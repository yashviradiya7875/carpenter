import { getAuthToken } from '../auth/session'

type ApiErrorBody = {
  status?: string
  message?: string
  details?: unknown
}

type CallableEnvelope<T> = {
  result: T
}

type CallableRequestOptions = {
  signal?: AbortSignal
}

type ApiErrorOptions = {
  code?: string
  httpStatus?: number
  details?: unknown
  cause?: unknown
}

export class ApiError extends Error {
  readonly code?: string
  readonly httpStatus?: number
  readonly details?: unknown

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.code = options.code
    this.httpStatus = options.httpStatus
    this.details = options.details
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081').replace(/\/+$/, '')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readApiError(value: unknown): ApiErrorBody | null {
  if (!isRecord(value) || !isRecord(value.error)) return null

  const { status, message, details } = value.error
  return {
    status: typeof status === 'string' ? status : undefined,
    message: typeof message === 'string' ? message : undefined,
    details,
  }
}

export async function callApi<TResponse, TData extends object = Record<string, unknown>>(
  endpoint: string,
  data: TData,
  options: CallableRequestOptions = {},
): Promise<TResponse> {
  const token = getAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data }),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('Unable to reach the API server.', { cause: error })
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new ApiError('The API returned an unreadable response.', {
      httpStatus: response.status,
      cause: error,
    })
  }

  if (!response.ok) {
    const apiError = readApiError(payload)
    throw new ApiError(apiError?.message || `The request failed (${response.status}).`, {
      code: apiError?.status,
      httpStatus: response.status,
      details: apiError?.details,
    })
  }

  if (!isRecord(payload) || !('result' in payload)) {
    throw new ApiError('The API response did not include a result.', {
      httpStatus: response.status,
    })
  }

  return (payload as CallableEnvelope<TResponse>).result
}