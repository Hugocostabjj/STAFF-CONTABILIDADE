# Site da Staff Assessoria Contábil

Site estático em HTML, CSS e JavaScript puros. Não precisa de instalação nem de build.

## Arquivos

- `index.html`: página pública de apresentação.
- `funcionarios.html`: área da equipe (login e funções internas).
- `assets/config.js`: contatos, link do portal Onvio e lista de funções da equipe. É o arquivo que você mais vai editar.
- `assets/auth.js`: login da equipe. Hoje desligado (`AUTH_MODE: "off"`).
- `assets/main.js` e `assets/style.css`: comportamento e visual.

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

## Antes de publicar

- As imagens estão em `assets/img/` e não dependem do site antigo. Os seis links da seção "Artigos" ainda abrem páginas do `staffassessoria.com` e deixam de funcionar quando o domínio passar para o novo site. Antes de trocar o domínio, escolha o que fazer com eles (publicar os artigos no novo site ou remover a seção).
- O botão "Área do cliente" abre `https://onvio.com.br/staff/#/documents/client` (definido em `ONVIO_PORTAL_URL` em `assets/config.js`). O cliente entra no próprio Onvio com o login e a senha que criou; o site não guarda nem vê essas credenciais.
- Preencha `CRC` e `WHATSAPP` em `assets/config.js`, se quiser exibi-los.

## Login da equipe

O repositório e o site do GitHub Pages são públicos. Senha conferida só no navegador não protege nada, por isso o login está desligado. Para ativar um login de verdade é preciso um serviço com servidor (por exemplo, Supabase Auth) ligado em `assets/auth.js`. Para ver a interface em teste local, troque `AUTH_MODE` para `"demo"` e não publique assim.

Não coloque no repositório senhas, chaves de API, nem dados de clientes.
