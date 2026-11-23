// Gestión del club (solo personal): agenda, horarios de fisio y barbería, clases, avisos y equipo.
// Lo usan la app de socios y el panel (panel/gestion.js es un enlace a este archivo).
import { html, useState, useEffect } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';

const CSS = `
.g{display:flex;flex-direction:column;gap:16px}
.g .g-tabs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -22px;padding:0 22px 2px}
.g .g-tabs::-webkit-scrollbar{display:none}
.g-chip{flex:none;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--line2);background:transparent;color:var(--muted);font-weight:600;font-size:14px}
.g-chip[aria-pressed="true"]{border-color:var(--gold);background:rgba(232,208,112,.14);color:var(--gold)}
.g-card{padding:16px 18px;border-radius:20px;background:var(--card);border:1px solid var(--line);display:flex;flex-direction:column;gap:12px}
.g-card h2{margin:0;font:400 italic 25px/1.1 'Instrument Serif',Georgia,serif}
.g-it{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:10px 0;border:0;border-top:1px solid var(--line);background:transparent;color:var(--ink);text-align:left}
.g-it:first-child{border-top:0}
.g-it>.q{flex:1;min-width:0}.g-it small{display:block;color:var(--muted);font-size:12.5px}
.g-it.off{opacity:.5}
.g-h{width:50px;flex:none;font-weight:700;font-variant-numeric:tabular-nums}
.g-lab{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.g-f{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
.g-f>span{font-size:13px;color:var(--muted);font-weight:600}
.g-f input,.g-f textarea,.g-f select{width:100%;min-width:0;min-height:48px;padding:10px 12px;border-radius:12px;border:1px solid var(--line2);background:var(--bg);color:var(--ink);font:inherit;font-size:16px;color-scheme:dark}
.g-row{display:flex;gap:10px}
.g-dias{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.g-dias button{min-height:44px;border-radius:12px;border:1px solid var(--line2);background:transparent;color:var(--muted);font-weight:700}
.g-dias button[aria-pressed="true"]{border-color:var(--gold);background:rgba(232,208,112,.14);color:var(--gold)}
.g-sem{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -22px;padding:0 22px}
.g-sem::-webkit-scrollbar{display:none}
.g-sem button{flex:none;width:58px;height:70px;border-radius:16px;border:1px solid var(--line2);background:var(--card);color:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.g-sem button[aria-pressed="true"]{border-color:var(--gold);color:var(--gold);background:rgba(232,208,112,.14)}
.g-sem b{font:800 21px/1 'Bricolage Grotesque',sans-serif}.g-sem span{font-size:11px;font-weight:700}
.g-b{min-height:48px;padding:0 16px;border-radius:14px;border:1px solid var(--line2);background:transparent;color:var(--ink);font-weight:700;font-size:14.5px}
.g-b.oro{border:0;background:var(--gold-grad);color:#0A0900}
.g-b.mal{color:var(--bad)}.g-b.ch{min-height:44px;padding:0 12px;font-size:13px}
.g-b:disabled{opacity:.45}
.g-chk{display:flex;align-items:center;gap:10px;min-height:44px}.g-chk input{width:20px;height:20px;accent-color:#E8D070}
.g-p{margin:0;color:var(--muted);font-size:13.5px}
.g-velo{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.65)}
.g-hoja{position:fixed;left:0;right:0;bottom:0;z-index:61;max-width:460px;margin:0 auto;max-height:88%;overflow:auto;box-sizing:border-box;background:var(--card);border-top:1px solid rgba(232,208,112,.3);border-radius:26px 26px 0 0;padding:22px 22px calc(26px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px}
@media (min-width:900px){.g.ancho{max-width:860px}.g-hoja{bottom:auto;top:8vh;max-height:84vh;border-radius:24px;border:1px solid var(--line2)}}`;
if (!document.getElementById('g-css')) { const s = document.createElement('style'); s.id = 'g-css'; s.textContent = CSS; document.head.append(s); }

const DL = ['L', 'M', 'X', 'J', 'V', 'S', 'D'], DN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const p2 = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const hh = (t) => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const largo = (d) => new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const h5 = (t) => (t || '').slice(0, 5);
const fecha = (d) => d.split('-').reverse().join('/');
const vivas = (xs) => (xs || []).filter((r) => r.estado !== 'anulada');
const Hoja = ({ titulo, cerrar, children }) => html`<div><div class="g-velo" onClick=${cerrar}></div><div class="g-hoja" role="dialog" aria-modal="true" aria-label=${titulo}>
  <div class="g-row" style="align-items:center"><b style="flex:1;font-size:18px">${titulo}</b><button class="g-b ch" onClick=${cerrar}>Cerrar</button></div>${children}</div></div>`;
