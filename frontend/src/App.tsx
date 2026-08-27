import { useState, useEffect } from 'react';
import {
  AppShell,
  Group,
  Title,
  Text,
  Button,
  Container,
  Avatar,
  ThemeIcon,
  Menu,
  Alert,
  Badge,
} from '@mantine/core';
import {
  IconShieldCheck,
  IconLogout,
  IconWorld,
  IconUser,
  IconUsers,
  IconEye,
  IconArrowLeft,
  IconBook,
} from '@tabler/icons-react';
import { LoginView } from './components/LoginView';
import { WebsitesList } from './components/WebsitesList';
import { ScanReport } from './components/ScanReport';
import { UsersList } from './components/UsersList';
import { SolutionCatalogView } from './components/SolutionCatalogView';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<any | null>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'report' | 'users' | 'solutions'>('list');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('jwt_token');
    const storedImpersonated = localStorage.getItem('impersonated_user');

    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.clear();
      }
    }

    if (storedImpersonated) {
      try {
        setImpersonatedUser(JSON.parse(storedImpersonated));
      } catch (e) {
        localStorage.removeItem('impersonated_user');
        localStorage.removeItem('impersonated_user_id');
      }
    }

    const handleUnauthorized = () => {
      setUser(null);
      setImpersonatedUser(null);
      setSelectedWebsite(null);
      localStorage.removeItem('impersonated_user');
      localStorage.removeItem('impersonated_user_id');
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    localStorage.removeItem('impersonated_user');
    localStorage.removeItem('impersonated_user_id');
    setUser(null);
    setImpersonatedUser(null);
    setSelectedWebsite(null);
  };

  const handleImpersonate = (targetUser: any) => {
    setImpersonatedUser(targetUser);
    localStorage.setItem('impersonated_user', JSON.stringify(targetUser));
    localStorage.setItem('impersonated_user_id', targetUser.id.toString());
    setSelectedWebsite(null);
    setViewMode('list');
  };

  const handleStopImpersonating = () => {
    setImpersonatedUser(null);
    localStorage.removeItem('impersonated_user');
    localStorage.removeItem('impersonated_user_id');
    setSelectedWebsite(null);
    setViewMode('users');
  };

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = user.role === 'admin';

  return (
    <AppShell header={{ height: impersonatedUser ? 115 : 60 }} padding="md">
      <AppShell.Header bg="dark.8">
        {/* Impersonation Warning Banner */}
        {impersonatedUser && (
          <Alert color="orange" variant="filled" radius={0} p="xs">
            <Container size="xl">
              <Group justify="space-between">
                <Group gap="xs">
                  <IconEye size={18} />
                  <Text size="sm" fw={600}>
                    Modo Personificação Ativo: Você está visualizando a plataforma como{' '}
                    <u>{impersonatedUser.name}</u> ({impersonatedUser.email})
                  </Text>
                </Group>
                <Button
                  size="xs"
                  variant="white"
                  color="dark"
                  leftSection={<IconArrowLeft size={14} />}
                  onClick={handleStopImpersonating}
                >
                  Voltar para o Perfil de Admin
                </Button>
              </Group>
            </Container>
          </Alert>
        )}

        <Container size="xl" h={60}>
          <Group justify="space-between" h="100%">
            <Group gap="sm" style={{ cursor: 'pointer' }} onClick={() => setViewMode('list')}>
              <ThemeIcon size={34} radius="md" color="indigo" variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }}>
                <IconShieldCheck size={22} />
              </ThemeIcon>
              <div>
                <Title order={4} fw={800} style={{ letterSpacing: -0.5 }}>
                  Validar Segurança
                </Title>
                <Text size="xs" c="dimmed" lh={1}>
                  WordPress Audit Platform
                </Text>
              </div>
            </Group>

            <Group gap="md">
              <Button
                variant={viewMode === 'list' || viewMode === 'report' ? 'light' : 'subtle'}
                color="indigo"
                leftSection={<IconWorld size={16} />}
                onClick={() => setViewMode('list')}
              >
                Websites Alvo
              </Button>

              {isAdmin && !impersonatedUser && (
                <>
                  <Button
                    variant={viewMode === 'solutions' ? 'light' : 'subtle'}
                    color="violet"
                    leftSection={<IconBook size={16} />}
                    onClick={() => setViewMode('solutions')}
                  >
                    Catálogo de Soluções
                  </Button>

                  <Button
                    variant={viewMode === 'users' ? 'light' : 'subtle'}
                    color="cyan"
                    leftSection={<IconUsers size={16} />}
                    onClick={() => setViewMode('users')}
                  >
                    Gerenciar Usuários
                  </Button>
                </>
              )}

              <Menu shadow="md" width={220} position="bottom-end">
                <Menu.Target>
                  <Group gap="xs" style={{ cursor: 'pointer' }}>
                    <Avatar color="indigo" radius="xl" size="sm">
                      {user.name ? user.name.charAt(0).toUpperCase() : <IconUser size={16} />}
                    </Avatar>
                    <div>
                      <Group gap={4}>
                        <Text size="sm" fw={600}>
                          {impersonatedUser ? impersonatedUser.name : user.name}
                        </Text>
                        <Badge size="xs" color={isAdmin ? 'indigo' : 'gray'}>
                          {impersonatedUser ? 'VISUALIZANDO' : isAdmin ? 'ADMIN' : 'USUÁRIO'}
                        </Badge>
                      </Group>
                    </div>
                  </Group>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>
                    {impersonatedUser ? impersonatedUser.email : user.email}
                  </Menu.Label>
                  <Menu.Divider />
                  {impersonatedUser && (
                    <Menu.Item leftSection={<IconArrowLeft size={14} />} onClick={handleStopImpersonating}>
                      Voltar para Admin
                    </Menu.Item>
                  )}
                  <Menu.Item color="red" leftSection={<IconLogout size={14} />} onClick={handleLogout}>
                    Sair da Conta
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main bg="dark.9" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <Container size="xl" py="lg">
          {viewMode === 'solutions' && isAdmin && !impersonatedUser ? (
            <SolutionCatalogView />
          ) : viewMode === 'users' && isAdmin && !impersonatedUser ? (
            <UsersList onImpersonate={handleImpersonate} currentUserId={user.id} />
          ) : viewMode === 'report' && selectedWebsite ? (
            <ScanReport website={selectedWebsite} onBack={() => setViewMode('list')} />
          ) : (
            <WebsitesList
              onSelectWebsite={(site) => {
                setSelectedWebsite(site);
                setViewMode('report');
              }}
              onTriggerScan={(site) => {
                setSelectedWebsite(site);
                setViewMode('report');
              }}
            />
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
