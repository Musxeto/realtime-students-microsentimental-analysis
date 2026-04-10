import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  useGetSessionByIdQuery,
  useGetSessionLogsQuery,
  useGetSessionMetricsQuery,
} from '../../../services/api/apiSlice'

interface EndSessionState {
  final_avg_score?: number | null
}

export function SessionSummaryPage() {
  const { id } = useParams()
  const location = useLocation()
  const navState = (location.state ?? {}) as EndSessionState
  const sessionId = Number(id)
  const skip = !id || Number.isNaN(sessionId)

  const { data: session } = useGetSessionByIdQuery(sessionId, { skip })
  const { data: metrics } = useGetSessionMetricsQuery(sessionId, { skip })
  const { data: logs } = useGetSessionLogsQuery({ sessionId, limit: 300, offset: 0 }, { skip })

  const finalScore = navState.final_avg_score ?? session?.final_avg_score ?? metrics?.avg_engagement_score ?? null

  const peakDistracted = useMemo(() => {
    const items = logs?.items ?? []
    if (!items.length) {
      return null
    }
    return items.reduce((max, row) => (row.distracted_count > max.distracted_count ? row : max), items[0])
  }, [logs?.items])

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-card panel-glow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Session Summary</h1>
          <p className="text-sm text-slate-600">Session #{id} has ended. Review outcome and key runtime metrics.</p>
        </div>
        <div className="rounded-xl bg-primary/10 px-4 py-2 text-primary">
          <p className="text-xs uppercase tracking-wide">Final Engagement</p>
          <p className="text-xl font-bold">{finalScore == null ? '-' : `${Math.round(finalScore)}%`}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Average Latency</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{metrics?.avg_latency_ms ?? '-'} ms</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Actual FPS</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{metrics?.actual_fps ?? '-'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Alert Events</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{metrics?.alert_count ?? 0}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Behavior Highlights</h2>
        <p className="mt-2 text-sm text-slate-600">
          Peak distracted count:{' '}
          <span className="font-semibold text-slate-900">
            {peakDistracted ? `${peakDistracted.distracted_count} students` : 'No data'}
          </span>
        </p>
        <p className="text-sm text-slate-600">
          Last tracked engagement:{' '}
          <span className="font-semibold text-slate-900">
            {logs?.items?.length ? `${Math.round(logs.items[logs.items.length - 1].engagement_score)}%` : 'No data'}
          </span>
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          to="/dashboard"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          Back to Dashboard
        </Link>
        <Link
          to="/session/start"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Start New Session
        </Link>
      </div>
    </section>
  )
}
