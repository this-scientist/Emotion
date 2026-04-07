import { supabase } from '../lib/supabase'
import type { ContentBlock } from '../types/block'
import type {
  BlockMappings,
  CreateSecureFileInput,
  SecureFilePayload,
} from '../types/secureFiles'

interface SecureFileCreated {
  id: string
  created_at: string
}

const secureFilesUrl = `${(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1/secure-files`

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    console.warn('用户未登录，无法访问安全文件API')
    throw new Error('UNAUTHENTICATED')
  }

  return token
}

async function secureRequest<T>(
  method: 'GET' | 'POST' | 'PATCH',
  options: {
    body?: unknown
    query?: string
  } = {},
): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(`${secureFilesUrl}${options.query ?? ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (!response.ok) {
    let message = 'secure file request failed'

    try {
      const errorBody = await response.json() as { message?: string }
      if (errorBody.message) {
        message = errorBody.message
      }
    } catch {
      // Keep the default error when the response body is not JSON.
    }

    throw new Error(message)
  }

  return await response.json() as T
}

export async function createSecureFile(
  payload: CreateSecureFileInput,
): Promise<SecureFileCreated> {
  return secureRequest<SecureFileCreated>('POST', { body: payload })
}

export async function getSecureFile(fileId: string): Promise<SecureFilePayload> {
  return secureRequest<SecureFilePayload>('GET', {
    query: `?fileId=${encodeURIComponent(fileId)}`,
  })
}

export async function saveSecureBlocks(
  fileId: string,
  blocks: ContentBlock[],
): Promise<void> {
  await secureRequest<{ ok: boolean }>('PATCH', {
    body: {
      fileId,
      op: 'blocks',
      value: blocks,
    },
  })
}

export async function saveSecureMappings(
  fileId: string,
  mappings: BlockMappings[],
): Promise<void> {
  await secureRequest<{ ok: boolean }>('PATCH', {
    body: {
      fileId,
      op: 'mappings',
      value: mappings,
    },
  })
}
