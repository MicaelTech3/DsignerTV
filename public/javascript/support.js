// ======================== support.js ==========================
// Suporte: envio de chamados, lista de chamados, chat em tempo real

const _sdb   = window.authModule.database;
const _sauth = window.authModule.auth;

// ─── Status → label + cor ───────────────────────────────────────────────────
const STATUS_MAP = {
  open:             { label: 'Aberto',              color: '#3b82f6' },
  pending:          { label: 'Aguardando resposta', color: '#f59e0b' },
  awaiting_payment: { label: 'Aguardando pagto.',   color: '#f59e0b' },
  proof_sent:       { label: 'Comprovante enviado', color: '#a78bfa' },
  closed:           { label: 'Fechado',             color: '#6b7280' },
  paid:             { label: 'Pago ✓',              color: '#22c55e' },
};

// ─── Ponto de entrada chamado pelo main.js ──────────────────────────────────
export function initSupport() {
  // Injeta a UI (botão toggle + modal de chat)
  injectSupportUI();

  // Aguarda autenticação
  _sauth.onAuthStateChanged(user => {
    if (!user) return;
    const userId = user.email.replace(/\./g, ',');
    setupSupportForm(user, userId);
    setupTicketToggle(userId);
  });
}

// ─── Botão "Ver meus chamados" ───────────────────────────────────────────────
function setupTicketToggle(userId) {
  const btn       = document.getElementById('toggle-ticket-list-btn');
  const listWrap  = document.getElementById('support-history-wrap');
  if (!btn || !listWrap) return;

  // Estado inicial: fechado
  listWrap.style.display = 'none';

  btn.addEventListener('click', async () => {
    const isOpen = listWrap.style.display !== 'none';
    if (isOpen) {
      listWrap.style.display = 'none';
      updateToggleBtnText(btn, false, 0);
    } else {
      listWrap.style.display = 'block';
      updateToggleBtnText(btn, true, 0);
      await loadTicketHistory(userId, btn);
    }
  });
}

function updateToggleBtnText(btn, isOpen, unread) {
  const badge = unread > 0
    ? ` <span style="background:#ef4444;color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;font-family:monospace;vertical-align:middle;">${unread}</span>`
    : '';
  btn.innerHTML = (isOpen ? '▲ Fechar chamados' : '📋 Ver meus chamados') + badge;
}

// ─── Formulário: enviar novo chamado ────────────────────────────────────────
function setupSupportForm(user, userId) {
  const form    = document.getElementById('support-form');
  const msgEl   = document.getElementById('support-message');
  const emailEl = document.getElementById('support-email');

  if (emailEl && !emailEl.value) emailEl.value = user.email;
  if (!form) return;

  // Remove listener anterior se houver (evita duplicação)
  if (form._supportInit) return;
  form._supportInit = true;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const email   = (document.getElementById('support-email')?.value || '').trim();
    const empresa = (document.getElementById('support-empresa')?.value || '').trim();
    const assunto = (document.getElementById('support-assunto')?.value || '').trim();
    const msg     = (document.getElementById('support-chamado')?.value || '').trim();

    if (!assunto || !msg) {
      showSupportMsg(msgEl, 'Preencha assunto e mensagem.', 'error');
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

    try {
      const ticket = {
        userId,
        email:     email || user.email,
        empresa:   empresa || '',
        subject:   assunto,
        message:   msg,
        status:    'open',
        type:      'support',
        unreadDev:  true,
        unreadUser: false,
        createdAt:  Date.now(),
        updatedAt:  Date.now(),
      };

      await _sdb.ref('support_tickets').push(ticket);

      showSupportMsg(msgEl, '✅ Chamado enviado! Responderemos em breve.', 'success');
      form.reset();
      if (emailEl) emailEl.value = user.email;

      // Abre a lista automaticamente após envio
      const listWrap  = document.getElementById('support-history-wrap');
      const toggleBtn = document.getElementById('toggle-ticket-list-btn');
      if (listWrap) listWrap.style.display = 'block';
      if (toggleBtn) updateToggleBtnText(toggleBtn, true, 0);

      await loadTicketHistory(userId, toggleBtn);

    } catch(err) {
      console.error('submitSupport:', err);
      showSupportMsg(msgEl, 'Erro ao enviar. Tente novamente.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Enviar Chamado'; }
    }
  });
}

