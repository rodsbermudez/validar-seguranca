import { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Text,
  Badge,
  Group,
  Stack,
  Grid,
  Card,
  Progress,
  Button,
  Table,
  Tooltip,
  Divider,
  Alert,
  ThemeIcon,
  Loader,
  Pagination,
  Tabs,
  TextInput,
  Select,
} from '@mantine/core';
import {
  IconBrain,
  IconCoins,
  IconActivity,
  IconClock,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconRefresh,
  IconUsers,
  IconWorld,
  IconChartBar,
  IconListCheck,
  IconSearch,
  IconArrowRight,
  IconSettings,
  IconFileCode,
  IconServer,
  IconSparkles,
} from '@tabler/icons-react';
import {
  getGlobalAiMetrics,
  getGlobalAiLogs,
  GlobalAiMetricsResponse,
  GlobalAiLogItem,
} from '../api';
import { formatDateTime, formatMonthYear } from '../utils/date';

interface GlobalAiMonitoringViewProps {
  onManageUser: (user: any) => void;
  onNavigateSettings?: () => void;
}

export function GlobalAiMonitoringView({
  onManageUser,
  onNavigateSettings,
}: GlobalAiMonitoringViewProps) {
  const [data, setData] = useState<GlobalAiMetricsResponse | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<string | null>('users');

  // Users filter
  const [userSearch, setUserSearch] = useState('');

  // Websites filter
  const [websiteSearch, setWebsiteSearch] = useState('');

  // Logs state & filters
  const [logs, setLogs] = useState<GlobalAiLogItem[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit] = useState(25);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsStatusFilter, setLogsStatusFilter] = useState<string | null>(null);
  const [logsActionFilter, setLogsActionFilter] = useState<string | null>(null);

  const formatTokens = (num: number) => {
    return Number(num || 0).toLocaleString('pt-BR');
  };

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const loadMetrics = async (monthToLoad?: string) => {
    try {
      setLoading(true);
      setErrorMessage('');
      const targetMonth = monthToLoad || selectedMonth;
      const res = await getGlobalAiMetrics(targetMonth);
      setData(res);
      if (res.selected_month) {
        setSelectedMonth(res.selected_month);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.messages?.error ||
          err.response?.data?.error ||
          'Erro ao carregar dados consolidados de monitoramento de IA.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (pageToLoad: number) => {
    try {
      setLogsLoading(true);
      const res = await getGlobalAiLogs({
        page: pageToLoad,
        limit: logsLimit,
        month: selectedMonth,
        search: logsSearch || undefined,
        status: logsStatusFilter || undefined,
        action_type: logsActionFilter || undefined,
      });
      setLogs(res.data || []);
      setLogsTotal(res.total || 0);
      setLogsTotalPages(res.total_pages || 1);
      setLogsPage(res.page || 1);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    loadLogs(1);
  }, [selectedMonth, logsStatusFilter, logsActionFilter]);

  const handleSearchLogsSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLogsPage(1);
    loadLogs(1);
  };

  // Month selector options
  const monthOptions = (() => {
    const months = new Set<string>();
    const current = new Date().toISOString().substring(0, 7);
    months.add(current);
    if (data?.monthly_history) {
      data.monthly_history.forEach((h) => months.add(h.year_month));
    }
    const sorted = Array.from(months).sort().reverse();
    return sorted.map((m) => ({
      value: m,
      label: formatMonthYear(m),
    }));
  })();

  const monthMetrics = data?.month_metrics;
  const allTimeMetrics = data?.all_time_metrics;
  const tokenPrice = data?.token_price_per_1k || 0;

  // Filtered users
  const filteredUsers = (data?.users_summary || []).filter((u) => {
    if (!userSearch) return true;
    const term = userSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });

  // Filtered websites
  const filteredWebsites = (data?.websites_summary || []).filter((w) => {
    if (!websiteSearch) return true;
    const term = websiteSearch.toLowerCase();
    return (
      w.name.toLowerCase().includes(term) ||
      w.url.toLowerCase().includes(term) ||
      w.owner_name.toLowerCase().includes(term) ||
      w.owner_email.toLowerCase().includes(term)
    );
  });

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'single_check':
        return { label: 'Diagnóstico Individual', color: 'blue', icon: <IconSparkles size={12} /> };
      case 'batch_check':
        return { label: 'Diagnóstico em Lote', color: 'indigo', icon: <IconActivity size={12} /> };
      case 'remediation_plugin':
        return { label: 'Plugin de Remediação', color: 'teal', icon: <IconFileCode size={12} /> };
      case 'server_guide':
        return { label: 'Guia de Servidor', color: 'orange', icon: <IconServer size={12} /> };
      default:
        return { label: type, color: 'gray', icon: <IconBrain size={12} /> };
    }
  };

  return (
    <Stack gap="lg">
      {/* Top Header Card */}
      <Paper p="md" radius="md" bg="dark.8">
        <Group justify="space-between" align="center" wrap="wrap">
          <div>
            <Group gap="xs">
              <ThemeIcon color="violet" size="lg" radius="md" variant="light">
                <IconBrain size={22} />
              </ThemeIcon>
              <div>
                <Group gap="xs">
                  <Title order={3} fw={700}>
                    Monitoramento Geral de IA & Custos
                  </Title>
                  <Badge color="violet" variant="light">
                    PAINEL GLOBAL
                  </Badge>
                </Group>
                <Text c="dimmed" size="xs">
                  Acompanhamento de consumo de tokens, estimativas de custos financeiros e auditoria detalhada de todos os usuários.
                </Text>
              </div>
            </Group>
          </div>

          <Group gap="sm" wrap="wrap">
            <Select
              size="sm"
              w={180}
              data={monthOptions}
              value={selectedMonth}
              onChange={(val) => {
                if (val) {
                  setSelectedMonth(val);
                }
              }}
              allowDeselect={false}
              placeholder="Selecione o mês"
            />

            <Tooltip label="Preço base configurado em Configurações Gerais para cálculo de custos">
              <Badge
                size="lg"
                variant="outline"
                color={tokenPrice > 0 ? 'teal' : 'gray'}
                style={{ textTransform: 'none', cursor: 'pointer' }}
                onClick={onNavigateSettings}
              >
                Preço: {tokenPrice > 0 ? `${formatCurrency(tokenPrice)} / 1k` : 'Não definido'}
              </Badge>
            </Tooltip>

            {onNavigateSettings && (
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                leftSection={<IconSettings size={14} />}
                onClick={onNavigateSettings}
              >
                Ajustar Preço
              </Button>
            )}

            <Button
              variant="light"
              color="indigo"
              size="sm"
              leftSection={<IconRefresh size={14} />}
              onClick={() => {
                loadMetrics(selectedMonth);
                loadLogs(logsPage);
              }}
              loading={loading}
            >
              Atualizar
            </Button>
          </Group>
        </Group>
      </Paper>

      {errorMessage && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="filled" title="Erro">
          {errorMessage}
        </Alert>
      )}

      {/* KPI Cards Row */}
      <Grid>
        {/* Month Cost Card */}
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card bg="dark.8" padding="lg" radius="md" withBorder style={{ borderColor: '#374151' }}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Custo do Mês ({formatMonthYear(selectedMonth)})
              </Text>
              <ThemeIcon color="teal" variant="light" size="md">
                <IconCoins size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" c="teal.4">
              {formatCurrency(monthMetrics?.estimated_cost || 0)}
            </Text>
            <Group justify="space-between" mt="xs">
              <Text size="xs" c="dimmed">
                Histórico acumulado:
              </Text>
              <Text size="xs" fw={600} c="gray.3">
                {formatCurrency(allTimeMetrics?.estimated_cost || 0)}
              </Text>
            </Group>
          </Card>
        </Grid.Col>

        {/* Month Tokens Card */}
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card bg="dark.8" padding="lg" radius="md" withBorder style={{ borderColor: '#374151' }}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Tokens no Mês
              </Text>
              <ThemeIcon color="violet" variant="light" size="md">
                <IconBrain size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {formatTokens(monthMetrics?.total_tokens || 0)}
            </Text>
            <Group justify="space-between" mt="xs">
              <Text size="xs" c="dimmed">
                Prompt: {formatTokens(monthMetrics?.total_prompt_tokens || 0)}
              </Text>
              <Text size="xs" c="dimmed">
                Saída: {formatTokens(monthMetrics?.total_completion_tokens || 0)}
              </Text>
            </Group>
          </Card>
        </Grid.Col>

        {/* Requests Card */}
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card bg="dark.8" padding="lg" radius="md" withBorder style={{ borderColor: '#374151' }}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Requisições no Mês
              </Text>
              <ThemeIcon color="blue" variant="light" size="md">
                <IconActivity size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {formatTokens(monthMetrics?.total_requests || 0)}
            </Text>
            <Group gap="xs" mt="xs">
              <Badge size="xs" color="teal" variant="light">
                {formatTokens(monthMetrics?.successful_requests || 0)} Sucessos
              </Badge>
              {monthMetrics && monthMetrics.failed_requests > 0 && (
                <Badge size="xs" color="red" variant="light">
                  {formatTokens(monthMetrics.failed_requests)} Falhas
                </Badge>
              )}
            </Group>
          </Card>
        </Grid.Col>

        {/* Latency & All-Time Total */}
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card bg="dark.8" padding="lg" radius="md" withBorder style={{ borderColor: '#374151' }}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Latência Média & Saúde
              </Text>
              <ThemeIcon color="indigo" variant="light" size="md">
                <IconClock size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {monthMetrics && monthMetrics.avg_duration_ms > 0
                ? `${(monthMetrics.avg_duration_ms / 1000).toFixed(2)}s`
                : '0.00s'}
            </Text>
            <Group justify="space-between" mt="xs">
              <Text size="xs" c="dimmed">
                Total Geral:
              </Text>
              <Badge size="xs" color="gray" variant="outline">
                {formatTokens(allTimeMetrics?.total_tokens || 0)} tokens
              </Badge>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Main Tabs Container */}
      <Paper p="md" radius="md" bg="dark.8">
        <Tabs value={activeTab} onChange={setActiveTab} color="violet" variant="outline">
          <Tabs.List mb="md">
            <Tabs.Tab
              value="users"
              leftSection={<IconUsers size={16} />}
              rightSection={
                <Badge size="xs" color="gray" variant="filled">
                  {data?.users_summary?.length || 0}
                </Badge>
              }
            >
              Consumo por Usuário
            </Tabs.Tab>

            <Tabs.Tab
              value="websites"
              leftSection={<IconWorld size={16} />}
              rightSection={
                <Badge size="xs" color="gray" variant="filled">
                  {data?.websites_summary?.length || 0}
                </Badge>
              }
            >
              Consumo por Website
            </Tabs.Tab>

            <Tabs.Tab value="evolution" leftSection={<IconChartBar size={16} />}>
              Evolução Mensal & Ações
            </Tabs.Tab>

            <Tabs.Tab
              value="logs"
              leftSection={<IconListCheck size={16} />}
              rightSection={
                <Badge size="xs" color="indigo" variant="filled">
                  {logsTotal}
                </Badge>
              }
            >
              Logs Globais de Auditoria
            </Tabs.Tab>
          </Tabs.List>

          {/* TAB 1: USERS */}
          <Tabs.Panel value="users">
            <Stack gap="md">
              <Group justify="space-between">
                <TextInput
                  placeholder="Filtrar por nome ou e-mail de usuário..."
                  leftSection={<IconSearch size={14} />}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.currentTarget.value)}
                  w={{ base: '100%', sm: 340 }}
                  size="sm"
                />
                <Text size="xs" c="dimmed">
                  Mostrando {filteredUsers.length} de {data?.users_summary?.length || 0} usuários
                </Text>
              </Group>

              {loading ? (
                <Group justify="center" p="xl">
                  <Loader size="md" color="violet" />
                </Group>
              ) : filteredUsers.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  Nenhum usuário encontrado com os filtros aplicados.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={900}>
                  <Table verticalSpacing="sm" highlightOnHover striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Usuário</Table.Th>
                        <Table.Th>Status IA</Table.Th>
                        <Table.Th>Plano / Cota Mensal</Table.Th>
                        <Table.Th>Consumo ({formatMonthYear(selectedMonth)})</Table.Th>
                        <Table.Th style={{ width: 180 }}>% Utilizado</Table.Th>
                        <Table.Th>Custo no Mês</Table.Th>
                        <Table.Th>Total Acumulado</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Ações</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredUsers.map((u) => {
                        const hasLimit = u.ai_monthly_token_limit !== null && u.ai_monthly_token_limit > 0;
                        const percent = u.usage_percent !== null ? u.usage_percent : 0;
                        const quotaColor = percent > 90 ? 'red' : percent > 70 ? 'yellow' : 'teal';

                        return (
                          <Table.Tr key={u.id}>
                            <Table.Td>
                              <div>
                                <Group gap="xs">
                                  <Text fw={600} size="sm">
                                    {u.name}
                                  </Text>
                                  <Badge
                                    size="xs"
                                    color={u.role === 'admin' ? 'indigo' : 'gray'}
                                    variant="light"
                                  >
                                    {u.role === 'admin' ? 'ADMIN' : 'USUÁRIO'}
                                  </Badge>
                                </Group>
                                <Text size="xs" c="dimmed">
                                  {u.email}
                                </Text>
                              </div>
                            </Table.Td>

                            <Table.Td>
                              <Badge
                                size="xs"
                                color={u.ai_enabled ? 'teal' : 'red'}
                                variant="dot"
                              >
                                {u.ai_enabled ? 'Ativa' : 'Desativada'}
                              </Badge>
                            </Table.Td>

                            <Table.Td>
                              {hasLimit ? (
                                <Text size="sm" fw={500}>
                                  {formatTokens(u.ai_monthly_token_limit!)} tokens
                                </Text>
                              ) : (
                                <Badge size="xs" color="teal" variant="light">
                                  ILIMITADO
                                </Badge>
                              )}
                            </Table.Td>

                            <Table.Td>
                              <Text size="sm" fw={600}>
                                {formatTokens(u.month_tokens)} tokens
                              </Text>
                            </Table.Td>

                            <Table.Td>
                              {hasLimit ? (
                                <Stack gap={2}>
                                  <Progress
                                    value={Math.min(100, percent)}
                                    color={quotaColor}
                                    size="xs"
                                    radius="xl"
                                  />
                                  <Text size="xs" c={quotaColor} fw={600}>
                                    {percent}%
                                  </Text>
                                </Stack>
                              ) : (
                                <Text size="xs" c="dimmed">
                                  Sem teto
                                </Text>
                              )}
                            </Table.Td>

                            <Table.Td>
                              <Text size="sm" fw={600} c={u.month_cost > 0 ? 'teal.4' : 'dimmed'}>
                                {formatCurrency(u.month_cost)}
                              </Text>
                            </Table.Td>

                            <Table.Td>
                              <Text size="xs" fw={500}>
                                {formatTokens(u.all_time_tokens)} tokens
                              </Text>
                              <Text size="xs" c="dimmed">
                                {formatCurrency(u.all_time_cost)} ({u.total_requests} reqs)
                              </Text>
                            </Table.Td>

                            <Table.Td style={{ textAlign: 'right' }}>
                              <Button
                                size="xs"
                                variant="light"
                                color="violet"
                                rightSection={<IconArrowRight size={12} />}
                                onClick={() => onManageUser(u)}
                              >
                                Gerenciar
                              </Button>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          </Tabs.Panel>

          {/* TAB 2: WEBSITES */}
          <Tabs.Panel value="websites">
            <Stack gap="md">
              <Group justify="space-between">
                <TextInput
                  placeholder="Filtrar por nome de site, URL ou proprietário..."
                  leftSection={<IconSearch size={14} />}
                  value={websiteSearch}
                  onChange={(e) => setWebsiteSearch(e.currentTarget.value)}
                  w={{ base: '100%', sm: 360 }}
                  size="sm"
                />
                <Text size="xs" c="dimmed">
                  Mostrando {filteredWebsites.length} websites com atividade de IA registrada
                </Text>
              </Group>

              {loading ? (
                <Group justify="center" p="xl">
                  <Loader size="md" color="violet" />
                </Group>
              ) : filteredWebsites.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  Nenhum website com atividade de IA encontrado.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={800}>
                  <Table verticalSpacing="sm" highlightOnHover striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Website</Table.Th>
                        <Table.Th>Proprietário</Table.Th>
                        <Table.Th>Reqs no Mês</Table.Th>
                        <Table.Th>Tokens no Mês ({formatMonthYear(selectedMonth)})</Table.Th>
                        <Table.Th>Custo no Mês</Table.Th>
                        <Table.Th>Total Acumulado</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredWebsites.map((w) => (
                        <Table.Tr key={w.id}>
                          <Table.Td>
                            <Group gap="xs">
                              <ThemeIcon color="patropi" variant="light" size="sm">
                                <IconWorld size={14} />
                              </ThemeIcon>
                              <div>
                                <Text fw={600} size="sm">
                                  {w.name}
                                </Text>
                                <Text
                                  component="a"
                                  href={w.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  size="xs"
                                  c="dimmed"
                                >
                                  {w.url}
                                </Text>
                              </div>
                            </Group>
                          </Table.Td>

                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {w.owner_name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {w.owner_email}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Badge size="sm" variant="light" color="blue">
                              {w.month_requests} reqs
                            </Badge>
                          </Table.Td>

                          <Table.Td>
                            <Text size="sm" fw={600}>
                              {formatTokens(w.month_tokens)} tokens
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Text size="sm" fw={600} c={w.month_cost > 0 ? 'teal.4' : 'dimmed'}>
                              {formatCurrency(w.month_cost)}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Text size="xs" fw={500}>
                              {formatTokens(w.all_time_tokens)} tokens
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatCurrency(w.all_time_cost)} ({w.all_time_requests} reqs)
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          </Tabs.Panel>

          {/* TAB 3: EVOLUTION & ACTIONS */}
          <Tabs.Panel value="evolution">
            <Grid gutter="md">
              {/* Monthly Progression */}
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Card bg="dark.7" p="md" radius="md" withBorder style={{ borderColor: '#374151' }}>
                  <Title order={5} fw={600} mb="sm">
                    Histórico de Consumo Mês a Mês
                  </Title>
                  <Text size="xs" c="dimmed" mb="md">
                    Evolução consolidada de requisições, tokens consumidos e custos totais da plataforma.
                  </Text>

                  {(!data?.monthly_history || data.monthly_history.length === 0) ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      Nenhum histórico registrado até o momento.
                    </Text>
                  ) : (
                    <Table.ScrollContainer minWidth={500}>
                      <Table verticalSpacing="xs" striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Mês</Table.Th>
                            <Table.Th>Requisições</Table.Th>
                            <Table.Th>Tokens Totais</Table.Th>
                            <Table.Th>Prompt / Resposta</Table.Th>
                            <Table.Th>Custo Estimado</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {data.monthly_history.map((h) => {
                            const isCurrent = h.year_month === selectedMonth;
                            return (
                              <Table.Tr
                                key={h.year_month}
                                style={isCurrent ? { backgroundColor: 'rgba(139, 92, 246, 0.1)' } : undefined}
                              >
                                <Table.Td>
                                  <Group gap={6}>
                                    <Text fw={600} size="sm">
                                      {formatMonthYear(h.year_month)}
                                    </Text>
                                    {isCurrent && (
                                      <Badge size="xs" color="violet" variant="filled">
                                        SELECIONADO
                                      </Badge>
                                    )}
                                  </Group>
                                </Table.Td>
                                <Table.Td>
                                  <Group gap={4}>
                                    <Text size="sm">{h.total_requests}</Text>
                                    {(h.failed_requests ?? 0) > 0 && (
                                      <Badge size="xs" color="red" variant="dot">
                                        {h.failed_requests} erros
                                      </Badge>
                                    )}
                                  </Group>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm" fw={600}>
                                    {formatTokens(h.total_tokens)}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs" c="dimmed">
                                    {formatTokens(h.prompt_tokens)} / {formatTokens(h.completion_tokens)}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm" fw={600} c="teal.4">
                                    {formatCurrency(h.estimated_cost)}
                                  </Text>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  )}
                </Card>
              </Grid.Col>

              {/* By Action Breakdown */}
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Card bg="dark.7" p="md" radius="md" withBorder style={{ borderColor: '#374151' }}>
                  <Title order={5} fw={600} mb="sm">
                    Consumo por Tipo de Operação
                  </Title>
                  <Text size="xs" c="dimmed" mb="md">
                    Distribuição no mês selecionado ({formatMonthYear(selectedMonth)}).
                  </Text>

                  {(!data?.by_action_month || data.by_action_month.length === 0) ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      Nenhuma operação de IA no mês selecionado.
                    </Text>
                  ) : (
                    <Table verticalSpacing="xs">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Tipo de Ação</Table.Th>
                          <Table.Th>Reqs</Table.Th>
                          <Table.Th>Tokens</Table.Th>
                          <Table.Th>Custo</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {data.by_action_month.map((act) => {
                          const meta = getActionLabel(act.action_type);
                          return (
                            <Table.Tr key={act.action_type}>
                              <Table.Td>
                                <Badge
                                  size="sm"
                                  color={meta.color}
                                  variant="light"
                                  leftSection={meta.icon}
                                >
                                  {meta.label}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{act.count}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" fw={600}>
                                  {formatTokens(act.tokens)}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" fw={600} c="teal.4">
                                  {formatCurrency(act.estimated_cost)}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  )}

                  <Divider my="md" />

                  <Title order={6} fw={600} mb="xs">
                    Totais Históricos por Ação
                  </Title>
                  <Table verticalSpacing="xs">
                    <Table.Tbody>
                      {(data?.by_action_all_time || []).map((act) => {
                        const meta = getActionLabel(act.action_type);
                        return (
                          <Table.Tr key={act.action_type}>
                            <Table.Td>
                              <Badge size="xs" color={meta.color} variant="outline">
                                {meta.label}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">
                                {act.count} reqs
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" fw={500}>
                                {formatTokens(act.tokens)} tok.
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="teal.4">
                                {formatCurrency(act.estimated_cost)}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Card>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          {/* TAB 4: LOGS */}
          <Tabs.Panel value="logs">
            <Stack gap="md">
              <form onSubmit={handleSearchLogsSubmit}>
                <Grid gutter="xs" align="flex-end">
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput
                      size="sm"
                      placeholder="Pesquisar por usuário, site, modelo ou ação..."
                      leftSection={<IconSearch size={14} />}
                      value={logsSearch}
                      onChange={(e) => setLogsSearch(e.currentTarget.value)}
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 6, sm: 2 }}>
                    <Select
                      size="sm"
                      placeholder="Status"
                      data={[
                        { value: '', label: 'Todos os Status' },
                        { value: 'success', label: 'Sucesso' },
                        { value: 'error', label: 'Erro' },
                      ]}
                      value={logsStatusFilter || ''}
                      onChange={(val) => setLogsStatusFilter(val || null)}
                      clearable
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 6, sm: 3 }}>
                    <Select
                      size="sm"
                      placeholder="Tipo de Ação"
                      data={[
                        { value: '', label: 'Todas as Ações' },
                        { value: 'single_check', label: 'Diagnóstico Individual' },
                        { value: 'batch_check', label: 'Diagnóstico em Lote' },
                        { value: 'remediation_plugin', label: 'Plugin de Remediação' },
                        { value: 'server_guide', label: 'Guia de Servidor' },
                      ]}
                      value={logsActionFilter || ''}
                      onChange={(val) => setLogsActionFilter(val || null)}
                      clearable
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 3 }}>
                    <Group justify="flex-end">
                      <Button
                        type="submit"
                        size="sm"
                        color="violet"
                        variant="light"
                        leftSection={<IconSearch size={14} />}
                      >
                        Filtrar Logs
                      </Button>
                      <Button
                        size="sm"
                        variant="subtle"
                        color="gray"
                        onClick={() => {
                          setLogsSearch('');
                          setLogsStatusFilter(null);
                          setLogsActionFilter(null);
                          setLogsPage(1);
                        }}
                      >
                        Limpar
                      </Button>
                    </Group>
                  </Grid.Col>
                </Grid>
              </form>

              {logsLoading ? (
                <Group justify="center" p="xl">
                  <Loader size="md" color="violet" />
                </Group>
              ) : logs.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  Nenhum log encontrado para os critérios selecionados.
                </Text>
              ) : (
                <>
                  <Table.ScrollContainer minWidth={950}>
                    <Table verticalSpacing="xs" striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Data / Hora</Table.Th>
                          <Table.Th>Usuário</Table.Th>
                          <Table.Th>Website</Table.Th>
                          <Table.Th>Ação</Table.Th>
                          <Table.Th>Modelo</Table.Th>
                          <Table.Th>Tokens (Total)</Table.Th>
                          <Table.Th>Custo Est.</Table.Th>
                          <Table.Th>Duração</Table.Th>
                          <Table.Th>Status</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {logs.map((log) => {
                          const actionMeta = getActionLabel(log.action_type);
                          return (
                            <Table.Tr key={log.id}>
                              <Table.Td>
                                <Text size="xs" fw={500}>
                                  {formatDateTime(log.created_at)}
                                </Text>
                              </Table.Td>

                              <Table.Td>
                                <Text size="xs" fw={600}>
                                  {log.user_name || `ID #${log.user_id}`}
                                </Text>
                                {log.user_email && (
                                  <Text size="10px" c="dimmed">
                                    {log.user_email}
                                  </Text>
                                )}
                              </Table.Td>

                              <Table.Td>
                                {log.website_name ? (
                                  <div>
                                    <Text size="xs" fw={500}>
                                      {log.website_name}
                                    </Text>
                                  </div>
                                ) : (
                                  <Text size="xs" c="dimmed">
                                    Global / N/A
                                  </Text>
                                )}
                              </Table.Td>

                              <Table.Td>
                                <Badge
                                  size="xs"
                                  color={actionMeta.color}
                                  variant="light"
                                  leftSection={actionMeta.icon}
                                >
                                  {actionMeta.label}
                                </Badge>
                              </Table.Td>

                              <Table.Td>
                                <Text size="xs" c="dimmed">
                                  {log.model}
                                </Text>
                              </Table.Td>

                              <Table.Td>
                                <Tooltip
                                  label={`Prompt: ${formatTokens(log.prompt_tokens)} | Resposta: ${formatTokens(
                                    log.completion_tokens
                                  )}`}
                                >
                                  <Text size="xs" fw={600}>
                                    {formatTokens(log.total_tokens)}
                                  </Text>
                                </Tooltip>
                              </Table.Td>

                              <Table.Td>
                                <Text size="xs" fw={600} c={log.estimated_cost > 0 ? 'teal.4' : 'dimmed'}>
                                  {formatCurrency(log.estimated_cost)}
                                </Text>
                              </Table.Td>

                              <Table.Td>
                                <Text size="xs" c="dimmed">
                                  {log.duration_ms > 0 ? `${(log.duration_ms / 1000).toFixed(2)}s` : '-'}
                                </Text>
                              </Table.Td>

                              <Table.Td>
                                {log.status === 'success' ? (
                                  <Badge size="xs" color="teal" variant="light" leftSection={<IconCheck size={10} />}>
                                    Sucesso
                                  </Badge>
                                ) : (
                                  <Tooltip label={log.error_message || 'Erro durante execução'}>
                                    <Badge size="xs" color="red" variant="light" leftSection={<IconX size={10} />}>
                                      Erro
                                    </Badge>
                                  </Tooltip>
                                )}
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>

                  <Group justify="space-between" mt="md">
                    <Text size="xs" c="dimmed">
                      Total de {logsTotal} registros • Página {logsPage} de {logsTotalPages}
                    </Text>
                    {logsTotalPages > 1 && (
                      <Pagination
                        value={logsPage}
                        onChange={(p) => {
                          setLogsPage(p);
                          loadLogs(p);
                        }}
                        total={logsTotalPages}
                        color="violet"
                        size="sm"
                      />
                    )}
                  </Group>
                </>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Stack>
  );
}
