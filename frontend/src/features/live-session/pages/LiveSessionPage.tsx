import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
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

  const detections = lastJsonMessage?.classifications ?? []
  const inferredDistracted = detections.filter((d) => {
    const label = d.label ?? ''
    return label === 'sleep' || label === 'using_device' || label === 'turn_head'
  }).length
  const inferredStudentCount =
    lastJsonMessage?.student_count ??
    lastJsonMessage?.behavior_boxes ??
    detections.length

  const currentEngagement = lastJsonMessage?.engagement_score ?? 0
  const distractedCount = lastJsonMessage?.distracted_count ?? inferredDistracted
  const engagedCount =
    lastJsonMessage?.engaged_count ??
    Math.max(0, inferredStudentCount - distractedCount)
  const liveLatency = lastJsonMessage?.processing_latency_ms
  const runtimeSec =
    lastJsonMessage?.runtime_sec ??
    lastJsonMessage?.timestamp_sec ??
    (lastJsonMessage?.processed_frames && lastJsonMessage?.live_fps
      ? lastJsonMessage.processed_frames / Math.max(lastJsonMessage.live_fps, 0.1)
      : undefined)
  const processedFrames =
    lastJsonMessage?.processed_frames ??
    ((lastJsonMessage?.frame_index ?? -1) + 1)
  const liveFps = lastJsonMessage?.live_fps
  const sourceFps = lastJsonMessage?.source_fps
  const streamCompleted = Boolean(lastJsonMessage?.stream_completed)
  const alertState = lastJsonMessage?.alert_state
  const frameSrc = lastJsonMessage?.frame_jpeg_base64
    ? `data:image/jpeg;base64,${lastJsonMessage.frame_jpeg_base64}`
    : null
  const frameW = lastJsonMessage?.frame_width ?? 1
  const frameH = lastJsonMessage?.frame_height ?? 1
  const overlayDetections = detections
  const [alertHistory, setAlertHistory] = useState<Array<{ id: number; msg: string; time: string }>>([])

  useEffect(() => {
    if (!lastJsonMessage) {
      return
    }

    const timelineSeconds =
      lastJsonMessage.timestamp_sec ??
      lastJsonMessage.runtime_sec ??
      (typeof runtimeSec === 'number' ? runtimeSec : 0)
    const seconds = Math.floor(timelineSeconds)
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
    [distractedCount, engagedCount]
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

  const PIE_COLORS = ['#10b981', '#f43f5e'] // Emerald for engaged, Rose for distracted

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm backdrop-blur-md">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950 shadow-inner">
          {frameSrc ? (
            <img src={frameSrc} alt="Live session frame" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-medium text-slate-400">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                Waiting for video frames...
              </div>
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
                    className={`absolute border-2 transition-all duration-200 ${distracted ? 'border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}
                    style={{ left, top, width, height }}
                  >
                    <span
                      className={`absolute -top-6 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm ${
                        distracted ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                    >
                      {label.toUpperCase()}
                      {confidence}
                    </span>
                  </div>
                )
              })
            : null}

          <div className="absolute left-4 top-4 rounded-xl bg-black/40 px-4 py-2.5 text-xs text-white shadow-lg backdrop-blur-md border border-white/10">
            <p className="font-bold tracking-wide">Session {id} <span className="mx-2 text-slate-400">•</span> {connectionLabel}</p>
            <div className="mt-1 flex gap-3 text-slate-300">
              <p>Time: <span className="font-semibold text-white">{typeof runtimeSec === 'number' ? `${runtimeSec}s` : '-'}</span></p>
              <p>Frame: <span className="font-semibold text-white">#{lastJsonMessage?.frame_index ?? '-'}</span></p>
            </div>
          </div>

          <div className="absolute right-4 top-4 rounded-xl bg-black/40 px-4 py-2.5 text-right text-xs text-white shadow-lg backdrop-blur-md border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Engagement</p>
            <p className="mt-0.5 text-3xl font-black tabular-nums leading-none tracking-tight">{Math.round(currentEngagement)}%</p>
            <p className="mt-1 flex justify-end gap-2 text-[10px] font-medium text-slate-300">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>{engagedCount}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>{distractedCount}</span>
            </p>
          </div>

          <div className="absolute bottom-4 left-4 rounded-xl bg-black/40 px-4 py-2.5 text-xs text-white shadow-lg backdrop-blur-md border border-white/10">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p className="text-slate-300">Latency: <span className="font-semibold text-white">{typeof liveLatency === 'number' ? `${liveLatency}ms` : '-'}</span></p>
              <p className="text-slate-300">Live FPS: <span className="font-semibold text-white">{liveFps ?? '-'} / {sourceFps ?? '-'}</span></p>
              <p className="col-span-2 text-slate-300">Processed: <span className="font-semibold text-white">{processedFrames ?? '-'} frames</span></p>
            </div>
          </div>

          {alertState?.active ? (
            <div className="absolute bottom-4 right-4 max-w-[50%] animate-pulse rounded-xl border border-rose-500/50 bg-rose-950/80 px-4 py-3 text-xs font-bold text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.3)] backdrop-blur-md">
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
                </span>
                ALERT: {alertState.reason || 'Low engagement detected'}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between px-2">
          <p className="text-xs font-medium text-slate-500">
            {frameSrc ? (
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Live frame stream active
                {lastJsonMessage ? ` • Payload received` : ''}
              </span>
            ) : (
              'No frame payload yet'
            )}
          </p>
          <button
            type="button"
            onClick={handleEndSession}
            disabled={isEnding}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-rose-600/20 transition-all hover:bg-rose-500 hover:shadow-md disabled:opacity-60"
          >
            {isEnding ? (
               <>
                 <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                 Ending...
               </>
             ) : 'End Session'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Live Engagement</h3>
              <p className="text-3xl font-black tabular-nums tracking-tight text-indigo-600 mt-1">{Math.round(currentEngagement)}%</p>
            </div>
            <div className="h-24 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', padding: '4px 8px' }}
                    itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                  />
                  <Pie
                    data={engagementBreakdown.filter(d => d.value > 0)}
                    innerRadius={25}
                    outerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {engagementBreakdown.filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[engagementBreakdown.findIndex(e => e.label === entry.label) % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-indigo-50/50 mix-blend-multiply blur-2xl"></div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Runtime Metrics</h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live latency</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                {typeof liveLatency === 'number' ? `${liveLatency} ms` : '-'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live FPS</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{liveFps ?? '-'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Runtime</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                {typeof runtimeSec === 'number' ? `${runtimeSec}s` : '-'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Processed</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{processedFrames ?? '-'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg / P95 Latency</p>
              <p className="mt-1 text-base font-bold tabular-nums text-slate-900">
                {metrics?.avg_latency_ms ?? '-'} / {metrics?.p95_latency_ms ?? '-'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Actual FPS / Alerts</p>
              <p className="mt-1 text-base font-bold tabular-nums text-slate-900">
                 {metrics?.actual_fps ?? '-'} / {metrics?.alert_count ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="flex h-64 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Engagement Timeline</h3>
          <div className="mt-4 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTimeline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} minTickGap={30} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '8px' }}
                  itemStyle={{ color: '#1e293b', fontWeight: 600, fontSize: '12px' }}
                  labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '2px' }}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTimeline)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors duration-300 ${alertState?.active ? 'border-rose-300' : 'border-slate-200'}`}>
          <div className={`border-b px-6 py-4 ${alertState?.active ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
              AI Co-Pilot Alert
              {alertState?.active && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                </span>
              )}
            </h3>
          </div>
          <div className="p-6">
            <p className={`font-medium ${alertState?.active ? 'text-rose-600' : 'text-slate-600'}`}>
              {alertState?.active
                ? alertState.reason || 'Low engagement alert is active.'
                : lastJsonMessage?.message
                  ? lastJsonMessage.message
                  : 'No intervention required yet. Alerts will appear on sustained low engagement.'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Intervention History</h3>
          <div className="mt-4 max-h-40 overflow-y-auto pr-2 space-y-3">
            {alertHistory.length === 0 ? (
              <p className="text-sm italic text-slate-400">No events logged yet.</p>
            ) : (
              alertHistory.map((h) => (
                <div key={h.id} className="group flex flex-col rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-slate-100/50">
                  <p className="text-sm font-bold text-slate-800">{h.msg}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">{h.time}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
