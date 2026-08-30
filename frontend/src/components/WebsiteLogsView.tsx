import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Title,
  Text,
  Button,
  Group,
  Badge,
  Stack,
  TextInput,
  SegmentedControl,
  Loader,
  Center,
  Alert,
  Switch,
  Code,
  Tooltip,
  ActionIcon,
  Box,
  Divider,
  ThemeIcon,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconRefresh,
  IconTrash,
  IconSearch,
  IconTerminal,
  IconAlertCircle,
  IconAlertTriangle,
  IconInfoCircle,
  IconCheck,
  IconCopy,
  IconPower,
  IconExternalLink,
  IconFileText,
} from '@tabler/icons-react';
import { getWebsiteLogs, toggleWebsiteLogs, clearWebsiteLogs, LogEntry } from '../api';

interface WebsiteLogsViewProps {
  website: { id: string | number; name: string; url: string; environment?: string };
  onBack: () => void;
}

export const WebsiteLogsView: React.FC<WebsiteLogsViewProps> = ({ website, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loggingEnabled, setLoggingEnabled] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const websiteId = Number(website.id);

  const fetchLogs = useCallback(async (level: string = filterLevel) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getWebsiteLogs(websiteId, level);
      setLogs(data.logs || []);
      setLoggingEnabled(data.logging_enabled ?? false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Falha ao conectar com o agente WordPress para ler os logs.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [websiteId, filterLevel]);

  useEffect(() => {
    fetchLogs(filterLevel);
  }, [fetchLogs, filterLevel]);

  const handleToggle = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await toggleWebsiteLogs(websiteId);
      setLoggingEnabled(res.logging_enabled);
      setSuccessMsg(res.message || (res.logging_enabled ? 'Captura de logs do WordPress ativada.' : 'Captura de logs do WordPress desativada.'));
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchLogs(filterLevel);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Falha ao alterar estado do log no WordPress.';
      setErrorMsg(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Tem certeza que deseja apagar todos os logs registrados neste site WordPress?')) {
      return;
    }
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await clearWebsiteLogs(websiteId);
      setSuccessMsg(res.message || 'Logs do WordPress limpos com sucesso.');
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchLogs(filterLevel);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Falha ao limpar arquivo de logs.';
      setErrorMsg(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyLine = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.message.toLowerCase().includes(term) ||
      log.timestamp.toLowerCase().includes(term) ||
      log.level.toLowerCase().includes(term)
    );
  });

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'fatal':
        return 'red';
      case 'warning':
        return 'orange';
      case 'notice':
        return 'blue';
      case 'deprecated':
        return 'grape';
      default:
        return 'gray';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'fatal':
        return <IconAlertCircle size={14} />;
      case 'warning':
        return <IconAlertTriangle size={14} />;
      case 'notice':
        return <IconInfoCircle size={14} />;
      default:
        return <IconFileText size={14} />;
    }
  };

  return (
    <Stack gap="lg">
      {/* Header Bar */}
      <Paper p="md" radius="md" withBorder bg="dark.8">
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <Button
              variant="light"
              color="gray"
              leftSection={<IconArrowLeft size={16} />}
              onClick={onBack}
            >
              Voltar aos Alvos
            </Button>

            <div>
              <Group gap="xs">
                <Title order={3}>Logs do WordPress em Tempo Real</Title>
                <Badge
                  color={website.environment === 'production' ? 'red' : website.environment === 'staging' ? 'orange' : 'teal'}
                  variant="light"
                >
                  {(website.environment || 'production').toUpperCase()}
                </Badge>
              </Group>
              <Text c="dimmed" size="sm">
                Monitoramento remoto de erros PHP do site{' '}
                <Text component="span" fw={600} c="indigo.3">
                  {website.name}
                </Text>{' '}
                (
                <Text component="a" href={website.url} target="_blank" rel="noopener noreferrer" c="blue.4" size="sm">
                  {website.url} <IconExternalLink size={12} style={{ display: 'inline' }} />
                </Text>
                )
              </Text>
            </div>
          </Group>

          <Badge
            size="lg"
            color={loggingEnabled ? 'green' : 'gray'}
            variant="filled"
            leftSection={<IconPower size={14} />}
          >
            {loggingEnabled ? 'SISTEMA DE LOGS ATIVO' : 'LOGS DESATIVADOS'}
          </Badge>
        </Group>
      </Paper>

      {/* Control Panel / Toolbar */}
      <Paper p="md" radius="md" withBorder bg="dark.7">
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            {/* Toggle switch */}
            <Group gap="sm" bg="dark.8" p="xs" px="md" style={{ borderRadius: 8, border: '1px solid #373A40' }}>
              <IconPower size={18} color={loggingEnabled ? '#40C057' : '#909296'} />
              <Text size="sm" fw={500}>
                Captura de Debug:
              </Text>
              <Switch
                checked={loggingEnabled}
                onChange={handleToggle}
                disabled={actionLoading || loading}
                color="green"
                size="md"
              />
              <Text size="xs" c={loggingEnabled ? 'green.4' : 'dimmed'} fw={600}>
                {loggingEnabled ? 'HABILITADO' : 'DESABILITADO'}
              </Text>
            </Group>

            {/* Filter Pills */}
            <Group gap="xs" align="center">
              <Text size="xs" c="dimmed" fw={600}>
                FILTRAR POR NIVEL:
              </Text>
              <SegmentedControl
                size="xs"
                value={filterLevel}
                onChange={(val) => setFilterLevel(val)}
                data={[
                  { label: 'Todos', value: 'all' },
                  { label: 'Fatal', value: 'fatal' },
                  { label: 'Warning', value: 'warning' },
                  { label: 'Notice', value: 'notice' },
                  { label: 'Deprecated', value: 'deprecated' },
                ]}
                color="indigo"
              />
            </Group>

            {/* Action Buttons */}
            <Group gap="xs">
              <Button
                size="sm"
                variant="light"
                color="indigo"
                leftSection={<IconRefresh size={16} className={loading ? 'mantine-rotate' : ''} />}
                onClick={() => fetchLogs(filterLevel)}
                loading={loading}
              >
                Atualizar
              </Button>
              <Button
                size="sm"
                variant="light"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={handleClear}
                disabled={actionLoading || logs.length === 0}
              >
                Limpar Logs
              </Button>
            </Group>
          </Group>

          {/* Search bar */}
          <TextInput
            placeholder="Pesquisar registros de log por erro, função ou arquivo..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            rightSection={
              searchTerm ? (
                <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setSearchTerm('')}>
                  <IconTrash size={12} />
                </ActionIcon>
              ) : null
            }
          />
        </Stack>
      </Paper>

      {/* Feedback Messages */}
      {errorMsg && (
        <Alert icon={<IconAlertCircle size={16} />} title="Atenção" color="red" withCloseButton onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <Alert icon={<IconCheck size={16} />} title="Sucesso" color="green" withCloseButton onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Main Terminal Output Panel */}
      <Paper p="lg" radius="md" withBorder bg="dark.9" style={{ minHeight: 400 }}>
        {loading ? (
          <Center py="xl" style={{ flexDirection: 'column', gap: 16 }}>
            <Loader color="indigo" size="lg" />
            <Text size="sm" c="dimmed">
              Consultando logs em tempo real do WordPress...
            </Text>
          </Center>
        ) : filteredLogs.length === 0 ? (
          <Center py="xl" style={{ flexDirection: 'column', gap: 12, textAlign: 'center' }}>
            <ThemeIcon size={54} radius="xl" color="dark" variant="light">
              <IconTerminal size={32} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              Nenhum registro de log encontrado
            </Text>
            <Text size="sm" c="dimmed" style={{ maxWidth: 500 }}>
              {!loggingEnabled
                ? 'A captura de logs está desativada no plugin WordPress. Ative a chave de captura acima para começar a registrar erros e avisos.'
                : 'O WordPress está executando normalmente sem registros para os filtros selecionados.'}
            </Text>
          </Center>
        ) : (
          <Stack gap="sm">
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={600}>
                EXIBINDO {filteredLogs.length} DE {logs.length} REGISTROS
              </Text>
              <Text size="xs" c="dimmed">
                Arquivo: <Code>wp-content/uploads/wp-patropi-logs/debug.log</Code>
              </Text>
            </Group>

            <Divider color="dark.6" mb="xs" />

            {filteredLogs.map((log, idx) => (
              <Paper
                key={idx}
                p="md"
                radius="sm"
                bg="dark.8"
                style={{
                  borderLeft: `4px solid var(--mantine-color-${getLevelColor(log.level)}-6)`,
                  fontFamily: 'monospace',
                  position: 'relative',
                }}
              >
                <Group justify="space-between" align="flex-start" mb="xs">
                  <Group gap="xs">
                    <Badge
                      color={getLevelColor(log.level)}
                      variant="filled"
                      size="xs"
                      leftSection={getLevelIcon(log.level)}
                    >
                      {log.level.toUpperCase()}
                    </Badge>
                    <Text size="xs" c="dimmed" ff="monospace">
                      {log.timestamp}
                    </Text>
                  </Group>

                  <Tooltip label={copiedIndex === idx ? 'Copiado!' : 'Copiar Log'}>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color={copiedIndex === idx ? 'green' : 'gray'}
                      onClick={() => handleCopyLine(log.raw_line || log.message, idx)}
                    >
                      {copiedIndex === idx ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    </ActionIcon>
                  </Tooltip>
                </Group>

                <Box
                  component="pre"
                  m={0}
                  p={0}
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: '#E0E0E0',
                  }}
                >
                  {log.message}
                </Box>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
};
