import React, { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Group,
  Button,
  Card,
  SimpleGrid,
  Badge,
  Alert,
  Loader,
  Paper,
  Stack,
  ThemeIcon,
  Radio,
  ActionIcon,
  Tooltip,
  NumberInput,
  Tabs,
  Table,
  Modal,
  TextInput,
  PasswordInput,
  Textarea,
  Switch,
  Divider,
  Grid,
  Box,
  CopyButton,
} from '@mantine/core';
import {
  IconCpu,
  IconCheck,
  IconBrain,
  IconShieldCheck,
  IconAlertTriangle,
  IconArrowLeft,
  IconRefresh,
  IconDeviceFloppy,
  IconAdjustments,
  IconCoins,
  IconPackage,
  IconWorld,
  IconPencil,
  IconTrash,
  IconPlus,
  IconCrown,
  IconCreditCard,
  IconQrcode,
} from '@tabler/icons-react';
import {
  getSettings,
  updateSettings,
  AIModelOption,
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  Plan,
} from '../api';

interface SettingsViewProps {
  onBack: () => void;
  currentUserRole?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack, currentUserRole = 'admin' }) => {
  const [activeTab, setActiveTab] = useState<string>('plans');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<string>('kimi-k2.7-code');
  const [tokenPrice, setTokenPrice] = useState<number | string>(0);
  const [promptTokenPrice, setPromptTokenPrice] = useState<number | string>(0);
  const [completionTokenPrice, setCompletionTokenPrice] = useState<number | string>(0);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [availableModels, setAvailableModels] = useState<AIModelOption[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Asaas Gateway State
  const [asaasApiKey, setAsaasApiKey] = useState<string>('');
  const [asaasEnv, setAsaasEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [asaasWebhookSecret, setAsaasWebhookSecret] = useState<string>('');
  const [asaasConfigured, setAsaasConfigured] = useState<boolean>(false);

  // Formas de Pagamento Habilitadas
  const [enableCreditCard, setEnableCreditCard] = useState<boolean>(true);
  const [enablePix, setEnablePix] = useState<boolean>(false);
  const [savingPaymentMethods, setSavingPaymentMethods] = useState<boolean>(false);
  const [paymentMethodsMsg, setPaymentMethodsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Plans State
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState<boolean>(false);
  const [planModalOpen, setPlanModalOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planSaving, setPlanSaving] = useState<boolean>(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Plan Form State
  const [planName, setPlanName] = useState<string>('');
  const [planSlug, setPlanSlug] = useState<string>('');
  const [planDescription, setPlanDescription] = useState<string>('');
  const [planWebsitesUnlimited, setPlanWebsitesUnlimited] = useState<boolean>(false);
  const [planMaxWebsites, setPlanMaxWebsites] = useState<number>(4);
  const [planAiTokens, setPlanAiTokens] = useState<number>(250000);
  const [planPriceMonthly, setPlanPriceMonthly] = useState<number>(97);
  const [planToolsEnabled, setPlanToolsEnabled] = useState<boolean>(true);
  const [planIsActive, setPlanIsActive] = useState<boolean>(true);
  const [planIsDefault, setPlanIsDefault] = useState<boolean>(false);
  const [planSortOrder, setPlanSortOrder] = useState<number>(1);

  const fetchSettings = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getSettings();
      if (res.success) {
        setActiveModel(res.active_ai_model || 'kimi-k2.7-code');
        const base = res.token_price_per_1k ?? 0;
        const pPrice = res.prompt_token_price_per_1k !== undefined ? res.prompt_token_price_per_1k : base;
        const cPrice = res.completion_token_price_per_1k !== undefined ? res.completion_token_price_per_1k : base;
        setTokenPrice(base);
        setPromptTokenPrice(pPrice);
        setCompletionTokenPrice(cPrice);
        setHasApiKey(res.has_api_key);
        setAvailableModels(res.available_models || []);
        setAsaasApiKey(res.asaas_api_key || '');
        setAsaasEnv(res.asaas_environment || 'sandbox');
        setAsaasWebhookSecret(res.asaas_webhook_secret || '');
        setAsaasConfigured(!!res.asaas_configured);
        if (res.payment_methods) {
          setEnableCreditCard(!!res.payment_methods.credit_card);
          setEnablePix(!!res.payment_methods.pix);
        }
      } else {
        setErrorMsg(res.message || 'Falha ao carregar configurações.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Erro de conexão ao buscar configurações.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlansList = async () => {
    try {
      setPlansLoading(true);
      const res = await getPlans();
      setPlans(res.data || []);
    } catch (err: any) {
      console.error('Erro ao buscar planos:', err);
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchPlansList();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const pPrice = Number(promptTokenPrice) || 0;
      const cPrice = Number(completionTokenPrice) || 0;
      const avg = Number(tokenPrice) || (pPrice + cPrice) / 2;
      const res = await updateSettings(activeModel, avg, pPrice, cPrice);
      if (res.success) {
        setSuccessMsg(
          res.message || 'Configurações de IA e precificação atualizadas com sucesso para toda a plataforma!'
        );
      } else {
        setErrorMsg(res.message || 'Erro ao salvar alterações.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Erro ao atualizar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsaasSettings = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await updateSettings(
        undefined,
        undefined,
        undefined,
        undefined,
        asaasApiKey,
        asaasEnv,
        asaasWebhookSecret
      );
      if (res.success) {
        setSuccessMsg('Configurações do Gateway Asaas atualizadas com sucesso!');
        setAsaasConfigured(!!res.asaas_configured);
      } else {
        setErrorMsg(res.message || 'Erro ao salvar configurações do Asaas.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Erro ao salvar configurações do Asaas.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaymentMethods = async () => {
    if (!enableCreditCard && !enablePix) {
      setPaymentMethodsMsg({
        type: 'error',
        text: 'Ao menos uma forma de pagamento deve permanecer ativa na plataforma.',
      });
      return;
    }

    setSavingPaymentMethods(true);
    setPaymentMethodsMsg(null);
    try {
      const res = await updateSettings(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          credit_card: enableCreditCard,
          pix: enablePix,
        }
      );
      if (res.success) {
        if (res.payment_methods) {
          setEnableCreditCard(!!res.payment_methods.credit_card);
          setEnablePix(!!res.payment_methods.pix);
        }
        setPaymentMethodsMsg({
          type: 'success',
          text: 'Formas de pagamento da plataforma atualizadas com sucesso!',
        });
      } else {
        setPaymentMethodsMsg({
          type: 'error',
          text: res.message || 'Falha ao salvar formas de pagamento.',
        });
      }
    } catch (err: any) {
      setPaymentMethodsMsg({
        type: 'error',
        text: err.response?.data?.messages?.error || err.response?.data?.message || 'Erro ao salvar formas de pagamento.',
      });
    } finally {
      setSavingPaymentMethods(false);
    }
  };

  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanName('');
    setPlanSlug('');
    setPlanDescription('');
    setPlanWebsitesUnlimited(false);
    setPlanMaxWebsites(4);
    setPlanAiTokens(250000);
    setPlanPriceMonthly(97);
    setPlanToolsEnabled(true);
    setPlanIsActive(true);
    setPlanIsDefault(false);
    setPlanSortOrder(plans.length + 1);
    setPlanError(null);
    setPlanModalOpen(true);
  };

  const handleOpenEditPlan = (p: Plan) => {
    setEditingPlan(p);
    setPlanName(p.name);
    setPlanSlug(p.slug);
    setPlanDescription(p.description || '');
    setPlanWebsitesUnlimited(p.max_websites === null);
    setPlanMaxWebsites(p.max_websites !== null ? Number(p.max_websites) : 10);
    setPlanAiTokens(Number(p.ai_monthly_tokens) || 250000);
    setPlanPriceMonthly(Number(p.price_monthly) || 0);
    setPlanToolsEnabled(Number(p.tools_enabled ?? 1) === 1);
    setPlanIsActive(Number(p.is_active) === 1);
    setPlanIsDefault(Number(p.is_default) === 1);
    setPlanSortOrder(Number(p.sort_order) || 1);
    setPlanError(null);
    setPlanModalOpen(true);
  };

  const handleSavePlanForm = async () => {
    if (!planName.trim()) {
      setPlanError('O nome do plano é obrigatório.');
      return;
    }
    if (!planAiTokens || planAiTokens <= 0) {
      setPlanError('A cota mensal de IA deve ser um número positivo (a IA não pode ser ilimitada).');
      return;
    }

    try {
      setPlanSaving(true);
      setPlanError(null);

      const payload = {
        name: planName.trim(),
        slug: planSlug.trim() || undefined,
        description: planDescription.trim() || undefined,
        max_websites: planWebsitesUnlimited ? null : Number(planMaxWebsites),
        ai_monthly_tokens: Number(planAiTokens),
        price_monthly: Number(planPriceMonthly) || 0,
        tools_enabled: planToolsEnabled ? 1 : 0,
        is_active: planIsActive ? 1 : 0,
        is_default: planIsDefault ? 1 : 0,
        sort_order: Number(planSortOrder) || 0,
      };

      if (editingPlan) {
        await updatePlan(editingPlan.id, payload);
      } else {
        await createPlan(payload);
      }

      setPlanModalOpen(false);
      setSuccessMsg(
        editingPlan ? 'Plano atualizado com sucesso!' : 'Novo plano cadastrado com sucesso!'
      );
      await fetchPlansList();
    } catch (err: any) {
      setPlanError(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao salvar dados do plano.'
      );
    } finally {
      setPlanSaving(false);
    }
  };

  const handleDeletePlanClick = async (p: Plan) => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir ou desativar o plano "${p.name}"?`
      )
    ) {
      return;
    }

    try {
      const res = await deletePlan(p.id);
      setSuccessMsg(res.message || 'Plano removido/desativado com sucesso.');
      await fetchPlansList();
    } catch (err: any) {
      alert(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao excluir plano.'
      );
    }
  };

  if (currentUserRole !== 'admin') {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertTriangle size={20} />} title="Acesso Restrito" color="red">
          Apenas administradores da plataforma possuem permissão para acessar a página de configurações.
        </Alert>
        <Button leftSection={<IconArrowLeft size={16} />} mt="md" variant="subtle" onClick={onBack}>
          Voltar para Lista de Sites
        </Button>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      {/* Header */}
      <Paper radius="md" p="md" mb="xl" withBorder style={{ backgroundColor: 'var(--mantine-color-dark-7)' }}>
        <Group justify="space-between" align="center">
          <Group>
            <ActionIcon variant="light" color="indigo" size="lg" onClick={onBack}>
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Group gap="xs">
                <ThemeIcon size="md" radius="sm" color="indigo">
                  <IconAdjustments size={18} />
                </ThemeIcon>
                <Title order={2} style={{ color: '#fff' }}>
                  Configurações Gerais da Plataforma
                </Title>
              </Group>
              <Text size="sm" c="dimmed">
                Gerencie os pacotes comerciais de planos, limites de sites, precificação e motores de Inteligência Artificial.
              </Text>
            </div>
          </Group>
          <Tooltip label="Atualizar Dados">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => {
                fetchSettings();
                fetchPlansList();
              }}
              loading={loading || plansLoading}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Paper>

      {/* Error & Success Messages */}
      {errorMsg && (
        <Alert
          icon={<IconAlertTriangle size={18} />}
          color="red"
          title="Erro"
          mb="md"
          withCloseButton
          onClose={() => setErrorMsg(null)}
        >
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <Alert
          icon={<IconCheck size={18} />}
          color="teal"
          title="Sucesso"
          mb="md"
          withCloseButton
          onClose={() => setSuccessMsg(null)}
        >
          {successMsg}
        </Alert>
      )}

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'plans')} color="indigo" variant="outline">
        <Tabs.List mb="lg">
          <Tabs.Tab value="plans" leftSection={<IconPackage size={16} />}>
            Planos & Pacotes Comerciais
          </Tabs.Tab>
          <Tabs.Tab value="ai" leftSection={<IconCpu size={16} />}>
            Motor de IA & Precificação de Tokens
          </Tabs.Tab>
          <Tabs.Tab value="payment" leftSection={<IconCreditCard size={16} />}>
            Gateway Asaas & Checkout
          </Tabs.Tab>
        </Tabs.List>

        {/* TAB 1: PLANOS & PACOTES */}
        <Tabs.Panel value="plans">
          <Stack gap="lg">
            <Paper p="lg" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
              <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
                <div>
                  <Group gap="xs">
                    <ThemeIcon color="indigo" variant="light" size="md">
                      <IconCrown size={18} />
                    </ThemeIcon>
                    <Title order={3}>Catálogo de Planos da Plataforma</Title>
                  </Group>
                  <Text size="xs" c="dimmed" mt={2}>
                    Configure as ofertas disponíveis para clientes. Defina cotas base de websites, teto mensal de IA e o valor de faturamento em R$.
                  </Text>
                </div>
                <Button
                  color="indigo"
                  leftSection={<IconPlus size={16} />}
                  onClick={handleOpenCreatePlan}
                >
                  Novo Plano
                </Button>
              </Group>

              {plansLoading ? (
                <Group justify="center" py="xl">
                  <Loader size="sm" color="indigo" />
                  <Text size="sm" c="dimmed">
                    Carregando catálogo de planos...
                  </Text>
                </Group>
              ) : (
                <Table highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Ordem</Table.Th>
                      <Table.Th>Plano</Table.Th>
                      <Table.Th>Websites Inclusos</Table.Th>
                      <Table.Th>Cota Mensal de IA</Table.Th>
                      <Table.Th>Ferramentas</Table.Th>
                      <Table.Th>Valor Mensal</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Ações</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {plans.map((p) => (
                      <Table.Tr key={p.id}>
                        <Table.Td>{p.sort_order}</Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Text fw={700} size="sm">
                              {p.name}
                            </Text>
                            {Number(p.is_default) === 1 && (
                              <Badge color="yellow" variant="light" size="xs">
                                Padrão
                              </Badge>
                            )}
                          </Group>
                          {p.description && (
                            <Text size="xs" c="dimmed">
                              {p.description}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <IconWorld size={14} color="#60a5fa" />
                            <Text size="sm" fw={600}>
                              {p.max_websites !== null ? `${p.max_websites} sites` : 'Ilimitado'}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <IconBrain size={14} color="#a78bfa" />
                            <Text size="sm" fw={600}>
                              {Number(p.ai_monthly_tokens).toLocaleString('pt-BR')} tokens
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {Number(p.tools_enabled ?? 1) === 1 ? (
                            <Badge color="teal" variant="light" size="xs">
                              Ativas
                            </Badge>
                          ) : (
                            <Badge color="orange" variant="light" size="xs">
                              Apenas Diagnóstico
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={700} c="teal.4">
                            {Number(p.price_monthly).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                            <Text component="span" size="xs" c="dimmed" fw={400} ml={2}>
                              /mês
                            </Text>
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={Number(p.is_active) === 1 ? 'teal' : 'gray'} variant="dot" size="sm">
                            {Number(p.is_active) === 1 ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Group gap="xs" justify="flex-end">
                            <Tooltip label="Editar Plano">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => handleOpenEditPlan(p)}
                              >
                                <IconPencil size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Excluir ou Desativar Plano">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                onClick={() => handleDeletePlanClick(p)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>

            <Alert color="indigo" variant="light" icon={<IconCrown size={16} />}>
              <Text size="xs">
                <b>Regra de Negócio:</b> Ao cadastrar ou alterar um usuário na tela de Gerenciamento de Usuários, o plano base selecionado é herdado automaticamente. Você também pode atribuir <b>add-ons com preços adicionais</b> (ex.: +5 sites ou +250k tokens de IA) diretamente na página <b>Gestão do Plano</b> do cliente.
              </Text>
            </Alert>
          </Stack>
        </Tabs.Panel>

        {/* TAB 2: MOTOR DE IA & CUSTOS */}
        <Tabs.Panel value="ai">
          {loading ? (
            <Paper p="xl" radius="md" withBorder ta="center">
              <Loader size="md" color="indigo" />
              <Text size="sm" c="dimmed" mt="sm">
                Carregando motores de Inteligência Artificial disponíveis...
              </Text>
            </Paper>
          ) : (
            <Stack gap="lg">
              {/* OpenCode Key Status */}
              <Paper
                p="md"
                radius="md"
                withBorder
                style={{
                  backgroundColor: 'rgba(34, 139, 230, 0.05)',
                  borderColor: 'rgba(34, 139, 230, 0.3)',
                }}
              >
                <Group justify="space-between">
                  <Group>
                    <ThemeIcon size="lg" radius="md" color={hasApiKey ? 'teal' : 'yellow'} variant="light">
                      <IconShieldCheck size={22} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600} size="sm">
                        Token OpenCode Go / Zen
                      </Text>
                      <Text size="xs" c="dimmed">
                        Autenticação global reutilizada para todos os modelos cadastrados no sistema.
                      </Text>
                    </div>
                  </Group>
                  <Badge color={hasApiKey ? 'teal' : 'yellow'} variant="filled">
                    {hasApiKey ? 'Configurado no Ambiente' : 'Chave não detectada'}
                  </Badge>
                </Group>
              </Paper>

              {/* Models Selection */}
              <Paper p="xl" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                  <div>
                    <Title order={3}>Modelos de Linguagem (LLMs)</Title>
                    <Text size="sm" c="dimmed">
                      Escolha o modelo de IA que executará os diagnósticos e geração de código de correção.
                    </Text>
                  </div>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                  {availableModels.map((m) => {
                    const isSelected = activeModel === m.id;
                    return (
                      <Card
                        key={m.id}
                        p="md"
                        radius="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          borderColor: isSelected ? 'var(--mantine-color-indigo-6)' : undefined,
                          backgroundColor: isSelected
                            ? 'rgba(76, 110, 245, 0.08)'
                            : 'var(--mantine-color-dark-6)',
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => setActiveModel(m.id)}
                      >
                        <Group justify="space-between" align="flex-start" mb="xs">
                          <Group gap="xs">
                            <ThemeIcon
                              size="md"
                              radius="md"
                              color={isSelected ? 'indigo' : 'gray'}
                              variant={isSelected ? 'filled' : 'light'}
                            >
                              <IconCpu size={16} />
                            </ThemeIcon>
                            <div>
                              <Text fw={600} size="sm">
                                {m.name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {m.provider}
                              </Text>
                            </div>
                          </Group>
                          <Radio checked={isSelected} onChange={() => setActiveModel(m.id)} />
                        </Group>

                        <Text size="xs" c="dimmed" mb="sm" style={{ minHeight: '36px' }}>
                          {m.description}
                        </Text>

                        <Group justify="space-between" mt="auto">
                          <Badge size="xs" color={isSelected ? 'indigo' : 'gray'} variant="light">
                            {m.badge}
                          </Badge>
                          {isSelected && (
                            <Badge size="xs" color="teal" variant="filled">
                              Ativo
                            </Badge>
                          )}
                        </Group>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              </Paper>

              {/* Token Pricing Section */}
              <Paper p="xl" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                  <div>
                    <Group gap="xs">
                      <ThemeIcon size="md" radius="sm" color="teal" variant="light">
                        <IconCoins size={18} />
                      </ThemeIcon>
                      <Title order={3}>Custos e Precificação de IA</Title>
                    </Group>
                    <Text size="sm" c="dimmed">
                      Defina o custo base por 1.000 tokens para cálculo de faturamento e relatórios de margem líquida.
                    </Text>
                  </div>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                  <Stack gap="sm">
                    <Paper p="md" radius="md" bg="dark.7" withBorder style={{ borderColor: '#374151' }}>
                      <Text size="xs" fw={700} c="cyan.4" tt="uppercase" mb={4}>
                        Tokens de Entrada (Prompt)
                      </Text>
                      <NumberInput
                        label="Valor por 1.000 tokens de entrada (R$)"
                        min={0}
                        step={0.005}
                        decimalScale={4}
                        thousandSeparator="."
                        decimalSeparator=","
                        prefix="R$ "
                        value={promptTokenPrice}
                        onChange={(val) => {
                          setPromptTokenPrice(val);
                          const p = Number(val) || 0;
                          const c = Number(completionTokenPrice) || 0;
                          setTokenPrice(Number(((p + c) / 2).toFixed(4)));
                        }}
                      />
                    </Paper>

                    <Paper p="md" radius="md" bg="dark.7" withBorder style={{ borderColor: '#374151' }}>
                      <Text size="xs" fw={700} c="violet.4" tt="uppercase" mb={4}>
                        Tokens de Saída (Completion / Resposta)
                      </Text>
                      <NumberInput
                        label="Valor por 1.000 tokens de saída (R$)"
                        min={0}
                        step={0.005}
                        decimalScale={4}
                        thousandSeparator="."
                        decimalSeparator=","
                        prefix="R$ "
                        value={completionTokenPrice}
                        onChange={(val) => {
                          setCompletionTokenPrice(val);
                          const p = Number(promptTokenPrice) || 0;
                          const c = Number(val) || 0;
                          setTokenPrice(Number(((p + c) / 2).toFixed(4)));
                        }}
                      />
                    </Paper>
                  </Stack>

                  <Paper p="md" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
                    <Group justify="space-between" mb="xs">
                      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                        Simulação de Custo Real Ponderado
                      </Text>
                      <Badge size="xs" color="gray" variant="outline">
                        Padrão: ~75% Prompt / 25% Saída
                      </Badge>
                    </Group>
                    <SimpleGrid cols={2} spacing="xs">
                      {[250000, 500000, 1000000, 2000000].map((tier) => {
                        const pToks = tier * 0.75;
                        const cToks = tier * 0.25;
                        const pC = (pToks / 1000) * (Number(promptTokenPrice) || 0);
                        const cC = (cToks / 1000) * (Number(completionTokenPrice) || 0);
                        const totalCost = pC + cC;
                        const label = tier >= 1000000 ? `${tier / 1000000}M` : `${tier / 1000}k`;

                        return (
                          <Paper key={tier} p="xs" radius="sm" bg="dark.7">
                            <Text size="11px" c="dimmed" fw={600}>
                              {label} tokens ({tier.toLocaleString('pt-BR')}):
                            </Text>
                            <Text size="sm" fw={700} c="teal.4">
                              {totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </Text>
                            <Text size="10px" c="dimmed">
                              In: {pC.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Out:{' '}
                              {cC.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </Text>
                          </Paper>
                        );
                      })}
                    </SimpleGrid>
                  </Paper>
                </SimpleGrid>
              </Paper>

              {/* Action Bar */}
              <Paper p="md" radius="md" withBorder>
                <Group justify="flex-end">
                  <Button variant="subtle" color="gray" onClick={onBack}>
                    Cancelar
                  </Button>
                  <Button
                    color="indigo"
                    size="md"
                    leftSection={<IconDeviceFloppy size={18} />}
                    onClick={handleSaveSettings}
                    loading={saving}
                  >
                    Salvar Configurações de IA
                  </Button>
                </Group>
              </Paper>
            </Stack>
          )}
        </Tabs.Panel>

        {/* TAB 3: GATEWAY ASAAS & CHECKOUT */}
        <Tabs.Panel value="payment">
          <Stack gap="lg">
            {/* NOVO: FORMAS DE PAGAMENTO HABILITADAS NA PLATAFORMA */}
            <Paper p="lg" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
              <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
                <div>
                  <Group gap="xs">
                    <ThemeIcon color="indigo" variant="light" size="md">
                      <IconAdjustments size={18} />
                    </ThemeIcon>
                    <Title order={3}>Formas de Pagamento Habilitadas</Title>
                  </Group>
                  <Text size="xs" c="dimmed" mt={2}>
                    Ative ou desative as formas de pagamento disponíveis para contratação de planos, upgrades e add-ons pelos usuários.
                  </Text>
                </div>
                <Badge
                  size="lg"
                  color={enableCreditCard && enablePix ? 'teal' : enableCreditCard ? 'indigo' : 'cyan'}
                  variant="light"
                >
                  {enableCreditCard && enablePix
                    ? 'Cartão & Pix Ativos'
                    : enableCreditCard
                    ? 'Apenas Cartão Ativo'
                    : 'Apenas Pix Ativo'}
                </Badge>
              </Group>

              {paymentMethodsMsg && (
                <Alert
                  color={paymentMethodsMsg.type === 'success' ? 'teal' : 'red'}
                  icon={paymentMethodsMsg.type === 'success' ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
                  mb="md"
                  withCloseButton
                  onClose={() => setPaymentMethodsMsg(null)}
                >
                  {paymentMethodsMsg.text}
                </Alert>
              )}

              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {/* Switch Cartão de Crédito */}
                <Paper
                  p="md"
                  radius="md"
                  bg={enableCreditCard ? 'rgba(26, 127, 134, 0.12)' : 'dark.7'}
                  withBorder
                  style={{
                    borderColor: enableCreditCard ? '#1A7F86' : '#4b5563',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Group justify="space-between" align="flex-start" mb="xs">
                    <Group gap="xs">
                      <ThemeIcon color="sitehub" variant={enableCreditCard ? 'filled' : 'light'} size="md">
                        <IconCreditCard size={18} />
                      </ThemeIcon>
                      <div>
                        <Text fw={700} size="sm" c="white">
                          Cartão de Crédito
                        </Text>
                        <Text size="11px" c="dimmed">
                          Cobrança Recorrente Automática
                        </Text>
                      </div>
                    </Group>
                    <Switch
                      checked={enableCreditCard}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        if (!checked && !enablePix) {
                          setPaymentMethodsMsg({
                            type: 'error',
                            text: 'Ao menos uma forma de pagamento deve permanecer ativa.',
                          });
                          return;
                        }
                        setPaymentMethodsMsg(null);
                        setEnableCreditCard(checked);
                      }}
                      color="sitehub"
                      size="md"
                    />
                  </Group>
                  <Text size="xs" c="gray.4" mt="xs">
                    Permite que clientes contratem planos e add-ons com cobrança recorrente no cartão. A liberação dos limites é instantânea com renovação mensal sem intervenção manual.
                  </Text>
                </Paper>

                {/* Switch Pix Instantâneo */}
                <Paper
                  p="md"
                  radius="md"
                  bg={enablePix ? 'rgba(6, 214, 160, 0.12)' : 'dark.7'}
                  withBorder
                  style={{
                    borderColor: enablePix ? '#06d6a0' : '#4b5563',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Group justify="space-between" align="flex-start" mb="xs">
                    <Group gap="xs">
                      <ThemeIcon color="emerald" variant={enablePix ? 'filled' : 'light'} size="md">
                        <IconQrcode size={18} />
                      </ThemeIcon>
                      <div>
                        <Text fw={700} size="sm" c="white">
                          Pix Instantâneo
                        </Text>
                        <Text size="11px" c="dimmed">
                          QR Code Dinâmico e Copia e Cola
                        </Text>
                      </div>
                    </Group>
                    <Switch
                      checked={enablePix}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        if (!checked && !enableCreditCard) {
                          setPaymentMethodsMsg({
                            type: 'error',
                            text: 'Ao menos uma forma de pagamento deve permanecer ativa.',
                          });
                          return;
                        }
                        setPaymentMethodsMsg(null);
                        setEnablePix(checked);
                      }}
                      color="emerald"
                      size="md"
                    />
                  </Group>
                  <Text size="xs" c="gray.4" mt="xs">
                    Permite que clientes paguem via Pix com geração de QR Code dinâmico do Asaas. A cada renovação mensal ou cálculo de pró-rata, um novo Pix é gerado.
                  </Text>
                </Paper>
              </SimpleGrid>

              <Group justify="flex-end" mt="lg">
                <Button
                  color="indigo"
                  size="sm"
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSavePaymentMethods}
                  loading={savingPaymentMethods}
                >
                  Salvar Formas de Pagamento
                </Button>
              </Group>
            </Paper>

            <Paper p="lg" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
              <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
                <div>
                  <Group gap="xs">
                    <ThemeIcon color="green" variant="light" size="md">
                      <IconCreditCard size={18} />
                    </ThemeIcon>
                    <Title order={3}>Integração com Gateway Asaas</Title>
                  </Group>
                  <Text size="xs" c="dimmed" mt={2}>
                    Configure suas credenciais da API do Asaas para cobrança via Pix dinâmico, QR Code, Cartão e Webhooks com provisionamento 100% automático.
                  </Text>
                </div>
                <Badge
                  size="lg"
                  color={asaasConfigured ? 'teal' : 'orange'}
                  variant="filled"
                >
                  {asaasConfigured ? 'Gateway Conectado' : 'Modo Homologação Ativo'}
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                <Paper p="md" radius="md" bg="dark.7" withBorder style={{ borderColor: '#4b5563' }}>
                  <Title order={5} mb="xs" c="white">Credenciais da API</Title>
                  <Text size="xs" c="dimmed" mb="md">
                    Obtenha sua chave no painel do Asaas em <i>Menu do Usuário &gt; Integrações &gt; Gerar Chave de API</i>.
                  </Text>

                  <Stack gap="sm">
                    <div>
                      <Text size="xs" fw={600} mb={4}>Ambiente de Execução</Text>
                      <Radio.Group
                        value={asaasEnv}
                        onChange={(val: any) => setAsaasEnv(val)}
                      >
                        <Group mt="xs">
                          <Radio value="sandbox" label="Sandbox (Homologação / Testes)" color="indigo" />
                          <Radio value="production" label="Produção (Cobranças Reais)" color="green" />
                        </Group>
                      </Radio.Group>
                    </div>

                    <PasswordInput
                      label="Chave de API (Access Token)"
                      placeholder="$aact_YTU5YTE0M2M6N2Nm..."
                      value={asaasApiKey}
                      onChange={(e) => setAsaasApiKey(e.target.value)}
                      description="Chave de autenticação enviada nas requisições HTTP para a API v3 do Asaas."
                    />

                    <TextInput
                      label="Token Secreto do Webhook (asaas-access-token)"
                      placeholder="Ex: seu-token-secreto-personalizado"
                      value={asaasWebhookSecret}
                      onChange={(e) => setAsaasWebhookSecret(e.target.value)}
                      description="Token validado pelo backend para confirmar que as notificações foram disparadas pelo Asaas."
                    />
                  </Stack>
                </Paper>

                <Paper p="md" radius="md" bg="dark.7" withBorder style={{ borderColor: '#4b5563' }}>
                  <Title order={5} mb="xs" c="white">Configuração de Webhooks</Title>
                  <Text size="xs" c="dimmed" mb="md">
                    Cadastre a URL abaixo no painel do Asaas para que a plataforma receba notificações de pagamento Pix em tempo real e ative a conta do cliente instantaneamente.
                  </Text>

                  <Stack gap="sm">
                    <Box>
                      <Text size="xs" fw={600} mb={4}>URL do Webhook da Plataforma:</Text>
                      <Group gap="xs">
                        <TextInput
                          value={`${window.location.origin}${window.location.pathname.startsWith('/validar-seguranca') ? '/validar-seguranca' : ''}/api/public/webhooks/asaas`}
                          readOnly
                          style={{ flex: 1 }}
                          size="xs"
                          styles={{ input: { fontFamily: 'monospace' } }}
                        />
                        <CopyButton value={`${window.location.origin}${window.location.pathname.startsWith('/validar-seguranca') ? '/validar-seguranca' : ''}/api/public/webhooks/asaas`}>
                          {({ copied, copy }) => (
                            <Button size="xs" color={copied ? 'teal' : 'indigo'} onClick={copy}>
                              {copied ? 'Copiado!' : 'Copiar'}
                            </Button>
                          )}
                        </CopyButton>
                      </Group>
                    </Box>

                    <Alert color="blue" variant="light">
                      <b>Eventos recomendados para ativar no Asaas:</b>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        <li><code>PAYMENT_RECEIVED</code> (Pagamento Pix recebido)</li>
                        <li><code>PAYMENT_CONFIRMED</code> (Pagamento confirmado)</li>
                        <li><code>PAYMENT_OVERDUE</code> (Cobrança vencida)</li>
                        <li><code>PAYMENT_REFUNDED</code> (Pagamento estornado)</li>
                      </ul>
                    </Alert>
                  </Stack>
                </Paper>
              </SimpleGrid>

              <Group justify="flex-end" mt="lg">
                <Button
                  color="teal"
                  size="md"
                  leftSection={<IconDeviceFloppy size={18} />}
                  onClick={handleSaveAsaasSettings}
                  loading={saving}
                >
                  Salvar Configurações do Asaas
                </Button>
              </Group>
            </Paper>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Modal: Criar / Editar Plano */}
      <Modal
        opened={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title={editingPlan ? `Editar Plano: ${editingPlan.name}` : 'Cadastrar Novo Plano'}
        size="lg"
        centered
      >
        <Stack gap="md">
          {planError && (
            <Alert color="red" variant="filled" title="Erro">
              {planError}
            </Alert>
          )}

          <Grid gutter="sm">
            <Grid.Col span={8}>
              <TextInput
                label="Nome do Plano"
                placeholder="Ex: Iniciante, Agência, Enterprise"
                required
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Identificador (Slug)"
                placeholder="ex: iniciante"
                value={planSlug}
                onChange={(e) => setPlanSlug(e.target.value)}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Descrição Curta"
            placeholder="Breve resumo dos benefícios inclusos neste pacote"
            rows={2}
            value={planDescription}
            onChange={(e) => setPlanDescription(e.target.value)}
          />

          <Divider label="Limites e Cotas Inclusas" labelPosition="center" />

          <Grid gutter="sm">
            {/* Websites */}
            <Grid.Col span={6}>
              <Card bg="dark.7" p="xs" radius="sm" withBorder style={{ borderColor: '#374151' }}>
                <Switch
                  label="Websites Ilimitados"
                  checked={planWebsitesUnlimited}
                  onChange={(e) => setPlanWebsitesUnlimited(e.currentTarget.checked)}
                  color="indigo"
                  size="xs"
                  mb="xs"
                />
                {!planWebsitesUnlimited ? (
                  <NumberInput
                    label="Limite de Websites"
                    min={1}
                    max={500}
                    value={planMaxWebsites}
                    onChange={(val) => setPlanMaxWebsites(Number(val) || 1)}
                  />
                ) : (
                  <Text size="xs" c="teal" mt={4}>
                    Sem limite de websites para este plano.
                  </Text>
                )}
              </Card>
            </Grid.Col>

            {/* IA Tokens */}
            <Grid.Col span={6}>
              <Card bg="dark.7" p="xs" radius="sm" withBorder style={{ borderColor: '#374151' }}>
                <Text size="xs" fw={600} mb={4}>
                  Cota Mensal de IA (Sem Ilimitado)
                </Text>
                <NumberInput
                  min={1000}
                  step={50000}
                  thousandSeparator="."
                  decimalSeparator=","
                  value={planAiTokens}
                  onChange={(val) => setPlanAiTokens(Number(val) || 250000)}
                />
                <Group gap={4} mt={6}>
                  <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setPlanAiTokens(250000)}>
                    250k
                  </Button>
                  <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setPlanAiTokens(500000)}>
                    500k
                  </Button>
                  <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setPlanAiTokens(1000000)}>
                    1M
                  </Button>
                  <Button size="compact-xs" variant="subtle" color="indigo" onClick={() => setPlanAiTokens(2000000)}>
                    2M
                  </Button>
                </Group>
              </Card>
            </Grid.Col>
          </Grid>

          <Divider label="Faturamento e Status" labelPosition="center" />

          <Grid gutter="sm">
            <Grid.Col span={6}>
              <NumberInput
                label="Valor Mensal do Plano (R$)"
                description="Preço de assinatura padrão."
                min={0}
                step={10}
                decimalScale={2}
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                value={planPriceMonthly}
                onChange={(val) => setPlanPriceMonthly(Number(val) || 0)}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="Ordem de Exibição"
                description="Posição na listagem."
                min={0}
                value={planSortOrder}
                onChange={(val) => setPlanSortOrder(Number(val) || 0)}
              />
            </Grid.Col>
          </Grid>

          <Card bg="dark.7" p="xs" radius="sm" withBorder style={{ borderColor: '#374151' }}>
            <Switch
              label="Ferramentas Ativas de Remediação (Fixes, Restauração e Atualizações)"
              description="Quando desmarcado, os relatórios são exibidos mas as ferramentas de correção ficam restritas com card de upgrade."
              checked={planToolsEnabled}
              onChange={(e) => setPlanToolsEnabled(e.currentTarget.checked)}
              color="teal"
            />
          </Card>

          <Group justify="space-between" mt="xs">
            <Switch
              label="Plano Ativo para Contratação"
              checked={planIsActive}
              onChange={(e) => setPlanIsActive(e.currentTarget.checked)}
              color="teal"
            />
            <Switch
              label="Plano Padrão para Novos Clientes"
              checked={planIsDefault}
              onChange={(e) => setPlanIsDefault(e.currentTarget.checked)}
              color="yellow"
            />
          </Group>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setPlanModalOpen(false)}>
              Cancelar
            </Button>
            <Button color="indigo" onClick={handleSavePlanForm} loading={planSaving}>
              {editingPlan ? 'Salvar Alterações' : 'Criar Plano'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};
