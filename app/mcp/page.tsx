"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  Globe,
  Terminal,
  Plug,
  Unplug,
  Loader2,
  Wrench,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  loadMcpServers,
  saveMcpServer,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  type McpServer,
  type McpTransportType,
} from "../mcp-store";
import type {
  McpConnectionStateExtended,
  ConnectRequest,
} from "@/lib/mcp-types";
import Inspector from "./inspector";

type KeyValue = { key: string; value: string };

const EMPTY_FORM = {
  name: "",
  transport: "streamable-http" as McpTransportType,
  url: "",
  headers: [] as KeyValue[],
  command: "",
  args: [] as string[],
  env: [] as KeyValue[],
};

type FormState = typeof EMPTY_FORM;

function formFromServer(s: McpServer): FormState {
  return {
    name: s.name,
    transport: s.transport,
    url: s.httpConfig?.url ?? "",
    headers: Object.entries(s.httpConfig?.headers ?? {}).map(([key, value]) => ({
      key,
      value,
    })),
    command: s.stdioConfig?.command ?? "",
    args: s.stdioConfig?.args ?? [],
    env: Object.entries(s.stdioConfig?.env ?? {}).map(([key, value]) => ({
      key,
      value,
    })),
  };
}

function kvToRecord(pairs: KeyValue[]): Record<string, string> | undefined {
  const filtered = pairs.filter((p) => p.key.trim());
  if (filtered.length === 0) return undefined;
  return Object.fromEntries(filtered.map((p) => [p.key, p.value]));
}

const STATUS_DOT: Record<string, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500 animate-pulse",
  error: "bg-red-500",
  disconnected: "bg-zinc-400 dark:bg-zinc-600",
};

const STATUS_LABEL: Record<string, string> = {
  connected: "연결됨",
  connecting: "연결 중...",
  error: "오류",
  disconnected: "연결 안됨",
};

