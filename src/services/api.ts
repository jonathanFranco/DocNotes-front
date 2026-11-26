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
}

export interface UploadResponse {
  message: string
  document: DocumentInfo
  processing_seconds: number
}

type ErrorParams = Record<string, string | number>

export interface SummaryPoint {
  text: string
  verified: boolean | null
  evidence: { page: number; excerpt: string } | null
}

export interface SummaryResponse {
  status: 'generating' | 'ready' | 'failed'
  stage: 'reading' | 'writing' | 'checking' | null
  progress: { done: number; total: number } | null
  points: SummaryPoint[]
  error: { code: string; params: ErrorParams } | null
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
  params?: ErrorParams
}

const ERROR_MESSAGES: Record<string, (params: ErrorParams) => string> = {
  FILE_NOT_PDF: () => 'Envie um arquivo com extensão .pdf.',
  FILE_EMPTY: () => 'O arquivo está vazio.',
  FILE_TOO_LARGE: (p) => `O arquivo excede o limite de ${p.max_mb} MB.`,
  PDF_INVALID: () => 'O arquivo não é um PDF válido.',
  PDF_CORRUPTED: () => 'Não foi possível abrir o PDF; o arquivo pode estar corrompido.',
  PDF_PASSWORD_PROTECTED: () => 'PDF protegido por senha não é suportado.',
  PDF_NO_PAGES: () => 'O PDF não contém páginas.',
  PDF_NO_TEXT: () => 'Nenhum texto extraível encontrado. PDFs digitalizados (apenas imagem) não são suportados.',
  NO_DOCUMENT: () => 'Nenhum documento carregado. Envie um PDF primeiro.',
  SUMMARY_EMPTY: () => 'O modelo não conseguiu resumir este documento. Tente novamente.',
  SUMMARY_FAILED: () => 'Algo deu errado ao gerar o resumo. Tente novamente.',
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

export function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.'
}

export function describeError(code: string, params: ErrorParams = {}): string {
  return ERROR_MESSAGES[code]?.(params) ?? 'Algo deu errado. Tente novamente.'
}

function errorMessage(status: number, code: string | null, params: ErrorParams): string {
  if (code && ERROR_MESSAGES[code]) return describeError(code, params)
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

export function getSummary(): Promise<SummaryResponse> {
  return request<SummaryResponse>('/documents/summary')
}

export function retrySummary(): Promise<SummaryResponse> {
  return request<SummaryResponse>('/documents/summary', { method: 'POST' })
}