// ─── Carrega e renderiza histórico de chamados ──────────────────────────────
export async function loadTicketHistory(userId, toggleBtn) {
  const list  = document.getElementById('support-history-list');
  const empty = document.getElementById('support-history-empty');
  if (!list) return;

  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ink-muted);font-size:13px;">Carregando chamados...</div>';

  try {
    const snap = await _sdb.ref('support_tickets')
      .orderByChild('userId')
      .equalTo(userId)
      .once('value');

    const data = snap.val() || {};
    const tickets = Object.entries(data)
      .map(([id, t]) => ({ id, ...t }))
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

    // Conta não-lidos para badge
    const unread = tickets.filter(t => t.unreadUser).length;
    if (toggleBtn) {
      const listWrap = document.getElementById('support-history-wrap');
      const isOpen   = listWrap?.style.display !== 'none';
      updateToggleBtnText(toggleBtn, isOpen, unread);
    }

    list.innerHTML = '';

    if (tickets.length === 0) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    for (const ticket of tickets) {
      list.appendChild(buildTicketCard(ticket, userId));
    }

    // Marcar unreadUser como false
    for (const ticket of tickets) {
      if (ticket.unreadUser) {
        _sdb.ref(`support_tickets/${ticket.id}`).update({ unreadUser: false }).catch(() => {});
      }
    }

  } catch(e) {
    console.error('loadTicketHistory:', e);
    list.innerHTML = '<div style="color:var(--ink-muted);font-size:13px;padding:12px;">Erro ao carregar chamados.</div>';
  }
}

// ─── Constrói card de ticket ─────────────────────────────────────────────────
function buildTicketCard(ticket, userId) {
  const wrap = document.createElement('div');
  wrap.className = 'support-ticket-item';

  const st   = STATUS_MAP[ticket.status] || { label: ticket.status || 'Aberto', color: '#6b7280' };
  const date = ticket.updatedAt
    ? new Date(ticket.updatedAt).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : '—';

  const isBilling = ['awaiting_payment','proof_sent'].includes(ticket.status);
  const unreadBadge = ticket.unreadUser
    ? '<span class="ticket-unread-dot">NOVO</span>'
    : '';

  wrap.innerHTML = `
    <div class="ticket-item-header">
      <span class="ticket-item-subject">${escHtml(ticket.subject || 'Sem assunto')}</span>
      <span class="ticket-item-status" style="color:${st.color}">${st.label}</span>
    </div>
    <div class="ticket-item-meta">
      <span>${date}</span>
      ${unreadBadge}
      ${isBilling ? '<span style="font-size:10px;background:rgba(245,158,11,.15);color:#f59e0b;padding:1px 7px;border-radius:6px;font-family:monospace;font-weight:700;">COBRANÇA</span>' : ''}
    </div>
    <div class="ticket-item-preview">${escHtml((ticket.message || '').slice(0, 120))}${(ticket.message||'').length > 120 ? '…' : ''}</div>

    ${ticket.devNote ? `
    <div style="margin-top:8px;padding:8px 10px;background:var(--bg-soft,rgba(255,255,255,.03));border-left:3px solid var(--accent);border-radius:0 6px 6px 0;font-size:12px;color:var(--ink-muted);">
      <span style="font-size:10px;color:var(--accent);font-weight:700;font-family:monospace;display:block;margin-bottom:2px;">RESPOSTA DA EQUIPE</span>
      ${escHtml(ticket.devNote)}
    </div>` : ''}

    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
      <button class="_btn-chat"
        style="font-size:12px;padding:5px 12px;border:1px solid var(--line,#2a2a2a);border-radius:6px;background:transparent;color:var(--ink-muted);cursor:pointer;">
        💬 Ver conversa
      </button>
      ${isBilling ? `
      <button class="_btn-go-billing"
        style="font-size:12px;padding:5px 12px;border:1px solid #f59e0b;border-radius:6px;background:rgba(245,158,11,.08);color:#f59e0b;cursor:pointer;">
        💰 Ver cobrança
      </button>` : ''}
    </div>
  `;

  wrap.querySelector('._btn-chat')?.addEventListener('click', () => openChat(ticket, userId));
  wrap.querySelector('._btn-go-billing')?.addEventListener('click', () => {
    document.querySelector('[data-section="perfil-section"]')?.click();
  });

  return wrap;
}

