import { useState, useEffect, useRef } from 'react';
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
  PasswordInput,
  SimpleGrid,
  CopyButton,
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
  IconLock,
  IconShieldCheck,
  IconMapPin,
  IconTrash,
} from '@tabler/icons-react';
import {
  getUserPlanDetails,
  updateUserPlan,
  getUserAiLogs,
  cancelSubscription,
  upgradePlanWithOptions,
  manageAddons,
  confirmProratedPix,
  requestAccountDeletion,
  UserPlanResponse,
  AiUsageLogItem,
  Plan,
} from '../api';
import { formatDateTime, formatDateOnly, formatMonthYear, parseDate } from '../utils/date';
import { CheckoutModal } from './CheckoutModal';

const formatCpfCnpjValue = (val: string): string => {
  const raw = (val || '').replace(/\D/g, '').slice(0, 14);
  if (raw.length <= 11) {
    if (raw.length > 9) return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
    if (raw.length > 6) return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
    if (raw.length > 3) return `${raw.slice(0, 3)}.${raw.slice(3)}`;
    return raw;
  }
  let formatted = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}`;
  if (raw.length > 12) formatted += `-${raw.slice(12)}`;
  return formatted;
};

const extractErrorMessage = (err: any, fallback: string): string => {
  if (!err) return fallback;
  const resData = err.response?.data;
  if (typeof resData === 'string' && resData.length > 0) {
    if (resData.includes('<html') || resData.includes('<!DOCTYPE')) {
      return 'Erro interno temporário no servidor (HTTP 500). Verifique os logs da aplicação.';
    }
    return resData;
  }
  if (resData?.messages?.error) return String(resData.messages.error);
  if (resData?.message) return String(resData.message);
  if (resData?.error) return String(resData.error);
  if (err.message && typeof err.message === 'string') return err.message;
  return fallback;
};

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
  const [extraAiTokens, setExtraAiTokens] = useState<number>(0);
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

  // Exclusão de Conta com Carência de 90 Dias
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    title: string;
    message: string | React.ReactNode;
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
  const [upgradeStep, setUpgradeStep] = useState<'config' | 'payment'>('config');
  const [upgradePaymentMethod, setUpgradePaymentMethod] = useState<'credit_card' | 'pix'>('credit_card');
  const [upgradeCardHolder, setUpgradeCardHolder] = useState(initialUser.name || '');
  const [upgradeCpfCnpj, setUpgradeCpfCnpj] = useState('');
  const [upgradeCardNumber, setUpgradeCardNumber] = useState('');
  const [upgradeCardExpiry, setUpgradeCardExpiry] = useState('');
  const [upgradeCardCcv, setUpgradeCardCcv] = useState('');
  const [upgradePostalCode, setUpgradePostalCode] = useState('');
  const [upgradeAddressNumber, setUpgradeAddressNumber] = useState('');
  const [upgradePaymentError, setUpgradePaymentError] = useState<string | null>(null);
  const [upgradePixData, setUpgradePixData] = useState<{
    payment_id: string;
    prorated_amount: number;
    pix_qr_code?: string | null;
    pix_copy_paste?: string | null;
    days_remaining?: number;
    next_due_date_formatted?: string;
    new_monthly?: number;
  } | null>(null);
  const [upgradePixLoading, setUpgradePixLoading] = useState(false);

  // Addons Modal State
  const [addonsModalOpen, setAddonsModalOpen] = useState(false);
  const [modalExtraWebsites, setModalExtraWebsites] = useState<number>(0);
  const [modalExtraAiPacks, setModalExtraAiPacks] = useState<number>(0);
  const [savingAddons, setSavingAddons] = useState(false);
  const [addonStep, setAddonStep] = useState<'config' | 'payment'>('config');
  const [addonPaymentMethod, setAddonPaymentMethod] = useState<'credit_card' | 'pix'>('credit_card');
  const [addonCardHolder, setAddonCardHolder] = useState(initialUser.name || '');
  const [addonCpfCnpj, setAddonCpfCnpj] = useState('');
  const [addonCardNumber, setAddonCardNumber] = useState('');
  const [addonCardExpiry, setAddonCardExpiry] = useState('');
  const [addonCardCcv, setAddonCardCcv] = useState('');
  const [addonPostalCode, setAddonPostalCode] = useState('');
  const [addonAddressNumber, setAddonAddressNumber] = useState('');
  const [addonPaymentError, setAddonPaymentError] = useState<string | null>(null);
  const [addonPixData, setAddonPixData] = useState<{
    payment_id: string;
    prorated_amount: number;
    pix_qr_code?: string | null;
    pix_copy_paste?: string | null;
    days_remaining?: number;
    next_due_date_formatted?: string;
    new_monthly?: number;
  } | null>(null);
  const [addonPixLoading, setAddonPixLoading] = useState(false);

  const addonPixPollingRef = useRef<any>(null);
  const upgradePixPollingRef = useRef<any>(null);

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
      setExtraAiTokens(pd.extra_ai_tokens || 0);
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
        extra_websites_price: calculatedExtraWebsitesPrice,
        extra_ai_tokens: Number(extraAiTokens) || 0,
        extra_ai_tokens_price: calculatedExtraAiTokensPrice,
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

  const handleConfirmAccountDeletion = async () => {
    if (!deletePassword) {
      setDeleteAccountError('Por favor, informe sua senha atual para confirmar a exclusão.');
      return;
    }

    setDeletingAccount(true);
    setDeleteAccountError(null);

    try {
      const res = await requestAccountDeletion(deletePassword);
      setDeleteAccountModalOpen(false);
      alert(res.message);
      // Logout imediato
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user');
      window.location.reload();
    } catch (err: any) {
      setDeleteAccountError(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Falha ao solicitar a exclusão da conta. Verifique sua senha e tente novamente.'
      );
    } finally {
      setDeletingAccount(false);
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
  const isCurrentPlanFree = Number(pd?.base_price ?? currentPlan?.price_monthly ?? 0) === 0 || currentPlan?.slug === 'free' || (pd?.plan_name || '').toLowerCase() === 'free';

  const allowCreditCard = data?.payment_methods ? data.payment_methods.credit_card : true;
  const allowPix = data?.payment_methods ? data.payment_methods.pix : false;

  // Global addon pricing reference
  const addonPricing = data?.addon_pricing || data?.plan_details?.addon_pricing || {
    extra_website_price: 8,
    ai_pack_price: 60,
    ai_pack_tokens: 250000,
  };

  const calculatedExtraWebsitesPrice = Math.round(Number(extraWebsites || 0) * (addonPricing.extra_website_price || 8) * 100) / 100;
  const aiPackTokens = addonPricing.ai_pack_tokens || 250000;
  const aiPackPrice = addonPricing.ai_pack_price || 60;
  const calculatedExtraAiTokensPrice = Math.round((Number(extraAiTokens || 0) / aiPackTokens) * aiPackPrice * 100) / 100;

  // Dynamic preview calculations for admin form
  const previewBaseWebsites = currentPlan ? currentPlan.max_websites : null;
  const previewTotalWebsites = previewBaseWebsites !== null ? previewBaseWebsites + Number(extraWebsites || 0) : null;

  const previewBaseAi = currentPlan ? currentPlan.ai_monthly_tokens : 250000;
  const previewTotalAi = previewBaseAi + Number(extraAiTokens || 0);

  const previewBasePrice = currentPlan ? currentPlan.price_monthly : 0;
  const previewTotalPrice = Number(previewBasePrice) + calculatedExtraWebsitesPrice + calculatedExtraAiTokensPrice;

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
  const newAddonsTotalMonthly = (pd?.base_price || 0) + (modalExtraWebsites * (addonPricing.extra_website_price || 8)) + (modalExtraAiPacks * aiPackPrice);
  const addonsDiffMonthly = Math.round((newAddonsTotalMonthly - currentTotalMonthly) * 100) / 100;
  const isAddonsDowngrade = addonsDiffMonthly <= 0;
  const cycleEnd = sub?.current_period_end;

  // Normalização do ciclo mensal:
  // Se cycleEnd estiver além de 35 dias no futuro (bug legado de 365 dias), normaliza para 30 dias
  const rawDaysRemaining = cycleEnd ? Math.max(1, Math.ceil((new Date(cycleEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 30;
  const daysRemainingInCycle = Math.min(30, rawDaysRemaining);

  const getMonthlyRenewalDate = (cycleEndVal: string | null | undefined): string => {
    if (!cycleEndVal) {
      return formatDateOnly(new Date(Date.now() + 30 * 86400000).toISOString());
    }
    const endMs = new Date(cycleEndVal).getTime();
    const diffDays = Math.ceil((endMs - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays > 35) {
      return formatDateOnly(new Date(Date.now() + 30 * 86400000).toISOString());
    }
    return formatDateOnly(cycleEndVal);
  };

  const nextCycleDueDateFmt = getMonthlyRenewalDate(cycleEnd);
  const proratedRatioCalc = Math.min(1.0, Math.max(0.033, daysRemainingInCycle / 30.0));
  const addonsProratedDueNow = addonsDiffMonthly > 0 ? Math.round(addonsDiffMonthly * proratedRatioCalc * 100) / 100 : 0;

  const selectedUpgradePlan = data?.available_plans.find((p) => p.id === targetUpgradePlanId);
  const upgradeNewTotal = selectedUpgradePlan
    ? Number(selectedUpgradePlan.price_monthly) + (Number(pd?.extra_websites || 0) * (addonPricing.extra_website_price || 8)) + (Number(pd?.extra_ai_tokens_price || 0))
    : 0;
  const upgradeDiffMonthly = Math.round((upgradeNewTotal - currentTotalMonthly) * 100) / 100;
  const isUpgradeDowngrade = upgradeDiffMonthly <= 0;
  const upgradeProratedDue = isCurrentPlanFree
    ? upgradeNewTotal
    : (upgradeDiffMonthly > 0 ? Math.round(upgradeDiffMonthly * proratedRatioCalc * 100) / 100 : 0);

  const getDayOfMonth = (val: string | number | Date | null | undefined): number => {
    if (!val) return 1;
    if (typeof val === 'string') {
      const match = val.match(/^\d{4}-\d{2}-(\d{2})/);
      if (match) return parseInt(match[1], 10);
    }
    const d = parseDate(val);
    return d ? d.getDate() : 1;
  };

  const startDateRaw = sub?.current_period_start || sub?.created_at || pd?.user_created_at || (initialUser as any)?.created_at;
  const planStartDateFmt = startDateRaw ? formatDateOnly(startDateRaw) : formatDateOnly(new Date().toISOString());
  const nextPaymentDateFmt = getMonthlyRenewalDate(cycleEnd);
  const renewalDayNumber = getDayOfMonth(startDateRaw || cycleEnd);

  const handleCardNumberFormat = (val: string, setter: (v: string) => void) => {
    const raw = val.replace(/\D/g, '').slice(0, 16);
    setter(raw.replace(/(\d{4})(?=\d)/g, '$1 '));
  };

  const handleCardExpiryFormat = (val: string, setter: (v: string) => void) => {
    const raw = val.replace(/\D/g, '').slice(0, 4);
    if (raw.length <= 2) {
      setter(raw);
    } else {
      setter(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    }
  };

  const handleCardCcvFormat = (val: string, setter: (v: string) => void) => {
    setter(val.replace(/\D/g, '').slice(0, 4));
  };

  const handlePostalCodeFormat = (val: string, setter: (v: string) => void) => {
    const raw = val.replace(/\D/g, '').slice(0, 8);
    if (raw.length <= 5) {
      setter(raw);
    } else {
      setter(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
  };

  const handleCpfCnpjFormat = (val: string, setter: (v: string) => void) => {
    setter(formatCpfCnpjValue(val));
  };

  const handleOpenAddonsModal = () => {
    setModalExtraWebsites(pd?.extra_websites || 0);
    setModalExtraAiPacks(Math.round((pd?.extra_ai_tokens || 0) / (aiPackTokens || 250000)));
    setAddonStep('config');
    const defaultPm = allowCreditCard ? 'credit_card' : 'pix';
    setAddonPaymentMethod(sub?.payment_method === 'pix' && allowPix ? 'pix' : defaultPm);
    setAddonPaymentError(null);
    setAddonPixData(null);
    setAddonCardHolder(initialUser.name || '');
    setAddonCpfCnpj(formatCpfCnpjValue(pd?.user_cpf_cnpj || (initialUser as any)?.cpf_cnpj || ''));
    setAddonCardNumber('');
    setAddonCardExpiry('');
    setAddonCardCcv('');
    setAddonPostalCode('');
    setAddonAddressNumber('');
    setAddonsModalOpen(true);
  };

  const handleOpenUpgradeModal = () => {
    setTargetUpgradePlanId(pd?.plan_id ? Number(pd.plan_id) : null);
    setUpgradeStep('config');
    const defaultPm = allowCreditCard ? 'credit_card' : 'pix';
    setUpgradePaymentMethod(sub?.payment_method === 'pix' && allowPix ? 'pix' : defaultPm);
    setUpgradePaymentError(null);
    setUpgradePixData(null);
    setUpgradeCardHolder(initialUser.name || '');
    setUpgradeCpfCnpj(formatCpfCnpjValue(pd?.user_cpf_cnpj || (initialUser as any)?.cpf_cnpj || ''));
    setUpgradeCardNumber('');
    setUpgradeCardExpiry('');
    setUpgradeCardCcv('');
    setUpgradePostalCode('');
    setUpgradeAddressNumber('');
    setUpgradeModalOpen(true);
  };

  // Polling for Addon Pix payment
  useEffect(() => {
    if (addonsModalOpen && addonStep === 'payment' && addonPaymentMethod === 'pix' && addonPixData?.payment_id) {
      addonPixPollingRef.current = setInterval(async () => {
        try {
          const res = await confirmProratedPix({
            payment_id: addonPixData.payment_id,
            plan_id: pd?.plan_id ? Number(pd.plan_id) : undefined,
            extra_websites: modalExtraWebsites,
            extra_ai_tokens: modalExtraAiPacks * aiPackTokens,
            user_id: initialUser.id,
          });
          if (res.paid) {
            clearInterval(addonPixPollingRef.current);
            setAddonsModalOpen(false);
            setAddonStep('config');
            setFeedback({
              title: 'Pagamento PIX Confirmado!',
              message: res.message || 'Add-ons ativados com sucesso! Seus novos limites já estão disponíveis.',
              color: 'teal',
              icon: 'check',
            });
            await loadData();
          }
        } catch (e) {
          // Keep polling silently
        }
      }, 4000);

      return () => {
        if (addonPixPollingRef.current) {
          clearInterval(addonPixPollingRef.current);
        }
      };
    }
  }, [addonsModalOpen, addonStep, addonPaymentMethod, addonPixData, modalExtraWebsites, modalExtraAiPacks, pd?.plan_id, initialUser.id]);

  // Polling for Upgrade Pix payment
  useEffect(() => {
    if (upgradeModalOpen && upgradeStep === 'payment' && upgradePaymentMethod === 'pix' && upgradePixData?.payment_id && targetUpgradePlanId) {
      upgradePixPollingRef.current = setInterval(async () => {
        try {
          const res = await confirmProratedPix({
            payment_id: upgradePixData.payment_id,
            plan_id: targetUpgradePlanId,
            extra_websites: pd?.extra_websites || 0,
            extra_ai_tokens: pd?.extra_ai_tokens || 0,
            user_id: initialUser.id,
          });
          if (res.paid) {
            clearInterval(upgradePixPollingRef.current);
            setUpgradeModalOpen(false);
            setUpgradeStep('config');
            setFeedback({
              title: 'Pagamento PIX Confirmado!',
              message: res.message || 'Upgrade de plano confirmado com sucesso!',
              color: 'teal',
              icon: 'check',
            });
            await loadData();
          }
        } catch (e) {
          // Keep polling silently
        }
      }, 4000);

      return () => {
        if (upgradePixPollingRef.current) {
          clearInterval(upgradePixPollingRef.current);
        }
      };
    }
  }, [upgradeModalOpen, upgradeStep, upgradePaymentMethod, upgradePixData, targetUpgradePlanId, pd?.extra_websites, pd?.extra_ai_tokens, initialUser.id]);

  // Clean polling intervals on unmount
  useEffect(() => {
    return () => {
      if (addonPixPollingRef.current) clearInterval(addonPixPollingRef.current);
      if (upgradePixPollingRef.current) clearInterval(upgradePixPollingRef.current);
    };
  }, []);

  // Redução de add-ons (sem cobrança agora)
  const handleSaveAddonsReduction = async () => {
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

      setAddonsModalOpen(false);
      setFeedback({
        title: 'Redução Agendada para a Próxima Fatura',
        message: res.message,
        color: 'blue',
        icon: 'info',
      });
      await loadData();
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

  // Avançar para o Quadro de Pagamento de Add-ons
  const handleProceedToAddonPayment = async () => {
    const baseMax = pd?.base_max_websites;
    const currentWebsites = pd?.websites_count || 0;
    if (baseMax !== null && baseMax !== undefined) {
      const newLimit = baseMax + modalExtraWebsites;
      if (currentWebsites > newLimit) {
        setErrorMessage(
          `Não é possível remover ou reduzir o add-on de sites: você possui ${currentWebsites} sites cadastrados, mas o novo limite seria de ${newLimit} sites. Remova pelo menos ${currentWebsites - newLimit} site(s) primeiro.`
        );
        return;
      }
    }

    setAddonPaymentError(null);
    setAddonStep('payment');

    if (addonPaymentMethod === 'pix' && !addonPixData) {
      handleGenerateAddonPix();
    }
  };

  // Gerar cobrança Pix para add-ons
  const handleGenerateAddonPix = async () => {
    try {
      setAddonPixLoading(true);
      setAddonPaymentError(null);
      const res = await manageAddons({
        extra_websites: modalExtraWebsites,
        extra_ai_packs: modalExtraAiPacks,
        user_id: initialUser.id,
        billing_type: 'PIX',
      });

      if (res.require_pix && res.payment_id) {
        setAddonPixData({
          payment_id: res.payment_id,
          prorated_amount: res.prorated_amount || addonsProratedDueNow,
          pix_qr_code: res.pix_qr_code,
          pix_copy_paste: res.pix_copy_paste,
          days_remaining: res.days_remaining,
          next_due_date_formatted: res.next_due_date_formatted,
          new_monthly: res.new_monthly,
        });
      } else if (res.require_checkout) {
        setAddonsModalOpen(false);
        setCheckoutPlan(currentPlan || null);
        setCheckoutExtraWebsites(modalExtraWebsites);
        setCheckoutExtraAiPacks(modalExtraAiPacks);
        setRenewModalOpen(true);
      }
    } catch (err: any) {
      console.error(err);
      setAddonPaymentError(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Falha ao gerar cobrança PIX para os add-ons.'
      );
    } finally {
      setAddonPixLoading(false);
    }
  };

  // Pagar add-ons no cartão de crédito
  const handlePayAddonsWithCard = async () => {
    const cleanNumber = addonCardNumber.replace(/\D/g, '');
    const cleanCcv = addonCardCcv.replace(/\D/g, '');
    const cleanCep = addonPostalCode.replace(/\D/g, '');
    const cleanCpfCnpj = addonCpfCnpj.replace(/\D/g, '');

    if (!addonCardHolder.trim()) {
      setAddonPaymentError('Informe o nome impresso no cartão.');
      return;
    }
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      setAddonPaymentError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido do titular.');
      return;
    }
    if (cleanNumber.length < 15) {
      setAddonPaymentError('Número do cartão inválido (mínimo 15 dígitos).');
      return;
    }
    const [monthStr, yearStrRaw] = (addonCardExpiry || '').split('/');
    if (!monthStr || !yearStrRaw || monthStr.length !== 2 || yearStrRaw.length !== 2) {
      setAddonPaymentError('Validade do cartão inválida. Utilize o formato MM/AA.');
      return;
    }
    if (cleanCcv.length < 3) {
      setAddonPaymentError('Código CVV inválido (3 ou 4 dígitos).');
      return;
    }
    if (cleanCep.length !== 8) {
      setAddonPaymentError('Informe um CEP válido (8 dígitos).');
      return;
    }
    if (!addonAddressNumber.trim()) {
      setAddonPaymentError('Informe o número do endereço.');
      return;
    }

    const yearStr = `20${yearStrRaw}`;

    try {
      setSavingAddons(true);
      setAddonPaymentError(null);

      const res = await manageAddons({
        extra_websites: modalExtraWebsites,
        extra_ai_packs: modalExtraAiPacks,
        user_id: initialUser.id,
        billing_type: 'CREDIT_CARD',
        credit_card: {
          holder_name: addonCardHolder.trim().toUpperCase(),
          number: cleanNumber,
          expiry_month: monthStr,
          expiry_year: yearStr,
          ccv: cleanCcv,
          postal_code: cleanCep,
          address_number: addonAddressNumber.trim(),
          cpf_cnpj: cleanCpfCnpj,
        },
      });

      if (res.paid) {
        setAddonsModalOpen(false);
        setAddonStep('config');
        setFeedback({
          title: 'Add-ons Ativados com Sucesso!',
          message: res.message || 'Pagamento pró-rata aprovado no cartão de crédito. Seus recursos adicionais já estão disponíveis!',
          color: 'teal',
          icon: 'check',
        });
        await loadData();
      } else if (res.require_checkout) {
        setAddonsModalOpen(false);
        setCheckoutPlan(currentPlan || null);
        setCheckoutExtraWebsites(modalExtraWebsites);
        setCheckoutExtraAiPacks(modalExtraAiPacks);
        setRenewModalOpen(true);
      } else {
        setAddonPaymentError(res.message || 'Pagamento pendente ou recusado pela operadora.');
      }
    } catch (err: any) {
      console.error(err);
      setAddonPaymentError(
        extractErrorMessage(err, 'Falha ao processar pagamento do cartão. Verifique os dados ou limite disponível.')
      );
    } finally {
      setSavingAddons(false);
    }
  };

  // Verificar pagamento Pix de Add-ons
  const handleCheckAddonPixPayment = async () => {
    if (!addonPixData?.payment_id) return;
    try {
      setAddonPixLoading(true);
      setAddonPaymentError(null);
      const res = await confirmProratedPix({
        payment_id: addonPixData.payment_id,
        plan_id: pd?.plan_id ? Number(pd.plan_id) : undefined,
        extra_websites: modalExtraWebsites,
        extra_ai_tokens: modalExtraAiPacks * aiPackTokens,
        user_id: initialUser.id,
      });

      if (res.paid) {
        setAddonsModalOpen(false);
        setAddonStep('config');
        setFeedback({
          title: 'Pagamento PIX Confirmado!',
          message: res.message || 'Add-ons ativados com sucesso! Seus novos limites já estão disponíveis.',
          color: 'teal',
          icon: 'check',
        });
        await loadData();
      } else {
        setAddonPaymentError(res.message || 'Pagamento ainda não confirmado pelo Asaas. Aguarde alguns instantes após o pagamento no seu banco.');
      }
    } catch (err: any) {
      console.error(err);
      setAddonPaymentError(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao verificar pagamento PIX.'
      );
    } finally {
      setAddonPixLoading(false);
    }
  };

  // Upgrade downgrade (sem cobrança)
  const handleConfirmUpgradeDowngrade = async () => {
    if (!targetUpgradePlanId) return;
    try {
      setUpgradingPlan(true);
      setErrorMessage('');
      const res = await upgradePlanWithOptions({
        plan_id: targetUpgradePlanId,
        user_id: initialUser.id,
      });
      setUpgradeModalOpen(false);
      setFeedback({
        title: 'Alteração de Plano Programada',
        message: res.message,
        color: 'blue',
        icon: 'info',
      });
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao alterar plano.'
      );
    } finally {
      setUpgradingPlan(false);
    }
  };

  // Avançar para o Quadro de Pagamento do Upgrade
  const handleProceedToUpgradePayment = () => {
    setUpgradePaymentError(null);
    setUpgradeStep('payment');
    if (upgradePaymentMethod === 'pix' && !upgradePixData) {
      handleGenerateUpgradePix();
    }
  };

  // Gerar cobrança Pix para Upgrade
  const handleGenerateUpgradePix = async () => {
    if (!targetUpgradePlanId) return;
    try {
      setUpgradePixLoading(true);
      setUpgradePaymentError(null);
      const res = await upgradePlanWithOptions({
        plan_id: targetUpgradePlanId,
        user_id: initialUser.id,
        billing_type: 'PIX',
      });

      if (res.require_pix && res.payment_id) {
        setUpgradePixData({
          payment_id: res.payment_id,
          prorated_amount: res.prorated_amount || 0,
          pix_qr_code: res.pix_qr_code,
          pix_copy_paste: res.pix_copy_paste,
          days_remaining: res.days_remaining,
          next_due_date_formatted: res.next_due_date_formatted,
          new_monthly: res.new_monthly,
        });
      } else if (res.require_checkout) {
        setUpgradeModalOpen(false);
        const planToCheckout = data?.available_plans.find((p) => p.id === targetUpgradePlanId) || currentPlan || null;
        setCheckoutPlan(planToCheckout);
        setCheckoutExtraWebsites(pd?.extra_websites || 0);
        setCheckoutExtraAiPacks(Math.round((pd?.extra_ai_tokens || 0) / (aiPackTokens || 250000)));
        setRenewModalOpen(true);
      }
    } catch (err: any) {
      console.error(err);
      setUpgradePaymentError(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Falha ao gerar cobrança PIX para o upgrade.'
      );
    } finally {
      setUpgradePixLoading(false);
    }
  };

  // Pagar Upgrade no Cartão
  const handlePayUpgradeWithCard = async () => {
    if (!targetUpgradePlanId) return;
    const cleanNumber = upgradeCardNumber.replace(/\D/g, '');
    const cleanCcv = upgradeCardCcv.replace(/\D/g, '');
    const cleanCep = upgradePostalCode.replace(/\D/g, '');
    const cleanCpfCnpj = upgradeCpfCnpj.replace(/\D/g, '');

    if (!upgradeCardHolder.trim()) {
      setUpgradePaymentError('Informe o nome impresso no cartão.');
      return;
    }
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      setUpgradePaymentError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido do titular.');
      return;
    }
    if (cleanNumber.length < 15) {
      setUpgradePaymentError('Número do cartão inválido (mínimo 15 dígitos).');
      return;
    }
    const [monthStr, yearStrRaw] = (upgradeCardExpiry || '').split('/');
    if (!monthStr || !yearStrRaw || monthStr.length !== 2 || yearStrRaw.length !== 2) {
      setUpgradePaymentError('Validade do cartão inválida. Utilize o formato MM/AA.');
      return;
    }
    if (cleanCcv.length < 3) {
      setUpgradePaymentError('Código CVV inválido (3 ou 4 dígitos).');
      return;
    }
    if (cleanCep.length !== 8) {
      setUpgradePaymentError('Informe um CEP válido (8 dígitos).');
      return;
    }
    if (!upgradeAddressNumber.trim()) {
      setUpgradePaymentError('Informe o número do endereço.');
      return;
    }

    const yearStr = `20${yearStrRaw}`;

    try {
      setUpgradingPlan(true);
      setUpgradePaymentError(null);

      const res = await upgradePlanWithOptions({
        plan_id: targetUpgradePlanId,
        user_id: initialUser.id,
        billing_type: 'CREDIT_CARD',
        credit_card: {
          holder_name: upgradeCardHolder.trim().toUpperCase(),
          number: cleanNumber,
          expiry_month: monthStr,
          expiry_year: yearStr,
          ccv: cleanCcv,
          postal_code: cleanCep,
          address_number: upgradeAddressNumber.trim(),
          cpf_cnpj: cleanCpfCnpj,
        },
      });

      if (res.paid) {
        setUpgradeModalOpen(false);
        setUpgradeStep('config');
        const planName = selectedUpgradePlan?.name || '';
        setFeedback({
          title: 'Upgrade Ativado com Sucesso!',
          message: res.message ? (
            <span dangerouslySetInnerHTML={{ __html: res.message }} />
          ) : (
            <span>
              Upgrade para o <strong>Plano {planName}</strong> ativado com sucesso! {isCurrentPlanFree ? 'A assinatura mensal' : 'O pagamento proporcional'} de R$ {(isCurrentPlanFree ? upgradeNewTotal : upgradeProratedDue).toFixed(2).replace('.', ',')} foi aprovado no cartão.
            </span>
          ),
          color: 'teal',
          icon: 'check',
        });
        await loadData();
      } else if (res.require_checkout) {
        setUpgradeModalOpen(false);
        const planToCheckout = data?.available_plans.find((p) => p.id === targetUpgradePlanId) || currentPlan || null;
        setCheckoutPlan(planToCheckout);
        setCheckoutExtraWebsites(pd?.extra_websites || 0);
        setCheckoutExtraAiPacks(Math.round((pd?.extra_ai_tokens || 0) / (aiPackTokens || 250000)));
        setRenewModalOpen(true);
      } else {
        setUpgradePaymentError(res.message || 'Pagamento pendente ou recusado pela operadora.');
      }
    } catch (err: any) {
      console.error(err);
      setUpgradePaymentError(
        extractErrorMessage(err, 'Falha ao processar pagamento do cartão. Verifique os dados ou limite disponível.')
      );
    } finally {
      setUpgradingPlan(false);
    }
  };

  // Verificar pagamento Pix de Upgrade
  const handleCheckUpgradePixPayment = async () => {
    if (!upgradePixData?.payment_id || !targetUpgradePlanId) return;
    try {
      setUpgradePixLoading(true);
      setUpgradePaymentError(null);
      const res = await confirmProratedPix({
        payment_id: upgradePixData.payment_id,
        plan_id: targetUpgradePlanId,
        extra_websites: pd?.extra_websites || 0,
        extra_ai_tokens: pd?.extra_ai_tokens || 0,
        user_id: initialUser.id,
      });

      if (res.paid) {
        setUpgradeModalOpen(false);
        setUpgradeStep('config');
        const planName = selectedUpgradePlan?.name || '';
        setFeedback({
          title: 'Pagamento PIX Confirmado!',
          message: res.message ? (
            <span dangerouslySetInnerHTML={{ __html: res.message }} />
          ) : (
            <span>
              Upgrade para o <strong>Plano {planName}</strong> confirmado com sucesso! Seus novos limites já estão ativos.
            </span>
          ),
          color: 'teal',
          icon: 'check',
        });
        await loadData();
      } else {
        setUpgradePaymentError(res.message || 'Pagamento ainda não confirmado pelo Asaas. Aguarde alguns instantes após o pagamento no seu banco.');
      }
    } catch (err: any) {
      console.error(err);
      setUpgradePaymentError(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao verificar pagamento PIX.'
      );
    } finally {
      setUpgradePixLoading(false);
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
                      Gestão do Plano: <span style={{ color: '#1A7F86' }}>{initialUser.name}</span>
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
          {typeof feedback.message === 'string' ? (
            <span
              dangerouslySetInnerHTML={{
                __html: feedback.message.includes('<strong>') || feedback.message.includes('<b>')
                  ? feedback.message
                  : feedback.message.replace(/(Plano\s+[A-Za-z0-9\u00C0-\u00FF_-]+)/gi, '<strong>$1</strong>'),
              }}
            />
          ) : (
            feedback.message
          )}
        </Alert>
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

      {/* Alerta de ferramentas bloqueadas no plano Free */}
      {Number(pd?.tools_enabled) === 0 && (
        <Alert
          icon={<IconLock size={18} />}
          color="orange"
          variant="light"
          title="Plano Free: Ferramentas de Correção Bloqueadas"
          styles={{
            root: { borderColor: 'rgba(237, 174, 73, 0.4)' },
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Text size="xs" maw={700}>
              Você está no plano gratuito. As auditorias e diagnósticos funcionam normalmente, mas as ferramentas ativas de correção (plugin de fixes com IA, atualizações remotas pela plataforma e restauração de arquivos) estão restritas aos planos pagos.
            </Text>
            <Button
              size="xs"
              variant="gradient"
              gradient={{ from: '#1A7F86', to: '#118ab2' }}
              onClick={() => {
                const paidPlan = data?.available_plans.find((p) => p.slug !== 'free' && Number(p.price_monthly) > 0);
                if (paidPlan) {
                  setTargetUpgradePlanId(paidPlan.id);
                  setCheckoutPlan(paidPlan);
                  setRenewModalOpen(true);
                }
              }}
            >
              Liberar Ferramentas com Plano Pago 🚀
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
            {/* Top row do Card: Valor à esquerda, Próximo Pagamento & Dia de Renovação à direita */}
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
              <div>
                <Text fw={800} size="24px" c="teal.4" style={{ lineHeight: 1.1 }}>
                  {formatMoney(pd?.total_monthly_price)}
                  <Text component="span" size="xs" c="dimmed" fw={400} ml={4}>
                    /mês
                  </Text>
                </Text>
                <Text size="11px" c="dimmed" mt={4}>
                  Iniciado em <Text component="span" fw={600} c="gray.3">{planStartDateFmt}</Text>
                </Text>
              </div>

              <Paper
                p="6px 10px"
                radius="sm"
                bg="dark.7"
                withBorder
                style={{ borderColor: '#374151' }}
              >
                <Group gap={6} align="center">
                  <ThemeIcon color={sub?.status === 'canceled' ? 'yellow' : 'teal'} size="xs" radius="xl" variant="light">
                    <IconCalendarEvent size={12} />
                  </ThemeIcon>
                  <div>
                    <Text size="9px" c="dimmed" fw={700} tt="uppercase">
                      {sub?.status === 'canceled' ? 'Vigência Até' : 'Próximo Pagamento'}
                    </Text>
                    <Text size="xs" fw={700} c={sub?.status === 'canceled' ? 'yellow.3' : 'teal.2'}>
                      {nextPaymentDateFmt}
                    </Text>
                  </div>
                </Group>
              </Paper>
            </Group>


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
                color="sitehub"
                variant="light"
                leftSection={<IconCrown size={14} />}
                onClick={handleOpenUpgradeModal}
              >
                Upgrade de Plano
              </Button>
              <Button
                size="xs"
                color="secondary"
                variant="light"
                leftSection={<IconSparkles size={14} />}
                onClick={handleOpenAddonsModal}
              >
                Add-ons
              </Button>
            </Group>

            <Group justify="space-between" mt="xs" align="center">
              {sub?.status === 'active' && !isCurrentPlanFree ? (
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  leftSection={<IconX size={14} />}
                  onClick={() => setCancelModalOpen(true)}
                >
                  Cancelar Assinatura
                </Button>
              ) : (
                <div />
              )}

              {initialUser.role !== 'admin' && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => {
                    setDeletePassword('');
                    setDeleteAccountError(null);
                    setDeleteAccountModalOpen(true);
                  }}
                >
                  Excluir Conta
                </Button>
              )}
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
              onClick={handleOpenAddonsModal}
            >
              {pd?.extra_websites ? 'Gerenciar Sites Extras' : `Adicionar Sites Extras (+R$ ${(addonPricing.extra_website_price || 8).toFixed(2).replace('.', ',')}/site)`}
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
              onClick={handleOpenAddonsModal}
            >
              {pd?.extra_ai_tokens ? 'Gerenciar Cota de IA' : `Adicionar Pacote de IA (+${(aiPackTokens / 1000).toLocaleString('pt-BR')}k)`}
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
              onClick={handleOpenUpgradeModal}
            >
              Fazer Upgrade de Plano
            </Button>
            <Button
              size="sm"
              color="teal"
              variant="light"
              leftSection={<IconSparkles size={16} />}
              onClick={handleOpenAddonsModal}
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

            {/* Add-on Websites: Quantidade com Cálculo Automático */}
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Card bg="dark.7" p="sm" radius="sm" withBorder style={{ borderColor: '#374151' }}>
                <Group justify="space-between" mb={6}>
                  <Text size="xs" fw={700} c="cyan.4">
                    ADD-ON: WEBSITES EXTRAS
                  </Text>
                  <Badge color="cyan" variant="light" size="xs">
                    R$ {(addonPricing.extra_website_price || 8).toFixed(2).replace('.', ',')}/site
                  </Badge>
                </Group>
                <NumberInput
                  label="Quantidade de Sites Extras (+)"
                  min={0}
                  max={200}
                  step={1}
                  value={extraWebsites}
                  onChange={(val) => setExtraWebsites(Number(val) || 0)}
                />
                <Paper p="xs" mt="xs" bg="dark.8" radius="xs" withBorder style={{ borderColor: '#1e293b' }}>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Valor Mensal Adicional:</Text>
                    <Text size="xs" fw={700} c="cyan.3">
                      +R$ {calculatedExtraWebsitesPrice.toFixed(2).replace('.', ',')}/mês
                    </Text>
                  </Group>
                </Paper>
              </Card>
            </Grid.Col>

            {/* Add-on IA: Tokens com Cálculo Automático */}
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Card bg="dark.7" p="sm" radius="sm" withBorder style={{ borderColor: '#374151' }}>
                <Group justify="space-between" mb={6}>
                  <Text size="xs" fw={700} c="violet.4">
                    ADD-ON: COTA EXTRA DE IA
                  </Text>
                  <Badge color="violet" variant="light" size="xs">
                    R$ {(addonPricing.ai_pack_price || 60).toFixed(2).replace('.', ',')} / {(aiPackTokens / 1000).toLocaleString('pt-BR')}k tokens
                  </Badge>
                </Group>
                <NumberInput
                  label="Tokens Extras (+)"
                  min={0}
                  max={10000000}
                  step={aiPackTokens}
                  thousandSeparator="."
                  decimalSeparator=","
                  value={extraAiTokens}
                  onChange={(val) => setExtraAiTokens(Number(val) || 0)}
                />
                <Paper p="xs" mt="xs" bg="dark.8" radius="xs" withBorder style={{ borderColor: '#1e293b' }}>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Valor Mensal Adicional:</Text>
                    <Text size="xs" fw={700} c="violet.3">
                      +R$ {calculatedExtraAiTokensPrice.toFixed(2).replace('.', ',')}/mês
                    </Text>
                  </Group>
                </Paper>
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
              onClick={() => setExtraAiTokens(aiPackTokens)}
            >
              +{(aiPackTokens / 1000).toLocaleString('pt-BR')}k
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => setExtraAiTokens(aiPackTokens * 2)}
            >
              +{((aiPackTokens * 2) / 1000).toLocaleString('pt-BR')}k
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => setExtraAiTokens(aiPackTokens * 4)}
            >
              +{((aiPackTokens * 4) / 1000).toLocaleString('pt-BR')}k
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="red"
              onClick={() => setExtraAiTokens(0)}
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
                    {isCurrentPlanFree
                      ? 'Plano Grátis / Teste'
                      : `Assinatura Recorrente ${sub.payment_method === 'credit_card' ? '(Cartão de Crédito)' : sub.payment_method === 'pix' ? '(Pix)' : ''}`}
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
                    isCurrentPlanFree ? (
                      <>
                        Plano de teste gratuito iniciado em <b>{planStartDateFmt}</b>. Permite diagnósticos de segurança com limites de teste.
                      </>
                    ) : (
                      <>
                        Plano iniciado em <b>{planStartDateFmt}</b> (dia {renewalDayNumber}) • Próxima renovação em <b>{nextPaymentDateFmt}</b> (renovação mensal todo dia <b>{renewalDayNumber}</b> • {Math.min(30, sub.days_remaining || daysRemainingInCycle)} dias restantes no ciclo).
                      </>
                    )
                  ) : sub.status === 'canceled' && sub.is_period_active ? (
                    <>
                      Cancelada em {sub.canceled_at ? formatDateOnly(sub.canceled_at) : '—'}. Seu acesso permanece 100% liberado até <b>{nextPaymentDateFmt}</b> ({Math.min(30, sub.days_remaining || daysRemainingInCycle)} dias restantes). Nenhuma nova cobrança será realizada. Após essa data, sua conta entrará em carência de 90 dias para exclusão definitiva caso não seja reativada.
                    </>
                  ) : (
                    <>
                      O período pago encerrou em {sub.current_period_end ? formatDateOnly(sub.current_period_end) : '—'}. Sua conta está em carência de 90 dias para exclusão definitiva. Contrate ou reative um plano para restaurar todos os seus recursos e sites.
                    </>
                  )}
                </Text>
              </div>
            </Group>

            <Group gap="xs">
              {sub.status === 'active' && !isCurrentPlanFree && (
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
              {sub.status === 'active' && isCurrentPlanFree && (
                <Button
                  variant="gradient"
                  gradient={{ from: '#1A7F86', to: '#118ab2' }}
                  size="xs"
                  leftSection={<IconCrown size={14} />}
                  onClick={() => {
                    const paidPlan = data?.available_plans.find((p) => p.slug !== 'free' && Number(p.price_monthly) > 0);
                    if (paidPlan) {
                      setTargetUpgradePlanId(paidPlan.id);
                      setCheckoutPlan(paidPlan);
                      setRenewModalOpen(true);
                    }
                  }}
                >
                  Mudar para Plano Pago 🚀
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

              {initialUser.role !== 'admin' && (
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => {
                    setDeletePassword('');
                    setDeleteAccountError(null);
                    setDeleteAccountModalOpen(true);
                  }}
                >
                  Excluir Minha Conta
                </Button>
              )}
            </Group>
          </Group>
        </Paper>
      )}

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
          <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />} title="Importante sobre o cancelamento da assinatura:">
            <Text size="xs">
              Ao confirmar o cancelamento da renovação:
            </Text>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
              <li>
                <b>Sem novas cobranças:</b> Nenhuma fatura adicional de renovação será gerada no Asaas.
              </li>
              <li>
                <b>Acesso garantido até o fim do ciclo:</b> Você continua com <b>ACESSO TOTAL</b> a todos os recursos do seu plano até o término do período já pago (
                <b>{sub?.current_period_end ? formatDateOnly(sub.current_period_end) : 'fim do ciclo atual'}</b>, restando {sub?.days_remaining || 0} dias).
              </li>
              <li>
                <b style={{ color: '#f59f00' }}>Carência de 90 dias após o período pago:</b> Assim que os dias pagos terminarem, sua conta entrará automaticamente em <b>período de carência de 90 dias para exclusão definitiva</b> (o mesmo ciclo aplicado ao solicitar exclusão de conta). Seus sites serão desconectados.
              </li>
              <li>
                <b>Prazo para reativação:</b> Durante esses 90 dias de carência, você poderá reativar sua conta e recuperar todos os seus sites a qualquer momento contratando um plano. Se a conta não for reativada dentro dos 90 dias, todos os sites, históricos e dados operacionais serão <b>permanentemente excluídos da plataforma</b>.
              </li>
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

      {/* Modal de Exclusão de Conta com Carência de 90 Dias */}
      <Modal
        opened={deleteAccountModalOpen}
        onClose={() => !deletingAccount && setDeleteAccountModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="red" variant="light" size="sm" radius="md">
              <IconTrash size={16} />
            </ThemeIcon>
            <Text fw={700} size="md" c="red.4">
              Excluir Minha Conta (Carência de 90 Dias)
            </Text>
          </Group>
        }
        centered
        radius="md"
        size="lg"
        styles={{ content: { backgroundColor: '#1f2937' }, header: { backgroundColor: '#1f2937' } }}
      >
        <Stack gap="md">
          {deleteAccountError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="Erro na Solicitação">
              {deleteAccountError}
            </Alert>
          )}

          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={20} />} title="Atenção: Como funciona a exclusão da sua conta">
            <Text size="xs" fw={500}>
              Para sua segurança, a exclusão da conta segue uma política com <b>período de carência de 90 dias</b>:
            </Text>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
              <li>
                <b>Cobranças suspensas imediatamente:</b> Nenhuma nova fatura recorrente será cobrada no seu cartão ou PIX.
              </li>
              <li>
                <b>Sites desconectados:</b> Seus sites cadastrados serão imediatamente desconectados da plataforma para pausar requisições.
              </li>
              <li>
                <b>90 dias para mudar de ideia:</b> Seus sites, notas e históricos permanecerão salvos por 90 dias. Durante esse período, basta fazer login com sua senha para <b>reativar sua conta</b> instantaneamente.
              </li>
              <li>
                <b>Exclusão definitiva após 90 dias:</b> Encerrado o prazo de 90 dias, os dados dos seus sites (varreduras, relatórios e notas) serão <b>permanentemente apagados</b>.
              </li>
            </ul>
          </Alert>

          <Paper withBorder p="md" radius="md" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <Text size="sm" fw={600} c="red.3" mb={6}>
              Confirmação Obrigatória por Senha
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              Para prosseguir com a exclusão agendada, digite a sua <b>senha atual</b> de acesso à plataforma:
            </Text>
            <PasswordInput
              label="Sua Senha Atual"
              placeholder="Digite sua senha para confirmar"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.currentTarget.value)}
              required
              error={!deletePassword && deleteAccountError ? 'Senha é obrigatória' : undefined}
            />
          </Paper>

          <Group justify="flex-end" mt="sm">
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => setDeleteAccountModalOpen(false)}
              disabled={deletingAccount}
            >
              Manter Minha Conta
            </Button>
            <Button
              color="red"
              size="sm"
              onClick={handleConfirmAccountDeletion}
              loading={deletingAccount}
              disabled={!deletePassword.trim()}
              leftSection={<IconTrash size={14} />}
            >
              Confirmar Exclusão da Conta
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
              {upgradeStep === 'config' ? 'Fazer Upgrade de Plano' : 'Quadro de Pagamento — Ativação de Upgrade'}
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
        {upgradeStep === 'config' ? (
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
                          {Number(p.tools_enabled) === 1 ? (
                            <Badge color="teal" size="xs" variant="light">
                              Ferramentas Ativas
                            </Badge>
                          ) : (
                            <Badge color="orange" size="xs" variant="light">
                              Apenas Diagnóstico
                            </Badge>
                          )}
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
            {selectedUpgradePlan &&
              selectedUpgradePlan.max_websites !== null &&
              selectedUpgradePlan.max_websites + (pd?.extra_websites || 0) < (pd?.websites_count || 0) && (
                <Alert color="red" variant="filled" icon={<IconAlertCircle size={16} />}>
                  <Text size="xs">
                    Você possui <b>{pd?.websites_count} sites cadastrados</b>. O Plano {selectedUpgradePlan.name} com seus add-ons comportará apenas <b>{selectedUpgradePlan.max_websites + (pd?.extra_websites || 0)} sites</b>. Exclua pelo menos <b>{(pd?.websites_count || 0) - (selectedUpgradePlan.max_websites + (pd?.extra_websites || 0))} site(s)</b> antes de selecionar este plano.
                  </Text>
                </Alert>
            )}

            {/* Transparência de Pró-rata e Próxima Fatura */}
            {targetUpgradePlanId && targetUpgradePlanId !== pd?.plan_id && selectedUpgradePlan && (
              isUpgradeDowngrade ? (
                <Alert color="teal" variant="light" icon={<IconInfoCircle size={18} />}>
                  <Text size="xs" fw={700}>Efeito na Próxima Fatura (Nenhuma cobrança hoje):</Text>
                  <Text size="xs" mt={2}>
                    Nenhum valor será cobrado agora. Seu plano atual permanece ativo até <b>{nextCycleDueDateFmt}</b>.
                    A partir dessa data, sua fatura passará para <b>R$ {upgradeNewTotal.toFixed(2).replace('.', ',')}/mês</b> no Plano {selectedUpgradePlan.name} (seus add-ons continuam preservados).
                  </Text>
                </Alert>
              ) : isCurrentPlanFree ? (
                <Alert color="indigo" variant="light" icon={<IconTrendingUp size={18} />}>
                  <Text size="xs" fw={700}>Ativação Imediata da Assinatura Mensal:</Text>
                  <Text size="xs" mt={2}>
                    Ao assinar o <b>Plano {selectedUpgradePlan.name}</b>, seu ciclo mensal de faturamento se inicia hoje.
                    Você paga apenas o valor da mensalidade de <b>R$ {upgradeNewTotal.toFixed(2).replace('.', ',')}</b>.
                    Sua próxima renovação mensal ocorrerá em <b>{nextCycleDueDateFmt}</b> no valor de <b>R$ {upgradeNewTotal.toFixed(2).replace('.', ',')}/mês</b>.
                  </Text>
                </Alert>
              ) : (
                <Alert color="indigo" variant="light" icon={<IconTrendingUp size={18} />}>
                  <Text size="xs" fw={700}>Cobrança Proporcional aos Dias Restantes (Pró-rata):</Text>
                  <Text size="xs" mt={2}>
                    Faltam <b>{daysRemainingInCycle} dias</b> até sua renovação em <b>{nextCycleDueDateFmt}</b>.
                    Você não paga o plano cheio novamente hoje: paga apenas <b>R$ {upgradeProratedDue.toFixed(2).replace('.', ',')}</b> referente aos dias restantes.
                    A partir de <b>{nextCycleDueDateFmt}</b>, sua assinatura mensal regular passará para <b>R$ {upgradeNewTotal.toFixed(2).replace('.', ',')}/mês</b>.
                  </Text>
                </Alert>
              )
            )}

            <Group justify="flex-end" mt="sm">
              <Button variant="subtle" color="gray" size="sm" onClick={() => setUpgradeModalOpen(false)} disabled={upgradingPlan}>
                Cancelar
              </Button>
              <Button
                color="indigo"
                variant="gradient"
                gradient={{ from: 'indigo.6', to: 'violet.6' }}
                size="sm"
                onClick={isUpgradeDowngrade ? handleConfirmUpgradeDowngrade : handleProceedToUpgradePayment}
                loading={upgradingPlan}
                disabled={
                  !targetUpgradePlanId ||
                  targetUpgradePlanId === pd?.plan_id ||
                  Boolean(
                    selectedUpgradePlan &&
                    selectedUpgradePlan.max_websites !== null &&
                    selectedUpgradePlan.max_websites + (pd?.extra_websites || 0) < (pd?.websites_count || 0)
                  )
                }
                leftSection={isUpgradeDowngrade ? <IconDeviceFloppy size={16} /> : <IconCreditCard size={16} />}
              >
                {isUpgradeDowngrade
                  ? 'Confirmar Alteração para o Próximo Mês'
                  : isCurrentPlanFree
                  ? `Prosseguir para Pagamento (R$ ${upgradeNewTotal.toFixed(2).replace('.', ',')}/mês) →`
                  : `Prosseguir para Pagamento (R$ ${upgradeProratedDue.toFixed(2).replace('.', ',')} Pró-rata) →`}
              </Button>
            </Group>
          </Stack>
        ) : (
          /* STEP 2: QUADRO DE PAGAMENTO DO UPGRADE */
          <Stack gap="md">
            {/* Box Resumo do Valor Proporcional */}
            <Paper p="md" radius="md" bg="rgba(30, 41, 59, 0.6)" style={{ border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <Group justify="space-between" align="center" wrap="nowrap">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Resumo da Operação</Text>
                  <Text size="sm" fw={700} c="white">
                    Upgrade para Plano {selectedUpgradePlan?.name}
                  </Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    {isCurrentPlanFree ? (
                      <>
                        Ciclo mensal iniciado hoje • Próxima renovação em <b>{nextCycleDueDateFmt}</b> (30 dias)
                      </>
                    ) : (
                      <>
                        Período proporcional: <b>{daysRemainingInCycle} dias restantes</b> até renovação em <b>{nextCycleDueDateFmt}</b>
                      </>
                    )}
                  </Text>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', minWidth: '180px' }}>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {isCurrentPlanFree ? 'Valor a Pagar Hoje:' : 'Valor a Pagar Hoje (Pró-rata):'}
                  </Text>
                  <Text fw={800} size="22px" c="indigo.3" style={{ lineHeight: 1.2 }}>
                    R$ {(isCurrentPlanFree ? upgradeNewTotal : upgradeProratedDue).toFixed(2).replace('.', ',')}
                  </Text>
                  <Text size="11px" c="dimmed" style={{ whiteSpace: 'nowrap', marginTop: 2 }}>
                    Próxima mensalidade: R$ {upgradeNewTotal.toFixed(2).replace('.', ',')}/mês
                  </Text>
                </div>
              </Group>
            </Paper>

            {/* Seletor de Método de Pagamento */}
            {allowCreditCard && allowPix && (
              <div>
                <Text size="xs" fw={700} c="dimmed" mb={6} tt="uppercase">
                  Escolha a Forma de Pagamento
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                  <Paper
                    p="sm"
                    radius="md"
                    onClick={() => setUpgradePaymentMethod('credit_card')}
                    style={{
                      cursor: 'pointer',
                      background: upgradePaymentMethod === 'credit_card' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                      border: upgradePaymentMethod === 'credit_card' ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Group justify="space-between" mb={4}>
                      <Group gap="xs">
                        <IconCreditCard size={18} color={upgradePaymentMethod === 'credit_card' ? '#818cf8' : '#94a3b8'} />
                        <Text size="sm" fw={700} c={upgradePaymentMethod === 'credit_card' ? 'white' : 'gray.4'}>
                          Cartão de Crédito
                        </Text>
                      </Group>
                      <Badge size="xs" color="indigo" variant="light">Instantâneo</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Aprovação imediata e liberação automática do novo plano.
                    </Text>
                  </Paper>

                  <Paper
                    p="sm"
                    radius="md"
                    onClick={() => {
                      setUpgradePaymentMethod('pix');
                      if (!upgradePixData) {
                        handleGenerateUpgradePix();
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      background: upgradePaymentMethod === 'pix' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                      border: upgradePaymentMethod === 'pix' ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Group justify="space-between" mb={4}>
                      <Group gap="xs">
                        <IconQrcode size={18} color={upgradePaymentMethod === 'pix' ? '#818cf8' : '#94a3b8'} />
                        <Text size="sm" fw={700} c={upgradePaymentMethod === 'pix' ? 'white' : 'gray.4'}>
                          PIX Instantâneo
                        </Text>
                      </Group>
                      <Badge size="xs" color="teal" variant="light">QR Code</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Pagamento via QR Code ou Copia e Cola com confirmação rápida.
                    </Text>
                  </Paper>
                </SimpleGrid>
              </div>
            )}

            {allowCreditCard && !allowPix && (
              <Paper p="sm" radius="md" bg="rgba(99, 102, 241, 0.1)" style={{ border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconCreditCard size={18} color="#818cf8" />
                    <div>
                      <Text size="sm" fw={700} c="white">
                        Pagamento via Cartão de Crédito
                      </Text>
                      <Text size="xs" c="dimmed">
                        Aprovação imediata e liberação automática do novo plano.
                      </Text>
                    </div>
                  </Group>
                  <Badge size="xs" color="indigo" variant="light">Automático</Badge>
                </Group>
              </Paper>
            )}

            {!allowCreditCard && allowPix && (
              <Paper p="sm" radius="md" bg="rgba(20, 184, 166, 0.1)" style={{ border: '1px solid rgba(20, 184, 166, 0.3)' }}>
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconQrcode size={18} color="#2dd4bf" />
                    <div>
                      <Text size="sm" fw={700} c="white">
                        Pagamento via Pix Instantâneo
                      </Text>
                      <Text size="xs" c="dimmed">
                        Pagamento via QR Code ou Copia e Cola com confirmação rápida.
                      </Text>
                    </div>
                  </Group>
                  <Badge size="xs" color="teal" variant="light">QR Code</Badge>
                </Group>
              </Paper>
            )}

            {/* ABA CARTÃO DE CRÉDITO */}
            {upgradePaymentMethod === 'credit_card' && (
              <Card p="sm" radius="md" bg="rgba(15, 23, 42, 0.6)" style={{ border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                <Stack gap="xs">
                  <Text size="xs" fw={700} c="indigo.3" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Dados do Cartão para Pagamento
                  </Text>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <TextInput
                      label="Nome Impresso no Cartão"
                      placeholder="Ex: CARLOS E SILVA"
                      value={upgradeCardHolder}
                      onChange={(e) => setUpgradeCardHolder(e.target.value.toUpperCase())}
                      required
                      size="xs"
                    />
                    <TextInput
                      label="CPF ou CNPJ do Titular"
                      placeholder="000.000.000-00"
                      value={upgradeCpfCnpj}
                      onChange={(e) => handleCpfCnpjFormat(e.target.value, setUpgradeCpfCnpj)}
                      maxLength={18}
                      required
                      size="xs"
                    />
                  </SimpleGrid>

                  <TextInput
                    label="Número do Cartão"
                    placeholder="0000 0000 0000 0000"
                    value={upgradeCardNumber}
                    onChange={(e) => handleCardNumberFormat(e.target.value, setUpgradeCardNumber)}
                    leftSection={<IconCreditCard size={16} />}
                    required
                    size="xs"
                  />

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <TextInput
                      label="Validade (MM/AA)"
                      placeholder="MM/AA"
                      value={upgradeCardExpiry}
                      onChange={(e) => handleCardExpiryFormat(e.target.value, setUpgradeCardExpiry)}
                      maxLength={5}
                      required
                      size="xs"
                    />
                    <TextInput
                      label="Código de Segurança (CVV)"
                      placeholder="123"
                      value={upgradeCardCcv}
                      onChange={(e) => handleCardCcvFormat(e.target.value, setUpgradeCardCcv)}
                      maxLength={4}
                      leftSection={<IconLock size={16} />}
                      required
                      type="password"
                      size="xs"
                    />
                  </SimpleGrid>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <TextInput
                      label="CEP do Titular"
                      placeholder="00000-000"
                      value={upgradePostalCode}
                      onChange={(e) => handlePostalCodeFormat(e.target.value, setUpgradePostalCode)}
                      maxLength={9}
                      leftSection={<IconMapPin size={16} />}
                      required
                      size="xs"
                    />
                    <TextInput
                      label="Número do Endereço"
                      placeholder="Ex: 100 ou S/N"
                      value={upgradeAddressNumber}
                      onChange={(e) => setUpgradeAddressNumber(e.target.value)}
                      required
                      size="xs"
                    />
                  </SimpleGrid>

                  <Group gap="xs" mt={4}>
                    <IconShieldCheck size={16} color="var(--mantine-color-green-4)" />
                    <Text size="11px" c="dimmed">
                      Pagamento seguro processado pelo gateway bancário Asaas com aprovação imediata.
                    </Text>
                  </Group>
                </Stack>
              </Card>
            )}

            {/* ABA PIX */}
            {upgradePaymentMethod === 'pix' && (
              <Card p="md" radius="md" bg="rgba(15, 23, 42, 0.6)" style={{ border: '1px solid rgba(20, 184, 166, 0.3)' }}>
                {upgradePixLoading && !upgradePixData ? (
                  <Stack align="center" py="lg">
                    <Loader size="md" color="teal" />
                    <Text size="xs" c="dimmed">Gerando cobrança PIX com o gateway Asaas...</Text>
                  </Stack>
                ) : upgradePixData ? (
                  <Stack gap="sm" align="center">
                    {upgradePixData.pix_qr_code && (
                      <Paper p="xs" radius="md" bg="white" style={{ display: 'inline-block' }}>
                        <img
                          src={upgradePixData.pix_qr_code}
                          alt="QR Code PIX Upgrade"
                          style={{ width: 170, height: 170, display: 'block' }}
                        />
                      </Paper>
                    )}

                    {upgradePixData.pix_copy_paste && (
                      <Stack gap={4} style={{ width: '100%' }}>
                        <Text size="xs" c="dimmed" ta="center">
                          Código Copia e Cola:
                        </Text>
                        <TextInput
                          readOnly
                          value={upgradePixData.pix_copy_paste}
                          size="xs"
                          rightSection={
                            <CopyButton value={upgradePixData.pix_copy_paste} timeout={2500}>
                              {({ copied, copy }) => (
                                <Button
                                  size="compact-xs"
                                  variant="subtle"
                                  color={copied ? 'teal' : 'blue'}
                                  onClick={copy}
                                >
                                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                </Button>
                              )}
                            </CopyButton>
                          }
                        />
                      </Stack>
                    )}

                    <Alert color="teal" variant="light" style={{ width: '100%' }}>
                      <Text size="xs" ta="center">
                        Aguardando confirmação bancária. Assim que o pagamento for realizado no seu banco, o upgrade será ativado automaticamente.
                      </Text>
                    </Alert>

                    <Button
                      color="teal"
                      variant="light"
                      size="xs"
                      onClick={handleCheckUpgradePixPayment}
                      loading={upgradePixLoading}
                      leftSection={<IconCheck size={14} />}
                    >
                      Já realizei o pagamento via PIX / Verificar
                    </Button>
                  </Stack>
                ) : (
                  <Stack align="center" py="md">
                    <Button
                      color="teal"
                      size="sm"
                      onClick={handleGenerateUpgradePix}
                      loading={upgradePixLoading}
                      leftSection={<IconQrcode size={16} />}
                    >
                      Gerar QR Code PIX de R$ {upgradeProratedDue.toFixed(2).replace('.', ',')}
                    </Button>
                  </Stack>
                )}
              </Card>
            )}

            {/* Exibição de Erro no Quadro de Pagamento */}
            {upgradePaymentError && (
              <Alert color="red" variant="filled" icon={<IconAlertCircle size={16} />}>
                <Text size="xs">{upgradePaymentError}</Text>
              </Alert>
            )}

            {/* Footer Buttons do Quadro de Pagamento */}
            <Group justify="space-between" mt="sm">
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setUpgradeStep('config')}
                disabled={upgradingPlan || upgradePixLoading}
                leftSection={<IconArrowLeft size={16} />}
              >
                Voltar à Seleção
              </Button>

              {upgradePaymentMethod === 'credit_card' && (
                <Button
                  color="indigo"
                  variant="gradient"
                  gradient={{ from: 'indigo.6', to: 'violet.6' }}
                  size="sm"
                  onClick={handlePayUpgradeWithCard}
                  loading={upgradingPlan}
                  leftSection={<IconCreditCard size={16} />}
                >
                  Pagar R$ {upgradeProratedDue.toFixed(2).replace('.', ',')} no Cartão
                </Button>
              )}

              {upgradePaymentMethod === 'pix' && (
                <Button
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={() => setUpgradeModalOpen(false)}
                >
                  Fechar
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal de Gestão / Contratação de Add-ons */}
      <Modal
        opened={addonsModalOpen}
        onClose={() => setAddonsModalOpen(false)}
        title={
          <Group gap="xs">
            <IconSparkles size={20} color="var(--mantine-color-teal-4)" />
            <Text fw={700} size="md">
              {addonStep === 'config' ? 'Contratar ou Gerenciar Add-ons' : 'Quadro de Pagamento — Ativação de Add-ons'}
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
        {addonStep === 'config' ? (
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
                      Pacotes IA (+{(aiPackTokens / 1000).toLocaleString('pt-BR')}k tokens por R$ {aiPackPrice.toFixed(2).replace('.', ',')}/mês cada)
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" mt={2}>
                    Plano base {pd?.plan_name}: <b>{((pd?.base_ai_tokens || 0) / 1000).toLocaleString('pt-BR')}k tokens</b>
                  </Text>
                </div>
                <Badge color="violet" variant="light">
                  +R$ {(modalExtraAiPacks * aiPackPrice).toFixed(2).replace('.', ',')}/mês
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
                    {(((pd?.base_ai_tokens || 0) + (modalExtraAiPacks * aiPackTokens)) / 1000).toLocaleString('pt-BR')}k tokens/mês
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
                    Plano {pd?.plan_name} (R$ {(pd?.base_price || 0).toFixed(2).replace('.', ',')}) + Sites Extras (R$ {(modalExtraWebsites * (addonPricing.extra_website_price || 8)).toFixed(2).replace('.', ',')}) + IA Extra (R$ {(modalExtraAiPacks * aiPackPrice).toFixed(2).replace('.', ',')})
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
                onClick={isAddonsDowngrade ? handleSaveAddonsReduction : handleProceedToAddonPayment}
                loading={savingAddons}
                disabled={isAddonRemovalBlocked}
                leftSection={isAddonsDowngrade ? <IconDeviceFloppy size={16} /> : <IconCreditCard size={16} />}
              >
                {isAddonsDowngrade
                  ? 'Confirmar Redução para o Próximo Mês'
                  : `Prosseguir para Pagamento (R$ ${addonsProratedDueNow.toFixed(2).replace('.', ',')} Pró-rata) →`}
              </Button>
            </Group>
          </Stack>
        ) : (
          /* STEP 2: QUADRO DE PAGAMENTO DOS ADD-ONS */
          <Stack gap="md">
            {/* Box Resumo do Valor Proporcional */}
            <Paper p="md" radius="md" bg="rgba(30, 41, 59, 0.6)" style={{ border: '1px solid rgba(20, 184, 166, 0.3)' }}>
              <Group justify="space-between" align="center">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Resumo da Operação</Text>
                  <Text size="sm" fw={700} c="white">
                    {modalExtraWebsites > 0 ? `+${modalExtraWebsites} site(s) extra(s)` : ''}
                    {modalExtraWebsites > 0 && modalExtraAiPacks > 0 ? ' • ' : ''}
                    {modalExtraAiPacks > 0 ? `+${modalExtraAiPacks} pacote(s) IA extra(s)` : ''}
                  </Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    Período proporcional: <b>{daysRemainingInCycle} dias restantes</b> até renovação em <b>{nextCycleDueDateFmt}</b>
                  </Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text size="xs" c="dimmed">Valor a Pagar Hoje (Pró-rata):</Text>
                  <Text fw={800} size="xl" c="teal.3">
                    R$ {addonsProratedDueNow.toFixed(2).replace('.', ',')}
                  </Text>
                  <Text size="11px" c="dimmed">
                    Próxima mensalidade: R$ {newAddonsTotalMonthly.toFixed(2).replace('.', ',')}/mês
                  </Text>
                </div>
              </Group>
            </Paper>

            {/* Seletor de Método de Pagamento */}
            {allowCreditCard && allowPix && (
              <div>
                <Text size="xs" fw={700} c="dimmed" mb={6} tt="uppercase">
                  Escolha a Forma de Pagamento
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                  <Paper
                    p="sm"
                    radius="md"
                    onClick={() => setAddonPaymentMethod('credit_card')}
                    style={{
                      cursor: 'pointer',
                      background: addonPaymentMethod === 'credit_card' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                      border: addonPaymentMethod === 'credit_card' ? '2px solid #14b8a6' : '1px solid rgba(255, 255, 255, 0.08)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Group justify="space-between" mb={4}>
                      <Group gap="xs">
                        <IconCreditCard size={18} color={addonPaymentMethod === 'credit_card' ? '#2dd4bf' : '#94a3b8'} />
                        <Text size="sm" fw={700} c={addonPaymentMethod === 'credit_card' ? 'white' : 'gray.4'}>
                          Cartão de Crédito
                        </Text>
                      </Group>
                      <Badge size="xs" color="teal" variant="light">Instantâneo</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Aprovação imediata e liberação automática dos add-ons contratados.
                    </Text>
                  </Paper>

                  <Paper
                    p="sm"
                    radius="md"
                    onClick={() => {
                      setAddonPaymentMethod('pix');
                      if (!addonPixData) {
                        handleGenerateAddonPix();
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      background: addonPaymentMethod === 'pix' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                      border: addonPaymentMethod === 'pix' ? '2px solid #14b8a6' : '1px solid rgba(255, 255, 255, 0.08)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Group justify="space-between" mb={4}>
                      <Group gap="xs">
                        <IconQrcode size={18} color={addonPaymentMethod === 'pix' ? '#2dd4bf' : '#94a3b8'} />
                        <Text size="sm" fw={700} c={addonPaymentMethod === 'pix' ? 'white' : 'gray.4'}>
                          PIX Instantâneo
                        </Text>
                      </Group>
                      <Badge size="xs" color="cyan" variant="light">QR Code</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Pagamento via QR Code ou Copia e Cola com confirmação rápida.
                    </Text>
                  </Paper>
                </SimpleGrid>
              </div>
            )}

            {allowCreditCard && !allowPix && (
              <Paper p="sm" radius="md" bg="rgba(20, 184, 166, 0.08)" style={{ border: '1px solid rgba(20, 184, 166, 0.25)' }}>
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconCreditCard size={18} color="#2dd4bf" />
                    <div>
                      <Text size="sm" fw={700} c="white">
                        Pagamento via Cartão de Crédito
                      </Text>
                      <Text size="xs" c="dimmed">
                        Aprovação imediata e liberação automática dos add-ons contratados.
                      </Text>
                    </div>
                  </Group>
                  <Badge size="xs" color="teal" variant="light">Automático</Badge>
                </Group>
              </Paper>
            )}

            {!allowCreditCard && allowPix && (
              <Paper p="sm" radius="md" bg="rgba(20, 184, 166, 0.08)" style={{ border: '1px solid rgba(20, 184, 166, 0.25)' }}>
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconQrcode size={18} color="#2dd4bf" />
                    <div>
                      <Text size="sm" fw={700} c="white">
                        Pagamento via Pix Instantâneo
                      </Text>
                      <Text size="xs" c="dimmed">
                        Pagamento via QR Code ou Copia e Cola com confirmação rápida.
                      </Text>
                    </div>
                  </Group>
                  <Badge size="xs" color="cyan" variant="light">QR Code</Badge>
                </Group>
              </Paper>
            )}

            {/* ABA CARTÃO DE CRÉDITO */}
            {addonPaymentMethod === 'credit_card' && (
              <Card p="sm" radius="md" bg="rgba(15, 23, 42, 0.6)" style={{ border: '1px solid rgba(20, 184, 166, 0.25)' }}>
                <Stack gap="xs">
                  <Text size="xs" fw={700} c="teal.3" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Dados do Cartão para Pagamento
                  </Text>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <TextInput
                      label="Nome Impresso no Cartão"
                      placeholder="Ex: CARLOS E SILVA"
                      value={addonCardHolder}
                      onChange={(e) => setAddonCardHolder(e.target.value.toUpperCase())}
                      required
                      size="xs"
                    />
                    <TextInput
                      label="CPF ou CNPJ do Titular"
                      placeholder="000.000.000-00"
                      value={addonCpfCnpj}
                      onChange={(e) => handleCpfCnpjFormat(e.target.value, setAddonCpfCnpj)}
                      maxLength={18}
                      required
                      size="xs"
                    />
                  </SimpleGrid>

                  <TextInput
                    label="Número do Cartão"
                    placeholder="0000 0000 0000 0000"
                    value={addonCardNumber}
                    onChange={(e) => handleCardNumberFormat(e.target.value, setAddonCardNumber)}
                    leftSection={<IconCreditCard size={16} />}
                    required
                    size="xs"
                  />

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <TextInput
                      label="Validade (MM/AA)"
                      placeholder="MM/AA"
                      value={addonCardExpiry}
                      onChange={(e) => handleCardExpiryFormat(e.target.value, setAddonCardExpiry)}
                      maxLength={5}
                      required
                      size="xs"
                    />
                    <TextInput
                      label="Código de Segurança (CVV)"
                      placeholder="123"
                      value={addonCardCcv}
                      onChange={(e) => handleCardCcvFormat(e.target.value, setAddonCardCcv)}
                      maxLength={4}
                      leftSection={<IconLock size={16} />}
                      required
                      type="password"
                      size="xs"
                    />
                  </SimpleGrid>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <TextInput
                      label="CEP do Titular"
                      placeholder="00000-000"
                      value={addonPostalCode}
                      onChange={(e) => handlePostalCodeFormat(e.target.value, setAddonPostalCode)}
                      maxLength={9}
                      leftSection={<IconMapPin size={16} />}
                      required
                      size="xs"
                    />
                    <TextInput
                      label="Número do Endereço"
                      placeholder="Ex: 100 ou S/N"
                      value={addonAddressNumber}
                      onChange={(e) => setAddonAddressNumber(e.target.value)}
                      required
                      size="xs"
                    />
                  </SimpleGrid>

                  <Group gap="xs" mt={4}>
                    <IconShieldCheck size={16} color="var(--mantine-color-green-4)" />
                    <Text size="11px" c="dimmed">
                      Pagamento seguro processado pelo gateway bancário Asaas com aprovação imediata.
                    </Text>
                  </Group>
                </Stack>
              </Card>
            )}

            {/* ABA PIX */}
            {addonPaymentMethod === 'pix' && (
              <Card p="md" radius="md" bg="rgba(15, 23, 42, 0.6)" style={{ border: '1px solid rgba(20, 184, 166, 0.3)' }}>
                {addonPixLoading && !addonPixData ? (
                  <Stack align="center" py="lg">
                    <Loader size="md" color="teal" />
                    <Text size="xs" c="dimmed">Gerando cobrança PIX com o gateway Asaas...</Text>
                  </Stack>
                ) : addonPixData ? (
                  <Stack gap="sm" align="center">
                    {addonPixData.pix_qr_code && (
                      <Paper p="xs" radius="md" bg="white" style={{ display: 'inline-block' }}>
                        <img
                          src={addonPixData.pix_qr_code}
                          alt="QR Code PIX Add-ons"
                          style={{ width: 170, height: 170, display: 'block' }}
                        />
                      </Paper>
                    )}

                    {addonPixData.pix_copy_paste && (
                      <Stack gap={4} style={{ width: '100%' }}>
                        <Text size="xs" c="dimmed" ta="center">
                          Código Copia e Cola:
                        </Text>
                        <TextInput
                          readOnly
                          value={addonPixData.pix_copy_paste}
                          size="xs"
                          rightSection={
                            <CopyButton value={addonPixData.pix_copy_paste} timeout={2500}>
                              {({ copied, copy }) => (
                                <Button
                                  size="compact-xs"
                                  variant="subtle"
                                  color={copied ? 'teal' : 'blue'}
                                  onClick={copy}
                                >
                                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                </Button>
                              )}
                            </CopyButton>
                          }
                        />
                      </Stack>
                    )}

                    <Alert color="teal" variant="light" style={{ width: '100%' }}>
                      <Text size="xs" ta="center">
                        Aguardando confirmação bancária. Assim que o pagamento for realizado no seu banco, os add-ons serão ativados automaticamente.
                      </Text>
                    </Alert>

                    <Button
                      color="teal"
                      variant="light"
                      size="xs"
                      onClick={handleCheckAddonPixPayment}
                      loading={addonPixLoading}
                      leftSection={<IconCheck size={14} />}
                    >
                      Já realizei o pagamento via PIX / Verificar
                    </Button>
                  </Stack>
                ) : (
                  <Stack align="center" py="md">
                    <Button
                      color="teal"
                      size="sm"
                      onClick={handleGenerateAddonPix}
                      loading={addonPixLoading}
                      leftSection={<IconQrcode size={16} />}
                    >
                      Gerar QR Code PIX de R$ {addonsProratedDueNow.toFixed(2).replace('.', ',')}
                    </Button>
                  </Stack>
                )}
              </Card>
            )}

            {/* Exibição de Erro no Quadro de Pagamento */}
            {addonPaymentError && (
              <Alert color="red" variant="filled" icon={<IconAlertCircle size={16} />}>
                <Text size="xs">{addonPaymentError}</Text>
              </Alert>
            )}

            {/* Footer Buttons do Quadro de Pagamento */}
            <Group justify="space-between" mt="sm">
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setAddonStep('config')}
                disabled={savingAddons || addonPixLoading}
                leftSection={<IconArrowLeft size={16} />}
              >
                Voltar à Configuração
              </Button>

              {addonPaymentMethod === 'credit_card' && (
                <Button
                  color="teal"
                  variant="gradient"
                  gradient={{ from: 'teal.6', to: 'green.6' }}
                  size="sm"
                  onClick={handlePayAddonsWithCard}
                  loading={savingAddons}
                  leftSection={<IconCreditCard size={16} />}
                >
                  Pagar R$ {addonsProratedDueNow.toFixed(2).replace('.', ',')} no Cartão
                </Button>
              )}

              {addonPaymentMethod === 'pix' && (
                <Button
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={() => setAddonsModalOpen(false)}
                >
                  Fechar
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </Modal>



      {/* Modal de Renovação / Contratação de Plano */}
      {renewModalOpen && (
        <CheckoutModal
          opened={renewModalOpen}
          onClose={() => setRenewModalOpen(false)}
          selectedPlan={checkoutPlan || currentPlan || (data?.available_plans?.[0] ?? null)}
          currentUser={initialUser}
          existingSubscription={sub}
          initialExtraWebsites={checkoutExtraWebsites}
          initialExtraAiPacks={checkoutExtraAiPacks}
          paymentMethods={data?.payment_methods}
          addonPricing={addonPricing}
          onPaymentSuccess={() => {
            setRenewModalOpen(false);
            loadData();
          }}
        />
      )}
    </Stack>
  );
}
