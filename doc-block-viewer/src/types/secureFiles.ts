import type { ContentBlock } from './block'
import type { SpeakerMapping } from '../utils/extractSpeakers'

export interface BlockMappings {
  blockId: string
  mappings: SpeakerMapping[]
}

export interface SecureFilePayload {
  id: string
  fileName: string
  originalName: string
  totalLines: number
  content: string[]
  blocks: ContentBlock[]
  mappings: BlockMappings[]
}

export interface CreateSecureFileInput {
  fileName: string
  originalName: string
  content: string[]
}
