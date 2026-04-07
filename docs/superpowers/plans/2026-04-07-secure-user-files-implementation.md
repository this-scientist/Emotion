# Secure User Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt `user_files.file_content`, `user_files.blocks_data`, and `user_files.mappings_data` behind a trusted backend while keeping Supabase Auth, plaintext metadata listing, and the current file-management UX.

**Architecture:** Keep Supabase Auth and direct metadata listing in the Vue app, but move sensitive file create/read/update flows behind a Supabase Edge Function that encrypts and decrypts payloads with per-user DEKs wrapped by a server-held KEK. Persist encrypted envelopes directly in the existing `user_files` table, and add a `user_encryption_keys` table for wrapped DEKs. Remove plaintext localStorage persistence so browser-side storage does not quietly undermine the privacy improvement.

**Tech Stack:** Vue 3, TypeScript, Vite, Supabase Auth, Supabase Postgres, Supabase Edge Functions (Deno), AES-256-GCM, Vitest, Deno test

---

## File Structure

### Create

- `supabase/migrations/20260407120000_secure_user_files.sql`
  - Alters `user_files` sensitive columns to `jsonb`
  - Creates `user_encryption_keys`
  - Locks direct client access to wrapped keys
- `supabase/tests/secure_user_files_schema.sql`
  - Smoke-checks schema assumptions after migration
- `supabase/functions/_shared/crypto.ts`
  - AES-GCM envelope helpers, AAD construction, DEK wrapping
- `supabase/functions/_shared/crypto.test.ts`
  - Unit tests for encrypt/decrypt/wrap/unwrap behavior
- `supabase/functions/_shared/auth.ts`
  - Validates Supabase JWT and returns authenticated user id
- `supabase/functions/_shared/userKeys.ts`
  - Fetches or creates wrapped per-user DEKs
- `supabase/functions/secure-files/index.ts`
  - Handles secure create/get/patch requests
- `supabase/functions/secure-files/index.test.ts`
  - Route and authorization tests for secure file operations
- `doc-block-viewer/src/types/secureFiles.ts`
  - Shared frontend types for secure API payloads
- `doc-block-viewer/src/services/secureFilesApi.ts`
  - Frontend wrapper around the secure edge function
- `doc-block-viewer/src/services/secureFilesApi.test.ts`
  - Request-shape tests for frontend secure API calls
- `doc-block-viewer/src/services/secureFileMapper.ts`
  - Pure helpers for API-to-state conversion and mapping upserts
- `doc-block-viewer/src/services/secureFileMapper.test.ts`
  - Unit tests for mapping/document-state helpers
- `doc-block-viewer/vitest.config.ts`
  - Vitest configuration for service/helper tests

### Modify

- `doc-block-viewer/package.json`
  - Adds `vitest` and test script
- `doc-block-viewer/src/lib/supabase.ts`
  - Updates `UserFile` typing so encrypted columns are no longer assumed plaintext
- `doc-block-viewer/src/types/block.ts`
  - Adds `fileId` to `DocState`
- `doc-block-viewer/src/composables/useBlockManager.ts`
  - Removes sensitive localStorage persistence and exposes `fileId`
- `doc-block-viewer/src/App.vue`
  - Uses secure backend for file create/open and persists encrypted blocks/mappings
- `doc-block-viewer/src/components/MappingDialog.vue`
  - Accepts existing mappings and preselects them
- `agent-README.md`
  - Documents the new privacy model and current scope

---

### Task 1: Add database schema for encrypted user files

**Files:**
- Create: `supabase/tests/secure_user_files_schema.sql`
- Create: `supabase/migrations/20260407120000_secure_user_files.sql`

- [ ] **Step 1: Write the failing schema smoke test**

```sql
-- supabase/tests/secure_user_files_schema.sql
DO $$
DECLARE
  file_content_type text;
  blocks_type text;
  mappings_type text;
  key_table_exists boolean;
BEGIN
  SELECT data_type INTO file_content_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_files'
    AND column_name = 'file_content';

  SELECT data_type INTO blocks_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_files'
    AND column_name = 'blocks_data';

  SELECT data_type INTO mappings_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_files'
    AND column_name = 'mappings_data';

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_encryption_keys'
  ) INTO key_table_exists;

  IF file_content_type <> 'jsonb' THEN
    RAISE EXCEPTION 'expected user_files.file_content to be jsonb, got %', file_content_type;
  END IF;

  IF blocks_type <> 'jsonb' THEN
    RAISE EXCEPTION 'expected user_files.blocks_data to be jsonb, got %', blocks_type;
  END IF;

  IF mappings_type <> 'jsonb' THEN
    RAISE EXCEPTION 'expected user_files.mappings_data to be jsonb, got %', mappings_type;
  END IF;

  IF NOT key_table_exists THEN
    RAISE EXCEPTION 'expected public.user_encryption_keys to exist';
  END IF;
END $$;
```

