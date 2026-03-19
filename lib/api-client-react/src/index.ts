// API Base URL - uses environment variable with fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cbtsoftware.onrender.com/api';
// React Query hooks wrapper
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Export query key helpers
export const getListSchoolsQueryKey = () => ['schools'];
export const getListExamsQueryKey = (schoolCode: string, filters?: any) => ['exams', schoolCode, filters];
export const getExamQueryKey = (schoolCode: string, examId: number) => ['exam', schoolCode, examId];
export const getGetExamQueryKey = (schoolCode: string, examId: number) => ['exam', schoolCode, examId];
export const getListStudentsQueryKey = (schoolCode: string, filters?: any) => ['students', schoolCode, filters];
export const getListTeachersQueryKey = (schoolCode: string) => ['teachers', schoolCode];
export const getListResultsQueryKey = (schoolCode: string, filters?: any) => ['results', schoolCode, filters];
export const getResultDetailQueryKey = (schoolCode: string, resultId: number) => ['result', schoolCode, resultId];
export const getCurrentUserQueryKey = () => ['currentUser'];

// Types for API responses
export interface User {
    id: number;
    username: string;
    role: string;
    schoolCode: string | null;
    schoolName: string | null;
    fullName: string | null;
    class: string | null;
}

export interface School {
    id: number;
    code: string;
    name: string | null;
    createdAt: string;
}

export interface Exam {
    id: number;
    title: string;
    subject: string;
    class: string;
    durationMinutes: number;
    isActive: boolean;
    schoolCode: string;
    teacherId: number;
    createdAt: string;
    questionCount: number;
}

export interface Question {
    id: number;
    examId: number;
    text: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    schoolCode: string;
}

export interface Result {
    id: number;
    examId: number;
    studentId: number;
    fullName: string;
    class: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    schoolCode: string;
    submittedAt: string;
    examTitle?: string;
    subject?: string;
}

