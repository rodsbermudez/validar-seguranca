import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Badge,
  Group,
  Stack,
  SegmentedControl,
  Select,
  TextInput,
  Button,
  Card,
  Box,
  Loader,
  Center,
  Alert,
  ThemeIcon,
  Divider,
  Anchor,
} from '@mantine/core';
import {
  IconSearch,
  IconRefresh,
  IconCalendarCheck,
  IconNote,
  IconClock,
  IconUser,
  IconShield,
  IconServer,
  IconBug,
  IconPalette,
  IconSparkles,
  IconInfoCircle,
  IconWorld,
  IconArrowLeft,
} from '@tabler/icons-react';
import { getPublicActivityLogs, ActivityLogItem } from '../api';
import { RichNoteContent } from './RichNoteContent';
import { formatDateTime } from '../utils/date';

interface PublicActivityLogsViewProps {
  shareToken: string;
  onExit?: () => void;
  isLoggedIn?: boolean;
}

export const PublicActivityLogsView: React.FC<PublicActivityLogsViewProps> = ({
  shareToken,
  onExit,
  isLoggedIn,
}) => {
  const [website, setWebsite] = useState<{
    name: string;
    url: string;
    environment: string;
  } | null>(null);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [typeFilter, setTypeFilter] = useState<'all' | 'maintenance' | 'note'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPublicLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPublicActivityLogs(shareToken);
      if (res && res.data) {
        setWebsite(res.data.website);
        setActivities(res.data.activities || []);
      } else {
        setError('Não foi possível obter os logs de atividades deste link.');
      }
    } catch (err: any) {
      console.error('Erro ao carregar logs públicos:', err);
      setError(
        err.response?.data?.messages?.error ||
          err.response?.data?.error ||
          'Este link de visualização é inválido ou foi revogado.'
      );
    } finally {
      setLoading(false);
    }
  }, [shareToken]);

  useEffect(() => {
    fetchPublicLogs();
  }, [fetchPublicLogs]);

  // Helper de categoria
  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'seguranca':
        return { label: 'Segurança', color: 'red', icon: <IconShield size={12} /> };
      case 'otimizacao':
        return { label: 'Otimização', color: 'teal', icon: <IconSparkles size={12} /> };
      case 'servidor':
        return { label: 'Servidor', color: 'orange', icon: <IconServer size={12} /> };
      case 'bugfix':
        return { label: 'Correção de Bug', color: 'grape', icon: <IconBug size={12} /> };
      case 'layout':
        return { label: 'Ajustes de Layout', color: 'cyan', icon: <IconPalette size={12} /> };
      case 'manutencao':
        return { label: 'Manutenção Mensal', color: 'blue', icon: <IconCalendarCheck size={12} /> };
      default:
        return { label: 'Geral', color: 'gray', icon: <IconNote size={12} /> };
    }
  };

  const formatDate = (dateStr: string) => {
    return formatDateTime(dateStr, '-');
  };

  // Filtragem dos registros
  const filteredActivities = activities.filter((item) => {
    if (typeFilter !== 'all' && item.item_type !== typeFilter) {
      return false;
    }

    if (categoryFilter !== 'all' && item.category !== categoryFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(query);
      const matchContent = item.content?.toLowerCase().includes(query);
      const matchUser = item.user_name?.toLowerCase().includes(query);
      if (!matchTitle && !matchContent && !matchUser) {
        return false;
      }
    }

    return true;
  });

  return (
    <Box bg="dark.9" style={{ minHeight: '100vh' }}>
      {/* Cabeçalho Minimalista: Somente a Logo da Patropi */}
      <Box
        component="header"
        bg="dark.8"
        py="md"
        px="lg"
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Container size="lg">
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <img
                src="images/logo-sitehub.svg"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (target.dataset.tried === '1') {
                    target.src = '/images/logo-sitehub.svg';
                    target.dataset.tried = '2';
                  } else {
                    target.dataset.tried = '1';
                    target.src = './images/logo-sitehub.svg';
                  }
                }}
                alt="SiteHub"
                style={{ height: 38, width: 'auto', display: 'block' }}
              />
            </Group>

            {isLoggedIn && onExit && (
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={<IconArrowLeft size={14} />}
                onClick={onExit}
              >
                Voltar ao Painel
              </Button>
            )}
          </Group>
        </Container>
      </Box>

      {/* Conteúdo Principal */}
      <Container size="lg" py="xl">
        {loading ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <Loader size="lg" color="indigo" />
              <Text size="sm" c="dimmed">
                Carregando diário de atividades...
              </Text>
            </Stack>
          </Center>
        ) : error ? (
          <Alert color="red" title="Acesso não disponível" icon={<IconInfoCircle size={20} />} radius="md">
            {error}
          </Alert>
        ) : (
          <Stack gap="lg">
            {/* Top Banner com Info do Site e Filtros */}
            <Paper p="lg" radius="md" bg="dark.8" withBorder style={{ borderLeft: '4px solid #1A7F86' }}>
              <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
                <div>
                  <Group gap="xs" align="center">
                    <Title order={2} c="white">
                      {website?.name || 'Website'}
                    </Title>
                    {website?.environment && (
                      <Badge
                        color={website.environment === 'production' ? 'amaranth' : 'emerald'}
                        variant="light"
                        size="sm"
                      >
                        {website.environment.toUpperCase()}
                      </Badge>
                    )}
                  </Group>

                  {website?.url && (
                    <Anchor
                      href={website.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      c="oceanBlue.4"
                      mt={4}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <IconWorld size={14} />
                      {website.url}
                    </Anchor>
                  )}

                  <Title order={4} mt="md" fw={600} c="gray.2">
                    Logs de Atividades & Diário Técnico
                  </Title>
                  <Text size="xs" c="dimmed" mt={2}>
                    Relatório transparente de manutenções preventivas, intervenções técnicas e melhorias executadas neste website.
                  </Text>
                </div>

                <Group gap="xs">
                  <Badge color="sitehub" variant="light" size="lg">
                    {activities.length} {activities.length === 1 ? 'registro' : 'registros'}
                  </Badge>
                  <Button
                    variant="light"
                    color="gray"
                    size="xs"
                    leftSection={<IconRefresh size={14} />}
                    loading={loading}
                    onClick={fetchPublicLogs}
                  >
                    Atualizar
                  </Button>
                </Group>
              </Group>

              <Divider my="md" color="dark.6" />

              {/* Filtros e Busca */}
              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <Group gap="xs" wrap="wrap">
                  <SegmentedControl
                    size="xs"
                    value={typeFilter}
                    onChange={(val) => setTypeFilter(val as any)}
                    data={[
                      { label: 'Todas as Atividades', value: 'all' },
                      { label: '🗓️ Manutenções Mensais', value: 'maintenance' },
                      { label: '📝 Notas Técnicas', value: 'note' },
                    ]}
                  />

                  <Select
                    size="xs"
                    value={categoryFilter}
                    onChange={(val) => setCategoryFilter(val || 'all')}
                    data={[
                      { label: 'Todas as Categorias', value: 'all' },
                      { label: 'Geral', value: 'geral' },
                      { label: 'Segurança', value: 'seguranca' },
                      { label: 'Otimização', value: 'otimizacao' },
                      { label: 'Servidor', value: 'servidor' },
                      { label: 'Correção de Bug', value: 'bugfix' },
                      { label: 'Ajustes de Layout', value: 'layout' },
                    ]}
                    style={{ width: 180 }}
                  />
                </Group>

                <TextInput
                  size="xs"
                  placeholder="Buscar por texto ou título..."
                  leftSection={<IconSearch size={14} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  style={{ minWidth: 260 }}
                />
              </Group>
            </Paper>

            {/* Timeline dos Registros */}
            {filteredActivities.length === 0 ? (
              <Paper p="xl" radius="md" bg="dark.8" withBorder style={{ textAlign: 'center' }}>
                <ThemeIcon size={54} radius="xl" color="gray" variant="light" mx="auto" mb="sm">
                  <IconNote size={30} />
                </ThemeIcon>
                <Title order={4} mb="xs">
                  Nenhuma atividade encontrada
                </Title>
                <Text size="sm" c="dimmed" maw={480} mx="auto">
                  {searchQuery || typeFilter !== 'all' || categoryFilter !== 'all'
                    ? 'Nenhum registro corresponde aos filtros selecionados. Tente limpar os filtros.'
                    : 'Nenhuma anotação técnica ou manutenção mensal registrada para este website até o momento.'}
                </Text>
              </Paper>
            ) : (
              <Stack gap="md">
                {filteredActivities.map((item) => {
                  const isMaintenance = item.item_type === 'maintenance';
                  const catMeta = getCategoryMeta(item.category);

                  return (
                    <Card
                      key={item.id}
                      p="md"
                      radius="md"
                      bg="dark.8"
                      withBorder
                      style={{
                        borderLeft: isMaintenance
                          ? '4px solid #118ab2'
                          : `4px solid ${
                              catMeta.color === 'red'
                                ? '#d1495b'
                                : catMeta.color === 'teal'
                                ? '#06d6a0'
                                : catMeta.color === 'orange'
                                ? '#edae49'
                                : catMeta.color === 'grape'
                                ? '#ef476f'
                                : catMeta.color === 'cyan'
                                ? '#00798c'
                                : '#1A7F86'
                            }`,
                      }}
                    >
                      <Group justify="space-between" align="flex-start" wrap="nowrap" mb="xs">
                        <Stack gap={4}>
                          <Group gap="xs" wrap="wrap" align="center">
                            {isMaintenance ? (
                              <Badge
                                color="oceanBlue"
                                variant="filled"
                                size="sm"
                                leftSection={<IconCalendarCheck size={12} />}
                              >
                                MANUTENÇÃO MENSAL
                              </Badge>
                            ) : (
                              <>
                                <Badge
                                  color="sitehub"
                                  variant="light"
                                  size="sm"
                                  leftSection={<IconNote size={12} />}
                                >
                                  NOTA TÉCNICA
                                </Badge>
                                <Badge
                                  color={catMeta.color}
                                  variant="light"
                                  size="sm"
                                  leftSection={catMeta.icon}
                                >
                                  {catMeta.label}
                                </Badge>
                              </>
                            )}

                            <Group gap={4} align="center" style={{ color: '#909296' }}>
                              <IconClock size={13} />
                              <Text size="xs" c="dimmed">
                                {formatDate(item.action_date)}
                              </Text>
                            </Group>
                          </Group>

                          <Title order={4} c="white">
                            {item.title}
                          </Title>
                        </Stack>
                      </Group>

                      {/* Conteúdo Rico com links e blocos de código */}
                      <Box mt="xs" mb="sm" p="xs" bg="dark.9" style={{ borderRadius: 6 }}>
                        <RichNoteContent content={item.content} />
                      </Box>

                      {/* Rodapé com Responsável / Autor */}
                      <Group justify="flex-start" align="center" gap="xs">
                        <IconUser size={13} color="#909296" />
                        <Text size="xs" c="dimmed">
                          Executado por:{' '}
                          <Text component="span" c="gray.3" fw={500}>
                            {item.user_name || 'Equipe Técnica'}
                          </Text>
                        </Text>
                      </Group>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Stack>
        )}
      </Container>
    </Box>
  );
};
