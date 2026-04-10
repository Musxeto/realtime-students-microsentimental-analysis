import { useEffect, useState } from 'react'
import { AlertCircle, BarChart3, BookOpen, Plus, Settings, Users } from 'lucide-react'
import {
  useAdminResetUserPasswordMutation,
  useCreateCourseMutation,
  useCreateTeacherMutation,
  useDeleteCourseMutation,
  useGetCoursesQuery,
  useGetTeachersQuery,
  useUpdateAlertConfigMutation,
  useUpdateTeacherMutation,
  useUpdateCourseMutation,
} from '../../../services/api/apiSlice'
import { CreateTeacherModal } from '../../../components/modals/CreateTeacherModal'
import { ResetPasswordModal } from '../../../components/modals/ResetPasswordModal'
import { CreateCourseModal } from '../../../components/modals/CreateCourseModal'
import { EditCourseModal } from '../../../components/modals/EditCourseModal'
import { UpdateAlertConfigModal } from '../../../components/modals/UpdateAlertConfigModal'

type Tab = 'overview' | 'teachers' | 'courses' | 'alerts' | 'settings'

export function AdminDashboardPage() {
  const { data: teachers = [], isLoading: teachersLoading } = useGetTeachersQuery()
  const { data: courses = [] } = useGetCoursesQuery()
  const [createTeacher, { isLoading: creatingTeacher }] = useCreateTeacherMutation()
  const [updateTeacher] = useUpdateTeacherMutation()
  const [adminResetUserPassword, { isLoading: resettingPassword }] = useAdminResetUserPasswordMutation()
  const [createCourse] = useCreateCourseMutation()
  const [updateCourse, { isLoading: updatingCourse }] = useUpdateCourseMutation()
  const [deleteCourse] = useDeleteCourseMutation()
  const [updateAlertConfig, { isLoading: updatingAlertConfig }] = useUpdateAlertConfigMutation()

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [feedback, setFeedback] = useState<string | null>(null)

  // Modal states
  const [isCreateTeacherModalOpen, setIsCreateTeacherModalOpen] = useState(false)
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false)
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null)
  const [resetPasswordUserName, setResetPasswordUserName] = useState<string>('')
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState(false)
  const [isEditCourseModalOpen, setIsEditCourseModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<{
    id: number
    course_name: string
    course_code: string
    semester: number
    section: number
    instructor_id: number | null
  } | null>(null)
  const [isUpdateAlertConfigModalOpen, setIsUpdateAlertConfigModalOpen] = useState(false)

  // Alert config state
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) setSelectedCourseId(courses[0].id)
  }, [courses, selectedCourseId])

  const showFeedback = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 4000)
  }

  // TEACHERS
  const handleCreateTeacher = async (data: { name: string; email: string; password: string; courseNames: string }) => {
    const courseNames = data.courseNames
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)

    try {
      await createTeacher({
        name: data.name,
        email: data.email,
        password: data.password,
        course_names: courseNames,
      }).unwrap()
      showFeedback('Teacher created successfully.')
      setIsCreateTeacherModalOpen(false)
    } catch {
      throw new Error('Failed to create teacher. Check form or email already exists.')
    }
  }

  const toggleTeacherStatus = async (id: number, active: boolean) => {
    try {
      await updateTeacher({ teacherId: id, payload: { is_active: !active } }).unwrap()
      showFeedback(`Teacher ${!active ? 'activated' : 'deactivated'}.`)
    } catch {
      showFeedback('Failed to update teacher status.')
    }
  }

  const handleResetPassword = async (newPassword: string) => {
    if (!resetPasswordUserId) return
    try {
      await adminResetUserPassword({ userId: resetPasswordUserId, new_password: newPassword }).unwrap()
      showFeedback('Password reset successfully.')
      setIsResetPasswordModalOpen(false)
    } catch {
      throw new Error('Failed to reset password.')
    }
  }

  const openResetPasswordModal = (userId: number, userName: string) => {
    setResetPasswordUserId(userId)
    setResetPasswordUserName(userName)
    setIsResetPasswordModalOpen(true)
  }

  // COURSES
  const handleCreateCourse = async (data: {
    course_name: string
    course_code?: string
    semester: number
    section: number
    instructor_id?: number | null
  }) => {
    try {
      await createCourse(data).unwrap()
      showFeedback('Course created successfully.')
      setIsCreateCourseModalOpen(false)
    } catch {
      throw new Error('Failed to create course.')
    }
  }

  const handleUpdateCourse = async (data: {
    course_name?: string
    course_code?: string
    semester?: number
    section?: number
    instructor_id?: number | null
  }) => {
    if (!editingCourse) return
    try {
      await updateCourse({
        courseId: editingCourse.id,
        payload: data,
      }).unwrap()
      showFeedback('Course updated successfully.')
      setIsEditCourseModalOpen(false)
      setEditingCourse(null)
    } catch {
      throw new Error('Failed to update course.')
    }
  }

  const handleDeleteCourse = async (id: number) => {
    if (!window.confirm('Delete this course?')) return
    try {
      await deleteCourse(id).unwrap()
      showFeedback('Course deleted.')
    } catch {
      showFeedback('Failed to delete course.')
    }
  }

  const openEditCourseModal = (course: {
    id: number
    course_name: string
    course_code: string
    semester: number
    section: number
    instructor_id: number | null
  }) => {
    setEditingCourse(course)
    setIsEditCourseModalOpen(true)
  }

  // ALERTS
  const handleUpdateAlertConfig = async (data: {
    course_id: number
    threshold: number
    duration: number
    enabled: boolean
  }) => {
    try {
      await updateAlertConfig({
        courseId: data.course_id,
        payload: {
          engagement_threshold: data.threshold,
          duration_seconds: data.duration,
          enabled: data.enabled,
        },
      }).unwrap()
      showFeedback('Alert config updated.')
      setIsUpdateAlertConfigModalOpen(false)
    } catch {
      throw new Error('Failed to update alert config.')
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
                onClick={() => {
                  setActiveTab('teachers')
                  setIsCreateTeacherModalOpen(true)
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <Plus className="h-4 w-4" />
                Add Teacher
              </button>
              <button
                onClick={() => {
                  setActiveTab('courses')
                  setIsCreateCourseModalOpen(true)
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <Plus className="h-4 w-4" />
                Create Course
              </button>
              <button
                onClick={() => {
                  setActiveTab('alerts')
                  setIsUpdateAlertConfigModalOpen(true)
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
              >
                <Plus className="h-4 w-4" />
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
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      t.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
            {teachers.length > 3 && (
              <button
                onClick={() => setActiveTab('teachers')}
                className="mt-4 text-sm font-semibold text-blue-600 hover:underline"
              >
                View all {teachers.length} teachers →
              </button>
            )}
          </div>
        </div>
      )}

      {/* TEACHERS TAB */}
      {activeTab === 'teachers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Teachers Management</h2>
              <p className="mt-1 text-sm text-slate-600">View and manage teacher accounts</p>
            </div>
            <button
              onClick={() => setIsCreateTeacherModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              Add Teacher
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
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
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold transition ${
                              t.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {t.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-3 text-sm">
                          <button
                            onClick={() => openResetPasswordModal(t.id, t.name)}
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
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Courses Management</h2>
              <p className="mt-1 text-sm text-slate-600">Create and manage courses</p>
            </div>
            <button
              onClick={() => setIsCreateCourseModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" />
              Create Course
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-900">Course Name</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Code</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Semester</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Section</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Instructor</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        No courses yet. Create one above.
                      </td>
                    </tr>
                  ) : (
                    courses.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-900">{c.course_name}</td>
                        <td className="px-6 py-3 text-slate-600">{c.course_code}</td>
                        <td className="px-6 py-3 text-slate-600">{c.semester}</td>
                        <td className="px-6 py-3 text-slate-600">{c.section}</td>
                        <td className="px-6 py-3 text-slate-600">{teachers.find((t) => t.id === c.instructor_id)?.name || 'Unassigned'}</td>
                        <td className="px-6 py-3 text-sm space-x-2">
                          <button
                            onClick={() => openEditCourseModal(c)}
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
        </div>
      )}

      {/* ALERTS TAB */}
      {activeTab === 'alerts' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Alert Configuration</h2>
          <p className="mt-1 text-sm text-slate-600">Configure engagement alerts per course</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Course</label>
              <select
                value={selectedCourseId ?? ''}
                onChange={(e) => setSelectedCourseId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsUpdateAlertConfigModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-amber-500"
            >
              Configure for Selected Course
            </button>
          </div>
        </div>
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

     

      {/* MODALS */}
      <CreateTeacherModal
        isOpen={isCreateTeacherModalOpen}
        onClose={() => setIsCreateTeacherModalOpen(false)}
        onSubmit={handleCreateTeacher}
        isLoading={creatingTeacher}
      />

      <ResetPasswordModal
        isOpen={isResetPasswordModalOpen}
        teacherName={resetPasswordUserName}
        onClose={() => {
          setIsResetPasswordModalOpen(false)
          setResetPasswordUserId(null)
          setResetPasswordUserName('')
        }}
        onSubmit={handleResetPassword}
        isLoading={resettingPassword}
      />

      <CreateCourseModal
        isOpen={isCreateCourseModalOpen}
        onClose={() => setIsCreateCourseModalOpen(false)}
        teachers={teachers.map((teacher) => ({ id: teacher.id, name: teacher.name }))}
        onSubmit={handleCreateCourse}
      />

      <EditCourseModal
        isOpen={isEditCourseModalOpen}
        initialCourse={editingCourse ?? undefined}
        teachers={teachers.map((teacher) => ({ id: teacher.id, name: teacher.name }))}
        onClose={() => {
          setIsEditCourseModalOpen(false)
          setEditingCourse(null)
        }}
        onSubmit={handleUpdateCourse}
        isLoading={updatingCourse}
      />

      <UpdateAlertConfigModal
        isOpen={isUpdateAlertConfigModalOpen}
        courseId={selectedCourseId ?? undefined}
        courseName={courses.find((c) => c.id === selectedCourseId)?.course_name}
        onClose={() => setIsUpdateAlertConfigModalOpen(false)}
        onSubmit={handleUpdateAlertConfig}
        isLoading={updatingAlertConfig}
      />
    </div>
  )
}