- [ ] **Step 2: Run the schema smoke test to verify it fails**

Run:

```bash
supabase db reset --local
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/secure_user_files_schema.sql
```

Expected: FAIL with an error similar to `expected user_files.file_content to be jsonb`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260407120000_secure_user_files.sql
create extension if not exists pgcrypto;

alter table public.user_files
  alter column file_content type jsonb
  using case
    when file_content is null then null
    else jsonb_build_object('legacy_plaintext', file_content)
  end,
  alter column blocks_data type jsonb
  using case
    when blocks_data is null then null
    else to_jsonb(blocks_data)
  end,
  alter column mappings_data type jsonb
  using case
    when mappings_data is null then null
    else to_jsonb(mappings_data)
  end;

create table if not exists public.user_encryption_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dek_id uuid not null default gen_random_uuid(),
  wrapped_dek jsonb not null,
  kek_version integer not null default 1,
  status text not null default 'active' check (status in ('active', 'rotated', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_encryption_keys enable row level security;

revoke all on public.user_encryption_keys from anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_encryption_keys_updated_at on public.user_encryption_keys;

create trigger set_user_encryption_keys_updated_at
before update on public.user_encryption_keys
for each row
execute function public.set_updated_at();
```

- [ ] **Step 4: Run the smoke test to verify the migration passes**

Run:

```bash
supabase db reset --local
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/secure_user_files_schema.sql
```

Expected: PASS with `DO` and no exception output.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260407120000_secure_user_files.sql supabase/tests/secure_user_files_schema.sql
git commit -m "feat: add secure user file schema"
```

### Task 2: Add crypto helpers for encrypted envelopes and wrapped DEKs

**Files:**
- Create: `supabase/functions/_shared/crypto.ts`
- Create: `supabase/functions/_shared/crypto.test.ts`

- [ ] **Step 1: Write failing crypto tests**

```ts
// supabase/functions/_shared/crypto.test.ts
import {
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  decryptJson,
  encryptJson,
  generateDek,
  unwrapDek,
  wrapDek,
} from "./crypto.ts";

Deno.test("encryptJson round-trips JSON payloads", async () => {
  const dek = generateDek();
  const aad = "user-1:file-1:file_content:v1";
  const payload = { lines: ["a", "b"] };

  const envelope = await encryptJson(dek, payload, aad);
  const decrypted = await decryptJson<typeof payload>(dek, envelope, aad);

  assertEquals(decrypted, payload);
});

Deno.test("encryptJson uses a unique IV each time", async () => {
  const dek = generateDek();
  const aad = "user-1:file-1:file_content:v1";
  const payload = { same: true };

  const first = await encryptJson(dek, payload, aad);
  const second = await encryptJson(dek, payload, aad);

  assertNotEquals(first.iv, second.iv);
  assertNotEquals(first.ciphertext, second.ciphertext);
});

Deno.test("decryptJson rejects tampered ciphertext", async () => {
  const dek = generateDek();
  const aad = "user-1:file-1:file_content:v1";
  const payload = { safe: true };

  const envelope = await encryptJson(dek, payload, aad);
  const tampered = {
    ...envelope,
    ciphertext: envelope.ciphertext.slice(0, -2) + "aa",
  };

  await assertRejects(() => decryptJson(dek, tampered, aad));
});

Deno.test("wrapDek round-trips per-user keys", async () => {
  const kek = generateDek();
  const dek = generateDek();
  const aad = "user-1:dek";

  const wrapped = await wrapDek(kek, dek, aad);
  const unwrapped = await unwrapDek(kek, wrapped, aad);

  assertEquals(Array.from(unwrapped), Array.from(dek));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
deno test supabase/functions/_shared/crypto.test.ts
```

Expected: FAIL with module export errors such as `encryptJson is not defined`.

- [ ] **Step 3: Write the crypto helpers**

```ts
// supabase/functions/_shared/crypto.ts
export interface EncryptedEnvelope {
  alg: "AES-256-GCM";
  version: 1;
  iv: string;
  ciphertext: string;
}

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function importKey(rawKey: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", rawKey, ALGORITHM, false, usages);
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodeJson<T>(value: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(value)) as T;
}

function encodeAad(aad: string): Uint8Array {
  return new TextEncoder().encode(aad);
}

export function generateDek(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function encryptJson(
  dek: Uint8Array,
  payload: unknown,
  aad: string,
): Promise<EncryptedEnvelope> {
  const key = await importKey(dek, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = encodeJson(payload);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, additionalData: encodeAad(aad) },
    key,
    plaintext,
  );

  return {
    alg: "AES-256-GCM",
    version: 1,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson<T>(
  dek: Uint8Array,
  envelope: EncryptedEnvelope,
  aad: string,
): Promise<T> {
  const key = await importKey(dek, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: fromBase64(envelope.iv),
      additionalData: encodeAad(aad),
    },
    key,
    fromBase64(envelope.ciphertext),
  );

  return decodeJson<T>(new Uint8Array(plaintext));
}

export async function wrapDek(
  kek: Uint8Array,
  dek: Uint8Array,
  aad: string,
): Promise<EncryptedEnvelope> {
  return encryptJson(kek, Array.from(dek), aad);
}

export async function unwrapDek(
  kek: Uint8Array,
  wrappedDek: EncryptedEnvelope,
  aad: string,
): Promise<Uint8Array> {
  const raw = await decryptJson<number[]>(kek, wrappedDek, aad);
  return new Uint8Array(raw);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
deno test supabase/functions/_shared/crypto.test.ts
```

Expected: PASS with `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/crypto.ts supabase/functions/_shared/crypto.test.ts
git commit -m "feat: add secure file crypto helpers"
```

### Task 3: Implement secure file create and read endpoints

**Files:**
- Create: `supabase/functions/_shared/auth.ts`
- Create: `supabase/functions/_shared/userKeys.ts`
- Create: `supabase/functions/secure-files/index.ts`
- Create: `supabase/functions/secure-files/index.test.ts`

- [ ] **Step 1: Write failing route tests for create and get**

```ts
// supabase/functions/secure-files/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { encryptJson } from "../_shared/crypto.ts";
import { handleRequest } from "./index.ts";

const user = { id: "00000000-0000-0000-0000-000000000001" };

Deno.test("POST creates an encrypted file record", async () => {
  let insertedBody: Record<string, unknown> | null = null;

  const response = await handleRequest(
    new Request("https://example.com/secure-files", {
      method: "POST",
      body: JSON.stringify({
        fileName: "session-1.docx",
        originalName: "session-1.docx",
        content: ["line 1", "line 2"],
      }),
    }),
    {
      authenticate: async () => user,
      loadOrCreateDek: async () => new Uint8Array(32).fill(7),
      insertFile: async (payload) => {
        insertedBody = payload;
        return { id: "file-1", created_at: "2026-04-07T00:00:00.000Z" };
      },
      getFile: async () => {
        throw new Error("not used");
      },
    },
  );

  const json = await response.json();

  assertEquals(response.status, 201);
  assertEquals(json.id, "file-1");
  assertEquals(typeof insertedBody?.file_content, "object");
});

Deno.test("GET returns decrypted file content for the owner", async () => {
  const dek = new Uint8Array(32).fill(9);
  const fileContent = await encryptJson(
    dek,
    ["line 1", "line 2"],
    `${user.id}:file-1:file_content:v1`,
  );

  const response = await handleRequest(
    new Request("https://example.com/secure-files?fileId=file-1", {
      method: "GET",
    }),
    {
      authenticate: async () => user,
      loadOrCreateDek: async () => dek,
      insertFile: async () => {
        throw new Error("not used");
      },
      getFile: async () => ({
        id: "file-1",
        file_name: "session-1.docx",
        original_name: "session-1.docx",
        file_meta: { totalLines: 2 },
        file_content: fileContent,
        blocks_data: null,
        mappings_data: null,
      }),
    },
  );

  const json = await response.json();

  assertEquals(response.status, 200);
  assertEquals(json.content, ["line 1", "line 2"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
deno test supabase/functions/secure-files/index.test.ts
```

Expected: FAIL because `handleRequest` does not exist yet.

- [ ] **Step 3: Implement auth, DEK loading, and create/get handlers**

```ts
// supabase/functions/_shared/auth.ts
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
```

```ts
// supabase/functions/_shared/userKeys.ts
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
  const { data: existing } = await admin
    .from("user_encryption_keys")
    .select("wrapped_dek")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

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
```

```ts
// supabase/functions/secure-files/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { authenticateRequest } from "../_shared/auth.ts";
import { decryptJson, encryptJson } from "../_shared/crypto.ts";
import { loadOrCreateUserDek } from "../_shared/userKeys.ts";

interface Deps {
  authenticate: (req: Request) => Promise<{ id: string }>;
  loadOrCreateDek: (userId: string) => Promise<Uint8Array>;
  insertFile: (payload: Record<string, unknown>) => Promise<{ id: string; created_at: string }>;
  getFile: (fileId: string, userId: string) => Promise<Record<string, any> | null>;
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
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function handleRequest(req: Request, deps: Deps = buildDeps()): Promise<Response> {
  try {
    const user = await deps.authenticate(req);
    const dek = await deps.loadOrCreateDek(user.id);
    const url = new URL(req.url);

    if (req.method === "POST") {
      const body = await req.json();
      const fileContent = await encryptJson(
        dek,
        body.content,
        `${user.id}:new:file_content:v1`,
      );

      const inserted = await deps.insertFile({
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

      const content = row.file_content
        ? await decryptJson<string[]>(
            dek,
            row.file_content,
            `${user.id}:${fileId}:file_content:v1`,
          )
        : [];

      return json({
        id: row.id,
        fileName: row.file_name,
        originalName: row.original_name,
        totalLines: row.file_meta?.totalLines ?? content.length,
        content,
        blocks: row.blocks_data ?? [],
        mappings: row.mappings_data ?? [],
      });
    }

    return json({ message: "method not allowed" }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHENTICATED") return json({ message: "unauthenticated" }, 401);
    return json({ message: "secure file operation failed" }, 500);
  }
}

Deno.serve((req) => handleRequest(req));
```

- [ ] **Step 4: Run the tests to verify create/get routes pass**

Run:

```bash
deno test supabase/functions/secure-files/index.test.ts
```

Expected: PASS with `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/auth.ts supabase/functions/_shared/userKeys.ts supabase/functions/secure-files/index.ts supabase/functions/secure-files/index.test.ts
git commit -m "feat: add secure file create and read endpoints"
```

### Task 4: Add secure block and mapping updates

**Files:**
- Modify: `supabase/functions/secure-files/index.ts`
- Modify: `supabase/functions/secure-files/index.test.ts`

- [ ] **Step 1: Write failing patch-route tests**

```ts
// add to supabase/functions/secure-files/index.test.ts
Deno.test("PATCH persists encrypted blocks", async () => {
  let updatedPayload: Record<string, unknown> | null = null;

  const response = await handleRequest(
    new Request("https://example.com/secure-files", {
      method: "PATCH",
      body: JSON.stringify({
        fileId: "file-1",
        op: "blocks",
        value: [{ id: "block-1", name: "intro", startLine: 0, endLine: 3, color: "#fff", createdAt: 1 }],
      }),
    }),
    {
      authenticate: async () => user,
      loadOrCreateDek: async () => new Uint8Array(32).fill(5),
      insertFile: async () => {
        throw new Error("not used");
      },
      getFile: async () => ({ id: "file-1" }),
      updateFile: async (fileId, userId, payload) => {
        updatedPayload = payload;
        return { id: fileId, user_id: userId };
      },
    } as any,
  );

  assertEquals(response.status, 200);
  assertEquals(typeof updatedPayload?.blocks_data, "object");
});

Deno.test("PATCH persists encrypted mappings", async () => {
  let updatedPayload: Record<string, unknown> | null = null;

  const response = await handleRequest(
    new Request("https://example.com/secure-files", {
      method: "PATCH",
      body: JSON.stringify({
        fileId: "file-1",
        op: "mappings",
        value: [{ blockId: "block-1", mappings: [{ speaker: "Alice", role: "counselor" }] }],
      }),
    }),
    {
      authenticate: async () => user,
      loadOrCreateDek: async () => new Uint8Array(32).fill(6),
      insertFile: async () => {
        throw new Error("not used");
      },
      getFile: async () => ({ id: "file-1" }),
      updateFile: async (_fileId, _userId, payload) => {
        updatedPayload = payload;
        return { id: "file-1" };
      },
    } as any,
  );

  assertEquals(response.status, 200);
  assertEquals(typeof updatedPayload?.mappings_data, "object");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
deno test supabase/functions/secure-files/index.test.ts
```

Expected: FAIL because `PATCH` returns `405` and `updateFile` is unused.

- [ ] **Step 3: Implement block and mapping patch handling**

```ts
// extend Deps in supabase/functions/secure-files/index.ts
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

// extend buildDeps()
updateFile: async (fileId, userId, payload) => {
  const { data, error } = await admin
    .from("user_files")
    .update(payload)
    .eq("id", fileId)
    .eq("user_id", userId)
    .select("id")
    .single();

  if (error) throw error;
  return data;
},

// add to handleRequest()
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
```

- [ ] **Step 4: Run the tests to verify patch routes pass**

Run:

```bash
deno test supabase/functions/secure-files/index.test.ts
```

Expected: PASS with `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/secure-files/index.ts supabase/functions/secure-files/index.test.ts
git commit -m "feat: add secure block and mapping updates"
```

### Task 5: Add frontend secure file client and pure mapping helpers

**Files:**
- Modify: `doc-block-viewer/package.json`
- Create: `doc-block-viewer/vitest.config.ts`
- Create: `doc-block-viewer/src/types/secureFiles.ts`
- Create: `doc-block-viewer/src/services/secureFilesApi.ts`
- Create: `doc-block-viewer/src/services/secureFilesApi.test.ts`
- Create: `doc-block-viewer/src/services/secureFileMapper.ts`
- Create: `doc-block-viewer/src/services/secureFileMapper.test.ts`

- [ ] **Step 1: Write failing frontend tests**

```ts
// doc-block-viewer/src/services/secureFilesApi.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSecureFile, saveSecureBlocks } from "./secureFilesApi";

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "token-123" } },
      }),
    },
  },
}));

describe("secureFilesApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "file-1" }),
    }));
  });

  it("posts content to the secure edge function", async () => {
    await createSecureFile({
      fileName: "session-1.docx",
      originalName: "session-1.docx",
      content: ["line 1"],
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/secure-files"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("patches encrypted blocks through the secure edge function", async () => {
    await saveSecureBlocks("file-1", [
      { id: "block-1", name: "intro", startLine: 0, endLine: 1, color: "#fff", createdAt: 1 },
    ]);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          fileId: "file-1",
          op: "blocks",
          value: [{ id: "block-1", name: "intro", startLine: 0, endLine: 1, color: "#fff", createdAt: 1 }],
        }),
      }),
    );
  });
});
```

```ts
// doc-block-viewer/src/services/secureFileMapper.test.ts
import { describe, expect, it } from "vitest";
import { toDocState, upsertBlockMappings } from "./secureFileMapper";

describe("secureFileMapper", () => {
  it("converts secure payloads into document state", () => {
    const state = toDocState({
      id: "file-1",
      fileName: "session-1.docx",
      originalName: "session-1.docx",
      totalLines: 2,
      content: ["a", "b"],
      blocks: [],
      mappings: [],
    });

    expect(state.fileId).toBe("file-1");
    expect(state.content).toEqual(["a", "b"]);
  });

  it("upserts mappings by block id", () => {
    const next = upsertBlockMappings([], "block-1", [
      { speaker: "Alice", role: "counselor" },
    ]);

    expect(next).toEqual([
      { blockId: "block-1", mappings: [{ speaker: "Alice", role: "counselor" }] },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
cd doc-block-viewer
npm install
npx vitest run src/services/secureFilesApi.test.ts src/services/secureFileMapper.test.ts
```

Expected: FAIL with missing module errors for the new service files.

- [ ] **Step 3: Add the client, helpers, and Vitest setup**

```json
// doc-block-viewer/package.json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.6.2",
    "vite": "^5.4.10",
    "vitest": "^2.1.8",
    "vue-tsc": "^2.1.10"
  }
}
```

```ts
// doc-block-viewer/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    restoreMocks: true,
  },
});
```

```ts
// doc-block-viewer/src/types/secureFiles.ts
import type { ContentBlock, DocState } from "./block";
import type { SpeakerMapping } from "../utils/extractSpeakers";

export interface StoredBlockMappings {
  blockId: string;
  mappings: SpeakerMapping[];
}

export interface SecureFileCreateInput {
  fileName: string;
  originalName: string;
  content: string[];
}

export interface SecureFileDetail {
  id: string;
  fileName: string;
  originalName: string;
  totalLines: number;
  content: string[];
  blocks: ContentBlock[];
  mappings: StoredBlockMappings[];
}

export interface SecureDocState extends DocState {
  fileId: string | null;
}
```

```ts
// doc-block-viewer/src/services/secureFilesApi.ts
import { supabase } from "../lib/supabase";
import type { ContentBlock } from "../types/block";
import type { SecureFileCreateInput, SecureFileDetail, StoredBlockMappings } from "../types/secureFiles";

const secureFilesUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secure-files`;

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("未登录，无法访问安全文件接口");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "请求失败" }));
    throw new Error(body.message ?? "请求失败");
  }
  return response.json() as Promise<T>;
}

