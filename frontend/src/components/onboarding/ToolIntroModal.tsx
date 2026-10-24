import React from 'react';
import {
  Modal,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  ThemeIcon,
  Divider,
} from '@mantine/core';
import {
  IconLayoutDashboard,
  IconRadar,
  IconRefresh,
  IconFileCheck,
  IconNotes,
  IconTerminal,
  IconFileText,
  IconCheck,
  IconInfoCircle,
} from '@tabler/icons-react';

export type ToolIntroKey =
  | 'overview'
  | 'audit'
  | 'updates'
  | 'integrity'
  | 'activity_logs'
  | 'logs'
  | 'diagnostic_report';

interface ToolConfig {
  title: string;
  badgeText: string;
  color: string;
  icon: React.ReactNode;
  subtitle: string;
  bullets: Array<{
    title: string;
    description: string;
  }>;
  primaryActionLabel?: string;
}

const TOOL_CONFIGS: Record<ToolIntroKey, ToolConfig> = {
  overview: {
    title: 'Visão Geral & Recursos do Servidor',
    badgeText: 'Painel Central',
    color: 'indigo',
    icon: <IconLayoutDashboard size={20} />,
    subtitle: 'Seu centro de comando para acompanhar a integridade do site e a saúde da infraestrutura.',
    bullets: [
      {
        title: 'Status & Pontuação Geral',
        description: 'Visualize de imediato a pontuação de segurança, estado da conexão e resumo das últimas auditorias.',
      },
      {
        title: 'Telemetria do Servidor',
        description: 'Métricas ao vivo de Armazenamento em Disco (HD), versão PHP/MySQL, consumo de RAM e carga de processador (CPU).',
      },
      {
        title: 'Atualização Sob Demanda',
        description: 'Utilize o botão "Atualizar Consumo" para reconsultar as métricas do servidor em tempo real.',
      },
    ],
    primaryActionLabel: 'Explorar Visão Geral',
  },
  audit: {
    title: 'Auditoria de Segurança & Conformidade',
    badgeText: 'Scanner de Vulnerabilidades',
    color: 'teal',
    icon: <IconRadar size={20} />,
    subtitle: 'Varredura profunda nas defesas e configurações do WordPress para detectar falhas e vulnerabilidades.',
    bullets: [
      {
        title: 'Inspeção Completa de Segurança',
        description: 'Analisa cabeçalhos HTTP, certificados SSL, portas, proteção de uploads e boas práticas de firewall.',
      },
      {
        title: 'Nota Técnica & Classificação (Grade)',
        description: 'Cálculo de score de 0 a 100 categorizado por falhas críticas, médias e baixas.',
      },
      {
        title: 'Remediação Prática',
        description: 'Cada apontamento traz instruções técnicas claras para correção ou aplicação com 1 clique.',
      },
    ],
    primaryActionLabel: 'Iniciar Auditoria Agora',
  },
  updates: {
    title: 'Gestão de Atualizações & Rollback Seguro',
    badgeText: 'Proteção Ativa',
    color: 'blue',
    icon: <IconRefresh size={20} />,
    subtitle: 'Atualize o WordPress Core, plugins e temas com tranquilidade e proteção contra quebras em produção.',
    bullets: [
      {
        title: 'Sistema de Rollback Automático',
        description: 'Cria pontos de restauração antes de atualizar para que você possa reverter qualquer plugin que apresentar instabilidade.',
      },
      {
        title: 'Atualização Individual ou em Lote',
        description: 'Escolha atualizar plugins específicos ou aplique todas as pendências em um clique com logs detalhados.',
      },
      {
        title: 'Histórico Completo de Alterações',
        description: 'Audite todas as atualizações efetuadas, com carimbo de data, versão anterior e status do processo.',
      },
    ],
    primaryActionLabel: 'Verificar Atualizações',
  },
  integrity: {
    title: 'Integridade dos Arquivos do Core',
    badgeText: 'Checksums Oficiais WP',
    color: 'cyan',
    icon: <IconFileCheck size={20} />,
    subtitle: 'Verificação profunda para identificar se arquivos originais do WordPress foram modificados ou infectados.',
    bullets: [
      {
        title: 'Validação Criptográfica SHA-256',
        description: 'Compara os arquivos do seu WordPress diretamente com os hashes oficiais distribuídos pelo WordPress.org.',
      },
      {
        title: 'Detecção de Malwares e Backdoors',
        description: 'Sinaliza alterações não autorizadas em pastas sensíveis como wp-admin e wp-includes.',
      },
      {
        title: 'Recuperação Rápida',
        description: 'Permite identificar arquivos adulterados e restaurar a versão original limpa e segura.',
      },
    ],
    primaryActionLabel: 'Verificar Arquivos',
  },
  activity_logs: {
    title: 'Relatório de Atividades & Link para Clientes',
    badgeText: 'Gestão Transparente',
    color: 'violet',
    icon: <IconNotes size={20} />,
    subtitle: 'Registre as manutenções executadas e gere relatórios públicos com link seguro para seus clientes.',
    bullets: [
      {
        title: 'Link Público para o Cliente',
        description: 'Compartilhe um link seguro e elegante para o cliente acompanhar as notas e manutenções do site.',
      },
      {
        title: 'Segregação de Dados Confidenciais',
        description: 'O cliente vê apenas as notas de entrega; dados administrativos e logs internos permanecem protegidos.',
      },
      {
        title: 'Histórico & Ciclos Mensais',
        description: 'Acompanhe as rotinas de manutenção agendadas e registre cada intervenção com rich text.',
      },
    ],
    primaryActionLabel: 'Criar Primeira Nota',
  },
  logs: {
    title: 'Logs do Servidor & Error Report',
    badgeText: 'Diagnóstico em Tempo Real',
    color: 'orange',
    icon: <IconTerminal size={20} />,
    subtitle: 'Acompanhe erros fatais e o arquivo debug.log do WordPress diretamente pelo navegador.',
    bullets: [
      {
        title: 'Filtro de Erros Fatais (48h)',
        description: 'Detecta imediatamente falhas graves de PHP que podem comprometer o funcionamento do site.',
      },
      {
        title: 'Leitura Sem FTP ou SSH',
        description: 'Consulte os logs do WordPress em tempo real sem precisar abrir cPanel, FTP ou terminal.',
      },
      {
        title: 'Limpeza de Logs com 1 Clique',
        description: 'Esvazie arquivos de log pesados com segurança para economizar espaço em disco no servidor.',
      },
    ],
    primaryActionLabel: 'Consultar Logs',
  },
  diagnostic_report: {
    title: 'Relatório Executivo de Diagnóstico & PDF',
    badgeText: 'Documento Oficial',
    color: 'grape',
    icon: <IconFileText size={20} />,
    subtitle: 'Auditoria consolidada pronta para apresentação a diretores, clientes ou parceiros de tecnologia.',
    bullets: [
      {
        title: 'Visão Executiva Unificada',
        description: 'Reúne notas de conformidade, saúde de infraestrutura, status de plugins e itens resolvidos.',
      },
      {
        title: 'Exportação em PDF Contínuo',
        description: 'Gere um arquivo PDF de alta definição formatado profissionalmente e pronto para impressão ou envio.',
      },
      {
        title: 'Checklist de Avaliação Completo',
        description: 'Lista transparente de todas as regras checadas com status de Resolvido ou Pendente.',
      },
    ],
    primaryActionLabel: 'Gerar PDF do Relatório',
  },
};

