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
  Select,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconBrain,
  IconActivity,
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
  IconWorld,
  IconCrown,
  IconReceipt,
  IconTrendingUp,
} from '@tabler/icons-react';
import {
  getUserPlanDetails,
  updateUserPlan,
  getUserAiLogs,
  UserPlanResponse,
  AiUsageLogItem,
} from '../api';
import { formatDateTime, formatMonthYear } from '../utils/date';

export interface UserPlanManagementViewProps {
  user: {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'user';
    is_active?: number;
    plan_id?: number | null;
    ai_enabled?: number;
    ai_monthly_token_limit?: number | null;
  };
  onBack: () => void;
  readOnly?: boolean;
}

export function UserPlanManagementView({
  user: initialUser,
  onBack,
  readOnly = false,
}: UserPlanManagementViewProps) {
  const [data, setData] = useState<UserPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Form State for Admin Editing
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [extraWebsites, setExtraWebsites] = useState<number>(0);
  const [extraWebsitesPrice, setExtraWebsitesPrice] = useState<number>(0);
  const [extraAiTokens, setExtraAiTokens] = useState<number>(0);
  const [extraAiTokensPrice, setExtraAiTokensPrice] = useState<number>(0);
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);

  // Advanced Custom Overrides
  const [useCustomOverrides, setUseCustomOverrides] = useState<boolean>(false);
  const [customMaxWebsites, setCustomMaxWebsites] = useState<number | string>('');
  const [customAiLimit, setCustomAiLimit] = useState<number | string>('');
  const [customPriceMonthly, setCustomPriceMonthly] = useState<number | string>('');

  const [savingPlan, setSavingPlan] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Logs & Pagination State
  const [logs, setLogs] = useState<AiUsageLogItem[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const pageSize = 20;

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await getUserPlanDetails(initialUser.id);
      setData(res);

      const pd = res.plan_details;
      setSelectedPlanId(pd.plan_id ? String(pd.plan_id) : '');
      setExtraWebsites(pd.extra_websites || 0);
      setExtraWebsitesPrice(pd.extra_websites_price || 0);
      setExtraAiTokens(pd.extra_ai_tokens || 0);
      setExtraAiTokensPrice(pd.extra_ai_tokens_price || 0);
      setAiEnabled(Number(pd.ai_enabled) === 1);

      if (pd.custom_max_websites !== null || pd.custom_ai_token_limit !== null || pd.custom_price_monthly !== null) {
        setUseCustomOverrides(true);
        setCustomMaxWebsites(pd.custom_max_websites ?? '');
        setCustomAiLimit(pd.custom_ai_token_limit ?? '');
        setCustomPriceMonthly(pd.custom_price_monthly ?? '');
      } else {
        setUseCustomOverrides(false);
        setCustomMaxWebsites('');
        setCustomAiLimit('');
        setCustomPriceMonthly('');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.messages?.error ||
          err.response?.data?.error ||
          'Erro ao carregar detalhes do plano do usuário.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (pageNum: number) => {
    try {
      setLogsLoading(true);
      const res = await getUserAiLogs(initialUser.id, {
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      });
      setLogs(res.data || []);
      setTotalLogs(res.pagination?.total || 0);
    } catch (err) {
      console.error('Erro ao carregar logs de IA:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadLogs(1);
  }, [initialUser.id]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadLogs(newPage);
  };

  const handleSavePlan = async () => {
    try {
      setSavingPlan(true);
      setSaveSuccess(false);
      setErrorMessage('');

      await updateUserPlan(initialUser.id, {
        plan_id: selectedPlanId ? Number(selectedPlanId) : null,
        extra_websites: Number(extraWebsites) || 0,
        extra_websites_price: Number(extraWebsitesPrice) || 0,
        extra_ai_tokens: Number(extraAiTokens) || 0,
        extra_ai_tokens_price: Number(extraAiTokensPrice) || 0,
        custom_max_websites: useCustomOverrides && customMaxWebsites !== '' ? Number(customMaxWebsites) : null,
        custom_ai_token_limit: useCustomOverrides && customAiLimit !== '' ? Number(customAiLimit) : null,
        custom_price_monthly: useCustomOverrides && customPriceMonthly !== '' ? Number(customPriceMonthly) : null,
        ai_enabled: aiEnabled ? 1 : 0,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.messages?.error ||
          err.response?.data?.error ||
          'Erro ao salvar alterações do plano.'
      );
    } finally {
      setSavingPlan(false);
    }
  };

  const formatTokens = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined || val === '') return '0';
    return Number(val).toLocaleString('pt-BR');
  };

  const formatMoney = (val: number | null | undefined): string => {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'security_scan':
        return { label: 'Auditoria de Segurança', color: 'indigo', icon: <IconActivity size={14} /> };
      case 'auto_remediation':
        return { label: 'Correção Automática', color: 'teal', icon: <IconSparkles size={14} /> };
      case 'generate_plugin':
        return { label: 'Gerador de Plugin', color: 'blue', icon: <IconFileCode size={14} /> };
      case 'generate_server_guide':
        return { label: 'Guia de Servidor', color: 'orange', icon: <IconServer size={14} /> };
      case 'solution_generation':
        return { label: 'Solução Inteligente', color: 'violet', icon: <IconListCheck size={14} /> };
      default:
        return { label: actionType, color: 'gray', icon: <IconBrain size={14} /> };
    }
  };

  const pd = data?.plan_details;
  const currentPlan = data?.available_plans.find((p) => String(p.id) === String(selectedPlanId));

  // Dynamic preview calculations for admin form
  const previewBaseWebsites = currentPlan ? currentPlan.max_websites : null;
  const previewTotalWebsites = previewBaseWebsites !== null ? previewBaseWebsites + Number(extraWebsites || 0) : null;

  const previewBaseAi = currentPlan ? currentPlan.ai_monthly_tokens : 250000;
  const previewTotalAi = previewBaseAi + Number(extraAiTokens || 0);

  const previewBasePrice = currentPlan ? currentPlan.price_monthly : 0;
  const previewTotalPrice = Number(previewBasePrice) + Number(extraWebsitesPrice || 0) + Number(extraAiTokensPrice || 0);

  // Metrics for AI progress
  const monthlyUsed = data?.month_stats?.total_tokens || 0;
  const monthlyLimit = pd?.effective_ai_token_limit || 250000;
  const percentAiUsed = monthlyLimit > 0 ? Math.min(100, Math.round((monthlyUsed / monthlyLimit) * 100)) : 100;
  const aiQuotaColor = percentAiUsed >= 100 ? 'red' : percentAiUsed >= 80 ? 'yellow' : 'teal';

  // Metrics for Websites progress
  const websitesUsed = pd?.websites_count || 0;
  const websitesLimit = pd?.effective_max_websites;
  const isWebsitesUnlimited = pd?.is_websites_unlimited ?? false;
  const percentWebsitesUsed = !isWebsitesUnlimited && websitesLimit && websitesLimit > 0
    ? Math.min(100, Math.round((websitesUsed / websitesLimit) * 100))
    : 0;
  const websitesQuotaColor = percentWebsitesUsed >= 100 ? 'red' : percentWebsitesUsed >= 80 ? 'yellow' : 'blue';

  // Margin calculation
  const monthlyRevenue = pd?.total_monthly_price || 0;
  const currentAiCost = data?.current_month_cost || 0;
  const grossProfit = Math.max(0, monthlyRevenue - currentAiCost);
  const profitMarginPercent = monthlyRevenue > 0 ? Math.round((grossProfit / monthlyRevenue) * 100) : 100;

  return (
    <Stack gap="lg">
      {/* Top Header Card */}
      <Paper p="md" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="sm">
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              leftSection={<IconArrowLeft size={16} />}
              onClick={onBack}
            >
              Voltar
            </Button>
            <Divider orientation="vertical" />
            <div>
              <Group gap="xs" align="center">
                <Title order={3}>
                  {readOnly ? (
                    'Gestão do Plano'
                  ) : (
                    <>
                      Gestão do Plano: <span style={{ color: '#818cf8' }}>{initialUser.name}</span>
                    </>
                  )}
                </Title>
                <Badge
                  color={
                    pd?.is_admin
                      ? 'indigo'
                      : pd?.plan_name === 'Full'
                      ? 'violet'
                      : pd?.plan_name === 'Profissional'
                      ? 'blue'
                      : 'teal'
                  }
                  variant="filled"
                  size="sm"
                >
                  {pd?.is_admin ? 'ADMIN' : pd?.plan_name || 'Iniciante'}
                </Badge>
                {pd && Number(pd.ai_enabled) === 0 && (
                  <Badge color="red" variant="light" size="sm">
                    IA Desativada
                  </Badge>
                )}
              </Group>
              {readOnly ? (
                <Text c="dimmed" size="xs" mt={2}>
                  Acompanhamento de websites, cotas de inteligência artificial e recursos do seu plano.
                </Text>
              ) : (
                <Text c="dimmed" size="xs" mt={2}>
                  {initialUser.email} • Controle unificado de sites contratados, cotas de IA, add-ons e faturamento.
                </Text>
              )}
            </div>
          </Group>

          <Button
            variant="light"
            color="indigo"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={() => {
              loadData();
              loadLogs(page);
            }}
            loading={loading}
          >
            Atualizar Dados
          </Button>
        </Group>
      </Paper>

      {errorMessage && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="filled" title="Erro">
          {errorMessage}
        </Alert>
      )}

      {/* Financial & Plan Overview Cards */}
      <Grid gutter="md">
        {/* Card 1: Mensalidade & Faturamento */}
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card bg="dark.8" padding="lg" radius="md" withBorder style={{ borderColor: '#374151' }} h="100%">
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Faturamento & Mensalidade
              </Text>
              <ThemeIcon color="teal" variant="light" size="md">
                <IconReceipt size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={800} size="26px" c="teal.4">
              {formatMoney(pd?.total_monthly_price)}
              <Text component="span" size="xs" c="dimmed" fw={400} ml={4}>
                /mês
              </Text>
            </Text>

            <Stack gap={3} mt="sm">
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Plano Base ({pd?.plan_name}):
                </Text>
                <Text size="xs" fw={600}>
                  {formatMoney(pd?.base_price)}
                </Text>
              </Group>
              {pd && pd.extra_websites > 0 && (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Sites Extras (+{pd.extra_websites}):
                  </Text>
                  <Text size="xs" fw={600} c="cyan.4">
                    +{formatMoney(pd.extra_websites_price)}
                  </Text>
                </Group>
              )}
              {pd && pd.extra_ai_tokens > 0 && (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    IA Extra (+{formatTokens(pd.extra_ai_tokens)}):
                  </Text>
                  <Text size="xs" fw={600} c="violet.4">
                    +{formatMoney(pd.extra_ai_tokens_price)}
                  </Text>
                </Group>
              )}
              {!readOnly && (
                <>
                  <Divider my={4} color="dark.6" />
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      Custo IA no Mês:
                    </Text>
                    <Text size="xs" fw={600} c="orange.4">
                      ~ {formatMoney(currentAiCost)}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs" c="teal.4" fw={700}>
                      Margem Líquida Est.:
                    </Text>
                    <Text size="xs" fw={700} c="teal.4">
                      {formatMoney(grossProfit)} ({profitMarginPercent}%)
                    </Text>
                  </Group>
                </>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        {/* Card 2: Websites Contratados */}
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card bg="dark.8" padding="lg" radius="md" withBorder style={{ borderColor: '#374151' }} h="100%">
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Websites Contratados
              </Text>
              <ThemeIcon color="blue" variant="light" size="md">
                <IconWorld size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={800} size="26px" c="blue.4">
              {websitesUsed}{' '}
              <Text component="span" size="sm" c="dimmed" fw={400}>
                {isWebsitesUnlimited ? 'sites (Ilimitado)' : `/ ${websitesLimit} sites`}
              </Text>
            </Text>

            {!isWebsitesUnlimited ? (
              <Stack gap={4} mt="sm">
                <Progress value={percentWebsitesUsed} color={websitesQuotaColor} size="sm" radius="xl" />
                <Group justify="space-between">
                  <Text size="xs" c={websitesQuotaColor} fw={600}>
                    {percentWebsitesUsed}% utilizado
                  </Text>
                  <Text size="xs" c="dimmed">
                    {pd?.websites_remaining ?? 0} disponível(is)
                  </Text>
                </Group>
                {pd?.extra_websites ? (
                  <Text size="11px" c="dimmed" mt={2}>
                    Inclui {pd.base_max_websites} do plano base + {pd.extra_websites} adicionais contratados.
                  </Text>
                ) : null}
              </Stack>
            ) : (
              <Text size="xs" c="teal" mt="sm">
                Sem limite de websites para este plano.
              </Text>
            )}
          </Card>
        </Grid.Col>

        {/* Card 3: Cota de Inteligência Artificial */}
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card bg="dark.8" padding="lg" radius="md" withBorder style={{ borderColor: '#374151' }} h="100%">
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Cota Mensal de IA
              </Text>
              <ThemeIcon color="violet" variant="light" size="md">
                <IconBrain size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={800} size="26px" c="violet.4">
              {formatTokens(monthlyUsed)}{' '}
              <Text component="span" size="sm" c="dimmed" fw={400}>
                / {formatTokens(monthlyLimit)} tokens
              </Text>
            </Text>

            {pd && Number(pd.ai_enabled) === 1 ? (
              <Stack gap={4} mt="sm">
                <Progress value={percentAiUsed} color={aiQuotaColor} size="sm" radius="xl" />
                <Group justify="space-between">
                  <Text size="xs" c={aiQuotaColor} fw={600}>
                    {percentAiUsed}% consumido
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatTokens(Math.max(0, monthlyLimit - monthlyUsed))} restantes
                  </Text>
                </Group>
                <Text size="11px" c="dimmed" mt={2}>
                  Teto estrito de segurança contra custos excessivos de API.
                </Text>
              </Stack>
            ) : (
              <Text size="xs" c="red" mt="sm">
                IA desabilitada para esta conta.
              </Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* Plan & Add-ons Configuration Form (Admin Only) */}
      {!readOnly && (
        <Paper p="xl" radius="md" bg="dark.8" withBorder style={{ borderColor: '#4338ca' }}>
          <Group justify="space-between" mb="md">
            <div>
              <Group gap="xs">
                <ThemeIcon color="indigo" variant="filled" size="md">
                  <IconCrown size={18} />
                </ThemeIcon>
                <Title order={4}>Configuração do Plano & Add-ons do Cliente</Title>
              </Group>
              <Text c="dimmed" size="xs" mt={2}>
                Selecione o pacote contratado e defina opcionais de sites extras ou cota extra de IA com seus respectivos valores.
              </Text>
            </div>
            <Switch
              label="Inteligência Artificial Habilitada"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.currentTarget.checked)}
              color="indigo"
              size="sm"
            />
          </Group>

          <Grid gutter="md">
            {/* Seletor de Plano Base */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Select
                label="Plano Base Contratado"
                description="Pacote comercial de referência."
                data={(data?.available_plans || []).map((p) => ({
                  value: String(p.id),
                  label: `${p.name} (${p.max_websites ? `${p.max_websites} sites` : 'Sites Ilim.'} • ${(Number(p.ai_monthly_tokens) / 1000).toLocaleString('pt-BR')}k IA • ${formatMoney(p.price_monthly)})`,
                }))}
                value={selectedPlanId}
                onChange={(val) => setSelectedPlanId(val || '')}
              />
            </Grid.Col>

            {/* Add-on Websites: Quantidade e Valor */}
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Card bg="dark.7" p="sm" radius="sm" withBorder style={{ borderColor: '#374151' }}>
                <Text size="xs" fw={700} c="cyan.4" mb={6}>
                  ADD-ON: WEBSITES EXTRAS
                </Text>
                <Grid gutter="xs">
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Sites Extras (+)"
                      min={0}
                      max={200}
                      step={1}
                      value={extraWebsites}
                      onChange={(val) => setExtraWebsites(Number(val) || 0)}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Valor Extra (R$)"
                      min={0}
                      step={10}
                      decimalScale={2}
                      thousandSeparator="."
                      decimalSeparator=","
                      prefix="R$ "
                      value={extraWebsitesPrice}
                      onChange={(val) => setExtraWebsitesPrice(Number(val) || 0)}
                    />
                  </Grid.Col>
                </Grid>
              </Card>
            </Grid.Col>

            {/* Add-on IA: Tokens e Valor */}
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Card bg="dark.7" p="sm" radius="sm" withBorder style={{ borderColor: '#374151' }}>
                <Text size="xs" fw={700} c="violet.4" mb={6}>
                  ADD-ON: COTA EXTRA DE IA
                </Text>
                <Grid gutter="xs">
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Tokens Extras (+)"
                      min={0}
                      max={10000000}
                      step={50000}
                      thousandSeparator="."
                      decimalSeparator=","
                      value={extraAiTokens}
                      onChange={(val) => setExtraAiTokens(Number(val) || 0)}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Valor Extra (R$)"
                      min={0}
                      step={10}
                      decimalScale={2}
                      thousandSeparator="."
                      decimalSeparator=","
                      prefix="R$ "
                      value={extraAiTokensPrice}
                      onChange={(val) => setExtraAiTokensPrice(Number(val) || 0)}
                    />
                  </Grid.Col>
                </Grid>
              </Card>
            </Grid.Col>
          </Grid>

          {/* Quick Add-on Presets */}
          <Group gap="xs" mt="sm">
            <Text size="xs" c="dimmed">
              Atalhos de Add-on de IA:
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                setExtraAiTokens(100000);
                if (extraAiTokensPrice === 0) setExtraAiTokensPrice(25);
              }}
            >
              +100k
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                setExtraAiTokens(250000);
                if (extraAiTokensPrice === 0) setExtraAiTokensPrice(45);
              }}
            >
              +250k
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                setExtraAiTokens(500000);
                if (extraAiTokensPrice === 0) setExtraAiTokensPrice(80);
              }}
            >
              +500k
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                setExtraAiTokens(1000000);
                if (extraAiTokensPrice === 0) setExtraAiTokensPrice(150);
              }}
            >
              +1M
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="red"
              onClick={() => {
                setExtraAiTokens(0);
                setExtraAiTokensPrice(0);
              }}
            >
              Zerar Add-on IA
            </Button>
          </Group>

          {/* Real-time Dynamic Preview Alert */}
          <Alert
            color="indigo"
            variant="light"
            mt="md"
            icon={<IconTrendingUp size={16} />}
            title="Prévia do Total Efetivo após Salvar:"
          >
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="lg">
                <Text size="sm">
                  Websites:{' '}
                  <b>
                    {previewTotalWebsites !== null ? `${previewTotalWebsites} sites` : 'Ilimitado'}
                  </b>{' '}
                  {extraWebsites > 0 && `(${previewBaseWebsites} base + ${extraWebsites} add-on)`}
                </Text>
                <Text size="sm">
                  IA Mensal: <b>{formatTokens(previewTotalAi)} tokens</b>{' '}
                  {extraAiTokens > 0 && `(${formatTokens(previewBaseAi)} base + ${formatTokens(extraAiTokens)} add-on)`}
                </Text>
                <Text size="sm">
                  Mensalidade: <b style={{ color: '#10b981' }}>{formatMoney(previewTotalPrice)}/mês</b>
                </Text>
              </Group>

              <Button
                color="indigo"
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSavePlan}
                loading={savingPlan}
              >
                Salvar Alterações do Plano
              </Button>
            </Group>
          </Alert>

          {saveSuccess && (
            <Alert icon={<IconCheck size={16} />} color="teal" variant="light" mt="md">
              Plano e adicionais do usuário atualizados com sucesso!
            </Alert>
          )}
        </Paper>
      )}

      {/* User's Websites List */}
      <Paper p="md" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
        <Group justify="space-between" mb="sm">
          <div>
            <Group gap="xs">
              <ThemeIcon color="blue" variant="light" size="md">
                <IconWorld size={18} />
              </ThemeIcon>
              <Title order={4}>Websites em Monitoramento ({data?.websites?.length || 0})</Title>
            </Group>
            <Text c="dimmed" size="xs" mt={2}>
              Sites vinculados diretamente a esta conta.
            </Text>
          </div>
        </Group>

        {data?.websites && data.websites.length > 0 ? (
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Nome do Site</Table.Th>
                <Table.Th>URL</Table.Th>
                <Table.Th>Ambiente</Table.Th>
                <Table.Th>Conexão com Plugin</Table.Th>
                <Table.Th>Data de Cadastro</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.websites.map((site) => (
                <Table.Tr key={site.id}>
                  <Table.Td>{site.id}</Table.Td>
                  <Table.Td fw={600}>{site.name}</Table.Td>
                  <Table.Td>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#60a5fa', textDecoration: 'none' }}
                    >
                      {site.url}
                    </a>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color="gray" variant="light">
                      {site.environment}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="xs"
                      color={Number(site.is_connected) === 1 ? 'teal' : 'orange'}
                      variant="dot"
                    >
                      {Number(site.is_connected) === 1 ? 'Conectado' : 'Aguardando Ativação'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{site.created_at ? formatDateTime(site.created_at) : '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed" size="sm" ta="center" py="md">
            Nenhum website cadastrado para este usuário até o momento.
          </Text>
        )}
      </Paper>

      {/* Breakdown by Action Type */}
      {data?.metrics?.by_action && data.metrics.by_action.length > 0 && (
        <Paper p="md" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
          <Text fw={600} size="sm" mb="sm">
            Consumo de IA por Funcionalidade
          </Text>
          <Group gap="md">
            {data.metrics.by_action.map((act) => {
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
              <Title order={4}>Histórico Mensal de Consumo de IA</Title>
            </Group>
            <Text c="dimmed" size="xs" mt={2}>
              Consolidação mês a mês (janeiro, fevereiro, março...) do consumo de tokens de inteligência artificial.
            </Text>
          </div>
        </Group>

        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Mês de Referência</Table.Th>
              <Table.Th>Requisições</Table.Th>
              <Table.Th>Tokens de Entrada (Prompt)</Table.Th>
              <Table.Th>Tokens de Saída (Completion)</Table.Th>
              <Table.Th>Total de Tokens</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.monthly_history && data.monthly_history.length > 0 ? (
              data.monthly_history.map((row) => (
                <Table.Tr key={row.year_month}>
                  <Table.Td fw={600}>{formatMonthYear(row.year_month, 'long')}</Table.Td>
                  <Table.Td>
                    <Badge size="xs" color="indigo" variant="light">
                      {row.total_requests} requisições
                    </Badge>
                  </Table.Td>
                  <Table.Td>{formatTokens(row.prompt_tokens)}</Table.Td>
                  <Table.Td>{formatTokens(row.completion_tokens)}</Table.Td>
                  <Table.Td fw={700}>{formatTokens(row.total_tokens)}</Table.Td>
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={5} align="center">
                  Nenhum registro de uso de IA encontrado para este usuário.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Detailed AI Logs Table */}
      <Paper p="xl" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
        <Group justify="space-between" mb="md">
          <div>
            <Title order={4}>Logs de Execução de IA</Title>
            <Text c="dimmed" size="xs">
              Registro detalhado das chamadas de API feitas no escopo deste usuário.
            </Text>
          </div>
          <Badge color="gray" variant="light">
            Total: {totalLogs} registros
          </Badge>
        </Group>

        {logsLoading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" color="indigo" />
            <Text size="sm" c="dimmed">
              Carregando histórico detalhado...
            </Text>
          </Group>
        ) : (
          <>
            <Table verticalSpacing="xs" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data & Hora</Table.Th>
                  <Table.Th>Funcionalidade</Table.Th>
                  <Table.Th>Website</Table.Th>
                  <Table.Th>Tokens (Total / Prompt / Compl.)</Table.Th>
                  <Table.Th>Tempo</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {logs.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6} align="center">
                      Nenhum log encontrado.
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  logs.map((log) => {
                    const actionInfo = getActionLabel(log.action_type);
                    return (
                      <Table.Tr key={log.id}>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          <Group gap={6}>
                            <IconClock size={13} color="#9ca3af" />
                            <Text size="xs">{formatDateTime(log.created_at)}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={actionInfo.color}
                            size="xs"
                            variant="light"
                            leftSection={actionInfo.icon}
                          >
                            {actionInfo.label}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {log.website_name ? (
                            <Text size="xs" fw={500}>
                              {log.website_name}
                            </Text>
                          ) : (
                            <Text size="xs" c="dimmed">
                              Global / N/A
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Text size="xs" fw={600}>
                              {formatTokens(log.total_tokens)}
                            </Text>
                            <Text size="11px" c="dimmed">
                              ({formatTokens(log.prompt_tokens)} in / {formatTokens(log.completion_tokens)} out)
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {log.status === 'success' ? (
                            <Badge color="teal" size="xs" variant="light" leftSection={<IconCheck size={10} />}>
                              Sucesso
                            </Badge>
                          ) : (
                            <Tooltip label={log.error_message || 'Erro desconhecido'} multiline w={300}>
                              <Badge color="red" size="xs" variant="light" leftSection={<IconX size={10} />}>
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

            {totalLogs > pageSize && (
              <Group justify="center" mt="lg">
                <Pagination
                  total={Math.ceil(totalLogs / pageSize)}
                  value={page}
                  onChange={handlePageChange}
                  color="indigo"
                  size="sm"
                />
              </Group>
            )}
          </>
        )}
      </Paper>
    </Stack>
  );
}
