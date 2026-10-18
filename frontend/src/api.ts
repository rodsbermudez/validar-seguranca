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
  token_price_per_1k?: number;
  prompt_token_price_per_1k?: number;
  completion_token_price_per_1k?: number;
  has_api_key: boolean;
  available_models: AIModelOption[];
  asaas_api_key?: string;
  asaas_environment?: 'sandbox' | 'production';
  asaas_webhook_secret?: string;
  asaas_configured?: boolean;
  message?: string;
}

export const getSettings = async (): Promise<PlatformSettingsResponse> => {
  const response = await api.get<PlatformSettingsResponse>('/settings');
  return response.data;
};

export const updateSettings = async (
  aiModel?: string,
  tokenPricePer1k?: number,
  promptTokenPricePer1k?: number,
  completionTokenPricePer1k?: number,
  asaasApiKey?: string,
  asaasEnvironment?: 'sandbox' | 'production',
  asaasWebhookSecret?: string
): Promise<PlatformSettingsResponse> => {
  const payload: Record<string, any> = {};
  if (aiModel !== undefined) payload.ai_model = aiModel;
  if (tokenPricePer1k !== undefined) payload.token_price_per_1k = tokenPricePer1k;
  if (promptTokenPricePer1k !== undefined) payload.prompt_token_price_per_1k = promptTokenPricePer1k;
  if (completionTokenPricePer1k !== undefined) payload.completion_token_price_per_1k = completionTokenPricePer1k;
  if (asaasApiKey !== undefined) payload.asaas_api_key = asaasApiKey;
  if (asaasEnvironment !== undefined) payload.asaas_environment = asaasEnvironment;
  if (asaasWebhookSecret !== undefined) payload.asaas_webhook_secret = asaasWebhookSecret;
  const response = await api.post<PlatformSettingsResponse>('/settings', payload);
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
  own_websites?: number;
  shared_websites?: number;
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

export interface DashboardAiUsage {
  ai_enabled: number;
  monthly_token_limit: number | null;
  is_unlimited: boolean;
  current_month_tokens: number;
  percent_used: number;
  tokens_remaining: number | null;
  estimated_cost: number;
  token_price_per_1k: number;
}

export interface DashboardOverviewResponse {
  status: number;
  data: {
    year_month: string;
    year_month_label: string;
    metrics: DashboardMetrics;
    plan_details?: UserPlanDetails;
    ai_usage?: DashboardAiUsage;
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

export interface UserAiMetrics {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  avg_duration_ms: number;
  current_month_tokens: number;
  by_action: Array<{
    action_type: string;
    count: number;
    tokens: number;
  }>;
}

export interface UserAiSettings {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  is_active: number;
  ai_enabled: number;
  ai_monthly_token_limit: number | null;
  created_at?: string;
}

export interface AiUsageLogItem {
  id: number;
  user_id: number;
  website_id?: number | null;
  website_name?: string | null;
  website_url?: string | null;
  action_type: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  duration_ms: number;
  status: 'success' | 'error';
  error_message?: string | null;
  created_at: string;
}

export interface MonthlyAiHistoryItem {
  year_month: string;
  total_requests: number;
  successful_requests: number;
  failed_requests?: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  prompt_cost?: number;
  completion_cost?: number;
  estimated_cost: number;
}

export interface UserAiMetricsResponse {
  status: number;
  user: UserAiSettings;
  metrics: UserAiMetrics;
  token_price_per_1k: number;
  current_month_cost: number;
  total_cost: number;
  monthly_history: MonthlyAiHistoryItem[];
}

export interface UserAiLogsResponse {
  status: number;
  data: AiUsageLogItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export const getUserAiMetrics = async (userId: number): Promise<UserAiMetricsResponse> => {
  const response = await api.get<UserAiMetricsResponse>(`/users/${userId}/ai-metrics`);
  return response.data;
};

export const updateUserAiLimits = async (
  userId: number,
  payload: { ai_enabled?: boolean | number; ai_monthly_token_limit?: number | null }
): Promise<{ status: number; message: string; data: UserAiSettings }> => {
  const response = await api.put(`/users/${userId}/ai-limits`, payload);
  return response.data;
};

export const getUserAiLogs = async (
  userId: number,
  params?: { limit?: number; offset?: number }
): Promise<UserAiLogsResponse> => {
  const response = await api.get<UserAiLogsResponse>(`/users/${userId}/ai-logs`, { params });
  return response.data;
};

export interface GlobalAiMetricsResponse {
  status: number;
  selected_month: string;
  token_price_per_1k: number;
  prompt_token_price_per_1k: number;
  completion_token_price_per_1k: number;
  month_metrics: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    avg_duration_ms: number;
    prompt_cost?: number;
    completion_cost?: number;
    estimated_cost: number;
  };
  all_time_metrics: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    avg_duration_ms: number;
    prompt_cost?: number;
    completion_cost?: number;
    estimated_cost: number;
  };
  monthly_history: MonthlyAiHistoryItem[];
  by_action_month: Array<{
    action_type: string;
    count: number;
    tokens: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cost?: number;
    completion_cost?: number;
    estimated_cost: number;
  }>;
  by_action_all_time: Array<{
    action_type: string;
    count: number;
    tokens: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cost?: number;
    completion_cost?: number;
    estimated_cost: number;
  }>;
  users_summary: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    is_active: number;
    ai_enabled: number;
    ai_monthly_token_limit: number | null;
    month_tokens: number;
    prompt_tokens_month?: number;
    completion_tokens_month?: number;
    prompt_cost_month?: number;
    completion_cost_month?: number;
    all_time_tokens: number;
    total_requests: number;
    usage_percent: number | null;
    month_cost: number;
    all_time_cost: number;
  }>;
  websites_summary: Array<{
    id: number;
    name: string;
    url: string;
    owner_name: string;
    owner_email: string;
    month_tokens: number;
    month_requests: number;
    month_cost: number;
    all_time_tokens: number;
    all_time_requests: number;
    all_time_cost: number;
  }>;
}

export interface GlobalAiLogItem extends AiUsageLogItem {
  user_name?: string;
  user_email?: string;
  prompt_cost?: number;
  completion_cost?: number;
  estimated_cost: number;
}

export interface GlobalAiLogsResponse {
  status: number;
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  token_price_per_1k: number;
  prompt_token_price_per_1k?: number;
  completion_token_price_per_1k?: number;
  data: GlobalAiLogItem[];
}

export const getGlobalAiMetrics = async (month?: string): Promise<GlobalAiMetricsResponse> => {
  const response = await api.get<GlobalAiMetricsResponse>('/ai-monitoring/metrics', {
    params: month ? { month } : undefined,
  });
  return response.data;
};

export const getGlobalAiLogs = async (params?: {
  page?: number;
  limit?: number;
  user_id?: number;
  website_id?: number;
  status?: string;
  action_type?: string;
  month?: string;
  search?: string;
}): Promise<GlobalAiLogsResponse> => {
  const response = await api.get<GlobalAiLogsResponse>('/ai-monitoring/logs', { params });
  return response.data;
};

// ==========================================
// Plans & Packages Catalog & User Quotas API
// ==========================================

export interface Plan {
  id: number;
  name: string;
  slug: string;
  description?: string;
  max_websites: number | null; // null = Sites Ilimitados
  ai_monthly_tokens: number; // Teto estrito de tokens (sem ilimitado)
  price_monthly: number; // Valor da assinatura em R$
  is_active: number;
  is_default: number;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionInfo {
  id: number;
  plan_id: number;
  status: 'active' | 'canceled' | 'expired' | 'pending' | 'past_due';
  gateway: string;
  gateway_subscription_id?: string;
  payment_method?: string;
  billing_cycle: string;
  price: number;
  extra_websites: number;
  extra_websites_price: number;
  extra_ai_tokens: number;
  extra_ai_tokens_price: number;
  current_period_start?: string;
  current_period_end?: string;
  canceled_at?: string;
  created_at?: string;
  is_period_active: boolean;
  days_remaining: number;
  can_cancel: boolean;
  can_reactivate?: boolean;
}

export interface UserPlanDetails {
  user_id: number;
  user_name: string;
  user_email: string;
  is_admin: boolean;
  plan_id: number | null;
  plan?: Plan | null;
  plan_name: string;
  ai_enabled: number;
  base_max_websites: number | null;
  extra_websites: number;
  extra_websites_price: number;
  custom_max_websites: number | null;
  effective_max_websites: number | null;
  is_websites_unlimited: boolean;
  websites_count: number;
  shared_websites_count?: number;
  total_websites_managed?: number;
  websites_remaining: number | null;
  is_websites_limit_reached: boolean;
  base_ai_tokens: number;
  extra_ai_tokens: number;
  extra_ai_tokens_price: number;
  custom_ai_token_limit: number | null;
  effective_ai_token_limit: number;
  base_price: number;
  custom_price_monthly: number | null;
  total_monthly_price: number;
  subscription?: SubscriptionInfo | null;
  user_created_at?: string;
  user_cpf_cnpj?: string | null;
  user_phone?: string | null;
  is_subscription_active?: boolean;
  is_subscription_canceled?: boolean;
  is_subscription_expired?: boolean;
}

export interface UserPlanResponse {
  status: number;
  plan_details: UserPlanDetails;
  subscription?: SubscriptionInfo | null;
  available_plans: Plan[];
  websites: Array<{
    id: number;
    name: string;
    url: string;
    environment: string;
    is_connected: number;
    created_at?: string;
  }>;
  metrics: UserAiMetrics;
  month_stats: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    total_requests: number;
  };
  token_price_per_1k: number;
  prompt_token_price_per_1k: number;
  completion_token_price_per_1k: number;
  current_month_cost: number;
  total_cost: number;
  monthly_history: MonthlyAiHistoryItem[];
}

export interface UpdateUserPlanPayload {
  plan_id?: number | null | string;
  extra_websites?: number;
  extra_websites_price?: number;
  extra_ai_tokens?: number;
  extra_ai_tokens_price?: number;
  custom_price_monthly?: number | null | string;
  custom_max_websites?: number | null | string;
  custom_ai_token_limit?: number | null | string;
  ai_enabled?: boolean | number;
}

export const getPlans = async (): Promise<{ status: number; data: Plan[] }> => {
  const response = await api.get('/plans');
  return response.data;
};

export const createPlan = async (payload: Partial<Plan>): Promise<{ status: number; message: string; data: Plan }> => {
  const response = await api.post('/plans', payload);
  return response.data;
};

export const updatePlan = async (
  id: number,
  payload: Partial<Plan>
): Promise<{ status: number; message: string; data: Plan }> => {
  const response = await api.put(`/plans/${id}`, payload);
  return response.data;
};

export const deletePlan = async (id: number): Promise<{ status: number; message: string }> => {
  const response = await api.delete(`/plans/${id}`);
  return response.data;
};

export const getUserPlanDetails = async (userId: number): Promise<UserPlanResponse> => {
  const response = await api.get<UserPlanResponse>(`/users/${userId}/plan`);
  return response.data;
};

export const updateUserPlan = async (
  userId: number,
  payload: UpdateUserPlanPayload
): Promise<{ status: number; message: string; data: UserPlanDetails }> => {
  const response = await api.put(`/users/${userId}/plan`, payload);
  return response.data;
};

export const getPublicPlans = async (): Promise<{ status: number; data: Plan[] }> => {
  const response = await api.get<{ status: number; data: Plan[] }>('/public/plans');
  return response.data;
};

// ==========================================
// Checkout & Asaas Payments API
// ==========================================

export interface CreditCardPayload {
  holder_name: string;
  number: string;
  expiry_month: string;
  expiry_year: string;
  ccv: string;
  postal_code?: string;
  address_number?: string;
  cpf_cnpj?: string;
  phone?: string;
}

export interface CheckoutInitiatePayload {
  plan_id: number;
  name: string;
  email: string;
  cpf_cnpj: string;
  phone: string;
  password?: string;
  billing_type?: 'PIX' | 'CREDIT_CARD';
  credit_card?: CreditCardPayload;
  postal_code?: string;
  address_number?: string;
  extra_websites?: number;
  extra_websites_price?: number;
  extra_ai_tokens?: number;
  extra_ai_tokens_price?: number;
  is_new_signup?: boolean;
}

export interface CheckoutInitiateResponse {
  status: number;
  success: boolean;
  billing_type?: 'PIX' | 'CREDIT_CARD';
  activated?: boolean;
  transaction_id: number;
  subscription_id: number;
  gateway_transaction_id: string;
  amount: number;
  plan_name: string;
  pix_qr_code?: string;
  pix_copy_paste?: string;
  pix_expiration?: string;
  card_last4?: string;
  card_brand?: string;
  invoice_url: string | null;
  is_simulated: boolean;
  token?: string;
  user?: {
    id: number | string;
    name: string;
    email: string;
    role: string;
  };
}

export interface CheckoutStatusResponse {
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  activated: boolean;
  transaction_id: number;
  paid_at?: string;
}

export interface CheckEmailResponse {
  status: number;
  valid: boolean;
  exists: boolean;
  user_name?: string;
  message: string;
}

export const checkCheckoutEmail = async (email: string): Promise<CheckEmailResponse> => {
  const response = await api.post<CheckEmailResponse>('/public/checkout/check-email', { email });
  return response.data;
};

export const initiateCheckout = async (
  payload: CheckoutInitiatePayload
): Promise<CheckoutInitiateResponse> => {
  const response = await api.post<CheckoutInitiateResponse>('/public/checkout/initiate', payload);
  return response.data;
};

export const getCheckoutStatus = async (
  transactionIdOrGatewayId: string | number
): Promise<CheckoutStatusResponse> => {
  const response = await api.get<CheckoutStatusResponse>(
    `/public/checkout/status/${transactionIdOrGatewayId}`
  );
  return response.data;
};

export const simulateConfirmCheckout = async (
  transactionIdOrGatewayId: string | number
): Promise<{ status: number; message: string; activated: boolean }> => {
  const response = await api.post(
    `/public/checkout/simulate-confirm/${transactionIdOrGatewayId}`
  );
  return response.data;
};

export const getCurrentSubscription = async (): Promise<{
  status: number;
  subscription: SubscriptionInfo | null;
  plan_details: UserPlanDetails;
}> => {
  const response = await api.get('/subscriptions/current');
  return response.data;
};

export const cancelSubscription = async (
  userId?: number
): Promise<{
  status: number;
  success: boolean;
  message: string;
  subscription_id: number;
  current_period_end: string;
  formatted_end_date: string;
  days_remaining: number;
  canceled_at: string;
}> => {
  const response = await api.post('/subscriptions/cancel', userId ? { user_id: userId } : {});
  return response.data;
};

export interface SubscriptionChangePreview {
  status: number;
  current_plan_name: string;
  current_monthly: number;
  new_plan_name: string;
  new_monthly: number;
  difference: number;
  is_downgrade: boolean;
  days_remaining: number;
  next_due_date: string;
  next_due_date_formatted: string;
  prorated_amount: number;
  websites_count: number;
  new_effective_max_websites: number | null;
  is_capacity_blocked: boolean;
  excess_websites: number;
  billing_type: 'CREDIT_CARD' | 'PIX';
  card_last4?: string;
  card_brand?: string;
  has_active_subscription: boolean;
  gateway_subscription_id?: string;
}

export const previewSubscriptionChange = async (payload: {
  plan_id?: number;
  extra_websites?: number;
  extra_ai_packs?: number;
  extra_ai_tokens?: number;
  user_id?: number;
}): Promise<SubscriptionChangePreview> => {
  const response = await api.post('/subscriptions/preview-change', payload);
  return response.data;
};

export const upgradePlan = async (
  planId: number,
  userId?: number
): Promise<{
  status: number;
  success: boolean;
  message: string;
  has_active_subscription?: boolean;
  require_pix?: boolean;
  require_checkout?: boolean;
  payment_id?: string;
  prorated_amount?: number;
  pix_qr_code?: string;
  pix_copy_paste?: string;
  days_remaining?: number;
  next_due_date_formatted?: string;
  new_monthly?: number;
  new_plan_id?: number;
  paid?: boolean;
  plan_details?: UserPlanDetails;
}> => {
  const response = await api.post('/subscriptions/upgrade-plan', {
    plan_id: planId,
    ...(userId ? { user_id: userId } : {}),
  });
  return response.data;
};

export const upgradePlanWithOptions = async (payload: {
  plan_id: number;
  user_id?: number;
  billing_type?: 'PIX' | 'CREDIT_CARD';
  credit_card?: CreditCardPayload;
}): Promise<{
  status: number;
  success: boolean;
  message: string;
  require_pix?: boolean;
  require_checkout?: boolean;
  payment_id?: string;
  prorated_amount?: number;
  pix_qr_code?: string;
  pix_copy_paste?: string;
  days_remaining?: number;
  next_due_date_formatted?: string;
  new_monthly?: number;
  new_plan_id?: number;
  paid?: boolean;
  plan_details?: UserPlanDetails;
}> => {
  const response = await api.post('/subscriptions/upgrade-plan', payload);
  return response.data;
};

export const manageAddons = async (payload: {
  extra_websites: number;
  extra_ai_packs?: number;
  extra_ai_tokens?: number;
  user_id?: number;
  billing_type?: 'PIX' | 'CREDIT_CARD';
  credit_card?: CreditCardPayload;
}): Promise<{
  status: number;
  success: boolean;
  message: string;
  require_pix?: boolean;
  require_checkout?: boolean;
  payment_id?: string;
  prorated_amount?: number;
  pix_qr_code?: string;
  pix_copy_paste?: string;
  days_remaining?: number;
  next_due_date_formatted?: string;
  new_monthly?: number;
  extra_websites?: number;
  extra_ai_tokens?: number;
  paid?: boolean;
  plan_details?: UserPlanDetails;
}> => {
  const response = await api.post('/subscriptions/manage-addons', payload);
  return response.data;
};

export const confirmProratedPix = async (payload: {
  payment_id: string;
  plan_id?: number;
  extra_websites?: number;
  extra_ai_tokens?: number;
  user_id?: number;
}): Promise<{
  status: number;
  paid: boolean;
  success?: boolean;
  message: string;
  plan_details?: UserPlanDetails;
}> => {
  const response = await api.post('/subscriptions/confirm-prorated-pix', payload);
  return response.data;
};



