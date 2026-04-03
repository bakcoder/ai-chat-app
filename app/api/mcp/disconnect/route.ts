import { NextRequest } from "next/server";
import mcpManager from "@/lib/mcp-manager";
import type { DisconnectRequest } from "@/lib/mcp-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DisconnectRequest;

    if (!body.serverId) {
      return Response.json({ error: "serverId가 필요합니다." }, { status: 400 });
    }

    const state = await mcpManager.disconnect(body.serverId);
    return Response.json(state);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "해제 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
