import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Title,
  Text,
  Button,
  Group,
  Badge,
  Stack,
  Table,
  ThemeIcon,
  Alert,
  Loader,
  Center,
  Grid,
  Card,
  TextInput,
  SegmentedControl,
  Box,
  Code,
  Tooltip,
  Modal,
} from '@mantine/core';
import {
  IconFileCheck,
  IconShieldCheck,
  IconAlertTriangle,
  IconRefresh,
  IconSearch,
  IconFileCode,
  IconAlertCircle,
  IconCheck,
  IconRestore,
  IconTrash,
  IconDownload,
} from '@tabler/icons-react';
import {
  getWebsiteIntegrity,
  scanWebsiteIntegrity,
  toggleIgnoreIntegrityIssue,
  deleteIntegrityFile,
  restoreIntegrityFile,
  IntegrityScanData,
  IntegrityIssue,
} from '../api';
import { formatDateTime } from '../utils/date';

interface WebsiteIntegrityViewProps {
  website: { id: string | number; name: string; url: string; environment?: string };
}

export const WebsiteIntegrityView: React.FC<WebsiteIntegrityViewProps> = ({ website }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [actionLoadingFile, setActionLoadingFile] = useState<string | null>(null);
  const [deleteModalOpened, setDeleteModalOpened] = useState<boolean>(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [restoreModalOpened, setRestoreModalOpened] = useState<boolean>(false);
  const [fileToRestore, setFileToRestore] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [scanData, setScanData] = useState<IntegrityScanData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const websiteId = Number(website.id);

  const fetchIntegrity = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getWebsiteIntegrity(websiteId);
      if (res.success && res.data) {
        setScanData(res.data);
      } else {
        setErrorMsg(res.message || 'Não foi possível carregar os dados de integridade.');
      }
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Falha ao conectar com o agente WordPress para verificar integridade.'
      );
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    fetchIntegrity();
  }, [fetchIntegrity]);

  const handleRunScan = async () => {
    setScanning(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await scanWebsiteIntegrity(websiteId);
      if (res.success && res.data) {
        setScanData(res.data);
        const activeCount = res.data.summary.active_issues ?? res.data.issues.filter(i => !i.is_ignored).length;
        if (res.data.is_secure) {
          if ((res.data.summary.ignored_issues || 0) > 0) {
            setSuccessMsg(`Varredura concluída: Core seguro! (${res.data.summary.ignored_issues} arquivo(s) resolvidos/ignorados mantidos).`);
          } else {
            setSuccessMsg('Varredura concluída: Todos os arquivos do Core são 100% autênticos!');
          }
        } else {
          setSuccessMsg(
            `Varredura concluída: ${activeCount} anomalia(s) pendente(s) requerem sua atenção.`
          );
        }
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(res.message || 'Falha ao executar a varredura de integridade.');
      }
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao processar varredura de integridade no servidor.'
      );
    } finally {
      setScanning(false);
    }
  };

  const handleToggleIgnore = async (file: string, currentIgnored: boolean) => {
    setActionLoadingFile(file);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await toggleIgnoreIntegrityIssue(websiteId, file, !currentIgnored);
      if (res.success && res.data) {
        setScanData(res.data);
        if (!currentIgnored) {
          setSuccessMsg(`Arquivo "${file}" marcado como ignorado / resolvido com sucesso!`);
        } else {
          setSuccessMsg(`Arquivo "${file}" reativado para monitoramento ativo!`);
        }
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message || 'Falha ao atualizar status do arquivo.');
      }
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao comunicar com o servidor para atualizar status do arquivo.'
      );
    } finally {
      setActionLoadingFile(null);
    }
  };

  const handleOpenDeleteModal = (file: string) => {
    setFileToDelete(file);
    setDeleteModalOpened(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await deleteIntegrityFile(websiteId, fileToDelete);
      if (res.success && res.data) {
        setScanData(res.data);
        setSuccessMsg(`Arquivo "${fileToDelete}" foi excluído com sucesso do servidor!`);
        setDeleteModalOpened(false);
        setFileToDelete(null);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(res.message || 'Falha ao excluir o arquivo no servidor.');
      }
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao comunicar com o servidor para excluir o arquivo.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenRestoreModal = (file: string) => {
    setFileToRestore(file);
    setRestoreModalOpened(true);
  };

  const handleConfirmRestore = async () => {
    if (!fileToRestore) return;
    setRestoring(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await restoreIntegrityFile(websiteId, fileToRestore);
      if (res.success && res.data) {
        setScanData(res.data);
        setSuccessMsg(`Arquivo "${fileToRestore}" restaurado com sucesso para a versão oficial autêntica do WordPress!`);
        setRestoreModalOpened(false);
        setFileToRestore(null);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(res.message || 'Falha ao restaurar o arquivo no servidor.');
      }
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Erro ao comunicar com o servidor para restaurar o arquivo original.'
      );
    } finally {
      setRestoring(false);
    }
  };

  const summary = scanData?.summary;
  const activeCount = summary?.active_issues ?? scanData?.issues.filter((i) => !i.is_ignored).length ?? 0;
  const ignoredCount = summary?.ignored_issues ?? scanData?.issues.filter((i) => i.is_ignored).length ?? 0;

  const getFilteredIssues = (): IntegrityIssue[] => {
    if (!scanData || !scanData.issues) return [];

    return scanData.issues.filter((issue) => {
      const matchesFilter =
        filterType === 'all' ||
        (filterType === 'pending' && !issue.is_ignored) ||
        (filterType === 'ignored' && issue.is_ignored) ||
        issue.type === filterType;

      const matchesSearch =
        searchQuery === '' ||
        issue.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  };

  const filteredIssues = getFilteredIssues();

  return (
    <Stack gap="md">
      {/* Header Card */}
      <Paper p="lg" radius="md" bg="dark.7" withBorder>
        <Group justify="space-between" align="center" wrap="wrap">
          <div>
            <Group gap="xs" align="center">
              <ThemeIcon size="lg" radius="md" color="teal" variant="light">
                <IconFileCheck size={22} />
              </ThemeIcon>
              <div>
                <Title order={3}>Verificador de Integridade do Core</Title>
                <Text size="xs" c="dimmed">
                  Compara a integridade dos arquivos locais com os checksums oficiais do WordPress.org.
                </Text>
              </div>
            </Group>
          </div>

          <Group gap="sm">
            {scanData && (
              <Badge color="gray" variant="light" size="sm">
                Versão WP: {scanData.wp_version} ({scanData.locale})
              </Badge>
            )}

            <Button
              color="teal"
              size="sm"
              loading={scanning}
              leftSection={<IconRefresh size={16} />}
              onClick={handleRunScan}
            >
              Executar Nova Varredura
            </Button>
          </Group>
        </Group>

        {errorMsg && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
            mt="md"
            withCloseButton
            onClose={() => setErrorMsg(null)}
          >
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert
            icon={<IconCheck size={16} />}
            color="teal"
            variant="light"
            mt="md"
            withCloseButton
            onClose={() => setSuccessMsg(null)}
          >
            {successMsg}
          </Alert>
        )}
      </Paper>

      {loading ? (
        <Center p="xl">
          <Stack align="center" gap="sm">
            <Loader size="lg" color="teal" />
            <Text size="sm" c="dimmed">
              Carregando dados de integridade do WordPress...
            </Text>
          </Stack>
        </Center>
      ) : scanData ? (
        <>
          {/* Status Hero Card */}
          {scanData.is_secure ? (
            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{
                borderColor: '#2b8a3e',
                backgroundColor: 'rgba(43, 138, 62, 0.1)',
              }}
            >
              <Group gap="md" align="center">
                <ThemeIcon size={52} radius="xl" color="green" variant="filled">
                  <IconShieldCheck size={32} />
                </ThemeIcon>
                <div style={{ flex: 1 }}>
                  <Group justify="space-between" align="center">
                    <Title order={4} c="green.4">
                      {ignoredCount > 0
                        ? 'Core Protegido (Exceções Ignoradas)'
                        : 'Core 100% Autêntico e Íntegro'}
                    </Title>
                    <Badge color="green" variant="filled" size="sm">
                      {ignoredCount > 0 ? 'SEGURO (RESOLVIDO)' : 'SEGURO'}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed" mt={2}>
                    {ignoredCount > 0
                      ? `Não há anomalias ativas pendentes. ${ignoredCount} arquivo(s) foram marcados como resolvidos/ignorados (ex: arquivos de plugins legítimos). Se algum desses arquivos for removido do servidor, ele sairá da lista automaticamente.`
                      : `Todos os ${summary?.total_checked} arquivos do WordPress ${scanData.wp_version} correspondem com exatidão aos originais publicados pelo WordPress.org. Nenhum arquivo foi adulterado.`}
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Última verificação realizada em: <b>{formatDateTime(scanData.scanned_at)}</b>
                  </Text>
                </div>
              </Group>
            </Paper>
          ) : (
            <Paper
              p="lg"
              radius="md"
              withBorder
              style={{
                borderColor: '#c92a2a',
                backgroundColor: 'rgba(201, 42, 42, 0.15)',
              }}
            >
              <Group gap="md" align="center">
                <ThemeIcon size={52} radius="xl" color="red" variant="filled">
                  <IconAlertTriangle size={32} />
                </ThemeIcon>
                <div style={{ flex: 1 }}>
                  <Group justify="space-between" align="center">
                    <Title order={4} c="red.4">
                      Atenção: {activeCount} Anomalia(s) Pendente(s) de Resolução!
                    </Title>
                    <Badge color="red" variant="filled" size="sm">
                      COMPROMETIDO
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed" mt={2}>
                    Foram identificadas <b>{activeCount}</b> inconsistência(s) ativas no core do WordPress
                    {ignoredCount > 0 && ` (${ignoredCount} arquivo(s) já resolvidos/ignorados)`}. Você pode excluir arquivos dispensáveis (ex: wp-config-sample.php ou scripts suspeitos) ou marcar como resolvido se pertencer a plugins legítimos.
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Última verificação realizada em: <b>{formatDateTime(scanData.scanned_at)}</b>
                  </Text>
                </div>
              </Group>
            </Paper>
          )}

          {/* Metrics Summary Grid */}
          <Grid>
            <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7" ta="center">
                <Text size="xs" fw={600} c="dimmed">
                  Total Verificados
                </Text>
                <Text fw={800} fz={24} mt={2}>
                  {summary?.total_checked ?? 0}
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7" ta="center">
                <Text size="xs" fw={600} c="green.4">
                  Arquivos Íntegros
                </Text>
                <Text fw={800} fz={24} c="green.4" mt={2}>
                  {summary?.passed ?? 0}
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7" ta="center">
                <Text size="xs" fw={600} c={activeCount > 0 ? 'red.4' : 'green.4'}>
                  Pendentes
                </Text>
                <Text fw={800} fz={24} c={activeCount > 0 ? 'red.4' : 'green.4'} mt={2}>
                  {activeCount}
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7" ta="center">
                <Text size="xs" fw={600} c="teal.4">
                  Resolvidos / Ignorados
                </Text>
                <Text fw={800} fz={24} c="teal.4" mt={2}>
                  {ignoredCount}
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7" ta="center">
                <Text size="xs" fw={600} c="red.4">
                  Modificados
                </Text>
                <Text fw={800} fz={24} c="red.4" mt={2}>
                  {summary?.modified ?? 0}
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7" ta="center">
                <Text size="xs" fw={600} c="orange.4">
                  Suspeitos
                </Text>
                <Text fw={800} fz={24} c="orange.4" mt={2}>
                  {summary?.suspicious ?? 0}
                </Text>
              </Card>
            </Grid.Col>
          </Grid>

          {/* Issues Section */}
          <Paper p="lg" radius="md" bg="dark.7" withBorder>
            <Group justify="space-between" mb="md" wrap="wrap">
              <div>
                <Title order={4}>Relatório Detalhado de Arquivos</Title>
                <Text size="xs" c="dimmed">
                  {scanData.issues.length === 0
                    ? 'Nenhum problema encontrado. O core está limpo.'
                    : `Exibindo ${filteredIssues.length} de ${scanData.issues.length} arquivo(s) detectados.`}
                </Text>
              </div>

              {scanData.issues.length > 0 && (
                <Group gap="sm" wrap="wrap">
                  <SegmentedControl
                    size="xs"
                    value={filterType}
                    onChange={setFilterType}
                    data={[
                      { label: `Todos (${scanData.issues.length})`, value: 'all' },
                      { label: `Pendentes (${activeCount})`, value: 'pending' },
                      { label: `Resolvidos (${ignoredCount})`, value: 'ignored' },
                      { label: `Modificados (${summary?.modified || 0})`, value: 'modified' },
                      { label: `Suspeitos (${summary?.suspicious || 0})`, value: 'suspicious' },
                      { label: `Ausentes (${summary?.missing || 0})`, value: 'missing' },
                    ]}
                  />

                  <TextInput
                    placeholder="Filtrar por nome do arquivo..."
                    size="xs"
                    leftSection={<IconSearch size={14} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    style={{ minWidth: 220 }}
                  />
                </Group>
              )}
            </Group>

            {scanData.issues.length === 0 ? (
              <Box p="xl" ta="center">
                <ThemeIcon size={64} radius="xl" color="green" variant="light" mb="sm">
                  <IconShieldCheck size={36} />
                </ThemeIcon>
                <Title order={4} c="green.4">
                  Nenhuma Anomalia Detectada
                </Title>
                <Text size="sm" c="dimmed" mt={4} maw={500} mx="auto">
                  Todos os arquivos do sistema core foram verificados contra os checksums oficiais do
                  WordPress.org e estão perfeitamente autênticos.
                </Text>
              </Box>
            ) : filteredIssues.length === 0 ? (
              <Box p="lg" ta="center">
                <Text size="sm" c="dimmed">
                  Nenhum arquivo corresponde aos filtros aplicados.
                </Text>
              </Box>
            ) : (
              <Table striped highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Arquivo / Caminho</Table.Th>
                    <Table.Th>Classificação</Table.Th>
                    <Table.Th>Severidade</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Detalhes Técnicos</Table.Th>
                    <Table.Th>Ações</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredIssues.map((issue, idx) => {
                    const isIgnored = !!issue.is_ignored;
                    const isToggling = actionLoadingFile === issue.file;
                    const canDelete = issue.type !== 'missing';
                    const canRestore = (issue.type === 'modified' || issue.type === 'missing') && !issue.file.startsWith('wp-content/');

                    return (
                      <Table.Tr
                        key={idx}
                        style={{
                          opacity: isIgnored ? 0.75 : 1,
                        }}
                      >
                        <Table.Td style={{ maxWidth: 260 }}>
                          <Group gap="xs" wrap="nowrap">
                            <ThemeIcon
                              size="sm"
                              radius="sm"
                              color={
                                isIgnored
                                  ? 'gray'
                                  : issue.type === 'modified'
                                  ? 'red'
                                  : issue.type === 'suspicious'
                                  ? 'orange'
                                  : 'yellow'
                              }
                              variant="light"
                            >
                              <IconFileCode size={14} />
                            </ThemeIcon>
                            <div>
                              <Text size="sm" fw={600} style={{ wordBreak: 'break-all' }}>
                                {issue.file}
                              </Text>
                              {issue.size ? (
                                <Text size="xs" c="dimmed">
                                  Tamanho: {(issue.size / 1024).toFixed(1)} KB
                                </Text>
                              ) : null}
                            </div>
                          </Group>
                        </Table.Td>

                        <Table.Td>
                          {issue.type === 'modified' && (
                            <Badge color="red" variant="light" size="sm">
                              Modificado
                            </Badge>
                          )}
                          {issue.type === 'suspicious' && (
                            <Badge color="orange" variant="light" size="sm">
                              Suspeito
                            </Badge>
                          )}
                          {issue.type === 'missing' && (
                            <Badge color="yellow" variant="light" size="sm">
                              Ausente
                            </Badge>
                          )}
                        </Table.Td>

                        <Table.Td>
                          <Badge
                            color={
                              issue.severity === 'CRITICAL'
                                ? 'red'
                                : issue.severity === 'HIGH'
                                ? 'orange'
                                : 'yellow'
                            }
                            variant="filled"
                            size="xs"
                          >
                            {issue.severity}
                          </Badge>
                        </Table.Td>

                        <Table.Td>
                          {isIgnored ? (
                            <Tooltip
                              label={`Ignorado em ${formatDateTime(issue.ignored_at, 'Data anterior')}. Se este arquivo for removido do servidor, a regra será limpa automaticamente.`}
                              multiline
                              w={260}
                            >
                              <Badge color="teal" variant="light" size="sm" leftSection={<IconCheck size={12} />}>
                                Resolvido
                              </Badge>
                            </Tooltip>
                          ) : (
                            <Badge color="red" variant="light" size="sm" leftSection={<IconAlertCircle size={12} />}>
                              Pendente
                            </Badge>
                          )}
                        </Table.Td>

                        <Table.Td style={{ maxWidth: 280 }}>
                          <Text size="xs" c="dimmed">
                            {issue.description}
                          </Text>
                          {issue.actual_hash && (
                            <Text size="xs" c="dimmed" mt={2}>
                              Hash Atual: <Code color="dark.6">{issue.actual_hash.substring(0, 10)}...</Code>
                            </Text>
                          )}
                          {issue.expected_hash && (
                            <Text size="xs" c="dimmed">
                              Hash Oficial: <Code color="dark.6">{issue.expected_hash.substring(0, 10)}...</Code>
                            </Text>
                          )}
                        </Table.Td>

                        <Table.Td style={{ minWidth: 200 }}>
                          <Group gap={6} wrap="nowrap">
                            {canRestore && (
                              <Button
                                variant="light"
                                color="blue"
                                size="xs"
                                leftSection={<IconDownload size={14} />}
                                onClick={() => handleOpenRestoreModal(issue.file)}
                              >
                                Restaurar Original
                              </Button>
                            )}

                            {isIgnored ? (
                              <Button
                                variant="subtle"
                                color="yellow"
                                size="xs"
                                loading={isToggling}
                                leftSection={<IconRestore size={14} />}
                                onClick={() => handleToggleIgnore(issue.file, true)}
                              >
                                Reativar
                              </Button>
                            ) : (
                              <Button
                                variant="light"
                                color="teal"
                                size="xs"
                                loading={isToggling}
                                leftSection={<IconCheck size={14} />}
                                onClick={() => handleToggleIgnore(issue.file, false)}
                              >
                                Ignorar
                              </Button>
                            )}

                            {canDelete && (
                              <Button
                                variant="subtle"
                                color="red"
                                size="xs"
                                leftSection={<IconTrash size={14} />}
                                onClick={() => handleOpenDeleteModal(issue.file)}
                              >
                                Excluir
                              </Button>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </>
      ) : (
        <Paper p="xl" radius="md" bg="dark.7" withBorder ta="center">
          <ThemeIcon size={64} radius="xl" color="teal" variant="light" mb="md">
            <IconFileCheck size={36} />
          </ThemeIcon>
          <Title order={4}>Nenhuma Varredura de Integridade Realizada</Title>
          <Text size="sm" c="dimmed" mt={4} maw={500} mx="auto" mb="md">
            Execute a primeira varredura para checar a autenticidade de todos os arquivos de sistema do
            WordPress contra os servidores oficiais do WordPress.org.
          </Text>
          <Button
            color="teal"
            size="sm"
            loading={scanning}
            leftSection={<IconRefresh size={16} />}
            onClick={handleRunScan}
          >
            Iniciar Primeira Varredura
          </Button>
        </Paper>
      )}

      {/* Confirmation Modal for File Deletion */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => !deleting && setDeleteModalOpened(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="red" variant="light" size="md">
              <IconAlertTriangle size={18} />
            </ThemeIcon>
            <Text fw={700}>Excluir Arquivo do Servidor</Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Você tem certeza de que deseja excluir permanentemente o seguinte arquivo da instalação do WordPress?
          </Text>

          <Paper p="xs" bg="dark.8" withBorder style={{ borderColor: '#c92a2a' }}>
            <Code block color="red.9" style={{ wordBreak: 'break-all' }}>
              {fileToDelete}
            </Code>
          </Paper>

          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            Esta ação é <b>irreversível</b> e removerá o arquivo físico do servidor. Certifique-se de que este arquivo não seja necessário para o funcionamento do seu site.
          </Alert>

          <Group justify="flex-end" gap="sm" mt="xs">
            <Button
              variant="default"
              size="sm"
              disabled={deleting}
              onClick={() => setDeleteModalOpened(false)}
            >
              Cancelar
            </Button>
            <Button
              color="red"
              size="sm"
              loading={deleting}
              leftSection={<IconTrash size={16} />}
              onClick={handleConfirmDelete}
            >
              Excluir Permanentemente
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Confirmation Modal for File Restoration */}
      <Modal
        opened={restoreModalOpened}
        onClose={() => !restoring && setRestoreModalOpened(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="blue" variant="light" size="md">
              <IconDownload size={18} />
            </ThemeIcon>
            <Text fw={700}>Restaurar Arquivo Autêntico do WordPress</Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Deseja substituir este arquivo pelo original limpo e autêntico baixado diretamente dos servidores oficiais do WordPress.org?
          </Text>

          <Paper p="xs" bg="dark.8" withBorder style={{ borderColor: '#1971c2' }}>
            <Code block color="blue.9" style={{ wordBreak: 'break-all' }}>
              {fileToRestore}
            </Code>
          </Paper>

          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
            O agente fará o download da versão exata correspondente à instalação ({scanData?.wp_version || 'Core'}), conferirá o hash de integridade e substituirá o arquivo no servidor com backup temporário de segurança.
          </Alert>

          <Group justify="flex-end" gap="sm" mt="xs">
            <Button
              variant="default"
              size="sm"
              disabled={restoring}
              onClick={() => setRestoreModalOpened(false)}
            >
              Cancelar
            </Button>
            <Button
              color="blue"
              size="sm"
              loading={restoring}
              leftSection={<IconDownload size={16} />}
              onClick={handleConfirmRestore}
            >
              Restaurar Original Agora
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
