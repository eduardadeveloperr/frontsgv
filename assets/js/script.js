// ======================================================
// Configurações e Estado da Aplicação
// ======================================================

// Chaves para armazenamento no localStorage
const STORAGE_KEY = 'job_applications';
const OLD_STORAGE_KEY = 'gcandidaturas:v1';

// Status válidos para as candidaturas
const VALID_STATUSES = ['Não Iniciado','Em Andamento','Aprovado','Reprovado'];

// Estado global da aplicação
let applications = []; // Array com todas as candidaturas
let currentFilter = { search:'', status:'' }; // Filtros ativos
let currentSort   = { by:'titulo', direction:'asc' }; // Ordenação atual

// ======================================================
// Referências aos Elementos DOM
// ======================================================

// Modal e formulário
const modal              = document.getElementById('modal');
const applicationForm    = document.getElementById('application-form');

// Tabela e exibição
const tableBody          = document.getElementById('application-table-body');
const kpiSection         = document.getElementById('kpi-section');
const applicationTable   = document.getElementById('application-table');
const noApplicationsDiv  = document.getElementById('no-applications');

// Filtros e busca
const searchInput        = document.getElementById('search-input');
const statusFilter       = document.getElementById('status-filter');
const clearFiltersBtn    = document.getElementById('clear-filters-btn');

// Botões de ação
const exportJsonBtn      = document.getElementById('export-json-btn');
const exportPdfBtn       = document.getElementById('export-pdf-btn');
const resetDataBtn       = document.getElementById('reset-data-btn');
const addBtn             = document.getElementById('add-btn');

// Sistema de mensagens
const messageBox         = document.getElementById('message-box');

// ======================================================
// Utilitários
// ======================================================

// Função para evitar múltiplas execuções rápidas (debounce)
const debounce = (fn, ms=200)=>{ 
  let id; 
  return (...a)=>{ 
    clearTimeout(id); 
    id = setTimeout(()=>fn(...a), ms); 
  }; 
};

// Exibe mensagens temporárias para o usuário
function showToast(msg, isError=false){
  messageBox.textContent = msg;
  messageBox.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  messageBox.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> messageBox.classList.remove('show'), 2600);
}

// ======================================================
// Gerenciamento do Modal
// ======================================================

// Abre o modal para adicionar/editar candidatura
function openModal(initialFocusId='form-titulo'){
  modal.classList.add('open');
  document.getElementById(initialFocusId)?.focus();
}

// Fecha o modal e limpa o formulário
function closeModal(){
  modal.classList.remove('open');
  applicationForm.reset();
}

// Fecha modal com ESC ou clicando fora
modal.addEventListener('click', (e)=>{ 
  if(e.target===modal) closeModal(); 
});
document.addEventListener('keydown', (e)=>{ 
  if(e.key==='Escape' && modal.classList.contains('open')) closeModal(); 
});

// ======================================================
// Armazenamento Local (LocalStorage)
// ======================================================

// Carrega candidaturas do localStorage
function loadApplications(){
  try{
    // Tenta carregar da versão atual
    const v2 = localStorage.getItem(STORAGE_KEY);
    if (v2) return JSON.parse(v2);
    
    // Migração da versão antiga (se existir)
    const v1 = localStorage.getItem(OLD_STORAGE_KEY);
    if (v1){
      const data = JSON.parse(v1);
      saveApplications(data);
      localStorage.removeItem(OLD_STORAGE_KEY);
      showToast('Dados antigos migrados.');
      return data;
    }
  }catch(e){ 
    console.error(e); 
    showToast('Falha ao carregar dados.', true); 
  }
  return [];
}

// Salva candidaturas no localStorage
function saveApplications(data){
  try{ 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); 
  }
  catch(e){ 
    console.error(e); 
    showToast('Erro ao salvar dados.', true); 
  }
}

// Apaga todos os dados do navegador
function resetData(){
  if (confirm('Apagar TODOS os dados do navegador?') && confirm('Confirma novamente?')){
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OLD_STORAGE_KEY);
    applications = []; 
    currentFilter = {search:'',status:''}; 
    currentSort = {by:'titulo',direction:'asc'};
    renderApp(); 
    showToast('Dados apagados.');
  }
}

