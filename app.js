/* AgroClime GDD Calculator (°C)
 * Method: Clipped (Tmin* = max(Tmin, base), Tmax* = min(Tmax, upper))
 * GDD = max(0, ((Tmin* + Tmax*)/2) - base)
 */

const qs = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => [...el.querySelectorAll(s)];

const baseInput  = qs('#baseTemp');
const upperInput = qs('#upperTemp');
const tableBody  = qs('#tableBody');
const totalCell  = qs('#totalGDD');
const avgPreview = qs('#avgPreview');

const addRowBtn   = qs('#addRow');
const clearRowsBtn= qs('#clearRows');
const sampleBtn   = qs('#sampleData');
const exportBtn   = qs('#exportCSV');
const savePrefs   = qs('#savePrefs');
const resetPrefs  = qs('#resetPrefs');
const themeToggle = qs('#themeToggle');

// Year in footer
qs('#year').textContent = new Date().getFullYear();

// Theme toggle
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  localStorage.setItem('agroclime_theme', document.body.classList.contains('light') ? 'light' : 'dark');
});
(function initTheme(){
  const t = localStorage.getItem('agroclime_theme');
  if(t === 'light') document.body.classList.add('light');
})();

// Prefs
(function loadPrefs(){
  const prefs = JSON.parse(localStorage.getItem('agroclime_prefs') || '{}');
  if (prefs.base != null) baseInput.value = prefs.base;
  if (prefs.upper != null) upperInput.value = prefs.upper;
})();
savePrefs.addEventListener('click', () => {
  const prefs = {
    base: parseFloat(baseInput.value),
    upper: parseFloat(upperInput.value)
  };
  if (!isFinite(prefs.base) || !isFinite(prefs.upper)) {
    alert('Please provide valid numeric thresholds.');
    return;
  }
  localStorage.setItem('agroclime_prefs', JSON.stringify(prefs));
  alert('Saved! These thresholds will load next time.');
});
resetPrefs.addEventListener('click', () => {
  baseInput.value = 10;
  upperInput.value = 30;
  localStorage.removeItem('agroclime_prefs');
  computeAll();
});

// Helpers
function clamp(val, min, max){
  return Math.min(Math.max(val, min), max);
}
function fmt(x){
  return Number.isFinite(x) ? x.toFixed(2) : '—';
}

function rowTemplate(dateStr = '', tmin = '', tmax = ''){
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="date" value="${dateStr}"></td>
    <td><input type="number" step="0.1" placeholder="e.g., 7.5" value="${tmin}"></td>
    <td><input type="number" step="0.1" placeholder="e.g., 22.3" value="${tmax}"></td>
    <td class="muted clippedAvg">—</td>
    <td class="gdd">0.00</td>
    <td><button class="btn ghost remove" title="Remove row">✖</button></td>
  `;
  // Events
  qsa('input', tr).forEach(inp => inp.addEventListener('input', computeAll));
  qs('.remove', tr).addEventListener('click', () => { tr.remove(); computeAll(); });
  return tr;
}

function addRow(dateStr = '', tmin = '', tmax = ''){
  tableBody.appendChild(rowTemplate(dateStr, tmin, tmax));
  computeAll();
}

function computeRow(tr){
  const base  = parseFloat(baseInput.value);
  const upper = parseFloat(upperInput.value);
  const inps = qsa('input', tr);

  const date  = inps[0].value; // unused but kept for CSV
  const tmin  = parseFloat(inps[1].value);
  const tmax  = parseFloat(inps[2].value);

  const clippedEl = qs('.clippedAvg', tr);
  const gddEl     = qs('.gdd', tr);

  if (!isFinite(base) || !isFinite(upper) || upper <= base) {
    clippedEl.textContent = '—';
    gddEl.textContent = '0.00';
    return 0;
  }

  if (!isFinite(tmin) || !isFinite(tmax)) {
    clippedEl.textContent = '—';
    gddEl.textContent = '0.00';
    return 0;
  }

  const tminStar = Math.max(tmin, base);
  const tmaxStar = Math.min(tmax, upper);
  const avg = (tminStar + tmaxStar) / 2;
  const gdd = Math.max(0, avg - base);

  clippedEl.textContent = fmt(avg);
  gddEl.textContent = fmt(gdd);
  return gdd;
}

function computeAll(){
  let total = 0;
  let avgSum = 0;
  let avgCount = 0;

  qsa('#tableBody tr').forEach(tr => {
    const before = qs('.clippedAvg', tr).textContent;
    const gdd = computeRow(tr);
    total += gdd;

    const avgCell = qs('.clippedAvg', tr).textContent;
    const avgVal = parseFloat(avgCell);
    if (isFinite(avgVal)) { avgSum += avgVal; avgCount += 1; }
  });

  totalCell.textContent = fmt(total);
  avgPreview.textContent = avgCount ? fmt(avgSum / avgCount) : '—';
}

// Buttons
addRowBtn.addEventListener('click', () => addRow(new Date().toISOString().slice(0,10)));

clearRowsBtn.addEventListener('click', () => {
  if (confirm('Remove all rows?')) {
    tableBody.innerHTML = '';
    computeAll();
  }
});

sampleBtn.addEventListener('click', () => {
  tableBody.innerHTML = '';
  const today = new Date();
  const samples = [-1, 0, 1, 2, 3].map(d => {
    const dt = new Date(today); dt.setDate(today.getDate() + d);
    return dt.toISOString().slice(0,10);
  });
  const demo = [
    {date: samples[0], tmin: 8.2, tmax: 19.7},
    {date: samples[1], tmin: 10.4, tmax: 27.5},
    {date: samples[2], tmin: 12.1, tmax: 31.3},
    {date: samples[3], tmin: 6.8, tmax: 18.9},
    {date: samples[4], tmin: 14.0, tmax: 29.2}
  ];
  demo.forEach(r => addRow(r.date, r.tmin, r.tmax));
});

exportBtn.addEventListener('click', () => {
  const base  = parseFloat(baseInput.value);
  const upper = parseFloat(upperInput.value);
  const rows = qsa('#tableBody tr').map(tr => {
    const inps = qsa('input', tr);
    const date = inps[0].value;
    const tmin = parseFloat(inps[1].value);
    const tmax = parseFloat(inps[2].value);

    // recompute to be sure
    const tminStar = Math.max(tmin, base);
    const tmaxStar = Math.min(tmax, upper);
    const avg = (isFinite(tmin) && isFinite(tmax)) ? ((tminStar + tmaxStar)/2) : NaN;
    const gdd = isFinite(avg) ? Math.max(0, avg - base) : NaN;

    return {
      Date: date || '',
      Tmin_C: isFinite(tmin) ? tmin : '',
      Tmax_C: isFinite(tmax) ? tmax : '',
      Clipped_Avg_C: isFinite(avg) ? avg.toFixed(2) : '',
      GDD: isFinite(gdd) ? gdd.toFixed(2) : ''
    };
  });

  if (!rows.length) {
    alert('No rows to export.');
    return;
  }

  const header = Object.keys(rows[0]);
  const csv = [
    header.join(','),
    ...rows.map(r => header.map(h => r[h]).join(','))
  ].join('\n');

  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agroclime_gdd_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Initialize with one row
addRow(new Date().toISOString().slice(0,10));
