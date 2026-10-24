import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Title,
  Text,
  Button,
  Group,
  Badge,
  Stack,
  TextInput,
  Select,
  Textarea,
  Modal,
  ActionIcon,
  Tooltip,
  Loader,
  Center,
  Card,
  Alert,
  SegmentedControl,
  Divider,
  Box,
  ThemeIcon,
} from '@mantine/core';
import {
  IconPlus,
  IconRefresh,
  IconSearch,
  IconCalendarCheck,
  IconNote,
  IconCode,
  IconLink,
  IconList,
  IconEdit,
  IconTrash,
  IconClock,
  IconUser,
  IconShield,
  IconServer,
  IconBug,
  IconPalette,
  IconSparkles,
  IconInfoCircle,
  IconShare,
  IconCopy,
  IconCheck,
  IconExternalLink,
} from '@tabler/icons-react';
import {
  Website,
  ActivityLogItem,
  getWebsiteActivityLogs,
  createWebsiteNote,
  updateWebsiteNote,
  deleteWebsiteNote,
  getPublicLogToken,
  regeneratePublicLogToken,
} from '../api';
import { RichNoteContent } from './RichNoteContent';
import { formatDateTime } from '../utils/date';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

interface WebsiteActivityLogsViewProps {
  website: Website;
  onOpenHelp?: () => void;
}

