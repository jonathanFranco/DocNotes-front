export interface ModelStatus {
  name: string
  available: boolean
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  ollama: {
    reachable: boolean
    llm: ModelStatus
    embedding: ModelStatus
    error: string | null
  }
}

export interface DocumentInfo {
  document_id: string
  filename: string
  page_count: number
  pages_with_text: number
  chunk_count: number
}

export interface UploadResponse {
  message: string
  document: DocumentInfo
  processing_seconds: number
}

export interface Source {
  page: number
  excerpt: string
  similarity: number
}

export interface ChatResponse {
  answer: string
  found: boolean
  sources: Source[]
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const API_BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, init)
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.')
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(response.status, body))
  }
  return body as T
}

function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (status === 502 || status === 504) return 'O servidor não respondeu. Verifique se o backend está rodando.'
  return `Erro inesperado no servidor (${status}).`
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

export async function getCurrentDocument(): Promise<DocumentInfo | null> {
  try {
    return await request<DocumentInfo>('/documents')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export function uploadDocument(file: File): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', file)
  return request<UploadResponse>('/documents/upload', { method: 'POST', body: form })
}

export function deleteDocument(): Promise<{ message: string }> {
  return request<{ message: string }>('/documents', { method: 'DELETE' })
}

export function askQuestion(question: string): Promise<ChatResponse> {
  return request<ChatResponse>('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
}
