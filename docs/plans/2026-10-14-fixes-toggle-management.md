# Plano de Implementação: Ativação/Desativação de Funcionalidades no Plugin de Fixes (WordPress & SaaS)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir que o usuário e a equipe técnica ativem e desativem individualmente cada regra/funcionalidade de segurança do plugin `WP Patropi Fixes`, tanto na página de configurações do plugin dentro do WordPress do cliente quanto remotamente pelo painel do SaaS na página de Auditoria & Segurança.

**Architecture:** 
1. No plugin `wp-patropi-fixes`, cada correção é condicionada à função `vs_is_fix_active($check_id)`, que consulta a opção WordPress `wp_patropi_fixes_settings` (onde todas iniciam como ativas por padrão). A página admin do plugin no WordPress ganha um formulário interativo com switches/toggles visuais e salvamento com nonce.
2. O plugin agente (`validar-seguranca-agent`) expõe rotas REST seguras (`GET /fixes` e `POST /fixes/toggle`) para comunicar o estado e alternar regras via requisições autenticadas por token.
3. O backend do SaaS (`Websites.php`) ganha endpoints proxy para se comunicar com o agente, e o gerador de plugins de remediação (`Remediation.php` / `AIService.php`) passa a gerar novos plugins de fix já com essa arquitetura modular.
4. O frontend do SaaS adiciona na tela de Auditoria & Segurança (`ScanReport.tsx`) uma seção dedicada e elegante para gerenciar os switches em tempo real com feedback instantâneo.

**Tech Stack:** PHP 8.2+, CodeIgniter 4, WordPress Plugin API / REST API, React 18, Mantine UI v7, TypeScript.

---

### Tarefa 1: Arquitetura de Opções e Toggles no Plugin `wp-patropi-fixes`

**Objetivo:** Permitir que o plugin de fixes armazene o estado de cada funcionalidade e disponibilize interface de ativação/desativação no WP Admin.

**Arquivos:**
- Modificar: `/opt/lampp/htdocs/wordpress/wp-content/plugins/wp-patropi-fixes/wp-patropi-fixes.php`

**Passo 1: Criar helper de checagem e registro de opções**
```php
if (!function_exists('vs_get_fixes_settings')) {
    function vs_get_fixes_settings() {
        return get_option('wp_patropi_fixes_settings', array());
    }
}

if (!function_exists('vs_is_fix_active')) {
    function vs_is_fix_active($check_id) {
        $settings = vs_get_fixes_settings();
        // Por padrão, se não configurado explicitamente como false, a regra é ativa
        if (isset($settings[$check_id])) {
            return (bool) $settings[$check_id];
        }
        return true;
    }
}
```

**Passo 2: Envolver cada hook/regra de segurança no condicional `vs_is_fix_active`**
- Exemplos:
  - `check_hsts`: `if (vs_is_fix_active('check_hsts')) { add_action('send_headers', ...); }`
  - `check_xmlrpc`: `if (vs_is_fix_active('check_xmlrpc')) { add_filter('xmlrpc_enabled', '__return_false'); ... }`
  - `check_author_enumeration`: `if (vs_is_fix_active('check_author_enumeration')) { ... }`

**Passo 3: Transformar a tabela da página administrativa (`vs_render_remediation_admin_page`) em formulário interativo**
- Criar lista com switches estilizados no padrão moderno (toggle switches CSS).
- Processar salvamento via POST com validação de `check_admin_referer('wp_patropi_fixes_save_action', 'wp_patropi_fixes_nonce')`.
- Exibir aviso de sucesso estilizado (`notice notice-success is-dismissible`).

---

### Tarefa 2: Endpoints REST no Plugin Agente (`validar-seguranca-agent`)

**Objetivo:** Expor rotas seguras para que o SaaS possa consultar os fixes instalados e alterar seu estado remotamente.

**Arquivos:**
- Modificar: `plugin-template/validar-seguranca-agent/includes/class-vs-rest-api.php`
- Modificar: `/opt/lampp/htdocs/wordpress/wp-content/plugins/wp-patropi-diagnostico/includes/class-vs-rest-api.php`

**Passo 1: Registrar rotas em `register_routes`**
- `GET /wp-patropi/v1/fixes` -> `handle_get_fixes`
- `POST /wp-patropi/v1/fixes/toggle` -> `handle_toggle_fix`

**Passo 2: Implementar manipuladores**
- `handle_get_fixes()`:
  - Verifica se o plugin `wp-patropi-fixes` está ativo no WordPress (via `is_plugin_active` ou checagem de arquivo).
  - Obtém lista de fixes registrados e seus respectivos estados a partir da opção `wp_patropi_fixes_settings`.
  - Retorna JSON estruturado:
    ```json
    {
      "success": true,
      "plugin_installed": true,
      "plugin_active": true,
      "fixes": [
        {
          "check_id": "check_hsts",
          "title": "Strict-Transport-Security (HSTS)",
          "description": "Cabeçalho Strict-Transport-Security enviado via HTTPS",
          "enabled": true
        }
      ]
    }
    ```
