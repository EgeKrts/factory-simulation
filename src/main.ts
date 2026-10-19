import * as THREE from 'three';
import { FactoryView, STATUS_COLOR, STATUS_TR } from './view';
import { SimulationSource, type DataSource } from './datasource';
import { PARAM_LABELS, TYPES, param, specOf } from './machineTypes';
import type { FactoryEvent, Layout, MachineDef, MachineType, Snapshot } from './types';
import { parseLayout, placementErrors, combineProcessingBuildings, upgradeGarmentHall } from './layout';
import { routeErrors } from './routes';
import { upgradeDyeHall } from './dyeLayout';
import { upgradeReceivingHall } from './receivingLayout';
import { upgradeRawWarehouse } from './rawLayout';
import { upgradeShippingWarehouse } from './shippingLayout';
import { upgradeEnergyCentre } from './energyLayout';
import { upgradeSolar } from './solar';
import { upgradeAdmin } from './adminLayout';
import { resourceDefaults } from './resources';

const LS_KEY = 'factory-layout-v2';
const startupMessages: string[] = [];
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function loadLayout(): Promise<Layout> {
  const defaults = await fetchDefault();
  const saved = localStorage.getItem(LS_KEY);
  if (saved) {
    try {
      const parsed = parseLayout(JSON.parse(saved), defaults), combined = upgradeAdmin(upgradeSolar(upgradeEnergyCentre(upgradeShippingWarehouse(upgradeRawWarehouse(upgradeReceivingHall(upgradeDyeHall(upgradeGarmentHall(combineProcessingBuildings(parsed)))))))));
      if (combined !== parsed) {
        localStorage.setItem(`${LS_KEY}-before-processing-merge-${Date.now()}`, saved);
        localStorage.setItem(LS_KEY, JSON.stringify(combined));
        startupMessages.push('Yerleşim güncellendi: ham depoda raflar ve parti hücreleri, mal kabulde kayıt–tarama–tartım hattı devrede. Önceki yerleşim yedeklendi.');
      }
      return combined;
    }
    catch (e) { localStorage.setItem(`${LS_KEY}-backup-${Date.now()}`, saved); startupMessages.push(`Kaydedilmiş yerleşim okunamadı; yedeği korundu. ${String(e)}`); return defaults; }
  }
  const legacy = localStorage.getItem('factory-layout-v1');
  if (legacy) {
    try {
      const migrated = parseLayout(JSON.parse(legacy), defaults);
      localStorage.setItem('factory-layout-v1-backup', legacy);
      localStorage.setItem(LS_KEY, JSON.stringify(migrated));
      startupMessages.push('Önceki yerleşim yedeklendi ve ayrı binalara taşındı.');
      return migrated;
    } catch (e) { startupMessages.push(`Önceki kayıt korundu; yeni yerleşke açıldı. ${String(e)}`); }
  }
  return defaults;
}
async function fetchDefault(): Promise<Layout> {
  return (await fetch(`${import.meta.env.BASE_URL}layouts/default.layout.json`)).json();
}

