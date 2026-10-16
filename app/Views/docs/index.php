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

        /* Badges de Severidade dos Testes */
        .badge-sev {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .badge-sev-critical {
            background: rgba(239, 68, 68, 0.18);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.4);
        }
        .badge-sev-high {
            background: rgba(249, 115, 22, 0.18);
            color: #fb923c;
            border: 1px solid rgba(249, 115, 22, 0.4);
        }
        .badge-sev-medium {
            background: rgba(250, 204, 21, 0.18);
            color: #facc15;
            border: 1px solid rgba(250, 204, 21, 0.4);
        }
        .badge-sev-low {
            background: rgba(56, 189, 248, 0.18);
            color: #38bdf8;
            border: 1px solid rgba(56, 189, 248, 0.4);
        }

        /* Cards de Teste */
        .test-card {
            background: #181818;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 16px;
            transition: all 0.2s ease;
        }
        .test-card:hover {
            border-color: #555555;
            background: #202020;
        }
        .test-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
            flex-wrap: wrap;
        }
        .test-card-title {
            font-size: 1.05rem;
            font-weight: 700;
            color: var(--text-main);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .test-card-code {
            font-family: var(--font-mono);
            font-size: 0.75rem;
            background: #090d16;
            color: #79c1a8;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(121, 193, 168, 0.25);
        }
        .test-card-desc {
            color: #cbd5e1;
            font-size: 0.92rem;
            margin-bottom: 12px;
            line-height: 1.55;
        }
        .test-card-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            padding-top: 10px;
            border-top: 1px dashed var(--border-color);
            font-size: 0.85rem;
        }
        @media (max-width: 768px) {
            .test-card-meta {
                grid-template-columns: 1fr;
            }
        }
        .test-meta-box {
            background: rgba(0, 0, 0, 0.25);
            padding: 10px 14px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .test-meta-title {
            font-weight: 700;
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .test-meta-risk { color: #f87171; }
        .test-meta-fix { color: #34d399; }

        .jump-nav {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 20px 0 28px 0;
            padding: 12px 16px;
            background: #111111;
            border: 1px solid var(--border-color);
            border-radius: 8px;
        }
        .jump-nav-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.82rem;
            font-weight: 600;
            padding: 6px 12px;
            border-radius: 6px;
            background: #222222;
            color: var(--text-main);
            text-decoration: none;
            border: 1px solid var(--border-color);
            transition: all 0.15s ease;
        }
        .jump-nav-btn:hover {
            background: var(--primary);
            color: #fff;
            border-color: var(--primary);
        }

        /* Botão de Copiar Lista para WhatsApp/Word */
        .btn-copy-list {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #236baa;
            color: #ffffff;
            border: 1px solid #1b5385;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
        }
        .btn-copy-list:hover {
            background: #1b5385;
            transform: translateY(-1px);
            box-shadow: 0 4px 10px rgba(35, 107, 170, 0.35);
        }
        .btn-copy-list:active {
            transform: translateY(0);
        }
        .btn-copy-list.copied {
            background: #10b981 !important;
            border-color: #059669 !important;
            color: #ffffff !important;
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

        /* Admin-only visibility */
        .admin-only {
            display: none !important;
        }
        body.is-admin .admin-only {
            display: block !important;
        }
        body.is-admin .nav-group.admin-only {
            display: block !important;
        }
        body.is-admin .nav-item.admin-only {
            display: list-item !important;
        }
        .admin-badge-indicator {
            display: none;
            align-items: center;
            gap: 6px;
            background: rgba(99, 102, 241, 0.15);
            color: #818cf8;
            border: 1px solid rgba(99, 102, 241, 0.35);
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }
        body.is-admin .admin-badge-indicator {
            display: inline-flex !important;
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
            <span id="adminBadgeIndicator" class="admin-badge-indicator">👑 Visão Administrador</span>
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
                    <li class="nav-item" style="margin-left: 10px;"><a href="#testes-resumo" style="font-size: 0.82rem; opacity: 0.85;"><span class="nav-icon">📋</span> Catálogo de Testes</a></li>
                    <li class="nav-item"><a href="#plugin-agente"><span class="nav-icon">🔌</span> Plugin Agente WordPress</a></li>
                    <li class="nav-item"><a href="#integridade-do-core"><span class="nav-icon">🔍</span> Integridade do Core & Auto-Fix</a></li>
                    <li class="nav-item"><a href="#logs-de-atividades"><span class="nav-icon">📝</span> Logs de Atividades & Diário Técnico</a></li>
                    <li class="nav-item"><a href="#link-publico-clientes"><span class="nav-icon">🔗</span> Link Público para Clientes</a></li>
                    <li class="nav-item"><a href="#logs-em-tempo-real"><span class="nav-icon">📜</span> Logs de Execução em Tempo Real</a></li>
                    <li class="nav-item"><a href="#atualizacoes-remotas"><span class="nav-icon">🔄</span> Atualizações Remotas (Plugins/Temas/Core)</a></li>
                    <li class="nav-item"><a href="#remediacao-e-ia"><span class="nav-icon">🤖</span> Remediação & Fixes WP</a></li>
                    <li class="nav-item"><a href="#gestao-plano-cliente"><span class="nav-icon">📦</span> Gestão do Plano & Consumo de IA</a></li>
                </ul>
            </div>

            <div class="nav-group admin-only">
                <div class="nav-title">Administração (Restrito)</div>
                <ul class="nav-list">
                    <li class="nav-item admin-only"><a href="#catalogo-de-solucoes"><span class="nav-icon">📚</span> Catálogo de Soluções</a></li>
                    <li class="nav-item admin-only"><a href="#gestao-de-usuarios"><span class="nav-icon">👥</span> Gestão de Usuários, Planos & Add-ons</a></li>
                    <li class="nav-item admin-only"><a href="#configuracao-planos-ia"><span class="nav-icon">⚙️</span> Catálogo de Planos & Motores de IA</a></li>
                    <li class="nav-item admin-only"><a href="#monitoramento-ia-global"><span class="nav-icon">💰</span> Monitoramento Geral de IA & Custos</a></li>
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
            <section id="auditoria-de-seguranca" class="doc-section">
                <h1>🛡️ Auditoria & Varreduras de Segurança</h1>
                <p>O módulo de auditoria executa varreduras automatizadas e profundas combinando <strong>análise perimetral externa não-invasiva</strong> com <strong>auditoria interna conectada</strong> (via plugin WP Patropi Agent). São mais de <strong>30 checagens automatizadas</strong> cobrindo todo o espectro de segurança do ecossistema WordPress.</p>
                
                <div class="callout callout-info">
                    <div class="callout-title">📋 Por que ter esta lista em mãos?</div>
                    <p>Esta documentação detalha cada um dos testes realizados, o objetivo da checagem, o risco prático caso o site falhe e a forma de remediação recomendada. Utilize este catálogo para responder com autoridade técnica às dúvidas de clientes e prospects.</p>
                </div>

                <!-- Barra de Navegação Rápida entre Categorias -->
                <div class="jump-nav">
                    <a href="#testes-resumo" class="jump-nav-btn">📊 Tabela Resumo</a>
                    <a href="#testes-infra" class="jump-nav-btn">🌐 1. Infraestrutura & Headers (5)</a>
                    <a href="#testes-arquivos" class="jump-nav-btn">📁 2. Arquivos & Diretórios (9)</a>
                    <a href="#testes-enumeracao" class="jump-nav-btn">👤 3. Enumeração & Login (5)</a>
                    <a href="#testes-fingerprint" class="jump-nav-btn">🔍 4. Fingerprinting (2)</a>
                    <a href="#testes-agente" class="jump-nav-btn">🔌 5. Agente Interno (9)</a>
                    <a href="#testes-integridade" class="jump-nav-btn">💎 6. Integridade do Core (1)</a>
                </div>

                <!-- Tabela Resumo Rápida -->
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin: 32px 0 10px 0; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">
                    <h2 id="testes-resumo" style="margin: 0; border-bottom: none; padding-bottom: 0;">📊 Relação Completa dos Testes de Segurança</h2>
                    <button type="button" class="btn-copy-list" id="btnCopyTestsList" onclick="copyTestsListWhatsApp(this)" title="Copiar checklist formatado em lista para colar no WhatsApp, Word ou Relatórios">
                        <span class="btn-copy-icon">📋</span>
                        <span class="btn-copy-text">Copiar Lista para WhatsApp / Word</span>
                    </button>
                </div>
                <p>Visão geral de todos os testes executados pela plataforma durante uma auditoria completa. Você pode consultar os detalhes abaixo ou copiar o checklist em formato de lista pelo botão acima:</p>

                <table class="doc-table">
                    <thead>
                        <tr>
                            <th>Teste</th>
                            <th>Identificador</th>
                            <th>Categoria</th>
                            <th>Severidade</th>
                            <th>Alvo Principal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Uso de HTTPS / SSL</strong></td>
                            <td><code>https_enforced</code></td>
                            <td>Infraestrutura</td>
                            <td><span class="badge-sev badge-sev-medium">Média</span></td>
                            <td>Tráfego criptografado</td>
                        </tr>
                        <tr>
                            <td><strong>Strict-Transport-Security (HSTS)</strong></td>
                            <td><code>header_strict_transport_security</code></td>
                            <td>Infraestrutura</td>
                            <td><span class="badge-sev badge-sev-medium">Média</span></td>
                            <td>Anti SSL-Striping</td>
                        </tr>
                        <tr>
                            <td><strong>X-Frame-Options (Anti-Clickjacking)</strong></td>
                            <td><code>header_x_frame_options</code></td>
                            <td>Infraestrutura</td>
                            <td><span class="badge-sev badge-sev-medium">Média</span></td>
                            <td>Bloqueio de iframes maliciosos</td>
                        </tr>
                        <tr>
                            <td><strong>X-Content-Type-Options (MIME Sniffing)</strong></td>
                            <td><code>header_x_content_type_options</code></td>
                            <td>Infraestrutura</td>
                            <td><span class="badge-sev badge-sev-low">Baixa</span></td>
                            <td>Execução de arquivos estáticos</td>
                        </tr>
                        <tr>
                            <td><strong>Content-Security-Policy (CSP)</strong></td>
                            <td><code>header_content_security_policy</code></td>
                            <td>Infraestrutura</td>
                            <td><span class="badge-sev badge-sev-high">Alta</span></td>
                            <td>Mitigação de XSS e injeção de scripts</td>
                        </tr>
                        <tr>
                            <td><strong>Listagem de Diretórios em Uploads</strong></td>
                            <td><code>dir_listing_uploads</code></td>
                            <td>Arquivos & Diretórios</td>
                            <td><span class="badge-sev badge-sev-high">Alta</span></td>
                            <td><code>/wp-content/uploads/</code></td>
                        </tr>
                        <tr>
                            <td><strong>Listagem de Diretórios no Core</strong></td>
                            <td><code>dir_listing_includes</code></td>
                            <td>Arquivos & Diretórios</td>
                            <td><span class="badge-sev badge-sev-high">Alta</span></td>
                            <td><code>/wp-includes/</code></td>
                        </tr>
                        <tr>
                            <td><strong>Backup de Configuração wp-config.php.bak</strong></td>
                            <td><code>file_wp_config_php_bak</code></td>
                            <td>Arquivos & Diretórios</td>
                            <td><span class="badge-sev badge-sev-critical">Crítica</span></td>
                            <td>Senha do Banco MySQL / Salts</td>
                        </tr>
                        <tr>
                            <td><strong>Cópia de Configuração wp-config.txt</strong></td>
                            <td><code>file_wp_config_txt</code></td>
                            <td>Arquivos & Diretórios</td>
                            <td><span class="badge-sev badge-sev-critical">Crítica</span></td>
                            <td>Senha do Banco MySQL / Salts</td>
                        </tr>
                        <tr>
                            <td><strong>Arquivo de Ambiente .env</strong></td>
                            <td><code>file_env</code></td>
                            <td>Arquivos & Diretórios</td>
                            <td><span class="badge-sev badge-sev-critical">Crítica</span></td>
                            <td>Tokens de API, senhas e SMTP</td>
                        </tr>
                        <tr>
                            <td><strong>Log de Depuração debug.log</strong></td>
                            <td><code>file_wp_content_debug_log</code></td>
                            <td>Arquivos & Diretórios</td>
                            <td><span class="badge-sev badge-sev-high">Alta</span></td>
                            <td><code>/wp-content/debug.log</code></td>
                        </tr>
                        <tr>
                            <td><strong>Log de Erros error_log</strong></td>
                            <td><code>file_wp_content_error_log</code></td>
                            <td>Arquivos & Diretórios</td>
                            <td><span class="badge-sev badge-sev-high">Alta</span></td>
                            <td><code>/wp-content/error_log</code></td>
                        </tr>
                        <tr>
                            <td><strong>Documentação Padrão readme.html</strong></td>
                            <td><code>info_readme_html</code></td>
                            <td>Arquivos & Diretórios</td>
                            <td><span class="badge-sev badge-sev-low">Baixa</span></td>
                            <td>Vazamento de versão instalada</td>
                        </tr>
                        <tr>
                            <td><strong>Arquivo de Licença license.txt</strong></td>
                            <td><code>info_license_txt</code></td>
                            <td>Arquivos & Diretórios</td>
                            <td><span class="badge-sev badge-sev-low">Baixa</span></td>
                            <td>Identificação de instalação padrão</td>
                        </tr>
                        <tr>
                            <td><strong>Enumeração de Usuários na REST API</strong></td>
                            <td><code>enum_wp_json_users</code></td>
                            <td>Enumeração & Login</td>
                            <td><span class="badge-sev badge-sev-high">Alta</span></td>
                            <td><code>/wp-json/wp/v2/users</code></td>
                        </tr>
                        <tr>
                            <td><strong>Enumeração via Query Author</strong></td>
                            <td><code>enum_author_query</code></td>
                            <td>Enumeração & Login</td>
                            <td><span class="badge-sev badge-sev-medium">Média</span></td>
                            <td><code>/?author=1</code> (Redirecionamento)</td>
                        </tr>
                        <tr>
                            <td><strong>Enumeração via Sitemap XML de Autores</strong></td>
                            <td><code>enum_sitemap_users</code></td>
                            <td>Enumeração & Login</td>
                            <td><span class="badge-sev badge-sev-high">Alta</span></td>
                            <td>Yoast, Rank Math e Nativo</td>
                        </tr>
                        <tr>
                            <td><strong>Interface Remota XML-RPC</strong></td>
                            <td><code>xmlrpc_enabled</code></td>
                            <td>Enumeração & Login</td>
                            <td><span class="badge-sev badge-sev-high">Alta</span></td>
                            <td><code>/xmlrpc.php</code> (Brute Force / DDoS)</td>
                        </tr>
                        <tr>
                            <td><strong>Página de Login Padrão Exposta</strong></td>
                            <td><code>wp_login_exposed</code></td>
                            <td>Enumeração & Login</td>
                            <td><span class="badge-sev badge-sev-low">Baixa</span></td>
                            <td><code>/wp-login.php</code></td>
                        </tr>
                        <tr>
                            <td><strong>Versão do WordPress em Meta Tag Generator</strong></td>
                            <td><code>fingerprint_wp_version_meta</code></td>
                            <td>Fingerprinting</td>
                            <td><span class="badge-sev badge-sev-medium">Média</span></td>
                            <td>Tag HTML <code>meta name="generator"</code></td>
                        </tr>
                        <tr>
                            <td><strong>Enumeração e Versões de Plugins</strong></td>
                            <td><code>fingerprint_plugins_detected</code></td>
                            <td>Fingerprinting</td>
                            <td><span class="badge-sev badge-sev-low">Baixa</span></td>
                            <td>Parâmetros <code>?ver=</code> e <code>readme.txt</code></td>
                        </tr>
                        <tr>
                            <td><strong>Atualizações Pendentes (Core/Plugins/Temas)</strong></td>
                            <td><code>agent_pending_updates</code></td>
                            <td>Agente Interno</td>
                            <td><span class="badge-sev badge-sev-high">Alta</span></td>
                            <td>Patches e CVEs conhecidas</td>
                        </tr>
                        <tr>
                            <td><strong>Plugins Inativos Abandonados</strong></td>
                            <td><code>agent_inactive_plugins</code></td>
                            <td>Agente Interno</td>
                            <td><span class="badge-sev badge-sev-low">Baixa</span></td>
                            <td>Código inativo no disco do servidor</td>
                        </tr>
                        <tr>
                            <td><strong>Conta de Administrador Padrão ("admin")</strong></td>
                            <td><code>agent_default_admin</code></td>
                            <td>Agente Interno</td>
                            <td><span class="badge-sev badge-sev-critical">Crítica</span></td>
                            <td>Alvo primário de ataques de força bruta</td>
                        </tr>
                        <tr>
                            <td><strong>Quantidade Excessiva de Administradores</strong></td>
                            <td><code>agent_total_admins</code></td>
                            <td>Agente Interno</td>
                            <td><span class="badge-sev badge-sev-low">Baixa</span></td>
                            <td>Princípio do Menor Privilégio</td>
                        </tr>
                        <tr>
                            <td><strong>Modo de Depuração em Produção (WP_DEBUG)</strong></td>
                            <td><code>agent_wp_debug</code></td>
                            <td>Agente Interno</td>
                            <td><span class="badge-sev badge-sev-high">Alta</span></td>
                            <td>Vazamento de queries e stacktraces</td>
                        </tr>
                        <tr>
                            <td><strong>Editor de Arquivos no WP-Admin</strong></td>
                            <td><code>agent_disallow_file_edit</code></td>
                            <td>Agente Interno</td>
                            <td><span class="badge-sev badge-sev-medium">Média</span></td>
                            <td>Injeção de Web Shell via painel</td>
                        </tr>
                        <tr>
                            <td><strong>Prefixo Padrão das Tabelas MySQL (wp_)</strong></td>
                            <td><code>agent_db_prefix</code></td>
                            <td>Agente Interno</td>
                            <td><span class="badge-sev badge-sev-low">Baixa</span></td>
                            <td>Ataques cegos de SQL Injection</td>
                        </tr>
                        <tr>
                            <td><strong>Cadastro de Usuários Aberto ao Público</strong></td>
                            <td><code>agent_user_registration</code></td>
                            <td>Agente Interno</td>
                            <td><span class="badge-sev badge-sev-medium">Média</span></td>
                            <td>Criação de contas não autorizadas</td>
                        </tr>
                        <tr>
                            <td><strong>Moderação Obrigatória de Comentários</strong></td>
                            <td><code>agent_comments_moderation</code></td>
                            <td>Agente Interno</td>
                            <td><span class="badge-sev badge-sev-high">Alta</span></td>
                            <td>Spam automatizado e links maliciosos</td>
                        </tr>
                        <tr>
                            <td><strong>Integridade Criptográfica do Core WordPress</strong></td>
                            <td><code>core_checksums</code></td>
                            <td>Integridade</td>
                            <td><span class="badge-sev badge-sev-critical">Crítica</span></td>
                            <td>Hashes MD5 oficiais WordPress.org</td>
                        </tr>
                    </tbody>
                </table>

                <!-- 1. Infraestrutura & Cabeçalhos HTTP -->
                <h2 id="testes-infra">🌐 1. Infraestrutura & Cabeçalhos HTTP</h2>
                <p>Verificações executadas na camada de transporte HTTP/HTTPS e cabeçalhos de segurança enviados pelo servidor web (Apache, Nginx, LiteSpeed, Cloudflare).</p>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🔒</span> Uso de HTTPS / SSL
                            <span class="test-card-code">https_enforced</span>
                        </div>
                        <span class="badge-sev badge-sev-medium">Severidade Média</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Avalia se a aplicação web utiliza estritamente o protocolo criptografado HTTPS e se as conexões em HTTP puro são redirecionadas com segurança para HTTPS.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Conexões HTTP sem criptografia trafegam dados em texto plano. Qualquer atacante na mesma rede (Wi-Fi pública, provedores intermediários) pode interceptar senhas, cookies de sessão e dados de formulários (Man-in-the-Middle). Além disso, o Google marca o site como "Não Seguro" e penaliza no ranking.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Instalar um certificado SSL válido (Let's Encrypt gratuito ou comercial) e configurar o redirecionamento 301 de todo o tráfego HTTP para HTTPS nas configurações gerais do WordPress ou no <code>.htaccess</code> / Nginx.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🛡️</span> Strict-Transport-Security (HSTS)
                            <span class="test-card-code">header_strict_transport_security</span>
                        </div>
                        <span class="badge-sev badge-sev-medium">Severidade Média</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Checa se o servidor envia o cabeçalho <code>Strict-Transport-Security</code> com parâmetros de tempo e subdomínios (ex: <code>max-age=31536000; includeSubDomains; preload</code>).
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Sem o HSTS, na primeira requisição do visitante para o domínio ainda pode ocorrer um ataque de <em>SSL Striping</em> (onde o atacante intercepta a conexão antes do redirecionamento e rebaixa silenciosamente a comunicação para HTTP desprotegido).
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Pode ser ativado com <strong>1 clique pelo Plugin WP Patropi Fixes</strong> (toggle "Strict-Transport-Security") ou adicionando a diretiva de cabeçalho no <code>.htaccess</code> conforme indicado no Guia do Servidor.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🖼️</span> X-Frame-Options (Anti-Clickjacking)
                            <span class="test-card-code">header_x_frame_options</span>
                        </div>
                        <span class="badge-sev badge-sev-medium">Severidade Média</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Verifica se as respostas HTTP contêm a diretiva <code>X-Frame-Options: SAMEORIGIN</code> ou <code>DENY</code>.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Vulnerabilidade a ataques de <em>Clickjacking</em>: invasores criam uma página maliciosa e carregam o site da sua empresa dentro de um <code>&lt;iframe&gt;</code> invisível ou transparente sobreposto a botões chamativos. O usuário acredita estar clicando em um jogo ou vídeo, mas está efetuando compras, alterando permissões ou clicando em links restritos do seu painel.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Inserir <code>Header always append X-Frame-Options SAMEORIGIN</code> no arquivo <code>.htaccess</code> ou <code>add_header X-Frame-Options "SAMEORIGIN";</code> na configuração do Nginx.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>📄</span> X-Content-Type-Options (Anti MIME Sniffing)
                            <span class="test-card-code">header_x_content_type_options</span>
                        </div>
                        <span class="badge-sev badge-sev-low">Severidade Baixa</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Confirma se o cabeçalho <code>X-Content-Type-Options: nosniff</code> é enviado para impedir que navegadores ignorem o tipo MIME declarado nos arquivos.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Sem este cabeçalho, alguns navegadores tentam adivinhar o formato do conteúdo. Isso abre brecha para ataques onde um invasor faz upload de uma imagem ou arquivo de texto com código JavaScript malicioso embutido, e o navegador o executa como script (Cross-Site Scripting).
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Adicionar a linha <code>Header set X-Content-Type-Options "nosniff"</code> no arquivo <code>.htaccess</code> do Apache ou equivalente no Nginx.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>📜</span> Content-Security-Policy (CSP)
                            <span class="test-card-code">header_content_security_policy</span>
                        </div>
                        <span class="badge-sev badge-sev-high">Severidade Alta</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Avalia a existência e a parametrização do cabeçalho <code>Content-Security-Policy</code> que restringe quais domínios podem carregar scripts, fontes, mídias e conexões no site.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            É a principal barreira contra ataques de XSS (Cross-Site Scripting). Sem uma política CSP definida, qualquer script injetado indevidamente por um plugin vulnerável ou anúncio de terceiros pode ler senhas digitadas, capturar dados de cartão de crédito e roubar cookies de sessão.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Declarar diretivas CSP no servidor ou via plugin de segurança especificando as fontes legítimas de assets (ex: Google Fonts, Analytics, YouTube).
                        </div>
                    </div>
                </div>

                <!-- 2. Exposição de Arquivos & Diretórios -->
                <h2 id="testes-arquivos">📁 2. Exposição de Arquivos & Diretórios Sensíveis</h2>
                <p>O scanner realiza requisições HTTP a caminhos críticos de arquivos de configuração, logs e diretórios para checar se informações confidenciais estão acessíveis sem autenticação.</p>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>📂</span> Listagem de Diretório em Uploads
                            <span class="test-card-code">dir_listing_uploads</span>
                        </div>
                        <span class="badge-sev badge-sev-high">Severidade Alta</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Testa se ao acessar <code>/wp-content/uploads/</code> o servidor web lista publicamente todos os arquivos em tela (Index of /wp-content/uploads).
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Invasores e robôs conseguem navegar em todas as pastas de ano e mês, baixando listas completas de mídias, faturas em PDF, notas fiscais, contratos enviados por clientes através de formulários e documentos privados esquecidos.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Desativar a listagem adicionando a diretiva <code>Options -Indexes</code> no arquivo <code>.htaccess</code> na raiz do site, ou <code>autoindex off;</code> no Nginx.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>📂</span> Listagem de Diretório no Core (/wp-includes/)
                            <span class="test-card-code">dir_listing_includes</span>
                        </div>
                        <span class="badge-sev badge-sev-high">Severidade Alta</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Testa se o diretório interno <code>/wp-includes/</code> permite a navegação direta de seus arquivos e bibliotecas pelo navegador.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Facilita a raspagem automatizada para identificar versões exatas de scripts de terceiros integrados ao core, arquivos obsoletos e estruturas internas de código.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Garantir que <code>Options -Indexes</code> esteja ativo globalmente e criar um arquivo <code>index.php</code> vazio ou regra de bloqueio em <code>/wp-includes/</code>.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🚨</span> Backup de Configuração: wp-config.php.bak
                            <span class="test-card-code">file_wp_config_php_bak</span>
                        </div>
                        <span class="badge-sev badge-sev-critical">Severidade Crítica</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Checa se cópias de backup como <code>wp-config.php.bak</code>, <code>wp-config.php.old</code> ou similares foram deixadas na raiz pública do servidor.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            O servidor web só executa arquivos com extensão <code>.php</code>. Arquivos com extensão <code>.bak</code> são servidos como download direto de texto puro! Qualquer visitante pode baixar o arquivo e ler o usuário, senha e endereço do Banco de Dados MySQL, além das chaves de criptografia (salts). O comprometimento do site é instantâneo.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Excluir imediatamente o arquivo do servidor via FTP/Gerenciador de Arquivos e adicionar regras no <code>.htaccess</code> bloqueando extensões <code>.bak</code>, <code>.old</code> e <code>.save</code>.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🚨</span> Cópia de Configuração em Texto: wp-config.txt
                            <span class="test-card-code">file_wp_config_txt</span>
                        </div>
                        <span class="badge-sev badge-sev-critical">Severidade Crítica</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Verifica se arquivos de configuração foram renomeados para <code>wp-config.txt</code> durante testes ou migrações.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            O arquivo abre diretamente na tela do navegador, entregando as credenciais de conexão do MySQL para qualquer curioso ou bot de varredura.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Remover o arquivo da pasta pública e nunca manter arquivos de texto contendo credenciais na pasta web.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🚨</span> Arquivo de Variáveis de Ambiente: /.env
                            <span class="test-card-code">file_env</span>
                        </div>
                        <span class="badge-sev badge-sev-critical">Severidade Crítica</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Tenta requisitar o arquivo <code>/.env</code> na raiz do domínio.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            O arquivo <code>.env</code> armazena segredos de alto impacto: chaves privadas de APIs de pagamento (Stripe, Pagar.me, Mercado Pago), credenciais de e-mail SMTP, tokens de autenticação AWS/Google Cloud e senhas de banco de dados.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Bloquear acesso a qualquer arquivo oculto (que inicie por ponto <code>.*</code>) no servidor web e manter o arquivo <code>.env</code> um nível acima da raiz pública (fora de <code>public_html</code>).
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>⚠️</span> Log de Depuração Aberto: /wp-content/debug.log
                            <span class="test-card-code">file_wp_content_debug_log</span>
                        </div>
                        <span class="badge-sev badge-sev-high">Severidade Alta</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Avalia se o arquivo <code>debug.log</code> nativo de desenvolvimento do WordPress está acessível diretamente via navegador.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            O log de erros contém caminhos físicos absolutos no servidor (ex: <code>/home/usuario/public_html/...</code>), queries com erro, stacktraces de funções, parâmetros recebidos em requisições de formulários e até mesmo tokens vazados.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Adicionar regra de negação para <code>*.log</code> no <code>.htaccess</code> ou mover o arquivo de log para um diretório seguro com permissões restritas.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>⚠️</span> Log de Erros do Servidor: /wp-content/error_log
                            <span class="test-card-code">file_wp_content_error_log</span>
                        </div>
                        <span class="badge-sev badge-sev-high">Severidade Alta</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Verifica a presença de arquivos <code>error_log</code> gerados automaticamente pelo cPanel ou Apache dentro de subpastas do WordPress.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Vazamento de detalhes de infraestrutura, versão de módulos do Apache e falhas de compatibilidade do PHP que auxiliam cibercriminosos a planejar ataques direcionados.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Limpar os arquivos de log antigos e incluir regra bloqueando o acesso a arquivos chamados <code>error_log</code> no arquivo <code>.htaccess</code>.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>ℹ️</span> Documentação Padrão: /readme.html
                            <span class="test-card-code">info_readme_html</span>
                        </div>
                        <span class="badge-sev badge-sev-low">Severidade Baixa</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Confirma se o arquivo <code>readme.html</code> que vem no pacote padrão do WordPress permanece publicado na raiz.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            O arquivo exibe com clareza o número da versão do WordPress em que o site foi criado, auxiliando robôs de varredura a catalogar o site como desatualizado.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Excluir o arquivo <code>readme.html</code> da pasta raiz da instalação.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>ℹ️</span> Arquivo de Licença: /license.txt
                            <span class="test-card-code">info_license_txt</span>
                        </div>
                        <span class="badge-sev badge-sev-low">Severidade Baixa</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Checa a presença do arquivo <code>license.txt</code> na raiz pública.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Facilita a identificação de instalações padrão do WordPress por ferramentas de reconhecimento automatizado.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Excluir ou bloquear o acesso público ao arquivo <code>license.txt</code>.
                        </div>
                    </div>
                </div>

                <!-- 3. Enumeração & Login -->
                <h2 id="testes-enumeracao">👤 3. Enumeração de Usuários & Interfaces de Ataque</h2>
                <p>Testes que analisam portas de entrada para ataques de força bruta, tentativas de adivinhação de senhas e vazamento de contas de administradores.</p>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>👥</span> Enumeração de Usuários via WP REST API
                            <span class="test-card-code">enum_wp_json_users</span>
                        </div>
                        <span class="badge-sev badge-sev-high">Severidade Alta</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Requisita o endpoint <code>/wp-json/wp/v2/users</code> para analisar se o WordPress entrega um JSON público contendo a lista com os usernames (slugs) de todos os autores e administradores do site.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Em qualquer ataque de força bruta, o invasor precisa descobrir dois dados: usuário e senha. Se o endpoint REST vaza a lista de logins exatos, a barreira defensiva é cortada pela metade, bastando ao atacante focar em quebrar a senha das contas encontradas.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Ativar a proteção com <strong>1 clique no Plugin WP Patropi Fixes</strong> (toggle "Enumeração de Usuários via REST API"), que restringe a listagem de usuários apenas para chamadas autenticadas retornando HTTP 401.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🔗</span> Enumeração via Query Author (/?author=1)
                            <span class="test-card-code">enum_author_query</span>
                        </div>
                        <span class="badge-sev badge-sev-medium">Severidade Média</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Envia uma requisição para <code>/?author=1</code> (e IDs subsequentes). O teste verifica se o WordPress redireciona o visitante para a URL amigável de arquivo do autor (ex: <code>/author/joaosilva/</code>), revelando o login da conta de ID 1 (quase sempre o administrador principal), ou se redireciona com segurança para a Home (<code>/</code>).
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            É o vetor clássico utilizado por ferramentas de escaneamento ofensivo (como WPScan) para catalogar os nomes de usuário administradores de qualquer site WordPress em segundos.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Habilitar o Fix de 1 clique no <strong>Plugin WP Patropi Fixes</strong> (toggle "Redirecionamento de Consultas de Autor"), que intercepta qualquer requisição por <code>?author=N</code> e a redireciona com HTTP 301 para a página inicial (<code>/</code>).
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🗺️</span> Enumeração via Sitemap XML (Yoast / Rank Math / Nativo)
                            <span class="test-card-code">enum_sitemap_users</span>
                        </div>
                        <span class="badge-sev badge-sev-high">Severidade Alta</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Analisa URLs de mapas de site como <code>/wp-sitemap-users-1.xml</code> (nativo), <code>/author-sitemap.xml</code> (Yoast SEO) e <code>/user-sitemap.xml</code> (Rank Math). Caso a URL redirecione (301/302), o scanner segue o redirecionamento para checar se uma lista de URLs de autores contendo seus logins é gerada para o Google.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Faz com que os logins de administradores sejam indexados nos motores de busca e expostos em uma listagem XML pública e estruturada, servindo de alvo fácil para bots de força bruta.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Ativar o toggle correspondente no <strong>Plugin WP Patropi Fixes</strong>, que desativa os provedores de autores nos plugins Yoast SEO, Rank Math e no core do WordPress, bloqueando essas rotas com status HTTP 404.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>⚡</span> Interface Remota XML-RPC (xmlrpc.php)
                            <span class="test-card-code">xmlrpc_enabled</span>
                        </div>
                        <span class="badge-sev badge-sev-high">Severidade Alta</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Envia uma requisição HTTP POST contendo uma chamada XML (<code>system.listMethods</code>) para o arquivo <code>/xmlrpc.php</code> para checar se a interface legado está ativa e processando métodos.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            O XML-RPC suporta a chamada <code>system.multicall</code>, permitindo que atacantes testem <strong>centenas de senhas em uma única requisição HTTP</strong>, contornando a maioria dos plugins de limite de tentativas de login. Além disso, a função de pingback do XML-RPC é usada para amplificação em ataques de negação de serviço (DDoS).
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Desativar com 1 clique no <strong>Plugin WP Patropi Fixes</strong> (toggle "Desativação Completa do XML-RPC") ou bloquear requisições para <code>xmlrpc.php</code> retornando HTTP 403 Forbidden no <code>.htaccess</code> / Nginx.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🚪</span> Página de Login Padrão Exposta (/wp-login.php)
                            <span class="test-card-code">wp_login_exposed</span>
                        </div>
                        <span class="badge-sev badge-sev-low">Severidade Baixa</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Verifica se o formulário de login clássico do WordPress está acessível diretamente no endereço padrão <code>/wp-login.php</code>.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            É a URL visada 24 horas por dia por redes de bots na internet que executam ataques de força bruta com listas de credenciais vazadas (Credential Stuffing).
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Alterar a URL de login (ex: <code>/painel-seguro/</code>) através de plugins especializados (como WPS Hide Login) e ativar autenticação em dois fatores (2FA) ou Cloudflare Turnstile.
                        </div>
                    </div>
                </div>

                <!-- 4. Fingerprinting -->
                <h2 id="testes-fingerprint">🔍 4. Fingerprinting & Detecção de Componentes</h2>
                <p>Mapeia o nível de exposição de versões de tecnologias e plugins que permitem que atacantes encontrem falhas conhecidas (CVEs).</p>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🏷️</span> Versão do WordPress em Meta Tag Generator
                            <span class="test-card-code">fingerprint_wp_version_meta</span>
                        </div>
                        <span class="badge-sev badge-sev-medium">Severidade Média</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Inspeciona o código HTML da página inicial em busca da tag <code>&lt;meta name="generator" content="WordPress X.Y.Z"&gt;</code>.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Vaza a versão exata do CMS. Se o WordPress estiver uma versão atrás, atacantes consultam bancos de vulnerabilidades públicos e disparam exploits direcionados especificamente para aquela versão.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Habilitar a proteção no <strong>Plugin WP Patropi Fixes</strong> (toggle "Ocultar Versões e Proteger Readme") para remover a ação <code>wp_generator</code> do cabeçalho HTML.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🧩</span> Enumeração e Versões de Plugins (Assets & Readme)
                            <span class="test-card-code">fingerprint_plugins_detected</span>
                        </div>
                        <span class="badge-sev badge-sev-low">Severidade Baixa</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Analisa tags <code>&lt;script&gt;</code> e <code>&lt;link&gt;</code> em busca do parâmetro <code>?ver=X.Y.Z</code> e tenta consultar arquivos de documentação pública <code>/wp-content/plugins/{slug}/readme.txt</code>.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Expõe para qualquer pessoa a lista dos plugins em funcionamento no site e suas versões exatas, facilitando a identificação de extensões desatualizadas com falhas de segurança conhecidas.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Ativar no <strong>Plugin WP Patropi Fixes</strong> o toggle correspondente, que remove os argumentos <code>?ver=</code> de scripts/estilos e bloqueia o acesso a arquivos <code>readme.txt</code> e <code>license.txt</code> dos plugins.
                        </div>
                    </div>
                </div>

                <!-- 5. Agente Interno -->
                <h2 id="testes-agente">🔌 5. Auditoria Interna do Agente WordPress</h2>
                <p>Testes de alta precisão executados a partir do banco de dados e arquivos internos do WordPress através da ponte criptografada com o plugin <strong>WP Patropi Agent</strong>.</p>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🔄</span> Atualizações Pendentes de Core, Plugins e Temas
                            <span class="test-card-code">agent_pending_updates</span>
                        </div>
                        <span class="badge-sev badge-sev-high">Severidade Alta</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Consulta a API de atualizações do WordPress para quantificar quantas pendências de atualização existem no core, plugins e temas.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Mais de 80% das invasões a sites WordPress ocorrem devido a plugins ou temas desatualizados que contêm vulnerabilidades já conhecidas publicamente com correções disponíveis.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Executar as atualizações pendentes diretamente pelo painel do SaaS (seção <strong>Atualizações Remotas</strong>) com backup prévio ou via painel do WordPress.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🗑️</span> Plugins Inativos Abandonados no Servidor
                            <span class="test-card-code">agent_inactive_plugins</span>
                        </div>
                        <span class="badge-sev badge-sev-low">Severidade Baixa</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Identifica a quantidade de plugins desativados que permanecem instalados no disco do servidor.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Plugins inativos não agregam nenhum benefício, mas seus arquivos PHP continuam no disco. Em caso de vulnerabilidades com execução direta de arquivos, eles podem ser explorados por atacantes mesmo com o plugin desativado.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Excluir definitivamente os plugins inativos através da listagem de plugins do WordPress ou pelo painel do SaaS.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🚨</span> Conta de Administrador Padrão ("admin")
                            <span class="test-card-code">agent_default_admin</span>
                        </div>
                        <span class="badge-sev badge-sev-critical">Severidade Crítica</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Checa se existe alguma conta de usuário ativa registrada exatamente com o login <code>admin</code>.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            O login <code>admin</code> é a primeira opção testada em ataques automatizados de força bruta e dicionário. Manter essa conta ativa multiplica exponencialmente as chances de sucesso de invasores.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Criar um novo usuário administrador com um nome personalizado e senha forte, reatribuir todos os posts e páginas existentes para essa nova conta e em seguida excluir a conta <code>admin</code>.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>👑</span> Quantidade Excessiva de Administradores
                            <span class="test-card-code">agent_total_admins</span>
                        </div>
                        <span class="badge-sev badge-sev-low">Severidade Baixa</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Analisa quantas contas ativas possuem o perfil de Administrador (gera alerta caso existam mais de 3).
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Princípio do Menor Privilégio: cada conta de administrador é uma chave mestra para o site inteiro. Se o e-mail ou computador de qualquer um desses administradores for infectado, toda a aplicação está em risco.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Rebaixar contas que apenas criam artigos para o perfil de <strong>Editor</strong> ou <strong>Autor</strong>, mantendo o privilégio de Administrador apenas para quem gerencia a infraestrutura.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🐞</span> Modo de Depuração em Produção (WP_DEBUG)
                            <span class="test-card-code">agent_wp_debug</span>
                        </div>
                        <span class="badge-sev badge-sev-high">Severidade Alta (Display) / Baixa</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Verifica as constantes <code>WP_DEBUG</code> e <code>WP_DEBUG_DISPLAY</code> no arquivo <code>wp-config.php</code>.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Quando o <code>WP_DEBUG_DISPLAY</code> está ativo, qualquer erro de PHP imprime consultas ao banco de dados, nomes de tabelas, nomes de variáveis e caminhos absolutos do servidor na tela para qualquer visitante.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Garantir que <code>define('WP_DEBUG', false);</code> e <code>define('WP_DEBUG_DISPLAY', false);</code> estejam definidos no <code>wp-config.php</code> em ambientes de produção.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>✏️</span> Editor de Arquivos no WP-Admin (DISALLOW_FILE_EDIT)
                            <span class="test-card-code">agent_disallow_file_edit</span>
                        </div>
                        <span class="badge-sev badge-sev-medium">Severidade Média</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Avalia se o editor de código PHP embutido no painel administrativo do WordPress está ativado ou desativado.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Se um administrador tiver a senha roubada, o editor de arquivos permite ao invasor editar arquivos como <code>functions.php</code> ou plugins diretamente no navegador, injetando uma Web Shell (código malicioso) para tomar controle definitivo do servidor.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Adicionar a linha <code>define('DISALLOW_FILE_EDIT', true);</code> no arquivo <code>wp-config.php</code>.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🗄️</span> Prefixo Padrão das Tabelas MySQL (wp_)
                            <span class="test-card-code">agent_db_prefix</span>
                        </div>
                        <span class="badge-sev badge-sev-low">Severidade Baixa</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Confirma se o banco de dados do WordPress utiliza o prefixo de tabela padrão <code>wp_</code>.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Muitos ataques automatizados de SQL Injection tentam adivinhar nomes de tabelas como <code>wp_users</code> e <code>wp_posts</code>. Um prefixo customizado adiciona uma camada adicional de dificuldade para ataques automatizados.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Em novas instalações, definir um prefixo único (ex: <code>patr9_</code>). Em sites existentes, alterar via plugin de segurança homologado com backup completo prévio do banco.
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>📝</span> Cadastro de Usuários Aberto ao Público
                            <span class="test-card-code">agent_user_registration</span>
                        </div>
                        <span class="badge-sev badge-sev-medium">Severidade Média</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Checa a opção <code>users_can_register</code> nas configurações do WordPress.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Em sites institucionais ou blogs que não possuem área de membros, manter o cadastro público aberto atrai a criação em massa de contas fantasmas por robôs de spam e expõe o site a falhas de escalonamento de privilégio.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Acessar <code>Configurações > Geral</code> no painel do WordPress e desmarcar a opção "Qualquer pessoa pode se registrar".
                        </div>
                    </div>
                </div>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>💬</span> Moderação Obrigatória de Comentários
                            <span class="test-card-code">agent_comments_moderation</span>
                        </div>
                        <span class="badge-sev badge-sev-high">Severidade Alta</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> Avalia se os comentários do site são publicados de forma automática sem a aprovação manual de um administrador/moderador.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Comentários livres são usados por redes de spam automatizado para disseminar links de cassinos, produtos ilegais e páginas de phishing, danificando gravemente a autoridade do site no Google e expondo os visitantes a vírus.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            Acessar <code>Configurações > Discussão</code> no painel do WordPress e marcar a opção "O comentário deve ser aprovado manualmente".
                        </div>
                    </div>
                </div>

                <!-- 6. Integridade do Core -->
                <h2 id="testes-integridade">💎 6. Integridade Criptográfica dos Arquivos do Core</h2>
                <p>Auditoria profunda de arquivos do sistema que detecta malwares injetados, backdoors e adulterações no código original do WordPress.</p>

                <div class="test-card">
                    <div class="test-card-header">
                        <div class="test-card-title">
                            <span>🔍</span> Verificação Criptográfica de Checksums Oficiais
                            <span class="test-card-code">core_checksums</span>
                        </div>
                        <span class="badge-sev badge-sev-critical">Severidade Crítica</span>
                    </div>
                    <div class="test-card-desc">
                        <strong>O que é verificado:</strong> A plataforma calcula o hash criptográfico (MD5) de cada arquivo nos diretórios <code>/wp-admin/</code>, <code>/wp-includes/</code> e na raiz do WordPress, comparando-o com os hashes oficiais assinados pela equipe do WordPress.org para a versão exata do core instalada.
                    </div>
                    <div class="test-card-meta">
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-risk">⚠️ Risco para o Cliente</div>
                            Se um hash diferir do original, o arquivo foi <strong>adulterado por invasores</strong> (injeção de código malicioso, criação de backdoors para roubo de senhas, desvio de tráfego para sites maliciosos) ou corrompido durante atualizações. Arquivos desconhecidos na raiz ou em pastas do core frequentemente indicam Web Shells ativas.
                        </div>
                        <div class="test-meta-box">
                            <div class="test-meta-title test-meta-fix">🛠️ Como Corrigir</div>
                            A plataforma possui a funcionalidade <strong>Auto-Fix com 1 clique</strong> na tela de Integridade do Core: ela faz o download do arquivo original limpo diretamente do repositório oficial do WordPress.org e substitui o arquivo comprometido com backup de segurança automático.
                        </div>
                    </div>
                </div>

                <h2>Como Adicionar um Site e Executar a Varredura</h2>
                <ol>
                    <li>No painel da plataforma, clique em <strong>"Websites Alvo"</strong> e depois em <strong>"+ Adicionar Website"</strong>.</li>
                    <li>Informe o nome e a URL completa da aplicação WordPress (ex: <code>http://seusite.com.br</code>).</li>
                    <li>Clique em <strong>"Executar Nova Varredura"</strong>. A análise leva poucos segundos e o relatório detalhado será exibido na tela.</li>
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

            <!-- 8. Remediação Híbrida & Plugin de Fixes -->
            <section id="remediacao-e-ia" class="doc-section">
                <h1>🤖 Remediação Híbrida, Plugin de Fixes & Inteligência Artificial</h1>
                <p>Nem todas as falhas de segurança podem ser tratadas da mesma forma. O <strong>Validar Segurança</strong> adota uma metodologia estruturada dividida entre correções automatizáveis no nível do código WordPress e orientações de infraestrutura para o servidor web:</p>

                <h2>1. Plugin Dedicado de Correções: WP Patropi Fixes (`wp-patropi-fixes`)</h2>
                <p>Para falhas relativas à aplicação WordPress (ocultação de versão, proteção contra enumeração de autores, cabeçalhos de segurança via PHP, bloqueio de sitemaps sensíveis e arquivos de documentação), a plataforma gera o plugin exclusivo <strong>WP Patropi Fixes</strong>.</p>

                <div class="callout callout-success">
                    <div class="callout-title">⚡ Arquitetura 100% Autônoma e Desacoplada</div>
                    <p>O <code>wp-patropi-fixes</code> não depende da existência prévia do plugin agente de diagnóstico. Ele opera com infraestrutura própria de endpoints REST API (<code>/wp-json/wp-patropi-fixes/v1/status</code> e <code>/wp-json/wp-patropi-fixes/v1/toggle</code>), permitindo instalar, monitorar e alternar correções de forma independente e isolada.</p>
                </div>

                <h3>Destaques de Engenharia do Plugin de Fixes:</h3>
                <ul>
                    <li><strong>Token e ID Embutidos no Código:</strong> Na geração do plugin, a plataforma injeta automaticamente as constantes PHP <code>VS_FIXES_SITE_TOKEN</code> e <code>VS_FIXES_SITE_ID</code> personalizadas para o site. Isso elimina a necessidade de configurações manuais ou inserção de chaves no wp-admin: basta instalar e ativar.</li>
                    <li><strong>Geração Determinística Nativa (Padrão):</strong> Por padrão, o plugin é compilado utilizando modelos canônicos estritamente validados e testados. A geração ocorre em menos de 1 segundo, sem risco de alucinações de código, erros de sintaxe ou dependência de limites de tokens de APIs externas. A geração com IA (Kimi K2.7 Code) continua disponível como recurso avançado no processamento em lote.</li>
                    <li><strong>Self-Healing (Auto-Recuperação de Credenciais):</strong> Ao carregar, o plugin verifica se a opção <code>vs_agent_token</code> existe em <code>wp_options</code>. Se estiver ausente ou desatualizada, ela é automaticamente sincronizada com o token legítimo embutido, reparando a comunicação com a plataforma silenciosamente.</li>
                    <li><strong>Resiliência a WAF, ModSecurity e Proxies Reversos:</strong> Provedores de hospedagem com ModSecurity, Cloudflare ou Apache FastCGI frequentemente removem cabeçalhos HTTP como <code>Authorization: Bearer</code> ou <code>X-Validar-Seguranca-Token</code>. O plugin possui suporte a autenticação multi-origem com fallback inteligente por query parameters (<code>?vs_token=</code> e <code>?agent_token=</code>).</li>
                    <li><strong>Prioridade Máxima em Filtros de Autenticação REST:</strong> O plugin registra seu validador no hook <code>rest_authentication_errors</code> com prioridade <code>99</code>. Isso garante que requisições autorizadas do SaaS não sejam bloqueadas por plugins de segurança de terceiros (como Wordfence, iThemes Security ou plugins de membership).</li>
                </ul>

                <h2>2. Gestão Granular de Proteções (Chaves Seletoras / Toggles)</h2>
                <p>Diferente de soluções que ativam tudo de forma engessada, o <strong>WP Patropi Fixes</strong> permite ativar ou desativar individualmente cada proteção aplicada, sem precisar desinstalar o plugin ou editar arquivos PHP.</p>

                <h3>Como Funciona no WordPress do Cliente (Painel WP-Admin):</h3>
                <ol>
                    <li>Acesse o menu lateral <strong>WP Patropi Fixes</strong> no wp-admin do cliente.</li>
                    <li>Visualize a tabela completa de proteções instaladas, incluindo título, código do teste e descrição técnica detalhada de cada uma.</li>
                    <li>Utilize a chave seletora (*Toggle Switch*) ao lado de cada item para alternar entre <span style="color:#10b981; font-weight:bold;">Ativo</span> e <span style="color:#94a3b8; font-weight:bold;">Inativo</span>. A alteração é gravada instantaneamente via AJAX na opção <code>vs_fixes_active_options</code> do banco de dados.</li>
                </ol>

                <h3>Como Funciona Remotamente no SaaS (Painel Validar Segurança):</h3>
                <ol>
                    <li>Acesse o site na plataforma e clique na aba <strong>Auditoria e Segurança</strong>.</li>
                    <li>Role até a seção <strong>"Proteções Ativas (WP Patropi Fixes)"</strong>.</li>
                    <li>Se o plugin estiver ativo no WordPress, a lista de proteções será exibida com seus respectivos status em tempo real.</li>
                    <li>Clique no toggle de qualquer proteção para habilitá-la ou desabilitá-la remotamente. O SaaS comunica-se via REST API autenticada com o WordPress do cliente, persistindo o estado imediatamente.</li>
                </ol>

                <div class="callout callout-info">
                    <div class="callout-title">🔄 Sincronização Bidirecional Contínua</div>
                    <p>Qualquer chave alternada no WordPress do cliente reflete no SaaS na próxima visualização, e qualquer comando emitido pelo painel do SaaS é aplicado no WordPress no mesmo segundo. Se precisar desativar temporariamente uma proteção para testes de compatibilidade (por exemplo, durante a homologação de um novo formulário ou plugin de login), você pode desativar apenas aquela regra específica com segurança total.</p>
                </div>

                <h2>3. Guia do Servidor & Ações Manuais (`SERVER_CONFIG` / `MANUAL_ACTION`)</h2>
                <p>Falhas que envolvem a infraestrutura do servidor web (Apache, Nginx, LiteSpeed), configurações de limites no <code>php.ini</code> ou diretivas de boot no <code>wp-config.php</code> não devem ser alteradas via plugin PHP por princípios de segurança da hospedagem. Para esses casos, utilize o botão <strong>"📙 Guia do Servidor / Ações Manuais"</strong>.</p>

                <div class="callout callout-success">
                    <div class="callout-title">💾 Persistência & Cache do Guia no Banco de Dados</div>
                    <p>Ao abrir o Guia do Servidor, a plataforma compila as instruções passo a passo (geradas por IA ou via Catálogo Canônico). O guia é <strong>salvo automaticamente no banco de dados</strong>, exibindo a etiqueta <code>💾 Guia salvo em: [data/hora]</code>. Nas próximas consultas, o carregamento é <strong>instantâneo</strong>. Para reprocessar as recomendações com o modelo mais recente da IA, clique em <code>🔄 Atualizar Instruções (IA)</code>.</p>
                </div>

                <h3>Exemplos de Snippets do Guia do Servidor</h3>

                <p><strong>Para Apache (Arquivo <code>.htaccess</code>):</strong></p>
                <div class="code-block">
                    <button class="btn-copy" onclick="copyCode(this)">Copiar</button>
                    <pre># Desativar Listagem de Diretórios
Options -Indexes

# Proteger wp-config.php e arquivos sensíveis
&lt;Files wp-config.php&gt;
Order allow,deny
Deny from all
&lt;/Files&gt;

# Bloquear acesso a arquivos de documentação
&lt;FilesMatch "^(readme\.html|readme\.txt|license\.txt)$"&gt;
Order allow,deny
Deny from all
&lt;/FilesMatch&gt;</pre>
                </div>

                <p><strong>Para Nginx (Arquivo <code>nginx.conf</code>):</strong></p>
                <div class="code-block">
                    <button class="btn-copy" onclick="copyCode(this)">Copiar</button>
                    <pre># Desativar listagem de diretórios
autoindex off;

# Forçar cabeçalho HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Bloquear arquivos sensíveis
location ~* /(wp-config\.php|readme\.html|license\.txt) {
    deny all;
    return 404;
}</pre>
                </div>
            </section>

            <!-- 5. Gestão do Plano & Consumo de IA (Visão do Cliente) -->
            <section id="gestao-plano-cliente" class="doc-section">
                <h1>📦 Gestão do Plano & Consumo de Inteligência Artificial</h1>
                <p>No <strong>Validar Segurança</strong>, o acesso aos recursos da plataforma é estruturado através de <strong>Planos & Pacotes</strong> desenhados para oferecer previsibilidade total de custos aos clientes. Cada conta possui um plano mensal ativo que contempla uma quantidade definida de websites monitorados e uma cota de tokens de Inteligência Artificial.</p>

                <h2>1. Como Funciona o Plano do Cliente</h2>
                <p>Ao contratar ou ativar sua conta, o cliente tem acesso aos recursos de forma consolidada:</p>
                <ul>
                    <li><strong>Websites Contratados:</strong> Quantidade máxima de sites WordPress que podem ser cadastrados e monitorados simultaneamente (ex: 4 sites, 10 sites ou Ilimitado).</li>
                    <li><strong>Cota Mensal de Inteligência Artificial:</strong> Volume de tokens disponíveis a cada ciclo mensal para análises aprofundadas, geração de soluções sob medida e diagnósticos inteligentes (ex: 250.000, 500.000 ou 2.000.000 de tokens).</li>
                    <li><strong>Mensalidade Fixa e Previsível:</strong> O uso de IA dentro da cota contratada está 100% incluso na mensalidade. Não existem cobranças variáveis por requisição ou surpresas na fatura no final do mês.</li>
                </ul>

                <h2>2. Entendendo os Tokens de IA: Entrada (Prompt) vs Saída (Completion)</h2>
                <p>Os modelos de inteligência artificial processam dados em unidades chamadas <strong>tokens</strong> (1 token equivale a aproximadamente 4 caracteres ou cerca de 0,75 palavra em português). Cada interação com a IA divide-se em duas etapas bem definidas:</p>

                <div class="grade-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin: 20px 0;">
                    <div class="grade-card" style="text-align: left; padding: 20px; background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.25);">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <span style="font-size: 1.5rem;">📥</span>
                            <strong style="color: #818cf8; font-size: 1.05rem;">Tokens de Entrada (Prompt)</strong>
                        </div>
                        <p style="font-size: 0.88rem; color: #cbd5e1; margin: 0;">
                            São os dados enviados pela plataforma para a IA analisar: o relatório da vulnerabilidade detectada, o contexto do WordPress auditado, cabeçalhos HTTP e os parâmetros técnicos do teste.
                        </p>
                    </div>

                    <div class="grade-card" style="text-align: left; padding: 20px; background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.25);">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <span style="font-size: 1.5rem;">📤</span>
                            <strong style="color: #34d399; font-size: 1.05rem;">Tokens de Saída (Completion)</strong>
                        </div>
                        <p style="font-size: 0.88rem; color: #cbd5e1; margin: 0;">
                            É a resposta técnica construída pela IA: o código PHP do patch de segurança para o WordPress, as regras para <code>.htaccess</code> ou <code>nginx.conf</code> e o passo a passo da mitigação manual.
                        </p>
                    </div>
                </div>

                <div class="callout callout-info">
                    <div class="callout-title">💡 Como é Feita a Contabilização no seu Plano?</div>
                    <p>Tanto os tokens de entrada (instruções enviadas) quanto os de saída (respostas geradas) são somados e debitados da sua <strong>Cota Mensal de IA</strong>. No menu superior <strong>Gestão do Plano</strong>, você visualiza em tempo real a barra de progresso (ex: <code>45.000 / 250.000 tokens</code>) com a porcentagem utilizada no ciclo vigente.</p>
                </div>

                <h2>3. Sistema de Add-ons (Upgrades Sob Demanda)</h2>
                <p>Se a sua carteira de sites crescer ou se você precisar de um volume maior de processamento de IA antes da virada do ciclo mensal, você não precisa ficar travado nem trocar de plano forçadamente. Você pode solicitar à administração a ativação de <strong>Add-ons</strong>:</p>

                <ul>
                    <li><strong>Sites Extras (+Websites):</strong> Adiciona capacidade para novos domínios ao seu plano base com acréscimo de um valor fixo mensal (ex: +2 sites por R$ 50,00/mês).</li>
                    <li><strong>Cota Extra de IA (+Tokens):</strong> Adiciona um pacote extra de tokens ao seu limite mensal com acréscimo de um valor fixo mensal (ex: +250k tokens por R$ 40,00/mês).</li>
                </ul>

                <p>O faturamento é sempre discriminado e transparente na tela <strong>Gestão do Plano</strong>:</p>
                <div class="code-block">
                    <pre style="color: #38bdf8;">Mensalidade Total = Plano Base (R$) + Sites Extras (R$) + IA Extra (R$)</pre>
                </div>

                <h2>4. Histórico Mensal & Auditoria de Consumo</h2>
                <p>Na tela <strong>Gestão do Plano</strong>, você tem acesso ao <strong>Histórico Mensal de Consumo de IA</strong> organizado por competência (Janeiro, Fevereiro, Março...). A tabela apresenta com transparência:</p>
                <ul>
                    <li><strong>Mês de Referência:</strong> Competência do ciclo de faturamento.</li>
                    <li><strong>Requisições:</strong> Quantidade de chamadas executadas com sucesso.</li>
                    <li><strong>Tokens de Entrada (Prompt) e de Saída (Completion):</strong> Detalhamento do volume de tráfego de dados com o motor de inteligência artificial.</li>
                    <li><strong>Total de Tokens:</strong> Soma total consumida no período.</li>
                </ul>
                <p>Abaixo do histórico, uma tabela detalhada com paginação permite auditar cada requisição individual com data, horário, funcionalidade e website de origem.</p>
            </section>

            <!-- 6. Catálogo de Soluções -->
            <section id="catalogo-de-solucoes" class="doc-section admin-only">
                <h1>📚 Catálogo de Soluções (Área Restrita Admin)</h1>
                <p>O <strong>Catálogo de Soluções</strong> é a base de conhecimento centralizadora da plataforma, visível para Administradores no menu superior (<em>Configurações &gt; Catálogo de Soluções</em>).</p>
                
                <p>Cada teste de auditoria (ex: <code>wp_xmlrpc_enabled</code>, <code>header_strict_transport_security</code>, <code>dir_listing_uploads</code>) possui um registro no catálogo contendo:</p>
                <ul>
                    <li><strong>Check ID:</strong> Identificador técnico único do teste.</li>
                    <li><strong>Tipo de Ação:</strong> <code>PLUGIN_AUTO_FIX</code> (Plugin WP), <code>SERVER_CONFIG</code> (Servidor) ou <code>MANUAL_ACTION</code> (Manual).</li>
                    <li><strong>Código PHP / Snippet:</strong> Código exato utilizado para a correção automática nos plugins de hardening.</li>
                    <li><strong>Instruções de Servidor:</strong> Guia descritivo de correção em `.htaccess` ou `nginx.conf`.</li>
                </ul>

                <p><strong>Manutenção em Lote com IA:</strong> Administradores dispõem do botão <strong>"✨ Gerar Soluções em Lote (IA)"</strong> diretamente no cabeçalho do catálogo, permitindo abastecer itens pendentes ou refinar toda a base com a IA Kimi K2.7 Code com acompanhamento em tempo real. Clientes que encontrarem falhas sem solução pré-existente possuem autonomia para gerá-las individualmente no relatório de auditoria, consumindo de suas próprias cotas mensais.</p>
            </section>

            <!-- 7. Gestão de Usuários & Cotas -->
            <section id="gestao-de-usuarios" class="doc-section admin-only">
                <h1>👥 Gestão de Usuários, Permissões & Cotas de IA</h1>
                <p>A plataforma oferece controle de acesso baseado em funções (RBAC - Role-Based Access Control) e controle granular do uso de IA por cliente:</p>

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
                            <td>Gerenciar Catálogo de Soluções em Lote</td>
                            <td>✅ Acesso Total</td>
                            <td>❌ Sem acesso</td>
                        </tr>
                        <tr>
                            <td>Gerenciar Usuários e Cotas de IA</td>
                            <td>✅ Criar/Editar/Configurar Cotas</td>
                            <td>❌ Sem acesso</td>
                        </tr>
                        <tr>
                            <td>Definir Preço do Token por Milheiro</td>
                            <td>✅ Configurações Gerais</td>
                            <td>❌ Sem acesso</td>
                        </tr>
                        <tr>
                            <td>Painel de Monitoramento Geral de IA</td>
                            <td>✅ Visão Global de Custos</td>
                            <td>❌ Apenas visualiza seu próprio consumo</td>
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

                <h2>Gestão em Abas & Menu de Ações Rápido</h2>
                <p>A tela de Usuários organiza as contas em duas abas dedicadas:</p>
                <ul>
                    <li><strong>Aba Clientes:</strong> Exibe exclusivamente os usuários comuns/clientes, com contador em tempo real no badge da aba.</li>
                    <li><strong>Aba Administradores:</strong> Exibe apenas os operadores e superusuários com privilégios administrativos.</li>
                </ul>
                <p>Cada linha conta com o menu dropdown <strong>"Ações"</strong>, centralizando em um clique as funções de <em>Gestão do Plano</em>, <em>Ver como (Impersonação)</em>, <em>Editar Usuário / Senha</em>, <em>Ativar / Desativar</em> e <em>Excluir</em>.</p>

                <h2>Painel "Gestão do Plano" por Cliente</h2>
                <p>Ao clicar em <strong>"Gestão do Plano"</strong> no menu de qualquer usuário, o administrador acessa o cockpit financeiro e operacional daquela conta:</p>
                <ul>
                    <li><strong>Atribuição de Plano Base:</strong> Seleção entre os pacotes vigentes no catálogo (Iniciante, Profissional ou Full).</li>
                    <li><strong>Configuração de Add-ons & Adicionais:</strong>
                        <ul>
                            <li><strong>Sites Extras:</strong> Quantidade de sites adicionais liberados e valor extra cobrado (R$/mês).</li>
                            <li><strong>Tokens de IA Extras:</strong> Cota adicional de tokens de IA e valor extra cobrado (R$/mês).</li>
                        </ul>
                    </li>
                    <li><strong>Painel DRE & Margem de Contribuição (Exclusivo Admin):</strong> O sistema calcula em tempo real o <strong>Faturamento Mensal Contratado (R$)</strong> contra o <strong>Custo Real da API de IA Consumida no Mês (R$)</strong>, exibindo a Margem Líquida em R$ e em percentual (%).</li>
                    <li><strong>Travas Automáticas de Backend:</strong> Se o cliente tentar cadastrar sites além do limite (base + extras), a criação é interrompida via API (`403 Forbidden`). Caso a cota mensal de IA seja atingida, novas chamadas de inteligência artificial são pausadas até o próximo ciclo ou até a contratação de add-ons.</li>
                </ul>
            </section>

            <!-- 8. Catálogo de Planos & Motores de IA (Área Restrita Admin) -->
            <section id="configuracao-planos-ia" class="doc-section admin-only">
                <h1>⚙️ Catálogo de Planos & Motores de IA (Área Restrita Admin)</h1>
                <p>Disponível em <em>Configurações &gt; Planos & Pacotes</em> e <em>Configurações &gt; Motor de IA & Precificação</em>, este módulo permite controlar toda a esteira comercial e de inteligência artificial do sistema.</p>

                <h2>1. Catálogo de Planos & Pacotes</h2>
                <p>O administrador pode gerenciar, criar e editar os planos base disponíveis no sistema:</p>

                <table class="doc-table">
                    <thead>
                        <tr>
                            <th>Plano</th>
                            <th>Sites Incluídos</th>
                            <th>Quota Mensal de IA</th>
                            <th>Mensalidade Base</th>
                            <th>Padrão</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Iniciante</strong></td>
                            <td>4 websites</td>
                            <td>250.000 tokens (250k)</td>
                            <td>R$ 97,00/mês</td>
                            <td>✅ Sim</td>
                        </tr>
                        <tr>
                            <td><strong>Profissional</strong></td>
                            <td>10 websites</td>
                            <td>500.000 tokens (500k)</td>
                            <td>R$ 197,00/mês</td>
                            <td>❌ Não</td>
                        </tr>
                        <tr>
                            <td><strong>Full</strong></td>
                            <td>Sites Ilimitados</td>
                            <td>2.000.000 tokens (2M)</td>
                            <td>R$ 397,00/mês</td>
                            <td>❌ Não</td>
                        </tr>
                    </tbody>
                </table>

                <div class="callout callout-warning">
                    <div class="callout-title">⚠️ Regra de Segurança Inegociável: Sem IA Ilimitada</div>
                    <p>Por diretriz de proteção orçamentária contra abusos e custos inesperados com provedores LLM, <strong>nenhum plano pode ter IA ilimitada</strong>. Mesmo o plano Full possui o teto estrito de <strong>2.000.000 de tokens</strong> mensais. Toda ampliação adicional de cotas deve ocorrer via Add-on com valor cobrado explicitamente.</p>
                </div>

                <h2>2. Configuração de Motores de IA & Precificação Diferenciada</h2>
                <p>Em <em>Configurações &gt; Motor de IA & Precificação</em>, o administrador parametriza o modelo LLM em execução e os custos reais de operação:</p>
                <ul>
                    <li><strong>Seleção de Modelos:</strong> Suporte nativo ao modelo <code>Kimi K2.7 Code</code> (via OpenCode Zen API), DeepSeek Chat e outros modelos especializados em engenharia reversa e código PHP.</li>
                    <li><strong>Preço por 1.000 Tokens de Entrada (Prompt):</strong> Valor cobrado pelo provedor para ler as instruções e relatórios enviados (ex: R$ 0,005 por 1k tokens).</li>
                    <li><strong>Preço por 1.000 Tokens de Saída (Completion):</strong> Valor cobrado pelo provedor para sintetizar o código de remediação (ex: R$ 0,020 por 1k tokens — tipicamente muito superior ao valor de entrada).</li>
                    <li><strong>Preço Médio de Referência:</strong> Valor médio ponderado utilizado como base consolidada para estimativas preliminares.</li>
                </ul>
            </section>

            <!-- 9. Monitoramento Geral de IA & Gestão de Custos -->
            <section id="monitoramento-ia-global" class="doc-section admin-only">
                <h1>💰 Monitoramento Geral de IA & Gestão de Custos (Área Restrita Admin)</h1>
                <p>Disponível exclusivamente para Administradores no menu <em>Configurações &gt; Uso Geral da IA</em>, esta área atua como o centro de comando financeiro e de governança de inteligência artificial de toda a plataforma.</p>

                <h2>Fórmula de Precificação Ponderada (Auditoria Real)</h2>
                <p>Diferente de sistemas que utilizam médias imprecisas, o <strong>Validar Segurança</strong> calcula o custo real de cada requisição aplicando a precificação diferenciada entre leitura e escrita de dados:</p>
                <div class="code-block">
                    <pre style="color: #10b981;">Custo Real (R$) = (Tokens Prompt / 1.000 × Preço Entrada) + (Tokens Completion / 1.000 × Preço Saída)</pre>
                </div>

                <h2>Cockpit Financeiro Global</h2>
                <ul>
                    <li><strong>Faturamento Mensal da Carteira (R$):</strong> Soma de todas as mensalidades e add-ons contratados por todos os clientes ativos.</li>
                    <li><strong>Gasto Total com Provedores de IA (R$):</strong> Custo real e ponderado de todas as chamadas de API executadas no mês selecionado.</li>
                    <li><strong>Margem Operacional Líquida (R$ e %):</strong> Diferença líquida entre o faturamento recebido dos clientes e o custo de infraestrutura de IA consumido.</li>
                    <li><strong>Volume de Tokens:</strong> Total discriminado de tokens de entrada (instruções) e tokens de conclusão (respostas de código).</li>
                    <li><strong>Filtro por Competência:</strong> Alternância imediata entre o mês corrente, competências anteriores ou histórico vitalício da plataforma.</li>
                </ul>

                <h2>Rankings de Auditoria</h2>
                <ol>
                    <li><strong>Ranking por Usuário:</strong> Identifica quais clientes mais consumiram tokens no mês, o percentual de atingimento da sua cota contratada e atalho direto para a <em>Gestão do Plano</em> daquele cliente.</li>
                    <li><strong>Ranking por Website:</strong> Relaciona quais domínios demandaram maior número de requisições e processamento de IA.</li>
                    <li><strong>Breakdown por Funcionalidade:</strong> Segmentação do uso entre geração de soluções no catálogo (<code>single_check</code> / <code>batch_check</code>), guias de servidor (<code>server_guide</code>) e plugins de remediação (<code>remediation_plugin</code>).</li>
                </ol>
            </section>

            <!-- 8. FAQ -->
            <section id="faq-e-boas-praticas" class="doc-section">
                <h1>❓ Central de Dúvidas, FAQ & Boas Práticas</h1>
                
                <h2>Perguntas Frequentes</h2>

                <h3>1. O plugin de correção WP Patropi Fixes pode quebrar meu site?</h3>
                <p>Os patches gerados aplicam rotinas seguras e padronizadas recomendadas pela OWASP. Além disso, a nova arquitetura do <strong>WP Patropi Fixes</strong> conta com <strong>gestão granular de proteções</strong>: caso qualquer regra específica entre em conflito com formulários ou plugins de terceiros, você não precisa desativar todo o plugin — basta desligar apenas a proteção conflitante diretamente no menu <code>WP Patropi Fixes</code> do WordPress ou remotamente pelo painel do SaaS.</p>

                <h3>2. O painel informa "Plugin WP Patropi Fixes não detectado ou inativo". Como proceder?</h3>
                <p>Essa mensagem indica que o SaaS não obteve resposta com status HTTP 200 na rota <code>/wp-json/wp-patropi-fixes/v1/status</code>. Siga este checklist para resolução rápida:</p>
                <ol>
                    <li>Certifique-se de que o plugin <strong>WP Patropi Fixes</strong> está instalado e ativo no WordPress.</li>
                    <li>Verifique se você gerou o plugin recentemente. As versões anteriores não continham as rotas de toggle e token embutido. Basta clicar em <strong>"✨ Gerar Soluções em Lote"</strong> no SaaS, baixar o novo ZIP gerado e fazer o upload no WordPress substituindo o anterior.</li>
                    <li>O plugin mais recente já contém token do site embutido no código PHP (<code>VS_FIXES_SITE_TOKEN</code>) e suporte automático a bypass de WAF/ModSecurity com query param (<code>?vs_token=</code>), permitindo conexão mesmo em hospedagens que descartam cabeçalhos HTTP.</li>
                </ol>

                <h3>3. Qual a diferença entre o Plugin Agente e o Plugin de Fixes?</h3>
                <p>Eles desempenham papéis complementares e agora são 100% independentes:</p>
                <ul>
                    <li><strong>Plugin Agente (wp-patropi-agent):</strong> É o módulo de <em>diagnóstico e telemetria</em>. Ele audita o banco de dados interno, inspeciona integridade dos arquivos do core do WordPress, monitora logs de erro do PHP em tempo real e orquestra atualizações remotas de temas e plugins.</li>
                    <li><strong>Plugin de Fixes (wp-patropi-fixes):</strong> É o módulo de <em>blindagem ativa (hardening)</em>. Ele aplica em tempo de execução os filtros de segurança que bloqueiam enumeração de usuários, removem versão exposta, desativam sitemaps sensíveis e protegem arquivos de documentação, com controle liga/desliga para cada regra.</li>
                </ul>

                <h3>4. O que fazer se a conexão com o Agente WordPress falhar?</h3>
                <p>Acesse o painel do WordPress em <strong>WP Patropi > Diagnóstico</strong> e utilize o botão <strong>"⚡ Testar Reconexão com a Plataforma"</strong>. Verifique se o Token do Agente salvo coincide com o token exibido na plataforma. Caso o servidor utilize firewall rígido, certifique-se de que a rota <code>/wp-json/wp-patropi/v1/</code> está acessível externamente.</p>

                <h3>5. Por que devo aplicar as alterações do Guia do Servidor manualmente?</h3>
                <p>Arquivos como <code>.htaccess</code>, <code>nginx.conf</code> e <code>php.ini</code> controlam a infraestrutura e o processo do servidor web. Por rígidos padrões de segurança da hospedagem, o WordPress não deve (e na maioria dos servidores não tem permissão para) alterar diretamente esses arquivos. Por essa razão, a plataforma gera a sintaxe exata e testada para você colar diretamente no painel cPanel, Plesk ou terminal SSH.</p>

                <div class="callout callout-info" style="margin-top:40px;">
                    <div class="callout-title">💬 Precisa de Ajuda Adicional?</div>
                    <p>Caso tenha dúvidas sobre a interpretação de algum diagnóstico de segurança, consulte a equipe de suporte ou o administrador da sua conta.</p>
                </div>
            </section>

        </main>
    </div>

    <!-- Script Vanilla JS para Busca e Interatividade -->
    <script>
        // Verificação Automática de Privilégios (Admin vs Cliente Público)
        (function() {
            try {
                let isAdmin = false;
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    const u = JSON.parse(storedUser);
                    if (u && u.role === 'admin') {
                        isAdmin = true;
                    }
                }
                if (isAdmin) {
                    document.body.classList.add('is-admin');
                }
            } catch (err) {
                console.warn('Erro ao verificar sessão na documentação:', err);
            }
        })();

        // Busca Dinâmica em Tempo Real
        document.getElementById('docSearch').addEventListener('input', function (e) {
            const query = e.target.value.toLowerCase().trim();
            const sections = document.querySelectorAll('.doc-section');
            const isAdmin = document.body.classList.contains('is-admin');

            sections.forEach(sec => {
                if (sec.classList.contains('admin-only') && !isAdmin) {
                    sec.style.display = 'none';
                    return;
                }
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

        // Copiar Lista Completa dos Testes de Segurança (Formato WhatsApp / Word)
        function copyTestsListWhatsApp(btn) {
            const checklistText = `🛡️ *VALIDAR SEGURANÇA — CHECKLIST COMPLETO DE AUDITORIA WORDPRESS*
Relação oficial de testes e checagens de vulnerabilidades executadas pela plataforma (Total: 31 testes):

🌐 *1. INFRAESTRUTURA & CABEÇALHOS HTTP*
• *Uso de HTTPS / SSL* [Média] — Verifica se o tráfego é criptografado obrigatoriamente via HTTPS.
• *Strict-Transport-Security (HSTS)* [Média] — Previne ataques de rebaixamento de conexão (SSL Striping).
• *X-Frame-Options* [Média] — Proteção anti-clickjacking para impedir que o site seja aberto em iframes maliciosos.
• *X-Content-Type-Options* [Baixa] — Bloqueia MIME Sniffing, impedindo execução indevida de arquivos estáticos.
• *Content-Security-Policy (CSP)* [Alta] — Restringe fontes confiáveis de scripts contra injeções de código (XSS).

📁 *2. EXPOSIÇÃO DE ARQUIVOS & DIRETÓRIOS*
• *Listagem de Diretórios em Uploads* [Alta] — Impede navegação aberta e download de mídias/documentos em /wp-content/uploads/.
• *Listagem de Diretórios no Core* [Alta] — Protege a estrutura interna de bibliotecas do /wp-includes/.
• *Backup wp-config.php.bak* [Crítica] — Detecta backups que revelam usuário e senha do Banco MySQL e chaves de segurança.
• *Cópia wp-config.txt* [Crítica] — Detecta cópias em formato texto que expõem credenciais de banco de dados.
• *Arquivo de Ambiente /.env* [Crítica] — Protege tokens de API, segredos de gateways de pagamento e senhas SMTP.
• *Log de Depuração debug.log* [Alta] — Impede leitura pública de stacktraces, caminhos de servidor e dados de requisições.
• *Log de Erros error_log* [Alta] — Bloqueia arquivos de log com vazamento de falhas internas da hospedagem.
• *Documentação readme.html* [Baixa] — Remove arquivo padrão que estampa a versão inicial instalada do WordPress.
• *Arquivo de Licença license.txt* [Baixa] — Higiene digital e redução de footprint de instalação padrão.

👤 *3. ENUMERAÇÃO DE USUÁRIOS & LOGIN*
• *Enumeração via REST API* [Alta] — Bloqueia rota /wp-json/wp/v2/users que vaza logins de autores e administradores.
• *Enumeração via Query Author* [Média] — Redireciona consultas /?author=N para a página inicial com status 301.
• *Enumeração via Sitemap XML* [Alta] — Desativa sitemaps de autores nos plugins Yoast, Rank Math e nativo do WordPress.
• *Interface Remota XML-RPC* [Alta] — Desativa xmlrpc.php contra ataques em lote de força bruta e DDoS Pingback.
• *Página de Login Padrão* [Baixa] — Avalia exposição do formulário /wp-login.php contra botnets automatizadas.

🔍 *4. FINGERPRINTING & DETECÇÃO DE COMPONENTES*
• *Versão do WordPress em Meta Tag* [Média] — Oculta a tag generator no HTML que facilita exploração de CVEs conhecidas.
• *Enumeração e Versões de Plugins* [Baixa] — Remove parâmetros ?ver= em scripts/estilos e bloqueia arquivos readme.txt.

🔌 *5. AUDITORIA INTERNA DO AGENTE WORDPRESS*
• *Atualizações Pendentes* [Alta] — Monitora patches de segurança críticos do Core, Plugins e Temas.
• *Plugins Inativos Abandonados* [Baixa] — Identifica arquivos PHP inativos que continuam ocupando disco e gerando riscos.
• *Conta de Administrador Padrão ("admin")* [Crítica] — Erradica o login padrão visado em todos os ataques de força bruta.
• *Quantidade de Administradores* [Baixa] — Aplica o Princípio do Menor Privilégio na gestão da equipe.
• *Modo de Depuração (WP_DEBUG)* [Alta] — Garante que erros de código e queries SQL não vazem na tela de visitantes.
• *Editor de Arquivos no WP-Admin* [Média] — Desativa editor de código PHP no painel contra injeção de Web Shells.
• *Prefixo das Tabelas MySQL* [Baixa] — Verifica uso de prefixo customizado para dificultar SQL Injection às cegas.
• *Cadastro Aberto de Usuários* [Média] — Bloqueia registro não autorizado de novos membros por robôs de spam.
• *Moderação Obrigatória de Comentários* [Alta] — Exige moderação prévia para evitar links maliciosos e penalizações no Google.

💎 *6. INTEGRIDADE CRIPTOGRÁFICA DO CORE*
• *Checksums Oficiais WordPress.org* [Crítica] — Compara hashes criptográficos MD5 de todos os arquivos do core com o repositório oficial, detectando códigos adulterados, backdoors e malwares injetados.

_Checklist oficial gerado pela plataforma Validar Segurança._`;

            const iconSpan = btn.querySelector('.btn-copy-icon');
            const textSpan = btn.querySelector('.btn-copy-text');
            const originalIcon = iconSpan ? iconSpan.innerText : '📋';
            const originalText = textSpan ? textSpan.innerText : 'Copiar Lista para WhatsApp / Word';

            function setSuccess() {
                btn.classList.add('copied');
                if (iconSpan) iconSpan.innerText = '✅';
                if (textSpan) textSpan.innerText = 'Copiado para a Área de Transferência!';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    if (iconSpan) iconSpan.innerText = originalIcon;
                    if (textSpan) textSpan.innerText = originalText;
                }, 2500);
            }

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(checklistText).then(setSuccess).catch(() => fallbackCopy(checklistText));
            } else {
                fallbackCopy(checklistText);
            }

            function fallbackCopy(text) {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-999999px';
                ta.style.top = '-999999px';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                try {
                    document.execCommand('copy');
                    setSuccess();
                } catch (err) {
                    alert('Não foi possível copiar automaticamente. Selecione o texto manualmente.');
                }
                document.body.removeChild(ta);
            }
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
