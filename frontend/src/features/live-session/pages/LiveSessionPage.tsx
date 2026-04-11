import { Card, DonutChart, LineChart, Metric, Text, Title } from '@tremor/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSessionWebSocket } from '../../../hooks/useSessionWebSocket'
import { useEndSessionMutation, useGetSessionMetricsQuery } from '../../../services/api/apiSlice'

export function LiveSessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lastJsonMessage, readyState } = useSessionWebSocket(id)
  const [endSession, { isLoading: isEnding }] = useEndSessionMutation()
  const [timeline, setTimeline] = useState<Array<{ time: string; engagement: number }>>([])
  const sessionId = Number(id)
  const { data: metrics } = useGetSessionMetricsQuery(sessionId, { skip: !id || Number.isNaN(sessionId) })

  const currentEngagement = lastJsonMessage?.engagement_score ?? 0
  const engagedCount = lastJsonMessage?.engaged_count ?? 0
  const distractedCount = lastJsonMessage?.distracted_count ?? 0
  const liveLatency = lastJsonMessage?.processing_latency_ms
  const runtimeSec = lastJsonMessage?.runtime_sec
  const processedFrames = lastJsonMessage?.processed_frames
  const liveFps = lastJsonMessage?.live_fps
  const sourceFps = lastJsonMessage?.source_fps
  const streamCompleted = Boolean(lastJsonMessage?.stream_completed)
  const alertState = lastJsonMessage?.alert_state
  const frameSrc = lastJsonMessage?.frame_jpeg_base64
    ? `data:image/jpeg;base64,${lastJsonMessage.frame_jpeg_base64}`
    : null
  const frameW = lastJsonMessage?.frame_width ?? 1
  const frameH = lastJsonMessage?.frame_height ?? 1
  const overlayDetections = lastJsonMessage?.classifications ?? []
  const [alertHistory, setAlertHistory] = useState<Array<{ id: number; msg: string; time: string }>>([])

  useEffect(() => {
    if (!lastJsonMessage) {
      return
    }

    const seconds = Math.floor(lastJsonMessage.timestamp_sec ?? 0)
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    const timeLabel = `${mm}:${ss}`

    setTimeline((prev) => {
      const next = [...prev, { time: timeLabel, engagement: lastJsonMessage.engagement_score ?? 0 }]
      return next.slice(-120)
    })

    // Log alerts in history if they are new
    if (lastJsonMessage.alert_state?.active) {
      const existing = alertHistory.find((h) => h.msg === lastJsonMessage.alert_state?.reason)
      if (!existing) {
        setAlertHistory((prev) => [
          {
            id: Date.now(),
            msg: lastJsonMessage.alert_state?.reason || 'Low engagement detected',
            time: new Date().toLocaleTimeString(),
          },
          ...prev,
        ].slice(0, 5))
      }
    } else if (lastJsonMessage.message && !lastJsonMessage.alert_state?.active) {
      // General system messages
      setAlertHistory((prev) => [
          { id: Date.now(), msg: lastJsonMessage.message!, time: new Date().toLocaleTimeString() },
          ...prev,
      ].slice(0, 5))
    }
  }, [lastJsonMessage, alertHistory])

  const engagementBreakdown = useMemo(
    () => [
      { label: 'Engaged', value: engagedCount },
      { label: 'Distracted', value: distractedCount },
    ],
    [distractedCount, engagedCount],
  )

  async function handleEndSession() {
    if (!id) {
      return
    }
    try {
      const result = await endSession(Number(id)).unwrap()
      navigate(`/session/${id}/summary`, {
        state: {
          final_avg_score: result.final_avg_score,
        },
      })
    } catch {
      // Keep user on page; stream may still be active.
    }
  }

  const connectionLabel = streamCompleted
    ? 'Completed'
    : readyState === 1
      ? 'Live'
      : readyState === 0
        ? 'Connecting'
        : 'Reconnecting'

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-xl border bg-white p-3 shadow-card">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-950">
          {frameSrc ? (
            <img src={frameSrc} alt="Live session frame" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-300">
              Waiting for video frames...
            </div>
          )}

          {frameSrc
            ? overlayDetections.map((det, idx) => {
                const box = det.box
                if (!box || box.length !== 4 || frameW <= 0 || frameH <= 0) {
                  return null
                }
                const [x1, y1, x2, y2] = box
                const left = `${Math.max(0, (x1 / frameW) * 100)}%`
                const top = `${Math.max(0, (y1 / frameH) * 100)}%`
                const width = `${Math.max(0, ((x2 - x1) / frameW) * 100)}%`
                const height = `${Math.max(0, ((y2 - y1) / frameH) * 100)}%`
                const label = det.label ?? 'unknown'
                const confidence = typeof det.confidence === 'number' ? ` ${Math.round(det.confidence * 100)}%` : ''
                const distracted = label === 'sleep' || label === 'using_device' || label === 'turn_head'

                return (
                  <div
                    key={`${idx}-${x1}-${y1}-${x2}-${y2}`}
                    className={`absolute border-2 ${distracted ? 'border-rose-400' : 'border-emerald-400'}`}
                    style={{ left, top, width, height }}
                  >
                    <span
                      className={`absolute -top-6 left-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${
                        distracted ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                    >
                      {label}
                      {confidence}
                    </span>
                  </div>
                )
              })
            : null}

          <div className="absolute left-3 top-3 rounded-lg bg-black/60 px-3 py-2 text-xs text-white backdrop-blur">
            <p className="font-semibold">Session {id} • {connectionLabel}</p>
            <p>Time {typeof runtimeSec === 'number' ? `${runtimeSec}s` : '-'}</p>
            <p>Frame #{lastJsonMessage?.frame_index ?? '-'}</p>
          </div>

          <div className="absolute right-3 top-3 rounded-lg bg-black/60 px-3 py-2 text-right text-xs text-white backdrop-blur">
            <p className="text-[10px] uppercase tracking-wide text-slate-300">Engagement</p>
            <p className="text-2xl font-bold leading-none">{Math.round(currentEngagement)}%</p>
            <p>Engaged {engagedCount} • Distracted {distractedCount}</p>
          </div>

          <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-3 py-2 text-xs text-white backdrop-blur">
            <p>Latency {typeof liveLatency === 'number' ? `${liveLatency} ms` : '-'}</p>
            <p>Live FPS {liveFps ?? '-'} • Source FPS {sourceFps ?? '-'}</p>
            <p>Processed frames {processedFrames ?? '-'}</p>
          </div>

          {alertState?.active ? (
            <div className="absolute bottom-3 right-3 max-w-[60%] rounded-lg border border-rose-400 bg-rose-950/85 px-3 py-2 text-xs font-semibold text-rose-100">
              ALERT: {alertState.reason || 'Low engagement detected'}
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {frameSrc ? 'Live frame stream active' : 'No frame payload yet'}
            {lastJsonMessage ? ` • payload keys received` : ''}
          </p>
          <button
            type="button"
            onClick={handleEndSession}
            disabled={isEnding}
            className="inline-flex rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
          >
            {isEnding ? 'Ending...' : 'End Session'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <Title>Live Engagement</Title>
          <Metric>{Math.round(currentEngagement)}%</Metric>
          <DonutChart
            className="mt-3"
            data={engagementBreakdown}
            category="value"
            index="label"
            valueFormatter={(value) => `${value}`}
          />
        </Card>

        <Card>
          <Title>Runtime Metrics</Title>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Live latency</p>
              <p className="text-base font-semibold text-slate-900">
                {typeof liveLatency === 'number' ? `${liveLatency} ms` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Live FPS</p>
              <p className="text-base font-semibold text-slate-900">{liveFps ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Runtime</p>
              <p className="text-base font-semibold text-slate-900">
                {typeof runtimeSec === 'number' ? `${runtimeSec}s` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Processed frames</p>
              <p className="text-base font-semibold text-slate-900">{processedFrames ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Avg latency</p>
              <p className="text-base font-semibold text-slate-900">{metrics?.avg_latency_ms ?? '-'} ms</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">P95 latency</p>
              <p className="text-base font-semibold text-slate-900">{metrics?.p95_latency_ms ?? '-'} ms</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Actual FPS</p>
              <p className="text-base font-semibold text-slate-900">{metrics?.actual_fps ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Source FPS / Alerts</p>
              <p className="text-base font-semibold text-slate-900">{sourceFps ?? '-'} / {metrics?.alert_count ?? 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <Title>Engagement Timeline</Title>
          <LineChart
            className="mt-4 h-56"
            data={timeline}
            index="time"
            categories={['engagement']}
            colors={['indigo']}
            yAxisWidth={40}
          />
        </Card>

        <Card decoration="top" decorationColor={alertState?.active ? 'rose' : 'slate'}>
          <Title className="flex items-center gap-2">
            AI Co-Pilot Alert
            {alertState?.active && (
              <span className="flex h-2 w-2 animate-ping rounded-full bg-rose-500" />
            )}
          </Title>
          <Text className={`mt-2 ${alertState?.active ? 'font-semibold text-rose-600' : ''}`}>
            {alertState?.active
              ? alertState.reason || 'Low engagement alert is active.'
              : lastJsonMessage?.message
                ? lastJsonMessage.message
                : 'No intervention required yet. Alerts will appear on sustained low engagement.'}
          </Text>
        </Card>

        <Card>
          <Title className="text-sm">Intervention History</Title>
          <div className="mt-4 space-y-3">
            {alertHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No events logged yet.</p>
            ) : (
              alertHistory.map((h) => (
                <div key={h.id} className="flex flex-col border-l-2 border-slate-200 pl-3">
                  <p className="text-xs font-semibold text-slate-800">{h.msg}</p>
                  <p className="text-[10px] text-slate-400">{h.time}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </section>
  )
}
