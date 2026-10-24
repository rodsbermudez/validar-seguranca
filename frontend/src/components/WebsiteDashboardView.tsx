import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Paper,
  Title,
  Text,
  Button,
  Group,
  Badge,
  Tabs,
  Card,
  Grid,
  ThemeIcon,
  Stack,
  Alert,
  Code,
  Box,
  TextInput,
  Select,
  RingProgress,
  Progress,
  Loader,
  Center,
  Table,
  Modal,
  ActionIcon,
  Tooltip,
  NumberInput,
  Textarea,
  Menu,
} from '@mantine/core';
import {
  IconPlugConnected,
  IconPlugConnectedX,
  IconRadar,
  IconTerminal,
  IconDownload,
  IconSettings,
  IconCheck,
  IconCopy,
  IconAlertCircle,
  IconRefresh,
  IconTrash,
  IconFileCheck,
  IconLayoutDashboard,
  IconFileText,
  IconUsers,
  IconUserPlus,
  IconUserX,
  IconDoorExit,
  IconMail,
  IconCalendarCheck,
  IconHistory,
  IconRotateClockwise,
  IconTools,
  IconChevronDown,
  IconNotes,
  IconAlertTriangle,
  IconDatabase,
  IconCpu,
  IconServer,
  IconActivity,
} from '@tabler/icons-react';
import {
  api,
  getWebsiteShares,
  addWebsiteShare,
  removeWebsiteShare,
  WebsiteShareMember,
  Website,
  MaintenanceStatus,
  MaintenanceHistoryItem,
  completeWebsiteMaintenance,
  uncompleteWebsiteMaintenance,
  getWebsiteMaintenanceHistory,
  getAvailableMaintenanceMonths,
  getUserPlanDetails,
  getDiagnosticSummary,
  DiagnosticSummaryResponse,
  getWebsite,
  disconnectWebsiteAgent,
  reconnectWebsiteAgent,
} from '../api';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { ScanReport } from './ScanReport';
import { WebsiteLogsView } from './WebsiteLogsView';
import { WebsiteUpdatesView, UpdatesSummary, UpdatesData } from './WebsiteUpdatesView';
import { WebsiteIntegrityView } from './WebsiteIntegrityView';
import { WebsiteDiagnosticReportView } from './WebsiteDiagnosticReportView';
import { WebsiteActivityLogsView } from './WebsiteActivityLogsView';
import { formatDateOnly, formatDateTime, formatMonthYear } from '../utils/date';

interface WebsiteDashboardViewProps {
  website: Website;
  onBack: () => void;
  onUpdateWebsite?: (updatedSite: Website) => void;
  onDeleteWebsite?: (siteId: string | number) => void;
  onNavigateToPlans?: () => void;
  initialTab?: string;
  onTabChange?: (tab: string) => void;
}

