import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Divider,
  Box,
  RingProgress,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDownload,
  IconRefresh,
  IconAlertTriangle,
  IconAlertCircle,
  IconCheck,
  IconFileCheck,
  IconTerminal,
  IconPlugConnected,
  IconWorld,
  IconPlug,
  IconPalette,
  IconRadar,
} from '@tabler/icons-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { getDiagnosticSummary, DiagnosticSummaryResponse } from '../api';
import { PATROPI_LOGO_BASE64 } from '../assets/logoBase64';

interface WebsiteDiagnosticReportViewProps {
  website: { id: string | number; name: string; url: string; environment?: string };
  onBack: () => void;
}

export const WebsiteDiagnosticReportView: React.FC<WebsiteDiagnosticReportViewProps> = ({
  website,
  onBack,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [report, setReport] = useState<DiagnosticSummaryResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getDiagnosticSummary(website.id);
      setReport(data);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          err.message ||
          'Falha ao carregar o diagnóstico completo do website.'
      );
    } finally {
      setLoading(false);
    }
  }, [website.id]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const reportRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setGeneratingPdf(true);

    try {
      const element = reportRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#1A1B1E',
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById('report-pdf-content');
          if (clonedEl) {
            clonedEl.style.width = '1120px';
            clonedEl.style.maxWidth = '1120px';
            clonedEl.style.margin = '0 auto';
          }
          const logoEl = clonedDoc.getElementById('pdf-report-logo');
          if (logoEl) {
            logoEl.style.display = 'block';
          }
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Preenche fundo escuro (#1A1B1E) na primeira página
      pdf.setFillColor(26, 27, 30);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.setFillColor(26, 27, 30);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const siteHost = website.url
        ? website.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
        : website.name.replace(/\s+/g, '-').toLowerCase();
      const siteSlug = siteHost.replace(/[^a-zA-Z0-9_\-]/g, '-');
      const dateStr = new Date().toISOString().slice(0, 10);

      pdf.save(`relatorio-diagnostico-${siteSlug}-${dateStr}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Houve um erro ao processar o download do PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const latestScan = report?.data?.latest_scan;
  const logs48h = report?.data?.logs_48h;
  const integrity = report?.data?.integrity;
  const updates = report?.data?.updates;

  const score = latestScan?.score !== undefined && latestScan?.score !== null ? Number(latestScan.score) : null;
  const grade = latestScan?.grade ?? (score !== null ? (score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F') : 'N/A');
  const scanSummary = latestScan?.summary;
  const totalChecks = scanSummary?.total_checks ?? ((scanSummary?.passed ?? 0) + (scanSummary?.failed ?? 0) + (scanSummary?.warnings ?? 0));

  const getScoreColor = (sc: number) => {
    if (sc >= 90) return 'teal';
    if (sc >= 75) return 'blue';
    if (sc >= 60) return 'yellow';
    if (sc >= 40) return 'orange';
    return 'red';
  };

  const rawScanDate = latestScan?.scanned_at || latestScan?.executed_at;
  const formattedScanDate = rawScanDate
    ? rawScanDate.includes('T')
      ? new Date(rawScanDate).toLocaleString('pt-BR')
      : rawScanDate
    : 'DATA N/D';

  const pendingPlugins = updates?.plugins?.filter((p) => p.has_update) || [];
  const pendingThemes = updates?.themes?.filter((t) => t.has_update) || [];
  const coreHasUpdate = !!updates?.core?.has_update;

  return (
    <>
      {/* Print Specific CSS to ensure spotless white paper output and hide navigation */}
      <style>{`
        @media print {
          body, html {
            background-color: #ffffff !important;
            color: #1a1a1a !important;
            font-size: 11pt !important;
          }
          .no-print, header, nav, .mantine-AppShell-header {
            display: none !important;
          }
          .report-sheet {
            background-color: #ffffff !important;
            color: #1a1a1a !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .report-card {
            background-color: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            color: #1e293b !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-text-dark {
            color: #0f172a !important;
          }
          .print-text-muted {
            color: #64748b !important;
          }
          .print-border {
            border-color: #cbd5e1 !important;
          }
          .page-break {
            page-break-before: always;
          }
          @page {
            size: A4;
            margin: 15mm 12mm 15mm 12mm;
          }
        }
      `}</style>

      <Box p={{ base: 'xs', sm: 'md', md: 'xl' }} style={{ maxWidth: 1120, margin: '0 auto' }}>
        {/* Top Action Bar (Screen Only - Hidden in Print) */}
        <Paper p="md" radius="md" bg="dark.7" withBorder mb="lg" className="no-print">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="sm">
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconArrowLeft size={16} />}
                onClick={onBack}
              >
                Voltar ao Painel do Site
              </Button>
              <Badge color="indigo" variant="light" size="lg">
                Visualização de Relatório Executivo
              </Badge>
            </Group>

            <Group gap="sm">
              <Button
                variant="light"
                color="blue"
                size="sm"
                leftSection={<IconRefresh size={16} />}
                loading={loading}
                onClick={fetchReport}
              >
                Atualizar Dados
              </Button>

              <Button
                color="indigo"
                size="sm"
                leftSection={<IconDownload size={16} />}
                loading={generatingPdf}
                onClick={handleDownloadPdf}
              >
                Baixar Relatório em PDF
              </Button>
            </Group>
          </Group>
        </Paper>

        {loading ? (
          <Center p={80}>
            <Stack align="center" gap="md">
              <Loader size="xl" color="indigo" />
              <Title order={4} c="dimmed">
                Consolidando diagnóstico de segurança e integridade...
              </Title>
              <Text size="sm" c="dimmed">
                Consultando logs das últimas 48h, varredura forense e atualizações do WordPress.
              </Text>
            </Stack>
          </Center>
        ) : errorMsg ? (
          <Alert icon={<IconAlertCircle size={18} />} title="Erro ao carregar diagnóstico" color="red">
            {errorMsg}
          </Alert>
        ) : (
          <Paper
            ref={reportRef}
            id="report-pdf-content"
            p={{ base: 'md', sm: 'xl' }}
            radius="md"
            bg="dark.8"
            withBorder
            className="report-sheet"
            style={{ borderColor: '#373a40' }}
          >
            {/* Header: Logo Exclusiva para o PDF (Oculta na tela normal para não duplicar com o header do SaaS) */}
            <div id="pdf-report-logo" style={{ display: 'none', marginBottom: 20 }}>
              <Group justify="space-between" align="center">
                <img
                  src={PATROPI_LOGO_BASE64}
                  alt="Patropi Comunica"
                  style={{ height: 42, width: 'auto', objectFit: 'contain' }}
                />
                <Badge color="green" size="sm" variant="light">
                  Validar Segurança Platform
                </Badge>
              </Group>
              <Divider my="sm" color="dark.5" />
            </div>

            {/* Header: Título & Metadados de Emissão */}
            <Group justify="space-between" align="flex-start" wrap="wrap" pb="md" style={{ borderBottom: '2px solid #475569' }}>
              <div>
                <Title order={2} style={{ letterSpacing: -0.5 }}>
                  Relatório Executivo de Diagnóstico
                </Title>
                <Text size="xs" c="dimmed" className="print-text-muted">
                  Auditoria de Segurança, Integridade do Core, Logs & Manutenção
                </Text>
              </div>

              <div style={{ textAlign: 'right' }}>
                <Text size="xs" c="dimmed" className="print-text-muted" fw={500}>
                  EMITIDO EM:
                </Text>
                <Text fw={700} size="sm">
                  {report?.generated_at ? new Date(report.generated_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}
                </Text>
                <Badge color="green" size="sm" variant="outline" mt={4}>
                  Validar Segurança Platform
                </Badge>
              </div>
            </Group>

            {/* Target Website Metadata Banner */}
            <Paper p="md" radius="sm" bg="dark.7" withBorder my="md" className="report-card">
              <Grid align="center">
                <Grid.Col span={{ base: 12, sm: 8 }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700} className="print-text-muted">
                    Website Alvo
                  </Text>
                  <Title order={3} mt={2}>
                    {report?.website.name || website.name}
                  </Title>
                  <Text size="sm" c="blue.4" component="a" href={website.url} target="_blank" rel="noreferrer">
                    {website.url}
                  </Text>
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 4 }} style={{ textAlign: 'right' }}>
                  <Group justify="flex-end" gap="xs">
                    <Badge color="red" size="md" variant="light">
                      {(report?.website.environment || website.environment || 'PRODUCTION').toUpperCase()}
                    </Badge>
                    <Badge
                      color={report?.website.is_connected ? 'teal' : 'gray'}
                      size="md"
                      variant="filled"
                      leftSection={<IconPlugConnected size={14} />}
                    >
                      {report?.website.is_connected ? 'AGENTE ATIVO' : 'SEM AGENTE'}
                    </Badge>
                  </Group>
                </Grid.Col>
              </Grid>
            </Paper>

            {/* 1. SEÇÃO: RESUMO EXECUTIVO DE AUDITORIA & SCORE */}
            <Box mb="xl" className="report-card" p="md" style={{ borderRadius: 8 }}>
              <Group justify="space-between" align="center" mb="sm">
                <Group gap="xs">
                  <ThemeIcon color="indigo" variant="light" radius="xl">
                    <IconRadar size={18} />
                  </ThemeIcon>
                  <Title order={4}>1. Avaliação de Segurança & Conformidade</Title>
                </Group>
                {latestScan && (
                  <Badge color="gray" variant="light">
                    REALIZADA EM: {formattedScanDate}
                  </Badge>
                )}
              </Group>

              {latestScan ? (
                <Grid align="center" mt="xs">
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Group justify="center">
                      <RingProgress
                        size={140}
                        thickness={12}
                        roundCaps
                        sections={[{ value: score ?? 0, color: getScoreColor(score ?? 0) }]}
                        label={
                          <Stack align="center" gap={0}>
                            <Text ta="center" fz={28} fw={800} lh={1} className="print-text-dark">
                              {score ?? 0}
                            </Text>
                            <Text ta="center" size="xs" c="dimmed" fw={700} className="print-text-muted">
                              GRADE {grade}
                            </Text>
                          </Stack>
                        }
                      />
                    </Group>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, md: 8 }}>
                    <Stack gap="xs">
                      <Group gap="md" style={{ width: '100%' }}>
                        <Paper
                          p="xs"
                          px="md"
                          radius="md"
                          bg="dark.6"
                          withBorder
                          ta="center"
                          style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}
                          className="report-card"
                        >
                          <Text size="xs" c="dimmed" fw={600} ta="center" className="print-text-muted">
                            Checagens
                          </Text>
                          <Text fw={800} fz={20} ta="center" className="print-text-dark">
                            {totalChecks}
                          </Text>
                        </Paper>

                        <Paper
                          p="xs"
                          px="md"
                          radius="md"
                          bg="dark.6"
                          withBorder
                          ta="center"
                          style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}
                          className="report-card"
                        >
                          <Text size="xs" c="green.4" fw={600} ta="center">
                            Aprovados
                          </Text>
                          <Text fw={800} fz={20} c="green.4" ta="center">
                            {scanSummary?.passed ?? 0}
                          </Text>
                        </Paper>

                        <Paper
                          p="xs"
                          px="md"
                          radius="md"
                          bg="dark.6"
                          withBorder
                          ta="center"
                          style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}
                          className="report-card"
                        >
                          <Text size="xs" c="red.4" fw={600} ta="center">
                            Falhas Críticas
                          </Text>
                          <Text fw={800} fz={20} c="red.4" ta="center">
                            {scanSummary?.failed ?? 0}
                          </Text>
                        </Paper>

                        <Paper
                          p="xs"
                          px="md"
                          radius="md"
                          bg="dark.6"
                          withBorder
                          ta="center"
                          style={{ flex: 1, minWidth: 90, borderColor: '#373A40' }}
                          className="report-card"
                        >
                          <Text size="xs" c="yellow.4" fw={600} ta="center">
                            Alertas
                          </Text>
                          <Text fw={800} fz={20} c="yellow.4" ta="center">
                            {scanSummary?.warnings ?? 0}
                          </Text>
                        </Paper>
                      </Group>

                      <Text size="xs" c="dimmed" mt="xs" className="print-text-muted">
                        Varredura com análise profunda de cabeçalhos de resposta HTTP, permissões de diretórios, exposição de arquivos sensíveis e integridade da aplicação.
                      </Text>
                    </Stack>
                  </Grid.Col>
                </Grid>
              ) : (
                <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light">
                  Nenhuma varredura de auditoria foi executada para este site ainda.
                </Alert>
              )}
            </Box>

            {/* 2. SEÇÃO: LOGS DE ERROS FATAIS (ÚLTIMAS 48 HORAS) */}
            <Box mb="xl" className="report-card" p="md" style={{ borderRadius: 8 }}>
              <Group justify="space-between" align="center" mb="sm">
                <Group gap="xs">
                  <ThemeIcon color={logs48h?.total_fatal_48h ? 'red' : 'green'} variant="light" radius="md">
                    <IconTerminal size={20} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>2. Monitoramento de Erros Fatais (Últimas 48 Horas)</Title>
                    <Text size="xs" c="dimmed" className="print-text-muted">
                      Detecção de quebras de execução PHP, incompatibilidades e paradas de serviço
                    </Text>
                  </div>
                </Group>

                <Badge
                  color={logs48h?.total_fatal_48h ? 'red' : 'green'}
                  size="md"
                  variant="filled"
                >
                  {logs48h?.total_fatal_48h ? `${logs48h.total_fatal_48h} ERRO(S) FATAL(IS)` : '0 ERROS FATAIS (100% ESTÁVEL)'}
                </Badge>
              </Group>

              {logs48h?.total_fatal_48h && logs48h.total_fatal_48h > 0 ? (
                <div>
                  <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="xs">
                    Identificamos {logs48h.total_fatal_48h} erro(s) fatal(is) no WordPress nas últimas 48 horas que demandam atenção imediata.
                  </Alert>

                  <Table striped highlightOnHover withTableBorder withColumnBorders style={{ fontSize: 12 }}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: 140 }}>Data / Hora</Table.Th>
                        <Table.Th style={{ width: 90 }}>Nível</Table.Th>
                        <Table.Th>Detalhes do Erro</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {logs48h.fatal_logs_48h.map((log, idx) => (
                        <Table.Tr key={idx}>
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>
                            <Text size="xs" fw={600}>
                              {log.timestamp}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="red" size="xs">
                              {log.level}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" style={{ wordBreak: 'break-all' }}>
                              {log.message}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              ) : (
                <Paper p="md" radius="sm" bg="rgba(43, 138, 62, 0.1)" withBorder style={{ borderColor: '#2b8a3e' }}>
                  <Group gap="sm">
                    <ThemeIcon color="green" radius="xl" size="md">
                      <IconCheck size={18} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={700} c="green.4">
                        Nenhum erro fatal ou interrupção de execução detectada nas últimas 48 horas!
                      </Text>
                      <Text size="xs" c="dimmed" className="print-text-muted">
                        O interpretador PHP e o WordPress operaram de forma contínua sem quebras catastróficas ou erros de sintaxe críticos.
                      </Text>
                    </div>
                  </Group>
                </Paper>
              )}
            </Box>

            {/* 3. SEÇÃO: INTEGRIDADE DO CORE DO WORDPRESS */}
            <Box mb="xl" className="report-card" p="md" style={{ borderRadius: 8 }}>
              <Group justify="space-between" align="center" mb="sm">
                <Group gap="xs">
                  <ThemeIcon color="teal" variant="light" radius="md">
                    <IconFileCheck size={20} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>3. Verificação Forense de Integridade do Core</Title>
                    <Text size="xs" c="dimmed" className="print-text-muted">
                      Confronto dos arquivos locais contra os hashes criptográficos oficiais do WordPress.org
                    </Text>
                  </div>
                </Group>

                {integrity && (
                  <Badge
                    color={integrity.is_secure ? 'green' : 'red'}
                    size="md"
                    variant="filled"
                  >
                    {integrity.is_secure ? 'CORE 100% AUTÊNTICO' : `${integrity.summary.active_issues || integrity.issues?.length || 0} ANOMALIA(S)`}
                  </Badge>
                )}
              </Group>

              {integrity ? (
                <>
                  <Grid mb="sm">
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <Paper p="xs" radius="sm" bg="dark.6" ta="center" className="report-card">
                        <Text size="xs" c="dimmed">Versão Analisada</Text>
                        <Text size="md" fw={700}>
                          WP {integrity.wp_version} ({integrity.locale})
                        </Text>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <Paper p="xs" radius="sm" bg="dark.6" ta="center" className="report-card">
                        <Text size="xs" c="dimmed">Arquivos Verificados</Text>
                        <Text size="md" fw={700} c="green.4">
                          {integrity.summary.passed} íntegros
                        </Text>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <Paper p="xs" radius="sm" bg="dark.6" ta="center" className="report-card">
                        <Text size="xs" c="dimmed">Modificados</Text>
                        <Text size="md" fw={700} c={integrity.summary.modified > 0 ? 'red.4' : 'dimmed'}>
                          {integrity.summary.modified}
                        </Text>
                      </Paper>
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <Paper p="xs" radius="sm" bg="dark.6" ta="center" className="report-card">
                        <Text size="xs" c="dimmed">Suspeitos / Sobras</Text>
                        <Text size="md" fw={700} c={integrity.summary.suspicious > 0 ? 'orange.4' : 'dimmed'}>
                          {integrity.summary.suspicious}
                        </Text>
                      </Paper>
                    </Grid.Col>
                  </Grid>

                  {integrity.issues && integrity.issues.length > 0 ? (
                    <div>
                      <Text size="xs" fw={600} mb={4} c="dimmed">
                        Arquivos que divergiram do padrão oficial do WordPress:
                      </Text>
                      <Table striped highlightOnHover withTableBorder style={{ fontSize: 12 }}>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Arquivo</Table.Th>
                            <Table.Th style={{ width: 110 }}>Classificação</Table.Th>
                            <Table.Th style={{ width: 100 }}>Status</Table.Th>
                            <Table.Th>Diagnóstico / Recomendação</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {integrity.issues.slice(0, 10).map((iss, idx) => (
                            <Table.Tr key={idx}>
                              <Table.Td>
                                <Text size="xs" fw={600} style={{ wordBreak: 'break-all' }}>
                                  {iss.file}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  size="xs"
                                  color={
                                    iss.type === 'modified'
                                      ? 'red'
                                      : iss.type === 'suspicious'
                                      ? 'orange'
                                      : 'yellow'
                                  }
                                >
                                  {iss.type.toUpperCase()}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Badge size="xs" color={iss.is_ignored ? 'teal' : 'red'} variant="light">
                                  {iss.is_ignored ? 'RESOLVIDO' : 'PENDENTE'}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" c="dimmed">
                                  {iss.description}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </div>
                  ) : (
                    <Paper p="md" radius="sm" bg="rgba(43, 138, 62, 0.1)" withBorder style={{ borderColor: '#2b8a3e' }}>
                      <Group gap="sm">
                        <ThemeIcon color="green" radius="xl" size="md">
                          <IconCheck size={18} />
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={700} c="green.4">
                            Todos os arquivos do sistema coincidem perfeitamente com os checksums oficiais!
                          </Text>
                          <Text size="xs" c="dimmed" className="print-text-muted">
                            Nenhuma adulteração, backdoor em pastas de sistema ou arquivo corrompido foi identificado.
                          </Text>
                        </div>
                      </Group>
                    </Paper>
                  )}
                </>
              ) : (
                <Text size="xs" c="dimmed">
                  Dados de integridade ainda não coletados para este website.
                </Text>
              )}
            </Box>

            {/* 4. SEÇÃO: ESTADO DAS ATUALIZAÇÕES (CORE, PLUGINS & TEMAS) */}
            <Box mb="xl" className="report-card" p="md" style={{ borderRadius: 8 }}>
              <Group justify="space-between" align="center" mb="sm">
                <Group gap="xs">
                  <ThemeIcon color="orange" variant="light" radius="md">
                    <IconRefresh size={20} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>4. Ciclo de Atualizações & Manutenção</Title>
                    <Text size="xs" c="dimmed" className="print-text-muted">
                      Verificação da versão do WordPress Core, Temas e Plugins instalados
                    </Text>
                  </div>
                </Group>

                {updates?.summary && (
                  <Badge
                    color={updates.summary.total_pending > 0 ? 'orange' : 'green'}
                    size="md"
                    variant="filled"
                  >
                    {updates.summary.total_pending > 0
                      ? `${updates.summary.total_pending} ITEM(NS) DESATUALIZADO(S)`
                      : 'SISTEMA 100% ATUALIZADO'}
                  </Badge>
                )}
              </Group>

              {updates ? (
                <>
                  {/* WordPress Core Status Card */}
                  <Paper p="sm" radius="sm" bg="dark.6" withBorder mb="md" className="report-card">
                    <Group justify="space-between" align="center">
                      <Group gap="sm">
                        <ThemeIcon color={coreHasUpdate ? 'orange' : 'green'} size="lg" radius="md">
                          <IconWorld size={20} />
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={700}>
                            WordPress Core (Motor Principal)
                          </Text>
                          <Text size="xs" c="dimmed" className="print-text-muted">
                            Versão Instalada: <b>{updates.core.current_version}</b>
                            {coreHasUpdate && (
                              <span> | Nova versão disponível no WordPress.org: <b style={{ color: '#ff922b' }}>{updates.core.new_version}</b></span>
                            )}
                          </Text>
                        </div>
                      </Group>

                      <Badge color={coreHasUpdate ? 'orange' : 'green'} variant="light">
                        {coreHasUpdate ? 'UPGRADE DO WP DISPONÍVEL' : 'VERSÃO MAIS RECENTE'}
                      </Badge>
                    </Group>
                  </Paper>

                  {/* Plugins / Temas Tables */}
                  {pendingPlugins.length > 0 || pendingThemes.length > 0 ? (
                    <div>
                      <Text size="xs" fw={700} c="dimmed" mb={4} tt="uppercase">
                        Itens com Atualização Pendente no Servidor:
                      </Text>
                      <Table striped highlightOnHover withTableBorder style={{ fontSize: 12 }}>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Tipo</Table.Th>
                            <Table.Th>Nome do Componente</Table.Th>
                            <Table.Th style={{ width: 130 }}>Versão Instalada</Table.Th>
                            <Table.Th style={{ width: 130 }}>Nova Versão</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {pendingPlugins.map((plugin, idx) => (
                            <Table.Tr key={`p-${idx}`}>
                              <Table.Td>
                                <Badge size="xs" color="indigo" variant="light" leftSection={<IconPlug size={10} />}>
                                  PLUGIN
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" fw={600}>
                                  {plugin.name}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" c="dimmed">
                                  {plugin.current_version}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" fw={700} c="orange.4">
                                  {plugin.new_version}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}

                          {pendingThemes.map((theme, idx) => (
                            <Table.Tr key={`t-${idx}`}>
                              <Table.Td>
                                <Badge size="xs" color="grape" variant="light" leftSection={<IconPalette size={10} />}>
                                  TEMA
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" fw={600}>
                                  {theme.name}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" c="dimmed">
                                  {theme.current_version}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" fw={700} c="orange.4">
                                  {theme.new_version}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </div>
                  ) : (
                    <Paper p="md" radius="sm" bg="rgba(43, 138, 62, 0.1)" withBorder style={{ borderColor: '#2b8a3e' }}>
                      <Group gap="sm">
                        <ThemeIcon color="green" radius="xl" size="md">
                          <IconCheck size={18} />
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={700} c="green.4">
                            Todos os plugins e temas instalados estão em suas versões mais recentes!
                          </Text>
                          <Text size="xs" c="dimmed" className="print-text-muted">
                            Manutenção preventiva em dia, minimizando exposição a brechas conhecidas e CVEs públicas.
                          </Text>
                        </div>
                      </Group>
                    </Paper>
                  )}
                </>
              ) : (
                <Text size="xs" c="dimmed">
                  Informações de atualizações não sincronizadas.
                </Text>
              )}
            </Box>

            {/* Footer Sign-off Note */}
            <Divider my="md" style={{ borderColor: '#475569' }} />
            <Group justify="space-between" align="center" pt="xs">
              <Text size="xs" c="dimmed" className="print-text-muted">
                Relatório de diagnóstico gerado de forma automatizada por <b>Validar Segurança</b>.
              </Text>
              <Text size="xs" c="dimmed" className="print-text-muted">
                Patropi Comunica — Auditoria & Hardening para WordPress
              </Text>
            </Group>
          </Paper>
        )}
      </Box>
    </>
  );
};
