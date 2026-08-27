import axios from 'axios';

const API_BASE_URL = 'http://localhost/validar-seguranca/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
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
