# 🛡️ Validar Segurança — WordPress Audit & AI Remediation Platform

Uma plataforma completa para **auditoria de segurança**, **triagem inteligente de falhas** e **remediação automatizada via Inteligência Artificial** para ecossistemas WordPress.

---

## 🌟 Principais Recursos

- **🛡️ Auditoria Automatizada de Segurança**:
  - Teste remoto de infraestrutura, cabeçalhos HTTP (HSTS, CSP, X-Frame-Options), listagem de diretórios (`/wp-content/uploads/`, `/wp-includes/`), enumeração de usuários e detecção de arquivos sensíveis.

- **🤖 Remediação Inteligente & Triagem Híbrida (IA - Kimi K2.7 Code)**:
  - **Triagem Automática**: Separação clara entre falhas corrigíveis via código/plugin e falhas que exigem intervenção de infraestrutura ou ações manuais.
  - **Gerador de Plugins de Correção**: Criação automatizada de plugins PHP customizados sob medida para sanar falhas diretamente no painel do WordPress.
  - **Guia do Servidor & Ações Manuais**: Instruções passo a passo geradas por IA para edições em `.htaccess`, `nginx.conf`, `php.ini`, `wp-config.php` e rotinas do painel SSH/cPanel.
  - **Cache & Persistência de Guias**: Salvamento automático dos conselhos da IA no banco de dados para carregamento instantâneo sem chamadas redundantes, com botão de atualização sob demanda.

- **📊 Catálogo de Soluções Integrado**:
  - Mapeamento detalhado de cada teste de segurança (`check_id`) associado a tipos de ação (`PLUGIN_AUTO_FIX`, `SERVER_CONFIG`, `MANUAL_ACTION`), gravidade e instruções de correção.

- **👥 Gestão de Usuários & Controle de Acesso (RBAC)**:
  - Níveis de permissão de Administrador e Usuário, com isolamento estrito de relatórios por proprietário e gerenciamento centralizado de usuários.

- **🎨 Interface Moderna em Dark Theme**:
  - Frontend responsivo desenvolvido em React + Mantine UI com tema escuro de alto contraste, tipografia legível e relatórios personalizáveis para impressão ou exportação em PDF.

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
