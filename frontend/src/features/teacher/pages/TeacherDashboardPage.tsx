import { BarChart3, CalendarClock, CirclePlay, RefreshCw, Search, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
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
import { useConfirm } from '../../../app/confirm'
import { useEndSessionMutation, useGetCoursesQuery, useGetSessionsQuery } from '../../../services/api/apiSlice'
import { useAppSelector } from '../../../app/hooks'

type StatusFilter = 'ALL' | 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED'

export function TeacherDashboardPage() {
  const confirm = useConfirm()
  const { data: coursesData, isLoading: isCoursesLoading, isError: isCoursesError, refetch: refetchCourses } = useGetCoursesQuery({ limit: 100 })
  const { data: sessionsData, isLoading: sessionsLoading, isError: sessionsError, refetch: refetchSessions } = useGetSessionsQuery({ limit: 200, offset: 0 })
  const [endSession, { isLoading: isEnding }] = useEndSessionMutation()

  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState<number | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(0)
  const pageSize = 10

  const courses = coursesData?.items ?? []
  const sessions = sessionsData?.items ?? []
  const courseNameById = useMemo(() => new Map(courses.map((course) => [course.id, course.course_name])), [courses])

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase()
    return sessions.filter((session) => {
      if (courseFilter !== 'ALL' && session.course_id !== courseFilter) return false
      if (statusFilter !== 'ALL' && session.status !== statusFilter) return false
      if (!term) return true
      const courseName = courseNameById.get(session.course_id)?.toLowerCase() ?? ''
      return String(session.id).includes(term) || courseName.includes(term)
    })
  }, [sessions, search, courseFilter, statusFilter, courseNameById])

  const pagedSessions = useMemo(() => {
    const start = page * pageSize
    return filteredSessions.slice(start, start + pageSize)
  }, [filteredSessions, page])

  const completedScores = sessions.filter((session) => session.final_avg_score != null).map((session) => Number(session.final_avg_score))
  const avgEngagement = completedScores.length
    ? Math.round((completedScores.reduce((sum, val) => sum + val, 0) / completedScores.length) * 10) / 10
    : 0
  const activeSessions = sessions.filter((session) => session.status === 'RUNNING' || session.status === 'PAUSED' || session.status === 'PENDING').length

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

  const trendData = useMemo(() => {
    return sessions
      .filter((session) => session.final_avg_score != null)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(-14)
      .map((session) => ({
        session: `#${session.id}`,
        engagement: Math.round(Number(session.final_avg_score ?? 0)),
      }))
  }, [sessions])

  const coursePerformance = useMemo(() => {
    return courses
      .map((course) => {
        const courseSessions = sessions.filter((session) => session.course_id === course.id)
        const scores = courseSessions
          .filter((session) => session.final_avg_score != null)
          .map((session) => Number(session.final_avg_score))
        const avg = scores.length ? Math.round((scores.reduce((sum, val) => sum + val, 0) / scores.length) * 10) / 10 : 0
        return {
          id: course.id,
          name: course.course_name,
          code: course.course_code,
          sessions: courseSessions.length,
          completed: scores.length,
          avg,
        }
      })
      .sort((a, b) => b.avg - a.avg)
  }, [courses, sessions])

  const refreshAll = async () => {
    try {
      await Promise.all([refetchCourses(), refetchSessions()])
      toast.success('Dashboard refreshed')
    } catch {
      toast.error('Failed to refresh dashboard data')
    }
  }

  const onEndSession = async (sessionId: number) => {
    const approved = await confirm({
      title: 'End class',
      message: 'Are you sure you want to end this class now?',
      confirmText: 'End Class',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!approved) return
    try {
      await endSession(sessionId).unwrap()
      await refetchSessions()
      toast.success('Class ended successfully')
    } catch {
      toast.error('Failed to end class')
    }
  }

  const role = useAppSelector(state => state.auth.role)
  const isAdmin = role === 'ADMIN'

  const COLORS_STATUS = ['#10b981', '#3b82f6', '#f59e0b', '#94a3b8'] // emerald, blue, amber, slate

  return (
    <section className="space-y-6 rounded-3xl bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/50 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900">
            <BarChart3 className="h-8 w-8 text-indigo-600" />
            Teacher Dashboard
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-600">Your own classes and engagement analytics in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          {!isAdmin && (
            <Link
              to="/session/start"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 shadow-indigo-600/20 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500 hover:shadow-lg"
            >
              <CirclePlay className="h-4 w-4" />
              Start Class
            </Link>
          )}
        </div>
      </div>

      {isCoursesError || sessionsError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">Some dashboard data failed to load.</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Total Courses</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-slate-900">{courses.length}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Assigned to you</p>
        </div>
        
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Total Classes</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-slate-900">{sessions.length}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">All recorded lectures</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Active Classes</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-blue-600">{activeSessions}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Running / Paused / Pending</p>
        </div>

        <div className="rounded-2xl border border-transparent bg-gradient-to-br from-indigo-500 to-cyan-500 p-6 text-white shadow-md transition-all hover:shadow-lg">
          <p className="text-sm font-medium uppercase tracking-wider text-indigo-100">Avg Engagement</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight">{avgEngagement}%</span>
          </div>
          <p className="mt-1 text-xs text-indigo-100/70">Completed classes only</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/teacher/courses" className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-indigo-600 hover:shadow">
          Open Courses Workspace
        </Link>
        <Link to="/teacher/sessions" className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-indigo-600 hover:shadow">
          Open Sessions Workspace
        </Link>
        <Link to="/teacher/analytics" className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-indigo-600 hover:shadow">
          Open Analytics Workspace
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex flex-col h-[420px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Engagement Trend</h3>
          <p className="text-sm text-slate-500">Last 14 completed sessions</p>
          <div className="mt-6 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#colorTrend)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Session Status Split</h3>
          <p className="text-sm text-slate-500">Distribution by lifecycle state</p>
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

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Course Performance</h3>
        <p className="text-sm text-slate-500">Performance summary for your own courses</p>
        
        {isCoursesLoading || sessionsLoading ? <p className="mt-4 text-sm text-slate-500">Loading course analytics...</p> : null}
        
        <div className="mt-6 space-y-4">
          {coursePerformance.map((course) => (
            <div key={course.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900">{course.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{course.code}</p>
                </div>
                <div className="rounded-lg bg-indigo-100/50 px-3 py-1">
                  <p className="text-sm font-bold text-indigo-700">{course.avg}% Avg</p>
                </div>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-indigo-500 transition-all duration-1000 ease-out" style={{ width: `${Math.max(0, Math.min(100, course.avg))}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-medium text-slate-500">
                <span>{course.sessions} total sessions</span>
                <span>{course.completed} completed</span>
              </div>
            </div>
          ))}
          {!isCoursesLoading && coursePerformance.length === 0 ? <p className="text-sm text-slate-500">No courses assigned yet.</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Session Explorer</h3>
            <p className="text-sm text-slate-500">Search and filter your session history</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1 text-slate-600">
            <CalendarClock className="h-4 w-4" />
            <span className="text-xs font-semibold">{filteredSessions.length} results</span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              placeholder="Search by session id or course..."
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <select
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
              setPage(0)
            }}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.course_name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter)
              setPage(0)
            }}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="RUNNING">Running</option>
            <option value="PAUSED">Paused</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Session</th>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Engagement</th>
                  <th className="px-4 py-3 font-semibold">Started</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pagedSessions.map((session) => {
                  const courseName = courseNameById.get(session.course_id) ?? `Course #${session.course_id}`
                  const statusColor =
                    session.status === 'COMPLETED'
                      ? 'bg-emerald-100/80 text-emerald-700 border-emerald-200'
                      : session.status === 'RUNNING'
                        ? 'bg-blue-100/80 text-blue-700 border-blue-200'
                        : session.status === 'PAUSED'
                          ? 'bg-amber-100/80 text-amber-700 border-amber-200'
                          : 'bg-slate-100/80 text-slate-700 border-slate-200'

                  return (
                    <tr key={session.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-800">#{session.id}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{courseName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${statusColor}`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{session.final_avg_score == null ? '-' : `${Math.round(session.final_avg_score)}%`}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(session.start_time).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={session.status === 'COMPLETED' ? `/session/${session.id}/summary` : `/session/${session.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 hover:text-indigo-800"
                          >
                            <Video className="h-3.5 w-3.5" />
                            Open
                          </Link>
                          {session.status !== 'COMPLETED' ? (
                            <button
                              type="button"
                              onClick={() => onEndSession(session.id)}
                              disabled={isEnding}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 hover:text-rose-800 disabled:opacity-60"
                            >
                              End Session
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!sessionsLoading && pagedSessions.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm font-medium text-slate-500" colSpan={6}>
                      No sessions match your filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs font-medium text-slate-500">
          <span>
            Showing {pagedSessions.length > 0 ? page * pageSize + 1 : 0} to {Math.min((page + 1) * pageSize, filteredSessions.length)} of {filteredSessions.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={page === 0}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={(page + 1) * pageSize >= filteredSessions.length}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
