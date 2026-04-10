import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { useConfirm } from '../../../app/confirm'
import { useEndSessionMutation, useGetCoursesQuery, useGetSessionsQuery } from '../../../services/api/apiSlice'

type StatusFilter = 'ALL' | 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED'

export function TeacherSessionsPage() {
  const confirm = useConfirm()
  const { data: sessionsData, isLoading, isError, refetch } = useGetSessionsQuery({ limit: 200, offset: 0 })
  const { data: coursesData } = useGetCoursesQuery({ limit: 100, offset: 0 })
  const [endSession, { isLoading: isEnding }] = useEndSessionMutation()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [courseId, setCourseId] = useState<number | 'ALL'>('ALL')
  const [page, setPage] = useState(0)
  const pageSize = 12

  const sessions = sessionsData?.items ?? []
  const courses = coursesData?.items ?? []
  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course.course_name])), [courses])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sessions.filter((session) => {
      if (status !== 'ALL' && session.status !== status) return false
      if (courseId !== 'ALL' && session.course_id !== courseId) return false
      if (!q) return true
      const cname = courseMap.get(session.course_id)?.toLowerCase() ?? ''
      return String(session.id).includes(q) || cname.includes(q)
    })
  }, [sessions, status, courseId, search, courseMap])

  const paged = useMemo(() => {
    const start = page * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

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
      await refetch()
      toast.success('Session ended successfully')
    } catch {
      toast.error('Failed to end session')
    }
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Sessions</h1>
          <p className="text-sm text-slate-600">Track, filter, and manage your lecture sessions.</p>
        </div>
        <Link to="/session/start" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          Start New Session
        </Link>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          placeholder="Search by session id or course"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
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
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter)
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

      {isError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Failed to load sessions.</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Avg Engagement</th>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((session) => {
              const active = session.status !== 'COMPLETED'
              return (
                <tr key={session.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">#{session.id}</td>
                  <td className="px-3 py-2 text-slate-700">{courseMap.get(session.course_id) ?? `Course #${session.course_id}`}</td>
                  <td className="px-3 py-2 text-slate-700">{session.status}</td>
                  <td className="px-3 py-2 text-slate-700">{session.final_avg_score == null ? '-' : `${Math.round(session.final_avg_score)}%`}</td>
                  <td className="px-3 py-2 text-slate-500">{new Date(session.start_time).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={active ? `/session/${session.id}` : `/session/${session.id}/summary`}
                        className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        Open
                      </Link>
                      {active ? (
                        <button
                          type="button"
                          onClick={() => onEndSession(session.id)}
                          disabled={isEnding}
                          className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                        >
                          End Session
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!isLoading && paged.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-sm text-slate-500">
                  No sessions found for current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing {paged.length > 0 ? page * pageSize + 1 : 0} - {Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * pageSize >= filtered.length}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}
