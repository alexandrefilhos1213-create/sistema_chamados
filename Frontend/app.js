// ==========================
// ESTADO GLOBAL
// ==========================
const state = {
  user: null,
  ticket: null,
  techView: 'abertos',
  unread: {},               // mensagens não lidas por ticket
  lastMsgCountPerTicket: {} // total de mensagens vistas localmente
};

let techChatInterval = null;
let userChatInterval = null;
let techTableInterval = null;
let notificationInterval = null;

// ==========================
// URL DO BACKEND
// ==========================
const API_BASE = 'https://sistema-chamados-6h91.onrender.com';

// ==========================
// API
// ==========================
const API = {
  async login(email, senha) {
    try {
      const r = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      return r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async post(path, body) {
    try {
      const r = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
      return r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async get(path) {
    try {
      const r = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
      return r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async patch(path, body) {
    try {
      const r = await fetch(`${API_BASE}${path}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: body ? JSON.stringify(body) : undefined
      });
      return r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
};

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (state.user) {
    h['x-user-id'] = state.user.id;
    h['x-user-role'] = state.user.role;
  }
  return h;
}

// ==========================
// ROTEAMENTO
// ==========================
function route(to) {
  document.querySelectorAll('section[data-route]').forEach(s => s.classList.add('hidden'));
  const el = document.querySelector(`section[data-route="${to}"]`);
  if (el) el.classList.remove('hidden');
}

function setWho() {
  const whoEl = document.getElementById('who');
  whoEl.textContent = state.user ? `${state.user.nome} (${state.user.role})` : '';
}

// ==========================
// INICIAL
// ==========================
window.addEventListener('DOMContentLoaded', () => {
  route('login');
  setWho();
  setupLogin();
});

// ==========================
// LOGIN
// ==========================
function setupLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const senha = document.getElementById('senha').value;
    const res = await API.login(email, senha);
    if (!res.ok) return alert(res.error || 'Falha no login');

    state.user = res.user;
    setWho();

    if (state.user.role === 'user') {
      route('user-hub');
      setupUserHub();
    } else if (state.user.role === 'tech') {
      route('tech-home');
      setupTechHome();
    } else if (state.user.role === 'admin') {
      route('admin-blank');
    }
  };
}

// ==========================
// NOTIFICAÇÕES
// ==========================
async function updateUnread(ticketId) {
  if (!ticketId) return;
  const res = await API.get(`/api/tickets/${ticketId}/messages`);
  if (!res.ok) return;

  const messages = res.data;
  const role = state.user.role;

  let unreadCount = 0;
  messages.forEach(m => {
    if (role === 'user' && !m.read_by_user && m.sender_role === 'tech') unreadCount++;
    if (role === 'tech' && !m.read_by_tech && m.sender_role === 'user') unreadCount++;
  });

  state.unread[ticketId] = unreadCount;

  // Atualiza badge na tabela
  const btn = document.querySelector(`button[data-open="${ticketId}"]`);
  if (btn)
    btn.innerHTML = `Abrir ${unreadCount ? `<span class="badge">${unreadCount}</span>` : ''}`;
}

// ==========================
// USER: HUB
// ==========================
function setupUserHub() {
  const tbody = document.getElementById('user-hub-tbody');
  const tabs = document.querySelectorAll('.user-tab');
  const newTicketBtn = document.getElementById('user-hub-new');

  tabs.forEach(t => {
    t.onclick = () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      loadUserHubTable(t.dataset.tab);
    };
  });

  if (newTicketBtn)
    newTicketBtn.onclick = () => {
      route('user-new');
      setupUserNew();
    };

  async function loadUserHubTable(tab) {
    const status = tab === 'concluidos' ? 'concluido' : 'aberto';
    const r = await API.get(`/api/user/tickets?status=${status}`);
    if (!r.ok)
      return (tbody.innerHTML = `<tr><td colspan="5">Erro ou acesso negado</td></tr>`);

    const tickets = r.data;
    if (!tickets.length)
      return (tbody.innerHTML = `<tr><td colspan="5">Nenhum chamado encontrado</td></tr>`);

    tbody.innerHTML = tickets
      .map(t => {
        const unread = state.unread[t.id] || 0;
        const badge = unread ? `<span class="badge">${unread}</span>` : '';
        return `<tr>
          <td>${t.id}</td>
          <td>${t.gravidade}</td>
          <td>${t.descricao}</td>
          <td>${t.status}</td>
          <td><button data-open="${t.id}" class="btn">Abrir ${badge}</button></td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('button[data-open]').forEach(b =>
      b.addEventListener('click', () => openUserChat(Number(b.dataset.open)))
    );

    tickets.forEach(t => updateUnread(t.id));
  }

  loadUserHubTable('abertos');

  if (notificationInterval) clearInterval(notificationInterval);
  notificationInterval = setInterval(() => {
    const tickets = Array.from(tbody.querySelectorAll('button[data-open]')).map(b =>
      Number(b.dataset.open)
    );
    tickets.forEach(tid => updateUnread(tid));
  }, 3000);
}

// ==========================
// USER: NOVO CHAMADO
// ==========================
function setupUserNew() {
  const form = document.getElementById('ticket-form');
  const backBtn = document.getElementById('user-new-back');

  document.getElementById('nome').value = state.user.nome || '';
  document.getElementById('gravidade').value = '';
  document.getElementById('descricao').value = '';

  if (backBtn)
    backBtn.onclick = () => {
      route('user-hub');
      setupUserHub();
    };

  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const nome = document.getElementById('nome').value.trim();
    const gravidade = document.getElementById('gravidade').value;
    const descricao = document.getElementById('descricao').value.trim();

    const r = await API.post('/api/tickets', { nome, gravidade, descricao });
    if (!r.ok) return alert(r.error || 'Erro ao criar chamado');

    state.ticket = r.data;
    await openUserChat(state.ticket.id);
  };
}

// ==========================
// USER: CHAT
// ==========================
async function openUserChat(ticketId) {
  const ticketRes = await API.get(`/api/tickets/${ticketId}`);
  if (!ticketRes.ok) return alert(ticketRes.error || 'Erro ao abrir chamado');

  state.ticket = ticketRes.data;
  route('user-chat');

  const header = document.getElementById('user-chat-header');
  const box = document.getElementById('user-chatbox');
  const msgInput = document.getElementById('user-msg');
  const sendBtn = document.getElementById('user-send');
  const completeBtn = document.getElementById('user-complete');
  const helpBtn = document.getElementById('user-help');
  const backBtn = document.getElementById('user-chat-back');

  if (backBtn) {
    backBtn.onclick = () => {
      clearInterval(userChatInterval);
      route('user-hub');
      setupUserHub();
    };
  }

  async function loadMessages() {
    await API.patch(`/api/tickets/${ticketId}/read`);
    const res = await API.get(`/api/tickets/${ticketId}/messages`);
    if (!res.ok) return;
    const msgs = res.data;

    const frag = document.createDocumentFragment();
    msgs.forEach(m => {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (m.sender_role === 'tech' ? 'left' : 'right');
      div.innerHTML = `
        <div class="msg-header">${m.sender_role === 'tech' ? 'Técnico' : state.user.nome}</div>
        <div class="msg-content">${m.content}</div>`;
      frag.appendChild(div);
    });
    box.innerHTML = '';
    box.appendChild(frag);
    box.scrollTop = box.scrollHeight;
    updateUnread(ticketId);
  }

  await loadMessages();

  if (userChatInterval) clearInterval(userChatInterval);
  userChatInterval = setInterval(loadMessages, 2000);

  if (sendBtn && msgInput)
    sendBtn.onclick = async () => {
      const v = msgInput.value.trim();
      if (!v) return;
      const r = await API.post(`/api/tickets/${ticketId}/messages`, { content: v });
      if (r.ok) {
        msgInput.value = '';
        await loadMessages();
      }
    };

  if (completeBtn)
    completeBtn.onclick = async () => {
      const r = await API.patch(`/api/tickets/${ticketId}/complete`);
      if (r.ok) {
        alert('Chamado encerrado com sucesso.');
        clearInterval(userChatInterval);
        route('user-hub');
        setupUserHub();
      }
    };

  if (helpBtn)
    helpBtn.onclick = async () => {
      const r = await API.patch(`/api/tickets/${ticketId}/help`);
      if (r.ok) alert('⚠️ Ajuda presencial solicitada!');
    };
}

// ==========================
// TECH: HOME
// ==========================
function setupTechHome() {
  const tbody = document.getElementById('tech-tbody');
  const tabs = document.querySelectorAll('.tab');

  tabs.forEach(t => {
    t.onclick = async () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      state.techView = t.dataset.tab === 'concluidos' ? 'concluidos' : 'abertos';
      await loadTechTable();
    };
  });

  async function loadTechTable() {
    const status = state.techView === 'concluidos' ? 'concluido' : 'aberto';
    const r = await API.get(`/api/tickets?status=${status}`);
    if (!r.ok)
      return (tbody.innerHTML = `<tr><td colspan="6">Erro: ${r.error}</td></tr>`);

    tbody.innerHTML = r.data
      .map(t => {
        const unread = state.unread[t.id] || 0;
        const badge = unread ? `<span class="badge">${unread}</span>` : '';
        const helpBadge = t.ajuda_presencial ? `<span class="ajuda-presencial">⚠️</span>` : '';
        const completeBtn = t.status === 'aberto'
          ? `<button data-complete="${t.id}" class="btn">Finalizar</button>`
          : '';
        return `<tr>
          <td>${t.id}</td>
          <td>${t.nome_usuario}</td>
          <td>${t.gravidade}</td>
          <td>${t.descricao}</td>
          <td>${badge}${helpBadge}</td>
          <td>
            <button data-open="${t.id}" class="btn">Abrir</button>
            ${completeBtn}
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('button[data-open]').forEach(b =>
      b.addEventListener('click', () => openTechChat(Number(b.dataset.open)))
    );
    tbody.querySelectorAll('button[data-complete]').forEach(b =>
      b.addEventListener('click', async () => {
        const id = Number(b.dataset.complete);
        const r = await API.patch(`/api/tickets/${id}/complete`);
        if (r.ok) await loadTechTable();
      })
    );

    r.data.forEach(t => updateUnread(t.id));
  }

  loadTechTable();

  if (techTableInterval) clearInterval(techTableInterval);
  techTableInterval = setInterval(loadTechTable, 3000);
}

// ==========================
// TECH: CHAT
// ==========================
async function openTechChat(ticketId) {
  const ticketRes = await API.get(`/api/tickets/${ticketId}`);
  if (!ticketRes.ok) return alert(ticketRes.error || 'Erro ao abrir chamado');

  state.ticket = ticketRes.data;
  route('tech-chat');

  const header = document.getElementById('tech-ticket-head');
  const box = document.getElementById('tech-chatbox');
  const msgInput = document.getElementById('tech-msg');
  const sendBtn = document.getElementById('tech-send');
  const backBtn = document.getElementById('tech-back');

  if (backBtn) {
    backBtn.onclick = () => {
      clearInterval(techChatInterval);
      route('tech-home');
      setupTechHome();
    };
  }

  async function loadMessages() {
    await API.patch(`/api/tickets/${ticketId}/read`);
    const res = await API.get(`/api/tickets/${ticketId}/messages`);
    if (!res.ok) return;

    const msgs = res.data;
    const frag = document.createDocumentFragment();
    msgs.forEach(m => {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (m.sender_role === 'tech' ? 'left' : 'right');
      div.innerHTML = `
        <div class="msg-header">${m.sender_role === 'tech' ? 'Técnico' : m.sender_role}</div>
        <div class="msg-content">${m.content}</div>`;
      frag.appendChild(div);
    });
    box.innerHTML = '';
    box.appendChild(frag);
    box.scrollTop = box.scrollHeight;
    updateUnread(ticketId);
  }

  await loadMessages();

  if (techChatInterval) clearInterval(techChatInterval);
  techChatInterval = setInterval(loadMessages, 2000);

  if (sendBtn && msgInput)
    sendBtn.onclick = async () => {
      const v = msgInput.value.trim();
      if (!v) return;
      const r = await API.post(`/api/tickets/${ticketId}/messages`, { content: v });
      if (r.ok) msgInput.value = '';
      await loadMessages();
    };
}
