import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { generateDek, type EncryptedEnvelope, unwrapDek, wrapDek } from "./crypto.ts";

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

function kek(): Uint8Array {
  const base64 = Deno.env.get("APP_KEK_BASE64") ?? "";
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function loadOrCreateUserDek(userId: string): Promise<Uint8Array> {
  const admin = serviceClient();
  const { data: existing, error: selectError } = await admin
    .from("user_encryption_keys")
    .select("wrapped_dek")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing?.wrapped_dek) {
    return unwrapDek(kek(), existing.wrapped_dek as EncryptedEnvelope, `${userId}:dek`);
  }

  const dek = generateDek();
  const wrappedDek = await wrapDek(kek(), dek, `${userId}:dek`);

  const { error } = await admin.from("user_encryption_keys").insert({
    user_id: userId,
    wrapped_dek: wrappedDek,
  });

  if (error) throw error;

  return dek;
}
