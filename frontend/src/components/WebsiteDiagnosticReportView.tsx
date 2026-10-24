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
  Progress,
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
  IconPlugConnectedX,
  IconWorld,
  IconPlug,
  IconPalette,
  IconRadar,
  IconServer,
  IconCpu,
  IconDatabase,
  IconActivity,
  IconShieldCheck,
} from '@tabler/icons-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { getDiagnosticSummary, DiagnosticSummaryResponse, reconnectWebsiteAgent } from '../api';
import { VEXORS_LOGO_BASE64 } from '../assets/logoBase64';
import { formatDateTime } from '../utils/date';

interface WebsiteDiagnosticReportViewProps {
  website: {
    id: string | number;
    name: string;
    url: string;
    environment?: string;
    is_connected?: number | boolean;
    agent_version?: string | null;
    latest_agent_version?: string | null;
    is_agent_outdated?: boolean | null;
  };
  onBack: () => void;
  onWebsiteUpdated?: (updated: any) => void;
}

// Helper para comparar versões semânticas (ex: 1.0.5 < 1.0.6)
const isVersionOlder = (current?: string | null, target?: string | null): boolean => {
  if (!current || !target) return false;
  if (current === target) return false;
  const cParts = current.split('.').map((n) => parseInt(n, 10) || 0);
  const tParts = target.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(cParts.length, tParts.length); i++) {
    const c = cParts[i] || 0;
    const t = tParts[i] || 0;
    if (c < t) return true;
    if (c > t) return false;
  }
  return false;
};