const Campo = ({ n, children }) => html`<label class="g-f"><span>${n}</span>${children}</label>`;
const Dias = ({ v, set }) => html`<div class="g-dias" role="group" aria-label="Días">${DL.map((d, i) => html`<button type="button" aria-label=${DN[i]} aria-pressed=${v.includes(i) ? 'true' : 'false'} onClick=${() => set(v.includes(i) ? v.filter((x) => x !== i) : [...v, i])}>${d}</button>`)}</div>`;

export function Gestion({ sb, avisar, admin, panel }) {
  const [sec, setSec] = useState('agenda');
  // hace una operación, avisa si falla y devuelve si ha ido bien
  const haz = async (op, msg) => { const { error, data } = await op; if (error) { avisar(error.code === '23505' ? 'Eso ya existe' : error.message); return false; } if (msg) avisar(msg); return data ?? true; };
  const rehacer = (msg) => haz(sb.rpc('rehacer_agenda'), msg);
  const S = [['agenda', 'Agenda'], ['horarios', 'Fisio y barbería'], ['clases', 'Clases'], ['cierres', 'Cierres'], ...(panel ? [] : [['avisos', 'Avisos']]), ...(admin ? [['equipo', 'Equipo']] : [])];
  const C = { agenda: Agenda, horarios: Horarios, clases: Clases, cierres: Cierres, avisos: Avisos, equipo: Equipo }[sec];
  return html`<div class=${'g' + (panel ? ' ancho' : ' pant')}>
    ${!panel && html`<div><p class="eyebrow">Solo personal</p><h1 class="serif">Gestión del <span class="kw">CLUB</span></h1></div>`}
    <div class="g-tabs" role="group" aria-label="Apartados">${S.map(([k, n]) => html`<button class="g-chip" aria-pressed=${k === sec ? 'true' : 'false'} onClick=${() => setSec(k)}>${n}</button>`)}</div>
    <${C} sb=${sb} haz=${haz} rehacer=${rehacer} avisar=${avisar} /></div>`;
}

