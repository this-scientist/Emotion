import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface AuthenticatedUser {
  id: string;
}

export async function authenticateRequest(req: Request): Promise<AuthenticatedUser> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
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
    throw new Error("UNAUTHENTICATED");
  }

  return { id: user.id };
}
