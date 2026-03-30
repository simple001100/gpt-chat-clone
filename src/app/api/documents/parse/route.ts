import { randomUUID } from "crypto";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  parseDocumentResponseSchema,
  parseFormSchema,
} from "@/lib/validation/documents";

const MAX_FILE_BYTES = 1024 * 1024; // 1MB
const MAX_CONTEXT_TOKENS = 5000;
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * 4;
const ALLOWED_EXTENSIONS = new Set(["txt", "md", "doc", "docx"]);

function normalizeText(raw: string) {
  return raw.replace(/\u0000/g, " ").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

async function parseTxtOrMd(file: File) {
  return normalizeText(await file.text());
}

async function parseDocx(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeText(result.value ?? "");
}

async function parseDoc(buffer: Buffer) {
  const extractor = new WordExtractor();
  const tmpPath = path.join(os.tmpdir(), `doc-${randomUUID()}.doc`);
  await fs.writeFile(tmpPath, buffer);
  try {
    const extracted = await extractor.extract(tmpPath);
    return normalizeText(extracted.getBody() ?? "");
  } finally {
    await fs.rm(tmpPath, { force: true });
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const parsedForm = parseFormSchema.safeParse({
    file: formData.get("file"),
  });
  if (!parsedForm.success) {
    return jsonError("file is required", 400);
  }

  const file = parsedForm.data.file;
  if (file.size <= 0) {
    return jsonError("File is empty", 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return jsonError("File is too large. Max size: 1MB", 400);
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return jsonError("Unsupported file format. Allowed: txt, md, doc, docx", 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    let content = "";

    if (extension === "txt" || extension === "md") {
      content = await parseTxtOrMd(file);
    } else if (extension === "docx") {
      content = await parseDocx(buffer);
    } else {
      content = await parseDoc(buffer);
    }

    if (!content) {
      return jsonError("Could not extract text from file", 400);
    }

    const truncated = content.length > MAX_CONTEXT_CHARS;
    const finalContent = truncated ? content.slice(0, MAX_CONTEXT_CHARS) : content;

    const payload = parseDocumentResponseSchema.parse({
      document: {
        id: randomUUID(),
        fileName: file.name,
        fileType: file.type || extension,
        content: finalContent,
        tokenEstimate: estimateTokens(finalContent),
        truncated,
      },
    });
    return jsonOk(payload);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to parse document",
      500,
    );
  }
}
