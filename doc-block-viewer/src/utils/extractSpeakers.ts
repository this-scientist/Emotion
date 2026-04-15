/**
 * 发言稿格式解析器
 * 
 * 支持两种格式：
 * 1. 旧格式：发言人名 + 空格 + yyyy-MM-dd HH:mm:ss
 *    示例：Orange 2026-03-25 18:04:03
 * 
 * 2. 新格式：发言人名 + (HH:MM:SS)
 *    示例：段月维(00:01:16):
 * 
 * 规则：
 * - 捕获发言人姓名
 * - 忽略时间戳（不保留）
 * - 发言内容在后续行，直到遇到下一个发言人行
 */

// 旧格式：发言人 年月日 时分秒
const OLD_FORMAT_RE = /^(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*$/

// 新格式：发言人(HH:MM:SS): 或 发言人(HH:MM:SS)
const NEW_FORMAT_RE = /^(.+?)\s*\((\d{2}:\d{2}:\d{2})\)\s*:?\s*$/

// 新格式（内容在同一行）：发言人(HH:MM:SS): 内容
const NEW_FORMAT_INLINE_RE = /^(.+?)\s*\((\d{2}:\d{2}:\d{2})\)\s*:\s*(.+)$/

/**
 * 解析一行，返回发言人信息或 null
 * 不保留时间戳，只提取发言人姓名
 */
function parseSpeakerLine(line: string): { speaker: string; hasContent: boolean; inlineContent?: string } | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // 先检查是否是内联格式：发言人(时间): 内容
  const inlineMatch = trimmed.match(NEW_FORMAT_INLINE_RE)
  if (inlineMatch) {
    return { 
      speaker: inlineMatch[1].trim(), 
      hasContent: true,
      inlineContent: inlineMatch[3].trim()
    }
  }

  // 检查新格式：发言人(时间): 或 发言人(时间)
  const newMatch = trimmed.match(NEW_FORMAT_RE)
  if (newMatch) {
    return { speaker: newMatch[1].trim(), hasContent: false }
  }

  // 检查旧格式：发言人 年月日 时分秒
  const oldMatch = trimmed.match(OLD_FORMAT_RE)
  if (oldMatch) {
    return { speaker: oldMatch[1].trim(), hasContent: false }
  }

  return null
}

/**
 * 从文本行中提取所有不重复的发言人
 */
export function extractSpeakers(lines: string[]): string[] {
  const speakers = new Set<string>()
  for (const line of lines) {
    const parsed = parseSpeakerLine(line)
    if (parsed) speakers.add(parsed.speaker)
  }
  return Array.from(speakers)
}

// ─────────────────────────────────────────────

export interface SpeakerMapping {
  speaker: string
  role: 'counselor' | 'visitor'
}

export type FormattedLine =
  | { type: 'speech'; roleLabel: string; role: 'counselor' | 'visitor'; speaker: string; content: string }
  | { type: 'plain'; text: string }

/**
 * 将块内容按角色映射格式化，返回结构化行数组
 * 不显示时间戳，只保留发言者和内容
 */
export function applyMapping(
  lines: string[],
  mappings: SpeakerMapping[]
): FormattedLine[] {
  const counselors  = new Set(mappings.filter(m => m.role === 'counselor').map(m => m.speaker))
  const visitors    = new Set(mappings.filter(m => m.role === 'visitor').map(m => m.speaker))
  const allSpeakers = new Set(mappings.map(m => m.speaker))

  const result: FormattedLine[] = []

  let i = 0
  while (i < lines.length) {
    const parsed = parseSpeakerLine(lines[i])

    if (parsed && allSpeakers.has(parsed.speaker)) {
      // ── 发言块开始 ──
      const { speaker, hasContent, inlineContent } = parsed
      const role      = counselors.has(speaker) ? 'counselor' : 'visitor'
      const roleLabel = role === 'counselor' ? '咨询师' : '来访者'

      // 内容行数组
      const contentLines: string[] = []

      // 如果有内联内容，先加入
      if (hasContent && inlineContent) {
        contentLines.push(inlineContent)
      }

      // 收集后续内容行，直到遇到下一个发言人行
      let j = i + 1
      while (j < lines.length) {
        const nextParsed = parseSpeakerLine(lines[j])
        // 只要下一行是"任意发言人"就停止
        if (nextParsed) break
        contentLines.push(lines[j])
        j++
      }

      result.push({
        type: 'speech',
        roleLabel,
        role,
        speaker,
        content: contentLines.join('\n').trim(),
      })

      i = j
    } else {
      // 普通行（标题、空行等）
      const text = lines[i].trim()
      if (text) {
        result.push({ type: 'plain', text })
      }
      i++
    }
  }

  return result
}
