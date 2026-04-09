import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import { API_BASE_URL } from '../../config/env'
import type { RootState } from '../../app/store'
import type { LoginRequest, LoginResponse } from '../../types/auth'
import { logout } from '../../features/auth/authSlice'

export interface Course {
  id: number
  course_name: string
  instructor_id: number
  available_videos: string[]
}

export interface StartSessionRequest {
  course_id: number
  video_path: string
  frame_step: number
}

export interface StartSessionResponse {
  session_id: number
  course_id: number
  status: string
  start_time: string
}

export interface EndSessionResponse {
  session_id: number
  status: string
  final_avg_score: number | null
}

export interface SessionOut {
  id: number
  course_id: number
  status: string
  start_time: string
  end_time: string | null
  final_avg_score: number | null
  video_path: string | null
  session_metadata?: Record<string, unknown> | null
}

export interface SessionListResponse {
  items: SessionOut[]
  total: number
  limit: number
  offset: number
}

export interface SessionLogItem {
  id: number
  session_id: number
  timestamp: string
  engagement_score: number
  engaged_count: number
  distracted_count: number
}

export interface SessionLogsResponse {
  items: SessionLogItem[]
  total: number
  limit: number
  offset: number
}

export interface CourseAnalytics {
  course_id: number
  course_name: string
  sessions_count: number
  completed_sessions_count: number
  avg_final_score: number | null
  peak_final_score: number | null
  lowest_final_score: number | null
  trend: Array<{ session_id: number; start_time: string; final_avg_score: number }>
}

export interface TeacherListItem {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
  course_count: number
  session_count: number
}

export interface CreateTeacherRequest {
  name: string
  email: string
  password: string
  course_names: string[]
}

export interface CreateTeacherResponse {
  teacher: { id: number; name: string; email: string; role: string; is_active: boolean }
  courses: Course[]
}

export interface UpdateTeacherRequest {
  teacherId: number
  payload: {
    name?: string
    email?: string
    is_active?: boolean
  }
}

export interface CreateCourseRequest {
  course_name: string
  instructor_id?: number
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as RootState
    const token = state.auth.accessToken

    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }

    return headers
  },
})

const baseQueryWithAuthGuard: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions)
  if (result.error?.status === 401) {
    api.dispatch(logout())
  }
  return result
}

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuthGuard,
  tagTypes: ['Teacher', 'Course', 'Session'],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
    }),
    getCourses: builder.query<Course[], void>({
      query: () => '/courses',
      providesTags: ['Course'],
    }),
    createCourse: builder.mutation<Course, CreateCourseRequest>({
      query: (body) => ({
        url: '/courses',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Course'],
    }),
    deleteCourse: builder.mutation<void, number>({
      query: (courseId) => ({
        url: `/courses/${courseId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Course', 'Session'],
    }),
    getCourseAnalytics: builder.query<CourseAnalytics, number>({
      query: (courseId) => `/courses/${courseId}/analytics`,
      providesTags: ['Course'],
    }),
    startSession: builder.mutation<StartSessionResponse, StartSessionRequest>({
      query: (body) => ({
        url: '/sessions/start',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Session'],
    }),
    endSession: builder.mutation<EndSessionResponse, number>({
      query: (sessionId) => ({
        url: `/sessions/${sessionId}/end`,
        method: 'POST',
      }),
      invalidatesTags: ['Session', 'Course'],
    }),
    getSessions: builder.query<SessionListResponse, { course_id?: number; status?: string; limit?: number; offset?: number } | undefined>({
      query: (params) =>
        params
          ? {
              url: '/sessions',
              params,
            }
          : '/sessions',
      providesTags: ['Session'],
    }),
    getSessionById: builder.query<SessionOut, number>({
      query: (sessionId) => `/sessions/${sessionId}`,
      providesTags: ['Session'],
    }),
    getSessionLogs: builder.query<SessionLogsResponse, { sessionId: number; limit?: number; offset?: number }>({
      query: ({ sessionId, limit = 200, offset = 0 }) => ({
        url: `/sessions/${sessionId}/logs`,
        params: { limit, offset },
      }),
      providesTags: ['Session'],
    }),
    getTeachers: builder.query<TeacherListItem[], void>({
      query: () => '/admin/teachers',
      providesTags: ['Teacher'],
    }),
    createTeacher: builder.mutation<CreateTeacherResponse, CreateTeacherRequest>({
      query: (body) => ({
        url: '/admin/teachers',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Teacher', 'Course'],
    }),
    updateTeacher: builder.mutation<{ id: number; email: string; name: string; role: string; is_active: boolean }, UpdateTeacherRequest>({
      query: ({ teacherId, payload }) => ({
        url: `/admin/teachers/${teacherId}`,
        method: 'PATCH',
        body: payload,
      }),
      invalidatesTags: ['Teacher'],
    }),
    getTeacherAnalytics: builder.query<{
      teacher_id: number
      teacher_name: string
      total_courses: number
      total_sessions: number
      overall_avg_final_score: number | null
      courses: Array<{ course_id: number; course_name: string; sessions_count: number; avg_final_score: number | null }>
    }, number>({
      query: (teacherId) => `/admin/teachers/${teacherId}/analytics`,
      providesTags: ['Teacher'],
    }),
  }),
})

export const {
  useLoginMutation,
  useGetCoursesQuery,
  useCreateCourseMutation,
  useDeleteCourseMutation,
  useGetCourseAnalyticsQuery,
  useStartSessionMutation,
  useEndSessionMutation,
  useGetSessionsQuery,
  useGetSessionByIdQuery,
  useGetSessionLogsQuery,
  useGetTeachersQuery,
  useCreateTeacherMutation,
  useUpdateTeacherMutation,
  useGetTeacherAnalyticsQuery,
} = apiSlice
