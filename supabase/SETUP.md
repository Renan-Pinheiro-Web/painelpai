# Setup do Supabase — Painel Renato Pinheiro

## 1. Criar projeto novo

- Acesse [supabase.com](https://supabase.com) e crie um **projeto novo** (nunca use
  o projeto da Essenza ou qualquer outro existente).
- Anote a **senha do banco** em lugar seguro.

## 2. Rodar as migrations

No **SQL Editor** do Supabase, rode os arquivos nesta ordem:

1. `supabase/migrations/001_site_products.sql` — cria tabelas e índices
2. `supabase/migrations/002_rls_e_storage.sql` — RLS, Storage e políticas

**Antes de rodar o arquivo 002**, edite o INSERT comentado no final da seção 1
e coloque seu e-mail real no lugar de `COLE_SEU_EMAIL_AQUI`. Descomente a linha
e rode junto com o restante.

## 3. Criar seu usuário

- Vá em **Authentication → Users** e crie um usuário com seu e-mail e senha.
- Confirme o e-mail (se o Supabase pedir confirmação).

## 4. Desligar cadastro público

- Vá em **Authentication → Providers → Email** e **desative "Enable Sign Ups"**.
- Isso impede que qualquer pessoa crie conta no seu projeto.

## 5. Verificar admin_users

- No SQL Editor, rode:
  ```sql
  SELECT * FROM admin_users;
  ```
- Confirme que seu e-mail aparece.

## 6. Copiar credenciais para o painel

- Vá em **Settings → API**.
- Copie apenas:
  - **Project URL** (ex.: `https://xxxxx.supabase.co`)
  - **anon key** (chave pública, segura para o front)
- **NUNCA copie ou use a `service_role key`** — ela ignora todo o RLS.

## 7. Testar

- Rode o script `supabase/tests/rls_check.sql` no SQL Editor para confirmar que
  as políticas estão funcionando.