export async function createSecureFile(input: SecureFileCreateInput): Promise<{ id: string }> {
  const response = await fetch(secureFilesUrl, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  return parseJson<{ id: string }>(response);
}

export async function getSecureFile(fileId: string): Promise<SecureFileDetail> {
  const response = await fetch(`${secureFilesUrl}?fileId=${encodeURIComponent(fileId)}`, {
    method: "GET",
    headers: await authHeaders(),
  });
  return parseJson<SecureFileDetail>(response);
}

export async function saveSecureBlocks(fileId: string, blocks: ContentBlock[]): Promise<void> {
  const response = await fetch(secureFilesUrl, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ fileId, op: "blocks", value: blocks }),
  });
  await parseJson<{ ok: true }>(response);
}

export async function saveSecureMappings(fileId: string, mappings: StoredBlockMappings[]): Promise<void> {
  const response = await fetch(secureFilesUrl, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ fileId, op: "mappings", value: mappings }),
  });
  await parseJson<{ ok: true }>(response);
}
```

```ts
// doc-block-viewer/src/services/secureFileMapper.ts
import type { ContentBlock } from "../types/block";
import type { SecureDocState, SecureFileDetail, StoredBlockMappings } from "../types/secureFiles";
import type { SpeakerMapping } from "../utils/extractSpeakers";

