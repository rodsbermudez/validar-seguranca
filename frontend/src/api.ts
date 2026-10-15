import axios from 'axios';
import { formatMonthYear } from './utils/date';

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
      const url = String(error.config?.url || '').toLowerCase();
      // Do not log out if the 401 is from an external agent communication endpoint
      const isAgentEndpoint =
        url.includes('/logs') ||
        url.includes('/updates') ||
        url.includes('/integrity') ||
        url.includes('/connect');

      if (!isAgentEndpoint) {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        localStorage.removeItem('impersonated_user');
        localStorage.removeItem('impersonated_user_id');
        window.dispatchEvent(new Event('auth-unauthorized'));
      }
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

export interface IntegrityIssue {
  file: string;
  type: 'modified' | 'suspicious' | 'missing';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  expected_hash?: string | null;
  actual_hash?: string | null;
  size?: number;
  modified_at?: string | null;
  description: string;
  recommendation: string;
  is_ignored?: boolean;
  ignored_at?: string | null;
  ignore_note?: string | null;
}

export interface IntegrityScanSummary {
  total_checked: number;
  passed: number;
  modified: number;
  suspicious: number;
  missing: number;
  issues_count: number;
  active_issues?: number;
  ignored_issues?: number;
}

export interface IntegrityScanData {
  scanned_at: string;
  wp_version: string;
  locale: string;
  is_secure: boolean;
  summary: IntegrityScanSummary;
  issues: IntegrityIssue[];
}

export interface WebsiteIntegrityResponse {
  status: number;
  success: boolean;
  data: IntegrityScanData;
  message?: string;
}

export const getWebsiteIntegrity = async (websiteId: number): Promise<WebsiteIntegrityResponse> => {
  const response = await api.get<WebsiteIntegrityResponse>(`/websites/${websiteId}/integrity`);
  return response.data;
};

export const scanWebsiteIntegrity = async (websiteId: number): Promise<WebsiteIntegrityResponse> => {
  const response = await api.post<WebsiteIntegrityResponse>(`/websites/${websiteId}/integrity/scan`);
  return response.data;
};

export const toggleIgnoreIntegrityIssue = async (
  websiteId: number,
  file: string,
  ignore: boolean = true,
  note?: string
): Promise<WebsiteIntegrityResponse> => {
  const response = await api.post<WebsiteIntegrityResponse>(`/websites/${websiteId}/integrity/ignore`, {
    file,
    ignore,
    note,
  });
  return response.data;
};

export const deleteIntegrityFile = async (
  websiteId: number,
  file: string
): Promise<WebsiteIntegrityResponse> => {
  const response = await api.post<WebsiteIntegrityResponse>(`/websites/${websiteId}/integrity/delete-file`, {
    file,
  });
  return response.data;
};

export const restoreIntegrityFile = async (
  websiteId: number,
  file: string
): Promise<WebsiteIntegrityResponse> => {
  const response = await api.post<WebsiteIntegrityResponse>(`/websites/${websiteId}/integrity/restore-file`, {
    file,
  });
  return response.data;
};

export interface DiagnosticSummaryResponse {
  status: number;
  success: boolean;
  generated_at: string;
  website: {
    id: number | string;
    name: string;
    url: string;
    environment: string;
    is_connected: number;
    connected_at?: string | null;
  };
  data: {
    latest_scan: any | null;
    logs_48h: {
      total_fatal_48h: number;
      fatal_logs_48h: Array<{
        timestamp: string;
        level: string;
        raw_line: string;
        message: string;
      }>;
      has_logs_agent: boolean;
      logging_enabled: boolean;
    };
    integrity: IntegrityScanData | null;
    updates: {
      summary: {
        total_pending: number;
        pending_plugins: number;
        pending_themes: number;
        pending_core: number;
      };
      core: {
        current_version: string;
        new_version: string;
        has_update: boolean;
      };
      plugins: Array<{
        file: string;
        slug: string;
        name: string;
        current_version: string;
        new_version: string;
        has_update: boolean;
        is_active?: boolean;
      }>;
      themes: Array<{
        slug: string;
        name: string;
        current_version: string;
        new_version: string;
        has_update: boolean;
      }>;
    } | null;
  };
}

export const getDiagnosticSummary = async (
  websiteId: number | string
): Promise<DiagnosticSummaryResponse> => {
  const response = await api.get<DiagnosticSummaryResponse>(`/websites/${websiteId}/diagnostic-summary`);
  return response.data;
};

export interface WebsiteFixItem {
  check_id: string;
  title: string;
  description: string;
  active: boolean;
}

export interface WebsiteFixesResponse {
  success: boolean;
  installed: boolean;
  active: boolean;
  version?: string | null;
  fixes: WebsiteFixItem[];
}

