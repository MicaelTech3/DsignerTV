// ======================== profile.js ==========================
import { getCurrentUserId } from './state.js';
import { showToast } from './toast.js';
import { calcStorageUsage, getUserPlan } from './media-manager.js';

const authModule = window.authModule;

export async function initProfile() {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return;

  const email = currentUserId.replace(/,/g, '.');

  // Preenche email nos elementos de perfil
  document.querySelectorAll('#user-email, #profile-email').forEach(el => {
    el.textContent = email;
  });

  await renderPlanCard(currentUserId);
  await renderBillingSection(currentUserId);
  initPlanChangeRequest(currentUserId);
}

// ─── Card de plano com barra de uso ───────────────────────────────────────────
async function renderPlanCard(currentUserId) {
  const planNameEl = document.getElementById('plan-name');
  const planUsedEl = document.getElementById('plan-used-text');
  const planFillEl = document.getElementById('plan-bar-fill');
  const planPctEl  = document.getElementById('plan-pct-text');
  const planFreeEl = document.getElementById('plan-free-text');
  const alertEl    = document.getElementById('plan-full-alert');
  const expiryEl   = document.getElementById('plan-expiry-text');

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
      : b >= 1048576  ? (b / 1048576).toFixed(1)    + ' MB'
      :                 (b / 1024).toFixed(0)         + ' KB';

    if (planNameEl) planNameEl.textContent = plan.label || '1 GB';
    if (planUsedEl) planUsedEl.textContent = `${fmt(usedBytes)} usados de ${fmt(quota)}`;
    if (planPctEl)  planPctEl.textContent  = `${pct.toFixed(1)}%`;
    if (planFreeEl) planFreeEl.textContent = `${fmt(quota - usedBytes)} livres`;

    // Vencimento
    if (expiryEl && plan.expiresAt) {
      const now = Date.now();
      const daysLeft = Math.ceil((plan.expiresAt - now) / 86400000);
      const dateStr = new Date(plan.expiresAt).toLocaleDateString('pt-BR');
      if (daysLeft < 0) {
        expiryEl.textContent = `⚠ Plano vencido em ${dateStr}`;
        expiryEl.style.color = 'var(--danger, #ef4444)';
      } else if (daysLeft <= 2) {
        expiryEl.textContent = `⏰ Vence em ${daysLeft === 0 ? 'hoje' : daysLeft + ' dia(s)'} — ${dateStr}`;
        expiryEl.style.color = '#f97316';
      } else {
        expiryEl.textContent = `Vence em ${dateStr} (${daysLeft} dias)`;
        expiryEl.style.color = 'var(--ink-muted)';
      }
    } else if (expiryEl) {
      expiryEl.textContent = '';
    }

    if (planFillEl) {
      planFillEl.style.width      = pct + '%';
      planFillEl.style.background =
        pct >= 95 ? '#ef4444'
        : pct >= 80 ? '#f59e0b'
        : 'var(--accent)';
    }

    if (alertEl) alertEl.style.display = pct >= 100 ? 'block' : 'none';

  } catch (err) {
    console.error('renderPlanCard:', err);
    if (planNameEl) planNameEl.textContent = '—';
  }
}

// ─── Seção de cobrança pendente ───────────────────────────────────────────────
async function renderBillingSection(currentUserId) {
  const section = document.getElementById('billing-section');
  if (!section) return;

  try {
    const snap    = await authModule.database.ref(`users/${currentUserId}/billing`).once('value');
    const billing = snap.val();

    if (!billing || billing.status === 'paid' || billing.status === 'overdue_downgraded') {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    const planLabelEl = document.getElementById('billing-plan-label');
    const priceEl     = document.getElementById('billing-price');
    const pixKeyEl    = document.getElementById('billing-pix-key');
    const pixNameEl   = document.getElementById('billing-pix-name');
    const pixBankEl   = document.getElementById('billing-pix-bank');
    const qrEl        = document.getElementById('billing-qr-img');
    const copyBtn     = document.getElementById('billing-copy-btn');
    const renewalTag  = document.getElementById('billing-renewal-tag');

    if (planLabelEl) planLabelEl.textContent = billing.planLabel || billing.planKey || '—';
    if (priceEl)     priceEl.textContent     = billing.price ? `R$ ${billing.price}` : '—';
    if (pixNameEl)   pixNameEl.textContent   = billing.pixName || '—';
    if (pixBankEl)   pixBankEl.textContent   = billing.pixBank || '—';
    if (renewalTag)  renewalTag.style.display = billing.isRenewal ? 'inline-block' : 'none';

    if (pixKeyEl) {
      pixKeyEl.textContent = billing.pixKey || '—';
    }

    if (copyBtn && billing.pixKey) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(billing.pixKey);
          copyBtn.textContent = '✅ Copiado!';
          setTimeout(() => { copyBtn.textContent = '📋 Copiar chave'; }, 2000);
        } catch {
          copyBtn.textContent = 'Erro ao copiar';
        }
      };
    }

    if (qrEl) {
      if (billing.qrCodeUrl) {
        qrEl.src = billing.qrCodeUrl;
        qrEl.style.display = 'block';
      } else {
        qrEl.style.display = 'none';
      }
    }

    // Upload de comprovante
    initProofUpload(currentUserId, billing);

  } catch (err) {
    console.error('renderBillingSection:', err);
    section.style.display = 'none';
  }
}

