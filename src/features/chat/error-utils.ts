type UserErrorMessages = {
  fallback: string;
  anonymousLimit: string;
  quota: string;
  fileTooLarge: string;
  chatNotFound: string;
  unauthorized: string;
  network: string;
};

export function toUserErrorMessage(
  error: unknown,
  messages: UserErrorMessages,
  fallbackOverride?: string,
) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const text = raw.toLowerCase();

  if (text.includes("anonymous question limit reached")) {
    return messages.anonymousLimit;
  }

  if (
    text.includes("resource_exhausted") ||
    text.includes("quota exceeded") ||
    text.includes("too many requests") ||
    text.includes(" 429")
  ) {
    return messages.quota;
  }

  if (text.includes("file is too large")) {
    return messages.fileTooLarge;
  }

  if (text.includes("chat not found")) {
    return messages.chatNotFound;
  }

  if (text.includes("unauthorized")) {
    return messages.unauthorized;
  }

  if (text.includes("failed to fetch") || text.includes("networkerror")) {
    return messages.network;
  }

  return fallbackOverride ?? messages.fallback;
}
