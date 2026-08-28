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
  Textarea,
  Tooltip,
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
  IconPlugConnected,
  IconDownload,
  IconSparkles,
  IconShieldPlus,
  IconServer,
  IconUserCheck,
  IconPlug,
  IconPrinter,
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
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Remediation & Solutions State
  const [catalogSolutions, setCatalogSolutions] = useState<Record<string, any>>({});
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Batch Generation State
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);

  // Single Check AI Generation State
  const [generatingCheckId, setGeneratingCheckId] = useState<string | null>(null);

  // Remediation Plugin Modal State
  const [remediationModalOpen, setRemediationModalOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [pluginGenerating, setPluginGenerating] = useState(false);
  const [remediationError, setRemediationError] = useState<string | null>(null);

  // Server Guide Modal State
  const [serverGuideModalOpen, setServerGuideModalOpen] = useState(false);
  const [serverGuideLoading, setServerGuideLoading] = useState(false);
  const [serverGuideHtml, setServerGuideHtml] = useState<string | null>(null);
  const [serverGuideError, setServerGuideError] = useState<string | null>(null);

  const fetchSolutionsCatalog = async () => {
    try {
      const res = await api.get('/solutions');
      setCatalogSolutions(res.data.by_check_id || {});
    } catch (e) {
      // Catalog optional fallback
    }
  };

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
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {}
    }
    fetchScanHistory();
    fetchSolutionsCatalog();
  }, [website.id]);

  const isAdmin = currentUser?.role === 'admin';

  const handleTriggerScan = async () => {
    setScanLoading(true);
    setError(null);
    try {
      const res = await api.post(`/scan/trigger/${website.id}`);
      setScanResult(res.data.data.results);
      fetchScanHistory();
      fetchSolutionsCatalog();
    } catch (err: any) {
      setError(err.response?.data?.messages?.error || err.response?.data?.error || 'Erro ao executar a auditoria.');
    } finally {
      setScanLoading(false);
    }
  };

  const handleDownloadAgentPlugin = async () => {
    setDownloadLoading(true);
    try {
      const response = await api.get(`/websites/${website.id}/download-plugin`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `validar-seguranca-agent-${website.name.replace(/\s+/g, '_').toLowerCase()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert('Erro ao baixar o plugin agente do WordPress.');
    } finally {
      setDownloadLoading(false);
    }
  };

  // Generate batch AI solutions (Admin)
  const handleBatchGenerateSolutions = async () => {
    if (!history.length && !scanResult) return;
    const currentScanId = history.length > 0 ? history[0].id : null;
    setBatchLoading(true);
    setBatchMsg(null);
    try {
      const res = await api.post('/solutions/generate-batch', {
        scan_id: currentScanId,
        force: false,
      });
      setBatchMsg(`Geração em lote concluída: ${res.data.processed} solução(ões) processada(s) via IA Kimi K2.7 Code.`);
      await fetchSolutionsCatalog();
    } catch (err: any) {
      alert(err.response?.data?.messages?.error || 'Falha no processamento em lote da IA.');
    } finally {
      setBatchLoading(false);
    }
  };

  // Generate single check AI solution (Admin)
  const handleGenerateSingleSolution = async (check: any) => {
    const checkId = check.id || check.check_id;
    setGeneratingCheckId(checkId);
    try {
      await api.post('/solutions/generate-single', {
        check_id: checkId,
        check_name: check.name || check.check_name,
        details: check.details || check.description || '',
        severity: check.severity || 'medium',
      });
      await fetchSolutionsCatalog();
    } catch (err: any) {
      alert(err.response?.data?.messages?.error || 'Erro ao gerar solução para esta falha.');
    } finally {
      setGeneratingCheckId(null);
    }
  };

  // Generate Remediation Plugin ZIP
  const handleGenerateRemediationPlugin = async () => {
    const currentScanId = history.length > 0 ? history[0].id : null;
    setPluginGenerating(true);
    setRemediationError(null);
    try {
      const response = await api.post(
        '/remediation/generate-plugin',
        {
          scan_id: currentScanId,
          website_id: website.id,
          custom_prompt: customPrompt,
        },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const siteHost = website.url.replace(/^https?:\/\//, '').replace(/[\/\?#].*$/, '');
      link.setAttribute('download', `validar-seguranca-fix-${siteHost}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setRemediationModalOpen(false);
    } catch (err: any) {
      let msg = 'Erro ao gerar o plugin de remediação.';
      if (err.response && err.response.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          msg = json.messages?.error || json.error || msg;
        } catch (e) {}
      }
      setRemediationError(msg);
    } finally {
      setPluginGenerating(false);
    }
  };

  useEffect(() => {
    if (scanResult) {
      setServerGuideHtml(scanResult.server_guide_html || null);
    }
  }, [scanResult]);

  // Generate Server & Manual Fixes Step-by-Step Guide via AI
  const handleFetchServerGuide = async (forceRefresh = false) => {
    const currentScanId = history.length > 0 ? history[0].id : null;

    if (!forceRefresh && scanResult?.server_guide_html) {
      setServerGuideHtml(scanResult.server_guide_html);
      return;
    }

    setServerGuideLoading(true);
    setServerGuideError(null);
    try {
      const res = await api.post('/remediation/generate-server-guide', {
        scan_id: currentScanId,
        website_id: website.id,
        force_refresh: forceRefresh,
      });
      const html = res.data.guide_html || null;
      setServerGuideHtml(html);

      if (scanResult && html) {
        setScanResult({
          ...scanResult,
          server_guide_html: html,
          server_guide_generated_at: res.data.generated_at,
        });
      }
    } catch (err: any) {
      setServerGuideError(err.response?.data?.messages?.error || err.response?.data?.error || 'Erro ao gerar o guia do servidor.');
    } finally {
      setServerGuideLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return <Badge color="green" leftSection={<IconCheck size={12} />}>SEGURO</Badge>;
      case 'FAIL':
        return <Badge color="red" leftSection={<IconX size={12} />}>FALHA</Badge>;
      case 'WARN':
      case 'WARNING':
      case 'ALERTA':
        return <Badge color="yellow" leftSection={<IconAlertTriangle size={12} />}>ALERTA</Badge>;
      default:
        return <Badge color="gray">{status}</Badge>;
    }
  };

  const getActionBadge = (checkId: string) => {
    const sol = catalogSolutions[checkId];
    if (!sol) {
      return (
        <Badge color="gray" variant="outline" size="xs">
          Triagem Pendente
        </Badge>
      );
    }
    switch (sol.action_type) {
      case 'PLUGIN_AUTO_FIX':
        return (
          <Badge color="cyan" variant="filled" size="xs" leftSection={<IconPlug size={10} />}>
            ⚡ Correção via Plugin
          </Badge>
        );
      case 'SERVER_CONFIG':
        return (
          <Badge color="orange" variant="filled" size="xs" leftSection={<IconServer size={10} />}>
            🖥️ Configuração no Servidor
          </Badge>
        );
      case 'MANUAL_ACTION':
        return (
          <Badge color="gray" variant="filled" size="xs" leftSection={<IconUserCheck size={10} />}>
            👤 Ação Manual
          </Badge>
        );
      default:
        return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'teal';
    if (score >= 75) return 'blue';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
  };

  // Collect checks eligible for plugin fix
  const getPluginFixableChecks = () => {
    if (!scanResult || !scanResult.categories) return [];
    const fixable: any[] = [];
    Object.values(scanResult.categories).forEach((cat: any) => {
      (cat.checks || []).forEach((c: any) => {
        const isFailed = c.status === 'FAIL' || c.status === 'WARN' || c.status === 'WARNING' || c.status === 'ALERTA' || c.status === 'FALHA';
        const sol = catalogSolutions[c.id || c.check_id];
        if (isFailed && sol && sol.action_type === 'PLUGIN_AUTO_FIX') {
          fixable.push({ check: c, solution: sol });
        }
      });
    });
    return fixable;
  };

  const pluginFixableList = getPluginFixableChecks();

  // Collect checks requiring Server Config or Manual Action
  const getServerFixableChecks = () => {
    if (!scanResult || !scanResult.categories) return [];
    const serverItems: any[] = [];
    Object.values(scanResult.categories).forEach((cat: any) => {
      (cat.checks || []).forEach((c: any) => {
        const isFailed = c.status === 'FAIL' || c.status === 'WARN' || c.status === 'WARNING' || c.status === 'ALERTA' || c.status === 'FALHA';
        const sol = catalogSolutions[c.id || c.check_id];
        // Skip plugin fixes, keep server config, manual action, or uncataloged failed checks
        if (isFailed && (!sol || sol.action_type !== 'PLUGIN_AUTO_FIX')) {
          serverItems.push({ check: c, solution: sol });
        }
      });
    });
    return serverItems;
  };

  const serverFixableList = getServerFixableChecks();

  if (loading) {
    return (
      <Paper p="xl" radius="md" withBorder bg="dark.8">
        <Center style={{ minHeight: 300 }}>
          <Stack align="center">
            <Loader color="indigo" size="lg" />
            <Text c="dimmed">Carregando relatório de auditoria e soluções...</Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  return (
    <Paper p="md" radius="md" withBorder bg="dark.8">
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
            Voltar
          </Button>
          <div>
            <Group gap="xs">
              <Title order={3}>{website.name}</Title>
              {scanResult?.is_hybrid && (
                <Badge color="teal" variant="filled" leftSection={<IconPlugConnected size={12} />}>
                  AUDITORIA HÍBRIDA (AGENTE ATIVO)
                </Badge>
              )}
            </Group>
            <Text c="dimmed" size="xs">
              {website.url}
            </Text>
          </div>
        </Group>

        <Group gap="xs">
          <Button
            variant="light"
            color="teal"
            leftSection={<IconDownload size={16} />}
            loading={downloadLoading}
            onClick={handleDownloadAgentPlugin}
          >
            Baixar Agente
          </Button>

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

      {batchMsg && (
        <Alert icon={<IconCheck size={16} />} color="green" mb="md" onClose={() => setBatchMsg(null)} withCloseButton>
          {batchMsg}
        </Alert>
      )}

      {!scanResult ? (
        <Paper p="xl" ta="center" bg="dark.7" radius="md" my="xl">
          <IconShieldOff size={50} style={{ opacity: 0.5 }} />
          <Text mt="md" fw={600} size="lg">Nenhuma varredura realizada para este site.</Text>
          <Text c="dimmed" size="sm" mb="lg">
            Inicie a auditoria automatizada de segurança para analisar cabeçalhos, vazamento de arquivos e enumeração.
          </Text>
          <Group justify="center" gap="md">
            <Button variant="light" color="teal" size="md" loading={downloadLoading} onClick={handleDownloadAgentPlugin} leftSection={<IconDownload size={18} />}>
              Baixar Plugin Agente
            </Button>
            <Button color="indigo" size="md" loading={scanLoading} onClick={handleTriggerScan}>
              Iniciar Varredura Agora
            </Button>
          </Group>
        </Paper>
      ) : (
        <Stack gap="lg">
          {/* Action Bar for Remediation & AI */}
          <Paper p="md" radius="md" bg="dark.7" style={{ border: '1px solid #373A40' }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="sm" fw={700} c="indigo.3">
                  🛡️ Remediação e Correção Automatizada por IA
                </Text>
                <Text size="xs" c="dimmed">
                  Gere um plugin customizado de correção para sanar as falhas elegíveis deste site.
                </Text>
              </div>

              <Group gap="xs">
                {isAdmin && (
                  <Button
                    variant="gradient"
                    gradient={{ from: 'indigo', to: 'violet' }}
                    leftSection={<IconSparkles size={16} />}
                    loading={batchLoading}
                    onClick={handleBatchGenerateSolutions}
                  >
                    ✨ Gerar Soluções em Lote (IA)
                  </Button>
                )}

                <Button
                  color="orange"
                  variant="filled"
                  leftSection={<IconServer size={18} />}
                  onClick={() => {
                    setServerGuideModalOpen(true);
                    if (!serverGuideHtml) {
                      handleFetchServerGuide();
                    }
                  }}
                >
                  📄 Guia do Servidor / Ações Manuais ({serverFixableList.length})
                </Button>

                <Button
                  color="teal"
                  variant="filled"
                  leftSection={<IconShieldPlus size={18} />}
                  onClick={() => {
                    setRemediationError(null);
                    setRemediationModalOpen(true);
                  }}
                >
                  🛡️ Gerar Plugin de Correção Customizado
                </Button>
              </Group>
            </Group>
          </Paper>

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

                  <Group gap="md" mt="xs" style={{ width: '100%' }}>
                    <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 100, borderColor: '#373A40' }}>
                      <Text size="xs" c="dimmed" fw={600} ta="center">Checagens</Text>
                      <Text fw={800} fz={22} ta="center">{scanResult.summary.total_checks}</Text>
                    </Paper>

                    <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 100, borderColor: '#373A40' }}>
                      <Text size="xs" c="green.4" fw={600} ta="center">Aprovados</Text>
                      <Text fw={800} fz={22} c="green.4" ta="center">{scanResult.summary.passed}</Text>
                    </Paper>

                    <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 100, borderColor: '#373A40' }}>
                      <Text size="xs" c="red.4" fw={600} ta="center">Falhas Críticas</Text>
                      <Text fw={800} fz={22} c="red.4" ta="center">{scanResult.summary.failed}</Text>
                    </Paper>

                    <Paper p="xs" px="md" radius="md" bg="dark.6" withBorder ta="center" style={{ flex: 1, minWidth: 100, borderColor: '#373A40' }}>
                      <Text size="xs" c="yellow.4" fw={600} ta="center">Alertas</Text>
                      <Text fw={800} fz={22} c="yellow.4" ta="center">{scanResult.summary.warnings}</Text>
                    </Paper>
                  </Group>
                </Stack>
              </Grid.Col>
            </Grid>
          </Paper>

          {/* Categorized Security Checks Accordion */}
          <Title order={4} mt="md">Detalhes dos Testes de Segurança</Title>

          <Accordion
            variant="separated"
            radius="md"
            styles={{
              item: {
                border: '1px solid #373A40',
                backgroundColor: '#111111',
                borderRadius: '8px',
                marginBottom: '10px',
              },
              control: {
                borderRadius: '8px',
              },
            }}
          >
            {Object.entries(scanResult.categories || {}).map(([key, category]: [string, any]) => (
              <Accordion.Item key={key} value={key} style={{ border: '1px solid #373A40' }}>
                <Accordion.Control>
                  <Group justify="space-between" pr="md">
                    <Group gap="sm">
                      <ThemeIcon size="md" radius="sm" color={key === 'internal_agent' ? 'teal' : 'indigo'} variant="light">
                        {key === 'internal_agent' ? <IconPlugConnected size={18} /> : <IconShieldCheck size={18} />}
                      </ThemeIcon>
                      <div>
                        <Text fw={600}>{category.category_name}</Text>
                        {category.status_error && (
                          <Text size="xs" c="red.4">{category.status_error}</Text>
                        )}
                      </div>
                    </Group>

                    <Group gap="xs">
                      {category.checks && category.checks.length > 0 ? (
                        <>
                          <Badge color="green" size="xs">
                            {category.checks.filter((c: any) => c.status === 'PASS').length} OK
                          </Badge>
                          <Badge color="red" size="xs">
                            {category.checks.filter((c: any) => c.status === 'FAIL' || c.status === 'WARN').length} Falhas
                          </Badge>
                        </>
                      ) : (
                        <Badge color="gray" size="xs">Indisponível</Badge>
                      )}
                    </Group>
                  </Group>
                </Accordion.Control>

                <Accordion.Panel>
                  <Stack gap="sm" mt="xs">
                    {category.checks && category.checks.length > 0 ? (
                      category.checks.map((check: any) => {
                        const checkId = check.id || check.check_id;
                        const sol = catalogSolutions[checkId];
                        const isFailed = check.status === 'FAIL' || check.status === 'WARN' || check.status === 'WARNING' || check.status === 'ALERTA' || check.status === 'FALHA';

                        return (
                          <Paper key={checkId} p="sm" radius="sm" bg="dark.7" withBorder style={{ borderColor: isFailed ? '#991B1B' : '#2C2E33' }}>
                            <Group justify="space-between" align="flex-start">
                              <div style={{ flex: 1 }}>
                                <Group gap="xs" mb={4}>
                                  {getStatusBadge(check.status)}
                                  <Text fw={600} size="sm">{check.name}</Text>
                                  <Badge size="xs" variant="outline" color={check.severity === 'CRITICAL' || check.severity === 'HIGH' ? 'red' : 'gray'}>
                                    {check.severity}
                                  </Badge>
                                  {getActionBadge(checkId)}
                                </Group>

                                <Text size="xs" c="dimmed">
                                  {check.description}
                                </Text>
                                <Divider my={6} style={{ opacity: 0.1 }} />
                                <Text size="xs" fw={500} color={isFailed ? 'red.3' : 'gray.4'}>
                                  👉 {check.details}
                                </Text>

                                {/* Solution Catalog Info Card if Available */}
                                {sol && (
                                  <Paper p="xs" mt="xs" bg="dark.8" radius="xs" style={{ borderLeft: '3px solid #4C6EF5' }}>
                                    <Text size="xs" fw={700} c="indigo.3">
                                      💡 Solução Recomendada: {sol.solution_title}
                                    </Text>
                                    <Text size="xs" c="gray.3" mt={2} style={{ whitespace: 'pre-line' }}>
                                      {sol.solution_instructions}
                                    </Text>
                                  </Paper>
                                )}
                              </div>

                              {/* Admin Action Button for Single Check AI Generation */}
                              {isAdmin && isFailed && (
                                <Tooltip label="Gerar / Atualizar solução específica com IA (Kimi K2.7 Code)">
                                  <Button
                                    size="xs"
                                    variant="light"
                                    color="violet"
                                    leftSection={<IconSparkles size={12} />}
                                    loading={generatingCheckId === checkId}
                                    onClick={() => handleGenerateSingleSolution(check)}
                                  >
                                    Gerar Solução (IA)
                                  </Button>
                                </Tooltip>
                              )}
                            </Group>
                          </Paper>
                        );
                      })
                    ) : (
                      <Text size="sm" c="dimmed">Nenhuma verificação executada nesta categoria.</Text>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Stack>
      )}

      {/* Remediation Plugin Modal */}
      <Modal
        opened={remediationModalOpen}
        onClose={() => setRemediationModalOpen(false)}
        title={
          <Group gap="xs">
            <IconShieldPlus size={22} color="#10B981" />
            <Text fw={700}>Gerar Plugin Customizado de Remediação</Text>
          </Group>
        }
        size="lg"
        radius="md"
      >
        <Stack gap="md">
          {remediationError && (
            <Alert color="red" icon={<IconAlertTriangle size={16} />}>
              {remediationError}
            </Alert>
          )}

          <Text size="sm">
            Este recurso irá compor e sintetizar via <b>IA (Kimi K2.7 Code)</b> um plugin WordPress exclusivo (ZIP) adaptado especificamente às falhas do seu site.
          </Text>

          <Paper p="xs" bg="dark.7" radius="sm">
            <Text size="xs" fw={700} c="teal.3" mb={4}>
              ⚡ FALHAS ELEGÍVEIS PARA CORREÇÃO VIA PLUGIN ({pluginFixableList.length}):
            </Text>
            {pluginFixableList.length === 0 ? (
              <Text size="xs" c="yellow.4">
                Nenhuma falha catalogada como <b>PLUGIN_AUTO_FIX</b> foi encontrada. Execute "Gerar Soluções em Lote" com perfil Admin ou verifique se as falhas do site requerem alterações manuais no servidor.
              </Text>
            ) : (
              <Stack gap={4}>
                {pluginFixableList.map((item, idx) => (
                  <Text key={idx} size="xs" c="gray.3">
                    • <b>{item.check.name}</b>: {item.solution.solution_title}
                  </Text>
                ))}
              </Stack>
            )}
          </Paper>

          <Textarea
            label="Prompt / Instruções Adicionais para a IA (Opcional)"
            placeholder="Digite observações importantes, ex: Evitar conflitos com o plugin Elementor, não desativar REST API para usuários logados, etc."
            rows={3}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.currentTarget.value)}
          />

          <Group justify="space-between" mt="md">
            <Button variant="default" onClick={() => setRemediationModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="teal"
              size="md"
              leftSection={<IconDownload size={18} />}
              loading={pluginGenerating}
              onClick={handleGenerateRemediationPlugin}
            >
              🚀 Gerar e Baixar Plugin (ZIP)
            </Button>
          </Group>
        </Stack>
      </Modal>

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
                    {item.scan_results?.is_hybrid && (
                      <Badge color="teal" size="xs">HÍBRIDO</Badge>
                    )}
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
      {/* Modal Guia do Servidor e Ações Manuais */}
      <Modal
        opened={serverGuideModalOpen}
        onClose={() => setServerGuideModalOpen(false)}
        title={
          <Group gap="xs">
            <IconServer size={22} color="#F97316" />
            <Text fw={700} size="md" c="white">Guia de Resolução: Servidor & Ações Manuais</Text>
          </Group>
        }
        size="xl"
        radius="md"
        centered
        styles={{
          header: {
            backgroundColor: '#1A1B1E',
            borderBottom: '1px solid #2C2E33',
            padding: '14px 20px',
          },
          body: {
            backgroundColor: '#141517',
            padding: '20px',
          },
          content: {
            backgroundColor: '#141517',
            border: '1px solid #2C2E33',
          }
        }}
      >
        <Stack gap="md">
          {serverGuideError && (
            <Alert color="red" icon={<IconAlertTriangle size={16} />}>
              {serverGuideError}
            </Alert>
          )}

          <Group justify="space-between" align="center">
            <div>
              <Text size="sm" c="dimmed">
                Instruções detalhadas geradas por <b>IA (Kimi K2.7 Code)</b> para falhas que exigem acesso SSH/cPanel, edições em <code>.htaccess</code>, <code>nginx.conf</code>, <code>php.ini</code> ou <code>wp-config.php</code>.
              </Text>
              {scanResult?.server_guide_generated_at && (
                <Text size="xs" c="orange.4" mt={2} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  💾 Guia salvo em: <b>{new Date(scanResult.server_guide_generated_at).toLocaleString('pt-BR')}</b>
                </Text>
              )}
            </div>

            <Group gap="xs" wrap="nowrap">
              <Button
                size="xs"
                variant="light"
                color="orange"
                leftSection={<IconRotateClockwise size={14} />}
                loading={serverGuideLoading}
                onClick={() => handleFetchServerGuide(true)}
                title="Consultar a IA para gerar um novo guia atualizado"
              >
                Atualizar Instruções (IA)
              </Button>
              {serverGuideHtml && (
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconPrinter size={14} />}
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Guia de Remediação do Servidor - ${website.name}</title>
                            <style>
                              body { font-family: system-ui, sans-serif; padding: 30px; line-height: 1.6; color: #111; }
                              pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; border: 1px solid #ccc; }
                              code { font-family: monospace; }
                              h3 { color: #d97706; margin-top: 24px; border-bottom: 2px solid #fef3c7; padding-bottom: 6px; }
                              .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #eee; }
                            </style>
                          </head>
                          <body>
                            <h1>🛡️ Guia de Remediação do Servidor: ${website.name}</h1>
                            <p><b>URL:</b> ${website.url} | <b>Data:</b> ${new Date().toLocaleString('pt-BR')}</p>
                            <hr/>
                            ${serverGuideHtml}
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                      printWindow.focus();
                      printWindow.print();
                    }
                  }}
                >
                  Imprimir / PDF
                </Button>
              )}
            </Group>
          </Group>

          {/* List of server issues covered */}
          <Paper p="xs" bg="dark.7" radius="sm">
            <Text size="xs" fw={700} c="orange.3" mb={4}>
              📋 FALHAS DO SERVIDOR / AÇÕES MANUAIS PROCESSADAS ({serverFixableList.length}):
            </Text>
            {serverFixableList.length === 0 ? (
              <Text size="xs" c="green.4">
                Nenhuma falha de servidor detectada neste relatório!
              </Text>
            ) : (
              <Stack gap={4}>
                {serverFixableList.map((item, idx) => (
                  <Group key={idx} justify="space-between">
                    <Text size="xs" c="gray.3">
                      • <b>{item.check.name}</b> {item.solution ? `(${item.solution.solution_title})` : ''}
                    </Text>
                    {getActionBadge(item.check.id || item.check.check_id)}
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>

          <Divider my="xs" />

          {serverGuideLoading ? (
            <Center style={{ minHeight: 200 }}>
              <Stack align="center" gap="sm">
                <Loader color="orange" size="lg" />
                <Text size="sm" c="dimmed">
                  IA Kimi K2.7 Code analisando infraestrutura e compondo o guia passo a passo...
                </Text>
              </Stack>
            </Center>
          ) : serverGuideHtml ? (
            <Paper p="md" bg="dark.9" radius="sm" style={{ border: '1px solid #373A40', maxHeight: '60vh', overflowY: 'auto' }}>
              <div
                className="server-guide-content"
                dangerouslySetInnerHTML={{ __html: serverGuideHtml }}
                style={{
                  color: '#E0E0E0',
                  lineHeight: '1.6',
                  fontSize: '14px',
                }}
              />
            </Paper>
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Clique em "Re-gerar Guia (IA)" para obter as instruções passo a passo.
            </Text>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setServerGuideModalOpen(false)}>
              Fechar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
};
