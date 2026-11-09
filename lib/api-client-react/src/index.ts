// API Base URL - uses environment variable with fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cbtsoftware.onrender.com/api';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Query Key Helpers ───────────────────────────────────────────────────────

export const getCurrentUserQueryKey = () => ['currentUser'];
export const getListSchoolsQueryKey = () => ['schools'];
export const getListTeachersQueryKey = (schoolCode: string) => ['teachers', schoolCode];
export const getListStudentsQueryKey = (schoolCode: string, className?: string) => ['students', schoolCode, className];
export const getListExamsQueryKey = (schoolCode: string, filters?: any) => ['exams', schoolCode, filters];
export const getGetExamQueryKey = (schoolCode: string, examId: number) => ['exam', schoolCode, examId];
export const getExamQueryKey = getGetExamQueryKey;
export const getListResultsQueryKey = (schoolCode: string, filters?: any) => ['results', schoolCode, filters];
export const getResultDetailQueryKey = (schoolCode: string, resultId: number) => ['result', schoolCode, resultId];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
    id: number;
    username: string;
    role: string;
    schoolCode: string | null;
    schoolName: string | null;
    fullName: string | null;
    class: string | null;
    profilePicture?: string | null;
    isDisabled?: boolean;
}

export interface School {
    id: number;
    code: string;
    name: string | null;
    createdAt: string;
    isDisabled?: boolean;
}

export interface Exam {
    id: number;
    title: string;
    subject: string;
    class: string;
    durationMinutes: number;
    assessmentType?: string;
    term?: string;
    isActive: boolean;
    schoolCode: string;
    teacherId: number;
    createdAt: string;
    questionCount: number;
    questions?: GroupedQuestion[]; // Change this from Question[] to GroupedQuestion[]
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
    imageUrl?: string | null;
    groupId?: number | null;
    groupOrder?: number | null;
    groupImageUrl?: string | null;
    groupTitle?: string | null;
    groupText?: string | null;
    questionType?: string | null;
    correctAnswerText?: string | null;
}

export interface QuestionGroup {
    id: number;
    examId: number;
    title: string;
    passageText?: string | null;
    imageUrl?: string | null;
    displayOrder: number;
}

export interface GroupedQuestion {
    isGroup: boolean;
    groupId?: number;        // question_groups.id (proper FK after migration)
    groupOrder?: number;
    groupImageUrl?: string | null;
    groupTitle?: string | null;
    groupText?: string | null;
    questions?: Question[];
    question?: Question;
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
    assessmentType?: string;
    term?: string;
    submittedAt: string;
    examTitle?: string;
    subject?: string;
}

export interface StudentCredential {
    id: number;
    fullName: string;
    username: string;
    class: string;
    generatedPassword: string | null;
}

// ─── API Client ──────────────────────────────────────────────────────────────

