import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGetCoursesQuery, useStartSessionMutation } from '../../../services/api/apiSlice'

export function SessionStartPage() {
  const navigate = useNavigate()
  const { data: coursesData, isLoading } = useGetCoursesQuery({ limit: 100 })
  const courses = coursesData?.items ?? []
  const [startSession, { isLoading: isStarting }] = useStartSessionMutation()
  const [courseId, setCourseId] = useState<number | null>(null)
  const [videoPath, setVideoPath] = useState('')
  const [frameStep, setFrameStep] = useState(5)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId && courses.length > 0) {
      setCourseId(courses[0].id)
    }
  }, [courseId, courses])

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId) ?? null,
    [courseId, courses],
  )

  useEffect(() => {
    if (selectedCourse?.available_videos?.length) {
      setVideoPath((current) => current || selectedCourse.available_videos[0])
    }
  }, [selectedCourse])

  async function handleStart() {
    if (!courseId || !videoPath.trim()) {
      setError('Please select a course and video path.')
      return
    }

    setError(null)
    try {
      const response = await startSession({
        course_id: courseId,
        video_path: videoPath,
        frame_step: frameStep,
      }).unwrap()
      navigate(`/session/${response.session_id}`)
    } catch {
      setError('Could not start session. Check that there is no active session for this course.')
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-white p-6 shadow-card">
      <h1 className="text-2xl font-semibold text-slate-900">Start Live Session</h1>
      <p className="text-sm text-slate-600">
        Select a course and video input, then start real-time behavior analysis.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Course</span>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            value={courseId ?? ''}
            onChange={(event) => setCourseId(Number(event.target.value))}
            disabled={isLoading || courses.length === 0}
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.course_name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Frame Step</span>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            type="number"
            min={1}
            max={20}
            value={frameStep}
            onChange={(event) => setFrameStep(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Video Path</span>
        {selectedCourse?.available_videos?.length ? (
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            value={videoPath}
            onChange={(event) => setVideoPath(event.target.value)}
          >
            {selectedCourse.available_videos.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            value={videoPath}
            onChange={(event) => setVideoPath(event.target.value)}
            placeholder="tests/test_video.mp4"
          />
        )}
      </label>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <button
        type="button"
        onClick={handleStart}
        disabled={isStarting || isLoading || courses.length === 0}
        className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {isStarting ? 'Starting...' : 'Start Session'}
      </button>
    </section>
  )
}