export function toDocState(detail: SecureFileDetail): SecureDocState {
  return {
    fileId: detail.id,
    fileName: detail.originalName || detail.fileName,
    content: detail.content,
    blocks: detail.blocks,
    totalLines: detail.totalLines,
  };
}

export function upsertBlockMappings(
  existing: StoredBlockMappings[],
  blockId: string,
  mappings: SpeakerMapping[],
): StoredBlockMappings[] {
  const next = existing.filter((item) => item.blockId !== blockId);
  next.push({ blockId, mappings });
  return next;
}

export function findBlockMappings(
  existing: StoredBlockMappings[],
  blockId: string,
): SpeakerMapping[] {
  return existing.find((item) => item.blockId === blockId)?.mappings ?? [];
}

export function blocksPayload(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block) => ({ ...block }));
}
```

- [ ] **Step 4: Run the frontend tests to verify they pass**

Run:

```bash
cd doc-block-viewer
npm test -- src/services/secureFilesApi.test.ts src/services/secureFileMapper.test.ts
```

Expected: PASS with all service/helper tests green.

- [ ] **Step 5: Commit**

```bash
git add doc-block-viewer/package.json doc-block-viewer/vitest.config.ts doc-block-viewer/src/types/secureFiles.ts doc-block-viewer/src/services/secureFilesApi.ts doc-block-viewer/src/services/secureFilesApi.test.ts doc-block-viewer/src/services/secureFileMapper.ts doc-block-viewer/src/services/secureFileMapper.test.ts
git commit -m "feat: add frontend secure file client"
```

### Task 6: Wire secure file create/open and block persistence into the app

**Files:**
- Modify: `doc-block-viewer/src/types/block.ts:10-15`
- Modify: `doc-block-viewer/src/composables/useBlockManager.ts:1-57`
- Modify: `doc-block-viewer/src/lib/supabase.ts:30-40`
- Modify: `doc-block-viewer/src/App.vue:52-190`

- [ ] **Step 1: Write a failing mapper/state test for `fileId`**

```ts
// add to doc-block-viewer/src/services/secureFileMapper.test.ts
it("keeps the secure file id in document state", () => {
  const state = toDocState({
    id: "file-99",
    fileName: "secure.txt",
    originalName: "secure.txt",
    totalLines: 1,
    content: ["secure"],
    blocks: [],
    mappings: [],
  });

  expect(state.fileId).toBe("file-99");
});
```

- [ ] **Step 2: Run the test to verify it fails on the current `DocState` shape**

Run:

```bash
cd doc-block-viewer
npx vitest run src/services/secureFileMapper.test.ts
```

Expected: FAIL with a TypeScript error because `DocState` has no `fileId`.

- [ ] **Step 3: Update state shape, remove localStorage persistence, and wire secure create/open/block save**

```ts
// doc-block-viewer/src/types/block.ts
export interface DocState {
  fileId: string | null
  fileName: string
  content: string[]
  blocks: ContentBlock[]
  totalLines: number
}
```

```ts
// doc-block-viewer/src/composables/useBlockManager.ts
import { ref, computed } from 'vue'
import type { ContentBlock, DocState, LineSelection } from '../types/block'
import { generateBlockColor } from '../utils/storage'

