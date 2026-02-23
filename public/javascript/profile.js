// ======================== profile.js ==========================
// Perfil do usuário: plano de armazenamento, solicitação de mudança e Academy

const db  = window.authModule.database;
const auth = window.authModule.auth;

// ─── Bytes → texto legível ──────────────────────────────────────────────────
function fmtBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0) + ' ' + units[i];
}

// ─── Mapeia nome de plano → quota em bytes ──────────────────────────────────
const PLAN_QUOTAS = {
  '50mb' : 50  * 1024 * 1024,
  '50 mb': 50  * 1024 * 1024,
  '100mb': 100 * 1024 * 1024,
  '100 mb':100 * 1024 * 1024,
  '512mb': 512 * 1024 * 1024,
  '512 mb':512 * 1024 * 1024,
  '1gb'  : 1   * 1024 * 1024 * 1024,
  '1 gb' : 1   * 1024 * 1024 * 1024,
  '2gb'  : 2   * 1024 * 1024 * 1024,
  '2 gb' : 2   * 1024 * 1024 * 1024,
  '5gb'  : 5   * 1024 * 1024 * 1024,
  '5 gb' : 5   * 1024 * 1024 * 1024,
  '10gb' : 10  * 1024 * 1024 * 1024,
  '10 gb': 10  * 1024 * 1024 * 1024,
  '20gb' : 20  * 1024 * 1024 * 1024,
  '20 gb': 20  * 1024 * 1024 * 1024,
};

function getQuota(planLabel) {
  if (!planLabel) return 50 * 1024 * 1024; // default 50 MB
  const key = String(planLabel).toLowerCase().replace(/\s+/g, ' ').trim();
  return PLAN_QUOTAS[key] || PLAN_QUOTAS[key.replace(' ', '')] || 50 * 1024 * 1024;
}

// ─── Calcula uso total de armazenamento do usuário ──────────────────────────
async function calcStorageUsed(userId) {
  try {
    const snap = await db.ref(`users/${userId}/tv_midias`).once('value');
    const tvMidias = snap.val() || {};
    let total = 0;
    Object.values(tvMidias).forEach(tvSlug => {
      Object.values(tvSlug).forEach(midia => {
        total += midia.fileSize || midia.size || 0;
      });
    });
    return total;
  } catch(e) {
    console.warn('calcStorageUsed:', e);
    return 0;
  }
}

// ─── Carrega e exibe dados do perfil + plano ────────────────────────────────
export async function initProfile(user) {
  // Email
  const emailEl = document.getElementById('profile-email');
  if (emailEl) emailEl.textContent = user.email;

  // Também preenche o campo de suporte se existir
  const supportEmailEl = document.getElementById('support-email');
  if (supportEmailEl) supportEmailEl.value = user.email;

  const userId = user.email.replace(/\./g, ',');

  await loadPlanCard(userId);
  initPlanChangeForm(userId, user.email);
  watchBilling(userId);
}

async function loadPlanCard(userId) {
  const nameEl   = document.getElementById('plan-name');
  const barEl    = document.getElementById('plan-bar-fill');
  const usedEl   = document.getElementById('plan-used-text');
  const pctEl    = document.getElementById('plan-pct-text');
  const freeEl   = document.getElementById('plan-free-text');
  const alertEl  = document.getElementById('plan-full-alert');

  try {
    // Busca plano do usuário
    const planSnap = await db.ref(`users/${userId}/plan`).once('value');
    const planData = planSnap.val();

    let planLabel = '50 MB';
    let quota     = 50 * 1024 * 1024;

    if (planData) {
      // Suporta tanto { label, quota } quanto { name, quota } quanto string direta
      planLabel = planData.label || planData.name || planData.planName || planData || '50 MB';
      quota     = planData.quota || planData.storageQuota || getQuota(planLabel);
    }

    if (nameEl) {
      nameEl.textContent = planLabel;
      nameEl.style.background = '';
    }

    // Calcula uso
    const used = await calcStorageUsed(userId);
    const pct  = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
    const free = Math.max(0, quota - used);

    // Cor da barra
    let barColor = 'var(--accent)';
    if (pct >= 90) barColor = '#ef4444';
    else if (pct >= 70) barColor = '#f59e0b';

    if (barEl)  { barEl.style.width = pct.toFixed(1) + '%'; barEl.style.background = barColor; }
    if (usedEl) usedEl.textContent = fmtBytes(used) + ' usado';
    if (pctEl)  pctEl.textContent  = pct.toFixed(0) + '%';
    if (freeEl) freeEl.textContent = fmtBytes(free) + ' livre';
    if (alertEl) alertEl.style.display = pct >= 100 ? 'block' : 'none';

    // Atualiza também a barra de storage em My Cloud se existir
    syncStorageBar(used, quota, pct);

    return { used, quota, pct };

  } catch(e) {
    console.error('loadPlanCard:', e);
    if (nameEl) nameEl.textContent = 'Erro ao carregar';
  }
}

