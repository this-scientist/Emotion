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

const selection = ref<LineSelection>({
  startLine: null,
  endLine: null,
})

export function useBlockManager() {
  const documentLoaded = computed(() => state.value.content.length > 0)
  const fileId = computed(() => state.value.fileId)
  const blocks = computed(() => state.value.blocks)
  const content = computed(() => state.value.content)
  const fileName = computed(() => state.value.fileName)
  const totalLines = computed(() => state.value.totalLines)

  function setDocument(docState: DocState) {
    state.value = docState
    selection.value = { startLine: null, endLine: null }
  }

  function createBlock(name: string, startLine: number, endLine: number, color?: string): ContentBlock {
    const block: ContentBlock = {
      id: `block-${Date.now()}`,
      name,
      startLine,
      endLine,
      color: color ?? generateBlockColor(state.value.blocks.length),
      createdAt: Date.now(),
    }
    state.value.blocks.push(block)
    return block
  }

  function updateBlock(id: string, updates: Partial<ContentBlock>): void {
    const index = state.value.blocks.findIndex((b) => b.id === id)
    if (index !== -1) {
      state.value.blocks[index] = { ...state.value.blocks[index], ...updates }
    }
  }

  function deleteBlock(id: string): void {
    const index = state.value.blocks.findIndex((b) => b.id === id)
    if (index !== -1) {
      state.value.blocks.splice(index, 1)
    }
  }

  function setSelectionStart(line: number): void {
    selection.value.startLine = line
    selection.value.endLine = null
  }

  function setSelectionEnd(line: number): void {
    if (selection.value.startLine !== null) {
      const start = Math.min(selection.value.startLine, line)
      const end = Math.max(selection.value.startLine, line)
      selection.value = { startLine: start, endLine: end }
    }
  }

  function clearSelection(): void {
    selection.value = { startLine: null, endLine: null }
  }

  function isLineSelected(line: number): boolean {
    const { startLine, endLine } = selection.value
    if (startLine === null || endLine === null) {
      return startLine === line
    }
    return line >= startLine && line <= endLine
  }

  function isLineInBlock(line: number): ContentBlock | undefined {
    return state.value.blocks.find(
      (block) => line >= block.startLine && line <= block.endLine
    )
  }

  return {
    state,
    selection,
    documentLoaded,
    fileId,
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
