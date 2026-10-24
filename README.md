# 🛡️ Vexors — WordPress Audit, Diagnostics & AI Remediation Platform

Uma plataforma moderna e robusta para **auditoria de segurança**, **diagnósticos forenses de integridade**, **remediação automatizada com IA** e **gestão de manutenção contínua** para ecossistemas WordPress.

---

## 🌟 Arquitetura da Plataforma

A plataforma opera com um modelo híbrido e desacoplado:
1. **Auditoria Externa Não-Invasiva:** Avaliação perimetral de cabeçalhos HTTP, diretórios sensíveis expostos, enumeração de usuários (REST API, sitemaps e query strings) e fingerprinting.
2. **Plugin Agente WordPress (`vexors-diagnostico`):** Telemetria interna do banco de dados, checksums oficiais do core WordPress.org, monitoramento de logs em tempo real e orquestração de atualizações remotas de temas e plugins.
3. **Plugin de Blindagem Ativa (`vexors-fixes`):** Plugin independente com controle liga/desliga de proteções individuais em tempo real, tokens embutidos e bypass automático de WAF/ModSecurity.
4. **Governança SaaS & Gateway Financeiro:** Gestão recorrente com faturamento Asaas, cotas de tokens de IA, add-ons pró-rata, carência automatizada de 90 dias e expurgo em lote.

---

## 👤 1. Funcionalidades Gerais (Usuários & Clientes)

Recursos e ferramentas acessíveis para todos os usuários cadastrados gerenciarem seus sites WordPress:

### 🛡️ Auditoria Automatizada & Varreduras Perimetrais
- Testes de infraestrutura e cabeçalhos de segurança (HSTS, CSP, X-Frame-Options, X-Content-Type-Options).
- Detecção de listagem de diretórios (`/wp-content/uploads/`, `/wp-includes/`) e arquivos críticos expostos (`wp-config.php.bak`, `wp-config.txt`, `.env`, `debug.log`, `error_log`).
- Bloqueio de enumeração de autores e logins via query strings (`/?author=N`), REST API (`/wp-json/wp/v2/users`) e sitemaps XML de SEO (Yoast, Rank Math, All in One SEO e nativo).
- Bloqueio de interfaces remotas legadas (`xmlrpc.php`) e ocultação de assinaturas de versão em tags meta HTML.

### 🔌 Plugin Agente WordPress (`vexors.app - Diagnóstico`)
- Instalação via arquivo ZIP personalizado para o site com handshake seguro de token.
- Diagnóstico interno completo: verificação de administradores padrão ("admin"), quantidade de administradores, modo de depuração (`WP_DEBUG`), integridade de permissões de escrita, prefixo de tabelas MySQL e atualizações pendentes.
- **Alerta Proativo de Agente Desatualizado:** Notificação em destaque no topo das telas do site quando o plugin agente estiver defasado em relação à versão mais recente da plataforma (ex: `v1.0.6 → v1.0.7`), com botão de download em 1 clique do ZIP atualizado.
- **Desconexão Segura do Plugin (Kill Switch):** Ação centralizada no menu *Ferramentas > "Desconectar plugin"*, com modal de confirmação que interrompe de imediato a ponte e o tráfego do SaaS para o WordPress (`is_connected = 0`), evitando cliques acidentais na barra superior.
- Botão de auto-reconexão e ressincronização de ponte no painel e no wp-admin para restabelecer a comunicação instantaneamente.

### 🖥️ Recursos do Servidor & Saúde da Infraestrutura (Telemetria Passiva)
- **Segunda Linha de 4 Cards de Infraestrutura:** Exibição clara no painel Visão Geral de cada site:
  1. **Armazenamento em Disco (HD):** Espaço livre, total e ocupado com barra de capacidade e alertas graduais (&lt; 75% verde, 75-89% atenção, &ge; 90% crítico).
  2. **Ambiente PHP & Banco de Dados (MySQL / MariaDB):** Versões ativas, limites vitais (`memory_limit`, `max_execution_time`, `upload_max_filesize`) e alertas sobre versões obsoletas do PHP (&lt; 8.1) ou MySQL (&lt; 8.0).
  3. **Consumo de Memória RAM:** Percentual e volume de memória física do servidor utilizada (`/proc/meminfo` ou limites de script PHP) com alertas de saturação.
  4. **Uso de Processamento de CPU:** Carga média recente (`sys_getloadavg` ponderado pela contagem de núcleos) e detecção de sobrecarga.
