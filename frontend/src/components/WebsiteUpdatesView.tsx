import React, { useState, useEffect, useCallback } from 'react';
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

interface UpdatesSummary {
  total_pending: number;
  pending_plugins: number;
  pending_themes: number;
  pending_core: number;
}

interface UpdatesData {
  summary: UpdatesSummary;
  core: CoreUpdateData;
  plugins: PluginUpdateItem[];
  themes: ThemeUpdateItem[];
}

interface WebsiteUpdatesViewProps {
  website: { id: string | number; name: string; url: string };
  onBack?: () => void;
  toolsEnabled?: boolean;
  onNavigateToPlans?: () => void;
}

export const WebsiteUpdatesView: React.FC<WebsiteUpdatesViewProps> = ({
  website,
  toolsEnabled = true,
  onNavigateToPlans,
}) => {
  const [updatesData, setUpdatesData] = useState<UpdatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [updatingAllPlugins, setUpdatingAllPlugins] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchUpdates = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
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

      // Se o retorno veio sem a lista de plugins mas indica que há pendências (cache legado/incompleto)
      if (
        !isManualRefresh &&
        payload &&
        (!payload.plugins || payload.plugins.length === 0) &&
        (payload.summary?.total_pending > 0 || payload.summary?.pending_plugins > 0)
      ) {
        const liveRes = await api.get(`/websites/${website.id}/updates?force_refresh=1`);
        const livePayload = liveRes.data?.data || liveRes.data;
        setUpdatesData(livePayload);
        return;
      }

      setUpdatesData(payload);
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Falha ao consultar atualizações do agente WordPress.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [website.id]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const handleApplyUpdate = async (type: 'plugin' | 'theme' | 'core', itemKey: string) => {
    setUpdatingItem(itemKey);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.post(`/websites/${website.id}/updates/apply`, {
        type,
        item: itemKey,
      });

      const message = res.data?.message || 'Atualização realizada com sucesso!';
      setSuccessMsg(message);
      setTimeout(() => setSuccessMsg(null), 5000);
      await fetchUpdates(true);
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Falha ao executar a atualização no WordPress.'));
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleUpdateAllPlugins = async () => {
    if (!updatesData || !updatesData.plugins) return;
    const pendingPlugins = updatesData.plugins.filter((p) => p.has_update);
    if (pendingPlugins.length === 0) return;

    setUpdatingAllPlugins(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    let countSuccess = 0;
    let countErrors = 0;

    for (const plugin of pendingPlugins) {
      setUpdatingItem(plugin.file);
      try {
        await api.post(`/websites/${website.id}/updates/apply`, {
          type: 'plugin',
          item: plugin.file,
        });
        countSuccess++;
      } catch (err) {
        countErrors++;
      }
    }

    setUpdatingItem(null);
    setUpdatingAllPlugins(false);

    if (countErrors === 0) {
      setSuccessMsg(`Todos os ${countSuccess} plugins foram atualizados com sucesso!`);
    } else {
      setErrorMsg(`${countSuccess} plugins atualizados com sucesso e ${countErrors} com erro.`);
    }
    setTimeout(() => {
      setSuccessMsg(null);
      setErrorMsg(null);
    }, 6000);

    await fetchUpdates(true);
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
                      leftSection={<IconArrowUpCircle size={14} />}
                      onClick={() => handleApplyUpdate('core', 'core')}
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
                              disabled={updatingAllPlugins}
                              leftSection={<IconArrowUpCircle size={14} />}
                              onClick={() => handleApplyUpdate('plugin', plugin.file)}
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
                              leftSection={<IconArrowUpCircle size={14} />}
                              onClick={() => handleApplyUpdate('theme', theme.slug)}
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
    </Stack>
  );
};
