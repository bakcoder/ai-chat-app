export type ToolCallInfo = {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallInfo[];
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

const CONVERSATIONS_KEY = "ai-chat-conversations";
const LEGACY_KEY = "ai-chat-messages";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function titleFromMessages(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "새 대화";
  const text = first.content.trim();
  return text.length > 30 ? text.slice(0, 30) + "..." : text;
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Conversation[];
      return parsed.map((c) => ({
        ...c,
        messages: Array.isArray(c.messages) ? c.messages : [],
      }));
    }

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const msgs = JSON.parse(legacy) as Message[];
      if (msgs.length > 0) {
        const migrated: Conversation = {
          id: generateId(),
          title: titleFromMessages(msgs),
          messages: msgs,
          createdAt: Date.now(),
        };
        const list = [migrated];
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list));
        localStorage.removeItem(LEGACY_KEY);
        return list;
      }
    }

    return [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch {
    /* localStorage full or unavailable */
  }
}

export function createConversation(): Conversation {
  return {
    id: generateId(),
    title: "새 대화",
    messages: [],
    createdAt: Date.now(),
  };
}

export function updateConversationMessages(
  conversations: Conversation[],
  id: string,
  messages: Message[],
): Conversation[] {
  return conversations.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      messages,
      title: messages.length > 0 ? titleFromMessages(messages) : c.title,
    };
  });
}

export function deleteConversation(
  conversations: Conversation[],
  id: string,
): Conversation[] {
  return conversations.filter((c) => c.id !== id);
}
