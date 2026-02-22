/* developer.js — DSigner Dev Console */

// ========== FIREBASE CONFIG ==========
const firebaseConfig = {
  apiKey: "AIzaSyBhj6nv3QcIHyuznWPNM4t_0NjL0ghMwFw",
  authDomain: "dsignertv.firebaseapp.com",
  databaseURL: "https://dsignertv-default-rtdb.firebaseio.com",
  projectId: "dsignertv",
  storageBucket: "dsignertv.firebasestorage.app",
  messagingSenderId: "930311416952",
  appId: "1:930311416952:web:d0e7289f0688c46492d18d"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// ========== STATE ==========
let currentUser = null;
let allUsersData = {};
let plansData = {};
let selectedPlanUids = new Set();
let ticketListener = null;
let currentNodePath = null;
let currentNodeData = null;
let rtListener = null;

// ========== THEME ==========
const themeBtn = document.getElementById('theme-toggle');
const htmlEl = document.documentElement;

function setTheme(t) {
  htmlEl.setAttribute('data-theme', t);
  localStorage.setItem('dev-theme', t);
}

themeBtn.addEventListener('click', () => {
  setTheme(htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

if (localStorage.getItem('dev-theme') === 'dark') setTheme('dark');

// ========== AUTH ==========
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('topbar-email').textContent = user.email;
    loadOverview();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    currentUser = null;
  }
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-err');
  btn.disabled = true;
  btn.textContent = 'Entrando...';
  errEl.style.display = 'none';
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) {
    errEl.textContent = translateAuthError(e.code);
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

document.getElementById('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-pass').focus(); });
document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-btn').click(); });

document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

function translateAuthError(code) {
  const map = {
    'auth/user-not-found': 'Usuário não encontrado',
    'auth/wrong-password': 'Senha incorreta',
    'auth/invalid-credential': 'Credenciais inválidas',
    'auth/invalid-email': 'Email inválido',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde.'
  };
  return map[code] || 'Erro ao entrar. Verifique as credenciais.';
}

// ========== NAVIGATION ==========
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const sec = item.dataset.section;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sec)?.classList.add('active');

    if (sec === 'users-section') loadUsers();
    if (sec === 'tvs-section') populateUserSelects();
    if (sec === 'media-section') populateUserSelects();
    if (sec === 'categories-section') loadAllCategories();
    if (sec === 'db-browser') browsePath('');
    if (sec === 'rules-section') loadRules();
    if (sec === 'dominios-section') initSitesSection();
    if (sec === 'plans-section') loadPlans();
    if (sec === 'tickets-section') loadTickets();
    if (sec === 'change-plans-section') loadChangePlans();
    if (sec === 'settings-section') loadSettings();
    if (sec === 'apps-section') loadAppsSection();
  });
});

document.getElementById('refresh-overview').addEventListener('click', loadOverview);
startTicketListener();
startChangePlansListener();

// ========== HELPERS ==========
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function filterTable(tbodyId, q) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const lq = q.toLowerCase();
  tbody.querySelectorAll('tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(lq) ? '' : 'none';
  });
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

// Confirm dialog
let _resolveConfirm = null;

function showConfirm(title, msg) {
  return new Promise(res => {
    _resolveConfirm = res;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-overlay').classList.add('open');
  });
}

function resolveConfirm(v) {
  document.getElementById('confirm-overlay').classList.remove('open');
  if (_resolveConfirm) { _resolveConfirm(v); _resolveConfirm = null; }
}

function syntaxHighlight(json) {
  if (typeof json !== 'string') json = JSON.stringify(json, null, 2);
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, m => {
    let cls = 'json-number';
    if (/^"/.test(m)) cls = /:$/.test(m) ? 'json-key' : 'json-string';
    else if (/true|false/.test(m)) cls = 'json-bool';
    else if (/null/.test(m)) cls = 'json-bool';
    return `<span class="${cls}">${m}</span>`;
  });
}

// ========== OVERVIEW ==========
async function loadOverview() {
  try {
    const snap = await db.ref('users').once('value');
    const data = snap.val() || {};
    allUsersData = data;
    const userIds = Object.keys(data);
    let totalTvs = 0, totalCats = 0, totalMedia = 0, onlineTvs = 0;

    for (const uid of userIds) {
      const u = data[uid];
      totalTvs += u.tvs ? Object.keys(u.tvs).length : 0;
      totalCats += u.categories ? Object.keys(u.categories).length : 0;
      if (u.tvs) {
        for (const tv of Object.values(u.tvs)) {
          if (tv.status === 'on') onlineTvs++;
        }
      }
      if (u.tv_midias) {
        for (const slug of Object.values(u.tv_midias)) {
          totalMedia += Object.keys(slug).length;
        }
      }
    }

    // Keys
    const keysSnap = await db.ref('midia').once('value');
    const keysCount = keysSnap.val() ? Object.keys(keysSnap.val()).length : 0;

    document.getElementById('stat-users').textContent = userIds.length;
    document.getElementById('stat-tvs').textContent = totalTvs;
    document.getElementById('stat-cats').textContent = totalCats;
    document.getElementById('stat-medias').textContent = totalMedia;
    document.getElementById('stat-online').textContent = onlineTvs;
    document.getElementById('stat-keys').textContent = keysCount;

    // Table
    const tbody = document.getElementById('overview-users-body');
    tbody.innerHTML = '';
    for (const uid of userIds) {
      const u = data[uid];
      const email = uid.replace(/,/g, '.');
      const tvCount = u.tvs ? Object.keys(u.tvs).length : 0;
      const catCount = u.categories ? Object.keys(u.categories).length : 0;
      let mediaCount = 0;
      if (u.tv_midias) for (const s of Object.values(u.tv_midias)) mediaCount += Object.keys(s).length;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${email}</td>
        <td>${tvCount}</td>
        <td>${catCount}</td>
        <td>${mediaCount}</td>
        <td>
          <button class="action-btn" onclick="viewUserRaw('${uid}')">JSON</button>
          <button class="action-btn danger" onclick="deleteUser('${uid}', '${email}')">Excluir</button>
        </td>`;
      tbody.appendChild(tr);
    }
  } catch(e) {
    console.error(e);
    toast('Erro ao carregar dados', 'error');
  }
}

// ========== USERS ==========
async function loadUsers() {
  const tbody = document.getElementById('users-body');
  tbody.innerHTML = '<tr><td colspan="8" class="loading"><div class="spinner"></div>Carregando...</td></tr>';
  try {
    const snap = await db.ref('users').once('value');
    const data = snap.val() || {};
    allUsersData = data;
    tbody.innerHTML = '';

    for (const uid of Object.keys(data)) {
      const u = data[uid];
      const email = uid.replace(/,/g, '.');
      const tvCount = u.tvs ? Object.keys(u.tvs).length : 0;
      const catCount = u.categories ? Object.keys(u.categories).length : 0;
      let mediaCount = 0;
      if (u.tv_midias) for (const s of Object.values(u.tv_midias)) mediaCount += Object.keys(s).length;

      // Plano
      const plan = u.plan || { quota: 1073741824, label: '1 GB' };
      const quotaBytes = plan.quota || 1073741824;

      const tr = document.createElement('tr');
      tr.dataset.uid = uid;
      tr.innerHTML = `
        <td class="mono" style="max-width:160px;overflow:hidden;text-overflow:ellipsis">${uid}</td>
        <td class="mono">${email}</td>
        <td>${tvCount}</td>
        <td>${catCount}</td>
        <td>${mediaCount}</td>
        <td class="mono storage-cell-${uid.replace(/[^a-z0-9]/gi,'_')}">
          <span style="color:var(--ink-dim);font-size:11px;">calculando…</span>
        </td>
        <td>
          <span class="badge badge-gray" style="font-family:var(--mono);font-size:11px;">${plan.label || '1 GB'}</span>
        </td>
        <td>
          <button class="action-btn" onclick="viewUserRaw('${uid}')">JSON</button>
          <button class="action-btn danger" onclick="deleteUser('${uid}', '${email}')">Excluir</button>
        </td>`;
      tbody.appendChild(tr);

      // Calcula storage em background para este usuário
      calcUserStorage(uid, u.tv_midias || {});
    }
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--red)">Erro ao carregar</td></tr>';
  }
}

// Calcula storage real via getMetadata() para cada storagePath único do usuário
async function calcUserStorage(uid, tvMidias) {
  const seen = new Set();
  const tasks = [];
  let totalBytes = 0;

  for (const tvSlug in tvMidias) {
    for (const mediaName in tvMidias[tvSlug]) {
      const path = tvMidias[tvSlug][mediaName]?.storagePath;
      if (!path || seen.has(path)) continue;
      seen.add(path);
      tasks.push(
        firebase.storage().ref().child(path).getMetadata()
          .then(m => { totalBytes += m.size || 0; })
          .catch(() => {})
      );
    }
  }

  await Promise.all(tasks);

  const plan = (allUsersData[uid] && allUsersData[uid].plan) || { quota: 1073741824, label: '1 GB' };
  const quota = plan.quota || 1073741824;
  const pct = Math.min((totalBytes / quota) * 100, 100);
  const fmt = b => b >= 1073741824 ? (b/1073741824).toFixed(2)+' GB' : b >= 1048576 ? (b/1048576).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB';

  const safeId = uid.replace(/[^a-z0-9]/gi,'_');
  const cell = document.querySelector(`.storage-cell-${safeId}`);
  if (!cell) return;

  const color = pct >= 95 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';
  cell.innerHTML = `
    <div style="font-size:11px;font-family:var(--mono);color:var(--ink-muted);margin-bottom:4px;">${fmt(totalBytes)} / ${fmt(quota)}</div>
    <div style="height:4px;background:var(--bg);border-radius:2px;overflow:hidden;width:100px;">
      <div style="height:100%;width:${pct.toFixed(1)}%;background:${color};border-radius:2px;transition:width .4s;"></div>
    </div>
    <div style="font-size:10px;font-family:var(--mono);color:var(--ink-dim);margin-top:2px;">${pct.toFixed(1)}%</div>
  `;

  // Salva no allUsersData para uso local
  if (allUsersData[uid]) allUsersData[uid]._usedBytes = totalBytes;
}

// ========== PLANO DO USUÁRIO ==========
function openPlanModal(uid, email) {
  const u = allUsersData[uid] || {};
  const plan = u.plan || { quota: 1073741824, label: '1 GB' };

  document.getElementById('plan-modal-email').textContent = email;
  document.getElementById('plan-modal-uid').value = uid;
  document.getElementById('plan-quota-select').value = String(plan.quota || 1073741824);
  document.getElementById('plan-custom-gb').value = '';
  document.getElementById('plan-label-input').value = plan.label || '';

  const usedBytes = u._usedBytes || 0;
  const fmt = b => b >= 1073741824 ? (b/1073741824).toFixed(2)+' GB' : b >= 1048576 ? (b/1048576).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB';
  document.getElementById('plan-modal-usage').textContent = usedBytes > 0 ? `Uso atual: ${fmt(usedBytes)}` : 'Calculando uso...';

  onPlanSelectChange();
  openModal('plan-modal');
}

function onPlanSelectChange() {
  const sel = document.getElementById('plan-quota-select');
  const customRow = document.getElementById('plan-custom-row');
  customRow.style.display = sel.value === 'custom' ? 'block' : 'none';
}

async function savePlan() {
  const uid = document.getElementById('plan-modal-uid').value;
  const selVal = document.getElementById('plan-quota-select').value;
  const customGb = parseFloat(document.getElementById('plan-custom-gb').value);
  const label = document.getElementById('plan-label-input').value.trim();
  const btn = document.getElementById('save-plan-btn');

  let quota;
  if (selVal === 'custom') {
    if (!customGb || customGb <= 0) { toast('Informe um valor válido em GB', 'error'); return; }
    quota = Math.round(customGb * 1073741824);
  } else {
    quota = parseInt(selVal);
  }

  const planLabel = label || (quota >= 1073741824 ? (quota/1073741824).toFixed(0)+' GB' : (quota/1048576).toFixed(0)+' MB');

  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    await db.ref(`users/${uid}/plan`).set({ quota, label: planLabel, updatedAt: Date.now(), updatedBy: 'dev-console' });
    if (allUsersData[uid]) allUsersData[uid].plan = { quota, label: planLabel };
    toast(`Plano de ${uid.replace(/,/g,'.')} atualizado para ${planLabel}`, 'success');
    closeModal('plan-modal');
    loadUsers(); // recarrega para atualizar badge
  } catch(e) {
    toast('Erro ao salvar plano: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar Plano';
  }
}

function viewUserRaw(uid) {
  const u = allUsersData[uid];
  document.getElementById('raw-modal-title').textContent = 'users/' + uid;
  document.getElementById('raw-modal-content').innerHTML = syntaxHighlight(u);
  openModal('raw-modal');
}

async function deleteUser(uid, email) {
  const ok = await showConfirm('Excluir usuário', `Excluir todos os dados de ${email}? Esta ação é IRREVERSÍVEL.`);
  if (!ok) return;
  try {
    await db.ref(`users/${uid}`).remove();
    toast('Usuário excluído', 'success');
    loadUsers();
    loadOverview();
  } catch(e) {
    toast('Erro ao excluir', 'error');
  }
}

// ========== USER SELECTS (shared) ==========
async function populateUserSelects() {
  try {
    const snap = await db.ref('users').once('value');
    const data = snap.val() || {};
    allUsersData = data;
    const uids = Object.keys(data);

    ['tv-user-select', 'media-user-select'].forEach(selId => {
      const sel = document.getElementById(selId);
      if (!sel) return;
      const current = sel.value;
      sel.innerHTML = '<option value="">— escolha um usuário —</option>';
      uids.forEach(uid => {
        const email = uid.replace(/,/g, '.');
        const tvCount = data[uid].tvs ? Object.keys(data[uid].tvs).length : 0;
        const opt = document.createElement('option');
        opt.value = uid;
        opt.textContent = `${email} (${tvCount} TVs)`;
        if (uid === current) opt.selected = true;
        sel.appendChild(opt);
      });
    });
  } catch(e) { console.error('populateUserSelects:', e); }
}

// ========== TVs (por usuário) ==========
let selectedTvUid = '';

function onTvUserChange() {
  selectedTvUid = document.getElementById('tv-user-select').value;
  const card = document.getElementById('tv-table-card');
  const refreshBtn = document.getElementById('tv-refresh-btn');
  const addBtn = document.getElementById('tv-add-btn');
  if (!selectedTvUid) {
    card.style.display = 'none';
    refreshBtn.style.display = 'none';
    addBtn.style.display = 'none';
    document.getElementById('tv-user-stats').style.display = 'none';
    return;
  }
  card.style.display = 'block';
  refreshBtn.style.display = '';
  addBtn.style.display = '';
  loadTvsForUser();
}

function loadTvsForUser() {
  const uid = selectedTvUid;
  if (!uid) return;
  const u = allUsersData[uid];
  const email = uid.replace(/,/g, '.');
  const tbody = document.getElementById('tvs-body');
  tbody.innerHTML = '<tr><td colspan="6" class="loading"><div class="spinner"></div>Carregando...</td></tr>';
  document.getElementById('tv-table-title').textContent = `TVs de ${email}`;

  // Re-fetch fresh data for this user
  db.ref(`users/${uid}/tvs`).once('value').then(snap => {
    const tvs = snap.val() || {};
    const cats = (allUsersData[uid] && allUsersData[uid].categories) || {};
    tbody.innerHTML = '';
    const entries = Object.entries(tvs);

    const statsEl = document.getElementById('tv-user-stats');
    statsEl.style.display = '';
    statsEl.className = 'badge badge-blue';
    statsEl.textContent = `${entries.length} TV${entries.length !== 1 ? 's' : ''}`;

    if (!entries.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px">Nenhuma TV encontrada</td></tr>';
      return;
    }

    entries.forEach(([tvId, tv]) => {
      const catName = cats[tv.categoryId] ? cats[tv.categoryId].name : tv.categoryId || '—';
      const mediaInfo = tv.media ? `<span class="badge badge-blue">${tv.media.type || 'mídia'}</span>`
                       : tv.playlist ? `<span class="badge badge-green">playlist (${tv.playlist.length})</span>` : '—';
      const statusBadge = tv.status === 'on'
        ? '<span class="badge badge-green">online</span>'
        : '<span class="badge badge-gray">off</span>';
      const keyEl = tv.activationKey
        ? `<span class="mono">${tv.activationKey}</span>`
        : '<span style="color:var(--text3)">—</span>';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:500">${tv.name || '—'}</td>
        <td>${catName}</td>
        <td>${statusBadge}</td>
        <td>${keyEl}</td>
        <td>${mediaInfo}</td>
        <td>
          <button class="action-btn" onclick="viewTvRaw('${uid}','${tvId}')">JSON</button>
          <button class="action-btn" onclick="sendStopToTv('${tv.activationKey}')">Stop</button>
          <button class="action-btn danger" onclick="deleteTv('${uid}','${tvId}','${tv.name}')">Del</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }).catch(e => {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red)">Erro: ${e.message}</td></tr>`;
  });
}

