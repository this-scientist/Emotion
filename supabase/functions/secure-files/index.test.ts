import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  decryptJson,
  encryptJson,
  type EncryptedEnvelope,
} from "../_shared/crypto.ts";
import { handleRequest } from "./index.ts";

const user = { id: "00000000-0000-0000-0000-000000000001" };

Deno.test("POST creates an encrypted file record", async () => {
  let insertedBody: Record<string, unknown> | null = null;
  const dek = new Uint8Array(32).fill(7);

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
      loadOrCreateDek: async () => dek,
      insertFile: async (payload: Record<string, unknown>) => {
        insertedBody = payload;
        return {
          id: payload.id as string,
          created_at: "2026-04-07T00:00:00.000Z",
        };
      },
      getFile: async () => {
        throw new Error("not used");
      },
      updateFile: async () => {
        throw new Error("not used");
      },
    },
  );

  const json = await response.json();
  const fileId = insertedBody?.["id"] as unknown as string;

  assertEquals(response.status, 201);
  assertEquals(json.id, fileId);
  assertEquals(typeof insertedBody?.["file_content"], "object");

  const decrypted = await decryptJson<string[]>(
    dek,
    insertedBody?.["file_content"] as unknown as EncryptedEnvelope,
    `${user.id}:${fileId}:file_content:v1`,
  );

  assertEquals(decrypted, ["line 1", "line 2"]);
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
      updateFile: async () => {
        throw new Error("not used");
      },
    },
  );

  const json = await response.json();

  assertEquals(response.status, 200);
  assertEquals(json.content, ["line 1", "line 2"]);
});

Deno.test("GET decrypts persisted blocks and mappings", async () => {
  const dek = new Uint8Array(32).fill(8);
  const blocks = [
    { id: "block-1", name: "intro", startLine: 0, endLine: 1, color: "#fff", createdAt: 1 },
  ];
  const mappings = [
    { blockId: "block-1", mappings: [{ speaker: "Alice", role: "counselor" }] },
  ];

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
        file_content: await encryptJson(
          dek,
          ["line 1", "line 2"],
          `${user.id}:file-1:file_content:v1`,
        ),
        blocks_data: await encryptJson(
          dek,
          blocks,
          `${user.id}:file-1:blocks_data:v1`,
        ),
        mappings_data: await encryptJson(
          dek,
          mappings,
          `${user.id}:file-1:mappings_data:v1`,
        ),
      }),
      updateFile: async () => {
        throw new Error("not used");
      },
    },
  );

  const json = await response.json();

  assertEquals(response.status, 200);
  assertEquals(json.blocks, blocks);
  assertEquals(json.mappings, mappings);
});

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
      updateFile: async (fileId: string, userId: string, payload: Record<string, unknown>) => {
        updatedPayload = payload;
        return { id: fileId, user_id: userId };
      },
    } as any,
  );

  assertEquals(response.status, 200);
  assertEquals(typeof updatedPayload?.["blocks_data"], "object");
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
      updateFile: async (_fileId: string, _userId: string, payload: Record<string, unknown>) => {
        updatedPayload = payload;
        return { id: "file-1" };
      },
    } as any,
  );

  assertEquals(response.status, 200);
  assertEquals(typeof updatedPayload?.["mappings_data"], "object");
});
