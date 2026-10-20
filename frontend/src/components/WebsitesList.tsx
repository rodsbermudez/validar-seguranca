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
  NumberInput,
  Select,
  Paper,
  Alert,
  Loader,
  Center,
  Tooltip,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconAlertCircle,
  IconWorldCheck,
  IconPencil,
  IconPlugConnected,
  IconLayoutDashboard,
  IconUsers,
  IconDoorExit,
  IconAlertTriangle,
  IconInfoCircle,
  IconDownload,
} from '@tabler/icons-react';
import { api, Website } from '../api';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

interface WebsitesListProps {
  onSelectWebsite: (website: Website) => void;
  onTriggerScan?: (website: Website) => void;
  onSelectLogs?: (website: Website) => void;
}

export const WebsitesList: React.FC<WebsitesListProps> = ({ onSelectWebsite }) => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [environment, setEnvironment] = useState<string>('production');
  const [maintenanceDay, setMaintenanceDay] = useState<number | string>('');

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

  const hasPendingWebsites = websites.some((s) => Number(s.is_connected) !== 1);

  // Revalidação em tempo real (Smart Polling + Focus Sync)
  useRealtimeSync({
    onSync: async () => {
      try {
        const response = await api.get('/websites');
        setWebsites(response.data.data || []);
      } catch (err) {
        // Silently catch background errors
      }
    },
    interval: hasPendingWebsites ? 6000 : 35000,
    revalidateOnFocus: true,
    enabled: true,
  });

  const handleOpenCreateModal = () => {
    setEditingWebsite(null);
    setName('');
    setUrl('');
    setEnvironment('production');
    setMaintenanceDay('');
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (site: Website) => {
    setEditingWebsite(site);
    setName(site.name);
    setUrl(site.url);
    setEnvironment(site.environment || 'production');
    setMaintenanceDay(site.maintenance_day || '');
    setError(null);
    setModalOpen(true);
  };

  const handleDownloadPlugin = async (site: Website) => {
    setDownloadingId(site.id);
    try {
      const response = await api.get(`/websites/${site.id}/download-plugin`, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      const siteHost = site.url
        ? site.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
        : site.name.replace(/\s+/g, '-').toLowerCase();
      const siteSlug = siteHost.replace(/[^a-zA-Z0-9_\-]/g, '-');
      link.setAttribute('download', `vexors-diagnostico-${siteSlug}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert('Erro ao baixar o plugin agente do WordPress.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    let formattedUrl = url.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    // Remove trailing slash
    formattedUrl = formattedUrl.replace(/\/+$/, '');

    const isUrlModified = editingWebsite
      ? formattedUrl !== editingWebsite.url.replace(/\/+$/, '')
      : false;

    const payload = {
      name: name.trim(),
      url: formattedUrl,
      environment,
      maintenance_day: maintenanceDay === '' || maintenanceDay === null ? null : Number(maintenanceDay),
    };

    try {
      if (editingWebsite) {
        await api.put(`/websites/${editingWebsite.id}`, payload);
        if (isUrlModified) {
          setNotice(
            `A URL do website "${name}" foi alterada com sucesso! O plugin agente de segurança precisará ser gerado e baixado novamente para restabelecer a conexão no WordPress com o novo endereço.`
          );
        }
      } else {
        await api.post('/websites', payload);
      }
      setModalOpen(false);
      setName('');
      setUrl('');
      setEnvironment('production');
      setMaintenanceDay('');
      setEditingWebsite(null);
      fetchWebsites();
    } catch (err: any) {
      setError(
        err.response?.data?.messages?.error ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Erro ao salvar website.'
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (site: Website) => {
    const isOwner = site.is_owner === undefined || site.is_owner === true || site.is_owner === 1;
    if (isOwner) {
      if (!confirm(`Deseja realmente remover o website "${site.name}"?`)) return;
      try {
        await api.delete(`/websites/${site.id}`);
        fetchWebsites();
      } catch (err: any) {
        alert(err.response?.data?.messages?.error || err.response?.data?.error || 'Erro ao excluir website.');
      }
    } else {
      if (!confirm(`Deseja remover seu acesso ao website compartilhado "${site.name}"?`)) return;
      try {
        const userJson = localStorage.getItem('user');
        const user = userJson ? JSON.parse(userJson) : null;
        if (user?.id) {
          await api.delete(`/websites/${site.id}/shares/${user.id}`);
          fetchWebsites();
        }
      } catch (err: any) {
        alert(err.response?.data?.messages?.error || err.response?.data?.error || 'Erro ao sair do website.');
      }
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

      {notice && (
        <Alert
          icon={<IconAlertTriangle size={18} />}
          color="orange"
          variant="light"
          mb="md"
          onClose={() => setNotice(null)}
          withCloseButton
          title="Atenção: Reinstalação de Plugin Necessária"
        >
          {notice}
        </Alert>
      )}

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
              <Table.Th>Status Agente WP</Table.Th>
              <Table.Th>Manutenção Mensal</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {websites.map((site) => {
              const isOwner = site.is_owner === undefined || site.is_owner === true || site.is_owner === 1;
              return (
                <Table.Tr key={site.id}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Text
                        fw={600}
                        style={{ cursor: 'pointer' }}
                        c="indigo.3"
                        onClick={() => onSelectWebsite(site)}
                      >
                        {site.name}
                      </Text>
                      <Badge
                        size="xs"
                        color={site.environment === 'production' ? 'red' : site.environment === 'staging' ? 'orange' : 'teal'}
                        variant="light"
                      >
                        {(site.environment || 'production').toUpperCase()}
                      </Badge>
                      {!isOwner && (
                        <Tooltip label={`Compartilhado por ${site.owner_name || site.owner_email || 'outro usuário'}`}>
                          <Badge size="xs" color="violet" variant="outline" leftSection={<IconUsers size={11} />}>
                            COMPARTILHADO
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="blue" component="a" href={site.url} target="_blank" rel="noopener noreferrer">
                      {site.url}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {Number(site.is_connected) === 1 ? (
                      <Badge color="green" variant="filled" leftSection={<IconPlugConnected size={12} />}>
                        CONECTADO
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light">
                        PENDENTE
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {site.maintenance ? (
                      <Group gap={6} wrap="nowrap">
                        <Badge
                          color={site.maintenance.badge_color}
                          variant={site.maintenance.status === 'completed' ? 'filled' : 'light'}
                          size="sm"
                        >
                          {site.maintenance.label}
                        </Badge>
                        {site.maintenance_day && (
                          <Text size="xs" c="dimmed">
                            (Dia {site.maintenance_day})
                          </Text>
                        )}
                      </Group>
                    ) : site.maintenance_day ? (
                      <Badge color="blue" variant="light" size="sm">
                        Todo dia {site.maintenance_day}
                      </Badge>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Não definida
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Group justify="flex-end" gap="xs" wrap="nowrap">
                      <Button
                        size="xs"
                        color="indigo"
                        leftSection={<IconLayoutDashboard size={14} />}
                        onClick={() => onSelectWebsite(site)}
                      >
                        Acessar Painel
                      </Button>
                      {isOwner ? (
                        <>
                          <Tooltip label="Baixar Plugin Agente WP (.zip)">
                            <ActionIcon
                              color="teal"
                              variant="subtle"
                              loading={downloadingId === site.id}
                              onClick={() => handleDownloadPlugin(site)}
                            >
                              <IconDownload size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Editar Configurações">
                            <ActionIcon color="blue" variant="subtle" onClick={() => handleOpenEditModal(site)}>
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Excluir Website">
                            <ActionIcon color="red" variant="subtle" onClick={() => handleDelete(site)}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      ) : (
                        <Tooltip label="Sair do Monitoramento deste Website">
                          <ActionIcon color="orange" variant="subtle" onClick={() => handleDelete(site)}>
                            <IconDoorExit size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      {/* Modal de Cadastro / Edição */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingWebsite ? 'Editar Alvo WordPress' : 'Cadastrar Novo Alvo WordPress'}
        centered
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          {!editingWebsite ? (
            <Alert
              icon={<IconInfoCircle size={18} />}
              color="blue"
              variant="light"
              mb="md"
              title="Endereço da Página Inicial (Obrigatório HTTPS)"
            >
              Para que os diagnósticos e a comunicação com o agente funcionem perfeitamente, informe a <b>URL da página inicial</b> do site iniciando com <b>https://</b> (ex: <code>https://seusite.com.br</code>). O protocolo seguro HTTPS é obrigatório. Não use links com <code>http://</code> nem informe subpáginas ou painel administrativo (como <code>/wp-admin</code>).
            </Alert>
          ) : (
            <Alert
              icon={<IconAlertTriangle size={18} />}
              color="orange"
              variant="light"
              mb="md"
              title="Atenção à alteração de URL"
            >
              Se a <b>URL do site for alterada</b>, o plugin agente de segurança precisará ser <b>gerado e baixado novamente</b> nesta plataforma e reinstalado no seu WordPress para restabelecer a comunicação e o token de segurança.
            </Alert>
          )}

          <TextInput
            label="Nome do Site"
            placeholder="Ex: Blog Principal"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />

          <TextInput
            label="URL da Página Inicial do WordPress (com HTTPS://)"
            description="Informe a URL da página inicial com https:// (Exemplo: https://seusite.com.br). O protocolo seguro HTTPS é obrigatório para funcionamento e comunicação com o agente."
            placeholder="https://seusite.com.br"
            required
            mt="md"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
          />

          {editingWebsite && url.trim() !== '' && url.trim().replace(/\/+$/, '') !== editingWebsite.url.replace(/\/+$/, '') && (
            <Alert
              icon={<IconAlertTriangle size={16} />}
              color="yellow"
              variant="filled"
              mt="xs"
            >
              Você está alterando a URL original (<code>{editingWebsite.url}</code>) para <code>{url.trim().replace(/\/+$/, '')}</code>. Ao salvar, a comunicação com o plugin instalado será interrompida e você precisará baixar e reinstalar o novo plugin no novo endereço.
            </Alert>
          )}

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
          <NumberInput
            label="Dia da Manutenção Mensal (Opcional)"
            description="Dia do mês (1 a 31) em que a rotina preventiva deve ser executada."
            placeholder="Ex: 15 (todo dia 15 de cada mês)"
            min={1}
            max={31}
            value={maintenanceDay}
            onChange={(val) => setMaintenanceDay(val)}
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
