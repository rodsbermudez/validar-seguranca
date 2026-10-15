# 🛡️ Validar Segurança — WordPress Audit & AI Remediation Platform

Uma plataforma completa para **auditoria de segurança**, **triagem inteligente de falhas** e **remediação automatizada via Inteligência Artificial** para ecossistemas WordPress.

---

## 🌟 Principais Recursos

- **🛡️ Auditoria Automatizada de Segurança**:
  - Teste remoto de infraestrutura, cabeçalhos HTTP (HSTS, CSP, X-Frame-Options), listagem de diretórios (`/wp-content/uploads/`, `/wp-includes/`), enumeração de usuários (via `/?author=1`, REST API e sitemaps XML em `/wp-sitemap-users-1.xml` e `/author-sitemap.xml`) e detecção de arquivos sensíveis.
  - **Detecção Avançada em Sitemaps XML**: Identificação de vazamentos de usernames no sitemap nativo e em plugins de SEO (Yoast SEO, Rank Math, All in One SEO), seguindo redirecionamentos HTTP 301/302 automaticamente.

- **🤖 Remediação Inteligente & Gestão Granular de Fixes (`wp-patropi-fixes`)**:
  - **Plugin de Correção 100% Autônomo e Desacoplado**: Plugin PHP sob medida (`wp-patropi-fixes`) gerado diretamente para o site com token e ID embutidos (`VS_FIXES_SITE_TOKEN` e `VS_FIXES_SITE_ID`). O plugin não depende do agente de diagnósticos para funcionar e possui sua própria infraestrutura de rotas REST API (`/wp-json/wp-patropi-fixes/v1/status` e `/wp-json/wp-patropi-fixes/v1/toggle`).
  - **Gestão Granular de Proteções (Toggles em Tempo Real)**: Ativação e desativação individual de cada proteção de segurança implementada (ex: bloqueio de enumeração de autores, ocultação de versão, cabeçalhos de segurança, bloqueio de arquivos sensíveis). A gestão pode ser feita tanto diretamente no painel do WordPress (menu `WP Patropi Fixes`) quanto remotamente no SaaS (seção *Proteções Ativas* na aba Auditoria e Segurança).
  - **Sincronização Bidirecional & Persistência**: Todas as preferências de ativação são gravadas no banco de dados do WordPress (`wp_options` -> `vs_fixes_active_options`) e refletem instantaneamente no SaaS e vice-versa.
  - **Resiliência a WAF, ModSecurity e Proxies Reversos**: Suporte a autenticação tolerante a falhas com extração multi-origem e fallback por query param (`?vs_token=` e `?agent_token=`), superando o descarte (stripping) de cabeçalhos `Authorization` ou `X-Validar-Seguranca-Token` comum em provedores de hospedagem com ModSecurity, Apache FastCGI ou Cloudflare.
  - **Bypass de Filtros REST Externos**: Integração com prioridade máxima (`priority 99`) no hook `rest_authentication_errors` do WordPress, impedindo que plugins de segurança de terceiros (como Wordfence ou iThemes) bloqueiem as requisições legítimas do SaaS.
  - **Self-Healing de Credenciais**: Auto-sincronização do token de autenticação em `wp_options` caso não exista ou esteja divergente, garantindo compatibilidade retroativa e reparo transparente.
  - **Geração Determinística Nativa & IA**: Modo nativo canônico de geração (< 1s, código limpo e sem alucinações) e modo estendido com IA Kimi K2.7 Code.
  - **Processamento em Lote em Tempo Real**: Modal interativo com barra de progresso em tempo real, contadores de estatísticas (Gerados, Reutilizados e Erros) e suporte a re-geração forçada para atualizar todas as falhas e alertas do relatório.
  - **Detecção Detalhada e Exibição de Erros**: Apresentação transparente da causa exata em caso de falha de requisição (erros HTTP 400, timeouts ou restrições do provedor de IA).
  - **Re-execução Seletiva de Falhas**: Botão dedicado `⚡ Re-executar Apenas Falhas` para reprocessar exclusivamente os itens com erro sem re-executar os itens gerados com sucesso.
  - **Triagem Automática**: Separação clara entre falhas corrigíveis via código/plugin e falhas que exigem intervenção de infraestrutura ou ações manuais.
  - **Guia do Servidor & Ações Manuais**: Instruções passo a passo geradas por IA para edições em `.htaccess`, `nginx.conf`, `php.ini`, `wp-config.php` e rotinas do painel SSH/cPanel. Inclui timeout expandido para 120s, exibição de alerta de erro com causa detalhada na modal e alternância instantânea para Guia Padrão (Sem IA) caso ocorra indisponibilidade da API.
  - **Cache & Persistência de Guias**: Salvamento automático dos conselhos da IA no banco de dados para carregamento instantâneo sem chamadas redundantes.

