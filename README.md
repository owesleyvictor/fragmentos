# Criador de UTMs da Gude

App para criar e organizar campanhas de UTM, com QR Code e exportação para Excel. Os dados são salvos no Supabase, então funcionam de qualquer dispositivo/navegador.

## Como configurar (uma vez só)

1. Crie uma conta gratuita em https://supabase.com e crie um novo projeto (qualquer nome, região São Paulo se disponível).
2. No painel do projeto, vá em **SQL Editor** > **New query**, cole o conteúdo do arquivo `supabase-schema.sql` deste repositório e clique em **Run**. Isso cria as tabelas `campaigns` e `tags`.
3. Vá em **Project Settings > API**. Copie o **Project URL** e a chave **anon public**.
4. Abra o arquivo `config.js` deste projeto e cole os dois valores:
   ```js
   window.SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   window.SUPABASE_ANON_KEY = "ey....";
   ```
5. Salve e abra `index.html` no navegador (ou publique os arquivos em qualquer hospedagem estática, ex: GitHub Pages, Netlify, Vercel).

A partir daí, qualquer pessoa que acessar o site com esse `config.js` vê e edita os mesmos dados — sem necessidade de login, conforme solicitado. A chave "anon" é pública por design do Supabase; as regras de acesso estão definidas no próprio `supabase-schema.sql`.

## Estrutura
- `index.html` / `styles.css` / `app.js` — aplicação
- `supabase-schema.sql` — script de criação das tabelas no Supabase
- `config.js` — credenciais do seu projeto Supabase
