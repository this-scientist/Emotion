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
