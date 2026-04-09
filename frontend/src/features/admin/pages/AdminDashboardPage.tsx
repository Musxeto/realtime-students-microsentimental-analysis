import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  useCreateCourseMutation,
  useCreateTeacherMutation,
  useDeleteCourseMutation,
  useGetCoursesQuery,
  useGetTeachersQuery,
  useUpdateTeacherMutation,
} from '../../../services/api/apiSlice'

export function AdminDashboardPage() {
  const { data: teachers = [], isLoading: teachersLoading } = useGetTeachersQuery()
  const { data: courses = [] } = useGetCoursesQuery()
  const [createTeacher, { isLoading: creatingTeacher }] = useCreateTeacherMutation()
  const [updateTeacher] = useUpdateTeacherMutation()
  const [createCourse] = useCreateCourseMutation()
  const [deleteCourse] = useDeleteCourseMutation()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [courseNames, setCourseNames] = useState('')

  const [newCourseName, setNewCourseName] = useState('')
  const [instructorId, setInstructorId] = useState<number | null>(null)

  async function handleCreateTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedCourses = courseNames
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

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
  }

  async function handleCreateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!instructorId) {
      return
    }

    await createCourse({
      course_name: newCourseName,
      instructor_id: instructorId,
    }).unwrap()

    setNewCourseName('')
  }

  async function toggleTeacherStatus(teacherId: number, current: boolean) {
    await updateTeacher({
      teacherId,
      payload: { is_active: !current },
    }).unwrap()
  }

  async function handleDeleteCourse(courseId: number) {
    await deleteCourse(courseId).unwrap()
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>

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
    </section>
  )
}
