import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/api/request-context";
import { jsonError, jsonOk } from "@/lib/api/http";

export async function POST(req: NextRequest) {
  const context = await getRequestContext(req);
  if (!context) {
    return jsonError("Unauthorized", 401);
  }

  // Browser client performs actual session sign-out in Supabase Auth.
  return jsonOk({ ok: true });
}
