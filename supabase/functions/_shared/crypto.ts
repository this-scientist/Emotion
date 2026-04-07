export interface EncryptedEnvelope {
  alg: "AES-256-GCM";
  version: 1;
  iv: string;
  ciphertext: string;
}

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function importKey(rawKey: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", asArrayBuffer(rawKey), ALGORITHM, false, usages);
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
    { name: ALGORITHM, iv: asArrayBuffer(iv), additionalData: asArrayBuffer(encodeAad(aad)) },
    key,
    asArrayBuffer(plaintext),
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
      iv: asArrayBuffer(fromBase64(envelope.iv)),
      additionalData: asArrayBuffer(encodeAad(aad)),
    },
    key,
    asArrayBuffer(fromBase64(envelope.ciphertext)),
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
