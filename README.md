# Guilherme S. — Design & Motion | Portfólio V3

Versão 2 do site comercial e portfólio com tema preto e magenta, efeitos discretos e foco nos serviços Sites, Social, Motion e Branding.

## O que foi alterado na V2

- Montserrat para textos, navegação e componentes de interface; Oxanium para os títulos de destaque.
- Hero reescrita: “Ideias que ganham forma. Marcas que movem.”
- Waves magenta fluidas (SVG vetorial com animação CSS) no lugar da antiga faixa de textos.
- Espaçamento vertical reduzido nas seções, sem comprometer a leitura.
- Quatro categorias: Sites, Social, Motion e Branding, incluindo o editor demonstrativo.
- Portfólio demonstrativo de quatro peças por categoria; removido o case ilustrativo de aplicativo.
- Microinterações nos botões, filtros, cards e links dos projetos.
- Layout responsivo em desktop e celular, com suporte a movimento reduzido.

## Deploy: GitHub → Netlify

1. Crie um repositório privado `guilherme-s-design-motion` ou atualize o repositório já criado.
2. Envie os arquivos do projeto, inclusive `netlify.toml` e toda a pasta `public`.
3. No Netlify, importe o repositório via GitHub. Configure a pasta de publicação como `public`. **Build command vazio**.
4. O deploy é estático, sem instalação de pacotes ou chaves de API. Alterações no GitHub fazem novos deploys automáticos.
5. Para testar localmente, rode `python -m http.server 8000` dentro de `public` e abra `http://localhost:8000`.

## Arquivos

- `public/index.html` — metadados e carregamento das fontes.
- `public/styles.css` — estilos e animações, incluindo as regras V2 no final.
- `public/app.js` — navegação, conteúdo do catálogo, portfólio, editor e formulários.
- `public/assets/` — logo e ilustrações de demonstração.
- `netlify.toml` — configuração de publicação e cabeçalhos.

## Editor demonstrativo e dados

Acesse `?painel=1` pelo rodapé para editar, reordenar e testar os quatro serviços. Os dados ficam **somente no navegador em localStorage** (chaves V2). Não há autenticação, publicação do catálogo no servidor ou upload na nuvem. O botão de contato prepara um texto e abre o WhatsApp apenas se o número tiver sido configurado; caso contrário, copia a mensagem.

O Portal do Cliente em `?portal=1` continua uma prévia sem login, clientes reais, arquivos ou aprovações. Não use para dados privados. A próxima etapa exigirá autenticação, regras de autorização e persistência no servidor.

As imagens demonstrativas devem ser substituídas por trabalhos reais; não sugerem clientes ou projetos executados. Os preços `R$ XX` e prazos genéricos são placeholders e não constituem proposta comercial final. Ao editar o catálogo para todos os usuários, atualize `DEFAULT_SERVICES` em `public/app.js` e publique novo commit.

## Segurança e acessibilidade

Não coloque senhas, tokens, dados sensíveis ou nomes de clientes nos arquivos públicos. O site tem navegação por teclado, contraste em tema escuro, foco visível e reduz movimento quando a preferência do dispositivo exige.
