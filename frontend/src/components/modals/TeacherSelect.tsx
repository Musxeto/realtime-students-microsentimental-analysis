import { useEffect, useMemo, useRef, useState } from 'react'

interface TeacherSelectProps {
  teachers: Array<{ id: number; name: string }>
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function TeacherSelect({ teachers, value, onChange, placeholder = 'Assign Teacher / Classroom Owner' }: TeacherSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const selectedLabel = useMemo(() => {
    if (!value) return 'Unassigned'
    const selected = teachers.find((teacher) => String(teacher.id) === value)
    return selected?.name ?? 'Unassigned'
  }, [teachers, value])

  const filteredTeachers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return teachers
    return teachers.filter((teacher) => teacher.name.toLowerCase().includes(term))
  }, [search, teachers])

  useEffect(() => {
    if (!isOpen) return
    searchInputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleSelect = (newValue: string) => {
    onChange(newValue)
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-300 px-4 py-2 text-sm text-left focus:border-blue-500 focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="text-slate-400">v</span>
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search teacher name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1" role="listbox" aria-label={placeholder}>
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${value === '' ? 'bg-blue-100 text-blue-700' : 'text-slate-700'}`}
            >
              Unassigned
            </button>
            {filteredTeachers.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">No teacher found.</p>
            ) : (
              filteredTeachers.map((teacher) => {
                const teacherId = String(teacher.id)
                const isSelected = value === teacherId
                return (
                  <button
                    key={teacher.id}
                    type="button"
                    onClick={() => handleSelect(teacherId)}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${isSelected ? 'bg-blue-100 text-blue-700' : 'text-slate-700'}`}
                  >
                    {teacher.name}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
