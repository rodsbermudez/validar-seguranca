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
  IconAlertTriangle,
  IconArrowRight,
  IconArrowLeft,
  IconSparkles,
  IconBrandWhatsapp,
  IconRocket,
  IconCreditCard,
  IconMapPin,
} from '@tabler/icons-react';
import {
  Plan,
  initiateCheckout,
  getCheckoutStatus,
  simulateConfirmCheckout,
  checkCheckoutEmail,
  CheckoutInitiateResponse,
  PaymentMethodsConfig,
  getPublicPaymentMethods,
} from '../api';

interface CheckoutModalProps {
  opened: boolean;
  onClose: () => void;
  selectedPlan: Plan | null;
  currentUser?: any;
  initialExtraWebsites?: number;
  initialExtraAiPacks?: number;
  paymentMethods?: PaymentMethodsConfig;
  onOpenLogin?: () => void;
  onPaymentSuccess: (user: any, token?: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  opened,
  onClose,
  selectedPlan,
  currentUser,
  initialExtraWebsites = 0,
  initialExtraAiPacks = 0,
  paymentMethods,
  onOpenLogin,
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

  // Email validation state
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Active payment methods configuration
  const [activePaymentMethods, setActivePaymentMethods] = useState<PaymentMethodsConfig>(
    paymentMethods || { credit_card: true, pix: false }
  );

  useEffect(() => {
    if (paymentMethods) {
      setActivePaymentMethods(paymentMethods);
    }
  }, [paymentMethods]);

  useEffect(() => {
    if (opened && !paymentMethods) {
      getPublicPaymentMethods()
        .then((res) => {
          if (res && res.payment_methods) {
            setActivePaymentMethods(res.payment_methods);
          }
        })
        .catch((e) => console.warn('Could not fetch public payment methods:', e));
    }
  }, [opened, paymentMethods]);

  const allowCreditCard = activePaymentMethods.credit_card;
  const allowPix = activePaymentMethods.pix;

  // Payment method: credit_card or pix
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix'>(
    allowCreditCard ? 'credit_card' : 'pix'
  );

