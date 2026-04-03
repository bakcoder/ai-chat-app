"use client";

import { useState } from "react";
import {
  Wrench,
  MessageSquare,
  FileText,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  McpToolInfo,
  McpPromptInfo,
  McpResourceInfo,
  CallToolResponse,
  GetPromptResponse,
  ReadResourceResponse,
} from "@/lib/mcp-types";

type InspectorProps = {
  serverId: string;
  serverName: string;
  tools: McpToolInfo[];
  prompts: McpPromptInfo[];
  resources: McpResourceInfo[];
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button variant="ghost" size="icon-xs" onClick={handleCopy} title="복사">
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </Button>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  const text = JSON.stringify(data, null, 2);
  return (
    <div className="relative">
      <div className="absolute top-1 right-1">
        <CopyButton text={text} />
      </div>
      <pre className="rounded-md border bg-muted/50 p-3 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
        {text}
      </pre>
    </div>
  );
}

function buildFieldsFromSchema(
  schema?: Record<string, unknown>,
): { name: string; type: string; description?: string; required: boolean }[] {
  if (!schema || typeof schema !== "object") return [];
  const props = (schema.properties ?? {}) as Record<
    string,
    { type?: string; description?: string }
  >;
  const req = Array.isArray(schema.required)
    ? (schema.required as string[])
    : [];
  return Object.entries(props).map(([name, prop]) => ({
    name,
    type: prop.type ?? "string",
    description: prop.description,
    required: req.includes(name),
  }));
}

