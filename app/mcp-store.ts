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

const STORAGE_KEY = "mcp-servers";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function loadMcpServers(): McpServer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as McpServer[];
    return [];
  } catch {
    return [];
  }
}

export function saveMcpServers(servers: McpServer[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
  } catch {
    /* localStorage full or unavailable */
  }
}

export function createMcpServer(
  data: Omit<McpServer, "id" | "createdAt" | "updatedAt">,
): McpServer {
  const now = Date.now();
  return { ...data, id: generateId(), createdAt: now, updatedAt: now };
}

export function updateMcpServer(
  servers: McpServer[],
  id: string,
  data: Partial<Omit<McpServer, "id" | "createdAt" | "updatedAt">>,
): McpServer[] {
  return servers.map((s) => {
    if (s.id !== id) return s;
    return { ...s, ...data, updatedAt: Date.now() };
  });
}

export function deleteMcpServer(servers: McpServer[], id: string): McpServer[] {
  return servers.filter((s) => s.id !== id);
}
