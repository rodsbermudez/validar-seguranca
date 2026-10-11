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
} from '@tabler/icons-react';
import {
  getWebsiteIntegrity,
  scanWebsiteIntegrity,
  IntegrityScanData,
  IntegrityIssue,
} from '../api';

interface WebsiteIntegrityViewProps {
  website: { id: string | number; name: string; url: string; environment?: string };
}

export const WebsiteIntegrityView: React.FC<WebsiteIntegrityViewProps> = ({ website }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
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
        if (res.data.is_secure) {
          setSuccessMsg('Varredura concluída: Todos os arquivos do Core são 100% autênticos!');
        } else {
          setSuccessMsg(
            `Varredura concluída: Encontradas ${res.data.summary.issues_count} anomalia(s) de integridade.`
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

  const getFilteredIssues = (): IntegrityIssue[] => {
    if (!scanData || !scanData.issues) return [];

    return scanData.issues.filter((issue) => {
      const matchesFilter = filterType === 'all' || issue.type === filterType;
      const matchesSearch =
        searchQuery === '' ||
        issue.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  };

  const filteredIssues = getFilteredIssues();
  const summary = scanData?.summary;

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
                      Core 100% Autêntico e Íntegro
                    </Title>
                    <Badge color="green" variant="filled" size="sm">
                      SEGURO
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed" mt={2}>
                    Todos os <b>{summary?.total_checked}</b> arquivos do WordPress{' '}
                    <b>{scanData.wp_version}</b> correspondem com exatidão aos originais publicados pelo
                    WordPress.org. Nenhum arquivo foi adulterado ou infectado.
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Última verificação realizada em: <b>{scanData.scanned_at}</b>
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
                      Atenção: Anomalias de Integridade Detectadas!
                    </Title>
                    <Badge color="red" variant="filled" size="sm">
                      COMPROMETIDO
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed" mt={2}>
                    Foram identificadas <b>{summary?.issues_count}</b> inconsistência(s) de arquivos.
                    Isto pode indicar contaminação por malware, backdoors instalados ou arquivos do sistema corrompidos.
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Última verificação realizada em: <b>{scanData.scanned_at}</b>
                  </Text>
                </div>
              </Group>
            </Paper>
          )}

          {/* Metrics Summary Grid */}
          <Grid>
            <Grid.Col span={{ base: 6, sm: 4, md: 2.4 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7" ta="center">
                <Text size="xs" fw={600} c="dimmed">
                  Total Verificados
                </Text>
                <Text fw={800} fz={24} mt={2}>
                  {summary?.total_checked ?? 0}
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 6, sm: 4, md: 2.4 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7" ta="center">
                <Text size="xs" fw={600} c="green.4">
                  Arquivos Íntegros
                </Text>
                <Text fw={800} fz={24} c="green.4" mt={2}>
                  {summary?.passed ?? 0}
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 6, sm: 4, md: 2.4 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7" ta="center">
                <Text size="xs" fw={600} c="red.4">
                  Modificados
                </Text>
                <Text fw={800} fz={24} c="red.4" mt={2}>
                  {summary?.modified ?? 0}
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 6, sm: 4, md: 2.4 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7" ta="center">
                <Text size="xs" fw={600} c="orange.4">
                  Suspeitos / Backdoors
                </Text>
                <Text fw={800} fz={24} c="orange.4" mt={2}>
                  {summary?.suspicious ?? 0}
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 6, sm: 4, md: 2.4 }}>
              <Card padding="md" radius="md" withBorder bg="dark.7" ta="center">
                <Text size="xs" fw={600} c="yellow.4">
                  Arquivos Ausentes
                </Text>
                <Text fw={800} fz={24} c="yellow.4" mt={2}>
                  {summary?.missing ?? 0}
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
                    : `Exibindo ${filteredIssues.length} de ${scanData.issues.length} ocorrência(s).`}
                </Text>
              </div>

              {scanData.issues.length > 0 && (
                <Group gap="sm">
                  <SegmentedControl
                    size="xs"
                    value={filterType}
                    onChange={setFilterType}
                    data={[
                      { label: `Todos (${scanData.issues.length})`, value: 'all' },
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
                    <Table.Th>Detalhes Técnicos</Table.Th>
                    <Table.Th>Ação Recomendada</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredIssues.map((issue, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td style={{ maxWidth: 280 }}>
                        <Group gap="xs" wrap="nowrap">
                          <ThemeIcon
                            size="sm"
                            radius="sm"
                            color={
                              issue.type === 'modified'
                                ? 'red'
                                : issue.type === 'suspicious'
                                ? 'orange'
                                : 'yellow'
                            }
                            variant="light"
                          >
                            <IconFileCode size={14} />
                          </ThemeIcon>
                          <Text size="sm" fw={600} style={{ wordBreak: 'break-all' }}>
                            {issue.file}
                          </Text>
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
                            Suspeito / Estranho
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

                      <Table.Td style={{ maxWidth: 300 }}>
                        <Text size="xs" c="dimmed">
                          {issue.description}
                        </Text>
                        {issue.actual_hash && (
                          <Text size="xs" c="dimmed" mt={2}>
                            Hash Atual: <Code color="dark.6">{issue.actual_hash.substring(0, 12)}...</Code>
                          </Text>
                        )}
                        {issue.expected_hash && (
                          <Text size="xs" c="dimmed">
                            Hash Oficial: <Code color="dark.6">{issue.expected_hash.substring(0, 12)}...</Code>
                          </Text>
                        )}
                      </Table.Td>

                      <Table.Td style={{ maxWidth: 260 }}>
                        <Text size="xs" fw={500} c={issue.type === 'suspicious' ? 'orange.3' : 'blue.3'}>
                          {issue.recommendation}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
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
    </Stack>
  );
};