// ========== MEDIA (por usuário) ==========
let selectedMediaUid = '';

function onMediaUserChange() {
  selectedMediaUid = document.getElementById('media-user-select').value;
  const card = document.getElementById('media-table-card');
  const refreshBtn = document.getElementById('media-refresh-btn');
  if (!selectedMediaUid) {
    card.style.display = 'none';
    refreshBtn.style.display = 'none';
    document.getElementById('media-user-stats').style.display = 'none';
    return;
  }
  card.style.display = 'block';
  refreshBtn.style.display = '';
  loadMediaForUser();
}

async function loadMediaForUser() {
  const uid = selectedMediaUid;
  if (!uid) return;
  const email = uid.replace(/,/g, '.');
  const tbody = document.getElementById('media-body');
  tbody.innerHTML = '<tr><td colspan="6" class="loading"><div class="spinner"></div>Carregando...</td></tr>';
  document.getElementById('media-table-title').textContent = `Mídias de ${email}`;

  try {
    const snap = await db.ref(`users/${uid}/tv_midias`).once('value');
    const data = snap.val() || {};
    tbody.innerHTML = '';
    let count = 0;

    for (const [tvSlug, medias] of Object.entries(data)) {
      for (const [mName, m] of Object.entries(medias)) {
        count++;
        const kind = m.mediaType || m.type || '—';
        const statusBadge = m.active
          ? '<span class="badge badge-green">ativa</span>'
          : '<span class="badge badge-gray">inativa</span>';

        const tr = document.createElement('tr');
        // Store data attrs for delete
        tr.dataset.uid = uid;
        tr.dataset.tvslug = tvSlug;
        tr.dataset.mname = mName;
        tr.dataset.storagepath = m.storagePath || '';

        tr.innerHTML = `
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${m.displayName || mName}">${m.displayName || mName}</td>
          <td>${m.tvName || tvSlug}</td>
          <td><span class="badge badge-blue">${kind}</span></td>
          <td>${statusBadge}</td>
          <td class="mono" style="font-size:11px">${fmtDate(m.timestamp)}</td>
          <td>
            <button class="action-btn" onclick='viewMediaObj(${JSON.stringify(JSON.stringify(m))})'>JSON</button>
            <button class="action-btn danger" onclick="deleteMediaRow(this)">Del</button>
          </td>`;
        tbody.appendChild(tr);
      }
    }

    const statsEl = document.getElementById('media-user-stats');
    statsEl.style.display = '';
    statsEl.className = 'badge badge-blue';
    statsEl.textContent = `${count} mídia${count !== 1 ? 's' : ''}`;

    if (!count) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px">Nenhuma mídia encontrada</td></tr>';
    }
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red)">Erro: ${e.message}</td></tr>`;
  }
}

function viewMediaObj(jsonStr) {
  const obj = JSON.parse(jsonStr);
  document.getElementById('raw-modal-title').textContent = 'Mídia — JSON';
  document.getElementById('raw-modal-content').innerHTML = syntaxHighlight(obj);
  openModal('raw-modal');
}

async function deleteMediaRow(btn) {
  const tr = btn.closest('tr');
  const uid = tr.dataset.uid;
  const tvSlug = tr.dataset.tvslug;
  const mName = tr.dataset.mname;
  const storagePath = tr.dataset.storagepath;

  const ok = await showConfirm('Excluir mídia', `Excluir "${mName}" de ${tvSlug}?\n\nIsso também removerá do Firebase Storage se houver arquivo.`);
  if (!ok) return;

  try {
    // 1. Remove de tv_midias
    await db.ref(`users/${uid}/tv_midias/${tvSlug}/${mName}`).remove();

    // 2. Remove do Firebase Storage se houver path
    if (storagePath && storagePath !== '') {
      try {
        await firebase.storage().ref().child(storagePath).delete();
        toast('Arquivo removido do Storage', 'success');
      } catch(storErr) {
        // Arquivo pode não existir mais — não é erro fatal
        console.warn('Storage delete:', storErr.message);
      }
    }

    // 3. Atualiza TVs do usuário que usavam esta mídia
    const tvsSnap = await db.ref(`users/${uid}/tvs`).once('value');
    const tvs = tvsSnap.val() || {};
    for (const [tvId, tv] of Object.entries(tvs)) {
      let changed = false;
      let wasActive = false;

      if (Array.isArray(tv.playlist)) {
        const before = tv.playlist.length;
        tv.playlist = tv.playlist.filter(item => {
          if (item.url && item.url.includes(mName)) { wasActive = true; return false; }
          return true;
        });
        if (tv.playlist.length !== before) changed = true;
      }

      if (tv.media && tv.media.url && tv.media.url.includes(mName)) {
        wasActive = true;
        tv.media = null;
        changed = true;
      }

      if (changed) {
        await db.ref(`users/${uid}/tvs/${tvId}`).update({
          media: tv.media || null,
          playlist: tv.playlist || null,
          lastUpdate: Date.now()
        });
      }

      if (wasActive && tv.activationKey) {
        await db.ref('midia/' + tv.activationKey).set({ tipo: 'stop', timestamp: Date.now() });
      }
    }

    // 4. Remove a linha da tabela
    tr.remove();
    toast('Mídia excluída do Firebase ✓', 'success');

    // Atualizar contador
    const remaining = document.getElementById('media-body').querySelectorAll('tr').length;
    const statsEl = document.getElementById('media-user-stats');
    if (statsEl) {
      statsEl.textContent = `${remaining} mídia${remaining !== 1 ? 's' : ''}`;
    }
    if (remaining === 0) {
      document.getElementById('media-body').innerHTML =
        '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px">Nenhuma mídia encontrada</td></tr>';
    }
  } catch(e) {
    console.error('deleteMediaRow:', e);
    toast('Erro ao excluir: ' + e.message, 'error');
  }
}