// API Client
export const api = {
    // Auth endpoints
    auth: {
        login: async (username: string, password: string, schoolCode?: string) => {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, schoolCode }),
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Login failed');
            return response.json() as Promise<User>;
        },

        logout: async () => {
            const response = await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            return response.json();
        },

        getCurrentUser: async () => {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                credentials: 'include',
            });
            if (!response.ok) return null;
            return response.json() as Promise<User>;
        },
    },

    // Schools endpoints
    schools: {
        list: async () => {
            const response = await fetch(`${API_BASE_URL}/schools`);
            return response.json() as Promise<School[]>;
        },

        create: async (data: { code: string; name: string; adminUsername: string; adminPassword: string }) => {
            const response = await fetch(`${API_BASE_URL}/schools/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return response.json();
        },

        update: async (code: string, name: string) => {
            const response = await fetch(`${API_BASE_URL}/schools`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, name }),
            });
            return response.json();
        },

        newSession: async (schoolCode: string) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/new-session`, {
                method: 'POST',
            });
            return response.json();
        },
    },

    // Exams endpoints
    exams: {
        list: async (schoolCode: string, filters?: { class?: string; active?: boolean }) => {
            const params = new URLSearchParams();
            if (filters?.class) params.append('class', filters.class);
            if (filters?.active !== undefined) params.append('active', String(filters.active));

            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams?${params}`);
            return response.json() as Promise<Exam[]>;
        },

        get: async (schoolCode: string, examId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}`);
            return response.json() as Promise<Exam & { questions: Question[] }>;
        },

        create: async (schoolCode: string, data: { title: string; subject: string; class: string; durationMinutes: number }) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
            });
            return response.json();
        },

        delete: async (schoolCode: string, examId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}`, {
                method: 'DELETE',
            });
            return response.json();
        },

        toggle: async (schoolCode: string, examId: number, isActive: boolean) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive }),
            });
            return response.json();
        },

        addQuestion: async (schoolCode: string, examId: number, data: {
            text: string;
            optionA: string;
            optionB: string;
            optionC: string;
            optionD: string;
            correctOption: string;
        }) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return response.json();
        },

        deleteQuestion: async (examId: number, questionId: number) => {
            const response = await fetch(`${API_BASE_URL}/exams/${examId}/questions/${questionId}`, {
                method: 'DELETE',
            });
            return response.json();
        },

        submit: async (schoolCode: string, examId: number, data: { studentId: number; fullName: string; answers: Record<string, string> }) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return response.json();
        },
    },

    // Students endpoints
    students: {
        list: async (schoolCode: string, className?: string) => {
            const params = className ? `?class=${encodeURIComponent(className)}` : '';
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students${params}`);
            return response.json();
        },

        create: async (schoolCode: string, data: { username: string; password: string; fullName: string; class: string }) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return response.json();
        },

        delete: async (schoolCode: string, studentId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/${studentId}`, {
                method: 'DELETE',
            });
            return response.json();
        },

        getDetail: async (schoolCode: string, studentId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/detail`);
            return response.json();
        },
    },

    // Teachers endpoints
    teachers: {
        list: async (schoolCode: string) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/teachers`);
            return response.json();
        },

        create: async (schoolCode: string, data: { username: string; password: string; fullName: string }) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/teachers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return response.json();
        },

        delete: async (schoolCode: string, teacherId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/teachers/${teacherId}`, {
                method: 'DELETE',
            });
            return response.json();
        },

        getDetail: async (schoolCode: string, teacherId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/teachers/${teacherId}/detail`);
            return response.json();
        },
    },

    // Results endpoints
    results: {
        list: async (schoolCode: string, filters?: { examId?: number; studentId?: number; teacherId?: number }) => {
            const params = new URLSearchParams();
            if (filters?.examId) params.append('examId', String(filters.examId));
            if (filters?.studentId) params.append('studentId', String(filters.studentId));
            if (filters?.teacherId) params.append('teacherId', String(filters.teacherId));

            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/results?${params}`);
            return response.json();
        },

        getDetail: async (schoolCode: string, resultId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/results/${resultId}/detail`);
            return response.json();
        },
    },
};

// Auth hooks
export function useLogin() {
    return useMutation({
        mutationFn: ({ username, password, schoolCode }: { username: string; password: string; schoolCode?: string }) =>
            api.auth.login(username, password, schoolCode),
    });
}

export function useLogout(options?: { mutation?: { onSuccess?: () => void } }) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.auth.logout,
        onSuccess: () => {
            queryClient.clear();
            options?.mutation?.onSuccess?.();
        },
    });
}

export function useCurrentUser() {
    return useQuery({
        queryKey: ['currentUser'],
        queryFn: api.auth.getCurrentUser,
    });
}

// Schools hooks
export function useSchools() {
    return useQuery({
        queryKey: ['schools'],
        queryFn: api.schools.list,
    });
}

export function useCreateSchool() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.schools.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schools'] });
        },
    });
}

// Exams hooks
export function useExams(schoolCode: string, filters?: { class?: string; active?: boolean }) {
    return useQuery({
        queryKey: ['exams', schoolCode, filters],
        queryFn: () => api.exams.list(schoolCode, filters),
        enabled: !!schoolCode,
    });
}

export function useExam(schoolCode: string, examId: number) {
    return useQuery({
        queryKey: ['exam', schoolCode, examId],
        queryFn: () => api.exams.get(schoolCode, examId),
        enabled: !!schoolCode && !!examId,
    });
}

export function useCreateExam(schoolCode: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { title: string; subject: string; class: string; durationMinutes: number }) =>
            api.exams.create(schoolCode, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exams', schoolCode] });
        },
    });
}

export function useDeleteExam(schoolCode: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (examId: number) => api.exams.delete(schoolCode, examId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exams', schoolCode] });
        },
    });
}

// Students hooks
export function useStudents(schoolCode: string, className?: string) {
    return useQuery({
        queryKey: ['students', schoolCode, className],
        queryFn: () => api.students.list(schoolCode, className),
        enabled: !!schoolCode,
    });
}

export function useCreateStudent(options?: { mutation?: { onSuccess?: () => void } }) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, data }: { schoolCode: string; data: { username: string; password: string; fullName: string; class: string } }) =>
            api.students.create(schoolCode, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['students', variables.schoolCode] });
            options?.mutation?.onSuccess?.();
        },
    });
}

// Results hooks
export function useResults(schoolCode: string, filters?: { examId?: number; studentId?: number; teacherId?: number }) {
    return useQuery({
        queryKey: ['results', schoolCode, filters],
        queryFn: () => api.results.list(schoolCode, filters),
        enabled: !!schoolCode,
    });
}

export function useResultDetail(schoolCode: string, resultId: number) {
    return useQuery({
        queryKey: ['result', schoolCode, resultId],
        queryFn: () => api.results.getDetail(schoolCode, resultId),
        enabled: !!schoolCode && !!resultId,
    });
}

// Aliases to match frontend imports
export const useGetMe = useCurrentUser;
export const useGetExam = useExam;
export function useListTeachers(schoolCode: string) {
    return useQuery({
        queryKey: ['teachers', schoolCode],
        queryFn: () => api.teachers.list(schoolCode),
        enabled: !!schoolCode,
    });
}
export const useListStudents = useStudents;
export const useListSchools = useSchools;
export const useListResults = useResults;
export const useListExams = useExams;

// Mutation hooks
export function useAddQuestion() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, examId, data }: {
            schoolCode: string; examId: number; data: {
                text: string;
                optionA: string;
                optionB: string;
                optionC: string;
                optionD: string;
                correctOption: string;
            }
        }) => api.exams.addQuestion(schoolCode, examId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['exam', variables.schoolCode, variables.examId] });
        },
    });
}

export function useDeleteQuestion() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ examId, questionId }: { examId: number; questionId: number }) =>
            api.exams.deleteQuestion(examId, questionId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exam'] });
        },
    });
}

export function useToggleExamStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, examId, isActive }: { schoolCode: string; examId: number; isActive: boolean }) =>
            api.exams.toggle(schoolCode, examId, isActive),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['exams', variables.schoolCode] });
            queryClient.invalidateQueries({ queryKey: ['exam', variables.schoolCode, variables.examId] });
        },
    });
}

export function useSubmitExam() {
    return useMutation({
        mutationFn: ({ schoolCode, examId, data }: {
            schoolCode: string; examId: number; data: {
                studentId: number;
                fullName: string;
                answers: Record<string, string>
            }
        }) => api.exams.submit(schoolCode, examId, data),
    });
}

export function useCreateTeacher(options?: { mutation?: { onSuccess?: () => void } }) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, data }: { schoolCode: string; data: { username: string; password: string; fullName: string } }) =>
            api.teachers.create(schoolCode, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['teachers', variables.schoolCode] });
            options?.mutation?.onSuccess?.();
        },
    });
}

export function useDeleteTeacher(options?: { mutation?: { onSuccess?: () => void } }) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, teacherId }: { schoolCode: string; teacherId: number }) =>
            api.teachers.delete(schoolCode, teacherId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['teachers', variables.schoolCode] });
            options?.mutation?.onSuccess?.();
        },
    });
}

export function useDeleteStudent(options?: { mutation?: { onSuccess?: () => void } }) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, studentId }: { schoolCode: string; studentId: number }) =>
            api.students.delete(schoolCode, studentId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['students', variables.schoolCode] });
            options?.mutation?.onSuccess?.();
        },
    });
}
export function useUpdateSchoolName() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ code, name }: { code: string; name: string }) => api.schools.update(code, name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schools'] });
        },
    });
}

export function useStartNewSession(options?: { mutation?: { onSuccess?: () => void } }) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode }: { schoolCode: string }) =>
            api.schools.newSession(schoolCode),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['students', variables.schoolCode] });
            options?.mutation?.onSuccess?.();
        },
    });
}

export function useTeacherDetail(schoolCode: string, teacherId: number) {
    return useQuery({
        queryKey: ['teacher', schoolCode, teacherId],
        queryFn: () => api.teachers.getDetail(schoolCode, teacherId),
        enabled: !!schoolCode && !!teacherId,
    });
}

export function useStudentDetail(schoolCode: string, studentId: number) {
    return useQuery({
        queryKey: ['student', schoolCode, studentId],
        queryFn: () => api.students.getDetail(schoolCode, studentId),
        enabled: !!schoolCode && !!studentId,
    });
}
