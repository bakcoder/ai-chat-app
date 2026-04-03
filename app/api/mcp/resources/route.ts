import { NextRequest } from "next/server";
import mcpManager from "@/lib/mcp-manager";
import type { ReadResourceRequest } from "@/lib/mcp-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReadResourceRequest;

    if (!body.serverId || !body.uri) {
      return Response.json(
        { error: "serverId와 uri가 필요합니다." },
        { status: 400 },
      );
    }

    const result = await mcpManager.readResource(body.serverId, body.uri);
    return Response.json(result);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "리소스 읽기 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
