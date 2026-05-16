import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BarChart3, BookOpen, ChevronLeft, ChevronRight, Filter, KeyRound, LineChart, Pencil, Plus, Search, Settings, Sparkles, Trash2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { useConfirm } from '../../../app/confirm'
import {
  useAdminResetUserPasswordMutation,
  useCreateCourseMutation,
  useCreateTeacherMutation,
  useGetAdminSummaryQuery,
  useDeleteCourseMutation,
  useGetCoursesQuery,
  useGetTeachersQuery,
  useGetSessionsQuery,
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
  const confirm = useConfirm()
  const [createTeacher, { isLoading: creatingTeacher }] = useCreateTeacherMutation()
  const [updateTeacher] = useUpdateTeacherMutation()
  const [adminResetUserPassword, { isLoading: resettingPassword }] = useAdminResetUserPasswordMutation()
  const [createCourse] = useCreateCourseMutation()
  const [updateCourse, { isLoading: updatingCourse }] = useUpdateCourseMutation()
  const [deleteCourse] = useDeleteCourseMutation()
  const [updateAlertConfig, { isLoading: updatingAlertConfig }] = useUpdateAlertConfigMutation()

  // Teachers query state
  const [teacherSearch, setTeacherSearch] = useState('')
  const [teacherStatus, setTeacherStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [teacherPage, setTeacherPage] = useState(0)
  const pageSize = 10

  // Courses query state
  const [courseSearch, setCourseSearch] = useState('')
  const [courseSemester, setCourseSemester] = useState<number | 'all'>('all')
  const [courseSection, setCourseSection] = useState<number | 'all'>('all')
  const [courseInstructor, setCourseInstructor] = useState<number | 'all'>('all')
  const [coursePage, setCoursePage] = useState(0)

  const { data: teachersData, isLoading: teachersLoading } = useGetTeachersQuery({
    search: teacherSearch || undefined,
    is_active: teacherStatus === 'all' ? undefined : teacherStatus === 'active',
    limit: pageSize,
    offset: teacherPage * pageSize,
  })

  const { data: allTeachersData } = useGetTeachersQuery({
    limit: 100,
    offset: 0,
  })

  const { data: coursesData, refetch: refetchCourses } = useGetCoursesQuery({
    search: courseSearch || undefined,
    semester: courseSemester === 'all' ? undefined : (courseSemester as number),
    section: courseSection === 'all' ? undefined : (courseSection as number),
    instructor_id: courseInstructor === 'all' ? undefined : (courseInstructor as number),
    limit: pageSize,
    offset: coursePage * pageSize,
  })
  const { data: sessionsData } = useGetSessionsQuery({ limit: 200, offset: 0 })
  const { data: summaryData } = useGetAdminSummaryQuery()

  const teachers = teachersData?.items ?? []
  const teacherOptions = allTeachersData?.items ?? teachers
  const teacherNameById = useMemo(() => {
    return new Map<number, string>(teacherOptions.map((t) => [t.id, t.name]))
  }, [teacherOptions])
  const teachersTotal = teachersData?.total ?? 0
  const courses = coursesData?.items ?? []
  const coursesTotal = coursesData?.total ?? 0
  const sessions = sessionsData?.items ?? []

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('overview')

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
      toast.success('Teacher created successfully.')
      setIsCreateTeacherModalOpen(false)
    } catch {
      toast.error('Failed to create teacher. Check form or email already exists.')
      throw new Error('Failed to create teacher. Check form or email already exists.')
    }
  }

  const toggleTeacherStatus = async (id: number, active: boolean) => {
    try {
      await updateTeacher({ teacherId: id, payload: { is_active: !active } }).unwrap()
      toast.success(`Teacher ${!active ? 'activated' : 'deactivated'}.`)
    } catch {
      toast.error('Failed to update teacher status.')
    }
  }

  const handleResetPassword = async (newPassword: string) => {
    if (!resetPasswordUserId) return
    try {
      await adminResetUserPassword({ userId: resetPasswordUserId, new_password: newPassword }).unwrap()
      toast.success('Password reset successfully.')
      setIsResetPasswordModalOpen(false)
    } catch {
      toast.error('Failed to reset password.')
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
      await refetchCourses()
      toast.success('Course created successfully.')
      setIsCreateCourseModalOpen(false)
    } catch {
      toast.error('Failed to create course.')
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
      await refetchCourses()
      toast.success('Course updated successfully.')
      setIsEditCourseModalOpen(false)
      setEditingCourse(null)
    } catch {
      toast.error('Failed to update course.')
      throw new Error('Failed to update course.')
    }
  }

  const handleDeleteCourse = async (id: number) => {
    const approved = await confirm({
      title: 'Delete course',
      message: 'Are you sure you want to delete this course?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!approved) return
    try {
      await deleteCourse(id).unwrap()
      await refetchCourses()
      toast.success('Course deleted.')
    } catch {
      toast.error('Failed to delete course.')
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
      toast.success('Alert config updated.')
      setIsUpdateAlertConfigModalOpen(false)
    } catch {
      toast.error('Failed to update alert config.')
      throw new Error('Failed to update alert config.')
    }
  }

  // STATS CARDS
  const totalTeachers = summaryData?.total_teachers ?? teachersTotal
  const activeTeachers = summaryData?.active_teachers ?? teachers.filter((t) => t.is_active).length
  const totalCourses = summaryData?.total_courses ?? coursesTotal
  const assignedCourses = summaryData?.assigned_courses ?? teachers.reduce((sum, t) => sum + t.course_count, 0)
  const totalSessions = summaryData?.total_sessions ?? teachers.reduce((sum, t) => sum + t.session_count, 0)
  const avgEngagement = useMemo(() => {
    const completedScores = sessions
      .filter((session) => session.final_avg_score != null)
      .map((session) => Number(session.final_avg_score))

    return completedScores.length
      ? Math.round((completedScores.reduce((sum, score) => sum + score, 0) / completedScores.length) * 10) / 10
      : 0
  }, [sessions])

  return (
    <div className="admin-theme space-y-6 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-card to-background/80 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900">
            <Sparkles className="h-7 w-7 text-blue-600" />
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">Manage teachers, courses, and system settings</p>
        </div>
      </div>

 {/* TAB NAVIGATION */}
      <div className="sticky bottom-0 z-10 mt-8 rounded-xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur">
        <div className="flex gap-2 overflow-x-auto">
          {(['overview', 'teachers', 'courses', 'alerts', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium transition ${
                activeTab === tab
                  ? 'rounded-lg bg-blue-600 text-white shadow'
                  : 'rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Teachers</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{totalTeachers}</p>
                </div>
                <Users className="h-12 w-12 text-blue-100" />
              </div>
              <p className="mt-4 text-xs text-slate-500">
                {activeTeachers} active teachers
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Courses</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{totalCourses}</p>
                </div>
                <BookOpen className="h-12 w-12 text-emerald-100" />
              </div>
              <p className="mt-4 text-xs text-slate-500">{assignedCourses} assigned courses</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Sessions</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{totalSessions}</p>
                </div>
                <BarChart3 className="h-12 w-12 text-orange-100" />
              </div>
              <p className="mt-4 text-xs text-slate-500">Across all courses</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Avg Engagement</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {avgEngagement}
                    %
                  </p>
                </div>
                <AlertCircle className="h-12 w-12 text-red-100" />
              </div>
              <p className="mt-4 text-xs text-slate-500">System-wide average</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
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
            
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={teacherSearch}
                  onChange={(e) => {
                    setTeacherSearch(e.target.value)
                    setTeacherPage(0)
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 min-w-[160px]">
                <Filter className="h-4 w-4 text-slate-400" />
                <select
                  value={teacherStatus}
                  onChange={(e) => {
                    setTeacherStatus(e.target.value as any)
                    setTeacherPage(0)
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
                  ) : (teachers.length === 0 && !teachersLoading) ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        No teachers found. Try adjusting your search/filter markers.
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
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/admin/teachers/${t.id}`}
                              className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-700 transition hover:bg-indigo-100"
                              title="Open Teacher Project Page"
                              aria-label={`Open project page for ${t.name}`}
                            >
                              <LineChart className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => openResetPasswordModal(t.id, t.name)}
                              className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100"
                              title="Reset Password"
                              aria-label={`Reset password for ${t.name}`}
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="text-sm text-slate-500">
                Showing <span className="font-medium">{teachers.length > 0 ? teacherPage * pageSize + 1 : 0}</span> to{' '}
                <span className="font-medium">{Math.min((teacherPage + 1) * pageSize, teachersTotal)}</span> of{' '}
                <span className="font-medium">{teachersTotal}</span> results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTeacherPage((p) => Math.max(0, p - 1))}
                  disabled={teacherPage === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  onClick={() => setTeacherPage((p) => p + 1)}
                  disabled={(teacherPage + 1) * pageSize >= teachersTotal}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COURSES TAB */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
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

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={courseSearch}
                  onChange={(e) => {
                    setCourseSearch(e.target.value)
                    setCoursePage(0)
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <select
                value={courseSemester}
                onChange={(e) => {
                  setCourseSemester(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  setCoursePage(0)
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
              <select
                value={courseSection}
                onChange={(e) => {
                  setCourseSection(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  setCoursePage(0)
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Sections</option>
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
              <select
                value={courseInstructor}
                onChange={(e) => {
                  setCourseInstructor(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  setCoursePage(0)
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Instructors</option>
                {/* We can use all teachers found so far if we want, or just a generic list */}
                {teacherOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
                        No courses found. Try adjusting your search/filters.
                      </td>
                    </tr>
                  ) : (
                    courses.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-900">{c.course_name}</td>
                        <td className="px-6 py-3 text-slate-600">{c.course_code}</td>
                        <td className="px-6 py-3 text-slate-600">{c.semester}</td>
                        <td className="px-6 py-3 text-slate-600">{c.section}</td>
                        <td className="px-6 py-3 text-slate-600">{(c.instructor_id != null ? teacherNameById.get(c.instructor_id) : undefined) || 'Unassigned'}</td>
                        <td className="px-6 py-3 text-sm">
                          <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditCourseModal(c)}
                            className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100"
                            title="Edit Course"
                            aria-label={`Edit ${c.course_name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(c.id)}
                            className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                            title="Delete Course"
                            aria-label={`Delete ${c.course_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="text-sm text-slate-500">
                Showing <span className="font-medium">{courses.length > 0 ? coursePage * pageSize + 1 : 0}</span> to{' '}
                <span className="font-medium">{Math.min((coursePage + 1) * pageSize, coursesTotal)}</span> of{' '}
                <span className="font-medium">{coursesTotal}</span> results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCoursePage((p) => Math.max(0, p - 1))}
                  disabled={coursePage === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  onClick={() => setCoursePage((p) => p + 1)}
                  disabled={(coursePage + 1) * pageSize >= coursesTotal}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALERTS TAB */}
      {activeTab === 'alerts' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">System Settings</h2>
          <div className="mt-6 space-y-4 text-slate-600">
            <p className="text-sm">• Backend API: Configured and running</p>
            <p className="text-sm">• Database: PostgreSQL 15 connected</p>
            <p className="text-sm">• Teachers: {teachersTotal} active accounts</p>
            <p className="text-sm">• Courses: {coursesTotal} total courses</p>
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
        teachers={teacherOptions.map((teacher) => ({ id: teacher.id, name: teacher.name }))}
        onSubmit={handleCreateCourse}
      />

      <EditCourseModal
        isOpen={isEditCourseModalOpen}
        initialCourse={editingCourse ?? undefined}
        teachers={teacherOptions.map((teacher) => ({ id: teacher.id, name: teacher.name }))}
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