// ========== CRIAR USUÁRIO ==========
async function createUser() {
  const email = document.getElementById('new-user-email').value.trim();
  const pass = document.getElementById('new-user-pass').value;
  const name = document.getElementById('new-user-name').value.trim();
  const errEl = document.getElementById('create-user-error');
  const btn = document.getElementById('create-user-btn');

  errEl.style.display = 'none';
  if (!email || !pass) { errEl.textContent = 'Email e senha são obrigatórios'; errEl.style.display = 'block'; return; }
  if (pass.length < 6) { errEl.textContent = 'Senha deve ter mínimo 6 caracteres'; errEl.style.display = 'block'; return; }

  btn.disabled = true;
  btn.textContent = 'Criando...';

  try {
    // Cria o usuário no Firebase Auth usando uma instância secundária temporária
    const secondaryApp = firebase.initializeApp(firebase.app().options, 'secondary-' + Date.now());
    const secondaryAuth = secondaryApp.auth();
    const cred = await secondaryAuth.createUserWithEmailAndPassword(email, pass);
    const newUser = cred.user;
    await secondaryAuth.signOut();
    await secondaryApp.delete();

    // Inicializa estrutura no Realtime Database
    const uid = email.replace(/\./g, ',');
    const initialData = {
      profile: { email, name: name || email, createdAt: Date.now(), createdBy: 'dev-console' },
      categories: { '1': { id: '1', name: 'Geral', status: 'active' } }
    };
    await db.ref(`users/${uid}`).update(initialData);

    toast(`Usuário ${email} criado com sucesso!`, 'success');
    closeModal('create-user-modal');
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-pass').value = '';
    document.getElementById('new-user-name').value = '';
    loadUsers();
    loadOverview();
  } catch(e) {
    const msgs = {
      'auth/email-already-in-use': 'Este email já está cadastrado',
      'auth/invalid-email': 'Email inválido',
      'auth/weak-password': 'Senha muito fraca'
    };
    errEl.textContent = msgs[e.code] || e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar Usuário';
  }
}

// ========== CRIAR TV ==========
function openCreateTvModal() {
  const uid = selectedTvUid;
  if (!uid) { toast('Selecione um usuário primeiro', 'error'); return; }
  const email = uid.replace(/,/g, '.');
  document.getElementById('create-tv-modal-title').textContent = `+ Nova TV para ${email}`;

  // Preencher categorias do usuário
  const cats = (allUsersData[uid] && allUsersData[uid].categories) || {};
  const sel = document.getElementById('new-tv-category');
  sel.innerHTML = '<option value="">— sem categoria —</option>';
  Object.entries(cats).forEach(([catId, cat]) => {
    const opt = document.createElement('option');
    opt.value = catId;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });

  document.getElementById('new-tv-name').value = '';
  document.getElementById('new-tv-key').value = '';
  document.getElementById('create-tv-error').style.display = 'none';
  openModal('create-tv-modal');
}

