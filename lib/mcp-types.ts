export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type McpToolInfo = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export type McpConnectionState = {
  status: ConnectionStatus;
  error?: string;
  tools: McpToolInfo[];
};

export type ConnectRequest = {
  serverId: string;
  transport: "streamable-http" | "stdio";
  httpConfig?: { url: string; headers?: Record<string, string> };
  stdioConfig?: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
};

export type DisconnectRequest = {
  serverId: string;
};

// -- Inspector types --

export type McpPromptInfo = {
  name: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
};

export type McpResourceInfo = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

export type McpPromptMessage = {
  role: string;
  content: { type: string; text?: string; [key: string]: unknown };
};

export type CallToolRequest = {
  serverId: string;
  toolName: string;
  args: Record<string, unknown>;
};

export type CallToolResponse = {
  content: { type: string; text?: string; [key: string]: unknown }[];
  isError?: boolean;
};

export type GetPromptRequest = {
  serverId: string;
  promptName: string;
  args: Record<string, string>;
};

export type GetPromptResponse = {
  description?: string;
  messages: McpPromptMessage[];
};

export type ReadResourceRequest = {
  serverId: string;
  uri: string;
};

export type ReadResourceResponse = {
  contents: { uri: string; mimeType?: string; text?: string; blob?: string }[];
};

export type McpConnectionStateExtended = McpConnectionState & {
  prompts: McpPromptInfo[];
  resources: McpResourceInfo[];
};
