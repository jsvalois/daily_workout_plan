// Volume-first tracker (no EMOM)
// Live clock
function updateClock(){ const n=new Date(); const pad=(x)=>String(x).padStart(2,'0'); document.getElementById('clock').textContent=`${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`; }
setInterval(updateClock, 1000); updateClock();

// Offline
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('service-worker.js').catch(()=>{}); }

const EXERCISE_MAP = await fetch('exercise_map.json').then(r=>r.json());
const IMAGE_MAP = await fetch('image_map.json').then(r=>r.json());

// Build grouped options
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
      const opt = document.createElement('option');
      opt.value = code; opt.textContent = `${code} — ${name}`;
      og.appendChild(opt);
    }
    el.appendChild(og);
  }
}

['e1','e2','e3','e4','currentExercise'].forEach(id => buildSelect(document.getElementById(id)));

// Preset defaults
document.getElementById('e1').value = 'C1';
document.getElementById('e2').value = 'C5';
document.getElementById('currentExercise').value = 'C1';

// Set Active buttons
document.querySelectorAll('button[data-active]').forEach(btn => {
  btn.addEventListener('click', () => {
    const srcId = btn.getAttribute('data-active');
    const code = document.getElementById(srcId).value;
    document.getElementById('currentExercise').value = code;
    renderViewer();
  });
});

// When currentExercise changes, update viewer
document.getElementById('currentExercise').addEventListener('change', renderViewer);
['e1','e2','e3','e4'].forEach(id => document.getElementById(id).addEventListener('change', ()=>{
  // if active is empty or not in list, set to this
  const cur = document.getElementById('currentExercise').value;
  const codes = new Set(['e1','e2','e3','e4'].map(x=>document.getElementById(x).value));
  if (!codes.has(cur)) { document.getElementById('currentExercise').value = document.getElementById(id).value; renderViewer(); }
}));

function srcFor(code) {
  return IMAGE_MAP[code]?.src || `assets/exercises/${code}.jpg`;
}
function labelFor(code) {
  const meta = EXERCISE_MAP[code] || {name:'Unknown', group:'?'};
  return `${code} — ${meta.name}`;
}
function groupFor(code) {
  return EXERCISE_MAP[code]?.group || '';
}
function renderViewer() {
  const code = document.getElementById('currentExercise').value;
  document.getElementById('viewerLabel').textContent = labelFor(code);
  const img = srcFor(code);
  fetch(img, {cache:'force-cache'}).then(r => {
    if (!r.ok || !r.headers.get('content-type')?.includes('image')) throw new Error('not image');
    return r.blob();
  }).then(b => {
    document.getElementById('viewerImg').src = URL.createObjectURL(b);
    document.getElementById('viewerImg').alt = labelFor(code);
  }).catch(()=>{
    document.getElementById('viewerImg').src = 'assets/exercises/placeholder.svg';
    document.getElementById('viewerImg').alt = 'Placeholder';
  });
}
renderViewer();

