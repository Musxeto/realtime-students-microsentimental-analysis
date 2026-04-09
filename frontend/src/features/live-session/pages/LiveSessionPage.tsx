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
  const alertState = lastJsonMessage?.alert_state

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
  }, [lastJsonMessage])

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
      await endSession(Number(id)).unwrap()
      navigate('/dashboard')
    } catch {
      // Keep user on page; stream may still be active.
    }
  }

  const connectionLabel = readyState === 1 ? 'Live' : readyState === 0 ? 'Connecting' : 'Reconnecting'

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-xl border bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Session {id}</h1>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {connectionLabel}
          </span>
        </div>
        <div className="aspect-video rounded-lg bg-slate-900/90" />
        <button
          type="button"
          onClick={handleEndSession}
          disabled={isEnding}
          className="mt-4 inline-flex rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
        >
          {isEnding ? 'Ending...' : 'End Session'}
        </button>
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
              <p className="text-xs uppercase tracking-wide text-slate-400">Alerts</p>
              <p className="text-base font-semibold text-slate-900">{metrics?.alert_count ?? 0}</p>
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

        <Card decoration="top" decorationColor="rose">
          <Title>AI Co-Pilot Alert</Title>
          <Text>
            {alertState?.active
              ? alertState.reason || 'Low engagement alert is active.'
              : lastJsonMessage?.message
                ? lastJsonMessage.message
                : 'No intervention required yet. Alerts will appear on sustained low engagement.'}
          </Text>
        </Card>
      </div>
    </section>
  )
}
