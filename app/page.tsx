"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "./sidebar";
import Chat from "./chat";
import Weather from "./weather";
import {
  loadConversations,
  saveConversation,
  createConversation,
  updateConversationMessages,
  deleteConversation as deleteConv,
  type Message,
  type Conversation,
} from "./store";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadConversations().then((data) => {
      setConversations(data);
      if (data.length > 0) {
        setActiveId(data[0].id);
      }
      setIsLoading(false);
    });
  }, []);

  const handleNew = useCallback(async () => {
    const conv = createConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    await saveConversation(conv);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (activeId === id) {
          setActiveId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
      await deleteConv(id);
    },
    [activeId],
  );

  const handleMessagesChange = useCallback(
    (messages: Message[]) => {
      if (!activeId) return;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeId) return c;
          const title =
            messages.length > 0
              ? (() => {
                  const first = messages.find((m) => m.role === "user");
                  if (!first) return c.title;
                  const text = first.content.trim();
                  return text.length > 30 ? text.slice(0, 30) + "..." : text;
                })()
              : c.title;
          return { ...c, messages, title };
        }),
      );
      updateConversationMessages(activeId, messages);
    },
    [activeId],
  );

  const activeConversation = conversations.find((c) => c.id === activeId);

  if (isLoading) {
    return <div className="flex flex-1 h-full bg-white dark:bg-zinc-950" />;
  }

  return (
    <div className="flex flex-1 h-full bg-white dark:bg-zinc-950">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNew}
        onDelete={handleDelete}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex flex-1 flex-col min-w-0">
        {activeConversation ? (
          <Chat
            key={activeConversation.id}
            messages={activeConversation.messages ?? []}
            onMessagesChange={handleMessagesChange}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-zinc-400 dark:text-zinc-600 text-sm mb-4">
                대화를 선택하거나 새 대화를 시작하세요.
              </p>
              <button
                onClick={handleNew}
                className="text-sm px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition"
              >
                새 대화 시작
              </button>
            </div>
          </div>
        )}
      </main>

      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            오늘의 날씨
          </span>
        </div>
        <Weather />
      </aside>
    </div>
  );
}
