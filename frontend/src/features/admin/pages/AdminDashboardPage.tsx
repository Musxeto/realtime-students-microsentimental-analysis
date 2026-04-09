import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  useAdminResetUserPasswordMutation,
  useCreateCourseMutation,
  useCreateTeacherMutation,
  useDeleteCourseMutation,
  useGetAlertConfigQuery,
  useGetCoursesQuery,
  useGetTeacherAnalyticsQuery,
  useGetTeachersQuery,
  useUpdateAlertConfigMutation,
  useUpdateTeacherMutation,
} from '../../../services/api/apiSlice'

export function AdminDashboardPage() {
  const { data: teachers = [], isLoading: teachersLoading, isError: teachersError } = useGetTeachersQuery()
  const { data: courses = [], isError: coursesError } = useGetCoursesQuery()
  const [createTeacher, { isLoading: creatingTeacher }] = useCreateTeacherMutation()
  const [updateTeacher] = useUpdateTeacherMutation()
  const [adminResetUserPassword] = useAdminResetUserPasswordMutation()
  const [createCourse] = useCreateCourseMutation()
  const [deleteCourse] = useDeleteCourseMutation()
  const [updateAlertConfig] = useUpdateAlertConfigMutation()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [courseNames, setCourseNames] = useState('')

  const [newCourseName, setNewCourseName] = useState('')
  const [instructorId, setInstructorId] = useState<number | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const { data: teacherAnalytics } = useGetTeacherAnalyticsQuery(selectedTeacherId ?? 0, {
    skip: selectedTeacherId == null,
  })

  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const { data: selectedAlertConfig } = useGetAlertConfigQuery(selectedCourseId ?? 0, {
    skip: selectedCourseId == null,
  })
  const [alertThreshold, setAlertThreshold] = useState(50)
  const [alertDuration, setAlertDuration] = useState(180)
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(courses[0].id)
    }
  }, [courses, selectedCourseId])

  useEffect(() => {
    if (!selectedTeacherId && teachers.length > 0) {
      setSelectedTeacherId(teachers[0].id)
    }
  }, [selectedTeacherId, teachers])

  useEffect(() => {
    if (!selectedAlertConfig) {
      return
    }
    setAlertThreshold(selectedAlertConfig.engagement_threshold)
    setAlertDuration(selectedAlertConfig.duration_seconds)
    setAlertEnabled(selectedAlertConfig.enabled)
  }, [selectedAlertConfig])

  async function handleCreateTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedCourses = courseNames
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    try {
      await createTeacher({
        name,
        email,
        password,
        course_names: parsedCourses,
      }).unwrap()

      setName('')
      setEmail('')
      setPassword('')
      setCourseNames('')
      setFeedback('Teacher created successfully.')
    } catch {
      setFeedback('Could not create teacher. Check form values or duplicate email.')
    }
  }

  async function handleCreateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!instructorId) {
      return
    }

    try {
      await createCourse({
        course_name: newCourseName,
        instructor_id: instructorId,
      }).unwrap()

      setNewCourseName('')
      setFeedback('Course created and assigned successfully.')
    } catch {
      setFeedback('Could not create course.')
    }
  }

  async function toggleTeacherStatus(teacherId: number, current: boolean) {
    try {
      await updateTeacher({
        teacherId,
        payload: { is_active: !current },
      }).unwrap()
      setFeedback('Teacher status updated.')
    } catch {
      setFeedback('Could not update teacher status.')
    }
  }

  async function handleDeleteCourse(courseId: number) {
    try {
      await deleteCourse(courseId).unwrap()
      setFeedback('Course deleted.')
    } catch {
      setFeedback('Could not delete course.')
    }
  }

  async function handleResetPassword(userId: number) {
    const newPassword = window.prompt('Enter new password for this user')
    if (!newPassword || newPassword.trim().length < 4) {
      setFeedback('Password reset cancelled or too short.')
      return
    }

    try {
      await adminResetUserPassword({ userId, new_password: newPassword.trim() }).unwrap()
      setFeedback('User password reset successfully.')
    } catch {
      setFeedback('Could not reset user password.')
    }
  }

  async function handleAlertConfigSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedCourseId) {
      return
    }

    try {
      await updateAlertConfig({
        courseId: selectedCourseId,
        payload: {
          engagement_threshold: alertThreshold,
          duration_seconds: alertDuration,
          enabled: alertEnabled,
        },
      }).unwrap()
      setFeedback('Alert config updated.')
    } catch {
      setFeedback('Could not update alert config.')
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
      {feedback ? <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">{feedback}</p> : null}
      {teachersError || coursesError ? <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">Some data failed to load. Refresh and try again.</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleCreateTeacher} className="space-y-3 rounded-xl border bg-white p-4 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">Create Teacher</h2>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Teacher name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Temporary password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Initial courses (comma separated)"
            value={courseNames}
            onChange={(event) => setCourseNames(event.target.value)}
          />
          <button
            type="submit"
            disabled={creatingTeacher}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {creatingTeacher ? 'Creating...' : 'Create Teacher'}
          </button>
        </form>

        <form onSubmit={handleCreateCourse} className="space-y-3 rounded-xl border bg-white p-4 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">Allocate New Course</h2>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Course name"
            value={newCourseName}
            onChange={(event) => setNewCourseName(event.target.value)}
            required
          />
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={instructorId ?? ''}
            onChange={(event) => setInstructorId(Number(event.target.value))}
            required
          >
            <option value="" disabled>
              Select teacher
            </option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name} ({teacher.email})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Create Course
          </button>
        </form>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-card">
        <h2 className="text-lg font-semibold text-slate-900">Teachers</h2>
        {teachersLoading ? <p className="mt-2 text-sm text-slate-500">Loading teachers...</p> : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Courses</th>
                <th className="py-2 pr-4">Sessions</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Security</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{teacher.name}</td>
                  <td className="py-2 pr-4">{teacher.email}</td>
                  <td className="py-2 pr-4">{teacher.course_count}</td>
                  <td className="py-2 pr-4">{teacher.session_count}</td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleTeacherStatus(teacher.id, teacher.is_active)}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        teacher.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
                      ].join(' ')}
                    >
                      {teacher.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleResetPassword(teacher.id)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-card">
        <h2 className="text-lg font-semibold text-slate-900">Courses</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="py-2 pr-4">Course</th>
                <th className="py-2 pr-4">Instructor ID</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{course.course_name}</td>
                  <td className="py-2 pr-4">{course.instructor_id}</td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(course.id)}
                      className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-card">
        <h2 className="text-lg font-semibold text-slate-900">Teacher Analytics</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[260px_1fr]">
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={selectedTeacherId ?? ''}
            onChange={(event) => setSelectedTeacherId(Number(event.target.value))}
          >
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-sm text-slate-600">Teacher: <span className="font-semibold text-slate-900">{teacherAnalytics?.teacher_name ?? '-'}</span></p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm">
              <p className="rounded-md bg-white px-2 py-1">Courses: <span className="font-semibold">{teacherAnalytics?.total_courses ?? 0}</span></p>
              <p className="rounded-md bg-white px-2 py-1">Sessions: <span className="font-semibold">{teacherAnalytics?.total_sessions ?? 0}</span></p>
              <p className="rounded-md bg-white px-2 py-1">Avg Engagement: <span className="font-semibold">{teacherAnalytics?.overall_avg_final_score == null ? '-' : `${Math.round(teacherAnalytics.overall_avg_final_score)}%`}</span></p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-3">Course</th>
                    <th className="py-1 pr-3">Sessions</th>
                    <th className="py-1 pr-3">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {(teacherAnalytics?.courses ?? []).map((course) => (
                    <tr key={course.course_id} className="border-t border-slate-200">
                      <td className="py-1 pr-3">{course.course_name}</td>
                      <td className="py-1 pr-3">{course.sessions_count}</td>
                      <td className="py-1 pr-3">{course.avg_final_score == null ? '-' : `${Math.round(course.avg_final_score)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleAlertConfigSubmit} className="space-y-3 rounded-xl border bg-white p-4 shadow-card">
        <h2 className="text-lg font-semibold text-slate-900">Course Alert Configuration</h2>
        <select
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={selectedCourseId ?? ''}
          onChange={(event) => setSelectedCourseId(Number(event.target.value))}
        >
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.course_name}
            </option>
          ))}
        </select>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            type="number"
            min={0}
            max={100}
            value={alertThreshold}
            onChange={(event) => setAlertThreshold(Number(event.target.value))}
            placeholder="Threshold %"
          />
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            type="number"
            min={0}
            max={3600}
            value={alertDuration}
            onChange={(event) => setAlertDuration(Number(event.target.value))}
            placeholder="Duration seconds"
          />
          <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={alertEnabled}
              onChange={(event) => setAlertEnabled(event.target.checked)}
            />
            Alert enabled
          </label>
        </div>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90">
          Save Alert Config
        </button>
      </form>
    </section>
  )
}
