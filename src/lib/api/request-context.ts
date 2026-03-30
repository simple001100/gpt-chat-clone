import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export type RequestContext =
  | { kind: "auth"; userId: string }
  | { kind: "anonymous"; anonymousId: string; fingerprint: string };

export async function getRequestContext(req: NextRequest): Promise<RequestContext | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    const supabasePublic = createSupabasePublicClient();
    const { data, error } = await supabasePublic.auth.getUser(token);
    if (!error && data.user) {
      return { kind: "auth", userId: data.user.id };
    }
  }

  const fingerprint = req.headers.get("x-anon-fingerprint")?.trim();
  if (!fingerprint) {
    return null;
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.rpc("create_anonymous_session", {
    p_fingerprint: fingerprint,
  });

  if (error || !data) {
    return null;
  }

  return {
    kind: "anonymous",
    anonymousId: data,
    fingerprint,
  };
}
