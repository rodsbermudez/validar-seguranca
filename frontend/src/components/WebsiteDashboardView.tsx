import React, { useState, useEffect, useCallback } from 'react';
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
} from '../api';
import { ScanReport } from './ScanReport';
import { WebsiteLogsView } from './WebsiteLogsView';
import { WebsiteUpdatesView } from './WebsiteUpdatesView';
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
}

export const WebsiteDashboardView: React.FC<WebsiteDashboardViewProps> = ({
  website,
  onBack,
  onUpdateWebsite,
  onDeleteWebsite,
  onNavigateToPlans,
  initialTab,
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
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(website.maintenance || null);
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

  const isConnected = Number(website.is_connected) === 1;

  const fetchLatestScan = useCallback(async () => {
    setScanHistoryLoading(true);
    try {
      const res = await api.get(`/scan/history/${website.id}`);
      const historyData = res.data.data || [];
      if (historyData.length > 0) {
        setLatestScan(historyData[0].scan_results);
      } else {
        setLatestScan(null);
      }
    } catch (e) {
      setLatestScan(null);
    } finally {
      setScanHistoryLoading(false);
    }
  }, [website.id]);

  useEffect(() => {
    fetchLatestScan();
  }, [fetchLatestScan]);

  // Live diagnostic summary for the 4 tool cards
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticSummaryResponse['data'] | null>(null);

  const fetchDiagnosticData = useCallback(async () => {
    if (!isConnected) return;
    try {
      const res = await getDiagnosticSummary(website.id);
      if (res?.data) {
        setDiagnosticData(res.data);
      }
    } catch (e) {
      // Fallback silently to DB data in website prop
    }
  }, [website.id, isConnected]);

  useEffect(() => {
    fetchDiagnosticData();
  }, [fetchDiagnosticData]);

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchDiagnosticData();
    }
  }, [activeTab, fetchDiagnosticData]);

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
        onUpdateWebsite({ ...website, maintenance: res.data.status });
      }
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
        onUpdateWebsite({ ...website, maintenance: res.data.status });
      }
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

    const payload = {
      name,
      url,
      environment,
      maintenance_day: maintenanceDay === '' || maintenanceDay === null ? null : Number(maintenanceDay),
    };

    try {
      const response = await api.put(`/websites/${website.id}`, payload);
      const updated = response.data?.data || { ...website, ...payload };
      setFormSuccess('Dados do website atualizados com sucesso!');
      if (onUpdateWebsite) {
        onUpdateWebsite(updated);
      }
      setTimeout(() => setFormSuccess(null), 4000);
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

  if (viewingDiagnostic) {
    return (
      <WebsiteDiagnosticReportView
        website={website}
        onBack={() => setViewingDiagnostic(false)}
      />
    );
  }

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
                color="gray"
                variant="light"
                leftSection={<IconPlugConnectedX size={16} />}
              >
                AGENTE PENDENTE
              </Badge>
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
            <Paper p="lg" radius="md" bg="dark.8" withBorder style={{ borderLeft: '4px solid #06d6a0' }}>
              <Group justify="space-between" mb="sm" wrap="wrap" gap="md">
                <Group gap="xs">
                  <ThemeIcon color="teal" variant="light" radius="xl">
                    <IconCalendarCheck size={18} />
                  </ThemeIcon>
                  <div>
                    <Group gap="xs" align="center">
                      <Title order={4}>Ciclo de Manutenção Preventiva</Title>
                      <Badge color="teal" variant="light" size="sm">
                        {formatMonthYear(new Date()).toUpperCase()}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Acompanhamento da rotina mensal de atualizações, integridade e testes do site.
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

                  {maintenanceStatus?.status === 'completed' ? (
                    <Button
                      variant="outline"
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
                          variant={maintenanceStatus.status === 'completed' ? 'filled' : 'light'}
                          size="md"
                        >
                          {maintenanceStatus.label}
                        </Badge>
                      ) : website.maintenance_day ? (
                        <Badge color="blue" variant="light" size="md">
                          Todo dia {website.maintenance_day}
                        </Badge>
                      ) : (
                        <Badge color="gray" variant="light" size="md">
                          Dia não agendado
                        </Badge>
                      )}
                    </Group>

                    {website.maintenance_day ? (
                      <Text size="sm" c="dimmed">
                        Rotina agendada para <b>todo dia {website.maintenance_day} de cada mês</b>.
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

                    {maintenanceStatus?.status === 'completed' && (
                      <Paper p="xs" bg="dark.7" radius="sm" withBorder mt={4}>
                        <Group justify="space-between" mb={maintenanceStatus.notes ? 4 : 0}>
                          <Text size="xs" c="green.4" fw={600}>
                            ✓ Concluída em:{' '}
                            {formatDateTime(maintenanceStatus.completed_at, 'Data N/D')}
                          </Text>
                          {maintenanceStatus.completed_by && (
                            <Text size="xs" c="dimmed">
                              Por: {maintenanceStatus.completed_by}
                            </Text>
                          )}
                        </Group>
                        {maintenanceStatus.notes && (
                          <Text size="xs" c="dimmed" fs="italic">
                            "{maintenanceStatus.notes}"
                          </Text>
                        )}
                      </Paper>
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
            </Paper>

            {/* Status Summary Cards (Módulos Ativos / Error Report & Auditoria) */}
            {(() => {
              // 1. Conexão
              const connDate = website.connected_at || website.created_at;

              // 2. Integridade
              const integrityInfo = diagnosticData?.integrity;
              const hasIntegrityScan = Boolean(website.last_integrity_scanned_at || integrityInfo?.scanned_at);
              const integrityScanDate = integrityInfo?.scanned_at || website.last_integrity_scanned_at;
              const integrityIssues = integrityInfo
                ? (integrityInfo.summary?.active_issues ?? integrityInfo.summary?.issues_count ?? 0)
                : Number(website.integrity_issues_count ?? 0);
              const isIntegritySecure = integrityInfo
                ? Boolean(integrityInfo.is_secure)
                : (website.integrity_is_secure === 1 || integrityIssues === 0);
              const integrityMod = integrityInfo?.summary?.modified ?? website.integrity_modified ?? 0;
              const integritySusp = integrityInfo?.summary?.suspicious ?? website.integrity_suspicious ?? 0;

              // 3. Atualizações
              const updatesInfo = diagnosticData?.updates;
              const hasUpdatesData = Boolean(
                updatesInfo ||
                website.last_updates_checked_at ||
                (website.updates_pending_count !== null && website.updates_pending_count !== undefined)
              );
              const totalPending = updatesInfo
                ? updatesInfo.summary.total_pending
                : Number(website.updates_pending_count ?? 0);
              const pendingPlugins = updatesInfo?.summary?.pending_plugins;
              const pendingThemes = updatesInfo?.summary?.pending_themes;
              const pendingCore = updatesInfo?.summary?.pending_core;
              const updatesCheckedAt = website.last_updates_checked_at;

              // 4. Error Report & Logs
              const logsInfo = diagnosticData?.logs_48h;
              const hasLogsData = Boolean(
                logsInfo ||
                website.last_logs_checked_at ||
                (website.logs_fatal_count !== null && website.logs_fatal_count !== undefined)
              );
              const totalFatal = logsInfo
                ? logsInfo.total_fatal_48h
                : Number(website.logs_fatal_count ?? 0);
              const logsCheckedAt = website.last_logs_checked_at;

              return (
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
                        <ThemeIcon color={isConnected ? 'green' : 'gray'} variant="light" radius="xl" size="md">
                          {isConnected ? <IconPlugConnected size={18} /> : <IconPlugConnectedX size={18} />}
                        </ThemeIcon>
                      </Group>

                      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Group justify="space-between" align="center" gap="xs" mb={4} wrap="nowrap">
                          <Text fw={700} size="sm" lineClamp={1}>
                            {isConnected ? 'Agente Ativo' : 'Pendente de Conexão'}
                          </Text>
                          {isConnected && (
                            <Badge size="xs" variant="light" color="teal" style={{ flexShrink: 0 }}>
                              Sincronizado
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={2} style={{ minHeight: 34 }} mb={4}>
                          {isConnected
                            ? 'O agente vexors.app está conectado e comunicando com o SaaS.'
                            : 'Baixe e ative o plugin no painel WordPress para liberar as funções.'}
                        </Text>
                        <Text size="10px" c="dimmed" style={{ minHeight: 16 }} mb="xs">
                          {isConnected && connDate ? `Sincronizado: ${formatDateTime(connDate)}` : ' '}
                        </Text>
                      </Box>

                      <Button
                        variant="light"
                        color={isConnected ? 'indigo' : 'teal'}
                        size="xs"
                        fullWidth
                        leftSection={isConnected ? <IconPlugConnected size={14} /> : <IconDownload size={14} />}
                        onClick={() => setActiveTab('agent')}
                        mt="auto"
                      >
                        {isConnected ? 'Ver Conexão' : 'Instalar Agente'}
                      </Button>
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
              );
            })()}
          </Stack>
        </Tabs.Panel>

        {/* Tab 2: Audit & Security */}
        <Tabs.Panel value="audit" pt="md">
          <ScanReport
            website={website}
            onBack={() => setActiveTab('overview')}
            toolsEnabled={toolsEnabled}
            onNavigateToPlans={onNavigateToPlans}
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
            website={website}
            toolsEnabled={toolsEnabled}
            onNavigateToPlans={onNavigateToPlans}
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

                  <Alert icon={<IconAlertCircle size={16} />} title="Status da Integração" color={isConnected ? 'green' : 'yellow'}>
                    {isConnected
                      ? 'Tudo certo! O agente respondeu perfeitamente ao teste de handshake.'
                      : 'O agente ainda não foi detectado com este token. Cole as credenciais acima em vexors.app > Diagnóstico no seu WordPress e clique em "Salvar Configurações e Conectar".'}
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
                <Stack gap="md" style={{ maxWidth: 600 }}>
                  <TextInput
                    label="Nome do Site"
                    placeholder="Ex: Blog Principal"
                    required
                    disabled={!isSiteOwner}
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                  />
                  <TextInput
                    label="URL do WordPress"
                    placeholder="http://localhost/wordpress"
                    required
                    disabled={!isSiteOwner}
                    value={url}
                    onChange={(e) => setUrl(e.currentTarget.value)}
                  />
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
    </Stack>
  );
};
