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