- **Engenharia Anti-Sobrecarga do Servidor:** Solicitações espaçadas e assíncronas com cache local inteligente, sem execução em tempo real a cada refresh e sem botões de ação na linha de recursos para blindar a estabilidade do servidor PHP-FPM.

### 📄 Relatório Diagnóstico & Atividades Executivo (PDF Contínuo)
- Consolidação formal da saúde da aplicação acessível via *Ferramentas > Relatório Diagnóstico*, estruturado em **5 Seções Completas**:
  1. **Avaliação de Segurança & Conformidade:** Gauge circular vetorial SVG com Score (0-100) e Grade (A+, A, B...), e **Checklist Completo de Testes** exibindo o status explícito de cada item checado: **Resolvido** (badge verde) ou **Pendente** (badge vermelho/amarelo com detalhamento de severidade e ação sugerida) para prestação de contas transparente ao cliente.
  2. **Infraestrutura & Recursos do Servidor:** Os 4 pilares de hardware e ambiente (HD, PHP/MySQL, RAM e CPU).
  3. **Estabilidade & Logs de Erros (Últimas 48h):** Histórico de exceções e contagem de erros fatais recentes.
  4. **Integridade Criptográfica do Core WordPress:** Certificação contra os checksums oficiais do WordPress.org.
  5. **Gestão de Atualizações & Inventário Completo de Componentes:** Status do WordPress Core, Agente Vexors Guard, tabela de Inventário Completo de Plugins (com versões, estado ativo/inativo e selo de proteção) e tabela de Inventário Completo de Temas.
- **Exportação em PDF Contínuo em Alta Definição:**
  - Layout contínuo de página única proporcional (`jsPDF`), eliminando quebras de página automáticas que cortavam cards, tabelas e gráficos pela metade.
  - Inlining de estilos e renderização avançada com html2canvas, prevenindo o desaparecimento ou truncamento de texto em pills e badges preenchidos.

### 🔍 Verificador Forense de Integridade do Core & Auto-Fix
- Inspeção criptográfica profunda (MD5) comparando todos os arquivos locais do core do WordPress com os hashes oficiais do repositório WordPress.org.
- Compatibilidade nativa com pacotes de idioma internacional (`en_US`) e português do Brasil (`pt_BR`), com normalização inteligente de CRLF/LF.
- Auditoria heurística do arquivo `version.php` prevenindo falsos positivos de adulteração.
- **Auto-Fix em 1 Clique:** Restauração automatizada de arquivos adulterados ou corrompidos diretamente a partir dos fontes oficiais do WordPress.

### 🤖 Blindagem Ativa & Gestão Granular de Fixes (`vexors.app - Fixes`)
- Plugin PHP sob medida gerado para o site com constantes de autenticação embutidas (`VS_FIXES_SITE_TOKEN` e `VS_FIXES_SITE_ID`).
- **Gestão Granular (Toggles em Tempo Real):** Ativação e desativação individual de cada regra de hardening tanto diretamente no wp-admin quanto remotamente pelo painel do SaaS.
- **Sincronização Bidirecional:** Qualquer alteração no WordPress reflete no SaaS e vice-versa instantaneamente via endpoints REST dedicados (`/wp-json/vexors-fixes/v1/status` e `/toggle`).
- **Resiliência a WAF e ModSecurity:** Fallback inteligente por query parameter (`?vs_token=`), garantindo funcionamento mesmo em hospedagens que descartam cabeçalhos `Authorization`.
- **Guia do Servidor & Ações Manuais:** Instruções passo a passo geradas com cache no banco de dados para edições de infraestrutura em `.htaccess`, `nginx.conf` e `php.ini`.