// ======================================================
// Validação e CRUD (Create, Read, Update, Delete)
// ======================================================

// Verifica se já existe candidatura com mesmo título e empresa
function isDuplicate(titulo, empresa){
  const t = titulo.trim().toLowerCase(), e = empresa.trim().toLowerCase();
  return applications.some(a => a.titulo.toLowerCase()===t && a.empresa.toLowerCase()===e);
}

// Cria uma nova candidatura
function createApplication(titulo, empresa){
  if (!titulo.trim() || !empresa.trim()){ 
    showToast('Título e Empresa são obrigatórios.', true); 
    return false; 
  }
  if (isDuplicate(titulo, empresa)){ 
    showToast('Candidatura duplicada.', true); 
    return false; 
  }
  applications.unshift({ 
    titulo: titulo.trim(), 
    empresa: empresa.trim(), 
    status: VALID_STATUSES[0] // Status padrão: "Não Iniciado"
  });
  saveApplications(applications); 
  showToast('Candidatura adicionada!');
  return true;
}

// ======================================================
// Filtros, Busca e Ordenação
// ======================================================

// Aplica filtros e busca nas candidaturas
function filterAndSearch(arr){
  const q = (currentFilter.search||'').toLowerCase();
  let out = arr;
  if (q) out = out.filter(a => (a.titulo+' '+a.empresa).toLowerCase().includes(q));
  if (currentFilter.status) out = out.filter(a => a.status===currentFilter.status);
  return out;
}

// Ordena as candidaturas conforme configuração atual
function sortApplications(arr){
  const { by, direction } = currentSort;
  const mul = direction==='asc' ? 1 : -1;
  return arr.sort((a,b)=>{
    const A = by==='status' ? VALID_STATUSES.indexOf(a.status) : (a[by]||'').toLowerCase();
    const B = by==='status' ? VALID_STATUSES.indexOf(b.status) : (b[by]||'').toLowerCase();
    if (A<B) return -1*mul; 
    if (A>B) return 1*mul; 
    return 0;
  });
}

// ======================================================
// KPIs (Indicadores de Performance)
// ======================================================

// Calcula estatísticas das candidaturas
function calculateKPIs(arr){
  const total = arr.length;
  const counts = Object.fromEntries(VALID_STATUSES.map(s=>[s,0]));
  arr.forEach(a=> counts[a.status]++);
  const pct = Object.fromEntries(VALID_STATUSES.map(s=>[
    s, total ? Math.round(counts[s]*100/total) : 0
  ]));
  return { total, counts, pct };
}

