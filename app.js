// B2B Marketing Attribution — custom visuals
// Reads the Attribution$ datasource via the Tableau Extension API.

let ALL = [];          // array of mapped objects
let charts = {};

function colIdx(table, name){
  for (let i=0;i<table.columns.length;i++){
    if (table.columns[i].fieldName === name) return i;
  }
  return -1;
}

function fmt(n){ return (Number(n)||0).toLocaleString('en-US'); }
function s(arr, f){ return arr.reduce((a,r)=>a+(Number(r[f])||0), 0); }

// ---------- toggle ----------
function buildModeToggle(){
  const modes = [...new Set(ALL.map(r=>r.Mode))];
  const cont = document.getElementById('modeFilter');
  ['All'].concat(modes).forEach(m=>{
    const b = document.createElement('button');
    b.textContent = m;
    b.dataset.mode = m;
    if (m==='All') b.classList.add('active');
    b.addEventListener('click', ()=>{
      cont.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      render();
    });
    cont.appendChild(b);
  });
}
function activeMode(){
  const a = document.querySelector('#modeFilter button.active');
  return a ? a.dataset.mode : 'All';
}
function filtered(){
  const m = activeMode();
  return m==='All' ? ALL : ALL.filter(r=>r.Mode===m);
}

// ---------- render ----------
function render(){
  const m = activeMode();
  const rows = filtered();
  const byGran = {};
  ['By Opco x Type','By Lead Type','Orders/Plac/Rev'].forEach(g=> byGran[g]=[]);
  rows.forEach(r=>{ if (byGran[r.Granularite]) byGran[r.Granularite].push(r); });

  const opr = byGran['Orders/Plac/Rev'];
  const dispSrc = byGran['By Opco x Type'].length ? byGran['By Opco x Type'] : byGran['By Lead Type'];

  setKPI('Dispatches', s(dispSrc,'Dispatches'), 'mode: '+(m==='All'?'All':m));
  setKPI('Orders',     s(opr,'Orders'),     'on OTS ML + OTS RIS');
  setKPI('Placements', s(opr,'Placements'), 'on OTS ML + OTS RIS');
  setKPI('Revenue',    s(opr,'Revenue'),    'on OTS ML + OTS RIS');

  document.getElementById('scopeInfo').textContent =
    'Mode: '+(m==='All'?'All':m)+'  ·  Orders/Placements/Revenue base: OTS ML + OTS RIS (dispatches on their own scope)';

  renderModeCompare(opr);
  renderOpco(byGran['By Opco x Type']);
  renderLeadType(byGran['By Lead Type']);
  renderOrdersBreakdown(opr);
  renderHeatmap(byGran['By Opco x Type']);
}

function setKPI(label, val, sub){
  [...document.querySelectorAll('.kpi')].forEach(k=>{
    if (k.querySelector('.label').textContent===label){
      k.querySelector('.value').textContent = fmt(val);
      k.querySelector('.sub').textContent = sub||'';
    }
  });
}

function newChart(id, cfg){ if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); }

// With vs Without — Orders/Placements/Revenue (OTS ML+RIS)
function renderModeCompare(opr){
  const byMode = {};
  opr.forEach(r=>{
    byMode[r.Mode] = byMode[r.Mode] || [0,0,0];
    byMode[r.Mode][0]+=Number(r.Orders)||0;
    byMode[r.Mode][1]+=Number(r.Placements)||0;
    byMode[r.Mode][2]+=Number(r.Revenue)||0;
  });
  const modes = Object.keys(byMode).sort();
  newChart('byModeChart', {
    type:'bar',
    data:{ labels:['Orders','Placements','Revenue'],
      datasets: modes.map((mode,i)=>({
        label: mode, data: byMode[mode],
        backgroundColor: i===0 ? '#2f6feb' : '#f5a623', borderRadius:6
      })) },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12 } } },
      scales:{ y:{ beginAtZero:true, grid:{ color:'rgba(30,42,58,.06)' } }, x:{ grid:{ display:false } } }
    }
  });
}

