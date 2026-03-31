import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey, getGeminiDefaultModel } from "@/lib/env";
import type { ChatRole } from "@/types/chat";

export type GeminiMessage = {
  role: ChatRole;
  content: string;
};

type StreamCallbacks = {
  onToken: (token: string) => void;
};

type GeminiContentMessage = {
  role: "model" | "user";
  parts: Array<{ text: string }>;
};

const MOCK_LLM_RESPONSE =
  "Это тестовый ответ по умолчанию. Реальный запрос к LLM отключен.";
const MOCK_CHAT_TITLE = "Тестовый чат";
const MODELS_WITHOUT_SYSTEM_INSTRUCTION = new Set(["gemma-3-1b-it"]);

function isMockLlmEnabled() {
  return process.env.MOCK_LLM === "true" || process.env.NODE_ENV === "test";
}

function toGeminiRole(role: ChatRole): GeminiContentMessage["role"] {
  return role === "assistant" ? "model" : "user";
}

let aiClient: GoogleGenAI | null = null;

function getGoogleGenAiClient() {
  if (aiClient) {
    return aiClient;
  }
  aiClient = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  return aiClient;
}

function buildModelCandidates(preferredModel: string) {
  const models = [preferredModel, getGeminiDefaultModel(), "gemini-2.5-flash"];
  return [...new Set(models)];
}

function isQuotaOrRateError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes("429") || text.includes("RESOURCE_EXHAUSTED");
}

function isDeveloperInstructionUnsupported(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes("Developer instruction is not enabled");
}

function shouldInlineSystemPrompt(model: string) {
  return MODELS_WITHOUT_SYSTEM_INSTRUCTION.has(model.trim().toLowerCase());
}

function buildContentsWithInlinedSystemPrompt(
  messages: GeminiContentMessage[],
  systemPrompt: string,
): GeminiContentMessage[] {
  if (!systemPrompt) {
    return messages;
  }

  return [
    {
      role: "user" as const,
      parts: [{ text: `System instruction:\n${systemPrompt}` }],
    },
    ...messages,
  ];
}

export async function streamGeminiResponse(
  messages: GeminiMessage[],
  callbacks: StreamCallbacks,
  model = getGeminiDefaultModel(),
) {
  if (isMockLlmEnabled()) {
    callbacks.onToken(MOCK_LLM_RESPONSE);
    return { text: MOCK_LLM_RESPONSE, model: "mock-gemini" };
  }

  const systemPrompt = messages
    .filter((item) => item.role === "system")
    .map((item) => item.content)
    .join("\n\n")
    .trim();

  const chatMessages: GeminiContentMessage[] = messages
    .filter((item) => item.role !== "system")
    .map((item) => ({
      role: toGeminiRole(item.role),
      parts: [{ text: item.content }],
    }));

  const ai = getGoogleGenAiClient();

  for (const candidateModel of buildModelCandidates(model)) {
    try {
      let response: Awaited<ReturnType<typeof ai.models.generateContentStream>>;
      const inlineSystemPrompt = shouldInlineSystemPrompt(candidateModel);
      const contents = inlineSystemPrompt
        ? buildContentsWithInlinedSystemPrompt(chatMessages, systemPrompt)
        : chatMessages;

      try {
        response = await ai.models.generateContentStream({
          model: candidateModel,
          contents,
          ...(!inlineSystemPrompt && systemPrompt
            ? { config: { systemInstruction: systemPrompt } }
            : {}),
        });
      } catch (error) {
        if (!isDeveloperInstructionUnsupported(error)) {
          throw error;
        }

        response = await ai.models.generateContentStream({
          model: candidateModel,
          contents: buildContentsWithInlinedSystemPrompt(
            chatMessages,
            systemPrompt,
          ),
        });
      }

      let fullText = "";
      for await (const chunk of response) {
        const token = chunk.text ?? "";
        if (!token) continue;
        fullText += token;
        callbacks.onToken(token);
      }

      return { text: fullText, model: candidateModel };
    } catch (error) {
      console.error(error);
      if (!isQuotaOrRateError(error)) {
        throw error;
      }
    }
  }

  throw new Error("Gemini model fallback exhausted");
}

export async function generateGeminiChatTitle(
  messages: GeminiMessage[],
  model = getGeminiDefaultModel(),
) {
  if (isMockLlmEnabled()) {
    return MOCK_CHAT_TITLE;
  }

  const context = messages
    .filter((item) => item.role !== "system")
    .map(
      (item) =>
        `${item.role === "assistant" ? "assistant" : "user"}: ${item.content}`,
    )
    .join("\n")
    .slice(0, 3500);

  const prompt = [
    "Сгенерируй короткий заголовок чата (3-7 слов) по контексту диалога.",
    "Верни только заголовок без кавычек, точки в конце и пояснений.",
    "Язык: русский, если это уместно по контексту.",
    "",
    context,
  ].join("\n");

  const ai = getGoogleGenAiClient();
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  const rawTitle = (response.text ?? "").trim();
  if (!rawTitle) {
    throw new Error("Title generation returned empty text");
  }

  return rawTitle;
}