// Renderiza os KPIs na tela
function renderKPIs(k){
  kpiSection.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <h4>Total de Candidaturas</h4>
        <div class="kpi-value"><span>${k.total}</span></div>
      </div>
      ${VALID_STATUSES.map(s=> `
        <div class="kpi-card">
          <h4>${s}</h4>
          <div class="kpi-value">
            <span>${k.counts[s]}</span>
            <span class="kpi-percentage">(${k.pct[s]}%)</span>
          </div>
        </div>
      `).join('')}
    </div>`;
}

// ======================================================
// Renderização da Tabela
// ======================================================

// HTML das opções de status para os selects
const STATUS_OPTIONS_HTML = VALID_STATUSES.map(s=>
  `<option value="${s}">${s}</option>`
).join('');

// Renderiza a tabela com as candidaturas
function renderTable(data){
  tableBody.innerHTML = '';

  const isFiltering = currentFilter.search || currentFilter.status;
  
  // Verifica se não há dados para exibir
  if (data.length===0){
    applicationTable.style.display = 'none';
    noApplicationsDiv.style.display = 'flex';
    noApplicationsDiv.querySelector('p').textContent = (applications.length && isFiltering)
      ? 'Nenhuma candidatura encontrada com os filtros atuais.'
      : 'Sem candidaturas ainda. Use o botão "+ Adicionar".';
    updateSortIcons();
    return;
  }

  // Exibe a tabela com dados
  noApplicationsDiv.style.display = 'none';
  applicationTable.style.display = 'table';

  const frag = document.createDocumentFragment();
  data.forEach(app=>{
    const idx = applications.findIndex(a=> a.titulo===app.titulo && a.empresa===app.empresa);
    const tr = document.createElement('tr');
    tr.dataset.index = idx;
    tr.innerHTML = `
      <td data-label="Título">${app.titulo}</td>
      <td data-label="Empresa">${app.empresa}</td>
      <td data-label="Status">
        <span class="status-chip" data-status="${app.status}">
          <span class="status-dot" aria-hidden="true"></span>
          <span class="status-text">${app.status}</span>
        </span>
        <select class="status-select" data-index="${idx}" 
                aria-label="Alterar status de ${app.titulo}">
          ${STATUS_OPTIONS_HTML}
        </select>
      </td>
      <td data-label="Ações">
        <button class="btn-delete" data-index="${idx}" 
                aria-label="Excluir candidatura de ${app.titulo}">
          Excluir
        </button>
      </td>
    `;
    tr.querySelector('.status-select').value = app.status;
    frag.appendChild(tr);
  });
  tableBody.appendChild(frag);
  updateSortIcons();
}

// ======================================================
// Renderização Geral da Aplicação
// ======================================================

// Atualiza toda a interface da aplicação
function renderApp(){
  const filtered = filterAndSearch(applications);
  const sorted   = sortApplications(filtered);
  renderKPIs(calculateKPIs(applications)); // KPIs usam dados totais (não filtrados)
  renderTable(sorted);
}

// ======================================================
// Ícones de Ordenação
// ======================================================

// Atualiza os ícones de ordenação na tabela
function updateSortIcons(){
  document.querySelectorAll('.sortable').forEach(th=>{
    const sortBy = th.dataset.sortBy;
    const icon = th.querySelector('.sort-icon');
    th.classList.remove('sorted-asc','sorted-desc');
    icon.textContent = '';
    if (currentSort.by===sortBy){
      const asc = currentSort.direction==='asc';
      th.classList.add(`sorted-${currentSort.direction}`);
      icon.textContent = asc ? '▲' : '▼';
    }
  });
}

// ======================================================
// Event Listeners
// ======================================================

// Submit do formulário de nova candidatura
applicationForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const titulo  = document.getElementById('form-titulo').value;
  const empresa = document.getElementById('form-empresa').value;
  if (createApplication(titulo, empresa)) {
    closeModal();
    renderApp();
  }
});

// Eventos de clique em vários elementos
document.addEventListener('click', (e)=>{
  const t = e.target;

  // Abrir modal
  if (t.id==='add-btn'){ openModal('form-titulo'); }
  
  // Fechar modal
  if (t.classList?.contains('close-btn') || t.classList?.contains('modal-cancel-btn')){ 
    closeModal(); 
  }
  
  // Limpar filtros
  if (t.id==='clear-filters-btn'){ 
    searchInput.value=''; 
    statusFilter.value=''; 
    currentFilter={search:'',status:''}; 
    renderApp(); 
  }

  // Exportar JSON
  if (t.id==='export-json-btn'){
    const blob = new Blob([JSON.stringify(applications,null,2)], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { 
      href:url, 
      download:'candidaturas.json' 
    });
    document.body.appendChild(a); 
    a.click(); 
    a.remove(); 
    URL.revokeObjectURL(url);
    showToast('Exportado para candidaturas.json');
  }

  // Exportar PDF
  if (t.id==='export-pdf-btn'){ exportAsPDF(); }

  // Resetar dados
  if (t.id==='reset-data-btn'){ resetData(); }

  // Deletar candidatura
  if (t.classList?.contains('btn-delete')){
    const idx = +t.dataset.index;
    const app = applications[idx];
    if (confirm(`Deletar "${app.titulo}" em "${app.empresa}"?`)){
      applications.splice(idx,1); 
      saveApplications(applications); 
      showToast('Excluída.'); 
      renderApp();
    }
  }
});

// Eventos de change (status e filtros)
document.addEventListener('change', (e)=>{
  const t = e.target;

  // Filtro por status
  if (t===statusFilter){ 
    currentFilter.status = t.value; 
    renderApp(); 
  }

  // Alterar status de uma candidatura
  if (t.classList?.contains('status-select')){
    const idx = +t.dataset.index;
    const val = t.value;
    if (!VALID_STATUSES.includes(val)){ 
      showToast('Status inválido.', true); 
      t.value = applications[idx].status; 
      return; 
    }
    applications[idx].status = val; 
    saveApplications(applications);
    showToast(`Status atualizado para "${val}".`); 
    renderApp();
  }
});

// Busca com debounce (evita buscas muito rápidas)
searchInput.addEventListener('input', debounce(()=>{
  currentFilter.search = searchInput.value;
  renderApp();
}, 200));

// Ordenação da tabela (click no cabeçalho)
applicationTable.querySelector('thead').addEventListener('click', (e)=>{
  const th = e.target.closest('.sortable'); 
  if (!th) return;
  const sortBy = th.dataset.sortBy;
  if (currentSort.by === sortBy) {
    currentSort.direction = currentSort.direction==='asc' ? 'desc' : 'asc';
  } else { 
    currentSort.by = sortBy; 
    currentSort.direction = 'asc'; 
  }
  renderApp();
});

// ======================================================
// Inicialização da Aplicação
// ======================================================

document.addEventListener('DOMContentLoaded', ()=>{
  applications = loadApplications();
  renderApp();

  // Garante que apenas o botão do header abre o modal
  addBtn?.addEventListener('click', ()=> openModal('form-titulo'));
});

// ======================================================
// Exportação em PDF (sem bibliotecas externas)
// ======================================================

// Escapa caracteres HTML para segurança
function escapeHtml(s){ 
  return String(s).replace(/[&<>"']/g, m => 
    ({'&':'&amp;','<':'&gt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])
  ); 
}

// Gera e abre relatório em PDF
function exportAsPDF(){
  const k = calculateKPIs(applications);
  const rows = applications.map(a => `
    <tr>
      <td>${escapeHtml(a.titulo)}</td>
      <td>${escapeHtml(a.empresa)}</td>
      <td>${escapeHtml(a.status)}</td>
    </tr>
  `).join('');

  const today = new Date().toLocaleString('pt-BR');
  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Relatório de Candidaturas</title>
  <style>
    body{font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,Arial,sans-serif;color:#111;margin:24px}
    h1{font-size:20px;margin:0 0 6px 0}
    .meta{color:#555;margin:0 0 16px 0}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}
    th{background:#f5f5f7;text-transform:uppercase;font-size:12px;letter-spacing:.04em}
    .kpis{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 16px}
    .kpi{border:1px solid #eee;border-radius:8px;padding:8px 10px}
    @media print { @page { size: A4; margin: 16mm } }
  </style>
</head>
<body>
  <h1>Relatório de Candidaturas</h1>
  <p class="meta">Gerado em: ${today}</p>
  <div class="kpis">
    <div class="kpi"><strong>Total:</strong> ${k.total}</div>
    <div class="kpi"><strong>Não Iniciado:</strong> ${k.counts['Não Iniciado']} (${k.pct['Não Iniciado']}%)</div>
    <div class="kpi"><strong>Em Andamento:</strong> ${k.counts['Em Andamento']} (${k.pct['Em Andamento']}%)</div>
    <div class="kpi"><strong>Aprovado:</strong> ${k.counts['Aprovado']} (${k.pct['Aprovado']}%)</div>
    <div class="kpi"><strong>Reprovado:</strong> ${k.counts['Reprovado']} (${k.pct['Reprovado']}%)</div>
  </div>
  <table>
    <thead><tr><th>Título</th><th>Empresa</th><th>Status</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="3">Sem candidaturas</td></tr>'}</tbody>
  </table>
  <script>window.print();</script>
</body>
</html>`;
  
  const w = window.open('', '_blank');
  w.document.open(); 
  w.document.write(html); 
  w.document.close();
}