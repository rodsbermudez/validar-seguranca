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
  Modal,
  TextInput,
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
  IconCreditCard,
  IconAlertTriangle,
  IconPlus,
  IconInfoCircle,
  IconQrcode,
  IconCopy,
} from '@tabler/icons-react';
import {
  getUserPlanDetails,
  updateUserPlan,
  getUserAiLogs,
  cancelSubscription,
  upgradePlan,
  manageAddons,
  confirmProratedPix,
  UserPlanResponse,
  AiUsageLogItem,
  Plan,
} from '../api';
import { formatDateTime, formatDateOnly, formatMonthYear } from '../utils/date';
import { CheckoutModal } from './CheckoutModal';

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

  // Subscription Cancellation, Renewal & Feedback State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelingSub, setCancelingSub] = useState(false);
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
    color: 'teal' | 'orange' | 'blue' | 'red';
    icon?: 'check' | 'alert' | 'info';
  } | null>(null);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [checkoutExtraWebsites, setCheckoutExtraWebsites] = useState<number>(0);
  const [checkoutExtraAiPacks, setCheckoutExtraAiPacks] = useState<number>(0);

  // Upgrade Plan Modal State
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [targetUpgradePlanId, setTargetUpgradePlanId] = useState<number | null>(null);
  const [upgradingPlan, setUpgradingPlan] = useState(false);

  // Addons Modal State
  const [addonsModalOpen, setAddonsModalOpen] = useState(false);
  const [modalExtraWebsites, setModalExtraWebsites] = useState<number>(0);
  const [modalExtraAiPacks, setModalExtraAiPacks] = useState<number>(0);
  const [savingAddons, setSavingAddons] = useState(false);

  // PIX Prorated Modal State
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{
    payment_id: string;
    prorated_amount: number;
    pix_qr_code?: string | null;
    pix_copy_paste?: string | null;
    days_remaining?: number;
    next_due_date_formatted?: string;
    new_monthly?: number;
    plan_id?: number;
    extra_websites?: number;
    extra_ai_tokens?: number;
  } | null>(null);
  const [confirmingPix, setConfirmingPix] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

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

  const handleCancelSubscription = async () => {
    try {
      setCancelingSub(true);
      setErrorMessage('');
      const res = await cancelSubscription(initialUser.id);
      setCancelModalOpen(false);
      setFeedback({
        title: 'Cancelamento Registrado',
        message: res.message,
        color: 'orange',
        icon: 'alert',
      });
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao cancelar assinatura.'
      );
    } finally {
      setCancelingSub(false);
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
  const sub = pd?.subscription || data?.subscription;
  const currentPlan = data?.available_plans.find((p) => String(p.id) === String(selectedPlanId || sub?.plan_id || pd?.plan_id));

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

  // Add-ons capacity validation variables
  const baseWebsitesLimit = pd?.base_max_websites ?? null;
  const userWebsitesCount = pd?.websites_count ?? 0;
  const newEffectiveWebsitesLimit = baseWebsitesLimit !== null ? baseWebsitesLimit + modalExtraWebsites : null;
  const isAddonRemovalBlocked = newEffectiveWebsitesLimit !== null && newEffectiveWebsitesLimit < userWebsitesCount;
  const sitesExcessCount = newEffectiveWebsitesLimit !== null ? Math.max(0, userWebsitesCount - newEffectiveWebsitesLimit) : 0;

  // Real-time Proration & Cycle calculations
  const currentTotalMonthly = pd?.total_monthly_price || 0;
  const newAddonsTotalMonthly = (pd?.base_price || 0) + (modalExtraWebsites * 8) + (modalExtraAiPacks * 60);
  const addonsDiffMonthly = Math.round((newAddonsTotalMonthly - currentTotalMonthly) * 100) / 100;
  const isAddonsDowngrade = addonsDiffMonthly <= 0;
  const cycleEnd = sub?.current_period_end;
  const daysRemainingInCycle = cycleEnd ? Math.max(1, Math.ceil((new Date(cycleEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 30;
  const nextCycleDueDateFmt = cycleEnd ? formatDateOnly(cycleEnd) : formatDateOnly(new Date(Date.now() + 30 * 86400000).toISOString());
  const proratedRatioCalc = Math.min(1.0, Math.max(0.033, daysRemainingInCycle / 30.0));
  const addonsProratedDueNow = addonsDiffMonthly > 0 ? Math.round(addonsDiffMonthly * proratedRatioCalc * 100) / 100 : 0;

  const handleConfirmUpgrade = async () => {
    if (!targetUpgradePlanId) return;

    try {
      setUpgradingPlan(true);
      setErrorMessage('');
      const res = await upgradePlan(targetUpgradePlanId, initialUser.id);
      
      if (res.require_checkout) {
        setUpgradeModalOpen(false);
        const planToCheckout = data?.available_plans.find((p) => p.id === targetUpgradePlanId) || currentPlan || null;
        setCheckoutPlan(planToCheckout);
        setCheckoutExtraWebsites(pd?.extra_websites || 0);
        setCheckoutExtraAiPacks(Math.round((pd?.extra_ai_tokens || 0) / 1000000));
        setRenewModalOpen(true);
      } else if (res.require_pix) {
        setUpgradeModalOpen(false);
        setPixData({
          payment_id: res.payment_id!,
          prorated_amount: res.prorated_amount || 0,
          pix_qr_code: res.pix_qr_code,
          pix_copy_paste: res.pix_copy_paste,
          days_remaining: res.days_remaining,
          next_due_date_formatted: res.next_due_date_formatted,
          new_monthly: res.new_monthly,
          plan_id: res.new_plan_id || targetUpgradePlanId,
          extra_websites: pd?.extra_websites || 0,
          extra_ai_tokens: pd?.extra_ai_tokens || 0,
        });
        setPixModalOpen(true);
      } else {
        setUpgradeModalOpen(false);
        setFeedback({
          title: 'Plano Atualizado com Sucesso',
          message: res.message,
          color: 'teal',
          icon: 'check',
        });
        await loadData();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao realizar alteração de plano.'
      );
    } finally {
      setUpgradingPlan(false);
    }
  };

  const handleSaveAddons = async () => {
    const baseMax = pd?.base_max_websites;
    const currentWebsites = pd?.websites_count || 0;
    if (baseMax !== null && baseMax !== undefined) {
      const newLimit = baseMax + modalExtraWebsites;
      if (currentWebsites > newLimit) {
        setErrorMessage(
          `Não é possível remover ou reduzir o add-on de sites: você possui ${currentWebsites} sites cadastrados, mas o novo limite seria de ${newLimit} sites (${baseMax} do plano + ${modalExtraWebsites} extras). Remova pelo menos ${currentWebsites - newLimit} site(s) antes de reduzir este add-on.`
        );
        return;
      }
    }

    try {
      setSavingAddons(true);
      setErrorMessage('');
      const res = await manageAddons({
        extra_websites: modalExtraWebsites,
        extra_ai_packs: modalExtraAiPacks,
        user_id: initialUser.id,
      });

      if (res.require_checkout) {
        setAddonsModalOpen(false);
        setCheckoutPlan(currentPlan || null);
        setCheckoutExtraWebsites(modalExtraWebsites);
        setCheckoutExtraAiPacks(modalExtraAiPacks);
        setRenewModalOpen(true);
      } else if (res.require_pix) {
        setAddonsModalOpen(false);
        setPixData({
          payment_id: res.payment_id!,
          prorated_amount: res.prorated_amount || 0,
          pix_qr_code: res.pix_qr_code,
          pix_copy_paste: res.pix_copy_paste,
          days_remaining: res.days_remaining,
          next_due_date_formatted: res.next_due_date_formatted,
          new_monthly: res.new_monthly,
          plan_id: pd?.plan_id ? Number(pd.plan_id) : undefined,
          extra_websites: res.extra_websites,
          extra_ai_tokens: res.extra_ai_tokens,
        });
        setPixModalOpen(true);
      } else {
        setAddonsModalOpen(false);
        const isScheduled = res.message?.toLowerCase().includes('programada') || res.message?.toLowerCase().includes('redução');
        setFeedback({
          title: isScheduled ? 'Redução Agendada para a Próxima Fatura' : 'Add-ons Atualizados com Sucesso',
          message: res.message,
          color: isScheduled ? 'blue' : 'teal',
          icon: isScheduled ? 'info' : 'check',
        });
        await loadData();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao atualizar add-ons.'
      );
    } finally {
      setSavingAddons(false);
    }
  };

  const handleConfirmPixPayment = async () => {
    if (!pixData?.payment_id) return;
    try {
      setConfirmingPix(true);
      setErrorMessage('');
      const res = await confirmProratedPix({
        payment_id: pixData.payment_id,
        plan_id: pixData.plan_id,
        extra_websites: pixData.extra_websites,
        extra_ai_tokens: pixData.extra_ai_tokens,
        user_id: initialUser.id,
      });

      if (res.paid) {
        setPixModalOpen(false);
        setFeedback({
          title: 'Pagamento Confirmado',
          message: res.message,
          color: 'teal',
          icon: 'check',
        });
        await loadData();
      } else {
        setErrorMessage(res.message || 'Pagamento ainda não confirmado pelo Asaas. Aguarde alguns instantes e tente novamente.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao verificar pagamento PIX.'
      );
    } finally {
      setConfirmingPix(false);
    }
  };

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

      {/* Feedback de ações (cancelamento, upgrade, add-ons, pix) */}
      {feedback && (
        <Alert
          icon={
            feedback.icon === 'alert' ? (
              <IconAlertTriangle size={16} />
            ) : feedback.icon === 'info' ? (
              <IconInfoCircle size={16} />
            ) : (
              <IconCheck size={16} />
            )
          }
          color={feedback.color}
          variant="filled"
          withCloseButton
          onClose={() => setFeedback(null)}
          title={feedback.title}
        >
          {feedback.message}
        </Alert>
      )}

      {/* Card / Alerta de Status da Assinatura */}
      {sub && (
        <Paper
          p="md"
          radius="md"
          bg="dark.8"
          withBorder
          style={{
            borderColor:
              sub.status === 'active'
                ? '#10b981'
                : sub.status === 'canceled' && sub.is_period_active
                ? '#f59e0b'
                : '#ef4444',
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap="sm">
              <ThemeIcon
                size="lg"
                radius="md"
                color={
                  sub.status === 'active'
                    ? 'teal'
                    : sub.status === 'canceled' && sub.is_period_active
                    ? 'yellow'
                    : 'red'
                }
                variant="light"
              >
                <IconCreditCard size={20} />
              </ThemeIcon>
              <div>
                <Group gap="xs" align="center">
                  <Text fw={700} size="sm">
                    Assinatura Recorrente Asaas (Pix)
                  </Text>
                  <Badge
                    size="sm"
                    variant="filled"
                    color={
                      sub.status === 'active'
                        ? 'teal'
                        : sub.status === 'canceled' && sub.is_period_active
                        ? 'yellow'
                        : 'red'
                    }
                  >
                    {sub.status === 'active'
                      ? 'ATIVA'
                      : sub.status === 'canceled' && sub.is_period_active
                      ? 'CANCELADA (ACESSO ATIVO)'
                      : sub.status === 'canceled'
                      ? 'CANCELADA (EXPIRADA)'
                      : 'EXPIRADA'}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  {sub.status === 'active' ? (
                    <>
                      Próxima renovação em <b>{sub.current_period_end ? formatDateOnly(sub.current_period_end) : '—'}</b> ({sub.days_remaining} dias restantes no ciclo).
                    </>
                  ) : sub.status === 'canceled' && sub.is_period_active ? (
                    <>
                      Cancelada em {sub.canceled_at ? formatDateOnly(sub.canceled_at) : '—'}. Seu acesso permanece 100% liberado até <b>{sub.current_period_end ? formatDateOnly(sub.current_period_end) : '—'}</b> ({sub.days_remaining} dias restantes). Nenhuma nova cobrança será realizada.
                    </>
                  ) : (
                    <>
                      O período pago encerrou em {sub.current_period_end ? formatDateOnly(sub.current_period_end) : '—'}. O cadastro de novos sites e os recursos de IA estão bloqueados até uma nova contratação.
                    </>
                  )}
                </Text>
              </div>
            </Group>

            <Group gap="xs">
              {sub.status === 'active' && (
                <Button
                  variant="outline"
                  color="red"
                  size="xs"
                  leftSection={<IconX size={14} />}
                  onClick={() => setCancelModalOpen(true)}
                >
                  Cancelar Assinatura
                </Button>
              )}
              {(sub.status === 'canceled' || sub.status === 'expired') && (
                <Button
                  variant="filled"
                  color="indigo"
                  size="xs"
                  leftSection={<IconRefresh size={14} />}
                  onClick={() => {
                    setCheckoutPlan(currentPlan || null);
                    setCheckoutExtraWebsites(pd?.extra_websites || 0);
                    setCheckoutExtraAiPacks(Math.round((pd?.extra_ai_tokens || 0) / 1000000));
                    setRenewModalOpen(true);
                  }}
                >
                  {sub.is_period_active ? 'Reativar / Renovar Assinatura' : 'Contratar Novo Plano'}
                </Button>
              )}
            </Group>
          </Group>
        </Paper>
      )}

      {/* Se o plano expirou e não há sub explícito */}
      {!sub && pd?.is_subscription_expired && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="filled" title="Assinatura Expirada">
          <Group justify="space-between" align="center">
            <Text size="xs">
              O período contratado da sua assinatura foi concluído. Os limites de sites e as funcionalidades de IA estão congelados.
            </Text>
            <Button
              size="xs"
              variant="white"
              color="red"
              onClick={() => {
                setCheckoutPlan(currentPlan || null);
                setCheckoutExtraWebsites(pd?.extra_websites || 0);
                setCheckoutExtraAiPacks(Math.round((pd?.extra_ai_tokens || 0) / 1000000));
                setRenewModalOpen(true);
              }}
            >
              Contratar Novo Plano
            </Button>
          </Group>
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

            <Divider my="sm" color="dark.6" />
            <Group gap="xs" grow>
              <Button
                size="xs"
                color="indigo"
                variant="light"
                leftSection={<IconCrown size={14} />}
                onClick={() => {
                  setTargetUpgradePlanId(pd?.plan_id || null);
                  setUpgradeModalOpen(true);
                }}
              >
                Upgrade de Plano
              </Button>
              <Button
                size="xs"
                color="teal"
                variant="light"
                leftSection={<IconSparkles size={14} />}
                onClick={() => {
                  setModalExtraWebsites(pd?.extra_websites || 0);
                  setModalExtraAiPacks(Math.round((pd?.extra_ai_tokens || 0) / 250000));
                  setAddonsModalOpen(true);
                }}
              >
                Add-ons
              </Button>
            </Group>
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
                {pd?.shared_websites_count ? (
                  <Text size="11px" c="violet.3" mt={2}>
                    + {pd.shared_websites_count} site(s) compartilhado(s) sob gestão (não consom cota contratada).
                  </Text>
                ) : null}
              </Stack>
            ) : (
              <Stack gap={4} mt="sm">
                <Text size="xs" c="teal">
                  Sem limite de websites para este plano.
                </Text>
                {pd?.shared_websites_count ? (
                  <Text size="11px" c="violet.3">
                    + {pd.shared_websites_count} site(s) compartilhado(s) sob gestão.
                  </Text>
                ) : null}
              </Stack>
            )}

            <Button
              size="xs"
              color="blue"
              variant="subtle"
              leftSection={<IconPlus size={14} />}
              fullWidth
              mt="xs"
              onClick={() => {
                setModalExtraWebsites(pd?.extra_websites || 0);
                setModalExtraAiPacks(Math.round((pd?.extra_ai_tokens || 0) / 250000));
                setAddonsModalOpen(true);
              }}
            >
              {pd?.extra_websites ? 'Gerenciar Sites Extras' : 'Adicionar Sites Extras (+R$ 8/site)'}
            </Button>
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

            <Button
              size="xs"
              color="violet"
              variant="subtle"
              leftSection={<IconPlus size={14} />}
              fullWidth
              mt="xs"
              onClick={() => {
                setModalExtraWebsites(pd?.extra_websites || 0);
                setModalExtraAiPacks(Math.round((pd?.extra_ai_tokens || 0) / 250000));
                setAddonsModalOpen(true);
              }}
            >
              {pd?.extra_ai_tokens ? 'Gerenciar Cota de IA' : 'Adicionar Pacote de IA (+250k)'}
            </Button>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Banner / Painel de Ações de Expansão e Upgrades */}
      <Paper p="md" radius="md" bg="rgba(30, 41, 59, 0.5)" withBorder style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <div>
            <Group gap="xs">
              <ThemeIcon size="md" color="indigo" variant="light" radius="md">
                <IconTrendingUp size={18} />
              </ThemeIcon>
              <Text fw={700} size="sm" c="white">
                Expansão de Recursos & Upgrades
              </Text>
            </Group>
            <Text size="xs" c="dimmed" mt={4} maw={620}>
              Precisa de mais capacidade? Mude seu plano com preservação automática dos add-ons contratados, ou adicione/cancele sites e pacotes de IA sob demanda.
            </Text>
          </div>
          <Group gap="xs">
            <Button
              size="sm"
              color="indigo"
              variant="gradient"
              gradient={{ from: 'indigo.6', to: 'violet.6' }}
              leftSection={<IconCrown size={16} />}
              onClick={() => {
                setTargetUpgradePlanId(pd?.plan_id || null);
                setUpgradeModalOpen(true);
              }}
            >
              Fazer Upgrade de Plano
            </Button>
            <Button
              size="sm"
              color="teal"
              variant="light"
              leftSection={<IconSparkles size={16} />}
              onClick={() => {
                setModalExtraWebsites(pd?.extra_websites || 0);
                setModalExtraAiPacks(Math.round((pd?.extra_ai_tokens || 0) / 250000));
                setAddonsModalOpen(true);
              }}
            >
              Contratar / Gerenciar Add-ons
            </Button>
          </Group>
        </Group>
      </Paper>

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

      {/* Modal de Confirmação de Cancelamento de Assinatura */}
      <Modal
        opened={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title={<Text fw={700} size="md">Confirmar Cancelamento de Assinatura</Text>}
        centered
        radius="md"
        size="md"
        styles={{ content: { backgroundColor: '#1f2937' }, header: { backgroundColor: '#1f2937' } }}
      >
        <Stack gap="md">
          <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />} title="Importante sobre o cancelamento:">
            <Text size="xs">
              Ao confirmar o cancelamento da assinatura:
            </Text>
            <ul style={{ margin: '6px 0 0 0', paddingLeft: 18, fontSize: 12 }}>
              <li>Nenhuma nova fatura de renovação será gerada no Asaas.</li>
              <li>
                <b>Você continua com ACESSO COMPLETO</b> a todos os recursos do seu plano até o término do período já pago (
                <b>{sub?.current_period_end ? formatDateOnly(sub.current_period_end) : 'fim do ciclo atual'}</b>, restando {sub?.days_remaining || 0} dias).
              </li>
              <li>Após essa data, os limites de sites e inteligência artificial serão pausados até uma nova contratação.</li>
            </ul>
          </Alert>

          <Text size="sm" c="dimmed">
            Tem certeza de que deseja cancelar a renovação da sua assinatura?
          </Text>

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" size="sm" onClick={() => setCancelModalOpen(false)} disabled={cancelingSub}>
              Manter Assinatura
            </Button>
            <Button color="red" size="sm" onClick={handleCancelSubscription} loading={cancelingSub} leftSection={<IconX size={14} />}>
              Sim, Cancelar Assinatura
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de Upgrade de Plano */}
      <Modal
        opened={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title={
          <Group gap="xs">
            <IconCrown size={20} color="var(--mantine-color-indigo-4)" />
            <Text fw={700} size="md">
              Fazer Upgrade de Plano
            </Text>
          </Group>
        }
        size="lg"
        radius="md"
        centered
        styles={{
          header: { background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' },
          content: { background: '#0f172a', border: '1px solid rgba(99, 102, 241, 0.3)' },
        }}
      >
        <Stack gap="md">
          {/* Alerta de preservação de add-ons */}
          <Alert color="indigo" variant="light" icon={<IconSparkles size={16} />}>
            <Text size="xs">
              <b>Preservação de Add-ons:</b> Seus add-ons contratados atuais (
              <b>{pd?.extra_websites || 0} sites extras</b> e <b>{((pd?.extra_ai_tokens || 0) / 1000).toLocaleString('pt-BR')}k tokens de IA extras</b>)
              permanecerão ativos no novo plano.
            </Text>
          </Alert>

          <Text size="xs" c="dimmed">
            Selecione o plano desejado para realizar o upgrade. A capacidade de sites e tokens do novo plano será aplicada imediatamente:
          </Text>

          {/* Cards dos Planos Disponíveis */}
          <Stack gap="xs">
            {data?.available_plans.map((p) => {
              const isCurrent = String(p.id) === String(pd?.plan_id);
              const isSelected = targetUpgradePlanId === p.id;
              const websitesCapacity = p.max_websites === null
                ? 'Sites Ilimitados'
                : `${p.max_websites + (pd?.extra_websites || 0)} Sites (${p.max_websites} base + ${pd?.extra_websites || 0} extras)`;
              const aiCapacity = `${((p.ai_monthly_tokens + (pd?.extra_ai_tokens || 0)) / 1000).toLocaleString('pt-BR')}k Tokens/mês`;
              const planPrice = Number(p.price_monthly) + (pd?.extra_websites_price || 0) + (pd?.extra_ai_tokens_price || 0);

              // Validação de capacidade
              const isCapacityInsufficient = p.max_websites !== null &&
                (p.max_websites + (pd?.extra_websites || 0)) < (pd?.websites_count || 0);

              return (
                <Paper
                  key={p.id}
                  p="sm"
                  radius="md"
                  onClick={() => {
                    if (!isCapacityInsufficient) {
                      setTargetUpgradePlanId(p.id);
                    }
                  }}
                  style={{
                    cursor: isCapacityInsufficient ? 'not-allowed' : 'pointer',
                    background: isSelected
                      ? 'rgba(99, 102, 241, 0.15)'
                      : isCurrent
                      ? 'rgba(30, 41, 59, 0.8)'
                      : 'rgba(30, 41, 59, 0.4)',
                    border: isSelected
                      ? '2px solid #6366f1'
                      : isCurrent
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    opacity: isCapacityInsufficient ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Group justify="space-between" align="center">
                    <div>
                      <Group gap="xs">
                        <Text fw={700} size="sm" c="white">
                          Plano {p.name}
                        </Text>
                        {isCurrent && (
                          <Badge color="green" size="xs" variant="light">
                            Plano Atual
                          </Badge>
                        )}
                        {isSelected && !isCurrent && (
                          <Badge color="indigo" size="xs" variant="filled">
                            Selecionado
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" mt={2}>
                        {p.description || 'Monitoramento contínuo e remediação com IA.'}
                      </Text>
                      <Group gap="xs" mt={4}>
                        <Badge color="blue" size="xs" variant="outline">
                          {websitesCapacity}
                        </Badge>
                        <Badge color="violet" size="xs" variant="outline">
                          {aiCapacity}
                        </Badge>
                      </Group>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <Text fw={700} size="md" c="indigo.3">
                        R$ {planPrice.toFixed(2).replace('.', ',')}
                        <Text component="span" size="xs" c="dimmed" fw={400}> /mês</Text>
                      </Text>
                      {isCapacityInsufficient && (
                        <Text size="10px" c="red.4" mt={2}>
                          Insuficiente para {pd?.websites_count} sites
                        </Text>
                      )}
                    </div>
                  </Group>
                </Paper>
              );
            })}
          </Stack>

          {/* Validação de erro se o selecionado não comportar */}
          {(() => {
            const selectedP = data?.available_plans.find((p) => p.id === targetUpgradePlanId);
            if (
              selectedP &&
              selectedP.max_websites !== null &&
              selectedP.max_websites + (pd?.extra_websites || 0) < (pd?.websites_count || 0)
            ) {
              const diff = (pd?.websites_count || 0) - (selectedP.max_websites + (pd?.extra_websites || 0));
              return (
                <Alert color="red" variant="filled" icon={<IconAlertCircle size={16} />}>
                  <Text size="xs">
                    Você possui <b>{pd?.websites_count} sites cadastrados</b>. O Plano {selectedP.name} com seus add-ons comportará apenas <b>{selectedP.max_websites + (pd?.extra_websites || 0)} sites</b>. Exclua pelo menos <b>{diff} site(s)</b> antes de selecionar este plano.
                  </Text>
                </Alert>
              );
            }
            return null;
          })()}

          {/* Transparência de Pró-rata e Próxima Fatura */}
          {(() => {
            if (!targetUpgradePlanId || targetUpgradePlanId === pd?.plan_id) return null;
            const sp = data?.available_plans.find((p) => p.id === targetUpgradePlanId);
            if (!sp) return null;

            const newTotal = Number(sp.price_monthly) + (Number(pd?.extra_websites || 0) * 8) + (Number(pd?.extra_ai_tokens_price || 0));
            const diff = Math.round((newTotal - currentTotalMonthly) * 100) / 100;
            const isDowngrade = diff <= 0;
            const proratedDue = diff > 0 ? Math.round(diff * proratedRatioCalc * 100) / 100 : 0;

            if (isDowngrade) {
              return (
                <Alert color="teal" variant="light" icon={<IconInfoCircle size={18} />}>
                  <Text size="xs" fw={700}>Efeito na Próxima Fatura (Nenhuma cobrança hoje):</Text>
                  <Text size="xs" mt={2}>
                    Nenhum valor será cobrado agora. Seu plano atual permanece ativo até <b>{nextCycleDueDateFmt}</b>.
                    A partir dessa data, sua fatura passará para <b>R$ {newTotal.toFixed(2).replace('.', ',')}/mês</b> no Plano {sp.name} (seus add-ons continuam preservados).
                  </Text>
                </Alert>
              );
            }

            return (
              <Alert color="indigo" variant="light" icon={<IconTrendingUp size={18} />}>
                <Text size="xs" fw={700}>Cobrança Proporcional aos Dias Restantes (Pró-rata):</Text>
                <Text size="xs" mt={2}>
                  Faltam <b>{daysRemainingInCycle} dias</b> até sua renovação em <b>{nextCycleDueDateFmt}</b>.
                  Você não paga o plano cheio novamente hoje: paga apenas <b>R$ {proratedDue.toFixed(2).replace('.', ',')}</b> referente aos dias restantes.
                  A partir de <b>{nextCycleDueDateFmt}</b>, sua assinatura mensal regular passará para <b>R$ {newTotal.toFixed(2).replace('.', ',')}/mês</b>.
                </Text>
              </Alert>
            );
          })()}

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" size="sm" onClick={() => setUpgradeModalOpen(false)} disabled={upgradingPlan}>
              Cancelar
            </Button>
            <Button
              color="indigo"
              variant="gradient"
              gradient={{ from: 'indigo.6', to: 'violet.6' }}
              size="sm"
              onClick={handleConfirmUpgrade}
              loading={upgradingPlan}
              disabled={
                !targetUpgradePlanId ||
                targetUpgradePlanId === pd?.plan_id ||
                (() => {
                  const sp = data?.available_plans.find((p) => p.id === targetUpgradePlanId);
                  return (
                    sp &&
                    sp.max_websites !== null &&
                    sp.max_websites + (pd?.extra_websites || 0) < (pd?.websites_count || 0)
                  );
                })()
              }
              leftSection={<IconCrown size={16} />}
            >
              {(() => {
                if (!targetUpgradePlanId || targetUpgradePlanId === pd?.plan_id) return 'Confirmar Upgrade';
                const sp = data?.available_plans.find((p) => p.id === targetUpgradePlanId);
                if (!sp) return 'Confirmar Upgrade';
                const newTotal = Number(sp.price_monthly) + (Number(pd?.extra_websites || 0) * 8) + (Number(pd?.extra_ai_tokens_price || 0));
                const diff = Math.round((newTotal - currentTotalMonthly) * 100) / 100;
                if (diff <= 0) return 'Confirmar Alteração para Próximo Mês';
                const proratedDue = Math.round(diff * proratedRatioCalc * 100) / 100;
                return `Confirmar Upgrade (R$ ${proratedDue.toFixed(2).replace('.', ',')} Pró-rata)`;
              })()}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de Gestão / Contratação de Add-ons */}
      <Modal
        opened={addonsModalOpen}
        onClose={() => setAddonsModalOpen(false)}
        title={
          <Group gap="xs">
            <IconSparkles size={20} color="var(--mantine-color-teal-4)" />
            <Text fw={700} size="md">
              Contratar ou Gerenciar Add-ons
            </Text>
          </Group>
        }
        size="lg"
        radius="md"
        centered
        styles={{
          header: { background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' },
          content: { background: '#0f172a', border: '1px solid rgba(20, 184, 166, 0.3)' },
        }}
      >
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Personalize sua assinatura adicionando sites extras ou pacotes de inteligência artificial. Os valores serão integrados à sua mensalidade recorrente.
          </Text>

          {/* Add-on 1: Sites Extras */}
          <Card p="md" radius="md" bg="rgba(15, 23, 42, 0.7)" style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Group justify="space-between" mb="xs">
              <div>
                <Group gap="xs">
                  <ThemeIcon color="blue" variant="light" size="sm">
                    <IconWorld size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={700} c="white">
                    Sites Extras (+R$ 8,00/mês por site)
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  Plano base {pd?.plan_name}: <b>{pd?.base_max_websites ?? 'Ilimitados'} sites</b> • Atualmente cadastrados: <b>{pd?.websites_count || 0} sites</b>
                </Text>
              </div>
              <Badge color="blue" variant="light">
                +R$ {(modalExtraWebsites * 8).toFixed(2).replace('.', ',')}/mês
              </Badge>
            </Group>

            <Group gap="md" align="center" mt="xs">
              <NumberInput
                min={0}
                max={100}
                value={modalExtraWebsites}
                onChange={(val) => setModalExtraWebsites(Number(val) || 0)}
                placeholder="0 sites"
                style={{ width: 140 }}
                size="sm"
              />
              <Text size="xs" c="dimmed">
                Capacidade total resultante:{' '}
                <Text component="span" fw={700} c={isAddonRemovalBlocked ? 'red.4' : 'blue.3'}>
                  {baseWebsitesLimit !== null ? `${newEffectiveWebsitesLimit} sites` : 'Ilimitado'}
                </Text>
              </Text>
            </Group>

            {/* ALERTA DE REMOÇÃO BLOQUEADA (REGRA MANDATÓRIA) */}
            {isAddonRemovalBlocked && (
              <Alert color="red" variant="filled" icon={<IconAlertCircle size={16} />} mt="sm">
                <Text size="xs" fw={700}>Remoção Bloqueada:</Text>
                <Text size="xs" mt={2}>
                  Você possui <b>{userWebsitesCount} sites cadastrados</b> no sistema, mas o limite com esta configuração seria de apenas <b>{newEffectiveWebsitesLimit} sites</b> ({baseWebsitesLimit} do plano {pd?.plan_name} + {modalExtraWebsites} extras).
                  Para remover ou reduzir este add-on, você deve primeiro excluir ou desvincular pelo menos <b>{sitesExcessCount} site(s)</b>.
                </Text>
              </Alert>
            )}
          </Card>

          {/* Add-on 2: Pacotes Extras de IA */}
          <Card p="md" radius="md" bg="rgba(15, 23, 42, 0.7)" style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Group justify="space-between" mb="xs">
              <div>
                <Group gap="xs">
                  <ThemeIcon color="violet" variant="light" size="sm">
                    <IconBrain size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={700} c="white">
                    Pacotes IA (+250k tokens por R$ 60,00/mês cada)
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  Plano base {pd?.plan_name}: <b>{((pd?.base_ai_tokens || 0) / 1000).toLocaleString('pt-BR')}k tokens</b>
                </Text>
              </div>
              <Badge color="violet" variant="light">
                +R$ {(modalExtraAiPacks * 60).toFixed(2).replace('.', ',')}/mês
              </Badge>
            </Group>

            <Group gap="md" align="center" mt="xs">
              <NumberInput
                min={0}
                max={20}
                value={modalExtraAiPacks}
                onChange={(val) => setModalExtraAiPacks(Number(val) || 0)}
                placeholder="0 pacotes"
                style={{ width: 140 }}
                size="sm"
              />
              <Text size="xs" c="dimmed">
                Cota total resultante:{' '}
                <Text component="span" fw={700} c="violet.3">
                  {(((pd?.base_ai_tokens || 0) + (modalExtraAiPacks * 250000)) / 1000).toLocaleString('pt-BR')}k tokens/mês
                </Text>
              </Text>
            </Group>
          </Card>

          {/* Resumo do Novo Faturamento Mensal */}
          <Paper p="sm" radius="md" bg="rgba(30, 41, 59, 0.5)" style={{ border: '1px dashed rgba(255, 255, 255, 0.15)' }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed">Novo Valor Mensal Estimado:</Text>
                <Text size="xs" c="dimmed">
                  Plano {pd?.plan_name} (R$ {(pd?.base_price || 0).toFixed(2).replace('.', ',')}) + Sites Extras (R$ {(modalExtraWebsites * 8).toFixed(2).replace('.', ',')}) + IA Extra (R$ {(modalExtraAiPacks * 60).toFixed(2).replace('.', ',')})
                </Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text fw={800} size="lg" c="teal.3">
                  R$ {newAddonsTotalMonthly.toFixed(2).replace('.', ',')}
                  <Text component="span" size="xs" c="dimmed" fw={400}> /mês</Text>
                </Text>
              </div>
            </Group>
          </Paper>

          {/* Transparência: Pró-rata vs Próximo Mês */}
          {isAddonsDowngrade ? (
            <Alert color="teal" variant="light" icon={<IconInfoCircle size={18} />}>
              <Text size="xs" fw={700}>Efeito na Próxima Fatura (Nenhuma cobrança hoje):</Text>
              <Text size="xs" mt={2}>
                Você já possui seus add-ons pagos até <b>{nextCycleDueDateFmt}</b>. Nenhum valor será cobrado agora.
                Ao confirmar, seus recursos atuais permanecem ativos até <b>{nextCycleDueDateFmt}</b>, e a partir dessa data sua fatura passará a ser de <b>R$ {newAddonsTotalMonthly.toFixed(2).replace('.', ',')}/mês</b>.
              </Text>
            </Alert>
          ) : (
            <Alert color="indigo" variant="light" icon={<IconTrendingUp size={18} />}>
              <Text size="xs" fw={700}>Cobrança Proporcional aos Dias Restantes (Pró-rata):</Text>
              <Text size="xs" mt={2}>
                Faltam <b>{daysRemainingInCycle} dias</b> até seu próximo vencimento em <b>{nextCycleDueDateFmt}</b>.
                Você não paga o plano cheio novamente: paga apenas <b>R$ {addonsProratedDueNow.toFixed(2).replace('.', ',')}</b> correspondente aos dias restantes.
                A partir de <b>{nextCycleDueDateFmt}</b>, sua fatura regular passará a ser de <b>R$ {newAddonsTotalMonthly.toFixed(2).replace('.', ',')}/mês</b>.
              </Text>
            </Alert>
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" size="sm" onClick={() => setAddonsModalOpen(false)} disabled={savingAddons}>
              Cancelar
            </Button>
            <Button
              color="teal"
              variant="gradient"
              gradient={{ from: 'teal.6', to: 'green.6' }}
              size="sm"
              onClick={handleSaveAddons}
              loading={savingAddons}
              disabled={isAddonRemovalBlocked}
              leftSection={<IconDeviceFloppy size={16} />}
            >
              {isAddonsDowngrade
                ? 'Confirmar Redução para o Próximo Mês'
                : `Confirmar e Contratar Add-ons (R$ ${addonsProratedDueNow.toFixed(2).replace('.', ',')} Pró-rata)`}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de Pagamento PIX Pró-rata */}
      <Modal
        opened={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        title={
          <Group gap="xs">
            <IconQrcode size={20} color="var(--mantine-color-teal-4)" />
            <Text fw={700} size="md">
              Pagamento da Diferença Proporcional (PIX)
            </Text>
          </Group>
        }
        size="md"
        radius="md"
        centered
        styles={{
          header: { background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' },
          content: { background: '#0f172a', border: '1px solid rgba(20, 184, 166, 0.4)' },
        }}
      >
        <Stack gap="md" align="center">
          <Alert color="indigo" variant="light" style={{ width: '100%' }}>
            <Text size="xs">
              Faltam <b>{pixData?.days_remaining} dias</b> até sua renovação em <b>{pixData?.next_due_date_formatted}</b>.
              Efetue o pagamento abaixo para ativar seus novos limites imediatamente.
            </Text>
          </Alert>

          <Paper p="md" radius="md" bg="rgba(30, 41, 59, 0.6)" style={{ textAlign: 'center', width: '100%' }}>
            <Text size="xs" c="dimmed">Valor Proporcional a Pagar:</Text>
            <Text fw={800} size="xl" c="teal.3">
              R$ {(pixData?.prorated_amount || 0).toFixed(2).replace('.', ',')}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Sua próxima mensalidade em {pixData?.next_due_date_formatted} será de R$ {(pixData?.new_monthly || 0).toFixed(2).replace('.', ',')}/mês
            </Text>
          </Paper>

          {pixData?.pix_qr_code && (
            <Paper p="sm" radius="md" bg="white" style={{ display: 'inline-block' }}>
              <img
                src={pixData.pix_qr_code}
                alt="QR Code PIX"
                style={{ width: 180, height: 180, display: 'block' }}
              />
            </Paper>
          )}

          {pixData?.pix_copy_paste && (
            <Stack gap="xs" style={{ width: '100%' }}>
              <Text size="xs" c="dimmed" ta="center">
                Código Copia e Cola:
              </Text>
              <TextInput
                readOnly
                value={pixData.pix_copy_paste}
                size="xs"
                rightSection={
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color={pixCopied ? 'teal' : 'blue'}
                    onClick={() => {
                      if (pixData?.pix_copy_paste) {
                        navigator.clipboard.writeText(pixData.pix_copy_paste);
                        setPixCopied(true);
                        setTimeout(() => setPixCopied(false), 3000);
                      }
                    }}
                  >
                    {pixCopied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </Button>
                }
              />
            </Stack>
          )}

          <Group justify="space-between" style={{ width: '100%' }} mt="sm">
            <Button variant="subtle" color="gray" size="sm" onClick={() => setPixModalOpen(false)}>
              Fechar
            </Button>
            <Button
              color="teal"
              variant="gradient"
              gradient={{ from: 'teal.6', to: 'green.6' }}
              size="sm"
              onClick={handleConfirmPixPayment}
              loading={confirmingPix}
              leftSection={<IconCheck size={16} />}
            >
              Já paguei via PIX
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de Renovação / Contratação de Plano */}
      {renewModalOpen && (
        <CheckoutModal
          opened={renewModalOpen}
          onClose={() => setRenewModalOpen(false)}
          selectedPlan={checkoutPlan || currentPlan || (data?.available_plans?.[0] ?? null)}
          currentUser={initialUser}
          initialExtraWebsites={checkoutExtraWebsites}
          initialExtraAiPacks={checkoutExtraAiPacks}
          onPaymentSuccess={() => {
            setRenewModalOpen(false);
            loadData();
          }}
        />
      )}
    </Stack>
  );
}
