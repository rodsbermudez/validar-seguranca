import React, { useState } from 'react';
import {
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Container,
  Group,
  ThemeIcon,
  Modal,
  Stack,
  Badge,
  Divider,
} from '@mantine/core';
import {
  IconShieldCheck,
  IconAlertCircle,
  IconAlertTriangle,
  IconRefresh,
  IconCheck,
  IconWorld,
  IconArrowLeft,
} from '@tabler/icons-react';
import { api, reactivateAccount } from '../api';

interface LoginModalProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export const LoginView: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@validar.local');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado de Reativação de Conta em Carência (90 dias)
  const [reactivationData, setReactivationData] = useState<any | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { email, password });
      
      // Caso a conta esteja em carência de 90 dias
      if (response.data?.needs_reactivation) {
        setReactivationData(response.data);
        return;
      }

      const { token, user } = response.data;
      localStorage.setItem('jwt_token', token);
      localStorage.setItem('user', JSON.stringify(user));

      onLoginSuccess(user, token);
    } catch (err: any) {
      setError(err.response?.data?.messages?.error || err.response?.data?.error || 'Email ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReactivation = async () => {
    if (!reactivationData) return;
    setReactivating(true);
    setReactivateError(null);

    try {
      const res = await reactivateAccount({
        reactivation_token: reactivationData.reactivation_token,
        email,
        password,
      });

      const { token, user } = res;
      localStorage.setItem('jwt_token', token);
      localStorage.setItem('user', JSON.stringify(user));

      setReactivationData(null);
      onLoginSuccess(user, token);
    } catch (err: any) {
      setReactivateError(
        err.response?.data?.messages?.error ||
          err.response?.data?.message ||
          'Falha ao reativar a conta. Tente novamente.'
      );
    } finally {
      setReactivating(false);
    }
  };

  return (
    <Container size={420} my={80}>
      <Group justify="center" mb={20}>
        <ThemeIcon size={60} radius="md" color="indigo" variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }}>
          <IconShieldCheck size={38} />
        </ThemeIcon>
      </Group>

      <Title ta="center" order={2} fw={700}>
        Vexors
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5} mb={30}>
        Painel de Auditoria e Segurança WordPress
      </Text>

      <Paper withBorder shadow="md" p={30} radius="md">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Erro no Acesso" color="red" mb={20}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextInput
            label="Email de Acesso"
            placeholder="admin@validar.local"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <PasswordInput
            label="Senha"
            placeholder="Sua senha"
            required
            mt="md"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Button fullWidth mt="xl" type="submit" loading={loading} color="indigo">
            Entrar no Painel
          </Button>
        </form>
      </Paper>

      {/* Modal de Reativação de Conta em Carência de 90 Dias */}
      <Modal
        opened={!!reactivationData}
        onClose={() => !reactivating && setReactivationData(null)}
        title={
          <Group gap="xs">
            <ThemeIcon color="teal" variant="light" size="sm" radius="md">
              <IconRefresh size={16} />
            </ThemeIcon>
            <Text fw={700} size="md" c="teal.4">
              Reativar Conta em Carência
            </Text>
          </Group>
        }
        centered
        radius="md"
        size="md"
        styles={{ content: { backgroundColor: '#1f2937' }, header: { backgroundColor: '#1f2937' } }}
      >
        <Stack gap="md">
          {reactivateError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="Falha na Reativação">
              {reactivateError}
            </Alert>
          )}

          <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={20} />} title="Sua conta está em processo de exclusão">
            <Text size="xs" fw={500}>
              Faltam <b>{reactivationData?.days_remaining || 0} dias</b> até a exclusão definitiva dos dados dos seus sites.
            </Text>
            <Text size="xs" mt={6} c="dimmed">
              Como você está dentro do prazo de carência de 90 dias, todos os seus sites cadastrados, notas e históricos de auditoria continuam salvos e podem ser totalmente recuperados agora.
            </Text>
          </Alert>

          <Paper withBorder p="sm" radius="md" style={{ backgroundColor: '#111827' }}>
            <Group justify="space-between" mb={6}>
              <Text size="xs" c="dimmed">Plano Anterior:</Text>
              <Badge color="indigo" variant="filled" size="sm">
                {reactivationData?.plan?.name || 'Plano Atual'}
              </Badge>
            </Group>
            <Group justify="space-between" mb={6}>
              <Text size="xs" c="dimmed">Sites Preservados:</Text>
              <Group gap={4}>
                <IconWorld size={14} color="#1A7F86" />
                <Text size="xs" fw={600}>{reactivationData?.user?.sites_count || 0} site(s)</Text>
              </Group>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Valor Mensal:</Text>
              <Text size="xs" fw={700} c="teal.3">
                {Number(reactivationData?.plan?.price_monthly) > 0
                  ? `R$ ${Number(reactivationData?.plan?.price_monthly).toFixed(2)}/mês`
                  : 'Gratuito'}
              </Text>
            </Group>
          </Paper>

          <Text size="xs" c="dimmed">
            Deseja reativar sua conta agora? Seus sites voltarão a ficar disponíveis imediatamente no seu painel.
          </Text>

          <Divider my={4} />

          <Group justify="flex-end" gap="xs">
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => setReactivationData(null)}
              disabled={reactivating}
              leftSection={<IconArrowLeft size={14} />}
            >
              Manter Cancelada
            </Button>
            <Button
              color="teal"
              size="sm"
              onClick={handleConfirmReactivation}
              loading={reactivating}
              leftSection={<IconCheck size={14} />}
            >
              Reativar Minha Conta Agora
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};
