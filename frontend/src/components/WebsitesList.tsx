import React, { useState, useEffect } from 'react';
import {
  Title,
  Text,
  Button,
  Group,
  Table,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Select,
  Paper,
  Alert,
  Loader,
  Center,
  Tooltip,
} from '@mantine/core';
import { IconPlus, IconTrash, IconRadar, IconAlertCircle, IconWorldCheck, IconPencil } from '@tabler/icons-react';
import { api } from '../api';

interface Website {
  id: string;
  name: string;
  url: string;
  environment: string;
  created_at: string;
}

interface WebsitesListProps {
  onSelectWebsite: (website: Website) => void;
  onTriggerScan: (website: Website) => void;
}

export const WebsitesList: React.FC<WebsitesListProps> = ({ onSelectWebsite, onTriggerScan }) => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [environment, setEnvironment] = useState<string>('production');

  const fetchWebsites = async () => {
    setLoading(true);
    try {
      const response = await api.get('/websites');
      setWebsites(response.data.data || []);
    } catch (err: any) {
      setError('Erro ao carregar lista de websites.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebsites();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingWebsite(null);
    setName('');
    setUrl('');
    setEnvironment('production');
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (site: Website) => {
    setEditingWebsite(site);
    setName(site.name);
    setUrl(site.url);
    setEnvironment(site.environment || 'production');
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (editingWebsite) {
        await api.put(`/websites/${editingWebsite.id}`, { name, url, environment });
      } else {
        await api.post('/websites', { name, url, environment });
      }
      setModalOpen(false);
      setName('');
      setUrl('');
      setEnvironment('production');
      setEditingWebsite(null);
      fetchWebsites();
    } catch (err: any) {
      setError(err.response?.data?.messages?.error || err.response?.data?.error || 'Erro ao salvar website.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este website cadastrado?')) return;
    try {
      await api.delete(`/websites/${id}`);
      fetchWebsites();
    } catch (err) {
      alert('Erro ao excluir website.');
    }
  };

  return (
    <Paper p="md" radius="md" withBorder>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={3}>Sites WordPress Alvo</Title>
          <Text c="dimmed" size="sm">
            Gerencie os websites cadastrados para auditoria automatizada de segurança.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} color="indigo" onClick={handleOpenCreateModal}>
          Novo Website
        </Button>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      )}

      {loading ? (
        <Center p="xl">
          <Loader color="indigo" size="lg" />
        </Center>
      ) : websites.length === 0 ? (
        <Paper p="xl" ta="center" bg="dark.7" radius="md">
          <IconWorldCheck size={48} style={{ opacity: 0.5 }} />
          <Text mt="md" fw={500}>Nenhum website cadastrado ainda.</Text>

          <Text c="dimmed" size="sm" mb="md">
            Clique no botão acima para adicionar seu primeiro alvo de varredura.
          </Text>
          <Button variant="light" color="indigo" onClick={handleOpenCreateModal}>
            Cadastrar Primeiro Site
          </Button>
        </Paper>
      ) : (
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome do Site</Table.Th>
              <Table.Th>URL do Alvo</Table.Th>
              <Table.Th>Ambiente</Table.Th>
              <Table.Th>Data de Cadastro</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {websites.map((site) => (
              <Table.Tr key={site.id}>
                <Table.Td fw={600}>{site.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="blue" component="a" href={site.url} target="_blank" rel="noopener noreferrer">
                    {site.url}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={site.environment === 'production' ? 'red' : 'teal'} variant="light">
                    {site.environment.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>{new Date(site.created_at).toLocaleDateString('pt-BR')}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Group justify="flex-end" gap="xs">
                    <Button
                      size="xs"
                      color="indigo"
                      leftSection={<IconRadar size={14} />}
                      onClick={() => onTriggerScan(site)}
                    >
                      Auditar Agora
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => onSelectWebsite(site)}
                    >
                      Histórico
                    </Button>
                    <Tooltip label="Editar Website">
                      <ActionIcon color="blue" variant="subtle" onClick={() => handleOpenEditModal(site)}>
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Excluir Website">
                      <ActionIcon color="red" variant="subtle" onClick={() => handleDelete(site.id)}>
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

      {/* Modal de Cadastro / Edição */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingWebsite ? 'Editar Alvo WordPress' : 'Cadastrar Novo Alvo WordPress'}
        centered
      >
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Nome do Site"
            placeholder="Ex: Blog Principal"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label="URL do WordPress"
            placeholder="http://localhost/wordpress"
            required
            mt="md"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
          />
          <Select
            label="Ambiente"
            data={[
              { value: 'production', label: 'Produção' },
              { value: 'staging', label: 'Staging / Homologação' },
              { value: 'local', label: 'Desenvolvimento Local' },
            ]}
            value={environment}
            onChange={(val) => setEnvironment(val || 'production')}
            mt="md"
          />
          <Group justify="flex-end" mt="xl">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" color="indigo" loading={formLoading}>
              {editingWebsite ? 'Salvar Alterações' : 'Salvar Website'}
            </Button>
          </Group>
        </form>
      </Modal>
    </Paper>
  );
};
