import { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Title,
  Text,
  Badge,
  Group,
  Stack,
  Grid,
  Card,
  Button,
  Table,
  Alert,
  Loader,
  Pagination,
  Tabs,
  TextInput,
  Select,
  Modal,
  Code,
  ActionIcon,
  CopyButton,
  Textarea,
  Box,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconServer,
  IconWorld,
  IconUser,
  IconRefresh,
  IconSearch,
  IconCheck,
  IconX,
  IconTrash,
  IconExternalLink,
  IconCode,
  IconInfoCircle,
  IconCopy,
  IconBug,
  IconShield,
  IconTerminal2,
  IconEye,
  IconFileText,
  IconBrain,
} from '@tabler/icons-react';
import {
  getPlatformErrorLogs,
  getPlatformErrorMetrics,
  getPlatformErrorFilters,
  getPlatformErrorDetails,
  updatePlatformErrorStatus,
  clearPlatformErrorLogs,
  PlatformErrorLog,
  PlatformErrorMetrics,
  PlatformErrorFilterOptions,
} from '../api';
import { formatDateTime } from '../utils/date';

export function PlatformErrorLogsView() {
  const [loading, setLoading] = useState<boolean>(true);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(true);
  const [logs, setLogs] = useState<PlatformErrorLog[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const perPage = 20;

  // Metrics
  const [metrics, setMetrics] = useState<PlatformErrorMetrics | null>(null);

  // Filter options
  const [filterOptions, setFilterOptions] = useState<PlatformErrorFilterOptions>({
    websites: [],
    users: [],
  });

  // Filters State
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [websiteFilter, setWebsiteFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState<PlatformErrorLog | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Clear modal / action
  const [clearing, setClearing] = useState<boolean>(false);

  // Fetch filter options (distinct websites and users)
  const fetchFilterOptions = useCallback(async () => {
    try {
      const data = await getPlatformErrorFilters();
      setFilterOptions(data);
    } catch (err) {
      console.error('Falha ao carregar opções de filtro:', err);
    }
  }, []);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await getPlatformErrorMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Falha ao carregar métricas:', err);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Fetch error logs with filters
  const fetchLogs = useCallback(
    async (currentPage: number = page) => {
      setLoading(true);
      try {
        const params: Record<string, any> = {
          page: currentPage,
          per_page: perPage,
        };

        if (statusFilter !== 'all') params.status = statusFilter;
        if (severityFilter !== 'all') params.severity = severityFilter;
        if (categoryFilter !== 'all') params.category = categoryFilter;
        if (websiteFilter !== 'all') params.website_id = websiteFilter;
        if (userFilter !== 'all') params.user_id = userFilter;
        if (search.trim()) params.search = search.trim();

        const res = await getPlatformErrorLogs(params);
        setLogs(res.logs || []);
        setTotal(res.total || 0);
        setTotalPages(res.total_pages || 1);
      } catch (err) {
        console.error('Falha ao carregar logs:', err);
      } finally {
        setLoading(false);
      }
    },
    [page, perPage, statusFilter, severityFilter, categoryFilter, websiteFilter, userFilter, search]
  );

  useEffect(() => {
    fetchMetrics();
    fetchFilterOptions();
  }, [fetchMetrics, fetchFilterOptions]);

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  // Handle open details modal
  const handleOpenDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailModalOpen(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const data = await getPlatformErrorDetails(id);
      setSelectedLog(data);
      setAdminNotes(data.admin_notes || '');
    } catch (err: any) {
      setActionError('Falha ao carregar detalhes completos do log.');
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle status update
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedLog) return;
    setUpdatingStatus(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const updated = await updatePlatformErrorStatus(selectedLog.id, {
        status: newStatus,
        admin_notes: adminNotes,
      });
      setSelectedLog(updated);
      setActionSuccess(`Status alterado para "${newStatus}" com sucesso!`);
      // Refresh list & metrics
      fetchLogs(page);
      fetchMetrics();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Falha ao atualizar status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle save notes only
  const handleSaveNotes = async () => {
    if (!selectedLog) return;
    setUpdatingStatus(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const updated = await updatePlatformErrorStatus(selectedLog.id, {
        admin_notes: adminNotes,
      });
      setSelectedLog(updated);
      setActionSuccess('Anotações salvas com sucesso!');
      fetchLogs(page);
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Falha ao salvar anotações.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle clear resolved/ignored logs
  const handleClearOldLogs = async () => {
    if (!window.confirm('Deseja excluir permanentemente os logs resolvidos e ignorados com mais de 30 dias?')) {
      return;
    }
    setClearing(true);
    try {
      const res = await clearPlatformErrorLogs(30);
      alert(`${res.deleted_count} logs antigos foram excluídos.`);
      fetchLogs(1);
      fetchMetrics();
    } catch (err: any) {
      alert('Falha ao limpar logs: ' + (err.response?.data?.message || err.message));
    } finally {
      setClearing(false);
    }
  };

  // Badges formatters
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge color="red" variant="filled">Crítica</Badge>;
      case 'error':
        return <Badge color="red" variant="light">Erro</Badge>;
      case 'warning':
        return <Badge color="yellow" variant="light">Aviso</Badge>;
      default:
        return <Badge color="blue" variant="light">Info</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unresolved':
        return <Badge color="red" variant="outline">Pendente</Badge>;
      case 'investigating':
        return <Badge color="yellow" variant="filled">Investigando</Badge>;
      case 'resolved':
        return <Badge color="teal" variant="filled">Resolvido</Badge>;
      case 'ignored':
        return <Badge color="gray" variant="light">Ignorado</Badge>;
      default:
        return <Badge color="gray">{status}</Badge>;
    }
  };

  const getCategoryLabel = (category: string) => {
    const map: Record<string, string> = {
      ai_service: 'Serviço de IA / OpenCode',
      agent_connection: 'Conexão Agente',
      security_scan: 'Varredura de Segurança',
      integrity_check: 'Integridade de Arquivos',
      updates_manager: 'Gestor de Atualizações',
      remediation_fixes: 'Correções / Fixes',
      logs_collector: 'Coletor de Logs',
      payment_gateway: 'Gateway Pagamento',
      general_api: 'API Geral',
    };
    return map[category] || category;
  };

  const getCategoryBadge = (category: string) => {
    if (category === 'ai_service') {
      return (
        <Badge size="xs" variant="light" color="violet" leftSection={<IconBrain size={12} />}>
          Serviço de IA / OpenCode
        </Badge>
      );
    }
    return (
      <Badge size="xs" variant="outline" color="gray">
        {getCategoryLabel(category)}
      </Badge>
    );
  };

  const getHttpStatusBadge = (status?: number | null, curl?: string | null) => {
    if (!status && curl) {
      return <Badge color="red" variant="dot">cURL Error</Badge>;
    }
    if (!status) return <Badge color="gray">0 / Sem Resposta</Badge>;

    if (status >= 500) {
      return <Badge color="red" variant="filled">HTTP {status}</Badge>;
    }
    if (status === 406) {
      return <Badge color="orange" variant="filled">HTTP 406 (WAF)</Badge>;
    }
    if (status === 403) {
      return <Badge color="red" variant="outline">HTTP 403 (Forbidden)</Badge>;
    }
    if (status === 404) {
      return <Badge color="yellow" variant="light">HTTP 404 (Rota)</Badge>;
    }
    if (status === 401) {
      return <Badge color="grape" variant="light">HTTP 401 (Auth)</Badge>;
    }
    return <Badge color="gray" variant="light">HTTP {status}</Badge>;
  };

  // Website options for Select
  const websiteSelectOptions = [
    { value: 'all', label: '🌐 Todos os Websites' },
    ...filterOptions.websites.map((w) => ({
      value: String(w.id),
      label: `${w.name || w.url} (${w.error_count} erros)`,
    })),
  ];

  // User options for Select
  const userSelectOptions = [
    { value: 'all', label: '👤 Todos os Clientes / Usuários' },
    ...filterOptions.users.map((u) => ({
      value: String(u.id),
      label: `${u.email} (${u.error_count} erros)`,
    })),
  ];

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between" align="center" wrap="wrap">
        <div>
          <Group gap="xs" align="center">
            <IconBug size={28} color="#FF6B6B" />
            <Title order={2} c="white">
              Central de Logs de Erros da Plataforma
            </Title>
          </Group>
          <Text size="sm" c="dimmed" mt={4}>
            Diagnóstico detalhado de falhas de conexão com agentes WordPress, bloqueios de WAF, timeouts e exceções da plataforma.
          </Text>
        </div>

        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} />}
            onClick={() => {
              fetchMetrics();
              fetchFilterOptions();
              fetchLogs(page);
            }}
            loading={loading || metricsLoading}
          >
            Atualizar
          </Button>

          <Button
            variant="subtle"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={handleClearOldLogs}
            loading={clearing}
          >
            Limpar Resolvidos (+30d)
          </Button>
        </Group>
      </Group>

      {/* Overview Metrics Cards */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card padding="md" radius="md" bg="dark.7" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Total de Falhas
                </Text>
                <Title order={2} c="white">
                  {metricsLoading ? <Loader size="xs" color="gray" /> : metrics?.total_errors ?? 0}
                </Title>
              </Stack>
              <ThemeIcon size="lg" radius="md" color="blue" variant="light">
                <IconTerminal2 size={20} />
              </ThemeIcon>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              Histórico acumulado de incidentes
            </Text>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card padding="md" radius="md" bg="dark.7" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Falhas Conexão (24h)
                </Text>
                <Title order={2} c={metrics?.connection_failures_24h ? 'orange.4' : 'green.4'}>
                  {metricsLoading ? <Loader size="xs" color="gray" /> : metrics?.connection_failures_24h ?? 0}
                </Title>
              </Stack>
              <ThemeIcon size="lg" radius="md" color="orange" variant="light">
                <IconServer size={20} />
              </ThemeIcon>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              Sites que falharam nas últimas 24 horas
            </Text>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card padding="md" radius="md" bg="dark.7" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Erros Críticos Pendentes
                </Text>
                <Title order={2} c={metrics?.unresolved_critical ? 'red.4' : 'green.4'}>
                  {metricsLoading ? <Loader size="xs" color="gray" /> : metrics?.unresolved_critical ?? 0}
                </Title>
              </Stack>
              <ThemeIcon size="lg" radius="md" color="red" variant="light">
                <IconShield size={20} />
              </ThemeIcon>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              Incidentes que requerem investigação
            </Text>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card padding="md" radius="md" bg="dark.7" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Impacto Global
                </Text>
                <Group gap="xs">
                  <Text size="lg" fw={700} c="white">
                    {metrics?.affected_websites ?? 0}
                  </Text>
                  <Text size="xs" c="dimmed">sites /</Text>
                  <Text size="lg" fw={700} c="white">
                    {metrics?.affected_users ?? 0}
                  </Text>
                  <Text size="xs" c="dimmed">clientes</Text>
                </Group>
              </Stack>
              <ThemeIcon size="lg" radius="md" color="grape" variant="light">
                <IconWorld size={20} />
              </ThemeIcon>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              Total de entidades únicas afetadas
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Filters & Search Toolbar */}
      <Paper p="md" radius="md" bg="dark.7" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
        <Stack gap="md">
          <Grid gutter="sm" align="flex-end">
            {/* Search Input */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <TextInput
                placeholder="Buscar por site, URL, e-mail, erro ou endpoint..."
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => {
                  setSearch(e.currentTarget.value);
                  setPage(1);
                }}
              />
            </Grid.Col>

            {/* Filter by Website (Client's Site) */}
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Select
                placeholder="Filtrar por Website"
                data={websiteSelectOptions}
                value={websiteFilter}
                searchable
                nothingFoundMessage="Nenhum website encontrado"
                leftSection={<IconWorld size={16} />}
                onChange={(val) => {
                  setWebsiteFilter(val || 'all');
                  setPage(1);
                }}
              />
            </Grid.Col>

            {/* Filter by User (Client) */}
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Select
                placeholder="Filtrar por Cliente / Usuário"
                data={userSelectOptions}
                value={userFilter}
                searchable
                nothingFoundMessage="Nenhum cliente encontrado"
                leftSection={<IconUser size={16} />}
                onChange={(val) => {
                  setUserFilter(val || 'all');
                  setPage(1);
                }}
              />
            </Grid.Col>
          </Grid>

          {/* Secondary Filters */}
          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
              <Select
                label="Status de Resolução"
                size="xs"
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val || 'all');
                  setPage(1);
                }}
                data={[
                  { value: 'all', label: 'Todos os Status' },
                  { value: 'unresolved', label: '🔴 Pendente / Não Resolvido' },
                  { value: 'investigating', label: '🟡 Em Investigação' },
                  { value: 'resolved', label: '🟢 Resolvido' },
                  { value: 'ignored', label: '⚪ Ignorado' },
                ]}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
              <Select
                label="Gravidade"
                size="xs"
                value={severityFilter}
                onChange={(val) => {
                  setSeverityFilter(val || 'all');
                  setPage(1);
                }}
                data={[
                  { value: 'all', label: 'Todas as Gravidades' },
                  { value: 'critical', label: 'Crítica' },
                  { value: 'error', label: 'Erro' },
                  { value: 'warning', label: 'Aviso' },
                  { value: 'info', label: 'Informativo' },
                ]}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
              <Select
                label="Categoria do Incidente"
                size="xs"
                value={categoryFilter}
                onChange={(val) => {
                  setCategoryFilter(val || 'all');
                  setPage(1);
                }}
                data={[
                  { value: 'all', label: 'Todas as Categorias' },
                  { value: 'ai_service', label: '🤖 Serviço de IA / OpenCode' },
                  { value: 'agent_connection', label: 'Conexão Agente WordPress' },
                  { value: 'security_scan', label: 'Varredura de Segurança' },
                  { value: 'integrity_check', label: 'Integridade de Arquivos' },
                  { value: 'updates_manager', label: 'Gestor de Atualizações' },
                  { value: 'remediation_fixes', label: 'Correções / Fixes' },
                  { value: 'logs_collector', label: 'Coletor de Logs' },
                  { value: 'payment_gateway', label: 'Gateway Pagamento' },
                  { value: 'general_api', label: 'API Geral' },
                ]}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 12, md: 3 }} style={{ display: 'flex', alignItems: 'flex-end' }}>
              {(statusFilter !== 'all' ||
                severityFilter !== 'all' ||
                categoryFilter !== 'all' ||
                websiteFilter !== 'all' ||
                userFilter !== 'all' ||
                search) && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconX size={14} />}
                  onClick={() => {
                    setStatusFilter('all');
                    setSeverityFilter('all');
                    categoryFilter !== 'all' && setCategoryFilter('all');
                    setWebsiteFilter('all');
                    setUserFilter('all');
                    setSearch('');
                    setPage(1);
                  }}
                  fullWidth
                >
                  Limpar Filtros
                </Button>
              )}
            </Grid.Col>
          </Grid>
        </Stack>
      </Paper>

      {/* Logs Table */}
      <Paper radius="md" bg="dark.7" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
        {loading ? (
          <Box p="xl" style={{ textAlign: 'center' }}>
            <Loader size="md" color="sitehub" />
            <Text size="sm" c="dimmed" mt="sm">
              Carregando registros de erros...
            </Text>
          </Box>
        ) : logs.length === 0 ? (
          <Box p="xl" style={{ textAlign: 'center' }}>
            <ThemeIcon size={48} radius="xl" color="green" variant="light" mb="md">
              <IconCheck size={28} />
            </ThemeIcon>
            <Title order={4} c="white">
              Nenhum erro registrado com os filtros selecionados!
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              A plataforma está operando normalmente ou nenhum incidente recente corresponde aos critérios de busca.
            </Text>
          </Box>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead bg="dark.8">
                <Table.Tr>
                  <Table.Th style={{ width: 150 }}>Data / Hora</Table.Th>
                  <Table.Th style={{ width: 220 }}>Website & Cliente</Table.Th>
                  <Table.Th style={{ width: 140 }}>Categoria</Table.Th>
                  <Table.Th style={{ width: 130 }}>Resposta / HTTP</Table.Th>
                  <Table.Th>Mensagem de Erro / Endpoint</Table.Th>
                  <Table.Th style={{ width: 110 }}>Status</Table.Th>
                  <Table.Th style={{ width: 110, textAlign: 'center' }}>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {logs.map((log) => (
                  <Table.Tr key={log.id}>
                    {/* Timestamp & Severity */}
                    <Table.Td>
                      <Stack gap={4}>
                        <Text size="xs" fw={600} c="white">
                          {formatDateTime(log.created_at)}
                        </Text>
                        <Group gap={4}>
                          {getSeverityBadge(log.severity)}
                        </Group>
                      </Stack>
                    </Table.Td>

                    {/* Website & User */}
                    <Table.Td>
                      <Stack gap={2}>
                        {log.website_name ? (
                          <Text size="xs" fw={600} c="white" lineClamp={1}>
                            {log.website_name}
                          </Text>
                        ) : (
                          <Text size="xs" c="dimmed">
                            Geral / Sistema
                          </Text>
                        )}
                        {log.website_url && (
                          <Text size="11px" c="dimmed" component="a" href={log.website_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }} lineClamp={1}>
                            {log.website_url.replace(/^https?:\/\//, '')}
                          </Text>
                        )}
                        {log.user_email && (
                          <Text size="11px" c="oceanBlue.4" lineClamp={1}>
                            {log.user_email}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>

                    {/* Category */}
                    <Table.Td>
                      {getCategoryBadge(log.category)}
                    </Table.Td>

                    {/* Status Code / cURL */}
                    <Table.Td>
                      {getHttpStatusBadge(log.http_status, log.curl_error)}
                    </Table.Td>

                    {/* Error message & endpoint */}
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="xs" fw={500} c="red.3" lineClamp={2}>
                          {log.error_message || 'Erro não detalhado'}
                        </Text>
                        {log.endpoint && (
                          <Text size="11px" c="dimmed" ff="monospace" lineClamp={1}>
                            {log.http_method} {log.endpoint}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>

                    {/* Status */}
                    <Table.Td>
                      {getStatusBadge(log.status)}
                    </Table.Td>

                    {/* Actions */}
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Button
                        size="xs"
                        variant="light"
                        color="sitehub"
                        leftSection={<IconEye size={14} />}
                        onClick={() => handleOpenDetail(log.id)}
                      >
                        Diagnóstico
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {totalPages > 1 && (
          <Group justify="space-between" p="md" bg="dark.8">
            <Text size="xs" c="dimmed">
              Exibindo {logs.length} de {total} incidentes registrados
            </Text>
            <Pagination
              total={totalPages}
              value={page}
              onChange={(newPage) => setPage(newPage)}
              size="sm"
              color="sitehub"
            />
          </Group>
        )}
      </Paper>

      {/* Technical Inspection & Solution Modal */}
      <Modal
        opened={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={
          <Group gap="xs">
            <IconBug size={20} color="#FF6B6B" />
            <Text fw={700} c="white">
              Diagnóstico e Inspeção Técnica do Incidente #{selectedLog?.id}
            </Text>
          </Group>
        }
        size="xl"
        radius="md"
        styles={{
          header: { background: 'var(--mantine-color-dark-8)' },
          content: { background: 'var(--mantine-color-dark-7)' },
        }}
      >
        {detailLoading || !selectedLog ? (
          <Box p="xl" style={{ textAlign: 'center' }}>
            <Loader size="md" color="sitehub" />
            <Text size="sm" c="dimmed" mt="xs">
              Carregando dados técnicos completos...
            </Text>
          </Box>
        ) : (
          <Stack gap="md">
            {/* Notifications */}
            {actionSuccess && (
              <Alert color="teal" icon={<IconCheck size={16} />} title="Sucesso" withCloseButton onClose={() => setActionSuccess(null)}>
                {actionSuccess}
              </Alert>
            )}
            {actionError && (
              <Alert color="red" icon={<IconAlertTriangle size={16} />} title="Erro" withCloseButton onClose={() => setActionError(null)}>
                {actionError}
              </Alert>
            )}

            {/* Top Quick Status Strip */}
            <Paper p="sm" radius="md" bg="dark.8" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <Grid gutter="xs" align="center">
                <Grid.Col span={{ base: 6, sm: 2.4 }}>
                  <Text size="xs" c="dimmed">Status Atual:</Text>
                  {getStatusBadge(selectedLog.status)}
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 2.4 }}>
                  <Text size="xs" c="dimmed">Categoria:</Text>
                  {getCategoryBadge(selectedLog.category)}
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 2.4 }}>
                  <Text size="xs" c="dimmed">Gravidade:</Text>
                  {getSeverityBadge(selectedLog.severity)}
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 2.4 }}>
                  <Text size="xs" c="dimmed">Código HTTP:</Text>
                  {getHttpStatusBadge(selectedLog.http_status, selectedLog.curl_error)}
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 2.4 }}>
                  <Text size="xs" c="dimmed">Data do Evento:</Text>
                  <Text size="xs" fw={600} c="white">
                    {formatDateTime(selectedLog.created_at)}
                  </Text>
                </Grid.Col>
              </Grid>
            </Paper>

            {/* Context Information Cards */}
            <Grid gutter="xs">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Paper p="sm" radius="md" bg="dark.8" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                  <Group justify="space-between" mb={4}>
                    <Text size="xs" fw={700} c="dimmed">WEBSITE DO CLIENTE</Text>
                    {selectedLog.website_url && (
                      <ActionIcon
                        component="a"
                        href={selectedLog.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="xs"
                        variant="subtle"
                        color="blue"
                      >
                        <IconExternalLink size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                  <Text size="sm" fw={600} c="white">
                    {selectedLog.website_name || 'Não identificado'}
                  </Text>
                  <Text size="xs" c="dimmed" ff="monospace" lineClamp={1}>
                    {selectedLog.website_url || 'URL não vinculada'}
                  </Text>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Paper p="sm" radius="md" bg="dark.8" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                  <Text size="xs" fw={700} c="dimmed" mb={4}>CONTA DO CLIENTE</Text>
                  <Text size="sm" fw={600} c="white">
                    {selectedLog.user_email || 'Não associado'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ID Usuário: {selectedLog.user_id || 'N/A'} {selectedLog.ip_address ? `• IP: ${selectedLog.ip_address}` : ''}
                  </Text>
                </Paper>
              </Grid.Col>
            </Grid>

            {/* Detailed Tabs */}
            <Tabs defaultValue="diagnosis" variant="outline" radius="md">
              <Tabs.List>
                <Tabs.Tab value="diagnosis" leftSection={<IconInfoCircle size={15} />}>
                  Diagnóstico & Solução
                </Tabs.Tab>
                <Tabs.Tab value="request" leftSection={<IconTerminal2 size={15} />}>
                  Requisição do SaaS
                </Tabs.Tab>
                <Tabs.Tab value="response" leftSection={<IconCode size={15} />}>
                  Resposta Bruta do Servidor
                </Tabs.Tab>
                <Tabs.Tab value="notes" leftSection={<IconFileText size={15} />}>
                  Anotações da Equipe
                </Tabs.Tab>
              </Tabs.List>

              {/* Tab 1: Smart Diagnosis */}
              <Tabs.Panel value="diagnosis" pt="md">
                <Stack gap="md">
                  {selectedLog.suggested_solution ? (
                    <Box
                      p="md"
                      bg="dark.8"
                      style={{
                        borderRadius: 8,
                        border: '1px solid rgba(255, 170, 0, 0.25)',
                        backgroundColor: 'rgba(255, 170, 0, 0.05)',
                      }}
                    >
                      <Group gap="xs" mb="xs">
                        <ThemeIcon color="orange" size="sm" radius="xl">
                          <IconAlertTriangle size={14} />
                        </ThemeIcon>
                        <Text size="sm" fw={700} c="orange.3">
                          Diagnóstico Automatizado da Plataforma Vexors:
                        </Text>
                      </Group>
                      <Text
                        size="xs"
                        c="gray.3"
                        style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}
                      >
                        {selectedLog.suggested_solution}
                      </Text>
                    </Box>
                  ) : (
                    <Alert color="blue" title="Sem sugestão automática">
                      Nenhum padrão específico de firewall ou timeout foi identificado automaticamente.
                    </Alert>
                  )}

                  <Box p="sm" bg="dark.8" style={{ borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <Text size="xs" fw={700} c="dimmed" mb={4}>
                      MENSAGEM DE ERRO CAPTURADA:
                    </Text>
                    <Code block color="red.9" c="red.2">
                      {selectedLog.error_message || 'Nenhuma mensagem reportada'}
                    </Code>
                  </Box>

                  {selectedLog.curl_error && (
                    <Box p="sm" bg="dark.8" style={{ borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <Text size="xs" fw={700} c="dimmed" mb={4}>
                        ERRO DA BIBLIOTECA CURL:
                      </Text>
                      <Code block color="gray.9" c="orange.3">
                        {selectedLog.curl_error}
                      </Code>
                    </Box>
                  )}
                </Stack>
              </Tabs.Panel>

              {/* Tab 2: SaaS Request Parameters */}
              <Tabs.Panel value="request" pt="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <Badge color="blue" variant="filled">
                        {selectedLog.http_method}
                      </Badge>
                      <Text size="xs" ff="monospace" c="white">
                        {selectedLog.endpoint || 'N/A'}
                      </Text>
                    </Group>
                    {selectedLog.request_payload && (
                      <CopyButton value={selectedLog.request_payload} timeout={2000}>
                        {({ copied, copy }) => (
                          <Button size="xs" variant="light" color={copied ? 'teal' : 'gray'} leftSection={<IconCopy size={12} />} onClick={copy}>
                            {copied ? 'Copiado!' : 'Copiar Payload'}
                          </Button>
                        )}
                      </CopyButton>
                    )}
                  </Group>

                  <Box p="sm" bg="dark.8" style={{ borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)', maxHeight: 300, overflowY: 'auto' }}>
                    <Text size="xs" fw={700} c="dimmed" mb={6}>
                      PAYLOAD ENVIADO (PARÂMETROS):
                    </Text>
                    {selectedLog.request_payload ? (
                      <Code block c="gray.3" bg="transparent" style={{ fontSize: 12 }}>
                        {selectedLog.request_payload}
                      </Code>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Nenhum parâmetro no corpo da requisição (método GET ou requisição sem payload).
                      </Text>
                    )}
                  </Box>

                  {selectedLog.user_agent && (
                    <Text size="11px" c="dimmed">
                      <b>User-Agent:</b> {selectedLog.user_agent}
                    </Text>
                  )}
                </Stack>
              </Tabs.Panel>

              {/* Tab 3: Raw Server Response */}
              <Tabs.Panel value="response" pt="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Text size="xs" fw={700} c="dimmed">
                      RESPOSTA BRUTA RETORNADA PELO SERVIDOR DO CLIENTE:
                    </Text>
                    {selectedLog.response_body && (
                      <CopyButton value={selectedLog.response_body} timeout={2000}>
                        {({ copied, copy }) => (
                          <Button size="xs" variant="light" color={copied ? 'teal' : 'gray'} leftSection={<IconCopy size={12} />} onClick={copy}>
                            {copied ? 'Copiado!' : 'Copiar Resposta'}
                          </Button>
                        )}
                      </CopyButton>
                    )}
                  </Group>

                  <Box p="sm" bg="dark.8" style={{ borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)', maxHeight: 350, overflowY: 'auto' }}>
                    {selectedLog.response_body ? (
                      <Code block c="gray.2" bg="transparent" style={{ fontSize: 12, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                        {selectedLog.response_body}
                      </Code>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Nenhuma resposta retornada pelo servidor (Timeout ou queda abrupta na conexão cURL).
                      </Text>
                    )}
                  </Box>
                </Stack>
              </Tabs.Panel>

              {/* Tab 4: Team Notes & Resolution */}
              <Tabs.Panel value="notes" pt="md">
                <Stack gap="md">
                  <Textarea
                    label="Anotações Internas do Suporte / Admin"
                    description="Descreva as ações tomadas com o cliente, links de tickets ou conclusões técnicas."
                    placeholder="Ex: Cliente utilizava Cloudflare com Bot Fight Mode ativo. Instruído a colocar o IP do Vexors na lista de permissões..."
                    minRows={4}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.currentTarget.value)}
                  />

                  <Group justify="flex-end">
                    <Button
                      size="xs"
                      variant="default"
                      onClick={handleSaveNotes}
                      loading={updatingStatus}
                    >
                      Salvar Apenas Anotações
                    </Button>
                  </Group>
                </Stack>
              </Tabs.Panel>
            </Tabs>

            {/* Quick Status Buttons Action Bar */}
            <Paper p="sm" radius="md" bg="dark.8" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <Group justify="space-between" align="center" wrap="wrap">
                <Text size="xs" fw={700} c="dimmed">
                  ALTERAR STATUS DO INCIDENTE:
                </Text>

                <Group gap="xs">
                  {selectedLog.status !== 'investigating' && (
                    <Button
                      size="xs"
                      color="yellow"
                      variant="light"
                      onClick={() => handleUpdateStatus('investigating')}
                      loading={updatingStatus}
                    >
                      Investigando
                    </Button>
                  )}

                  {selectedLog.status !== 'resolved' && (
                    <Button
                      size="xs"
                      color="teal"
                      variant="filled"
                      leftSection={<IconCheck size={14} />}
                      onClick={() => handleUpdateStatus('resolved')}
                      loading={updatingStatus}
                    >
                      Marcar como Resolvido
                    </Button>
                  )}

                  {selectedLog.status !== 'ignored' && (
                    <Button
                      size="xs"
                      color="gray"
                      variant="subtle"
                      onClick={() => handleUpdateStatus('ignored')}
                      loading={updatingStatus}
                    >
                      Ignorar
                    </Button>
                  )}

                  {selectedLog.status !== 'unresolved' && (
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={() => handleUpdateStatus('unresolved')}
                      loading={updatingStatus}
                    >
                      Reabrir Incidente
                    </Button>
                  )}
                </Group>
              </Group>
            </Paper>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
export default PlatformErrorLogsView;
