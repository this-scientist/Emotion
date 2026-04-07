export interface ContentBlock {
  id: string
  name: string
  startLine: number
  endLine: number
  color: string      // hex color chosen by user
  createdAt: number
}

export interface DocState {
  fileId: string | null
  fileName: string
  content: string[]
  blocks: ContentBlock[]
  totalLines: number
}

export interface LineSelection {
  startLine: number | null
  endLine: number | null
}
