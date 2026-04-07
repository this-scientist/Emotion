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
