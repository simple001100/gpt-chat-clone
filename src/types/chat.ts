export type ChatRole = "user" | "assistant" | "system";

export type ChatRecord = {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
};

export type MessageRecord = {
  id: string;
  chat_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
};