  // Credit Card fields
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCcv, setCardCcv] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressNumber, setAddressNumber] = useState('');

  // Add-ons
  const [extraWebsites, setExtraWebsites] = useState<number>(initialExtraWebsites);
  const [extraAiPacks, setExtraAiPacks] = useState<number>(initialExtraAiPacks); // cada pack = 250k tokens por R$ 60

  // Payment response & verification state
  const [checkoutData, setCheckoutData] = useState<CheckoutInitiateResponse | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const pollingRef = useRef<any>(null);

  // Pre-fill fields if user is logged in
  useEffect(() => {
    if (opened) {
      setStep('form');
      setError(null);
      setEmailChecking(false);
      setEmailExists(false);
      setEmailError(null);
      setCheckoutData(null);
      setExtraWebsites(initialExtraWebsites);
      setExtraAiPacks(initialExtraAiPacks);
      setPaymentMethod(allowCreditCard ? 'credit_card' : 'pix');
      setCardHolder('');
      setCardNumber('');
      setCardExpiry('');
      setCardCcv('');
      setPostalCode('');
      setAddressNumber('');

      if (currentUser) {
        setName(currentUser.name || '');
        setEmail(currentUser.email || '');
        setEmailExists(false);
        setEmailError(null);
      } else {
        setName('');
        setEmail('');
        setCpfCnpj('');
        setPhone('');
        setPassword('');
        setEmailExists(false);
        setEmailError(null);
      }
    }
  }, [opened, currentUser]);

  const validateEmailAvailability = async (emailToTest: string) => {
    if (currentUser) return;
    const clean = emailToTest.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setEmailExists(false);
      setEmailError(null);
      return;
    }

    try {
      setEmailChecking(true);
      const res = await checkCheckoutEmail(clean);
      if (res.exists) {
        setEmailExists(true);
        setEmailError('Este e-mail já possui cadastro na plataforma.');
      } else {
        setEmailExists(false);
        setEmailError(null);
      }
    } catch (err) {
      console.error('Erro ao checar email:', err);
    } finally {
      setEmailChecking(false);
    }
  };

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

  // Format Card Number (0000 0000 0000 0000)
  const handleCardNumberChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 19);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
  };

  // Format Card Expiry (MM/AA)
  const handleCardExpiryChange = (val: string) => {
    let digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 2) {
      const month = parseInt(digits.slice(0, 2), 10);
      if (month > 12) {
        digits = '12' + digits.slice(2);
      } else if (month === 0 && digits.length === 2) {
        digits = '01';
      }
      setCardExpiry(digits.slice(0, 2) + '/' + digits.slice(2));
    } else {
      setCardExpiry(digits);
    }
  };

  // Format Card CVV (3 or 4 digits)
  const handleCardCcvChange = (val: string) => {
    setCardCcv(val.replace(/\D/g, '').slice(0, 4));
  };

  // Format Postal Code CEP (00000-000)
  const handlePostalCodeChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) {
      setPostalCode(digits);
    } else {
      setPostalCode(`${digits.slice(0, 5)}-${digits.slice(5)}`);
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

    // Validate Credit Card fields if selected
    if (paymentMethod === 'credit_card') {
      if (!cardHolder.trim()) {
        setError('Por favor, informe o nome do titular como impresso no cartão.');
        return;
      }

      const cleanNumber = cardNumber.replace(/\D/g, '');
      if (cleanNumber.length < 13 || cleanNumber.length > 19) {
        setError('Por favor, informe um número de cartão de crédito válido (13 a 19 dígitos).');
        return;
      }

      const [monthStr, yearStrRaw] = cardExpiry.split('/');
      const monthNum = parseInt(monthStr, 10);
      if (!monthStr || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        setError('Por favor, informe um mês de validade válido (01 a 12).');
        return;
      }

      if (!yearStrRaw || yearStrRaw.length < 2) {
        setError('Por favor, informe o ano de validade do cartão (ex: 28 ou 2028).');
        return;
      }

      const cleanCcv = cardCcv.replace(/\D/g, '');
      if (cleanCcv.length < 3 || cleanCcv.length > 4) {
        setError('O código de segurança (CVV) deve possuir 3 ou 4 dígitos.');
        return;
      }

      const cleanCep = postalCode.replace(/\D/g, '');
      if (cleanCep.length !== 8) {
        setError('Por favor, informe um CEP válido com 8 dígitos para o faturamento do cartão.');
        return;
      }

      if (!addressNumber.trim()) {
        setError('Por favor, informe o número do endereço do titular.');
        return;
      }
    }

    if (!currentUser) {
      if (emailExists) {
        setError('Este e-mail já possui cadastro na plataforma. Por favor, faça login com sua conta para continuar.');
        return;
      }

      try {
        setEmailChecking(true);
        const checkRes = await checkCheckoutEmail(email.trim().toLowerCase());
        if (checkRes.exists) {
          setEmailExists(true);
          setEmailError('Este e-mail já possui cadastro na plataforma.');
          setError('Este e-mail já possui cadastro na plataforma. Por favor, faça login com sua conta para contratar ou gerenciar sua assinatura.');
          return;
        }
      } catch (e) {
        // Ignora falha de rede da checagem prévia e deixa o backend validar
      } finally {
        setEmailChecking(false);
      }
    }

    setLoading(true);

    try {
      const payload: any = {
        plan_id: selectedPlan.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        cpf_cnpj: cleanCpf,
        phone: phone.replace(/\D/g, ''),
        password: password || undefined,
        billing_type: paymentMethod === 'credit_card' ? 'CREDIT_CARD' : 'PIX',
        extra_websites: extraWebsites,
        extra_websites_price: extraWebsitesPrice,
        extra_ai_tokens: extraAiTokens,
        extra_ai_tokens_price: extraAiPrice,
        is_new_signup: !currentUser,
      };

      if (paymentMethod === 'credit_card') {
        const [monthStr, yearStrRaw] = cardExpiry.split('/');
        const yearStr = yearStrRaw.length === 2 ? `20${yearStrRaw}` : yearStrRaw;
        const cleanCep = postalCode.replace(/\D/g, '');

        payload.credit_card = {
          holder_name: cardHolder.trim().toUpperCase(),
          number: cardNumber.replace(/\D/g, ''),
          expiry_month: monthStr.padStart(2, '0'),
          expiry_year: yearStr,
          ccv: cardCcv.replace(/\D/g, ''),
          postal_code: cleanCep,
          address_number: addressNumber.trim(),
        };
        payload.postal_code = cleanCep;
        payload.address_number = addressNumber.trim();
      }

      const res = await initiateCheckout(payload);
      setCheckoutData(res);

      if (res.activated) {
        // Ativação imediata no cartão de crédito
        if (res.token && res.user) {
          localStorage.setItem('jwt_token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));
        }
        setStep('success');
      } else if (paymentMethod === 'credit_card') {
        // Se foi cartão mas status requer acompanhamento
        if (res.token && res.user) {
          localStorage.setItem('jwt_token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));
        }
        setStep('success');
      } else {
        // Fluxo Pix
        setStep('pix');
      }
    } catch (err: any) {
      if (err?.response?.data?.user_exists) {
        setEmailExists(true);
        setEmailError('Este e-mail já possui cadastro na plataforma.');
      }
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
              ? 'Contratação de Plano'
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailExists) {
                    setEmailExists(false);
                    setEmailError(null);
                  }
                }}
                onBlur={(e) => validateEmailAvailability(e.target.value)}
                required
                type="email"
                disabled={!!currentUser}
                error={emailError}
                rightSection={
                  emailChecking ? (
                    <Loader size="xs" color="indigo" />
                  ) : emailExists ? (
                    <IconAlertCircle size={18} color="var(--mantine-color-red-5)" />
                  ) : email && !emailError && !currentUser ? (
                    <IconCheck size={18} color="var(--mantine-color-green-5)" />
                  ) : null
                }
              />
            </SimpleGrid>

            {emailExists && !currentUser && (
              <Alert
                color="yellow"
                variant="light"
                icon={<IconAlertTriangle size={18} />}
                title="E-mail já cadastrado na plataforma"
              >
                <Stack gap="xs">
                  <Text size="sm">
                    Identificamos que o e-mail <strong>{email}</strong> já possui uma conta ativa. Para assinar um novo plano ou gerenciar sua assinatura, faça login na sua conta existente.
                  </Text>
                  {onOpenLogin && (
                    <Group>
                      <Button
                        size="xs"
                        variant="filled"
                        color="yellow"
                        onClick={() => {
                          onClose();
                          onOpenLogin();
                        }}
                      >
                        Fazer Login com esta Conta
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Alert>
            )}

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

            <Divider label="Forma de Pagamento da Assinatura" labelPosition="center" color="dark.5" />

            {allowCreditCard && allowPix && (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                <Paper
                  p="sm"
                  radius="md"
                  onClick={() => setPaymentMethod('credit_card')}
                  style={{
                    cursor: 'pointer',
                    background: paymentMethod === 'credit_card' ? 'rgba(26, 127, 134, 0.18)' : 'rgba(30, 41, 59, 0.5)',
                    border: paymentMethod === 'credit_card' ? '2px solid #1A7F86' : '1px solid rgba(255, 255, 255, 0.08)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <IconCreditCard size={18} color={paymentMethod === 'credit_card' ? '#1A7F86' : '#94a3b8'} />
                      <Text size="sm" fw={700} c={paymentMethod === 'credit_card' ? 'white' : 'gray.4'}>
                        Cartão de Crédito
                      </Text>
                    </Group>
                    <Badge size="xs" color="sitehub" variant="light">Automático</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Cobrança recorrente mensal sem risco de interrupção.
                  </Text>
                </Paper>

                <Paper
                  p="sm"
                  radius="md"
                  onClick={() => setPaymentMethod('pix')}
                  style={{
                    cursor: 'pointer',
                    background: paymentMethod === 'pix' ? 'rgba(6, 214, 160, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                    border: paymentMethod === 'pix' ? '2px solid #06d6a0' : '1px solid rgba(255, 255, 255, 0.08)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <IconQrcode size={18} color={paymentMethod === 'pix' ? '#06d6a0' : '#94a3b8'} />
                      <Text size="sm" fw={700} c={paymentMethod === 'pix' ? 'white' : 'gray.4'}>
                        Pix Instantâneo
                      </Text>
                    </Group>
                    <Badge size="xs" color="emerald" variant="light">QR Code</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Pagamento com QR Code instantâneo a cada renovação.
                  </Text>
                </Paper>
              </SimpleGrid>
            )}

            {allowCreditCard && !allowPix && (
              <Paper p="sm" radius="md" bg="rgba(26, 127, 134, 0.12)" style={{ border: '1px solid rgba(26, 127, 134, 0.35)' }}>
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconCreditCard size={18} color="#1A7F86" />
                    <div>
                      <Text size="sm" fw={700} c="white">
                        Pagamento via Cartão de Crédito
                      </Text>
                      <Text size="xs" c="dimmed">
                        Cobrança mensal recorrente com ativação imediata dos limites.
                      </Text>
                    </div>
                  </Group>
                  <Badge size="xs" color="sitehub" variant="light">Recorrência Automática</Badge>
                </Group>
              </Paper>
            )}

            {!allowCreditCard && allowPix && (
              <Paper p="sm" radius="md" bg="rgba(6, 214, 160, 0.1)" style={{ border: '1px solid rgba(6, 214, 160, 0.35)' }}>
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconQrcode size={18} color="#06d6a0" />
                    <div>
                      <Text size="sm" fw={700} c="white">
                        Pagamento via Pix Instantâneo
                      </Text>
                      <Text size="xs" c="dimmed">
                        Geração de QR Code e código Copia e Cola na próxima etapa.
                      </Text>
                    </div>
                  </Group>
                  <Badge size="xs" color="emerald" variant="light">QR Code</Badge>
                </Group>
              </Paper>
            )}

            {/* Campos de Cartão de Crédito */}
            {paymentMethod === 'credit_card' && (
              <Card p="sm" radius="md" bg="rgba(15, 23, 42, 0.6)" style={{ border: '1px solid rgba(26, 127, 134, 0.3)' }}>
                <Stack gap="xs">
                  <Text size="xs" fw={700} c="sitehub.4" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Dados do Cartão de Crédito
                  </Text>

                  <TextInput
                    label="Nome Impresso no Cartão"
                    placeholder="Ex: CARLOS E SILVA"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    required
                  />

                  <TextInput
                    label="Número do Cartão"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => handleCardNumberChange(e.target.value)}
                    leftSection={<IconCreditCard size={16} />}
                    required
                  />

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <TextInput
                      label="Validade (MM/AA)"
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChange={(e) => handleCardExpiryChange(e.target.value)}
                      maxLength={5}
                      required
                    />
                    <TextInput
                      label="Código de Segurança (CVV)"
                      placeholder="123"
                      value={cardCcv}
                      onChange={(e) => handleCardCcvChange(e.target.value)}
                      maxLength={4}
                      leftSection={<IconLock size={16} />}
                      required
                      type="password"
                    />
                  </SimpleGrid>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <TextInput
                      label="CEP do Titular"
                      placeholder="00000-000"
                      value={postalCode}
                      onChange={(e) => handlePostalCodeChange(e.target.value)}
                      maxLength={9}
                      leftSection={<IconMapPin size={16} />}
                      required
                    />
                    <TextInput
                      label="Número do Endereço"
                      placeholder="Ex: 100 ou S/N"
                      value={addressNumber}
                      onChange={(e) => setAddressNumber(e.target.value)}
                      required
                    />
                  </SimpleGrid>
                </Stack>
              </Card>
            )}

            <Button
              type="submit"
              size="md"
              color="sitehub"
              variant="gradient"
              gradient={
                paymentMethod === 'credit_card'
                  ? { from: '#1A7F86', to: '#118ab2' }
                  : { from: '#1A7F86', to: '#06d6a0' }
              }
              leftSection={
                paymentMethod === 'credit_card' ? (
                  <IconCreditCard size={18} />
                ) : (
                  <IconQrcode size={18} />
                )
              }
              loading={loading}
              fullWidth
              mt="xs"
            >
              {paymentMethod === 'credit_card'
                ? `Assinar no Cartão (R$ ${totalAmount.toFixed(2).replace('.', ',')}/mês)`
                : `Gerar Pix para Pagamento (R$ ${totalAmount.toFixed(2).replace('.', ',')})`}
            </Button>

            <Text size="xs" c="dimmed" ta="center">
              {paymentMethod === 'credit_card'
                ? '🔒 Transação criptografada de ponta a ponta. Recorrência automática processada pelo Asaas.'
                : '🔒 Pagamento seguro processado via gateway Asaas. Liberação automática via Pix.'}
            </Text>
          </Stack>
        </form>
      )}

      {/* PASSO 2: PIX QR CODE & COPIA E COLA */}
      {step === 'pix' && checkoutData && (
        <Stack gap="md" align="center">
          <Badge size="lg" color="emerald" variant="light" leftSection={<span className="pulse-green" />}>
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
                    color={copied ? 'emerald' : 'sitehub'}
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
                {isVerifying ? <Loader size="xs" color="sitehub" /> : <IconCheck size={14} color="#06d6a0" />}
                <Text size="xs" c="gray.3">
                  {isVerifying ? 'Monitorando liquidação bancária em tempo real...' : 'Aguardando liquidação do Pix...'}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                Expira em: {checkoutData.pix_expiration ? new Date(checkoutData.pix_expiration).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '30 minutos'}
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
                <Text size="xs" c="dimmed">Forma de Pagamento</Text>
                <Text size="sm" fw={600} c="indigo.3">
                  {checkoutData?.billing_type === 'CREDIT_CARD'
                    ? `Cartão •••• ${checkoutData.card_last4 || ''} (${checkoutData.card_brand || 'Crédito'})`
                    : 'Pix Instantâneo'}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Status</Text>
                <Badge color="green" variant="light" size="sm">Assinatura Ativa</Badge>
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

          {checkoutData?.billing_type === 'CREDIT_CARD' && (
            <Alert color="indigo" variant="light" w="100%">
              <Text size="xs">
                <b>Renovação Automática:</b> O plano será renovado mensalmente de forma automática em seu cartão de crédito. Você pode gerenciar ou cancelar sua assinatura a qualquer momento na tela de <b>Gestão do Plano</b>, com acesso assegurado até o fim do ciclo pago.
              </Text>
            </Alert>
          )}

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
