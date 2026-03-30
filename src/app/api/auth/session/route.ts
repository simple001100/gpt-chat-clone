import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/api/request-context";
import { jsonError, jsonOk } from "@/lib/api/http";

export async function GET(req: NextRequest) {
  const context = await getRequestContext(req);
  if (!context) {
    return jsonError("No active session", 401);
  }

  if (context.kind === "auth") {
    return jsonOk({ kind: "auth", userId: context.userId });
  }

  return jsonOk({
    kind: "anonymous",
    anonymousId: context.anonymousId,
    fingerprint: context.fingerprint,
  });
}
