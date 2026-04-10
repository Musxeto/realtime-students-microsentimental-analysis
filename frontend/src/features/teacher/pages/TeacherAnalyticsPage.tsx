import { Card, DonutChart, LineChart, Metric, Text, Title } from '@tremor/react'
import { useMemo } from 'react'
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
    ]
  }, [sessions])

  const courseDonut = useMemo(() => {
    return courses.map((course) => ({
      name: course.course_code,
      value: sessions.filter((session) => session.course_id === course.id).length,
    }))
  }, [courses, sessions])

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 shadow-card">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Analytics</h1>
        <p className="text-sm text-slate-600">Deep analytics for your own teaching sessions.</p>
      </div>

      {isError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Failed to load analytics.</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <Title>Total Sessions</Title>
          <Metric>{sessions.length}</Metric>
        </Card>
        <Card>
          <Title>Completed Sessions</Title>
          <Metric>{completed.length}</Metric>
        </Card>
        <Card>
          <Title>Average Engagement</Title>
          <Metric>{avgEngagement}%</Metric>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <Title>Engagement Trend</Title>
          <Text>Latest 20 completed sessions</Text>
          <LineChart
            className="mt-4 h-64"
            data={trend}
            index="session"
            categories={['engagement']}
            colors={['indigo']}
            yAxisWidth={36}
          />
        </Card>

        <Card>
          <Title>Session Status</Title>
          <Text>How your sessions are distributed</Text>
          <DonutChart
            className="mt-4"
            data={statusData}
            category="value"
            index="name"
            valueFormatter={(value) => `${value}`}
            colors={['emerald', 'blue', 'amber', 'slate']}
          />
        </Card>
      </div>

      <Card>
        <Title>Course Workload Split</Title>
        <Text>Sessions by course code</Text>
        <DonutChart
          className="mt-4"
          data={courseDonut}
          category="value"
          index="name"
          valueFormatter={(value) => `${value}`}
          colors={['indigo', 'cyan', 'violet', 'amber', 'rose', 'teal', 'lime', 'sky']}
        />
      </Card>

      {isLoading ? <p className="text-sm text-slate-500">Loading analytics...</p> : null}
    </section>
  )
}
