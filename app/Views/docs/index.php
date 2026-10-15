<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentação & Guia de Uso — Validar Segurança</title>
    <link rel="icon" type="image/png" href="<?= base_url('favicon.png') ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-body: #333333;
            --bg-sidebar: #111111;
            --bg-card: #111111;
            --bg-card-hover: #1c1c1c;
            --border-color: #444444;
            --border-subtle: #222222;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --text-dim: #79c1a8;
            --primary: #236baa;
            --primary-hover: #1b5385;
            --accent-pink: #ec1c66;
            --accent-teal: #79c1a8;
            --accent-orange: #ec1c66;
            --accent-green: #79c1a8;
            --accent-red: #ef4444;
            --accent-purple: #ec1c66;
            --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
            --font-mono: 'JetBrains Mono', monospace;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--font-sans);
            background-color: var(--bg-body);
            color: var(--text-main);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }

        /* Header Navigation */
        header {
            position: sticky;
            top: 0;
            z-index: 50;
            background: rgba(17, 17, 17, 0.96);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-color);
            height: 64px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
            color: var(--text-main);
            font-weight: 700;
            font-size: 1.15rem;
        }

        .brand-logo {
            width: 34px;
            height: 34px;
            background: linear-gradient(135deg, #0284c7, #f97316);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.1rem;
            color: #fff;
            box-shadow: 0 2px 10px rgba(56, 189, 248, 0.25);
        }

        .brand-badge {
            background: #1e293b;
            color: var(--primary);
            font-size: 0.75rem;
            padding: 2px 8px;
            border-radius: 9999px;
            border: 1px solid rgba(56, 189, 248, 0.3);
            margin-left: 6px;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .search-box {
            position: relative;
            width: 320px;
        }

        .search-box input {
            width: 100%;
            padding: 8px 14px 8px 36px;
            background: #1e293b;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            color: var(--text-main);
            font-size: 0.875rem;
            outline: none;
            transition: all 0.2s ease;
        }

        .search-box input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
        }

        .search-icon {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 0.9rem;
            pointer-events: none;
        }

        .btn-app {
            background: linear-gradient(135deg, #236baa, #ec1c66);
            color: #fff;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: opacity 0.2s;
        }

        .btn-app:hover {
            opacity: 0.9;
        }

        /* Layout Main Grid */
        .doc-wrapper {
            display: flex;
            min-height: calc(100vh - 64px);
        }

        /* Sidebar Navigation */
        aside.sidebar {
            width: 300px;
            background: var(--bg-sidebar);
            border-right: 1px solid var(--border-color);
            position: sticky;
            top: 64px;
            height: calc(100vh - 64px);
            overflow-y: auto;
            padding: 24px 16px;
            flex-shrink: 0;
        }

        .nav-group {
            margin-bottom: 24px;
        }

        .nav-title {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-dim);
            font-weight: 700;
            margin-bottom: 8px;
            padding-left: 12px;
        }

        .nav-list {
            list-style: none;
        }

        .nav-item a {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 9px 12px;
            color: var(--text-muted);
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            border-radius: 6px;
            transition: all 0.15s ease;
        }

        .nav-item a:hover {
            background: var(--bg-card);
            color: var(--text-main);
        }

        .nav-item a.active {
            background: rgba(56, 189, 248, 0.12);
            color: var(--primary);
            font-weight: 600;
            border-left: 3px solid var(--primary);
        }

        .nav-icon {
            font-size: 1.05rem;
            width: 20px;
            text-align: center;
        }

        /* Content Area */
        main.content {
            flex: 1;
            max-width: 960px;
            padding: 40px 48px;
            margin: 0 auto;
        }

        .doc-section {
            margin-bottom: 64px;
            scroll-margin-top: 80px;
        }

        .doc-section h1 {
            font-size: 2rem;
            font-weight: 800;
            color: var(--text-main);
            margin-bottom: 12px;
            letter-spacing: -0.02em;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .doc-section h2 {
            font-size: 1.4rem;
            font-weight: 700;
            color: var(--text-main);
            margin: 28px 0 14px 0;
            border-bottom: 1px solid var(--border-subtle);
            padding-bottom: 8px;
        }

        .doc-section h3 {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--primary);
            margin: 20px 0 10px 0;
        }

        .doc-section p {
            color: #cbd5e1;
            font-size: 1rem;
            margin-bottom: 16px;
            line-height: 1.7;
        }

        .doc-section ul, .doc-section ol {
            margin: 0 0 20px 24px;
            color: #cbd5e1;
        }

        .doc-section li {
            margin-bottom: 8px;
            line-height: 1.6;
        }

        /* Callouts & Alert Cards */
        .callout {
            padding: 16px 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid;
            background: #1e293b;
        }

        .callout-info {
            border-color: var(--primary);
            background: rgba(56, 189, 248, 0.08);
        }

        .callout-warning {
            border-color: var(--accent-orange);
            background: rgba(249, 115, 22, 0.08);
        }

        .callout-success {
            border-color: var(--accent-green);
            background: rgba(16, 185, 129, 0.08);
        }

        .callout-title {
            font-weight: 700;
            font-size: 0.95rem;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .callout-info .callout-title { color: var(--primary); }
        .callout-warning .callout-title { color: var(--accent-orange); }
        .callout-success .callout-title { color: var(--accent-green); }

        /* Grade Badges & Tables */
        .grade-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 12px;
            margin: 20px 0;
        }

        .grade-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 14px;
            text-align: center;
        }

        .grade-badge {
            font-size: 1.8rem;
            font-weight: 800;
            display: block;
            margin-bottom: 4px;
        }

        .grade-a-plus { color: #10b981; }
        .grade-a { color: #34d399; }
        .grade-b { color: #38bdf8; }
        .grade-c { color: #facc15; }
        .grade-d { color: #fb923c; }
        .grade-f { color: #ef4444; }

        .grade-label {
            font-size: 0.8rem;
            color: var(--text-muted);
            font-weight: 500;
        }

        table.doc-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: var(--bg-card);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid var(--border-color);
        }

        table.doc-table th, table.doc-table td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
            font-size: 0.9rem;
        }

        table.doc-table th {
            background: #0f172a;
            color: var(--text-main);
            font-weight: 600;
        }

        table.doc-table tr:last-child td {
            border-bottom: none;
        }

        /* Code snippets */
        .code-block {
            position: relative;
            background: #090d16;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
            font-family: var(--font-mono);
            font-size: 0.875rem;
            color: #38bdf8;
            overflow-x: auto;
        }

        .code-block pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
        }

        .btn-copy {
            position: absolute;
            top: 10px;
            right: 10px;
            background: #1e293b;
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 0.75rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-copy:hover {
            background: var(--primary);
            color: #fff;
        }

        /* Responsive */
        @media (max-width: 900px) {
            .doc-wrapper { flex-direction: column; }
            aside.sidebar { width: 100%; height: auto; position: static; }
            main.content { padding: 24px 20px; }
            .search-box { width: 200px; }
        }
    </style>
</head>
<body>

    <!-- Header Navigation -->
    <header>
        <a href="<?= base_url('docs') ?>" class="brand">
            <img src="<?= base_url('images/logo-Patropi.png') ?>" alt="Logo Patropi" style="height: 38px; width: auto; max-width: 220px; object-fit: contain;">
            <span class="brand-badge">Documentação</span>
        </a>

        <div class="header-actions">
            <div class="search-box">
                <span class="search-icon">🔍</span>
                <input type="text" id="docSearch" placeholder="Buscar na documentação (ex: Grade, Plugin, .htaccess)...">
            </div>
            <a href="<?= base_url() ?>" class="btn-app">
                <span>Ir para a Plataforma</span>
                <span>➔</span>
            </a>
        </div>
    </header>

    <div class="doc-wrapper">
        <!-- Sidebar Navigation -->
        <aside class="sidebar">
            <div class="nav-group">
                <div class="nav-title">Introdução</div>
                <ul class="nav-list">
                    <li class="nav-item"><a href="#visao-geral" class="active"><span class="nav-icon">🚀</span> Visão Geral</a></li>
                    <li class="nav-item"><a href="#pontuacao-e-notas"><span class="nav-icon">📊</span> Notas & Cálculo de Grade</a></li>
                </ul>
            </div>

            <div class="nav-group">
                <div class="nav-title">Funcionalidades Principais</div>
                <ul class="nav-list">
                    <li class="nav-item"><a href="#auditoria-de-seguranca"><span class="nav-icon">🛡️</span> Auditoria & Varreduras</a></li>
                    <li class="nav-item"><a href="#plugin-agente"><span class="nav-icon">🔌</span> Plugin Agente WordPress</a></li>
                    <li class="nav-item"><a href="#integridade-do-core"><span class="nav-icon">🔍</span> Integridade do Core & Auto-Fix</a></li>
                    <li class="nav-item"><a href="#logs-de-atividades"><span class="nav-icon">📝</span> Logs de Atividades & Diário Técnico</a></li>
                    <li class="nav-item"><a href="#link-publico-clientes"><span class="nav-icon">🔗</span> Link Público para Clientes</a></li>
                    <li class="nav-item"><a href="#logs-em-tempo-real"><span class="nav-icon">📜</span> Logs de Execução em Tempo Real</a></li>
                    <li class="nav-item"><a href="#atualizacoes-remotas"><span class="nav-icon">🔄</span> Atualizações Remotas (Plugins/Temas/Core)</a></li>
                    <li class="nav-item"><a href="#remediacao-e-ia"><span class="nav-icon">🤖</span> Remediação Híbrida & IA</a></li>
                </ul>
            </div>

            <div class="nav-group">
                <div class="nav-title">Administração</div>
                <ul class="nav-list">
                    <li class="nav-item"><a href="#catalogo-de-solucoes"><span class="nav-icon">📚</span> Catálogo de Soluções</a></li>
                    <li class="nav-item"><a href="#gestao-de-usuarios"><span class="nav-icon">👥</span> Gestão de Usuários</a></li>
                </ul>
            </div>

            <div class="nav-group">
                <div class="nav-title">Suporte</div>
                <ul class="nav-list">
                    <li class="nav-item"><a href="#faq-e-boas-praticas"><span class="nav-icon">❓</span> FAQ & Boas Práticas</a></li>
                </ul>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="content">

            <!-- 1. Visão Geral -->
            <section id="visao-geral" class="doc-section">
                <h1>🚀 Visão Geral da Plataforma</h1>
                <p>O <strong>Validar Segurança</strong> é uma plataforma avançada de auditoria, diagnóstico contínuo e remediação inteligente de segurança voltada para aplicações <strong>WordPress</strong>.</p>
                
                <p>A plataforma adota uma <strong>arquitetura híbrida de proteção</strong>, unindo varreduras externas não invasivas com a coleta interna promovida pelo <strong>Plugin Agente Patropi</strong> instalado diretamente na aplicação WordPress.</p>

                <div class="callout callout-info">
                    <div class="callout-title">💡 Como Funciona a Proteção Híbrida?</div>
                    <p>Enquanto a varredura externa analisa o comportamento público do site (cabeçalhos de segurança, arquivos expostos e usuários enumeráveis), o Plugin Agente coleta diagnósticos internos do WordPress (plugins vulneráveis, usuários administradores legados, diretórios com escrita) garantindo 100% de cobertura.</p>
                </div>

                <h2>Destaques do Sistema</h2>
                <ul>
                    <li><strong>Diagnóstico Instantâneo:</strong> Execução de varreduras em menos de 10 segundos com relatórios categorizados.</li>
                    <li><strong>Triagem Automática:</strong> Separação entre falhas que podem ser corrigidas por plugin e falhas que exigem configurações no servidor web.</li>
                    <li><strong>Remediação com IA:</strong> Geração automatizada de plugins PHP sob medida e guias de servidor detalhados alimentados pelo modelo <code>Kimi K2.7 Code</code> via OpenCode Zen API.</li>
                    <li><strong>Logs de Atividades & Diário Técnico:</strong> Linha do tempo unificada com manutenções e intervenções avulsas, suporte a código e links clicáveis.</li>
                    <li><strong>Link Público para Clientes:</strong> Compartilhamento direto com o cliente em modo somente leitura com identidade visual da Patropi.</li>
                </ul>

                <h2>Navegação e Menus da Plataforma</h2>
                <p>A interface foi estruturada com foco em produtividade e elegância visual:</p>
                <ul>
                    <li><strong>Menu Global Superior:</strong> Acesso rápido em primeiro nível a <em>Websites</em>, <em>Configurações</em> (com dropdown reunindo Gerais, Usuários e Catálogo de Soluções), <em>Documentação</em> e menu do usuário logado (com suporte a impersonação para administradores).</li>
                    <li><strong>Dashboard Central com Destaque de 30+ Dias:</strong> O painel principal exibe dois radares estratégicos: o <strong>Radar de Segurança</strong> (notas e status das auditorias remotas) e o <strong>Resumo de Integridades do Core</strong> (sites seguros, pendentes ou com arquivos adulterados). Sites que não são auditados ou verificados há mais de 30 dias recebem destaque visual em amarelo, e os 6 piores sites de cada radar são listados para intervenção prioritária.</li>
                    <li><strong>Menu Ferramentas nos Sites:</strong> Na barra superior interna de cada site, o selo de status de conexão do agente fica posicionado ao lado do botão <strong>Ferramentas</strong>, abrindo um menu dropdown que reúne todas as áreas (Visão Geral, Auditoria, Integridade, Logs de Atividades, Logs em Tempo Real, Atualizações, Agente WP, Configurações, Relatórios e Download do Agente).</li>
                    <li><strong>Registro de Manutenções com Mês de Referência:</strong> No modal de conclusão de manutenção mensal, você pode selecionar o mês vigente ou marcar meses anteriores para registrar intervenções retroativas com histórico completo.</li>
                </ul>
            </section>

            <!-- 2. Pontuação e Notas -->
            <section id="pontuacao-e-notas" class="doc-section">
                <h1>📊 Entendendo a Pontuação & Notas (Grade & Score)</h1>
                <p>Cada varredura de segurança gera uma nota numérica de <strong>0 a 100</strong> e atribui uma classificação por letra (<strong>Grade</strong>), variando de <code>A+</code> (Segurança Máxima) até <code>F</code> (Crítico / Altamente Vulnerável).</p>

                <h2>Escala de Classificação (Grades)</h2>
                <div class="grade-grid">
                    <div class="grade-card">
                        <span class="grade-badge grade-a-plus">A+</span>
                        <span class="grade-label">95 - 100 pts<br>Excelente</span>
                    </div>
                    <div class="grade-card">
                        <span class="grade-badge grade-a">A</span>
                        <span class="grade-label">85 - 94 pts<br>Muito Bom</span>
                    </div>
                    <div class="grade-card">
                        <span class="grade-badge grade-b">B</span>
                        <span class="grade-label">70 - 84 pts<br>Satisfatório</span>
                    </div>
                    <div class="grade-card">
                        <span class="grade-badge grade-c">C</span>
                        <span class="grade-label">50 - 69 pts<br>Atenção</span>
                    </div>
                    <div class="grade-card">
                        <span class="grade-badge grade-d">D</span>
                        <span class="grade-label">30 - 49 pts<br>Vulnerável</span>
                    </div>
                    <div class="grade-card">
                        <span class="grade-badge grade-f">F</span>
                        <span class="grade-label">0 - 29 pts<br>Crítico</span>
                    </div>
                </div>

                <h2>Como o Cálculo da Nota Funciona?</h2>
                <p>A nota inicial de todo relatório começa em <strong>100 pontos</strong>. A cada falha detectada durante os testes de auditoria, uma penalidade específica é deduzida da pontuação final com base na severidade da vulnerabilidade:</p>

                <table class="doc-table">
                    <thead>
                        <tr>
                            <th>Severidade</th>
                            <th>Penalidade por Falha</th>
                            <th>Exemplo de Vulnerabilidade</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><span style="color:#ef4444; font-weight:700;">🔴 Crítica</span></td>
                            <td>-25 a -35 pontos</td>
                            <td>Usuário Administrador padrão ("admin") ativo / Diretório <code>wp-includes</code> navegável</td>
                        </tr>
                        <tr>
                            <td><span style="color:#f97316; font-weight:700;">🟠 Alta</span></td>
                            <td>-15 a -20 pontos</td>
                            <td>Ausência de HTTPS/SSL / Enumeração pública de usuários via query <code>?author=1</code></td>
                        </tr>
                        <tr>
                            <td><span style="color:#facc15; font-weight:700;">🟡 Média</span></td>
                            <td>-10 a -15 pontos</td>
                            <td>Falta de cabeçalhos Strict-Transport-Security (HSTS) ou X-Frame-Options</td>
                        </tr>
                        <tr>
                            <td><span style="color:#38bdf8; font-weight:700;">🔵 Baixa</span></td>
                            <td>-5 a -10 pontos</td>
                            <td>Exposição de versão do WordPress ou cabeçalhos X-Powered-By no servidor</td>
                        </tr>
                    </tbody>
                </table>

                <div class="callout callout-warning">
                    <div class="callout-title">⚠️ Por que meu site está com Nota 0 se tenho 18 testes Aprovados?</div>
                    <p>No modelo de auditoria de segurança, <strong>falhas críticas possuem peso cumulativo severo</strong>. Se um website for aprovado em 18 checagens simples mas falhar em 4 ou 5 vulnerabilidades de alta severidade (como usuário admin exposto, SSL ausente e diretórios abertos), a soma das penalidades zera a pontuação. Segurança não é uma média simples, pois uma única falha grave permite a invasão total da aplicação.</p>
                </div>
            </section>

            <!-- 3. Auditoria de Segurança -->
            <!-- 3. Auditoria de Segurança -->
            <section id="auditoria-de-seguranca" class="doc-section">
                <h1>🛡️ Auditoria & Varreduras de Segurança</h1>
                <p>O módulo de auditoria executa varreduras automatizadas cobrindo 5 categorias principais de testes:</p>
                
                <ol>
                    <li><strong>Infraestrutura & Cabeçalhos HTTP:</strong> Verifica HTTPS/SSL, HSTS, X-Content-Type-Options, X-Frame-Options e políticas de proteção.</li>
                    <li><strong>Exposição de Arquivos & Diretórios:</strong> Testa navegabilidade nos diretórios <code>/wp-content/uploads/</code>, <code>/wp-includes/</code>, arquivos de log e documentos públicos de plugins (ex: <code>readme.txt</code>, <code>license.txt</code>).</li>
                    <li><strong>Enumeração de Usuários & Login:</strong> Avalia se atacantes podem listar login de autores via query <code>/?author=1</code>, REST API (<code>/wp-json/wp/v2/users</code>) ou através de sitemaps XML de usuários.
                        <div class="callout callout-info" style="margin-top:10px;">
                            <div class="callout-title">🔍 Detecção em Sitemaps XML (Yoast / Nativo / Rank Math)</div>
                            <p>O scanner analisa não apenas a URL nativa do WordPress (<code>/wp-sitemap-users-1.xml</code>), mas também sitemaps gerados por plugins de SEO populares, como Yoast SEO (<code>/author-sitemap.xml</code>) e Rank Math. Caso a rota redirecione para outra página de sitemap (HTTP 301/302), o scanner segue o redirecionamento automaticamente para verificar a exposição real de usernames.</p>
                        </div>
                    </li>
                    <li><strong>Fingerprinting & Detecção de Versão:</strong> Checa vazamento de versões do PHP, servidor web, WordPress e remoção de parâmetros <code>?ver=</code> em arquivos CSS/JS.</li>
                    <li><strong>Auditoria Interna do Agente Patropi:</strong> Avalia plugins abandonados/inativos, atualizações pendentes e contas privilegiadas.</li>
                </ol>

                <h2>Como Adicionar um Site e Executar a Varredura</h2>
                <ol>
                    <li>No painel da plataforma, clique em <strong>"Websites Alvo"</strong> e depois em <strong>"+ Adicionar Website"</strong>.</li>
                    <li>Informe o nome e a URL completa da aplicação WordPress (ex: <code>http://seusite.com.br</code>).</li>
                    <li>Clique em <strong>"Executar Nova Varredura"</strong>. A análise leva poucos segundos e o relatório será exibido na tela.</li>
                </ol>
            </section>

            <!-- 4. Plugin Agente WordPress -->
            <section id="plugin-agente" class="doc-section">
                <h1>🔌 Plugin Agente WordPress (Patropi Agent)</h1>
                <p>O <strong>Validar Segurança Agent</strong> é o plugin companheiro que conecta a plataforma diretamente ao WordPress para coletar informações internas e permitir a aplicação de correções.</p>

                <h2>Como Instalar e Conectar o Agente</h2>
                <ol>
                    <li>Na listagem de websites da plataforma, clique em <strong>"Baixar Agente WP"</strong> para obter o arquivo <code>validar-seguranca-agent.zip</code>.</li>
                    <li>No WordPress do cliente, vá em <code>Plugins > Adicionar Novo > Enviar Plugin</code> e ative o plugin.</li>
                    <li>Copie o <strong>Token de Conexão Único</strong> gerado na plataforma para o site desejado.</li>
                    <li>No WordPress, acesse a tela do plugin <strong>WP Patropi > Diagnóstico</strong> e cole o token para concluir a conexão.</li>
                </ol>

                <h2>Botão de Reconexão e Refazer Ponte</h2>
                <p>Caso o token seja alterado na plataforma ou a conexão entre a aplicação WordPress e o painel seja interrompida, o plugin conta com o botão <strong>"⚡ Testar Reconexão com a Plataforma"</strong>. Ele permite reiniciar o handshake de autenticação de forma simples e direta, sem a necessidade de reinstalar o plugin.</p>

                <h2>Configuração Manual de Credenciais no WP-Admin</h2>
                <p>Caso você reinstale o plugin manualmente ou queira conferir se o token salvo coincide com o painel SaaS, a página <strong>WP Patropi > Diagnóstico</strong> no WordPress disponibiliza campos editáveis para:</p>
                <ul>
                    <li><strong>ID do Site no SaaS:</strong> Identificador numérico do site no banco da plataforma.</li>
                    <li><strong>Token do Agente:</strong> Chave de segurança exclusiva de comunicação.</li>
                    <li><strong>URL do Painel SaaS:</strong> Endereço da plataforma para comunicação e handshakes automáticos.</li>
                </ul>
                <p>Ao salvar as configurações, o agente valida as chaves e estabelece o pareamento instantaneamente com o painel.</p>
            </section>

            <!-- 5. Logs em Tempo Real -->
            <section id="logs-em-tempo-real" class="doc-section">
                <h1>📜 Logs de Execução em Tempo Real do WordPress</h1>
                <p>A aba <strong>Logs em Tempo Real</strong> permite que os administradores monitorem erros de PHP, avisos do sistema (warnings), notices e logs de depuração do WordPress diretamente pelo painel SaaS, sem necessidade de abrir clientes FTP ou gerenciadores de arquivos da hospedagem.</p>

                <h2>Principais Funcionalidades do Módulo de Logs</h2>
                <ul>
                    <li><strong>Ativação/Desativação Remota:</strong> Com um único clique no botão de alternância (switch), você ativa o <code>WP_DEBUG_LOG</code> do WordPress. Quando ativado, os erros passam a ser gravados em arquivo protegido e são <em>ocultados da tela pública</em> (prevenindo vazamento de dados aos visitantes).</li>
                    <li><strong>Filtros por Nível de Severidade:</strong> Filtre os logs em tempo real entre <code>Fatal Error</code>, <code>Warning</code>, <code>Notice</code>, <code>Deprecated</code> ou visualize todos os registros concatenados.</li>
                    <li><strong>Console com Busca e Auto-Scroll:</strong> Digite termos, nomes de funções ou plugins para localizar a origem exata de problemas e ative o botão de Auto-scroll para acompanhar a execução em tempo real.</li>
                    <li><strong>Limpeza do Arquivo de Logs:</strong> Permite esvaziar o arquivo <code>debug.log</code> no servidor WordPress para reiniciar o monitoramento de novos incidentes.</li>
                </ul>

                <div class="callout callout-info">
                    <div class="callout-title">🔒 Armazenamento Seguro dos Logs</div>
                    <p>Os logs são armazenados no diretório <code>wp-content/uploads/wp-patropi-logs/debug.log</code> protegido por arquivo <code>.htaccess</code> interno que bloqueia o download direto de navegadores não autorizados.</p>
                </div>
            </section>

            <!-- 6. Gestão Centralizada de Atualizações Remotas -->
            <section id="atualizacoes-remotas" class="doc-section">
                <h1>🔄 Gestão Centralizada de Atualizações Remotas</h1>
                <p>O módulo de <strong>Atualizações</strong> oferece visibilidade total do estado de desatualização de componentes do WordPress e permite disparar atualizações remotas e silenciosas sem precisar fazer login no wp-admin de cada site gerenciado.</p>

                <h2>O Que Pode Ser Atualizado Diretamente pelo SaaS</h2>
                <ol>
                    <li><strong>Plugins Instalados:</strong> Identifica quais plugins possuem versões mais recentes no repositório oficial do WordPress.org ou via transient ativo e permite atualização individual ou de múltiplos itens.</li>
                    <li><strong>Temas:</strong> Detecta temas do WordPress que possuem novas versões publicadas com botão de atualização segura.</li>
                    <li><strong>Core do WordPress:</strong> Compara a versão local em execução contra a última versão estável disponível na API do WordPress.org.</li>
                </ol>

                <h2>Execução Silenciosa com Classes Nativas</h2>
                <p>Ao solicitar a atualização, o agente executa as classes nativas do core do WordPress (<code>Plugin_Upgrader</code>, <code>Theme_Upgrader</code>, <code>Core_Upgrader</code>), garantindo que as rotinas de descompactação, verificação de dependências e substituição de arquivos respeitem o fluxo oficial e seguro do WordPress.</p>
            </section>

            <!-- 7. Verificador de Integridade do Core & Auto-Fix -->
            <section id="integridade-do-core" class="doc-section">
                <h1>🔍 Verificador de Integridade do Core & Auto-Fix Oficial</h1>
                <p>O <strong>Verificador de Integridade</strong> atua como um escâner forense no WordPress cliente, garantindo que nenhum arquivo de sistema essencial tenha sido adulterado, corrompido ou infectado por injeções de malware, webshells ou backdoors.</p>

                <h2>Como Funciona a Varredura de Integridade</h2>
                <ol>
                    <li><strong>Consulta a Checksums Oficiais:</strong> O agente consulta os hashes MD5 oficiais disponibilizados pela API do WordPress.org (<code>api.wordpress.org/core/checksums/1.0/</code>) para a versão e idioma exatos do site.</li>
                    <li><strong>Varredura Criptográfica Local:</strong> O agente calcula o <code>md5_file()</code> de cada arquivo nos diretórios do sistema (<code>/wp-admin/</code>, <code>/wp-includes/</code> e na raiz <code>ABSPATH</code>).</li>
                    <li><strong>Classificação Automática de Anomalias:</strong>
                        <ul>
                            <li><span style="color:#ef4444; font-weight:bold;">Modificado (CRITICAL):</span> Arquivo oficial cujo conteúdo foi alterado em relação ao release original (forte indício de código malicioso ou edição indevida).</li>
                            <li><span style="color:#f97316; font-weight:bold;">Suspeito (CRITICAL/LOW):</span> Arquivos desconhecidos em diretórios protegidos do sistema ou sobras de instalação em servidores de produção (ex: <code>wp-config-sample.php</code>, <code>readme.html</code>).</li>
                            <li><span style="color:#eab308; font-weight:bold;">Ausente (HIGH):</span> Arquivos essenciais do core do WordPress que foram deletados do servidor.</li>
                        </ul>
                    </li>
                </ol>

                <h2>Recursos de Correção Rápida (Ações Diretas)</h2>
                
                <h3>1. Auto-Fix / Restauração do Arquivo Original (Módulo 6)</h3>
                <p>Ao identificar um arquivo modificado ou ausente, você pode clicar em <strong>"Restaurar Original"</strong>. O agente:</p>
                <ul>
                    <li>Valida a whitelist estrita de arquivos pertencentes ao Core oficial (protegendo permanentemente arquivos customizados como <code>wp-config.php</code> e <code>wp-content/</code>).</li>
                    <li>Baixa a versão oficial e autêntica correspondente à versão instalada diretamente dos servidores do WordPress.org / GitHub oficial.</li>
                    <li>Cria uma cópia de segurança temporária (<code>.bak</code>), grava o arquivo limpo e verifica a integridade pós-gravação. Em caso de qualquer falha, executa rollback automático.</li>
                </ul>

                <h3>2. Exclusão Direta de Arquivos Suspeitos ou Sobras</h3>
                <p>Para arquivos não essenciais encontrados na raiz (como <code>wp-config-sample.php</code> ou arquivos residuais), o painel disponibiliza o botão <strong>"Excluir"</strong> com modal de confirmação irreversível, eliminando a superfície de exposição sem necessitar de FTP.</p>

                <h3>3. Ignorar e Marcar como Resolvido com Purga Automática</h3>
                <p>Se um arquivo foi intencionalmente adicionado por algum plugin de segurança legítimo (ex: Wordfence), você pode marcá-lo como <strong>"Ignorar / Resolvido"</strong>. A plataforma aplica a seguinte inteligência:</p>
                <ul>
                    <li>A decisão fica memorizada enquanto o arquivo continuar existindo no servidor.</li>
                    <li><strong>Purga Automática:</strong> Se o arquivo deixar de existir no servidor e for recriado futuramente, a regra é purgada automaticamente e o arquivo voltará a ser apontado como pendente, evitando falsos negativos.</li>
                </ul>

                <h3>4. Scanner Heurístico & Compatibilidade com Pacotes em Português (pt_BR)</h3>
                <p>O arquivo <code>wp-includes/version.php</code> em instalações baixadas em Português do Brasil contém a variável legítima <code>$wp_local_package = 'pt_BR';</code>, o que gerava divergências de hash contra repositórios internacionais.</p>
                <ul>
                    <li><strong>Validação Multinível:</strong> O agente compara tanto o hash do locale local quanto o hash do build base internacional, normalizando variações de quebra de linha (CRLF vs LF).</li>
                    <li><strong>Análise Estrutural de Tokens:</strong> O agente audita os tokens PHP do arquivo. Ele só é considerado íntegro se contiver estritamente variáveis permitidas do WordPress (com versão coincidente) e nenhuma chamada de função executável ou código malicioso.</li>
                    <li><strong>Restauração com Preservação de Idioma:</strong> Ao restaurar o <code>version.php</code>, o agente injeta a definição do pacote local com fidelidade criptográfica total, prevenindo erros de mismatch.</li>
                    <li><strong>Persistência no Banco de Dados:</strong> O resultado da última varredura (status, contadores e data) é gravado no banco de dados do SaaS, garantindo que o status do site permaneça visível mesmo após novo login na plataforma.</li>
                </ul>
            </section>

            <!-- 8. Logs de Atividades & Diário Técnico -->
            <section id="logs-de-atividades" class="doc-section">
                <h1>📝 Logs de Atividades & Diário Técnico</h1>
                <p>A tela de <strong>Logs de Atividades</strong> atua como um livro-razão e diário técnico contínuo para cada site gerenciado, permitindo que a equipe registre todas as intervenções executadas e forneça transparência total para o cliente e administradores.</p>

                <h2>Timeline Unificada de Eventos</h2>
                <p>A lista de atividades consolida automaticamente dois tipos de registros em uma linha do tempo única e cronológica:</p>
                <ol>
                    <li><strong>Anotações das Manutenções Mensais:</strong> Toda vez que uma manutenção periódica é concluída no painel com o relatório de atividades e mês selecionado, ela entra diretamente na linha do tempo como registro oficial de manutenção.</li>
                    <li><strong>Notas Técnicas Avulsas:</strong> Observações, diagnósticos e ajustes pontuais realizados no dia a dia podem ser criados a qualquer momento pela equipe técnica sem depender do ciclo mensal de manutenção.</li>
                </ol>

                <h2>Categorias Pré-definidas</h2>
                <p>Cada nota técnica pode ser classificada em categorias visuais que facilitam a filtragem e localização de históricos:</p>
                <ul>
                    <li><span class="badge" style="background:#236baa; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:600;">Geral</span> — Notas operacionais e registros rotineiros.</li>
                    <li><span class="badge" style="background:#ef4444; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:600;">Segurança</span> — Aplicação de patches, mitigação de vulnerabilidades e bloqueios de IP.</li>
                    <li><span class="badge" style="background:#10b981; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:600;">Otimização</span> — Ajustes de performance, cache e Core Web Vitals.</li>
                    <li><span class="badge" style="background:#8b5cf6; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:600;">Servidor</span> — Configurações de DNS, PHP, Apache/Nginx ou banco de dados.</li>
                    <li><span class="badge" style="background:#f97316; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:600;">Correção de Bug</span> — Resolução de erros 500, incompatibilidades de plugins ou conflitos de código.</li>
                    <li><span class="badge" style="background:#ec1c66; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:600;">Ajustes de Layout</span> — Modificações em CSS, temas filhos e ajustes visuais solicitados.</li>
                </ul>

                <h2>Formatação Rica com Suporte a Código e Links</h2>
                <p>O campo de conteúdo das notas aceita formatação técnica avançada:</p>
                <ul>
                    <li><strong>Links Clicáveis:</strong> URLs inseridas nas notas são detectadas automaticamente e renderizadas como links seguros com abertura em nova aba (<code>target="_blank"</code>).</li>
                    <li><strong>Blocos de Código com 1-Click Copy:</strong> Trechos de código formatados com crases triplas (<code>```código```</code>) ou crases simples (<code>`snippet`</code>) são renderizados em tipografia monospace com destaque e botão integrado <strong>"Copiar Código"</strong>.</li>
                </ul>

                <h2>Acesso Compartilhado Colaborativo</h2>
                <p>Qualquer usuário com acesso compartilhado ao website tem permissão integral para registrar notas, visualizar a linha do tempo e consultar quem foi o autor de cada anotação técnica.</p>
            </section>

            <!-- 9. Link Público de Visualização para Clientes -->
            <section id="link-publico-clientes" class="doc-section">
                <h1>🔗 Link Público de Visualização de Logs para Clientes</h1>
                <p>O <strong>Link Público</strong> permite que você envie para o seu cliente uma página externa segura e moderna para ele acompanhar todo o histórico de manutenções e intervenções técnicas realizadas no site dele, sem necessidade de criar usuário ou fazer login no SaaS.</p>

                <h2>Características da Visão do Cliente</h2>
                <ul>
                    <li><strong>Identidade Visual Patropi Comunica:</strong> O cabeçalho da visualização pública é minimalista e limpo, contendo exclusivamente a logomarca da Patropi Comunica, garantindo profissionalismo e foco no conteúdo.</li>
                    <li><strong>Modo Estrito de Leitura (Sem Edição):</strong> O cliente pode navegar, pesquisar palavras-chave e filtrar por categoria, mas não possui permissão para editar, excluir ou criar novas notas.</li>
                    <li><strong>Segurança via Token Criptográfico:</strong> O acesso é liberado por meio de um token aleatório de 64 caracteres hexadecimais (<code>public_log_token</code>), sem expor IDs internos do banco de dados.</li>
                    <li><strong>Regeneração Instantânea:</strong> No painel do site, ao clicar em <strong>"Link para Cliente"</strong>, você pode copiar a URL pública ou regenerar o token a qualquer momento caso queira revogar acessos antigos.</li>
                </ul>
            </section>

            <!-- 8. Remediação Híbrida & IA -->
            <section id="remediacao-e-ia" class="doc-section">
                <h1>🤖 Remediação Híbrida & Inteligência Artificial</h1>
                <p>Nem todas as falhas de segurança podem ser corrigidas da mesma forma. Por isso, a plataforma separa as correções em duas categorias distintas:</p>

                <h2>1. Correção via Plugin Customizado (`PLUGIN_AUTO_FIX`)</h2>
                <p>Falhas referentes ao comportamento interno do WordPress (desativar enumeração de autores, ocultar versão, bloquear rotas REST públicas) são agrupadas no botão <strong>"✨ Gerar Soluções em Lote (Plugin WP)"</strong>.</p>
                <p>Ao clicar no botão, a Inteligência Artificial compila um plugin PHP sob medida que pode ser instalado no WordPress com apenas um clique para sanar todas as falhas selecionadas simultaneamente.</p>

                <h2>2. Guia do Servidor & Ações Manuais (`SERVER_CONFIG` / `MANUAL_ACTION`)</h2>
                <p>Falhas que exigem configurações no servidor web (Apache, Nginx), no arquivo <code>php.ini</code> ou edições no <code>wp-config.php</code> são apresentadas no botão <strong>"📙 Guia do Servidor / Ações Manuais"</strong>.</p>

                <div class="callout callout-success">
                    <div class="callout-title">💾 Persistência & Cache do Guia no Banco de Dados</div>
                    <p>Ao abrir o Guia do Servidor pela primeira vez, a IA (Kimi K2.7 Code) gera um passo a passo completo. Esse guia é **salvo automaticamente no banco de dados**, exibindo a etiqueta <code>💾 Guia salvo em: [data/hora]</code>. Nas próximas vezes que você abrir o relatório, o guia carrega **instantaneamente** sem consumo de tokens. Se desejar atualizar as recomendações, basta clicar no botão <code>🔄 Atualizar Instruções (IA)</code>.</p>
                </div>

                <h3>Exemplos de Snippets Gerados pela IA</h3>

                <p><strong>Para Apache (Arquivo <code>.htaccess</code>):</strong></p>
                <div class="code-block">
                    <button class="btn-copy" onclick="copyCode(this)">Copiar</button>
                    <pre># Desativar Listagem de Diretórios
Options -Indexes

# Proteger wp-config.php
&lt;Files wp-config.php&gt;
Order allow,deny
Deny from all
&lt;/Files&gt;</pre>
                </div>

                <p><strong>Para Nginx (Arquivo <code>nginx.conf</code>):</strong></p>
                <div class="code-block">
                    <button class="btn-copy" onclick="copyCode(this)">Copiar</button>
                    <pre># Desativar listagem de diretórios
autoindex off;

# Forçar cabeçalho HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;</pre>
                </div>
            </section>

            <!-- 6. Catálogo de Soluções -->
            <section id="catalogo-de-solucoes" class="doc-section">
                <h1>📚 Catálogo de Soluções (Área Admin)</h1>
                <p>O <strong>Catálogo de Soluções</strong> é a base de conhecimento centralizadora da plataforma, visível para Administradores no menu superior.</p>
                
                <p>Cada teste de auditoria (ex: <code>check_https</code>, <code>check_hsts</code>, <code>check_directory_listing</code>) possui um registro no catálogo contendo:</p>
                <ul>
                    <li><strong>Check ID:</strong> Identificador técnico único do teste.</li>
                    <li><strong>Tipo de Ação:</strong> <code>PLUGIN_AUTO_FIX</code> (Plugin WP), <code>SERVER_CONFIG</code> (Servidor) ou <code>MANUAL_ACTION</code> (Manual).</li>
                    <li><strong>Código PHP / Snippet:</strong> Código exato utilizado para a correção automática.</li>
                    <li><strong>Instruções de Servidor:</strong> Guia descritivo de correção em `.htaccess` ou `nginx.conf`.</li>
                </ul>

                <p>Administradores podem utilizar o botão <strong>"🤖 Gerar Soluções Faltantes com IA"</strong> para preencher automaticamente qualquer código de solução ausente com a IA Kimi K2.7 Code.</p>
            </section>

            <!-- 7. Gestão de Usuários -->
            <section id="gestao-de-usuarios" class="doc-section">
                <h1>👥 Gestão de Usuários & Permissões (RBAC)</h1>
                <p>A plataforma oferece controle de acesso baseado em funções (RBAC - Role-Based Access Control):</p>

                <table class="doc-table">
                    <thead>
                        <tr>
                            <th>Recurso / Permissão</th>
                            <th>Administrador (Admin)</th>
                            <th>Usuário Comum (Cliente)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Cadastrar e Auditar Websites</td>
                            <td>✅ Todos os sites</td>
                            <td>✅ Somente sites próprios</td>
                        </tr>
                        <tr>
                            <td>Gerar Plugins & Guias de Servidor</td>
                            <td>✅ Sim</td>
                            <td>✅ Sim</td>
                        </tr>
                        <tr>
                            <td>Gerenciar Catálogo de Soluções</td>
                            <td>✅ Acesso Total</td>
                            <td>❌ Sem acesso</td>
                        </tr>
                        <tr>
                            <td>Gerenciar Usuários da Plataforma</td>
                            <td>✅ Criar/Editar/Desativar</td>
                            <td>❌ Sem acesso</td>
                        </tr>
                        <tr>
                            <td>Registrar e Consultar Logs de Atividades</td>
                            <td>✅ Todos os sites</td>
                            <td>✅ Sites próprios e compartilhados</td>
                        </tr>
                        <tr>
                            <td>Gerar e Compartilhar Link Público para Clientes</td>
                            <td>✅ Sim</td>
                            <td>✅ Sim (sites autorizados)</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <!-- 8. FAQ -->
            <section id="faq-e-boas-praticas" class="doc-section">
                <h1>❓ Central de Dúvidas, FAQ & Boas Práticas</h1>
                
                <h2>Perguntas Frequentes</h2>

                <h3>1. O plugin de correção gerado por IA pode quebrar meu site?</h3>
                <p>Os plugins gerados aplicam apenas rotinas padrão do WordPress recomendadas pela OWASP. No entanto, é **boa prática indispensável** realizar um backup completo do banco de dados e arquivos antes de ativar qualquer novo plugin ou editar arquivos do servidor.</p>

                <h3>2. O que fazer se a conexão com o Agente WordPress falhar?</h3>
                <p>Verifique se o token de conexão inserido no WordPress corresponde exatamente ao token exibido na plataforma em <code>Websites Alvo > Token</code>. Certifique-se também de que o site cliente possui acesso à internet para responder às chamadas da API REST.</p>

                <h3>3. Por que devo aplicar as alterações do Guia do Servidor manualmente?</h3>
                <p>Arquivos como <code>.htaccess</code> e <code>nginx.conf</code> controlam a infraestrutura do servidor web. Por questões de segurança estrita da hospedagem, aplicações web PHP não devem ter permissão de escrita nesses arquivos críticos do sistema. Por isso, fornecemos o código exato e testado para você colar no cPanel/SSH.</p>

                <div class="callout callout-info" style="margin-top:40px;">
                    <div class="callout-title">💬 Precisa de Ajuda Adicional?</div>
                    <p>Caso tenha dúvidas sobre a interpretação de algum diagnóstico de segurança, consulte a equipe de suporte ou o administrador da sua conta.</p>
                </div>
            </section>

        </main>
    </div>

    <!-- Script Vanilla JS para Busca e Interatividade -->
    <script>
        // Busca Dinâmica em Tempo Real
        document.getElementById('docSearch').addEventListener('input', function (e) {
            const query = e.target.value.toLowerCase().trim();
            const sections = document.querySelectorAll('.doc-section');
            const navLinks = document.querySelectorAll('.nav-item a');

            sections.forEach(sec => {
                const text = sec.innerText.toLowerCase();
                if (text.includes(query) || query === '') {
                    sec.style.display = 'block';
                } else {
                    sec.style.display = 'none';
                }
            });
        });

        // Botão de Copiar Código
        function copyCode(btn) {
            const pre = btn.nextElementSibling;
            navigator.clipboard.writeText(pre.innerText).then(() => {
                const originalText = btn.innerText;
                btn.innerText = 'Copiado!';
                btn.style.background = '#10b981';
                btn.style.color = '#fff';
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.style.background = '#1e293b';
                    btn.style.color = 'var(--text-muted)';
                }, 2000);
            });
        }

        // Active Navigation Highlight on Scroll
        function updateActiveNav() {
            const sections = document.querySelectorAll('.doc-section');
            const navLinks = document.querySelectorAll('.nav-item a');
            const scrollPos = window.scrollY + 140; // Offset for sticky header

            let currentSectionId = '';

            sections.forEach(section => {
                if (section.style.display === 'none') return;
                const top = section.offsetTop;
                const height = section.offsetHeight;
                if (scrollPos >= top && scrollPos < top + height) {
                    currentSectionId = section.getAttribute('id');
                }
            });

            // If scrolled to bottom of page, highlight last visible item
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 40) {
                const visibleSections = Array.from(sections).filter(s => s.style.display !== 'none');
                if (visibleSections.length > 0) {
                    currentSectionId = visibleSections[visibleSections.length - 1].getAttribute('id');
                }
            }

            if (currentSectionId) {
                navLinks.forEach(link => {
                    if (link.getAttribute('href') === '#' + currentSectionId) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                });
            }
        }

        let isScrolling;
        window.addEventListener('scroll', function() {
            window.clearTimeout(isScrolling);
            isScrolling = setTimeout(updateActiveNav, 30);
        });
        window.addEventListener('load', updateActiveNav);

        // Smooth Scroll & Click Active Fix
        document.querySelectorAll('.nav-item a').forEach(link => {
            link.addEventListener('click', function(e) {
                const targetId = this.getAttribute('href');
                if (targetId && targetId.startsWith('#')) {
                    e.preventDefault();
                    const targetEl = document.querySelector(targetId);
                    if (targetEl) {
                        const targetOffset = targetEl.offsetTop - 80;
                        window.scrollTo({
                            top: targetOffset,
                            behavior: 'smooth'
                        });
                        document.querySelectorAll('.nav-item a').forEach(l => l.classList.remove('active'));
                        this.classList.add('active');
                    }
                }
            });
        });
    </script>
</body>
</html>