- **📝 Logs de Atividades & Diário Técnico Unificado**:
  - **Timeline Consolidada**: Linha do tempo cronológica que unifica as notas das manutenções mensais e anotações técnicas avulsas realizadas no dia a dia.
  - **Categorização Visual**: Classificação em badges de status por categorias (`Geral`, `Segurança`, `Otimização`, `Servidor`, `Correção de Bug`, `Ajustes de Layout`).
  - **Formatação Técnica Rica**: Reconhecimento automático de URLs clicáveis e blocos de código (`code snippets`) com botão de cópia rápida em 1 clique.
  - **Acesso Colaborativo**: Suporte a equipes com permissão de criação e consulta de notas para todos os membros com acesso ao site.

- **🔗 Link Público de Visualização para Clientes**:
  - **Visão Dedicada para o Cliente**: Página pública externa (`/public/logs/:token`) com cabeçalho limpo contendo unicamente a logomarca da Patropi Comunica.
  - **Modo Estrito de Consulta**: Permite ao cliente final auditar o histórico de manutenções e intervenções técnicas, com pesquisa e filtros, sem capacidade de edição, exclusão ou criação de dados.
  - **Gestão de Tokens Criptográficos**: Geração de tokens de 64 caracteres com botão no painel para copiar a URL ou regenerar o token a qualquer momento.

- **🔍 Verificador Forense de Integridade do Core & Auto-Fix**:
  - **Compatibilidade Internacional e pt_BR**: Varredura inteligente de checksums compatível com pacotes traduzidos do WordPress (`pt_BR`) e internacional (`en_US`), com normalização de quebras de linha CRLF/LF.
  - **Auditoria Heurística de Tokens**: Inspeção profunda de tokens PHP no arquivo `wp-includes/version.php`, prevenindo falsos positivos de adulteração enquanto bloqueia rigorosamente injeções maliciosas (`eval`, `base64_decode`, backdoors).
  - **Restauração em 1 Clique com Preservação de Idioma**: Auto-fix confiável que baixa arquivos oficiais do GitHub/SVN e reconstrói o arquivo autêntico com fidelidade criptográfica total.
  - **Persistência de Resultados no Banco**: Armazenamento automático da última varredura no banco de dados para evitar relatórios pendentes ao relogar na plataforma.

- **🧭 Nova Interface & Navegação Otimizada**:
  - **Menu Global com Dropdown Configurações**: Top bar reorganizada com acessos de primeiro nível a `Websites`, `Configurações` (dropdown reunindo Gerais, Usuários e Catálogo de Soluções), `Documentação` e perfil do usuário.
  - **Dashboard com Radar de Segurança e Integridade**: Monitoramento com destaque em amarelo para sites que não são auditados ou verificados há mais de 30 dias e listagem dos 6 piores sites em cada aspecto para correção prioritária.
  - **Menu Ferramentas nos Sites**: Barra do site compacta com selo de status de conexão do agente e menu dropdown unificado reunindo todas as abas, relatórios e downloads.
  - **Modal de Manutenções com Mês de Referência**: Permite selecionar o mês atual ou meses anteriores no modal de conclusão de manutenção para registros retroativos.

- **🔌 Plugin Agente Patropi (WordPress Companion)**:
  - Integração nativa no painel do WordPress com menu dedicado, histórico de diagnósticos, logs em tempo real e **botão de reconexão/re-sincronização de ponte** para restabelecer a comunicação com a plataforma instantaneamente.

- **📊 Catálogo de Soluções Integrado (`SolutionCatalogSeeder`)**:
  - Mapeamento detalhado de cada teste de segurança (`check_id`) associado a tipos de ação (`PLUGIN_AUTO_FIX`, `SERVER_CONFIG`, `MANUAL_ACTION`), gravidade e instruções de correção (incluindo snippets PHP para desativar sitemaps de autores no Yoast/Rank Math/Nativo e bloquear requisições com HTTP 404).

- **📖 Central de Documentação Integrada (`/docs`)**:
  - Portal completo de documentação da plataforma desenvolvido em CodeIgniter, cobrindo funcionamento de auditoria, agente interno, integridade do core, logs de atividades, links públicos para clientes, remediação por IA e boas práticas, com busca em tempo real e navegação fluida por scroll offset.

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
