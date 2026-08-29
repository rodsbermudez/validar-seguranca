# 🛡️ Validar Segurança — WordPress Audit & AI Remediation Platform

Uma plataforma completa para **auditoria de segurança**, **triagem inteligente de falhas** e **remediação automatizada via Inteligência Artificial** para ecossistemas WordPress.

---

## 🌟 Principais Recursos

- **🛡️ Auditoria Automatizada de Segurança**:
  - Teste remoto de infraestrutura, cabeçalhos HTTP (HSTS, CSP, X-Frame-Options), listagem de diretórios (`/wp-content/uploads/`, `/wp-includes/`), enumeração de usuários (via `/?author=1`, REST API e sitemaps XML em `/wp-sitemap-users-1.xml` e `/author-sitemap.xml`) e detecção de arquivos sensíveis.
  - **Detecção Avançada em Sitemaps XML**: Identificação de vazamentos de usernames no sitemap nativo e em plugins de SEO (Yoast SEO, Rank Math, All in One SEO), seguindo redirecionamentos HTTP 301/302 automaticamente.

- **🤖 Remediação Inteligente & Geração em Lote via IA (Kimi K2.7 Code)**:
  - **Processamento em Lote em Tempo Real**: Modal interativo com barra de progresso em tempo real, contadores de estatísticas (Gerados, Reutilizados e Erros) e suporte a re-geração forçada para atualizar todas as falhas e alertas do relatório.
  - **Detecção Detalhada e Exibição de Erros**: Apresentação transparente da causa exata em caso de falha de requisição (erros HTTP 400, timeouts ou restrições do provedor de IA).
  - **Re-execução Seletiva de Falhas**: Botão dedicado `⚡ Re-executar Apenas Falhas` para reprocessar exclusivamente os itens com erro sem re-executar os itens gerados com sucesso.
  - **Mecanismo de Resiliência e Fallback cURL**: Suporte a retentativas automáticas cURL no `AIService` sem envio de parâmetros sensíveis (`temperature`), garantindo 100% de compatibilidade com o provedor OpenCode Zen.
  - **Triagem Automática**: Separação clara entre falhas corrigíveis via código/plugin e falhas que exigem intervenção de infraestrutura ou ações manuais.
  - **Gerador de Plugins de Correção**: Criação automatizada de plugins PHP customizados sob medida para sanar falhas diretamente no painel do WordPress (incluindo desativação de sitemaps de autores, redirecionamento 301 de requisições de autor para a Home, remoção de parâmetros `?ver=` e bloqueio de arquivos `readme.txt`/`license.txt`).
  - **Guia do Servidor & Ações Manuais**: Instruções passo a passo geradas por IA para edições em `.htaccess`, `nginx.conf`, `php.ini`, `wp-config.php` e rotinas do painel SSH/cPanel. Inclui timeout expandido para 120s, exibição de alerta de erro com causa detalhada na modal e alternância instantânea para Guia Padrão (Sem IA) caso ocorra indisponibilidade da API.
  - **Cache & Persistência de Guias**: Salvamento automático dos conselhos da IA no banco de dados para carregamento instantâneo sem chamadas redundantes.

- **🔌 Plugin Agente Patropi (WordPress Companion)**:
  - Integração nativa no painel do WordPress com menu dedicado, histórico de diagnósticos e **botão de reconexão/re-sincronização de ponte** para restabelecer a comunicação com a plataforma instantaneamente.

- **📊 Catálogo de Soluções Integrado (`SolutionCatalogSeeder`)**:
  - Mapeamento detalhado de cada teste de segurança (`check_id`) associado a tipos de ação (`PLUGIN_AUTO_FIX`, `SERVER_CONFIG`, `MANUAL_ACTION`), gravidade e instruções de correção (incluindo snippets PHP para desativar sitemaps de autores no Yoast/Rank Math/Nativo e bloquear requisições com HTTP 404).

- **📖 Central de Documentação Integrada (`/docs`)**:
  - Portal completo de documentação da plataforma desenvolvido em CodeIgniter, cobrindo funcionamento de auditoria, agente interno, remediação por IA, proteção contra enumeração em sitemaps XML e boas práticas, com busca em tempo real e navegação fluida por scroll offset.

- **🎨 Identidade Visual Patropi Comunica & Cores Customizadas**:
  - Integração da nova logo horizontal (`logo-Patropi.png`) e favicon (`favicon.png`).
  - Paleta de cores em Dark Theme: Primária (`#236baa`), Secundária (`#ec1c66`), Detalhes (`#79c1a8`), Fundo de Tela (`#333333`), Fundo de Cards (`#111111`).
  - Cards de métricas com números centralizados e bordas realçadas no relatório de segurança e no acordeão de categorias.

- **👥 Gestão de Usuários & Controle de Acesso (RBAC)**:
  - Níveis de permissão de Administrador e Usuário, com isolamento estrito de relatórios por proprietário e gerenciamento centralizado de usuários.

- **📊 Relatórios Personalizados**:
  - Frontend responsivo desenvolvido em React + Mantine UI v7 com tema escuro de alto contraste, tipografia legível e relatórios personalizáveis para impressão ou exportação em PDF.

---

## 🛠️ Tecnologias Utilizadas

- **Backend**: PHP 8.2+ | CodeIgniter 4 (API RESTful) | Composer
- **Frontend**: React 18 | TypeScript | Vite | Mantine UI v7 | Tabler Icons
- **Inteligência Artificial**: OpenCode Zen API (`kimi-k2.7-code`)
- **Banco de Dados**: MySQL 8.0+ / MariaDB
- **Autenticação**: JWT (JSON Web Tokens)

---

## 🚀 Instalação e Configuração

### 1. Requisitos do Sistema
- PHP 8.2 ou superior (com extensões `curl`, `json`, `mbstring`, `mysqlnd`, `intl`)
- Node.js 18+ e npm
- Servidor Web (Apache/XAMPP/LAMPP ou Nginx)
- MySQL / MariaDB

### 2. Configuração do Backend (CodeIgniter 4)
1. Clone o repositório no diretório do seu servidor web:
   ```bash
   cd /opt/lampp/htdocs/validar-seguranca
   ```
2. Instale as dependências via Composer:
   ```bash
   composer install
   ```
3. Configure o arquivo `.env`:
   ```ini
   database.default.hostname = localhost
   database.default.database = validar-seguranca
   database.default.username = root
   database.default.password = 
   database.default.DBDriver = MySQLi

   # Chave de Integração OpenCode Zen API (IA)
   OPENCODE_API_KEY=sua_chave_aqui
   ```
4. Execute as migrações do banco de dados:
   ```bash
   php spark migrate
   ```

### 3. Configuração e Build do Frontend (React)
1. Acesse a pasta do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências do Node:
   ```bash
   npm install
   ```
3. Compile o projeto para produção:
   ```bash
   npm run build
   ```

---

## 📄 Licença e Uso

Desenvolvido para auditoria e fortificação de ambientes WordPress de forma automatizada e segura.
