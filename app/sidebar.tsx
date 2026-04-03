"use client";

import type { Conversation } from "./store";

type SidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
};

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onClose,
}: SidebarProps) {
  const sorted = [...conversations].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 flex flex-col
          bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800
          transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            대화 목록
          </span>
          <button
            onClick={onNew}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-80 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            새 대화
          </button>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {sorted.length === 0 && (
            <p className="px-3 py-4 text-xs text-zinc-400 dark:text-zinc-600 text-center">
              대화가 없습니다.
            </p>
          )}
          {sorted.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 mx-2 mb-0.5 rounded-lg cursor-pointer transition-colors ${
                conv.id === activeId
                  ? "bg-zinc-200 dark:bg-zinc-800"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
              }`}
            >
              <button
                onClick={() => {
                  onSelect(conv.id);
                  onClose();
                }}
                className="flex-1 text-left px-3 py-2.5 min-w-0"
              >
                <span className="block text-sm truncate text-zinc-800 dark:text-zinc-200">
                  {conv.title}
                </span>
                <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {new Date(conv.createdAt).toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className="shrink-0 p-1.5 mr-2 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
                aria-label="대화 삭제"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5"
                >
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
