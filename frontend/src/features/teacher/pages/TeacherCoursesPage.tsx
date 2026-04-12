import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGetCoursesQuery, useGetSessionsQuery } from '../../../services/api/apiSlice'

export function TeacherCoursesPage() {
  const { data: coursesData, isLoading: coursesLoading, isError } = useGetCoursesQuery({ limit: 100, offset: 0 })
  const { data: sessionsData } = useGetSessionsQuery({ limit: 200, offset: 0 })
  const [search, setSearch] = useState('')

  const courses = coursesData?.items ?? []
  const sessions = sessionsData?.items ?? []

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return courses
      .map((course) => {
        const related = sessions.filter((session) => session.course_id === course.id)
        const completed = related.filter((session) => session.final_avg_score != null)
        const avg = completed.length
          ? Math.round((completed.reduce((sum, s) => sum + Number(s.final_avg_score ?? 0), 0) / completed.length) * 10) / 10
          : 0
        return {
          ...course,
          classCount: related.length,
          completedCount: completed.length,
          avgEngagement: avg,
        }
      })
      .filter((row) => {
        if (!term) return true
        return row.course_name.toLowerCase().includes(term) || row.course_code.toLowerCase().includes(term)
      })
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
  }, [courses, sessions, search])

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Courses</h1>
          <p className="text-sm text-slate-600">Performance and session breakdown for your own courses.</p>
        </div>
        <Link to="/session/start" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          Start Class
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search course by name/code"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />

      {isError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Failed to load courses.</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((course) => (
          <div key={course.id} className="rounded-xl border border-slate-200 p-4">
            <p className="text-base font-semibold text-slate-900">{course.course_name}</p>
            <p className="text-xs text-slate-500">{course.course_code} • Semester {course.semester} • Section {course.section}</p>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p>Classes: {course.classCount}</p>
              <p>Completed: {course.completedCount}</p>
              <p>Avg Engagement: {course.avgEngagement}%</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                to={`/teacher/courses/${course.id}/history`}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-center text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                View History
              </Link>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded bg-slate-100">
              <div className="h-full rounded bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, course.avgEngagement))}%` }} />
            </div>
          </div>
        ))}
      </div>

      {!coursesLoading && rows.length === 0 ? <p className="text-sm text-slate-500">No courses found.</p> : null}
    </section>
  )
}
