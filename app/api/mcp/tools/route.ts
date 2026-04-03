import { NextRequest } from "next/server";
import mcpManager from "@/lib/mcp-manager";
import type { CallToolRequest } from "@/lib/mcp-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CallToolRequest;

    if (!body.serverId || !body.toolName) {
      return Response.json(
        { error: "serverId와 toolName이 필요합니다." },
        { status: 400 },
      );
    }

    const result = await mcpManager.callTool(
      body.serverId,
      body.toolName,
      body.args ?? {},
    );
    return Response.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "도구 호출 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
