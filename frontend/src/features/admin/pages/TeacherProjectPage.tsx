import { BarChart3, BookOpen, CalendarClock, CheckCircle2, UserCircle2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useGetTeacherProjectPageQuery } from '../../../services/api/apiSlice'

function score(value: number | null) {
  if (value === null || Number.isNaN(value)) return 'N/A'
  return `${Math.round(value * 10) / 10}%`
}

function formatDate(value: string) {
  const dt = new Date(value)
  return dt.toLocaleString()
}

export function TeacherProjectPage() {
  const { teacherId } = useParams()
  const numericId = Number(teacherId)
  const { data, isLoading, isError } = useGetTeacherProjectPageQuery(numericId, {
    skip: !teacherId || Number.isNaN(numericId),
  })

  if (!teacherId || Number.isNaN(numericId)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Invalid teacher id.
      </div>
    )
  }

  if (isLoading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">Loading teacher project page...</div>
  }

  if (isError || !data) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Failed to load teacher analytics.</div>
        <Link to="/admin" className="text-sm font-semibold text-blue-600 hover:underline">
          Back to Admin Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 rounded-2xl bg-gradient-to-br from-white via-slate-50 to-blue-50 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin" className="text-sm font-semibold text-blue-600 hover:underline">
            ← Back to Admin Dashboard
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold text-slate-900">
            <UserCircle2 className="h-8 w-8 text-blue-600" />
            {data.teacher_name}
          </h1>
          <p className="text-sm text-slate-600">{data.teacher_email}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            data.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
          }`}
        >
          {data.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Courses</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.total_courses}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sessions</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.total_sessions}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed Sessions</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.completed_sessions_count}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overall Average</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{score(data.overall_avg_final_score)}</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <BookOpen className="h-5 w-5 text-blue-600" />
          Course Analytics
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-900">Course</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Code</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Sem/Section</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Sessions</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Avg</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Peak</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Lowest</th>
              </tr>
            </thead>
            <tbody>
              {data.courses.map((course) => (
                <tr key={course.course_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{course.course_name}</td>
                  <td className="px-4 py-3 text-slate-600">{course.course_code}</td>
                  <td className="px-4 py-3 text-slate-600">{course.semester} / {course.section}</td>
                  <td className="px-4 py-3 text-slate-600">{course.sessions_count} ({course.completed_sessions_count} completed)</td>
                  <td className="px-4 py-3 text-slate-600">{score(course.avg_final_score)}</td>
                  <td className="px-4 py-3 text-slate-600">{score(course.peak_final_score)}</td>
                  <td className="px-4 py-3 text-slate-600">{score(course.lowest_final_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <CalendarClock className="h-5 w-5 text-emerald-600" />
          Session Analytics
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-900">Session</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Course</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Start</th>
                <th className="px-4 py-3 font-semibold text-slate-900">End</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Final Avg</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((session) => (
                <tr key={session.session_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">#{session.session_id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{session.course_name}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(session.start_time)}</td>
                  <td className="px-4 py-3 text-slate-600">{session.end_time ? formatDate(session.end_time) : 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {session.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{score(session.final_avg_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          Courses List
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.courses.map((course) => (
            <span key={`chip-${course.course_id}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              {course.course_code} • {course.course_name}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
