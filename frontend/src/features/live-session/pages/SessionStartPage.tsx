import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGetCoursesQuery, useStartSessionMutation } from '../../../services/api/apiSlice'

function formatStreamLabel(source: string): string {
  const trimmed = source.trim()
  const urlMatch = trimmed.match(/^https?:\/\/(?:[^/]+)\/(.+)$/i)
  const value = (urlMatch?.[1] ?? trimmed).replace(/\\/g, '/')
  const lastSegment = value.split('/').filter(Boolean).pop() ?? value
  return lastSegment.replace(/\.[^.]+$/, '')
}

export function SessionStartPage() {
  const navigate = useNavigate()
  const { data: coursesData, isLoading } = useGetCoursesQuery({ limit: 100, include_videos: true })
  const courses = coursesData?.items ?? []
  const [startSession, { isLoading: isStarting }] = useStartSessionMutation()
  const [courseId, setCourseId] = useState<number | null>(null)
  const [videoPath, setVideoPath] = useState('')
  const [frameStep, setFrameStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId && courses.length > 0) {
      setCourseId(courses[0].id)
    }
  }, [courseId, courses])

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId) ?? null,
    [courses, courseId],
  )

  const availableVideos = useMemo(() => {
    if (selectedCourse) {
      return Array.from(new Set(selectedCourse.available_videos ?? []))
    }
    return Array.from(new Set(courses.flatMap((course) => course.available_videos ?? [])))
  }, [courses, selectedCourse])

  useEffect(() => {
    if (availableVideos.length) {
      setVideoPath((current) => current || availableVideos[0])
    }
  }, [availableVideos])

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
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
          value={videoPath}
          onChange={(event) => setVideoPath(event.target.value)}
          placeholder="tests/test_video.mp4 or http://ip:port/video"
          list="available-video-sources"
        />
        {availableVideos.length ? (
          <datalist id="available-video-sources">
            {availableVideos.map((path) => (
              <option key={path} value={path} />
            ))}
          </datalist>
        ) : null}
      </label>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">
            ClassStreams for {selectedCourse?.course_name ?? 'selected course'} ({availableVideos.length})
          </p>
          {videoPath ? (
            <span className="text-xs text-slate-600" title={videoPath}>
              Selected: {formatStreamLabel(videoPath)}
            </span>
          ) : null}
        </div>

        {availableVideos.length > 0 ? (
          <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {availableVideos.map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => setVideoPath(source)}
                title={source}
                className={`w-full rounded-md border px-2 py-1 text-left text-xs transition ${
                  videoPath === source
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {formatStreamLabel(source)}
              </button>
            ))}
          </div>
        ) : null}

        {availableVideos.length === 0 ? (
          <p className="text-xs text-slate-500">No detected sources for this course yet.</p>
        ) : null}
      </div>

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