// ---------- Agenda ----------
function Agenda({ sb, haz }) {
  const [dia, setDia] = useState(iso(new Date())); const [xs, setXs] = useState(null); const [sel, setSel] = useState(null); const [err, setErr] = useState(false);
  const dias = Array.from({ length: 28 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); return d; });
  const cargar = async () => {
    const a = new Date(dia + 'T00:00:00'), b = new Date(a); b.setDate(b.getDate() + 1);
    const [h, c] = await Promise.all([
      sb.from('huecos').select('id,inicio,fin,bloqueado,servicios(nombre),reservas(id,estado,socios(nombre,movil,num_socio))').gte('inicio', a.toISOString()).lt('inicio', b.toISOString()),
      sb.from('clase_sesiones').select('id,inicio,fin,plazas,monitor,cancelada,motivo,clases(nombre),clase_reservas(id,estado,asistio,creado,socios(nombre,movil,num_socio))').gte('inicio', a.toISOString()).lt('inicio', b.toISOString())]);
    if (h.error || c.error) { setErr(true); return null; }
    const l = [...h.data.map((x) => ({ ...x, t: 'hueco', nombre: x.servicios?.nombre, r: x.reservas.find((r) => r.estado === 'confirmada') })), ...c.data.map((x) => ({ ...x, t: 'clase', nombre: x.clases?.nombre }))].sort((x, y) => x.inicio.localeCompare(y.inicio));
    setErr(false); return l;
  };
  useEffect(() => { let vivo = true; setXs(null); cargar().then((l) => vivo && l && setXs(l)); return () => { vivo = false; }; }, [dia]);
  const refrescar = async () => { const l = await cargar(); if (l) { setXs(l); setSel((s) => s && l.find((x) => x.id === s.id) || null); } };
  const op = async (o, msg) => { const r = await haz(o, msg); if (r !== false) await refrescar(); return r; };
  return html`<div class="g">
    <div class="g-sem">${dias.map((d) => html`<button aria-label=${largo(d)} aria-pressed=${iso(d) === dia ? 'true' : 'false'} onClick=${() => setDia(iso(d))}><span>${DL[(d.getDay() + 6) % 7]}</span><b>${d.getDate()}</b></button>`)}</div>
    <div class="g-card"><h2>${largo(dia + 'T12:00:00')}</h2>
      ${err ? html`<p class="g-p">No se ha podido cargar la agenda.</p>` : xs === null ? html`<p class="g-p">Cargando…</p>` : xs.length === 0 ? html`<p class="g-p">No hay nada este día. Pon los horarios en «Fisio y barbería» y en «Clases».</p>` :
        html`<div>${xs.map((x) => html`<button key=${x.id} class=${'g-it' + (x.bloqueado || x.cancelada ? ' off' : '')} onClick=${() => setSel(x)}><span class="g-h">${hh(x.inicio)}</span><span class="q"><b>${x.nombre}</b><small>${x.t === 'clase'
          ? x.cancelada ? 'Cancelada' : vivas(x.clase_reservas).filter((r) => r.estado === 'confirmada').length + ' de ' + x.plazas + ' plazas' + (x.monitor ? ' · ' + x.monitor : '')
          : x.r ? x.r.socios?.nombre : x.bloqueado ? 'Bloqueada' : 'Libre'}</small></span></button>`)}</div>`}</div>
    ${sel && html`<${Hoja} titulo=${sel.nombre + ' · ' + hh(sel.inicio)} cerrar=${() => setSel(null)}>${sel.t === 'hueco' ? html`<${Hueco} key=${sel.id} x=${sel} sb=${sb} op=${op} />` : html`<${Sesion} key=${sel.id} x=${sel} sb=${sb} op=${op} />`}</${Hoja}>`}
  </div>`;
}
function Persona({ r, children }) {
  return html`<div class="g-it"><span class="q"><b>${r.socios?.nombre}</b><small>Nº ${r.socios?.num_socio}${r.socios?.movil ? html` · <a href=${'tel:' + r.socios.movil} style="color:var(--gold)">${r.socios.movil}</a>` : ''}</small></span>${children}</div>`;
}
function Apuntar({ sb, op, tipo, id }) {
  const [q, setQ] = useState(''); const [l, setL] = useState([]);
  useEffect(() => {
    const t = q.trim().replace(/[%,()]/g, ''); if (t.length < 2 && !/^\d+$/.test(t)) { setL([]); return; }
    let vivo = true; const id2 = setTimeout(async () => { const b = sb.from('socios').select('id,nombre,num_socio').not('num_socio', 'is', null).limit(6); const { data } = await (/^\d+$/.test(t) ? b.eq('num_socio', Number(t)) : b.ilike('nombre', '%' + t + '%')); if (vivo) setL(data || []); }, 250);
    return () => { vivo = false; clearTimeout(id2); };
  }, [q]);
  return html`<div><${Campo} n="Apuntar a un socio"><input type="search" placeholder="Nombre o número" value=${q} onInput=${(e) => setQ(e.target.value)} /></${Campo}>
    ${l.map((s) => html`<button class="g-it" key=${s.id} onClick=${async () => { const r = await op(sb.rpc('apuntar_socio', { p_tipo: tipo, p_id: id, p_num: s.num_socio })); if (r !== false) setQ(''); }}><span class="q"><b>${s.nombre}</b><small>Nº ${s.num_socio}</small></span><span style="color:var(--gold);font-weight:700">Apuntar</span></button>`)}</div>`;
}
function Hueco({ x, sb, op }) {
  const pasado = new Date(x.inicio) < new Date();
  if (x.r) return html`<div class="g"><${Persona} r=${x.r} />${!pasado && html`<button class="g-b mal" onClick=${() => confirm('¿Anular la reserva de ' + x.r.socios?.nombre + '?') && op(sb.from('reservas').update({ estado: 'anulada' }).eq('id', x.r.id), 'Reserva anulada')}>Anular reserva</button>`}</div>`;
  if (pasado) return html`<p class="g-p">Esta hora ya ha pasado.</p>`;
  return html`<div class="g">${!x.bloqueado && html`<${Apuntar} sb=${sb} op=${op} tipo="hueco" id=${x.id} />`}
    <button class="g-b" onClick=${() => op(sb.from('huecos').update({ bloqueado: !x.bloqueado }).eq('id', x.id), x.bloqueado ? 'Hora abierta' : 'Hora bloqueada')}>${x.bloqueado ? 'Volver a abrir esta hora' : 'Bloquear esta hora'}</button></div>`;
}
function Sesion({ x, sb, op }) {
  const [f, setF] = useState({ plazas: x.plazas, monitor: x.monitor || '' });
  const conf = vivas(x.clase_reservas).filter((r) => r.estado === 'confirmada'), esp = vivas(x.clase_reservas).filter((r) => r.estado === 'espera').sort((a, b) => a.creado.localeCompare(b.creado));
  const pasada = new Date(x.inicio) < new Date();
  const editar = (c, msg) => op(sb.rpc('editar_sesion', { p_sesion: x.id, p_plazas: Number(f.plazas), p_monitor: f.monitor, p_cancelada: x.cancelada, p_motivo: x.motivo || '', ...c }), msg);
  const quitar = (r) => confirm('¿Quitar a ' + r.socios?.nombre + ' de la clase?') && op(sb.rpc('cancelar_clase', { p_reserva: r.id }), 'Quitado de la clase');
  return html`<div class="g">
    ${x.cancelada && html`<p class="g-p" style="color:var(--bad)">Clase cancelada${x.motivo ? ': ' + x.motivo : ''}. Los apuntados lo ven en su app y reciben una notificación si las tienen activadas.</p>`}
    <div><span class="g-lab">Apuntados · ${conf.length} de ${x.plazas}</span>${conf.length === 0 && html`<p class="g-p">Nadie todavía.</p>`}
      ${conf.map((r) => html`<${Persona} key=${r.id} r=${r}>${pasada ? html`<button class="g-chip" aria-pressed=${r.asistio ? 'true' : 'false'} onClick=${() => op(sb.from('clase_reservas').update({ asistio: !r.asistio }).eq('id', r.id))}>${r.asistio ? 'Vino ✓' : 'Vino'}</button>` : html`<button class="g-b ch mal" onClick=${() => quitar(r)}>Quitar</button>`}</${Persona}>`)}</div>
    ${esp.length > 0 && html`<div><span class="g-lab">Lista de espera · ${esp.length}</span>${esp.map((r) => html`<${Persona} key=${r.id} r=${r}>${!pasada && html`<button class="g-b ch mal" onClick=${() => quitar(r)}>Quitar</button>`}</${Persona}>`)}</div>`}
    ${!x.cancelada && html`<${Apuntar} sb=${sb} op=${op} tipo="clase" id=${x.id} />`}
    ${!pasada && html`<div class="g-row"><${Campo} n="Plazas"><input type="number" inputmode="numeric" min="1" value=${f.plazas} onInput=${(e) => setF({ ...f, plazas: e.target.value })} /></${Campo}><${Campo} n="Monitor"><input value=${f.monitor} onInput=${(e) => setF({ ...f, monitor: e.target.value })} /></${Campo}></div>
      <button class="g-b oro" onClick=${() => editar({}, 'Cambios guardados')}>Guardar solo en esta clase</button>
      ${x.cancelada ? html`<button class="g-b" onClick=${() => editar({ p_cancelada: false, p_motivo: '' }, 'Clase recuperada')}>Recuperar la clase</button>`
        : html`<button class="g-b mal" onClick=${() => { const m = prompt('Motivo (lo verán los apuntados). Deja vacío si no quieres poner ninguno.'); if (m !== null) editar({ p_cancelada: true, p_motivo: m }, 'Clase cancelada'); }}>Cancelar esta clase</button>`}`}</div>`;
}

