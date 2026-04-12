import { useParams, Link } from 'react-router-dom'
import { useGetCourseHistoryQuery, useGetCourseAnalyticsQuery } from '../../../services/api/apiSlice'
import { ArrowLeft, History, Clock, User, CheckCircle2 } from 'lucide-react'

export function CourseHistoryPage() {
  const { id } = useParams()
  const courseId = Number(id)
  
  const { data: history, isLoading: historyLoading } = useGetCourseHistoryQuery(courseId, { skip: !id })
  const { data: analytics, isLoading: analyticsLoading } = useGetCourseAnalyticsQuery(courseId, { skip: !id })

  if (historyLoading || analyticsLoading) {
    return <div className="p-8 text-slate-500">Loading class history...</div>
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/teacher/courses" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">{analytics?.course_name || 'Course History'}</h1>
          <p className="text-sm font-medium text-slate-500">Audit logs and teaching timeline</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700">
              <History className="h-4 w-4 text-indigo-500" />
              Event Timeline
            </h2>
          </div>
          
          <div className="p-6">
            {history?.length === 0 ? (
              <p className="py-8 text-center text-sm font-medium text-slate-400">No history events recorded yet.</p>
            ) : (
              <div className="space-y-8 relative">
                <div className="absolute left-[19px] top-2 h-[calc(100%-16px)] w-0.5 bg-slate-100" />
                
                {history?.map((log) => {
                  const date = new Date(log.timestamp).toLocaleString()
                  const isClassComplete = log.action === 'CLASS_COMPLETED'
                  const isTeacherAssigned = log.action === 'TEACHER_ASSIGNED'
                  
                  return (
                    <div key={log.id} className="relative pl-12">
                      <div className={`absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border bg-white shadow-sm ${
                        isClassComplete ? 'border-emerald-200 text-emerald-500' : 
                        isTeacherAssigned ? 'border-indigo-200 text-indigo-500' : 'border-slate-200 text-slate-400'
                      }`}>
                        {isClassComplete ? <CheckCircle2 className="h-5 w-5" /> :
                         isTeacherAssigned ? <User className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{log.action.replace('_', ' ')}</p>
                        <p className="text-base font-bold text-slate-800">
                          {isClassComplete && `Class #${log.details?.session_id} ended with ${Math.round(log.details?.avg_engagement)}% engagement`}
                          {isTeacherAssigned && `Teacher ${log.details?.new_instructor_name} assigned to course`}
                          {log.action === 'COURSE_CREATED' && `Course created: ${log.details?.course_name}`}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {date}</span>
                          {isClassComplete && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                              Duration: {Math.floor(log.details?.duration_seconds / 60)}m {log.details?.duration_seconds % 60}s
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Quick Stats</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Completed Classes</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{analytics?.completed_sessions_count}</p>
              </div>
              <div className="rounded-2xl bg-indigo-50 p-4">
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Avg Engagement</p>
                <p className="mt-1 text-2xl font-black text-indigo-600">{Math.round(analytics?.avg_final_score || 0)}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