async function main() {
  const layout = await loadLayout();
  let source: DataSource;
  let latest: Snapshot | null = null;
  let wasPaused = false;
  let layoutValid = true;
  const history = new Map<string, number[]>();

  // ---------- İdari bina paneli: birim kartları + kat kesiti ----------
  const adminPanel = document.createElement('section');
  adminPanel.id = 'adminPanel'; adminPanel.hidden = true; $('stage').appendChild(adminPanel);
  const FLOOR_NAMES = ['Zemin Kat', '1. Kat', '2. Kat'];
  function renderAdmin(open: boolean, floor: number, unitId: string | null) {
    adminPanel.hidden = !open;
    if (!open) return;
    const units = view.adminUnits, floors = Math.max(1, view.adminFloors);
    const chip = (f: number, label: string) => `<button class="chip ${f === floor ? 'on' : ''}" data-floor="${f}">${label}</button>`;
    const groups = Array.from({ length: floors }, (_, f) => `<h4>${FLOOR_NAMES[f] ?? f + '. Kat'}</h4>` + units.filter((u) => u.floor === f).map((u) =>
      `<button class="unit ${u.id === unitId ? 'on' : ''}" data-unit="${esc(u.id)}"><span class="ico">${u.icon}</span><span class="txt"><b>${esc(u.name)}</b><small>${esc(u.desc)}</small></span><em class="${u.status}">${u.status === 'ready' ? 'Hazır' : 'Planlanıyor'}</em></button>`).join('')).join('');
    adminPanel.innerHTML = `<header><div><small>İDARİ BİNA</small><b>Birimler</b></div><div class="hdr-acts"><button class="x" data-act="hide" title="Menüyü kapat" aria-label="Menüyü kapat">✕</button></div></header>
      <div class="chips"><span>Kat kesiti</span>${Array.from({ length: floors }, (_, f) => chip(f, FLOOR_NAMES[f] ?? f + '. Kat')).join('')}${chip(-1, 'Tüm bina')}<button class="chip exit" data-act="exit" title="İdari bina görünümünden çık">Çıkış</button></div>
      <div class="cards">${groups}</div>`;
  }
  adminPanel.onclick = (e) => {
    const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!el) return;
    if (el.dataset.act === 'hide') {
      if (view.adminFloor < 0) view.closeAdmin();
      else adminPanel.hidden = true;
    } else if (el.dataset.act === 'exit') view.closeAdmin();
    else if (el.dataset.floor !== undefined) view.setAdminFloor(Number(el.dataset.floor));
    else if (el.dataset.unit) view.focusAdminUnit(el.dataset.unit);
  };

  const view = new FactoryView($('c') as HTMLCanvasElement, {
    onAdminChange: renderAdmin,
    onSelect: () => { renderInspector(); markTree(); },
    onBuildingSelect: (id) => {
      ($('buildingSelect') as HTMLSelectElement).value = id ?? '';
      $('sceneTitle').textContent = id === 'eco_store' ? 'DOKUMA ECO-TEX MAĞAZASI' : id === 'outdoor_complex' ? 'AÇIK KAFETERYA & EV ŞARJ OTOPARKI' : id ? view.layout.buildings?.find((b) => b.id === id)?.name ?? 'Bina inceleme' : 'TEKSTİL YERLEŞKESİ';
      $('sceneEyebrow').textContent = 'ENDÜSTRİYEL YERLEŞKE' + (id ? ' / ' + ($('sceneTitle').textContent??'').slice(0,2) : '');
      $('sceneSubtitle').textContent = id === 'eco_store' ? 'Çatı açık · OEKO-TEX® & GOTS Fabrika Satış Showroom' : id === 'outdoor_complex' ? 'Sosyal Yaşam Terası · 10× 300 kW Solar EV Şarj & Otopark' : id ? 'Çatı açık · İç üretim alanı' : `${view.layout.floor.size.join(' × ')} m · ${view.layout.buildings?.length ?? 0} bina`;
      renderInspector();
    },
    onError: (text) => say(text),
    onLayoutEdited: (structural) => {
      localStorage.setItem(LS_KEY, JSON.stringify(view.layout));
      source?.layoutChanged?.();
      if (structural) renderTree();
      renderInspector();
    },
  });
  // view.setLayout ve source başlatma, tüm UI sabitleri tanımlandıktan sonra (aşağıda) yapılır

  // ---------- olay günlüğü ----------
  const logEl = $('log');
  const fmtT = (t: number) => { const s = 6 * 3600 + t; return `${String(Math.floor(s / 3600) % 24).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`; };
  function logEvent(e: FactoryEvent) {
    const d = document.createElement('div');
    d.className = e.level;
    d.textContent = `[${fmtT(e.t)}] ${e.text}`;
    logEl.prepend(d);
    while (logEl.childElementCount > 120) logEl.lastElementChild!.remove();
  }

  // ---------- sol ağaç ----------
  const tree = $('tree');
  function renderTree() {
    tree.innerHTML = '';
    const areas = [...view.layout.areas];
    const known = new Set(areas.map((a) => a.id));
    const rest = view.layout.machines.filter((m) => !known.has(m.area));
    if (rest.length) areas.push({ id: '_', name: 'DİĞER', color: '#94a3b8', center: [0, 0], size: [0, 0] });
    for (const a of areas) {
      const ms = view.layout.machines.filter((m) => (a.id === '_' ? !known.has(m.area) : m.area === a.id));
      if (!ms.length) continue;
      const box = document.createElement('div');
      box.className = 'area';
      box.innerHTML = `<div class="area-h" style="border-color:${a.color}">${esc(a.name)}</div>`;
      if (a.buildingId) (box.firstElementChild as HTMLElement).onclick = () => view.inspectBuilding(a.buildingId!);
      for (const m of ms) {
        const r = document.createElement('div');
        r.className = 'row'; r.dataset.id = m.id;
        r.innerHTML = `<span class="dot" style="background:${hex(STATUS_COLOR.IDLE)}"></span><span>${esc(m.name ?? m.id)}</span><small></small>`;
        r.onclick = () => view.focus(m.id);
        box.appendChild(r);
      }
      tree.appendChild(box);
    }
    markTree();
  }
  function markTree() {
    tree.querySelectorAll<HTMLElement>('.row').forEach((r) => r.classList.toggle('sel', r.dataset.id === view.selectedId));
  }
  function updateTree() {
    if (!latest) return;
    const map = new Map(latest.machines.map((m) => [m.id, m]));
    tree.querySelectorAll<HTMLElement>('.row').forEach((r) => {
      const s = map.get(r.dataset.id!);
      if (!s) return;
      (r.firstElementChild as HTMLElement).style.background = hex(STATUS_COLOR[s.status]);
      r.querySelector('small')!.textContent = [s.currentLotId,s.queue?`⏵${s.queue}`:''].filter(Boolean).join(' · ');
      r.title=[s.currentLotId?`Parti: ${s.currentLotId}`:'Aktif parti yok',s.operator?`Operatör: ${s.operator.name} (${s.operator.id})`:'',s.resources?`Elektrik: ${s.resources.electricityKw.toFixed(2)} kW`:''].filter(Boolean).join('\n');
    });
  }

  // ---------- sağ panel ----------
  const insp = $('inspector');
  let liveEl: HTMLElement | null = null;
  function renderInspector() {
    const d = view.layout.machines.find((m) => m.id === view.selectedId);
    liveEl = null;
    if (!d) {
      if (view.openBuildingId === 'eco_store') {
        insp.innerHTML = `<div class="insp-h">🌿 Dokuma Eco-Tex Mağazası</div><p class="muted">34 × 22 m · 4.6 m yüksekliğinde · Fabrika Satış & Showroom</p><p>OEKO-TEX® Standard 100 ve GOTS sertifikalı organik tekstil koleksiyonlarının sergilendiği amiral mağaza.</p><div class="kv"><span>Kasa & POS</span><span>2 dokunmatik POS + Kraft paketleme</span><span>Ev Tekstili</span><span>Organik havlu, bornoz & keten nevresim</span><span>Koleksiyon</span><span>Butik askılıklar, kumaş & iplik duvarı</span><span>Deneyim</span><span>3 soyunma kabini & VIP Eco-Lounge</span></div>`;
        return;
      }
      if (view.openBuildingId === 'outdoor_complex') {
        insp.innerHTML = `<div class="insp-h">☕ Açık Kafeterya & EV Otopark</div><p class="muted">98 × 30 m · Sosyal Yaşam Alanı & Şarj İstasyonu</p><p>Personel ve ziyaretçiler için açık hava bahçe kafeteryası, dinlenme kamelyaları ve güneş enerjili elektrikli araç şarj merkezi.</p><div class="kv"><span>Garden Cafe</span><span>Espresso bar, 8 şemsiyeli masa & 3 kamelya</span><span>Rekreasyon</span><span>Süs havuzu, fıskiye & masa tenisi alanı</span><span>EV Supercharger</span><span>10× 300 kW DC hızlı şarj + Solar Carport</span><span>Otopark & Mikro</span><span>18 araçlık otopark + 6'lı E-Scooter şarj</span></div>`;
        return;
      }
      const b = view.layout.buildings?.find((b) => b.id === view.openBuildingId);
      insp.innerHTML = b ? `<div class="insp-h">${esc(b.name)}</div><p class="muted">${b.size[0]} × ${b.size[1]} m · ${b.height} m yüksekliğinde</p><p>Çatı ve yakın duvarlar açıldı. İçerideki bir makineye tıklayarak üretimi inceleyin.</p><p class="muted">Yük kapısı: ${b.doors.length} · Binadan çıkmak için Yerleşke görünümünü seçin.</p>` : '<div class="insp-h">Fabrika yerleşkesi</div><p class="muted">Bir binaya tıklayın veya üstteki bina listesinden seçim yapın. Çatısı açılan binada makineleri inceleyebilirsiniz.</p>';
      return;
    }
    $('app').classList.remove('collapse-right');
    const spec = specOf(d);
    const edit = view.editMode;
    const defaults=resourceDefaults(d);
    const paramKeys = [...new Set([...Object.keys(spec.params),...Object.keys(defaults)])].filter((k) => k !== 'cycleSec' || spec.role !== 'utility' || d.type === 'dyeprep');
    insp.innerHTML = `
      <div class="insp-h">${esc(d.name ?? d.id)}</div>
      <div class="insp-sub">${esc(d.id)} · ${esc(spec.label)}</div>
      <div class="insp-sub">Model: ${esc(view.modelInfo(d.id))}</div>
      <div id="live"></div>
      ${spec.role!=='slot'&& !['inverter','battery','switchgear','transformer'].includes(d.type)?`<details><summary>Operatör ataması</summary><div class="field"><span>Sicil</span><input id="operatorId" value="${esc(d.operator?.id??'')}" placeholder="Örn. OP-001"></div><div class="field"><span>Ad soyad</span><input id="operatorName" value="${esc(d.operator?.name??'')}" placeholder="Operatör adı"></div><button id="saveOperator">Atamayı kaydet</button><p class="muted">Boş bırakılırsa simülasyon operatörü kullanılır.</p></details>`:''}
      ${spec.role === 'slot' ? '<p class="muted">Rezerv alan: ileride buraya yeni makine yerleştirilecek.</p>' : ''}
      <hr><h3>Parametreler</h3>
      ${paramKeys.map((k) => `<div class="field"><span>${PARAM_LABELS[k] ?? k}</span><input type="number" data-p="${k}" value="${d.params[k]??defaults[k]??param(d, k)}" step="any" /></div>`).join('')}
      ${spec.role === 'slot' ? '' : '<div class="btns"><button id="bFault">⚠ Arıza ver / onar</button></div>'}
      ${edit ? `<hr><h3>Yerleşim</h3>
        <div class="field wide"><span>Ad</span><input type="text" id="fName" value="${esc(d.name ?? '')}" /></div>
        <div class="field wide"><span>Bölüm / bina</span><select id="fArea">${view.layout.areas.map((a) => `<option value="${esc(a.id)}" ${a.id === d.area ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
        <div class="field wide"><span>Sonraki istasyonlar (virgülle, id)</span><input type="text" id="fNext" value="${esc(d.next.join(', '))}" /></div>
        <div class="kv"><span>Konum</span><span id="pos"></span><span>Yön</span><span id="rot"></span></div>
        <div class="btns"><button id="bDup">⧉ Kopyala</button><button id="bDel" class="danger">🗑 Sil</button></div>` : ''}`;
    liveEl = $('live');
    $('saveOperator')?.addEventListener('click',()=>{
      const id=($('operatorId') as HTMLInputElement).value.trim(),name=($('operatorName') as HTMLInputElement).value.trim();
      if(!!id!==!!name){say('Operatör sicili ve adını birlikte girin.');return;}
      d.operator=id?{id,name}:undefined;onEdited(false);say('Operatör ataması kaydedildi.');
    });
    insp.querySelectorAll<HTMLInputElement>('input[data-p]').forEach((i) => {
      i.onchange = () => {
        const key = i.dataset.p!, before = d.params[key], value = Number(i.value);
        if (!Number.isFinite(value) || value < 0 || ['cycleSec','queueCap','spawnSec'].includes(key) && value < 1) { i.value = String(param(d, key)); say('Bu parametre için geçerli, pozitif bir değer girin.'); return; }
        d.params[key] = value;
        const errors = placementErrors(view.layout, d);
        if (errors.length) { if (before === undefined) delete d.params[key]; else d.params[key] = before; i.value = String(param(d, key)); say(errors[0]); return; }
        localStorage.setItem(LS_KEY, JSON.stringify(view.layout));
      };
    });
    $('bFault')?.addEventListener('click', () => source.toggleFault?.(d.id));
    if (edit) {
      ($('fArea') as HTMLSelectElement).onchange = (e) => {
        const before = d.area, position = [...d.position] as MachineDef['position'];
        const area = view.layout.areas.find((a) => a.id === (e.target as HTMLSelectElement).value)!;
        d.area = area.id; d.position = [area.center[0], 0, area.center[1]];
        const errors = placementErrors(view.layout, d);
        if (errors.length) { d.area = before; d.position = position; (e.target as HTMLSelectElement).value = before; say(errors[0]); return; }
        view.refreshMachine(d.id); view.focus(d.id); onEdited(true);
      };
      ($('fName') as HTMLInputElement).onchange = (e) => { d.name = (e.target as HTMLInputElement).value || undefined; view.refreshMachine(d.id); onEdited(true); };
      ($('fNext') as HTMLInputElement).onchange = (e) => {
        const previous = d.next;
        d.next = (e.target as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean);
        const errors = routeErrors(view.layout);
        if (errors.length) { d.next = previous; (e.target as HTMLInputElement).value = previous.join(', '); say(errors[0]); return; }
        view.refreshMachine(d.id); onEdited(false);
      };
      $('bDel').onclick = () => view.removeMachine(d.id);
      $('bDup').onclick = () => {
        const c: MachineDef = JSON.parse(JSON.stringify(d));
        c.id = nextId(d.type); c.position = [d.position[0] + 6, 0, d.position[2] + 6]; c.next = []; c.name = d.name ? d.name + ' (kopya)' : undefined;
        view.addMachine(c);
      };
    }
  }
  function onEdited(structural: boolean) {
    localStorage.setItem(LS_KEY, JSON.stringify(view.layout));
    if (structural) renderTree();
    source.layoutChanged?.();
  }

  const spark = document.createElement('canvas');
  function updateLive() {
    if (!liveEl || !view.selectedId) return;
    const s = latest?.machines.find((m) => m.id === view.selectedId);
    const d = view.layout.machines.find((m) => m.id === view.selectedId);
    if (!s || !d) return;
    const tele = Object.entries(s.telemetry);
    liveEl.innerHTML = `
      <span class="pill" style="background:${hex(STATUS_COLOR[s.status])}">${STATUS_TR[s.status]}</span> ${s.info ? `<span class="muted">${esc(s.info)}</span>` : ''}
      <div class="bar"><i style="width:${Math.round(s.progress * 100)}%"></i></div>
      <div class="kv">
        <span>Çalışılan parti no</span><span>${esc(s.currentLotId ?? '-')}</span>
        <span>Operatör</span><span>${s.operator?`${esc(s.operator.name)} · ${esc(s.operator.id)}${s.operator.simulated?' (simülasyon)':''}`:'Atanmadı / veri yok'}</span>
        <span>Kuyruk</span><span>${s.queue}</span>
        <span>İyi / Red</span><span>${s.counters.good} / ${s.counters.reject}</span>
        <span>Çalışma</span><span>${(s.counters.runtimeS / 60).toFixed(0)} dk</span>
        <span>Duruş</span><span>${(s.counters.downtimeS / 60).toFixed(0)} dk</span>
        ${tele.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')}
      </div>
      ${s.resources?`<h3>Anlık kaynak tüketimi</h3><div class="kv"><span>Elektrik</span><span>${s.resources.electricityKw.toFixed(2)} kW</span>${s.resources.waterM3H!==undefined?`<span>Su</span><span>${s.resources.waterM3H.toFixed(2)} m³/sa</span>`:''}${s.resources.steamKgH!==undefined?`<span>Buhar</span><span>${s.resources.steamKgH.toFixed(1)} kg/sa</span>`:''}${s.resources.gasNm3H!==undefined?`<span>Doğalgaz</span><span>${s.resources.gasNm3H.toFixed(2)} Nm³/sa</span>`:''}</div><p class="muted">Simülasyon tahmini · Boştaki elektrik, bekleme tüketimidir. Doğalgaz kazan üzerinden tüketilir.</p>`:''}
      ${s.job?`<h3>${s.currentLotId?'Aktif iş':'Son iş'} toplamı</h3><div class="kv"><span>Parti / ağırlık</span><span>${esc(s.job.lotId)} · ${s.job.kg.toFixed(1)} kg</span><span>İş elektriği</span><span>${s.job.electricityKwh.toFixed(3)} kWh</span>${s.resources?.waterM3H!==undefined?`<span>İş suyu</span><span>${s.job.waterM3.toFixed(3)} m³</span>`:''}${s.resources?.steamKgH!==undefined?`<span>İş buharı</span><span>${s.job.steamKg.toFixed(2)} kg</span>`:''}</div><p class="muted">Yalnızca bu partinin aktif işleme tüketimi; bekleme tüketimi hariç.</p>`:''}
      <canvas id="spark" width="270" height="50"></canvas>`;
    if (view.editMode) {
      const p = $('pos'), r = $('rot');
      if (p) p.textContent = `${d.position[0].toFixed(1)}, ${d.position[2].toFixed(1)}`;
      if (r) r.textContent = `${Math.round(THREE.MathUtils.radToDeg(d.rotationY))}°`;
    }
    const h = history.get(s.id);
    const cv = $('spark') as HTMLCanvasElement;
    if (h && h.length > 1 && cv) {
      const g = cv.getContext('2d')!;
      const mx = Math.max(...h, 1), mn = Math.min(...h, 0);
      g.strokeStyle = '#22d3ee'; g.lineWidth = 1.5; g.beginPath();
      h.forEach((v, i) => { const x = (i / (h.length - 1)) * cv.width, y = cv.height - 4 - ((v - mn) / (mx - mn || 1)) * (cv.height - 8); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
    }
  }
  void spark;

  // ---------- üst bar ----------
  function updateTop() {
    if (!latest) return;
    const k = latest.kpi;
    const s = 6 * 3600 + k.simTime;
    const day = Math.floor(s / 86400) + 1, hr = Math.floor(s / 3600) % 24;
    $('clock').textContent = `G${day} ${String(hr).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
    $('shift').textContent = hr >= 6 && hr < 14 ? '1. Vardiya' : hr >= 14 && hr < 22 ? '2. Vardiya' : '3. Vardiya (gece)';
    $('kProduced').textContent = `${Math.round(k.producedKg).toLocaleString('tr')} kg`;
    $('kPallets').textContent = String(k.palletsShipped);
    $('kWip').textContent = String(k.wip);
    $('kUtil').textContent = `${k.utilizationPct.toFixed(0)}%`;
    $('kRej').textContent = String(k.rejects);
    $('kSteam').textContent = `${k.steamBar.toFixed(1)} bar · ${Math.round(k.steamLoadKgH)} kg/sa`;
    $('kDye').textContent = String(k.dyeStock);
    const p=latest.power;
    $('powerPanel').hidden=!p;
    if(p){const n=(v:number)=>v.toLocaleString('tr',{maximumFractionDigits:1});
      $('powerLive').innerHTML=`<div>Güneş <b>${n(p.solarKw)} kW</b> · Fabrika <b>${n(p.loadKw)} kW</b></div><div>Batarya <b>%${n(p.socPct)}</b> · ${n(p.storedKwh)} / ${n(p.capacityKwh)} kWh</div><div>Şarj ${n(p.chargeKw)} · Deşarj ${n(p.dischargeKw)} kW</div><div>Şebekeden ${n(p.importKw)} · Satış ${n(p.exportKw)} kW</div><div>Satılan ${n(p.exportedKwh)} kWh · Gelir <b>${n(p.incomeTl)} TL</b></div><div>Alış maliyeti ${n(p.costTl)} TL · Kısılan ${n(p.curtailedKw)} kW</div>${p.unservedKw>.01?`<div class="powerAlert">Karşılanamayan tüketim ${n(p.unservedKw)} kW</div>`:''}`;
    }
    $('srcKind').textContent = source.paused ? 'DURAKLATILDI' : 'SİMÜLASYON';
    document.querySelectorAll<HTMLButtonElement>('#speedGroup button').forEach((b) => b.classList.toggle('on', source.paused ? Number(b.dataset.speed) === 0 : Number(b.dataset.speed) === source.speed));
  }

  // hız butonları
  const gridSettings=layout.machines.find(m=>m.id==='GRID-01');
  if(gridSettings){($('exportEnabled') as HTMLInputElement).checked=!!gridSettings.params.exportEnabled;($('sellPrice') as HTMLInputElement).value=String(gridSettings.params.sellTlKwh);($('buyPrice') as HTMLInputElement).value=String(gridSettings.params.buyTlKwh);}
  for(const id of ['exportEnabled','sellPrice','buyPrice'])$(id).onchange=()=>{const grid=view.layout.machines.find(m=>m.id==='GRID-01');if(!grid)return;const value=Number(($('sellPrice') as HTMLInputElement).value),buy=Number(($('buyPrice') as HTMLInputElement).value);if(!Number.isFinite(value)||value<0||!Number.isFinite(buy)||buy<0)return;Object.assign(grid.params,{exportEnabled:($('exportEnabled') as HTMLInputElement).checked?1:0,sellTlKwh:value,buyTlKwh:buy});localStorage.setItem(LS_KEY,JSON.stringify(view.layout));source.layoutChanged?.();};
  document.querySelectorAll<HTMLButtonElement>('#speedGroup button').forEach((b) => {
    b.onclick = () => {
      if (view.editMode) { say('Yerleşimi düzenlerken simülasyon duraklatılır.'); return; }
      if (!layoutValid) { say('Önce Düzenle modunda yerleşim sorunlarını düzeltin.'); return; }
      const v = Number(b.dataset.speed);
      if (v === 0) source.setPaused?.(!source.paused); else { source.setPaused?.(false); source.setSpeed?.(v); }
      document.querySelectorAll('#speedGroup button').forEach((x) => x.classList.remove('on'));
      (source.paused ? document.querySelector('#speedGroup [data-speed="0"]')! : b).classList.add('on');
    };
  });
  $('btnOverview').onclick = () => view.overview();
  $('btnCapture').onclick = () => {
    const output = document.createElement('canvas'); output.width = view.renderer.domElement.width; output.height = view.renderer.domElement.height + 64;
    view.renderer.render(view.scene, view.camera);
    const g = output.getContext('2d')!; g.fillStyle = '#142323'; g.fillRect(0, 0, output.width, 64);
    g.fillStyle = '#e8e9de'; g.font = '600 22px system-ui'; g.fillText(`DOKUMA / ${$('sceneTitle').textContent}`, 22, 29);
    g.fillStyle = '#a9b8af'; g.font = '12px system-ui'; g.fillText(`${$('sceneSubtitle').textContent} · ${$('clock').textContent}`, 22, 50);
    g.drawImage(view.renderer.domElement, 0, 64);
    const selected=latest?.machines.find(m=>m.id===view.selectedId);
    if(selected?.resources){
      const r=selected.resources,j=selected.job;
      const lines=[`Makine: ${selected.id}`,`Parti: ${selected.currentLotId??'-'}`,`Operatör: ${selected.operator?.name??'Veri yok'}`,selected.operator?.id??'',`Elektrik: ${r.electricityKw.toFixed(2)} kW`,...(r.waterM3H!==undefined?[`Su: ${r.waterM3H.toFixed(2)} m³/sa`]:[]),...(r.steamKgH!==undefined?[`Buhar: ${r.steamKgH.toFixed(1)} kg/sa`]:[]),...(r.gasNm3H!==undefined?[`Doğalgaz: ${r.gasNm3H.toFixed(2)} Nm³/sa`]:[]),...(j?[`${selected.currentLotId?'Aktif':'Son'} iş: ${j.lotId} · ${j.kg.toFixed(1)} kg`,`İş elektriği: ${j.electricityKwh.toFixed(3)} kWh`,...(r.waterM3H!==undefined?[`İş suyu: ${j.waterM3.toFixed(3)} m³`]:[]),...(r.steamKgH!==undefined?[`İş buharı: ${j.steamKg.toFixed(2)} kg`]:[])]:[]),'Simülasyon tahmini'];
      g.fillStyle='#142a2eea';g.fillRect(18,82,310,45+lines.length*19);g.fillStyle='#dfbd72';g.font='600 14px system-ui';g.fillText('MAKİNE / İŞ / KAYNAK',30,104);g.fillStyle='#e3eced';g.font='12px system-ui';lines.forEach((line,i)=>g.fillText(line,30,128+i*19));
    }
    if(latest?.power){const p=latest.power,x=output.width-330,y=82;g.fillStyle='#142a2eea';g.fillRect(x,y,312,158);g.fillStyle='#dfbd72';g.font='600 14px system-ui';g.fillText('GÜNEŞ · BATARYA · ŞEBEKE',x+12,y+22);g.fillStyle='#e3eced';g.font='12px system-ui';for(const [i,line] of [`Güneş ${p.solarKw.toFixed(1)} kW · Fabrika ${p.loadKw.toFixed(1)} kW`,`Batarya %${p.socPct.toFixed(1)} · ${p.storedKwh.toFixed(1)} kWh`,`Şarj ${p.chargeKw.toFixed(1)} · Deşarj ${p.dischargeKw.toFixed(1)} kW`,`Alım ${p.importKw.toFixed(1)} · Satış ${p.exportKw.toFixed(1)} kW`,`Satılan ${p.exportedKwh.toFixed(1)} kWh · ${p.incomeTl.toFixed(1)} TL`,'Kurgusal senaryo tarifesi'].entries())g.fillText(line,x+12,y+44+i*19);}
    output.toBlob(async (blob) => {
      if (!blob) { say('Görsel oluşturulamadı.'); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dokuma-${view.openBuildingId ?? 'yerleske'}.png`;
      if (import.meta.env.DEV) {
        try {
          const response = await fetch('/__capture', { method:'POST', headers:{ 'Content-Type':'image/png', 'X-Scene':view.openBuildingId ?? 'yerleske' }, body:blob });
          if (response.ok) { const saved = await response.json(); URL.revokeObjectURL(a.href); a.href = saved.url; }
        } catch { /* Standard browser download remains available. */ }
      }
      a.textContent = 'PNG indir'; a.id = 'captureLink'; say('Görsel hazır. '); $('toast').appendChild(a);
      const image = document.createElement('img'); image.src = a.href; image.alt = 'Oluşturulan yerleşke görseli'; image.style.cssText = 'display:block;width:240px;max-height:160px;object-fit:contain;margin-top:8px'; $('toast').appendChild(image);
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    }, 'image/png');
  };
  const buildingSelect = $('buildingSelect') as HTMLSelectElement;
  for (const b of layout.buildings ?? []) buildingSelect.add(new Option(b.name, b.id));
  buildingSelect.add(new Option('🌿 Eco-Tex Mağaza & Showroom', 'eco_store'));
  buildingSelect.add(new Option('☕ Açık Kafeterya & EV Otopark', 'outdoor_complex'));
  buildingSelect.onchange = () => buildingSelect.value ? view.inspectBuilding(buildingSelect.value) : view.overview();
  ($('lightMode') as HTMLSelectElement).onchange = (e) => { view.lightMode = (e.target as HTMLSelectElement).value as 'auto' | 'day' | 'night'; };
  function setMachineMenu(open:boolean){
    $('app').classList.toggle('collapse-left',!open);
    $('left').inert=!open;
    $('btnLeft').setAttribute('aria-expanded',String(open));
    $('btnLeft').classList.toggle('on',open);
  }
  $('btnLeft').onclick=()=>setMachineMenu($('app').classList.contains('collapse-left'));
  $('btnCloseLeft').onclick=()=>{setMachineMenu(false);$('btnLeft').focus();};
  setMachineMenu(!$('app').classList.contains('collapse-left'));
  const fullscreenButton=$('btnFullscreen') as HTMLButtonElement;
  function syncFullscreen(){
    const active=document.fullscreenElement===$('app');
    fullscreenButton.textContent=active?'⛶ Ekrandan çık':'⛶ Tam ekran';
    fullscreenButton.setAttribute('aria-pressed',String(active));
    fullscreenButton.setAttribute('aria-label',active?'Tam ekrandan çık':'Tam ekranı aç');
    fullscreenButton.title=active?'Tam ekrandan çık (F / Esc)':'Tam ekran (F)';
  }
  fullscreenButton.onclick=async()=>{
    if(!document.fullscreenEnabled){say('Bu tarayıcı tam ekranı desteklemiyor. Tarayıcının F11 tuşunu kullanabilirsiniz.');return;}
    try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}
    catch{say('Tam ekran açılamadı. Tarayıcının F11 tuşunu kullanabilirsiniz.');}
    syncFullscreen();
  };
  document.addEventListener('fullscreenchange',syncFullscreen);
  syncFullscreen();
  for (const [button, cls] of [['btnRight', 'collapse-right'], ['btnLog', 'collapse-log']]) $('' + button).onclick = () => $('app').classList.toggle(cls);
  const chk = (id: string, f: (v: boolean) => void) => { ($(id) as HTMLInputElement).onchange = (e) => f((e.target as HTMLInputElement).checked); };
  chk('chkLabels', (v) => view.setOverlayVisible('labels', v));
  chk('chkArrows', (v) => view.setOverlayVisible('arrows', v));
  chk('chkPipes', (v) => view.setOverlayVisible('pipes', v));
  chk('chkFaults', (v) => source.setFaultsEnabled?.(v));

  // ---------- düzenleme ----------
  const addType = $('addType') as HTMLSelectElement;
  (Object.keys(TYPES) as MachineType[]).forEach((t) => addType.add(new Option(TYPES[t].label, t)));
  function nextId(type: MachineType) {
    const p = type.toUpperCase().replace(/_/g, '');
    let n = 1;
    while (view.layout.machines.some((m) => m.id === `${p}-${String(n).padStart(2, '0')}`)) n++;
    return `${p}-${String(n).padStart(2, '0')}`;
  }
  $('btnEdit').onclick = () => {
    const on = !view.editMode;
    if (!on) {
      const errors = [...view.layout.machines.flatMap((m) => placementErrors(view.layout, m)), ...routeErrors(view.layout)];
      if (errors.length) { say(errors[0]); return; }
      layoutValid = true;
      source.layoutChanged?.(); source.setPaused?.(wasPaused);
    } else { wasPaused = source.paused ?? false; source.setPaused?.(true); }
    view.setEditMode(on);
    $('editbar').hidden = !on;
    $('btnEdit').classList.toggle('on', on);
    $('btnEdit').textContent = on ? '✔ Düzenlemeyi bitir' : '✏️ Düzenle';
    renderInspector();
  };
  $('btnAdd').onclick = () => {
    const type = addType.value as MachineType;
    const building = view.layout.buildings?.find((b) => b.id === view.openBuildingId);
    if (!building) { say('Makine eklemek için önce bir bina açın.'); return; }
    const t = view.controls.target;
    const x = Math.round(t.x / 0.5) * 0.5, z = Math.round(t.z / 0.5) * 0.5;
    const area = view.layout.areas.find((a) => a.buildingId === building.id)?.id;
    if (!area) return;
    const candidate: MachineDef = { id: nextId(type), type, area, position: [x, 0, z], rotationY: 0, params: {}, next: [] };
    if (placementErrors(view.layout, candidate).length) {
      let found = false;
      for (let dz = -building.size[1] / 2 + 4; dz < building.size[1] / 2 - 3 && !found; dz += 3) for (let dx = -building.size[0] / 2 + 8; dx < building.size[0] / 2 - 3 && !found; dx += 3) {
        candidate.position = [building.center[0] + dx, 0, building.center[1] + dz]; found = !placementErrors(view.layout, candidate).length;
      }
      if (!found) { say('Bu makine ve kuyruğu için binada yeterli boşluk yok.'); return; }
    }
    view.addMachine(candidate);
  };
  const setMode = (m: 'translate' | 'rotate') => {
    view.setTransformMode(m);
    $('btnMove').classList.toggle('on', m === 'translate');
    $('btnRotate').classList.toggle('on', m === 'rotate');
  };
  $('btnMove').onclick = () => setMode('translate');
  $('btnRotate').onclick = () => setMode('rotate');
  $('btnExport').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(view.layout, null, 2)], { type: 'application/json' }));
    a.download = 'factory.layout.json'; a.click();
  };
  $('btnImport').onclick = () => $('fileImport').click();
  const reload = (l: Layout) => {
    localStorage.setItem(LS_KEY, JSON.stringify(l));
    location.reload();
  };
  ($('fileImport') as HTMLInputElement).onchange = async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const imported = upgradeAdmin(upgradeSolar(upgradeEnergyCentre(upgradeShippingWarehouse(upgradeRawWarehouse(upgradeReceivingHall(upgradeDyeHall(upgradeGarmentHall(combineProcessingBuildings(parseLayout(JSON.parse(await f.text()), await fetchDefault()))))))))));
      localStorage.setItem(`${LS_KEY}-backup-${Date.now()}`, JSON.stringify(view.layout));
      reload(imported);
    } catch (error) { say(`İçe aktarılamadı: ${error instanceof Error ? error.message : error}`); }
  };
  $('btnReset').onclick = async () => { if (confirm('Yerleşim varsayılana döndürülsün mü?')) { localStorage.setItem(`${LS_KEY}-backup-${Date.now()}`, JSON.stringify(view.layout)); reload(await fetchDefault()); } };

  addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
    if((e.target as HTMLElement).isContentEditable||e.ctrlKey||e.altKey||e.metaKey)return;
    if(!e.repeat && e.code==='KeyF'){e.preventDefault();fullscreenButton.click();}
    if(!e.repeat && e.code==='KeyM'){e.preventDefault();$('btnLeft').click();}
    if (e.code === 'Space') { e.preventDefault(); ($('speedGroup').querySelector('[data-speed="0"]') as HTMLButtonElement).click(); }
    if (e.code === 'Escape') {
      if (!adminPanel.hidden) adminPanel.hidden = true;
      view.select(null);
    }
    if (view.editMode) {
      if (e.code === 'KeyG') setMode('translate');
      if (e.code === 'KeyR') setMode('rotate');
      if ((e.code === 'Delete') && view.selectedId) view.removeMachine(view.selectedId);
    }
  });

  // GLB sürükle-bırak
  const toast = $('toast');
  const say = (t: string) => { toast.textContent = t; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3500); };
  const stage = $('stage');
  stage.addEventListener('dragover', (e) => e.preventDefault());
  stage.addEventListener('drop', async (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files[0];
    if (!f || !/\.(glb|gltf)$/i.test(f.name)) return;
    const d = view.layout.machines.find((m) => m.id === view.selectedId);
    if (!d) { say('Önce modelin uygulanacağı bir makine seçin'); return; }
    try { await view.applyGlbFile(d.type, f); say(`${TYPES[d.type].label} tipindeki tüm makineler ${f.name} ile güncellendi`); }
    catch { say('GLB okunamadı'); }
  });

  // ---------- başlatma ----------
  view.setLayout(layout);
  source = new SimulationSource(view.layout);
  source.onSnapshot((s) => { latest = s; view.applySnapshot(s); });
  source.onEvent((e) => logEvent(e));
  renderTree();
  for (const text of startupMessages) logEvent({ t: 0, level: 'info', text });
  const issues = [...layout.machines.flatMap((m) => placementErrors(layout, m)), ...routeErrors(layout)];
  if (issues.length) {
    layoutValid = false;
    source.setPaused?.(true);
    for (const text of issues) logEvent({ t: 0, level: 'warn', text });
    $('app').classList.remove('collapse-log'); say('Yerleşimde sorun var; ayrıntılar olay günlüğünde. Düzenle modunda düzeltin.');
  }

  // ---------- ana döngü ----------
  const inspection = new URLSearchParams(location.search).get('inspect');
  if (inspection && layout.buildings?.some(b=>b.id===inspection)) {
    source.setPaused?.(true);view.lightMode='day';view.inspectBuilding(inspection);
    buildingSelect.value=inspection;($('lightMode') as HTMLSelectElement).value='day';
    setMachineMenu(false);$('app').classList.add('collapse-right');
  }
  const clock = new THREE.Clock();
  let uiAcc = 0, histAcc = 0;
  function frame() {
    const dt = clock.getDelta();
    source.tick(dt);
    view.update(dt);
    uiAcc += dt; histAcc += dt;
    if (uiAcc > 0.25) {
      uiAcc = 0; updateTop(); updateTree(); updateLive();
      const m = view.metrics;
      $('performance').textContent = `${Math.round(m.fps)} FPS · ${m.calls} çizim · ${m.width}×${m.height}`;
      $('performance').dataset.triangles = String(m.triangles);
    }
    if (histAcc > 0.5 && latest) {
      histAcc = 0;
      for (const m of latest.machines) {
        const v = Object.values(m.telemetry)[0] ?? m.progress * 100;
        const h = history.get(m.id) ?? [];
        h.push(v); if (h.length > 120) h.shift();
        history.set(m.id, h);
      }
    }
    requestAnimationFrame(frame);
  }
  frame();
}

main();



