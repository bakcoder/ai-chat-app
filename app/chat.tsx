"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
} from "react";
import Link from "next/link";
import { Settings, Wrench, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import Markdown from "./markdown";
import type { Message, ToolCallInfo } from "./store";
import type { McpConnectionStateExtended } from "@/lib/mcp-types";

type ChatProps = {
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
  onToggleSidebar: () => void;
};

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; serverId: string }
  | { type: "tool_result"; name: string; result: string; isError?: boolean }
  | { type: "error"; message: string }
  | { type: "done" };

function ToolCallDisplay({ calls }: { calls: ToolCallInfo[] }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (calls.length === 0) return null;

  return (
    <div className="space-y-1.5 mb-2">
      {calls.map((call, i) => {
        const isOpen = expanded[i] ?? false;
        const isDone = call.result !== undefined;

        return (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs"
          >
            <button
              onClick={() =>
                setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))
              }
              className="flex items-center gap-1.5 w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
            >
              {isDone ? (
                call.isError ? (
                  <span className="size-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 text-[10px] font-bold shrink-0">!</span>
                ) : (
                  <span className="size-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
                    <svg className="size-2.5" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                )
              ) : (
                <Loader2 className="size-3.5 animate-spin text-zinc-400 shrink-0" />
              )}
              <Wrench className="size-3 text-zinc-500 shrink-0" />
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {call.name}
              </span>
              <span className="ml-auto text-zinc-400">
                {isOpen ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </span>
            </button>
            {isOpen && (
              <div className="px-3 py-2 space-y-1.5 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                <div>
                  <span className="text-zinc-400 text-[10px] uppercase tracking-wider">arguments</span>
                  <pre className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-all">
                    {JSON.stringify(call.args, null, 2)}
                  </pre>
                </div>
                {call.result !== undefined && (
                  <div>
                    <span className={`text-[10px] uppercase tracking-wider ${call.isError ? "text-red-400" : "text-zinc-400"}`}>
                      {call.isError ? "error" : "result"}
                    </span>
                    <pre className={`mt-0.5 text-[11px] whitespace-pre-wrap break-all ${call.isError ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}`}>
                      {call.result}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function McpToggle({
  enabled,
  onToggle,
  connectedCount,
}: {
  enabled: boolean;
  onToggle: () => void;
  connectedCount: number;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
        enabled
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
      }`}
      title={enabled ? "MCP 도구 비활성화" : "MCP 도구 활성화"}
    >
      <Wrench className="size-3.5" />
      <span>MCP {enabled ? "ON" : "OFF"}</span>
      {enabled && connectedCount > 0 && (
        <span className="bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-full px-1.5 text-[10px]">
          {connectedCount}
        </span>
      )}
    </button>
  );
}

export default function Chat({
  messages,
  onMessagesChange,
  onToggleSidebar,
}: ChatProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [mcpEnabled, setMcpEnabled] = useState(true);
  const [connectedCount, setConnectedCount] = useState(0);
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallInfo[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingToolCalls]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/mcp/status");
        if (!res.ok) return;
        const data: Record<string, McpConnectionStateExtended> = await res.json();
        const count = Object.values(data).filter((s) => s.status === "connected").length;
        setConnectedCount(count);
      } catch {
        /* ignore */
      }
    }
    fetchCount();
    const id = setInterval(fetchCount, 5000);
    return () => clearInterval(id);
  }, []);

  function getInputText(): string {
    return textareaRef.current?.value.trim() ?? "";
  }

  function clearInput() {
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
  }

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = getInputText();
      if (!text || isStreaming) return;

      const userMsg: Message = { role: "user", content: text };
      const updated = [...messages, userMsg];
      onMessagesChange(updated);
      clearInput();
      setIsStreaming(true);
      setPendingToolCalls([]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updated.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            mcpEnabled,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errBody = await res.json().catch(() => null);
          const errText = errBody?.error ?? `서버 오류 (${res.status})`;
          onMessagesChange([
            ...updated,
            { role: "assistant", content: errText },
          ]);
          setIsStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        let buffer = "";
        const toolCalls: ToolCallInfo[] = [];

        onMessagesChange([...updated, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: StreamEvent;
            try {
              event = JSON.parse(line);
            } catch {
              assistantContent += line;
              onMessagesChange([
                ...updated,
                { role: "assistant", content: assistantContent, toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined },
              ]);
              continue;
            }

            switch (event.type) {
              case "text":
                assistantContent += event.text;
                onMessagesChange([
                  ...updated,
                  { role: "assistant", content: assistantContent, toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined },
                ]);
                break;
              case "tool_call":
                toolCalls.push({
                  name: event.name,
                  args: event.args,
                });
                setPendingToolCalls([...toolCalls]);
                break;
              case "tool_result": {
                const tc = toolCalls.find(
                  (t) => t.name === event.name && t.result === undefined,
                );
                if (tc) {
                  tc.result = event.result;
                  tc.isError = event.isError;
                }
                setPendingToolCalls([...toolCalls]);
                break;
              }
              case "error":
                assistantContent += `\n[오류] ${event.message}`;
                onMessagesChange([
                  ...updated,
                  { role: "assistant", content: assistantContent, toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined },
                ]);
                break;
              case "done":
                break;
            }
          }
        }

        onMessagesChange([
          ...updated,
          {
            role: "assistant",
            content: assistantContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          },
        ]);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        onMessagesChange([
          ...updated,
          { role: "assistant", content: "네트워크 오류가 발생했습니다." },
        ]);
      } finally {
        setIsStreaming(false);
        setPendingToolCalls([]);
        abortRef.current = null;
      }
    },
    [isStreaming, messages, onMessagesChange, mcpEnabled],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  return (
    <div className="flex flex-1 flex-col h-full w-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors md:hidden"
          aria-label="메뉴"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <h1 className="flex-1 text-lg font-semibold tracking-tight">AI Chat</h1>
        <McpToggle
          enabled={mcpEnabled}
          onToggle={() => setMcpEnabled((v) => !v)}
          connectedCount={connectedCount}
        />
        <Link
          href="/mcp"
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="MCP 서버 설정"
        >
          <Settings className="w-5 h-5" />
        </Link>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center h-full">
            <p className="text-zinc-400 dark:text-zinc-600 text-center text-sm">
              메시지를 입력하면 AI가 응답합니다.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <ToolCallDisplay calls={msg.toolCalls} />
                )}
                <Markdown content={msg.content} />
                {i === messages.length - 1 && isStreaming && !msg.content && pendingToolCalls.length === 0 && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse rounded-sm" />
                )}
              </div>
            )}
          </div>
        ))}

        {/* Pending tool calls (shown during streaming before final message) */}
        {isStreaming && pendingToolCalls.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
              <ToolCallDisplay calls={pendingToolCalls} />
              {messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content && (
                <Markdown content={messages[messages.length - 1].content} />
              )}
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse rounded-sm" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3"
      >
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            ref={textareaRef}
            defaultValue=""
            onChange={(e) => autoResize(e.target)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={isStreaming}
            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-40 hover:opacity-80 transition"
            aria-label="전송"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
