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
} from '@mantine/core';
import { IconUserPlus, IconTrash, IconEye, IconPencil, IconPower } from '@tabler/icons-react';
import { api } from '../api';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  is_active: number;
  created_at: string;
}

interface UsersListProps {
  onImpersonate: (user: User) => void;
  currentUserId: number;
}

export function UsersList({ onImpersonate, currentUserId }: UsersListProps) {
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

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setIsAdmin(false);
    setIsActive(true);
    setErrorMsg('');
    setOpenedModal(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setIsAdmin(user.role === 'admin');
    setIsActive(user.is_active === 1);
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

    const actionText = user.is_active === 1 ? 'desativar' : 'ativar';
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
            <Table.Th>Data de Cadastro</Table.Th>
            <Table.Th style={{ textAlign: 'right' }}>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading ? (
            <Table.Tr>
              <Table.Td colSpan={7} align="center">
                Carregando usuários...
              </Table.Td>
            </Table.Tr>
          ) : users.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7} align="center">
                Nenhum usuário cadastrado.
              </Table.Td>
            </Table.Tr>
          ) : (
            users.map((user) => (
              <Table.Tr key={user.id} style={{ opacity: user.is_active === 0 ? 0.6 : 1 }}>
                <Table.Td>{user.id}</Table.Td>
                <Table.Td style={{ fontWeight: 600 }}>{user.name}</Table.Td>
                <Table.Td>{user.email}</Table.Td>
                <Table.Td>
                  <Badge color={user.role === 'admin' ? 'indigo' : 'gray'} variant="light">
                    {user.role === 'admin' ? 'ADMINISTRADOR' : 'USUÁRIO'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={user.is_active === 1 ? 'teal' : 'red'} variant="dot">
                    {user.is_active === 1 ? 'ATIVO' : 'INATIVO'}
                  </Badge>
                </Table.Td>
                <Table.Td>{new Date(user.created_at).toLocaleDateString('pt-BR')}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Group gap="xs" justify="flex-end">
                    <Tooltip label={`Ver painel como ${user.name}`}>
                      <Button
                        size="xs"
                        variant="light"
                        color="cyan"
                        leftSection={<IconEye size={14} />}
                        onClick={() => onImpersonate(user)}
                        disabled={user.is_active === 0}
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
                      <Tooltip label={user.is_active === 1 ? 'Desativar Usuário' : 'Ativar Usuário'}>
                        <ActionIcon
                          variant="subtle"
                          color={user.is_active === 1 ? 'orange' : 'green'}
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
            ))
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
              description="Administradores podem gerenciar usuários e visualizar o painel de qualquer conta."
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.currentTarget.checked)}
              color="indigo"
              mt="xs"
            />
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