### 📜 Logs de Execução em Tempo Real & Atualizações Remotas
- Visualização em tempo real do stream de logs de depuração do PHP e do WordPress sem necessidade de acessar o SSH ou cPanel.
- Aplicação remota de atualizações pendentes de plugins, temas e do core do WordPress em 1 clique com feedback em tempo real.

### 📝 Timeline de Atividades & Diário Técnico Unificado
- Linha do tempo cronológica que unifica as notas das manutenções mensais e os registros de intervenções técnicas avulsas realizadas no dia a dia.
- Categorização visual com badges (`Geral`, `Segurança`, `Otimização`, `Servidor`, `Correção de Bug`, `Ajustes de Layout`).
- Reconhecimento automático de URLs e blocos de código com botão de cópia rápida.

### 🔗 Link Público Seguro de Visualização para Clientes
- Página pública externa (`/public/logs/:token`) com identidade visual limpa dedicada ao cliente final.
- Modo estrito de auditoria: permite que o cliente acompanhe manutenções e intervenções sem permissões de alteração ou exclusão de dados.
- Gestão e regeneração de tokens criptográficos de acesso em 1 clique.

### 📦 Gestão do Plano, Assinaturas Recorrentes & Add-ons
- Acompanhamento do ciclo de faturamento, data exata da próxima renovação e limites de sites e cotas de IA.
- Contratação simplificada de **Add-ons** (sites adicionais e cotas extras de IA) com **cálculo pró-rata automático** cobrando apenas os dias restantes até o próximo ciclo.
- Upgrade de plano em 1 clique com liberação imediata de limites.
- Histórico mensal de consumo de IA discriminando tokens de entrada (prompt), saída (completion) e custo.

### ⏳ Cancelamento de Assinatura com Carência Automática de 90 Dias
- O usuário pode cancelar a assinatura a qualquer momento na tela Gestão do Plano.
- A cobrança da próxima mensalidade é cancelada imediatamente no Asaas.
- O acesso a todos os sites e recursos permanece **100% ativo até o último dia do ciclo já pago** (`current_period_end`).
- **Após o término do ciclo pago**, a conta entra automaticamente no período de **carência de 90 dias** (`pending_deletion`), desconectando os sites e iniciando a contagem para exclusão definitiva.
- A qualquer momento durante a carência de 90 dias, o usuário pode reativar a conta contratando um novo plano e restaurando todos os seus dados intactos.

### 🔒 Exclusão de Conta com Confirmação por Senha (LGPD)
- Exclusão voluntária disponível em *Minha Conta > Excluir Minha Conta*.
- **Confirmação Obrigatória por Senha:** Exige a senha de acesso atual para autorizar a solicitação.
- Efeitos imediatos:
  - Cancelamento da assinatura no Asaas;
  - Desconexão imediata de todos os sites (`is_connected = 0`);
  - Conta desativada e colocada em carência de 90 dias (`pending_deletion`).
- Tentativas de login durante a carência direcionam para a tela de **Reativação de Conta** (recuperando todos os sites e históricos intactos após assinatura).
- Tentativas de cadastro com o mesmo e-mail durante a carência são bloqueadas, orientando o usuário a reativar sua conta existente.

---

## 👑 2. Funcionalidades Administrativas & Governança (Exclusivo Administradores)

Recursos restritos e protegidos por controle de acesso (RBAC) para a gestão completa da plataforma:

### 📚 Catálogo Central de Soluções & Geração em Lote com IA
- Mapeamento detalhado de cada vulnerabilidade (`check_id`) com tipo de ação (`PLUGIN_AUTO_FIX`, `SERVER_CONFIG`, `MANUAL_ACTION`).
- **Geração em Lote com IA:** Botão dedicado para sintetizar e abastecer snippets PHP e regras de servidor para todo o catálogo utilizando o motor de IA em tempo real com barra de progresso.

### 👥 Gestão Centralizada de Usuários (RBAC)
- Separação clara em abas dedicadas: **Aba Clientes** e **Aba Administradores**, com contadores em tempo real.
- Menu rápido de ações: *Gestão do Plano*, *Ver como (Impersonação)*, *Editar Dados/Senha*, *Ativar/Desativar* e *Excluir*.
- Monitoramento do ciclo de vida das contas com badges informativos: `Ativo`, `Em Carência (Exclusão em DD/MM/AAAA)` e `Purgado`.

