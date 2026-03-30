"use client";

type ChatRealtimeEvent =
  | { type: "chat_created"; chatId: string }
  | { type: "message_created"; chatId: string };

type ChatRealtimeEventMessage = ChatRealtimeEvent & { sourceId: string };

const CHANNEL_NAME = "gpt-chat-clone-realtime";

let channel: BroadcastChannel | null = null;
const SOURCE_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `source-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function getChannel() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }

  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }

  return channel;
}

export function publishChatRealtimeEvent(event: ChatRealtimeEvent) {
  const target = getChannel();
  if (!target) return;
  target.postMessage({ ...event, sourceId: SOURCE_ID });
}

export function subscribeChatRealtimeEvents(handler: (event: ChatRealtimeEvent) => void) {
  const target = getChannel();
  if (!target) {
    return () => {};
  }

  const listener = (message: MessageEvent<ChatRealtimeEventMessage>) => {
    if (!message?.data) return;
    if (message.data.sourceId === SOURCE_ID) return;
    const { sourceId, ...event } = message.data;
    void sourceId;
    handler(event);
  };

  target.addEventListener("message", listener);
  return () => {
    target.removeEventListener("message", listener);
  };
}
