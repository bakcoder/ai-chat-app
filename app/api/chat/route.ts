import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  type Content,
  type FunctionDeclaration,
  type Part,
} from "@google/genai";
import { NextRequest } from "next/server";
import mcpManager from "@/lib/mcp-manager";

export const runtime = "nodejs";

const MODEL = "gemini-2.0-flash";
const MAX_TOOL_ROUNDS = 5;

type Message = {
  role: "user" | "assistant";
  content: string;
};

function getApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
}

function cleanSchema(
  schema: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!schema) return undefined;
  const cleaned = { ...schema };
  delete cleaned["$schema"];
  delete cleaned["additionalProperties"];
  if (cleaned.properties && typeof cleaned.properties === "object") {
    const props = { ...cleaned.properties } as Record<
      string,
      Record<string, unknown>
    >;
    for (const key of Object.keys(props)) {
      const p = { ...props[key] };
      delete p["$schema"];
      delete p["additionalProperties"];
      props[key] = p;
    }
    cleaned.properties = props;
  }
  return cleaned;
}

function buildToolDeclarations(enabledServerIds?: string[]): {
  declarations: FunctionDeclaration[];
  serverMap: Map<string, string>;
} {
  const declarations: FunctionDeclaration[] = [];
  const serverMap = new Map<string, string>();
  const states = mcpManager.getAllStates();
  const seen = new Set<string>();

  for (const [serverId, state] of Object.entries(states)) {
    if (state.status !== "connected") continue;
    if (enabledServerIds && !enabledServerIds.includes(serverId)) continue;
    for (const tool of state.tools) {
      if (seen.has(tool.name)) continue;
      seen.add(tool.name);

      const uniqueName = `${serverId}__${tool.name}`;
      serverMap.set(uniqueName, serverId);
      declarations.push({
        name: uniqueName,
        description: tool.description ?? tool.name,
        parameters: cleanSchema(
          tool.inputSchema as Record<string, unknown> | undefined,
        ),
      });
    }
  }
  return { declarations, serverMap };
}

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; serverId: string }
  | { type: "tool_result"; name: string; result: string; isError?: boolean }
  | { type: "error"; message: string }
  | { type: "done" };

export async function POST(request: NextRequest) {
  const apiKey = getApiKey();

  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY가 설정되지 않았습니다. .env.local을 확인해주세요." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const messages: Message[] = body.messages ?? [];
  const enabledServerIds: string[] | undefined = body.mcpServerIds;
  const mcpEnabled: boolean = body.mcpEnabled ?? true;

  if (messages.length === 0) {
    return Response.json(
      { error: "메시지가 비어있습니다." },
      { status: 400 },
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const contents: Content[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const { declarations, serverMap } = mcpEnabled
    ? buildToolDeclarations(enabledServerIds)
    : { declarations: [] as FunctionDeclaration[], serverMap: new Map<string, string>() };
  const hasTools = declarations.length > 0;

  const config = hasTools
    ? {
        tools: [{ functionDeclarations: declarations }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
        },
      }
    : {};

  const encoder = new TextEncoder();

  function sendEvent(controller: ReadableStreamDefaultController, event: StreamEvent) {
    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let currentContents = [...contents];

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = await ai.models.generateContent({
            model: MODEL,
            contents: currentContents,
            config,
          });

          const parts = response.candidates?.[0]?.content?.parts ?? [];
          const functionCalls = parts.filter(
            (p): p is Part & { functionCall: NonNullable<Part["functionCall"]> } =>
              !!p.functionCall,
          );

          if (functionCalls.length === 0) {
            const text = parts
              .map((p) => p.text ?? "")
              .filter(Boolean)
              .join("");
            if (text) sendEvent(controller, { type: "text", text });
            sendEvent(controller, { type: "done" });
            controller.close();
            return;
          }

          currentContents.push({
            role: "model",
            parts: functionCalls.map((fc) => ({ functionCall: fc.functionCall })),
          });

          const responseParts: Part[] = [];
          for (const fc of functionCalls) {
            const uniqueName = fc.functionCall.name!;
            const serverId = serverMap.get(uniqueName);
            const originalName = uniqueName.includes("__")
              ? uniqueName.split("__").slice(1).join("__")
              : uniqueName;

            sendEvent(controller, {
              type: "tool_call",
              name: originalName,
              args: (fc.functionCall.args as Record<string, unknown>) ?? {},
              serverId: serverId ?? "unknown",
            });

            let resultObj: Record<string, unknown>;
            let resultText = "";
            let isError = false;

            if (!serverId) {
              resultObj = { error: `서버를 찾을 수 없습니다: ${uniqueName}` };
              resultText = resultObj.error as string;
              isError = true;
            } else {
              try {
                const toolResult = await mcpManager.callTool(
                  serverId,
                  originalName,
                  (fc.functionCall.args as Record<string, unknown>) ?? {},
                );
                resultText = toolResult.content
                  .filter((c) => c.type === "text")
                  .map((c) => c.text)
                  .join("\n");
                resultObj = { result: resultText || JSON.stringify(toolResult.content) };
                isError = toolResult.isError ?? false;
              } catch (err) {
                const msg = err instanceof Error ? err.message : "도구 호출에 실패했습니다.";
                resultObj = { error: msg };
                resultText = msg;
                isError = true;
              }
            }

            sendEvent(controller, {
              type: "tool_result",
              name: originalName,
              result: resultText || JSON.stringify(resultObj),
              isError,
            });

            responseParts.push({
              functionResponse: {
                name: uniqueName,
                response: resultObj,
              },
            });
          }

          currentContents.push({ role: "user", parts: responseParts });
        }

        const finalResponse = await ai.models.generateContentStream({
          model: MODEL,
          contents: currentContents,
          config,
        });
        for await (const chunk of finalResponse) {
          if (chunk.text) sendEvent(controller, { type: "text", text: chunk.text });
        }
        sendEvent(controller, { type: "done" });
        controller.close();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "응답 생성 중 오류가 발생했습니다.";
        sendEvent(controller, { type: "error", message });
        sendEvent(controller, { type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
