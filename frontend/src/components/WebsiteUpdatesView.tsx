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
} from '@tabler/icons-react';
import { api } from '../api';
import { extractErrorMessage } from '../utils/formatError';
import { UpgradeGateBanner } from './UpgradeGateBanner';

interface PluginUpdateItem {
  file: string;
  slug: string;
  name: string;
  current_version: string;
  new_version: string;
  has_update: boolean;
  is_active?: boolean;
}

interface ThemeUpdateItem {
  slug: string;
  name: string;
  current_version: string;
  new_version: string;
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
}

export interface UpdateModalState {
  isOpen: boolean;
  isProcessing: boolean;
  title: string;
  mode: 'single' | 'batch';
  items: ProgressItem[];
  currentIndex: number;
  overallSuccessCount: number;
  overallErrorCount: number;
}

interface WebsiteUpdatesViewProps {
  website: { id: string | number; name: string; url: string };
  onBack?: () => void;
  toolsEnabled?: boolean;
  onNavigateToPlans?: () => void;
  onUpdatesChanged?: (summary?: UpdatesSummary, fullData?: UpdatesData) => void;
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

  // Modal de Andamento das Atualizações & Trava de Concorrência
  const [updateModal, setUpdateModal] = useState<UpdateModalState>({
    isOpen: false,
    isProcessing: false,
    title: '',
    mode: 'single',
    items: [],
    currentIndex: 0,
    overallSuccessCount: 0,
    overallErrorCount: 0,
  });

  const isAnyUpdating = updateModal.isProcessing || updatingItem !== null || updatingAllPlugins || refreshing || loading;

