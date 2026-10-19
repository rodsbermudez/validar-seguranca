import React from 'react';
import { Card, Group, Text, Title, Button, Stack, ThemeIcon, Badge, SimpleGrid, Box } from '@mantine/core';
import { IconLock, IconSparkles, IconCheck, IconArrowRight } from '@tabler/icons-react';

interface UpgradeGateBannerProps {
  title?: string;
  description?: string;
  featureName?: string;
  onUpgradeClick?: () => void;
  compact?: boolean;
}

export const UpgradeGateBanner: React.FC<UpgradeGateBannerProps> = ({
  title = 'Desbloqueie as Ferramentas de Remediação Automática',
  description = 'Seu plano atual permite visualizar os diagnósticos e auditorias completas, mas as ferramentas ativas de correção (restauração de arquivos, atualizações remotas e plugin de fixes) exigem um plano pago.',
  featureName,
  onUpgradeClick,
  compact = false,
}) => {
  if (compact) {
    return (
      <Card
        p="sm"
        radius="md"
        bg="rgba(15, 23, 42, 0.75)"
        withBorder
        style={{
          borderColor: 'rgba(26, 127, 134, 0.4)',
          background: 'linear-gradient(135deg, rgba(26, 127, 134, 0.12) 0%, rgba(15, 23, 42, 0.9) 100%)',
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="sitehub" variant="light">
              <IconLock size={16} />
            </ThemeIcon>
            <div>
              <Group gap={6} align="center">
                <Text size="sm" fw={700} c="white">
                  {featureName ? `Ação bloqueada: ${featureName}` : title}
                </Text>
                <Badge size="xs" color="orange" variant="light">Plano Free</Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Faça o upgrade para executar correções automáticas e aplicar alterações remotas.
              </Text>
            </div>
          </Group>
          {onUpgradeClick && (
            <Button
              size="xs"
              variant="gradient"
              gradient={{ from: '#1A7F86', to: '#118ab2' }}
              rightSection={<IconArrowRight size={14} />}
              onClick={onUpgradeClick}
            >
              Liberar Ferramentas 🚀
            </Button>
          )}
        </Group>
      </Card>
    );
  }

  return (
    <Card
      p="lg"
      radius="lg"
      withBorder
      style={{
        background: 'linear-gradient(135deg, rgba(7, 59, 76, 0.35) 0%, rgba(15, 23, 42, 0.95) 100%)',
        borderColor: 'rgba(26, 127, 134, 0.45)',
        boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.4)',
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Group gap="sm">
            <ThemeIcon size={38} radius="md" color="sitehub" variant="gradient" gradient={{ from: '#1A7F86', to: '#118ab2' }}>
              <IconSparkles size={22} color="white" />
            </ThemeIcon>
            <div>
              <Group gap="xs" align="center">
                <Title order={4} c="white">
                  {title}
                </Title>
                <Badge size="sm" color="orange" variant="light">
                  Apenas Diagnóstico no Plano Free
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" mt={2} maw={680}>
                {description}
              </Text>
            </div>
          </Group>

          {onUpgradeClick && (
            <Button
              size="sm"
              variant="gradient"
              gradient={{ from: '#1A7F86', to: '#06d6a0' }}
              rightSection={<IconArrowRight size={16} />}
              onClick={onUpgradeClick}
              style={{ boxShadow: '0 4px 14px rgba(6, 214, 160, 0.25)' }}
            >
              Fazer Upgrade do Plano 🚀
            </Button>
          )}
        </Group>

        <Box
          p="sm"
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Text size="xs" fw={700} c="sitehub.4" mb="xs" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Vantagens exclusivas desbloqueadas nos Planos Pagos:
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xs">
            <Group gap={6} align="center" wrap="nowrap">
              <ThemeIcon size={18} radius="xl" color="emerald" variant="light">
                <IconCheck size={12} />
              </ThemeIcon>
              <Text size="xs" c="gray.3">
                Download do Plugin de Fixes
              </Text>
            </Group>
            <Group gap={6} align="center" wrap="nowrap">
              <ThemeIcon size={18} radius="xl" color="emerald" variant="light">
                <IconCheck size={12} />
              </ThemeIcon>
              <Text size="xs" c="gray.3">
                Restauração 1-click do Core WP.org
              </Text>
            </Group>
            <Group gap={6} align="center" wrap="nowrap">
              <ThemeIcon size={18} radius="xl" color="emerald" variant="light">
                <IconCheck size={12} />
              </ThemeIcon>
              <Text size="xs" c="gray.3">
                Atualização remota pelo painel
              </Text>
            </Group>
            <Group gap={6} align="center" wrap="nowrap">
              <ThemeIcon size={18} radius="xl" color="emerald" variant="light">
                <IconCheck size={12} />
              </ThemeIcon>
              <Text size="xs" c="gray.3">
                Geração de Soluções com IA
              </Text>
            </Group>
          </SimpleGrid>
        </Box>
      </Stack>
    </Card>
  );
};