// ─── Chat em tempo real ──────────────────────────────────────────────────────
let _chatId   = null;
let _chatRef  = null;

function openChat(ticket, userId) {
  const modal = document.getElementById('_sup-chat-modal');
  if (!modal) return;

  _chatId = ticket.id;

  const st = STATUS_MAP[ticket.status] || { label: ticket.status, color: '#6b7280' };
  document.getElementById('_sch-title').textContent  = ticket.subject || 'Conversa';
  document.getElementById('_sch-status').textContent = st.label;
  document.getElementById('_sch-status').style.color = st.color;
  document.getElementById('_sch-orig').textContent   = ticket.message || '';

  modal.style.display = 'flex';

  // Listener em tempo real das mensagens
  if (_chatRef) _chatRef.off('value');
  _chatRef = _sdb.ref(`support_tickets/${ticket.id}/messages`);
  _chatRef.on('value', snap => renderMessages(snap.val(), userId));

  // Marcar como lido
  _sdb.ref(`support_tickets/${ticket.id}`).update({ unreadUser: false }).catch(() => {});

  setTimeout(() => document.getElementById('_sch-input')?.focus(), 100);
}

function closeChat() {
  const modal = document.getElementById('_sup-chat-modal');
  if (modal) modal.style.display = 'none';
  if (_chatRef) { _chatRef.off('value'); _chatRef = null; }
  _chatId = null;
}

function renderMessages(messages, userId) {
  const container = document.getElementById('_sch-msgs');
  if (!container) return;

  if (!messages || Object.keys(messages).length === 0) {
    container.innerHTML = '<div style="text-align:center;font-size:12px;color:var(--ink-dim);padding:24px">Nenhuma mensagem ainda.<br>Aguarde resposta da equipe.</div>';
    return;
  }

  const sorted = Object.entries(messages)
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => (a.sentAt||0) - (b.sentAt||0));

  container.innerHTML = '';
  for (const msg of sorted) {
    const isUser = msg.role === 'user' || msg.userId === userId;
    const time   = msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '';
    const el = document.createElement('div');
    el.style.cssText = `display:flex;flex-direction:column;align-items:${isUser ? 'flex-end' : 'flex-start'};`;
    el.innerHTML = `
      <div style="max-width:80%;padding:9px 13px;border-radius:12px;font-size:13px;line-height:1.5;
        ${isUser
          ? 'background:var(--accent,#00d4ff);color:#000;border-bottom-right-radius:3px;'
          : 'background:var(--bg-soft,rgba(255,255,255,.06));border:1px solid var(--line,#2a2a2a);color:var(--ink);border-bottom-left-radius:3px;'}">
        <div style="font-size:10px;font-weight:700;opacity:.7;margin-bottom:3px;font-family:monospace;">${isUser ? 'Você' : '🛠 Equipe DSigner'}</div>
        ${escHtml(msg.text || '')}
        <div style="font-size:10px;opacity:.55;margin-top:4px;text-align:right;font-family:monospace;">${time}</div>
      </div>
    `;
    container.appendChild(el);
  }
  container.scrollTop = container.scrollHeight;
}

