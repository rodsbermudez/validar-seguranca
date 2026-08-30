import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  const origin = window.location.origin;
  const pathName = window.location.pathname;
  if (pathName.startsWith('/validar-seguranca')) {
    return `${origin}/validar-seguranca/api`;
  }
  return `${origin}/api`;
};

export const getDocsUrl = () => {
  const pathName = window.location.pathname;
  if (pathName.startsWith('/validar-seguranca')) {
    return '/validar-seguranca/docs';
  }
  return '/docs';
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token and optional impersonation header to outgoing requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const impersonateId = localStorage.getItem('impersonated_user_id');
  if (impersonateId && config.headers) {
    config.headers['X-Impersonate-User-Id'] = impersonateId;
  }

  return config;
});

// Interceptor to handle unauthenticated responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user');
      localStorage.removeItem('impersonated_user');
      localStorage.removeItem('impersonated_user_id');
      window.dispatchEvent(new Event('auth-unauthorized'));
    }
    return Promise.reject(error);
  }
);

export interface LogEntry {
  timestamp: string;
  level: 'Fatal' | 'Warning' | 'Notice' | 'Deprecated' | 'Other';
  raw_line: string;
  message: string;
}

export interface WebsiteLogsResponse {
  status: number;
  success: boolean;
  logging_enabled: boolean;
  total: number;
  logs: LogEntry[];
  message?: string;
}

export const getWebsiteLogs = async (websiteId: number, filterLevel: string = 'all'): Promise<WebsiteLogsResponse> => {
  const response = await api.get<WebsiteLogsResponse>(`/websites/${websiteId}/logs`, {
    params: { filter_level: filterLevel }
  });
  return response.data;
};

export const toggleWebsiteLogs = async (websiteId: number): Promise<{ success: boolean; logging_enabled: boolean; message: string }> => {
  const response = await api.post(`/websites/${websiteId}/logs/toggle`);
  return response.data;
};

export const clearWebsiteLogs = async (websiteId: number): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(`/websites/${websiteId}/logs/clear`);
  return response.data;
};

export interface AIModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  badge: string;
  color: string;
}

export interface PlatformSettingsResponse {
  status: number;
  success: boolean;
  active_ai_model: string;
  has_api_key: boolean;
  available_models: AIModelOption[];
  message?: string;
}

export const getSettings = async (): Promise<PlatformSettingsResponse> => {
  const response = await api.get<PlatformSettingsResponse>('/settings');
  return response.data;
};

export const updateSettings = async (aiModel: string): Promise<PlatformSettingsResponse> => {
  const response = await api.post<PlatformSettingsResponse>('/settings', { ai_model: aiModel });
  return response.data;
};