- `handle_toggle_fix($request)`:
  - Recebe `check_id` e `enabled` (boolean).
  - Atualiza a opção `wp_patropi_fixes_settings`.
  - Retorna sucesso e status atualizado.

---

### Tarefa 3: Atualização do Gerador de Plugins no SaaS (`Remediation.php` & `AIService.php`)

**Objetivo:** Garantir que todo novo plugin gerado pelo SaaS já contenha nativamente o suporte a switches e persistência de regras.

**Arquivos:**
- Modificar: `app/Controllers/Api/Remediation.php`
- Modificar: `app/Services/AIService.php`

**Passo 1: Atualizar `buildNativeRemediationPlugin()`**
- Injetar no código gerado:
  - As funções `vs_get_fixes_settings()` e `vs_is_fix_active($check_id)`.
  - A matriz de regras `$pluginFixes` com IDs e títulos.
  - A renderização do formulário interativo com switches e salvamento de configurações.

**Passo 2: Atualizar prompt em `AIService::generateRemediationPlugin()`**
- Adicionar instrução obrigatória para que a IA crie a função de controle `vs_is_fix_active($check_id)` e o formulário com switches.

---

### Tarefa 4: Backend do SaaS — Rotas e Controller de Fixes

**Objetivo:** Criar endpoints proxy seguros no SaaS para consultar e alternar os fixes de um site gerenciado.

**Arquivos:**
- Modificar: `app/Config/Routes.php`
- Modificar: `app/Controllers/Api/Websites.php`

**Passo 1: Adicionar rotas na API do SaaS**
```php
$routes->get('api/websites/(:num)/fixes', 'Api\Websites::getFixes/$1');
$routes->post('api/websites/(:num)/fixes/toggle', 'Api\Websites::toggleFix/$1');
```

**Passo 2: Implementar métodos em `Websites.php`**
- `getFixes($id)`:
  - Verifica permissão do usuário para o website.
  - Dispara requisição com fallback: `makeAgentRequestWithFallback($website['url'], '/fixes', 'GET', $website['agent_token'])`.
  - Retorna dados consolidados para o frontend.
- `toggleFix($id)`:
  - Recebe `check_id` e `enabled`.
  - Dispara requisição: `makeAgentRequestWithFallback($website['url'], '/fixes/toggle', 'POST', $website['agent_token'], ['check_id' => $checkId, 'enabled' => $enabled])`.
  - Retorna confirmação de atualização.

---

### Tarefa 5: Integração no Frontend do SaaS (API Client e Interface de Auditoria)

**Objetivo:** Adicionar os métodos HTTP e renderizar o painel interativo de fixes na aba de Auditoria & Segurança.

**Arquivos:**
- Modificar: `frontend/src/api.ts`
- Modificar: `frontend/src/components/ScanReport.tsx`

**Passo 1: Adicionar métodos em `frontend/src/api.ts`**
```typescript
export const getWebsiteFixes = async (websiteId: number | string) => {
  const res = await api.get(`/websites/${websiteId}/fixes`);
  return res.data;
};

export const toggleWebsiteFix = async (
  websiteId: number | string,
  checkId: string,
  enabled: boolean
) => {
  const res = await api.post(`/websites/${websiteId}/fixes/toggle`, { check_id: checkId, enabled });
  return res.data;
};
```

**Passo 2: Criar seção de gerenciamento em `ScanReport.tsx`**
- Criar estado para os fixes: `fixesList`, `fixesLoading`, `pluginActive`, `togglingCheckId`.
- Carregar fixes ao montar a aba de auditoria.
- Renderizar card **"🛡️ Correções de Segurança Aplicadas (Plugin WP Patropi Fixes)"**:
  - Se o plugin não estiver ativo: alerta sutil com botão para "Gerar Soluções em Lote (Plugin WP)".
  - Se o plugin estiver ativo: grid/tabela elegante com:
    - Nome da Correção e Check ID
    - Switch interativo do Mantine (`<Switch checked={fix.enabled} onChange={...} />`)
    - Badge indicativo (`Ativo` / `Inativo`)
    - Loader individual durante a alteração

**Passo 3: Compilar frontend**
- Executar `npm run build` na pasta `frontend`.

---

### Tarefa 6: Validação End-to-End e Testes

1. **Validação no WordPress:**
   - Acessar `http://localhost/wordpress/wp-admin/admin.php?page=wp-patropi-fixes`.
   - Alternar um fix (ex: Desativar HSTS ou XML-RPC), clicar em Salvar e verificar se a preferência persiste no banco `wp_options`.
2. **Validação no SaaS:**
   - Acessar o painel do website no SaaS na aba **Auditoria & Segurança**.
   - Verificar se as correções ativas são listadas automaticamente.
   - Alternar um switch no SaaS e verificar se o estado muda instantaneamente no WordPress.
3. **Commit & Push:**
   - Comitar e enviar alterações com mensagem descritiva.