interface ToolIntroModalProps {
  tool: ToolIntroKey | null;
  opened: boolean;
  onClose: () => void;
  onPrimaryAction?: () => void;
}

export const ToolIntroModal: React.FC<ToolIntroModalProps> = ({
  tool,
  opened,
  onClose,
  onPrimaryAction,
}) => {
  if (!tool) return null;
  const config = TOOL_CONFIGS[tool];
  if (!config) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="md"
      radius="md"
      centered
      title={
        <Group gap="xs">
          <ThemeIcon color={config.color} variant="light" size="md" radius="xl">
            {config.icon}
          </ThemeIcon>
          <div>
            <Text fw={700} size="sm">
              {config.title}
            </Text>
            <Text size="11px" c="dimmed">
              Primeiro Acesso • {config.badgeText}
            </Text>
          </div>
        </Group>
      }
    >
      <Stack gap="md" py="xs">
        <Text size="sm" c="dimmed">
          {config.subtitle}
        </Text>

        <Stack gap="xs">
          {config.bullets.map((bullet, idx) => (
            <Paper key={idx} p="sm" radius="md" bg="dark.7" withBorder>
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <ThemeIcon color={config.color} variant="light" size="sm" radius="xl" style={{ flexShrink: 0, marginTop: 2 }}>
                  <IconCheck size={12} />
                </ThemeIcon>
                <div>
                  <Text size="xs" fw={700}>
                    {bullet.title}
                  </Text>
                  <Text size="xs" c="dimmed" lh={1.4}>
                    {bullet.description}
                  </Text>
                </div>
              </Group>
            </Paper>
          ))}
        </Stack>

        <Paper p="xs" radius="sm" bg="dark.8">
          <Group gap="xs" wrap="nowrap">
            <ThemeIcon color="gray" variant="subtle" size="sm">
              <IconInfoCircle size={14} />
            </ThemeIcon>
            <Text size="11px" c="dimmed">
              Esta apresentação contextual só é exibida na primeira vez que você acessa esta tela.
            </Text>
          </Group>
        </Paper>

        <Divider my="xs" />

        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="xs" onClick={onClose}>
            Entendi, Explorar Tela
          </Button>
          {onPrimaryAction && (
            <Button
              color={config.color}
              size="xs"
              onClick={() => {
                onClose();
                onPrimaryAction();
              }}
            >
              {config.primaryActionLabel || 'Continuar'}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
};
