import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Group,
  Title,
  Text,
  Badge,
  Button,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  SegmentedControl,
  Loader,
  Alert,
  Tooltip,
  Code,
} from '@mantine/core';
import {
  IconEdit,
  IconSparkles,
  IconRefresh,
  IconCheck,
  IconAlertCircle,
  IconBook,
  IconPlug,
  IconServer,
  IconUserCheck,
} from '@tabler/icons-react';
import { api } from '../api';

export function SolutionCatalogView() {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [editModalOpened, setEditModalOpened] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [aiRefining, setAiRefining] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await api.get('/solutions');
      setSolutions(res.data.data || []);
    } catch (err: any) {
      setErrorMsg('Falha ao carregar o catálogo de soluções.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleEditClick = (item: any) => {
    setEditingItem({ ...item });
    setSuccessMsg(null);
    setErrorMsg(null);
    setEditModalOpened(true);
  };

  const handleSave = async () => {
    if (!editingItem) return;
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await api.put(`/solutions/${editingItem.id}`, editingItem);
      setSuccessMsg('Solução atualizada com sucesso no catálogo!');
      setTimeout(() => {
        setEditModalOpened(false);
        fetchCatalog();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.messages?.error || 'Erro ao atualizar solução.');
    } finally {
      setSaving(false);
    }
  };

  const handleAiRefine = async () => {
    if (!editingItem) return;
    setAiRefining(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await api.post('/solutions/generate-single', {
        check_id: editingItem.check_id,
        check_name: editingItem.check_name,
        details: editingItem.problem_description || '',
        severity: 'medium',
      });

      const updated = res.data.data;
      setEditingItem(updated);
      setSuccessMsg('Solução refatorada com sucesso pela IA Kimi K2.7 Code!');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.messages?.error || 'Falha na refatoração com IA.');
    } finally {
      setAiRefining(false);
    }
  };

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'PLUGIN_AUTO_FIX':
        return (
          <Badge color="cyan" variant="filled" leftSection={<IconPlug size={12} />}>
            ⚡ Correção via Plugin
          </Badge>
        );
      case 'SERVER_CONFIG':
        return (
          <Badge color="orange" variant="filled" leftSection={<IconServer size={12} />}>
            🖥️ Configuração de Servidor
          </Badge>
        );
      case 'MANUAL_ACTION':
        return (
          <Badge color="gray" variant="filled" leftSection={<IconUserCheck size={12} />}>
            👤 Ação Manual
          </Badge>
        );
      default:
        return <Badge color="blue">{type}</Badge>;
    }
  };

  const filteredSolutions = solutions.filter((item) => {
    const matchesFilter = filterAction === 'ALL' || item.action_type === filterAction;
    const matchesQuery =
      searchQuery === '' ||
      item.check_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.check_name && item.check_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.solution_title && item.solution_title.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesQuery;
  });

  return (
    <div>
      <Card radius="lg" p="xl" bg="dark.8" style={{ border: '1px solid #2C2E33' }}>
        <Group justify="space-between" mb="lg">
          <div>
            <Group gap="xs">
              <IconBook size={24} style={{ color: '#4C6EF5' }} />
              <Title order={3} fw={700}>
                Catálogo Central de Soluções (Base de Conhecimento)
              </Title>
            </Group>
            <Text size="sm" c="dimmed">
              Gerencie a base de conhecimento de vulnerabilidades e soluções utilizadas na geração de plugins e orientações de auditoria.
            </Text>
          </div>
          <Button variant="light" color="indigo" leftSection={<IconRefresh size={16} />} onClick={fetchCatalog} loading={loading}>
            Atualizar Lista
          </Button>
        </Group>

        <Group justify="space-between" mb="md">
          <SegmentedControl
            value={filterAction}
            onChange={setFilterAction}
            data={[
              { label: 'Todas as Soluções', value: 'ALL' },
              { label: '⚡ Plugins', value: 'PLUGIN_AUTO_FIX' },
              { label: '🖥️ Servidor', value: 'SERVER_CONFIG' },
              { label: '👤 Manuais', value: 'MANUAL_ACTION' },
            ]}
          />
          <TextInput
            placeholder="Pesquisar por nome, ID ou título..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ width: 300 }}
          />
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader color="indigo" />
          </Group>
        ) : filteredSolutions.length === 0 ? (
          <Alert color="blue" icon={<IconAlertCircle size={16} />} my="lg">
            Nenhuma solução catalogada encontrada para os filtros selecionados.
          </Alert>
        ) : (
          <Table highlightOnHover verticalSpacing="sm" border={1}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID do Teste</Table.Th>
                <Table.Th>Nome do Teste</Table.Th>
                <Table.Th>Tipo de Ação</Table.Th>
                <Table.Th>Título da Solução</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredSolutions.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Code color="indigo">{item.check_id}</Code>
                  </Table.Td>
                  <Table.Td fw={600}>{item.check_name}</Table.Td>
                  <Table.Td>{getActionBadge(item.action_type)}</Table.Td>
                  <Table.Td>{item.solution_title || <Text c="dimmed" fs="italic">Pendente de geração</Text>}</Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Tooltip label="Editar Solução / Refinar com IA">
                      <ActionIcon color="indigo" variant="light" onClick={() => handleEditClick(item)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        opened={editModalOpened}
        onClose={() => setEditModalOpened(false)}
        title={
          <Group gap="xs">
            <IconBook size={20} color="#4C6EF5" />
            <Text fw={700}>Editar Solução: {editingItem?.check_name}</Text>
          </Group>
        }
        size="lg"
        radius="md"
      >
        {editingItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {successMsg && (
              <Alert color="green" icon={<IconCheck size={16} />}>
                {successMsg}
              </Alert>
            )}
            {errorMsg && (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {errorMsg}
              </Alert>
            )}

            <Group grow>
              <TextInput label="ID do Teste" value={editingItem.check_id} disabled />
              <Select
                label="Tipo de Ação (Triagem)"
                value={editingItem.action_type}
                onChange={(val) => setEditingItem({ ...editingItem, action_type: val })}
                data={[
                  { value: 'PLUGIN_AUTO_FIX', label: '⚡ PLUGIN_AUTO_FIX (Correção via Plugin)' },
                  { value: 'SERVER_CONFIG', label: '🖥️ SERVER_CONFIG (Configuração de Servidor)' },
                  { value: 'MANUAL_ACTION', label: '👤 MANUAL_ACTION (Ação Manual)' },
                ]}
              />
            </Group>

            <TextInput
              label="Título da Solução"
              value={editingItem.solution_title || ''}
              onChange={(e) => setEditingItem({ ...editingItem, solution_title: e.currentTarget.value })}
            />

            <Textarea
              label="Análise do Problema (Diagnóstico)"
              rows={3}
              value={editingItem.problem_description || ''}
              onChange={(e) => setEditingItem({ ...editingItem, problem_description: e.currentTarget.value })}
            />

            <Textarea
              label="Instruções e Guia Passo a Passo para o Cliente"
              rows={4}
              value={editingItem.solution_instructions || ''}
              onChange={(e) => setEditingItem({ ...editingItem, solution_instructions: e.currentTarget.value })}
            />

            {editingItem.action_type === 'PLUGIN_AUTO_FIX' && (
              <Textarea
                label="Trecho de Código PHP para o Plugin (Fix Code Snippet)"
                rows={5}
                description="Código PHP limpo que será injetado no plugin customizado (sem tag <?php)."
                style={{ fontFamily: 'monospace' }}
                value={editingItem.fix_code_snippet || ''}
                onChange={(e) => setEditingItem({ ...editingItem, fix_code_snippet: e.currentTarget.value })}
              />
            )}

            <Textarea
              label="Notas para a IA / Considerações do Admin"
              rows={2}
              value={editingItem.ai_notes || ''}
              onChange={(e) => setEditingItem({ ...editingItem, ai_notes: e.currentTarget.value })}
            />

            <Group justify="space-between" mt="md">
              <Button
                variant="gradient"
                gradient={{ from: 'indigo', to: 'violet' }}
                leftSection={<IconSparkles size={16} />}
                onClick={handleAiRefine}
                loading={aiRefining}
              >
                ✨ Refinar Solução com IA (Kimi K2.7 Code)
              </Button>
              <Group gap="xs">
                <Button variant="default" onClick={() => setEditModalOpened(false)}>
                  Cancelar
                </Button>
                <Button color="indigo" onClick={handleSave} loading={saving}>
                  Salvar Solução
                </Button>
              </Group>
            </Group>
          </div>
        )}
      </Modal>
    </div>
  );
}
