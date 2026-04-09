import useWebSocket from 'react-use-websocket'
import { WS_BASE_URL } from '../config/env'

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
  const socketUrl = sessionId
    ? `${WS_BASE_URL}/sessions/ws/stream/${sessionId}`
    : null

  const { lastJsonMessage, readyState } = useWebSocket<SessionPayload>(
    socketUrl,
    {
      shouldReconnect: () => true,
      reconnectInterval: 3000,
      heartbeat: {
        message: 'ping',
        interval: 30000,
      },
    },
  )

  return {
    lastJsonMessage,
    readyState,
  }
}
