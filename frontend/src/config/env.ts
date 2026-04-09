const defaultApiBaseUrl = 'http://localhost:8000'
const defaultWsBaseUrl = 'ws://localhost:8000'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl

export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? defaultWsBaseUrl
