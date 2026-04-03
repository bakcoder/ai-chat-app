import { supabase } from "@/lib/supabase";

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

type ConversationRow = {
  id: string;
  title: string;
  messages: unknown;
  created_at: number;
};

function rowToConversation(row: ConversationRow): Conversation {
  const messages = Array.isArray(row.messages)
    ? (row.messages as Message[])
    : [];
  return {
    id: row.id,
    title: row.title,
    messages,
    createdAt: row.created_at,
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function titleFromMessages(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "새 대화";
  const text = first.content.trim();
  return text.length > 30 ? text.slice(0, 30) + "..." : text;
}

export async function loadConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as ConversationRow[]).map(rowToConversation);
}

export function createConversation(): Conversation {
  return {
    id: generateId(),
    title: "새 대화",
    messages: [],
    createdAt: Date.now(),
  };
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await supabase.from("conversations").upsert({
    id: conv.id,
    title: conv.title,
    messages: conv.messages,
    created_at: conv.createdAt,
  });
}

export async function updateConversationMessages(
  id: string,
  messages: Message[],
): Promise<void> {
  const title = messages.length > 0 ? titleFromMessages(messages) : "새 대화";
  await supabase
    .from("conversations")
    .update({ messages, title })
    .eq("id", id);
}

export async function deleteConversation(id: string): Promise<void> {
  await supabase.from("conversations").delete().eq("id", id);
}
