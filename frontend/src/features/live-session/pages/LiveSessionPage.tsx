import { Card, DonutChart, LineChart, Metric, Text, Title } from '@tremor/react'
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

const engagementSeries = [
  { time: '00:00', engagement: 82 },
  { time: '00:30', engagement: 79 },
  { time: '01:00', engagement: 76 },
  { time: '01:30', engagement: 71 },
  { time: '02:00', engagement: 68 },
]

const engagementBreakdown = [
  { label: 'Engaged', value: 68 },
  { label: 'Distracted', value: 32 },
]

export function LiveSessionPage() {
  const { id } = useParams()
  const latest = useMemo(
    () => engagementSeries[engagementSeries.length - 1]?.engagement ?? 0,
    [],
  )

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-xl border bg-white p-4 shadow-card">
        <h1 className="mb-3 text-xl font-semibold text-slate-900">Session {id}</h1>
        <div className="aspect-video rounded-lg bg-slate-900/90" />
      </div>

      <div className="space-y-4">
        <Card>
          <Title>Live Engagement</Title>
          <Metric>{latest}%</Metric>
          <DonutChart
            className="mt-3"
            data={engagementBreakdown}
            category="value"
            index="label"
            valueFormatter={(value) => `${value}%`}
          />
        </Card>

        <Card>
          <Title>Engagement Timeline</Title>
          <LineChart
            className="mt-4 h-56"
            data={engagementSeries}
            index="time"
            categories={['engagement']}
            colors={['indigo']}
            yAxisWidth={40}
          />
        </Card>

        <Card decoration="top" decorationColor="rose">
          <Title>AI Co-Pilot Alert</Title>
          <Text>No intervention required yet. Alerts will appear on sustained low engagement.</Text>
        </Card>
      </div>
    </section>
  )
}
