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
} from '@mantine/core';
import { IconShieldCheck, IconAlertCircle } from '@tabler/icons-react';
import { api } from '../api';

interface LoginModalProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export const LoginView: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@validar.local');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { email, password });
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

  return (
    <Container size={420} my={80}>
      <Group justify="center" mb={20}>
        <ThemeIcon size={60} radius="md" color="indigo" variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }}>
          <IconShieldCheck size={38} />
        </ThemeIcon>
      </Group>

      <Title ta="center" order={2} fw={700}>
        Validar Segurança
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
    </Container>
  );
};
