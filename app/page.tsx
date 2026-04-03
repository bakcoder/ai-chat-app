"use client";

import { useState, useEffect, useSyncExternalStore, useCallback } from "react";
import Sidebar from "./sidebar";
import Chat from "./chat";
import Weather from "./weather";
import {
  loadConversations,
  saveConversations,
  createConversation,
  updateConversationMessages,
  deleteConversation,
  type Message,
  type Conversation,
} from "./store";

const emptyConvs: Conversation[] = [];
let listeners: Array<() => void> = [];
let clientSnapshot: Conversation[] = emptyConvs;

function getClientSnapshot(): Conversation[] {
  return clientSnapshot;
}

function getServerSnapshot(): Conversation[] {
  return emptyConvs;
}

function subscribe(cb: () => void): () => void {
  listeners = [...listeners, cb];
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function notifyListeners() {
  for (const l of listeners) l();
}

function emitChange(next: Conversation[]) {
  clientSnapshot = next;
  saveConversations(next);
  notifyListeners();
}

export default function Home() {
  const conversations = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const isHydrated = conversations !== emptyConvs;

  useEffect(() => {
    if (clientSnapshot === emptyConvs) {
      clientSnapshot = loadConversations();
      notifyListeners();
    }
  }, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeInitialized, setActiveInitialized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isHydrated && !activeInitialized) {
    if (conversations.length > 0 && activeId === null) {
      const sorted = [...conversations].sort((a, b) => b.createdAt - a.createdAt);
      setActiveId(sorted[0].id);
    }
    setActiveInitialized(true);
  }

  const persist = useCallback((next: Conversation[]) => {
    emitChange(next);
  }, []);

  const handleNew = useCallback(() => {
    const conv = createConversation();
    const next = [conv, ...conversations];
    persist(next);
    setActiveId(conv.id);
  }, [conversations, persist]);

  const handleDelete = useCallback(
    (id: string) => {
      const next = deleteConversation(conversations, id);
      persist(next);
      if (activeId === id) {
        const sorted = [...next].sort((a, b) => b.createdAt - a.createdAt);
        setActiveId(sorted.length > 0 ? sorted[0].id : null);
      }
    },
    [conversations, activeId, persist],
  );

  const handleMessagesChange = useCallback(
    (messages: Message[]) => {
      if (!activeId) return;
      const next = updateConversationMessages(conversations, activeId, messages);
      persist(next);
    },
    [activeId, conversations, persist],
  );

  const activeConversation = conversations.find((c) => c.id === activeId);

  if (!isHydrated) {
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

      {/* Right sidebar - weather */}
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
