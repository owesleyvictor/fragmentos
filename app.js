/* Criador de UTMs da Gude - lógica do app (dados salvos no Supabase, acessível de qualquer dispositivo) */

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

let supabaseClient = null;
let campaigns = []; // cache local da última leitura do banco
let currentCampaignId = null;

function isConfigured() {
  return window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
    !window.SUPABASE_URL.includes('COLE_AQUI') && !window.SUPABASE_ANON_KEY.includes('COLE_AQUI');
}

function initSupabase() {
  const banner = document.getElementById('connBanner');
  if (!isConfigured()) {
    banner.hidden = false;
    banner.textContent = 'Supabase não configurado ainda: edite o arquivo config.js com a URL e a anon key do seu projeto para os dados serem salvos na nuvem e acessíveis em qualquer dispositivo.';
    return false;
  }
  supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  banner.hidden = true;
  return true;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowStr(d) {
  return new Date(d || Date.now()).toLocaleString('pt-BR');
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

/* ---------------- Carregamento de dados ---------------- */

async function loadCampaigns() {
  if (!supabaseClient) return;
  const { data: camps, error } = await supabaseClient
    .from('campaigns')
    .select('*')
    .order('criado_em', { ascending: false });
  if (error) { showToast('Erro ao carregar campanhas: ' + error.message); return; }

  const { data: tags, error: tagsError } = await supabaseClient
    .from('tags')
    .select('*')
    .order('criado_em', { ascending: true });
  if (tagsError) { showToast('Erro ao carregar links: ' + tagsError.message); return; }

  campaigns = camps.map(c => ({
    id: c.id,
    empresa: c.empresa,
    unidade: c.unidade,
    nome: c.nome,
    slug: c.slug,
    baseUrl: c.base_url,
    descricao: c.descricao || '',
    criadoPor: c.criado_por,
    criadoEm: nowStr(c.criado_em),
    criadoEmTs: new Date(c.criado_em).getTime(),
    atualizadoPor: c.atualizado_por,
    atualizadoEm: c.atualizado_em ? nowStr(c.atualizado_em) : '',
    tags: tags.filter(t => t.campaign_id === c.id).map(t => ({
      id: t.id,
      plataforma: t.plataforma,
      source: t.source,
      medium: t.medium,
      term: t.term,
      content: t.content,
      link: t.link,
      shortUrl: t.short_url || '',
      criadoPor: t.criado_por,
      criadoEm: nowStr(t.criado_em)
    }))
  }));
}

/* ---------------- Dashboard ---------------- */

function renderDashboard() {
  const tbody = document.getElementById('campaignsTbody');
  const search = document.getElementById('searchBox').value.trim().toLowerCase();
  const empresaFilter = document.getElementById('filterEmpresa').value;

  const empresaSel = document.getElementById('filterEmpresa');
  const empresas = [...new Set(campaigns.map(c => c.empresa).filter(Boolean))].sort();
  const prevVal = empresaSel.value;
  empresaSel.innerHTML = '<option value="">Todas as empresas/unidades</option>' +
    empresas.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
  empresaSel.value = prevVal;

  let list = campaigns.slice().sort((a, b) => (b.criadoEmTs || 0) - (a.criadoEmTs || 0));

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

async function createNewCampaign() {
  const payload = {
    empresa: '', unidade: '', nome: 'Nova campanha', slug: 'nova-campanha-' + uid().slice(0, 5),
    base_url: '', descricao: '', criado_por: getCurrentUser()
  };
  const { data, error } = await supabaseClient.from('campaigns').insert(payload).select().single();
  if (error) { showToast('Erro ao criar campanha: ' + error.message); return; }
  await loadCampaigns();
  openCampaign(data.id);
}

function openCampaign(id) {
  currentCampaignId = id;
  const c = campaigns.find(x => x.id === id);
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

async function saveCampaignFields() {
  const c = campaigns.find(x => x.id === currentCampaignId);
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

  const { error } = await supabaseClient.from('campaigns').update({
    empresa, unidade, nome, slug, base_url: baseUrl, descricao,
    atualizado_por: getCurrentUser(), atualizado_em: new Date().toISOString()
  }).eq('id', c.id);

  if (error) { showToast('Erro ao salvar: ' + error.message); return; }

  await loadCampaigns();
  showToast('Dados da campanha salvos.');
  openCampaign(c.id);
}

async function deleteCampaign() {
  const c = campaigns.find(x => x.id === currentCampaignId);
  if (!c) return;
  if (!confirm(`Excluir a campanha "${c.nome}" e todos os ${c.tags.length} links gerados? Essa ação não pode ser desfeita.`)) return;
  const { error } = await supabaseClient.from('campaigns').delete().eq('id', c.id);
  if (error) { showToast('Erro ao excluir: ' + error.message); return; }
  await loadCampaigns();
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
  const c = campaigns.find(x => x.id === currentCampaignId);
  if (!c) return;
  const url = buildUrl(c, currentFields());
  document.getElementById('linkPreview').textContent = url || 'Preencha a URL base da campanha e os campos UTM.';
}

function clearTagForm() {
  ['utm_plataforma', 'utm_source', 'utm_medium', 'utm_term', 'utm_content'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

async function addTag() {
  const c = campaigns.find(x => x.id === currentCampaignId);
  if (!c) return;
  if (!c.baseUrl) { showToast('Salve a URL base da campanha antes de gerar links.'); return; }

  const f = currentFields();
  if (f.includeSource && !f.source) { showToast('Informe o utm_source ou desmarque a opção.'); return; }
  if (f.includeMedium && !f.medium) { showToast('Informe o utm_medium ou desmarque a opção.'); return; }

  const link = buildUrl(c, f);
  const payload = {
    campaign_id: c.id,
    plataforma: f.plataforma,
    source: f.source,
    medium: f.medium,
    term: f.term,
    content: f.content,
    link,
    short_url: '',
    criado_por: getCurrentUser()
  };
  const { error } = await supabaseClient.from('tags').insert(payload);
  if (error) { showToast('Erro ao adicionar link: ' + error.message); return; }

  await loadCampaigns();
  clearTagForm();
  updateLinkPreview();
  renderTagsTable();
  showToast('Link adicionado à campanha.');
}

async function removeTag(tagId) {
  if (!confirm('Remover este link?')) return;
  const { error } = await supabaseClient.from('tags').delete().eq('id', tagId);
  if (error) { showToast('Erro ao remover: ' + error.message); return; }
  await loadCampaigns();
  renderTagsTable();
}

function renderTagsTable() {
  const c = campaigns.find(x => x.id === currentCampaignId);
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
  tbody.querySelectorAll('.short-url-input').forEach(input => input.addEventListener('change', async () => {
    const { error } = await supabaseClient.from('tags').update({ short_url: input.value.trim() }).eq('id', input.dataset.id);
    if (error) { showToast('Erro ao salvar URL encurtada: ' + error.message); return; }
    await loadCampaigns();
    showToast('URL encurtada salva.');
  }));
}

/* ---------------- QR Code ---------------- */

function openQrModal(tagId) {
  const c = campaigns.find(x => x.id === currentCampaignId);
  const t = c.tags.find(x => x.id === tagId);
  const url = t.shortUrl || t.link;

  document.getElementById('qrUrlText').textContent = url;
  const container = document.getElementById('qrContainer');
  container.innerHTML = '';

  new QRCode(container, {
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
}

function downloadQr(t, type) {
  const container = document.getElementById('qrContainer');
  const name = `qrcode-${slugify(t.plataforma || t.source || 'utm')}`;
  const svgEl = container.querySelector('svg');
  if (!svgEl) { showToast('QR ainda gerando, tente novamente.'); return; }
  const serializer = new XMLSerializer();
  let svgStr = serializer.serializeToString(svgEl);
  if (!svgStr.includes('xmlns=')) {
    svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (type === 'svg') {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    triggerDownload(URL.createObjectURL(blob), name + '.svg');
  } else {
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

function exportCampaigns(list, filename) {
  if (!list.length) { showToast('Nenhuma campanha selecionada.'); return; }
  const rows = list.flatMap(flattenCampaign);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 24 }, { wch: 34 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 50 }, { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'UTMs');

  const summaryRows = list.map(c => ({
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

async function init() {
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
    exportCampaigns(campaigns, 'gude-utms-todas-campanhas.xlsx');
  });

  document.getElementById('btnExportSelected').addEventListener('click', () => {
    const ids = [...document.querySelectorAll('.campSelect:checked')].map(cb => cb.dataset.id);
    const selected = campaigns.filter(c => ids.includes(c.id));
    exportCampaigns(selected, 'gude-utms-selecionadas.xlsx');
  });

  document.getElementById('btnExportCampaign').addEventListener('click', () => {
    const c = campaigns.find(x => x.id === currentCampaignId);
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

  if (initSupabase()) {
    await loadCampaigns();
    renderDashboard();
  }
}

document.addEventListener('DOMContentLoaded', init);