// ---------- Fisio y barbería ----------
function Horarios({ sb, haz, rehacer, avisar }) {
  const [srv, setSrv] = useState(null); const [l, setL] = useState([]); const [hs, setHs] = useState([]);
  const [f, setF] = useState({ dias: [], desde: '16:00', hasta: '20:00' }); const [u, setU] = useState({ dia: iso(new Date()), desde: '16:00', hasta: '20:00' }); const [dur, setDur] = useState(''); const [oc, setOc] = useState(false);
  const cargar = async () => {
    const [a, b] = await Promise.all([sb.from('servicios').select('*').order('nombre'), sb.from('servicio_horarios').select('*').order('dia').order('desde')]);
    setL(a.data || []); setHs(b.data || []); setSrv((s) => s || a.data?.[0]?.codigo);
  };
  useEffect(() => { cargar(); }, []);
  const s = l.find((x) => x.codigo === srv);
  useEffect(() => { if (s) setDur(s.duracion_min); }, [srv, s?.duracion_min]);
  if (!s) return html`<p class="g-p">Cargando…</p>`;
  const mios = hs.filter((h) => h.servicio === srv);
  const con = (fn) => async () => { if (oc) return; setOc(true); try { await fn(); } finally { setOc(false); } };
  const anadir = con(async () => {
    if (!f.dias.length) return avisar('Elige al menos un día'); if (f.hasta <= f.desde) return avisar('La hora de fin va después de la de inicio');
    if (mios.some((h) => f.dias.includes(h.dia) && h5(h.desde) < f.hasta && h5(h.hasta) > f.desde)) return avisar('Se pisa con otro tramo de ese día');
    if (await haz(sb.from('servicio_horarios').insert(f.dias.map((dia) => ({ servicio: srv, dia, desde: f.desde, hasta: f.hasta })))) === false) return;
    await rehacer('Horario publicado'); setF({ ...f, dias: [] }); cargar();
  });
  const quitar = (h) => con(async () => { if (!confirm('¿Quitar ' + DN[h.dia] + ' de ' + h5(h.desde) + ' a ' + h5(h.hasta) + '? Las horas libres desaparecen; las reservadas se mantienen.')) return; const n = await haz(sb.rpc('quitar_horario', { p_tipo: 'servicio', p_id: h.id })); if (n === false) return; avisar(n > 0 ? n + ' reservas siguen en pie: revísalas en Agenda' : 'Tramo quitado'); cargar(); })();
  const guardarDur = con(async () => { const n = Number(dur); if (!(n >= 10 && n <= 240)) return avisar('Pon entre 10 y 240 minutos'); if (await haz(sb.from('servicios').update({ duracion_min: n }).eq('codigo', srv)) === false) return; await rehacer('Duración cambiada'); cargar(); });
  const suelto = con(async () => {
    let t = new Date(u.dia + 'T' + u.desde + ':00'); const fin = new Date(u.dia + 'T' + u.hasta + ':00'), filas = [];
    const { data: ya, error } = await sb.from('huecos').select('inicio,fin').eq('servicio', srv).lt('inicio', fin.toISOString()).gt('fin', t.toISOString());
    if (error) return avisar(error.message);
    while (+t + s.duracion_min * 6e4 <= +fin) { const n = new Date(+t + s.duracion_min * 6e4); if (t > new Date() && !ya.some((h) => new Date(h.inicio) < n && new Date(h.fin) > t)) filas.push({ servicio: srv, inicio: t.toISOString(), fin: n.toISOString() }); t = n; }
    if (!filas.length) return avisar('No hay horas nuevas en ese tramo'); haz(sb.from('huecos').insert(filas), filas.length + ' horas abiertas');
  });
  return html`<div class="g">
    <div class="g-row">${l.map((x) => html`<button class="g-chip" aria-pressed=${x.codigo === srv ? 'true' : 'false'} onClick=${() => setSrv(x.codigo)}>${x.nombre}</button>`)}</div>
    <div class="g-card"><h2>Horario semanal</h2>${mios.length === 0 ? html`<p class="g-p">Sin horario todavía. Añade los días que viene.</p>` : html`<div>${mios.map((h) => html`<div class="g-it" key=${h.id}><span class="q"><b>${DN[h.dia]}</b><small>${h5(h.desde)} – ${h5(h.hasta)}</small></span><button class="g-b ch mal" disabled=${oc} onClick=${() => quitar(h)}>Quitar</button></div>`)}</div>`}</div>
    <div class="g-card"><h2>Añadir días</h2><${Dias} v=${f.dias} set=${(dias) => setF({ ...f, dias })} />
      <div class="g-row"><${Campo} n="Desde"><input type="time" value=${f.desde} onInput=${(e) => setF({ ...f, desde: e.target.value })} /></${Campo}><${Campo} n="Hasta"><input type="time" value=${f.hasta} onInput=${(e) => setF({ ...f, hasta: e.target.value })} /></${Campo}></div>
      <button class="g-b oro" disabled=${oc} onClick=${anadir}>Añadir al horario</button><p class="g-p">Se abren citas de ${s.duracion_min} min cada semana, con 4 semanas de antelación.</p></div>
    <div class="g-card"><h2>Solo un día</h2><${Campo} n="Día"><input type="date" min=${iso(new Date())} value=${u.dia} onInput=${(e) => setU({ ...u, dia: e.target.value })} /></${Campo}>
      <div class="g-row"><${Campo} n="Desde"><input type="time" value=${u.desde} onInput=${(e) => setU({ ...u, desde: e.target.value })} /></${Campo}><${Campo} n="Hasta"><input type="time" value=${u.hasta} onInput=${(e) => setU({ ...u, hasta: e.target.value })} /></${Campo}></div><button class="g-b" disabled=${oc} onClick=${suelto}>Abrir horas ese día</button></div>
    <div class="g-card"><h2>Ajustes</h2><div class="g-row" style="align-items:flex-end"><${Campo} n="Minutos por cita"><input type="number" inputmode="numeric" value=${dur} onInput=${(e) => setDur(e.target.value)} /></${Campo}><button class="g-b" disabled=${oc} onClick=${guardarDur}>Guardar</button></div>
      <label class="g-chk"><input type="checkbox" checked=${s.activo} onChange=${async (e) => { const v = e.target.checked; if (await haz(sb.from('servicios').update({ activo: v }).eq('codigo', srv)) !== false) await rehacer(v ? 'Visible en la app' : 'Oculto en la app'); cargar(); }} /> Visible en la app</label></div></div>`;
}