function ToolPanel({
  serverId,
  tool,
}: {
  serverId: string;
  tool: McpToolInfo;
}) {
  const fields = buildFieldsFromSchema(tool.inputSchema);
  const [values, setValues] = useState<Record<string, string>>({});
  const [rawJson, setRawJson] = useState("");
  const [useRawJson, setUseRawJson] = useState(fields.length === 0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CallToolResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    setError(null);

    let args: Record<string, unknown>;
    if (useRawJson) {
      try {
        args = rawJson.trim() ? JSON.parse(rawJson) : {};
      } catch {
        setError("JSON 파싱 오류");
        setLoading(false);
        return;
      }
    } else {
      args = {};
      for (const f of fields) {
        const val = values[f.name] ?? "";
        if (!val && f.required) {
          setError(`필수 필드 "${f.name}"을(를) 입력하세요.`);
          setLoading(false);
          return;
        }
        if (val) {
          if (f.type === "number" || f.type === "integer") {
            args[f.name] = Number(val);
          } else if (f.type === "boolean") {
            args[f.name] = val === "true";
          } else if (f.type === "object" || f.type === "array") {
            try {
              args[f.name] = JSON.parse(val);
            } catch {
              args[f.name] = val;
            }
          } else {
            args[f.name] = val;
          }
        }
      }
    }

    try {
      const res = await fetch("/api/mcp/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, toolName: tool.name, args }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "도구 호출 실패");
      } else {
        setResult(data);
      }
    } catch {
      setError("요청 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {tool.description && (
        <p className="text-xs text-muted-foreground">{tool.description}</p>
      )}

      {fields.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setUseRawJson(false)}
            className={`px-2 py-1 rounded-md transition-colors ${!useRawJson ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            폼 입력
          </button>
          <button
            onClick={() => setUseRawJson(true)}
            className={`px-2 py-1 rounded-md transition-colors ${useRawJson ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            JSON 입력
          </button>
        </div>
      )}

      {useRawJson ? (
        <div className="grid gap-2">
          <Label className="text-xs">Arguments (JSON)</Label>
          <Textarea
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            placeholder="{}"
            rows={4}
            className="font-mono text-xs"
          />
        </div>
      ) : (
        fields.map((f) => (
          <div key={f.name} className="grid gap-1.5">
            <Label className="text-xs">
              {f.name}
              {f.required && <span className="text-destructive ml-0.5">*</span>}
              <span className="text-muted-foreground ml-1 font-normal">
                ({f.type})
              </span>
            </Label>
            {f.description && (
              <p className="text-xs text-muted-foreground -mt-1">
                {f.description}
              </p>
            )}
            <Input
              value={values[f.name] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.name]: e.target.value }))
              }
              placeholder={f.type === "object" || f.type === "array" ? "JSON" : ""}
              className="text-xs h-8"
            />
          </div>
        ))
      )}

      <Button size="sm" onClick={handleRun} disabled={loading}>
        {loading ? <Loader2 className="animate-spin mr-1.5 size-3.5" /> : <Play className="mr-1.5 size-3.5" />}
        실행
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">결과</span>
            {result.isError && <Badge variant="destructive">오류</Badge>}
          </div>
          {result.content.map((c, i) => (
            <div key={i}>
              {c.type === "text" ? (
                <div className="relative">
                  <div className="absolute top-1 right-1">
                    <CopyButton text={c.text ?? ""} />
                  </div>
                  <pre className="rounded-md border bg-muted/50 p-3 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                    {c.text}
                  </pre>
                </div>
              ) : (
                <JsonBlock data={c} />
              )}
            </div>
          ))}
        </div>
      )}

      {tool.inputSchema && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group">
            <ChevronRight className="size-3 group-data-[state=open]:hidden" />
            <ChevronDown className="size-3 hidden group-data-[state=open]:block" />
            Input Schema
          </CollapsibleTrigger>
          <CollapsibleContent>
            <JsonBlock data={tool.inputSchema} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function PromptPanel({
  serverId,
  prompt,
}: {
  serverId: string;
  prompt: McpPromptInfo;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GetPromptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    setError(null);

    const args: Record<string, string> = {};
    for (const a of prompt.arguments ?? []) {
      const val = values[a.name] ?? "";
      if (!val && a.required) {
        setError(`필수 인자 "${a.name}"을(를) 입력하세요.`);
        setLoading(false);
        return;
      }
      if (val) args[a.name] = val;
    }

    try {
      const res = await fetch("/api/mcp/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, promptName: prompt.name, args }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "프롬프트 실행 실패");
      } else {
        setResult(data);
      }
    } catch {
      setError("요청 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {prompt.description && (
        <p className="text-xs text-muted-foreground">{prompt.description}</p>
      )}

      {(prompt.arguments ?? []).map((a) => (
        <div key={a.name} className="grid gap-1.5">
          <Label className="text-xs">
            {a.name}
            {a.required && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          {a.description && (
            <p className="text-xs text-muted-foreground -mt-1">
              {a.description}
            </p>
          )}
          <Input
            value={values[a.name] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [a.name]: e.target.value }))
            }
            className="text-xs h-8"
          />
        </div>
      ))}

      <Button size="sm" onClick={handleRun} disabled={loading}>
        {loading ? <Loader2 className="animate-spin mr-1.5 size-3.5" /> : <Play className="mr-1.5 size-3.5" />}
        실행
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <span className="text-xs font-medium">결과</span>
          {result.description && (
            <p className="text-xs text-muted-foreground">{result.description}</p>
          )}
          {result.messages.map((m, i) => (
            <div key={i} className="rounded-md border p-3 space-y-1">
              <Badge variant="outline" className="text-xs">
                {m.role}
              </Badge>
              {m.content.type === "text" ? (
                <pre className="text-xs leading-relaxed whitespace-pre-wrap break-all">
                  {m.content.text}
                </pre>
              ) : (
                <JsonBlock data={m.content} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourcePanel({
  serverId,
  resource,
}: {
  serverId: string;
  resource: McpResourceInfo;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReadResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRead() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/mcp/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, uri: resource.uri }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "리소스 읽기 실패");
      } else {
        setResult(data);
      }
    } catch {
      setError("요청 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <code className="rounded bg-muted px-1.5 py-0.5">{resource.uri}</code>
        {resource.mimeType && (
          <Badge variant="outline" className="text-xs">
            {resource.mimeType}
          </Badge>
        )}
      </div>
      {resource.description && (
        <p className="text-xs text-muted-foreground">{resource.description}</p>
      )}

      <Button size="sm" onClick={handleRead} disabled={loading}>
        {loading ? <Loader2 className="animate-spin mr-1.5 size-3.5" /> : <FileText className="mr-1.5 size-3.5" />}
        읽기
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <span className="text-xs font-medium">내용</span>
          {result.contents.map((c, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1.5 py-0.5">
                  {c.uri}
                </code>
                {c.mimeType && (
                  <Badge variant="outline" className="text-xs">
                    {c.mimeType}
                  </Badge>
                )}
              </div>
              {c.text != null ? (
                <div className="relative">
                  <div className="absolute top-1 right-1">
                    <CopyButton text={c.text} />
                  </div>
                  <pre className="rounded-md border bg-muted/50 p-3 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                    {c.text}
                  </pre>
                </div>
              ) : c.blob ? (
                <p className="text-xs text-muted-foreground">
                  바이너리 데이터 ({c.blob.length} chars, base64)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">내용 없음</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemList<T extends { name: string; description?: string }>({
  items,
  selected,
  onSelect,
  icon: Icon,
  emptyMessage,
}: {
  items: T[];
  selected: string | null;
  onSelect: (name: string) => void;
  icon: React.ComponentType<{ className?: string }>;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          key={item.name}
          onClick={() => onSelect(item.name)}
          className={`w-full flex items-start gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
            selected === item.name
              ? "bg-primary/10 text-primary"
              : "hover:bg-muted"
          }`}
        >
          <Icon className="size-3.5 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="font-medium block truncate">{item.name}</span>
            {item.description && (
              <span className="text-muted-foreground line-clamp-1">
                {item.description}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export default function Inspector({
  serverId,
  serverName,
  tools,
  prompts,
  resources,
}: InspectorProps) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);

  const activeTool = tools.find((t) => t.name === selectedTool);
  const activePrompt = prompts.find((p) => p.name === selectedPrompt);
  const activeResource = resources.find((r) => r.name === selectedResource);

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">
          Inspector — {serverName}
        </h3>
      </div>

      <Tabs defaultValue="tools" className="w-full">
        <div className="border-b px-4">
          <TabsList className="bg-transparent h-9 -mb-px">
            <TabsTrigger value="tools" className="text-xs gap-1.5 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Wrench className="size-3.5" />
              Tools ({tools.length})
            </TabsTrigger>
            <TabsTrigger value="prompts" className="text-xs gap-1.5 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <MessageSquare className="size-3.5" />
              Prompts ({prompts.length})
            </TabsTrigger>
            <TabsTrigger value="resources" className="text-xs gap-1.5 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <FileText className="size-3.5" />
              Resources ({resources.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tools" className="mt-0">
          <div className="grid md:grid-cols-[220px_1fr] min-h-[300px]">
            <ScrollArea className="border-r max-h-[400px]">
              <div className="p-2">
                <ItemList
                  items={tools}
                  selected={selectedTool}
                  onSelect={setSelectedTool}
                  icon={Wrench}
                  emptyMessage="사용 가능한 도구가 없습니다."
                />
              </div>
            </ScrollArea>
            <div className="p-4">
              {activeTool ? (
                <ToolPanel
                  key={activeTool.name}
                  serverId={serverId}
                  tool={activeTool}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  좌측에서 도구를 선택하세요.
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="mt-0">
          <div className="grid md:grid-cols-[220px_1fr] min-h-[300px]">
            <ScrollArea className="border-r max-h-[400px]">
              <div className="p-2">
                <ItemList
                  items={prompts}
                  selected={selectedPrompt}
                  onSelect={setSelectedPrompt}
                  icon={MessageSquare}
                  emptyMessage="사용 가능한 프롬프트가 없습니다."
                />
              </div>
            </ScrollArea>
            <div className="p-4">
              {activePrompt ? (
                <PromptPanel
                  key={activePrompt.name}
                  serverId={serverId}
                  prompt={activePrompt}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  좌측에서 프롬프트를 선택하세요.
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="mt-0">
          <div className="grid md:grid-cols-[220px_1fr] min-h-[300px]">
            <ScrollArea className="border-r max-h-[400px]">
              <div className="p-2">
                <ItemList
                  items={resources}
                  selected={selectedResource}
                  onSelect={(name) => setSelectedResource(name)}
                  icon={FileText}
                  emptyMessage="사용 가능한 리소스가 없습니다."
                />
              </div>
            </ScrollArea>
            <div className="p-4">
              {activeResource ? (
                <ResourcePanel
                  key={activeResource.name}
                  serverId={serverId}
                  resource={activeResource}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  좌측에서 리소스를 선택하세요.
                </p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