async function sendMsg() {
  if (!_chatId) return;
  const input = document.getElementById('_sch-input');
  const text  = (input?.value || '').trim();
  if (!text) return;

  const user = _sauth.currentUser;
  if (!user) return;

  input.value = '';
  input.disabled = true;

  try {
    const msg = {
      role:   'user',
      userId: user.email.replace(/\./g, ','),
      email:  user.email,
      text,
      sentAt: Date.now(),
    };
    await _sdb.ref(`support_tickets/${_chatId}/messages`).push(msg);
    await _sdb.ref(`support_tickets/${_chatId}`).update({
      unreadDev: true,
      updatedAt: Date.now(),
      status: 'pending',
    });
  } catch(e) {
    console.error('sendMsg:', e);
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// ─── Injeta UI dinamicamente no DOM ─────────────────────────────────────────
function injectSupportUI() {
  // 1. Botão toggle e wrapper da lista
  const histSection = document.querySelector('#support-section');
  if (histSection) {
    // Adiciona botão toggle antes da lista se não existir
    if (!document.getElementById('toggle-ticket-list-btn')) {
      const btn = document.createElement('button');
      btn.id = 'toggle-ticket-list-btn';
      btn.className = 'btn';
      btn.style.cssText = 'font-size:13px;margin-bottom:12px;display:block;';
      btn.textContent = '📋 Ver meus chamados';

      // Envolve a lista num wrapper controlável
      const list = document.getElementById('support-history-list');
      const empty = document.getElementById('support-history-empty');
      if (list) {
        // Cria wrapper
        const wrap = document.createElement('div');
        wrap.id = 'support-history-wrap';
        wrap.style.display = 'none';
        list.parentNode.insertBefore(wrap, list);
        wrap.appendChild(list);
        if (empty) wrap.appendChild(empty);

        // Insere botão antes do wrap
        wrap.parentNode.insertBefore(btn, wrap);
      }
    }
  }

  // 2. Modal de chat
  if (!document.getElementById('_sup-chat-modal')) {
    const modal = document.createElement('div');
    modal.id = '_sup-chat-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.82);align-items:center;justify-content:center;padding:14px;';
    modal.onclick = e => { if (e.target === modal) closeChat(); };
    modal.innerHTML = `
      <div style="background:var(--bg-card,#111);border:1px solid var(--line,#2a2a2a);border-radius:14px;width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.6);">
        <div style="padding:13px 16px;border-bottom:1px solid var(--line,#2a2a2a);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;">
          <div style="flex:1;min-width:0;">
            <div id="_sch-title" style="font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
            <div id="_sch-status" style="font-size:11px;font-family:monospace;margin-top:2px;"></div>
          </div>
          <button onclick="window._closeSupChat()" style="background:none;border:none;font-size:26px;cursor:pointer;color:var(--ink-muted);line-height:1;flex-shrink:0;padding:0 4px;">×</button>
        </div>
        <div style="padding:8px 14px;border-bottom:1px solid var(--line,#2a2a2a);background:var(--bg-soft,rgba(255,255,255,.02));flex-shrink:0;">
          <div style="font-size:10px;font-family:monospace;color:var(--ink-dim);margin-bottom:2px;">MENSAGEM ORIGINAL</div>
          <div id="_sch-orig" style="font-size:12px;color:var(--ink-muted);max-height:50px;overflow:hidden;line-height:1.4;"></div>
        </div>
        <div id="_sch-msgs" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;min-height:80px;"></div>
        <div style="padding:10px 12px;border-top:1px solid var(--line,#2a2a2a);display:flex;gap:8px;align-items:flex-end;flex-shrink:0;">
          <textarea id="_sch-input" rows="2" placeholder="Escreva sua mensagem... (Enter envia)"
            style="flex:1;background:var(--field,#1a1a2e);color:var(--ink);border:1px solid var(--line,#2a2a2a);border-radius:8px;padding:8px 10px;resize:none;font-family:inherit;font-size:13px;outline:none;"></textarea>
          <button onclick="window._sendSupMsg()" class="btn" style="padding:8px 16px;white-space:nowrap;flex-shrink:0;">Enviar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Enter para enviar
    document.getElementById('_sch-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
  }

  // Expõe globais para onclick inline
  window._closeSupChat = closeChat;
  window._sendSupMsg   = sendMsg;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────
function showSupportMsg(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : 'var(--ink-muted)';
  if (type !== 'info') setTimeout(() => { el.textContent = ''; }, 6000);
}

function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}