// ---------- Clases ----------
function Clases({ sb, haz, rehacer, avisar }) {
  const [l, setL] = useState(null); const [ed, setEd] = useState(null); const [id, setId] = useState(null); const [f, setF] = useState({ dias: [], hora: '18:00', monitor: '' });
  const cargar = async () => { const { data } = await sb.from('clases').select('*,clase_horarios(*)').order('nombre'); setL(data || []); };
  useEffect(() => { cargar(); }, []);
  const c = (l || []).find((x) => x.id === id);
  const guardar = async () => {
    if (!ed.nombre.trim()) return avisar('Falta el nombre');
    const n = { nombre: ed.nombre.trim(), descripcion: ed.descripcion?.trim() || null, monitor: ed.monitor?.trim() || null, duracion_min: Number(ed.duracion_min), plazas: Number(ed.plazas), cancelar_horas: Number(ed.cancelar_horas), reservable: ed.reservable, activa: ed.activa };
    if (await haz(ed.id ? sb.from('clases').update(n).eq('id', ed.id) : sb.from('clases').insert(n)) === false) return;
    await rehacer('Clase guardada'); setEd(null); cargar();
  };
  const anadir = async () => { if (!f.dias.length) return avisar('Elige al menos un día'); if (await haz(sb.from('clase_horarios').insert(f.dias.map((dia) => ({ clase_id: id, dia, hora: f.hora, monitor: f.monitor.trim() || null })))) === false) return; await rehacer('Horario publicado'); setF({ ...f, dias: [] }); cargar(); };
  const quitar = async (h) => { if (!confirm('¿Quitar ' + DN[h.dia] + ' a las ' + h5(h.hora) + '? Las clases con gente apuntada se mantienen.')) return; const n = await haz(sb.rpc('quitar_horario', { p_tipo: 'clase', p_id: h.id })); if (n === false) return; avisar(n > 0 ? n + ' apuntados siguen en pie: revísalos en Agenda' : 'Horario quitado'); cargar(); };
  const e = (k) => ({ value: ed[k] ?? '', onInput: (x) => setEd({ ...ed, [k]: x.target.value }) });
  return html`<div class="g">
    ${l === null ? html`<p class="g-p">Cargando…</p>` : l.map((x) => html`<div class="g-card" key=${x.id}><div class="g-row" style="align-items:center"><h2 style="flex:1">${x.nombre}</h2><button class="g-b ch" onClick=${() => setEd({ ...x })}>Editar</button></div>
      <p class="g-p">${x.duracion_min} min · ${x.plazas} plazas${x.monitor ? ' · ' + x.monitor : ''}${x.activa ? '' : ' · oculta'}</p>
      <div>${[...x.clase_horarios].sort((a, b) => a.dia - b.dia || a.hora.localeCompare(b.hora)).map((h) => html`<div class="g-it" key=${h.id}><span class="q"><b>${DN[h.dia]} · ${h5(h.hora)}</b>${h.monitor && html`<small>${h.monitor}</small>`}</span><button class="g-b ch mal" onClick=${() => quitar(h)}>Quitar</button></div>`)}</div>
      <button class="g-b oro" onClick=${() => setId(x.id)}>Añadir horario</button></div>`)}
    <button class="g-b" onClick=${() => setEd({ nombre: '', duracion_min: 60, plazas: 10, cancelar_horas: 2, reservable: true, activa: true })}>Crear otra clase</button>
    ${c && html`<${Hoja} titulo=${'Horario de ' + c.nombre} cerrar=${() => setId(null)}><${Dias} v=${f.dias} set=${(dias) => setF({ ...f, dias })} />
      <div class="g-row"><${Campo} n="Hora"><input type="time" value=${f.hora} onInput=${(x) => setF({ ...f, hora: x.target.value })} /></${Campo}><${Campo} n="Monitor (opcional)"><input value=${f.monitor} onInput=${(x) => setF({ ...f, monitor: x.target.value })} /></${Campo}></div><button class="g-b oro" onClick=${anadir}>Añadir al horario</button></${Hoja}>`}
    ${ed && html`<${Hoja} titulo=${ed.id ? 'Editar clase' : 'Nueva clase'} cerrar=${() => setEd(null)}><${Campo} n="Nombre"><input ...${e('nombre')} /></${Campo}><${Campo} n="Descripción"><input ...${e('descripcion')} /></${Campo}><${Campo} n="Monitor"><input ...${e('monitor')} /></${Campo}>
      <div class="g-row"><${Campo} n="Minutos"><input type="number" ...${e('duracion_min')} /></${Campo}><${Campo} n="Plazas"><input type="number" ...${e('plazas')} /></${Campo}></div><${Campo} n="Se puede anular hasta (horas antes)"><input type="number" ...${e('cancelar_horas')} /></${Campo}>
      <label class="g-chk"><input type="checkbox" checked=${ed.reservable} onChange=${(x) => setEd({ ...ed, reservable: x.target.checked })} /> El socio se apunta desde la app</label><label class="g-chk"><input type="checkbox" checked=${ed.activa} onChange=${(x) => setEd({ ...ed, activa: x.target.checked })} /> Visible en la app</label>
      <p class="g-p">Las clases que ya tienen apuntados no cambian; edítalas una a una en Agenda.</p><button class="g-b oro" onClick=${guardar}>Guardar</button></${Hoja}>`}</div>`;
}

