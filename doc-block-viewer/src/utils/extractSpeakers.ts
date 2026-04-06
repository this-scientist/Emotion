/**
 * 发言稿格式：发言人名和时间戳在同一行，空格分隔
 *
 * 示例：
 *   Orange 2026-03-25 18:04:03
 *   发言内容第一行
 *   发言内容第二行
 *
 *   老赵 2026-03-25 18:04:27
 *   发言内容...
 *
 * 规则：匹配 "任意非空文本 + 空格 + yyyy-MM-dd HH:mm:ss" 的行
 *       开头部分即为发言人姓名
 */

// 匹配"发言人 时间戳"整行：捕获组1=发言人，捕获组2=时间戳
const SPEAKER_LINE_RE = /^(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*$/

/**
 * 解析一行，返回 { speaker, timestamp } 或 null
 */
function parseSpeakerLine(line: string): { speaker: string; timestamp: string } | null {
  const m = line.trim().match(SPEAKER_LINE_RE)
  if (!m) return null
  return { speaker: m[1].trim(), timestamp: m[2].trim() }
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
  | { type: 'speech'; roleLabel: string; role: 'counselor' | 'visitor'; speaker: string; timestamp: string; content: string }
  | { type: 'plain'; text: string }

/**
 * 将块内容按角色映射格式化，返回结构化行数组
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
      const { speaker, timestamp } = parsed
      const role      = counselors.has(speaker) ? 'counselor' : 'visitor'
      const roleLabel = role === 'counselor' ? '咨询师' : '来访者'

      // 收集后续内容行，直到遇到下一个发言人行
      const contentLines: string[] = []
      let j = i + 1
      while (j < lines.length) {
        const nextParsed = parseSpeakerLine(lines[j])
        // 只要下一行是"任意发言人"（不限于已映射的）就停止，避免遗漏段落
        if (nextParsed) break
        contentLines.push(lines[j])
        j++
      }

      result.push({
        type: 'speech',
        roleLabel,
        role,
        speaker,
        timestamp,
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
