import { randomUUID } from "crypto";
import path from "path";
import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestContext } from "@/lib/api/request-context";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  uploadFileResponseSchema,
  uploadFormSchema,
} from "@/lib/validation/upload";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function sanitizeFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path
    .basename(fileName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return `${base || "file"}${ext}`;
}

export async function POST(req: NextRequest) {
  const context = await getRequestContext(req);
  if (!context) {
    return jsonError("Unauthorized", 401);
  }

  const formData = await req.formData();
  const parsedForm = uploadFormSchema.safeParse({
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
    return jsonError("File is too large (max 10MB)", 400);
  }

  const isImage = file.type.startsWith("image/");
  const bucket = isImage ? "chat-images" : "chat-documents";
  const owner = context.kind === "auth" ? context.userId : context.anonymousId;
  const safeName = sanitizeFileName(file.name);
  const storagePath = `${owner}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;

  const supabase = createSupabaseAdminClient();
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    return jsonError(uploadError.message, 500);
  }

  if (bucket === "chat-images") {
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    const payload = uploadFileResponseSchema.parse({
      file: {
        bucket,
        path: storagePath,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: data.publicUrl,
      },
    });
    return jsonOk(payload);
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60);

  if (signedError) {
    return jsonError(signedError.message, 500);
  }

  const payload = uploadFileResponseSchema.parse({
    file: {
      bucket,
      path: storagePath,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileUrl: signed.signedUrl,
    },
  });
  return jsonOk(payload);
}
