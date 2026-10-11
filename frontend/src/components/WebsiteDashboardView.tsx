import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Title,
  Text,
  Button,
  Group,
  Badge,
  Tabs,
  Card,
  Grid,
  ThemeIcon,
  Stack,
  Alert,
  Code,
  Box,
  TextInput,
  Select,
  RingProgress,
  Loader,
  Center,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconPlugConnected,
  IconPlugConnectedX,
  IconRadar,
  IconTerminal,
  IconDownload,
  IconSettings,
  IconCheck,
  IconCopy,
  IconAlertCircle,
  IconRefresh,
  IconTrash,
  IconLock,
  IconFileCheck,
  IconLayoutDashboard,
} from '@tabler/icons-react';
import { api } from '../api';
import { ScanReport } from './ScanReport';
import { WebsiteLogsView } from './WebsiteLogsView';
import { WebsiteUpdatesView } from './WebsiteUpdatesView';

interface Website {
  id: string;
  name: string;
  url: string;
  environment: string;
  is_connected?: number | boolean;
  agent_token?: string;
  created_at: string;
}

interface WebsiteDashboardViewProps {
  website: Website;
  onBack: () => void;
  onUpdateWebsite?: (updatedSite: Website) => void;
  onDeleteWebsite?: (siteId: string) => void;
}

