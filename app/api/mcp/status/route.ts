import mcpManager from "@/lib/mcp-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const states = mcpManager.getAllStates();
  return Response.json(states);
}