export default function McpPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [connectionStates, setConnectionStates] = useState<
    Record<string, McpConnectionStateExtended>
  >({});
  const [inspectorServerId, setInspectorServerId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadMcpServers().then(setServers);
  }, []);

  // Poll connection statuses
  useEffect(() => {
    async function fetchStatuses() {
      try {
        const res = await fetch("/api/mcp/status");
        if (res.ok) {
          const data = await res.json();
          setConnectionStates(data);
        }
      } catch {
        /* polling failure is non-critical */
      }
    }

    fetchStatuses();
    pollingRef.current = setInterval(fetchStatuses, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(server: McpServer) {
    setEditingId(server.id);
    setForm(formFromServer(server));
    setDialogOpen(true);
  }

  function handleDelete(id: string) {
    handleDisconnect(id);
    setServers((prev) => prev.filter((s) => s.id !== id));
    deleteMcpServer(id);
  }

  function isValid(): boolean {
    if (!form.name.trim()) return false;
    if (form.transport === "streamable-http" && !form.url.trim()) return false;
    if (form.transport === "stdio" && !form.command.trim()) return false;
    return true;
  }

  function handleSave() {
    if (!isValid()) return;

    const partialData = {
      name: form.name.trim(),
      transport: form.transport,
      httpConfig:
        form.transport === "streamable-http"
          ? { url: form.url.trim(), headers: kvToRecord(form.headers) }
          : undefined,
      stdioConfig:
        form.transport === "stdio"
          ? {
              command: form.command.trim(),
              args: form.args.filter((a) => a.trim()),
              env: kvToRecord(form.env),
            }
          : undefined,
    };

    if (editingId) {
      setServers((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, ...partialData, updatedAt: Date.now() }
            : s,
        ),
      );
      updateMcpServer(editingId, partialData);
    } else {
      const server = createMcpServer(partialData);
      setServers((prev) => [...prev, server]);
      saveMcpServer(server);
    }

    setDialogOpen(false);
  }

  async function handleConnect(server: McpServer) {
    setActionLoading((prev) => new Set(prev).add(server.id));

    const body: ConnectRequest = {
      serverId: server.id,
      transport: server.transport,
      httpConfig: server.httpConfig,
      stdioConfig: server.stdioConfig,
    };

    try {
      const res = await fetch("/api/mcp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const state: McpConnectionStateExtended = await res.json();
      setConnectionStates((prev) => ({ ...prev, [server.id]: state }));
    } catch {
      setConnectionStates((prev) => ({
        ...prev,
        [server.id]: {
          status: "error",
          error: "연결 요청에 실패했습니다.",
          tools: [],
          prompts: [],
          resources: [],
        },
      }));
    } finally {
      setActionLoading((prev) => {
        const next = new Set(prev);
        next.delete(server.id);
        return next;
      });
    }
  }

  async function handleDisconnect(serverId: string) {
    setActionLoading((prev) => new Set(prev).add(serverId));

    try {
      const res = await fetch("/api/mcp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });
      const state: McpConnectionStateExtended = await res.json();
      setConnectionStates((prev) => ({ ...prev, [serverId]: state }));
      if (inspectorServerId === serverId) setInspectorServerId(null);
    } catch {
      /* ignore */
    } finally {
      setActionLoading((prev) => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addKv(field: "headers" | "env") {
    setForm((prev) => ({
      ...prev,
      [field]: [...prev[field], { key: "", value: "" }],
    }));
  }

  function updateKv(field: "headers" | "env", idx: number, kv: KeyValue) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === idx ? kv : item)),
    }));
  }

  function removeKv(field: "headers" | "env", idx: number) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== idx),
    }));
  }

  function addArg() {
    setForm((prev) => ({ ...prev, args: [...prev.args, ""] }));
  }

  function updateArg(idx: number, value: string) {
    setForm((prev) => ({
      ...prev,
      args: prev.args.map((a, i) => (i === idx ? value : a)),
    }));
  }

  function removeArg(idx: number) {
    setForm((prev) => ({
      ...prev,
      args: prev.args.filter((_, i) => i !== idx),
    }));
  }

  const sorted = [...servers].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link href="/">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft />
            </Button>
          </Link>
          <h1 className="flex-1 text-lg font-semibold tracking-tight">
            MCP 서버 관리
          </h1>
          <Button size="sm" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            서버 추가
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Globe className="size-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              등록된 MCP 서버가 없습니다.
            </p>
            <Button size="sm" onClick={openCreate}>
              <Plus data-icon="inline-start" />
              첫 서버 추가
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {sorted.map((server) => {
              const connState = connectionStates[server.id];
              const status = connState?.status ?? "disconnected";
              const isLoading = actionLoading.has(server.id);
              const isConnected = status === "connected";

              return (
                <Card key={server.id} size="sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {server.transport === "streamable-http" ? (
                        <Globe className="size-4 text-muted-foreground" />
                      ) : (
                        <Terminal className="size-4 text-muted-foreground" />
                      )}
                      {server.name}
                      <span
                        className={`inline-block size-2 rounded-full ${STATUS_DOT[status]}`}
                        title={STATUS_LABEL[status]}
                      />
                      <span className="text-xs font-normal text-muted-foreground">
                        {STATUS_LABEL[status]}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {server.transport === "streamable-http"
                        ? server.httpConfig?.url
                        : server.stdioConfig?.command}
                      {status === "error" && connState?.error && (
                        <span className="block text-destructive text-xs mt-1">
                          {connState.error}
                        </span>
                      )}
                    </CardDescription>
                    <CardAction>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">
                          {server.transport === "streamable-http"
                            ? "HTTP"
                            : "stdio"}
                        </Badge>
                        {isConnected ? (
                          <>
                            <Button
                              variant={inspectorServerId === server.id ? "secondary" : "ghost"}
                              size="icon-xs"
                              onClick={() =>
                                setInspectorServerId((prev) =>
                                  prev === server.id ? null : server.id,
                                )
                              }
                              title="Inspector"
                            >
                              <Search />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleDisconnect(server.id)}
                              disabled={isLoading}
                              title="연결 해제"
                            >
                              {isLoading ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <Unplug />
                              )}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleConnect(server)}
                            disabled={isLoading || status === "connecting"}
                            title="연결"
                          >
                            {isLoading || status === "connecting" ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Plug />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEdit(server)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDelete(server.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </CardAction>
                  </CardHeader>

                  {/* Tools list for connected servers */}
                  {isConnected &&
                    connState?.tools &&
                    connState.tools.length > 0 && (
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Wrench className="size-3" />
                            사용 가능한 도구 ({connState.tools.length})
                          </div>
                          <div className="grid gap-1.5">
                            {connState.tools.map((tool) => (
                              <div
                                key={tool.name}
                                className="flex items-start gap-2 rounded-md border border-border/50 px-2.5 py-2"
                              >
                                <Badge variant="secondary" className="shrink-0 mt-0.5">
                                  {tool.name}
                                </Badge>
                                {tool.description && (
                                  <span className="text-xs text-muted-foreground leading-relaxed">
                                    {tool.description}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    )}

                  {/* Fallback content for non-connected servers */}
                  {!isConnected && (
                    <CardContent>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {server.transport === "streamable-http" &&
                          server.httpConfig?.headers &&
                          Object.keys(server.httpConfig.headers).length > 0 && (
                            <span>
                              헤더 {Object.keys(server.httpConfig.headers).length}개
                            </span>
                          )}
                        {server.transport === "stdio" && (
                          <>
                            {server.stdioConfig?.args &&
                              server.stdioConfig.args.length > 0 && (
                                <span>
                                  인자 {server.stdioConfig.args.length}개
                                </span>
                              )}
                            {server.stdioConfig?.env &&
                              Object.keys(server.stdioConfig.env).length >
                                0 && (
                                <span>
                                  환경변수{" "}
                                  {Object.keys(server.stdioConfig.env).length}개
                                </span>
                              )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {inspectorServerId && connectionStates[inspectorServerId]?.status === "connected" && (() => {
          const connState = connectionStates[inspectorServerId];
          const server = servers.find((s) => s.id === inspectorServerId);
          if (!server || !connState) return null;
          return (
            <div className="mt-6">
              <Inspector
                serverId={inspectorServerId}
                serverName={server.name}
                tools={connState.tools ?? []}
                prompts={connState.prompts ?? []}
                resources={connState.resources ?? []}
              />
            </div>
          );
        })()}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "서버 편집" : "서버 추가"}
            </DialogTitle>
            <DialogDescription>
              MCP 서버의 연결 정보를 설정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="server-name">서버 이름</Label>
              <Input
                id="server-name"
                placeholder="My MCP Server"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>전송 방식</Label>
              <Select
                value={form.transport}
                onValueChange={(val) =>
                  updateField("transport", val as McpTransportType)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="streamable-http">
                    Streamable HTTP
                  </SelectItem>
                  <SelectItem value="stdio">stdio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.transport === "streamable-http" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="server-url">URL</Label>
                  <Input
                    id="server-url"
                    placeholder="https://example.com/mcp"
                    value={form.url}
                    onChange={(e) => updateField("url", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>헤더</Label>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => addKv("headers")}
                    >
                      <Plus data-icon="inline-start" />
                      추가
                    </Button>
                  </div>
                  {form.headers.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder="Key"
                        value={h.key}
                        onChange={(e) =>
                          updateKv("headers", i, {
                            ...h,
                            key: e.target.value,
                          })
                        }
                        className="flex-1"
                      />
                      <Input
                        placeholder="Value"
                        value={h.value}
                        onChange={(e) =>
                          updateKv("headers", i, {
                            ...h,
                            value: e.target.value,
                          })
                        }
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeKv("headers", i)}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {form.transport === "stdio" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="server-command">명령어</Label>
                  <Input
                    id="server-command"
                    placeholder="npx -y @example/mcp-server"
                    value={form.command}
                    onChange={(e) => updateField("command", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>인자 (args)</Label>
                    <Button variant="ghost" size="xs" onClick={addArg}>
                      <Plus data-icon="inline-start" />
                      추가
                    </Button>
                  </div>
                  {form.args.map((arg, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder={`arg ${i + 1}`}
                        value={arg}
                        onChange={(e) => updateArg(i, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeArg(i)}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>환경 변수</Label>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => addKv("env")}
                    >
                      <Plus data-icon="inline-start" />
                      추가
                    </Button>
                  </div>
                  {form.env.map((e, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder="Key"
                        value={e.key}
                        onChange={(ev) =>
                          updateKv("env", i, { ...e, key: ev.target.value })
                        }
                        className="flex-1"
                      />
                      <Input
                        placeholder="Value"
                        value={e.value}
                        onChange={(ev) =>
                          updateKv("env", i, { ...e, value: ev.target.value })
                        }
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeKv("env", i)}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              취소
            </Button>
            <Button onClick={handleSave} disabled={!isValid()}>
              {editingId ? "저장" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