// ─── Upload de comprovante ────────────────────────────────────────────────────
function initProofUpload(currentUserId, billing) {
  const uploadBtn  = document.getElementById('billing-upload-btn');
  const uploadInput = document.getElementById('billing-proof-input');
  const statusEl   = document.getElementById('billing-upload-status');

  if (!uploadBtn || !uploadInput) return;

  uploadBtn.onclick = () => uploadInput.click();

  uploadInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Aceita apenas imagens e PDF
    if (!file.type.match(/image\/*/) && file.type !== 'application/pdf') {
      showToast('Envie uma imagem ou PDF', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Arquivo muito grande (máx 5MB)', 'error');
      return;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Enviando...';
    if (statusEl) statusEl.textContent = 'Enviando comprovante...';

    try {
      const fileName  = `proofs/${currentUserId}_${Date.now()}_${file.name}`;
      const storageRef = authModule.storage.ref().child(fileName);
      const snapshot  = await storageRef.put(file);
      const url       = await snapshot.ref.getDownloadURL();

      // Salva URL do comprovante na cobrança
      await authModule.database.ref(`users/${currentUserId}/billing`).update({
        proof:       url,
        proofSentAt: Date.now(),
        status:      'proof_sent',
      });

      // Notifica dev no ticket se houver
      const ticketsSnap = await authModule.database
        .ref('support_tickets')
        .orderByChild('userId')
        .equalTo(currentUserId)
        .once('value');

      const tickets = ticketsSnap.val() || {};
      for (const [tid, t] of Object.entries(tickets)) {
        if (t.status === 'awaiting_payment' || t.type === 'plan_change') {
          await authModule.database.ref(`support_tickets/${tid}`).update({
            proof:       url,
            proofSentAt: Date.now(),
            unreadDev:   true,
            updatedAt:   Date.now(),
          });
          break;
        }
      }

      if (statusEl) {
        statusEl.textContent = '✅ Comprovante enviado! Aguarde confirmação do suporte.';
        statusEl.style.color = 'var(--accent)';
      }
      uploadBtn.textContent = '✅ Enviado';
      showToast('Comprovante enviado!', 'success');

    } catch (err) {
      console.error('proof upload:', err);
      showToast('Erro ao enviar comprovante', 'error');
      if (statusEl) statusEl.textContent = '❌ Erro ao enviar. Tente novamente.';
      uploadBtn.disabled = false;
      uploadBtn.textContent = '📎 Enviar Comprovante';
    }
  };
}

// ─── Formulário de solicitação de mudança de plano ────────────────────────────
function initPlanChangeRequest(currentUserId) {
  const requestBtn = document.getElementById('request-plan-change-btn');
  const formArea   = document.getElementById('plan-change-form');
  const cancelBtn  = document.getElementById('cancel-plan-request-btn');
  const submitBtn  = document.getElementById('submit-plan-request-btn');

  if (requestBtn) {
    const newBtn = requestBtn.cloneNode(true);
    requestBtn.parentNode.replaceChild(newBtn, requestBtn);
    document.getElementById('request-plan-change-btn').addEventListener('click', () => {
      if (formArea) formArea.style.display = formArea.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (cancelBtn) {
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    document.getElementById('cancel-plan-request-btn').addEventListener('click', () => {
      if (formArea) formArea.style.display = 'none';
    });
  }

  if (submitBtn) {
    const newSubmit = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmit, submitBtn);
    document.getElementById('submit-plan-request-btn').addEventListener('click', async () => {
      await submitPlanRequest(currentUserId);
    });
  }
}

// ─── Envia solicitação como ticket de suporte ─────────────────────────────────
async function submitPlanRequest(currentUserId) {
  if (!navigator.onLine) { showToast('Sem internet', 'error'); return; }

  const planSelect = document.getElementById('plan-request-size');
  const msgInput   = document.getElementById('plan-request-msg');
  const submitBtn  = document.getElementById('submit-plan-request-btn');

  const requestedPlan = planSelect?.value || '2 GB';
  const userMsg       = msgInput?.value.trim() || '';

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }

  try {
    const plan  = await getUserPlan(currentUserId);
    const email = currentUserId.replace(/,/g, '.');
    const reqId = `planreq_${currentUserId}_${Date.now()}`;

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