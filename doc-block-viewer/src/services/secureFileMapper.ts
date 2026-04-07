import type { DocState } from '../types/block'
import type { BlockMappings, SecureFilePayload } from '../types/secureFiles'
import type { SpeakerMapping } from '../utils/extractSpeakers'

export function toDocState(payload: SecureFilePayload): DocState {
  const content = Array.isArray(payload.content) ? payload.content : []

  return {
    fileId: payload.id,
    fileName: payload.originalName || payload.fileName,
    content,
    blocks: Array.isArray(payload.blocks) ? payload.blocks : [],
    totalLines: payload.totalLines || content.length,
  }
}

export function upsertBlockMappings(
  existing: BlockMappings[],
  blockId: string,
  mappings: SpeakerMapping[],
): BlockMappings[] {
  const next = existing.filter((item) => item.blockId !== blockId)

  if (mappings.length === 0) {
    return next
  }

  return [
    ...next,
    {
      blockId,
      mappings: [...mappings],
    },
  ]
}

export function findBlockMappings(
  existing: BlockMappings[],
  blockId: string,
): SpeakerMapping[] {
  return existing.find((item) => item.blockId === blockId)?.mappings ?? []
}