export const WebsiteDiagnosticReportView: React.FC<WebsiteDiagnosticReportViewProps> = ({
  website,
  onBack,
  onWebsiteUpdated,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [report, setReport] = useState<DiagnosticSummaryResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [reconnectAlert, setReconnectAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Mantém referência estável do callback onWebsiteUpdated para evitar loop infinito de re-renderização
  const onWebsiteUpdatedRef = useRef(onWebsiteUpdated);
  useEffect(() => {
    onWebsiteUpdatedRef.current = onWebsiteUpdated;
  }, [onWebsiteUpdated]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getDiagnosticSummary(website.id);
      setReport(data);
      if (data?.website && onWebsiteUpdatedRef.current) {
        onWebsiteUpdatedRef.current(data.website);
      }
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

  const handleReconnect = async () => {
    setReconnecting(true);
    setReconnectAlert(null);
    try {
      const res = await reconnectWebsiteAgent(website.id);
      if (res.success) {
        setReconnectAlert({
          type: 'success',
          message: res.message || 'Agente WordPress reconectado com sucesso!',
        });
        if (res.data && onWebsiteUpdated) {
          onWebsiteUpdated(res.data);
        }
        await fetchReport();
      } else {
        setReconnectAlert({
          type: 'error',
          message: res.message || 'Não foi possível reconectar com o agente.',
        });
      }
    } catch (err: any) {
      setReconnectAlert({
        type: 'error',
        message:
          err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Falha na comunicação ao tentar reconectar com o agente.',
      });
    } finally {
      setReconnecting(false);
    }
  };

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
  const serverEnv = updates?.server_environment;

  const score = latestScan?.score !== undefined && latestScan?.score !== null ? Number(latestScan.score) : null;
  const grade = latestScan?.grade ?? (score !== null ? (score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F') : 'N/A');
  const scanSummary = latestScan?.summary;
  const totalChecks = scanSummary?.total_checks ?? ((scanSummary?.passed ?? 0) + (scanSummary?.failed ?? 0) + (scanSummary?.warnings ?? 0));

  const getScoreColorHex = (sc: number) => {
    if (sc >= 90) return '#06d6a0'; // emerald
    if (sc >= 75) return '#1A7F86'; // oceanBlue / teal
    if (sc >= 60) return '#ffd166'; // royalGold
    if (sc >= 40) return '#f77f00'; // honeyBronze
    return '#ef476f'; // amaranth
  };

  const scoreVal = score ?? 0;
  const scoreColorHex = getScoreColorHex(scoreVal);
  const ringRadius = 54;
  const ringCircumference = 2 * Math.PI * ringRadius; // ~339.292
  const ringDashoffset = ringCircumference * (1 - Math.max(0, Math.min(100, scoreVal)) / 100);

  const rawScanDate = latestScan?.scanned_at || latestScan?.executed_at;
  const formattedScanDate = formatDateTime(rawScanDate, 'DATA N/D');

  // Checagens detalhadas da varredura de segurança
  const allScanChecks: Array<{
    id: string;
    name: string;
    description?: string;
    status: 'PASS' | 'FAIL' | 'WARN' | string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
    details?: string;
    category_name?: string;
  }> = [];

  if (latestScan?.categories && typeof latestScan.categories === 'object') {
    Object.values(latestScan.categories).forEach((cat: any) => {
      if (cat?.checks && Array.isArray(cat.checks)) {
        cat.checks.forEach((chk: any) => {
          allScanChecks.push({
            ...chk,
            category_name: cat.category_name || 'Geral',
          });
        });
      }
    });
  } else if (Array.isArray(latestScan?.checks)) {
    latestScan.checks.forEach((chk: any) => {
      allScanChecks.push(chk);
    });
  }

  const severityWeight: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const sortedScanChecks = [...allScanChecks].sort((a, b) => {
    const isPendingA = a.status === 'FAIL' || a.status === 'WARN';
    const isPendingB = b.status === 'FAIL' || b.status === 'WARN';
    if (isPendingA && !isPendingB) return -1;
    if (!isPendingA && isPendingB) return 1;

    const sevA = severityWeight[a.severity?.toUpperCase()] || 0;
    const sevB = severityWeight[b.severity?.toUpperCase()] || 0;
    if (sevA !== sevB) return sevB - sevA;

    return (a.name || '').localeCompare(b.name || '');
  });

  // Métricas de Infraestrutura & Recursos do Servidor
  // 1. Armazenamento em Disco (HD)
  const diskTotalMb = serverEnv?.disk_total_mb ?? null;
  const diskFreeMb = serverEnv?.disk_free_mb ?? null;
  const diskUsedPct = serverEnv?.disk_used_pct ?? (
    diskTotalMb && diskFreeMb !== null && diskTotalMb > 0
      ? Math.round(((diskTotalMb - diskFreeMb) / diskTotalMb) * 100)
      : null
  );
  const diskColor = diskUsedPct !== null
    ? (diskUsedPct >= 90 ? 'red' : diskUsedPct >= 75 ? 'yellow' : 'teal')
    : 'gray';
  const diskStatusBadge = diskUsedPct !== null
    ? (diskUsedPct >= 90 ? 'Espaço Crítico' : diskUsedPct >= 75 ? 'Espaço Baixo' : 'Espaço Saudável')
    : 'Aguardando Sincronização';
  const diskFreeFormatted = diskFreeMb !== null
    ? (diskFreeMb >= 1024 ? `${(diskFreeMb / 1024).toFixed(1)} GB Livres` : `${diskFreeMb} MB Livres`)
    : 'Armazenamento N/D';
  const diskTotalFormatted = diskTotalMb !== null
    ? `${(diskTotalMb / 1024).toFixed(1)} GB Total`
    : null;

  // 2. PHP & Banco de Dados (MySQL)
  const phpVersion = serverEnv?.php_version;
  const mysqlVersion = serverEnv?.mysql_version;
  const serverSoftware = serverEnv?.server_software;
  const parsePhp = (ver?: string) => {
    if (!ver) return null;
    const m = ver.match(/^(\d+)\.(\d+)/);
    return m ? parseFloat(`${m[1]}.${m[2]}`) : null;
  };
  const phpNum = parsePhp(phpVersion);
  let phpColor = 'gray';
  let phpBadge = 'Aguardando';
  let phpStatusDesc = 'Versões do PHP e MySQL ativas no ambiente WordPress.';
  if (phpNum !== null) {
    if (phpNum >= 8.2) {
      phpColor = 'teal';
      phpBadge = 'PHP Moderno (Seguro)';
      phpStatusDesc = 'Versão com suporte ativo e atualizações contínuas de segurança.';
    } else if (phpNum >= 8.0) {
      phpColor = 'yellow';
      phpBadge = 'Fim de Suporte Ativo';
      phpStatusDesc = 'Apenas patches de segurança críticos. Recomendado planejar upgrade para PHP 8.2+.';
    } else {
      phpColor = 'red';
      phpBadge = 'PHP Obsoleto (Risco)';
      phpStatusDesc = 'Versão descontinuada sem patches de segurança. Risco elevado de incompatibilidade e invasão.';
    }
  }

  // 3. Memória RAM (WordPress)
  const memUsageMb = serverEnv?.memory_usage_mb ?? null;
  const memLimit = serverEnv?.memory_limit ?? '';
  const memPeakMb = serverEnv?.memory_peak_mb ?? null;
  const memUsedPct = serverEnv?.memory_used_pct ?? null;
  const ramColor = memUsedPct !== null
    ? (memUsedPct >= 85 ? 'red' : memUsedPct >= 70 ? 'yellow' : 'teal')
    : 'gray';
  const ramBadge = memUsedPct !== null
    ? (memUsedPct >= 85 ? 'Limite Próximo' : memUsedPct >= 70 ? 'Moderado' : 'Estável')
    : 'Aguardando';
  const ramStatusDesc = memLimit
    ? `Limite PHP: ${memLimit}${memPeakMb ? ` · Pico: ${memPeakMb} MB` : ''}.`
    : 'Consumo de memória alocado para a execução dos scripts do WordPress.';

  // 4. Carga de Processamento (CPU)
  const cpuAvailable = serverEnv?.cpu_available ?? null;
  const cpuLoadPct = serverEnv?.cpu_load_pct ?? null;
  const cpuLoad1m = serverEnv?.cpu_load_1m ?? null;
  const cpuLoad5m = serverEnv?.cpu_load_5m ?? null;
  const cpuCores = serverEnv?.cpu_cores ?? 1;
  let cpuColor = 'gray';
  let cpuBadge = 'Aguardando';
  let cpuDescText = 'Média de processamento do servidor web.';
  if (cpuAvailable === false) {
    cpuColor = 'indigo';
    cpuBadge = 'Hospedagem Compartilhada';
    cpuDescText = 'Métricas de CPU restritas pelas políticas de isolamento do provedor de hospedagem.';
  } else if (cpuLoadPct !== null) {
    if (cpuLoadPct >= 85) {
      cpuColor = 'red';
      cpuBadge = 'Sobrecarga de CPU';
    } else if (cpuLoadPct >= 60) {
      cpuColor = 'yellow';
      cpuBadge = 'Carga Elevada';
    } else {
      cpuColor = 'teal';
      cpuBadge = 'Normal';
    }
    cpuDescText = `Load: 1m: ${cpuLoad1m ?? '—'}, 5m: ${cpuLoad5m ?? '—'} (${cpuCores} Core${cpuCores > 1 ? 's' : ''}).`;
  }

  // Componentes & Ciclo de Atualizações
  const allPlugins = updates?.plugins || [];
  const allThemes = updates?.themes || [];
  const coreHasUpdate = !!updates?.core?.has_update;

  const pendingPlugins = allPlugins.filter((p) => p.has_update);
  const upToDatePlugins = allPlugins.filter((p) => !p.has_update);
  const activePlugins = allPlugins.filter((p) => p.is_active);
  const inactivePlugins = allPlugins.filter((p) => !p.is_active);

  const pendingThemes = allThemes.filter((t) => t.has_update);
  const upToDateThemes = allThemes.filter((t) => !t.has_update);
  const activeTheme = allThemes.find((t) => t.is_active);

  const totalPending = (updates?.summary?.total_pending ?? 0) || (pendingPlugins.length + pendingThemes.length + (coreHasUpdate ? 1 : 0));

  // Ordenação com itens desatualizados no topo para destaque visual imediato
  const sortedPlugins = [...allPlugins].sort((a, b) => {
    if (a.has_update && !b.has_update) return -1;
    if (!a.has_update && b.has_update) return 1;
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    return a.name.localeCompare(b.name);
  });

  const sortedThemes = [...allThemes].sort((a, b) => {
    if (a.has_update && !b.has_update) return -1;
    if (!a.has_update && b.has_update) return 1;
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    return a.name.localeCompare(b.name);
  });

  const currentAgentVersion =
    serverEnv?.agent_version ||
    allPlugins.find((p) => p.is_protected || p.file?.includes('validar-seguranca') || p.file?.includes('vexors'))?.current_version ||
    report?.website?.agent_version ||
    website.agent_version ||
    null;

  const latestAgentVersion =
    report?.data?.agent_status?.latest_version ||
    report?.website?.latest_agent_version ||
    website.latest_agent_version ||
    '1.0.6';

  const isAgentOutdated = Boolean(
    report?.data?.agent_status?.is_outdated ??
    report?.website?.is_agent_outdated ??
    website.is_agent_outdated ??
    (currentAgentVersion ? isVersionOlder(currentAgentVersion, latestAgentVersion) : false)
  );

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
            fill: #0f172a !important;
          }
          .print-text-muted {
            color: #64748b !important;
            fill: #64748b !important;
          }
          .print-track {
            stroke: #e2e8f0 !important;
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
              {Number(report?.website?.is_connected) !== 1 && (
                <Button
                  color="teal"
                  size="sm"
                  leftSection={<IconPlugConnected size={16} />}
                  loading={reconnecting}
                  onClick={handleReconnect}
                >
                  Conectar Agente
                </Button>
              )}

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

        {/* Feedback alert after attempting reconnect */}
        {reconnectAlert && (
          <Alert
            color={reconnectAlert.type === 'success' ? 'green' : 'red'}
            title={reconnectAlert.type === 'success' ? 'Sucesso' : 'Falha na Conexão'}
            mb="md"
            withCloseButton
            onClose={() => setReconnectAlert(null)}
            icon={reconnectAlert.type === 'success' ? <IconCheck size={18} /> : <IconAlertCircle size={18} />}
            className="no-print"
          >
            {reconnectAlert.message}
          </Alert>
        )}

        {/* Prominent banner if agent is disconnected */}
        {!loading && !errorMsg && Number(report?.website?.is_connected) !== 1 && (
          <Alert
            icon={<IconPlugConnectedX size={20} />}
            title="Agente WordPress Desconectado"
            color="red"
            variant="light"
            radius="md"
            mb="md"
            className="no-print"
          >
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <Box style={{ maxWidth: 720 }}>
                <Text size="sm">
                  O agente deste site está <strong>desconectado</strong>. As requisições automáticas e consultas em tempo real ao WordPress foram suspensas para preservar a estabilidade do servidor.
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Os dados exibidos abaixo são do último diagnóstico salvo. Caso o plugin esteja ativo no WordPress, clique ao lado para restabelecer a conexão.
                </Text>
              </Box>
              <Button
                color="teal"
                size="sm"
                leftSection={<IconPlugConnected size={16} />}
                loading={reconnecting}
                onClick={handleReconnect}
              >
                Conectar Agente Agora
              </Button>
            </Group>
          </Alert>
        )}

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
          <Stack gap="md" className="no-print">
            <Alert icon={<IconAlertCircle size={18} />} title="Agente Desconectado ou Indisponível" color="red">
              <Stack gap="xs">
                <Text size="sm">{errorMsg}</Text>
                <Text size="xs" c="dimmed">
                  O agente WordPress pode ter sido desativado ou o servidor do cliente está temporariamente inacessível.
                </Text>
                <Group mt="xs">
                  <Button
                    color="teal"
                    size="sm"
                    leftSection={<IconPlugConnected size={16} />}
                    loading={reconnecting}
                    onClick={handleReconnect}
                  >
                    Tentar Conectar Agora
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    leftSection={<IconRefresh size={16} />}
                    loading={loading}
                    onClick={fetchReport}
                  >
                    Recarregar Dados Salvos
                  </Button>
                </Group>
              </Stack>
            </Alert>
          </Stack>
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
                  src={VEXORS_LOGO_BASE64}
                  alt="Vexors"
                  style={{ height: 42, width: 'auto', objectFit: 'contain' }}
                />
                <Badge color="green" size="sm" variant="light">
                  Vexors Platform
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
                  {formatDateTime(report?.generated_at || new Date())}
                </Text>
                <Badge color="green" size="sm" variant="outline" mt={4}>
                  Vexors Platform
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
                      color={Number(report?.website?.is_connected) === 1 ? 'teal' : 'red'}
                      size="md"
                      variant="filled"
                      leftSection={
                        Number(report?.website?.is_connected) === 1 ? (
                          <IconPlugConnected size={14} />
                        ) : (
                          <IconPlugConnectedX size={14} />
                        )
                      }
                    >
                      {Number(report?.website?.is_connected) === 1 ? 'AGENTE ATIVO' : 'AGENTE DESCONECTADO'}
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
                <>
                  <Grid align="center" mt="xs">
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Group justify="center">
                      <Box style={{ width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg
                          width="140"
                          height="140"
                          viewBox="0 0 140 140"
                          style={{ overflow: 'visible', display: 'block' }}
                        >
                          {/* Trilha circular de fundo */}
                          <circle
                            cx="70"
                            cy="70"
                            r={ringRadius}
                            fill="none"
                            stroke="#2C2E33"
                            strokeWidth="12"
                            className="print-track"
                          />
                          {/* Arco de progresso proporcional */}
                          <circle
                            cx="70"
                            cy="70"
                            r={ringRadius}
                            fill="none"
                            stroke={scoreColorHex}
                            strokeWidth="12"
                            strokeDasharray={ringCircumference}
                            strokeDashoffset={ringDashoffset}
                            strokeLinecap="round"
                            transform="rotate(-90 70 70)"
                          />
                          {/* Nota Numérica Central */}
                          <text
                            x="70"
                            y="65"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#FFFFFF"
                            fontSize="32"
                            fontWeight="800"
                            fontFamily="system-ui, -apple-system, sans-serif"
                            className="print-text-dark"
                          >
                            {scoreVal}
                          </text>
                          {/* Classificação / Grade */}
                          <text
                            x="70"
                            y="90"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#909296"
                            fontSize="11"
                            fontWeight="700"
                            letterSpacing="0.8"
                            fontFamily="system-ui, -apple-system, sans-serif"
                            className="print-text-muted"
                          >
                            GRADE {grade}
                          </text>
                        </svg>
                      </Box>
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

                <Divider my="md" style={{ borderColor: '#373A40' }} />

                {/* Tabela Detalhada de Itens Checados e Status (Resolvido vs Pendente) */}
                <Box mt="md">
                  <Group justify="space-between" align="center" mb="sm" wrap="wrap" gap="xs">
                    <div>
                      <Text size="xs" fw={700} c="dimmed" tt="uppercase" className="print-text-muted">
                        Itens de Segurança Checados ({allScanChecks.length})
                      </Text>
                      <Text size="11px" c="dimmed" className="print-text-muted">
                        Status de conformidade detalhado de cada teste de segurança e auditoria executado
                      </Text>
                    </div>

                    <Group gap="xs">
                      <Badge size="xs" color="green" variant="light" leftSection={<IconCheck size={10} />}>
                        {allScanChecks.filter((c) => c.status === 'PASS').length} Resolvidos
                      </Badge>
                      {allScanChecks.filter((c) => c.status !== 'PASS').length > 0 && (
                        <Badge size="xs" color="red" variant="filled" leftSection={<IconAlertTriangle size={10} />}>
                          {allScanChecks.filter((c) => c.status !== 'PASS').length} Pendentes
                        </Badge>
                      )}
                    </Group>
                  </Group>

                  {sortedScanChecks.length > 0 ? (
                    <Table striped highlightOnHover withTableBorder style={{ fontSize: 12 }}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ width: 180 }}>Status</Table.Th>
                          <Table.Th>Item Avaliado / Checagem</Table.Th>
                          <Table.Th style={{ width: 110 }}>Severidade</Table.Th>
                          <Table.Th>Diagnóstico / Detalhes</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {sortedScanChecks.map((chk, idx) => {
                          const isPass = chk.status === 'PASS';
                          const isFail = chk.status === 'FAIL';
                          const isWarn = chk.status === 'WARN';
                          const sev = (chk.severity || 'LOW').toUpperCase();

                          return (
                            <Table.Tr
                              key={`chk-${chk.id || idx}`}
                              style={
                                isFail
                                  ? { backgroundColor: 'rgba(224, 49, 49, 0.08)' }
                                  : isWarn
                                  ? { backgroundColor: 'rgba(245, 159, 0, 0.08)' }
                                  : undefined
                              }
                            >
                              <Table.Td>
                                {isPass ? (
                                  <Badge
                                    size="xs"
                                    color="green"
                                    variant="light"
                                    leftSection={<IconCheck size={10} />}
                                  >
                                    Resolvido
                                  </Badge>
                                ) : isFail ? (
                                  <Badge
                                    size="xs"
                                    color="red"
                                    variant="filled"
                                    leftSection={<IconAlertCircle size={10} />}
                                  >
                                    Pendente (Falha)
                                  </Badge>
                                ) : (
                                  <Badge
                                    size="xs"
                                    color="yellow"
                                    variant="filled"
                                    leftSection={<IconAlertTriangle size={10} />}
                                  >
                                    Pendente (Alerta)
                                  </Badge>
                                )}
                              </Table.Td>

                              <Table.Td>
                                <Text size="xs" fw={!isPass ? 700 : 500}>
                                  {chk.name}
                                </Text>
                                {chk.category_name && (
                                  <Text size="10px" c="dimmed">
                                    {chk.category_name}
                                  </Text>
                                )}
                                {chk.description && (
                                  <Text size="11px" c="dimmed" mt={2} className="print-text-muted">
                                    {chk.description}
                                  </Text>
                                )}
                              </Table.Td>

                              <Table.Td>
                                <Badge
                                  size="xs"
                                  color={
                                    sev === 'CRITICAL'
                                      ? 'red'
                                      : sev === 'HIGH'
                                      ? 'orange'
                                      : sev === 'MEDIUM'
                                      ? 'yellow'
                                      : 'blue'
                                  }
                                  variant="light"
                                >
                                  {sev}
                                </Badge>
                              </Table.Td>

                              <Table.Td>
                                <Text
                                  size="xs"
                                  c={isFail ? 'red.4' : isWarn ? 'yellow.4' : 'dimmed'}
                                  fw={!isPass ? 600 : 400}
                                  className={isPass ? 'print-text-muted' : undefined}
                                  style={{ wordBreak: 'break-word' }}
                                >
                                  {chk.details || '—'}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text size="xs" c="dimmed">
                      Nenhuma checagem individual detalhada encontrada nesta varredura.
                    </Text>
                  )}
                </Box>
              </>
            ) : (
                <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light">
                  Nenhuma varredura de auditoria foi executada para este site ainda.
                </Alert>
              )}
            </Box>

            {/* 2. SEÇÃO: INFRAESTRUTURA & SAÚDE DO SERVIDOR */}
            <Box mb="xl" className="report-card" p="md" style={{ borderRadius: 8 }}>
              <Group justify="space-between" align="center" mb="sm">
                <Group gap="xs">
                  <ThemeIcon color="teal" variant="light" radius="md">
                    <IconServer size={20} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>2. Infraestrutura & Recursos do Servidor</Title>
                    <Text size="xs" c="dimmed" className="print-text-muted">
                      Telemetria de armazenamento em disco, memória RAM, processamento e ambiente de execução
                    </Text>
                  </div>
                </Group>

                <Badge
                  color={
                    diskColor === 'red' || phpColor === 'red' || ramColor === 'red' || cpuColor === 'red'
                      ? 'red'
                      : diskColor === 'yellow' || phpColor === 'yellow' || ramColor === 'yellow' || cpuColor === 'yellow'
                      ? 'yellow'
                      : 'teal'
                  }
                  size="md"
                  variant="filled"
                >
                  {diskColor === 'red' || phpColor === 'red' || ramColor === 'red' || cpuColor === 'red'
                    ? 'REQUER ATENÇÃO NO SERVIDOR'
                    : diskColor === 'yellow' || phpColor === 'yellow' || ramColor === 'yellow' || cpuColor === 'yellow'
                    ? 'ALERTAS DE RECURSOS'
                    : 'INFRAESTRUTURA SAUDÁVEL'}
                </Badge>
              </Group>

              <Grid mt="xs">
                {/* Card 1: Armazenamento em Disco (HD) */}
                <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                  <Paper
                    p="sm"
                    radius="md"
                    bg="dark.6"
                    withBorder
                    h="100%"
                    className="report-card"
                    style={{ display: 'flex', flexDirection: 'column', borderColor: '#373A40' }}
                  >
                    <Group justify="space-between" align="center" mb={6} wrap="nowrap">
                      <Text size="xs" fw={700} c="dimmed" tt="uppercase" truncate style={{ whiteSpace: 'nowrap' }}>
                        Disco / Armazenamento
                      </Text>
                      <ThemeIcon color={diskColor} variant="light" size="sm" radius="xl" style={{ flexShrink: 0 }}>
                        <IconDatabase size={14} />
                      </ThemeIcon>
                    </Group>
                    <Text fw={800} fz={18} c="white" className="print-text-dark">
                      {diskFreeFormatted}
                    </Text>
                    <Group justify="space-between" align="center" mt={4}>
                      <Badge size="xs" color={diskColor} variant="light">
                        {diskStatusBadge}
                      </Badge>
                      {diskTotalFormatted && (
                        <Text size="xs" c="dimmed" className="print-text-muted">
                          {diskTotalFormatted}
                        </Text>
                      )}
                    </Group>
                    {diskUsedPct !== null && (
                      <Progress value={diskUsedPct} color={diskColor} size="xs" radius="xl" mt="xs" />
                    )}
                    <Text size="xs" c="dimmed" mt="xs" className="print-text-muted" style={{ flex: 1 }}>
                      {diskTotalMb !== null
                        ? `Consumo de ${diskUsedPct ?? 0}% do volume total alocado.`
                        : 'Espaço em disco para uploads, banco de dados e arquivos do sistema.'}
                    </Text>
                  </Paper>
                </Grid.Col>

                {/* Card 2: PHP & Banco de Dados */}
                <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                  <Paper
                    p="sm"
                    radius="md"
                    bg="dark.6"
                    withBorder
                    h="100%"
                    className="report-card"
                    style={{ display: 'flex', flexDirection: 'column', borderColor: '#373A40' }}
                  >
                    <Group justify="space-between" align="center" mb={6} wrap="nowrap">
                      <Text size="xs" fw={700} c="dimmed" tt="uppercase" truncate style={{ whiteSpace: 'nowrap' }}>
                        PHP & Banco de Dados
                      </Text>
                      <ThemeIcon color={phpColor} variant="light" size="sm" radius="xl" style={{ flexShrink: 0 }}>
                        <IconServer size={14} />
                      </ThemeIcon>
                    </Group>
                    <Text fw={800} fz={18} c="white" className="print-text-dark">
                      {phpVersion ? `PHP ${phpVersion}` : 'PHP Não Informado'}
                    </Text>
                    <Group justify="space-between" align="center" mt={4}>
                      <Badge size="xs" color={phpColor} variant="light">
                        {phpBadge}
                      </Badge>
                      {mysqlVersion && (
                        <Text size="xs" c="dimmed" className="print-text-muted" fw={600}>
                          MySQL {mysqlVersion}
                        </Text>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" mt="xs" className="print-text-muted" style={{ flex: 1 }}>
                      {phpStatusDesc}
                    </Text>
                    {serverSoftware && (
                      <Text size="10px" c="dimmed" mt={4} className="print-text-muted">
                        Web: {serverSoftware}
                      </Text>
                    )}
                  </Paper>
                </Grid.Col>

                {/* Card 3: Memória RAM */}
                <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                  <Paper
                    p="sm"
                    radius="md"
                    bg="dark.6"
                    withBorder
                    h="100%"
                    className="report-card"
                    style={{ display: 'flex', flexDirection: 'column', borderColor: '#373A40' }}
                  >
                    <Group justify="space-between" align="center" mb={6} wrap="nowrap">
                      <Text size="xs" fw={700} c="dimmed" tt="uppercase" truncate style={{ whiteSpace: 'nowrap' }}>
                        Memória RAM
                      </Text>
                      <ThemeIcon color={ramColor} variant="light" size="sm" radius="xl" style={{ flexShrink: 0 }}>
                        <IconCpu size={14} />
                      </ThemeIcon>
                    </Group>
                    <Text fw={800} fz={18} c="white" className="print-text-dark">
                      {memUsageMb !== null ? `${memUsageMb} MB em Uso` : 'Memória N/D'}
                    </Text>
                    <Group justify="space-between" align="center" mt={4}>
                      <Badge size="xs" color={ramColor} variant="light">
                        {ramBadge}
                      </Badge>
                      {memUsedPct !== null && (
                        <Text size="xs" c="dimmed" className="print-text-muted">
                          {memUsedPct}% alocado
                        </Text>
                      )}
                    </Group>
                    {memUsedPct !== null && (
                      <Progress value={memUsedPct} color={ramColor} size="xs" radius="xl" mt="xs" />
                    )}
                    <Text size="xs" c="dimmed" mt="xs" className="print-text-muted" style={{ flex: 1 }}>
                      {ramStatusDesc}
                    </Text>
                  </Paper>
                </Grid.Col>

                {/* Card 4: Processador (CPU) */}
                <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                  <Paper
                    p="sm"
                    radius="md"
                    bg="dark.6"
                    withBorder
                    h="100%"
                    className="report-card"
                    style={{ display: 'flex', flexDirection: 'column', borderColor: '#373A40' }}
                  >
                    <Group justify="space-between" align="center" mb={6} wrap="nowrap">
                      <Text size="xs" fw={700} c="dimmed" tt="uppercase" truncate style={{ whiteSpace: 'nowrap' }}>
                        Carga da CPU
                      </Text>
                      <ThemeIcon color={cpuColor} variant="light" size="sm" radius="xl" style={{ flexShrink: 0 }}>
                        <IconActivity size={14} />
                      </ThemeIcon>
                    </Group>
                    <Text fw={800} fz={18} c="white" className="print-text-dark">
                      {cpuAvailable === false
                        ? 'Compartilhada'
                        : cpuLoadPct !== null
                        ? `${cpuLoadPct}% de Carga`
                        : cpuLoad1m !== null
                        ? `Load: ${cpuLoad1m}`
                        : 'CPU N/D'}
                    </Text>
                    <Group justify="space-between" align="center" mt={4}>
                      <Badge size="xs" color={cpuColor} variant="light">
                        {cpuBadge}
                      </Badge>
                      {cpuCores && cpuAvailable !== false && (
                        <Text size="xs" c="dimmed" className="print-text-muted">
                          {cpuCores} Core{cpuCores > 1 ? 's' : ''}
                        </Text>
                      )}
                    </Group>
                    {cpuLoadPct !== null && (
                      <Progress value={cpuLoadPct} color={cpuColor} size="xs" radius="xl" mt="xs" />
                    )}
                    <Text size="xs" c="dimmed" mt="xs" className="print-text-muted" style={{ flex: 1 }}>
                      {cpuDescText}
                    </Text>
                  </Paper>
                </Grid.Col>
              </Grid>
            </Box>

            {/* 3. SEÇÃO: LOGS DE ERROS FATAIS (ÚLTIMAS 48 HORAS) */}
            <Box mb="xl" className="report-card" p="md" style={{ borderRadius: 8 }}>
              <Group justify="space-between" align="center" mb="sm">
                <Group gap="xs">
                  <ThemeIcon color={logs48h?.total_fatal_48h ? 'red' : 'green'} variant="light" radius="md">
                    <IconTerminal size={20} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>3. Monitoramento de Erros Fatais (Últimas 48 Horas)</Title>
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
                <Paper p="md" radius="sm" bg="rgba(6, 214, 160, 0.1)" withBorder style={{ borderColor: '#06d6a0' }}>
                  <Group gap="sm">
                    <ThemeIcon color="emerald" radius="xl" size="md">
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

            {/* 4. SEÇÃO: INTEGRIDADE DO CORE DO WORDPRESS */}
            <Box mb="xl" className="report-card" p="md" style={{ borderRadius: 8 }}>
              <Group justify="space-between" align="center" mb="sm">
                <Group gap="xs">
                  <ThemeIcon color="teal" variant="light" radius="md">
                    <IconFileCheck size={20} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>4. Verificação Forense de Integridade do Core</Title>
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
                    <Paper p="md" radius="sm" bg="rgba(6, 214, 160, 0.1)" withBorder style={{ borderColor: '#06d6a0' }}>
                      <Group gap="sm">
                        <ThemeIcon color="emerald" radius="xl" size="md">
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

            {/* 5. SEÇÃO: ESTADO DAS ATUALIZAÇÕES & INVENTÁRIO COMPLETO */}
            <Box mb="xl" className="report-card" p="md" style={{ borderRadius: 8 }}>
              <Group justify="space-between" align="center" mb="sm">
                <Group gap="xs">
                  <ThemeIcon color="orange" variant="light" radius="md">
                    <IconRefresh size={20} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>5. Ciclo de Atualizações & Inventário de Componentes</Title>
                    <Text size="xs" c="dimmed" className="print-text-muted">
                      Diagnóstico e inventário completo de versão do WordPress Core, Temas e Plugins instalados
                    </Text>
                  </div>
                </Group>

                {updates?.summary && (
                  <Badge
                    color={totalPending > 0 ? 'orange' : 'green'}
                    size="md"
                    variant="filled"
                  >
                    {totalPending > 0
                      ? `${totalPending} ITEM(NS) COM ATUALIZAÇÃO DISPONÍVEL`
                      : 'SISTEMA 100% ATUALIZADO'}
                  </Badge>
                )}
              </Group>

              {updates ? (
                <>
                  {/* Resumo Geral de Componentes (4 Cards de Indicadores) */}
                  <Grid mb="md">
                    {/* WP Core Summary */}
                    <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                      <Paper p="xs" px="sm" radius="sm" bg="dark.6" withBorder className="report-card" style={{ borderColor: '#373A40' }}>
                        <Group justify="space-between" align="center">
                          <Text size="xs" c="dimmed" fw={600} className="print-text-muted">
                            WordPress Core
                          </Text>
                          <Badge size="xs" color={coreHasUpdate ? 'orange' : 'green'} variant="light">
                            {coreHasUpdate ? 'Upgrade Pendente' : 'Atualizado'}
                          </Badge>
                        </Group>
                        <Text size="md" fw={700} mt={2} className="print-text-dark">
                          v{updates.core.current_version || 'N/D'}
                        </Text>
                        {coreHasUpdate && (
                          <Text size="xs" c="orange.4" fw={600}>
                            Nova versão: v{updates.core.new_version}
                          </Text>
                        )}
                      </Paper>
                    </Grid.Col>

                    {/* Plugins Summary */}
                    <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                      <Paper p="xs" px="sm" radius="sm" bg="dark.6" withBorder className="report-card" style={{ borderColor: '#373A40' }}>
                        <Group justify="space-between" align="center">
                          <Text size="xs" c="dimmed" fw={600} className="print-text-muted">
                            Plugins Instalados
                          </Text>
                          <Badge size="xs" color={pendingPlugins.length > 0 ? 'orange' : 'green'} variant="light">
                            {pendingPlugins.length > 0 ? `${pendingPlugins.length} Desatualizado(s)` : 'Todos em Dia'}
                          </Badge>
                        </Group>
                        <Text size="md" fw={700} mt={2} className="print-text-dark">
                          {allPlugins.length} Plugins
                        </Text>
                        <Text size="xs" c="dimmed" className="print-text-muted">
                          {upToDatePlugins.length} em dia · {activePlugins.length} ativos / {inactivePlugins.length} inativos
                        </Text>
                      </Paper>
                    </Grid.Col>

                    {/* Temas Summary */}
                    <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                      <Paper p="xs" px="sm" radius="sm" bg="dark.6" withBorder className="report-card" style={{ borderColor: '#373A40' }}>
                        <Group justify="space-between" align="center">
                          <Text size="xs" c="dimmed" fw={600} className="print-text-muted">
                            Temas Instalados
                          </Text>
                          <Badge size="xs" color={pendingThemes.length > 0 ? 'orange' : 'green'} variant="light">
                            {pendingThemes.length > 0 ? `${pendingThemes.length} Desatualizado(s)` : 'Todos em Dia'}
                          </Badge>
                        </Group>
                        <Text size="md" fw={700} mt={2} className="print-text-dark">
                          {allThemes.length} Temas
                        </Text>
                        <Text size="xs" c="dimmed" className="print-text-muted">
                          {activeTheme ? `Ativo: ${activeTheme.name}` : `${upToDateThemes.length} atualizados`}
                        </Text>
                      </Paper>
                    </Grid.Col>

                    {/* Agente Vexors Guard Summary */}
                    <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                      <Paper p="xs" px="sm" radius="sm" bg="dark.6" withBorder className="report-card" style={{ borderColor: '#373A40' }}>
                        <Group justify="space-between" align="center">
                          <Text size="xs" c="dimmed" fw={600} className="print-text-muted">
                            Agente Vexors Guard
                          </Text>
                          <Badge size="xs" color={isAgentOutdated ? 'yellow' : 'teal'} variant="light">
                            {isAgentOutdated ? 'Atualização Disponível' : 'Protegido'}
                          </Badge>
                        </Group>
                        <Text size="md" fw={700} mt={2} className="print-text-dark">
                          v{currentAgentVersion || '1.0.6'}
                        </Text>
                        <Text size="xs" c="dimmed" className="print-text-muted">
                          {isAgentOutdated ? `Disponível: v${latestAgentVersion}` : 'Telemetria e blindagem ativas'}
                        </Text>
                      </Paper>
                    </Grid.Col>
                  </Grid>

                  {/* Destaque de Atenção Imediata se houver pendências */}
                  {totalPending > 0 ? (
                    <Alert
                      icon={<IconAlertTriangle size={18} />}
                      color="orange"
                      variant="light"
                      radius="md"
                      mb="md"
                      title="Atenção Recomendada: Atualizações Disponíveis para Aplicação"
                    >
                      <Text size="xs">
                        Foram identificadas <b>{totalPending} atualização(ões) pendente(s)</b> ({pendingPlugins.length} plugin(s), {pendingThemes.length} tema(s){coreHasUpdate ? ', Core do WordPress' : ''}). No inventário abaixo, os itens que requerem atenção estão destacados em laranja para fácil localização e planejamento de manutenção preventiva.
                      </Text>
                    </Alert>
                  ) : (
                    <Paper p="md" radius="sm" bg="rgba(6, 214, 160, 0.1)" withBorder style={{ borderColor: '#06d6a0' }} mb="md">
                      <Group gap="sm">
                        <ThemeIcon color="emerald" radius="xl" size="md">
                          <IconCheck size={18} />
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={700} c="green.4">
                            Todos os plugins, temas e o Core do WordPress estão 100% atualizados!
                          </Text>
                          <Text size="xs" c="dimmed" className="print-text-muted">
                            Manutenção preventiva rigorosamente em dia, minimizando superfície de ataque e garantindo estabilidade operacional.
                          </Text>
                        </div>
                      </Group>
                    </Paper>
                  )}

                  {/* WordPress Core Banner */}
                  <Paper
                    p="sm"
                    radius="sm"
                    bg="dark.6"
                    withBorder
                    mb="md"
                    className="report-card"
                    style={{ borderColor: coreHasUpdate ? '#f59f00' : '#373A40' }}
                  >
                    <Group justify="space-between" align="center" wrap="wrap">
                      <Group gap="sm">
                        <ThemeIcon color={coreHasUpdate ? 'orange' : 'green'} size="lg" radius="md">
                          <IconWorld size={20} />
                        </ThemeIcon>
                        <div>
                          <Group gap="xs" align="center">
                            <Text size="sm" fw={700}>
                              WordPress Core (Núcleo da Aplicação)
                            </Text>
                            {coreHasUpdate && (
                              <Badge color="orange" size="xs" variant="filled">
                                AÇÃO REQUERIDA
                              </Badge>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed" className="print-text-muted">
                            Versão Instalada: <b>{updates.core.current_version || 'N/D'}</b>
                            {coreHasUpdate ? (
                              <span> · Nova versão disponível no WordPress.org: <b style={{ color: '#edae49' }}>{updates.core.new_version}</b></span>
                            ) : (
                              <span> · Versão estável mais recente suportada.</span>
                            )}
                          </Text>
                        </div>
                      </Group>

                      <Badge color={coreHasUpdate ? 'orange' : 'green'} variant="light">
                        {coreHasUpdate ? 'UPGRADE DO WP DISPONÍVEL' : 'VERSÃO MAIS RECENTE'}
                      </Badge>
                    </Group>
                  </Paper>

                  {/* Inventário Completo de Plugins */}
                  <Box mb="md">
                    <Group justify="space-between" align="center" mb={6}>
                      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                        Inventário Completo de Plugins ({allPlugins.length})
                      </Text>
                      <Group gap="xs">
                        <Badge size="xs" color="green" variant="light">
                          {upToDatePlugins.length} Atualizados
                        </Badge>
                        {pendingPlugins.length > 0 && (
                          <Badge size="xs" color="orange" variant="filled">
                            {pendingPlugins.length} Requerem Atualização
                          </Badge>
                        )}
                      </Group>
                    </Group>

                    {sortedPlugins.length > 0 ? (
                      <Table striped highlightOnHover withTableBorder style={{ fontSize: 12 }}>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th style={{ width: 180 }}>Status de Atualização</Table.Th>
                            <Table.Th>Plugin / Extensão</Table.Th>
                            <Table.Th style={{ width: 110 }}>Versão Atual</Table.Th>
                            <Table.Th style={{ width: 140 }}>Versão Mais Recente</Table.Th>
                            <Table.Th style={{ width: 100 }}>Estado no WP</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {sortedPlugins.map((plugin, idx) => (
                            <Table.Tr
                              key={`p-${idx}`}
                              style={
                                plugin.has_update
                                  ? { backgroundColor: 'rgba(245, 159, 0, 0.08)' }
                                  : undefined
                              }
                            >
                              <Table.Td>
                                {plugin.has_update ? (
                                  <Badge
                                    size="xs"
                                    color="orange"
                                    variant="filled"
                                    leftSection={<IconAlertTriangle size={10} />}
                                  >
                                    Atualização Disponível
                                  </Badge>
                                ) : (
                                  <Badge
                                    size="xs"
                                    color="green"
                                    variant="light"
                                    leftSection={<IconCheck size={10} />}
                                  >
                                    Atualizado
                                  </Badge>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Group gap="xs" align="center">
                                  <IconPlug size={14} style={{ opacity: 0.7 }} />
                                  <Text size="xs" fw={plugin.has_update ? 700 : 500}>
                                    {plugin.name}
                                  </Text>
                                  {plugin.is_protected && (
                                    <Badge size="xs" color="blue" variant="outline" leftSection={<IconShieldCheck size={10} />}>
                                      Vexors Guard
                                    </Badge>
                                  )}
                                </Group>
                                <Text size="10px" c="dimmed">
                                  {plugin.slug || plugin.file}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" fw={plugin.has_update ? 600 : 400}>
                                  {plugin.current_version}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                {plugin.has_update ? (
                                  <Text size="xs" fw={700} c="orange.4">
                                    {plugin.new_version}
                                  </Text>
                                ) : (
                                  <Text size="xs" c="dimmed">
                                    {plugin.current_version} (Mais Recente)
                                  </Text>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  size="xs"
                                  color={plugin.is_active ? 'teal' : 'gray'}
                                  variant={plugin.is_active ? 'light' : 'outline'}
                                >
                                  {plugin.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Nenhum plugin identificado no ambiente.
                      </Text>
                    )}
                  </Box>

                  {/* Inventário Completo de Temas */}
                  <Box>
                    <Group justify="space-between" align="center" mb={6}>
                      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                        Inventário Completo de Temas ({allThemes.length})
                      </Text>
                      <Group gap="xs">
                        <Badge size="xs" color="green" variant="light">
                          {upToDateThemes.length} Atualizados
                        </Badge>
                        {pendingThemes.length > 0 && (
                          <Badge size="xs" color="orange" variant="filled">
                            {pendingThemes.length} Requerem Atualização
                          </Badge>
                        )}
                      </Group>
                    </Group>

                    {sortedThemes.length > 0 ? (
                      <Table striped highlightOnHover withTableBorder style={{ fontSize: 12 }}>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th style={{ width: 180 }}>Status de Atualização</Table.Th>
                            <Table.Th>Tema</Table.Th>
                            <Table.Th style={{ width: 110 }}>Versão Atual</Table.Th>
                            <Table.Th style={{ width: 140 }}>Versão Mais Recente</Table.Th>
                            <Table.Th style={{ width: 100 }}>Estado no WP</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {sortedThemes.map((theme, idx) => (
                            <Table.Tr
                              key={`t-${idx}`}
                              style={
                                theme.has_update
                                  ? { backgroundColor: 'rgba(245, 159, 0, 0.08)' }
                                  : undefined
                              }
                            >
                              <Table.Td>
                                {theme.has_update ? (
                                  <Badge
                                    size="xs"
                                    color="orange"
                                    variant="filled"
                                    leftSection={<IconAlertTriangle size={10} />}
                                  >
                                    Atualização Disponível
                                  </Badge>
                                ) : (
                                  <Badge
                                    size="xs"
                                    color="green"
                                    variant="light"
                                    leftSection={<IconCheck size={10} />}
                                  >
                                    Atualizado
                                  </Badge>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Group gap="xs" align="center">
                                  <IconPalette size={14} style={{ opacity: 0.7 }} />
                                  <Text size="xs" fw={theme.has_update ? 700 : 500}>
                                    {theme.name}
                                  </Text>
                                </Group>
                                <Text size="10px" c="dimmed">
                                  {theme.slug}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" fw={theme.has_update ? 600 : 400}>
                                  {theme.current_version}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                {theme.has_update ? (
                                  <Text size="xs" fw={700} c="orange.4">
                                    {theme.new_version}
                                  </Text>
                                ) : (
                                  <Text size="xs" c="dimmed">
                                    {theme.current_version} (Mais Recente)
                                  </Text>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  size="xs"
                                  color={theme.is_active ? 'indigo' : 'gray'}
                                  variant={theme.is_active ? 'filled' : 'outline'}
                                >
                                  {theme.is_active ? 'Tema Ativo' : 'Inativo'}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Nenhum tema identificado no ambiente.
                      </Text>
                    )}
                  </Box>
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
                Relatório de diagnóstico gerado de forma automatizada por <b>Vexors</b>.
              </Text>
              <Text size="xs" c="dimmed" className="print-text-muted">
                Vexores — Auditoria & Hardening para WordPress
              </Text>
            </Group>
          </Paper>
        )}
      </Box>
    </>
  );
};
