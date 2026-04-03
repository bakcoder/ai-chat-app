import { supabase } from "@/lib/supabase";

export type McpTransportType = "streamable-http" | "stdio";

export type McpHttpConfig = {
  url: string;
  headers?: Record<string, string>;
};

export type McpStdioConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type McpServer = {
  id: string;
  name: string;
  transport: McpTransportType;
  httpConfig?: McpHttpConfig;
  stdioConfig?: McpStdioConfig;
  createdAt: number;
  updatedAt: number;
};

type McpServerRow = {
  id: string;
  name: string;
  transport: string;
  http_config: unknown;
  stdio_config: unknown;
  created_at: number;
  updated_at: number;
};

function rowToMcpServer(row: McpServerRow): McpServer {
  return {
    id: row.id,
    name: row.name,
    transport: row.transport as McpTransportType,
    httpConfig: (row.http_config as McpHttpConfig) ?? undefined,
    stdioConfig: (row.stdio_config as McpStdioConfig) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function loadMcpServers(): Promise<McpServer[]> {
  const { data, error } = await supabase
    .from("mcp_servers")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return (data as McpServerRow[]).map(rowToMcpServer);
}

export function createMcpServer(
  data: Omit<McpServer, "id" | "createdAt" | "updatedAt">,
): McpServer {
  const now = Date.now();
  return { ...data, id: generateId(), createdAt: now, updatedAt: now };
}

export async function saveMcpServer(server: McpServer): Promise<void> {
  await supabase.from("mcp_servers").upsert({
    id: server.id,
    name: server.name,
    transport: server.transport,
    http_config: server.httpConfig ?? null,
    stdio_config: server.stdioConfig ?? null,
    created_at: server.createdAt,
    updated_at: server.updatedAt,
  });
}

export async function updateMcpServer(
  id: string,
  data: Partial<Omit<McpServer, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: Date.now() };
  if (data.name !== undefined) update.name = data.name;
  if (data.transport !== undefined) update.transport = data.transport;
  if (data.httpConfig !== undefined) update.http_config = data.httpConfig ?? null;
  if (data.stdioConfig !== undefined) update.stdio_config = data.stdioConfig ?? null;

  await supabase.from("mcp_servers").update(update).eq("id", id);
}

export async function deleteMcpServer(id: string): Promise<void> {
  await supabase.from("mcp_servers").delete().eq("id", id);
}