// Dispatches by Opco (By Opco x Type)
function renderOpco(g){
  const map = {};
  g.forEach(r=>{ map[r.Opco] = (map[r.Opco]||0)+(Number(r.Dispatches)||0); });
  const items = Object.entries(map).sort((a,b)=>b[1]-a[1]);
  newChart('opcoChart', {
    type:'bar',
    data:{ labels:items.map(x=>x[0]), datasets:[{ data:items.map(x=>x[1]), backgroundColor:'#2f6feb', borderRadius:6 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{ x:{ grid:{ color:'rgba(30,42,58,.06)' } }, y:{ grid:{ display:false } } }
    }
  });
}

// Dispatches by Lead Type (By Lead Type)
function renderLeadType(g){
  const map = {};
  g.forEach(r=>{ map[r['Lead Type']] = (map[r['Lead Type']]||0)+(Number(r.Dispatches)||0); });
  const items = Object.entries(map).sort((a,b)=>b[1]-a[1]);
  const PALETTE = ['#2f6feb','#6aa2ff','#22c1a3','#f5a623','#e5484d','#9b59b6','#16a085','#e67e22'];
  newChart('typeChart', {
    type:'bar',
    data:{ labels:items.map(x=>x[0]), datasets:[{ data:items.map(x=>x[1]), backgroundColor:PALETTE, borderRadius:6 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{ x:{ grid:{ color:'rgba(30,42,58,.06)' } }, y:{ grid:{ display:false } } }
    }
  });
}

// Orders/Placements/Revenue by Mode x Opco (raw)
function renderOrdersBreakdown(opr){
  const modes = [...new Set(opr.map(r=>r.Mode))].sort();
  const opcos = [...new Set(opr.map(r=>r.Opco))].sort();
  newChart('ordersChart', {
    type:'bar',
    data:{ labels:['Orders','Placements','Revenue'],
      datasets: modes.flatMap(mode=>opcos.map(opco=>{
        const row = opr.find(r=>r.Mode===mode && r.Opco===opco);
        return { label: mode + ' · ' + opco,
          data:[row?Number(row.Orders)||0:0, row?Number(row.Placements)||0:0, row?Number(row.Revenue)||0:0],
          backgroundColor: mode.includes('With') ? '#2f6feb' : '#f5a623', borderRadius:4 };
      }))
    },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12 } } },
      scales:{ y:{ beginAtZero:true, grid:{ color:'rgba(30,42,58,.06)' } } }
    }
  });
}

// Heatmap Dispatches by Opco x Lead Type (By Opco x Type)
function renderHeatmap(g){
  const opcos = [...new Set(g.map(r=>r.Opco))].sort();
  const types = [...new Set(g.map(r=>r['Lead Type']))].sort();
  const val = {};
  g.forEach(r=>{ val[r.Opco+'|'+r['Lead Type']] = Number(r.Dispatches)||0; });
  const max = Math.max(1, ...g.map(r=>Number(r.Dispatches)||0));
  let html = '<tr><th>Opco \\ Lead Type</th>' + types.map(t=>'<th>'+t+'</th>').join('') + '</tr>';
  opcos.forEach(op=>{
    html += '<tr><th>'+op+'</th>';
    types.forEach(t=>{
      const v = val[op+'|'+t]||0;
      const a = Math.round((v/max)*0.85);
      html += `<td style="background:rgba(47,111,235,${a});color:${a>0.45?'#fff':'#1e2a3a'}">${fmt(v)}</td>`;
    });
    html += '</tr>';
  });
  document.getElementById('heatTable').innerHTML = html;
}

// ---------- init ----------
function init(){
  const status = document.getElementById('status');
  tableau.extensions.initialize().then(()=>{
    const ws = tableau.extensions.dashboardContent.dashboard.worksheets[0];
    return ws.getUnderlyingDataAsync();
  }).then(table=>{
    const C = {};
    ['Mode','Scope','Granularite','Opco','Lead Type','Dispatches','Orders','Placements','Revenue']
      .forEach(f=> C[f]=colIdx(table,f));
    ALL = table.data.map(row=>({
      Mode: row[C['Mode']].value,
      Scope: row[C['Scope']].value,
      Granularite: row[C['Granularite']].value,
      Opco: row[C['Opco']].value,
      'Lead Type': row[C['Lead Type']].value,
      Dispatches: Number(row[C['Dispatches']].value)||0,
      Orders: Number(row[C['Orders']].value)||0,
      Placements: Number(row[C['Placements']].value)||0,
      Revenue: Number(row[C['Revenue']].value)||0
    }));
    buildModeToggle();
    render();
    okay(status);
  }).catch(err=> fail(status, err));
}

function okay(st){ st.textContent='Connected to datasource'; st.className='ok'; }
function fail(st, e){ st.textContent='Error: '+String(e); st.className=''; }

init();
