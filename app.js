// DWC Pro — image-first with EMOM timer, A/B blocks, logging, offline
const $ = (id) => document.getElementById(id);

// Live clock
function updateClock(){ const n=new Date(); const pad=(x)=>String(x).padStart(2,'0'); $('clock').textContent=`${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`; }
setInterval(updateClock, 1000); updateClock();

// PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(()=>{});
}

// Data maps
const EXERCISE_MAP = await fetch('exercise_map.json').then(r => r.json());
const IMAGE_MAP = await fetch('image_map.json').then(r => r.json());

// Build grouped <select> options
function buildSelect(sel) {
  sel.innerHTML = '';
  const groups = {};
  for (const [code, meta] of Object.entries(EXERCISE_MAP)) {
    if (!groups[meta.group]) groups[meta.group] = [];
    groups[meta.group].push([code, meta.name]);
  }
  for (const g of Object.keys(groups)) {
    const og = document.createElement('optgroup');
    og.label = g;
    for (const [code, name] of groups[g]) {
      const opt = document.createElement('option');
      opt.value = code; opt.textContent = `${code} — ${name}`;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
}

['a1','b1','a2','b2'].forEach(id => buildSelect($(id)));

// Presets (from your earlier weekly plan)
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
  renderCurrent();
});

// URL params (?a=C1&b=C5&a2=T1&b2=T2)
const params = new URLSearchParams(location.search);
if (params.get('a')) $('a1').value = params.get('a').toUpperCase();
if (params.get('b')) $('b1').value = params.get('b').toUpperCase();
if (params.get('a2')) $('a2').value = params.get('a2').toUpperCase();
if (params.get('b2')) $('b2').value = params.get('b2').toUpperCase();

// Viewer helpers
function srcFor(code) {
  const path = IMAGE_MAP[code]?.src || `assets/exercises/${code}.jpg`;
  return path;
}
function labelFor(code) {
  const meta = EXERCISE_MAP[code] || {name:'Unknown'};
  return `${code} — ${meta.name}`;
}

// Timer state
let running = false;
let startMs = 0;
let elapsedMs = 0;
let roundSeconds = parseInt($('roundSeconds').value, 10);
let roundsPerBlock = parseInt($('roundsPerBlock').value, 10);
let currentBlock = 1; // 1..2
let currentRound = 1; // 1..roundsPerBlock
let currentSide = 'A'; // 'A' or 'B'
let rafId = 0;

function updateMeta() {
  $('metaBlock').textContent = `Block ${currentBlock}`;
  $('metaRound').textContent = `Round ${currentRound} / ${roundsPerBlock}`;
  $('metaSide').textContent = currentSide === 'A' ? 'A (odd)' : 'B (even)';
}