  const handleCloseModal = async () => {
    if (updateModal.isProcessing) return;
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

  const handleApplyUpdate = async (
    type: 'plugin' | 'theme' | 'core',
    itemKey: string,
    itemName?: string,
    currentVersion?: string,
    newVersion?: string
  ) => {
    if (isAnyUpdating) return;

    const displayName = itemName || (type === 'core' ? 'WordPress Core' : itemKey);
    const currVer = currentVersion || '';
    const newVer = newVersion || '';

    setUpdatingItem(itemKey);
    setErrorMsg(null);
    setSuccessMsg(null);

    setUpdateModal({
      isOpen: true,
      isProcessing: true,
      title: `Atualizando ${type === 'core' ? 'WordPress Core' : type === 'plugin' ? 'Plugin' : 'Tema'}: ${displayName}`,
      mode: 'single',
      items: [{
        id: itemKey,
        name: displayName,
        type,
        currentVersion: currVer,
        newVersion: newVer,
        status: 'updating',
      }],
      currentIndex: 0,
      overallSuccessCount: 0,
      overallErrorCount: 0,
    });

    try {
      const res = await api.post(`/websites/${website.id}/updates/apply`, {
        type,
        item: itemKey,
      });

      const message = res.data?.message || 'Atualização realizada com sucesso!';
      setUpdateModal((prev) => ({
        ...prev,
        isProcessing: false,
        overallSuccessCount: 1,
        items: prev.items.map((it) => ({
          ...it,
          status: 'success',
          message,
        })),
      }));
    } catch (err: any) {
      const errMsg = extractErrorMessage(err, 'Falha ao executar a atualização no WordPress.');
      setUpdateModal((prev) => ({
        ...prev,
        isProcessing: false,
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

  const handleUpdateAllPlugins = async () => {
    if (isAnyUpdating) return;
    if (!updatesData || !updatesData.plugins) return;
    const pendingPlugins = updatesData.plugins.filter((p) => p.has_update);
    if (pendingPlugins.length === 0) return;

    setUpdatingAllPlugins(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const initialItems: ProgressItem[] = pendingPlugins.map((p, idx) => ({
      id: p.file,
      name: p.name,
      type: 'plugin',
      currentVersion: p.current_version,
      newVersion: p.new_version,
      status: idx === 0 ? 'updating' : 'pending',
    }));

    setUpdateModal({
      isOpen: true,
      isProcessing: true,
      title: `Atualizando Plugins Pendentes (${pendingPlugins.length} itens)`,
      mode: 'batch',
      items: initialItems,
      currentIndex: 0,
      overallSuccessCount: 0,
      overallErrorCount: 0,
    });

    let countSuccess = 0;
    let countErrors = 0;

    for (let i = 0; i < pendingPlugins.length; i++) {
      const plugin = pendingPlugins[i];

      setUpdatingItem(plugin.file);
      setUpdateModal((prev) => ({
        ...prev,
        currentIndex: i,
        items: prev.items.map((it, idx) => idx === i ? { ...it, status: 'updating' } : it),
      }));

      try {
        const res = await api.post(`/websites/${website.id}/updates/apply`, {
          type: 'plugin',
          item: plugin.file,
        });
        countSuccess++;
        setUpdateModal((prev) => ({
          ...prev,
          overallSuccessCount: countSuccess,
          items: prev.items.map((it, idx) => idx === i ? {
            ...it,
            status: 'success',
            message: res.data?.message || 'Atualizado com sucesso!',
          } : it),
        }));
      } catch (err: any) {
        countErrors++;
        const errMsg = extractErrorMessage(err, `Falha ao atualizar ${plugin.name}.`);
        setUpdateModal((prev) => ({
          ...prev,
          overallErrorCount: countErrors,
          items: prev.items.map((it, idx) => idx === i ? {
            ...it,
            status: 'error',
            message: errMsg,
          } : it),
        }));
      }
    }

    setUpdatingItem(null);
    setUpdatingAllPlugins(false);
    setUpdateModal((prev) => ({
      ...prev,
      isProcessing: false,
    }));
  };

  const coreData = updatesData?.core || { current_version: '', new_version: '', has_update: false };
  const pluginsList = updatesData?.plugins || [];
  const themesList = updatesData?.themes || [];
  const pendingPlugins = pluginsList.filter((p) => p.has_update);
  const pendingThemes = themesList.filter((t) => t.has_update);

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
              Gerencie e aplique atualizações no WordPress Core, Plugins e Temas diretamente pelo SaaS.
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
                      onClick={() => handleApplyUpdate('core', 'core', 'WordPress Core', coreData.current_version, coreData.new_version)}
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
                  Lista de plugins instalados no WordPress e versões disponíveis no repositório.
                </Text>
              </div>

              {pendingPlugins.length > 0 && (
                toolsEnabled === false ? (
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
                )
              )}
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
                  {pluginsList.map((plugin) => (
                    <Table.Tr key={plugin.file}>
                      <Table.Td>
                        <Group gap="xs">
                          <Text size="sm" fw={600}>
                            {plugin.name}
                          </Text>
                          <Code c="dimmed">
                            {plugin.slug}
                          </Code>
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
                              onClick={() => handleApplyUpdate('plugin', plugin.file, plugin.name, plugin.current_version, plugin.new_version)}
                            >
                              Atualizar
                            </Button>
                          )
                        ) : (
                          <Badge color="green" variant="subtle" size="xs">
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
                        <Text size="sm" fw={600}>
                          {theme.name}
                        </Text>
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
                              onClick={() => handleApplyUpdate('theme', theme.slug, theme.name, theme.current_version, theme.new_version)}
                            >
                              Atualizar
                            </Button>
                          )
                        ) : (
                          <Badge color="green" variant="subtle" size="xs">
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

      {/* Modal de Andamento das Atualizações & Trava de Concorrência */}
      <Modal
        opened={updateModal.isOpen}
        onClose={handleCloseModal}
        closeOnClickOutside={false}
        closeOnEscape={!updateModal.isProcessing}
        withCloseButton={!updateModal.isProcessing}
        title={
          <Group gap="xs">
            <ThemeIcon color="indigo" variant="light" size="md" radius="sm">
              <IconArrowUpCircle size={20} />
            </ThemeIcon>
            <Text fw={700} size="md" c="white">
              {updateModal.title}
            </Text>
          </Group>
        }
        size={updateModal.mode === 'batch' ? 'lg' : 'md'}
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
          {/* MODO SINGLE: Update individual */}
          {updateModal.mode === 'single' && (
            <>
              {updateModal.isProcessing ? (
                <Paper p="md" bg="dark.8" radius="sm" withBorder style={{ borderColor: '#2C2E33' }}>
                  <Stack align="center" gap="sm" py="md">
                    <Loader color="indigo" size="lg" />
                    <Text fw={600} size="sm" c="white">
                      Atualizando {updateModal.items[0]?.name}...
                    </Text>
                    {updateModal.items[0]?.currentVersion && updateModal.items[0]?.newVersion && (
                      <Group gap="xs">
                        <Badge size="xs" color="gray" variant="outline">
                          v{updateModal.items[0].currentVersion}
                        </Badge>
                        <Text size="xs" c="dimmed">→</Text>
                        <Badge size="xs" color="indigo" variant="filled">
                          v{updateModal.items[0].newVersion}
                        </Badge>
                      </Group>
                    )}
                    <Text size="xs" c="dimmed" ta="center" style={{ maxWidth: 380 }}>
                      Enviando comando para o agente WordPress. O pacote está sendo baixado e instalado com segurança. Não feche esta janela.
                    </Text>
                  </Stack>
                </Paper>
              ) : updateModal.overallSuccessCount > 0 ? (
                <Alert color="green" icon={<IconCheck size={20} />} title="Atualização Concluída!" radius="sm">
                  <Text size="sm">
                    {updateModal.items[0]?.message || `${updateModal.items[0]?.name} foi atualizado com sucesso!`}
                  </Text>
                </Alert>
              ) : (
                <Alert color="red" icon={<IconAlertCircle size={20} />} title="Falha na Atualização" radius="sm">
                  <Text size="sm">
                    {updateModal.items[0]?.message || 'Não foi possível concluir a atualização.'}
                  </Text>
                </Alert>
              )}

              {!updateModal.isProcessing && (
                <Button
                  color={updateModal.overallSuccessCount > 0 ? 'green' : 'gray'}
                  variant="filled"
                  fullWidth
                  leftSection={updateModal.overallSuccessCount > 0 ? <IconCheck size={16} /> : undefined}
                  onClick={handleCloseModal}
                >
                  Concluir e Atualizar Lista
                </Button>
              )}
            </>
          )}

          {/* MODO BATCH: Atualizar Todos */}
          {updateModal.mode === 'batch' && (
            <>
              <div>
                <Group justify="space-between" mb={6}>
                  <Text size="xs" fw={600} c="dimmed">
                    {updateModal.isProcessing
                      ? `Progresso: ${updateModal.currentIndex + 1} de ${updateModal.items.length}`
                      : `Concluído: ${updateModal.items.length} de ${updateModal.items.length} itens processados`}
                  </Text>
                  <Text size="xs" fw={700} c={updateModal.isProcessing ? 'indigo.3' : 'green.4'}>
                    {Math.round(
                      ((updateModal.isProcessing
                        ? updateModal.currentIndex
                        : updateModal.items.length) /
                        updateModal.items.length) *
                        100
                    )}%
                  </Text>
                </Group>
                <Progress
                  value={
                    ((updateModal.isProcessing
                      ? updateModal.currentIndex + 0.3
                      : updateModal.items.length) /
                      updateModal.items.length) *
                    100
                  }
                  color={updateModal.isProcessing ? 'indigo' : 'green'}
                  animated={updateModal.isProcessing}
                  size="md"
                  radius="xl"
                />
              </div>

              {!updateModal.isProcessing && (
                updateModal.overallErrorCount === 0 ? (
                  <Alert color="green" icon={<IconCheck size={18} />} title="Todos os Plugins Atualizados!" radius="sm">
                    <Text size="sm">
                      Todos os {updateModal.overallSuccessCount} plugins foram atualizados com sucesso e o site segue em perfeito funcionamento.
                    </Text>
                  </Alert>
                ) : (
                  <Alert color="yellow" icon={<IconAlertCircle size={18} />} title="Processamento Concluído com Avisos" radius="sm">
                    <Text size="sm">
                      {updateModal.overallSuccessCount} plugin(s) atualizado(s) com sucesso e {updateModal.overallErrorCount} com erro. Verifique a lista abaixo.
                    </Text>
                  </Alert>
                )
              )}

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
                    <Group key={item.id} justify="space-between" wrap="nowrap" p="xs" style={{ borderBottom: idx < updateModal.items.length - 1 ? '1px solid #25262B' : 'none' }}>
                      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                        {item.status === 'updating' && <Loader size="xs" color="indigo" />}
                        {item.status === 'success' && <IconCheck size={16} color="#12b886" />}
                        {item.status === 'error' && <IconAlertCircle size={16} color="#fa5252" />}
                        {item.status === 'pending' && <Text size="xs" c="dimmed">⏳</Text>}

                        <div style={{ minWidth: 0 }}>
                          <Text size="xs" fw={600} truncate c={item.status === 'updating' ? 'indigo.3' : item.status === 'error' ? 'red.4' : 'white'}>
                            {item.name}
                          </Text>
                          {item.message && (
                            <Text size="11px" c={item.status === 'error' ? 'red.3' : 'dimmed'} truncate>
                              {item.message}
                            </Text>
                          )}
                        </div>
                      </Group>

                      <Group gap={4} wrap="nowrap">
                        <Badge size="xs" color="gray" variant="outline">
                          v{item.currentVersion}
                        </Badge>
                        <Text size="xs" c="dimmed">→</Text>
                        <Badge size="xs" color={item.status === 'success' ? 'green' : 'indigo'} variant={item.status === 'success' ? 'filled' : 'outline'}>
                          v{item.newVersion}
                        </Badge>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </Paper>

              {!updateModal.isProcessing && (
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
