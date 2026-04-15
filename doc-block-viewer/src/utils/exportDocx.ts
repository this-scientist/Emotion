import {
  Document, Packer, Table, TableRow, TableCell,
  Paragraph, TextRun, WidthType, AlignmentType,
  VerticalAlign, BorderStyle,
} from 'docx'
import type { TableRowData } from '../components/TableEditor.vue'
import { intentLabel, techLabel } from '../data/tableData'
import type { FormattedLine } from './extractSpeakers'

// 宋体5号 = 9pt = 18 half-points
const SONG_SIZE = 18

/** 统一文字样式：宋体5号 */
function songRun(text: string, bold = false): TextRun {
  return new TextRun({ text, bold, size: SONG_SIZE, font: { name: '宋体' } })
}

/** 带边框的表格单元格，宋体5号 */
function cell(
  text: string,
  opts: {
    bold?: boolean
    rowSpan?: number
    columnSpan?: number
    align?: typeof AlignmentType[keyof typeof AlignmentType]
    vAlign?: typeof VerticalAlign[keyof typeof VerticalAlign]
    width?: number
  } = {}
): TableCell {
  const b = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  return new TableCell({
    rowSpan: opts.rowSpan,
    columnSpan: opts.columnSpan,
    verticalAlign: opts.vAlign as any ?? VerticalAlign.CENTER,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    borders: { top: b, bottom: b, left: b, right: b },
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.CENTER,
        children: [songRun(text, opts.bold)],
      }),
    ],
  })
}

/** 根据 TableRowData[] 生成 docx Table 对象 */
function buildTable(rows: TableRowData[]): Table {
  const headerRow1 = new TableRow({
    tableHeader: true,
    children: [
      cell('助人者意图',        { bold: true, rowSpan: 2, width: 1500 }),
      cell('助人技术',          { bold: true, rowSpan: 2, width: 1500 }),
      cell('有效性 5 点评分',   { bold: true, columnSpan: 2, width: 2000 }),
      cell('当事人反应',        { bold: true, rowSpan: 2, width: 1300 }),
      cell('更好的干预（如有）', { bold: true, rowSpan: 2, width: 2500 }),
    ],
  })

  const headerRow2 = new TableRow({
    tableHeader: true,
    children: [
      cell('咨询师', { bold: true, width: 1000 }),
      cell('来访者', { bold: true, width: 1000 }),
    ],
  })

  const dataRows = rows.map(row =>
    new TableRow({
      children: [
        cell(row.intents.map(i => intentLabel(i)).join('、'),
          { align: AlignmentType.LEFT, vAlign: VerticalAlign.TOP }),
        cell(row.techs.map(t => techLabel(t)).join('\n'),
          { align: AlignmentType.LEFT, vAlign: VerticalAlign.TOP }),
        cell(row.scoreC  ?? '', { align: AlignmentType.CENTER }),
        cell(row.scoreV  ?? '', { align: AlignmentType.CENTER }),
        cell(row.reaction ?? '', { align: AlignmentType.LEFT, vAlign: VerticalAlign.TOP }),
        cell(row.betterIntervention ?? '', { align: AlignmentType.LEFT, vAlign: VerticalAlign.TOP }),
      ],
    })
  )

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow1, headerRow2, ...dataRows],
  })
}

/**
 * 混合导出：正文段落 + 嵌入表格
 * contentItems 是顺序排列的内容项，可以是文本段落或表格
 */
export interface DocTextItem {
  type: 'text'
  line: FormattedLine
}
export interface DocTableItem {
  type: 'table'
  rows: TableRowData[]
}
export type DocItem = DocTextItem | DocTableItem

export async function exportMixedDocx(
  items: DocItem[],
  blockName: string
): Promise<Blob> {
  const children: (Paragraph | Table)[] = []

  // 标题
  children.push(
    new Paragraph({
      children: [songRun(blockName, true)],
      spacing: { after: 200 },
    })
  )

  for (const item of items) {
    if (item.type === 'text') {
      const line = item.line
      if (line.type === 'plain') {
        // 普通行
        children.push(
          new Paragraph({
            children: [songRun(line.text)],
            spacing: { after: 0 },
          })
        )
      } else {
        // 发言段落：咨询师：内容 / 来访者：内容
        children.push(
          new Paragraph({
            children: [
              songRun(`${line.roleLabel}：`, true),
              songRun(line.content),
            ],
            spacing: { after: 80 },
          })
        )
      }
    } else {
      // 插入表格（前后各加一个空行）
      children.push(new Paragraph({ children: [songRun('')], spacing: { after: 0 } }))
      children.push(buildTable(item.rows))
      children.push(new Paragraph({ children: [songRun('')], spacing: { after: 0 } }))
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: { name: '宋体' }, size: SONG_SIZE },
        },
      },
    },
    sections: [{ children }],
  })

  return Packer.toBlob(doc)
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

// 保留旧接口兼容（单独导出表格）
export async function exportTableToDocx(
  rows: TableRowData[],
  blockName: string
): Promise<Blob> {
  return exportMixedDocx(
    [{ type: 'table', rows }],
    blockName
  )
}
