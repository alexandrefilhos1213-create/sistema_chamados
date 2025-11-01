require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, sql } = require('./db.js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==========================
// FUNÇÕES AUXILIARES
// ==========================
function getAuth(req) {
  const id = Number(req.headers['x-user-id'] || 0);
  const role = (req.headers['x-user-role'] || '').toLowerCase();
  return { id, role };
}

function requireRole(...roles) {
  return (req, res, next) => {
    const { role } = getAuth(req);
    if (!roles.includes(role)) return res.status(403).json({ ok: false, error: 'Acesso negado' });
    next();
  };
}

// ==========================
// LOGIN
// ==========================
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body ?? {};
  if (!email || !senha) return res.status(400).json({ ok: false, error: 'Informe email e senha' });

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('senha', sql.NVarChar, senha)
      .query('SELECT id, nome, role FROM dbo.users WHERE email=@email AND senha=@senha');

    if (!result.recordset.length) return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
    res.json({ ok: true, user: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro interno no servidor' });
  }
});

// ==========================
// CRIAR CHAMADO
// ==========================
app.post('/api/tickets', requireRole('user'), async (req, res) => {
  const { id: userId } = getAuth(req);
  const { nome, gravidade, descricao } = req.body ?? {};

  if (!nome || !gravidade || !descricao)
    return res.status(400).json({ ok: false, error: 'Campos obrigatórios ausentes' });

  try {
    const pool = await connectDB();
    const insertResult = await pool.request()
      .input('userId', sql.Int, userId)
      .input('nome_usuario', sql.NVarChar, nome)
      .input('gravidade', sql.NVarChar, gravidade)
      .input('descricao', sql.NVarChar, descricao)
      .input('status', sql.NVarChar, 'aberto')
      .query(`
        INSERT INTO dbo.tickets (user_id, nome_usuario, gravidade, descricao, status, ajuda_presencial, created_at)
        VALUES (@userId, @nome_usuario, @gravidade, @descricao, @status, 0, GETDATE());
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const ticketId = insertResult.recordset[0].id;
    const ticket = await pool.request()
      .input('id', sql.Int, ticketId)
      .query('SELECT * FROM dbo.tickets WHERE id=@id');

    res.json({ ok: true, data: ticket.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao criar chamado' });
  }
});

// ==========================
// LISTAR CHAMADOS (TÉCNICO)
// ==========================
app.get('/api/tickets', requireRole('tech'), async (req, res) => {
  const statusQuery = (req.query.status || 'aberto').toLowerCase();
  const status = statusQuery === 'concluido' ? 'concluido' : 'aberto';

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('status', sql.NVarChar, status)
      .query('SELECT * FROM dbo.tickets WHERE status=@status ORDER BY id DESC');

    res.json({ ok: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao buscar chamados' });
  }
});

// ==========================
// LISTAR CHAMADOS (USUÁRIO)
// ==========================
app.get('/api/user/tickets', requireRole('user'), async (req, res) => {
  const { id: userId } = getAuth(req);
  const statusQuery = (req.query.status || 'aberto').toLowerCase();
  const status = statusQuery === 'concluido' ? 'concluido' : 'aberto';

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('status', sql.NVarChar, status)
      .query('SELECT * FROM dbo.tickets WHERE user_id=@userId AND status=@status ORDER BY id DESC');

    res.json({ ok: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao buscar chamados' });
  }
});

// ==========================
// DETALHAR CHAMADO
// ==========================
app.get('/api/tickets/:id', requireRole('tech', 'user'), async (req, res) => {
  const ticketId = Number(req.params.id);
  const { id: userId, role } = getAuth(req);

  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });

  try {
    const pool = await connectDB();
    const result = await pool.request().input('id', sql.Int, ticketId).query('SELECT * FROM dbo.tickets WHERE id=@id');
    if (!result.recordset.length) return res.status(404).json({ ok: false, error: 'Chamado não encontrado' });

    const ticket = result.recordset[0];
    if (!(role === 'tech' || ticket.user_id === userId))
      return res.status(403).json({ ok: false, error: 'Acesso negado' });

    res.json({ ok: true, data: ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao buscar chamado' });
  }
});

// ==========================
// FINALIZAR CHAMADO
// ==========================
app.patch('/api/tickets/:id/complete', requireRole('user', 'tech'), async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });

  try {
    const pool = await connectDB();
    const ticketRes = await pool.request().input('id', sql.Int, ticketId).query('SELECT * FROM dbo.tickets WHERE id=@id');
    if (!ticketRes.recordset.length) return res.status(404).json({ ok: false, error: 'Chamado não encontrado' });

    await pool.request()
      .input('id', sql.Int, ticketId)
      .query('UPDATE dbo.tickets SET status=\'concluido\', closed_at=GETDATE() WHERE id=@id');

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao finalizar chamado' });
  }
});

// ==========================
// AJUDA PRESENCIAL
// ==========================
app.patch('/api/tickets/:id/help', requireRole('user'), async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });

  try {
    const pool = await connectDB();
    await pool.request()
      .input('id', sql.Int, ticketId)
      .query('UPDATE dbo.tickets SET ajuda_presencial = 1 WHERE id=@id');

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao solicitar ajuda presencial' });
  }
});

// ==========================
// MENSAGENS
// ==========================
app.get('/api/tickets/:id/messages', requireRole('tech', 'user'), async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('ticket_id', sql.Int, ticketId)
      .query('SELECT * FROM dbo.messages WHERE ticket_id=@ticket_id ORDER BY created_at ASC');

    res.json({ ok: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao buscar mensagens' });
  }
});

app.post('/api/tickets/:id/messages', requireRole('tech', 'user'), async (req, res) => {
  const ticketId = Number(req.params.id);
  const { id: userId, role } = getAuth(req);
  const { content } = req.body ?? {};

  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });
  if (!content) return res.status(400).json({ ok: false, error: 'Mensagem vazia' });

  try {
    const pool = await connectDB();
    await pool.request()
      .input('ticket_id', sql.Int, ticketId)
      .input('sender_id', sql.Int, userId)
      .input('sender_role', sql.NVarChar, role)
      .input('content', sql.NVarChar, content)
      .query('INSERT INTO dbo.messages (ticket_id, sender_id, sender_role, content, created_at) VALUES (@ticket_id, @sender_id, @sender_role, @content, GETDATE())');

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao enviar mensagem' });
  }
});

// ==========================
// MARCAR MENSAGENS COMO LIDAS
// ==========================
app.patch('/api/tickets/:id/read', requireRole('tech', 'user'), async (req, res) => {
  const ticketId = Number(req.params.id);
  const { role } = getAuth(req);
  if (!ticketId) return res.status(400).json({ ok: false, error: 'ID inválido' });

  try {
    const pool = await connectDB();
    let query = '';
    if (role === 'user') query = 'UPDATE dbo.messages SET read_by_user = 1 WHERE ticket_id=@ticket_id';
    else if (role === 'tech') query = 'UPDATE dbo.messages SET read_by_tech = 1 WHERE ticket_id=@ticket_id';
    else return res.status(403).json({ ok: false, error: 'Função não permitida' });

    await pool.request().input('ticket_id', sql.Int, ticketId).query(query);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erro ao atualizar mensagens' });
  }
});

// ==========================
// SERVIDOR
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