const state = ref<DocState>({
  fileId: null,
  fileName: '',
  content: [],
  blocks: [],
  totalLines: 0,
})

export function useBlockManager() {
  const fileId = computed(() => state.value.fileId)
  const documentLoaded = computed(() => state.value.content.length > 0)
  const blocks = computed(() => state.value.blocks)
  const content = computed(() => state.value.content)
  const fileName = computed(() => state.value.fileName)
  const totalLines = computed(() => state.value.totalLines)

  function setDocument(docState: DocState) {
    state.value = docState
    selection.value = { startLine: null, endLine: null }
  }

  return {
    state,
    selection,
    fileId,
    documentLoaded,
    blocks,
    content,
    fileName,
    totalLines,
    setDocument,
    createBlock,
    updateBlock,
    deleteBlock,
    setSelectionStart,
    setSelectionEnd,
    clearSelection,
    isLineSelected,
    isLineInBlock,
  }
}
```

```ts
// doc-block-viewer/src/lib/supabase.ts
export interface UserFile {
  id: string
  user_id: string
  folder_id: string | null
  file_name: string
  original_name: string
  file_content: Record<string, any> | null
  file_meta: Record<string, any> | null
  blocks_data: Record<string, any> | null
  mappings_data: Record<string, any> | null
  analysis_data: any | null
  created_at: string
  updated_at: string
}
```

```ts
// replace the affected logic in doc-block-viewer/src/App.vue
import { createSecureFile, getSecureFile, saveSecureBlocks } from './services/secureFilesApi'
import { blocksPayload, toDocState } from './services/secureFileMapper'
import type { StoredBlockMappings } from './types/secureFiles'

