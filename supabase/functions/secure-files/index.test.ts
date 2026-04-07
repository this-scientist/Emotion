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
      insertFile: async (payload: Record<string, unknown>) => {
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
  assertEquals(typeof insertedBody?.["file_content"], "object");
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
