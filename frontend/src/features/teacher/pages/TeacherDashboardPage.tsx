import { Link } from 'react-router-dom'
import { useGetCourseAnalyticsQuery, useGetCoursesQuery, useGetSessionsQuery } from '../../../services/api/apiSlice'

function CourseAnalyticsCard({ courseId, courseName }: { courseId: number; courseName: string }) {
  const { data, isLoading, isError } = useGetCourseAnalyticsQuery(courseId)

  if (isLoading) {
    return <div className="rounded-xl border bg-white p-4 text-sm text-slate-500 shadow-card">Loading analytics...</div>
  }

  if (isError) {
    return <div className="rounded-xl border bg-white p-4 text-sm text-danger shadow-card">Analytics unavailable.</div>
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-card">
      <h3 className="text-base font-semibold text-slate-900">{courseName}</h3>
      <p className="mt-2 text-sm text-slate-600">Sessions: {data?.sessions_count ?? 0}</p>
      <p className="text-sm text-slate-600">Average Engagement: {Math.round(data?.avg_final_score ?? 0)}%</p>
    </div>
  )
}

export function TeacherDashboardPage() {
  const { data: courses = [], isLoading: isCoursesLoading, isError: isCoursesError } = useGetCoursesQuery()
  const { data: sessions, isLoading: sessionsLoading, isError: sessionsError } = useGetSessionsQuery({ limit: 20, offset: 0 })

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Teacher Dashboard</h1>
      <p className="text-sm text-slate-600">Assigned courses, lecture analytics, and recent session history.</p>
      {isCoursesError || sessionsError ? <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">Some dashboard data failed to load.</p> : null}

      <div className="rounded-xl border bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">My Courses</h2>
          <Link
            to="/session/start"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            Start New Session
          </Link>
        </div>

        {isCoursesLoading ? <p className="mt-3 text-sm text-slate-500">Loading courses...</p> : null}
        {!isCoursesLoading && courses.length === 0 ? <p className="mt-3 text-sm text-slate-500">No courses assigned yet.</p> : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <CourseAnalyticsCard key={course.id} courseId={course.id} courseName={course.course_name} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-card">
        <h2 className="text-lg font-semibold text-slate-900">Recent Lectures</h2>
        {sessionsLoading ? <p className="mt-2 text-sm text-slate-500">Loading sessions...</p> : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="py-2 pr-4">Session</th>
                <th className="py-2 pr-4">Course ID</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Avg Engagement</th>
              </tr>
            </thead>
            <tbody>
              {(sessions?.items ?? []).map((session) => (
                <tr key={session.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">
                    <Link className="text-primary hover:underline" to={`/session/${session.id}`}>
                      #{session.id}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{session.course_id}</td>
                  <td className="py-2 pr-4">{session.status}</td>
                  <td className="py-2 pr-4">{session.final_avg_score == null ? '-' : `${Math.round(session.final_avg_score)}%`}</td>
                </tr>
              ))}
              {!sessionsLoading && (sessions?.items?.length ?? 0) === 0 ? (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={4}>
                    No lectures yet. Start a live session to begin collecting analytics.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
