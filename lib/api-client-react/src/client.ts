const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cbtsoftware.onrender.com/api';

export const apiClient = {
    // Auth endpoints
    login: async (username: string, password: string, schoolCode?: string) => {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, schoolCode }),
            credentials: 'include',
        });
        return response.json();
    },

    // Schools endpoints
    getSchools: async () => {
        const response = await fetch(`${API_BASE_URL}/schools`);
        return response.json();
    },

    // Add other endpoints as needed
};