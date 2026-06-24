/* Criador de UTMs da Gude - lógica do app (client-side, localStorage) */

const STORAGE_KEY = 'gude_utm_campaigns_v1';
const USER_KEY = 'gude_utm_current_user';

const INFO_TEXTS = {
  overview: 'Preencha os campos do UTM, selecione com os checkboxes quais parâmetros entram no link e clique em "Adicionar link" para gerar e salvar a URL final.',
  plataforma: 'Rótulo livre para você identificar o link na lista (ex: "BIO INSTAGRAM", "OUTDOOR"). Não entra na URL, é só organização interna.',
  source: 'utm_source: de onde vem o tráfego. Ex: instagram, facebook, whatsapp, google, outdoor.',
  medium: 'utm_medium: o meio/formato usado. Ex: bio, story, dm, link, qrcode, cpc, email.',
  term: 'utm_term: usado geralmente em campanhas pagas de busca para identificar palavras-chave. Opcional.',
  content: 'utm_content: diferencia anúncios ou conteúdos que apontam para o mesmo link (ex: variação de criativo, posição do botão). Opcional.',
  utm_campaign: 'utm_campaign: identifica a campanha como um todo. Use um slug sem espaços/acentos, ex: segunda-graduacao-2025-1. Esse valor é usado em todos os links desta campanha.'
};

