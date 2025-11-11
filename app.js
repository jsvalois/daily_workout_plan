// Volume + Presets (no timers) with HIIT link
const $ = (id) => document.getElementById(id);

// Live clock
function updateClock(){ const n=new Date(); const pad=(x)=>String(x).padStart(2,'0'); $('clock').textContent=`${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`; }
setInterval(updateClock, 1000); updateClock();

// Offline
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('service-worker.js').catch(()=>{}); }

const EXERCISE_MAP = await fetch('exercise_map.json').then(r=>r.json());
const IMAGE_MAP = await fetch('image_map.json').then(r=>r.json());

// Build grouped options into a select
function buildSelect(el) {
  el.innerHTML = '';
  const groups = {};
  for (const [code, meta] of Object.entries(EXERCISE_MAP)) {
    if (!groups[meta.group]) groups[meta.group] = [];
    groups[meta.group].push([code, meta.name]);
  }
  for (const g of Object.keys(groups)) {
    const og = document.createElement('optgroup'); og.label = g;
    for (const [code, name] of groups[g]) {
      const opt = document.createElement('option'); opt.value = code; opt.textContent = `${code} — ${name}`;
      og.appendChild(opt);
    }
    el.appendChild(og);
  }
}

// Populate selects
['a1','b1','a2','b2','currentExercise'].forEach(id => buildSelect($(id)));

// Session Presets
const PRESETS = {
  day1: { a1: 'C1', b1: 'C5', a2: 'T1', b2: 'T2' },
  day2: { a1: 'D1', b1: 'D3', a2: 'B2', b2: 'B3' },
  day3: { a1: 'L6', b1: 'L3', a2: 'S3', b2: 'S4' },
  day4: { a1: 'C3', b1: 'C2', a2: 'S1', b2: 'S5' },
  day5: { a1: 'D2', b1: 'D4', a2: 'T4', b2: 'T3' },
  day6: { a1: 'L2', b1: 'L8', a2: 'B4', b2: 'B1' }
};

$('preset').addEventListener('change', (e)=>{
  const p = PRESETS[e.target.value]; if (!p) return;
  Object.entries(p).forEach(([k,v]) => { const el=$(k); if (el) el.value = v; });
  $('currentExercise').value = p.a1;
  renderViewer();
});

// URL params for direct linking (?a=...&b=...&a2=...&b2=...)
const params = new URLSearchParams(location.search);
if (params.get('a')) $('a1').value = params.get('a').toUpperCase();
if (params.get('b')) $('b1').value = params.get('b').toUpperCase();
if (params.get('a2')) $('a2').value = params.get('a2').toUpperCase();
if (params.get('b2')) $('b2').value = params.get('b2').toUpperCase();
$('currentExercise').value = $('a1').value || 'C1';

// Set Active buttons
document.querySelectorAll('button[data-active]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-active');
    $('currentExercise').value = $(id).value;
    renderViewer();
  });
});

// Viewer helpers
function srcFor(code){ return IMAGE_MAP[code]?.src || `assets/exercises/${code}.jpg`; }
function labelFor(code){ const meta = EXERCISE_MAP[code] || {name:'Unknown'}; return `${code} — ${meta.name}`; }
function groupFor(code){ return EXERCISE_MAP[code]?.group || ''; }

// Render viewer
function renderViewer(){
  const code = $('currentExercise').value;
  $('viewerLabel').textContent = labelFor(code);
  const img = srcFor(code);
  fetch(img, {cache:'force-cache'}).then(r => {
    if (!r.ok || !r.headers.get('content-type')?.includes('image')) throw new Error('not image');
    return r.blob();
  }).then(b => {
    $('viewerImg').src = URL.createObjectURL(b);
    $('viewerImg').alt = labelFor(code);
  }).catch(()=>{
    $('viewerImg').src = 'assets/exercises/placeholder.svg';
    $('viewerImg').alt = 'Placeholder';
  });
}
renderViewer();

// HIIT logging
$('logHiitBtn').addEventListener('click', ()=>{
  const now = new Date();
  addLog({ type:'hiit', ts: now.toISOString(), date: now.toISOString().slice(0,10), duration_min: 20 });
  alert('Logged a 20‑minute HIIT session.');
});

