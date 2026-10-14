import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Grid,
  Card,
  Badge,
  Button,
  Table,
  Tabs,
  Progress,
  ActionIcon,
  Tooltip,
  Modal,
  Textarea,
  Alert,
  Loader,
  Center,
  ThemeIcon,
  Box,
  Select,
} from '@mantine/core';
import {
  IconWorld,
  IconCalendarCheck,
  IconAlertTriangle,
  IconShieldCheck,
  IconPlugConnected,
  IconPlugConnectedX,
  IconCheck,
  IconArrowRight,
  IconRadar,
  IconRefresh,
  IconNotes,
  IconCalendarEvent,
  IconRotateClockwise,
} from '@tabler/icons-react';
import {
  getDashboardOverview,
  completeWebsiteMaintenance,
  uncompleteWebsiteMaintenance,
  getAvailableMaintenanceMonths,
  syncAllIntegrityWebsites,
  DashboardOverviewResponse,
  DashboardMaintenanceTask,
  Website,
} from '../api';

interface OverviewDashboardViewProps {
  onSelectWebsite: (website: Website | any, initialTab?: string) => void;
  onNavigateToWebsites: () => void;
}

export const OverviewDashboardView: React.FC<OverviewDashboardViewProps> = ({
  onSelectWebsite,
  onNavigateToWebsites,
}) => {
  const [data, setData] = useState<DashboardOverviewResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingIntegrity, setSyncingIntegrity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Complete Maintenance Modal State
  const maintenanceMonthOptions = getAvailableMaintenanceMonths();
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<DashboardMaintenanceTask | null>(null);
  const [selectedMaintenanceMonth, setSelectedMaintenanceMonth] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDashboardOverview();
      if (response && response.data) {
        setData(response.data);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.messages?.error ||
        err.response?.data?.message ||
        'Erro ao carregar o painel geral de monitoramento.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleOpenCompleteModal = (task: DashboardMaintenanceTask) => {
    setTaskToComplete(task);
    setNotes('');
    setSelectedMaintenanceMonth(data?.year_month || maintenanceMonthOptions[0]?.value || '');
    setCompleteModalOpen(true);
  };

  const handleConfirmComplete = async () => {
    if (!taskToComplete) return;
    setActionLoading(true);
    try {
      await completeWebsiteMaintenance(taskToComplete.website_id, selectedMaintenanceMonth, notes);
      setCompleteModalOpen(false);
      setTaskToComplete(null);
      setNotes('');
      // Refresh dashboard data
      await fetchOverview();
    } catch (err: any) {
      alert(
        err.response?.data?.messages?.error ||
        err.response?.data?.message ||
        'Erro ao registrar conclusão da manutenção.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleUncomplete = async (task: DashboardMaintenanceTask) => {
    if (
      !confirm(
        `Deseja reabrir a manutenção de ${task.website_name} para ${data?.year_month_label || 'este mês'}?`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      await uncompleteWebsiteMaintenance(task.website_id, data?.year_month);
      await fetchOverview();
    } catch (err: any) {
      alert(
        err.response?.data?.messages?.error ||
        err.response?.data?.message ||
        'Erro ao reabrir manutenção.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncIntegrity = async () => {
    setSyncingIntegrity(true);
    try {
      const res = await syncAllIntegrityWebsites();
      await fetchOverview();
      alert(res.message || 'Integridades sincronizadas com sucesso!');
    } catch (err: any) {
      alert(
        err.response?.data?.messages?.error ||
        err.response?.data?.message ||
        'Falha ao sincronizar integridades dos websites.'
      );
    } finally {
      setSyncingIntegrity(false);
    }
  };

  const getScoreColor = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return 'gray';
    if (score >= 90) return 'teal';
    if (score >= 75) return 'blue';
    if (score >= 50) return 'yellow';
    return 'red';
  };

  if (loading && !data) {
    return (
      <Center p="xl" style={{ minHeight: 400 }}>
        <Stack align="center" gap="xs">
          <Loader color="indigo" size="lg" />
          <Text c="dimmed" size="sm">
            Carregando Cockpit da Plataforma...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (error && !data) {
    return (
      <Alert
        icon={<IconAlertTriangle size={16} />}
        color="red"
        title="Erro ao Carregar Dashboard"
        variant="filled"
      >
        {error}
        <Button variant="white" color="dark" size="xs" mt="md" onClick={fetchOverview}>
          Tentar Novamente
        </Button>
      </Alert>
    );
  }

  const metrics = data?.metrics || {
    total_websites: 0,
    connected_websites: 0,
    pending_websites: 0,
    average_score: null,
    total_scheduled: 0,
    completed_count: 0,
    overdue_count: 0,
    today_count: 0,
    upcoming_count: 0,
    not_scheduled_count: 0,
    progress_percent: 0,
    urgent_tasks_count: 0,
  };

  const maintenances = data?.maintenances || [];
  const securityRadar = data?.security_radar || [];
  const integrityRadar = data?.integrity_radar || [];

  // Filter maintenance list according to active tab
  const filteredMaintenances = maintenances.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'overdue') return item.status === 'overdue';
    if (activeFilter === 'today') return item.status === 'today';
    if (activeFilter === 'upcoming') return item.status === 'upcoming';
    if (activeFilter === 'completed') return item.status === 'completed';
    if (activeFilter === 'not_scheduled') return item.status === 'not_scheduled';
    return true;
  });

  return (
    <Stack gap="lg">
      {/* Header Banner */}
      <Paper p="md" radius="md" bg="dark.7" withBorder style={{ borderLeft: '4px solid #4c6ef5' }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <div>
            <Group gap="xs" align="center">
              <Title order={3}>Painel Geral & Cockpit de Monitoramento</Title>
              <Badge color="indigo" variant="filled" size="md">
                {data?.year_month_label || 'Ciclo Atual'}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              Acompanhamento integrado de alvos WordPress, ciclo mensal de manutenções e segurança da carteira.
            </Text>
          </div>

          <Group gap="xs">
            <Button
              variant="light"
              color="gray"
              size="xs"
              leftSection={<IconRefresh size={14} />}
              onClick={fetchOverview}
              loading={loading}
            >
              Atualizar
            </Button>
            <Button
              variant="filled"
              color="indigo"
              size="xs"
              leftSection={<IconWorld size={14} />}
              onClick={onNavigateToWebsites}
            >
              Ver Todos os Websites
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* KPI Metrics Cards */}
      <Grid>
        {/* Card 1: Websites */}
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card padding="md" radius="md" withBorder bg="dark.7" h="100%">
            <Group justify="space-between" align="flex-start" mb="xs">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                Websites Cadastrados
              </Text>
              <ThemeIcon color="indigo" variant="light" radius="xl" size="md">
                <IconWorld size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={800} fz={26} lh={1}>
              {metrics.total_websites}
            </Text>
            <Group gap="xs" mt="xs">
              <Badge color="green" variant="light" size="xs" leftSection={<IconPlugConnected size={11} />}>
                {metrics.connected_websites} Conectados
              </Badge>
              {metrics.pending_websites > 0 && (
                <Badge color="gray" variant="outline" size="xs" leftSection={<IconPlugConnectedX size={11} />}>
                  {metrics.pending_websites} Pendentes
                </Badge>
              )}
            </Group>
          </Card>
        </Grid.Col>

        {/* Card 2: Manutenções do Mês */}
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card padding="md" radius="md" withBorder bg="dark.7" h="100%">
            <Group justify="space-between" align="flex-start" mb="xs">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                Manutenções de {data?.year_month_label?.split(' ')[0] || 'Mês'}
              </Text>
              <ThemeIcon color="teal" variant="light" radius="xl" size="md">
                <IconCalendarCheck size={18} />
              </ThemeIcon>
            </Group>
            <Group gap="xs" align="baseline">
              <Text fw={800} fz={26} lh={1} c="teal.4">
                {metrics.completed_count}
              </Text>
              <Text size="sm" c="dimmed">
                de {metrics.total_scheduled} com data
              </Text>
            </Group>
            <Progress
              value={metrics.progress_percent}
              color={metrics.progress_percent === 100 ? 'teal' : 'indigo'}
              size="sm"
              radius="xl"
              mt="xs"
              striped={metrics.progress_percent < 100 && metrics.completed_count > 0}
            />
            <Text size="xs" c="dimmed" mt={4}>
              {metrics.progress_percent}% concluído este mês
            </Text>
          </Card>
        </Grid.Col>

        {/* Card 3: Média de Segurança */}
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card padding="md" radius="md" withBorder bg="dark.7" h="100%">
            <Group justify="space-between" align="flex-start" mb="xs">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                Média de Segurança
              </Text>
              <ThemeIcon color="blue" variant="light" radius="xl" size="md">
                <IconShieldCheck size={18} />
              </ThemeIcon>
            </Group>
            <Group gap="xs" align="center">
              <Text fw={800} fz={26} lh={1} c={getScoreColor(metrics.average_score)}>
                {metrics.average_score !== null ? `${metrics.average_score}` : '—'}
              </Text>
              {metrics.average_score !== null && (
                <Text size="sm" c="dimmed">
                  / 100 pts
                </Text>
              )}
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              {metrics.average_score !== null
                ? 'Baseado na última auditoria de cada site'
                : 'Nenhum site com auditoria realizada'}
            </Text>
          </Card>
        </Grid.Col>

        {/* Card 4: Atenção Imediata */}
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card
            padding="md"
            radius="md"
            withBorder
            bg="dark.7"
            h="100%"
            style={{
              borderColor: metrics.urgent_tasks_count > 0 ? '#fa5252' : undefined,
            }}
          >
            <Group justify="space-between" align="flex-start" mb="xs">
              <Text size="xs" fw={700} c={metrics.urgent_tasks_count > 0 ? 'red.4' : 'dimmed'} tt="uppercase">
                Atenção Imediata
              </Text>
              <ThemeIcon
                color={metrics.urgent_tasks_count > 0 ? 'red' : 'gray'}
                variant={metrics.urgent_tasks_count > 0 ? 'filled' : 'light'}
                radius="xl"
                size="md"
              >
                <IconAlertTriangle size={18} />
              </ThemeIcon>
            </Group>
            <Text
              fw={800}
              fz={26}
              lh={1}
              c={metrics.urgent_tasks_count > 0 ? 'red.4' : 'dimmed'}
            >
              {metrics.urgent_tasks_count}
            </Text>
            <Group gap="xs" mt="xs">
              {metrics.overdue_count > 0 && (
                <Badge color="red" variant="filled" size="xs">
                  {metrics.overdue_count} atrasada{metrics.overdue_count > 1 ? 's' : ''}
                </Badge>
              )}
              {metrics.today_count > 0 && (
                <Badge color="yellow" variant="filled" size="xs">
                  {metrics.today_count} para hoje
                </Badge>
              )}
              {metrics.urgent_tasks_count === 0 && (
                <Text size="xs" c="green.4">
                  Tudo em dia com o cronograma!
                </Text>
              )}
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Main Grid: Left = Maintenance Queue, Right = Security Radar & Scans */}
      <Grid>
        {/* Left Column: Fila de Manutenções do Mês (8 cols) */}
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper p="md" radius="md" withBorder bg="dark.8">
            <Group justify="space-between" mb="md" align="flex-start">
              <div>
                <Group gap="xs" align="center">
                  <ThemeIcon color="teal" variant="light" radius="md">
                    <IconCalendarEvent size={18} />
                  </ThemeIcon>
                  <Title order={4}>Cronograma de Manutenção Preventiva</Title>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  Gerencie a execução mensal nos sites e registre a conclusão com notas do trabalho executado.
                </Text>
              </div>
            </Group>

            {/* Filter Tabs */}
            <Tabs value={activeFilter} onChange={(v) => setActiveFilter(v || 'all')} mb="md">
              <Tabs.List>
                <Tabs.Tab value="all" leftSection={<Text size="xs" fw={700}>({maintenances.length})</Text>}>
                  Todas
                </Tabs.Tab>
                <Tabs.Tab
                  value="overdue"
                  color="red"
                  leftSection={
                    metrics.overdue_count > 0 ? (
                      <Badge color="red" size="xs" circle>
                        {metrics.overdue_count}
                      </Badge>
                    ) : undefined
                  }
                >
                  Atrasadas
                </Tabs.Tab>
                <Tabs.Tab
                  value="today"
                  color="yellow"
                  leftSection={
                    metrics.today_count > 0 ? (
                      <Badge color="yellow" size="xs" circle>
                        {metrics.today_count}
                      </Badge>
                    ) : undefined
                  }
                >
                  Hoje
                </Tabs.Tab>
                <Tabs.Tab value="upcoming">
                  Próximas ({metrics.upcoming_count})
                </Tabs.Tab>
                <Tabs.Tab value="completed" color="green">
                  Concluídas ({metrics.completed_count})
                </Tabs.Tab>
                {metrics.not_scheduled_count > 0 && (
                  <Tabs.Tab value="not_scheduled" color="gray">
                    Sem Dia ({metrics.not_scheduled_count})
                  </Tabs.Tab>
                )}
              </Tabs.List>
            </Tabs>

            {filteredMaintenances.length === 0 ? (
              <Box p="xl" ta="center">
                <Text size="sm" c="dimmed">
                  Nenhuma manutenção encontrada para este filtro no ciclo de {data?.year_month_label}.
                </Text>
              </Box>
            ) : (
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Website</Table.Th>
                    <Table.Th>Dia Previsto</Table.Th>
                    <Table.Th>Status no Mês</Table.Th>
                    <Table.Th>Segurança</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Ações</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredMaintenances.map((task) => {
                    const isCompleted = task.status === 'completed';

                    return (
                      <Table.Tr key={task.website_id}>
                        {/* Website Info */}
                        <Table.Td>
                          <div>
                            <Group gap={6} wrap="nowrap">
                              <Text
                                fw={600}
                                size="sm"
                                c="indigo.3"
                                style={{ cursor: 'pointer' }}
                                onClick={() =>
                                  onSelectWebsite({
                                    id: task.website_id,
                                    name: task.website_name,
                                    url: task.website_url,
                                    environment: task.environment,
                                  })
                                }
                              >
                                {task.website_name}
                              </Text>
                              <Badge
                                size="xs"
                                color={
                                  task.environment === 'production'
                                    ? 'red'
                                    : task.environment === 'staging'
                                    ? 'orange'
                                    : 'teal'
                                }
                                variant="light"
                              >
                                {(task.environment || 'prod').toUpperCase().slice(0, 4)}
                              </Badge>
                            </Group>
                            <Text size="xs" c="dimmed" truncate style={{ maxWidth: 220 }}>
                              {task.website_url}
                            </Text>
                          </div>
                        </Table.Td>

                        {/* Dia Previsto */}
                        <Table.Td>
                          {task.maintenance_day ? (
                            <div>
                              <Text size="sm" fw={600}>
                                Todo dia {task.maintenance_day}
                              </Text>
                              {task.target_date && (
                                <Text size="xs" c="dimmed">
                                  Previsto: {task.target_date.split('-').reverse().join('/')}
                                </Text>
                              )}
                            </div>
                          ) : (
                            <Text size="xs" c="dimmed">
                              Não definido
                            </Text>
                          )}
                        </Table.Td>

                        {/* Status no Mês */}
                        <Table.Td>
                          <div>
                            <Badge
                              color={task.badge_color}
                              variant={isCompleted ? 'filled' : 'light'}
                              size="sm"
                            >
                              {task.label}
                            </Badge>
                            {isCompleted && task.completed_at && (
                              <Group gap={4} mt={3}>
                                <Text size="xs" c="dimmed">
                                  {new Date(task.completed_at).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </Text>
                                {task.completed_by && (
                                  <Text size="xs" c="dimmed">
                                    • {task.completed_by}
                                  </Text>
                                )}
                                {task.notes && (
                                  <Tooltip label={task.notes} multiline w={220}>
                                    <ThemeIcon size="xs" color="gray" variant="subtle">
                                      <IconNotes size={12} />
                                    </ThemeIcon>
                                  </Tooltip>
                                )}
                              </Group>
                            )}
                          </div>
                        </Table.Td>

                        {/* Nota de Segurança */}
                        <Table.Td>
                          {task.latest_score !== null && task.latest_score !== undefined ? (
                            <Badge
                              color={getScoreColor(task.latest_score)}
                              variant="outline"
                              size="sm"
                            >
                              {task.latest_score} pts ({task.latest_grade || 'N/A'})
                            </Badge>
                          ) : (
                            <Text size="xs" c="dimmed">
                              Sem varredura
                            </Text>
                          )}
                        </Table.Td>

                        {/* Ações */}
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Group justify="flex-end" gap={6} wrap="nowrap">
                            {!isCompleted ? (
                              <Button
                                size="xs"
                                color="teal"
                                variant="light"
                                leftSection={<IconCheck size={14} />}
                                onClick={() => handleOpenCompleteModal(task)}
                              >
                                Concluir
                              </Button>
                            ) : (
                              <Tooltip label="Reabrir / Desmarcar conclusão deste mês">
                                <ActionIcon
                                  color="orange"
                                  variant="subtle"
                                  size="sm"
                                  loading={actionLoading}
                                  onClick={() => handleUncomplete(task)}
                                >
                                  <IconRotateClockwise size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}

                            <Tooltip label="Acessar painel do site">
                              <ActionIcon
                                color="indigo"
                                variant="subtle"
                                size="sm"
                                onClick={() =>
                                  onSelectWebsite({
                                    id: task.website_id,
                                    name: task.website_name,
                                    url: task.website_url,
                                    environment: task.environment,
                                  })
                                }
                              >
                                <IconArrowRight size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Grid.Col>

        {/* Right Column: Radar de Segurança & Radar de Integridade (4 cols) */}
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            {/* Card Radar de Segurança */}
            <Paper p="md" radius="md" withBorder bg="dark.8">
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <ThemeIcon color="indigo" variant="light" radius="md">
                    <IconRadar size={18} />
                  </ThemeIcon>
                  <Title order={4}>Radar de Segurança (6 Alvos Críticos)</Title>
                </Group>
                <Badge color="gray" variant="light" size="xs">
                  {securityRadar.length} Sites
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" mb="md">
                Sites com menor nota na auditoria ou sem varredura há mais de 30 dias.
              </Text>

              {securityRadar.length === 0 ? (
                <Text size="xs" c="dimmed" ta="center" py="md">
                  Nenhum site cadastrado ainda.
                </Text>
              ) : (
                <Stack gap="xs">
                  {securityRadar.slice(0, 6).map((item) => (
                    <Paper
                      key={item.website_id}
                      p="xs"
                      radius="sm"
                      bg="dark.7"
                      withBorder
                      style={{
                        cursor: 'pointer',
                        borderColor: item.is_critical
                          ? '#fa5252'
                          : item.is_outdated
                          ? '#fd7e14'
                          : undefined,
                      }}
                      onClick={() =>
                        onSelectWebsite(
                          {
                            id: item.website_id,
                            name: item.website_name,
                            url: item.website_url,
                            environment: item.environment,
                          },
                          'overview'
                        )
                      }
                    >
                      <Group justify="space-between" align="center" wrap="nowrap">
                        <div style={{ overflow: 'hidden' }}>
                          <Group gap={4} wrap="nowrap">
                            <Text size="xs" fw={600} truncate>
                              {item.website_name}
                            </Text>
                            {!item.is_connected && (
                              <Tooltip label="Agente não conectado">
                                <IconPlugConnectedX size={12} color="#fa5252" />
                              </Tooltip>
                            )}
                          </Group>
                          <Group gap={6} mt={2}>
                            {item.is_outdated ? (
                              <Badge
                                size="xs"
                                color={item.days_since_scan !== null ? 'orange' : 'red'}
                                variant="light"
                              >
                                {item.days_since_scan !== null
                                  ? `+${item.days_since_scan}d sem auditoria`
                                  : 'Nunca auditado'}
                              </Badge>
                            ) : (
                              <Text size="10px" c="dimmed">
                                {item.days_since_scan !== null
                                  ? `Auditado há ${item.days_since_scan}d`
                                  : 'Auditado recentemente'}
                              </Text>
                            )}
                          </Group>
                        </div>

                        <div>
                          {item.latest_score !== null && item.latest_score !== undefined ? (
                            <Badge
                              color={getScoreColor(item.latest_score)}
                              variant="filled"
                              size="sm"
                            >
                              {item.latest_score} pts {item.latest_grade ? `(${item.latest_grade})` : ''}
                            </Badge>
                          ) : (
                            <Badge color="gray" variant="light" size="xs">
                              Pendente
                            </Badge>
                          )}
                        </div>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>

            {/* Card Radar de Integridade do Core */}
            <Paper p="md" radius="md" withBorder bg="dark.8">
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <ThemeIcon color="cyan" variant="light" radius="md">
                    <IconShieldCheck size={18} />
                  </ThemeIcon>
                  <Title order={4}>Radar de Integridade (6 Alvos Críticos)</Title>
                </Group>
                <Group gap="xs">
                  <Tooltip label="Sincronizar e salvar integridade de todos os sites conectados na base de dados">
                    <Button
                      size="xs"
                      variant="light"
                      color="cyan"
                      loading={syncingIntegrity}
                      leftSection={<IconRefresh size={14} />}
                      onClick={handleSyncIntegrity}
                    >
                      Sincronizar
                    </Button>
                  </Tooltip>
                  <Badge color="gray" variant="light" size="xs">
                    {integrityRadar.length} Sites
                  </Badge>
                </Group>
              </Group>
              <Text size="xs" c="dimmed" mb="md">
                Arquivos modificados do WordPress core ou sem verificação há mais de 30 dias.
              </Text>

              {integrityRadar.length === 0 ? (
                <Text size="xs" c="dimmed" ta="center" py="md">
                  Nenhum site cadastrado ainda.
                </Text>
              ) : (
                <Stack gap="xs">
                  {integrityRadar.slice(0, 6).map((item) => {
                    const hasIssues = item.issues_count !== null && item.issues_count !== undefined && item.issues_count > 0;
                    return (
                      <Paper
                        key={item.website_id}
                        p="xs"
                        radius="sm"
                        bg="dark.7"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          borderColor: hasIssues
                            ? '#fa5252'
                            : item.is_outdated
                            ? '#fd7e14'
                            : undefined,
                        }}
                        onClick={() =>
                          onSelectWebsite(
                            {
                              id: item.website_id,
                              name: item.website_name,
                              url: item.website_url,
                              environment: item.environment,
                            },
                            'integrity'
                          )
                        }
                      >
                        <Group justify="space-between" align="center" wrap="nowrap">
                          <div style={{ overflow: 'hidden' }}>
                            <Group gap={4} wrap="nowrap">
                              <Text size="xs" fw={600} truncate>
                                {item.website_name}
                              </Text>
                              {!item.is_connected && (
                                <Tooltip label="Agente não conectado">
                                  <IconPlugConnectedX size={12} color="#fa5252" />
                                </Tooltip>
                              )}
                            </Group>

                            {/* Métricas da varredura salvas na base de dados */}
                            {item.total_checked !== null && item.total_checked !== undefined ? (
                              <Group gap={4} mt={3} wrap="wrap">
                                <Badge size="xs" variant="outline" color="gray">
                                  {item.total_checked} verif.
                                </Badge>
                                <Badge size="xs" variant="light" color="green">
                                  {item.passed} íntegros
                                </Badge>
                                {(item.issues_count ?? 0) > 0 && (
                                  <Badge size="xs" variant="filled" color="red">
                                    {item.issues_count} pend.
                                  </Badge>
                                )}
                                {(item.ignored_issues ?? 0) > 0 && (
                                  <Badge size="xs" variant="light" color="teal">
                                    {item.ignored_issues} resolv.
                                  </Badge>
                                )}
                                {(item.modified ?? 0) > 0 && (
                                  <Badge size="xs" variant="light" color="red">
                                    {item.modified} modif.
                                  </Badge>
                                )}
                                {(item.suspicious ?? 0) > 0 && (
                                  <Badge size="xs" variant="light" color="orange">
                                    {item.suspicious} susp.
                                  </Badge>
                                )}
                              </Group>
                            ) : null}

                            <Group gap={6} mt={2}>
                              {item.is_outdated ? (
                                <Badge
                                  size="xs"
                                  color={item.days_since_scan !== null ? 'orange' : 'red'}
                                  variant="light"
                                >
                                  {item.days_since_scan !== null
                                    ? `+${item.days_since_scan}d sem checagem`
                                    : 'Nunca verificado'}
                                </Badge>
                              ) : (
                                <Text size="10px" c="dimmed">
                                  {item.days_since_scan !== null
                                    ? `Verificado há ${item.days_since_scan}d`
                                    : 'Verificado recentemente'}
                                </Text>
                              )}
                            </Group>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            {hasIssues ? (
                              <Badge color="red" variant="filled" size="sm">
                                {item.issues_count} {item.issues_count === 1 ? 'erro' : 'erros'}
                              </Badge>
                            ) : item.last_scanned_at && !item.is_outdated ? (
                              <Badge color="teal" variant="light" size="sm">
                                100% Íntegro
                              </Badge>
                            ) : (
                              <Badge color="gray" variant="light" size="xs">
                                Pendente
                              </Badge>
                            )}
                          </div>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>

      {/* Modal de Conclusão da Manutenção */}
      <Modal
        opened={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="teal" size="sm" radius="xl">
              <IconCheck size={14} />
            </ThemeIcon>
            <Text fw={700} size="sm">
              Concluir Manutenção Mensal
            </Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          {taskToComplete && (
            <Paper p="xs" bg="dark.7" radius="sm" withBorder>
              <Text size="xs" fw={700}>
                {taskToComplete.website_name}
              </Text>
              <Text size="xs" c="dimmed">
                {taskToComplete.website_url}
              </Text>
              {taskToComplete.maintenance_day && (
                <Group gap="xs" mt={4}>
                  <Badge size="xs" color="gray" variant="outline">
                    Dia programado: {taskToComplete.maintenance_day}
                  </Badge>
                </Group>
              )}
            </Paper>
          )}

          <Select
            label="Mês de Referência da Manutenção"
            description="Selecione o ciclo/mês em que esta manutenção foi realizada"
            data={maintenanceMonthOptions}
            value={selectedMaintenanceMonth}
            onChange={(val) => val && setSelectedMaintenanceMonth(val)}
            allowDeselect={false}
          />

          <Textarea
            label="Notas do que foi realizado (opcional)"
            description="Ex: Plugins WooCommerce e Elementor atualizados, backup realizado e testes de checkout efetuados."
            placeholder="Descreva observações relevantes sobre esta manutenção..."
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setCompleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="teal"
              leftSection={<IconCheck size={16} />}
              loading={actionLoading}
              onClick={handleConfirmComplete}
            >
              Registrar Conclusão
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
