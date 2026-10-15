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
  Switch,
  NumberInput,
  Button,
  Table,
  Tooltip,
  Divider,
  Alert,
  ThemeIcon,
  Loader,
  Pagination,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconBrain,
  IconActivity,
  IconCoins,
  IconClock,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconDeviceFloppy,
  IconRefresh,
  IconSparkles,
  IconFileCode,
  IconServer,
  IconListCheck,
  IconCalendarEvent,
} from '@tabler/icons-react';
import {
  getUserAiMetrics,
  updateUserAiLimits,
  getUserAiLogs,
  UserAiMetrics,
  UserAiSettings,
  AiUsageLogItem,
  MonthlyAiHistoryItem,
} from '../api';
import { formatDateTime, formatMonthYear } from '../utils/date';

interface UserAiManagementViewProps {
  user: {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'user';
    is_active?: number;
    ai_enabled?: number;
    ai_monthly_token_limit?: number | null;
  };
  onBack: () => void;
  readOnly?: boolean;
}

export function UserAiManagementView({
  user: initialUser,
  onBack,
  readOnly = false,
}: UserAiManagementViewProps) {
  const [user, setUser] = useState<UserAiSettings>({
    id: initialUser.id,
    name: initialUser.name,
    email: initialUser.email,
    role: initialUser.role,
    is_active: initialUser.is_active ?? 1,
    ai_enabled: initialUser.ai_enabled ?? 1,
    ai_monthly_token_limit: initialUser.ai_monthly_token_limit ?? null,
  });

  const [metrics, setMetrics] = useState<UserAiMetrics | null>(null);
  const [tokenPrice, setTokenPrice] = useState<number>(0);
  const [currentMonthCost, setCurrentMonthCost] = useState<number>(0);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyAiHistoryItem[]>([]);

  const [logs, setLogs] = useState<AiUsageLogItem[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [savingLimits, setSavingLimits] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form State for AI limits
  const [aiEnabled, setAiEnabled] = useState(Number(initialUser.ai_enabled ?? 1) === 1);
  const [tokenLimit, setTokenLimit] = useState<number | string>(
    initialUser.ai_monthly_token_limit ?? ''
  );

  const loadMetricsAndUser = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await getUserAiMetrics(user.id);
      setUser(res.user);
      setMetrics(res.metrics);
      setTokenPrice(res.token_price_per_1k || 0);
      setCurrentMonthCost(res.current_month_cost || 0);
      setTotalCost(res.total_cost || 0);
      setMonthlyHistory(res.monthly_history || []);
      setAiEnabled(Number(res.user.ai_enabled) === 1);
      setTokenLimit(res.user.ai_monthly_token_limit ?? '');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.messages?.error ||
          err.response?.data?.error ||
          'Erro ao carregar métricas de IA do usuário.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (targetPage: number) => {
    try {
      setLogsLoading(true);
      const offset = (targetPage - 1) * pageSize;
      const res = await getUserAiLogs(user.id, { limit: pageSize, offset });
      setLogs(res.data || []);
      setTotalLogs(res.pagination?.total || 0);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadMetricsAndUser();
    loadLogs(1);
  }, [user.id]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadLogs(newPage);
  };

  const handleSaveLimits = async () => {
    try {
      setSavingLimits(true);
      setSaveSuccess(false);
      setErrorMessage('');

      const parsedLimit =
        tokenLimit === '' || tokenLimit === null || Number(tokenLimit) === 0
          ? null
          : Math.max(0, Number(tokenLimit));

      const res = await updateUserAiLimits(user.id, {
        ai_enabled: aiEnabled ? 1 : 0,
        ai_monthly_token_limit: parsedLimit,
      });

      setUser(res.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.messages?.error ||
          err.response?.data?.error ||
          'Erro ao salvar configurações de IA.'
      );
    } finally {
      setSavingLimits(false);
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'single_check':
        return { label: 'Solução Individual', icon: <IconSparkles size={14} />, color: 'teal' };
      case 'batch_check':
        return { label: 'Lote de Soluções', icon: <IconListCheck size={14} />, color: 'cyan' };
      case 'server_guide':
        return { label: 'Guia de Servidor', icon: <IconServer size={14} />, color: 'orange' };
      case 'plugin_generation':
        return { label: 'Geração de Plugin', icon: <IconFileCode size={14} />, color: 'grape' };
      default:
        return { label: type, icon: <IconBrain size={14} />, color: 'blue' };
    }
  };

  const formatTokens = (val: number | undefined | null) => {
    if (!val) return '0';
    return Number(val).toLocaleString('pt-BR');
  };

  // Monthly quota calculations
  const monthlyUsed = metrics?.current_month_tokens || 0;
  const monthlyLimit = user.ai_monthly_token_limit;
  const isUnlimited = monthlyLimit === null || monthlyLimit <= 0;
  const percentUsed = isUnlimited ? 0 : Math.min(100, Math.round((monthlyUsed / monthlyLimit) * 100));

  const quotaColor = percentUsed > 90 ? 'red' : percentUsed > 70 ? 'yellow' : 'teal';

  return (
    <Stack gap="lg">
      {/* Top Bar with Navigation and User Information */}
      <Paper p="md" radius="md" bg="dark.8">
        <Group justify="space-between" align="center">
          <Group gap="md">
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconArrowLeft size={16} />}
              onClick={onBack}
            >
              {readOnly ? 'Voltar para o Painel' : 'Voltar para Usuários'}
            </Button>
            <Divider orientation="vertical" />
            <div>
              <Group gap="xs">
                <Title order={3} fw={700}>
                  {readOnly ? 'Meu Consumo de Inteligência Artificial' : user.name}
                </Title>
                <Badge color={user.role === 'admin' ? 'indigo' : 'gray'} variant="light">
                  {user.role === 'admin' ? 'ADMIN' : 'USUÁRIO'}
                </Badge>
                <Badge color={aiEnabled ? 'teal' : 'red'} variant="dot">
                  {aiEnabled ? 'IA ATIVA' : 'IA DESATIVADA'}
                </Badge>
              </Group>
              <Text c="dimmed" size="xs">
                {readOnly ? `${user.name} (${user.email}) • Métricas e histórico auditável de IA` : `${user.email} • ID #${user.id}`}
              </Text>
            </div>
          </Group>

          <Button
            variant="light"
            color="indigo"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={() => {
              loadMetricsAndUser();
              loadLogs(page);
            }}
            loading={loading}
          >
            Atualizar Métricas
          </Button>
        </Group>
      </Paper>

      {errorMessage && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="filled" title="Erro">
          {errorMessage}
        </Alert>
      )}

      {/* Metrics Cards Grid */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card bg="dark.8" padding="lg" radius="md" withBorder style={{ borderColor: '#374151' }}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Consumo Mensal
              </Text>
              <ThemeIcon color={quotaColor} variant="light" size="md">
                <IconCoins size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {formatTokens(monthlyUsed)}{' '}
              <Text component="span" size="sm" c="dimmed" fw={400}>
                {isUnlimited ? 'tokens (Ilimitado)' : `/ ${formatTokens(monthlyLimit)}`}
              </Text>
            </Text>
            {tokenPrice > 0 && (
              <Text size="xs" c="teal.4" fw={600} mt={2}>
                ~ {currentMonthCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            )}
            {!isUnlimited ? (
              <Stack gap={4} mt="xs">
                <Progress value={percentUsed} color={quotaColor} size="sm" radius="xl" />
                <Group justify="space-between">
                  <Text size="xs" c={quotaColor} fw={600}>
                    {percentUsed}% utilizado
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatTokens(Math.max(0, (monthlyLimit || 0) - monthlyUsed))} restantes
                  </Text>
                </Group>
              </Stack>
            ) : (
              <Text size="xs" c="teal" mt="xs">
                Sem cota máxima definida
              </Text>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card bg="dark.8" padding="lg" radius="md" withBorder style={{ borderColor: '#374151' }}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Total de Requisições
              </Text>
              <ThemeIcon color="indigo" variant="light" size="md">
                <IconActivity size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {metrics ? formatTokens(metrics.total_requests) : '0'}
            </Text>
            <Group gap="xs" mt="xs">
              <Badge size="xs" color="teal" variant="light">
                {metrics ? formatTokens(metrics.successful_requests) : 0} Sucessos
              </Badge>
              {metrics && metrics.failed_requests > 0 && (
                <Badge size="xs" color="red" variant="light">
                  {formatTokens(metrics.failed_requests)} Falhas
                </Badge>
              )}
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card bg="dark.8" padding="lg" radius="md" withBorder style={{ borderColor: '#374151' }}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Tokens Acumulados
              </Text>
              <ThemeIcon color="cyan" variant="light" size="md">
                <IconBrain size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {metrics ? formatTokens(metrics.total_tokens) : '0'}
            </Text>
            {tokenPrice > 0 && (
              <Text size="xs" c="teal.4" fw={600} mt={2}>
                Total: {totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            )}
            <Text size="xs" c="dimmed" mt="xs">
              Prompt: {metrics ? formatTokens(metrics.total_prompt_tokens) : 0} | Saída:{' '}
              {metrics ? formatTokens(metrics.total_completion_tokens) : 0}
            </Text>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card bg="dark.8" padding="lg" radius="md" withBorder style={{ borderColor: '#374151' }}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Latência Média
              </Text>
              <ThemeIcon color="violet" variant="light" size="md">
                <IconClock size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {metrics && metrics.avg_duration_ms > 0
                ? `${(metrics.avg_duration_ms / 1000).toFixed(1)}s`
                : '—'}
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              Tempo de resposta da IA
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Governance & Limits Configuration Card */}
      {readOnly ? (
        <Paper p="lg" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
          <Group justify="space-between" align="center">
            <div>
              <Title order={4} mb={4}>
                Status da Conta e Política de Cota de IA
              </Title>
              <Text c="dimmed" size="sm">
                Informações de permissão e cota mensal estabelecidas para seu usuário. Para solicitar alterações ou aumento de limite, contate o administrador da plataforma.
              </Text>
            </div>
            <Group gap="sm">
              <Badge color={aiEnabled ? 'teal' : 'red'} size="lg" variant="light">
                {aiEnabled ? 'Recursos de IA Habilitados' : 'Recursos de IA Desativados'}
              </Badge>
              <Badge color={isUnlimited ? 'indigo' : 'cyan'} size="lg" variant="outline">
                {isUnlimited ? 'Cota Mensal: Ilimitada' : `Cota Mensal: ${formatTokens(monthlyLimit)} tokens`}
              </Badge>
            </Group>
          </Group>
        </Paper>
      ) : (
        <Paper p="xl" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
          <Title order={4} mb="xs">
            Regras de Acesso e Limites de Consumo
          </Title>
          <Text c="dimmed" size="sm" mb="lg">
            Controle permissões de uso de Inteligência Artificial e estabeleça limites mensais de tokens para este usuário.
          </Text>

          <Grid gutter="lg" align="flex-end">
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Switch
                label="Habilitar Recursos de Inteligência Artificial"
                description="Quando desativado, o usuário não poderá gerar correções automáticas nem guias de servidor com IA."
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.currentTarget.checked)}
                color="indigo"
                size="md"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <NumberInput
                label="Limite Mensal de Tokens"
                description="Defina 0 ou deixe em branco para cota ilimitada."
                placeholder="Ex: 50000"
                min={0}
                step={10000}
                thousandSeparator="."
                decimalSeparator=","
                value={tokenLimit}
                onChange={(val) => setTokenLimit(val)}
                disabled={!aiEnabled}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 3 }}>
              <Button
                color="indigo"
                fullWidth
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSaveLimits}
                loading={savingLimits}
              >
                Salvar Limites
              </Button>
            </Grid.Col>
          </Grid>

          {/* Quick limit presets */}
          {aiEnabled && (
            <Group gap="xs" mt="sm">
              <Text size="xs" c="dimmed">
                Atalhos de Cota:
              </Text>
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setTokenLimit(25000)}>
                25k
              </Button>
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setTokenLimit(50000)}>
                50k
              </Button>
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setTokenLimit(100000)}>
                100k
              </Button>
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setTokenLimit(250000)}>
                250k
              </Button>
              <Button size="compact-xs" variant="subtle" color="indigo" onClick={() => setTokenLimit('')}>
                Ilimitado
              </Button>
            </Group>
          )}

          {saveSuccess && (
            <Alert icon={<IconCheck size={16} />} color="teal" variant="light" mt="md">
              Limites de IA do usuário atualizados com sucesso!
            </Alert>
          )}
        </Paper>
      )}

      {/* Breakdown by Action Type */}
      {metrics?.by_action && metrics.by_action.length > 0 && (
        <Paper p="md" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
          <Text fw={600} size="sm" mb="sm">
            Consumo por Funcionalidade
          </Text>
          <Group gap="md">
            {metrics.by_action.map((act) => {
              const info = getActionLabel(act.action_type);
              return (
                <Card
                  key={act.action_type}
                  bg="dark.7"
                  p="xs"
                  radius="sm"
                  withBorder
                  style={{ minWidth: 180, borderColor: '#4b5563' }}
                >
                  <Group gap="xs" mb={4}>
                    <Badge color={info.color} size="xs" leftSection={info.icon} variant="light">
                      {info.label}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      {act.count} chamada(s)
                    </Text>
                    <Text size="xs" fw={700}>
                      {formatTokens(act.tokens)} tokens
                    </Text>
                  </Group>
                </Card>
              );
            })}
          </Group>
        </Paper>
      )}

      {/* Monthly Consumption History Table */}
      <Paper p="xl" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
        <Group justify="space-between" mb="md">
          <div>
            <Group gap="xs">
              <ThemeIcon color="indigo" variant="light" size="md">
                <IconCalendarEvent size={18} />
              </ThemeIcon>
              <Title order={4}>Histórico Mensal de Consumo</Title>
            </Group>
            <Text c="dimmed" size="xs" mt={2}>
              Consolidação mês a mês (janeiro, fevereiro, março...) mantida permanentemente para faturamento e auditoria.
            </Text>
          </div>
          {tokenPrice > 0 ? (
            <Badge color="teal" variant="light" size="sm">
              Tarifa: {tokenPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / 1.000 tokens
            </Badge>
          ) : (
            <Badge color="gray" variant="light" size="sm">
              Sem tarifa cadastrada
            </Badge>
          )}
        </Group>

        <Table highlightOnHover verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Mês de Referência</Table.Th>
              <Table.Th>Requisições</Table.Th>
              <Table.Th>Tokens Prompt</Table.Th>
              <Table.Th>Tokens Saída</Table.Th>
              <Table.Th>Total Tokens</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Custo Estimado (R$)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {monthlyHistory.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} align="center" py="md">
                  <Text c="dimmed" size="sm">
                    Nenhum registro mensal de consumo até o momento.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              monthlyHistory.map((item) => (
                <Table.Tr key={item.year_month}>
                  <Table.Td>
                    <Badge variant="outline" color="indigo" size="sm">
                      {formatMonthYear(item.year_month, 'long')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" fw={500}>
                      {item.total_requests} chamada(s){' '}
                      <Text component="span" size="xs" c="dimmed">
                        ({item.successful_requests} ok)
                      </Text>
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {formatTokens(item.prompt_tokens)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {formatTokens(item.completion_tokens)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" fw={700}>
                      {formatTokens(item.total_tokens)}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" fw={700} c={item.estimated_cost > 0 ? 'teal.4' : 'dimmed'}>
                      {item.estimated_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Telemetry Logs Table */}
      <Paper p="xl" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
        <Group justify="space-between" mb="md">
          <div>
            <Title order={4}>Histórico de Utilização de IA</Title>
            <Text c="dimmed" size="xs">
              Registro auditável de cada chamada realizada pelo usuário para os modelos de IA.
            </Text>
          </div>
          <Text size="xs" c="dimmed">
            Total registrado: {totalLogs} chamada(s)
          </Text>
        </Group>

        <Table highlightOnHover verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data / Hora</Table.Th>
              <Table.Th>Ação</Table.Th>
              <Table.Th>Website Relacionado</Table.Th>
              <Table.Th>Modelo</Table.Th>
              <Table.Th>Tokens</Table.Th>
              <Table.Th>Duração</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {logsLoading ? (
              <Table.Tr>
                <Table.Td colSpan={7} align="center" py="xl">
                  <Group justify="center" gap="xs">
                    <Loader size="xs" color="indigo" />
                    <Text size="sm" c="dimmed">
                      Carregando logs de telemetria...
                    </Text>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ) : logs.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7} align="center" py="xl">
                  <Text c="dimmed" size="sm">
                    Nenhum registro de uso de IA encontrado para este usuário.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              logs.map((log) => {
                const actionInfo = getActionLabel(log.action_type);
                const isSuccess = log.status === 'success';

                return (
                  <Table.Tr key={log.id}>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      <Text size="xs">{formatDateTime(log.created_at)}</Text>
                    </Table.Td>

                    <Table.Td>
                      <Badge
                        color={actionInfo.color}
                        variant="light"
                        size="xs"
                        leftSection={actionInfo.icon}
                      >
                        {actionInfo.label}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      {log.website_url ? (
                        <Text size="xs" fw={500}>
                          {log.website_name || log.website_url}
                        </Text>
                      ) : (
                        <Text size="xs" c="dimmed">
                          Catálogo Geral / Sistema
                        </Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      <Badge variant="outline" color="gray" size="xs">
                        {log.model}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      <Tooltip
                        label={`Prompt: ${formatTokens(log.prompt_tokens)} | Saída: ${formatTokens(
                          log.completion_tokens
                        )}`}
                      >
                        <Text size="xs" fw={600}>
                          {formatTokens(log.total_tokens)}
                        </Text>
                      </Tooltip>
                    </Table.Td>

                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {log.duration_ms > 0 ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </Text>
                    </Table.Td>

                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      {isSuccess ? (
                        <Badge
                          color="teal"
                          variant="light"
                          size="sm"
                          leftSection={<IconCheck size={12} stroke={2.5} />}
                        >
                          Sucesso
                        </Badge>
                      ) : (
                        <Tooltip label={log.error_message || 'Erro desconhecido'} withArrow>
                          <Badge
                            color="red"
                            variant="light"
                            size="sm"
                            leftSection={<IconX size={12} stroke={2.5} />}
                            style={{ cursor: 'pointer' }}
                          >
                            Falha
                          </Badge>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>

        {/* Pagination */}
        {totalLogs > pageSize && (
          <Group justify="center" mt="lg">
            <Pagination
              value={page}
              onChange={handlePageChange}
              total={Math.ceil(totalLogs / pageSize)}
              color="indigo"
              size="sm"
            />
          </Group>
        )}
      </Paper>
    </Stack>
  );
}