### 🎭 Impersonação Segura ("Ver Como Cliente")
- Permite ao administrador navegar na plataforma com a perspectiva exata do cliente selecionado para diagnóstico e suporte avançado, sem necessidade de saber a senha do usuário.
- Indicador visual em destaque no topo informando o modo de impersonação e botão para retornar à visão de Administrador em 1 clique.

### 📊 Cockpit Financeiro por Cliente: DRE & Margem de Contribuição
- Cálculo em tempo real do **Faturamento Contratado (R$)** vs. **Custo Real da API de IA Consumida no Mês (R$)**.
- Exibição da Margem Líquida em R$ e da margem percentual (%) individual por cliente.
- Configuração personalizada de limites de sites extras e tokens de IA adicionais.

### ⚙️ Catálogo Comercial de Planos & Travas Orçamentárias
- Criação e parametrização de planos comerciais (Iniciante, Profissional, Full ou planos sob medida).
- **Salvaguarda Orçamentária Rígida:** Diretriz que proíbe IA ilimitada no sistema para proteger a operação contra custos descontrolados de API.

### 💰 Centro de Comando Financeiro de IA & Precificação Ponderada
- **Fórmula Ponderada Real de Custo:**
  $$\text{Custo (R\$)} = \left(\frac{\text{Tokens Entrada}}{1.000} \times \text{Preço Entrada}\right) + \left(\frac{\text{Tokens Saída}}{1.000} \times \text{Preço Saída}\right)$$
- Cockpit global de faturamento total da carteira vs gasto real com IA, margem líquida consolidada e volume global de tokens.
- Rankings de auditoria: clientes que mais consumiram, domínios que mais demandaram IA e segmentação por funcionalidade.

### 💳 Gestão de Meios de Pagamento Habilitados & Gateway Asaas
- Interruptores independentes para habilitar/desabilitar **Cartão de Crédito** e **Pix Instantâneo**.
- Formulários adaptativos (exibição de seletor ou redirecionamento direto conforme os métodos ativos).
- Trava de integridade que impede desativar todos os métodos simultaneamente.
- Integração com Asaas (API Key, Modo Sandbox e Webhooks para conciliação automática).

### ⏰ Rotina Automatizada de Expurgo de Contas (`PurgeExpiredAccounts`)
- Comando nativo CodeIgniter 4 CLI para automação diária via Cron:
  ```bash
  php spark accounts:purge-expired
  ```
- **Transição Automática:** Localiza assinaturas canceladas cujo período pago terminou e aplica carência de 90 dias com sites desconectados.
- **Expurgo Definitivo:** Localiza contas cuja carência de 90 dias expirou e remove permanentemente todos os registros dos sites, mantendo dados cadastrais com status `purged`.

### ⚖️ Preservação e Integridade de Dados Fiscais e Consumo de IA
- A plataforma assegura a **imutabilidade do histórico financeiro e de consumo de IA**.
- Mesmo quando uma conta tem seus sites expurgados após os 90 dias, os registros de `ai_usage_logs` e `payment_transactions` permanecem vinculados ao ID do usuário.
- Garante que relatórios fiscais, relatórios contábeis e o DRE da administração permaneçam 100% corretos e confiáveis ao longo do tempo.

### 📖 Central de Documentação Integrada (`/docs`)
- Documentação técnica e operacional completa acessível diretamente na plataforma.
- **Visão Adaptativa por Privilégio:** Usuários comuns visualizam apenas as seções gerais; administradores visualizam as seções restritas de governança, catálogo de soluções, DRE e configurações de gateway.

---

## ⚖️ 3. Segregação de Dados: Clientes (Públicos) vs. Administração (Restritos)

A plataforma implementa isolamento multi-tenant rigoroso e governança de dados pautada no princípio do menor privilégio:

