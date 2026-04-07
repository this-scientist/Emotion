import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { authenticateRequest } from "../_shared/auth.ts";
import {
  decryptJson,
  encryptJson,
  type EncryptedEnvelope,
} from "../_shared/crypto.ts";
import { loadOrCreateUserDek } from "../_shared/userKeys.ts";

interface Deps {
  authenticate: (req: Request) => Promise<{ id: string }>;
  loadOrCreateDek: (userId: string) => Promise<Uint8Array>;
  insertFile: (payload: Record<string, unknown>) => Promise<{ id: string; created_at: string }>;
  getFile: (fileId: string, userId: string) => Promise<Record<string, any> | null>;
  updateFile: (
    fileId: string,
    userId: string,
    payload: Record<string, unknown>,
  ) => Promise<Record<string, any> | null>;
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

function buildDeps(): Deps {
  const admin = serviceClient();

  return {
    authenticate: authenticateRequest,
    loadOrCreateDek: loadOrCreateUserDek,
    insertFile: async (payload) => {
      const { data, error } = await admin
        .from("user_files")
        .insert(payload)
        .select("id, created_at")
        .single();

      if (error || !data) throw error ?? new Error("INSERT_FAILED");
      return data;
    },
    getFile: async (fileId, userId) => {
      const { data, error } = await admin
        .from("user_files")
        .select("id,file_name,original_name,file_meta,file_content,blocks_data,mappings_data")
        .eq("id", fileId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    updateFile: async (fileId, userId, payload) => {
      const { data, error } = await admin
        .from("user_files")
        .update(payload)
        .eq("id", fileId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, X-Request-ID",
    },
  });
}

async function decryptField<T>(
  dek: Uint8Array,
  envelope: EncryptedEnvelope | null,
  aad: string,
  fallback: T,
): Promise<T> {
  if (!envelope) return fallback;
  return decryptJson<T>(dek, envelope, aad);
}

export async function handleRequest(req: Request, deps: Deps = buildDeps()): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, X-Request-ID",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    const user = await deps.authenticate(req);
    const dek = await deps.loadOrCreateDek(user.id);
    const url = new URL(req.url);

    if (req.method === "POST") {
      const body = await req.json();
      const fileId = crypto.randomUUID();
      const fileContent = await encryptJson(
        dek,
        body.content,
        `${user.id}:${fileId}:file_content:v1`,
      );

      const inserted = await deps.insertFile({
        id: fileId,
        user_id: user.id,
        file_name: body.fileName,
        original_name: body.originalName,
        file_meta: { totalLines: body.content.length },
        file_content: fileContent,
        blocks_data: null,
        mappings_data: null,
      });

      return json(inserted, 201);
    }

    if (req.method === "GET") {
      const fileId = url.searchParams.get("fileId");
      if (!fileId) return json({ message: "fileId is required" }, 400);

      const row = await deps.getFile(fileId, user.id);
      if (!row) return json({ message: "not found" }, 404);

      const content = await decryptField<string[]>(
        dek,
        row.file_content as EncryptedEnvelope | null,
        `${user.id}:${fileId}:file_content:v1`,
        [],
      );
      const blocks = await decryptField(
        dek,
        row.blocks_data as EncryptedEnvelope | null,
        `${user.id}:${fileId}:blocks_data:v1`,
        [],
      );
      const mappings = await decryptField(
        dek,
        row.mappings_data as EncryptedEnvelope | null,
        `${user.id}:${fileId}:mappings_data:v1`,
        [],
      );

      return json({
        id: row.id,
        fileName: row.file_name,
        originalName: row.original_name,
        totalLines: row.file_meta?.totalLines ?? content.length,
        content,
        blocks,
        mappings,
      });
    }

    if (req.method === "PATCH") {
      const body = await req.json();
      const fileId = body.fileId as string;
      const op = body.op as "blocks" | "mappings";
      const field = op === "blocks" ? "blocks_data" : "mappings_data";
      const envelope = await encryptJson(
        dek,
        body.value,
        `${user.id}:${fileId}:${field}:v1`,
      );

      const updated = await deps.updateFile(fileId, user.id, {
        [field]: envelope,
      });

      if (!updated) return json({ message: "not found" }, 404);
      return json({ ok: true });
    }

    return json({ message: "method not allowed" }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHENTICATED") {
      return json({ message: "unauthenticated" }, 401);
    }
    return json({ message: "secure file operation failed" }, 500);
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleRequest(req));
}