// ---------- Cierres ----------
function Cierres({ sb, haz, rehacer, avisar }) {
  const [l, setL] = useState([]); const [op, setOp] = useState([]); const [f, setF] = useState({ q: '', desde: iso(new Date()), hasta: iso(new Date()), motivo: '' });
  const cargar = async () => { const [a, b, c] = await Promise.all([sb.from('cierres').select('*').gte('hasta', iso(new Date())).order('desde'), sb.from('servicios').select('codigo,nombre'), sb.from('clases').select('id,nombre')]); setL(a.data || []); setOp([['', 'Todo'], ...(b.data || []).map((x) => ['s:' + x.codigo, x.nombre]), ...(c.data || []).map((x) => ['c:' + x.id, x.nombre])]); };
  useEffect(() => { cargar(); }, []);
  const nom = (c) => (op.find(([k]) => k === (c.servicio ? 's:' + c.servicio : c.clase_id ? 'c:' + c.clase_id : '')) || [])[1];
  const anadir = async () => { if (f.hasta < f.desde) return avisar('La fecha de fin va después'); if (await haz(sb.from('cierres').insert({ servicio: f.q.startsWith('s:') ? f.q.slice(2) : null, clase_id: f.q.startsWith('c:') ? f.q.slice(2) : null, desde: f.desde, hasta: f.hasta, motivo: f.motivo.trim() || null })) === false) return; await rehacer('Cierre guardado. Revisa en Agenda si hay reservas'); cargar(); };
  return html`<div class="g"><div class="g-card"><h2>Vacaciones y festivos</h2><${Campo} n="Qué se cierra"><select value=${f.q} onChange=${(e) => setF({ ...f, q: e.target.value })}>${op.map(([k, n]) => html`<option value=${k}>${n}</option>`)}</select></${Campo}>
    <div class="g-row"><${Campo} n="Desde"><input type="date" value=${f.desde} onInput=${(e) => setF({ ...f, desde: e.target.value })} /></${Campo}><${Campo} n="Hasta"><input type="date" value=${f.hasta} onInput=${(e) => setF({ ...f, hasta: e.target.value })} /></${Campo}></div><${Campo} n="Motivo (solo lo ve el personal)"><input value=${f.motivo} onInput=${(e) => setF({ ...f, motivo: e.target.value })} /></${Campo}><button class="g-b oro" onClick=${anadir}>Cerrar esos días</button><p class="g-p">Quita las horas y clases libres. Lo que ya está reservado no se anula solo.</p></div>
    ${l.length > 0 && html`<div class="g-card"><div>${l.map((c) => html`<div class="g-it" key=${c.id}><span class="q"><b>${nom(c)}</b><small>${fecha(c.desde)} – ${fecha(c.hasta)}${c.motivo ? ' · ' + c.motivo : ''}</small></span><button class="g-b ch" onClick=${async () => { if (await haz(sb.from('cierres').delete().eq('id', c.id)) !== false) await rehacer('Días abiertos otra vez'); cargar(); }}>Quitar</button></div>`)}</div></div>`}</div>`;
}

