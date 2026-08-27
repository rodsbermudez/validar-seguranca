import React, { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Text,
  Button,
  Group,
  RingProgress,
  Badge,
  Accordion,
  ThemeIcon,
  Stack,
  Grid,
  Divider,
  Loader,
  Center,
  Alert,
  Modal,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconShieldOff,
  IconShieldCheck,
  IconHistory,
  IconRotateClockwise,
} from '@tabler/icons-react';
import { api } from '../api';

interface ScanReportProps {
  website: { id: string; name: string; url: string };
  onBack: () => void;
}

export const ScanReport: React.FC<ScanReportProps> = ({ website, onBack }) => {
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const fetchScanHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/scan/history/${website.id}`);
      const historyData = res.data.data || [];
      setHistory(historyData);
      if (historyData.length > 0) {
        setScanResult(historyData[0].scan_results);
      }
    } catch (err: any) {
      setError('Erro ao carregar relatório de varredura.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScanHistory();
  }, [website.id]);

  const handleTriggerScan = async () => {
    setScanLoading(true);
    setError(null);
    try {
      const res = await api.post(`/scan/trigger/${website.id}`);
      setScanResult(res.data.data.results);
      fetchScanHistory();
    } catch (err: any) {
      setError(err.response?.data?.messages?.error || err.response?.data?.error || 'Erro ao executar a auditoria.');
    } finally {
      setScanLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return <Badge color="green" leftSection={<IconCheck size={12} />}>SEGURO</Badge>;
      case 'FAIL':
        return <Badge color="red" leftSection={<IconX size={12} />}>FALHA</Badge>;
      case 'WARN':
        return <Badge color="yellow" leftSection={<IconAlertTriangle size={12} />}>ALERTA</Badge>;
      default:
        return <Badge color="gray">{status}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'teal';
    if (score >= 75) return 'blue';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
  };

  if (loading) {
    return (
      <Paper p="xl" radius="md" withBorder>
        <Center style={{ minHeight: 300 }}>
          <Stack align="center">
            <Loader color="indigo" size="lg" />
            <Text c="dimmed">Carregando relatório de auditoria...</Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  return (
    <Paper p="md" radius="md" withBorder>
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
            Voltar
          </Button>
          <div>
            <Title order={3}>{website.name}</Title>
            <Text c="dimmed" size="xs">
              {website.url}
            </Text>
          </div>
        </Group>

        <Group gap="xs">
          {history.length > 0 && (
            <Button
              variant="default"
              leftSection={<IconHistory size={16} />}
              onClick={() => setHistoryModalOpen(true)}
            >
              Histórico ({history.length})
            </Button>
          )}
          <Button
            color="indigo"
            leftSection={<IconRotateClockwise size={16} />}
            loading={scanLoading}
            onClick={handleTriggerScan}
          >
            Executar Nova Varredura
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" mb="md" onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      )}

      {!scanResult ? (
        <Paper p="xl" ta="center" bg="dark.7" radius="md" my="xl">
          <IconShieldOff size={50} style={{ opacity: 0.5 }} />
          <Text mt="md" fw={600} size="lg">Nenhuma varredura realizada para este site.</Text>
          <Text c="dimmed" size="sm" mb="lg">
            Inicie a auditoria automatizada de segurança para analisar cabeçalhos, vazamento de arquivos e enumeração.
          </Text>
          <Button color="indigo" size="md" loading={scanLoading} onClick={handleTriggerScan}>
            Iniciar Varredura Agora
          </Button>
        </Paper>
      ) : (
        <Stack gap="lg">
          {/* Summary Dashboard Header */}
          <Paper p="lg" radius="md" bg="dark.8" withBorder>
            <Grid align="center">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Group justify="center">
                  <RingProgress
                    size={150}
                    thickness={14}
                    roundCaps
                    sections={[{ value: scanResult.score, color: getScoreColor(scanResult.score) }]}
                    label={
                      <Stack align="center" gap={0}>
                        <Text ta="center" fz={32} fw={800} lh={1}>
                          {scanResult.score}
                        </Text>
                        <Text ta="center" size="xs" c="dimmed" fw={700}>
                          GRADE {scanResult.grade}
                        </Text>
                      </Stack>
                    }
                  />
                </Group>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 8 }}>
                <Stack gap="xs">
                  <Text size="sm" fw={700} c="dimmed">
                    RESUMO DA AUDITORIA ({scanResult.scanned_at})
                  </Text>

                  <Group gap="md" mt="xs">
                    <Paper p="xs" px="md" radius="sm" bg="dark.6">
                      <Text size="xs" c="dimmed">Checagens</Text>
                      <Text fw={700}>{scanResult.summary.total_checks}</Text>
                    </Paper>

                    <Paper p="xs" px="md" radius="sm" bg="dark.6">
                      <Text size="xs" c="green.4">Aprovados</Text>
                      <Text fw={700} c="green.4">{scanResult.summary.passed}</Text>
                    </Paper>

                    <Paper p="xs" px="md" radius="sm" bg="dark.6">
                      <Text size="xs" c="red.4">Falhas Críticas</Text>
                      <Text fw={700} c="red.4">{scanResult.summary.failed}</Text>
                    </Paper>

                    <Paper p="xs" px="md" radius="sm" bg="dark.6">
                      <Text size="xs" c="yellow.4">Alertas</Text>
                      <Text fw={700} c="yellow.4">{scanResult.summary.warnings}</Text>
                    </Paper>
                  </Group>
                </Stack>
              </Grid.Col>
            </Grid>
          </Paper>

          {/* Categorized Security Checks Accordion */}
          <Title order={4} mt="md">Detalhes dos Testes de Segurança</Title>

          <Accordion variant="separated" radius="md">
            {Object.entries(scanResult.categories || {}).map(([key, category]: [string, any]) => (
              <Accordion.Item key={key} value={key}>
                <Accordion.Control>
                  <Group justify="space-between" pr="md">
                    <Group gap="sm">
                      <ThemeIcon size="md" radius="sm" color="indigo" variant="light">
                        <IconShieldCheck size={18} />
                      </ThemeIcon>
                      <Text fw={600}>{category.category_name}</Text>
                    </Group>

                    <Group gap="xs">
                      <Badge color="green" size="xs">
                        {category.checks.filter((c: any) => c.status === 'PASS').length} OK
                      </Badge>
                      <Badge color="red" size="xs">
                        {category.checks.filter((c: any) => c.status === 'FAIL').length} Falhas
                      </Badge>
                    </Group>
                  </Group>
                </Accordion.Control>

                <Accordion.Panel>
                  <Stack gap="sm" mt="xs">
                    {category.checks.map((check: any) => (
                      <Paper key={check.id} p="sm" radius="sm" bg="dark.7" withBorder>
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Group gap="xs">
                              {getStatusBadge(check.status)}
                              <Text fw={600} size="sm">{check.name}</Text>
                              <Badge size="xs" variant="outline" color={check.severity === 'CRITICAL' || check.severity === 'HIGH' ? 'red' : 'gray'}>
                                {check.severity}
                              </Badge>
                            </Group>
                            <Text size="xs" c="dimmed" mt={4}>
                              {check.description}
                            </Text>
                            <Divider my={6} style={{ opacity: 0.1 }} />
                            <Text size="xs" fw={500} color={check.status === 'FAIL' ? 'red.3' : check.status === 'WARN' ? 'yellow.3' : 'gray.4'}>
                              👉 {check.details}
                            </Text>
                          </div>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Stack>
      )}

      {/* Modal Histórico de Varreduras */}
      <Modal
        opened={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Histórico de Auditorias Executadas"
        size="lg"
        centered
      >
        <Stack gap="sm">
          {history.map((item) => (
            <Paper key={item.id} p="sm" radius="md" withBorder bg="dark.7">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed">
                    Executado em: {new Date(item.executed_at).toLocaleString('pt-BR')}
                  </Text>
                  <Group gap="xs" mt={4}>
                    <Badge color={getScoreColor(item.score)}>SCORE: {item.score} / 100</Badge>
                    <Badge variant="outline" color="gray">
                      STATUS: {item.status.toUpperCase()}
                    </Badge>
                  </Group>
                </div>
                <Button
                  size="xs"
                  variant="light"
                  color="indigo"
                  onClick={() => {
                    setScanResult(item.scan_results);
                    setHistoryModalOpen(false);
                  }}
                >
                  Visualizar Relatório
                </Button>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Modal>
    </Paper>
  );
};
