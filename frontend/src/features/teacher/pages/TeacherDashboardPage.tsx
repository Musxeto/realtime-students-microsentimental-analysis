import { Card, DonutChart, LineChart, Metric, Text, Title } from '@tremor/react'
import { BarChart3, CalendarClock, CirclePlay, RefreshCw, Search, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { useConfirm } from '../../../app/confirm'
import { useEndSessionMutation, useGetCoursesQuery, useGetSessionsQuery } from '../../../services/api/apiSlice'

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
      { status: 'Completed', value: counts.COMPLETED },
      { status: 'Running', value: counts.RUNNING },
      { status: 'Paused', value: counts.PAUSED },
      { status: 'Pending', value: counts.PENDING },
    ]
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
      title: 'End session',
      message: 'Are you sure you want to end this session now?',
      confirmText: 'End Session',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!approved) return
    try {
      await endSession(sessionId).unwrap()
      await refetchSessions()
      toast.success('Session ended successfully')
    } catch {
      toast.error('Failed to end session')
    }
  }

  return (
    <section className="space-y-6 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
            Teacher Analytics Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">Your own classes, sessions, and engagement analytics in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            to="/session/start"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            <CirclePlay className="h-4 w-4" />
            Start Session
          </Link>
        </div>
      </div>

      {isCoursesError || sessionsError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Some dashboard data failed to load.</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Title>Total Courses</Title>
          <Metric>{courses.length}</Metric>
          <Text>Assigned to you</Text>
        </Card>
        <Card>
          <Title>Total Sessions</Title>
          <Metric>{sessions.length}</Metric>
          <Text>All recorded lectures</Text>
        </Card>
        <Card>
          <Title>Active Sessions</Title>
          <Metric>{activeSessions}</Metric>
          <Text>Running / Paused / Pending</Text>
        </Card>
        <Card>
          <Title>Avg Engagement</Title>
          <Metric>{avgEngagement}%</Metric>
          <Text>Completed sessions only</Text>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link to="/teacher/courses" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Open Courses Workspace
        </Link>
        <Link to="/teacher/sessions" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Open Sessions Workspace
        </Link>
        <Link to="/teacher/analytics" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Open Analytics Workspace
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <Title>Engagement Trend</Title>
          <Text>Last 14 completed sessions</Text>
          <LineChart
            className="mt-4 h-64"
            data={trendData}
            index="session"
            categories={['engagement']}
            colors={['indigo']}
            yAxisWidth={36}
          />
        </Card>
        <Card>
          <Title>Session Status Split</Title>
          <Text>Distribution by lifecycle state</Text>
          <DonutChart
            className="mt-4"
            data={statusData}
            index="status"
            category="value"
            colors={['emerald', 'blue', 'amber', 'slate']}
            valueFormatter={(value) => `${value}`}
          />
        </Card>
      </div>

      <Card>
        <Title>Course Performance</Title>
        <Text>Performance summary for your own courses</Text>
        {isCoursesLoading || sessionsLoading ? <p className="mt-3 text-sm text-slate-500">Loading course analytics...</p> : null}
        <div className="mt-4 space-y-3">
          {coursePerformance.map((course) => (
            <div key={course.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{course.name}</p>
                  <p className="text-xs text-slate-500">{course.code}</p>
                </div>
                <p className="text-sm font-semibold text-indigo-700">{course.avg}% Avg</p>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-slate-100">
                <div className="h-full rounded bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, course.avg))}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{course.sessions} sessions</span>
                <span>{course.completed} completed</span>
              </div>
            </div>
          ))}
          {!isCoursesLoading && coursePerformance.length === 0 ? <p className="text-sm text-slate-500">No courses assigned yet.</p> : null}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Title>Session Explorer</Title>
            <Text>Search and filter your session history</Text>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <CalendarClock className="h-4 w-4" />
            <span className="text-xs">{filteredSessions.length} results</span>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              placeholder="Search by session id or course"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <select
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
              setPage(0)
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="RUNNING">Running</option>
            <option value="PAUSED">Paused</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Session</th>
                <th className="px-3 py-2">Course</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Engagement</th>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedSessions.map((session) => {
                const courseName = courseNameById.get(session.course_id) ?? `Course #${session.course_id}`
                const statusColor =
                  session.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : session.status === 'RUNNING'
                      ? 'bg-blue-100 text-blue-700'
                      : session.status === 'PAUSED'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700'

                return (
                  <tr key={session.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-800">#{session.id}</td>
                    <td className="px-3 py-2 text-slate-700">{courseName}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor}`}>{session.status}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{session.final_avg_score == null ? '-' : `${Math.round(session.final_avg_score)}%`}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(session.start_time).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={session.status === 'COMPLETED' ? `/session/${session.id}/summary` : `/session/${session.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          <Video className="h-3.5 w-3.5" />
                          Open
                        </Link>
                        {session.status !== 'COMPLETED' ? (
                          <button
                            type="button"
                            onClick={() => onEndSession(session.id)}
                            disabled={isEnding}
                            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
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
                  <td className="px-3 py-4 text-sm text-slate-500" colSpan={6}>
                    No sessions match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {pagedSessions.length > 0 ? page * pageSize + 1 : 0} - {Math.min((page + 1) * pageSize, filteredSessions.length)} of {filteredSessions.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={page === 0}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={(page + 1) * pageSize >= filteredSessions.length}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </section>
  )
}