export const api = {
    auth: {
        login: async (username: string, password: string, schoolCode?: string): Promise<User> => {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, schoolCode }),
                credentials: 'include',
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({ error: 'Login failed. Please check your credentials.' }));
                const err: any = new Error(data.error || 'Login failed');
                err.status = response.status;
                err.data = data;
                throw err;
            }
            return response.json();
        },

        logout: async () => {
            const response = await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            return response.json();
        },

        getCurrentUser: async (): Promise<User | null> => {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                credentials: 'include',
            });
            if (!response.ok) return null;
            return response.json();
        },
    },

    schools: {
        list: async (): Promise<School[]> => {
            const response = await fetch(`${API_BASE_URL}/schools`, {
                credentials: 'include',
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw Object.assign(new Error(data.error || 'Failed to load schools'), { status: response.status, data });
            }
            return response.json();
        },

        create: async (data: { code: string; name: string; adminUsername: string; adminPassword: string }) => {
            const response = await fetch(`${API_BASE_URL}/schools/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
            });
            return response.json();
        },

        update: async (code: string, name: string) => {
            const response = await fetch(`${API_BASE_URL}/schools`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, name }),
                credentials: 'include',
            });
            return response.json();
        },

        newSession: async (schoolCode: string) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/new-session`, {
                method: 'POST',
                credentials: 'include',
            });
            return response.json();
        },

        previewNewSession: async (schoolCode: string): Promise<{
            currentSession: string;
            currentTerm: string;
            newSession: string;
            classes: { class: string; nextClass: string | null; promoting: number; retaining: number; graduating: number }[];
        }> => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/new-session-preview`, {
                credentials: 'include',
            });
            return response.json();
        },
    },

    teachers: {
        list: async (schoolCode: string): Promise<User[]> => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/teachers`, {
                credentials: 'include',
            });
            return response.json();
        },

        create: async (schoolCode: string, data: { username: string; password: string; fullName: string }) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/teachers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
            });
            return response.json();
        },

        delete: async (schoolCode: string, teacherId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/teachers/${teacherId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            return response.json();
        },

        getDetail: async (schoolCode: string, teacherId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/teachers/${teacherId}/detail`, {
                credentials: 'include',
            });
            return response.json();
        },
    },

    students: {
        list: async (schoolCode: string, className?: string): Promise<User[]> => {
            const params = className ? `?class=${encodeURIComponent(className)}` : '';
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students${params}`, {
                credentials: 'include',
            });
            return response.json();
        },

        create: async (schoolCode: string, data: { username: string; password: string; fullName: string; class: string }) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
            });
            return response.json();
        },

        delete: async (schoolCode: string, studentId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/${studentId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            return response.json();
        },

        getDetail: async (schoolCode: string, studentId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/detail`, {
                credentials: 'include',
            });
            return response.json();
        },

        credentials: async (schoolCode: string): Promise<StudentCredential[]> => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/credentials`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch credentials');
            return response.json();
        },
    },

    exams: {
        list: async (schoolCode: string, filters?: { class?: string; active?: boolean }): Promise<Exam[]> => {
            const params = new URLSearchParams();
            if (filters?.class) params.append('class', filters.class);
            if (filters?.active !== undefined) params.append('active', String(filters.active));
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams?${params}`, {
                credentials: 'include',
            });
            return response.json();
        },

        bulkAddQuestions: async (schoolCode: string, examId: number, questions: Array<{
            text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: string;
        }>, groupId?: number | null, groupTitle?: string | null, groupText?: string | null, groupImageUrl?: string | null) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}/questions/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions, groupId, groupTitle, groupText, groupImageUrl }),
                credentials: 'include',
            });
            return response.json();
        },

        get: async (schoolCode: string, examId: number): Promise<Exam & { questions: GroupedQuestion[] }> => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}`, {
                credentials: 'include',
            });
            return response.json();
        },

        create: async (schoolCode: string, data: {
            title: string; subject: string; class: string; durationMinutes: number; assessmentType?: string;
            term?: string;
        }) => {
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
                credentials: 'include',
            });
            return response.json();
        },

        toggle: async (schoolCode: string, examId: number, isActive: boolean) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive }),
                credentials: 'include',
            });
            return response.json();
        },

        addQuestion: async (schoolCode: string, examId: number, data: {
            text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: string; imageUrl?: string | null; groupId?: number | null; groupTitle?: string | null; groupText?: string | null; groupImageUrl?: string | null; questionType?: string | null; correctAnswerText?: string | null;
        }) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
            });
            return response.json();
        },

        updateGroup: async (schoolCode: string, examId: number, groupId: number, data: { groupTitle: string; groupText?: string | null; groupImageUrl?: string | null }) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}/groups/${groupId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
            });
            return response.json();
        },

        deleteGroup: async (schoolCode: string, examId: number, groupId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}/groups/${groupId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            return response.json();
        },

        updateQuestion: async (schoolCode: string, examId: number, questionId: number, data: { text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: string; imageUrl?: string | null; questionType?: string | null; correctAnswerText?: string | null; groupId?: number | null }) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}/questions/${questionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
            });
            return response.json();
        },

        deleteQuestion: async (schoolCode: string, examId: number, questionId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}/questions/${questionId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            return response.json();
        },

        submit: async (schoolCode: string, examId: number, data: { studentId: number; fullName: string; answers: Record<string, string> }) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/exams/${examId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
            });
            return response.json();
        },
    },

    results: {
        list: async (schoolCode: string, filters?: { examId?: number; studentId?: number; teacherId?: number }): Promise<Result[]> => {
            const params = new URLSearchParams();
            if (filters?.examId) params.append('examId', String(filters.examId));
            if (filters?.studentId) params.append('studentId', String(filters.studentId));
            if (filters?.teacherId) params.append('teacherId', String(filters.teacherId));
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/results?${params}`, {
                credentials: 'include',
            });
            return response.json();
        },

        getDetail: async (schoolCode: string, resultId: number) => {
            const response = await fetch(`${API_BASE_URL}/schools/${schoolCode}/results/${resultId}/detail`, {
                credentials: 'include',
            });
            return response.json();
        },
    },
};

// ─── Options Type Helper ─────────────────────────────────────────────────────

type MutationOptions<T = void> = {
    mutation?: {
        onSuccess?: (data?: T) => void;
        onError?: (error: any) => void;
    };
};

// ─── Auth Hooks ──────────────────────────────────────────────────────────────

export function useLogin() {
    return useMutation({
        mutationFn: ({ username, password, schoolCode }: { username: string; password: string; schoolCode?: string }) =>
            api.auth.login(username, password, schoolCode),
    });
}

export function useLogout(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.auth.logout,
        onSuccess: () => {
            queryClient.clear();
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useCurrentUser() {
    return useQuery({
        queryKey: getCurrentUserQueryKey(),
        queryFn: api.auth.getCurrentUser,
    });
}

// ─── School Hooks ────────────────────────────────────────────────────────────

export function useSchools() {
    return useQuery({
        queryKey: getListSchoolsQueryKey(),
        queryFn: api.schools.list,
    });
}

export function useCreateSchool(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { code: string; name: string; adminUsername: string; adminPassword: string }) =>
            api.schools.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useUpdateSchoolName(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ code, name }: { code: string; name: string }) =>
            api.schools.update(code, name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useStartNewSession(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode }: { schoolCode: string }) =>
            api.schools.newSession(schoolCode),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['students', variables.schoolCode] });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function usePreviewNewSession(schoolCode: string, enabled: boolean) {
    return useQuery({
        queryKey: ['newSessionPreview', schoolCode],
        queryFn: () => api.schools.previewNewSession(schoolCode),
        enabled: !!schoolCode && enabled,
        staleTime: 0,
    });
}

// ─── Teacher Hooks ───────────────────────────────────────────────────────────

export function useListTeachers(schoolCode: string) {
    return useQuery({
        queryKey: getListTeachersQueryKey(schoolCode),
        queryFn: () => api.teachers.list(schoolCode),
        enabled: !!schoolCode,
    });
}

export function useCreateTeacher(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, data }: { schoolCode: string; data: { username: string; password: string; fullName: string } }) =>
            api.teachers.create(schoolCode, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: getListTeachersQueryKey(variables.schoolCode) });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useDeleteTeacher(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, teacherId }: { schoolCode: string; teacherId: number }) =>
            api.teachers.delete(schoolCode, teacherId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: getListTeachersQueryKey(variables.schoolCode) });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useTeacherDetail(schoolCode: string, teacherId: number | null) {
    return useQuery({
        queryKey: ['teacher', schoolCode, teacherId],
        queryFn: () => api.teachers.getDetail(schoolCode, teacherId!),
        enabled: !!schoolCode && !!teacherId,
    });
}

// ─── Student Hooks ───────────────────────────────────────────────────────────

export function useListStudents(schoolCode: string, className?: string) {
    return useQuery({
        queryKey: getListStudentsQueryKey(schoolCode, className),
        queryFn: () => api.students.list(schoolCode, className),
        enabled: !!schoolCode,
    });
}

export function useCreateStudent(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, data }: { schoolCode: string; data: { username: string; password: string; fullName: string; class: string } }) =>
            api.students.create(schoolCode, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['students', variables.schoolCode] });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useDeleteStudent(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, studentId }: { schoolCode: string; studentId: number }) =>
            api.students.delete(schoolCode, studentId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['students', variables.schoolCode] });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useStudentDetail(schoolCode: string, studentId: number | null) {
    return useQuery({
        queryKey: ['student', schoolCode, studentId],
        queryFn: () => api.students.getDetail(schoolCode, studentId!),
        enabled: !!schoolCode && !!studentId,
    });
}

export function useStudentCredentials(schoolCode: string) {
    return useQuery({
        queryKey: ['students', 'credentials', schoolCode],
        queryFn: () => api.students.credentials(schoolCode),
        enabled: !!schoolCode,
    });
}

// ─── Exam Hooks ──────────────────────────────────────────────────────────────

export function useListExams(schoolCode: string, filters?: { class?: string; active?: boolean }) {
    return useQuery({
        queryKey: getListExamsQueryKey(schoolCode, filters),
        queryFn: () => api.exams.list(schoolCode, filters),
        enabled: !!schoolCode,
    });
}

export function useBulkAddQuestions(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, examId, questions, groupId, groupTitle, groupText, groupImageUrl }: {
            schoolCode: string;
            examId: number;
            questions: Array<{
                text: string; optionA: string; optionB: string;
                optionC: string; optionD: string; correctOption: string;
            }>;
            groupId?: number | null;
            groupTitle?: string | null;
            groupText?: string | null;
            groupImageUrl?: string | null;
        }) => api.exams.bulkAddQuestions(schoolCode, examId, questions, groupId, groupTitle, groupText, groupImageUrl),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: getExamQueryKey(variables.schoolCode, variables.examId) });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useExam(schoolCode: string, examId: number) {
    return useQuery({
        queryKey: getExamQueryKey(schoolCode, examId),
        queryFn: () => api.exams.get(schoolCode, examId),
        enabled: !!schoolCode && !!examId,
    });
}

export function useCreateExam(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, data }: { schoolCode: string; data: { title: string; subject: string; class: string; durationMinutes: number; assessmentType?: string; term?: string; } }) =>
            api.exams.create(schoolCode, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['exams', variables.schoolCode] });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useDeleteExam(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, examId }: { schoolCode: string; examId: number }) =>
            api.exams.delete(schoolCode, examId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['exams', variables.schoolCode] });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useToggleExamStatus(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, examId, isActive }: { schoolCode: string; examId: number; isActive: boolean }) =>
            api.exams.toggle(schoolCode, examId, isActive),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['exams', variables.schoolCode] });
            queryClient.invalidateQueries({ queryKey: getExamQueryKey(variables.schoolCode, variables.examId) });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useAddQuestion(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, examId, data }: {
            schoolCode: string; examId: number; data: {
                text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: string; imageUrl?: string | null; groupId?: number | null; groupTitle?: string | null; groupText?: string | null; groupImageUrl?: string | null; questionType?: string | null; correctAnswerText?: string | null;
            }
        }) => api.exams.addQuestion(schoolCode, examId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: getExamQueryKey(variables.schoolCode, variables.examId) });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useUpdateGroup(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, examId, groupId, data }: { schoolCode: string; examId: number; groupId: number; data: { groupTitle: string; groupText?: string | null; groupImageUrl?: string | null } }) =>
            api.exams.updateGroup(schoolCode, examId, groupId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: getExamQueryKey(variables.schoolCode, variables.examId) });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useDeleteGroup(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, examId, groupId }: { schoolCode: string; examId: number; groupId: number }) =>
            api.exams.deleteGroup(schoolCode, examId, groupId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: getExamQueryKey(variables.schoolCode, variables.examId) });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useUpdateQuestion(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, examId, questionId, data }: { schoolCode: string; examId: number; questionId: number; data: { text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: string; imageUrl?: string | null; questionType?: string | null; correctAnswerText?: string | null; groupId?: number | null } }) =>
            api.exams.updateQuestion(schoolCode, examId, questionId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: getExamQueryKey(variables.schoolCode, variables.examId) });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useDeleteQuestion(options?: MutationOptions) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ schoolCode, examId, questionId }: { schoolCode: string; examId: number; questionId: number }) =>
            api.exams.deleteQuestion(schoolCode, examId, questionId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: getExamQueryKey(variables.schoolCode, variables.examId) });
            options?.mutation?.onSuccess?.();
        },
        onError: options?.mutation?.onError,
    });
}

export function useSubmitExam(options?: MutationOptions) {
    return useMutation({
        mutationFn: ({ schoolCode, examId, data }: {
            schoolCode: string; examId: number; data: { studentId: number; fullName: string; answers: Record<string, string> }
        }) => api.exams.submit(schoolCode, examId, data),
        onSuccess: options?.mutation?.onSuccess,
        onError: options?.mutation?.onError,
    });
}

// ─── Results Hooks ───────────────────────────────────────────────────────────

export function useListResults(schoolCode: string, filters?: { examId?: number; studentId?: number; teacherId?: number }) {
    return useQuery({
        queryKey: getListResultsQueryKey(schoolCode, filters),
        queryFn: () => api.results.list(schoolCode, filters),
        enabled: !!schoolCode,
    });
}

export function useResultDetail(schoolCode: string, resultId: number | null) {
    return useQuery({
        queryKey: getResultDetailQueryKey(schoolCode, resultId!),
        queryFn: () => api.results.getDetail(schoolCode, resultId!),
        enabled: !!schoolCode && !!resultId,
    });
}

// ─── Aliases ─────────────────────────────────────────────────────────────────

export const useGetMe = useCurrentUser;
export const useGetExam = useExam;
export const useExams = useListExams;
export const useStudents = useListStudents;
export const useResults = useListResults;
export const useListSchools = useSchools;