import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Title,
  Button,
  Badge,
  Card,
  TextInput,
  PasswordInput,
  Alert,
  Loader,
  Paper,
  Divider,
  CopyButton,
  Box,
  SimpleGrid,
  NumberInput,
} from '@mantine/core';
import {
  IconCheck,
  IconCopy,
  IconQrcode,
  IconShieldCheck,
  IconLock,
  IconAlertCircle,
  IconArrowRight,
  IconArrowLeft,
  IconSparkles,
  IconBrandWhatsapp,
  IconRocket,
} from '@tabler/icons-react';
import {
  Plan,
  initiateCheckout,
  getCheckoutStatus,
  simulateConfirmCheckout,
  CheckoutInitiateResponse,
} from '../api';

interface CheckoutModalProps {
  opened: boolean;
  onClose: () => void;
  selectedPlan: Plan | null;
  currentUser?: any;
  onPaymentSuccess: (user: any, token?: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  opened,
  onClose,
  selectedPlan,
  currentUser,
  onPaymentSuccess,
}) => {
  const [step, setStep] = useState<'form' | 'pix' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Add-ons
  const [extraWebsites, setExtraWebsites] = useState<number>(0);
  const [extraAiPacks, setExtraAiPacks] = useState<number>(0); // cada pack = 250k tokens por R$ 60

  // Pix payment state
  const [checkoutData, setCheckoutData] = useState<CheckoutInitiateResponse | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const pollingRef = useRef<any>(null);

  // Pre-fill fields if user is logged in
  useEffect(() => {
    if (opened) {
      setStep('form');
      setError(null);
      setCheckoutData(null);
      setExtraWebsites(0);
      setExtraAiPacks(0);

      if (currentUser) {
        setName(currentUser.name || '');
        setEmail(currentUser.email || '');
      } else {
        setName('');
        setEmail('');
        setCpfCnpj('');
        setPhone('');
        setPassword('');
      }
    }
  }, [opened, currentUser]);

  // Clean polling on unmount or step change
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Poll payment status while on 'pix' step
  useEffect(() => {
    if (step === 'pix' && checkoutData?.gateway_transaction_id) {
      setIsVerifying(true);
      pollingRef.current = setInterval(async () => {
        try {
          const res = await getCheckoutStatus(checkoutData.gateway_transaction_id);
          if (res.status === 'paid' && res.activated) {
            clearInterval(pollingRef.current);
            setIsVerifying(false);
            setStep('success');

            // If a token was generated, update auth session
            if (checkoutData.token && checkoutData.user) {
              localStorage.setItem('jwt_token', checkoutData.token);
              localStorage.setItem('user', JSON.stringify(checkoutData.user));
            }
          }
        } catch (e) {
          // Keep polling silently
        }
      }, 4000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [step, checkoutData]);

  if (!selectedPlan) return null;

  // Financial calculations
  const basePrice = Number(selectedPlan.price_monthly) || 0;
  const extraWebsitesPrice = extraWebsites * 8; // R$ 8 por site extra (ou R$ 40 por pacote de 5)
  const extraAiTokens = extraAiPacks * 250000;
  const extraAiPrice = extraAiPacks * 60; // R$ 60 por 250k tokens
  const totalAmount = basePrice + extraWebsitesPrice + extraAiPrice;

  // Format CPF/CNPJ mask
  const handleCpfChange = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (raw.length <= 11) {
      // CPF: 000.000.000-00
      setCpfCnpj(
        raw
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      );
    } else {
      // CNPJ: 00.000.000/0000-00
      setCpfCnpj(
        raw
          .slice(0, 14)
          .replace(/(\d{2})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1/$2')
          .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
      );
    }
  };

  // Format phone mask (00) 00000-0000
  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 10) {
      setPhone(raw.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3'));
    } else {
      setPhone(raw.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3'));
    }
  };

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCpf = cpfCnpj.replace(/\D/g, '');
    if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
      setError('Por favor, informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }

    if (!currentUser && (!password || password.length < 6)) {
      setError('A senha de acesso deve possuir pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const res = await initiateCheckout({
        plan_id: selectedPlan.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        cpf_cnpj: cleanCpf,
        phone: phone.replace(/\D/g, ''),
        password: password || undefined,
        extra_websites: extraWebsites,
        extra_websites_price: extraWebsitesPrice,
        extra_ai_tokens: extraAiTokens,
        extra_ai_tokens_price: extraAiPrice,
      });

      setCheckoutData(res);
      setStep('pix');
    } catch (err: any) {
      const msg =
        err?.response?.data?.messages?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Não foi possível iniciar o checkout. Verifique os dados informados.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!checkoutData?.gateway_transaction_id) return;
    setSimulating(true);
    try {
      await simulateConfirmCheckout(checkoutData.gateway_transaction_id);
      if (checkoutData.token && checkoutData.user) {
        localStorage.setItem('jwt_token', checkoutData.token);
        localStorage.setItem('user', JSON.stringify(checkoutData.user));
      }
      setStep('success');
    } catch (e: any) {
      setError('Erro ao simular confirmação: ' + (e?.message || 'Falha na requisição'));
    } finally {
      setSimulating(false);
    }
  };

  const handleGoToDashboard = () => {
    onClose();
    if (checkoutData?.user) {
      onPaymentSuccess(checkoutData.user, checkoutData.token);
    } else if (currentUser) {
      onPaymentSuccess(currentUser);
    } else {
      window.location.reload();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconShieldCheck size={22} color="var(--mantine-color-indigo-4)" />
          <Text fw={700} size="lg">
            {step === 'form'
              ? 'Contratação de Plano SaaS'
              : step === 'pix'
              ? 'Pagamento via Pix Instantâneo'
              : 'Assinatura Confirmada com Sucesso!'}
          </Text>
        </Group>
      }
      size="lg"
      radius="md"
      centered
      styles={{
        header: {
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        },
        content: {
          background: '#0f172a',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        },
      }}
    >
      {/* Resumo do Plano Selecionado */}
      <Paper p="md" radius="md" bg="rgba(30, 41, 59, 0.5)" mb="md" style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Group justify="space-between" align="center">
          <div>
            <Group gap="xs">
              <Title order={4} c="white">
                Plano {selectedPlan.name}
              </Title>
              <Badge color="indigo" variant="light">
                {selectedPlan.max_websites === null ? 'Sites Ilimitados' : `Até ${selectedPlan.max_websites} Sites`}
              </Badge>
              <Badge color="violet" variant="outline">
                {(selectedPlan.ai_monthly_tokens / 1000).toLocaleString('pt-BR')}k Tokens IA
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {selectedPlan.description || 'Auditoria contínua, telemetria em tempo real e remediação com IA.'}
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text size="xs" c="dimmed">Total Mensal</Text>
            <Title order={3} c="indigo.4">
              R$ {totalAmount.toFixed(2).replace('.', ',')}
              <Text span size="xs" c="dimmed" fw={400}> /mês</Text>
            </Title>
          </div>
        </Group>
      </Paper>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          variant="light"
          mb="md"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* PASSO 1: DADOS DO USUÁRIO & ADD-ONS */}
      {step === 'form' && (
        <form onSubmit={handleStartPayment}>
          <Stack gap="md">
            {/* Add-ons Opcionais */}
            <Card p="sm" radius="md" bg="rgba(15, 23, 42, 0.6)" style={{ border: '1px dashed rgba(99, 102, 241, 0.3)' }}>
              <Text size="xs" fw={700} c="indigo.3" mb="xs" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Add-ons Extras Opcionais
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Box>
                  <Text size="xs" fw={600} c="gray.3">
                    Sites Extras (+R$ 8/site)
                  </Text>
                  <Text size="xs" c="dimmed" mb={4}>
                    Aumente o limite de monitoramento
                  </Text>
                  <NumberInput
                    min={0}
                    max={100}
                    value={extraWebsites}
                    onChange={(val) => setExtraWebsites(Number(val) || 0)}
                    placeholder="0 sites"
                    size="xs"
                  />
                </Box>
                <Box>
                  <Text size="xs" fw={600} c="gray.3">
                    Pacotes IA (+250k tokens / R$ 60)
                  </Text>
                  <Text size="xs" c="dimmed" mb={4}>
                    Cota extra para remediação e código
                  </Text>
                  <NumberInput
                    min={0}
                    max={20}
                    value={extraAiPacks}
                    onChange={(val) => setExtraAiPacks(Number(val) || 0)}
                    placeholder="0 pacotes"
                    size="xs"
                  />
                </Box>
              </SimpleGrid>
            </Card>

            <Divider label="Dados do Titular da Conta" labelPosition="center" color="dark.5" />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Nome Completo"
                placeholder="Ex: Carlos Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <TextInput
                label="E-mail de Acesso"
                placeholder="seu.email@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                disabled={!!currentUser}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="CPF ou CNPJ"
                placeholder="000.000.000-00"
                value={cpfCnpj}
                onChange={(e) => handleCpfChange(e.target.value)}
                required
              />
              <TextInput
                label="WhatsApp / Telefone"
                placeholder="(11) 98765-4321"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                leftSection={<IconBrandWhatsapp size={16} color="var(--mantine-color-green-5)" />}
                required
              />
            </SimpleGrid>

            {!currentUser && (
              <PasswordInput
                label="Defina uma Senha de Acesso"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftSection={<IconLock size={16} />}
                required
                description="Você usará este e-mail e senha para acessar sua conta."
              />
            )}

            <Button
              type="submit"
              size="md"
              color="indigo"
              variant="gradient"
              gradient={{ from: 'indigo.6', to: 'blue.6' }}
              leftSection={<IconQrcode size={18} />}
              loading={loading}
              fullWidth
              mt="xs"
            >
              Gerar Pix para Pagamento (R$ {totalAmount.toFixed(2).replace('.', ',')})
            </Button>

            <Text size="xs" c="dimmed" ta="center">
              🔒 Pagamento seguro processado via gateway Asaas. Liberação automática via Pix.
            </Text>
          </Stack>
        </form>
      )}

      {/* PASSO 2: PIX QR CODE & COPIA E COLA */}
      {step === 'pix' && checkoutData && (
        <Stack gap="md" align="center">
          <Badge size="lg" color="green" variant="light" leftSection={<span className="pulse-green" />}>
            Aguardando Pagamento Pix
          </Badge>

          <Text size="sm" c="gray.3" ta="center">
            Abra o app do seu banco, escolha <b>Pagar com Pix</b> e escaneie o QR Code abaixo ou utilize a chave Copia e Cola:
          </Text>

          {/* QR Code Card */}
          <Paper
            p="md"
            radius="md"
            bg="white"
            style={{
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {checkoutData.pix_qr_code ? (
              <img
                src={checkoutData.pix_qr_code}
                alt="QR Code Pix Asaas"
                style={{ width: 220, height: 220, objectFit: 'contain' }}
              />
            ) : (
              <Box w={220} h={220} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconQrcode size={120} color="#333" />
              </Box>
            )}
          </Paper>

          {/* Copia e Cola */}
          <Box w="100%">
            <Text size="xs" fw={600} c="dimmed" mb={4}>
              Código Pix Copia e Cola:
            </Text>
            <Group gap="xs" style={{ width: '100%' }}>
              <TextInput
                value={checkoutData.pix_copy_paste || ''}
                readOnly
                size="sm"
                style={{ flex: 1 }}
                styles={{
                  input: {
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#a5b4fc',
                  },
                }}
              />
              <CopyButton value={checkoutData.pix_copy_paste || ''} timeout={2500}>
                {({ copied, copy }) => (
                  <Button
                    color={copied ? 'teal' : 'indigo'}
                    variant={copied ? 'filled' : 'light'}
                    onClick={copy}
                    leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  >
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                )}
              </CopyButton>
            </Group>
          </Box>

          {/* Status do Polling */}
          <Paper p="sm" radius="md" bg="rgba(30, 41, 59, 0.4)" w="100%" style={{ border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                {isVerifying ? <Loader size="xs" color="indigo" /> : <IconCheck size={14} color="#22c55e" />}
                <Text size="xs" c="gray.3">
                  {isVerifying ? 'Monitorando liquidação bancária em tempo real...' : 'Aguardando liquidação do Pix...'}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                Expira em: {new Date(checkoutData.pix_expiration).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Group>
          </Paper>

          {/* Botão de Teste em Modo Simulação / Sandbox */}
          {checkoutData.is_simulated && (
            <Alert color="violet" variant="light" w="100%">
              <Group justify="space-between" align="center">
                <Text size="xs">
                  <b>Ambiente de Homologação:</b> Como a chave de produção do Asaas ainda não está ativa, você pode simular a confirmação instantânea do Pix:
                </Text>
                <Button
                  size="xs"
                  color="violet"
                  variant="filled"
                  loading={simulating}
                  onClick={handleSimulatePayment}
                  leftSection={<IconSparkles size={14} />}
                >
                  Simular Pagamento Pix
                </Button>
              </Group>
            </Alert>
          )}

          <Group justify="space-between" w="100%" mt="xs">
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => setStep('form')}
            >
              Voltar aos Dados
            </Button>
            <Button
              variant="default"
              size="xs"
              onClick={onClose}
            >
              Concluir Depois
            </Button>
          </Group>
        </Stack>
      )}

      {/* PASSO 3: SUCESSO & LIBERAÇÃO DO PLANO */}
      {step === 'success' && (
        <Stack gap="lg" align="center" py="md">
          <Box
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(34, 197, 94, 0.5)',
            }}
          >
            <IconRocket size={44} color="#22c55e" />
          </Box>

          <div style={{ textAlign: 'center' }}>
            <Title order={3} c="white">
              Parabéns! Sua Assinatura está Ativa!
            </Title>
            <Text size="sm" c="dimmed" mt={4} maw={420}>
              O pagamento do <b>Plano {selectedPlan.name}</b> foi confirmado e todos os recursos de auditoria e IA já foram liberados para sua conta.
            </Text>
          </div>

          <Paper p="md" radius="md" bg="rgba(30, 41, 59, 0.5)" w="100%" style={{ border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <SimpleGrid cols={2} spacing="xs">
              <div>
                <Text size="xs" c="dimmed">Plano Contratado</Text>
                <Text size="sm" fw={600} c="white">{selectedPlan.name}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Valor Mensal</Text>
                <Text size="sm" fw={600} c="green.4">R$ {totalAmount.toFixed(2).replace('.', ',')}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Capacidade de Sites</Text>
                <Text size="sm" fw={600} c="white">
                  {selectedPlan.max_websites === null
                    ? 'Ilimitados'
                    : `${(selectedPlan.max_websites || 0) + extraWebsites} Sites`}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Cota Mensal de IA</Text>
                <Text size="sm" fw={600} c="violet.3">
                  {((selectedPlan.ai_monthly_tokens + extraAiTokens) / 1000).toLocaleString('pt-BR')}k Tokens
                </Text>
              </div>
            </SimpleGrid>
          </Paper>

          <Button
            size="lg"
            color="green"
            variant="gradient"
            gradient={{ from: 'teal.6', to: 'green.6' }}
            rightSection={<IconArrowRight size={18} />}
            fullWidth
            onClick={handleGoToDashboard}
          >
            Acessar Minha Plataforma Agora
          </Button>
        </Stack>
      )}
    </Modal>
  );
};
