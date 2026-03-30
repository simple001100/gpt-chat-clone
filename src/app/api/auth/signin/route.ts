import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/http";
import { createSupabasePublicClient } from "@/lib/supabase/public";

type SignInBody = {
  email?: string;
  password?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as SignInBody;
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return jsonError("Email and password are required", 400);
  }

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return jsonError(error?.message ?? "Invalid credentials", 401);
  }

  return jsonOk({
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      user: {
        id: data.user?.id ?? "",
        email: data.user?.email ?? "",
      },
    },
  });
}
