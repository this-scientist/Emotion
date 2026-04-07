import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface AuthenticatedUser {
  id: string;
}

export async function authenticateRequest(req: Request): Promise<AuthenticatedUser> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.error("认证失败:", error?.message || "未知错误");
    throw new Error("UNAUTHENTICATED");
  }

  return { id: user.id };
}