export const WebsiteDashboardView: React.FC<WebsiteDashboardViewProps> = ({
  website,
  onBack,
  onUpdateWebsite,
  onDeleteWebsite,
  onNavigateToPlans,
  initialTab,
  onTabChange,
}) => {
  const [activeTab, setActiveTab] = useState<string | null>(initialTab || 'overview');
  const [viewingDiagnostic, setViewingDiagnostic] = useState<boolean>(false);
  const [downloading, setDownloading] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [toolsEnabled, setToolsEnabled] = useState<boolean>(true);

  useEffect(() => {
    const checkTools = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;
        const u = JSON.parse(storedUser);
        if (u.role === 'admin') {
          setToolsEnabled(true);
          return;
        }
        const res = await getUserPlanDetails(u.id);
        if (res?.plan_details) {
          setToolsEnabled(res.plan_details.tools_enabled !== 0);
        }
      } catch (err) {
        // default true
      }
    };
    checkTools();
  }, []);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (activeTab && onTabChange) {
      onTabChange(activeTab);
    }
  }, [activeTab, onTabChange]);

  // Website local state to support seamless background updates without page reload
  const [currentWebsite, setCurrentWebsite] = useState<Website>(website);

  useEffect(() => {
    setCurrentWebsite(website);
    setName(website.name);
    setUrl(website.url);
    setEnvironment(website.environment || 'production');
    setMaintenanceDay(website.maintenance_day || '');
    setMaintenanceStatus(website.maintenance || (website as any).maintenance_status || null);
  }, [website]);

  const isConnected = Number(currentWebsite.is_connected) === 1;

  // Latest Audit State
  const [latestScan, setLatestScan] = useState<any | null>(null);
  const [scanHistoryLoading, setScanHistoryLoading] = useState(false);

  // Settings Form State
  const [name, setName] = useState(website.name);
  const [url, setUrl] = useState(website.url);
  const [environment, setEnvironment] = useState(website.environment || 'production');
  const [maintenanceDay, setMaintenanceDay] = useState<number | string>(website.maintenance_day || '');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Maintenance Cycle State
  const maintenanceMonthOptions = getAvailableMaintenanceMonths();
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(
    website.maintenance || (website as any).maintenance_status || null
  );
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [selectedMaintenanceMonth, setSelectedMaintenanceMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Agent Connection & Kill Switch State
  const [disconnecting, setDisconnecting] = useState<boolean>(false);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [killModalOpen, setKillModalOpen] = useState<boolean>(false);
  const [feedbackAlert, setFeedbackAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setFeedbackAlert(null);
    try {
      const res = await disconnectWebsiteAgent(website.id);
      if (res.success) {
        setKillModalOpen(false);
        setFeedbackAlert({
          type: 'success',
          message: res.message || 'Serviço do site desligado com sucesso. Todas as requisições ao agente foram interrompidas.',
        });
        const updated = res.data || { ...currentWebsite, is_connected: 0 };
        setCurrentWebsite(updated);
        if (onUpdateWebsite) {
          onUpdateWebsite(updated);
        }
      } else {
        setFeedbackAlert({
          type: 'error',
          message: res.message || 'Falha ao desligar serviço do site.',
        });
      }
    } catch (err: any) {
      setFeedbackAlert({
        type: 'error',
        message:
          err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao desligar serviço do website.',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const renderFormattedAlertMessage = (rawMessage: string) => {
    if (!rawMessage) return null;
    const cleaned = rawMessage.replace(/\s*\(HTTP\s*\d+\)/gi, '');
    const parts = cleaned.split(/(vexors\.app\s*-\s*Diagnóstico)/gi);
    return (
      <span>
        {parts.map((part, index) =>
          /vexors\.app\s*-\s*Diagnóstico/i.test(part) ? (
            <strong key={index}>{part}</strong>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const handleReconnect = async () => {
    setReconnecting(true);
    setFeedbackAlert(null);
    try {
      const res = await reconnectWebsiteAgent(website.id);
      if (res.success) {
        setFeedbackAlert({
          type: 'success',
          message: res.message || 'Agente WordPress reconectado com sucesso!',
        });
        const updated = res.data || { ...currentWebsite, is_connected: 1, connected_at: new Date().toISOString() };
        setCurrentWebsite(updated);
        if (onUpdateWebsite) {
          onUpdateWebsite(updated);
        }
        await fetchDiagnosticData(false);
        await fetchLatestScan(false);
      } else {
        setFeedbackAlert({
          type: 'error',
          message: res.message || 'Não foi possível reconectar com o agente WordPress.',
        });
      }
    } catch (err: any) {
      setFeedbackAlert({
        type: 'error',
        message:
          err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Falha na comunicação ao tentar reconectar o agente. Verifique se o plugin está ativo no WordPress.',
      });
    } finally {
      setReconnecting(false);
    }
  };

  const fetchLatestScan = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setScanHistoryLoading(true);
    }
    try {
      const res = await api.get(`/scan/history/${website.id}`);
      const historyData = res.data?.data || [];
      const latestCompleted = historyData.find(
        (item: any) => item.status === 'completed' && item.scan_results
      );
      if (latestCompleted) {
        setLatestScan(latestCompleted.scan_results);
      } else if (historyData.length === 0) {
        setLatestScan(null);
      }
    } catch (e) {
      // Silently catch background error
    } finally {
      if (showLoading) {
        setScanHistoryLoading(false);
      }
    }
  }, [website.id]);

  useEffect(() => {
    fetchLatestScan(true);
  }, [fetchLatestScan]);

  // Live diagnostic summary for the 4 tool cards
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticSummaryResponse['data'] | null>(null);
  const isFetchingDiagnosticRef = useRef<boolean>(false);

  const fetchDiagnosticData = useCallback(async (force = false) => {
    if (isFetchingDiagnosticRef.current) return;
    isFetchingDiagnosticRef.current = true;
    try {
      const res = await getDiagnosticSummary(website.id, force);
      if (res?.data) {
        setDiagnosticData(res.data);
      }
    } catch (e) {
      // Fallback silently to DB data in website prop
    } finally {
      isFetchingDiagnosticRef.current = false;
    }
  }, [website.id]);

  useEffect(() => {
    if (isConnected) {
      fetchDiagnosticData(false);
    }
  }, [isConnected, fetchDiagnosticData]);

  const onUpdateWebsiteRef = useRef(onUpdateWebsite);
  useEffect(() => {
    onUpdateWebsiteRef.current = onUpdateWebsite;
  }, [onUpdateWebsite]);

  const refreshWebsite = useCallback(async () => {
    try {
      const freshSite = await getWebsite(website.id);
      if (freshSite) {
        setCurrentWebsite((prev) => {
          const wasConnected = Number(prev.is_connected) === 1;
          const isNowConnected = Number(freshSite.is_connected) === 1;
          if (!wasConnected && isNowConnected) {
            // Agente conectou!
            fetchDiagnosticData(false);
            fetchLatestScan(false);
          }
          return freshSite;
        });
        const mStatus = freshSite.maintenance || (freshSite as any).maintenance_status || null;
        if (mStatus) {
          setMaintenanceStatus(mStatus);
        }
        if (onUpdateWebsiteRef.current) {
          onUpdateWebsiteRef.current(freshSite);
        }
      }
    } catch (e) {
      // Silently catch background error
    }
  }, [website.id, fetchDiagnosticData, fetchLatestScan]);

  const handleUpdatesChanged = useCallback((newSummary?: UpdatesSummary, fullData?: UpdatesData) => {
    if (newSummary) {
      setDiagnosticData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          updates: fullData || {
            summary: newSummary,
            core: prev.updates?.core || { current_version: '', new_version: '', has_update: false },
            plugins: prev.updates?.plugins || [],
            themes: prev.updates?.themes || [],
          },
        };
      });
      setCurrentWebsite((prev) => ({
        ...prev,
        updates_pending_count: newSummary.total_pending,
        last_updates_checked_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      }));
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchLatestScan(false);
      refreshWebsite();
    }
  }, [activeTab, fetchLatestScan, refreshWebsite]);

  // Revalidação em Tempo Real (Smart Polling + Focus Sync) do SaaS
  // Polling é 100% passivo: consulta apenas o banco MySQL local do SaaS (refreshWebsite e fetchLatestScan)
  useRealtimeSync({
    onSync: async () => {
      await refreshWebsite();
      if (activeTab === 'overview') {
        await fetchLatestScan(false);
      }
    },
    // Se estiver aguardando conexão do agente, checa status no banco a cada 8s
    // Se já estiver conectado, revalidação local a cada 60s
    interval: isConnected ? 60000 : 8000,
    revalidateOnFocus: true,
    enabled: true,
  });

  const fetchMaintenanceHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getWebsiteMaintenanceHistory(website.id);
      setMaintenanceHistory(res.data || []);
      setHistoryModalOpen(true);
    } catch (e) {
      console.error('Erro ao buscar histórico de manutenções:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCompleteMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const res = await completeWebsiteMaintenance(website.id, selectedMaintenanceMonth, maintenanceNotes);
      setMaintenanceStatus(res.data.status);
      setCompleteModalOpen(false);
      setMaintenanceNotes('');
      if (onUpdateWebsite) {
        onUpdateWebsite({ ...currentWebsite, maintenance: res.data.status, maintenance_status: res.data.status });
      }
      refreshWebsite();
    } catch (err: any) {
      alert(
        err.response?.data?.messages?.error ||
        err.response?.data?.message ||
        'Erro ao registrar manutenção.'
      );
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleUncompleteMaintenance = async () => {
    if (!confirm('Deseja realmente reabrir a manutenção deste mês?')) return;
    setMaintenanceLoading(true);
    try {
      const res = await uncompleteWebsiteMaintenance(website.id);
      setMaintenanceStatus(res.data.status);
      if (onUpdateWebsite) {
        onUpdateWebsite({ ...currentWebsite, maintenance: res.data.status, maintenance_status: res.data.status });
      }
      refreshWebsite();
    } catch (err: any) {
      alert(
        err.response?.data?.messages?.error ||
        err.response?.data?.message ||
        'Erro ao reabrir manutenção.'
      );
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'emerald';
    if (score >= 75) return 'oceanBlue';
    if (score >= 60) return 'royalGold';
    if (score >= 40) return 'honeyBronze';
    return 'amaranth';
  };

  const handleDownloadPlugin = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/websites/${website.id}/download-plugin`, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      const siteHost = website.url
        ? website.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
        : website.name.replace(/\s+/g, '-').toLowerCase();
      const siteSlug = siteHost.replace(/[^a-zA-Z0-9_\-]/g, '-');
      link.setAttribute('download', `vexors-diagnostico-${siteSlug}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert('Erro ao baixar o plugin agente do WordPress.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyToken = () => {
    if (website.agent_token) {
      navigator.clipboard.writeText(website.agent_token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 3000);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    let formattedUrl = url.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    formattedUrl = formattedUrl.replace(/\/+$/, '');

    const isUrlModified = formattedUrl !== website.url.replace(/\/+$/, '');

    const payload = {
      name: name.trim(),
      url: formattedUrl,
      environment,
      maintenance_day: maintenanceDay === '' || maintenanceDay === null ? null : Number(maintenanceDay),
    };

    try {
      const response = await api.put(`/websites/${website.id}`, payload);
      const updated = response.data?.data || { ...website, ...payload };
      if (isUrlModified) {
        setFormSuccess(
          'Website atualizado com sucesso! Como a URL foi modificada, baixe novamente o plugin agente na aba Visão Geral e reinstale no WordPress para restabelecer a comunicação segura.'
        );
      } else {
        setFormSuccess('Dados do website atualizados com sucesso!');
      }
      if (onUpdateWebsite) {
        onUpdateWebsite(updated);
      }
      setTimeout(() => setFormSuccess(null), 8000);
    } catch (err: any) {
      setFormError(
        err.response?.data?.messages?.error ||
          err.response?.data?.error ||
          'Erro ao salvar alterações do website.'
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Deseja realmente excluir o website "${website.name}"?`)) return;
    try {
      await api.delete(`/websites/${website.id}`);
      if (onDeleteWebsite) {
        onDeleteWebsite(website.id);
      }
      onBack();
    } catch (err) {
      alert('Erro ao excluir website.');
    }
  };

  // Sharing & Members State
  const [shares, setShares] = useState<WebsiteShareMember[]>([]);
  const [ownerInfo, setOwnerInfo] = useState<{ id: number; name: string; email: string } | null>(
    website.owner_name ? { id: 0, name: website.owner_name, email: website.owner_email || '' } : null
  );
  const [isSiteOwner, setIsSiteOwner] = useState<boolean>(
    website.is_owner === undefined || website.is_owner === true || website.is_owner === 1
  );
  const [sharesLoading, setSharesLoading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    setSharesLoading(true);
    try {
      const res = await getWebsiteShares(website.id);
      if (res && res.data) {
        setShares(res.data.shares || []);
        setOwnerInfo(res.data.owner || null);
        if (typeof res.data.is_owner === 'boolean') {
          setIsSiteOwner(res.data.is_owner);
        }
      }
    } catch (e) {
      console.error('Erro ao buscar compartilhamentos:', e);
    } finally {
      setSharesLoading(false);
    }
  }, [website.id]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await addWebsiteShare(website.id, inviteEmail.trim(), inviteRole);
      setInviteSuccess(res.message || 'Usuário adicionado com sucesso!');
      setInviteEmail('');
      fetchShares();
      setTimeout(() => {
        setShareModalOpen(false);
        setInviteSuccess(null);
      }, 1500);
    } catch (err: any) {
      setInviteError(
        err.response?.data?.messages?.error ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Erro ao compartilhar website.'
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveShare = async (userId: number, memberName: string) => {
    if (!confirm(`Deseja revogar o acesso de "${memberName}" a este website?`)) {
      return;
    }
    try {
      await removeWebsiteShare(website.id, userId);
      fetchShares();
    } catch (err: any) {
      alert(err.response?.data?.messages?.error || err.response?.data?.message || 'Erro ao revogar acesso.');
    }
  };

  const handleLeaveWebsite = async () => {
    if (!confirm('Deseja realmente sair do monitoramento deste website? Você perderá o acesso até ser convidado novamente.')) {
      return;
    }
    try {
      const userJson = localStorage.getItem('user');
      const currentUser = userJson ? JSON.parse(userJson) : null;
      if (currentUser?.id) {
        await removeWebsiteShare(website.id, currentUser.id);
        onBack();
      }
    } catch (err: any) {
      alert(err.response?.data?.messages?.error || err.response?.data?.message || 'Erro ao sair do website.');
    }
  };

  const handleWebsiteUpdatedFromDiagnostic = useCallback(
    (updated: any) => {
      setCurrentWebsite((prev) => ({ ...prev, ...updated }));
      if (onUpdateWebsite) {
        onUpdateWebsite(updated);
      }
    },
    [onUpdateWebsite]
  );

  if (viewingDiagnostic) {
    return (
      <WebsiteDiagnosticReportView
        website={currentWebsite}
        onBack={() => setViewingDiagnostic(false)}
        onWebsiteUpdated={handleWebsiteUpdatedFromDiagnostic}
      />
    );
  }

  // Version comparison helper: returns true if current is older than target (e.g. 1.0.5 < 1.0.6)
  const isVersionOlder = (current?: string | null, target?: string | null) => {
    if (!current || !target) return false;
    if (current === target) return false;
    const cParts = current.split('.').map((n) => parseInt(n, 10) || 0);
    const tParts = target.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(cParts.length, tParts.length); i++) {
      const c = cParts[i] || 0;
      const t = tParts[i] || 0;
      if (c < t) return true;
      if (c > t) return false;
    }
    return false;
  };

  const agentPluginFromUpdates = diagnosticData?.updates?.plugins?.find(
    (p) => p.is_protected || (p.file && (p.file.includes('vexors') || p.file.includes('validar-seguranca')))
  );

  const currentAgentVersion =
    diagnosticData?.agent_status?.current_version ||
    diagnosticData?.updates?.server_environment?.agent_version ||
    agentPluginFromUpdates?.current_version ||
    currentWebsite?.agent_version ||
    website.agent_version ||
    null;

  const latestAgentVersion =
    diagnosticData?.agent_status?.latest_version ||
    currentWebsite?.latest_agent_version ||
    website.latest_agent_version ||
    '1.0.6';

  const isAgentOutdated = Boolean(
    diagnosticData?.agent_status?.is_outdated ??
    currentWebsite?.is_agent_outdated ??
    website.is_agent_outdated ??
    (currentAgentVersion ? isVersionOlder(currentAgentVersion, latestAgentVersion) : false)
  );

  return (
    <Stack gap="md">
      {/* Top Banner Header */}
      <Paper p="md" radius="md" bg="dark.7" withBorder style={{ borderLeft: '4px solid #1A7F86' }}>
        <Group justify="space-between" align="center">
          <Group gap="md">
            <div>
              <Group gap="xs" align="center">
                <Title order={3}>{website.name}</Title>
                <Badge
                  color={
                    website.environment === 'production'
                      ? 'red'
                      : website.environment === 'staging'
                      ? 'orange'
                      : 'teal'
                  }
                  variant="light"
                  size="sm"
                >
                  {(website.environment || 'production').toUpperCase()}
                </Badge>
                {!isSiteOwner && (
                  <Badge color="violet" variant="outline" size="sm" leftSection={<IconUsers size={12} />}>
                    COMPARTILHADO
                  </Badge>
                )}
              </Group>
              <Text
                size="sm"
                c="blue.4"
                component="a"
                href={website.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {website.url}
              </Text>
            </div>
          </Group>

          <Group gap="sm">
            {isConnected ? (
              <Badge
                size="lg"
                color="green"
                variant="filled"
                leftSection={<IconPlugConnected size={16} />}
              >
                AGENTE CONECTADO
              </Badge>
            ) : (
              <Badge
                size="lg"
                color="red"
                variant="filled"
                leftSection={<IconPlugConnectedX size={16} />}
              >
                AGENTE DESCONECTADO
              </Badge>
            )}

            {isConnected && isAgentOutdated && (
              <Tooltip
                label={`O plugin agente no WordPress está na versão ${currentAgentVersion || 'legada'}, e a versão ${latestAgentVersion} está disponível. Clique para baixar o plugin atualizado.`}
                withArrow
                multiline
                w={280}
              >
                <Badge
                  size="lg"
                  color="yellow"
                  variant="filled"
                  leftSection={<IconAlertTriangle size={16} />}
                  rightSection={<IconDownload size={14} />}
                  style={{ cursor: 'pointer' }}
                  onClick={handleDownloadPlugin}
                >
                  {downloading ? 'BAIXANDO...' : `PLUGIN DESATUALIZADO (v${currentAgentVersion || '?'} → v${latestAgentVersion})`}
                </Badge>
              </Tooltip>
            )}

            {isConnected ? (
              <Button
                variant="light"
                color="red"
                size="sm"
                leftSection={<IconPlugConnectedX size={16} />}
                onClick={() => setKillModalOpen(true)}
              >
                Desligar Serviço
              </Button>
            ) : (
              <Button
                variant="filled"
                color="teal"
                size="sm"
                leftSection={<IconPlugConnected size={16} />}
                loading={reconnecting}
                onClick={handleReconnect}
              >
                Conectar Agente
              </Button>
            )}

            {/* Menu Dropdown Ferramentas */}
            <Menu shadow="md" width={240} position="bottom-end" returnFocus={false}>
              <Menu.Target>
                <Button
                  variant="filled"
                  color="indigo"
                  size="sm"
                  leftSection={<IconTools size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                >
                  Ferramentas
                </Button>
              </Menu.Target>

              <Menu.Dropdown bg="dark.8">
                <Menu.Label c="dimmed">Navegação</Menu.Label>
                <Menu.Item
                  leftSection={<IconLayoutDashboard size={16} />}
                  onClick={() => setActiveTab('overview')}
                  bg={activeTab === 'overview' ? 'dark.6' : undefined}
                >
                  Visão Geral
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconRadar size={16} />}
                  onClick={() => setActiveTab('audit')}
                  bg={activeTab === 'audit' ? 'dark.6' : undefined}
                >
                  Auditoria & Segurança
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFileCheck size={16} />}
                  onClick={() => setActiveTab('integrity')}
                  bg={activeTab === 'integrity' ? 'dark.6' : undefined}
                >
                  Integridade do Core
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconNotes size={16} />}
                  onClick={() => setActiveTab('activity_logs')}
                  bg={activeTab === 'activity_logs' ? 'dark.6' : undefined}
                >
                  Logs de Atividades
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTerminal size={16} />}
                  onClick={() => setActiveTab('logs')}
                  bg={activeTab === 'logs' ? 'dark.6' : undefined}
                >
                  Logs em Tempo Real
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => setActiveTab('updates')}
                  bg={activeTab === 'updates' ? 'dark.6' : undefined}
                >
                  Atualizações
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconPlugConnected size={16} />}
                  onClick={() => setActiveTab('agent')}
                  bg={activeTab === 'agent' ? 'dark.6' : undefined}
                >
                  Agente WordPress
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconSettings size={16} />}
                  onClick={() => setActiveTab('settings')}
                  bg={activeTab === 'settings' ? 'dark.6' : undefined}
                >
                  Configurações
                </Menu.Item>

                <Menu.Divider />

                <Menu.Label c="dimmed">Ações & Relatórios</Menu.Label>
                <Menu.Item
                  leftSection={<IconFileText size={16} color="#1A7F86" />}
                  onClick={() => setViewingDiagnostic(true)}
                >
                  Relatório Diagnóstico
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconDownload size={16} color="#06d6a0" />}
                  onClick={handleDownloadPlugin}
                  disabled={downloading}
                >
                  Baixar Plugin WP
                </Menu.Item>
                {isConnected ? (
                  <Menu.Item
                    leftSection={<IconPlugConnectedX size={16} color="#fa5252" />}
                    color="red"
                    onClick={() => setKillModalOpen(true)}
                  >
                    Desligar Serviço (Kill Switch)
                  </Menu.Item>
                ) : (
                  <Menu.Item
                    leftSection={<IconPlugConnected size={16} color="#12b886" />}
                    onClick={handleReconnect}
                    disabled={reconnecting}
                  >
                    Conectar Agente
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Paper>

      {/* Main Tabs Navigation (sem Tabs.List para manter layout limpo) */}
      <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>

        {/* Tab 1: Overview */}
        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            {/* Feedback alert (Reconnect / Kill Switch result) */}
            {feedbackAlert && (
              <Alert
                color={feedbackAlert.type === 'success' ? 'green' : 'red'}
                title={feedbackAlert.type === 'success' ? 'Sucesso' : 'Atenção'}
                withCloseButton
                onClose={() => setFeedbackAlert(null)}
                icon={feedbackAlert.type === 'success' ? <IconCheck size={18} /> : <IconAlertCircle size={18} />}
              >
                {renderFormattedAlertMessage(feedbackAlert.message)}
              </Alert>
            )}

            {/* Prominent banner if agent is disconnected */}
            {!isConnected && (
              <Alert
                icon={<IconPlugConnectedX size={22} />}
                title="Agente WordPress Desconectado"
                color="red"
                variant="light"
                radius="md"
              >
                <Group justify="space-between" align="center" wrap="wrap" gap="md">
                  <Box style={{ maxWidth: 700 }}>
                    <Text size="sm">
                      A comunicação com o agente deste site está desativada. Todas as requisições automáticas e consultas externas foram suspensas para garantir a estabilidade do servidor.
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>
                      Para restabelecer o monitoramento em tempo real, verifique se o plugin <strong>vexors.app - Diagnóstico</strong> está ativo no seu WordPress e clique em <strong>Conectar Agente</strong>.
                    </Text>
                  </Box>
                  <Group gap="xs">
                    <Button
                      color="teal"
                      size="sm"
                      leftSection={<IconPlugConnected size={16} />}
                      loading={reconnecting}
                      onClick={handleReconnect}
                    >
                      Conectar Agente
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      leftSection={<IconDownload size={16} />}
                      loading={downloading}
                      onClick={handleDownloadPlugin}
                    >
                      Baixar Plugin WP
                    </Button>
                  </Group>
                </Group>
              </Alert>
            )}
            {/* Card do Resumo da Última Auditoria */}
            <Paper p="lg" radius="md" bg="dark.8" withBorder>
              <Group justify="space-between" mb="sm">
                <Group gap="xs">
                  <ThemeIcon color="indigo" variant="light" radius="xl">
                    <IconRadar size={18} />
                  </ThemeIcon>
                  <Title order={4}>Resumo da Última Auditoria</Title>
                </Group>
                {latestScan && (
                  <Badge color="gray" variant="light">
                    Realizada em: {formatDateTime(latestScan.scanned_at, 'Data N/D')}
                  </Badge>
                )}
              </Group>

              {scanHistoryLoading ? (
                <Center p="md">
                  <Loader size="sm" color="indigo" />
                </Center>
              ) : latestScan ? (
                <Grid align="center" mt="xs">
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Group justify="center">
                      <RingProgress
                        size={140}
                        thickness={12}
                        roundCaps
                        sections={[{ value: latestScan.score, color: getScoreColor(latestScan.score) }]}
                        label={
                          <Stack align="center" gap={0}>
                            <Text ta="center" fz={28} fw={800} lh={1}>
                              {latestScan.score}
                            </Text>
                            <Text ta="center" size="xs" c="dimmed" fw={700}>
                              GRADE {latestScan.grade}
                            </Text>
                          </Stack>
                        }
                      />
                    </Group>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, md: 8 }}>
                    <Stack gap="xs">
                      <Group gap="md" style={{ width: '100%' }}>
                        <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}>
                          <Text size="xs" c="dimmed" fw={600} ta="center">Checagens</Text>
                          <Text fw={800} fz={20} ta="center">{latestScan.summary?.total_checks ?? 0}</Text>
                        </Paper>

                        <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}>
                          <Text size="xs" c="green.4" fw={600} ta="center">Aprovados</Text>
                          <Text fw={800} fz={20} c="green.4" ta="center">{latestScan.summary?.passed ?? 0}</Text>
                        </Paper>

                        <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}>
                          <Text size="xs" c="red.4" fw={600} ta="center">Falhas Críticas</Text>
                          <Text fw={800} fz={20} c="red.4" ta="center">{latestScan.summary?.failed ?? 0}</Text>
                        </Paper>

                        <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}>
                          <Text size="xs" c="yellow.4" fw={600} ta="center">Alertas</Text>
                          <Text fw={800} fz={20} c="yellow.4" ta="center">{latestScan.summary?.warnings ?? 0}</Text>
                        </Paper>
                      </Group>

                      <Group justify="flex-end" mt="xs">
                        <Button
                          variant="light"
                          color="indigo"
                          size="xs"
                          leftSection={<IconRadar size={14} />}
                          onClick={() => setActiveTab('audit')}
                        >
                          Ver Detalhes / Iniciar Varredura
                        </Button>
                      </Group>
                    </Stack>
                  </Grid.Col>
                </Grid>
              ) : (
                <Box p="md" bg="dark.7" style={{ borderRadius: 8 }} ta="center">
                  <Text size="sm" c="dimmed" mb="xs">Nenhuma auditoria executada para este site ainda.</Text>
                  <Button
                    color="indigo"
                    size="xs"
                    leftSection={<IconRadar size={14} />}
                    onClick={() => setActiveTab('audit')}
                  >
                    Executar Primeira Auditoria Agora
                  </Button>
                </Box>
              )}
            </Paper>

            {/* Card do Ciclo de Manutenção Preventiva do Mês */}
            {(() => {
              const activeSite = currentWebsite || website;
              const isMaintenanceCompleted = maintenanceStatus?.status === 'completed';

              return (
                <Paper
                  p="lg"
                  radius="md"
                  bg={isMaintenanceCompleted ? 'rgba(6, 214, 160, 0.04)' : 'dark.8'}
                  withBorder
                  style={{
                    borderLeft: isMaintenanceCompleted
                      ? '4px solid #06d6a0'
                      : maintenanceStatus?.status === 'overdue'
                      ? '4px solid #fa5252'
                      : maintenanceStatus?.status === 'today'
                      ? '4px solid #fab005'
                      : '4px solid #228be6',
                    borderColor: isMaintenanceCompleted ? 'rgba(6, 214, 160, 0.3)' : undefined,
                  }}
                >
                  <Group justify="space-between" mb="sm" wrap="wrap" gap="md">
                    <Group gap="xs">
                      <ThemeIcon
                        color={isMaintenanceCompleted ? 'teal' : 'blue'}
                        variant={isMaintenanceCompleted ? 'filled' : 'light'}
                        radius="xl"
                        size="md"
                      >
                        {isMaintenanceCompleted ? <IconCheck size={18} /> : <IconCalendarCheck size={18} />}
                      </ThemeIcon>
                      <div>
                        <Group gap="xs" align="center">
                          <Title order={4}>Ciclo de Manutenção Preventiva</Title>
                          {isMaintenanceCompleted ? (
                            <Badge color="teal" variant="filled" size="sm" leftSection={<IconCheck size={12} />}>
                              CONCLUÍDA EM {formatMonthYear(new Date()).toUpperCase()}
                            </Badge>
                          ) : (
                            <Badge color="blue" variant="light" size="sm">
                              {formatMonthYear(new Date()).toUpperCase()}
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c={isMaintenanceCompleted ? 'teal.3' : 'dimmed'}>
                          {isMaintenanceCompleted
                            ? 'A manutenção preventiva deste mês já foi executada e registrada com sucesso.'
                            : 'Acompanhamento da rotina mensal de atualizações, integridade e testes do site.'}
                        </Text>
                      </div>
                    </Group>

                    <Group gap="xs">
                      <Button
                        variant="subtle"
                        color="gray"
                        size="xs"
                        leftSection={<IconHistory size={14} />}
                        onClick={fetchMaintenanceHistory}
                        loading={historyLoading}
                      >
                        Histórico Anterior
                      </Button>

                      <Button
                        variant="light"
                        color="indigo"
                        size="xs"
                        leftSection={<IconNotes size={14} />}
                        onClick={() => setActiveTab('activity_logs')}
                      >
                        Diário & Anotações
                      </Button>

                      {isMaintenanceCompleted ? (
                        <Button
                          variant="subtle"
                          color="orange"
                          size="xs"
                          leftSection={<IconRotateClockwise size={14} />}
                          loading={maintenanceLoading}
                          onClick={handleUncompleteMaintenance}
                        >
                          Reabrir Manutenção
                        </Button>
                      ) : (
                        <Button
                          variant="filled"
                          color="teal"
                          size="xs"
                          leftSection={<IconCheck size={14} />}
                          loading={maintenanceLoading}
                          onClick={() => {
                            setMaintenanceNotes('');
                            setCompleteModalOpen(true);
                          }}
                        >
                          Marcar Concluída este Mês
                        </Button>
                      )}
                    </Group>
                  </Group>

                  {isMaintenanceCompleted ? (
                    <Grid align="stretch" mt="xs">
                      <Grid.Col span={{ base: 12, md: 7 }}>
                        <Paper
                          p="sm"
                          radius="md"
                          bg="rgba(6, 214, 160, 0.08)"
                          withBorder
                          style={{ borderColor: 'rgba(6, 214, 160, 0.25)', height: '100%' }}
                        >
                          <Group gap="sm" align="flex-start" wrap="nowrap">
                            <ThemeIcon color="teal" variant="light" size="md" radius="xl" mt={2}>
                              <IconCheck size={16} />
                            </ThemeIcon>
                            <div style={{ flex: 1 }}>
                              <Group justify="space-between" align="center" wrap="wrap">
                                <Text size="sm" fw={700} c="teal.3">
                                  Manutenção Preventiva Realizada!
                                </Text>
                                <Badge color="teal" variant="light" size="xs">
                                  {activeSite.maintenance_day
                                    ? `Ciclo Mensal (Todo dia ${activeSite.maintenance_day})`
                                    : 'Ciclo Mensal'}
                                </Badge>
                              </Group>

                              <Text size="xs" c="dimmed" mt={4}>
                                Concluída em <b>{formatDateTime(maintenanceStatus?.completed_at, 'Data N/D')}</b>
                                {maintenanceStatus?.completed_by && (
                                  <> por <b>{maintenanceStatus.completed_by}</b></>
                                )}.
                              </Text>

                              {maintenanceStatus?.notes && (
                                <Paper p="xs" bg="dark.8" radius="sm" withBorder mt="xs" style={{ borderLeft: '3px solid #06d6a0' }}>
                                  <Text size="xs" c="dimmed" fs="italic">
                                    "{maintenanceStatus.notes}"
                                  </Text>
                                </Paper>
                              )}

                              <Text size="xs" c="dimmed" mt={8}>
                                💡 Próximo ciclo programado para <b>{activeSite.maintenance_day ? `todo dia ${activeSite.maintenance_day} do próximo mês` : 'o próximo mês'}</b>.
                              </Text>
                            </div>
                          </Group>
                        </Paper>
                      </Grid.Col>

                      <Grid.Col span={{ base: 12, md: 5 }}>
                        <Paper
                          p="sm"
                          bg="dark.7"
                          radius="md"
                          withBorder
                          ta="center"
                          style={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                          }}
                        >
                          <Text size="xs" fw={600} c="teal.3" mb={4}>
                            ✓ Rotinas do Mês Finalizadas
                          </Text>
                          <Text size="xs" c="dimmed" mb="xs">
                            Atualizações, integridade e diagnóstico verificados para este ciclo.
                          </Text>
                          <Group gap="xs" justify="center">
                            <Button
                              variant="light"
                              color="blue"
                              size="compact-xs"
                              leftSection={<IconRefresh size={12} />}
                              onClick={() => setActiveTab('updates')}
                            >
                              Ver Atualizações
                            </Button>
                            <Button
                              variant="light"
                              color="teal"
                              size="compact-xs"
                              leftSection={<IconFileCheck size={12} />}
                              onClick={() => setActiveTab('integrity')}
                            >
                              Integridade
                            </Button>
                            <Button
                              variant="light"
                              color="indigo"
                              size="compact-xs"
                              leftSection={<IconRadar size={12} />}
                              onClick={() => setActiveTab('audit')}
                            >
                              Nova Auditoria
                            </Button>
                          </Group>
                        </Paper>
                      </Grid.Col>
                    </Grid>
                  ) : (
                    <Grid align="center" mt="xs">
                      <Grid.Col span={{ base: 12, md: 7 }}>
                        <Stack gap="xs">
                          <Group gap="xs" align="center">
                            <Text size="sm" fw={600}>
                              Status Atual:
                            </Text>
                            {maintenanceStatus ? (
                              <Badge
                                color={maintenanceStatus.badge_color}
                                variant="light"
                                size="md"
                              >
                                {maintenanceStatus.label}
                              </Badge>
                            ) : activeSite.maintenance_day ? (
                              <Badge color="blue" variant="light" size="md">
                                Todo dia {activeSite.maintenance_day}
                              </Badge>
                            ) : (
                              <Badge color="gray" variant="light" size="md">
                                Dia não agendado
                              </Badge>
                            )}
                          </Group>

                          {activeSite.maintenance_day ? (
                            <Text size="sm" c="dimmed">
                              Rotina agendada para <b>todo dia {activeSite.maintenance_day} de cada mês</b>.
                            </Text>
                          ) : (
                            <Group gap="xs">
                              <Text size="xs" c="orange.4">
                                Nenhum dia do mês definido para a manutenção preventiva.
                              </Text>
                              <Button
                                variant="subtle"
                                color="indigo"
                                size="compact-xs"
                                onClick={() => setActiveTab('settings')}
                              >
                                Configurar dia agora
                              </Button>
                            </Group>
                          )}
                        </Stack>
                      </Grid.Col>

                      <Grid.Col span={{ base: 12, md: 5 }}>
                        <Paper p="sm" bg="dark.7" radius="md" withBorder ta="center">
                          <Text size="xs" c="dimmed" mb={4}>
                            Ações Recomendadas na Manutenção:
                          </Text>
                          <Group gap="xs" justify="center">
                            <Button
                              variant="light"
                              color="blue"
                              size="compact-xs"
                              leftSection={<IconRefresh size={12} />}
                              onClick={() => setActiveTab('updates')}
                            >
                              Atualizar Plugins
                            </Button>
                            <Button
                              variant="light"
                              color="teal"
                              size="compact-xs"
                              leftSection={<IconFileCheck size={12} />}
                              onClick={() => setActiveTab('integrity')}
                            >
                              Checksums Core
                            </Button>
                            <Button
                              variant="light"
                              color="indigo"
                              size="compact-xs"
                              leftSection={<IconRadar size={12} />}
                              onClick={() => setActiveTab('audit')}
                            >
                              Nova Auditoria
                            </Button>
                          </Group>
                        </Paper>
                      </Grid.Col>
                    </Grid>
                  )}
                </Paper>
              );
            })()}

            {/* Status Summary Cards (Módulos Ativos / Error Report & Auditoria) */}
            {(() => {
              const activeSite = currentWebsite || website;

              // 1. Conexão
              const connDate = activeSite.connected_at || activeSite.created_at;

              // 2. Integridade
              const integrityInfo = diagnosticData?.integrity;
              const hasIntegrityScan = Boolean(activeSite.last_integrity_scanned_at || integrityInfo?.scanned_at);
              const integrityScanDate = integrityInfo?.scanned_at || activeSite.last_integrity_scanned_at;
              const integrityIssues = integrityInfo
                ? (integrityInfo.summary?.active_issues ?? integrityInfo.summary?.issues_count ?? 0)
                : Number(activeSite.integrity_issues_count ?? 0);
              const isIntegritySecure = integrityInfo
                ? Boolean(integrityInfo.is_secure)
                : (activeSite.integrity_is_secure === 1 || integrityIssues === 0);
              const integrityMod = integrityInfo?.summary?.modified ?? activeSite.integrity_modified ?? 0;
              const integritySusp = integrityInfo?.summary?.suspicious ?? activeSite.integrity_suspicious ?? 0;

              // 3. Atualizações
              const updatesInfo = diagnosticData?.updates;
              const hasUpdatesData = Boolean(
                updatesInfo ||
                activeSite.last_updates_checked_at ||
                (activeSite.updates_pending_count !== null && activeSite.updates_pending_count !== undefined)
              );
              const totalPending = updatesInfo
                ? updatesInfo.summary.total_pending
                : Number(activeSite.updates_pending_count ?? 0);
              const pendingPlugins = updatesInfo?.summary?.pending_plugins;
              const pendingThemes = updatesInfo?.summary?.pending_themes;
              const pendingCore = updatesInfo?.summary?.pending_core;
              const updatesCheckedAt = activeSite.last_updates_checked_at;

              // 4. Error Report & Logs
              const logsInfo = diagnosticData?.logs_48h;
              const hasLogsData = Boolean(
                logsInfo ||
                activeSite.last_logs_checked_at ||
                (activeSite.logs_fatal_count !== null && activeSite.logs_fatal_count !== undefined)
              );
              const totalFatal = logsInfo
                ? logsInfo.total_fatal_48h
                : Number(activeSite.logs_fatal_count ?? 0);
              const logsCheckedAt = activeSite.last_logs_checked_at;

              // 5. Server Environment Metrics (Linha 2 de Cards)
              const serverEnv = updatesInfo?.server_environment;

              // Card 5: Armazenamento em Disco (HD)
              const diskTotalMb = serverEnv?.disk_total_mb ?? null;
              const diskFreeMb = serverEnv?.disk_free_mb ?? null;
              const diskUsedPct = serverEnv?.disk_used_pct ?? (
                diskTotalMb && diskFreeMb !== null && diskTotalMb > 0
                  ? Math.round(((diskTotalMb - diskFreeMb) / diskTotalMb) * 100)
                  : null
              );
              const hasDiskData = diskFreeMb !== null;
              const diskColor = diskUsedPct !== null
                ? (diskUsedPct >= 90 ? 'red' : diskUsedPct >= 75 ? 'yellow' : 'teal')
                : 'gray';
              const diskFreeText = diskFreeMb !== null
                ? (diskFreeMb >= 1024 ? `${(diskFreeMb / 1024).toFixed(1)} GB Livres` : `${diskFreeMb} MB Livres`)
                : 'Armazenamento';
              const diskDescText = diskTotalMb !== null
                ? `De um total de ${(diskTotalMb / 1024).toFixed(1)} GB (${diskUsedPct ?? 0}% em uso).`
                : 'Informações de armazenamento do servidor web.';

              // Card 6: PHP & Banco de Dados (MySQL)
              const phpVersion = serverEnv?.php_version;
              const mysqlVersion = serverEnv?.mysql_version;
              const parsePhp = (ver?: string) => {
                if (!ver) return null;
                const m = ver.match(/^(\d+)\.(\d+)/);
                return m ? parseFloat(`${m[1]}.${m[2]}`) : null;
              };
              const phpNum = parsePhp(phpVersion);
              let phpColor = 'gray';
              let phpBadge = 'Aguardando';
              let phpStatusDesc = 'Versões do PHP e MySQL ativas no ambiente WordPress.';
              if (phpNum !== null) {
                if (phpNum >= 8.2) {
                  phpColor = 'teal';
                  phpBadge = 'PHP Moderno';
                  phpStatusDesc = 'PHP com suporte ativo e patches de segurança.';
                } else if (phpNum >= 8.0) {
                  phpColor = 'yellow';
                  phpBadge = 'Fim de Suporte';
                  phpStatusDesc = 'Recomendado atualizar para PHP 8.2+ para maior estabilidade.';
                } else {
                  phpColor = 'red';
                  phpBadge = 'PHP Obsoleto';
                  phpStatusDesc = 'Versão descontinuada com vulnerabilidades conhecidas.';
                }
              }

              // Card 7: Uso de Memória RAM (WordPress)
              const memUsageMb = serverEnv?.memory_usage_mb ?? null;
              const memLimit = serverEnv?.memory_limit ?? '';
              const memPeakMb = serverEnv?.memory_peak_mb ?? null;
              const memUsedPct = serverEnv?.memory_used_pct ?? null;
              const hasMemData = memUsageMb !== null;
              const ramColor = memUsedPct !== null
                ? (memUsedPct >= 85 ? 'red' : memUsedPct >= 70 ? 'yellow' : 'teal')
                : 'gray';
              const ramBadge = memUsedPct !== null
                ? (memUsedPct >= 85 ? 'Limite Próximo' : memUsedPct >= 70 ? 'Moderado' : 'Estável')
                : 'Aguardando';
              const ramDescText = memLimit
                ? `Limite: ${memLimit}${memPeakMb ? ` · Pico: ${memPeakMb} MB` : ''}.`
                : 'Consumo de memória alocado pelo processo WordPress.';

              // Card 8: Carga de Processamento (CPU)
              const cpuAvailable = serverEnv?.cpu_available ?? null;
              const cpuLoadPct = serverEnv?.cpu_load_pct ?? null;
              const cpuLoad1m = serverEnv?.cpu_load_1m ?? null;
              const cpuLoad5m = serverEnv?.cpu_load_5m ?? null;
              const cpuCores = serverEnv?.cpu_cores ?? 1;
              let cpuColor = 'gray';
              let cpuBadge = 'Aguardando';
              let cpuDescText = 'Média de processamento do servidor web.';
              if (cpuAvailable === false) {
                cpuBadge = 'Compartilhada';
                cpuDescText = 'Métrica restrita pelo provedor de hospedagem.';
              } else if (cpuLoadPct !== null) {
                if (cpuLoadPct >= 85) {
                  cpuColor = 'red';
                  cpuBadge = 'Sobrecarga';
                } else if (cpuLoadPct >= 60) {
                  cpuColor = 'yellow';
                  cpuBadge = 'Carga Elevada';
                } else {
                  cpuColor = 'teal';
                  cpuBadge = 'Normal';
                }
                cpuDescText = `Load: 1m: ${cpuLoad1m ?? '—'}, 5m: ${cpuLoad5m ?? '—'} (${cpuCores} Core${cpuCores > 1 ? 's' : ''}).`;
              }

              return (
                <>
                  <Grid>
                  {/* Card 1: Status da Conexão */}
                  <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                    <Card
                      padding="md"
                      radius="md"
                      withBorder
                      bg="dark.7"
                      h="100%"
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      <Group justify="space-between" mb="xs">
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase" lineClamp={1}>
                          Status da Conexão
                        </Text>
                        <ThemeIcon color={isConnected ? 'green' : 'red'} variant="light" radius="xl" size="md">
                          {isConnected ? <IconPlugConnected size={18} /> : <IconPlugConnectedX size={18} />}
                        </ThemeIcon>
                      </Group>

                      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Group justify="space-between" align="center" gap="xs" mb={4} wrap="nowrap">
                          <Text fw={700} size="sm" lineClamp={1}>
                            {isConnected ? 'Agente Conectado' : 'Agente Desconectado'}
                          </Text>
                          <Badge
                            size="xs"
                            variant="light"
                            color={!isConnected ? 'red' : isAgentOutdated ? 'yellow' : 'teal'}
                            style={{ flexShrink: 0 }}
                          >
                            {!isConnected ? 'Interrompido' : isAgentOutdated ? 'Desatualizado' : 'Sincronizado'}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 34 }} mb={4}>
                          {isConnected
                            ? isAgentOutdated
                              ? `Agente conectado (v${currentAgentVersion || 'legada'}), mas a versão ${latestAgentVersion} está disponível.`
                              : 'O agente vexors.app está conectado e comunicando com o SaaS.'
                            : 'A comunicação com o WordPress está pausada para evitar sobrecarga.'}
                        </Text>
                        <Text size="10px" c="dimmed" style={{ minHeight: 16 }} mb="xs">
                          {isConnected && connDate ? `Sincronizado: ${formatDateTime(connDate)}` : ' '}
                        </Text>
                      </Box>

                      {isConnected ? (
                        <Button
                          variant="light"
                          color="indigo"
                          size="xs"
                          fullWidth
                          leftSection={<IconPlugConnected size={14} />}
                          onClick={() => setActiveTab('agent')}
                          mt="auto"
                        >
                          Ver Conexão
                        </Button>
                      ) : (
                        <Group gap="xs" mt="auto" grow>
                          <Button
                            variant="filled"
                            color="teal"
                            size="xs"
                            leftSection={<IconPlugConnected size={14} />}
                            loading={reconnecting}
                            onClick={handleReconnect}
                          >
                            Conectar
                          </Button>
                          <Button
                            variant="subtle"
                            color="gray"
                            size="xs"
                            onClick={() => setActiveTab('agent')}
                          >
                            Configurar
                          </Button>
                        </Group>
                      )}
                    </Card>
                  </Grid.Col>

                  {/* Card 2: Integridade do Core */}
                  <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                    <Card
                      padding="md"
                      radius="md"
                      withBorder
                      bg="dark.7"
                      h="100%"
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      <Group justify="space-between" mb="xs">
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase" lineClamp={1}>
                          Integridade do Core
                        </Text>
                        <ThemeIcon
                          color={!hasIntegrityScan ? 'teal' : isIntegritySecure ? 'teal' : 'red'}
                          variant="light"
                          radius="xl"
                          size="md"
                        >
                          <IconFileCheck size={18} />
                        </ThemeIcon>
                      </Group>

                      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Group justify="space-between" align="center" gap="xs" mb={4} wrap="nowrap">
                          <Text fw={700} size="sm" lineClamp={1}>
                            {!hasIntegrityScan
                              ? 'Checksums Oficiais'
                              : isIntegritySecure
                              ? 'Core 100% Autêntico'
                              : `${integrityIssues} Anomalia(s)`}
                          </Text>
                          {hasIntegrityScan && (
                            <Badge
                              size="xs"
                              variant="light"
                              color={isIntegritySecure ? 'teal' : 'red'}
                              style={{ flexShrink: 0 }}
                            >
                              {isIntegritySecure ? '0 falhas' : 'Atenção'}
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 34 }} mb={4}>
                          {!hasIntegrityScan
                            ? 'Verifica se arquivos do core foram adulterados ou se há backdoors ocultos.'
                            : isIntegritySecure
                            ? 'Todos os arquivos do core oficial do WordPress estão autênticos.'
                            : `${integrityMod > 0 ? `${integrityMod} modificado(s)` : ''}${integritySusp > 0 ? `${integrityMod > 0 ? ', ' : ''}${integritySusp} suspeito(s)` : ''}${integrityMod === 0 && integritySusp === 0 ? 'Arquivos oficiais adulterados.' : ''}`}
                        </Text>
                        <Text size="10px" c="dimmed" style={{ minHeight: 16 }} mb="xs">
                          {hasIntegrityScan && integrityScanDate ? `Último scan: ${formatDateTime(integrityScanDate)}` : ' '}
                        </Text>
                      </Box>

                      <Button
                        variant="light"
                        color={hasIntegrityScan && !isIntegritySecure ? 'red' : 'teal'}
                        size="xs"
                        fullWidth
                        leftSection={<IconFileCheck size={14} />}
                        onClick={() => setActiveTab('integrity')}
                        mt="auto"
                      >
                        {hasIntegrityScan ? 'Ver Integridade' : 'Verificar Integridade'}
                      </Button>
                    </Card>
                  </Grid.Col>

                  {/* Card 3: Gestão de Atualizações */}
                  <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                    <Card
                      padding="md"
                      radius="md"
                      withBorder
                      bg="dark.7"
                      h="100%"
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      <Group justify="space-between" mb="xs">
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase" lineClamp={1}>
                          Gestão de Atualizações
                        </Text>
                        <ThemeIcon
                          color={!hasUpdatesData ? 'blue' : totalPending === 0 ? 'teal' : 'yellow'}
                          variant="light"
                          radius="xl"
                          size="md"
                        >
                          <IconRefresh size={18} />
                        </ThemeIcon>
                      </Group>

                      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Group justify="space-between" align="center" gap="xs" mb={4} wrap="nowrap">
                          <Text fw={700} size="sm" lineClamp={1}>
                            {!hasUpdatesData
                              ? 'Plugins, Temas & Core'
                              : totalPending === 0
                              ? 'Tudo Atualizado'
                              : `${totalPending} Pendente(s)`}
                          </Text>
                          {hasUpdatesData && (
                            <Badge
                              size="xs"
                              variant="light"
                              color={totalPending === 0 ? 'teal' : 'yellow'}
                              style={{ flexShrink: 0 }}
                            >
                              {totalPending === 0 ? 'Em dia' : `${totalPending} item(ns)`}
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 34 }} mb={4}>
                          {!hasUpdatesData
                            ? 'Atualize itens remotamente em 1 clique com preservação de status ativo.'
                            : totalPending === 0
                            ? 'WordPress Core, temas e plugins na versão mais recente disponível.'
                            : `${pendingPlugins !== undefined ? `${pendingPlugins} plugin(s), ${pendingThemes || 0} tema(s)${pendingCore ? ', Core' : ''}` : `${totalPending} atualização(ões) pendente(s)`}.`}
                        </Text>
                        <Text size="10px" c="dimmed" style={{ minHeight: 16 }} mb="xs">
                          {hasUpdatesData && updatesCheckedAt ? `Checado: ${formatDateTime(updatesCheckedAt)}` : hasUpdatesData ? 'Verificado recentemente' : ' '}
                        </Text>
                      </Box>

                      <Button
                        variant="light"
                        color="blue"
                        size="xs"
                        fullWidth
                        leftSection={<IconRefresh size={14} />}
                        onClick={() => setActiveTab('updates')}
                        mt="auto"
                      >
                        {hasUpdatesData ? 'Ver Atualizações' : 'Gerenciar Atualizações'}
                      </Button>
                    </Card>
                  </Grid.Col>

                  {/* Card 4: Error Report & Logs */}
                  <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                    <Card
                      padding="md"
                      radius="md"
                      withBorder
                      bg="dark.7"
                      h="100%"
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      <Group justify="space-between" mb="xs">
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase" lineClamp={1}>
                          Error Report & Logs
                        </Text>
                        <ThemeIcon
                          color={!hasLogsData ? 'cyan' : totalFatal === 0 ? 'teal' : 'red'}
                          variant="light"
                          radius="xl"
                          size="md"
                        >
                          <IconTerminal size={18} />
                        </ThemeIcon>
                      </Group>

                      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Group justify="space-between" align="center" gap="xs" mb={4} wrap="nowrap">
                          <Text fw={700} size="sm" lineClamp={1}>
                            {!hasLogsData
                              ? 'Logs em Tempo Real'
                              : totalFatal === 0
                              ? 'Sem Falhas Fatais'
                              : `${totalFatal} Erro(s) Crítico(s)`}
                          </Text>
                          {hasLogsData && (
                            <Badge
                              size="xs"
                              variant="light"
                              color={totalFatal === 0 ? 'teal' : 'red'}
                              style={{ flexShrink: 0 }}
                            >
                              {totalFatal === 0 ? 'Estável (48h)' : 'Alerta PHP'}
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 34 }} mb={4}>
                          {!hasLogsData
                            ? 'Consulte erros PHP, avisos do sistema e depuração gerados no site.'
                            : totalFatal === 0
                            ? 'Nenhum erro fatal ou crash PHP registrado nas últimas 48 horas.'
                            : `Detectadas ${totalFatal} falha(s) crítica(s) de execução PHP nas últimas 48h.`}
                        </Text>
                        <Text size="10px" c="dimmed" style={{ minHeight: 16 }} mb="xs">
                          {hasLogsData && logsCheckedAt ? `Checado: ${formatDateTime(logsCheckedAt)}` : hasLogsData ? 'Monitoramento em tempo real' : ' '}
                        </Text>
                      </Box>

                      <Button
                        variant="light"
                        color={hasLogsData && totalFatal > 0 ? 'red' : 'cyan'}
                        size="xs"
                        fullWidth
                        leftSection={<IconTerminal size={14} />}
                        onClick={() => setActiveTab('logs')}
                        mt="auto"
                      >
                        {hasLogsData ? 'Ver Error Report' : 'Acessar Console'}
                      </Button>
                    </Card>
                  </Grid.Col>
                </Grid>

                {/* Linha 2 de Cards: Saúde do Servidor (HD, PHP/MySQL, RAM, CPU) */}
                <Grid mt="md">
                  {/* Card 5: Armazenamento em Disco */}
                  <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                    <Card
                      padding="md"
                      radius="md"
                      withBorder
                      bg="dark.7"
                      h="100%"
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      <Group justify="space-between" mb="xs" wrap="nowrap">
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase" lineClamp={1}>
                          Armazenamento (Disco)
                        </Text>
                        <ThemeIcon color={diskColor} variant="light" radius="xl" size="md" style={{ flexShrink: 0 }}>
                          <IconDatabase size={18} />
                        </ThemeIcon>
                      </Group>

                      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Group justify="space-between" align="center" gap="xs" mb={4} wrap="nowrap">
                          <Text fw={700} size="sm" lineClamp={1}>
                            {diskFreeText}
                          </Text>
                          <Badge
                            size="xs"
                            variant="light"
                            color={diskColor}
                            style={{ flexShrink: 0 }}
                          >
                            {hasDiskData ? (diskUsedPct !== null && diskUsedPct >= 90 ? 'Crítico' : diskUsedPct !== null && diskUsedPct >= 75 ? 'Espaço Baixo' : 'Saudável') : 'Sem Dados'}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 34 }} mb={4}>
                          {diskDescText}
                        </Text>
                        <Progress value={diskUsedPct ?? 0} color={diskColor} size="sm" radius="xl" mb={6} />
                        <Text size="10px" c="dimmed" style={{ minHeight: 16 }}>
                          {hasUpdatesData && updatesCheckedAt ? `Medição: ${formatDateTime(updatesCheckedAt)}` : hasDiskData ? 'Medição recente' : ' '}
                        </Text>
                      </Box>
                    </Card>
                  </Grid.Col>

                  {/* Card 6: PHP & Banco de Dados */}
                  <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                    <Card
                      padding="md"
                      radius="md"
                      withBorder
                      bg="dark.7"
                      h="100%"
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      <Group justify="space-between" mb="xs" wrap="nowrap">
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase" lineClamp={1}>
                          PHP & Banco de Dados
                        </Text>
                        <ThemeIcon color={phpColor} variant="light" radius="xl" size="md" style={{ flexShrink: 0 }}>
                          <IconServer size={18} />
                        </ThemeIcon>
                      </Group>

                      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Group justify="space-between" align="center" gap="xs" mb={4} wrap="nowrap">
                          <Text fw={700} size="sm" lineClamp={1}>
                            {phpVersion ? `PHP ${phpVersion}` : 'Versões do Servidor'}
                          </Text>
                          <Badge
                            size="xs"
                            variant="light"
                            color={phpColor}
                            style={{ flexShrink: 0 }}
                          >
                            {phpBadge}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 34 }} mb={4}>
                          {mysqlVersion ? `MySQL/MariaDB ${mysqlVersion}. ${phpStatusDesc}` : phpStatusDesc}
                        </Text>
                        <Progress value={phpNum && phpNum >= 8.2 ? 100 : phpNum && phpNum >= 8.0 ? 65 : 30} color={phpColor} size="sm" radius="xl" mb={6} />
                        <Text size="10px" c="dimmed" style={{ minHeight: 16 }}>
                          {hasUpdatesData && updatesCheckedAt ? `Medição: ${formatDateTime(updatesCheckedAt)}` : phpVersion ? 'Medição recente' : ' '}
                        </Text>
                      </Box>
                    </Card>
                  </Grid.Col>

                  {/* Card 7: Memória RAM (WordPress) */}
                  <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                    <Card
                      padding="md"
                      radius="md"
                      withBorder
                      bg="dark.7"
                      h="100%"
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      <Group justify="space-between" mb="xs" wrap="nowrap">
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase" lineClamp={1}>
                          Memória RAM
                        </Text>
                        <ThemeIcon color={ramColor} variant="light" radius="xl" size="md" style={{ flexShrink: 0 }}>
                          <IconCpu size={18} />
                        </ThemeIcon>
                      </Group>

                      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Group justify="space-between" align="center" gap="xs" mb={4} wrap="nowrap">
                          <Text fw={700} size="sm" lineClamp={1}>
                            {hasMemData ? `${memUsageMb} MB em Uso` : 'Consumo de Memória'}
                          </Text>
                          <Badge
                            size="xs"
                            variant="light"
                            color={ramColor}
                            style={{ flexShrink: 0 }}
                          >
                            {ramBadge}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 34 }} mb={4}>
                          {ramDescText}
                        </Text>
                        <Progress value={memUsedPct ?? 0} color={ramColor} size="sm" radius="xl" mb={6} />
                        <Text size="10px" c="dimmed" style={{ minHeight: 16 }}>
                          {hasUpdatesData && updatesCheckedAt ? `Medição: ${formatDateTime(updatesCheckedAt)}` : hasMemData ? 'Medição recente' : ' '}
                        </Text>
                      </Box>
                    </Card>
                  </Grid.Col>

                  {/* Card 8: Carga da CPU */}
                  <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                    <Card
                      padding="md"
                      radius="md"
                      withBorder
                      bg="dark.7"
                      h="100%"
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      <Group justify="space-between" mb="xs" wrap="nowrap">
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase" lineClamp={1}>
                          Carga da CPU
                        </Text>
                        <ThemeIcon color={cpuColor} variant="light" radius="xl" size="md" style={{ flexShrink: 0 }}>
                          <IconActivity size={18} />
                        </ThemeIcon>
                      </Group>

                      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Group justify="space-between" align="center" gap="xs" mb={4} wrap="nowrap">
                          <Text fw={700} size="sm" lineClamp={1}>
                            {cpuAvailable && cpuLoadPct !== null
                              ? `${cpuLoadPct}% de Carga`
                              : cpuAvailable === false
                              ? 'Hospedagem Compartilhada'
                              : 'Processamento (CPU)'}
                          </Text>
                          <Badge
                            size="xs"
                            variant="light"
                            color={cpuColor}
                            style={{ flexShrink: 0 }}
                          >
                            {cpuBadge}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 34 }} mb={4}>
                          {cpuDescText}
                        </Text>
                        <Progress value={cpuAvailable && cpuLoadPct !== null ? cpuLoadPct : 0} color={cpuColor} size="sm" radius="xl" mb={6} />
                        <Text size="10px" c="dimmed" style={{ minHeight: 16 }}>
                          {hasUpdatesData && updatesCheckedAt ? `Medição: ${formatDateTime(updatesCheckedAt)}` : cpuAvailable ? 'Medição recente' : ' '}
                        </Text>
                      </Box>
                    </Card>
                  </Grid.Col>
                </Grid>
              </>
            );
          })()}
          </Stack>
        </Tabs.Panel>

        {/* Tab 2: Audit & Security */}
        <Tabs.Panel value="audit" pt="md">
          <ScanReport
            website={currentWebsite}
            onBack={() => setActiveTab('overview')}
            toolsEnabled={toolsEnabled}
            onNavigateToPlans={onNavigateToPlans}
            onScanComplete={(newResults) => {
              setLatestScan(newResults);
              refreshWebsite();
            }}
          />
        </Tabs.Panel>

        {/* Tab 3: Core Integrity */}
        <Tabs.Panel value="integrity" pt="md">
          <WebsiteIntegrityView
            website={website}
            toolsEnabled={toolsEnabled}
            onNavigateToPlans={onNavigateToPlans}
          />
        </Tabs.Panel>

        {/* Tab: Activity Logs & Technical Notes */}
        <Tabs.Panel value="activity_logs" pt="md">
          <WebsiteActivityLogsView website={website} />
        </Tabs.Panel>

        {/* Tab 4: Realtime Logs */}
        <Tabs.Panel value="logs" pt="md">
          <WebsiteLogsView website={website} onBack={() => setActiveTab('overview')} />
        </Tabs.Panel>

        {/* Tab 5: Remote Updates */}
        <Tabs.Panel value="updates" pt="md">
          <WebsiteUpdatesView
            website={currentWebsite}
            toolsEnabled={toolsEnabled}
            onNavigateToPlans={onNavigateToPlans}
            onUpdatesChanged={handleUpdatesChanged}
          />
        </Tabs.Panel>

        {/* Tab 4: WP Agent Info */}
        <Tabs.Panel value="agent" pt="md">
          <Paper p="lg" radius="md" withBorder bg="dark.7">
            <Title order={4} mb="xs">
              Conexão com o Plugin vexors.app - Diagnóstico
            </Title>
            <Text size="sm" c="dimmed" mb="lg">
              O plugin agente é responsável por integrar seu WordPress ao SaaS vexors.app com autenticação criptografada via tokens.
            </Text>

            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="md" radius="sm" bg="dark.8" withBorder mb="md">
                  <Text size="sm" fw={600} mb="xs">
                    1. Baixar o Plugin Personalizado
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    Este pacote ZIP já vem configurado especificamente para este website ({website.name}).
                  </Text>
                  <Button
                    leftSection={<IconDownload size={16} />}
                    color="teal"
                    size="xs"
                    loading={downloading}
                    onClick={handleDownloadPlugin}
                  >
                    Baixar Plugin Agente (.zip)
                  </Button>
                </Paper>

                <Paper p="md" radius="sm" bg="dark.8" withBorder>
                  <Text size="sm" fw={600} mb="xs">
                    2. Instalar no WordPress
                  </Text>
                  <Stack gap={4}>
                    <Text size="xs">Acesse o painel do seu site em <b>Plugins &gt; Adicionar Novo &gt; Enviar Plugin</b>.</Text>
                    <Text size="xs">Selecione o arquivo ZIP baixado e clique em <b>Instalar Agora</b> e depois em <b>Ativar</b>.</Text>
                  </Stack>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="md" radius="sm" bg="dark.8" withBorder h="100%">
                  <Text size="sm" fw={600} mb="xs">
                    Credenciais de Conexão Manual
                  </Text>
                  <Text size="xs" c="dimmed" mb="sm">
                    Caso tenha reinstalado o plugin ou queira configurar diretamente no painel do WordPress em <b>vexors.app &gt; Diagnóstico</b>:
                  </Text>
                  
                  <Stack gap="xs" mb="md">
                    <div>
                      <Text size="xs" fw={500} c="dimmed">ID do Site no SaaS:</Text>
                      <Code block px="sm" py={6} style={{ fontSize: 13, fontWeight: 'bold' }}>
                        {website.id}
                      </Code>
                    </div>

                    <div>
                      <Text size="xs" fw={500} c="dimmed">Token do Agente:</Text>
                      <Group gap="xs" wrap="nowrap" align="center">
                        <Code block px="sm" py={6} style={{ wordBreak: 'break-all', flex: 1, fontSize: 12 }}>
                          {website.agent_token || 'Nenhum token gerado.'}
                        </Code>
                        {website.agent_token && (
                          <Button
                            size="xs"
                            variant="light"
                            color={copiedToken ? 'green' : 'indigo'}
                            leftSection={copiedToken ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            onClick={handleCopyToken}
                          >
                            {copiedToken ? 'Copiado!' : 'Copiar'}
                          </Button>
                        )}
                      </Group>
                    </div>
                  </Stack>

                  <Alert
                    icon={isConnected ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
                    title={isConnected ? 'Status da Integração: Conectado' : 'Status da Integração: Desconectado'}
                    color={isConnected ? 'green' : 'red'}
                  >
                    <Stack gap="xs">
                      <Text size="xs">
                        {isConnected
                          ? 'Tudo certo! O agente respondeu perfeitamente ao teste de handshake e está ativo no WordPress.'
                          : 'O agente está atualmente desconectado. As requisições automáticas foram suspensas para preservar o servidor.'}
                      </Text>
                      <Group mt={4}>
                        {isConnected ? (
                          <Button
                            variant="light"
                            color="red"
                            size="xs"
                            leftSection={<IconPlugConnectedX size={14} />}
                            onClick={() => setKillModalOpen(true)}
                          >
                            Desligar Serviço (Kill Switch)
                          </Button>
                        ) : (
                          <Button
                            color="teal"
                            size="xs"
                            leftSection={<IconPlugConnected size={14} />}
                            loading={reconnecting}
                            onClick={handleReconnect}
                          >
                            Conectar Agente Agora
                          </Button>
                        )}
                      </Group>
                    </Stack>
                  </Alert>
                </Paper>
              </Grid.Col>
            </Grid>
          </Paper>
        </Tabs.Panel>

        {/* Tab 5: Settings */}
        <Tabs.Panel value="settings" pt="md">
          <Stack gap="lg">
            {/* Bloco 1: Configurações Gerais do Website */}
            <Paper p="lg" radius="md" withBorder bg="dark.7">
              <Group justify="space-between" mb="md" align="flex-start">
                <div>
                  <Title order={4}>Configurações do Website</Title>
                  <Text size="sm" c="dimmed">
                    {isSiteOwner
                      ? 'Edite as informações básicas e o ambiente de execução do site.'
                      : 'Informações cadastrais deste website alvo.'}
                  </Text>
                </div>
                {!isSiteOwner && (
                  <Badge color="violet" variant="outline" leftSection={<IconUsers size={12} />}>
                    Membro Convidado
                  </Badge>
                )}
              </Group>

              {formError && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" onClose={() => setFormError(null)} withCloseButton>
                  {formError}
                </Alert>
              )}

              {formSuccess && (
                <Alert icon={<IconCheck size={16} />} color="green" mb="md" onClose={() => setFormSuccess(null)} withCloseButton>
                  {formSuccess}
                </Alert>
              )}

              <form onSubmit={handleSaveSettings}>
                <Stack gap="md" style={{ maxWidth: 650 }}>
                  <Alert
                    icon={<IconAlertTriangle size={18} />}
                    color="orange"
                    variant="light"
                    title="Atenção à alteração de URL"
                  >
                    Se você alterar a <b>URL do site</b>, o plugin agente WordPress precisará ser <b>gerado e baixado novamente</b> nesta plataforma e reinstalado no seu WordPress para restabelecer a comunicação segura e os tokens de integração.
                  </Alert>

                  <TextInput
                    label="Nome do Site"
                    placeholder="Ex: Blog Principal"
                    required
                    disabled={!isSiteOwner}
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                  />
                  <TextInput
                    label="URL da Página Inicial do WordPress (com HTTPS://)"
                    description="Informe a URL da página inicial com https:// (Exemplo: https://seusite.com.br). O protocolo seguro HTTPS é obrigatório para funcionamento e comunicação com o agente."
                    placeholder="https://seusite.com.br"
                    required
                    disabled={!isSiteOwner}
                    value={url}
                    onChange={(e) => setUrl(e.currentTarget.value)}
                  />

                  {url.trim() !== '' && url.trim().replace(/\/+$/, '') !== website.url.replace(/\/+$/, '') && (
                    <Alert
                      icon={<IconAlertTriangle size={16} />}
                      color="yellow"
                      variant="filled"
                    >
                      Atenção: A URL informada é diferente da URL cadastrada (<code>{website.url}</code>). Ao salvar as alterações, a comunicação com o plugin instalado será pausada e você deverá ir até a aba <b>Visão Geral</b> para baixar o novo pacote do plugin e reinstalá-lo.
                    </Alert>
                  )}
                  <Select
                    label="Ambiente"
                    disabled={!isSiteOwner}
                    data={[
                      { value: 'production', label: 'Produção' },
                      { value: 'staging', label: 'Staging / Homologação' },
                      { value: 'local', label: 'Desenvolvimento Local' },
                    ]}
                    value={environment}
                    onChange={(val) => setEnvironment(val || 'production')}
                  />
                  <NumberInput
                    label="Dia da Manutenção Mensal (Opcional)"
                    description="Dia do mês (1 a 31) em que a manutenção preventiva deve ser executada. O sistema ajustará dinamicamente nos meses menores."
                    placeholder="Ex: 15 (todo dia 15 de cada mês)"
                    min={1}
                    max={31}
                    disabled={!isSiteOwner}
                    value={maintenanceDay}
                    onChange={(val) => setMaintenanceDay(val)}
                  />
                  {isSiteOwner && (
                    <Group justify="flex-start" mt="xs">
                      <Button type="submit" color="indigo" loading={formLoading}>
                        Salvar Alterações
                      </Button>
                    </Group>
                  )}
                </Stack>
              </form>
            </Paper>

            {/* Bloco 2: Gestão de Compartilhamento & Acessos */}
            <Paper p="lg" radius="md" withBorder bg="dark.7">
              <Group justify="space-between" mb="md" align="flex-start">
                <div>
                  <Group gap="xs" align="center">
                    <ThemeIcon color="violet" variant="light" radius="md">
                      <IconUsers size={18} />
                    </ThemeIcon>
                    <Title order={4}>Compartilhamento & Membros com Acesso</Title>
                  </Group>
                  <Text size="sm" c="dimmed" mt={4}>
                    Compartilhe este website com outros usuários cadastrados na plataforma para monitorarem auditorias, logs e integridade juntos.
                  </Text>
                </div>

                {isSiteOwner && (
                  <Button
                    color="violet"
                    size="xs"
                    leftSection={<IconUserPlus size={15} />}
                    onClick={() => {
                      setInviteEmail('');
                      setInviteError(null);
                      setInviteSuccess(null);
                      setShareModalOpen(true);
                    }}
                  >
                    Convidar Usuário
                  </Button>
                )}
              </Group>

              {sharesLoading ? (
                <Center p="md">
                  <Loader size="sm" color="violet" />
                </Center>
              ) : (
                <Table verticalSpacing="sm" withTableBorder={false} highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Usuário</Table.Th>
                      <Table.Th>E-mail</Table.Th>
                      <Table.Th>Papel</Table.Th>
                      <Table.Th>Adicionado em</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Ações</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {/* Linha do Proprietário */}
                    {ownerInfo && (
                      <Table.Tr>
                        <Table.Td>
                          <Group gap="xs">
                            <Text fw={600} size="sm">{ownerInfo.name}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">{ownerInfo.email}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color="blue" variant="filled" size="sm">
                            PROPRIETÁRIO
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">Criação do site</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="xs" c="dimmed">—</Text>
                        </Table.Td>
                      </Table.Tr>
                    )}

                    {/* Linhas de Membros Compartilhados */}
                    {shares.map((member) => (
                      <Table.Tr key={member.id}>
                        <Table.Td>
                          <Text fw={500} size="sm">{member.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">{member.email}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color="violet" variant="light" size="sm">
                            {member.role === 'admin' ? 'ADMINISTRADOR' : 'MONITOR / AUDITOR'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {formatDateOnly(member.created_at)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {isSiteOwner ? (
                            <Tooltip label="Revogar acesso deste usuário">
                              <ActionIcon
                                color="red"
                                variant="subtle"
                                onClick={() => handleRemoveShare(member.user_id, member.name)}
                              >
                                <IconUserX size={16} />
                              </ActionIcon>
                            </Tooltip>
                          ) : (
                            <Text size="xs" c="dimmed">—</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}

                    {shares.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <Text size="sm" c="dimmed" ta="center" py="xs">
                            Nenhum outro usuário possui acesso compartilhado a este website.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>

            {/* Bloco 3: Zona de Perigo / Ações Críticas */}
            <Paper p="lg" radius="md" withBorder bg="dark.7">
              <Title order={5} c="red" mb="xs">
                {isSiteOwner ? 'Zona de Perigo' : 'Ações de Acesso'}
              </Title>
              {isSiteOwner ? (
                <>
                  <Text size="xs" c="dimmed" mb="md">
                    A exclusão do website removerá o cadastro no SaaS e todo o histórico de auditorias associadas a ele.
                  </Text>
                  <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
                    Excluir Website Alvo
                  </Button>
                </>
              ) : (
                <>
                  <Text size="xs" c="dimmed" mb="md">
                    Você pode remover seu próprio acesso a este website compartilhado a qualquer momento.
                  </Text>
                  <Button
                    color="orange"
                    variant="light"
                    leftSection={<IconDoorExit size={16} />}
                    onClick={handleLeaveWebsite}
                  >
                    Sair do Monitoramento deste Website
                  </Button>
                </>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Modal de Convidar Usuário / Compartilhar Website */}
      <Modal
        opened={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={
          <Group gap="xs">
            <IconUsers size={20} color="#7950f2" />
            <Text fw={600}>Compartilhar Website</Text>
          </Group>
        }
        centered
      >
        <form onSubmit={handleInviteSubmit}>
          <Text size="sm" c="dimmed" mb="md">
            Informe o e-mail do usuário cadastrado na plataforma para conceder acesso de monitoramento a este site.
          </Text>

          {inviteError && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" onClose={() => setInviteError(null)} withCloseButton>
              {inviteError}
            </Alert>
          )}

          {inviteSuccess && (
            <Alert icon={<IconCheck size={16} />} color="green" mb="md">
              {inviteSuccess}
            </Alert>
          )}

          <TextInput
            label="E-mail do Usuário"
            placeholder="usuario@email.com"
            leftSection={<IconMail size={16} />}
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.currentTarget.value)}
            mb="md"
          />

          <Select
            label="Nível de Permissão"
            value={inviteRole}
            onChange={(val) => setInviteRole(val || 'viewer')}
            data={[
              { value: 'viewer', label: 'Monitor / Auditor (Visualizar auditorias, logs e integridade)' },
            ]}
            mb="lg"
          />

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setShareModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" color="violet" loading={inviteLoading} leftSection={<IconUserPlus size={16} />}>
              Adicionar Membro
            </Button>
          </Group>
        </form>
      </Modal>

      {/* Modal de Conclusão da Manutenção */}
      <Modal
        opened={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="teal" size="sm" radius="xl">
              <IconCheck size={14} />
            </ThemeIcon>
            <Text fw={700} size="sm">
              Registrar Conclusão da Manutenção
            </Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Paper p="xs" bg="dark.7" radius="sm" withBorder>
            <Text size="xs" fw={700}>
              {website.name}
            </Text>
            <Text size="xs" c="dimmed">
              {website.url}
            </Text>
            {website.maintenance_day && (
              <Group gap="xs" mt={4}>
                <Badge size="xs" color="gray" variant="outline">
                  Dia programado: {website.maintenance_day}
                </Badge>
              </Group>
            )}
          </Paper>

          <Select
            label="Mês de Referência da Manutenção"
            description="Selecione o ciclo/mês em que esta manutenção foi realizada"
            data={maintenanceMonthOptions}
            value={selectedMaintenanceMonth}
            onChange={(val) => val && setSelectedMaintenanceMonth(val)}
            allowDeselect={false}
          />

          <Textarea
            label="Notas do que foi realizado (opcional)"
            description="Ex: Plugins WooCommerce e Elementor atualizados, backup realizado e testes de formulário efetuados."
            placeholder="Descreva as atualizações ou verificações efetuadas..."
            rows={3}
            value={maintenanceNotes}
            onChange={(e) => setMaintenanceNotes(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setCompleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="teal"
              leftSection={<IconCheck size={16} />}
              loading={maintenanceLoading}
              onClick={handleCompleteMaintenance}
            >
              Confirmar Conclusão
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de Histórico de Manutenções */}
      <Modal
        opened={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="indigo" size="sm" radius="xl">
              <IconHistory size={14} />
            </ThemeIcon>
            <Text fw={700} size="sm">
              Histórico de Manutenções - {website.name}
            </Text>
          </Group>
        }
        size="lg"
        centered
      >
        {historyLoading ? (
          <Center p="xl">
            <Loader size="md" color="indigo" />
          </Center>
        ) : maintenanceHistory.length === 0 ? (
          <Box p="lg" ta="center">
            <Text size="sm" c="dimmed">
              Nenhuma manutenção anterior registrada para este website.
            </Text>
          </Box>
        ) : (
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ciclo (Mês/Ano)</Table.Th>
                <Table.Th>Concluída em</Table.Th>
                <Table.Th>Responsável</Table.Th>
                <Table.Th>Observações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {maintenanceHistory.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Badge color="indigo" variant="light" size="sm">
                      {formatMonthYear(item.year_month)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">
                      {formatDateTime(item.completed_at)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" fw={500}>
                      {item.user_name || item.user_email || '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {item.notes || 'Sem observações'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Modal>

      {/* Modal de Confirmação do Kill Switch */}
      <Modal
        opened={killModalOpen}
        onClose={() => setKillModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="red" size="sm" radius="xl">
              <IconPlugConnectedX size={14} />
            </ThemeIcon>
            <Text fw={700} size="sm">
              Desligar Serviço do Site (Kill Switch)
            </Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Paper p="xs" bg="dark.7" radius="sm" withBorder>
            <Text size="xs" fw={700}>
              {website.name}
            </Text>
            <Text size="xs" c="dimmed">
              {website.url}
            </Text>
          </Paper>

          <Alert
            icon={<IconAlertTriangle size={18} />}
            title="Atenção: Interrupção Imediata"
            color="red"
            variant="light"
          >
            <Text size="xs">
              Esta ação desliga a integração com o agente WordPress. Nenhuma requisição automática, leitura de logs, checagem de integridade ou verificação de updates será disparada para este servidor até que você conecte manualmente.
            </Text>
          </Alert>

          <Text size="xs" c="dimmed">
            Isso é ideal caso você tenha desativado temporariamente o plugin no WordPress ou precise estancar qualquer tráfego da plataforma para estabilizar o servidor PHP-FPM.
          </Text>

          <Group justify="flex-end" mt="sm">
            <Button
              variant="default"
              size="sm"
              onClick={() => setKillModalOpen(false)}
              disabled={disconnecting}
            >
              Cancelar
            </Button>
            <Button
              color="red"
              size="sm"
              leftSection={<IconPlugConnectedX size={16} />}
              loading={disconnecting}
              onClick={handleDisconnect}
            >
              Desligar Serviço Agora
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