async function createTv() {
  const uid = selectedTvUid;
  if (!uid) return;
  const name = document.getElementById('new-tv-name').value.trim();
  const categoryId = document.getElementById('new-tv-category').value;
  const activationKey = document.getElementById('new-tv-key').value.trim();
  const status = document.getElementById('new-tv-status').value;
  const errEl = document.getElementById('create-tv-error');

  errEl.style.display = 'none';
  if (!name) { errEl.textContent = 'Nome da TV é obrigatório'; errEl.style.display = 'block'; return; }

  try {
    // Pegar TVs existentes para gerar novo ID
    const snap = await db.ref(`users/${uid}/tvs`).once('value');
    const existingTvs = snap.val() || {};
    const ids = Object.keys(existingTvs).map(Number).filter(n => !isNaN(n));
    const newId = (ids.length ? Math.max(...ids) + 1 : 1).toString();

    const newTv = {
      id: newId,
      name,
      categoryId: categoryId || null,
      status,
      activationKey: activationKey || null,
      deviceName: activationKey ? `Dispositivo ${newId}` : null,
      lastActivation: activationKey ? Date.now() : null,
      createdAt: Date.now(),
      createdBy: 'dev-console'
    };

    await db.ref(`users/${uid}/tvs/${newId}`).set(newTv);

    // Se tiver activation key, registra no nó /midia também
    if (activationKey) {
      await db.ref('midia/' + activationKey).set({
        tipo: 'activation',
        tvData: newTv,
        timestamp: Date.now()
      });
    }

    // Atualizar allUsersData local
    if (!allUsersData[uid]) allUsersData[uid] = {};
    if (!allUsersData[uid].tvs) allUsersData[uid].tvs = {};
    allUsersData[uid].tvs[newId] = newTv;

    toast(`TV "${name}" criada com sucesso!`, 'success');
    closeModal('create-tv-modal');
    loadTvsForUser();
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

// ========== PLANOS ==========

async function loadPlans() {
  const tbody = document.getElementById('plans-body');
  tbody.innerHTML = '<tr><td colspan="7" class="loading"><div class="spinner"></div>Carregando...</td></tr>';
  selectedPlanUids.clear();
  updateSelectedCount();
  try {
    const snap = await db.ref('users').once('value');
    const data = snap.val() || {};
    allUsersData = data;
    plansData = {};
    const uids = Object.keys(data);
    document.getElementById('plan-stat-users').textContent = uids.length;
    tbody.innerHTML = '';
    for (const uid of uids) {
      const u = data[uid];
      const email = uid.replace(/,/g, '.');
      const plan = u.plan || { quota: 1073741824, label: '1 GB' };
      plansData[uid] = { email, plan, usedBytes: 0, quota: plan.quota || 1073741824 };
      const safeId = uid.replace(/[^a-z0-9]/gi, '_');
      const tr = document.createElement('tr');
      tr.dataset.uid = uid;
      tr.innerHTML = `
        <td><input type="checkbox" class="plan-checkbox" data-uid="${uid}" onchange="onPlanCheckChange('${uid}', this.checked)"></td>
        <td class="mono" style="font-size:12px">${email}</td>
        <td><span class="badge badge-gray" style="font-family:var(--mono);font-size:11px" id="plan-badge-${safeId}">${plan.label || '1 GB'}</span></td>
        <td class="mono" id="plan-used-${safeId}" style="font-size:11px;color:var(--ink-dim)">calc…</td>
        <td id="plan-bar-${safeId}">
          <div style="height:5px;background:var(--bg);border-radius:2px;overflow:hidden;width:120px">
            <div style="height:100%;width:0%;background:var(--ink);border-radius:2px;transition:width .5s" id="plan-barfill-${safeId}"></div>
          </div>
        </td>
        <td class="mono" id="plan-pct-${safeId}" style="font-size:11px;color:var(--ink-dim)">—</td>
        <td><button class="action-btn" onclick="openSinglePlanModal('${uid}', '${email}')">Editar</button></td>`;
      tbody.appendChild(tr);
      calcPlanStorage(uid, u.tv_midias || {});
    }
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--red)">Erro</td></tr>';
  }
}

async function calcPlanStorage(uid, tvMidias) {
  const seen = new Set(); const tasks = []; let totalBytes = 0;
  for (const tvSlug in tvMidias) {
    for (const mediaName in tvMidias[tvSlug]) {
      const path = tvMidias[tvSlug][mediaName]?.storagePath;
      if (!path || seen.has(path)) continue;
      seen.add(path);
      tasks.push(firebase.storage().ref().child(path).getMetadata().then(m => { totalBytes += m.size||0; }).catch(()=>{}));
    }
  }
  await Promise.all(tasks);
  const d = plansData[uid]; if (!d) return;
  d.usedBytes = totalBytes;
  if (allUsersData[uid]) allUsersData[uid]._usedBytes = totalBytes;
  const quota = d.quota;
  const pct = Math.min((totalBytes/quota)*100, 100);
  const fmt = b => b>=1073741824?(b/1073741824).toFixed(2)+' GB':b>=1048576?(b/1048576).toFixed(1)+' MB':(b/1024).toFixed(0)+' KB';
  const color = pct>=95?'var(--red)':pct>=80?'var(--yellow)':'var(--green)';
  const s = uid.replace(/[^a-z0-9]/gi,'_');
  const usedEl = document.getElementById(`plan-used-${s}`);
  const fillEl = document.getElementById(`plan-barfill-${s}`);
  const pctEl  = document.getElementById(`plan-pct-${s}`);
  if (usedEl) usedEl.textContent = fmt(totalBytes);
  if (fillEl) { fillEl.style.width=pct.toFixed(1)+'%'; fillEl.style.background=color; }
  if (pctEl)  { pctEl.textContent=pct.toFixed(1)+'%'; pctEl.style.color=color; }
  updatePlanStats();
}

function updatePlanStats() {
  const vals = Object.values(plansData);
  const totalUsed  = vals.reduce((a,d)=>a+(d.usedBytes||0),0);
  const totalQuota = vals.reduce((a,d)=>a+(d.quota||1073741824),0);
  const warn = vals.filter(d=>d.quota&&(d.usedBytes/d.quota)>=0.8).length;
  const full = vals.filter(d=>d.quota&&(d.usedBytes/d.quota)>=1).length;
  const fmt = b => b>=1073741824?(b/1073741824).toFixed(1)+' GB':(b/1048576).toFixed(0)+' MB';
  const tu=document.getElementById('plan-stat-total'); if(tu) tu.textContent=fmt(totalQuota);
  const uu=document.getElementById('plan-stat-used');  if(uu) uu.textContent=fmt(totalUsed);
  const wu=document.getElementById('plan-stat-warn');  if(wu) wu.textContent=warn;
  const fu=document.getElementById('plan-stat-full');  if(fu) fu.textContent=full;
}

function onPlanCheckChange(uid, checked) {
  if (checked) selectedPlanUids.add(uid); else selectedPlanUids.delete(uid);
  updateSelectedCount();
}
function toggleSelectAllPlans(checked) {
  document.querySelectorAll('.plan-checkbox').forEach(cb => { cb.checked=checked; onPlanCheckChange(cb.dataset.uid,checked); });
}
function updateSelectedCount() {
  const n = selectedPlanUids.size;
  const el=document.getElementById('plans-selected-count'); if(el) el.textContent=n>0?`${n} selecionado${n>1?'s':''}`:'0 selecionados';
  const btn=document.getElementById('bulk-apply-selected-btn'); if(btn) btn.style.display=n>0?'':'none';
}
function openBulkPlanModal() {
  const targets = selectedPlanUids.size>0 ? [...selectedPlanUids].map(u=>u.replace(/,/g,'.')).join(', ') : 'Todos os usuários ('+Object.keys(plansData).length+')';
  document.getElementById('bulk-plan-target-info').innerHTML = `<b>Destino:</b> ${targets}<br><span style="color:var(--red)">Isso sobrescreve o plano dos usuários selecionados.</span>`;
  document.getElementById('bulk-plan-progress').style.display='none';
  document.getElementById('bulk-plan-save-btn').disabled=false;
  openModal('bulk-plan-modal');
}
function onBulkQuotaChange() {
  document.getElementById('bulk-custom-row').style.display = document.getElementById('bulk-quota-select').value==='custom'?'block':'none';
}
async function applyBulkPlan() {
  const selVal=document.getElementById('bulk-quota-select').value;
  const customGb=parseFloat(document.getElementById('bulk-custom-gb').value);
  const label=document.getElementById('bulk-label-input').value.trim();
  const btn=document.getElementById('bulk-plan-save-btn');
  const pw=document.getElementById('bulk-plan-progress');
  const pt=document.getElementById('bulk-plan-progress-text');
  const pb=document.getElementById('bulk-plan-progress-bar');
  let quota;
  if (selVal==='custom') { if(!customGb||customGb<=0){toast('Informe um valor válido em GB','error');return;} quota=Math.round(customGb*1073741824); }
  else quota=parseInt(selVal);
  const planLabel=label||(quota>=1073741824?(quota/1073741824).toFixed(0)+' GB':(quota/1048576).toFixed(0)+' MB');
  const targets=selectedPlanUids.size>0?[...selectedPlanUids]:Object.keys(plansData);
  btn.disabled=true; pw.style.display='block'; let done=0;
  for (const uid of targets) {
    pt.textContent=`Aplicando ${done+1}/${targets.length}…`;
    pb.style.width=((done/targets.length)*100).toFixed(0)+'%';
    try {
      await db.ref(`users/${uid}/plan`).set({quota,label:planLabel,updatedAt:Date.now(),updatedBy:'dev-console'});
      if(allUsersData[uid]) allUsersData[uid].plan={quota,label:planLabel};
      if(plansData[uid]) { plansData[uid].plan={quota,label:planLabel}; plansData[uid].quota=quota; }
      const s=uid.replace(/[^a-z0-9]/gi,'_');
      const badgeEl=document.getElementById(`plan-badge-${s}`); if(badgeEl) badgeEl.textContent=planLabel;
    } catch(e){ console.warn('plan error',uid,e); }
    done++;
  }
  pb.style.width='100%'; pt.textContent=`Concluído! ${done} usuários atualizados.`;
  toast(`Plano ${planLabel} aplicado em ${done} usuário${done>1?'s':''}`, 'success');
  setTimeout(()=>closeModal('bulk-plan-modal'),1400);
  selectedPlanUids.clear(); updateSelectedCount();
  document.getElementById('plan-select-all').checked=false;
}
function openSinglePlanModal(uid,email) { openPlanModal(uid,email); }

// ========== CHAMADOS ==========

async function loadTickets() {
  const tbody=document.getElementById('tickets-body');
  tbody.innerHTML='<tr><td colspan="7" class="loading"><div class="spinner"></div>Carregando...</td></tr>';
  const filterStatus=document.getElementById('ticket-filter-status')?.value||'';
  try {
    const snap=await db.ref('support_tickets').once('value');
    const data=snap.val()||{};
    const tickets=Object.entries(data).map(([id,t])=>({id,...t})).filter(t=>!filterStatus||t.status===filterStatus).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const total=Object.keys(data).length;
    const open=Object.values(data).filter(t=>t.status==='open').length;
    const pending=Object.values(data).filter(t=>t.status==='pending').length;
    const closed=Object.values(data).filter(t=>t.status==='closed').length;
    const unread=Object.values(data).filter(t=>t.status!=='closed').length;
    document.getElementById('ticket-stat-total').textContent=total;
    document.getElementById('ticket-stat-open').textContent=open;
    document.getElementById('ticket-stat-pending').textContent=pending;
    document.getElementById('ticket-stat-done').textContent=closed;
    const badge=document.getElementById('ticket-badge');
    if(badge){ badge.textContent=unread; badge.style.display=unread>0?'':'none'; }
    tbody.innerHTML='';
    if(tickets.length===0){ tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--ink-dim);padding:20px;font-family:var(--mono);font-size:12px">Nenhum chamado encontrado</td></tr>'; return; }
    for (const t of tickets) {
      const statusColor=t.status==='open'?'var(--blue)':t.status==='pending'?'var(--yellow)':'var(--green)';
      const statusLabel={open:'Aberto',pending:'Aguardando',closed:'Resolvido'}[t.status]||t.status;
      const date=t.createdAt?new Date(t.createdAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
      const msgPreview=(t.message||'').slice(0,60)+((t.message||'').length>60?'…':'');
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td class="mono" style="font-size:11px">${(t.email||t.userId||'?').replace(/,/g,'.')}</td>
        <td style="font-size:13px;font-weight:500">${t.subject||'Sem assunto'}</td>
        <td style="font-size:12px;color:var(--ink-muted);max-width:200px">${msgPreview}</td>
        <td class="mono" style="font-size:11px;white-space:nowrap">${date}</td>
        <td><span style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor};padding:2px 8px;border-radius:3px;font-size:10px;font-family:var(--mono);font-weight:600">${statusLabel}</span></td>
        <td style="text-align:center"><span style="font-size:16px;cursor:pointer;opacity:.5" title="Chat em breve">💬</span></td>
        <td>
          <button class="action-btn" onclick="openTicket('${t.id}')">Ver</button>
          <button class="action-btn danger" onclick="deleteTicketById('${t.id}')">Del</button>
        </td>`;
      tbody.appendChild(tr);
    }
  } catch(e) { tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--red)">Erro ao carregar</td></tr>'; }
}

function startTicketListener() {
  if (ticketListener) return;
  try {
    ticketListener = db.ref('support_tickets').on('value', snap => {
      const data=snap.val()||{};
      const unread=Object.values(data).filter(t=>t.status!=='closed').length;
      const badge=document.getElementById('ticket-badge');
      if(badge){ badge.textContent=unread; badge.style.display=unread>0?'':'none'; }
      const section=document.getElementById('tickets-section');
      if(section&&section.classList.contains('active')) loadTickets();
    });
  } catch(e) { console.warn('ticket listener:', e); }
}

function openTicket(id) {
  db.ref(`support_tickets/${id}`).once('value').then(snap => {
    const t=snap.val(); if(!t) return;
    const date=t.createdAt?new Date(t.createdAt).toLocaleString('pt-BR'):'';
    document.getElementById('ticket-modal-title').textContent=t.subject||'Sem assunto';
    document.getElementById('ticket-modal-sub').textContent=`${(t.email||t.userId||'?').replace(/,/g,'.')} · ${date}`;
    document.getElementById('ticket-original-msg').textContent=t.message||'';
    document.getElementById('ticket-status-select').value=t.status||'open';
    document.getElementById('ticket-note-input').value=t.devNote||'';
    document.getElementById('ticket-modal-id').value=id;
    openModal('ticket-modal');
  });
}
async function saveTicket() {
  const id=document.getElementById('ticket-modal-id').value;
  const status=document.getElementById('ticket-status-select').value;
  const note=document.getElementById('ticket-note-input').value.trim();
  try {
    await db.ref(`support_tickets/${id}`).update({status,devNote:note,updatedAt:Date.now()});
    toast('Chamado atualizado','success'); closeModal('ticket-modal'); loadTickets();
  } catch(e){ toast('Erro ao salvar','error'); }
}
async function deleteTicket() { const id=document.getElementById('ticket-modal-id').value; await deleteTicketById(id); closeModal('ticket-modal'); }
async function deleteTicketById(id) {
  const ok=await showConfirm('Excluir chamado','Excluir este chamado permanentemente?'); if(!ok) return;
  try { await db.ref(`support_tickets/${id}`).remove(); toast('Chamado excluído','success'); loadTickets(); }
  catch(e){ toast('Erro ao excluir','error'); }
}

// ========== CHANGE PLANS ==========

const PLAN_CONFIGS = {
  '50mb':  { label: '50 MB',   quota: 52428800 },
  '100mb': { label: '100 MB',  quota: 104857600 },
  '512mb': { label: '512 MB',  quota: 536870912 },
  '1gb':   { label: '1 GB',    quota: 1073741824 },
  '2gb':   { label: '2 GB',    quota: 2147483648 },
  '5gb':   { label: '5 GB',    quota: 5368709120 },
  '10gb':  { label: '10 GB',   quota: 10737418240 },
  '20gb':  { label: '20 GB',   quota: 21474836480 },
};

async function loadChangePlans() {
  const tbody = document.getElementById('cp-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="loading"><div class="spinner"></div>Carregando...</td></tr>';

  const filterStatus = document.getElementById('cp-filter-status')?.value || '';

  try {
    // Carrega tickets do tipo plan_change E planos ativos com vencimento
    const [ticketsSnap, usersSnap] = await Promise.all([
      db.ref('support_tickets').orderByChild('type').equalTo('plan_change').once('value'),
      db.ref('users').once('value'),
    ]);

    const tickets = [];
    const now = Date.now();

    // Solicitações pendentes
    (ticketsSnap.val() || {}) && Object.entries(ticketsSnap.val() || {}).forEach(([id, t]) => {
      if (t.status === 'closed') return;
      tickets.push({ id, source: 'request', ...t });
    });

    // Assinaturas ativas / vencendo / inadimplentes
    const usersData = usersSnap.val() || {};
    Object.entries(usersData).forEach(([uid, u]) => {
      const plan = u.plan;
      if (!plan || !plan.expiresAt) return;
      const daysLeft = Math.ceil((plan.expiresAt - now) / 86400000);
      let billStatus = 'active';
      if (daysLeft < 0)  billStatus = 'overdue';
      else if (daysLeft <= 2) billStatus = 'expiring';
      tickets.push({ id: `sub_${uid}`, source: 'subscription', userId: uid,
        email: uid.replace(/,/g, '.'), currentPlan: plan.label, requestedPlan: plan.label,
        status: billStatus, expiresAt: plan.expiresAt, daysLeft, planKey: plan.key });
    });

    // Stats
    const pending  = tickets.filter(t => t.status === 'open' || t.status === 'pending').length;
    const waiting  = tickets.filter(t => t.status === 'awaiting_payment').length;
    const paid     = tickets.filter(t => t.status === 'active').length;
    const expiring = tickets.filter(t => t.status === 'expiring').length;
    const overdue  = tickets.filter(t => t.status === 'overdue').length;

    document.getElementById('cp-stat-pending').textContent  = pending;
    document.getElementById('cp-stat-waiting').textContent  = waiting;
    document.getElementById('cp-stat-paid').textContent     = paid;
    document.getElementById('cp-stat-expiring').textContent = expiring;
    document.getElementById('cp-stat-overdue').textContent  = overdue;

    // Badge no nav
    const badge = document.getElementById('cp-badge');
    const unread = pending + waiting + expiring;
    if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? '' : 'none'; }

    // Filtro
    const filtered = filterStatus
      ? tickets.filter(t => {
          if (filterStatus === 'pending') return t.status === 'open' || t.status === 'pending';
          return t.status === filterStatus;
        })
      : tickets;

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--ink-dim);padding:20px;font-size:12px">Nenhuma solicitação</td></tr>';
      return;
    }

    filtered.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

    for (const t of filtered) {
      const emailDisplay = (t.email || t.userId || '?').replace(/,/g, '.');
      const date = t.createdAt ? fmtDate(t.createdAt) : '—';
      const expiry = t.expiresAt ? fmtDate(t.expiresAt) : '—';

      const statusMap = {
        open: ['var(--yellow)', 'Pendente'],
        pending: ['var(--yellow)', 'Pendente'],
        awaiting_payment: ['var(--blue)', 'Aguard. Pgto'],
        active: ['var(--green)', 'Ativo'],
        expiring: ['#f97316', 'Vence em breve'],
        overdue: ['var(--red)', 'Inadimplente'],
        closed: ['var(--ink-dim)', 'Encerrado'],
      };
      const [sc, sl] = statusMap[t.status] || ['var(--ink-dim)', t.status];

      const isOverdue = t.status === 'overdue';
      const tr = document.createElement('tr');
      if (isOverdue) tr.style.background = 'rgba(239,68,68,0.06)';
      if (t.status === 'expiring') tr.style.background = 'rgba(249,115,22,0.06)';

      // Ações dependem do tipo
      let actionsHtml = '';
      if (t.source === 'request') {
        actionsHtml = `<button class="action-btn" onclick="openCpModal('${t.id}')">Ver</button>`;
      } else {
        actionsHtml = `
          <button class="action-btn primary" onclick="sendRenewalBilling('${t.userId}','${t.planKey||'1gb'}')">💰 Renovar</button>
          ${isOverdue ? `<button class="action-btn" onclick="downgradeToFree('${t.userId}')">↓ 50MB</button>` : ''}
          ${t.status === 'active' ? `<button class="action-btn" onclick="confirmRenewal('${t.userId}')">✅ Confirmar Pgto</button>` : ''}
        `;
      }

      tr.innerHTML = `
        <td class="mono" style="font-size:11px">${emailDisplay}</td>
        <td style="font-size:12px">${t.currentPlan || '—'}</td>
        <td style="font-size:12px;color:var(--blue);font-weight:600">${t.requestedPlan || '—'}</td>
        <td class="mono" style="font-size:11px">${date}</td>
        <td class="mono" style="font-size:11px;color:${t.daysLeft < 0 ? 'var(--red)' : t.daysLeft <= 2 ? '#f97316' : 'inherit'}">${expiry}</td>
        <td><span style="background:${sc}20;color:${sc};border:1px solid ${sc};padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;font-family:var(--mono)">${sl}</span></td>
        <td style="display:flex;gap:4px;flex-wrap:wrap">${actionsHtml}</td>
      `;
      tbody.appendChild(tr);
    }
  } catch(e) {
    console.error('loadChangePlans:', e);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--red)">Erro ao carregar</td></tr>';
  }
}

async function openCpModal(ticketId) {
  const snap = await db.ref(`support_tickets/${ticketId}`).once('value');
  const t = snap.val();
  if (!t) return;

  document.getElementById('cp-modal-title').textContent    = 'Solicitação de Plano';
  document.getElementById('cp-modal-sub').textContent      = (t.email || t.userId || '').replace(/,/g, '.');
  document.getElementById('cp-modal-current').textContent  = t.currentPlan   || '—';
  document.getElementById('cp-modal-requested').textContent = t.requestedPlan || '—';
  document.getElementById('cp-modal-msg').textContent      = t.message || '';
  document.getElementById('cp-modal-id').value             = ticketId;
  document.getElementById('cp-modal-userid').value         = t.userId || '';

  // Preenche valor baseado nas settings
  const settingsSnap = await db.ref('dev_settings/plans').once('value');
  const settings = settingsSnap.val() || {};
  const reqKey = planLabelToKey(t.requestedPlan);
  const planCfg = settings[reqKey] || {};
  document.getElementById('cp-modal-value').textContent = planCfg.price ? `R$ ${planCfg.price}` : '—';

  // Pré-seleciona o plano solicitado
  const sel = document.getElementById('cp-modal-plan-select');
  if (reqKey && sel) sel.value = reqKey;

  // Comprovante
  const proofWrap = document.getElementById('cp-modal-proof-wrap');
  const proofInfo = document.getElementById('cp-modal-proof-info');
  const proofLink = document.getElementById('cp-modal-proof-link');
  if (t.proof) {
    proofWrap.style.display = 'block';
    proofInfo.textContent = `Enviado em ${fmtDate(t.proofSentAt || t.updatedAt)}`;
    proofLink.href = t.proof;
  } else {
    proofWrap.style.display = 'none';
  }

  // Vencimento
  document.getElementById('cp-modal-expiry').textContent = t.expiresAt ? fmtDate(t.expiresAt) : 'Nenhum';

  openModal('cp-modal');
}

async function applyPlanChange() {
  const ticketId = document.getElementById('cp-modal-id').value;
  const userId   = document.getElementById('cp-modal-userid').value;
  const planKey  = document.getElementById('cp-modal-plan-select').value;
  const note     = document.getElementById('cp-modal-note').value.trim();

  if (!userId || !planKey) { toast('Dados incompletos', 'error'); return; }

  const cfg = PLAN_CONFIGS[planKey];
  if (!cfg) { toast('Plano inválido', 'error'); return; }

  const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // +30 dias

  try {
    // Atualiza plano do usuário
    await db.ref(`users/${userId}/plan`).set({
      key: planKey,
      label: cfg.label,
      quota: cfg.quota,
      expiresAt,
      activatedAt: Date.now(),
      activatedBy: currentUser?.email || 'dev',
    });

    // Fecha o ticket
    if (ticketId && !ticketId.startsWith('sub_')) {
      await db.ref(`support_tickets/${ticketId}`).update({
        status: 'closed',
        devNote: note || 'Plano aplicado pelo dev',
        updatedAt: Date.now(),
        unreadUser: true,
      });
    }

    toast(`Plano ${cfg.label} aplicado! Vence em 30 dias.`, 'success');
    closeModal('cp-modal');
    loadChangePlans();
  } catch(e) {
    console.error('applyPlanChange:', e);
    toast('Erro ao aplicar plano', 'error');
  }
}

async function sendBillingToUser() {
  const ticketId  = document.getElementById('cp-modal-id').value;
  const userId    = document.getElementById('cp-modal-userid').value;
  const planKey   = document.getElementById('cp-modal-plan-select').value;

  if (!userId || !planKey) { toast('Selecione o plano antes de enviar', 'error'); return; }

  // Carrega settings do plano
  const settingsSnap = await db.ref(`dev_settings/plans/${planKey}`).once('value');
  const planSettings = settingsSnap.val();

  if (!planSettings || !planSettings.pixKey) {
    toast('Configure o Pix para este plano em Settings antes de enviar', 'error');
    return;
  }

  const cfg = PLAN_CONFIGS[planKey];
  const billing = {
    planKey,
    planLabel:    cfg.label,
    price:        planSettings.price || '—',
    pixKey:       planSettings.pixKey,
    pixName:      planSettings.pixName || '',
    pixBank:      planSettings.pixBank || '',
    qrCodeUrl:    planSettings.qrCodeUrl || '',
    sentAt:       Date.now(),
    status:       'awaiting_payment',
  };

  try {
    // Salva cobrança no nó do usuário
    await db.ref(`users/${userId}/billing`).set(billing);

    // Atualiza ticket
    if (ticketId && !ticketId.startsWith('sub_')) {
      await db.ref(`support_tickets/${ticketId}`).update({
        status: 'awaiting_payment',
        updatedAt: Date.now(),
        unreadUser: true,
        billingPlanKey: planKey,
      });
    }

    toast('Cobrança enviada para o usuário!', 'success');
    closeModal('cp-modal');
    loadChangePlans();
  } catch(e) {
    console.error('sendBillingToUser:', e);
    toast('Erro ao enviar cobrança', 'error');
  }
}

async function sendRenewalBilling(userId, planKey) {
  const settingsSnap = await db.ref(`dev_settings/plans/${planKey}`).once('value');
  const planSettings = settingsSnap.val();

  if (!planSettings || !planSettings.pixKey) {
    toast('Configure o Pix para este plano em Settings', 'error');
    return;
  }

  const cfg = PLAN_CONFIGS[planKey] || { label: planKey };
  const billing = {
    planKey,
    planLabel:    cfg.label,
    price:        planSettings.price || '—',
    pixKey:       planSettings.pixKey,
    pixName:      planSettings.pixName || '',
    pixBank:      planSettings.pixBank || '',
    qrCodeUrl:    planSettings.qrCodeUrl || '',
    sentAt:       Date.now(),
    status:       'awaiting_payment',
    isRenewal:    true,
  };

  try {
    await db.ref(`users/${userId}/billing`).set(billing);
    toast('Cobrança de renovação enviada!', 'success');
    loadChangePlans();
  } catch(e) {
    toast('Erro ao enviar renovação', 'error');
  }
}

async function confirmRenewal(userId) {
  const planSnap = await db.ref(`users/${userId}/plan`).once('value');
  const plan = planSnap.val();
  if (!plan) { toast('Plano não encontrado', 'error'); return; }

  const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
  try {
    await db.ref(`users/${userId}/plan`).update({ expiresAt, activatedAt: Date.now() });
    await db.ref(`users/${userId}/billing`).update({ status: 'paid', paidAt: Date.now() });
    toast('Pagamento confirmado! Plano renovado por 30 dias.', 'success');
    loadChangePlans();
  } catch(e) {
    toast('Erro ao confirmar pagamento', 'error');
  }
}

async function downgradeToFree(userId) {
  const ok = await showConfirm('Rebaixar plano', 'Mover usuário para 50 MB (inadimplência)?');
  if (!ok) return;
  const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
  try {
    await db.ref(`users/${userId}/plan`).set({
      key: '50mb', label: '50 MB', quota: 52428800,
      expiresAt, activatedAt: Date.now(), activatedBy: 'system_downgrade',
    });
    await db.ref(`users/${userId}/billing`).update({ status: 'overdue_downgraded' });
    toast('Usuário rebaixado para 50 MB', 'success');
    loadChangePlans();
  } catch(e) {
    toast('Erro ao rebaixar plano', 'error');
  }
}

// Listener para badge de Change Plans
function startChangePlansListener() {
  try {
    db.ref('support_tickets').orderByChild('type').equalTo('plan_change').on('value', snap => {
      const data = snap.val() || {};
      const pending = Object.values(data).filter(t => t.status === 'open' || t.status === 'pending' || t.status === 'awaiting_payment').length;
      const badge = document.getElementById('cp-badge');
      if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? '' : 'none'; }
      const sec = document.getElementById('change-plans-section');
      if (sec && sec.classList.contains('active')) loadChangePlans();
    });
  } catch(e) { console.warn('cp listener:', e); }
}

function planLabelToKey(label) {
  if (!label) return '1gb';
  const l = label.toLowerCase().replace(/\s/g, '');
  const map = { '50mb':  '50mb', '100mb': '100mb', '512mb': '512mb',
    '1gb': '1gb', '2gb': '2gb', '5gb': '5gb', '10gb': '10gb', '20gb': '20gb' };
  return map[l] || '1gb';
}

// ========== SETTINGS ==========

const PLAN_KEYS = ['50mb','100mb','512mb','1gb','2gb','5gb','10gb','20gb'];

async function loadSettings() {
  const container = document.getElementById('settings-plans-container');
  if (!container) return;
  container.innerHTML = '<div class="loading" style="padding:24px;text-align:center"><div class="spinner"></div>Carregando...</div>';

  const snap = await db.ref('dev_settings/plans').once('value');
  const settings = snap.val() || {};

  container.innerHTML = '';

  for (const key of PLAN_KEYS) {
    const cfg = PLAN_CONFIGS[key];
    const s   = settings[key] || {};

    const card = document.createElement('div');
    card.className = 'table-card';
    card.style.padding = '16px';
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div>
          <div style="font-weight:700;font-size:15px">${cfg.label}</div>
          <div style="font-size:11px;font-family:var(--mono);color:var(--ink-dim)">${key}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;font-family:var(--mono);color:var(--ink-dim)">R$</span>
          <input class="edit-input" id="s-price-${key}" type="number" step="0.01" min="0" placeholder="0,00"
            value="${s.price || ''}" style="width:90px;text-align:right;font-weight:700;font-size:15px">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="edit-field" style="margin:0">
          <div class="edit-label">Chave Pix</div>
          <input class="edit-input" id="s-pixkey-${key}" type="text" placeholder="CPF, email, telefone ou aleatória"
            value="${s.pixKey || ''}">
        </div>
        <div class="edit-field" style="margin:0">
          <div class="edit-label">Nome do Favorecido</div>
          <input class="edit-input" id="s-pixname-${key}" type="text" placeholder="Nome completo"
            value="${s.pixName || ''}">
        </div>
        <div class="edit-field" style="margin:0">
          <div class="edit-label">Banco</div>
          <input class="edit-input" id="s-pixbank-${key}" type="text" placeholder="Ex: Nubank, Itaú..."
            value="${s.pixBank || ''}">
        </div>
        <div class="edit-field" style="margin:0">
          <div class="edit-label">URL do QR Code (imagem)</div>
          <input class="edit-input" id="s-qr-${key}" type="url" placeholder="https://..."
            value="${s.qrCodeUrl || ''}">
        </div>
      </div>
      ${s.qrCodeUrl ? `<img src="${s.qrCodeUrl}" alt="QR Code ${cfg.label}"
        style="margin-top:12px;width:120px;height:120px;border-radius:8px;border:1px solid var(--border);object-fit:contain;background:#fff">` : ''}
    `;
    container.appendChild(card);
  }
}

async function saveSettings() {
  const btn = document.querySelector('[onclick="saveSettings()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    const updates = {};
    for (const key of PLAN_KEYS) {
      updates[key] = {
        price:     document.getElementById(`s-price-${key}`)?.value   || '',
        pixKey:    document.getElementById(`s-pixkey-${key}`)?.value  || '',
        pixName:   document.getElementById(`s-pixname-${key}`)?.value || '',
        pixBank:   document.getElementById(`s-pixbank-${key}`)?.value || '',
        qrCodeUrl: document.getElementById(`s-qr-${key}`)?.value      || '',
      };
    }
    await db.ref('dev_settings/plans').set(updates);
    toast('Settings salvas com sucesso!', 'success');
    loadSettings(); // recarrega para mostrar QR Codes
  } catch(e) {
    console.error('saveSettings:', e);
    toast('Erro ao salvar settings', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar tudo'; }
  }
}

// ========== RULES VIEWER ==========

const CURRENT_RULES = {
  "Realtime Database": {
    "rules": {
      ".read": false,
      ".write": false,
      "users": {
        ".read": "auth != null && auth.token.email === 'micaelbardimtech@gmail.com'",
        ".write": "auth != null && auth.token.email === 'micaelbardimtech@gmail.com'",
        "$userId": {
          ".read": "auth != null && (auth.token.email.replace('.', ',') === $userId || auth.token.email === 'micaelbardimtech@gmail.com')",
          ".write": "auth != null && (auth.token.email.replace('.', ',') === $userId || auth.token.email === 'micaelbardimtech@gmail.com')",
          "categories": { ".indexOn": ["id", "name", "status"] },
          "tvs": { ".indexOn": ["id", "name", "categoryId", "status", "activationKey"] },
          "tv_midias": { "$tvSlug": { ".indexOn": ["active", "timestamp", "lastActive"] } }
        }
      },
      "midia": {
        ".read": "auth != null && auth.token.email === 'micaelbardimtech@gmail.com'",
        "$activationKey": {
          ".read": true,
          ".write": "auth != null"
        }
      }
    }
  },
  "Firebase Storage": {
    "rules_version": "2",
    "service": "firebase.storage",
    "match /b/{bucket}/o": {
      "match /tv_media/{allPaths=**}": {
        "allow read": "request.auth != null",
        "allow write": "request.auth != null",
        "allow delete": "request.auth != null && request.auth.token.email == 'micaelbardimtech@gmail.com'"
      },
      "match /{allPaths=**}": {
        "allow read, write": "request.auth != null && request.auth.token.email == 'micaelbardimtech@gmail.com'"
      }
    }
  }
};

function loadRules() {
  document.getElementById('rules-viewer').innerHTML = syntaxHighlight(CURRENT_RULES);
}

function copyRules() {
  navigator.clipboard.writeText(JSON.stringify(CURRENT_RULES, null, 2))
    .then(() => toast('Rules copiadas!', 'success'));
}

async function testRule() {
  const path = document.getElementById('rules-test-path').value.trim();
  const email = document.getElementById('rules-test-email').value.trim();
  const op = document.getElementById('rules-test-op').value;
  const resultEl = document.getElementById('rules-test-result');

  if (!path || !email) {
    resultEl.textContent = '⚠ Preencha path e email';
    resultEl.style.color = 'var(--yellow)';
    return;
  }

  resultEl.textContent = '⏳ testando...';
  resultEl.style.color = 'var(--text3)';

  // Testa tentando fazer a operação no Firebase com o usuário atual
  // Como somos o admin, testamos lendo o path diretamente
  try {
    if (op === 'read') {
      await db.ref(path).once('value');
      resultEl.textContent = `✅ ${op.toUpperCase()} permitido em /${path} (como dev admin)`;
      resultEl.style.color = 'var(--green)';
    } else {
      // write test - apenas verifica sem modificar
      resultEl.textContent = `ℹ️ Teste de WRITE requer simulação no Firebase Console`;
      resultEl.style.color = 'var(--blue)';
    }
  } catch(e) {
    resultEl.textContent = `❌ ${op.toUpperCase()} negado: ${e.message}`;
    resultEl.style.color = 'var(--red)';
  }
}

function viewTvRaw(uid, tvId) {
  const tv = allUsersData[uid]?.tvs?.[tvId];
  document.getElementById('raw-modal-title').textContent = `users/${uid}/tvs/${tvId}`;
  document.getElementById('raw-modal-content').innerHTML = syntaxHighlight(tv);
  openModal('raw-modal');
}

async function deleteTv(uid, tvId, name) {
  const ok = await showConfirm('Excluir TV', `Excluir a TV "${name}"?`);
  if (!ok) return;
  try {
    await db.ref(`users/${uid}/tvs/${tvId}`).remove();
    toast('TV excluída', 'success');
    loadTvsForUser();
  } catch(e) { toast('Erro ao excluir', 'error'); }
}

async function sendStopToTv(key) {
  if (!key || key === 'null') { toast('TV sem activation key', 'error'); return; }
  try {
    await db.ref('midia/' + key).set({ tipo: 'stop', timestamp: Date.now() });
    toast(`Stop enviado para ${key}`, 'success');
  } catch(e) { toast('Erro ao enviar stop', 'error'); }
}

// ========== MEDIA ==========
async function loadAllMedia() {
  const tbody = document.getElementById('media-body');
  tbody.innerHTML = '<tr><td colspan="7" class="loading"><div class="spinner"></div>Carregando...</td></tr>';
  try {
    const snap = await db.ref('users').once('value');
    const data = snap.val() || {};
    tbody.innerHTML = '';
    let count = 0;
    for (const uid of Object.keys(data)) {
      const u = data[uid];
      const email = uid.replace(/,/g, '.');
      if (!u.tv_midias) continue;
      for (const [tvSlug, medias] of Object.entries(u.tv_midias)) {
        for (const [mName, m] of Object.entries(medias)) {
          count++;
          const type = m.mediaType || m.type || '—';
          const statusBadge = m.active ? '<span class="badge badge-green">ativa</span>' : '<span class="badge badge-gray">inativa</span>';
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis" title="${m.displayName || mName}">${m.displayName || mName}</td>
            <td>${m.tvName || tvSlug}</td>
            <td class="mono" style="font-size:11px">${email}</td>
            <td><span class="badge badge-blue">${type}</span></td>
            <td>${statusBadge}</td>
            <td class="mono" style="font-size:11px">${fmtDate(m.timestamp)}</td>
            <td>
              <button class="action-btn" onclick="viewMediaRaw(${JSON.stringify(JSON.stringify(m))})">JSON</button>
              <button class="action-btn danger" onclick="deleteMedia('${uid}','${tvSlug}','${mName}')">Del</button>
            </td>`;
          tbody.appendChild(tr);
        }
      }
    }
    if (!count) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">Nenhuma mídia encontrada</td></tr>';
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--red)">Erro ao carregar</td></tr>';
  }
}

function viewMediaRaw(jsonStr) {
  const obj = JSON.parse(jsonStr);
  document.getElementById('raw-modal-title').textContent = 'Mídia — JSON';
  document.getElementById('raw-modal-content').innerHTML = syntaxHighlight(obj);
  openModal('raw-modal');
}

async function deleteMedia(uid, tvSlug, mName) {
  const ok = await showConfirm('Excluir mídia', `Excluir "${mName}" de ${tvSlug}?`);
  if (!ok) return;
  try {
    await db.ref(`users/${uid}/tv_midias/${tvSlug}/${mName}`).remove();
    toast('Mídia excluída', 'success');
    loadAllMedia();
  } catch(e) { toast('Erro ao excluir', 'error'); }
}

// ========== CATEGORIES ==========
async function loadAllCategories() {
  const tbody = document.getElementById('cats-body');
  tbody.innerHTML = '<tr><td colspan="6" class="loading"><div class="spinner"></div>Carregando...</td></tr>';
  try {
    const snap = await db.ref('users').once('value');
    const data = snap.val() || {};
    tbody.innerHTML = '';
    let count = 0;
    for (const uid of Object.keys(data)) {
      const u = data[uid];
      const email = uid.replace(/,/g, '.');
      if (!u.categories) continue;
      for (const [catId, cat] of Object.entries(u.categories)) {
        count++;
        const tvCount = u.tvs ? Object.values(u.tvs).filter(tv => tv.categoryId === catId).length : 0;
        const statusBadge = cat.status === 'active' ? '<span class="badge badge-green">active</span>' : '<span class="badge badge-gray">inactive</span>';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono">${catId}</td>
          <td style="font-weight:500">${cat.name}</td>
          <td class="mono" style="font-size:11px">${email}</td>
          <td>${statusBadge}</td>
          <td>${tvCount}</td>
          <td>
            <button class="action-btn" onclick="editCategory('${uid}','${catId}')">Editar</button>
            <button class="action-btn danger" onclick="deleteCategory('${uid}','${catId}','${cat.name}')">Del</button>
          </td>`;
        tbody.appendChild(tr);
      }
    }
    if (!count) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px">Nenhuma categoria encontrada</td></tr>';
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--red)">Erro ao carregar</td></tr>';
  }
}

function editCategory(uid, catId) {
  const cat = allUsersData[uid]?.categories?.[catId];
  if (!cat) { toast('Dados não disponíveis. Recarregue a seção.', 'error'); return; }
  document.getElementById('node-modal-title').textContent = `Categoria: ${cat.name}`;
  document.getElementById('node-modal-content').innerHTML = `
    <div class="edit-field"><div class="edit-label">Nome</div><input class="edit-input" id="edit-cat-name" value="${cat.name}"></div>
    <div class="edit-field"><div class="edit-label">Status</div><select class="edit-input" id="edit-cat-status"><option value="active" ${cat.status==='active'?'selected':''}>active</option><option value="inactive" ${cat.status!=='active'?'selected':''}>inactive</option></select></div>`;
  currentNodePath = `users/${uid}/categories/${catId}`;
  currentNodeData = cat;
  document.getElementById('node-delete-btn').style.display = 'none';
  document.getElementById('node-save-btn').onclick = async () => {
    const newName = document.getElementById('edit-cat-name').value.trim();
    const newStatus = document.getElementById('edit-cat-status').value;
    if (!newName) { toast('Nome inválido', 'error'); return; }
    try {
      await db.ref(currentNodePath).update({ name: newName, status: newStatus });
      toast('Categoria atualizada', 'success');
      closeModal('node-modal');
      loadAllCategories();
    } catch(e) { toast('Erro ao salvar', 'error'); }
  };
  openModal('node-modal');
}

async function deleteCategory(uid, catId, name) {
  const ok = await showConfirm('Excluir categoria', `Excluir "${name}" e todas as TVs associadas?`);
  if (!ok) return;
  try {
    await db.ref(`users/${uid}/categories/${catId}`).remove();
    const snap = await db.ref(`users/${uid}/tvs`).once('value');
    const tvs = snap.val() || {};
    for (const [tvId, tv] of Object.entries(tvs)) {
      if (tv.categoryId === catId) await db.ref(`users/${uid}/tvs/${tvId}`).remove();
    }
    toast('Categoria e TVs excluídas', 'success');
    loadAllCategories();
  } catch(e) { toast('Erro ao excluir', 'error'); }
}

// ========== DB BROWSER ==========
let currentBrowsePath = '';

async function browsePath(pathOverride) {
  const pathInput = document.getElementById('db-path-input');
  const path = pathOverride !== undefined ? pathOverride : (pathInput?.value?.trim() || '');
  currentBrowsePath = path;

  // Path bar
  renderPathBar(path);

  const container = document.getElementById('db-tree');
  container.innerHTML = '<div class="loading"><div class="spinner"></div>Buscando...</div>';

  try {
    const ref = path ? db.ref(path) : db.ref('/');
    const snap = await ref.once('value');
    const data = snap.val();
    container.innerHTML = '';

    if (data === null) {
      container.innerHTML = '<div style="padding:20px;color:var(--text3);font-family:var(--mono);font-size:13px">Nó vazio ou inexistente</div>';
      return;
    }

    if (typeof data !== 'object') {
      container.innerHTML = `<div class="json-viewer">${syntaxHighlight(JSON.stringify({ value: data }, null, 2))}</div>`;
      return;
    }

    for (const [key, val] of Object.entries(data)) {
      container.appendChild(buildTreeNode(key, val, path ? `${path}/${key}` : key));
    }
  } catch(e) {
    container.innerHTML = `<div style="padding:20px;color:var(--red);font-family:var(--mono);font-size:13px">Erro: ${e.message}</div>`;
  }
}

function renderPathBar(path) {
  const bar = document.getElementById('path-bar');
  const parts = path ? path.split('/').filter(Boolean) : [];
  let html = `<span class="path-crumb" onclick="browsePath('')">raiz</span>`;
  let accumulated = '';
  for (const part of parts) {
    accumulated += (accumulated ? '/' : '') + part;
    const p = accumulated;
    html += `<span class="path-sep">/</span><span class="path-crumb" onclick="browsePath('${p}')">${part}</span>`;
  }
  bar.innerHTML = html;
}

function buildTreeNode(key, val, fullPath) {
  const node = document.createElement('div');
  node.className = 'tree-node';
  const isObj = val && typeof val === 'object';
  const count = isObj ? Object.keys(val).length : null;

  node.innerHTML = `
    <div class="tree-node-head">
      <span class="tree-arrow">${isObj ? '▶' : '·'}</span>
      <span class="tree-key">${key}</span>
      ${count !== null ? `<span class="tree-count">{${count}}</span>` : `<span class="tree-type">${typeof val}</span>`}
      <div style="margin-left:auto;display:flex;gap:4px">
        <button class="action-btn" onclick="event.stopPropagation();openNodePath('${fullPath}')">→ Navegar</button>
        <button class="action-btn" onclick="event.stopPropagation();openNodeRaw('${fullPath}')">JSON</button>
        <button class="action-btn danger" onclick="event.stopPropagation();deleteNodePath('${fullPath}')">Del</button>
      </div>
    </div>
    <div class="tree-body">
      ${isObj ? `<div class="json-viewer" style="max-height:200px">${syntaxHighlight(val)}</div>` : `<span class="mono">${JSON.stringify(val)}</span>`}
    </div>`;

  node.querySelector('.tree-node-head').addEventListener('click', (e) => {
    if (e.target.closest('.action-btn')) return;
    node.classList.toggle('open');
  });

  return node;
}

function openNodePath(path) {
  document.getElementById('db-path-input').value = path;
  browsePath(path);
}

async function openNodeRaw(path) {
  try {
    const snap = await db.ref(path).once('value');
    document.getElementById('raw-modal-title').textContent = path;
    document.getElementById('raw-modal-content').innerHTML = syntaxHighlight(snap.val());
    openModal('raw-modal');
  } catch(e) { toast('Erro ao buscar nó', 'error'); }
}

async function deleteNodePath(path) {
  const ok = await showConfirm('Excluir nó', `Excluir o nó "${path}" e todos os filhos?`);
  if (!ok) return;
  try {
    await db.ref(path).remove();
    toast('Nó excluído', 'success');
    browsePath(currentBrowsePath);
  } catch(e) { toast('Erro ao excluir', 'error'); }
}

async function saveNodeEdit() {}

async function confirmDeleteNode() {
  if (!currentNodePath) return;
  const ok = await showConfirm('Excluir nó', `Excluir ${currentNodePath}?`);
  if (!ok) return;
  try {
    await db.ref(currentNodePath).remove();
    toast('Nó excluído', 'success');
    closeModal('node-modal');
  } catch(e) { toast('Erro ao excluir', 'error'); }
}

// ========== REALTIME ==========
function sendRealtimeCommand() {
  const key = document.getElementById('rt-key').value.trim();
  if (!key) { toast('Informe a activation key', 'error'); return; }
  const tipo = document.getElementById('rt-type').value;
  const url = document.getElementById('rt-url').value.trim();
  const dur = parseInt(document.getElementById('rt-duration').value) || 10;
  const payload = { tipo, timestamp: Date.now() };
  if (url) payload.url = url;
  if (tipo === 'image' || tipo === 'video') payload.duration = dur;

  db.ref('midia/' + key).set(payload)
    .then(() => toast(`Comando "${tipo}" enviado para ${key}`, 'success'))
    .catch(() => toast('Erro ao enviar', 'error'));
}

function monitorKey() {
  const key = document.getElementById('rt-key').value.trim();
  if (!key) { toast('Informe a activation key', 'error'); return; }
  if (rtListener) rtListener();
  const monitorEl = document.getElementById('rt-monitor');
  const statusEl = document.getElementById('rt-status');
  statusEl.className = 'badge badge-green';
  statusEl.textContent = 'online · ' + key;
  rtListener = db.ref('midia/' + key).on('value', snap => {
    const data = snap.val();
    monitorEl.innerHTML = data ? syntaxHighlight(data) : '<span style="color:var(--text3)">Sem dados</span>';
  });
}

function updateRtFields() {}

// ========== RAW COPY ==========
function copyRaw() {
  const text = document.getElementById('raw-modal-content').textContent;
  navigator.clipboard.writeText(text).then(() => toast('Copiado!', 'success'));
}

// ========== SITES ==========
const DOMAINS_KEY = 'dsigner-dev-domains';

const DEFAULT_DOMAINS = [
  { url: 'dsignertv.com.br', type: 'principal', registrar: 'Registro.br', notes: 'Site principal / landing page', status: 'checking', ssl: 'checking' },
  { url: 'app.dsignertv.com.br', type: 'painel', registrar: 'Registro.br', notes: 'Painel do cliente', status: 'checking', ssl: 'checking' },
  { url: 'dsignertv.firebaseapp.com', type: 'dev', registrar: 'Firebase', notes: 'Auth domain Firebase', status: 'checking', ssl: 'checking' },
];

function loadDomainsFromStorage() {
  try {
    const raw = localStorage.getItem(DOMAINS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_DOMAINS;
  } catch { return DEFAULT_DOMAINS; }
}

function saveDomainsToStorage(domains) {
  localStorage.setItem(DOMAINS_KEY, JSON.stringify(domains));
}

let domainsList = loadDomainsFromStorage();

function renderSitesTable() {
  const tbody = document.getElementById('sites-body');
  tbody.innerHTML = '';

  let online = 0, sslOk = 0, checking = 0;
  document.getElementById('site-stat-total').textContent = domainsList.length;

  domainsList.forEach((d, idx) => {
    const typeBadge = {
      principal: 'badge-blue', landing: 'badge-green', painel: 'badge-blue',
      api: 'badge-yellow', dev: 'badge-gray', outro: 'badge-gray'
    }[d.type] || 'badge-gray';

    const statusBadge = d.status === 'online'
      ? '<span class="badge badge-green">online</span>'
      : d.status === 'offline'
      ? '<span class="badge badge-red">offline</span>'
      : '<span class="badge badge-yellow">verificando...</span>';

    const sslBadge = d.ssl === 'ok'
      ? '<span class="badge badge-green">✓ SSL</span>'
      : d.ssl === 'error'
      ? '<span class="badge badge-red">✗ SSL</span>'
      : '<span class="badge badge-gray">—</span>';

    if (d.status === 'online') online++;
    if (d.ssl === 'ok') sslOk++;
    if (d.status === 'checking') checking++;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <a href="https://${d.url}" target="_blank" style="color:var(--blue);font-family:var(--mono);font-size:12px;text-decoration:none">
          ${d.url} ↗
        </a>
      </td>
      <td><span class="badge ${typeBadge}">${d.type}</span></td>
      <td>${statusBadge}</td>
      <td>${sslBadge}</td>
      <td style="font-size:12px;color:var(--text3)">${d.registrar || '—'}</td>
      <td style="font-size:12px;color:var(--text3);max-width:200px">${d.notes || '—'}</td>
      <td>
        <button class="action-btn" onclick="checkDomain(${idx})">↻</button>
        <button class="action-btn" onclick="editDomain(${idx})">Editar</button>
        <button class="action-btn danger" onclick="removeDomain(${idx})">Del</button>
      </td>`;
    tbody.appendChild(tr);
  });

  document.getElementById('site-stat-online').textContent = online;
  document.getElementById('site-stat-ssl').textContent = sslOk;
  document.getElementById('site-stat-checking').textContent = checking;
}

async function checkDomain(idx) {
  const d = domainsList[idx];
  d.status = 'checking';
  d.ssl = 'checking';
  renderSitesTable();

  try {
    // Usa fetch com mode no-cors para testar se o domínio responde
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(`https://${d.url}`, { mode: 'no-cors', signal: controller.signal });
    clearTimeout(timeout);
    d.status = 'online';
    d.ssl = 'ok'; // se chegou via https sem erro, SSL está ok
  } catch(e) {
    if (e.name === 'AbortError') {
      d.status = 'offline';
    } else {
      // no-cors fetch pode lançar TypeError em CORS mas o site pode estar online
      d.status = 'online';
      d.ssl = 'ok';
    }
  }

  saveDomainsToStorage(domainsList);
  renderSitesTable();
}

async function checkAllDomains() {
  toast('Verificando todos os domínios...', 'info');
  await Promise.all(domainsList.map((_, idx) => checkDomain(idx)));
  toast('Verificação concluída', 'success');
}

function addDomain() {
  const url = document.getElementById('new-domain-url').value.trim().replace(/^https?:\/\//, '');
  const type = document.getElementById('new-domain-type').value;
  const registrar = document.getElementById('new-domain-registrar').value.trim();
  const notes = document.getElementById('new-domain-notes').value.trim();

  if (!url) { toast('Informe o domínio', 'error'); return; }

  domainsList.push({ url, type, registrar, notes, status: 'checking', ssl: 'checking' });
  saveDomainsToStorage(domainsList);
  closeModal('add-domain-modal');
  document.getElementById('new-domain-url').value = '';
  document.getElementById('new-domain-registrar').value = '';
  document.getElementById('new-domain-notes').value = '';
  renderSitesTable();

  // Auto-check o novo domínio
  checkDomain(domainsList.length - 1);
  toast(`Domínio ${url} adicionado`, 'success');
}

function editDomain(idx) {
  const d = domainsList[idx];
  document.getElementById('new-domain-url').value = d.url;
  document.getElementById('new-domain-type').value = d.type;
  document.getElementById('new-domain-registrar').value = d.registrar || '';
  document.getElementById('new-domain-notes').value = d.notes || '';

  // Trocar botão para salvar edição
  const modal = document.getElementById('add-domain-modal');
  modal.querySelector('.modal-head-title').textContent = '✏ Editar Domínio';
  const saveBtn = modal.querySelector('.btn-sm.primary');
  saveBtn.textContent = 'Salvar';
  saveBtn.onclick = () => {
    domainsList[idx] = {
      ...domainsList[idx],
      url: document.getElementById('new-domain-url').value.trim().replace(/^https?:\/\//, ''),
      type: document.getElementById('new-domain-type').value,
      registrar: document.getElementById('new-domain-registrar').value.trim(),
      notes: document.getElementById('new-domain-notes').value.trim(),
    };
    saveDomainsToStorage(domainsList);
    closeModal('add-domain-modal');
    modal.querySelector('.modal-head-title').textContent = '+ Adicionar Domínio';
    saveBtn.textContent = 'Adicionar';
    saveBtn.onclick = addDomain;
    renderSitesTable();
    toast('Domínio atualizado', 'success');
  };
  openModal('add-domain-modal');
}

async function removeDomain(idx) {
  const ok = await showConfirm('Remover domínio', `Remover "${domainsList[idx].url}" da lista?`);
  if (!ok) return;
  domainsList.splice(idx, 1);
  saveDomainsToStorage(domainsList);
  renderSitesTable();
  toast('Domínio removido', 'success');
}

function initSitesSection() {
  renderSitesTable();
}

// ========== KEYBOARD ==========
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    resolveConfirm(false);
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    const dbInput = document.getElementById('db-path-input');
    if (document.getElementById('db-browser').classList.contains('active')) {
      browsePath(dbInput.value.trim());
    }
  }
});

// Close modals on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ========== APP RELEASES ==========

const RELEASE_TYPES = {
  apk:   { label: 'Android APK', icon: '📱', storagePath: 'releases/apk/' },
  win:   { label: 'Windows EXE', icon: '⊞', storagePath: 'releases/windows/' },
  linux: { label: 'Linux',       icon: '🐧', storagePath: 'releases/linux/' },
};

async function loadAppsSection() {
  for (const type of ['apk', 'win', 'linux']) await loadCurrentRelease(type);
  await loadReleasesHistory();
}

async function loadCurrentRelease(type) {
  const infoEl  = document.getElementById(type + '-current-info');
  const badgeEl = document.getElementById(type + '-version-badge');
  try {
    const snap = await db.ref('app_releases/' + type + '/current').once('value');
    const data = snap.val();
    if (!data) {
      if (infoEl) infoEl.textContent = 'Nenhuma versão publicada ainda.';
      if (badgeEl) { badgeEl.textContent = 'sem versão'; badgeEl.className = 'badge badge-gray'; }
      return;
    }
    const dateStr = data.publishedAt
      ? new Date(data.publishedAt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : '—';
    const sizeStr = data.size
      ? (data.size > 1048576 ? (data.size/1048576).toFixed(1)+' MB' : (data.size/1024).toFixed(0)+' KB')
      : '—';
    if (infoEl) infoEl.innerHTML =
      '<strong>' + (data.fileName || '—') + '</strong><br>' +
      'Publicado: ' + dateStr + ' &nbsp;·&nbsp; ' + sizeStr + '<br>' +
      (data.note ? 'Nota: <em style="color:var(--blue)">' + data.note + '</em><br>' : '') +
      '<a href="' + data.url + '" target="_blank" style="color:var(--blue);font-size:11px">↗ Download link</a>';
    if (badgeEl) { badgeEl.textContent = dateStr.split(',')[0]; badgeEl.className = 'badge badge-green'; }
  } catch(e) {
    if (infoEl) infoEl.textContent = 'Erro ao carregar.';
    console.error('loadCurrentRelease:', e);
  }
}

async function loadReleasesHistory() {
  const tbody = document.getElementById('releases-history-body');
  if (!tbody) return;
  try {
    const snap = await db.ref('app_releases').once('value');
    const data = snap.val() || {};
    const rows = [];
    for (const type in data) {
      const history = data[type] && data[type].history ? data[type].history : {};
      for (const id in history) rows.push(Object.assign({ type, id }, history[id]));
    }
    rows.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">Nenhum release publicado ainda</td></tr>';
      return;
    }
    for (const r of rows) {
      const cfg = RELEASE_TYPES[r.type] || { label: r.type, icon: '📦' };
      const date = r.publishedAt ? new Date(r.publishedAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
      const sizeStr = r.size ? (r.size > 1048576 ? (r.size/1048576).toFixed(1)+' MB' : (r.size/1024).toFixed(0)+' KB') : '—';
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><span class="badge badge-blue">' + cfg.icon + ' ' + cfg.label + '</span></td>' +
        '<td class="mono" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis">' + (r.fileName||'—') + '</td>' +
        '<td style="font-size:12px;color:var(--text3);max-width:200px">' + (r.note||'—') + '</td>' +
        '<td class="mono" style="font-size:11px;white-space:nowrap">' + date + '</td>' +
        '<td class="mono" style="font-size:11px">' + sizeStr + '</td>' +
        '<td>' + (r.url ? '<a href="'+r.url+'" target="_blank" class="action-btn">↗ Link</a>' : '—') + '</td>';
      tbody.appendChild(tr);
    }
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--red)">Erro ao carregar histórico</td></tr>';
    console.error('loadReleasesHistory:', e);
  }
}

function previewReleaseFile(type) {
  const input   = document.getElementById(type + '-file-input');
  const preview = document.getElementById(type + '-file-preview');
  const upBtn   = document.getElementById(type + '-upload-btn');
  const file    = input.files[0];
  if (!file) return;
  const sizeStr = file.size > 1048576 ? (file.size/1048576).toFixed(1)+' MB' : (file.size/1024).toFixed(0)+' KB';
  preview.textContent = '✓ ' + file.name + '  ·  ' + sizeStr;
  preview.style.display = 'block';
  upBtn.disabled = false;
}

async function uploadRelease(type) {
  const input  = document.getElementById(type + '-file-input');
  const noteEl = document.getElementById(type + '-note');
  const btn    = document.getElementById(type + '-upload-btn');
  const bar    = document.getElementById(type + '-progress-bar');
  const fill   = document.getElementById(type + '-progress-fill');
  const file   = input.files[0];
  if (!file) { toast('Selecione um arquivo primeiro', 'error'); return; }
  const cfg      = RELEASE_TYPES[type];
  const note     = noteEl ? noteEl.value.trim() : '';
  const fileName = file.name;
  const storagePath = cfg.storagePath + fileName;
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  bar.style.display = 'block';
  fill.style.width = '0%';
  try {
    const storageRef = firebase.storage().ref().child(storagePath);
    const uploadTask = storageRef.put(file);
    await new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        function(snapshot) {
          var pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          fill.style.width = pct.toFixed(0) + '%';
        }, reject, resolve);
    });
    const url = await uploadTask.snapshot.ref.getDownloadURL();
    const releaseData = { fileName, url, note, size: file.size, publishedAt: Date.now(), publishedBy: (currentUser && currentUser.email) || 'dev' };
    const historyId = 'r_' + Date.now();
    await db.ref('app_releases/' + type + '/current').set(releaseData);
    await db.ref('app_releases/' + type + '/history/' + historyId).set(releaseData);
    toast(cfg.label + ' publicado com sucesso!', 'success');
    input.value = '';
    if (noteEl) noteEl.value = '';
    document.getElementById(type + '-file-preview').style.display = 'none';
    bar.style.display = 'none';
    fill.style.width = '0%';
    await loadCurrentRelease(type);
    await loadReleasesHistory();
  } catch(e) {
    console.error('uploadRelease:', e);
    toast('Erro no upload: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    var labels = { apk: 'APK', win: 'Windows', linux: 'Linux' };
    btn.textContent = '⬆ Publicar ' + (labels[type] || type);
  }
}