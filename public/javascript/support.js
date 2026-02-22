// ======================== support.js ==========================
// Módulo de Suporte — painel do usuário
// Gerencia envio de chamados, histórico e chat em tempo real com o dev

import { getCurrentUserId } from './state.js';
import { showToast } from './toast.js';

const authModule = window.authModule;

let chatListener  = null;
let currentTicketId = null;

export function initSupport() {
  // Pré-preenche email com o do usuário logado
  const emailEl = document.getElementById('support-email');
  const uid = getCurrentUserId();
  if (emailEl && uid) emailEl.value = uid.replace(/,/g, '.');

  const form = document.getElementById('support-form');
  if (form) {
    // Remove listener antigo se houver (caso initSupport seja chamado mais de uma vez)
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitTicket();
    });
  }

  // Recarrega lista toda vez que a seção é aberta
  loadUserTickets();

  // Delegação de clique para "Abrir Conversa"
  const historyList = document.getElementById('support-history-list');
  if (historyList) {
    historyList.replaceWith(historyList.cloneNode(true));
    document.getElementById('support-history-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.open-chat-btn');
      if (btn) openChatModal(btn.dataset.ticketId);
    });
  }

  // Botão fechar modal
  const closeBtn = document.getElementById('close-chat-modal');
  if (closeBtn) {
    closeBtn.replaceWith(closeBtn.cloneNode(true));
    document.getElementById('close-chat-modal').addEventListener('click', closeChatModal);
  }

  // Fechar clicando fora
  const chatModal = document.getElementById('chat-modal');
  if (chatModal) {
    chatModal.addEventListener('click', (e) => {
      if (e.target === chatModal) closeChatModal();
    });
  }

  // Enviar mensagem
  const sendBtn = document.getElementById('send-chat-btn');
  if (sendBtn) {
    sendBtn.replaceWith(sendBtn.cloneNode(true));
    document.getElementById('send-chat-btn').addEventListener('click', sendChatMessage);
  }

  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.replaceWith(chatInput.cloneNode(true));
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
  }
}

// ────────────────────────────────────────────────────────────
// Enviar novo chamado
// ────────────────────────────────────────────────────────────
async function submitTicket() {
  const currentUserId = getCurrentUserId();
  if (!navigator.onLine) { showToast('Sem internet', 'error'); return; }

  const emailEl   = document.getElementById('support-email');
  const empresaEl = document.getElementById('support-empresa');
  const assuntoEl = document.getElementById('support-assunto');
  const chamadoEl = document.getElementById('support-chamado');
  const msgEl     = document.getElementById('support-message');
  const btnEl     = document.querySelector('#support-form .btn[type="submit"]') ||
                    document.querySelector('#support-form .btn');

  const email   = emailEl?.value.trim() || currentUserId.replace(/,/g, '.');
  const empresa = empresaEl?.value.trim() || '';
  const assunto = assuntoEl?.value.trim() || 'Sem assunto';
  const message = chamadoEl?.value.trim() || '';

  if (!message) { showToast('Escreva uma mensagem', 'error'); return; }

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Enviando...'; }

  try {
    const ticketId = `${currentUserId}_${Date.now()}`;
    await authModule.database.ref(`support_tickets/${ticketId}`).set({
      userId:     currentUserId,
      email,
      empresa,
      subject:    assunto,
      message,
      status:     'open',
      createdAt:  Date.now(),
      updatedAt:  Date.now(),
      unreadDev:  true,
      unreadUser: false,
    });

    if (msgEl) {
      msgEl.textContent = '✅ Chamado enviado! Em breve nossa equipe entrará em contato.';
      msgEl.style.color = 'var(--accent)';
      setTimeout(() => { msgEl.textContent = ''; }, 6000);
    }
    showToast('Chamado enviado!', 'success');
    if (chamadoEl) chamadoEl.value = '';
    if (assuntoEl) assuntoEl.value = '';
    loadUserTickets();
  } catch (err) {
    console.error('submitTicket:', err);
    showToast('Falha ao enviar chamado', 'error');
    if (msgEl) { msgEl.textContent = '❌ Erro ao enviar. Tente novamente.'; msgEl.style.color = 'var(--danger, red)'; }
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Enviar Chamado'; }
  }
}

