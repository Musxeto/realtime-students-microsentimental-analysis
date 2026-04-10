import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BaseModal } from './BaseModal'
import { TeacherSelect } from './TeacherSelect'

interface EditCourseModalProps {
  isOpen: boolean
  initialCourse?: {
    course_name: string
    course_code: string
    semester: number
    section: number
    instructor_id: number | null
  }
  teachers?: Array<{ id: number; name: string }>
  onClose: () => void
  onSubmit: (data: {
    course_name?: string
    course_code?: string
    semester?: number
    section?: number
    instructor_id?: number | null
  }) => Promise<void>
  isLoading?: boolean
}

export function EditCourseModal({ isOpen, initialCourse, teachers = [], onClose, onSubmit, isLoading }: EditCourseModalProps) {
  const [formData, setFormData] = useState({
    course_name: initialCourse?.course_name || '',
    course_code: initialCourse?.course_code || '',
    semester: initialCourse?.semester || 1,
    section: initialCourse?.section || 1,
    instructor_id: initialCourse?.instructor_id?.toString() || '',
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFormData({
      course_name: initialCourse?.course_name || '',
      course_code: initialCourse?.course_code || '',
      semester: initialCourse?.semester || 1,
      section: initialCourse?.section || 1,
      instructor_id: initialCourse?.instructor_id?.toString() || '',
    })
  }, [initialCourse, isOpen])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit({
        course_name: formData.course_name.trim() || undefined,
        course_code: formData.course_code.trim() || undefined,
        semester: formData.semester,
        section: formData.section,
        instructor_id: formData.instructor_id ? parseInt(formData.instructor_id, 10) : null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update course')
    }
  }

  return (
    <BaseModal isOpen={isOpen} title={`Edit Course${initialCourse ? ` - ${initialCourse.course_name}` : ''}`} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
        
        <div>
          <label htmlFor="courseName" className="block text-sm font-medium text-slate-700 mb-2">
            Course Name
          </label>
          <input
            id="courseName"
            type="text"
            placeholder="e.g., Classroom A"
            value={formData.course_name}
            onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="courseCode" className="block text-sm font-medium text-slate-700 mb-2">
            Course Code
          </label>
          <input
            id="courseCode"
            type="text"
            value={formData.course_code}
            onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="semester" className="block text-sm font-medium text-slate-700 mb-2">
              Semester
            </label>
            <input
              id="semester"
              type="number"
              min={1}
              max={8}
              value={formData.semester}
              onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) || 1 })}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="section" className="block text-sm font-medium text-slate-700 mb-2">
              Section
            </label>
            <input
              id="section"
              type="number"
              min={1}
              max={5}
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: Number(e.target.value) || 1 })}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Assign Teacher / Classroom Owner
          </label>
          <TeacherSelect
            teachers={teachers}
            value={formData.instructor_id}
            onChange={(newValue) => setFormData({ ...formData, instructor_id: newValue })}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </BaseModal>
  )
}
