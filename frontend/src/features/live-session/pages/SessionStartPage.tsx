import { Link } from 'react-router-dom'

export function SessionStartPage() {
  return (
    <section className="space-y-4 rounded-xl border bg-white p-6 shadow-card">
      <h1 className="text-2xl font-semibold text-slate-900">Start Live Session</h1>
      <p className="text-sm text-slate-600">
        Select a course and video input, then start real-time behavior analysis.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <input
          className="rounded-lg border px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
          placeholder="Course ID"
        />
        <input
          className="rounded-lg border px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
          placeholder="Video path (e.g., ai/tests/test_video.mp4)"
        />
      </div>

      <Link
        to="/session/demo"
        className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
      >
        Start Session
      </Link>
    </section>
  )
}