// Logging
const STORAGE_KEY = 'dwc_logs_v3';
function loadLogs(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveLogs(d){ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

function addLog(entry){ const d = loadLogs(); d.push(entry); saveLogs(d); renderTablesAndTotals(); }

document.getElementById('logBtn').addEventListener('click', () => {
  const code = document.getElementById('currentExercise').value;
  if (!code) { alert('Pick an active exercise.'); return; }
  const reps = parseInt(document.getElementById('reps').value, 10);
  const weight = parseFloat(document.getElementById('weight').value);
  const unit = document.getElementById('unit').value;
  const notes = document.getElementById('notes').value.trim();
  const nSets = Math.max(1, parseInt(document.getElementById('nSets').value, 10) || 1);
  if (!reps || reps < 1) { alert('Enter reps (>=1)'); return; }
  if (isNaN(weight) || weight < 0) { alert('Enter a valid weight'); return; }

  const meta = EXERCISE_MAP[code] || {};
  const now = new Date();
  const ymd = now.toISOString().slice(0,10);
  for (let i=0;i<nSets;i++) {
    addLog({
      ts: now.toISOString(),
      date: ymd,
      exercise: code,
      name: meta.name || '',
      group: meta.group || '',
      reps, weight, unit, notes,
      volume: reps * weight // in native unit
    });
  }

  document.getElementById('reps').value = '';
  document.getElementById('weight').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('nSets').value = 1;
  document.getElementById('reps').focus();
});

// Filters & totals
const LB_PER_KG = 2.2046226218;
function toDisplayWeight(w, unit, displayUnit) {
  if (displayUnit === 'lb') return unit === 'kg' ? w * LB_PER_KG : w;
  if (displayUnit === 'kg') return unit === 'lb' ? w / LB_PER_KG : w;
  return w;
}

function dateInRange(d, range) {
  const dayMs = 86400000;
  const now = new Date();
  const dDate = new Date(d + 'T00:00:00');
  const today = new Date(now.toISOString().slice(0,10) + 'T00:00:00');
  if (range === 'today') return dDate.getTime() === today.getTime();
  if (range === '7d') return (today - dDate) <= 6*dayMs && (today - dDate) >= 0;
  if (range === '30d') return (today - dDate) <= 29*dayMs && (today - dDate) >= 0;
  return true;
}

['displayUnit','rangeSelect'].forEach(id => document.getElementById(id).addEventListener('change', renderTablesAndTotals));
document.getElementById('filterText').addEventListener('input', renderTablesAndTotals);

function renderTablesAndTotals() {
  const displayUnit = document.getElementById('displayUnit').value;
  const range = document.getElementById('rangeSelect').value;
  const filter = (document.getElementById('filterText').value || '').toLowerCase();

  const logs = loadLogs().filter(r => dateInRange(r.date, range));
  const tbody = document.querySelector('#logTable tbody');
  tbody.innerHTML = '';
  let totalSets = 0;
  let sumReps = 0;
  let sumWeightDisp = 0;
  let sumVolumeDisp = 0;

  const byGroup = new Map();
  const byExercise = new Map();

  for (const r of logs) {
    const codeName = `${r.exercise} ${r.name}`.toLowerCase();
    if (filter && !codeName.includes(filter)) continue;

    const weightDisp = toDisplayWeight(r.weight, r.unit, displayUnit);
    const volDisp = weightDisp * r.reps;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${new Date(r.ts).toLocaleString()}</td>
      <td><strong>${r.exercise}</strong></td>
      <td>${r.name}</td>
      <td>${r.group || ''}</td>
      <td>${r.reps}</td>
      <td>${weightDisp.toFixed(2)}</td>
      <td>${displayUnit}</td>
      <td>${volDisp.toFixed(2)}</td>
      <td>${r.notes || ''}</td>`;
    tbody.appendChild(tr);

    totalSets += 1;
    sumReps += r.reps;
    sumWeightDisp += weightDisp;
    sumVolumeDisp += volDisp;

    if (r.group) byGroup.set(r.group, (byGroup.get(r.group) || 0) + volDisp);
    const exKey = `${r.exercise} — ${r.name}`;
    byExercise.set(exKey, (byExercise.get(exKey) || 0) + volDisp);
  }

  document.getElementById('totalVolume').textContent = `${sumVolumeDisp.toFixed(2)} ${displayUnit}`;
  document.getElementById('totalSets').textContent = `${totalSets}`;
  document.getElementById('avgReps').textContent = totalSets ? (sumReps / totalSets).toFixed(1) : '0';
  document.getElementById('avgWeight').textContent = totalSets ? (sumWeightDisp / totalSets).toFixed(1) + ' ' + displayUnit : '0';

  // Fill by group
  const gBody = document.querySelector('#byGroup tbody'); gBody.innerHTML = '';
  for (const [g, v] of Array.from(byGroup.entries()).sort((a,b)=>b[1]-a[1])) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${g}</td><td>${v.toFixed(2)} ${displayUnit}</td>`;
    gBody.appendChild(tr);
  }
  // Fill by exercise
  const eBody = document.querySelector('#byExercise tbody'); eBody.innerHTML = '';
  for (const [e, v] of Array.from(byExercise.entries()).sort((a,b)=>b[1]-a[1])) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e}</td><td>${v.toFixed(2)} ${displayUnit}</td>`;
    eBody.appendChild(tr);
  }
}
renderTablesAndTotals();

// Export/Import/Clear
document.getElementById('exportCSV').addEventListener('click', () => {
  const data = loadLogs();
  const header = ['ts','date','exercise','name','group','reps','weight','unit','volume','volume_lb','volume_kg','notes'];
  const rows = [header.join(',')].concat(
    data.map(r => {
      const vol_lb = r.unit === 'kg' ? r.volume * LB_PER_KG : r.volume;
      const vol_kg = r.unit === 'lb' ? r.volume / LB_PER_KG : r.volume;
      const obj = { **r, volume_lb: vol_lb, volume_kg: vol_kg };
      return header.map(k => {
        const v = (obj[k] ?? '').toString().replace(/"/g, '""');
        return /[",\n]/.test(v) ? `"${v}"` : v;
      }).join(',');
    })
  );
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'dwc_logs.csv'; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('exportJSON').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(loadLogs(), null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'dwc_logs.json'; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importJSON').addEventListener('change', (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { try { const parsed = JSON.parse(reader.result); if (!Array.isArray(parsed)) throw new Error('Invalid JSON'); localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); renderTablesAndTotals(); alert('Import complete.'); } catch(err){ alert('Import failed: '+err.message); } };
  reader.readAsText(f);
});

document.getElementById('clearLogs').addEventListener('click', () => {
  if (confirm('Delete all logged sets?')) { localStorage.removeItem(STORAGE_KEY); renderTablesAndTotals(); }
});
