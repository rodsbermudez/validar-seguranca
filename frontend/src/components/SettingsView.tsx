import React, { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Group,
  Button,
  Card,
  SimpleGrid,
  Badge,
  Alert,
  Loader,
  Paper,
  Stack,
  ThemeIcon,
  Radio,
  ActionIcon,
  Tooltip,
  NumberInput,
} from '@mantine/core';
import {
  IconCpu,
  IconCheck,
  IconSparkles,
  IconShieldCheck,
  IconAlertTriangle,
  IconArrowLeft,
  IconRefresh,
  IconDeviceFloppy,
  IconAdjustments,
  IconCoins,
} from '@tabler/icons-react';
import { getSettings, updateSettings, AIModelOption } from '../api';

interface SettingsViewProps {
  onBack: () => void;
  currentUserRole?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack, currentUserRole = 'admin' }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<string>('kimi-k2.7-code');
  const [tokenPrice, setTokenPrice] = useState<number | string>(0);
  const [promptTokenPrice, setPromptTokenPrice] = useState<number | string>(0);
  const [completionTokenPrice, setCompletionTokenPrice] = useState<number | string>(0);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [availableModels, setAvailableModels] = useState<AIModelOption[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getSettings();
      if (res.success) {
        setActiveModel(res.active_ai_model || 'kimi-k2.7-code');
        const base = res.token_price_per_1k ?? 0;
        const pPrice = res.prompt_token_price_per_1k !== undefined ? res.prompt_token_price_per_1k : base;
        const cPrice = res.completion_token_price_per_1k !== undefined ? res.completion_token_price_per_1k : base;
        setTokenPrice(base);
        setPromptTokenPrice(pPrice);
        setCompletionTokenPrice(cPrice);
        setHasApiKey(res.has_api_key);
        setAvailableModels(res.available_models || []);
      } else {
        setErrorMsg(res.message || 'Falha ao carregar configurações.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Erro de conexão ao buscar configurações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const pPrice = Number(promptTokenPrice) || 0;
      const cPrice = Number(completionTokenPrice) || 0;
      const avg = Number(tokenPrice) || ((pPrice + cPrice) / 2);
      const res = await updateSettings(activeModel, avg, pPrice, cPrice);
      if (res.success) {
        setSuccessMsg(res.message || 'Configurações de IA e precificação atualizadas com sucesso para toda a plataforma!');
      } else {
        setErrorMsg(res.message || 'Erro ao salvar alterações.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Erro ao atualizar configurações.');
    } finally {
      setSaving(false);
    }
  };

  if (currentUserRole !== 'admin') {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertTriangle size={20} />} title="Acesso Restrito" color="red">
          Apenas administradores da plataforma possuem permissão para acessar a página de configurações de IA.
        </Alert>
        <Button leftSection={<IconArrowLeft size={16} />} mt="md" variant="subtle" onClick={onBack}>
          Voltar para Lista de Sites
        </Button>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      {/* Header */}
      <Paper radius="md" p="md" mb="xl" withBorder style={{ backgroundColor: 'var(--mantine-color-dark-7)' }}>
        <Group justify="space-between" align="center">
          <Group>
            <ActionIcon variant="light" color="indigo" size="lg" onClick={onBack}>
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Group gap="xs">
                <ThemeIcon size="md" radius="sm" color="indigo">
                  <IconAdjustments size={18} />
                </ThemeIcon>
                <Title order={2} style={{ color: '#fff' }}>
                  Configurações da Plataforma
                </Title>
              </Group>
              <Text size="sm" c="dimmed">
                Gerencie o motor de Inteligência Artificial utilizado em todas as análises e remediações do sistema.
              </Text>
            </div>
          </Group>
          <Tooltip label="Atualizar Dados">
            <ActionIcon variant="subtle" color="gray" onClick={fetchSettings} loading={loading}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Paper>

      {/* Error & Success Messages */}
      {errorMsg && (
        <Alert icon={<IconAlertTriangle size={18} />} color="red" title="Erro" mb="md" withCloseButton onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <Alert icon={<IconCheck size={18} />} color="teal" title="Sucesso" mb="md" withCloseButton onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {loading ? (
        <Paper p="xl" radius="md" withBorder ta="center">
          <Loader size="md" color="indigo" />
          <Text size="sm" c="dimmed" mt="sm">
            Carregando motores de Inteligência Artificial disponíveis...
          </Text>
        </Paper>
      ) : (
        <Stack gap="lg">
          {/* OpenCode Key Status */}
          <Paper p="md" radius="md" withBorder style={{ backgroundColor: 'rgba(34, 139, 230, 0.05)', borderColor: 'rgba(34, 139, 230, 0.3)' }}>
            <Group justify="space-between">
              <Group>
                <ThemeIcon size="lg" radius="md" color={hasApiKey ? 'teal' : 'yellow'} variant="light">
                  <IconShieldCheck size={22} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="sm">
                    Token OpenCode Go / Zen
                  </Text>
                  <Text size="xs" c="dimmed">
                    Autenticação global reutilizada para todos os modelos cadastrados no sistema.
                  </Text>
                </div>
              </Group>
              <Badge color={hasApiKey ? 'teal' : 'yellow'} variant="light" size="lg">
                {hasApiKey ? 'Token Configurado & Ativo' : 'Token Ausente (.env)'}
              </Badge>
            </Group>
          </Paper>

          {/* AI Model Selection Section */}
          <Paper p="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <div>
                <Group gap="xs">
                  <IconSparkles size={20} color="var(--mantine-color-indigo-4)" />
                  <Text fw={700} size="lg">
                    Seleção de Motor de IA (Global)
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  A alteração do modelo se aplicará instantaneamente a <b>todas as consultas</b> e para <b>todos os usuários</b> da plataforma.
                </Text>
              </div>
              <Badge color="indigo" variant="outline">
                3 Modelos Disponíveis
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              {availableModels.map((model) => {
                const isSelected = activeModel === model.id;
                return (
                  <Card
                    key={model.id}
                    shadow="sm"
                    padding="lg"
                    radius="md"
                    withBorder
                    onClick={() => setActiveModel(model.id)}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      borderColor: isSelected ? 'var(--mantine-color-indigo-5)' : undefined,
                      backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.08)' : undefined,
                      boxShadow: isSelected ? '0 0 12px rgba(79, 70, 229, 0.25)' : undefined,
                    }}
                  >
                    <Group justify="space-between" align="flex-start" mb="xs">
                      <ThemeIcon size="lg" radius="md" color={model.color || 'indigo'} variant={isSelected ? 'filled' : 'light'}>
                        <IconCpu size={22} />
                      </ThemeIcon>
                      <Radio
                        checked={isSelected}
                        onChange={() => setActiveModel(model.id)}
                        value={model.id}
                        color="indigo"
                        aria-label={model.name}
                      />
                    </Group>

                    <Text fw={700} size="md" mt="xs">
                      {model.name}
                    </Text>

                    <Group gap={6} my={6}>
                      <Badge color="gray" variant="subtle" size="xs">
                        {model.provider}
                      </Badge>
                      <Badge color={model.color || 'indigo'} variant="light" size="xs">
                        {model.badge}
                      </Badge>
                    </Group>

                    <Text size="xs" c="dimmed" mt="xs" style={{ minHeight: '48px', lineHeight: 1.4 }}>
                      {model.description}
                    </Text>

                    {isSelected && (
                      <Badge color="indigo" variant="filled" fullWidth mt="md" leftSection={<IconCheck size={12} />}>
                        Modelo Ativo Globalmente
                      </Badge>
                    )}
                  </Card>
                );
              })}
            </SimpleGrid>
          </Paper>

          {/* AI Token Pricing Section */}
          <Paper p="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md" wrap="wrap">
              <div>
                <Group gap="xs">
                  <IconCoins size={20} color="var(--mantine-color-teal-4)" />
                  <Text fw={700} size="lg">
                    Precificação Discriminada de Tokens (Entrada vs. Saída)
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  Defina os custos por mil (1.000) tokens para entrada (prompt) e saída (respostas). O sistema calcula os custos administrativos exatos com base nos volumes reais gerados por cada usuário e website.
                </Text>
              </div>
              <Group gap="xs">
                <Badge color="blue" variant="light" size="sm">
                  Entrada (Prompt)
                </Badge>
                <Badge color="violet" variant="light" size="sm">
                  Saída (Completion)
                </Badge>
              </Group>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <NumberInput
                    label="Tokens de Entrada (Prompt)"
                    description="Custo a cada 1k tokens de instruções/contexto."
                    placeholder="0.015"
                    min={0}
                    step={0.005}
                    decimalScale={4}
                    fixedDecimalScale
                    prefix="R$ "
                    thousandSeparator="."
                    decimalSeparator=","
                    value={promptTokenPrice}
                    onChange={(val) => {
                      setPromptTokenPrice(val);
                      const p = Number(val) || 0;
                      const c = Number(completionTokenPrice) || 0;
                      setTokenPrice(Number(((p + c) / 2).toFixed(4)));
                    }}
                  />

                  <NumberInput
                    label="Tokens de Saída (Respostas)"
                    description="Custo a cada 1k tokens gerados pela IA."
                    placeholder="0.060"
                    min={0}
                    step={0.005}
                    decimalScale={4}
                    fixedDecimalScale
                    prefix="R$ "
                    thousandSeparator="."
                    decimalSeparator=","
                    value={completionTokenPrice}
                    onChange={(val) => {
                      setCompletionTokenPrice(val);
                      const p = Number(promptTokenPrice) || 0;
                      const c = Number(val) || 0;
                      setTokenPrice(Number(((p + c) / 2).toFixed(4)));
                    }}
                  />
                </SimpleGrid>

                <Paper p="xs" radius="sm" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="xs" fw={600} c="gray.3">
                        Valor Médio de Referência (Clientes)
                      </Text>
                      <Text size="11px" c="dimmed">
                        Preço médio exibido de forma simplificada na interface do usuário.
                      </Text>
                    </div>
                    <Badge color="teal" size="md" variant="filled">
                      {Number(tokenPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / 1k
                    </Badge>
                  </Group>
                </Paper>

                <Text size="xs" c="dimmed">
                  <b>Nota técnica:</b> Provedores de LLM costumam cobrar um valor superior para tokens de saída devido ao alto custo computacional na geração de código e respostas. Nos relatórios administrativos, a discriminação é mantida 100% auditável.
                </Text>
              </Stack>

              <Paper p="md" radius="md" bg="dark.8" withBorder style={{ borderColor: '#374151' }}>
                <Group justify="space-between" mb="xs">
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    Simulação de Custo Real Ponderado
                  </Text>
                  <Badge size="xs" color="gray" variant="outline">
                    Padrão: ~75% Prompt / 25% Saída
                  </Badge>
                </Group>
                <SimpleGrid cols={2} spacing="xs">
                  {[250000, 500000, 1000000, 2000000].map((tier) => {
                    const pToks = tier * 0.75;
                    const cToks = tier * 0.25;
                    const pC = (pToks / 1000) * (Number(promptTokenPrice) || 0);
                    const cC = (cToks / 1000) * (Number(completionTokenPrice) || 0);
                    const totalCost = pC + cC;
                    const label = tier >= 1000000 ? `${tier / 1000000}M` : `${tier / 1000}k`;

                    return (
                      <Paper key={tier} p="xs" radius="sm" bg="dark.7">
                        <Text size="11px" c="dimmed" fw={600}>
                          {label} tokens ({tier.toLocaleString('pt-BR')}):
                        </Text>
                        <Text size="sm" fw={700} c="teal.4">
                          {totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </Text>
                        <Text size="10px" c="dimmed">
                          Entrada: {pC.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Saída: {cC.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </Text>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              </Paper>
            </SimpleGrid>
          </Paper>

          {/* Action Bar */}
          <Paper p="md" radius="md" withBorder>
            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={onBack}>
                Cancelar
              </Button>
              <Button
                color="indigo"
                size="md"
                leftSection={<IconDeviceFloppy size={18} />}
                onClick={handleSave}
                loading={saving}
              >
                Salvar Configurações
              </Button>
            </Group>
          </Paper>
        </Stack>
      )}
    </Container>
  );
};