const openFileError = ref('')
const persistError = ref('')
const storedMappings = ref<StoredBlockMappings[]>([])

const {
  fileId,
  documentLoaded,
  blocks,
  content,
  fileName,
  totalLines,
  setDocument,
  createBlock,
  updateBlock,
  deleteBlock,
  clearSelection,
} = useBlockManager()

function resetDocumentState() {
  setDocument({ fileId: null, fileName: '', content: [], blocks: [], totalLines: 0 })
  storedMappings.value = []
}

async function handleOpenFile(file: UserFile) {
  openFileError.value = ''
  persistError.value = ''

  try {
    const detail = await getSecureFile(file.id)
    setDocument(toDocState(detail))
    storedMappings.value = detail.mappings
    appView.value = 'editor'
  } catch {
    openFileError.value = '文件安全加载失败，请稍后重试'
  }
}

async function handleFileSelected(file: File) {
  try {
    const result = await parseDocument(file)
    const created = await createSecureFile({
      fileName: result.fileName,
      originalName: result.fileName,
      content: result.content,
    })

    setDocument({
      fileId: created.id,
      fileName: result.fileName,
      content: result.content,
      blocks: [],
      totalLines: result.content.length,
    })
    storedMappings.value = []
  } catch (error) {
    alert(error instanceof Error ? error.message : '文件解析失败')
  }
}