export interface ToggleFixResponse {
  success: boolean;
  check_id: string;
  active: boolean;
  message?: string;
}

export const getWebsiteFixes = async (
  websiteId: number | string
): Promise<WebsiteFixesResponse> => {
  const response = await api.get<WebsiteFixesResponse>(`/websites/${websiteId}/fixes`);
  return response.data;
};

export const toggleWebsiteFix = async (
  websiteId: number | string,
  checkId: string,
  enabled: boolean
): Promise<ToggleFixResponse> => {
  const response = await api.post<ToggleFixResponse>(`/websites/${websiteId}/fixes/toggle`, {
    check_id: checkId,
    enabled,
  });
  return response.data;
};

export interface WebsiteShareMember {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface WebsiteSharesResponse {
  status: number;
  data: {
    owner: {
      id: number;
      name: string;
      email: string;
    } | null;
    shares: WebsiteShareMember[];
    is_owner: boolean;
  };
}

export const getWebsiteShares = async (websiteId: number | string): Promise<WebsiteSharesResponse> => {
  const response = await api.get<WebsiteSharesResponse>(`/websites/${websiteId}/shares`);
  return response.data;
};

export const addWebsiteShare = async (
  websiteId: number | string,
  email: string,
  role: string = 'viewer'
): Promise<{ status: number; message: string; data: WebsiteShareMember }> => {
  const response = await api.post(`/websites/${websiteId}/shares`, { email, role });
  return response.data;
};

export const removeWebsiteShare = async (
  websiteId: number | string,
  userId: number | string
): Promise<{ status: number; message: string }> => {
  const response = await api.delete(`/websites/${websiteId}/shares/${userId}`);
  return response.data;
};

// Maintenance Cycle & Dashboard Types
export interface Website {
  id: string | number;
  name: string;
  url: string;
  environment: string;
  is_connected?: number | boolean;
  agent_token?: string;
  maintenance_day?: number | null;
  created_at: string;
  is_owner?: boolean | number;
  owner_name?: string;
  owner_email?: string;
  user_role?: string;
  shares_count?: number;
  latest_score?: number | null;
  latest_grade?: string | null;
  latest_scanned_at?: string | null;
  maintenance?: MaintenanceStatus;
}

export interface MaintenanceStatus {
  status: 'completed' | 'overdue' | 'today' | 'upcoming' | 'not_scheduled';
  label: string;
  badge_color: 'green' | 'red' | 'yellow' | 'blue' | 'gray';
  completed_at?: string | null;
  completed_by?: string | null;
  notes?: string | null;
  target_day?: number | null;
  target_date?: string | null;
  year_month?: string;
}

export interface MaintenanceHistoryItem {
  id: number;
  website_id: number;
  user_id: number;
  year_month: string;
  completed_at: string;
  notes?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  created_at?: string;
}

export interface DashboardMetrics {
  total_websites: number;
  connected_websites: number;
  pending_websites: number;
  average_score: number | null;
  total_scheduled: number;
  completed_count: number;
  overdue_count: number;
  today_count: number;
  upcoming_count: number;
  not_scheduled_count: number;
  progress_percent: number;
  urgent_tasks_count: number;
}

export interface DashboardMaintenanceTask {
  website_id: number;
  website_name: string;
  website_url: string;
  environment: string;
  is_owner: boolean;
  owner_name?: string;
  maintenance_day: number | null;
  status: 'completed' | 'overdue' | 'today' | 'upcoming' | 'not_scheduled';
  label: string;
  badge_color: string;
  target_day: number | null;
  target_date?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  notes?: string | null;
  latest_score?: number | null;
  latest_grade?: string | null;
}

export interface DashboardSecurityRadarItem {
  website_id: number;
  website_name: string;
  website_url: string;
  environment: string;
  is_connected: boolean;
  latest_score: number | null;
  latest_grade: string | null;
  latest_scanned_at: string | null;
  days_since_scan?: number | null;
  is_outdated: boolean;
  is_critical: boolean;
  needs_scan: boolean;
}

export interface DashboardIntegrityRadarItem {
  website_id: number;
  website_name: string;
  website_url: string;
  environment: string;
  is_connected: boolean;
  total_checked?: number | null;
  passed?: number | null;
  issues_count?: number | null;
  ignored_issues?: number | null;
  modified?: number | null;
  suspicious?: number | null;
  is_secure?: boolean | number | null;
  last_scanned_at?: string | null;
  days_since_scan?: number | null;
  is_outdated: boolean;
  needs_scan: boolean;
}

export interface DashboardRecentScanItem {
  id: number;
  website_id: number;
  website_name: string;
  website_url: string;
  status: string;
  score: number | null;
  grade?: string | null;
  executed_at: string;
}

export interface DashboardOverviewResponse {
  status: number;
  data: {
    year_month: string;
    year_month_label: string;
    metrics: DashboardMetrics;
    maintenances: DashboardMaintenanceTask[];
    security_radar: DashboardSecurityRadarItem[];
    integrity_radar: DashboardIntegrityRadarItem[];
    recent_scans?: DashboardRecentScanItem[];
  };
}

export const getDashboardOverview = async (yearMonth?: string): Promise<DashboardOverviewResponse> => {
  const response = await api.get<DashboardOverviewResponse>('/dashboard/overview', {
    params: yearMonth ? { year_month: yearMonth } : undefined,
  });
  return response.data;
};

export const completeWebsiteMaintenance = async (
  websiteId: number | string,
  yearMonth?: string,
  notes?: string
): Promise<{ status: number; message: string; data: { record: any; status: MaintenanceStatus } }> => {
  const response = await api.post(`/websites/${websiteId}/maintenance/complete`, {
    year_month: yearMonth,
    notes,
  });
  return response.data;
};

export const uncompleteWebsiteMaintenance = async (
  websiteId: number | string,
  yearMonth?: string
): Promise<{ status: number; message: string; data: { status: MaintenanceStatus } }> => {
  const response = await api.delete(`/websites/${websiteId}/maintenance/complete`, {
    params: yearMonth ? { year_month: yearMonth } : undefined,
  });
  return response.data;
};

export const getWebsiteMaintenanceHistory = async (
  websiteId: number | string
): Promise<{ status: number; data: MaintenanceHistoryItem[] }> => {
  const response = await api.get(`/websites/${websiteId}/maintenance/history`);
  return response.data;
};

export const getAvailableMaintenanceMonths = (): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${yyyy}-${mm}`;

    const monthName = formatMonthYear(value, 'long');
    const label = i === 0 ? `${monthName} (Mês Atual)` : monthName;

    options.push({ value, label });
  }

  return options;
};

export const syncAllIntegrityWebsites = async (): Promise<{
  status: number;
  message: string;
  data: { synced_count: number; failed_count: number; details: any[] };
}> => {
  const response = await api.post('/websites/sync-integrity');
  return response.data;
};

export interface ActivityLogItem {
  id: string; // 'maint_12' | 'note_5'
  item_type: 'maintenance' | 'note';
  title: string;
  category: string; // 'manutencao' | 'geral' | 'seguranca' | 'otimizacao' | 'servidor' | 'bugfix' | 'layout'
  content: string;
  action_date: string;
  user_id: number;
  user_name: string;
  user_email: string;
  year_month?: string;
  maintenance_id?: number;
  note_id?: number;
}

export interface CreateWebsiteNotePayload {
  title?: string;
  category?: string;
  content: string;
  action_date?: string;
}

export const getWebsiteActivityLogs = async (
  websiteId: number | string
): Promise<{ status: number; data: ActivityLogItem[] }> => {
  const response = await api.get(`/websites/${websiteId}/activity-logs`);
  return response.data;
};

export const createWebsiteNote = async (
  websiteId: number | string,
  payload: CreateWebsiteNotePayload
): Promise<{ status: number; message: string; data: any }> => {
  const response = await api.post(`/websites/${websiteId}/notes`, payload);
  return response.data;
};

export const updateWebsiteNote = async (
  websiteId: number | string,
  noteId: number,
  payload: Partial<CreateWebsiteNotePayload>
): Promise<{ status: number; message: string; data: any }> => {
  const response = await api.put(`/websites/${websiteId}/notes/${noteId}`, payload);
  return response.data;
};

export const deleteWebsiteNote = async (
  websiteId: number | string,
  noteId: number
): Promise<{ status: number; message: string }> => {
  const response = await api.delete(`/websites/${websiteId}/notes/${noteId}`);
  return response.data;
};

export const getPublicLogToken = async (
  websiteId: number | string
): Promise<{ status: number; data: { token: string; share_url: string } }> => {
  const response = await api.get(`/websites/${websiteId}/public-log-token`);
  return response.data;
};

export const regeneratePublicLogToken = async (
  websiteId: number | string
): Promise<{ status: number; message: string; data: { token: string; share_url: string } }> => {
  const response = await api.post(`/websites/${websiteId}/public-log-token/regenerate`);
  return response.data;
};

export interface PublicActivityLogsResponse {
  status: number;
  data: {
    website: {
      name: string;
      url: string;
      environment: string;
    };
    activities: ActivityLogItem[];
  };
}

export const getPublicActivityLogs = async (
  token: string
): Promise<PublicActivityLogsResponse> => {
  const response = await api.get(`/public/activity-logs/${token}`);
  return response.data;
};