function syncStorageBar(used, quota, pct) {
  const barText  = document.getElementById('storage-bar-text');
  const barSub   = document.getElementById('storage-bar-sub');
  const barFill  = document.getElementById('storage-bar-fill');
  const barWrap  = document.getElementById('storage-usage-bar');
  const warning  = document.getElementById('storage-full-warning');

  if (!barWrap) return;
  barWrap.style.display = 'block';
  if (barText) barText.textContent = `${fmtBytes(used)} de ${fmtBytes(quota)} usados`;
  if (barSub)  barSub.textContent  = `${pct.toFixed(0)}% utilizado`;
  if (barFill) { barFill.style.width = pct + '%'; barFill.style.background = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : 'var(--accent)'; }
  if (warning) warning.style.display = pct >= 100 ? 'block' : 'none';
}

// ─── Formulário de solicitação de mudança de plano ──────────────────────────
function initPlanChangeForm(userId, email) {
  const toggleBtn  = document.getElementById('request-plan-change-btn');
  const form       = document.getElementById('plan-change-form');
  const cancelBtn  = document.getElementById('cancel-plan-request-btn');
  const submitBtn  = document.getElementById('submit-plan-request-btn');

  if (!toggleBtn || !form) return;

  // Toggle do formulário
  toggleBtn.addEventListener('click', () => {
    const open = form.style.display !== 'none';
    form.style.display = open ? 'none' : 'block';
    toggleBtn.textContent = open ? '📩 Solicitar mudança de plano' : '✕ Cancelar';
  });

  cancelBtn?.addEventListener('click', () => {
    form.style.display = 'none';
    toggleBtn.textContent = '📩 Solicitar mudança de plano';
  });

  submitBtn?.addEventListener('click', async () => {
    const size = document.getElementById('plan-request-size')?.value;
    const msg  = document.getElementById('plan-request-msg')?.value?.trim();

    if (!size) { showProfileToast('Selecione um plano', 'error'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      // Busca nome da empresa se existir
      const userSnap = await db.ref(`users/${userId}`).once('value');
      const userData = userSnap.val() || {};
      const empresa  = userData.empresa || email;

      const ticket = {
        userId,
        email,
        empresa,
        subject: `Solicitação de plano: ${size}`,
        message: msg || `Usuário solicitou upgrade para ${size}.`,
        status: 'open',
        type: 'plan_change',
        currentPlan: document.getElementById('plan-name')?.textContent || '—',
        requestedPlan: size,
        unreadDev: true,
        unreadUser: false,
        createdAt: Date.now(),
      };

      await db.ref('support_tickets').push(ticket);

      showProfileToast('Solicitação enviada! Nossa equipe irá entrar em contato. ✅', 'success');
      form.style.display = 'none';
      toggleBtn.textContent = '📩 Solicitar mudança de plano';
      document.getElementById('plan-request-msg') && (document.getElementById('plan-request-msg').value = '');

    } catch(e) {
      console.error('submitPlanRequest:', e);
      showProfileToast('Erro ao enviar. Tente novamente.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar Solicitação';
    }
  });
}

// ─── Listener em tempo real da cobrança ─────────────────────────────────────
let _billingRef = null;

function watchBilling(userId) {
  // Remove listener anterior se existir
  if (_billingRef) {
    _billingRef.off('value');
    _billingRef = null;
  }

  _billingRef = db.ref(`users/${userId}/billing`);
  _billingRef.on('value', snap => {
    const billing = snap.val();
    renderBillingSection(billing, userId);
  });
}

function renderBillingSection(billing, userId) {
  const section   = document.getElementById('billing-section');
  if (!section) return;

  // Só mostra se tiver cobrança pendente ou comprovante enviado
  const showStatuses = ['awaiting_payment', 'proof_sent'];
  if (!billing || !showStatuses.includes(billing.status)) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  // Tag renovação
  const renewalTag = document.getElementById('billing-renewal-tag');
  if (renewalTag) renewalTag.style.display = billing.isRenewal ? 'inline-block' : 'none';

  // Plano e preço
  const planLabel = document.getElementById('billing-plan-label');
  const priceEl   = document.getElementById('billing-price');
  if (planLabel) planLabel.textContent = billing.planLabel || '—';
  if (priceEl)   priceEl.textContent   = billing.price ? 'R$ ' + billing.price : '—';

  // QR Code
  const qrImg   = document.getElementById('billing-qr-img');
  const qrPlaceholder = document.getElementById('billing-qr-placeholder');
  if (qrImg) {
    if (billing.qrCodeUrl) {
      qrImg.src = billing.qrCodeUrl;
      qrImg.style.display = 'block';
      if (qrPlaceholder) qrPlaceholder.style.display = 'none';
    } else {
      qrImg.style.display = 'none';
      if (qrPlaceholder) qrPlaceholder.style.display = 'flex';
    }
  }

  // Dados Pix
  const pixName = document.getElementById('billing-pix-name');
  const pixBank = document.getElementById('billing-pix-bank');
  const pixKey  = document.getElementById('billing-pix-key');
  if (pixName) pixName.textContent = billing.pixName || '—';
  if (pixBank) pixBank.textContent = billing.pixBank || '—';
  if (pixKey)  pixKey.textContent  = billing.pixKey  || '—';

  // Se já enviou comprovante, mostra feedback
  const uploadStatus = document.getElementById('billing-upload-status');
  if (uploadStatus && billing.status === 'proof_sent') {
    uploadStatus.textContent = '✅ Comprovante enviado! Aguardando confirmação.';
    uploadStatus.style.color = '#22c55e';
  }

  // Botão copiar chave Pix
  const copyBtn = document.getElementById('billing-copy-btn');
  if (copyBtn && !copyBtn._billingListener) {
    copyBtn._billingListener = true;
    copyBtn.addEventListener('click', () => {
      const key = billing.pixKey;
      if (!key) return;
      navigator.clipboard?.writeText(key).then(() => {
        copyBtn.textContent = '✅ Copiado!';
        setTimeout(() => { copyBtn.textContent = '📋 Copiar chave Pix'; }, 2000);
      }).catch(() => {
        // Fallback para browsers sem clipboard API
        const el = document.createElement('textarea');
        el.value = key;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        copyBtn.textContent = '✅ Copiado!';
        setTimeout(() => { copyBtn.textContent = '📋 Copiar chave Pix'; }, 2000);
      });
    });
  }

  // Botão upload comprovante
  const uploadBtn   = document.getElementById('billing-upload-btn');
  const proofInput  = document.getElementById('billing-proof-input');
  if (uploadBtn && proofInput && !uploadBtn._billingListener) {
    uploadBtn._billingListener = true;
    uploadBtn.addEventListener('click', () => proofInput.click());
    proofInput.addEventListener('change', async () => {
      const file = proofInput.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        showProfileToast('Arquivo muito grande (máx 10MB)', 'error'); return;
      }
      uploadBtn.disabled = true;
      uploadBtn.textContent = '⏳ Enviando...';
      if (uploadStatus) uploadStatus.textContent = 'Enviando comprovante...';
      try {
        const storageRef = window.authModule.storage.ref(
          `proofs/${userId}_${Date.now()}_${file.name}`
        );
        const task = await storageRef.put(file);
        const url  = await task.ref.getDownloadURL();

        await db.ref(`users/${userId}/billing`).update({
          proof: url,
          proofSentAt: Date.now(),
          status: 'proof_sent',
        });

        if (uploadStatus) {
          uploadStatus.textContent = '✅ Comprovante enviado com sucesso!';
          uploadStatus.style.color = '#22c55e';
        }
        showProfileToast('Comprovante enviado! ✅', 'success');
      } catch(e) {
        console.error('uploadProof:', e);
        if (uploadStatus) uploadStatus.textContent = 'Erro ao enviar. Tente novamente.';
        showProfileToast('Erro ao enviar comprovante', 'error');
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '📎 Enviar Comprovante';
        proofInput.value = '';
      }
    });
  }
}

// ─── Toast simples ──────────────────────────────────────────────────────────
function showProfileToast(msg, type = 'info') {
  // Tenta usar o showToast global se existir
  if (typeof window.showToast === 'function') {
    window.showToast(msg, type); return;
  }
  // Fallback próprio
  let el = document.getElementById('_profile-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '_profile-toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;color:#fff;transition:opacity .3s;pointer-events:none;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6';
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3500);
}

// ─── Exporta função de reload do plano (para usar no navigation.js) ─────────
export async function reloadPlanForUser() {
  const user = auth.currentUser;
  if (!user) return;
  const userId = user.email.replace(/\./g, ',');
  await loadPlanCard(userId);
}