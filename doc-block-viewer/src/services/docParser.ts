import mammoth from 'mammoth'

export interface ParseResult {
  content: string[]
  fileName: string
}

export async function parseDocument(file: File): Promise<ParseResult> {
  const fileName = file.name
  const extension = fileName.split('.').pop()?.toLowerCase()

  if (extension === 'txt') {
    return parseTextFile(file)
  }

  if (extension === 'docx') {
    return parseDocxFile(file)
  }

  if (extension === 'doc') {
    throw new Error('暂不支持 .doc 格式，请将文件转换为 .docx 格式后上传')
  }

  throw new Error(`不支持的文件格式: .${extension}`)
}

async function parseTextFile(file: File): Promise<ParseResult> {
  const content = await file.text()
  const lines = content.split('\n').map((line) => line.trimEnd())
  return {
    content: lines,
    fileName: file.name,
  }
}

async function parseDocxFile(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  const lines = result.value.split('\n').map((line) => line.trimEnd())
  return {
    content: lines,
    fileName: file.name,
  }
}
