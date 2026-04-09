import useWebSocket from 'react-use-websocket'
import { WS_BASE_URL } from '../config/env'

interface SessionPayload {
  engagement?: number
  message?: string
}

export function useSessionWebSocket(sessionId: string | undefined) {
  const socketUrl = sessionId
    ? `${WS_BASE_URL}/sessions/ws/stream/${sessionId}`
    : null

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket<SessionPayload>(
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
    sendJsonMessage,
    lastJsonMessage,
    readyState,
  }
}