function beep() {
  if (!$('enableBeep').checked) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.05;
    o.connect(g); g.connect(ctx.destination);
    o.start(); setTimeout(()=>{ o.stop(); ctx.close(); }, 150);
  } catch {}
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil((roundSeconds * 1000) - (ms % (roundSeconds*1000))) / 1000);
  const m = Math.floor(total / 60); const s = Math.floor(total % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function currentCode() {
  const map = {
    1: {A: $('a1').value, B: $('b1').value},
    2: {A: $('a2').value, B: $('b2').value}
  };
  return map[currentBlock][currentSide];
}

function renderViewer() {
  const code = currentCode();
  $('viewerLabel').textContent = `${currentSide}${currentBlock} — ${labelFor(code)}`;
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

function tick() {
  if (!running) return;
  const now = performance.now();
  const ms = elapsedMs + (now - startMs);
  const sec = Math.floor(ms / 1000);
  const tInRound = sec % roundSeconds;
  $('timerBig').textContent = formatTime(ms);

  // edge: round advance
  if (tInRound === 0 && Math.abs((ms % 1000)) < 30) {
    // minute boundary — keep stable using integer logic
  }

  // Check for round change
  const newRound = Math.floor(sec / roundSeconds) + 1;
  if (newRound !== currentRound) {
    // toggle side & play beep
    currentSide = (currentSide === 'A') ? 'B' : 'A';
    currentRound = newRound;
    beep();
    if (currentRound > roundsPerBlock) {
      // move block
      currentBlock++;
      if (currentBlock > 2) {
        // session complete
        pauseTimer();
        currentBlock = 2; currentRound = roundsPerBlock; currentSide = 'B';
      } else {
        currentRound = 1; currentSide = 'A';
      }
    }
    updateMeta();
    renderViewer();
  }

  rafId = requestAnimationFrame(tick);
}

function startTimer() {
  if (running) return;
  running = true;
  startMs = performance.now();
  rafId = requestAnimationFrame(tick);
}
function pauseTimer() {
  if (!running) return;
  running = false;
  cancelAnimationFrame(rafId);
  elapsedMs += performance.now() - startMs;
}
function resetTimer() {
  running = false; cancelAnimationFrame(rafId);
  elapsedMs = 0; currentBlock = 1; currentRound = 1; currentSide = 'A';
  roundSeconds = parseInt($('roundSeconds').value, 10);
  roundsPerBlock = parseInt($('roundsPerBlock').value, 10);
  $('timerBig').textContent = `${String(Math.floor(roundSeconds/60)).padStart(2,'0')}:${String(roundSeconds%60).padStart(2,'0')}`;
  updateMeta();
  renderViewer();
}

// Controls
$('startBtn').addEventListener('click', startTimer);
$('pauseBtn').addEventListener('click', pauseTimer);
$('resetBtn').addEventListener('click', resetTimer);

document.addEventListener('keydown', (e)=>{
  if (e.code === 'Space') { e.preventDefault(); running ? pauseTimer() : startTimer(); }
  if (e.key === 'n' || e.key === 'N') {
    // manual next round
    elapsedMs += (roundSeconds * 1000) - ((elapsedMs + (performance.now()-startMs)) % (roundSeconds*1000));
  }
  if (e.key === 'r' || e.key === 'R') resetTimer();
});

['a1','b1','a2','b2'].forEach(id => $(id).addEventListener('change', renderViewer));
['roundSeconds','roundsPerBlock'].forEach(id => $(id).addEventListener('change', resetTimer));

function renderCurrent(){ updateMeta(); renderViewer(); }
renderCurrent();

// Logger
const STORAGE_KEY = 'dwc_logs_v2';
function loadLogs(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveLogs(d){ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
function renderTable() {
  const tbody = document.querySelector('#logTable tbody'); tbody.innerHTML = '';
  const filter = ($('filterText').value || '').toLowerCase();
  for (const r of loadLogs()) {
    if (filter && !(`${r.exercise} ${r.name}`.toLowerCase().includes(filter))) continue;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${new Date(r.ts).toLocaleString()}</td>
      <td>${r.block}</td><td>${r.round}</td><td>${r.side}</td>
      <td><strong>${r.exercise}</strong></td><td>${r.name}</td>
      <td>${r.reps}</td><td>${r.weight}</td><td>${r.unit}</td><td>${r.notes||''}</td>`;
    tbody.appendChild(tr);
  }
}
renderTable();
$('filterText').addEventListener('input', renderTable);

$('logBtn').addEventListener('click', () => {
  const reps = parseInt($('reps').value, 10);
  const weight = parseFloat($('weight').value);
  const unit = $('unit').value;
  const notes = $('notes').value.trim();
  if (!reps || reps < 1) { alert('Enter reps (>=1)'); return; }
  if (isNaN(weight) || weight < 0) { alert('Enter a valid weight'); return; }
  const code = currentCode();
  const entry = {
    ts: new Date().toISOString(),
    block: currentBlock, round: currentRound, side: currentSide,
    exercise: code, name: EXERCISE_MAP[code]?.name || '',
    reps, weight, unit, notes
  };
  const data = loadLogs(); data.push(entry); saveLogs(data); renderTable();
  $('reps').value = ''; $('weight').value = ''; $('notes').value = ''; $('reps').focus();
});

$('exportCSV').addEventListener('click', () => {
  const data = loadLogs();
  const header = ['ts','block','round','side','exercise','name','reps','weight','unit','notes'];
  const rows = [header.join(',')].concat(
    data.map(r => header.map(k => {
      const v = (r[k] ?? '').toString().replace(/"/g, '""');
      return /[",\n]/.test(v) ? `"${v}"` : v;
    }).join(','))
  );
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'dwc_logs.csv'; a.click();
  URL.revokeObjectURL(url);
});
$('exportJSON').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(loadLogs(), null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'dwc_logs.json'; a.click();
  URL.revokeObjectURL(url);
});
$('importJSON').addEventListener('change', (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { try { const parsed = JSON.parse(reader.result); if (!Array.isArray(parsed)) throw new Error('Invalid JSON'); localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); renderTable(); alert('Import complete.'); } catch(err){ alert('Import failed: '+err.message); } };
  reader.readAsText(f);
});
$('clearLogs').addEventListener('click', () => {
  if (confirm('Delete all logged sets?')) { localStorage.removeItem(STORAGE_KEY); renderTable(); }
});