export const WebsiteDashboardView: React.FC<WebsiteDashboardViewProps> = ({
  website,
  onBack,
  onUpdateWebsite,
  onDeleteWebsite,
}) => {
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [downloading, setDownloading] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  
  // Latest Audit State
  const [latestScan, setLatestScan] = useState<any | null>(null);
  const [scanHistoryLoading, setScanHistoryLoading] = useState(false);

  // Settings Form State
  const [name, setName] = useState(website.name);
  const [url, setUrl] = useState(website.url);
  const [environment, setEnvironment] = useState(website.environment || 'production');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const isConnected = Number(website.is_connected) === 1;

  const fetchLatestScan = useCallback(async () => {
    setScanHistoryLoading(true);
    try {
      const res = await api.get(`/scan/history/${website.id}`);
      const historyData = res.data.data || [];
      if (historyData.length > 0) {
        setLatestScan(historyData[0].scan_results);
      } else {
        setLatestScan(null);
      }
    } catch (e) {
      setLatestScan(null);
    } finally {
      setScanHistoryLoading(false);
    }
  }, [website.id]);

  useEffect(() => {
    fetchLatestScan();
  }, [fetchLatestScan]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'teal';
    if (score >= 75) return 'blue';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
  };

  const handleDownloadPlugin = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/websites/${website.id}/download-plugin`, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      const siteHost = website.url
        ? website.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
        : website.name.replace(/\s+/g, '-').toLowerCase();
      const siteSlug = siteHost.replace(/[^a-zA-Z0-9_\-]/g, '-');
      link.setAttribute('download', `wp-patropi-diagnostico-${siteSlug}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert('Erro ao baixar o plugin agente do WordPress.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyToken = () => {
    if (website.agent_token) {
      navigator.clipboard.writeText(website.agent_token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 3000);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const response = await api.put(`/websites/${website.id}`, { name, url, environment });
      const updated = response.data?.data || { ...website, name, url, environment };
      setFormSuccess('Dados do website atualizados com sucesso!');
      if (onUpdateWebsite) {
        onUpdateWebsite(updated);
      }
      setTimeout(() => setFormSuccess(null), 4000);
    } catch (err: any) {
      setFormError(
        err.response?.data?.messages?.error ||
          err.response?.data?.error ||
          'Erro ao salvar alterações do website.'
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Deseja realmente excluir o website "${website.name}"?`)) return;
    try {
      await api.delete(`/websites/${website.id}`);
      if (onDeleteWebsite) {
        onDeleteWebsite(website.id);
      }
      onBack();
    } catch (err) {
      alert('Erro ao excluir website.');
    }
  };

  return (
    <Stack gap="md">
      {/* Top Banner Header */}
      <Paper p="md" radius="md" bg="dark.7" withBorder style={{ borderLeft: '4px solid #4c6ef5' }}>
        <Group justify="space-between" align="center">
          <Group gap="md">
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconArrowLeft size={16} />}
              onClick={onBack}
            >
              Voltar aos Sites
            </Button>
            <div>
              <Group gap="xs" align="center">
                <Title order={3}>{website.name}</Title>
                <Badge
                  color={
                    website.environment === 'production'
                      ? 'red'
                      : website.environment === 'staging'
                      ? 'orange'
                      : 'teal'
                  }
                  variant="light"
                  size="sm"
                >
                  {(website.environment || 'production').toUpperCase()}
                </Badge>
              </Group>
              <Text
                size="sm"
                c="blue.4"
                component="a"
                href={website.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {website.url}
              </Text>
            </div>
          </Group>

          <Group gap="sm">
            {isConnected ? (
              <Badge
                size="lg"
                color="green"
                variant="filled"
                leftSection={<IconPlugConnected size={16} />}
              >
                AGENTE CONECTADO
              </Badge>
            ) : (
              <Badge
                size="lg"
                color="gray"
                variant="light"
                leftSection={<IconPlugConnectedX size={16} />}
              >
                AGENTE PENDENTE
              </Badge>
            )}

            <Button
              variant="light"
              color="teal"
              size="xs"
              loading={downloading}
              leftSection={<IconDownload size={14} />}
              onClick={handleDownloadPlugin}
            >
              Baixar Plugin WP
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
        <Tabs.List bg="dark.8" p="xs" style={{ borderRadius: 8 }}>
          <Tabs.Tab
            value="overview"
            leftSection={<IconLayoutDashboard size={16} />}
            fw={600}
          >
            Visão Geral
          </Tabs.Tab>
          <Tabs.Tab
            value="audit"
            leftSection={<IconRadar size={16} />}
            fw={600}
          >
            Auditoria & Segurança
          </Tabs.Tab>
          <Tabs.Tab
            value="logs"
            leftSection={<IconTerminal size={16} />}
            fw={600}
          >
            Logs em Tempo Real
          </Tabs.Tab>
          <Tabs.Tab
            value="updates"
            leftSection={<IconRefresh size={16} />}
            fw={600}
          >
            Atualizações
          </Tabs.Tab>
          <Tabs.Tab
            value="agent"
            leftSection={<IconPlugConnected size={16} />}
            fw={600}
          >
            Agente WordPress
          </Tabs.Tab>
          <Tabs.Tab
            value="settings"
            leftSection={<IconSettings size={16} />}
            fw={600}
          >
            Configurações
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab 1: Overview */}
        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            {/* Card do Resumo da Última Auditoria */}
            <Paper p="lg" radius="md" bg="dark.8" withBorder>
              <Group justify="space-between" mb="sm">
                <Group gap="xs">
                  <ThemeIcon color="indigo" variant="light" radius="xl">
                    <IconRadar size={18} />
                  </ThemeIcon>
                  <Title order={4}>Resumo da Última Auditoria</Title>
                </Group>
                {latestScan && (
                  <Badge color="gray" variant="light">
                    Realizada em: {latestScan.scanned_at || 'Data N/D'}
                  </Badge>
                )}
              </Group>

              {scanHistoryLoading ? (
                <Center p="md">
                  <Loader size="sm" color="indigo" />
                </Center>
              ) : latestScan ? (
                <Grid align="center" mt="xs">
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Group justify="center">
                      <RingProgress
                        size={140}
                        thickness={12}
                        roundCaps
                        sections={[{ value: latestScan.score, color: getScoreColor(latestScan.score) }]}
                        label={
                          <Stack align="center" gap={0}>
                            <Text ta="center" fz={28} fw={800} lh={1}>
                              {latestScan.score}
                            </Text>
                            <Text ta="center" size="xs" c="dimmed" fw={700}>
                              GRADE {latestScan.grade}
                            </Text>
                          </Stack>
                        }
                      />
                    </Group>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, md: 8 }}>
                    <Stack gap="xs">
                      <Group gap="md" style={{ width: '100%' }}>
                        <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}>
                          <Text size="xs" c="dimmed" fw={600} ta="center">Checagens</Text>
                          <Text fw={800} fz={20} ta="center">{latestScan.summary?.total_checks ?? 0}</Text>
                        </Paper>

                        <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}>
                          <Text size="xs" c="green.4" fw={600} ta="center">Aprovados</Text>
                          <Text fw={800} fz={20} c="green.4" ta="center">{latestScan.summary?.passed ?? 0}</Text>
                        </Paper>

                        <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}>
                          <Text size="xs" c="red.4" fw={600} ta="center">Falhas Críticas</Text>
                          <Text fw={800} fz={20} c="red.4" ta="center">{latestScan.summary?.failed ?? 0}</Text>
                        </Paper>

                        <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}>
                          <Text size="xs" c="yellow.4" fw={600} ta="center">Alertas</Text>
                          <Text fw={800} fz={20} c="yellow.4" ta="center">{latestScan.summary?.warnings ?? 0}</Text>
                        </Paper>
                      </Group>

                      <Group justify="flex-end" mt="xs">
                        <Button
                          variant="light"
                          color="indigo"
                          size="xs"
                          leftSection={<IconRadar size={14} />}
                          onClick={() => setActiveTab('audit')}
                        >
                          Ver Detalhes / Iniciar Varredura
                        </Button>
                      </Group>
                    </Stack>
                  </Grid.Col>
                </Grid>
              ) : (
                <Box p="md" bg="dark.7" style={{ borderRadius: 8 }} ta="center">
                  <Text size="sm" c="dimmed" mb="xs">Nenhuma auditoria executada para este site ainda.</Text>
                  <Button
                    color="indigo"
                    size="xs"
                    leftSection={<IconRadar size={14} />}
                    onClick={() => setActiveTab('audit')}
                  >
                    Executar Primeira Auditoria Agora
                  </Button>
                </Box>
              )}
            </Paper>

            {/* Status Summary Cards */}
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card padding="lg" radius="md" withBorder bg="dark.7" h="100%">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                      Status da Conexão
                    </Text>
                    <ThemeIcon color={isConnected ? 'green' : 'gray'} variant="light" radius="xl">
                      {isConnected ? <IconPlugConnected size={18} /> : <IconPlugConnectedX size={18} />}
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg" mb={4}>
                    {isConnected ? 'Agente Ativo' : 'Pendente de Sincronização'}
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    {isConnected
                      ? 'O agente WP Patropi está comunicando com o SaaS com sucesso.'
                      : 'Baixe e ative o plugin no seu painel WordPress para liberar os relatórios.'}
                  </Text>
                  <Button
                    variant="light"
                    color={isConnected ? 'indigo' : 'teal'}
                    size="xs"
                    fullWidth
                    onClick={() => setActiveTab('agent')}
                  >
                    {isConnected ? 'Ver Configuração do Agente' : 'Instalar Agente WordPress'}
                  </Button>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card padding="lg" radius="md" withBorder bg="dark.7" h="100%">
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                      Logs de Execução WP
                    </Text>
                    <ThemeIcon color="cyan" variant="light" radius="xl">
                      <IconTerminal size={18} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg" mb={4}>
                    Logs em Tempo Real
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    Consulte erros PHP, avisos do sistema e debugs gerados diretamente no WordPress.
                  </Text>
                  <Button
                    variant="light"
                    color="cyan"
                    size="xs"
                    fullWidth
                    leftSection={<IconTerminal size={14} />}
                    onClick={() => setActiveTab('logs')}
                  >
                    Acessar Console de Logs
                  </Button>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Upcoming Features Section (Planejadas) */}
            <Paper p="lg" radius="md" withBorder bg="dark.8">
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={4}>🚀 Próximos Módulos de Manutenção</Title>
                  <Text size="xs" c="dimmed">
                    Ferramentas planejadas para a gestão ativa deste site.
                  </Text>
                </div>
                <Badge color="pink" variant="light">
                  Em Planejamento
                </Badge>
              </Group>

              <Grid>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Paper p="sm" radius="sm" bg="dark.7" style={{ opacity: 0.8 }}>
                    <Group gap="xs" mb={4}>
                      <IconRefresh size={18} style={{ color: '#4dabf7' }} />
                      <Text size="sm" fw={600}>
                        Atualizações Remotas
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Atualize plugins, temas e a versão do WordPress em 1 clique diretamente pelo SaaS.
                    </Text>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Paper p="sm" radius="sm" bg="dark.7" style={{ opacity: 0.8 }}>
                    <Group gap="xs" mb={4}>
                      <IconLock size={18} style={{ color: '#ffec99' }} />
                      <Text size="sm" fw={600}>
                        Hardening em 1-Clique
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Desative edição de código, bloqueie XML-RPC e oculte a versão do WP instantaneamente.
                    </Text>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Paper p="sm" radius="sm" bg="dark.7" style={{ opacity: 0.8 }}>
                    <Group gap="xs" mb={4}>
                      <IconFileCheck size={18} style={{ color: '#63e6be' }} />
                      <Text size="sm" fw={600}>
                        Verificador de Integridade
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Verifique a autenticidade dos arquivos do sistema comparando os checksums oficiais do WordPress.org.
                    </Text>
                  </Paper>
                </Grid.Col>
              </Grid>
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* Tab 2: Audit & Security */}
        <Tabs.Panel value="audit" pt="md">
          <ScanReport website={website} onBack={() => setActiveTab('overview')} />
        </Tabs.Panel>

        {/* Tab 3: Realtime Logs */}
        <Tabs.Panel value="logs" pt="md">
          <WebsiteLogsView website={website} onBack={() => setActiveTab('overview')} />
        </Tabs.Panel>

        {/* Tab 4: Remote Updates */}
        <Tabs.Panel value="updates" pt="md">
          <WebsiteUpdatesView website={website} />
        </Tabs.Panel>

        {/* Tab 4: WP Agent Info */}
        <Tabs.Panel value="agent" pt="md">
          <Paper p="lg" radius="md" withBorder bg="dark.7">
            <Title order={4} mb="xs">
              Conexão com o Plugin WP Patropi Agent
            </Title>
            <Text size="sm" c="dimmed" mb="lg">
              O plugin agente é responsável por integrar seu WordPress ao SaaS Validar Segurança com autenticação criptografada via tokens.
            </Text>

            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="md" radius="sm" bg="dark.8" withBorder mb="md">
                  <Text size="sm" fw={600} mb="xs">
                    1. Baixar o Plugin Personalizado
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    Este pacote ZIP já vem configurado especificamente para este website ({website.name}).
                  </Text>
                  <Button
                    leftSection={<IconDownload size={16} />}
                    color="teal"
                    size="xs"
                    loading={downloading}
                    onClick={handleDownloadPlugin}
                  >
                    Baixar Plugin Agente (.zip)
                  </Button>
                </Paper>

                <Paper p="md" radius="sm" bg="dark.8" withBorder>
                  <Text size="sm" fw={600} mb="xs">
                    2. Instalar no WordPress
                  </Text>
                  <Stack gap={4}>
                    <Text size="xs">Acesse o painel do seu site em <b>Plugins &gt; Adicionar Novo &gt; Enviar Plugin</b>.</Text>
                    <Text size="xs">Selecione o arquivo ZIP baixado e clique em <b>Instalar Agora</b> e depois em <b>Ativar</b>.</Text>
                  </Stack>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="md" radius="sm" bg="dark.8" withBorder h="100%">
                  <Text size="sm" fw={600} mb="xs">
                    Chave de Conexão (Agent Token)
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Utilizada para sincronizar a ponte entre o SaaS e seu WordPress:
                  </Text>
                  <Group gap="xs" mb="md">
                    <Code block px="md" py="xs" style={{ wordBreak: 'break-all', width: '100%' }}>
                      {website.agent_token || 'Nenhum token gerado.'}
                    </Code>
                    {website.agent_token && (
                      <Button
                        size="xs"
                        variant="light"
                        color={copiedToken ? 'green' : 'indigo'}
                        leftSection={copiedToken ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        onClick={handleCopyToken}
                      >
                        {copiedToken ? 'Copiado!' : 'Copiar Token'}
                      </Button>
                    )}
                  </Group>

                  <Alert icon={<IconAlertCircle size={16} />} title="Status da Integração" color={isConnected ? 'green' : 'gray'}>
                    {isConnected
                      ? 'Tudo certo! O agente respondeu perfeitamente ao teste de handshake.'
                      : 'O agente ainda não foi detectado. Após ativar o plugin no WordPress, clique no botão de reconectar no painel do WP Patropi.'}
                  </Alert>
                </Paper>
              </Grid.Col>
            </Grid>
          </Paper>
        </Tabs.Panel>

        {/* Tab 5: Settings */}
        <Tabs.Panel value="settings" pt="md">
          <Paper p="lg" radius="md" withBorder bg="dark.7">
            <Title order={4} mb="md">
              Configurações do Website
            </Title>

            {formError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" onClose={() => setFormError(null)} withCloseButton>
                {formError}
              </Alert>
            )}

            {formSuccess && (
              <Alert icon={<IconCheck size={16} />} color="green" mb="md" onClose={() => setFormSuccess(null)} withCloseButton>
                {formSuccess}
              </Alert>
            )}

            <form onSubmit={handleSaveSettings}>
              <Stack gap="md" style={{ maxWidth: 600 }}>
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
                />
                <Group justify="flex-start" mt="xs">
                  <Button type="submit" color="indigo" loading={formLoading}>
                    Salvar Alterações
                  </Button>
                </Group>
              </Stack>
            </form>

            <Box mt="xl" pt="md" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <Title order={5} c="red" mb="xs">
                Zona de Perigo
              </Title>
              <Text size="xs" c="dimmed" mb="md">
                A exclusão do website removerá o cadastro no SaaS e todo o histórico de auditorias associadas a ele.
              </Text>
              <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
                Excluir Website Alvo
              </Button>
            </Box>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
};
