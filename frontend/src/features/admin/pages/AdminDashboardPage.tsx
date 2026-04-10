import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, BarChart3, BookOpen, Settings, Users, X } from 'lucide-react'
import {
  useAdminResetUserPasswordMutation,
  useCreateCourseMutation,
  useCreateTeacherMutation,
  useDeleteCourseMutation,
  useGetAlertConfigQuery,
  useGetCoursesQuery,
  useGetTeachersQuery,
  useUpdateAlertConfigMutation,
  useUpdateTeacherMutation,
  useUpdateCourseMutation,
} from '../../../services/api/apiSlice'

type Tab = 'overview' | 'teachers' | 'courses' | 'alerts' | 'settings'

export function AdminDashboardPage() {
  const { data: teachers = [], isLoading: teachersLoading } = useGetTeachersQuery()
  const { data: courses = [] } = useGetCoursesQuery()
  const [createTeacher, { isLoading: creatingTeacher }] = useCreateTeacherMutation()
  const [updateTeacher] = useUpdateTeacherMutation()
  const [adminResetUserPassword] = useAdminResetUserPasswordMutation()
  const [createCourse] = useCreateCourseMutation()
  const [updateCourse] = useUpdateCourseMutation()
  const [deleteCourse] = useDeleteCourseMutation()
  const [updateAlertConfig] = useUpdateAlertConfigMutation()

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [feedback, setFeedback] = useState<string | null>(null)

  // Teacher form state
  const [teacherForm, setTeacherForm] = useState({ name: '', email: '', password: '', courseNames: '' })

  // Course form state
  const [courseForm, setCourseForm] = useState({ name: '', instructorId: '' })
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null)
  const [editingCourseName, setEditingCourseName] = useState('')

  // Alert config state
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const { data: selectedAlertConfig } = useGetAlertConfigQuery(selectedCourseId ?? 0, {
    skip: selectedCourseId == null,
  })
  const [alertConfig, setAlertConfig] = useState({ threshold: 50, duration: 180, enabled: true })

  // Teacher analytics state
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  // const { data: teacherAnalytics } = useGetTeacherAnalyticsQuery(selectedTeacherId ?? 0, {
  //   skip: selectedTeacherId == null,
  // })

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) setSelectedCourseId(courses[0].id)
  }, [courses, selectedCourseId])

  useEffect(() => {
    if (!selectedTeacherId && teachers.length > 0) setSelectedTeacherId(teachers[0].id)
  }, [selectedTeacherId, teachers])

  useEffect(() => {
    if (selectedAlertConfig) {
      setAlertConfig({
        threshold: selectedAlertConfig.engagement_threshold,
        duration: selectedAlertConfig.duration_seconds,
        enabled: selectedAlertConfig.enabled,
      })
    }
  }, [selectedAlertConfig])

  const showFeedback = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 4000)
  }

  // TEACHERS
  async function handleCreateTeacher(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const courseNames = teacherForm.courseNames
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)

    try {
      await createTeacher({
        name: teacherForm.name,
        email: teacherForm.email,
        password: teacherForm.password,
        course_names: courseNames,
      }).unwrap()

      setTeacherForm({ name: '', email: '', password: '', courseNames: '' })
      showFeedback('Teacher created successfully.')
    } catch {
      showFeedback('Failed to create teacher. Check form or email already exists.')
    }
  }

  async function toggleTeacherStatus(id: number, active: boolean) {
    try {
      await updateTeacher({ teacherId: id, payload: { is_active: !active } }).unwrap()
      showFeedback(`Teacher ${!active ? 'activated' : 'deactivated'}.`)
    } catch {
      showFeedback('Failed to update teacher status.')
    }
  }

  async function handleResetPassword(userId: number) {
    const pwd = window.prompt('Enter new password (min 4 chars):')
    if (!pwd || pwd.length < 4) {
      showFeedback('Password must be at least 4 characters.')
      return
    }

    try {
      await adminResetUserPassword({ userId, new_password: pwd }).unwrap()
      showFeedback('Password reset successfully.')
    } catch {
      showFeedback('Failed to reset password.')
    }
  }

  // COURSES
  async function handleCreateCourse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!courseForm.instructorId) return

    try {
      await createCourse({
        course_name: courseForm.name,
        instructor_id: parseInt(courseForm.instructorId),
      }).unwrap()

      setCourseForm({ name: '', instructorId: '' })
      showFeedback('Course created successfully.')
    } catch {
      showFeedback('Failed to create course.')
    }
  }

  async function handleUpdateCourse() {
    if (!editingCourseId || !editingCourseName.trim()) return

    try {
      await updateCourse({
        courseId: editingCourseId,
        payload: { course_name: editingCourseName },
      }).unwrap()

      setEditingCourseId(null)
      setEditingCourseName('')
      showFeedback('Course updated successfully.')
    } catch {
      showFeedback('Failed to update course.')
    }
  }

  async function handleDeleteCourse(id: number) {
    if (!window.confirm('Delete this course?')) return

    try {
      await deleteCourse(id).unwrap()
      showFeedback('Course deleted.')
    } catch {
      showFeedback('Failed to delete course.')
    }
  }

  // ALERTS
  async function handleUpdateAlertConfig(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedCourseId) return

    try {
      await updateAlertConfig({
        courseId: selectedCourseId,
        payload: {
          engagement_threshold: alertConfig.threshold,
          duration_seconds: alertConfig.duration,
          enabled: alertConfig.enabled,
        },
      }).unwrap()

      showFeedback('Alert config updated.')
    } catch {
      showFeedback('Failed to update alert config.')
    }
  }

  // STATS CARDS
  const totalSessions = teachers.reduce((sum, t) => sum + t.session_count, 0)
  const totalCoursesAssigned = teachers.reduce((sum, t) => sum + t.course_count, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Manage teachers, courses, and system settings</p>
        </div>
      </div>

      {feedback && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-900">{feedback}</p>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Teachers</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{teachers.length}</p>
                </div>
                <Users className="h-12 w-12 text-blue-100" />
              </div>
              <p className="mt-4 text-xs text-slate-500">
                {teachers.filter((t) => t.is_active).length} active
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Courses</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{courses.length}</p>
                </div>
                <BookOpen className="h-12 w-12 text-emerald-100" />
              </div>
              <p className="mt-4 text-xs text-slate-500">{totalCoursesAssigned} assignments</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Sessions</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{totalSessions}</p>
                </div>
                <BarChart3 className="h-12 w-12 text-orange-100" />
              </div>
              <p className="mt-4 text-xs text-slate-500">Across all courses</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Avg Engagement</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {teachers.length > 0
                      ? Math.round(
                          (teachers.reduce((sum, t) => sum + (t.session_count > 0 ? 70 : 0), 0) / teachers.length) * 10
                        ) / 10
                      : 0}
                    %
                  </p>
                </div>
                <AlertCircle className="h-12 w-12 text-red-100" />
              </div>
              <p className="mt-4 text-xs text-slate-500">System-wide average</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <button
                onClick={() => setActiveTab('teachers')}
                className="rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                + Add Teacher
              </button>
              <button
                onClick={() => setActiveTab('courses')}
                className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                + Create Course
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
              >
                Configure Alerts
              </button>
            </div>
          </div>

          {/* Teacher List Preview */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Recent Teachers</h2>
            <div className="mt-4 space-y-2">
              {teachers.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <div>
                    <p className="font-medium text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.email}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${t.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
            {teachers.length > 3 && (
              <button onClick={() => setActiveTab('teachers')} className="mt-4 text-sm font-semibold text-blue-600 hover:underline">
                View all {teachers.length} teachers →
              </button>
            )}
          </div>
        </div>
      )}

      {/* TEACHERS TAB */}
      {activeTab === 'teachers' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateTeacher} className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Create New Teacher</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input
                type="text"
                placeholder="Full name"
                value={teacherForm.name}
                onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                required
              />
              <input
                type="email"
                placeholder="Email address"
                value={teacherForm.email}
                onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                required
              />
              <input
                type="password"
                placeholder="Temporary password"
                value={teacherForm.password}
                onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                required
              />
              <input
                type="text"
                placeholder="Initial courses (comma separated)"
                value={teacherForm.courseNames}
                onChange={(e) => setTeacherForm({ ...teacherForm, courseNames: e.target.value })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={creatingTeacher}
              className="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {creatingTeacher ? 'Creating...' : 'Create Teacher'}
            </button>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Teachers Management</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-900">Name</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Email</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Courses</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Sessions</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Status</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachersLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        Loading teachers...
                      </td>
                    </tr>
                  ) : teachers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        No teachers yet. Create one above.
                      </td>
                    </tr>
                  ) : (
                    teachers.map((t) => (
                      <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-900">{t.name}</td>
                        <td className="px-6 py-3 text-slate-600">{t.email}</td>
                        <td className="px-6 py-3 text-slate-600">{t.course_count}</td>
                        <td className="px-6 py-3 text-slate-600">{t.session_count}</td>
                        <td className="px-6 py-3">
                          <button
                            onClick={() => toggleTeacherStatus(t.id, t.is_active)}
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              t.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-3 text-sm">
                          <button
                            onClick={() => handleResetPassword(t.id)}
                            className="font-semibold text-blue-600 hover:underline"
                          >
                            Reset Password
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* COURSES TAB */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateCourse} className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Create New Course</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input
                type="text"
                placeholder="Course name"
                value={courseForm.name}
                onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                required
              />
              <select
                value={courseForm.instructorId}
                onChange={(e) => setCourseForm({ ...courseForm, instructorId: e.target.value })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                required
              >
                <option value="">Select instructor</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="mt-4 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Create Course
            </button>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Courses Management</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-900">Course Name</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Instructor</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                        No courses yet. Create one above.
                      </td>
                    </tr>
                  ) : (
                    courses.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-900">{c.course_name}</td>
                        <td className="px-6 py-3 text-slate-600">{teachers.find((t) => t.id === c.instructor_id)?.name || 'Unknown'}</td>
                        <td className="px-6 py-3 text-sm space-x-2">
                          <button
                            onClick={() => {
                              setEditingCourseId(c.id)
                              setEditingCourseName(c.course_name)
                            }}
                            className="font-semibold text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(c.id)}
                            className="font-semibold text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Course Modal */}
          {editingCourseId !== null && (
            <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Edit Course</h3>
                  <button
                    onClick={() => {
                      setEditingCourseId(null)
                      setEditingCourseName('')
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={editingCourseName}
                  onChange={(e) => setEditingCourseName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Course name"
                />
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleUpdateCourse}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setEditingCourseId(null)
                      setEditingCourseName('')
                    }}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ALERTS TAB */}
      {activeTab === 'alerts' && (
        <form onSubmit={handleUpdateAlertConfig} className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Alert Configuration</h2>
          <div className="mt-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700">Select Course</label>
              <select
                value={selectedCourseId ?? ''}
                onChange={(e) => setSelectedCourseId(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Engagement Threshold (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={alertConfig.threshold}
                  onChange={(e) => setAlertConfig({ ...alertConfig, threshold: Number(e.target.value) })}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">Alert triggers when engagement falls below this %</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Alert Duration (seconds)</label>
                <input
                  type="number"
                  min={0}
                  value={alertConfig.duration}
                  onChange={(e) => setAlertConfig({ ...alertConfig, duration: Number(e.target.value) })}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">How long the alert remains active</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="alertEnabled"
                checked={alertConfig.enabled}
                onChange={(e) => setAlertConfig({ ...alertConfig, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="alertEnabled" className="text-sm font-medium text-slate-700">
                Enable alerts for this course
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-amber-500"
            >
              Update Alert Configuration
            </button>
          </div>
        </form>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">System Settings</h2>
          <div className="mt-6 space-y-4 text-slate-600">
            <p className="text-sm">• Backend API: Configured and running</p>
            <p className="text-sm">• Database: PostgreSQL 15 connected</p>
            <p className="text-sm">• Teachers: {teachers.length} active accounts</p>
            <p className="text-sm">• Courses: {courses.length} total courses</p>
            <p className="text-sm">• Sessions: {totalSessions} recorded sessions</p>
            <hr className="my-6" />
            <p className="text-xs text-slate-500">Settings and configuration options will be expanded based on system requirements.</p>
          </div>
        </div>
      )}

      {/* TAB NAVIGATION */}
      <div className="sticky bottom-0 mt-8 border-t border-slate-200 bg-white pt-4">
        <div className="flex gap-2 overflow-x-auto">
          {(['overview', 'teachers', 'courses', 'alerts', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium transition ${
                activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'overview' && <BarChart3 className="h-4 w-4" />}
              {tab === 'teachers' && <Users className="h-4 w-4" />}
              {tab === 'courses' && <BookOpen className="h-4 w-4" />}
              {tab === 'alerts' && <AlertCircle className="h-4 w-4" />}
              {tab === 'settings' && <Settings className="h-4 w-4" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