async function persistBlocks() {
  if (!fileId.value) return
  try {
    await saveSecureBlocks(fileId.value, blocksPayload(blocks.value))
    persistError.value = ''
  } catch {
    persistError.value = '分块已更新，但保存到安全存储失败，请重试'
  }
}

async function handleSaveBlock(name: string, color: string) {
  if (pendingBlock.value) {
    updateBlock(pendingBlock.value.id, { name, color })
  } else {
    createBlock(name, pendingStartLine.value, pendingEndLine.value, color)
  }
  showBlockEditor.value = false
  clearSelection()
  await persistBlocks()
}

async function handleDeleteBlock(id: string) {
  deleteBlock(id)
  await persistBlocks()
}
```

- [ ] **Step 4: Run focused tests and a smoke build**

Run:

```bash
cd doc-block-viewer
npx vitest run src/services/secureFilesApi.test.ts src/services/secureFileMapper.test.ts
npm run build
```

Expected: PASS for tests and a successful Vite production build.

- [ ] **Step 5: Commit**

```bash
git add doc-block-viewer/src/types/block.ts doc-block-viewer/src/composables/useBlockManager.ts doc-block-viewer/src/lib/supabase.ts doc-block-viewer/src/App.vue
git commit -m "feat: wire secure file create and block persistence"
```

### Task 7: Persist mappings, prefill the dialog, and document the privacy model

**Files:**
- Modify: `doc-block-viewer/src/App.vue:103-194`
- Modify: `doc-block-viewer/src/components/MappingDialog.vue:7-63`
- Modify: `agent-README.md`

- [ ] **Step 1: Write a failing helper test for mapping upserts**

```ts
// add to doc-block-viewer/src/services/secureFileMapper.test.ts
it("replaces prior mappings for the same block", () => {
  const next = upsertBlockMappings(
    [{ blockId: "block-1", mappings: [{ speaker: "Alice", role: "counselor" }] }],
    "block-1",
    [{ speaker: "Bob", role: "visitor" }],
  );

  expect(next).toEqual([
    { blockId: "block-1", mappings: [{ speaker: "Bob", role: "visitor" }] },
  ]);
});
```

- [ ] **Step 2: Run the helper test to verify the replacement behavior fails if not implemented**

Run:

```bash
cd doc-block-viewer
npx vitest run src/services/secureFileMapper.test.ts
```

Expected: FAIL until `upsertBlockMappings()` replaces an existing entry instead of appending duplicates.

- [ ] **Step 3: Wire mapping persistence and README updates**

```ts
// replace the mapping-related sections in doc-block-viewer/src/App.vue
import { findBlockMappings, upsertBlockMappings } from './services/secureFileMapper'
import { saveSecureMappings } from './services/secureFilesApi'

