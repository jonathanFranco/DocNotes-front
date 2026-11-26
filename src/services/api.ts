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

interface ErrorBody {
  code?: string
  params?: Record<string, string | number>
}

const ERROR_MESSAGES: Record<string, (params: Record<string, string | number>) => string> = {
  FILE_NOT_PDF: () => 'Envie um arquivo com extensão .pdf.',
  FILE_EMPTY: () => 'O arquivo está vazio.',
  FILE_TOO_LARGE: (p) => `O arquivo excede o limite de ${p.max_mb} MB.`,
  PDF_INVALID: () => 'O arquivo não é um PDF válido.',
  PDF_CORRUPTED: () => 'Não foi possível abrir o PDF; o arquivo pode estar corrompido.',
  PDF_PASSWORD_PROTECTED: () => 'PDF protegido por senha não é suportado.',
  PDF_NO_PAGES: () => 'O PDF não contém páginas.',
  PDF_NO_TEXT: () => 'Nenhum texto extraível encontrado. PDFs digitalizados (apenas imagem) não são suportados.',
  QUESTION_EMPTY: () => 'A pergunta não pode estar vazia.',
  QUESTION_TOO_LONG: (p) => `A pergunta deve ter no máximo ${p.max_chars} caracteres.`,
  NO_DOCUMENT: () => 'Nenhum documento carregado. Envie um PDF antes de perguntar.',
  OLLAMA_UNAVAILABLE: () => 'O Ollama não está respondendo. Verifique se ele está rodando e tente novamente.',
  OLLAMA_MODEL_ERROR: (p) => `O Ollama não conseguiu usar o modelo "${p.model}". Verifique se ele está instalado.`,
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
    const { code = null, params = {} } = (body ?? {}) as ErrorBody
    throw new ApiError(response.status, errorMessage(response.status, code, params))
  }
  return body as T
}

function errorMessage(status: number, code: string | null, params: Record<string, string | number>): string {
  const message = code ? ERROR_MESSAGES[code] : undefined
  if (message) return message(params)
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