// ---------- Avisos ----------
function Avisos({ sb, haz, avisar }) {
  const v = { titulo: '', texto: '', destacado: false, hasta: '', notificar: false }; const [f, setF] = useState(v); const [l, setL] = useState([]); const [n, setN] = useState(null);
  const cargar = async () => { const { data } = await sb.from('avisos').select('*').order('creado', { ascending: false }).limit(30); setL(data || []); sb.rpc('push_alcance').then((r) => setN(r.data ?? null)); };
  useEffect(() => { cargar(); }, []);
  const publicar = async () => { if (!f.titulo.trim()) return avisar('Falta el título'); if (f.notificar && !confirm('Se enviará una notificación a ' + (n ?? 'todos los') + ' móviles y no se puede deshacer. ¿Enviar?')) return; if (await haz(sb.from('avisos').insert({ titulo: f.titulo.trim(), texto: f.texto.trim() || null, destacado: f.destacado, hasta: f.hasta || null, notificar: f.notificar }), 'Publicado en la app') !== false) { setF(v); cargar(); } };
  return html`<div class="g"><div class="g-card"><h2>Nuevo aviso</h2><${Campo} n="Título"><input value=${f.titulo} onInput=${(e) => setF({ ...f, titulo: e.target.value })} /></${Campo}><${Campo} n="Texto"><textarea rows="4" value=${f.texto} onInput=${(e) => setF({ ...f, texto: e.target.value })}></textarea></${Campo}><${Campo} n="Visible hasta (opcional)"><input type="date" value=${f.hasta} onInput=${(e) => setF({ ...f, hasta: e.target.value })} /></${Campo}>
    <label class="g-chk"><input type="checkbox" checked=${f.destacado} onChange=${(e) => setF({ ...f, destacado: e.target.checked })} /> Destacado</label><label class="g-chk"><input type="checkbox" checked=${f.notificar} onChange=${(e) => setF({ ...f, notificar: e.target.checked })} /> Enviar notificación al móvil${n === null ? '' : ' (' + n + ')'}</label><button class="g-b oro" onClick=${publicar}>Publicar en la app</button></div>
    ${l.length > 0 && html`<div class="g-card"><div>${l.map((a) => html`<div class="g-it" key=${a.id}><span class="q"><b>${a.titulo}</b><small>${a.publicado ? 'Visible' : 'Oculto'}</small></span><button class="g-b ch" onClick=${async () => { await haz(sb.from('avisos').update({ publicado: !a.publicado }).eq('id', a.id)); cargar(); }}>${a.publicado ? 'Ocultar' : 'Mostrar'}</button></div>`)}</div></div>`}</div>`;
}