// Logging for strength
const STORAGE_KEY = 'dwc_logs_v4';
function loadLogs(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveLogs(d){ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

document.getElementById('logBtn').addEventListener('click', () => {
  const code = $('currentExercise').value;
  if (!code) { alert('Pick an active exercise.'); return; }
  const reps = parseInt($('reps').value, 10);
  const weight = parseFloat($('weight').value);
  const unit = $('unit').value;
  const notes = $('notes').value.trim();
  const nSets = Math.max(1, parseInt($('nSets').value, 10) || 1);
  if (!reps || reps < 1) { alert('Enter reps (>=1)'); return; }
  if (isNaN(weight) || weight < 0) { alert('Enter a valid weight'); return; }

  const meta = EXERCISE_MAP[code] || {};
  const now = new Date();
  const ymd = now.toISOString().slice(0,10);
  const data = loadLogs();
  for (let i=0;i<nSets;i++) {
    data.push({
      type: 'set',
      ts: now.toISOString(),
      date: ymd,
      exercise: code,
      name: meta.name || '',
      group: meta.group || '',
      reps, weight, unit, notes,
      volume: reps * weight // native unit
    });
  }
  saveLogs(data);
  $('reps').value = ''; $('weight').value = ''; $('notes').value = ''; $('nSets').value = 1; $('reps').focus();
  renderTablesAndTotals();
});

// Filters & totals
const LB_PER_KG = 2.2046226218;
function toDisplayWeight(w, unit, displayUnit){
  if (displayUnit === 'lb') return unit === 'kg' ? w * LB_PER_KG : w;
  if (displayUnit === 'kg') return unit === 'lb' ? w / LB_PER_KG : w;
  return w;
}
function dateInRange(d, range){
  const dayMs = 86400000;
  const now = new Date();
  const dDate = new Date(d + 'T00:00:00');
  const today = new Date(now.toISOString().slice(0,10) + 'T00:00:00');
  if (range === 'today') return dDate.getTime() === today.getTime();
  if (range === '7d') return (today - dDate) <= 6*dayMs && (today - dDate) >= 0;
  if (range === '30d') return (today - dDate) <= 29*dayMs && (today - dDate) >= 0;
  return true;
}

['displayUnit','rangeSelect'].forEach(id => $(id).addEventListener('change', renderTablesAndTotals));
$('filterText').addEventListener('input', renderTablesAndTotals);

function renderTablesAndTotals(){
  const displayUnit = $('displayUnit').value;
  const range = $('rangeSelect').value;
  const filter = ($('filterText').value || '').toLowerCase();
  const all = loadLogs();

  // Separate logs: sets vs hiit
  const sets = all.filter(r => r.type === 'set' && dateInRange(r.date, range));
  const hiits = all.filter(r => r.type === 'hiit' && dateInRange(r.date, range));

  // Log table (both types)
  const tbody = document.querySelector('#logTable tbody'); tbody.innerHTML = '';
  for (const r of all.filter(r => dateInRange(r.date || r.ts?.slice(0,10), range))) {
    if (r.type === 'set') {
      const codeName = `${r.exercise} ${r.name}`.toLowerCase();
      if (filter && !codeName.includes(filter)) continue;
      const wDisp = toDisplayWeight(r.weight, r.unit, displayUnit);
      const vDisp = wDisp * r.reps;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${new Date(r.ts).toLocaleString()}</td><td>SET</td>
        <td><strong>${r.exercise}</strong></td><td>${r.name}</td><td>${r.group||''}</td>
        <td>${r.reps}</td><td>${wDisp.toFixed(2)}</td><td>${displayUnit}</td><td>${vDisp.toFixed(2)}</td><td>${r.notes||''}</td>`;
      tbody.appendChild(tr);
    } else if (r.type === 'hiit') {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${new Date(r.ts).toLocaleString()}</td><td>HIIT</td>
        <td colspan="7">20‑minute HIIT</td><td></td>`;
      tbody.appendChild(tr);
    }
  }

  // Totals (sets only)
  let totalSets = sets.length;
  let sumReps = 0, sumWeightDisp = 0, sumVolumeDisp = 0;

  const byGroup = new Map();
  const byExercise = new Map();

  for (const r of sets) {
    const w = toDisplayWeight(r.weight, r.unit, displayUnit);
    const v = w * r.reps;
    sumReps += r.reps;
    sumWeightDisp += w;
    sumVolumeDisp += v;
    if (r.group) byGroup.set(r.group, (byGroup.get(r.group)||0)+v);
    const exKey = `${r.exercise} — ${r.name}`;
    byExercise.set(exKey, (byExercise.get(exKey)||0)+v);
  }

  $('totalVolume').textContent = `${sumVolumeDisp.toFixed(2)} ${displayUnit}`;
  $('totalSets').textContent = `${totalSets}`;
  $('avgReps').textContent = totalSets ? (sumReps/totalSets).toFixed(1) : '0';
  $('avgWeight').textContent = totalSets ? (sumWeightDisp/totalSets).toFixed(1) + ' ' + displayUnit : '0';
  $('hiitCount').textContent = `${hiits.length}`;

  // Fill tables
  const gBody = document.querySelector('#byGroup tbody'); gBody.innerHTML = '';
  for (const [g, v] of Array.from(byGroup.entries()).sort((a,b)=>b[1]-a[1])) {
    const tr = document.createElement('tr'); tr.innerHTML = `<td>${g}</td><td>${v.toFixed(2)} ${displayUnit}</td>`; gBody.appendChild(tr);
  }
  const eBody = document.querySelector('#byExercise tbody'); eBody.innerHTML = '';
  for (const [e, v] of Array.from(byExercise.entries()).sort((a,b)=>b[1]-a[1])) {
    const tr = document.createElement('tr'); tr.innerHTML = `<td>${e}</td><td>${v.toFixed(2)} ${displayUnit}</td>`; eBody.appendChild(tr);
  }
}
renderTablesAndTotals();

// Export/Import/Clear
$('exportCSV').addEventListener('click', () => {
  const data = loadLogs();
  const header = ['type','ts','date','exercise','name','group','reps','weight','unit','volume','duration_min','notes'];
  const rows = [header.join(',')].concat(
    data.map(r => header.map(k => {
      const v = (r[k] ?? '').toString().replace(/"/g, '""');
      return /[",\n]/.test(v) ? `"${v}"` : v;
    }).join(','))
  );
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'dwc_logs.csv'; a.click(); URL.revokeObjectURL(url);
});
$('exportJSON').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(loadLogs(), null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'dwc_logs.json'; a.click(); URL.revokeObjectURL(url);
});
$('importJSON').addEventListener('change', (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { try { const parsed = JSON.parse(reader.result); if (!Array.isArray(parsed)) throw new Error('Invalid JSON'); localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); renderTablesAndTotals(); alert('Import complete.'); } catch(err){ alert('Import failed: '+err.message); } };
  reader.readAsText(f);
});
$('clearLogs').addEventListener('click', () => {
  if (confirm('Delete all logged entries?')) { localStorage.removeItem(STORAGE_KEY); renderTablesAndTotals(); }
});
