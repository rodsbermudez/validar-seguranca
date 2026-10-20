# Guia de Publicação e Deploy: Hostinger VPS com CloudPanel
**Plataforma Vexors (SaaS de Auditoria e Segurança WordPress)**

---

## 📌 Visão Geral da Arquitetura em Produção

* **Sistema Operacional**: Ubuntu 22.04 / 24.04 LTS (Hostinger VPS)
* **Painel de Controle**: CloudPanel
* **Servidor Web**: Nginx
* **Linguagem Backend**: PHP 8.2 ou PHP 8.3 (PHP-FPM)
* **Banco de Dados**: MySQL 8.0 ou MariaDB 10.11+
* **Frontend**: React + Vite (os arquivos compilados residem na pasta `public/`)
* **Document Root**: `/home/{usuario}/htdocs/{dominio}/public`

---

## Passo 1: Criar o Site PHP no CloudPanel

1. Acesse o seu painel **CloudPanel** (ex: `https://ip-do-vps:8443`).
2. No menu lateral, clique em **Sites** e depois no botão **+ Add Site**.
3. Selecione a opção **Create a PHP Site**.
4. Preencha os campos:
   * **Domain Name**: Seu domínio ou subdomínio (ex: `app.vexors.com.br` ou `vexors.app`).
   * **Site User**: Um nome de usuário para o site (ex: `vexors`). Guarde este nome e a senha gerada.
   * **PHP Version**: Selecione **PHP 8.2** ou **PHP 8.3**.
5. Clique em **Create**.

> ⚠️ **PONTO MAIS CRÍTICO NO CLOUDPANEL:**
> Por padrão, o CloudPanel define a raiz em `/home/{usuario}/htdocs/{dominio}/`.
> No CodeIgniter 4, o ponto de entrada da web DEVE ser a pasta `public/`.
>
> **Como ajustar**:
> 1. Na lista de sites, clique no site recém-criado.
> 2. Na aba **Settings**, localize o campo **Document Root**.
> 3. Altere de:
>    `/home/vexors/htdocs/seudominio.com`
>    para:
>    `/home/vexors/htdocs/seudominio.com/public`
> 4. Clique em **Save**.

---

## Passo 2: Criar o Banco de Dados no CloudPanel

1. No CloudPanel, clique no seu site e vá para a aba **Databases**.
2. Clique no botão **+ Add Database**.
3. Preencha os dados:
   * **Database Name**: Ex: `vexors_prod`
   * **Database User**: Ex: `vexors_user`
   * **Password**: Gere uma senha forte e copie.
4. Clique em **Create**.

---

## Passo 3: Clonar o Projeto via SSH no VPS

1. Conecte-se ao seu VPS via terminal SSH (com o usuário do site ou `root`):
   ```bash
   ssh root@ip-do-seu-vps
   ```

2. Acesse a pasta do site criada pelo CloudPanel:
   ```bash
   cd /home/vexors/htdocs/seudominio.com
   ```

3. Remova os arquivos padrão temporários que o CloudPanel cria na pasta:
   ```bash
   rm -rf *
   ```

4. Clone o repositório do projeto:
   ```bash
   git clone https://github.com/rodsbermudez/validar-seguranca.git .
   ```

5. Caso deseje utilizar a branch com as últimas melhorias de logs de erro:
   ```bash
   git checkout error-logs
   # Ou permaneça na 'main' caso já tenha realizado o merge
   ```

---

## Passo 4: Instalar Dependências PHP (Composer)

No mesmo diretório do projeto, execute:

```bash
composer install --no-dev --optimize-autoloader
```

*(Se o composer não estiver no PATH global do CloudPanel, use `/usr/local/bin/composer` ou instale com `curl -sS https://getcomposer.org/installer | php`)*.

---

## Passo 5: Configurar o Arquivo `.env` de Produção

1. Copie o arquivo de exemplo para `.env`:
   ```bash
   cp env .env
   nano .env
   ```

2. Configure as seguintes variáveis essenciais:

