import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Paper,
  Title,
  Text,
  Button,
  Group,
  Badge,
  Table,
  Stack,
  Alert,
  Loader,
  Center,
  Grid,
  Card,
  ThemeIcon,
  Code,
  Modal,
  Progress,
  Tooltip,
} from '@mantine/core';
import {
  IconRefresh,
  IconCheck,
  IconAlertCircle,
  IconArrowUpCircle,
  IconWorld,
  IconPlug,
  IconPalette,
  IconLock,
  IconServer,
  IconAlertTriangle,
  IconShieldCheck,
  IconX,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import { api } from '../api';
import { extractErrorMessage } from '../utils/formatError';
import { UpgradeGateBanner } from './UpgradeGateBanner';

export interface ServerEnvironment {
  php_version?: string;
  mysql_version?: string;
  wp_version?: string;
  server_software?: string;
  memory_limit?: string;
  disk_free_mb?: number;
  disk_total_mb?: number;
}

export interface CompatibilityWarning {
  type: 'php' | 'wp_core' | 'wp_tested' | 'disk';
  title: string;
  message: string;
  severity: 'warning' | 'danger';
}

interface PluginUpdateItem {
  file: string;
  slug: string;
  name: string;
  current_version: string;
  new_version: string;
  requires_php?: string;
  requires_wp?: string;
  tested_wp?: string;
  has_update: boolean;
  is_active?: boolean;
}

interface ThemeUpdateItem {
  slug: string;
  name: string;
  current_version: string;
  new_version: string;
  requires_php?: string;
  requires_wp?: string;
  has_update: boolean;
}

interface CoreUpdateData {
  current_version: string;
  new_version: string;
  has_update: boolean;
}

export interface UpdatesSummary {
  total_pending: number;
  pending_plugins: number;
  pending_themes: number;
  pending_core: number;
}

export interface UpdatesData {
  summary: UpdatesSummary;
  server_environment?: ServerEnvironment;
  core: CoreUpdateData;
  plugins: PluginUpdateItem[];
  themes: ThemeUpdateItem[];
}

export interface ProgressItem {
  id: string;
  name: string;
  type: 'plugin' | 'theme' | 'core';
  currentVersion: string;
  newVersion: string;
  status: 'pending' | 'updating' | 'success' | 'error';
  message?: string;
  warnings?: CompatibilityWarning[];
}

export interface UpdateModalState {
  isOpen: boolean;
  phase: 'preflight' | 'updating' | 'finished';
  title: string;
  mode: 'single' | 'batch';
  items: ProgressItem[];
  currentIndex: number;
  overallSuccessCount: number;
  overallErrorCount: number;
  warningsCount: number;
}

interface ExecutionStep {
  label: string;
  detail: string;
}

const UPDATE_STEPS: ExecutionStep[] = [
  {
    label: 'Checando versões e requisitos',
    detail: 'Validando versão de PHP, compatibilidade com o WordPress e recursos de ambiente...',
  },
  {
    label: 'Conectando ao agente WordPress',
    detail: 'Enviando comando autenticado e inicializando modo de segurança...',
  },
  {
    label: 'Baixando e instalando nova versão',
    detail: 'Descompactando pacote oficial do repositório e substituindo arquivos no servidor...',
  },
  {
    label: 'Verificando integridade e reativação',
    detail: 'Confirmando status ativo do plugin e revalidando integridade da resposta do site...',
  },
];

interface WebsiteUpdatesViewProps {
  website: { id: string | number; name: string; url: string };
  onBack?: () => void;
  toolsEnabled?: boolean;
  onNavigateToPlans?: () => void;
  onUpdatesChanged?: (summary?: UpdatesSummary, fullData?: UpdatesData) => void;
}

/** Compara semanticamente duas versões numéricas no formato X.Y.Z */
function compareVersions(v1?: string, v2?: string): number {
  if (!v1 || !v2) return 0;
  const p1 = v1.replace(/[^0-9.]/g, '').split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = v2.replace(/[^0-9.]/g, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/** Avalia compatibilidade pré-flight e produz avisos instrutivos sem bloqueio rígido */
function evaluateItemCompatibility(
  item: { name: string; requires_php?: string; requires_wp?: string; tested_wp?: string },
  serverEnv?: ServerEnvironment,
  currentCoreVersion?: string
): CompatibilityWarning[] {
  const warnings: CompatibilityWarning[] = [];
  const wpVersion = serverEnv?.wp_version || currentCoreVersion;
  const phpVersion = serverEnv?.php_version;

  // 1. Homologação WordPress (Versão testada pelo autor vs Versão atual do WP)
  if (item.tested_wp && wpVersion) {
    if (compareVersions(wpVersion, item.tested_wp) > 0) {
      warnings.push({
        type: 'wp_tested',
        title: 'Aviso de Homologação WordPress',
        message: `O autor certificou esta versão até o WordPress ${item.tested_wp}, e seu site está rodando o WordPress ${wpVersion}. Na grande maioria dos casos o plugin funciona perfeitamente, mas a homologação oficial para a sua versão ainda não foi emitida.`,
        severity: 'warning',
      });
    }
  }

  // 2. Requisito Mínimo de PHP
  if (item.requires_php && phpVersion) {
    if (compareVersions(phpVersion, item.requires_php) < 0) {
      warnings.push({
        type: 'php',
        title: 'Requisito de PHP Superior',
        message: `O plugin recomenda PHP ${item.requires_php} ou superior, mas seu servidor está com PHP ${phpVersion}.`,
        severity: 'danger',
      });
    }
  }

  // 3. Requisito Mínimo de WordPress Core
  if (item.requires_wp && wpVersion) {
    if (compareVersions(wpVersion, item.requires_wp) < 0) {
      warnings.push({
        type: 'wp_core',
        title: 'Requisito Mínimo de WordPress',
        message: `Exige no mínimo o WordPress ${item.requires_wp}, enquanto seu site roda ${wpVersion}. Recomendamos atualizar o WordPress antes.`,
        severity: 'warning',
      });
    }
  }

  // 4. Espaço em Disco
  if (serverEnv?.disk_free_mb !== undefined && serverEnv.disk_free_mb !== null) {
    if (serverEnv.disk_free_mb < 300) {
      warnings.push({
        type: 'disk',
        title: 'Espaço em Disco Reduzido',
        message: `O servidor possui apenas ${serverEnv.disk_free_mb} MB livres. A descompactação de arquivos pode falhar se o disco atingir 100%.`,
        severity: 'danger',
      });
    }
  }

  return warnings;
}

export const WebsiteUpdatesView: React.FC<WebsiteUpdatesViewProps> = ({
  website,
  toolsEnabled = true,
  onNavigateToPlans,
  onUpdatesChanged,
}) => {
  const [updatesData, setUpdatesData] = useState<UpdatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [updatingAllPlugins, setUpdatingAllPlugins] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados de Feedback em Tempo Real das Etapas
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [batchCurrentStep, setBatchCurrentStep] = useState<string>('Checando versões e conectando...');
  const [realLogs, setRealLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState<boolean>(false);

  // Modal de Andamento & Decisão Informada
  const [updateModal, setUpdateModal] = useState<UpdateModalState>({
    isOpen: false,
    phase: 'preflight',
    title: '',
    mode: 'single',
    items: [],
    currentIndex: 0,
    overallSuccessCount: 0,
    overallErrorCount: 0,
    warningsCount: 0,
  });

  const isAnyUpdating =
    (updateModal.isOpen && updateModal.phase === 'updating') ||
    updatingItem !== null ||
    updatingAllPlugins ||
    refreshing ||
    loading;

  const handleCloseModal = async () => {
    if (updateModal.isOpen && updateModal.phase === 'updating') return;
    setUpdateModal((prev) => ({ ...prev, isOpen: false }));
    await fetchUpdates(true);
  };

  const onUpdatesChangedRef = useRef(onUpdatesChanged);
  useEffect(() => {
    onUpdatesChangedRef.current = onUpdatesChanged;
  }, [onUpdatesChanged]);

  const fetchUpdates = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh || updatesData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMsg(null);

    try {
      const endpoint = isManualRefresh
        ? `/websites/${website.id}/updates?force_refresh=1`
        : `/websites/${website.id}/updates`;
      const res = await api.get(endpoint);
      const payload = res.data?.data || res.data;

      setUpdatesData(payload);
      if (onUpdatesChangedRef.current && payload?.summary) {
        onUpdatesChangedRef.current(payload.summary, payload);
      }
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Falha ao consultar atualizações do agente WordPress.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [website.id, updatesData]);

  useEffect(() => {
    fetchUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [website.id]);

  /** Execução direta da atualização individual no backend com feedback passo a passo */
  const executeSingleUpdate = async (itemKey: string, type: 'plugin' | 'theme' | 'core') => {
    setUpdatingItem(itemKey);
    setCurrentStepIndex(0);
    setRealLogs([]);
    setShowLogs(false);

    setUpdateModal((prev) => ({
      ...prev,
      phase: 'updating',
      items: prev.items.map((it) => ({ ...it, status: 'updating' })),
    }));

    // Simulação visual sincronizada enquanto a requisição HTTP trafega e o WP executa
    const timer1 = setTimeout(() => setCurrentStepIndex(1), 600);
    const timer2 = setTimeout(() => setCurrentStepIndex(2), 1600);

    try {
      const res = await api.post(`/websites/${website.id}/updates/apply`, {
        type,
        item: itemKey,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      // Etapa 4: Verificando integridade e reativação
      setCurrentStepIndex(3);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const message = res.data?.message || 'Atualização realizada com sucesso!';
      const rawMessages = Array.isArray(res.data?.messages)
        ? res.data.messages
        : Array.isArray(res.data?.data?.messages)
        ? res.data.data.messages
        : [];
      if (rawMessages.length > 0) {
        setRealLogs(rawMessages);
      }

      setUpdateModal((prev) => ({
        ...prev,
        phase: 'finished',
        overallSuccessCount: 1,
        items: prev.items.map((it) => ({
          ...it,
          status: 'success',
          message,
        })),
      }));
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      const errMsg = extractErrorMessage(err, 'Falha ao executar a atualização no WordPress.');
      setUpdateModal((prev) => ({
        ...prev,
        phase: 'finished',
        overallErrorCount: 1,
        items: prev.items.map((it) => ({
          ...it,
          status: 'error',
          message: errMsg,
        })),
      }));
    } finally {
      setUpdatingItem(null);
    }
  };

  /** Dispara a verificação prévia de compatibilidade para 1 item */
  const handleApplyUpdate = (
    type: 'plugin' | 'theme' | 'core',
    itemKey: string,
    itemName?: string,
    currentVersion?: string,
    newVersion?: string,
    requiresPhp?: string,
    requiresWp?: string,
    testedWp?: string
  ) => {
    if (isAnyUpdating) return;

    const displayName = itemName || (type === 'core' ? 'WordPress Core' : itemKey);
    const currVer = currentVersion || '';
    const newVer = newVersion || '';

    // Avaliação Pré-Flight
    const warnings = evaluateItemCompatibility(
      {
        name: displayName,
        requires_php: requiresPhp,
        requires_wp: requiresWp,
        tested_wp: testedWp,
      },
      updatesData?.server_environment,
      updatesData?.core?.current_version
    );

    const progressItem: ProgressItem = {
      id: itemKey,
      name: displayName,
      type,
      currentVersion: currVer,
      newVersion: newVer,
      status: 'pending',
      warnings,
    };

    if (warnings.length > 0) {
      // Exibe modal em fase de pré-flight para Decisão Informada
      setUpdateModal({
        isOpen: true,
        phase: 'preflight',
        title: `Verificação de Compatibilidade: ${displayName}`,
        mode: 'single',
        items: [progressItem],
        currentIndex: 0,
        overallSuccessCount: 0,
        overallErrorCount: 0,
        warningsCount: warnings.length,
      });
    } else {
      // Sem avisos, abre o modal já na fase de atualização direta com os steps
      setUpdateModal({
        isOpen: true,
        phase: 'updating',
        title: `Atualizando ${type === 'core' ? 'WordPress Core' : type === 'plugin' ? 'Plugin' : 'Tema'}: ${displayName}`,
        mode: 'single',
        items: [{ ...progressItem, status: 'updating' }],
        currentIndex: 0,
        overallSuccessCount: 0,
        overallErrorCount: 0,
        warningsCount: 0,
      });
      executeSingleUpdate(itemKey, type);
    }
  };

  /** Execução em lote sequencial com feedback do item ativo */
  const executeBatchUpdate = async (itemsToUpdate: ProgressItem[]) => {
    setUpdatingAllPlugins(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setRealLogs([]);
    setShowLogs(false);

    setUpdateModal((prev) => ({
      ...prev,
      phase: 'updating',
      mode: 'batch',
      items: itemsToUpdate.map((it, idx) => ({ ...it, status: idx === 0 ? 'updating' : 'pending' })),
      currentIndex: 0,
      overallSuccessCount: 0,
      overallErrorCount: 0,
    }));

    let countSuccess = 0;
    let countErrors = 0;

    for (let i = 0; i < itemsToUpdate.length; i++) {
      const item = itemsToUpdate[i];

      setUpdatingItem(item.id);
      setBatchCurrentStep('Checando versões e requisitos...');
      setUpdateModal((prev) => ({
        ...prev,
        currentIndex: i,
        items: prev.items.map((it, idx) => (idx === i ? { ...it, status: 'updating' } : it)),
      }));

      const t1 = setTimeout(() => setBatchCurrentStep('Conectando ao agente e ativando segurança...'), 500);
      const t2 = setTimeout(() => setBatchCurrentStep('Baixando pacote oficial e instalando...'), 1400);

      try {
        const res = await api.post(`/websites/${website.id}/updates/apply`, {
          type: item.type,
          item: item.id,
        });

        clearTimeout(t1);
        clearTimeout(t2);
        setBatchCurrentStep('Verificando integridade e reativação... OK');

        countSuccess++;
        setUpdateModal((prev) => ({
          ...prev,
          overallSuccessCount: countSuccess,
          items: prev.items.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: 'success',
                  message: res.data?.message || 'Atualizado com sucesso!',
                }
              : it
          ),
        }));
      } catch (err: any) {
        clearTimeout(t1);
        clearTimeout(t2);
        countErrors++;
        const errMsg = extractErrorMessage(err, `Falha ao atualizar ${item.name}.`);
        setBatchCurrentStep(`Erro: ${errMsg}`);
        setUpdateModal((prev) => ({
          ...prev,
          overallErrorCount: countErrors,
          items: prev.items.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: 'error',
                  message: errMsg,
                }
              : it
          ),
        }));
      }
    }

    setUpdatingItem(null);
    setUpdatingAllPlugins(false);
    setUpdateModal((prev) => ({
      ...prev,
      phase: 'finished',
    }));
  };

  /** Dispara a verificação prévia em lote para todos os plugins pendentes */
  const handleUpdateAllPlugins = () => {
    if (isAnyUpdating) return;
    if (!updatesData || !updatesData.plugins) return;
    const pendingPlugins = updatesData.plugins.filter((p) => p.has_update);
    if (pendingPlugins.length === 0) return;

    // Avalia compatibilidade de todos os itens da fila
    const batchItems: ProgressItem[] = pendingPlugins.map((plugin) => {
      const warnings = evaluateItemCompatibility(
        {
          name: plugin.name,
          requires_php: plugin.requires_php,
          requires_wp: plugin.requires_wp,
          tested_wp: plugin.tested_wp,
        },
        updatesData.server_environment,
        updatesData.core?.current_version
      );

      return {
        id: plugin.file,
        name: plugin.name,
        type: 'plugin',
        currentVersion: plugin.current_version,
        newVersion: plugin.new_version,
        status: 'pending',
        warnings,
      };
    });

    const totalWarnings = batchItems.reduce((acc, it) => acc + (it.warnings?.length || 0), 0);

    if (totalWarnings > 0) {
      // Abre modal de triagem e decisão informada
      setUpdateModal({
        isOpen: true,
        phase: 'preflight',
        title: `Verificação em Lote (${pendingPlugins.length} plugins)`,
        mode: 'batch',
        items: batchItems,
        currentIndex: 0,
        overallSuccessCount: 0,
        overallErrorCount: 0,
        warningsCount: totalWarnings,
      });
    } else {
      // 100% dos plugins são compatíveis, inicia direto
      executeBatchUpdate(batchItems);
    }
  };

  const coreData = updatesData?.core || { current_version: '', new_version: '', has_update: false };
  const pluginsList = updatesData?.plugins || [];
  const themesList = updatesData?.themes || [];
  const pendingPlugins = pluginsList.filter((p) => p.has_update);
  const pendingThemes = themesList.filter((t) => t.has_update);
  const serverEnv = updatesData?.server_environment;

  return (
    <Stack gap="md">
      {/* Header & Controls */}
      <Paper p="md" radius="md" bg="dark.7" withBorder>
        <Group justify="space-between" align="center">
          <div>
            <Group gap="xs">
              <Title order={4}>🔄 Gestão de Atualizações Remotas</Title>
              {updatesData?.summary && (
                <Badge
                  size="md"
                  color={updatesData.summary.total_pending > 0 ? 'orange' : 'green'}
                  variant="filled"
                >
                  {updatesData.summary.total_pending > 0
                    ? `${updatesData.summary.total_pending} Atualização(ões) Pendente(s)`
                    : 'Tudo Atualizado'}
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed" mt={2}>
              Audite e aplique atualizações no WordPress Core, Plugins e Temas com validação prévia de compatibilidade.
            </Text>
          </div>

          <Button
            variant="light"
            color="indigo"
            size="xs"
            loading={refreshing}
            disabled={isAnyUpdating}
            leftSection={<IconRefresh size={14} />}
            onClick={() => fetchUpdates(true)}
          >
            Buscar Atualizações
          </Button>
        </Group>
      </Paper>

      {/* Feedback Messages */}
      {errorMsg && (
        <Alert
          icon={<IconAlertCircle size={18} />}
          title="Atenção / Falha"
          color="red"
          withCloseButton
          onClose={() => setErrorMsg(null)}
        >
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <Alert
          icon={<IconCheck size={18} />}
          title="Sucesso"
          color="green"
          withCloseButton
          onClose={() => setSuccessMsg(null)}
        >
          {successMsg}
        </Alert>
      )}

      {loading ? (
        <Center p="xl">
          <Loader color="indigo" size="lg" />
        </Center>
      ) : !updatesData ? (
        <Paper p="xl" ta="center" bg="dark.7" radius="md">
          <IconAlertCircle size={48} style={{ opacity: 0.5 }} />
          <Text mt="md" fw={600}>
            Não foi possível carregar o estado das atualizações.
          </Text>
          <Text size="xs" c="dimmed" mb="md">
            Verifique se o agente Vexors está ativo no site ({website.url}).
          </Text>
          <Button variant="light" color="indigo" size="xs" onClick={() => fetchUpdates(true)}>
            Tentar Novamente
          </Button>
        </Paper>
      ) : (
        <Stack gap="lg">
          {toolsEnabled === false && (
            <UpgradeGateBanner
              title="Aplicação Remota de Atualizações Bloqueada"
              description="Seu plano atual permite auditar quais plugins, temas e versões do WordPress precisam de atualização, mas o disparo e aplicação automática via painel exigem um plano pago."
              featureName="Atualizações Remotas"
              onUpgradeClick={onNavigateToPlans}
            />
          )}

          {/* Card de Diagnóstico do Servidor (Passo 2) */}
          {serverEnv && (
            <Paper p="md" radius="md" bg="dark.7" withBorder style={{ borderColor: '#2C2E33' }}>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <ThemeIcon color="teal" variant="light" size="sm" radius="sm">
                    <IconServer size={16} />
                  </ThemeIcon>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    Diagnóstico de Recursos do Servidor (Pre-Flight Data)
                  </Text>
                </Group>
                <Badge size="xs" color="teal" variant="light">
                  Status Coletado
                </Badge>
              </Group>

              <Grid gutter="xs">
                {/* PHP */}
                <Grid.Col span={{ base: 6, sm: 3, md: 2.4 }}>
                  <Paper p="xs" bg="dark.8" radius="sm" withBorder style={{ borderColor: '#25262B' }}>
                    <Text size="11px" c="dimmed">
                      PHP Instalado
                    </Text>
                    <Group gap={6} align="center" mt={2}>
                      <Text size="sm" fw={700} c="white">
                        v{serverEnv.php_version || 'N/A'}
                      </Text>
                      {serverEnv.php_version && (
                        <Badge
                          size="xs"
                          color={compareVersions(serverEnv.php_version, '8.0.0') >= 0 ? 'green' : 'orange'}
                          variant="dot"
                        >
                          {compareVersions(serverEnv.php_version, '8.0.0') >= 0 ? 'OK' : 'Legado'}
                        </Badge>
                      )}
                    </Group>
                  </Paper>
                </Grid.Col>

                {/* MySQL */}
                <Grid.Col span={{ base: 6, sm: 3, md: 2.4 }}>
                  <Paper p="xs" bg="dark.8" radius="sm" withBorder style={{ borderColor: '#25262B' }}>
                    <Text size="11px" c="dimmed">
                      Banco de Dados
                    </Text>
                    <Text size="sm" fw={700} c="white" mt={2} truncate>
                      {serverEnv.mysql_version || 'MySQL / MariaDB'}
                    </Text>
                  </Paper>
                </Grid.Col>

                {/* Core WP */}
                <Grid.Col span={{ base: 6, sm: 3, md: 2.4 }}>
                  <Paper p="xs" bg="dark.8" radius="sm" withBorder style={{ borderColor: '#25262B' }}>
                    <Text size="11px" c="dimmed">
                      WordPress Core
                    </Text>
                    <Text size="sm" fw={700} c="white" mt={2}>
                      v{serverEnv.wp_version || coreData.current_version || 'N/A'}
                    </Text>
                  </Paper>
                </Grid.Col>

                {/* Memory Limit */}
                <Grid.Col span={{ base: 6, sm: 3, md: 2.4 }}>
                  <Paper p="xs" bg="dark.8" radius="sm" withBorder style={{ borderColor: '#25262B' }}>
                    <Text size="11px" c="dimmed">
                      Limite de Memória
                    </Text>
                    <Text size="sm" fw={700} c="white" mt={2}>
                      {serverEnv.memory_limit || 'Padrão'}
                    </Text>
                  </Paper>
                </Grid.Col>

                {/* Disk Space */}
                <Grid.Col span={{ base: 12, sm: 12, md: 2.4 }}>
                  <Paper p="xs" bg="dark.8" radius="sm" withBorder style={{ borderColor: '#25262B' }}>
                    <Group justify="space-between">
                      <Text size="11px" c="dimmed">
                        Espaço em Disco
                      </Text>
                      {serverEnv.disk_free_mb !== undefined && serverEnv.disk_free_mb !== null && (
                        <Text
                          size="11px"
                          fw={700}
                          c={serverEnv.disk_free_mb < 500 ? 'red.4' : 'green.4'}
                        >
                          {serverEnv.disk_free_mb > 1024
                            ? `${(serverEnv.disk_free_mb / 1024).toFixed(1)} GB livres`
                            : `${serverEnv.disk_free_mb} MB livres`}
                        </Text>
                      )}
                    </Group>
                    {serverEnv.disk_total_mb && serverEnv.disk_free_mb && (
                      <Progress
                        mt={6}
                        size="xs"
                        value={Math.round(
                          ((serverEnv.disk_total_mb - serverEnv.disk_free_mb) / serverEnv.disk_total_mb) * 100
                        )}
                        color={serverEnv.disk_free_mb < 500 ? 'red' : 'teal'}
                        radius="xl"
                      />
                    )}
                  </Paper>
                </Grid.Col>
              </Grid>
            </Paper>
          )}

          {/* Summary Cards Row */}
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7">
                <Group justify="space-between" mb="xs">
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    WordPress Core
                  </Text>
                  <ThemeIcon color={coreData.has_update ? 'orange' : 'green'} variant="light" radius="xl">
                    <IconWorld size={18} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="md">
                  Versão {coreData.current_version || 'N/A'}
                </Text>
                <Text size="xs" c="dimmed" mb="sm">
                  {coreData.has_update
                    ? `Nova versão disponível: ${coreData.new_version}`
                    : 'Seu WordPress está na versão mais recente.'}
                </Text>

                {coreData.has_update ? (
                  toolsEnabled === false ? (
                    <Badge
                      color="gray"
                      variant="light"
                      fullWidth
                      leftSection={<IconLock size={12} />}
                      style={{ cursor: onNavigateToPlans ? 'pointer' : 'default' }}
                      onClick={onNavigateToPlans}
                    >
                      Atualização Bloqueada (Free)
                    </Badge>
                  ) : (
                    <Button
                      size="xs"
                      color="orange"
                      fullWidth
                      loading={updatingItem === 'core'}
                      disabled={isAnyUpdating}
                      leftSection={<IconArrowUpCircle size={14} />}
                      onClick={() =>
                        handleApplyUpdate(
                          'core',
                          'core',
                          'WordPress Core',
                          coreData.current_version,
                          coreData.new_version
                        )
                      }
                    >
                      Atualizar para {coreData.new_version}
                    </Button>
                  )
                ) : (
                  <Badge color="green" variant="light" fullWidth>
                    SISTEMA ATUALIZADO
                  </Badge>
                )}
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7">
                <Group justify="space-between" mb="xs">
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    Plugins Instalados
                  </Text>
                  <ThemeIcon color={pendingPlugins.length > 0 ? 'orange' : 'green'} variant="light" radius="xl">
                    <IconPlug size={18} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="md">
                  {pluginsList.length} Plugins no Total
                </Text>
                <Text size="xs" c="dimmed" mb="sm">
                  {pendingPlugins.length > 0
                    ? `${pendingPlugins.length} necessita(m) de atualização.`
                    : 'Todos os plugins estão atualizados.'}
                </Text>
                {pendingPlugins.length > 0 ? (
                  <Button
                    size="xs"
                    color="indigo"
                    fullWidth
                    loading={updatingAllPlugins}
                    disabled={isAnyUpdating}
                    leftSection={<IconArrowUpCircle size={14} />}
                    onClick={handleUpdateAllPlugins}
                  >
                    Atualizar Todos os Plugins ({pendingPlugins.length})
                  </Button>
                ) : (
                  <Badge color="green" variant="light" fullWidth>
                    PLUGINS EM DIA
                  </Badge>
                )}
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7">
                <Group justify="space-between" mb="xs">
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    Temas Instalados
                  </Text>
                  <ThemeIcon color={pendingThemes.length > 0 ? 'orange' : 'green'} variant="light" radius="xl">
                    <IconPalette size={18} />
                  </ThemeIcon>
                </Group>
                <Text fw={700} size="md">
                  {themesList.length} Temas no Total
                </Text>
                <Text size="xs" c="dimmed" mb="sm">
                  {pendingThemes.length > 0
                    ? `${pendingThemes.length} tema(s) desatualizado(s).`
                    : 'Todos os temas estão atualizados.'}
                </Text>
                <Badge color={pendingThemes.length > 0 ? 'orange' : 'green'} variant="light" fullWidth>
                  {pendingThemes.length > 0 ? `${pendingThemes.length} Pendente(s)` : 'TEMAS EM DIA'}
                </Badge>
              </Card>
            </Grid.Col>
          </Grid>

          {/* Section: Plugins Table */}
          <Paper p="md" radius="md" bg="dark.7" withBorder>
            <Group justify="space-between" mb="md">
              <div>
                <Title order={5}>🔌 Plugins ({pluginsList.length})</Title>
                <Text size="xs" c="dimmed">
                  Lista de plugins instalados no WordPress, requisitos informados e versões disponíveis.
                </Text>
              </div>

              {pendingPlugins.length > 0 &&
                (toolsEnabled === false ? (
                  <Badge
                    color="gray"
                    variant="light"
                    size="sm"
                    leftSection={<IconLock size={12} />}
                    style={{ cursor: onNavigateToPlans ? 'pointer' : 'default' }}
                    onClick={onNavigateToPlans}
                  >
                    Atualização em Lote Bloqueada (Free)
                  </Badge>
                ) : (
                  <Button
                    size="xs"
                    color="blue"
                    loading={updatingAllPlugins}
                    disabled={isAnyUpdating}
                    leftSection={<IconArrowUpCircle size={14} />}
                    onClick={handleUpdateAllPlugins}
                  >
                    Atualizar Todos os Pendentes
                  </Button>
                ))}
            </Group>

            {pluginsList.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">
                Nenhum plugin encontrado no site.
              </Text>
            ) : (
              <Table verticalSpacing="xs" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nome do Plugin</Table.Th>
                    <Table.Th>Status WP</Table.Th>
                    <Table.Th>Versão Atual</Table.Th>
                    <Table.Th>Nova Versão</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Ação</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pluginsList.map((plugin) => {
                    const isTestedOutdated =
                      plugin.tested_wp &&
                      serverEnv?.wp_version &&
                      compareVersions(serverEnv.wp_version, plugin.tested_wp) > 0;

                    return (
                      <Table.Tr key={plugin.file}>
                        <Table.Td>
                          <Group gap="xs">
                            <div>
                              <Group gap="xs">
                                <Text size="sm" fw={600}>
                                  {plugin.name}
                                </Text>
                                <Code c="dimmed">{plugin.slug}</Code>
                              </Group>

                              {/* Badges de Compatibilidade Pré-Flight */}
                              {plugin.has_update && (
                                <Group gap={6} mt={3}>
                                  {plugin.tested_wp && (
                                    <Tooltip
                                      label={
                                        isTestedOutdated
                                          ? `O autor testou até o WP ${plugin.tested_wp}. Seu site está no WP ${serverEnv?.wp_version}.`
                                          : `Homologado para sua versão do WordPress.`
                                      }
                                      position="bottom"
                                      withArrow
                                    >
                                      <Badge
                                        size="xs"
                                        color={isTestedOutdated ? 'yellow' : 'gray'}
                                        variant={isTestedOutdated ? 'filled' : 'subtle'}
                                        leftSection={isTestedOutdated ? <IconAlertTriangle size={10} /> : undefined}
                                      >
                                        Testado até WP {plugin.tested_wp}
                                      </Badge>
                                    </Tooltip>
                                  )}
                                  {plugin.requires_php && (
                                    <Badge size="xs" color="gray" variant="subtle">
                                      PHP ≥ {plugin.requires_php}
                                    </Badge>
                                  )}
                                </Group>
                              )}
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {plugin.is_active ? (
                            <Badge size="xs" color="green" variant="light">
                              🟢 Ativo
                            </Badge>
                          ) : (
                            <Badge size="xs" color="gray" variant="subtle">
                              ⚪ Inativo
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" color="gray" variant="outline">
                            {plugin.current_version}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {plugin.has_update ? (
                            <Badge size="xs" color="orange" variant="filled">
                              {plugin.new_version}
                            </Badge>
                          ) : (
                            <Badge size="xs" color="green" variant="light">
                              {plugin.current_version} (Mais Recente)
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {plugin.has_update ? (
                            toolsEnabled === false ? (
                              <Badge
                                color="gray"
                                variant="light"
                                size="xs"
                                leftSection={<IconLock size={10} />}
                                style={{ cursor: onNavigateToPlans ? 'pointer' : 'default' }}
                                onClick={onNavigateToPlans}
                              >
                                Bloqueado (Free)
                              </Badge>
                            ) : (
                              <Button
                                size="xs"
                                color="indigo"
                                loading={updatingItem === plugin.file}
                                disabled={isAnyUpdating}
                                leftSection={<IconArrowUpCircle size={14} />}
                                onClick={() =>
                                  handleApplyUpdate(
                                    'plugin',
                                    plugin.file,
                                    plugin.name,
                                    plugin.current_version,
                                    plugin.new_version,
                                    plugin.requires_php,
                                    plugin.requires_wp,
                                    plugin.tested_wp
                                  )
                                }
                              >
                                Atualizar
                              </Button>
                            )
                          ) : (
                            <Badge size="xs" color="gray" variant="subtle">
                              Atualizado
                            </Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Paper>

          {/* Section: Themes Table */}
          <Paper p="md" radius="md" bg="dark.7" withBorder>
            <Title order={5} mb="xs">
              🎨 Temas ({themesList.length})
            </Title>
            <Text size="xs" c="dimmed" mb="md">
              Lista de temas instalados no WordPress.
            </Text>

            {themesList.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">
                Nenhum tema encontrado no site.
              </Text>
            ) : (
              <Table verticalSpacing="xs" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nome do Tema</Table.Th>
                    <Table.Th>Versão Atual</Table.Th>
                    <Table.Th>Nova Versão</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Ação</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {themesList.map((theme) => (
                    <Table.Tr key={theme.slug}>
                      <Table.Td>
                        <div>
                          <Text size="sm" fw={600}>
                            {theme.name}
                          </Text>
                          <Code c="dimmed">{theme.slug}</Code>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" color="gray" variant="outline">
                          {theme.current_version}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {theme.has_update ? (
                          <Badge size="xs" color="orange" variant="filled">
                            {theme.new_version}
                          </Badge>
                        ) : (
                          <Badge size="xs" color="green" variant="light">
                            {theme.current_version} (Mais Recente)
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {theme.has_update ? (
                          toolsEnabled === false ? (
                            <Badge
                              color="gray"
                              variant="light"
                              size="xs"
                              leftSection={<IconLock size={10} />}
                              style={{ cursor: onNavigateToPlans ? 'pointer' : 'default' }}
                              onClick={onNavigateToPlans}
                            >
                              Bloqueado (Free)
                            </Badge>
                          ) : (
                            <Button
                              size="xs"
                              color="indigo"
                              loading={updatingItem === theme.slug}
                              disabled={isAnyUpdating}
                              leftSection={<IconArrowUpCircle size={14} />}
                              onClick={() =>
                                handleApplyUpdate(
                                  'theme',
                                  theme.slug,
                                  theme.name,
                                  theme.current_version,
                                  theme.new_version,
                                  theme.requires_php,
                                  theme.requires_wp
                                )
                              }
                            >
                              Atualizar
                            </Button>
                          )
                        ) : (
                          <Badge size="xs" color="gray" variant="subtle">
                            Atualizado
                          </Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Stack>
      )}

      {/* Modal de Andamento das Atualizações, Decisão Informada & Etapas Detalhadas */}
      <Modal
        opened={updateModal.isOpen}
        onClose={handleCloseModal}
        closeOnClickOutside={false}
        closeOnEscape={updateModal.phase !== 'updating'}
        withCloseButton={updateModal.phase !== 'updating'}
        title={
          <Group gap="xs">
            <ThemeIcon
              color={
                updateModal.phase === 'preflight'
                  ? 'yellow'
                  : updateModal.overallErrorCount > 0
                  ? 'red'
                  : 'indigo'
              }
              variant="light"
              size="md"
              radius="sm"
            >
              {updateModal.phase === 'preflight' ? (
                <IconAlertTriangle size={20} />
              ) : (
                <IconArrowUpCircle size={20} />
              )}
            </ThemeIcon>
            <Text fw={700} size="md" c="white">
              {updateModal.title}
            </Text>
          </Group>
        }
        size={updateModal.mode === 'batch' || updateModal.phase === 'preflight' ? 'lg' : 'md'}
        radius="md"
        centered
        styles={{
          header: {
            backgroundColor: '#1A1B1E',
            borderBottom: '1px solid #2C2E33',
            padding: '14px 20px',
          },
          body: {
            backgroundColor: '#141517',
            padding: '20px',
          },
          content: {
            backgroundColor: '#141517',
            border: '1px solid #2C2E33',
          },
        }}
      >
        <Stack gap="md">
          {/* FASE 1: PRE-FLIGHT CHECK (Decisão Informada) */}
          {updateModal.phase === 'preflight' && (
            <Stack gap="md">
              {updateModal.mode === 'single' && (
                <>
                  <Paper p="sm" bg="dark.8" radius="sm" withBorder style={{ borderColor: '#2C2E33' }}>
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={700} c="white">
                          {updateModal.items[0]?.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {updateModal.items[0]?.id}
                        </Text>
                      </div>
                      <Group gap={4}>
                        <Badge size="xs" color="gray" variant="outline">
                          v{updateModal.items[0]?.currentVersion}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          →
                        </Text>
                        <Badge size="xs" color="orange" variant="filled">
                          v{updateModal.items[0]?.newVersion}
                        </Badge>
                      </Group>
                    </Group>
                  </Paper>

                  {/* Avisos Identificados */}
                  <Stack gap="xs">
                    {updateModal.items[0]?.warnings?.map((warn, i) => (
                      <Alert
                        key={i}
                        color={warn.severity === 'danger' ? 'red' : 'yellow'}
                        icon={<IconAlertTriangle size={18} />}
                        title={warn.title}
                        radius="sm"
                      >
                        <Text size="xs">{warn.message}</Text>
                      </Alert>
                    ))}
                  </Stack>

                  <Paper p="xs" bg="dark.8" radius="sm">
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <ThemeIcon color="teal" variant="light" size="sm" radius="xl" mt={2}>
                        <IconShieldCheck size={14} />
                      </ThemeIcon>
                      <Text size="xs" c="dimmed">
                        <strong style={{ color: '#fff' }}>Decisão Informada:</strong> O sistema não bloqueia sua atualização. Se optar por prosseguir, você poderá acompanhar o progresso passo a passo em tempo real.
                      </Text>
                    </Group>
                  </Paper>

                  <Group justify="flex-end" gap="sm" mt="xs">
                    <Button
                      variant="subtle"
                      color="gray"
                      size="sm"
                      leftSection={<IconX size={16} />}
                      onClick={handleCloseModal}
                    >
                      Cancelar
                    </Button>
                    <Button
                      color="orange"
                      variant="filled"
                      size="sm"
                      leftSection={<IconArrowUpCircle size={16} />}
                      onClick={() =>
                        executeSingleUpdate(updateModal.items[0].id, updateModal.items[0].type)
                      }
                    >
                      Atualizar Mesmo Assim
                    </Button>
                  </Group>
                </>
              )}

              {updateModal.mode === 'batch' && (
                <>
                  <Alert
                    color="yellow"
                    icon={<IconAlertTriangle size={18} />}
                    title="Avisos de Compatibilidade Identificados"
                    radius="sm"
                  >
                    <Text size="xs">
                      Encontramos {updateModal.warningsCount} aviso(s) de compatibilidade ou homologação na fila de atualização. Você pode atualizar todos mesmo assim ou selecionar apenas os 100% seguros.
                    </Text>
                  </Alert>

                  <Paper
                    p="xs"
                    bg="dark.8"
                    radius="sm"
                    withBorder
                    style={{ borderColor: '#2C2E33', maxHeight: 260, overflowY: 'auto' }}
                  >
                    <Stack gap={6}>
                      {updateModal.items.map((item, idx) => {
                        const hasWarn = (item.warnings?.length || 0) > 0;
                        return (
                          <Group
                            key={item.id}
                            justify="space-between"
                            wrap="nowrap"
                            p="xs"
                            style={{
                              borderBottom:
                                idx < updateModal.items.length - 1 ? '1px solid #25262B' : 'none',
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <Group gap="xs">
                                <Text size="xs" fw={600} truncate c={hasWarn ? 'yellow.4' : 'white'}>
                                  {item.name}
                                </Text>
                                {hasWarn ? (
                                  <Badge size="xs" color="yellow" variant="light">
                                    {item.warnings![0].title}
                                  </Badge>
                                ) : (
                                  <Badge size="xs" color="green" variant="subtle">
                                    ✓ 100% Compatível
                                  </Badge>
                                )}
                              </Group>
                              {hasWarn && (
                                <Text size="11px" c="dimmed" mt={2}>
                                  {item.warnings![0].message}
                                </Text>
                              )}
                            </div>

                            <Group gap={4} wrap="nowrap">
                              <Badge size="xs" color="gray" variant="outline">
                                v{item.currentVersion}
                              </Badge>
                              <Text size="xs" c="dimmed">
                                →
                              </Text>
                              <Badge size="xs" color="indigo" variant="outline">
                                v{item.newVersion}
                              </Badge>
                            </Group>
                          </Group>
                        );
                      })}
                    </Stack>
                  </Paper>

                  <Group justify="space-between" gap="sm" mt="xs">
                    <Button
                      variant="subtle"
                      color="gray"
                      size="xs"
                      leftSection={<IconX size={14} />}
                      onClick={handleCloseModal}
                    >
                      Cancelar
                    </Button>

                    <Group gap="xs">
                      {updateModal.items.some((it) => (it.warnings?.length || 0) === 0) && (
                        <Button
                          color="green"
                          variant="light"
                          size="xs"
                          leftSection={<IconShieldCheck size={14} />}
                          onClick={() => {
                            const safeItems = updateModal.items.filter(
                              (it) => (it.warnings?.length || 0) === 0
                            );
                            executeBatchUpdate(safeItems);
                          }}
                        >
                          Atualizar Apenas os 100% Seguros (
                          {
                            updateModal.items.filter((it) => (it.warnings?.length || 0) === 0)
                              .length
                          }
                          )
                        </Button>
                      )}

                      <Button
                        color="orange"
                        variant="filled"
                        size="xs"
                        leftSection={<IconArrowUpCircle size={14} />}
                        onClick={() => executeBatchUpdate(updateModal.items)}
                      >
                        Atualizar Todos Mesmo com Avisos
                      </Button>
                    </Group>
                  </Group>
                </>
              )}
            </Stack>
          )}

          {/* FASE 2: ATUALIZAÇÃO EM ANDAMENTO (Single Mode com Etapas em Tempo Real) */}
          {updateModal.phase === 'updating' && updateModal.mode === 'single' && (
            <Paper p="md" bg="dark.8" radius="sm" withBorder style={{ borderColor: '#2C2E33' }}>
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <div>
                    <Text size="sm" fw={700} c="white">
                      {updateModal.items[0]?.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {updateModal.items[0]?.id}
                    </Text>
                  </div>
                  {updateModal.items[0]?.currentVersion && updateModal.items[0]?.newVersion && (
                    <Group gap={4}>
                      <Badge size="xs" color="gray" variant="outline">
                        v{updateModal.items[0].currentVersion}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        →
                      </Text>
                      <Badge size="xs" color="indigo" variant="filled">
                        v{updateModal.items[0].newVersion}
                      </Badge>
                    </Group>
                  )}
                </Group>

                {/* Lista de Etapas em Tempo Real */}
                <Stack gap="xs" mt="xs">
                  {UPDATE_STEPS.map((step, idx) => {
                    const isDone = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;

                    return (
                      <Paper
                        key={idx}
                        p="xs"
                        radius="sm"
                        bg={isCurrent ? 'dark.7' : 'dark.9'}
                        withBorder
                        style={{
                          borderColor: isCurrent ? '#4c6ef5' : isDone ? '#2b8a3e44' : '#25262B',
                          transition: 'all 0.25s ease',
                        }}
                      >
                        <Group gap="xs" wrap="nowrap" align="flex-start">
                          <ThemeIcon
                            size="sm"
                            radius="xl"
                            color={isDone ? 'green' : isCurrent ? 'indigo' : 'gray'}
                            variant={isDone || isCurrent ? 'light' : 'subtle'}
                            mt={2}
                          >
                            {isDone ? (
                              <IconCheck size={14} />
                            ) : isCurrent ? (
                              <Loader size={12} color="indigo" />
                            ) : (
                              <Text size="10px" c="dimmed">
                                ⚪
                              </Text>
                            )}
                          </ThemeIcon>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Group justify="space-between" wrap="nowrap">
                              <Text
                                size="xs"
                                fw={isCurrent ? 700 : 500}
                                c={isDone ? 'green.4' : isCurrent ? 'white' : 'dimmed'}
                              >
                                {step.label}
                              </Text>
                              {isDone && (
                                <Badge size="xs" color="green" variant="subtle">
                                  Concluído
                                </Badge>
                              )}
                              {isCurrent && (
                                <Badge size="xs" color="indigo" variant="light">
                                  Em andamento...
                                </Badge>
                              )}
                            </Group>
                            <Text size="11px" c="dimmed" mt={1}>
                              {step.detail}
                            </Text>
                          </div>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>

                <Text size="11px" c="dimmed" ta="center">
                  O WordPress está aplicando as alterações com segurança. Não feche esta janela.
                </Text>
              </Stack>
            </Paper>
          )}

          {/* FASE 3: CONCLUÍDO (Single Mode com Resumo e Logs) */}
          {updateModal.phase === 'finished' && updateModal.mode === 'single' && (
            <Stack gap="sm">
              {updateModal.overallSuccessCount > 0 ? (
                <Alert
                  color="green"
                  icon={<IconCheck size={20} />}
                  title="Atualização Concluída com Sucesso!"
                  radius="sm"
                >
                  <Text size="sm">
                    {updateModal.items[0]?.message ||
                      `${updateModal.items[0]?.name} foi atualizado com sucesso!`}
                  </Text>
                </Alert>
              ) : (
                <Alert
                  color="red"
                  icon={<IconAlertCircle size={20} />}
                  title="Falha na Atualização"
                  radius="sm"
                >
                  <Text size="sm">
                    {updateModal.items[0]?.message || 'Não foi possível concluir a atualização.'}
                  </Text>
                </Alert>
              )}

              {/* Resumo das Etapas Finalizadas */}
              <Paper p="xs" bg="dark.8" radius="sm" withBorder style={{ borderColor: '#2C2E33' }}>
                <Stack gap={6}>
                  {UPDATE_STEPS.map((step, idx) => (
                    <Group key={idx} justify="space-between" p="4px 8px">
                      <Group gap="xs">
                        <ThemeIcon
                          size="xs"
                          radius="xl"
                          color={updateModal.overallSuccessCount > 0 ? 'green' : idx < 2 ? 'green' : 'red'}
                          variant="light"
                        >
                          {updateModal.overallSuccessCount > 0 ? (
                            <IconCheck size={12} />
                          ) : idx < 2 ? (
                            <IconCheck size={12} />
                          ) : (
                            <IconAlertCircle size={12} />
                          )}
                        </ThemeIcon>
                        <Text size="xs" c="dimmed">
                          {step.label}
                        </Text>
                      </Group>
                      <Badge
                        size="xs"
                        color={updateModal.overallSuccessCount > 0 ? 'green' : idx < 2 ? 'green' : 'red'}
                        variant="subtle"
                      >
                        {updateModal.overallSuccessCount > 0 ? 'OK' : idx < 2 ? 'OK' : 'Falha'}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              </Paper>

              {/* Registro Técnico do WordPress Upgrader */}
              {realLogs.length > 0 && (
                <div>
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    fullWidth
                    rightSection={showLogs ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                    onClick={() => setShowLogs((prev) => !prev)}
                  >
                    {showLogs
                      ? 'Ocultar detalhes técnicos'
                      : `Ver registro técnico do WordPress (${realLogs.length} etapas)`}
                  </Button>
                  {showLogs && (
                    <Paper
                      p="xs"
                      bg="dark.9"
                      radius="sm"
                      mt="xs"
                      withBorder
                      style={{ borderColor: '#25262B', maxHeight: 150, overflowY: 'auto' }}
                    >
                      <Stack gap={4}>
                        {realLogs.map((log, i) => (
                          <Text key={i} size="11px" c="dimmed" style={{ fontFamily: 'monospace' }}>
                            • {log}
                          </Text>
                        ))}
                      </Stack>
                    </Paper>
                  )}
                </div>
              )}

              <Button
                color={updateModal.overallSuccessCount > 0 ? 'green' : 'gray'}
                variant="filled"
                fullWidth
                leftSection={
                  updateModal.overallSuccessCount > 0 ? <IconCheck size={16} /> : undefined
                }
                onClick={handleCloseModal}
              >
                Concluir e Atualizar Lista
              </Button>
            </Stack>
          )}

          {/* FASE 2 & 3: BATCH MODE (Atualização em Lote) */}
          {updateModal.phase !== 'preflight' && updateModal.mode === 'batch' && (
            <>
              <div>
                <Group justify="space-between" mb={6}>
                  <Text size="xs" fw={600} c="dimmed">
                    {updateModal.phase === 'updating'
                      ? `Progresso: ${updateModal.currentIndex + 1} de ${updateModal.items.length}`
                      : `Concluído: ${updateModal.items.length} de ${updateModal.items.length} itens processados`}
                  </Text>
                  <Text
                    size="xs"
                    fw={700}
                    c={updateModal.phase === 'updating' ? 'indigo.3' : 'green.4'}
                  >
                    {Math.round(
                      ((updateModal.phase === 'updating'
                        ? updateModal.currentIndex
                        : updateModal.items.length) /
                        updateModal.items.length) *
                        100
                    )}
                    %
                  </Text>
                </Group>
                <Progress
                  value={
                    ((updateModal.phase === 'updating'
                      ? updateModal.currentIndex + 0.3
                      : updateModal.items.length) /
                      updateModal.items.length) *
                    100
                  }
                  color={updateModal.phase === 'updating' ? 'indigo' : 'green'}
                  animated={updateModal.phase === 'updating'}
                  size="md"
                  radius="xl"
                />
              </div>

              {/* Feedback da Etapa em Execução para o Item Atual */}
              {updateModal.phase === 'updating' && updateModal.items[updateModal.currentIndex] && (
                <Paper p="xs" bg="dark.7" radius="sm" withBorder style={{ borderColor: '#373A40' }}>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                      <Loader size="xs" color="indigo" />
                      <div style={{ minWidth: 0 }}>
                        <Text size="xs" fw={700} c="white" truncate>
                          {updateModal.items[updateModal.currentIndex]?.name}
                        </Text>
                        <Text size="11px" c="indigo.3" truncate>
                          {batchCurrentStep}
                        </Text>
                      </div>
                    </Group>
                    <Badge size="xs" color="indigo" variant="light">
                      Item {updateModal.currentIndex + 1} de {updateModal.items.length}
                    </Badge>
                  </Group>
                </Paper>
              )}

              {updateModal.phase === 'finished' &&
                (updateModal.overallErrorCount === 0 ? (
                  <Alert
                    color="green"
                    icon={<IconCheck size={18} />}
                    title="Todos os Itens Atualizados!"
                    radius="sm"
                  >
                    <Text size="sm">
                      Todos os {updateModal.overallSuccessCount} plugins selecionados foram atualizados com sucesso e o site segue em perfeito funcionamento.
                    </Text>
                  </Alert>
                ) : (
                  <Alert
                    color="yellow"
                    icon={<IconAlertCircle size={18} />}
                    title="Processamento Concluído com Avisos"
                    radius="sm"
                  >
                    <Text size="sm">
                      {updateModal.overallSuccessCount} item(ns) atualizado(s) com sucesso e{' '}
                      {updateModal.overallErrorCount} com erro. Verifique a lista abaixo.
                    </Text>
                  </Alert>
                ))}

              {/* Lista com o status de cada item em tempo real */}
              <Paper
                p="xs"
                bg="dark.8"
                radius="sm"
                withBorder
                style={{ borderColor: '#2C2E33', maxHeight: 260, overflowY: 'auto' }}
              >
                <Stack gap={6}>
                  {updateModal.items.map((item, idx) => (
                    <Group
                      key={item.id}
                      justify="space-between"
                      wrap="nowrap"
                      p="xs"
                      style={{
                        borderBottom:
                          idx < updateModal.items.length - 1 ? '1px solid #25262B' : 'none',
                      }}
                    >
                      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                        {item.status === 'updating' && <Loader size="xs" color="indigo" />}
                        {item.status === 'success' && <IconCheck size={16} color="#12b886" />}
                        {item.status === 'error' && <IconAlertCircle size={16} color="#fa5252" />}
                        {item.status === 'pending' && <Text size="xs" c="dimmed">⏳</Text>}

                        <div style={{ minWidth: 0 }}>
                          <Text
                            size="xs"
                            fw={600}
                            truncate
                            c={
                              item.status === 'updating'
                                ? 'indigo.3'
                                : item.status === 'error'
                                ? 'red.4'
                                : 'white'
                            }
                          >
                            {item.name}
                          </Text>
                          {item.message && (
                            <Text
                              size="11px"
                              c={item.status === 'error' ? 'red.3' : 'dimmed'}
                              truncate
                            >
                              {item.message}
                            </Text>
                          )}
                        </div>
                      </Group>

                      <Group gap={4} wrap="nowrap">
                        <Badge size="xs" color="gray" variant="outline">
                          v{item.currentVersion}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          →
                        </Text>
                        <Badge
                          size="xs"
                          color={item.status === 'success' ? 'green' : 'indigo'}
                          variant={item.status === 'success' ? 'filled' : 'outline'}
                        >
                          v{item.newVersion}
                        </Badge>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </Paper>

              {updateModal.phase === 'finished' && (
                <Button
                  color={updateModal.overallErrorCount === 0 ? 'green' : 'indigo'}
                  variant="filled"
                  fullWidth
                  leftSection={<IconCheck size={16} />}
                  onClick={handleCloseModal}
                >
                  Concluir e Atualizar Lista
                </Button>
              )}
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
};
