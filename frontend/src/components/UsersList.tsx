import { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  Title,
  Text,
  Button,
  Group,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  PasswordInput,
  Switch,
  Stack,
  Tooltip,
  Select,
} from '@mantine/core';
import {
  IconUserPlus,
  IconTrash,
  IconEye,
  IconPencil,
  IconPower,
  IconBrain,
  IconPackage,
  IconWorld,
} from '@tabler/icons-react';
import { api, getPlans, Plan } from '../api';
import { formatDateOnly } from '../utils/date';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  is_active: number;
  plan_id?: number | null;
  plan_name?: string;
  effective_max_websites?: number | null;
  is_websites_unlimited?: boolean;
  websites_count?: number;
  total_monthly_price?: number;
  ai_enabled?: number;
  ai_monthly_token_limit?: number | null;
  current_month_tokens?: number;
  current_month_cost?: number;
  created_at: string;
}

interface UsersListProps {
  onImpersonate: (user: User) => void;
  onManageAi: (user: User) => void;
  currentUserId: number;
}

export function UsersList({ onImpersonate, onManageAi, currentUserId }: UsersListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [openedModal, setOpenedModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenCreateModal = async () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setIsAdmin(false);
    setIsActive(true);
    setErrorMsg('');
    try {
      const pRes = await getPlans();
      const pList = pRes.data || [];
      setAvailablePlans(pList);
      const def = pList.find((p) => Number(p.is_default) === 1);
      setSelectedPlanId(def ? String(def.id) : (pList[0] ? String(pList[0].id) : ''));
    } catch {
      // ignore
    }
    setOpenedModal(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setIsAdmin(user.role === 'admin');
    setIsActive(Number(user.is_active) === 1);
    setErrorMsg('');
    setOpenedModal(true);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name || !email) {
      setErrorMsg('Nome e E-mail são obrigatórios.');
      return;
    }

    if (!editingUser && !password) {
      setErrorMsg('Senha é obrigatória para cadastro de novo usuário.');
      return;
    }

    try {
      setSubmitting(true);

      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, {
          name,
          email,
          password: password || undefined,
          is_admin: isAdmin,
          is_active: isActive ? 1 : 0,
        });
      } else {
        await api.post('/users', {
          name,
          email,
          password,
          is_admin: isAdmin,
          plan_id: !isAdmin && selectedPlanId ? Number(selectedPlanId) : undefined,
        });
      }

      setOpenedModal(false);
      setEditingUser(null);
      setName('');
      setEmail('');
      setPassword('');
      setIsAdmin(false);
      setIsActive(true);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.messages?.error || err.response?.data?.error || 'Erro ao salvar usuário.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (user.id === currentUserId) {
      alert('Você não pode desativar sua própria conta.');
      return;
    }

    const actionText = Number(user.is_active) === 1 ? 'desativar' : 'ativar';
    if (!window.confirm(`Tem certeza que deseja ${actionText} a conta do usuário ${user.name}?`)) return;

    try {
      await api.post(`/users/${user.id}/toggle-status`);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.messages?.error || err.response?.data?.error || 'Erro ao alterar status.');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir permanentemente este usuário?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.messages?.error || err.response?.data?.error || 'Erro ao excluir usuário.');
    }
  };

  return (
    <Paper p="xl" radius="md" bg="dark.8">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={3} fw={700}>
            Gerenciamento de Usuários
          </Title>
          <Text c="dimmed" size="sm">
            Cadastre novos usuários, edite acessos/senhas, desative contas ou visualize o sistema como outro usuário.
          </Text>
        </div>
        <Button
          leftSection={<IconUserPlus size={18} />}
          color="indigo"
          onClick={handleOpenCreateModal}
        >
          Novo Usuário
        </Button>
      </Group>

      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ID</Table.Th>
            <Table.Th>Nome</Table.Th>
            <Table.Th>E-mail</Table.Th>
            <Table.Th>Perfil</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Plano & Recursos</Table.Th>
            <Table.Th>Data de Cadastro</Table.Th>
            <Table.Th style={{ textAlign: 'right' }}>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading ? (
            <Table.Tr>
              <Table.Td colSpan={8} align="center">
                Carregando usuários...
              </Table.Td>
            </Table.Tr>
          ) : users.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={8} align="center">
                Nenhum usuário cadastrado.
              </Table.Td>
            </Table.Tr>
          ) : (
            users.map((user) => {
              const isUserActive = Number(user.is_active) === 1;
              const isAiDisabled = Number(user.ai_enabled ?? 1) === 0;

              return (
                <Table.Tr key={user.id} style={{ opacity: !isUserActive ? 0.6 : 1 }}>
                  <Table.Td>{user.id}</Table.Td>
                  <Table.Td style={{ fontWeight: 600 }}>{user.name}</Table.Td>
                  <Table.Td>{user.email}</Table.Td>
                  <Table.Td>
                    <Badge color={user.role === 'admin' ? 'indigo' : 'gray'} variant="light">
                      {user.role === 'admin' ? 'ADMINISTRADOR' : 'USUÁRIO'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={isUserActive ? 'teal' : 'red'} variant="dot">
                      {isUserActive ? 'ATIVO' : 'INATIVO'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={3}>
                      <Group gap={6}>
                        <Badge
                          color={
                            user.role === 'admin'
                              ? 'indigo'
                              : user.plan_name === 'Full'
                              ? 'violet'
                              : user.plan_name === 'Profissional'
                              ? 'blue'
                              : 'teal'
                          }
                          variant="filled"
                          size="xs"
                        >
                          {user.role === 'admin' ? 'ADMIN' : user.plan_name || 'Iniciante'}
                        </Badge>
                        {user.total_monthly_price !== undefined && user.total_monthly_price > 0 && (
                          <Badge color="gray" variant="light" size="xs">
                            {user.total_monthly_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                          </Badge>
                        )}
                      </Group>

                      <Group gap={8} mt={1}>
                        <Group gap={3}>
                          <IconWorld size={12} color="#60a5fa" />
                          <Text size="11px" fw={600}>
                            {user.websites_count ?? 0}
                          </Text>
                          <Text size="11px" c="dimmed">
                            / {user.is_websites_unlimited ? 'Ilim.' : `${user.effective_max_websites ?? '4'} sites`}
                          </Text>
                        </Group>

                        <Text size="11px" c="dimmed">
                          •
                        </Text>

                        {isAiDisabled ? (
                          <Text size="11px" c="dimmed">
                            IA Desativada
                          </Text>
                        ) : (
                          <Group gap={3}>
                            <IconBrain size={12} color="#a78bfa" />
                            <Text size="11px" fw={600}>
                              {user.current_month_tokens ? Number(user.current_month_tokens).toLocaleString('pt-BR') : '0'}
                            </Text>
                            <Text size="11px" c="dimmed">
                              / {user.ai_monthly_token_limit ? Number(user.ai_monthly_token_limit).toLocaleString('pt-BR') : '250k'}
                            </Text>
                          </Group>
                        )}
                      </Group>
                    </Stack>
                  </Table.Td>
                  <Table.Td>{formatDateOnly(user.created_at)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Group gap="xs" justify="flex-end">
                      <Tooltip label={`Gerenciar plano, limites de sites, cotas de IA e add-ons de ${user.name}`}>
                        <Button
                          size="xs"
                          variant="light"
                          color="indigo"
                          leftSection={<IconPackage size={14} />}
                          onClick={() => onManageAi(user)}
                        >
                          Gestão do Plano
                        </Button>
                      </Tooltip>

                      <Tooltip label={`Ver painel como ${user.name}`}>
                        <Button
                          size="xs"
                          variant="light"
                          color="cyan"
                          leftSection={<IconEye size={14} />}
                          onClick={() => onImpersonate(user)}
                          disabled={!isUserActive}
                        >
                          Ver como
                        </Button>
                      </Tooltip>

                      <Tooltip label="Editar Usuário & Senha">
                        <ActionIcon variant="subtle" color="blue" onClick={() => handleOpenEditModal(user)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>

                      {user.id !== currentUserId && (
                        <Tooltip label={isUserActive ? 'Desativar Usuário' : 'Ativar Usuário'}>
                          <ActionIcon
                            variant="subtle"
                            color={isUserActive ? 'orange' : 'green'}
                            onClick={() => handleToggleStatus(user)}
                          >
                            <IconPower size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}

                    {user.id !== currentUserId && (
                      <Tooltip label="Excluir Permanentemente">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })
        )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={openedModal}
        onClose={() => setOpenedModal(false)}
        title={editingUser ? `Editar Usuário: ${editingUser.name}` : 'Cadastrar Novo Usuário'}
        centered
      >
        <form onSubmit={handleSubmitUser}>
          <Stack gap="md">
            {errorMsg && (
              <Text color="red" size="sm" fw={600}>
                {errorMsg}
              </Text>
            )}
            <TextInput
              label="Nome Completo"
              placeholder="Ex: João da Silva"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextInput
              label="E-mail de Acesso"
              placeholder="joao@cliente.com"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <PasswordInput
              label="Senha de Acesso"
              placeholder={editingUser ? 'Deixe em branco para não alterar' : 'Senha secreta'}
              required={!editingUser}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              description={editingUser ? 'Preencha apenas se desejar redefinir a senha do usuário.' : undefined}
            />
            <Switch
              label="Definir como Administrador"
              description="Administradores têm acesso irrestrito e não consomem cotas de planos."
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.currentTarget.checked)}
              color="indigo"
              mt="xs"
            />
            {!editingUser && !isAdmin && availablePlans.length > 0 && (
              <Select
                label="Plano Inicial Contratado"
                description="Define a cota base de sites e tokens de IA."
                data={availablePlans.map((p) => ({
                  value: String(p.id),
                  label: `${p.name} (${p.max_websites ? `${p.max_websites} sites` : 'Sites Ilim.'} • ${(Number(p.ai_monthly_tokens) / 1000).toLocaleString('pt-BR')}k IA • ${Number(p.price_monthly).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês)`,
                }))}
                value={selectedPlanId}
                onChange={(val) => setSelectedPlanId(val || '')}
              />
            )}
            {editingUser && editingUser.id !== currentUserId && (
              <Switch
                label="Conta Ativa"
                description="Usuários inativos são bloqueados ao tentar fazer login."
                checked={isActive}
                onChange={(e) => setIsActive(e.currentTarget.checked)}
                color="teal"
              />
            )}
            <Group justify="flex-end" mt="lg">
              <Button variant="default" onClick={() => setOpenedModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" color="indigo" loading={submitting}>
                {editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Paper>
  );
}
