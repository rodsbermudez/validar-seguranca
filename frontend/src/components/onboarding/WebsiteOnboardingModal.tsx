import React, { useState, useEffect } from 'react';
import {
  Modal,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  ThemeIcon,
  Badge,
  Code,
  ActionIcon,
  Tooltip,
  Loader,
  Box,
  Divider,
} from '@mantine/core';
import {
  IconDownload,
  IconPlugConnected,
  IconCheck,
  IconCopy,
  IconTools,
  IconRadar,
  IconShieldCheck,
  IconInfoCircle,
} from '@tabler/icons-react';
import { Website } from '../../api';

interface WebsiteOnboardingModalProps {
  opened: boolean;
  website: Website;
  isConnected: boolean;
  reconnecting: boolean;
  downloading: boolean;
  onDownloadPlugin: () => Promise<void> | void;
  onReconnect: () => Promise<void> | void;
  onStartAudit: () => void;
  onClose: () => void;
}

export const WebsiteOnboardingModal: React.FC<WebsiteOnboardingModalProps> = ({
  opened,
  website,
  isConnected,
  reconnecting,
  downloading,
  onDownloadPlugin,
  onReconnect,
  onStartAudit,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [copiedToken, setCopiedToken] = useState(false);

  // Se já estiver conectado ao abrir, vai direto para o passo 3
  useEffect(() => {
    if (isConnected && step < 3) {
      setStep(3);
    }
  }, [isConnected, step]);

  const handleCopyToken = () => {
    if (website.agent_token) {
      navigator.clipboard.writeText(website.agent_token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    }
  };

  const handleDownload = async () => {
    try {
      await onDownloadPlugin();
      setStep(2);
    } catch (e) {
      // Se falhar o download, ainda avança ou exibe erro
      setStep(2);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      radius="md"
      centered
      closeOnClickOutside={false}
      withCloseButton
      title={
        <Group gap="xs">
          <ThemeIcon
            color={step === 3 ? 'teal' : 'indigo'}
            variant="light"
            size="md"
            radius="xl"
          >
            {step === 3 ? <IconShieldCheck size={18} /> : <IconTools size={18} />}
          </ThemeIcon>
          <Text fw={700} size="sm">
            Guia de Conexão Inicial • Passo {step} de 3
          </Text>
        </Group>
      }
    >
      {/* PASSO 1: Boas-vindas e Download */}
      {step === 1 && (
        <Stack gap="md" py="xs">
          <Box>
            <Title order={4} mb={4}>
              Boas-vindas ao seu novo site no Vexors!
            </Title>
            <Text size="sm" c="dimmed">
              O site <strong style={{ color: '#fff' }}>{website.name}</strong> ({website.url}) foi cadastrado com sucesso.
            </Text>
          </Box>

          <Paper p="md" radius="md" bg="dark.7" withBorder>
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon color="indigo" variant="light" size="lg" radius="md" style={{ flexShrink: 0 }}>
                <IconInfoCircle size={20} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={600} mb={4}>
                  Por que conectar o Agente WordPress?
                </Text>
                <Text size="xs" c="dimmed" lh={1.5}>
                  O agente é o nosso plugin oficial de segurança. Ele permite realizar auditorias profundas,
                  monitorar recursos do servidor (HD, RAM e CPU) em tempo real e atualizar plugins com
                  sistema de rollback automático.
                </Text>
              </div>
            </Group>
          </Paper>

          <Paper p="md" radius="md" bg="indigo.9" style={{ border: '1px solid var(--mantine-color-indigo-6)' }}>
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <div>
                <Text size="sm" fw={700} c="white">
                  Plugin Pré-configurado Exclusivo
                </Text>
                <Text size="xs" c="indigo.1">
                  Já contém a chave de autenticação exclusiva gerada para este site.
                </Text>
              </div>
              <Button
                color="white"
                c="indigo.9"
                leftSection={<IconDownload size={16} />}
                loading={downloading}
                onClick={handleDownload}
              >
                Baixar Plugin WP (.zip)
              </Button>
            </Group>
          </Paper>

          <Divider my="xs" />

          <Group justify="space-between" align="center">
            <Button variant="subtle" color="gray" size="xs" onClick={onClose}>
              Configurar mais tarde
            </Button>
            <Button
              variant="light"
              color="indigo"
              size="xs"
              onClick={() => setStep(2)}
            >
              Já tenho o plugin baixado →
            </Button>
          </Group>
        </Stack>
      )}

      {/* PASSO 2: Ativação no WordPress */}
      {step === 2 && (
        <Stack gap="md" py="xs">
          <Box>
            <Title order={4} mb={4}>
              Instale e Ative o Plugin no WordPress
            </Title>
            <Text size="sm" c="dimmed">
              Siga os 3 passos rápidos para conectar o agente ao Vexors:
            </Text>
          </Box>

          <Stack gap="xs">
            <Paper p="sm" radius="md" bg="dark.7" withBorder>
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <Badge size="lg" circle color="indigo">1</Badge>
                <div>
                  <Text size="sm" fw={600}>Acesse seu painel WordPress</Text>
                  <Text size="xs" c="dimmed">
                    Vá em <strong>Plugins → Adicionar Novo</strong> no menu lateral do seu WordPress.
                  </Text>
                </div>
              </Group>
            </Paper>

            <Paper p="sm" radius="md" bg="dark.7" withBorder>
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <Badge size="lg" circle color="indigo">2</Badge>
                <div>
                  <Text size="sm" fw={600}>Envie e ative o arquivo .zip</Text>
                  <Text size="xs" c="dimmed">
                    Clique em <strong>Enviar Plugin</strong>, selecione o arquivo baixado e clique em <strong>Ativar Plugin</strong>.
                  </Text>
                </div>
              </Group>
            </Paper>

            <Paper p="sm" radius="md" bg="dark.7" withBorder>
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <Badge size="lg" circle color="indigo">3</Badge>
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={600}>Token do Agente (se solicitado)</Text>
                  <Text size="xs" c="dimmed" mb={4}>
                    O plugin já vem configurado, mas caso precise inserir a chave manualmente:
                  </Text>
                  <Group gap="xs" wrap="nowrap">
                    <Code block style={{ flex: 1, fontSize: 11, wordBreak: 'break-all' }}>
                      {website.agent_token || 'Token não gerado'}
                    </Code>
                    <Tooltip label={copiedToken ? 'Copiado!' : 'Copiar Token'}>
                      <ActionIcon
                        variant="light"
                        color={copiedToken ? 'teal' : 'indigo'}
                        onClick={handleCopyToken}
                      >
                        {copiedToken ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </div>
              </Group>
            </Paper>
          </Stack>

          {/* Status dinâmico da conexão */}
          <Paper p="sm" radius="md" bg="dark.8" withBorder>
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Group gap="xs">
                <Loader size="xs" color="teal" />
                <Text size="xs" c="dimmed">
                  Aguardando ativação no WordPress... O Vexors sincroniza automaticamente.
                </Text>
              </Group>

              <Button
                color="teal"
                size="xs"
                leftSection={<IconPlugConnected size={14} />}
                loading={reconnecting}
                onClick={onReconnect}
              >
                Testar Conexão Agora
              </Button>
            </Group>
          </Paper>

          <Divider my="xs" />

          <Group justify="space-between" align="center">
            <Button variant="subtle" color="gray" size="xs" onClick={() => setStep(1)}>
              ← Voltar ao Passo 1
            </Button>
            <Button variant="default" size="xs" onClick={onClose}>
              Já ativei / Concluir depois
            </Button>
          </Group>
        </Stack>
      )}

      {/* PASSO 3: Agente Conectado & Apresentação de Ferramentas */}
      {step === 3 && (
        <Stack gap="md" py="xs">
          <Box ta="center">
            <ThemeIcon color="teal" variant="light" size={54} radius="xl" mb="xs">
              <IconCheck size={32} />
            </ThemeIcon>
            <Title order={3} c="teal.4">
              Agente Conectado com Sucesso!
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              Seu WordPress agora está conectado com segurança ao Vexors.
            </Text>
          </Box>

          <Paper p="md" radius="md" bg="dark.7" withBorder>
            <Text size="sm" fw={700} mb="xs">
              🛠️ Como acessar as funcionalidades:
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              No topo da tela, clique no botão <strong>Ferramentas</strong> para navegar pelos módulos:
            </Text>

            <Stack gap={6}>
              <Text size="xs">
                • <strong>📊 Visão Geral:</strong> Resumo executivo e telemetria de HD, RAM, CPU e PHP/MySQL.
              </Text>
              <Text size="xs">
                • <strong>🛡️ Auditoria & Segurança:</strong> Varredura profunda com pontuação (0-100) e correções.
              </Text>
              <Text size="xs">
                • <strong>🔄 Atualizações:</strong> Atualize plugins e temas com rollback automático.
              </Text>
              <Text size="xs">
                • <strong>🔍 Integridade do Core:</strong> Verifique se arquivos oficiais WP foram adulterados.
              </Text>
              <Text size="xs">
                • <strong>📝 Logs de Atividades:</strong> Notas técnicas e geração do Link Público para Clientes.
              </Text>
              <Text size="xs">
                • <strong>⚡ Error Report:</strong> Logs de erros fatais do WordPress em tempo real.
              </Text>
            </Stack>
          </Paper>

          <Divider my="xs" />

          <Group justify="flex-end" gap="sm">
            <Button variant="default" size="sm" onClick={onClose}>
              Explorar Painel
            </Button>
            <Button
              color="indigo"
              size="sm"
              leftSection={<IconRadar size={16} />}
              onClick={() => {
                onClose();
                onStartAudit();
              }}
            >
              Iniciar Primeira Auditoria
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
};
