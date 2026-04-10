import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import useWebSocketImport from 'react-use-websocket'
import { WS_BASE_URL } from '../config/env'
import type { RootState } from '../app/store'

const useWebSocket =
  (useWebSocketImport as unknown as { default?: typeof useWebSocketImport }).default ?? useWebSocketImport

export interface SessionPayload {
  session_id?: number
  frame_index: number
  timestamp_sec: number
  engagement_score: number
  engaged_count: number
  distracted_count: number
  classifications?: Array<Record<string, unknown>>
  message?: string
  alert_state?: {
    active: boolean
    reason: string
    triggered_at?: string
  }
}

export function useSessionWebSocket(sessionId: string | undefined) {
  const token = useSelector((s: RootState) => s.auth.accessToken)

  const socketUrl = useMemo(() => {
    if (!sessionId) return null
    // Attach access token as query param to support authenticated websocket proxies.
    if (token) {
      const sep = WS_BASE_URL.includes('?') ? '&' : '?'
      return `${WS_BASE_URL}/sessions/ws/stream/${sessionId}${sep}token=${encodeURIComponent(token)}`
    }
    return `${WS_BASE_URL}/sessions/ws/stream/${sessionId}`
  }, [sessionId, token])

  const { lastJsonMessage, readyState } = useWebSocket<SessionPayload>(socketUrl, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
    heartbeat: {
      message: 'ping',
      interval: 30000,
    },
  })

  return {
    lastJsonMessage,
    readyState,
  }
}