// ────────────────────────────────────────────────────────────
// Listar chamados do usuário logado
// ────────────────────────────────────────────────────────────
async function loadUserTickets() {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return;

  const listEl  = document.getElementById('support-history-list');
  const emptyEl = document.getElementById('support-history-empty');
  if (!listEl) return;

  listEl.innerHTML = '<div style="color:var(--ink-muted);font-size:13px;padding:8px 0">Carregando...</div>';

  try {
    const snap = await authModule.database
      .ref('support_tickets')
      .orderByChild('userId')
      .equalTo(currentUserId)
      .once('value');

    const data    = snap.val() || {};
    const tickets = Object.entries(data)
      .map(([id, t]) => ({ id, ...t }))
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

    listEl.innerHTML = '';

    if (tickets.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    for (const t of tickets) {
      const statusColors = { open: 'var(--accent)', pending: '#f59e0b', closed: '#22c55e' };
      const statusLabels = { open: 'Aberto', pending: 'Aguardando', closed: 'Resolvido' };
      const statusColor  = statusColors[t.status] || 'var(--ink-muted)';
      const statusLabel  = statusLabels[t.status]  || t.status;
      const date = t.createdAt
        ? new Date(t.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—';
      const preview = (t.message || '').slice(0, 80) + ((t.message || '').length > 80 ? '…' : '');

      const item = document.createElement('div');
      item.className = 'support-ticket-item';
      item.innerHTML = `
        <div class="ticket-item-header">
          <span class="ticket-item-subject">${escapeHtml(t.subject || 'Sem assunto')}</span>
          <span class="ticket-item-status" style="color:${statusColor};">${statusLabel}</span>
        </div>
        <div class="ticket-item-meta">
          <span class="ticket-item-date">${date}</span>
          ${t.unreadUser ? '<span class="ticket-unread-dot">Nova resposta</span>' : ''}
        </div>
        <div class="ticket-item-preview">${escapeHtml(preview)}</div>
        <button class="open-chat-btn btn" data-ticket-id="${t.id}" type="button"
          style="margin-top:8px;font-size:12px;padding:6px 14px;">
          💬 Abrir Conversa
        </button>
      `;
      listEl.appendChild(item);
    }
  } catch (err) {
    console.error('loadUserTickets:', err);
    listEl.innerHTML = '<div style="color:var(--ink-muted);font-size:13px">Erro ao carregar chamados.</div>';
  }
}

// ────────────────────────────────────────────────────────────
// Abrir modal de chat
// ────────────────────────────────────────────────────────────
async function openChatModal(ticketId) {
  currentTicketId = ticketId;

  // Marca como lido pelo usuário
  await authModule.database.ref(`support_tickets/${ticketId}`).update({
    unreadUser: false,
    updatedAt:  Date.now(),
  }).catch(() => {});

  const snap   = await authModule.database.ref(`support_tickets/${ticketId}`).once('value');
  const ticket = snap.val();
  if (!ticket) return;

  document.getElementById('chat-modal-title').textContent    = 'Conversa — ' + escapeHtml(ticket.subject || 'Chamado');
  document.getElementById('chat-modal-subject').textContent  = ticket.email || '';
  document.getElementById('chat-original-msg').textContent   = ticket.message || '';

  const statusEl = document.getElementById('chat-modal-status');
  if (statusEl) {
    const labels = { open: 'Aberto', pending: 'Aguardando', closed: 'Resolvido' };
    statusEl.textContent = labels[ticket.status] || ticket.status;
    statusEl.className   = 'chat-status-badge chat-status-' + (ticket.status || 'open');
  }

  const chatInputArea = document.getElementById('chat-input-area');
  if (chatInputArea) chatInputArea.style.display = ticket.status === 'closed' ? 'none' : 'flex';

  document.getElementById('chat-modal').style.display = 'flex';
  startChatListener(ticketId);
}

// ────────────────────────────────────────────────────────────
// Listener em tempo real das mensagens
// ────────────────────────────────────────────────────────────
function startChatListener(ticketId) {
  // Para listener anterior
  if (chatListener && currentTicketId) {
    authModule.database
      .ref(`support_tickets/${currentTicketId}/messages`)
      .off('value', chatListener);
  }

  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;
  messagesEl.innerHTML =
    '<div style="text-align:center;color:var(--ink-muted);font-size:12px;padding:16px">Carregando mensagens...</div>';

  chatListener = authModule.database
    .ref(`support_tickets/${ticketId}/messages`)
    .on('value', (snap) => {
      const data     = snap.val() || {};
      const messages = Object.entries(data)
        .map(([id, m]) => ({ id, ...m }))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      messagesEl.innerHTML = '';

      if (messages.length === 0) {
        messagesEl.innerHTML =
          '<div style="text-align:center;color:var(--ink-muted);font-size:12px;padding:24px 0">Nenhuma mensagem ainda. Escreva para iniciar!</div>';
        return;
      }

      for (const msg of messages) {
        const isUser = msg.sender === 'user';
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-dev'}`;
        bubble.innerHTML = `
          <div class="chat-bubble-name">${isUser ? 'Você' : '🛠 Suporte DSigner'}</div>
          <div class="chat-bubble-text">${escapeHtml(msg.text || '')}</div>
          <div class="chat-bubble-time">${msg.timestamp
            ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : ''}</div>
        `;
        messagesEl.appendChild(bubble);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
}

// ────────────────────────────────────────────────────────────
// Fechar modal
// ────────────────────────────────────────────────────────────
function closeChatModal() {
  if (chatListener && currentTicketId) {
    authModule.database
      .ref(`support_tickets/${currentTicketId}/messages`)
      .off('value', chatListener);
    chatListener = null;
  }
  currentTicketId = null;
  const modal = document.getElementById('chat-modal');
  if (modal) modal.style.display = 'none';
  loadUserTickets(); // atualiza badges de não lido
}

// ────────────────────────────────────────────────────────────
// Enviar mensagem no chat
// ────────────────────────────────────────────────────────────
async function sendChatMessage() {
  if (!currentTicketId) return;
  const inputEl = document.getElementById('chat-input');
  const text    = inputEl?.value.trim();
  if (!text) return;
  if (!navigator.onLine) { showToast('Sem internet', 'error'); return; }

  const currentUserId = getCurrentUserId();
  inputEl.value       = '';
  inputEl.disabled    = true;

  try {
    const msgId = Date.now().toString();
    await authModule.database
      .ref(`support_tickets/${currentTicketId}/messages/${msgId}`)
      .set({ sender: 'user', senderId: currentUserId, text, timestamp: Date.now() });

    await authModule.database.ref(`support_tickets/${currentTicketId}`).update({
      unreadDev:  true,
      unreadUser: false,
      updatedAt:  Date.now(),
      status:     'open',
    });
  } catch (err) {
    console.error('sendChatMessage:', err);
    showToast('Falha ao enviar mensagem', 'error');
  } finally {
    inputEl.disabled = false;
    inputEl.focus();
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}