# Site da Staff Assessoria Contábil

Site estático em HTML, CSS e JavaScript puros. Não precisa de instalação nem de build.

## Arquivos

- `index.html`: página pública de apresentação (certificado digital, serviços, artigos, contato).
- `funcionarios.html`: apenas redireciona para `equipe/`.
- `equipe/`: área da equipe (painel de certificados e robô de notas). Entra com e-mail e senha pelo Supabase Auth; as permissões valem no banco (RLS).
- `assets/config.js`: contatos e links públicos. É o arquivo que você mais vai editar.
- `assets/main.js`, `assets/chatbot.js` e `assets/style.css`: comportamento, assistente de atendimento e visual.
- `assets/auth.js`: não é mais usado. Pode ser apagado do repositório.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie todos os arquivos desta pasta para a raiz dele.
2. No repositório, abra Settings, depois Pages.
3. Em "Build and deployment", escolha "Deploy from a branch", branch `main`, pasta `/ (root)`, e salve.
4. Em alguns minutos o site abre em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

## Usar o domínio staffassessoria.com

Isso troca o site atual (WordPress) pelo novo. Faça só quando estiver pronto.

1. Em Settings, Pages, preencha "Custom domain" com o domínio e salve. O GitHub cria o arquivo `CNAME` no repositório.
2. No provedor do domínio, aponte o DNS para o GitHub Pages seguindo a documentação oficial do GitHub (registros A para o domínio raiz e CNAME para `www`).
3. Depois que o endereço funcionar, ative "Enforce HTTPS".
4. No Supabase, em Authentication, URL Configuration, troque o Site URL e as Redirect URLs pelo novo endereço de `equipe/`.

## Antes de publicar

- Os links da seção "Artigos" abrem fontes oficiais (Receita Federal e Planalto) e continuam valendo depois da troca de domínio.
- O botão "Área do cliente" abre `https://onvio.com.br/staff/#/documents/client` (definido em `ONVIO_PORTAL_URL` em `assets/config.js`). O cliente entra no próprio Onvio; o site não guarda nem vê essas credenciais.
- Preencha `CRC` em `assets/config.js`, se quiser exibi-lo.

## Segurança (leia antes de enviar arquivos)

O repositório e o site são **públicos**: qualquer pessoa lê todo o código e todo o histórico.

- **Nunca envie** para o repositório: certificados (`.pfx`, `.p12`), senhas, chaves secretas (a `service_role` do Supabase, por exemplo), planilhas ou qualquer dado de clientes. Apagar depois não resolve, porque o arquivo continua no histórico.
- O envio pelo site do GitHub ("Add file, Upload files") **ignora o `.gitignore`**. Confira os nomes dos arquivos antes de arrastar.
- No navegador só pode ficar a chave pública do Supabase (`sb_publishable_...`). Ela é feita para ser pública, mas só é segura se o RLS estiver ativado em todas as tabelas.
- Todas as páginas têm uma política de segurança de conteúdo (CSP) no `<head>`. Se adicionar scripts ou fontes de outro site, é preciso liberar o endereço nessa política.
- Ative a verificação em duas etapas na conta do GitHub e na do Supabase.
