import {
  Client,
  StreamableHTTPClientTransport,
  StdioClientTransport,
} from "@modelcontextprotocol/client";
import type {
  ConnectRequest,
  ConnectionStatus,
  McpConnectionStateExtended,
  McpToolInfo,
  McpPromptInfo,
  McpResourceInfo,
  CallToolResponse,
  GetPromptResponse,
  ReadResourceResponse,
} from "./mcp-types";

type McpConnection = {
  client: Client;
  status: ConnectionStatus;
  error?: string;
  tools: McpToolInfo[];
  prompts: McpPromptInfo[];
  resources: McpResourceInfo[];
};

class McpManager {
  private connections = new Map<string, McpConnection>();

  async connect(config: ConnectRequest): Promise<McpConnectionStateExtended> {
    const existing = this.connections.get(config.serverId);
    if (existing?.status === "connected") {
      return this.toState(existing);
    }

    if (existing?.status === "connecting") {
      return this.toState(existing);
    }

    // Clean up previous failed connection
    if (existing) {
      try {
        await existing.client.close();
      } catch {
        /* ignore */
      }
    }

    const conn: McpConnection = {
      client: new Client({ name: "ai-chat-app", version: "0.1.0" }),
      status: "connecting",
      tools: [],
      prompts: [],
      resources: [],
    };
    this.connections.set(config.serverId, conn);

    try {
      const transport = this.createTransport(config);
      await conn.client.connect(transport);
      conn.status = "connected";

      await this.refreshCapabilities(conn);

      return this.toState(conn);
    } catch (err) {
      conn.status = "error";
      conn.error =
        err instanceof Error ? err.message : "연결에 실패했습니다.";
      return this.toState(conn);
    }
  }

  async disconnect(serverId: string): Promise<McpConnectionStateExtended> {
    const conn = this.connections.get(serverId);
    if (!conn) {
      return { status: "disconnected", tools: [], prompts: [], resources: [] };
    }

    try {
      await conn.client.close();
    } catch {
      /* ignore */
    }

    this.connections.delete(serverId);
    return { status: "disconnected", tools: [], prompts: [], resources: [] };
  }

  getState(serverId: string): McpConnectionStateExtended {
    const conn = this.connections.get(serverId);
    if (!conn) return { status: "disconnected", tools: [], prompts: [], resources: [] };
    return this.toState(conn);
  }

  getAllStates(): Record<string, McpConnectionStateExtended> {
    const result: Record<string, McpConnectionStateExtended> = {};
    for (const [id, conn] of this.connections) {
      result[id] = this.toState(conn);
    }
    return result;
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResponse> {
    const conn = this.getConnection(serverId);
    const result = await conn.client.callTool({ name: toolName, arguments: args });
    return {
      content: (result.content ?? []) as CallToolResponse["content"],
      isError: result.isError,
    };
  }

  async listPrompts(serverId: string): Promise<McpPromptInfo[]> {
    const conn = this.getConnection(serverId);
    const { prompts } = await conn.client.listPrompts();
    return prompts.map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    }));
  }

  async getPrompt(
    serverId: string,
    promptName: string,
    args: Record<string, string>,
  ): Promise<GetPromptResponse> {
    const conn = this.getConnection(serverId);
    const result = await conn.client.getPrompt({ name: promptName, arguments: args });
    return {
      description: result.description,
      messages: (result.messages ?? []) as GetPromptResponse["messages"],
    };
  }

  async listResources(serverId: string): Promise<McpResourceInfo[]> {
    const conn = this.getConnection(serverId);
    const { resources } = await conn.client.listResources();
    return resources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }));
  }

  async readResource(
    serverId: string,
    uri: string,
  ): Promise<ReadResourceResponse> {
    const conn = this.getConnection(serverId);
    const result = await conn.client.readResource({ uri });
    return {
      contents: (result.contents ?? []) as ReadResourceResponse["contents"],
    };
  }

  private getConnection(serverId: string): McpConnection {
    const conn = this.connections.get(serverId);
    if (!conn || conn.status !== "connected") {
      throw new Error("서버가 연결되어 있지 않습니다.");
    }
    return conn;
  }

  private async refreshCapabilities(conn: McpConnection) {
    const [toolsResult, promptsResult, resourcesResult] = await Promise.allSettled([
      conn.client.listTools(),
      conn.client.listPrompts(),
      conn.client.listResources(),
    ]);

    if (toolsResult.status === "fulfilled") {
      conn.tools = toolsResult.value.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown> | undefined,
      }));
    }

    if (promptsResult.status === "fulfilled") {
      conn.prompts = promptsResult.value.prompts.map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments,
      }));
    }

    if (resourcesResult.status === "fulfilled") {
      conn.resources = resourcesResult.value.resources.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      }));
    }
  }

  private createTransport(config: ConnectRequest) {
    if (config.transport === "streamable-http") {
      if (!config.httpConfig?.url) {
        throw new Error("HTTP URL이 필요합니다.");
      }
      return new StreamableHTTPClientTransport(
        new URL(config.httpConfig.url),
        {
          requestInit: config.httpConfig.headers
            ? { headers: config.httpConfig.headers }
            : undefined,
        },
      );
    }

    if (!config.stdioConfig?.command) {
      throw new Error("명령어(command)가 필요합니다.");
    }
    const baseEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) baseEnv[k] = v;
    }

    return new StdioClientTransport({
      command: config.stdioConfig.command,
      args: config.stdioConfig.args,
      env: config.stdioConfig.env
        ? { ...baseEnv, ...config.stdioConfig.env }
        : undefined,
    });
  }

  private toState(conn: McpConnection): McpConnectionStateExtended {
    return {
      status: conn.status,
      error: conn.error,
      tools: conn.tools,
      prompts: conn.prompts,
      resources: conn.resources,
    };
  }
}

declare const globalThis: {
  __mcpManager?: McpManager;
} & typeof global;

const mcpManager = globalThis.__mcpManager ?? new McpManager();
globalThis.__mcpManager = mcpManager;

export default mcpManager;
