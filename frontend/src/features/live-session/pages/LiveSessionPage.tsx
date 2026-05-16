import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
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
  const [isFullscreen, setIsFullscreen] = useState(false)
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
  const alert_active = alertState?.active
  const [alertHistory, setAlertHistory] = useState<Array<{ id: number; msg: string; time: string }>>([])
  const lowEngagementToastRef = useRef<string | null>(null)

  const handleFullscreenToggle = async () => {
    const videoContainer = document.getElementById('video-feed-container')
    if (!videoContainer) return

    try {
      if (!isFullscreen) {
        if (videoContainer.requestFullscreen) {
          await videoContainer.requestFullscreen()
        } else if ((videoContainer as any).webkitRequestFullscreen) {
          await (videoContainer as any).webkitRequestFullscreen()
        }
        setIsFullscreen(true)
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen()
        } else if ((document as any).webkitFullscreenElement) {
          await (document as any).webkitExitFullscreen()
        }
        setIsFullscreen(false)
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        setIsFullscreen(false)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [])

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
    // Low engagement toast (below 70%)
    if (currentEngagement > 0 && currentEngagement < 70) {
      if (!lowEngagementToastRef.current) {
        lowEngagementToastRef.current = toast.error(
          `⚠️ Engagement dropped to ${Math.round(currentEngagement)}%! Class needs attention.`,
          { duration: 8000, id: 'low-engagement-alert' }
        )
      }
    } else {
      if (lowEngagementToastRef.current) {
        toast.dismiss('low-engagement-alert')
        lowEngagementToastRef.current = null
      }
    }
  }, [lastJsonMessage, alertHistory, currentEngagement])

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
    <section className={`${isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'grid gap-6 lg:grid-cols-[1.7fr_1fr] xl:grid-cols-[2fr_1fr]'}`}>
      <div className={`${isFullscreen ? 'w-full h-full flex flex-col' : 'flex flex-col gap-6'}`}>
        <div className={`${isFullscreen ? 'flex-1' : 'rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm backdrop-blur-md'}`}>
          <div
            id="video-feed-container"
            className={`relative ${isFullscreen ? 'fixed inset-0 w-full h-full' : 'aspect-video'} overflow-hidden ${isFullscreen ? '' : 'rounded-xl'} bg-slate-950 shadow-inner`}
          >
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
              <p className="font-bold tracking-wide">{lastJsonMessage?.course_name || 'Class'} <span className="mx-2 text-slate-400">•</span> {connectionLabel}</p>
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

            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="absolute right-4 bottom-4 rounded-lg bg-black/40 p-2 text-white shadow-lg backdrop-blur-md border border-white/10 hover:bg-black/60 transition-all hover:scale-110 z-10"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4m-4 0l5 5m11-5v4m0-4h-4m4 0l-5 5M4 20v-4m0 4h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              )}
            </button>

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
        </div>

        {!isFullscreen && (
          <>
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
                 ) : 'End Class'}
                </button>
              </div>

            <div className={`group relative overflow-hidden rounded-3xl border transition-all duration-500 shadow-xl backdrop-blur-xl ${
              alert_active 
                ? 'border-rose-400/50 bg-rose-500/10 shadow-rose-500/10' 
                : 'border-white/20 bg-white/10 shadow-indigo-500/5'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/5 opacity-50" />
              
              <div className={`relative border-b px-6 py-4 backdrop-blur-md ${
                alert_active ? 'border-rose-400/30 bg-rose-500/20' : 'border-white/20 bg-indigo-500/20'
              }`}>
                <h3 className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-slate-800 dark:text-white">
                  <div className={`h-2.5 w-2.5 rounded-full ${alert_active ? 'animate-pulse bg-rose-500 shadow-[0_0_10px_#f43f5e]' : 'bg-indigo-400 shadow-[0_0_10px_#818cf8]'}`} />
                  Class Engagement Monitor
                  {lastJsonMessage?.course_name && (
                    <span className="ml-1 font-semibold text-slate-500 normal-case tracking-normal">
                      — {lastJsonMessage.course_name}
                    </span>
                  )}
                </h3>
              </div>
              
              <div className="relative p-6">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-md transition-transform duration-300 group-hover:scale-110 ${
                    alert_active ? 'border-rose-400/50 bg-rose-500/20 text-rose-200' : 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
                  }`}>
                    {alert_active ? (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    ) : (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.674a3 3 0 01-5.996 0zm5.117-2.83a5.007 5.007 0 011.557-1.27l.534-.406a3.996 3.996 0 000-6.492l-.534-.406a5.007 5.007 0 01-1.557-1.27c-.435-.547-1.015-.974-1.745-1.22L12 2.32c-.329-.104-.671-.104-1 0l-.338.106c-.73.246-1.31.673-1.745 1.22a5.007 5.007 0 01-1.557 1.27l-.534.406a3.996 3.996 0 000 6.492l.534.406a5.007 5.007 0 011.557 1.27c.435.547 1.015.974 1.745 1.22L11 16.68c.329.104.671.104 1 0l.338-.106c.73-.246 1.31-.673 1.745-1.22z" /></svg>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <p className={`text-base font-bold leading-relaxed tracking-tight ${alert_active ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                      {alert_active
                        ? alertState.reason || 'Sustained low engagement detected.'
                        : lastJsonMessage?.message
                          ? lastJsonMessage.message.replace('AI Coach: ', '')
                          : 'Monitoring class engagement in real-time. Advisor suggestions will appear here.'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`h-1 w-1 rounded-full ${alert_active ? 'bg-rose-400' : 'bg-indigo-400'}`} />
                      <p className={`text-[10px] font-black uppercase tracking-widest ${alert_active ? 'text-rose-300' : 'text-indigo-500 dark:text-indigo-300'}`}>
                        Live Pedagogical Stream
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={`absolute bottom-0 left-0 h-[2px] w-full transition-transform duration-1000 ${alert_active ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ transform: `scaleX(${readyState === 1 ? 1 : 0})` }} />
            </div>

          </>
        )}
      </div>

      {!isFullscreen && (
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

        </div>
      )}
    </section>
  )
}
