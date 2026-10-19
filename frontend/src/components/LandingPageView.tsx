import React, { useState, useEffect } from 'react';
import {
  Container,
  Group,
  Stack,
  Text,
  Title,
  Button,
  Badge,
  Card,
  Paper,
  ThemeIcon,
  Accordion,
  Modal,
  TextInput,
  PasswordInput,
  Alert,
  Loader,
  Center,
  SimpleGrid,
  Divider,
  Box,
  Anchor,
  Grid,
} from '@mantine/core';
import {
  IconShieldCheck,
  IconWorld,
  IconBrain,
  IconCheck,
  IconArrowRight,
  IconSparkles,
  IconCode,
  IconNotes,
  IconHelpCircle,
  IconExternalLink,
  IconLock,
  IconAlertCircle,
  IconLayoutDashboard,
  IconLayersLinked,
  IconX,
  IconRocket,
} from '@tabler/icons-react';
import { getPublicPlans, getDocsUrl, Plan, PaymentMethodsConfig, api } from '../api';
import { CheckoutModal } from './CheckoutModal';

interface LandingPageViewProps {
  onLoginSuccess: (user: any, token: string) => void;
  currentUser?: any;
  onGoToDashboard?: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onLoginSuccess,
  currentUser,
  onGoToDashboard,
}) => {
  // Modal de Login
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('admin@validar.local');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Modal de Contratação / Checkout Prévio
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);

  // Planos carregados dinamicamente do banco
  const [plans, setPlans] = useState<Plan[]>([
    {
      id: 4,
      name: 'Free',
      slug: 'free',
      description: 'Teste prático com diagnósticos de segurança para o seu site WordPress.',
      max_websites: 1,
      ai_monthly_tokens: 10000,
      price_monthly: 0.0,
      tools_enabled: 0,
      is_active: 1,
      is_default: 0,
      sort_order: 0,
    },
    {
      id: 1,
      name: 'Iniciante',
      slug: 'iniciante',
      description: 'Plano base para pequenos negócios e gestão essencial.',
      max_websites: 4,
      ai_monthly_tokens: 250000,
      price_monthly: 97.0,
      tools_enabled: 1,
      is_active: 1,
      is_default: 1,
      sort_order: 1,
    },
    {
      id: 2,
      name: 'Profissional',
      slug: 'profissional',
      description: 'Ideal para agências, desenvolvedores e carteiras em crescimento.',
      max_websites: 10,
      ai_monthly_tokens: 500000,
      price_monthly: 197.0,
      tools_enabled: 1,
      is_active: 1,
      is_default: 0,
      sort_order: 2,
    },
    {
      id: 3,
      name: 'Full',
      slug: 'full',
      description: 'Sites ilimitados e alto volume de processamento para operações críticas.',
      max_websites: null,
      ai_monthly_tokens: 2000000,
      price_monthly: 397.0,
      tools_enabled: 1,
      is_active: 1,
      is_default: 0,
      sort_order: 3,
    },
  ]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsConfig | undefined>(undefined);

  // Busca automática dos planos da plataforma
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true);
        const res = await getPublicPlans();
        if (res && res.data && res.data.length > 0) {
          setPlans(res.data);
        }
        if (res && res.payment_methods) {
          setPaymentMethods(res.payment_methods);
        }
      } catch (err) {
        console.warn('Usando planos padrão de fallback na Landing Page:', err);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  // Submissão do Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const response = await api.post('/auth/login', {
        email: loginEmail,
        password: loginPassword,
      });
      const { token, user } = response.data;

      localStorage.setItem('jwt_token', token);
      localStorage.setItem('user', JSON.stringify(user));

      setLoginModalOpen(false);
      onLoginSuccess(user, token);
    } catch (err: any) {
      setLoginError(
        err.response?.data?.messages?.error ||
          err.response?.data?.error ||
          'Email ou senha inválidos. Verifique os dados digitados.'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setContractModalOpen(true);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Box bg="#0a0e17" style={{ minHeight: '100vh', color: '#e2e8f0', overflowX: 'hidden' }}>
      {/* 1. Header / Navbar Fixo com Blur */}
      <Box
        component="header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'rgba(10, 14, 23, 0.88)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Container size="xl" h={72}>
          <Group justify="space-between" h="100%">
            {/* Logo */}
            <Group gap="sm" style={{ cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img
                src="images/vexors-logo.svg"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (target.dataset.tried === '1') {
                    target.src = '/images/vexors-logo.svg';
                    target.dataset.tried = '2';
                  } else if (!target.dataset.tried) {
                    target.src = '/validar-seguranca/images/vexors-logo.svg';
                    target.dataset.tried = '1';
                  }
                }}
                alt="Vexors"
                style={{ height: 42, width: 'auto', objectFit: 'contain' }}
              />
            </Group>

            {/* Menu Links */}
            <Group gap="xl" visibleFrom="md">
              <Anchor
                component="button"
                c="dimmed"
                fw={500}
                size="sm"
                onClick={() => scrollToSection('diferenciais')}
                style={{ textDecoration: 'none' }}
              >
                Diferenciais
              </Anchor>
              <Anchor
                component="button"
                c="dimmed"
                fw={500}
                size="sm"
                onClick={() => scrollToSection('funcionalidades')}
                style={{ textDecoration: 'none' }}
              >
                Funcionalidades
              </Anchor>
              <Anchor
                component="button"
                c="dimmed"
                fw={500}
                size="sm"
                onClick={() => scrollToSection('como-funciona')}
                style={{ textDecoration: 'none' }}
              >
                Como Funciona
              </Anchor>
              <Anchor
                component="button"
                c="dimmed"
                fw={500}
                size="sm"
                onClick={() => scrollToSection('planos')}
                style={{ textDecoration: 'none' }}
              >
                Planos & Preços
              </Anchor>
              <Anchor
                href={getDocsUrl()}
                target="_blank"
                c="dimmed"
                fw={500}
                size="sm"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Documentação <IconExternalLink size={13} />
              </Anchor>
            </Group>

            {/* Ações da Direita */}
            <Group gap="sm">
              {currentUser ? (
                <Button
                  variant="gradient"
                  gradient={{ from: '#1A7F86', to: '#118ab2' }}
                  size="sm"
                  leftSection={<IconLayoutDashboard size={16} />}
                  onClick={onGoToDashboard}
                >
                  Ir para o Painel
                </Button>
              ) : (
                <>
                  <Button
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => setLoginModalOpen(true)}
                  >
                    Entrar
                  </Button>
                  <Button
                    variant="gradient"
                    gradient={{ from: '#1A7F86', to: '#118ab2' }}
                    size="sm"
                    onClick={() => scrollToSection('planos')}
                  >
                    Ver Planos
                  </Button>
                </>
              )}
            </Group>
          </Group>
        </Container>
      </Box>

      {/* 2. Hero Section */}
      <Box
        py={{ base: 60, md: 90 }}
        style={{
          position: 'relative',
          background:
            'radial-gradient(circle at 50% 10%, rgba(26, 127, 134, 0.22) 0%, rgba(17, 138, 178, 0.08) 35%, transparent 70%)',
        }}
      >
        <Container size="xl">
          <Grid gutter={40} align="center">
            {/* Lado Esquerdo: Mensagem de Alto Impacto */}
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Badge
                size="lg"
                radius="xl"
                color="sitehub"
                variant="light"
                mb="md"
                leftSection={<span className="pulse-green" style={{ marginRight: 4 }} />}
                style={{ border: '1px solid rgba(26, 127, 134, 0.45)' }}
              >
                PROTEÇÃO HÍBRIDA & REMEDIAÇÃO COM IA PARA WORDPRESS
              </Badge>

              <Title
                order={1}
                fz={{ base: 32, sm: 42, md: 50 }}
                fw={900}
                lh={1.15}
                mb="md"
                style={{ letterSpacing: '-0.02em' }}
              >
                Auditoria Contínua, Blindagem Ativa e{' '}
                <Text
                  component="span"
                  inherit
                  variant="gradient"
                  gradient={{ from: '#06d6a0', to: '#1A7F86' }}
                >
                  Remediação com Inteligência Artificial
                </Text>
              </Title>

              <Text size="lg" c="#94a3b8" lh={1.65} mb="xl" style={{ maxWidth: 620 }}>
                Proteja sua carteira de sites WordPress contra vulnerabilidades, arquivos adulterados no core e ataques automatizados. Combine varreduras externas instantâneas com telemetria interna criptográfica e patches automáticos sob medida.
              </Text>

              <Group gap="md" wrap="wrap">
                <Button
                  size="md"
                  radius="md"
                  variant="gradient"
                  gradient={{ from: '#1A7F86', to: '#118ab2' }}
                  rightSection={<IconArrowRight size={18} />}
                  onClick={() => scrollToSection('planos')}
                  style={{ boxShadow: '0 8px 24px rgba(26, 127, 134, 0.35)' }}
                >
                  Conhecer os Planos
                </Button>
                <Button
                  size="md"
                  radius="md"
                  variant="default"
                  bg="rgba(30, 41, 59, 0.6)"
                  style={{ borderColor: 'rgba(255, 255, 255, 0.12)' }}
                  onClick={() => scrollToSection('como-funciona')}
                >
                  Ver Como Funciona
                </Button>
              </Group>

              {/* Indicadores Rápidos de Confiança */}
              <Group gap="xl" mt={40} pt={20} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div>
                  <Text fw={800} fz={22} c="#118ab2">
                    31+
                  </Text>
                  <Text size="xs" c="dimmed">
                    Testes de Segurança
                  </Text>
                </div>
                <Divider orientation="vertical" />
                <div>
                  <Text fw={800} fz={22} c="#06d6a0">
                    100%
                  </Text>
                  <Text size="xs" c="dimmed">
                    Integridade MD5 Core
                  </Text>
                </div>
                <Divider orientation="vertical" />
                <div>
                  <Text fw={800} fz={22} c="#ffd166">
                    Kimi K2.7
                  </Text>
                  <Text size="xs" c="dimmed">
                    IA Especializada em Código
                  </Text>
                </div>
              </Group>
            </Grid.Col>

            {/* Lado Direito: Radar de Segurança Mockup Tecnológico */}
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Paper
                p="lg"
                radius="lg"
                bg="#0f172a"
                withBorder
                style={{
                  borderColor: 'rgba(26, 127, 134, 0.4)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(26, 127, 134, 0.18)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Linha de janela macOS */}
                <Group justify="space-between" mb="md" pb="xs" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <Group gap={6}>
                    <Box w={10} h={10} style={{ borderRadius: '50%', backgroundColor: '#d1495b' }} />
                    <Box w={10} h={10} style={{ borderRadius: '50%', backgroundColor: '#ffd166' }} />
                    <Box w={10} h={10} style={{ borderRadius: '50%', backgroundColor: '#06d6a0' }} />
                    <Text size="xs" c="dimmed" ml={6}>
                      auditoria_wp.live
                    </Text>
                  </Group>
                  <Badge size="xs" color="emerald" variant="light" leftSection={<span className="pulse-green" />}>
                    AGENTE WP CONECTADO
                  </Badge>
                </Group>

                {/* Card do Score A+ */}
                <Card p="md" radius="md" bg="#1e293b" mb="sm" withBorder style={{ borderColor: 'rgba(26, 127, 134, 0.3)' }}>
                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                        Índice Geral de Segurança
                      </Text>
                      <Text fw={900} fz={32} c="#06d6a0">
                        98 <span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 500 }}>/ 100 pts</span>
                      </Text>
                      <Text size="xs" c="#06d6a0">
                        ● Grau Máximo A+ Atingido
                      </Text>
                    </div>

                    <Box
                      p={12}
                      style={{
                        borderRadius: '50%',
                        border: '3px solid #06d6a0',
                        width: 72,
                        h: 72,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(6, 214, 160, 0.1)',
                      }}
                    >
                      <Text fw={900} fz={26} c="#06d6a0">
                        A+
                      </Text>
                    </Box>
                  </Group>
                </Card>

                {/* Telemetrias e Status */}
                <Stack gap={8} mt="md">
                  <Paper p="xs" radius="sm" bg="rgba(2, 6, 23, 0.6)" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}>
                    <Group justify="space-between">
                      <Group gap={6}>
                        <IconShieldCheck size={16} color="#118ab2" />
                        <Text size="xs" fw={600}>
                          Hashes Oficiais WordPress.org
                        </Text>
                      </Group>
                      <Badge color="emerald" size="xs" variant="filled">
                        100% Íntegro
                      </Badge>
                    </Group>
                  </Paper>

                  <Paper p="xs" radius="sm" bg="rgba(2, 6, 23, 0.6)" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}>
                    <Group justify="space-between">
                      <Group gap={6}>
                        <IconLock size={16} color="#1A7F86" />
                        <Text size="xs" fw={600}>
                          Enumeração REST API & XML-RPC
                        </Text>
                      </Group>
                      <Badge color="sitehub" size="xs" variant="filled">
                        Blindado
                      </Badge>
                    </Group>
                  </Paper>

                  <Paper p="xs" radius="sm" bg="rgba(2, 6, 23, 0.6)" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}>
                    <Group justify="space-between">
                      <Group gap={6}>
                        <IconSparkles size={16} color="#ffd166" />
                        <Text size="xs" fw={600}>
                          Patches Gerados por IA
                        </Text>
                      </Group>
                      <Badge color="royalGold" size="xs" variant="filled">
                        Ativos c/ Granularidade
                      </Badge>
                    </Group>
                  </Paper>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      {/* 3. Seção Diferenciais: Por que a Proteção Híbrida? */}
      <Box id="diferenciais" py={70} bg="#0f172a" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <Container size="xl">
          <Center mb={40}>
            <Stack align="center" gap="xs">
              <Badge color="sitehub" variant="light" size="md">
                O DIFERENCIAL VEXORS
              </Badge>
              <Title order={2} ta="center" fz={{ base: 26, sm: 34 }}>
                Por que Ferramentas Comuns Falham na Segurança WordPress?
              </Title>
              <Text c="dimmed" size="sm" ta="center" style={{ maxWidth: 640 }}>
                Scanners de mercado olham apenas para a superfície e geram relatórios alarmistas sem resolver o problema. Nossa arquitetura une varredura externa com inspeção profunda de arquivos e remediação ativa.
              </Text>
            </Stack>
          </Center>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={30}>
            {/* Card Negativo: Scanners Comuns */}
            <Card
              p="xl"
              radius="md"
              bg="#111827"
              withBorder
              style={{ borderColor: 'rgba(239, 68, 68, 0.3)', borderLeft: '4px solid #ef4444' }}
            >
              <Group mb="md" gap="xs">
                <ThemeIcon color="red" variant="light" size="lg" radius="md">
                  <IconAlertCircle size={22} />
                </ThemeIcon>
                <Title order={3} fz="lg" c="#f87171">
                  Scanners Tradicionais de Mercado
                </Title>
              </Group>
              <Stack gap="sm">
                <Group gap="xs" align="flex-start">
                  <Text c="red" fw={700}>
                    ✕
                  </Text>
                  <Text size="sm" c="#94a3b8">
                    <strong>Apenas Varredura Superficial:</strong> Verificam somente o HTML público e cabeçalhos abertos.
                  </Text>
                </Group>
                <Group gap="xs" align="flex-start">
                  <Text c="red" fw={700}>
                    ✕
                  </Text>
                  <Text size="sm" c="#94a3b8">
                    <strong>Cegos para Backdoors:</strong> Não conseguem saber se o core do WordPress foi alterado ou se há injeções de código ocultas no servidor.
                  </Text>
                </Group>
                <Group gap="xs" align="flex-start">
                  <Text c="red" fw={700}>
                    ✕
                  </Text>
                  <Text size="sm" c="#94a3b8">
                    <strong>Zero Correção Automática:</strong> Entregam um PDF com dezenas de páginas e deixam todo o trabalho de implementação para você.
                  </Text>
                </Group>
              </Stack>
            </Card>

            {/* Card Positivo: Vexors */}
            <Card
              p="xl"
              radius="md"
              bg="#111827"
              withBorder
              style={{
                borderColor: 'rgba(16, 185, 129, 0.4)',
                borderLeft: '4px solid #10b981',
                boxShadow: '0 8px 30px rgba(16, 185, 129, 0.1)',
              }}
            >
              <Group mb="md" gap="xs">
                <ThemeIcon color="green" variant="light" size="lg" radius="md">
                  <IconShieldCheck size={22} />
                </ThemeIcon>
                <Title order={3} fz="lg" c="#34d399">
                  Plataforma Vexors
                </Title>
              </Group>
              <Stack gap="sm">
                <Group gap="xs" align="flex-start">
                  <Text c="green" fw={700}>
                    ✓
                  </Text>
                  <Text size="sm" c="#cbd5e1">
                    <strong>Proteção Híbrida de 360°:</strong> Varreduras externas não invasivas combinadas com o <strong>Plugin Agente WP</strong> instalado na aplicação.
                  </Text>
                </Group>
                <Group gap="xs" align="flex-start">
                  <Text c="green" fw={700}>
                    ✓
                  </Text>
                  <Text size="sm" c="#cbd5e1">
                    <strong>Integridade Criptográfica MD5:</strong> Compara cada arquivo do WordPress com os hashes oficiais do WordPress.org, erradicando malwares.
                  </Text>
                </Group>
                <Group gap="xs" align="flex-start">
                  <Text c="green" fw={700}>
                    ✓
                  </Text>
                  <Text size="sm" c="#cbd5e1">
                    <strong>Remediação com IA Kimi K2.7 Code:</strong> Gera o plugin de correção customizado e regras de servidor com switches individuais liga/desliga.
                  </Text>
                </Group>
              </Stack>
            </Card>
          </SimpleGrid>
        </Container>
      </Box>

      {/* 4. Funcionalidades Principais */}
      <Box id="funcionalidades" py={80}>
        <Container size="xl">
          <Center mb={50}>
            <Stack align="center" gap="xs">
              <Badge color="sitehub" variant="light" size="md">
                RECURSOS TECNOLÓGICOS
              </Badge>
              <Title order={2} ta="center" fz={{ base: 26, sm: 34 }}>
                Construído para Agências, Devs e Gestores de WordPress
              </Title>
              <Text c="dimmed" size="sm" ta="center" style={{ maxWidth: 600 }}>
                Tudo o que você precisa para manter sua carteira de clientes protegida com processos padronizados e relatórios de alto nível.
              </Text>
            </Stack>
          </Center>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={24}>
            {/* 1. Auditoria de 31+ Testes */}
            <Card p="lg" radius="md" bg="#0f172a" withBorder className="landing-card-glow" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <ThemeIcon size={46} radius="md" color="sitehub" variant="light" mb="md">
                <IconShieldCheck size={24} />
              </ThemeIcon>
              <Title order={3} fz="md" mb="xs">
                Auditoria de 31+ Vetores Críticos
              </Title>
              <Text size="xs" c="dimmed" lh={1.6}>
                Varreduras em cabeçalhos HTTP (HSTS, CSP, X-Frame-Options), arquivos de backup expostos, `.env`, logs de erro, interface XML-RPC e enumeração REST API.
              </Text>
            </Card>

            {/* 2. Integridade do Core */}
            <Card p="lg" radius="md" bg="#0f172a" withBorder className="landing-card-glow" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <ThemeIcon size={46} radius="md" color="emerald" variant="light" mb="md">
                <IconCode size={24} />
              </ThemeIcon>
              <Title order={3} fz="md" mb="xs">
                Integridade Criptográfica do Core
              </Title>
              <Text size="xs" c="dimmed" lh={1.6}>
                Inspeção arquivo a arquivo comparando com a versão oficial do WordPress.org. Identifica backdoors injetados e permite auto-fix instantâneo.
              </Text>
            </Card>

            {/* 3. Remediação com IA */}
            <Card p="lg" radius="md" bg="#0f172a" withBorder className="landing-card-glow" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <ThemeIcon size={46} radius="md" color="royalGold" variant="light" mb="md">
                <IconBrain size={24} />
              </ThemeIcon>
              <Title order={3} fz="md" mb="xs">
                Remediação com IA (Kimi K2.7 Code)
              </Title>
              <Text size="xs" c="dimmed" lh={1.6}>
                Geração automatizada de plugins PHP e regras para `.htaccess` e `nginx.conf`. Inteligência artificial especializada em segurança defensiva de código.
              </Text>
            </Card>

            {/* 4. Granularidade Sem Quebras */}
            <Card p="lg" radius="md" bg="#0f172a" withBorder className="landing-card-glow" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <ThemeIcon size={46} radius="md" color="secondary" variant="light" mb="md">
                <IconLayersLinked size={24} />
              </ThemeIcon>
              <Title order={3} fz="md" mb="xs">
                Controle Granular Liga/Desliga
              </Title>
              <Text size="xs" c="dimmed" lh={1.6}>
                O plugin <strong>WP Fixes</strong> conta com interruptor individual para cada proteção. Se uma regra conflitar com outro plugin, basta desligá-la em 1 clique.
              </Text>
            </Card>

            {/* 5. Diário Técnico & Manutenções */}
            <Card p="lg" radius="md" bg="#0f172a" withBorder className="landing-card-glow" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <ThemeIcon size={46} radius="md" color="balticBlue" variant="light" mb="md">
                <IconNotes size={24} />
              </ThemeIcon>
              <Title order={3} fz="md" mb="xs">
                Diário de Bordo & Manutenções
              </Title>
              <Text size="xs" c="dimmed" lh={1.6}>
                Cronograma mensal de manutenção preventiva para cada cliente. Registre tarefas com notas formatadas, blocos de código e links de comprovação.
              </Text>
            </Card>

            {/* 6. Link Público para Clientes */}
            <Card p="lg" radius="md" bg="#0f172a" withBorder className="landing-card-glow" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <ThemeIcon size={46} radius="md" color="oceanBlue" variant="light" mb="md">
                <IconWorld size={24} />
              </ThemeIcon>
              <Title order={3} fz="md" mb="xs">
                Link Público para Clientes Finais
              </Title>
              <Text size="xs" c="dimmed" lh={1.6}>
                Compartilhe com seu cliente o histórico técnico em modo somente-leitura com a identidade da sua agência, provando o valor das manutenções mensais.
              </Text>
            </Card>
          </SimpleGrid>
        </Container>
      </Box>

      {/* 5. Seção Como Funciona */}
      <Box id="como-funciona" py={80} bg="#0f172a" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <Container size="lg">
          <Center mb={50}>
            <Stack align="center" gap="xs">
              <Badge color="emerald" variant="light" size="md">
                PASSO A PASSO
              </Badge>
              <Title order={2} ta="center" fz={{ base: 26, sm: 34 }}>
                Pronto para Operar em Poucos Minutos
              </Title>
            </Stack>
          </Center>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing={30}>
            <Paper p="xl" radius="md" bg="#111827" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.08)', position: 'relative' }}>
              <Badge color="sitehub" size="xl" radius="xl" mb="md">
                Passo 1
              </Badge>
              <Title order={4} mb="xs">
                Cadastre o Domínio
              </Title>
              <Text size="xs" c="dimmed" lh={1.6}>
                Adicione a URL do WordPress na plataforma. Em menos de 10 segundos a primeira varredura externa de 31 testes é concluída com nota preliminar.
              </Text>
            </Paper>

            <Paper p="xl" radius="md" bg="#111827" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.08)', position: 'relative' }}>
              <Badge color="oceanBlue" size="xl" radius="xl" mb="md">
                Passo 2
              </Badge>
              <Title order={4} mb="xs">
                Conecte o Agente WP
              </Title>
              <Text size="xs" c="dimmed" lh={1.6}>
                Baixe o plugin agente leve no WordPress e cole a chave segura. A telemetria interna, verificação MD5 e logs em tempo real são habilitados na hora.
              </Text>
            </Paper>

            <Paper p="xl" radius="md" bg="#111827" withBorder style={{ borderColor: 'rgba(255, 255, 255, 0.08)', position: 'relative' }}>
              <Badge color="teal" size="xl" radius="xl" mb="md">
                Passo 3
              </Badge>
              <Title order={4} mb="xs">
                Remedie com IA & Nota A+
              </Title>
              <Text size="xs" c="dimmed" lh={1.6}>
                Gere os patches automáticos de remediação com IA, aplique as regras no servidor e acompanhe seu score subir para <strong>A+ (95 - 100 pts)</strong>.
              </Text>
            </Paper>
          </SimpleGrid>
        </Container>
      </Box>

      {/* 6. Seção de Planos & Preços (Dinâmica da Plataforma) */}
      <Box id="planos" py={90} style={{ position: 'relative' }}>
        <Container size="xl">
          <Center mb={50}>
            <Stack align="center" gap="xs">
              <Badge color="sitehub" variant="gradient" gradient={{ from: '#1A7F86', to: '#118ab2' }} size="lg">
                TABELA DE PLANOS & PACOTES
              </Badge>
              <Title order={2} ta="center" fz={{ base: 28, sm: 38 }}>
                Escolha o Plano Ideal para a sua Operação
              </Title>
              <Text c="dimmed" size="sm" ta="center" style={{ maxWidth: 620 }}>
                Planos mensais com previsibilidade total de custos. Uso de IA incluso na franquia contratada, sem cobranças variáveis inesperadas.
              </Text>
            </Stack>
          </Center>

          {loadingPlans ? (
            <Center py={40}>
              <Loader color="sitehub" size="lg" />
            </Center>
          ) : (
            <Grid gutter={20} align="stretch">
              {plans.slice(0, 4).map((plan) => {
                const isFree = Number(plan.price_monthly) === 0 || plan.slug === 'free';
                const isFeatured = plan.name.toLowerCase().includes('profissional') || plan.slug === 'profissional';
                const isFull = plan.slug === 'full' || plan.name.toLowerCase().includes('full');
                const isUnlimitedSites = plan.max_websites === null || plan.max_websites === 0;

                return (
                  <Grid.Col span={{ base: 12, sm: 6, lg: 3 }} key={plan.id}>
                    <Card
                      p="lg"
                      radius="lg"
                      bg={isFeatured ? '#0d252e' : '#0f172a'}
                      withBorder
                      h="100%"
                      className={isFeatured ? 'landing-card-featured' : 'landing-card-glow'}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transform: isFeatured ? 'scale(1.02)' : undefined,
                        zIndex: isFeatured ? 2 : 1,
                        border: isFeatured ? '2px solid #ef476f' : '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      {isFree && (
                        <Badge
                          color="gray"
                          variant="light"
                          size="sm"
                          radius="sm"
                          style={{
                            position: 'absolute',
                            top: 14,
                            right: 14,
                          }}
                        >
                          TESTE GRÁTIS
                        </Badge>
                      )}

                      {isFeatured && (
                        <Badge
                          color="secondary"
                          variant="filled"
                          size="sm"
                          radius="sm"
                          style={{
                            position: 'absolute',
                            top: 14,
                            right: 14,
                            boxShadow: '0 4px 12px rgba(239, 71, 111, 0.4)',
                          }}
                        >
                          ⭐ MAIS POPULAR
                        </Badge>
                      )}

                      {isFull && (
                        <Badge
                          color="royalGold"
                          variant="filled"
                          size="sm"
                          radius="sm"
                          c="dark.9"
                          style={{
                            position: 'absolute',
                            top: 14,
                            right: 14,
                            boxShadow: '0 4px 12px rgba(255, 209, 102, 0.4)',
                          }}
                        >
                          👑 ILIMITADO
                        </Badge>
                      )}

                      <div>
                        <Text fw={700} fz="lg" c={isFeatured ? '#06d6a0' : 'white'} mb={4}>
                          {plan.name}
                        </Text>
                        <Text size="xs" c="dimmed" mb="md" style={{ minHeight: 36 }}>
                          {plan.description || (isFree ? 'Teste prático com diagnósticos de segurança.' : 'Monitoramento e remediação profissional.')}
                        </Text>

                        {/* Preço Mensal */}
                        <Group align="baseline" gap={4} mb="md">
                          {isFree ? (
                            <>
                              <Text fw={900} fz={32} c="#06d6a0">
                                Grátis
                              </Text>
                              <Text size="xs" c="dimmed">
                                para sempre
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text fw={900} fz={32} c="#06d6a0">
                                {Number(plan.price_monthly).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </Text>
                              <Text size="xs" c="dimmed">
                                /mês
                              </Text>
                            </>
                          )}
                        </Group>

                        <Divider mb="md" color="dark.6" />

                        {/* Recursos do Plano */}
                        <Stack gap={8} mb="xl">
                          {/* Websites */}
                          <Group gap="xs" align="center" wrap="nowrap">
                            <ThemeIcon size={20} radius="xl" color="sitehub" variant="light">
                              <IconCheck size={12} />
                            </ThemeIcon>
                            <Text size="xs" fw={600}>
                              {isUnlimitedSites ? (
                                <span style={{ color: '#118ab2' }}>Websites Ilimitados</span>
                              ) : (
                                `${plan.max_websites} website${Number(plan.max_websites) > 1 ? 's' : ''} sob gestão`
                              )}
                            </Text>
                          </Group>

                          {/* IA Tokens */}
                          <Group gap="xs" align="center" wrap="nowrap">
                            <ThemeIcon size={20} radius="xl" color="secondary" variant="light">
                              <IconCheck size={12} />
                            </ThemeIcon>
                            <Text size="xs">
                              <strong>
                                {Number(plan.ai_monthly_tokens).toLocaleString('pt-BR')}
                              </strong>{' '}
                              tokens IA/mês
                            </Text>
                          </Group>

                          {/* Auditorias */}
                          <Group gap="xs" align="center" wrap="nowrap">
                            <ThemeIcon size={20} radius="xl" color="emerald" variant="light">
                              <IconCheck size={12} />
                            </ThemeIcon>
                            <Text size="xs">Auditorias de 31+ testes</Text>
                          </Group>

                          {/* Plugin Agente */}
                          <Group gap="xs" align="center" wrap="nowrap">
                            <ThemeIcon size={20} radius="xl" color="emerald" variant="light">
                              <IconCheck size={12} />
                            </ThemeIcon>
                            <Text size="xs">Plugin Agente WP Oficial</Text>
                          </Group>

                          {/* Integridade Core MD5 */}
                          <Group gap="xs" align="center" wrap="nowrap">
                            <ThemeIcon size={20} radius="xl" color="emerald" variant="light">
                              <IconCheck size={12} />
                            </ThemeIcon>
                            <Text size="xs">Integridade Core MD5</Text>
                          </Group>

                          {/* Plugin de Correções Automáticas */}
                          <Group gap="xs" align="center" wrap="nowrap">
                            <ThemeIcon
                              size={20}
                              radius="xl"
                              color={isFree ? 'gray' : 'emerald'}
                              variant={isFree ? 'outline' : 'light'}
                            >
                              {isFree ? <IconX size={12} color="#64748b" /> : <IconCheck size={12} />}
                            </ThemeIcon>
                            <Text
                              size="xs"
                              c={isFree ? 'dimmed' : undefined}
                              td={isFree ? 'line-through' : undefined}
                            >
                              Plugin de Correções (Fixes)
                            </Text>
                          </Group>

                          {/* Restauração de Arquivos */}
                          <Group gap="xs" align="center" wrap="nowrap">
                            <ThemeIcon
                              size={20}
                              radius="xl"
                              color={isFree ? 'gray' : 'emerald'}
                              variant={isFree ? 'outline' : 'light'}
                            >
                              {isFree ? <IconX size={12} color="#64748b" /> : <IconCheck size={12} />}
                            </ThemeIcon>
                            <Text
                              size="xs"
                              c={isFree ? 'dimmed' : undefined}
                              td={isFree ? 'line-through' : undefined}
                            >
                              Restauração 1-click WP.org
                            </Text>
                          </Group>

                          {/* Atualizações Remotas */}
                          <Group gap="xs" align="center" wrap="nowrap">
                            <ThemeIcon
                              size={20}
                              radius="xl"
                              color={isFree ? 'gray' : 'emerald'}
                              variant={isFree ? 'outline' : 'light'}
                            >
                              {isFree ? <IconX size={12} color="#64748b" /> : <IconCheck size={12} />}
                            </ThemeIcon>
                            <Text
                              size="xs"
                              c={isFree ? 'dimmed' : undefined}
                              td={isFree ? 'line-through' : undefined}
                            >
                              Atualizações pelo SaaS
                            </Text>
                          </Group>

                          {/* Soluções com IA */}
                          <Group gap="xs" align="center" wrap="nowrap">
                            <ThemeIcon
                              size={20}
                              radius="xl"
                              color={isFree ? 'gray' : 'emerald'}
                              variant={isFree ? 'outline' : 'light'}
                            >
                              {isFree ? <IconX size={12} color="#64748b" /> : <IconCheck size={12} />}
                            </ThemeIcon>
                            <Text
                              size="xs"
                              c={isFree ? 'dimmed' : undefined}
                              td={isFree ? 'line-through' : undefined}
                            >
                              Geração de Patches IA
                            </Text>
                          </Group>

                          {/* Diferencial do Profissional */}
                          {isFeatured && (
                            <Group gap="xs" align="center" wrap="nowrap">
                              <ThemeIcon size={20} radius="xl" color="secondary" variant="light">
                                <IconCheck size={12} />
                              </ThemeIcon>
                              <Text size="xs" fw={600} c="secondary.3">
                                Gestão de equipe & partilhas
                              </Text>
                            </Group>
                          )}

                          {/* Diferencial do Full */}
                          {isFull && (
                            <Group gap="xs" align="center" wrap="nowrap">
                              <ThemeIcon size={20} radius="xl" color="royalGold" variant="light">
                                <IconCheck size={12} />
                              </ThemeIcon>
                              <Text size="xs" fw={600} c="yellow.3">
                                White-label & suporte VIP
                              </Text>
                            </Group>
                          )}
                        </Stack>
                      </div>

                      <Button
                        size="sm"
                        radius="md"
                        variant={isFeatured ? 'gradient' : (isFree ? 'outline' : 'light')}
                        gradient={isFeatured ? { from: '#1A7F86', to: '#118ab2' } : undefined}
                        color={isFree ? 'emerald' : 'sitehub'}
                        fullWidth
                        rightSection={isFree ? <IconRocket size={16} /> : <IconArrowRight size={16} />}
                        onClick={() => handleSelectPlan(plan)}
                      >
                        {isFree ? 'Começar Grátis 🚀' : `Assinar ${plan.name}`}
                      </Button>
                    </Card>
                  </Grid.Col>
                );
              })}
            </Grid>
          )}

          {/* Card Explicativo de Add-ons */}
          <Paper
            p="lg"
            radius="md"
            mt={40}
            bg="#111827"
            withBorder
            style={{ borderColor: 'rgba(26, 127, 134, 0.35)' }}
          >
            <Group justify="space-between" align="center" wrap="wrap" gap="md">
              <Group gap="md">
                <ThemeIcon size={44} radius="md" color="royalGold" variant="light">
                  <IconSparkles size={24} />
                </ThemeIcon>
                <div>
                  <Text fw={700} size="sm">
                    Precisa de Mais Sites ou Quota Extra de IA? Sistema de Add-ons Sob Demanda
                  </Text>
                  <Text size="xs" c="dimmed">
                    Você pode expandir a capacidade do seu plano adicionando pacotes de +Sites e +Tokens de IA individualmente, mantendo total previsibilidade de faturamento.
                  </Text>
                </div>
              </Group>

              <Badge color="sitehub" variant="light" size="lg">
                Faturamento Transparente & Sem Surpresas
              </Badge>
            </Group>
          </Paper>
        </Container>
      </Box>

      {/* 7. FAQ */}
      <Box id="faq" py={80} bg="#0f172a" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <Container size="md">
          <Center mb={40}>
            <Stack align="center" gap="xs">
              <Badge color="gray" variant="light" size="md">
                DÚVIDAS FREQUENTES
              </Badge>
              <Title order={2} ta="center" fz={{ base: 24, sm: 32 }}>
                Perguntas Frequentes sobre a Plataforma
              </Title>
            </Stack>
          </Center>

          <Accordion variant="separated" radius="md">
            <Accordion.Item value="item-1" bg="#111827" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <Accordion.Control icon={<IconHelpCircle size={18} color="#38bdf8" />}>
                O plugin de remediação Vexors Fixes pode quebrar meu site?
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed" lh={1.6}>
                  Não. Os patches aplicam padrões defensivos seguros recomendados pela OWASP. Além disso, cada regra possui seu próprio interruptor (liga/desliga). Caso haja qualquer conflito com um formulário ou plugin legado de terceiro, basta desligar apenas aquela proteção específica sem desativar a blindagem do restante do site.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="item-2" bg="#111827" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <Accordion.Control icon={<IconHelpCircle size={18} color="#38bdf8" />}>
                Qual a diferença entre sites próprios e sites compartilhados?
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed" lh={1.6}>
                  Sites próprios são aqueles cadastrados diretamente por você e que consom as vagas contratadas do seu plano. Sites compartilhados são domínios que outros clientes ou agências concederam acesso a você: eles aparecem no seu painel geral sob gestão, mas <strong>não consom as vagas do seu plano contratado</strong>.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="item-3" bg="#111827" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <Accordion.Control icon={<IconHelpCircle size={18} color="#38bdf8" />}>
                Como funciona o consumo de Inteligência Artificial?
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed" lh={1.6}>
                  Os tokens de IA são consumidos quando você solicita diagnósticos aprofundados, gera soluções sob medida para o catálogo ou cria patches de servidor. O plano contempla uma franquia mensal generosa (ex: 500k no plano Profissional), 100% inclusa na mensalidade sem cobranças variáveis por chamada.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="item-4" bg="#111827" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <Accordion.Control icon={<IconHelpCircle size={18} color="#38bdf8" />}>
                O que acontece se eu ultrapassar a quantidade de sites do meu plano?
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed" lh={1.6}>
                  Você pode solicitar um upgrade de plano ou adicionar pacotes avulsos de sites extras via Add-ons diretamente com a administração da plataforma, sem necessidade de migrações complexas.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="item-5" bg="#111827" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <Accordion.Control icon={<IconHelpCircle size={18} color="#38bdf8" />}>
                Como o cliente final visualiza as manutenções?
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed" lh={1.6}>
                  Você pode gerar um <strong>Link Público</strong> protegido por token para cada site. O cliente final acessa um painel em modo somente-leitura com a marca da sua agência, comprovando as notas de manutenção preventiva e o status de integridade do site.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Container>
      </Box>

      {/* 8. Footer Institucional */}
      <Box
        component="footer"
        py={40}
        bg="#070a10"
        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <Container size="xl">
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap="sm">
              <img
                src="images/vexors-logo.svg"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (target.dataset.tried === '1') {
                    target.src = '/images/vexors-logo.svg';
                    target.dataset.tried = '2';
                  } else if (!target.dataset.tried) {
                    target.src = '/validar-seguranca/images/vexors-logo.svg';
                    target.dataset.tried = '1';
                  }
                }}
                alt="Vexors"
                style={{ height: 32, width: 'auto', objectFit: 'contain' }}
              />
              <Text size="xs" c="dimmed">
                © {new Date().getFullYear()} vexors.app . Todos os direitos reservados.
              </Text>
            </Group>

            <Group gap="lg">
              <Anchor href={getDocsUrl()} target="_blank" size="xs" c="dimmed">
                Documentação Oficial
              </Anchor>
              <Anchor component="button" size="xs" c="dimmed" onClick={() => setLoginModalOpen(true)}>
                Área do Cliente
              </Anchor>
              <Anchor component="button" size="xs" c="dimmed" onClick={() => scrollToSection('planos')}>
                Planos Comerciais
              </Anchor>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* 9. Modal de Login Rápido */}
      <Modal
        opened={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="sitehub" variant="light" size="md" radius="md">
              <IconLock size={18} />
            </ThemeIcon>
            <Text fw={700} size="md">
              Acessar a Plataforma
            </Text>
          </Group>
        }
        centered
        size="sm"
        overlayProps={{ backgroundOpacity: 0.7, blur: 6 }}
        styles={{
          content: {
            backgroundColor: '#0f172a',
            border: '1px solid rgba(26, 127, 134, 0.35)',
          },
          header: {
            backgroundColor: '#0f172a',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          },
        }}
      >
        <form onSubmit={handleLoginSubmit}>
          <Stack gap="md" mt="xs">
            {loginError && (
              <Alert icon={<IconAlertCircle size={16} />} color="amaranth" variant="filled">
                {loginError}
              </Alert>
            )}

            <TextInput
              label="E-mail de Acesso"
              placeholder="seu-email@dominio.com.br"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />

            <PasswordInput
              label="Senha"
              placeholder="Sua senha de acesso"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />

            <Button
              type="submit"
              variant="gradient"
              gradient={{ from: '#1A7F86', to: '#118ab2' }}
              fullWidth
              mt="xs"
              loading={loginLoading}
            >
              Entrar na Plataforma
            </Button>

            <Text size="xs" c="dimmed" ta="center">
              Dúvidas ou recuperação de acesso? Entre em contato com o suporte da Vexors.
            </Text>
          </Stack>
        </form>
      </Modal>

      {/* 10. Modal de Contratação & Checkout Asaas via Pix */}
      <CheckoutModal
        opened={contractModalOpen}
        onClose={() => setContractModalOpen(false)}
        selectedPlan={selectedPlan}
        currentUser={currentUser}
        paymentMethods={paymentMethods}
        onOpenLogin={() => setLoginModalOpen(true)}
        onPaymentSuccess={(user, token) => {
          setContractModalOpen(false);
          onLoginSuccess(user, token || '');
        }}
      />
    </Box>
  );
};
