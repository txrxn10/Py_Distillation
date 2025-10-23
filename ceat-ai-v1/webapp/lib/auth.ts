import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = "http://ceatapi.demodevelopment.com/api";

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
}

export interface AuthResponse {
    message: string;
    access_token: string;
    user: User;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

class AuthService {
    private api = axios.create({
        baseURL: API_BASE_URL,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    constructor() {
        // Add request interceptor to include auth token
        this.api.interceptors.request.use((config) => {
            const token = this.getToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        // Add response interceptor to handle auth errors
        this.api.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    this.logout();
                }
                return Promise.reject(error);
            }
        );
    }

    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await this.api.post('/auth/login', credentials);
        const authData = response.data;

        // Store token in cookie
        Cookies.set('auth_token', authData.access_token, {
            expires: 7, // 7 days
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        return authData;
    }

    async register(credentials: RegisterCredentials): Promise<AuthResponse> {
        const response = await this.api.post('/auth/register', credentials);
        const authData = response.data;

        // Store token in cookie
        Cookies.set('auth_token', authData.access_token, {
            expires: 7, // 7 days
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        return authData;
    }

    async getProfile(): Promise<User> {
        const response = await this.api.get('/auth/profile');
        return response.data.user;
    }

    async updateProfile(data: Partial<Pick<User, 'firstName' | 'lastName'>>): Promise<User> {
        const response = await this.api.put('/auth/profile', data);
        return response.data.user;
    }

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        await this.api.post('/auth/change-password', {
            currentPassword,
            newPassword,
        });
    }

    logout(): void {
        Cookies.remove('auth_token');
        window.location.href = '/';
    }

    getToken(): string | undefined {
        return Cookies.get('auth_token');
    }

    isAuthenticated(): boolean {
        return !!this.getToken();
    }
}

export const authService = new AuthService();

// Export the configured axios instance for use in other services
export const apiClient = authService['api'];