let state = { campaigns: [] };
let currentCampaignId = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : { campaigns: [] };
  } catch (e) {
    state = { campaigns: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowStr() {
  return new Date().toLocaleString('pt-BR');
}

function getCurrentUser() {
  const v = document.getElementById('currentUser').value.trim();
  return v || 'Não identificado';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

function slugify(str) {
  return str
    .toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ---------------- Dashboard ---------------- */

function renderDashboard() {
  const tbody = document.getElementById('campaignsTbody');
  const search = document.getElementById('searchBox').value.trim().toLowerCase();
  const empresaFilter = document.getElementById('filterEmpresa').value;

  // populate empresa filter options
  const empresaSel = document.getElementById('filterEmpresa');
  const empresas = [...new Set(state.campaigns.map(c => c.empresa).filter(Boolean))].sort();
  const prevVal = empresaSel.value;
  empresaSel.innerHTML = '<option value="">Todas as empresas/unidades</option>' +
    empresas.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
  empresaSel.value = prevVal;

  let list = state.campaigns.slice().sort((a, b) => (b.criadoEmTs || 0) - (a.criadoEmTs || 0));

  if (empresaFilter) list = list.filter(c => c.empresa === empresaFilter);
  if (search) {
    list = list.filter(c =>
      [c.empresa, c.unidade, c.nome, c.slug].join(' ').toLowerCase().includes(search)
    );
  }

  tbody.innerHTML = '';
  document.getElementById('emptyState').hidden = list.length > 0;

  list.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="checkbox-cell"><input type="checkbox" class="campSelect" data-id="${c.id}" /></td>
      <td><strong>${escapeHtml(c.empresa || '-')}</strong><br/><span style="color:var(--muted)">${escapeHtml(c.unidade || '')}</span></td>
      <td>${escapeHtml(c.nome || '-')}</td>
      <td><code>${escapeHtml(c.slug || '-')}</code></td>
      <td>${(c.tags || []).length}</td>
      <td>${escapeHtml(c.criadoPor || '-')}</td>
      <td>${escapeHtml(c.criadoEm || '-')}</td>
      <td><button class="btn btn-ghost btn-small openCampaign" data-id="${c.id}">Abrir</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.openCampaign').forEach(btn => {
    btn.addEventListener('click', () => openCampaign(btn.dataset.id));
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function createNewCampaign() {
  const c = {
    id: uid(),
    empresa: '',
    unidade: '',
    nome: '',
    slug: '',
    baseUrl: '',
    descricao: '',
    criadoPor: getCurrentUser(),
    criadoEm: nowStr(),
    criadoEmTs: Date.now(),
    atualizadoPor: '',
    atualizadoEm: '',
    tags: []
  };
  state.campaigns.push(c);
  saveState();
  openCampaign(c.id);
}

function openCampaign(id) {
  currentCampaignId = id;
  const c = state.campaigns.find(x => x.id === id);
  if (!c) return;

  document.getElementById('f_empresa').value = c.empresa || '';
  document.getElementById('f_unidade').value = c.unidade || '';
  document.getElementById('f_nome').value = c.nome || '';
  document.getElementById('f_slug').value = c.slug || '';
  document.getElementById('f_baseurl').value = c.baseUrl || '';
  document.getElementById('f_descricao').value = c.descricao || '';

  const metaParts = [`Criado por ${escapeHtml(c.criadoPor || '-')} em ${escapeHtml(c.criadoEm || '-')}`];
  if (c.atualizadoPor) metaParts.push(`· Última edição por ${escapeHtml(c.atualizadoPor)} em ${escapeHtml(c.atualizadoEm)}`);
  document.getElementById('campaignMeta').innerHTML = metaParts.join(' ');

  document.getElementById('tabCampaign').disabled = false;
  switchView('campaign');
  clearTagForm();
  renderTagsTable();
  updateLinkPreview();
}

function saveCampaignFields() {
  const c = state.campaigns.find(x => x.id === currentCampaignId);
  if (!c) return;
  const empresa = document.getElementById('f_empresa').value.trim();
  const unidade = document.getElementById('f_unidade').value.trim();
  const nome = document.getElementById('f_nome').value.trim();
  let slug = document.getElementById('f_slug').value.trim();
  const baseUrl = document.getElementById('f_baseurl').value.trim();
  const descricao = document.getElementById('f_descricao').value.trim();

  if (!empresa || !unidade || !nome || !baseUrl) {
    showToast('Preencha empresa, unidade, nome da campanha e URL base.');
    return;
  }
  if (!slug) slug = slugify(nome);

  c.empresa = empresa;
  c.unidade = unidade;
  c.nome = nome;
  c.slug = slug;
  c.baseUrl = baseUrl;
  c.descricao = descricao;
  c.atualizadoPor = getCurrentUser();
  c.atualizadoEm = nowStr();

  document.getElementById('f_slug').value = slug;
  saveState();
  showToast('Dados da campanha salvos.');
  openCampaign(c.id);
}

function deleteCampaign() {
  const c = state.campaigns.find(x => x.id === currentCampaignId);
  if (!c) return;
  if (!confirm(`Excluir a campanha "${c.nome}" e todos os ${c.tags.length} links gerados? Essa ação não pode ser desfeita.`)) return;
  state.campaigns = state.campaigns.filter(x => x.id !== currentCampaignId);
  saveState();
  switchView('dashboard');
  renderDashboard();
}

/* ---------------- Tagueador ---------------- */

function buildUrl(c, fields) {
  if (!c.baseUrl) return '';
  const params = [];
  if (fields.includeSource && fields.source) params.push(`utm_source=${encodeURIComponent(fields.source)}`);
  if (fields.includeMedium && fields.medium) params.push(`utm_medium=${encodeURIComponent(fields.medium)}`);
  if (fields.includeCampaign && c.slug) params.push(`utm_campaign=${encodeURIComponent(c.slug)}`);
  if (fields.includeTerm && fields.term) params.push(`utm_term=${encodeURIComponent(fields.term)}`);
  if (fields.includeContent && fields.content) params.push(`utm_content=${encodeURIComponent(fields.content)}`);
  if (!params.length) return c.baseUrl;
  const sep = c.baseUrl.includes('?') ? '&' : '?';
  return c.baseUrl + sep + params.join('&');
}

function currentFields() {
  return {
    plataforma: document.getElementById('utm_plataforma').value.trim(),
    source: document.getElementById('utm_source').value.trim(),
    medium: document.getElementById('utm_medium').value.trim(),
    term: document.getElementById('utm_term').value.trim(),
    content: document.getElementById('utm_content').value.trim(),
    includeSource: document.getElementById('chk_source').checked,
    includeMedium: document.getElementById('chk_medium').checked,
    includeCampaign: document.getElementById('chk_campaign').checked,
    includeTerm: document.getElementById('chk_term').checked,
    includeContent: document.getElementById('chk_content').checked
  };
}

function updateLinkPreview() {
  const c = state.campaigns.find(x => x.id === currentCampaignId);
  if (!c) return;
  const url = buildUrl(c, currentFields());
  document.getElementById('linkPreview').textContent = url || 'Preencha a URL base da campanha e os campos UTM.';
}

function clearTagForm() {
  ['utm_plataforma', 'utm_source', 'utm_medium', 'utm_term', 'utm_content'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function addTag() {
  const c = state.campaigns.find(x => x.id === currentCampaignId);
  if (!c) return;
  if (!c.baseUrl) { showToast('Salve a URL base da campanha antes de gerar links.'); return; }

  const f = currentFields();
  if (f.includeSource && !f.source) { showToast('Informe o utm_source ou desmarque a opção.'); return; }
  if (f.includeMedium && !f.medium) { showToast('Informe o utm_medium ou desmarque a opção.'); return; }

  const link = buildUrl(c, f);
  const tag = {
    id: uid(),
    plataforma: f.plataforma,
    source: f.source,
    medium: f.medium,
    term: f.term,
    content: f.content,
    link,
    shortUrl: '',
    qrPng: '',
    qrSvg: '',
    criadoPor: getCurrentUser(),
    criadoEm: nowStr()
  };
  c.tags.push(tag);
  saveState();
  clearTagForm();
  updateLinkPreview();
  renderTagsTable();
  showToast('Link adicionado à campanha.');
}

function removeTag(tagId) {
  const c = state.campaigns.find(x => x.id === currentCampaignId);
  if (!c) return;
  if (!confirm('Remover este link?')) return;
  c.tags = c.tags.filter(t => t.id !== tagId);
  saveState();
  renderTagsTable();
}

function renderTagsTable() {
  const c = state.campaigns.find(x => x.id === currentCampaignId);
  const tbody = document.getElementById('tagsTbody');
  tbody.innerHTML = '';
  document.getElementById('emptyTagsState').hidden = (c.tags || []).length > 0;

  c.tags.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(t.plataforma || '-')}</td>
      <td>${escapeHtml(t.source || '-')}</td>
      <td>${escapeHtml(t.medium || '-')}</td>
      <td>${escapeHtml(t.term || '-')}</td>
      <td>${escapeHtml(t.content || '-')}</td>
      <td class="link-cell">${escapeHtml(t.link)}
        <br/><button class="btn btn-ghost btn-small copyLink" data-id="${t.id}">Copiar</button>
      </td>
      <td><input type="text" class="short-url-input" data-id="${t.id}" placeholder="cole aqui" value="${escapeHtml(t.shortUrl)}" /></td>
      <td><button class="btn btn-ghost btn-small qrBtn" data-id="${t.id}">QR Code</button></td>
      <td>${escapeHtml(t.criadoPor)}<br/><span style="color:var(--muted);font-size:11px">${escapeHtml(t.criadoEm)}</span></td>
      <td><button class="btn btn-danger btn-small removeTagBtn" data-id="${t.id}">Excluir</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.copyLink').forEach(btn => btn.addEventListener('click', () => {
    const t = c.tags.find(x => x.id === btn.dataset.id);
    navigator.clipboard.writeText(t.link);
    showToast('Link copiado!');
  }));
  tbody.querySelectorAll('.removeTagBtn').forEach(btn => btn.addEventListener('click', () => removeTag(btn.dataset.id)));
  tbody.querySelectorAll('.qrBtn').forEach(btn => btn.addEventListener('click', () => openQrModal(btn.dataset.id)));
  tbody.querySelectorAll('.short-url-input').forEach(input => input.addEventListener('change', () => {
    const t = c.tags.find(x => x.id === input.dataset.id);
    t.shortUrl = input.value.trim();
    saveState();
    showToast('URL encurtada salva.');
  }));
}

/* ---------------- QR Code ---------------- */

let qrInstance = null;

function openQrModal(tagId) {
  const c = state.campaigns.find(x => x.id === currentCampaignId);
  const t = c.tags.find(x => x.id === tagId);
  const url = t.shortUrl || t.link;

  document.getElementById('qrUrlText').textContent = url;
  const container = document.getElementById('qrContainer');
  container.innerHTML = '';

  qrInstance = new QRCode(container, {
    text: url,
    width: 220,
    height: 220,
    colorDark: '#16365c',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
    drawer: 'svg'
  });

  document.getElementById('btnDownloadPng').onclick = () => downloadQr(t, 'png');
  document.getElementById('btnDownloadSvg').onclick = () => downloadQr(t, 'svg');

  document.getElementById('qrModal').hidden = false;
  document.getElementById('qrModal').dataset.tagId = tagId;
}

function downloadQr(t, type) {
  const container = document.getElementById('qrContainer');
  const name = `qrcode-${slugify(t.plataforma || t.source || 'utm')}`;
  if (type === 'svg') {
    const svgEl = container.querySelector('svg');
    if (!svgEl) { showToast('QR ainda gerando, tente novamente.'); return; }
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgEl);
    if (!svgStr.includes('xmlns=')) {
      svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    triggerDownload(URL.createObjectURL(blob), name + '.svg');
  } else {
    const svgEl = container.querySelector('svg');
    if (!svgEl) { showToast('QR ainda gerando, tente novamente.'); return; }
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgEl);
    if (!svgStr.includes('xmlns=')) {
      svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 440; canvas.height = 440;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => triggerDownload(URL.createObjectURL(blob), name + '.png'));
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  }
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------------- Exportação Excel ---------------- */

function flattenCampaign(c) {
  if (!c.tags.length) {
    return [{
      Empresa: c.empresa, Unidade: c.unidade, Campanha: c.nome, 'UTM Campaign (slug)': c.slug,
      'URL Base': c.baseUrl, Plataforma: '', 'utm_source': '', 'utm_medium': '', 'utm_term': '', 'utm_content': '',
      'Link Final': '', 'URL Encurtada': '', 'Criado por (link)': '', 'Criado em (link)': '',
      'Criado por (campanha)': c.criadoPor, 'Criado em (campanha)': c.criadoEm, Descrição: c.descricao
    }];
  }
  return c.tags.map(t => ({
    Empresa: c.empresa,
    Unidade: c.unidade,
    Campanha: c.nome,
    'UTM Campaign (slug)': c.slug,
    'URL Base': c.baseUrl,
    Plataforma: t.plataforma,
    'utm_source': t.source,
    'utm_medium': t.medium,
    'utm_term': t.term,
    'utm_content': t.content,
    'Link Final': t.link,
    'URL Encurtada': t.shortUrl,
    'Criado por (link)': t.criadoPor,
    'Criado em (link)': t.criadoEm,
    'Criado por (campanha)': c.criadoPor,
    'Criado em (campanha)': c.criadoEm,
    Descrição: c.descricao
  }));
}

function exportCampaigns(campaigns, filename) {
  if (!campaigns.length) { showToast('Nenhuma campanha selecionada.'); return; }
  const rows = campaigns.flatMap(flattenCampaign);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 24 }, { wch: 34 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 50 }, { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'UTMs');

  const summaryRows = campaigns.map(c => ({
    Empresa: c.empresa, Unidade: c.unidade, Campanha: c.nome, Slug: c.slug,
    'Qtd. de links': c.tags.length, 'Criado por': c.criadoPor, 'Criado em': c.criadoEm, Descrição: c.descricao
  }));
  const ws2 = XLSX.utils.json_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumo de Campanhas');

  XLSX.writeFile(wb, filename);
}

/* ---------------- Navegação / Eventos ---------------- */

function switchView(view) {
  document.getElementById('dashboardView').hidden = view !== 'dashboard';
  document.getElementById('campaignView').hidden = view !== 'campaign';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'dashboard') renderDashboard();
}

function initInfoModal() {
  document.body.addEventListener('click', e => {
    const icon = e.target.closest('.info-icon');
    if (!icon) return;
    const key = icon.dataset.info;
    document.getElementById('infoModalTitle').textContent = key === 'overview' ? 'Como funciona' : `Sobre ${key}`;
    document.getElementById('infoModalText').textContent = INFO_TEXTS[key] || '';
    document.getElementById('infoModal').hidden = false;
  });
  document.getElementById('closeInfoModal').addEventListener('click', () => {
    document.getElementById('infoModal').hidden = true;
  });
}

function init() {
  loadState();
  document.getElementById('currentUser').value = localStorage.getItem(USER_KEY) || '';
  document.getElementById('currentUser').addEventListener('change', e => {
    localStorage.setItem(USER_KEY, e.target.value.trim());
  });

  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
    if (!b.disabled) switchView(b.dataset.view);
  }));

  document.getElementById('btnNewCampaign').addEventListener('click', createNewCampaign);
  document.getElementById('btnBack').addEventListener('click', () => switchView('dashboard'));
  document.getElementById('btnSaveCampaign').addEventListener('click', saveCampaignFields);
  document.getElementById('btnDeleteCampaign').addEventListener('click', deleteCampaign);
  document.getElementById('btnAddTag').addEventListener('click', addTag);

  document.getElementById('searchBox').addEventListener('input', renderDashboard);
  document.getElementById('filterEmpresa').addEventListener('change', renderDashboard);

  document.getElementById('btnSelectAll').addEventListener('click', () => {
    document.querySelectorAll('.campSelect').forEach(cb => cb.checked = true);
  });

  document.getElementById('btnExportAll').addEventListener('click', () => {
    exportCampaigns(state.campaigns, 'gude-utms-todas-campanhas.xlsx');
  });

  document.getElementById('btnExportSelected').addEventListener('click', () => {
    const ids = [...document.querySelectorAll('.campSelect:checked')].map(cb => cb.dataset.id);
    const selected = state.campaigns.filter(c => ids.includes(c.id));
    exportCampaigns(selected, 'gude-utms-selecionadas.xlsx');
  });

  document.getElementById('btnExportCampaign').addEventListener('click', () => {
    const c = state.campaigns.find(x => x.id === currentCampaignId);
    exportCampaigns([c], `gude-utm-${slugify(c.nome || 'campanha')}.xlsx`);
  });

  ['utm_plataforma', 'utm_source', 'utm_medium', 'utm_term', 'utm_content'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateLinkPreview);
  });
  ['chk_source', 'chk_medium', 'chk_campaign', 'chk_term', 'chk_content'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateLinkPreview);
  });

  document.getElementById('closeQrModal').addEventListener('click', () => {
    document.getElementById('qrModal').hidden = true;
  });

  initInfoModal();
  renderDashboard();
}

document.addEventListener('DOMContentLoaded', init);