export const WebsiteActivityLogsView: React.FC<WebsiteActivityLogsViewProps> = ({ website, onOpenHelp }) => {
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [typeFilter, setTypeFilter] = useState<'all' | 'maintenance' | 'note'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal de Compartilhamento com o Cliente
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string>('');
  const [shareLoading, setShareLoading] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [regeneratingToken, setRegeneratingToken] = useState(false);

  // Modal de Criação / Edição
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('geral');
  const [actionDate, setActionDate] = useState('');
  const [content, setContent] = useState('');
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWebsiteActivityLogs(website.id);
      setActivities(res.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar logs de atividades:', err);
      setError('Não foi possível carregar as atividades deste site.');
    } finally {
      setLoading(false);
    }
  }, [website.id]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useRealtimeSync({
    onSync: fetchActivities,
    interval: 20000,
    revalidateOnFocus: true,
    enabled: true,
  });

  const handleOpenShareModal = async () => {
    setShareModalOpen(true);
    setShareLoading(true);
    try {
      const res = await getPublicLogToken(website.id);
      if (res && res.data) {
        setShareToken(res.data.token);
      }
    } catch (e) {
      console.error('Erro ao buscar token de compartilhamento:', e);
    } finally {
      setShareLoading(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!confirm('Deseja realmente gerar um novo link? O link anterior deixará de funcionar imediatamente.')) {
      return;
    }
    setRegeneratingToken(true);
    try {
      const res = await regeneratePublicLogToken(website.id);
      if (res && res.data) {
        setShareToken(res.data.token);
      }
    } catch (e) {
      alert('Erro ao regenerar link.');
    } finally {
      setRegeneratingToken(false);
    }
  };

  const getFullShareUrl = () => {
    if (!shareToken) return '';
    return `${window.location.origin}/?share_log=${shareToken}`;
  };

  const handleCopyShareLink = () => {
    const url = getFullShareUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2500);
    }
  };

  // Abrir Modal de Criação
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingNoteId(null);
    setTitle('');
    setCategory('geral');
    // Data/hora local formatada para datetime-local (YYYY-MM-DDTHH:mm)
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setActionDate(localIso);
    setContent('');
    setPreviewTab('edit');
    setFormError(null);
    setModalOpen(true);
  };

  // Abrir Modal de Edição
  const handleOpenEditModal = (item: ActivityLogItem) => {
    if (!item.note_id) return;
    setModalMode('edit');
    setEditingNoteId(item.note_id);
    setTitle(item.title === 'Observação Técnica' ? '' : item.title);
    setCategory(item.category || 'geral');

    let formattedDate = '';
    if (item.action_date) {
      const d = new Date(item.action_date);
      if (!isNaN(d.getTime())) {
        formattedDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      }
    }
    setActionDate(formattedDate || '');
    setContent(item.content || '');
    setPreviewTab('edit');
    setFormError(null);
    setModalOpen(true);
  };

  // Helpers de inserção rápida no textarea
  const insertSnippet = (prefix: string, placeholder: string, suffix: string) => {
    setContent((prev) => {
      const snippet = `${prefix}${placeholder}${suffix}`;
      return prev ? `${prev}\n\n${snippet}` : snippet;
    });
  };

  // Salvar nota (Criação ou Edição)
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setFormError('Por favor, informe o conteúdo da anotação.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      title: title.trim() || undefined,
      category,
      content: content.trim(),
      action_date: actionDate ? actionDate.replace('T', ' ') + ':00' : undefined,
    };

    try {
      if (modalMode === 'create') {
        await createWebsiteNote(website.id, payload);
      } else if (modalMode === 'edit' && editingNoteId) {
        await updateWebsiteNote(website.id, editingNoteId, payload);
      }
      setModalOpen(false);
      fetchActivities();
    } catch (err: any) {
      setFormError(
        err.response?.data?.messages?.error ||
          err.response?.data?.error ||
          'Erro ao salvar anotação.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Excluir nota
  const handleDeleteNote = async (item: ActivityLogItem) => {
    if (!item.note_id) return;
    if (!confirm(`Deseja realmente excluir a anotação "${item.title}"?`)) return;

    try {
      await deleteWebsiteNote(website.id, item.note_id);
      fetchActivities();
    } catch (err: any) {
      alert('Erro ao excluir anotação.');
    }
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

  return (
    <Stack gap="lg">
      {/* Top Banner da Seção */}
      <Paper p="lg" radius="md" bg="dark.8" withBorder>
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <div>
            <Group gap="xs" align="center">
              <Title order={3}>Logs de Atividades & Diário Técnico</Title>
              <Badge color="indigo" variant="light" size="md">
                {activities.length} {activities.length === 1 ? 'registro' : 'registros'}
              </Badge>
              {onOpenHelp && (
                <Tooltip label="Como funciona esta tela?">
                  <ActionIcon variant="subtle" color="indigo" size="sm" onClick={onOpenHelp}>
                    <IconInfoCircle size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              Acompanhe o histórico unificado das manutenções mensais e registre notas técnicas,
              comandos e ações realizadas neste website.
            </Text>
          </div>

          <Group gap="sm">
            <Button
              variant="light"
              color="gray"
              size="sm"
              leftSection={<IconRefresh size={16} />}
              loading={loading}
              onClick={fetchActivities}
            >
              Atualizar
            </Button>
            <Button
              variant="light"
              color="teal"
              size="sm"
              leftSection={<IconShare size={16} />}
              onClick={handleOpenShareModal}
            >
              Link para Cliente
            </Button>
            <Button
              variant="filled"
              color="indigo"
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={handleOpenCreateModal}
            >
              Nova Anotação / Registro
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
            placeholder="Buscar por texto, autor ou título..."
            leftSection={<IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ minWidth: 260 }}
          />
        </Group>
      </Paper>

      {/* Conteúdo Principal / Timeline */}
      {loading && activities.length === 0 ? (
        <Center py="xl">
          <Loader size="lg" color="indigo" />
        </Center>
      ) : error ? (
        <Alert color="red" title="Erro" icon={<IconInfoCircle size={18} />}>
          {error}
        </Alert>
      ) : filteredActivities.length === 0 ? (
        <Paper p="xl" radius="md" bg="dark.8" withBorder style={{ textAlign: 'center' }}>
          <ThemeIcon size={54} radius="xl" color="gray" variant="light" mx="auto" mb="sm">
            <IconNote size={30} />
          </ThemeIcon>
          <Title order={4} mb="xs">
            Nenhuma atividade encontrada
          </Title>
          <Text size="sm" c="dimmed" maw={480} mx="auto" mb="md">
            {searchQuery || typeFilter !== 'all' || categoryFilter !== 'all'
              ? 'Nenhum registro corresponde aos filtros selecionados. Tente limpar os filtros.'
              : 'Nenhuma anotação técnica ou manutenção mensal registrada para este website até o momento.'}
          </Text>
          <Button
            size="xs"
            variant="light"
            color="indigo"
            leftSection={<IconPlus size={14} />}
            onClick={handleOpenCreateModal}
          >
            Cadastrar Primeira Anotação
          </Button>
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
                          color="cyan"
                          variant="filled"
                          size="sm"
                          leftSection={<IconCalendarCheck size={12} />}
                        >
                          MANUTENÇÃO MENSAL
                        </Badge>
                      ) : (
                        <>
                          <Badge
                            color="indigo"
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

                  <Group gap="xs" wrap="nowrap">
                    {!isMaintenance && (
                      <>
                        <Tooltip label="Editar anotação">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={() => handleOpenEditModal(item)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Excluir anotação">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => handleDeleteNote(item)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                  </Group>
                </Group>

                {/* Conteúdo Rico com links e blocos de código */}
                <Box mt="xs" mb="sm" p="xs" bg="dark.9" style={{ borderRadius: 6 }}>
                  <RichNoteContent content={item.content} />
                </Box>

                {/* Rodapé com Responsável / Autor */}
                <Group justify="flex-start" align="center" gap="xs">
                  <IconUser size={13} color="#909296" />
                  <Text size="xs" c="dimmed">
                    Registrado por:{' '}
                    <Text component="span" c="gray.3" fw={500}>
                      {item.user_name || 'Usuário'}
                    </Text>{' '}
                    {item.user_email && (
                      <Text component="span" c="dimmed">
                        ({item.user_email})
                      </Text>
                    )}
                  </Text>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Modal de Criação / Edição de Nota */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          <Group gap="xs">
            <IconNote size={20} color="#4c6ef5" />
            <Text fw={600} size="md">
              {modalMode === 'create'
                ? 'Cadastrar Anotação / Registro Técnico'
                : 'Editar Anotação Técnica'}
            </Text>
          </Group>
        }
        size="lg"
        centered
      >
        <form onSubmit={handleSaveNote}>
          <Stack gap="md">
            {formError && (
              <Alert color="red" title="Erro" icon={<IconInfoCircle size={16} />}>
                {formError}
              </Alert>
            )}

            <TextInput
              label="Título ou Assunto (Opcional)"
              placeholder="Ex: Refeita configuração do Nginx / Atualização manual de plugin"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />

            <Group grow>
              <Select
                label="Categoria da Ação"
                value={category}
                onChange={(val) => setCategory(val || 'geral')}
                data={[
                  { label: 'Geral', value: 'geral' },
                  { label: 'Segurança', value: 'seguranca' },
                  { label: 'Otimização', value: 'otimizacao' },
                  { label: 'Configuração de Servidor', value: 'servidor' },
                  { label: 'Correção de Bug', value: 'bugfix' },
                  { label: 'Ajustes de Layout', value: 'layout' },
                ]}
                required
              />

              <TextInput
                label="Data da Ação"
                type="datetime-local"
                value={actionDate}
                onChange={(e) => setActionDate(e.currentTarget.value)}
                description="Momento em que a intervenção foi realizada"
              />
            </Group>

            <div>
              <Group justify="space-between" align="center" mb={6}>
                <Text size="sm" fw={500}>
                  Descrição Detalhada da Ação *
                </Text>

                <Group gap={6}>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="gray"
                    leftSection={<IconLink size={12} />}
                    onClick={() => insertSnippet('[Nome do Link](', 'https://exemplo.com', ')')}
                  >
                    + Link
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="gray"
                    leftSection={<IconCode size={12} />}
                    onClick={() =>
                      insertSnippet('```bash\n', '# seu comando ou código aqui\n', '```')
                    }
                  >
                    + Código
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="gray"
                    leftSection={<IconList size={12} />}
                    onClick={() => insertSnippet('- ', 'item da lista', '')}
                  >
                    + Lista
                  </Button>
                </Group>
              </Group>

              <SegmentedControl
                size="xs"
                value={previewTab}
                onChange={(v) => setPreviewTab(v as any)}
                data={[
                  { label: 'Editar', value: 'edit' },
                  { label: 'Pré-visualização', value: 'preview' },
                ]}
                mb="xs"
              />

              {previewTab === 'edit' ? (
                <Textarea
                  placeholder="Descreva as modificações efetuadas. Você pode incluir links diretos, blocos de comandos em ```bash ... ``` e explicações detalhadas."
                  minRows={6}
                  autosize
                  maxRows={14}
                  value={content}
                  onChange={(e) => setContent(e.currentTarget.value)}
                  required
                />
              ) : (
                <Box
                  p="md"
                  bg="dark.9"
                  style={{
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.1)',
                    minHeight: 140,
                  }}
                >
                  {content.trim() ? (
                    <RichNoteContent content={content} />
                  ) : (
                    <Text size="sm" c="dimmed">
                      Nenhum conteúdo digitado para pré-visualização.
                    </Text>
                  )}
                </Box>
              )}
            </div>

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" color="gray" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" color="indigo" loading={saving}>
                {modalMode === 'create' ? 'Salvar Anotação' : 'Atualizar Anotação'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal de Compartilhamento com o Cliente */}
      <Modal
        opened={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={
          <Group gap="xs">
            <IconShare size={20} color="#20c997" />
            <Text fw={600} size="md">
              Link de Visualização para o Cliente
            </Text>
          </Group>
        }
        size="md"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Envie este link para seu cliente acompanhar o diário de atividades e as manutenções deste site. O cliente verá apenas o logo da Vexors no topo e poderá pesquisar e filtrar os registros, sem permissão para editar ou cadastrar novas entradas.
          </Text>

          {shareLoading ? (
            <Center py="md">
              <Loader size="sm" color="teal" />
            </Center>
          ) : (
            <>
              <TextInput
                label="Link de Acesso do Cliente"
                readOnly
                value={getFullShareUrl()}
                rightSection={
                  <Tooltip label={copiedShareLink ? 'Copiado!' : 'Copiar Link'}>
                    <ActionIcon
                      variant="subtle"
                      color={copiedShareLink ? 'teal' : 'gray'}
                      onClick={handleCopyShareLink}
                    >
                      {copiedShareLink ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                }
              />

              <Group justify="space-between" align="center" mt="xs">
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  loading={regeneratingToken}
                  onClick={handleRegenerateToken}
                >
                  Revogar e Gerar Novo Link
                </Button>

                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    color="gray"
                    leftSection={<IconExternalLink size={14} />}
                    component="a"
                    href={getFullShareUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Testar Visualização
                  </Button>
                  <Button
                    size="xs"
                    color="teal"
                    leftSection={copiedShareLink ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    onClick={handleCopyShareLink}
                  >
                    {copiedShareLink ? 'Link Copiado!' : 'Copiar Link'}
                  </Button>
                </Group>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
};