| Camada de Acesso | Público-Alvo | Dados & Recursos Acessíveis | Restrições & Blindagens de Segurança |
| :--- | :--- | :--- | :--- |
| **Visão do Cliente Final** | Cliente final da agência / dono do site | • **Relatório Diagnóstico Executivo (Web & PDF):** Nota, checklist completo de testes checados (Resolvido vs Pendente), telemetria e inventário.<br>• **Link Público de Atividades (`/public/logs/:token`):** Timeline cronológica das manutenções e intervenções do site. | • Modo **estritamente somente leitura** (sem permissão de edição, exclusão ou criação).<br>• Protegido por token criptográfico de 64 caracteres.<br>• Nenhum dado financeiro, chave de API ou custo é exposto. |
| **Usuário do SaaS (Dono do Site)** | Usuário logado / Agência | • Painel de gestão dos seus próprios websites.<br>• Varreduras, auto-fix do core, atualizações remotas e fixes.<br>• Gestão da sua própria assinatura, add-ons pró-rata e volumetria do seu próprio consumo de IA. | • Isolamento por `user_id` em todas as consultas SQL.<br>• Não visualiza custos de atacado de IA nem margens de contribuição.<br>• Sem acesso à gestão de usuários, catálogo global ou expurgo. |
| **Administração & Governança** | Gestores do SaaS (Admin) | • **Cockpit Financeiro por Cliente (DRE):** Faturamento contratado vs Custo real de IA consumido (R$) e margem líquida.<br>• **Centro de Comando Global de IA:** Volumetria total de tokens e rankings de consumo.<br>• **Catálogo Global de Soluções com IA em Lote.**<br>• **Gestão de Usuários RBAC, Impersonação, Carência de 90 Dias e Expurgo CLI.**<br>• **Catálogo de Planos com Travas Orçamentárias** e **Gateway Asaas (Cartão/Pix).** | • Autenticação restrita via JWT com claim `role: 'admin'`.<br>• Validação server-side em todos os endpoints REST da API.<br>• Seções restritas da documentação (`.admin-only`) ocultadas para não-administradores. |

---

## 🛠️ Tecnologias Utilizadas

- **Backend**: PHP 8.2+ | CodeIgniter 4 (Arquitetura RESTful MVC) | Composer
- **Frontend**: React 18 | TypeScript | Vite | Mantine UI v7 | Tabler Icons
- **Inteligência Artificial**: OpenCode Zen API (`kimi-k2.7-code`) | DeepSeek API
- **Banco de Dados**: MySQL 8.0+ / MariaDB 10.11+
- **Gateway Financeiro**: Asaas API v3 (Cobranças Recorrentes, Cartão e Pix via Webhook)
- **Autenticação & Segurança**: JWT (JSON Web Tokens) com RBAC

---

## 🚀 Instalação e Configuração

### 1. Requisitos do Sistema
- PHP 8.2 ou superior (com extensões `curl`, `json`, `mbstring`, `mysqlnd`, `intl`)
- Node.js 18+ e npm
- Servidor Web (Nginx ou Apache)
- MySQL 8.0+ / MariaDB 10.11+

### 2. Configuração do Backend (CodeIgniter 4)
1. Clone o repositório:
   ```bash
   git clone https://github.com/rodsbermudez/validar-seguranca.git
   cd validar-seguranca
   ```
2. Instale as dependências via Composer:
   ```bash
   composer install
   ```
3. Configure o arquivo `.env`:
   ```ini
   database.default.hostname = localhost
   database.default.database = vexors_db
   database.default.username = seu_usuario
   database.default.password = sua_senha
   database.default.DBDriver = MySQLi

   # Integração de IA
   OPENCODE_API_KEY=sua_chave_opencode
   ```
4. Execute as migrações do banco de dados:
   ```bash
   php spark migrate
   ```

### 3. Configuração e Build do Frontend (React)
1. Acesse o diretório do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências e compile:
   ```bash
   npm install
   npm run build
   ```
   *(Os arquivos compilados são gerados automaticamente em `public/assets/`)*.

### 4. Configuração do Cron Job de Manutenção
Configure no crontab do servidor para execução diária:
```bash
0 3 * * * cd /caminho/do/projeto && php spark accounts:purge-expired >> /dev/null 2>&1
```

---

## 📄 Licença e Uso

Desenvolvido para auditoria, hardening e governança contínua de ecossistemas WordPress.
