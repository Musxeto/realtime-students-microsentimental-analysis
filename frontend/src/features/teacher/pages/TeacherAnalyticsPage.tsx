import { useMemo } from 'react'
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
import { useGetCoursesQuery, useGetSessionsQuery } from '../../../services/api/apiSlice'

export function TeacherAnalyticsPage() {
  const { data: coursesData } = useGetCoursesQuery({ limit: 100, offset: 0 })
  const { data: sessionsData, isLoading, isError } = useGetSessionsQuery({ limit: 200, offset: 0 })

  const courses = coursesData?.items ?? []
  const sessions = sessionsData?.items ?? []

  const completed = sessions.filter((session) => session.final_avg_score != null)
  const avgEngagement = completed.length
    ? Math.round((completed.reduce((sum, s) => sum + Number(s.final_avg_score ?? 0), 0) / completed.length) * 10) / 10
    : 0

  const trend = useMemo(() => {
    return completed
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(-20)
      .map((session) => ({
        session: `#${session.id}`,
        engagement: Math.round(Number(session.final_avg_score ?? 0)),
      }))
  }, [completed])

  const statusData = useMemo(() => {
    const counts: Record<string, number> = { RUNNING: 0, PAUSED: 0, PENDING: 0, COMPLETED: 0 }
    sessions.forEach((session) => {
      counts[session.status] = (counts[session.status] ?? 0) + 1
    })
    return [
      { name: 'Completed', value: counts.COMPLETED },
      { name: 'Running', value: counts.RUNNING },
      { name: 'Paused', value: counts.PAUSED },
      { name: 'Pending', value: counts.PENDING },
    ].filter(d => d.value > 0)
  }, [sessions])

  const courseDonut = useMemo(() => {
    return courses
      .map((course) => ({
        name: course.course_name,
        value: sessions.filter((session) => session.course_id === course.id).length,
      }))
      .filter((d) => d.value > 0)
  }, [courses, sessions])

  const COLORS_STATUS = ['#10b981', '#3b82f6', '#f59e0b', '#94a3b8'] // emerald, blue, amber, slate
  const COLORS_COURSES = ['#6366f1', '#06b6d4', '#8b5cf6', '#f59e0b', '#f43f5e', '#14b8a6', '#84cc16', '#0ea5e9']

  return (
    <section className="space-y-6 rounded-3xl border border-border/70 bg-gradient-to-br from-background via-card to-background/80 p-6 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Analytics</h1>
        <p className="mt-2 text-sm text-slate-600">Deep analytics and actionable insights for your teaching sessions.</p>
      </div>

      {isError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          Failed to load analytics.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Total Sessions</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-slate-900">{sessions.length}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Completed Sessions</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-slate-900">{completed.length}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-transparent bg-gradient-to-br from-indigo-500 to-cyan-500 p-6 text-white shadow-md transition-all hover:shadow-lg">
          <p className="text-sm font-medium uppercase tracking-wider text-indigo-100">Average Engagement</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight">{avgEngagement}%</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex h-[400px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Engagement Trend</h3>
          <p className="text-sm text-slate-500">Latest 20 completed sessions</p>
          <div className="mt-6 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="session" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                  labelStyle={{ color: '#64748b', fontSize: '13px' }}
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorEngagement)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Session Status</h3>
          <p className="text-sm text-slate-500">How your sessions are distributed</p>
          <div className="mt-6 flex h-full flex-row items-center justify-between">
            <div className="h-64 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                  />
                  <Pie
                    data={statusData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_STATUS[index % COLORS_STATUS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-3 pr-4">
              {statusData.map((entry, idx) => (
                <div key={entry.name} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS_STATUS[idx % COLORS_STATUS.length] }}></span>
                  {entry.name}: <span className="text-slate-900 font-bold">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Course Workload Split</h3>
        <p className="text-sm text-slate-500">Sessions by course name</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div className="h-80 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                />
                <Pie
                  data={courseDonut}
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {courseDonut.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_COURSES[index % COLORS_COURSES.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-2 lg:pr-6">
            {courseDonut.map((entry, idx) => (
              <div key={entry.name} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS_COURSES[idx % COLORS_COURSES.length] }}></span>
                {entry.name}: <span className="text-slate-900 font-bold">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
        </div>
      ) : null}
    </section>
  )
}
