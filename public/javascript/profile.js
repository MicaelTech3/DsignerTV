// ======================== profile.js ==========================
// Módulo de Perfil — exibe plano de armazenamento e solicitação de mudança

import { getCurrentUserId } from './state.js';
import { showToast } from './toast.js';
import { calcStorageUsage, getUserPlan } from './media-manager.js';

const authModule = window.authModule;

export async function initProfile() {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return;

  const email = currentUserId.replace(/,/g, '.');

  // Preenche email em todos os lugares
  document.querySelectorAll('#user-email, #profile-email').forEach(el => {
    el.textContent = email;
  });

  await renderPlanCard(currentUserId);
  initPlanChangeRequest(currentUserId);
}

// ────────────────────────────────────────────────────────────
// Renderiza o card de plano com barra de progresso
// ────────────────────────────────────────────────────────────
async function renderPlanCard(currentUserId) {
  const planNameEl = document.getElementById('plan-name');
  const planUsedEl = document.getElementById('plan-used-text');
  const planFillEl = document.getElementById('plan-bar-fill');
  const planPctEl  = document.getElementById('plan-pct-text');
  const planFreeEl = document.getElementById('plan-free-text');
  const alertEl    = document.getElementById('plan-full-alert');

  if (!planNameEl) return;
  planNameEl.textContent = 'Carregando...';

  try {
    const [usedBytes, plan] = await Promise.all([
      calcStorageUsage(currentUserId),
      getUserPlan(currentUserId),
    ]);

    const quota = plan.quota || 1073741824;
    const pct   = Math.min((usedBytes / quota) * 100, 100);

    const fmt = b =>
      b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB'
      : b >= 1048576  ? (b / 1048576).toFixed(1)  + ' MB'
      :                 (b / 1024).toFixed(0)       + ' KB';

    if (planNameEl) planNameEl.textContent = plan.label || '1 GB';
    if (planUsedEl) planUsedEl.textContent = `${fmt(usedBytes)} usados de ${fmt(quota)}`;
    if (planPctEl)  planPctEl.textContent  = `${pct.toFixed(1)}%`;
    if (planFreeEl) planFreeEl.textContent = `${fmt(quota - usedBytes)} livres`;

    if (planFillEl) {
      planFillEl.style.width      = pct + '%';
      planFillEl.style.background =
        pct >= 95 ? 'var(--danger, #ef4444)'
        : pct >= 80 ? '#f59e0b'
        : 'var(--accent)';
    }

    if (alertEl) alertEl.style.display = pct >= 100 ? 'block' : 'none';

  } catch (err) {
    console.error('renderPlanCard:', err);
    if (planNameEl) planNameEl.textContent = '—';
  }
}

// ────────────────────────────────────────────────────────────
// Lógica do formulário de solicitação de mudança de plano
// ────────────────────────────────────────────────────────────
function initPlanChangeRequest(currentUserId) {
  const requestBtn = document.getElementById('request-plan-change-btn');
  const formArea   = document.getElementById('plan-change-form');
  const cancelBtn  = document.getElementById('cancel-plan-request-btn');
  const submitBtn  = document.getElementById('submit-plan-request-btn');

  // Limpa listeners anteriores clonando
  if (requestBtn) {
    const newBtn = requestBtn.cloneNode(true);
    requestBtn.parentNode.replaceChild(newBtn, requestBtn);
    newBtn.addEventListener('click', () => {
      if (formArea) formArea.style.display = formArea.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (cancelBtn) {
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    newCancel.addEventListener('click', () => {
      if (formArea) formArea.style.display = 'none';
    });
  }

  if (submitBtn) {
    const newSubmit = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmit, submitBtn);
    newSubmit.addEventListener('click', async () => {
      await submitPlanRequest(currentUserId);
    });
  }
}

// ────────────────────────────────────────────────────────────
// Envia solicitação de mudança de plano como ticket de suporte
// ────────────────────────────────────────────────────────────
async function submitPlanRequest(currentUserId) {
  if (!navigator.onLine) { showToast('Sem internet', 'error'); return; }

  const planSelect = document.getElementById('plan-request-size');
  const msgInput   = document.getElementById('plan-request-msg');
  const submitBtn  = document.getElementById('submit-plan-request-btn');

  const requestedPlan = planSelect?.value || '2 GB';
  const userMsg       = msgInput?.value.trim() || '';

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }

  try {
    const plan    = await getUserPlan(currentUserId);
    const email   = currentUserId.replace(/,/g, '.');
    const reqId   = `planreq_${currentUserId}_${Date.now()}`;

    await authModule.database.ref(`support_tickets/${reqId}`).set({
      userId:        currentUserId,
      email,
      empresa:       '',
      subject:       `📦 Solicitação de mudança de plano → ${requestedPlan}`,
      message:       userMsg || `Solicito mudança do plano atual (${plan.label || '1 GB'}) para ${requestedPlan}.`,
      status:        'open',
      type:          'plan_change',
      currentPlan:   plan.label || '1 GB',
      requestedPlan,
      createdAt:     Date.now(),
      updatedAt:     Date.now(),
      unreadDev:     true,
      unreadUser:    false,
    });

    showToast('Solicitação enviada! Nossa equipe irá analisar em breve.', 'success');
    const formArea = document.getElementById('plan-change-form');
    if (formArea) formArea.style.display = 'none';
    if (msgInput) msgInput.value = '';

  } catch (err) {
    console.error('submitPlanRequest:', err);
    showToast('Falha ao enviar solicitação', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Enviar Solicitação'; }
  }
}