```ini
# 1. AMBIENTE EM PRODUÇÃO (Desativa logs de debug visíveis e otimiza cache)
CI_ENVIRONMENT = production

# 2. URL BASE COM HTTPS (Com barra no final)
app.baseURL = 'https://seudominio.com/'

# 3. CONEXÃO COM O BANCO DE DADOS CRIADO NO PASSO 2
database.default.hostname = 127.0.0.1
database.default.database = vexors_prod
database.default.username = vexors_user
database.default.password = sua_senha_forte_aqui
database.default.DBDriver = MySQLi
database.default.DBPrefix = 
database.default.port = 3306

# 4. CHAVE DE INTELIGÊNCIA ARTIFICIAL (OpenCode / OpenAI / etc)
OPENCODE_API_KEY = sua_chave_api_aqui
OPENCODE_API_URL = https://api.opencode.com/v1
OPENCODE_MODEL = opencode/claude-3-7-sonnet

# 5. CHAVE DE CRIPTOGRAFIA / SESSÃO (Gere uma chave segura ou use php spark key:generate)
encryption.key = hex2bin:sua_chave_hex_aqui
```

3. Salve com `Ctrl + O`, `Enter` e saia com `Ctrl + X`.

---

## Passo 6: Executar as Migrações do Banco de Dados

Rode o Spark para criar automaticamente todas as tabelas da plataforma:

```bash
php spark migrate
```

Isso criará a estrutura completa:
* Usuários, Autenticação e Perfis
* Sites cadastrados e tokens dos agentes
* Catálogo de soluções e varreduras
* Tabela de planos e assinaturas
* Central de logs de erro e diagnósticos (`platform_error_logs`)

### Criar o Primeiro Usuário Administrador:
Se o banco for novo, execute uma seed ou crie o primeiro admin via script/Spark:
```bash
php spark db:seed UserSeeder
# Ou crie diretamente via Tinker/MySQL caso não tenha seeder inicial
```

---

## Passo 7: Permissões de Pastas e Segurança

O Nginx e o PHP-FPM precisam de permissão de escrita nas pastas de cache, logs e uploads:

```bash
# Ajusta o proprietário para o usuário do CloudPanel
chown -R vexors:clp /home/vexors/htdocs/seudominio.com

# Garante permissões de escrita na pasta writable
chmod -R 775 /home/vexors/htdocs/seudominio.com/writable
chmod -R 775 /home/vexors/htdocs/seudominio.com/public
```

---

## Passo 8: Ajustar o Nginx VHost no CloudPanel

No painel do CloudPanel, acesse o seu site e clique na aba **Vhost**.

Verifique se o bloco `location /` possui a regra do CodeIgniter 4:

```nginx
location / {
    try_files $uri $uri/ /index.php$is_args$args;
}
```

E para permitir uploads de plugins do WordPress sem timeout nem bloqueio de tamanho de arquivo, aumente o tamanho máximo logo dentro do bloco `server {`:

```nginx
client_max_body_size 64M;
fastcgi_read_timeout 180s;
proxy_read_timeout 180s;
```

Clique em **Save**. O CloudPanel reiniciará o Nginx automaticamente em 2 segundos.

---

## Passo 9: Emitir Certificado SSL Gratuito (HTTPS)

1. No CloudPanel, no seu site, clique na aba **SSL/TLS**.
2. Clique no botão **New Let's Encrypt Certificate**.
3. Confirme o domínio (certifique-se de que o DNS do domínio na Hostinger / Cloudflare já está apontando para o IP do VPS).
4. Clique em **Create and Install**.

Pronto! Seu site já estará acessível via `https://seudominio.com`.

---

## Passo 10: Build do Frontend (Caso Atualize Diretamente no VPS)

No repositório do Git, os arquivos de produção compilados já ficam prontos na pasta `public/assets/`. 

Porém, se no futuro você desejar recompilar o frontend diretamente no VPS:
```bash
cd /home/vexors/htdocs/seudominio.com/frontend
npm install
npm run build
```
O build irá gerar automaticamente os arquivos estáticos dentro de `public/`.

---

## 🛠️ Checklist de Verificação Pós-Deploy:

- [ ] Acessar `https://seudominio.com` no navegador e verificar se a Landing Page carrega normalmente.
- [ ] Fazer login com a conta de Administrador.
- [ ] No menu superior **Configurações**, acessar **Logs de Erros da Plataforma** e verificar se a tela abre sem erros.
- [ ] Testar adicionar um site WordPress e validar o download do plugin agente em ZIP.
- [ ] Testar a conexão do agente WordPress com a plataforma.