// ---------- Equipo ----------
function Equipo({ sb, haz, avisar }) {
  const [l, setL] = useState([]); const [f, setF] = useState({ email: '', nombre: '', rol: 'recepcion' });
  const cargar = async () => { const { data } = await sb.rpc('equipo_lista'); setL(data || []); };
  useEffect(() => { cargar(); }, []);
  const guardar = async () => { if (!f.email.trim() || !f.nombre.trim()) return avisar('Faltan el nombre o el correo'); if (await haz(sb.rpc('equipo_guardar', { p_email: f.email, p_nombre: f.nombre, p_rol: f.rol }), 'Equipo actualizado') !== false) { setF({ email: '', nombre: '', rol: 'recepcion' }); cargar(); } };
  return html`<div class="g"><div class="g-card"><h2>Quién gestiona</h2><div>${l.map((p) => html`<div class="g-it" key=${p.user_id}><span class="q" style="overflow-wrap:anywhere"><b>${p.nombre}</b><small>${p.rol === 'admin' ? 'Administrador' : 'Recepción'} · ${p.email}</small></span><button class="g-b ch mal" onClick=${async () => { if (confirm('¿Quitar el acceso de gestión a ' + p.nombre + '?')) { await haz(sb.rpc('equipo_quitar', { p_user: p.user_id }), 'Acceso quitado'); cargar(); } }}>Quitar</button></div>`)}</div></div>
    <div class="g-card"><h2>Añadir a alguien</h2><${Campo} n="Nombre"><input value=${f.nombre} onInput=${(e) => setF({ ...f, nombre: e.target.value })} /></${Campo}><${Campo} n="Correo con el que entra en la app"><input type="email" autocapitalize="off" value=${f.email} onInput=${(e) => setF({ ...f, email: e.target.value })} /></${Campo}><${Campo} n="Permiso"><select value=${f.rol} onChange=${(e) => setF({ ...f, rol: e.target.value })}><option value="recepcion">Recepción</option><option value="admin">Administrador</option></select></${Campo}><button class="g-b oro" onClick=${guardar}>Guardar</button>
      <p class="g-p">Tiene que haber entrado antes en la app con ese correo. Los dos permisos gestionan agenda, horarios, clases y avisos, y ven los datos de los socios. El equipo solo lo cambia un administrador.</p></div></div>`;
}
