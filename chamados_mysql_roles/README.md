# Sistema de Chamados — MySQL (Usuário, Técnico, Administrador)

Arquitetura:
- **MySQL** para banco de dados
- **Node.js + Express + mysql2** (API REST)
- **Frontend SPA** (HTML/CSS/JS puro) com rotas por `hash`

## Requisitos
- Node 18+
- MySQL 8+

## Setup
1) Crie o banco e rode os scripts em `server/sql/` **nesta ordem**:
   - `01_schema_mysql.sql`
   - `02_seed_mysql.sql`

2) Configurar backend:
```bash
cd server
cp .env.example .env   # edite credenciais do MySQL
npm install
npm start
```
O servidor sobe em `http://localhost:3000` e serve a SPA em `/`.

## Login de teste
- Usuário normal: `user@demo.com` / `123`
- Técnico: `tech@demo.com` / `123`
- Admin: `admin@demo.com` / `123` (acessa tela branca)

## Fluxos
- **Usuário**: Login → "Novo Chamado" (nome, gravidade, descrição) → Chat (envia msg, **Concluir** e **Ajuda Presencial**)
- **Técnico**: Login → Painel (Abertos / Concluídos) → Clicar em chamado → Chat técnico (envia msg)
- **Admin**: Login → Tela branca

## API (principais)
- `POST /api/login {email, senha}` → `{ok, user:{id,nome,role}}`
- `POST /api/tickets` (user) → cria chamado
- `GET /api/tickets?status=aberto|concluido` (tech) → lista por status
- `GET /api/tickets/:id` (user dono ou tech) → dados do chamado
- `PATCH /api/tickets/:id/complete` (user dono ou tech) → finaliza
- `PATCH /api/tickets/:id/help` (user dono) → marca pedido de ajuda presencial
- `GET /api/tickets/:id/messages` (user dono ou tech) → mensagens
- `POST /api/tickets/:id/messages` (user dono ou tech) → envia mensagem

> **Auth simples para protótipo**: o backend confia no `x-user-id` e `x-user-role` enviados pelo front (sem JWT). Em produção, troque por sessão/JWT.