const mappingBlock = ref<ContentBlock | null>(null)

async function handleMappingConfirm(mappings: SpeakerMapping[], block: ContentBlock) {
  mappingResult.value = { block, mappings }
  showMappingDialog.value = false
  showMappingView.value = true

  storedMappings.value = upsertBlockMappings(storedMappings.value, block.id, mappings)

  if (!fileId.value) return

  try {
    await saveSecureMappings(fileId.value, storedMappings.value)
    persistError.value = ''
  } catch {
    persistError.value = '角色映射已更新，但保存到安全存储失败，请重试'
  }
}
```

```ts
// update MappingDialog props/watch in doc-block-viewer/src/components/MappingDialog.vue
const props = defineProps<{
  visible: boolean
  block: ContentBlock | null
  blockLines: string[]
  initialMappings?: SpeakerMapping[]
}>()

watch(() => props.visible, (v) => {
  if (v && props.blockLines.length) {
    speakers.value = extractSpeakers(props.blockLines)
    counselors.value = props.initialMappings
      ?.filter((item) => item.role === 'counselor')
      .map((item) => item.speaker) ?? []
    visitors.value = props.initialMappings
      ?.filter((item) => item.role === 'visitor')
      .map((item) => item.speaker) ?? []
  }
})
```

```vue
<!-- add this binding where MappingDialog is used in doc-block-viewer/src/App.vue -->
<MappingDialog
  :visible="showMappingDialog"
  :block="mappingBlock"
  :block-lines="mappingBlockLines"
  :initial-mappings="mappingBlock ? findBlockMappings(storedMappings, mappingBlock.id) : []"
  @close="showMappingDialog = false"
  @confirm="handleMappingConfirm"
/>
```

```md
<!-- append to agent-README.md -->
## 数据隐私改造（password 分支）

- 认证继续使用 Supabase Auth，项目不自建密码存储。
- `user_files.file_content`、`user_files.blocks_data`、`user_files.mappings_data` 改为应用层加密存储。
- `original_name` 保持明文，便于文件列表展示和基础筛选。
- 文件创建、打开、分块保存、映射保存通过可信后端处理，不再由前端直接写入敏感明文。
- `analysis_data` 暂未纳入本次改造范围。
```

- [ ] **Step 4: Run the full verification set**

Run:

```bash
deno test supabase/functions/_shared/crypto.test.ts supabase/functions/secure-files/index.test.ts
cd doc-block-viewer
npm test
npm run build
```

Expected:

- Deno tests PASS
- Vitest PASS
- build PASS

Manual verification:

```text
1. 登录并上传一个 .txt 或 .docx 文件。
2. 在数据库中确认 user_files.original_name 可读。
3. 在数据库中确认 file_content / blocks_data / mappings_data 为 JSON 密文包，不是可读正文。
4. 重新打开文件，正文正常显示。
5. 新建分块并刷新后重新打开，分块仍存在。
6. 为某个块保存角色映射，重新打开映射弹窗时默认勾选仍存在。
```

- [ ] **Step 5: Commit**

```bash
git add doc-block-viewer/src/App.vue doc-block-viewer/src/components/MappingDialog.vue agent-README.md
git commit -m "feat: persist secure mappings and document privacy model"
```

---

## Self-Review

### Spec coverage

- Supabase Auth retained: covered in Tasks 3, 5, 6
- Trusted backend boundary for sensitive operations: covered in Tasks 3 and 4
- AES-256-GCM application-layer encryption: covered in Task 2
- Direct modification of existing `user_files` table: covered in Task 1
- `original_name` remains plaintext: preserved in Task 3 and Task 7
- `analysis_data` out of scope: preserved by omission and documented in Task 7
- No data migration: Task 1 changes schema directly; no dual-read migration path is introduced
- README update requirement: covered in Task 7
- Basic metadata listing remains plaintext: preserved by not altering `FileManager.vue` list query

### Placeholder scan

- No `TODO`, `TBD`, or “similar to previous task” references remain.
- All commands are concrete.
- All code steps include concrete file content or replacement blocks.

### Type consistency

- Frontend secure payload types live in `src/types/secureFiles.ts`.
- `DocState.fileId` is introduced once and reused consistently.
- Mapping persistence uses `StoredBlockMappings[]` consistently across API, helpers, and App state.
