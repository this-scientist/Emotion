import type { DocState } from '../types/block'

const STORAGE_KEY = 'doc-block-viewer-state'

export function saveToStorage(state: DocState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save to localStorage:', error)
  }
}

export function loadFromStorage(): DocState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      return JSON.parse(data) as DocState
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error)
  }
  return null
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear localStorage:', error)
  }
}

export function generateBlockColor(index: number): string {
  const colors = [
    '#4A90D9',
    '#67C23A',
    '#E6A23C',
    '#F56C6C',
    '#909399',
    '#9B59B6',
    '#1ABC9C',
    '#E74C3C',
    '#3498DB',
    '#2ECC71',
  ]
  return colors[index % colors.length]
}
