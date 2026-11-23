// Entrenar · registro de series al estilo Ferrum, con el catálogo de máquinas del club.
// La sesión en curso vive en el teléfono (funciona sin cobertura) y se sube al terminar.
import { html, useState, useEffect, useMemo, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';

const LS_ACTIVA = 'theclub-sesion-activa', LS_PEND = 'theclub-sesiones-pendientes', LS_CAT = 'theclub-catalogo';
const GRUPOS = ['Pecho', 'Espalda', 'Pierna', 'Glúteo', 'Hombro', 'Bíceps', 'Tríceps', 'Abdomen'];
const TIPOS = ['Máquina', 'Polea', 'Barra', 'Mancuernas', 'Peso corporal'];
const grupoDe = (c) => GRUPOS.includes(c?.grupo) ? c.grupo : 'Otros';
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const RETO = 12;
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const fmt = (n) => String(Math.round(Number(n) * 100) / 100).replace('.', ',');
const num = (v) => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : 0; };
const e1rm = (s) => s.peso > 0 && s.reps > 0 ? (s.reps === 1 ? s.peso : s.peso * (1 + s.reps / 30)) : 0;
const clave = (e) => e.ejercicio_id || e.ejId || ('n:' + (e.ejercicio_nombre || e.nombre || '').toLowerCase());
const diaSemana = (iso) => (new Date(iso + 'T12:00:00').getDay() + 6) % 7;
const fechaCorta = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const mmss = (s) => { const m = Math.floor(s / 60); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };

// ---------- datos ----------
async function cargarTodo(sb, socioId) {
  const desde = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const [cat, rut, ses] = await Promise.all([
    sb.from('ejercicios').select('id,nombre,grupo,equipo,maquina_num,zona,marca,socio_id').eq('activo', true).order('nombre'),
    sb.from('rutinas').select('*').eq('socio_id', socioId).order('creado'),
    sb.from('sesiones').select('id,fecha,inicio,fin,titulo,series(ejercicio_id,ejercicio_nombre,orden,n,peso,reps)').eq('socio_id', socioId).gte('fecha', desde).order('fecha', { ascending: false }).limit(400)
  ]);
  if (cat.data) guardar(LS_CAT, cat.data);
  return { catalogo: cat.data || leer(LS_CAT, []), rutinas: rut.data || [], sesiones: (ses.data || []).map(normalizar) };
}
// sesión de la base de datos → {id, fecha, titulo, inicio, fin, ejercicios:[{ejId,nombre,sets:[{peso,reps}]}]}
function normalizar(s) {
  const por = new Map();
  (s.series || []).sort((a, b) => a.orden - b.orden || a.n - b.n).forEach((x) => {
    const k = x.orden + '|' + clave(x);
    if (!por.has(k)) por.set(k, { ejId: x.ejercicio_id, nombre: x.ejercicio_nombre, sets: [] });
    por.get(k).sets.push({ peso: Number(x.peso), reps: x.reps });
  });
  return { id: s.id, fecha: s.fecha, titulo: s.titulo, inicio: s.inicio, fin: s.fin, ejercicios: [...por.values()] };
}
async function subirSesion(sb, socioId, s) {
  const { error: e1 } = await sb.from('sesiones').upsert({ id: s.id, socio_id: socioId, fecha: s.fecha, inicio: s.inicio, fin: s.fin, titulo: s.titulo });
  if (e1) throw e1;
  await sb.from('series').delete().eq('sesion_id', s.id);
  const filas = s.ejercicios.flatMap((e, i) => e.sets.map((x, j) => ({ sesion_id: s.id, socio_id: socioId, ejercicio_id: e.ejId || null, ejercicio_nombre: e.nombre, orden: i, n: j + 1, peso: x.peso, reps: x.reps })));
  if (filas.length) { const { error: e2 } = await sb.from('series').insert(filas); if (e2) throw e2; }
}
async function subirPendientes(sb, socioId) {
  const pend = leer(LS_PEND, []); const quedan = [];
  for (const s of pend) { try { await subirSesion(sb, socioId, s); } catch { quedan.push(s); } }
  guardar(LS_PEND, quedan.length ? quedan : null);
  return pend.length - quedan.length;
}

// marcas por ejercicio a partir de todas las sesiones (más recientes primero)
function marcas(sesiones) {
  const m = new Map();
  [...sesiones].sort((a, b) => (a.fecha + (a.inicio || '')).localeCompare(b.fecha + (b.inicio || ''))).forEach((s) => s.ejercicios.forEach((e) => {
    const k = clave(e); const r = m.get(k) || { nombre: e.nombre, ultima: null, rm: null, max: null, veces: 0 };
    r.ultima = { fecha: s.fecha, sets: e.sets, sesion: s.id }; r.veces++; r.nombre = e.nombre;
    e.sets.forEach((x) => {
      if (!r.rm || e1rm(x) > r.rm.v) r.rm = { v: e1rm(x), peso: x.peso, reps: x.reps, fecha: s.fecha };
      if (!r.max || x.peso > r.max.peso) r.max = { peso: x.peso, reps: x.reps, fecha: s.fecha };
    });
    m.set(k, r);
  }));
  return m;
}

// ======================= PANTALLA =======================
export function Entrenar({ sb, socio, avisar, activo }) {
  const [datos, setDatos] = useState({ catalogo: leer(LS_CAT, []), rutinas: [], sesiones: [] });
  const [cargado, setCargado] = useState(false);
  const [activa, setActiva] = useState(leer(LS_ACTIVA, null));
  const [vista, setVista] = useState('inicio');          // inicio · historial · records
  const [hoja, setHoja] = useState(null);                // {tipo:'ejercicio'|'rutina'|'sesion', ...}
  const [resumen, setResumen] = useState(null);
  const recargar = async () => {
    try { await subirPendientes(sb, socio.id); } catch {}
    try { const d = await cargarTodo(sb, socio.id); setDatos(d); } catch {}
    setCargado(true);
  };
  useEffect(() => { recargar(); }, []);
  useEffect(() => { guardar(LS_ACTIVA, activa); }, [activa]);
  const todas = useMemo(() => [...leer(LS_PEND, []), ...datos.sesiones], [datos, cargado]);
  const M = useMemo(() => marcas(todas.filter((s) => s.id !== activa?.id)), [todas, activa?.id]);

  // reto y racha
  const mes = hoyISO().slice(0, 7);
  const diasMes = new Set(todas.filter((s) => s.fecha.slice(0, 7) === mes && s.ejercicios.some((e) => e.sets.length)).map((s) => s.fecha)).size;
  const racha = (() => {
    const lunes = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - diaSemana(iso)); return d.toISOString().slice(0, 10); };
    const set = new Set(todas.filter((s) => s.ejercicios.some((e) => e.sets.length)).map((s) => lunes(s.fecha)));
    let n = 0; const l = new Date(lunes(hoyISO()) + 'T12:00:00');
    if (!set.has(l.toISOString().slice(0, 10))) l.setDate(l.getDate() - 7);
    while (set.has(l.toISOString().slice(0, 10))) { n++; l.setDate(l.getDate() - 7); }
    return n;
  })();
  // ejercicio propio creado, editado o borrado: se refleja al momento y queda guardado en el móvil
  const cambioCat = (e, fuera) => setDatos((d) => { const c = d.catalogo.filter((x) => x.id !== e.id); if (!fuera) c.push(e); c.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); guardar(LS_CAT, c); return { ...d, catalogo: c }; });
  const rutinaHoy = datos.rutinas.find((r) => (r.dias || []).includes(diaSemana(hoyISO())));

  const empezar = (rutina) => {
    const s = { id: uuid(), fecha: hoyISO(), inicio: new Date().toISOString(), titulo: rutina ? rutina.nombre : 'Entreno libre',
      ejercicios: rutina ? (rutina.ejercicios || []).map((e) => ({ ejId: e.id || null, nombre: e.nombre, sets: [] })) : [] };
    setActiva(s); setVista('inicio');
  };
  const terminar = async () => {
    const s = { ...activa, fin: new Date().toISOString(), ejercicios: activa.ejercicios.filter((e) => e.sets.length) };
    if (!s.ejercicios.length) { setActiva(null); avisar('Sesión descartada: no tenía series'); return; }
    const recs = s.ejercicios.reduce((a, e) => a + e.sets.filter((x) => { const r = M.get(clave(e)); return !r || e1rm(x) > (r.rm?.v || 0) + 0.01; }).length, 0);
    const vol = s.ejercicios.reduce((a, e) => a + e.sets.reduce((b, x) => b + x.peso * x.reps, 0), 0);
    setActiva(null);
    try { await subirSesion(sb, socio.id, s); } catch { guardar(LS_PEND, [...leer(LS_PEND, []), s]); avisar('Sin conexión: se guardará al volver la cobertura'); }
    setResumen({ ...s, recs, vol, mins: Math.round((new Date(s.fin) - new Date(s.inicio)) / 6e4) });
    recargar();
  };

  if (resumen) return html`<${Resumen} r=${resumen} cerrar=${() => setResumen(null)} />`;
  if (activa) return html`<${SesionActiva} sb=${sb} socio=${socio} cambioCat=${cambioCat} s=${activa} set=${setActiva} M=${M} catalogo=${datos.catalogo} terminar=${terminar} avisar=${avisar} activo=${activo} />`;

  return html`<div class="pant">
    <header><div><p class="eyebrow">Tus entrenos</p><h1 class="serif">A <span class="kw">ENTRENAR</span></h1></div></header>
    <div class="seg" role="group" aria-label="Sección"><span class="ind" style=${'width:calc((100% - 8px)/3);transform:translateX(' + ['inicio', 'historial', 'records'].indexOf(vista) * 100 + '%)'}></span>
      ${[['inicio', 'Hoy'], ['historial', 'Historial'], ['records', 'Récords']].map(([k, n]) => html`<button aria-pressed=${vista === k ? 'true' : 'false'} onClick=${() => setVista(k)}>${n}</button>`)}</div>

    ${vista === 'inicio' && html`
      <div class="card oro" style="gap:10px">
        <span class="lab">${rutinaHoy ? 'Hoy te toca' : datos.rutinas.length ? 'Hoy no tienes rutina' : 'Empieza a apuntar'}</span>
        <b style="font-size:20px">${rutinaHoy ? rutinaHoy.nombre : datos.rutinas.length ? 'Día libre' : 'Tu primer entreno'}</b>
        ${rutinaHoy && html`<span class="muted" style="font-size:13px">${(rutinaHoy.ejercicios || []).map((e) => e.nombre).join(' · ')}</span>`}
        <div class="fila" style="margin-top:4px">
          <button class="btn2" onClick=${() => setHoja({ tipo: 'rutinas' })}>${datos.rutinas.length ? 'Mis rutinas' : 'Crear rutina'}</button>
          <button class="btn" style="min-height:44px;font-size:15px" onClick=${() => empezar(rutinaHoy || null)}>${rutinaHoy ? 'Empezar' : 'Entreno libre'}</button>
        </div>
      </div>
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><span><span class="lab">Reto del mes</span><br /><b>${RETO} días entrenando</b></span><span class="kw num" style="font-size:26px">${diasMes}/${RETO}</span></div>
        <div class="reto" aria-hidden="true">${Array.from({ length: RETO }, (_, i) => html`<i class=${i < diasMes ? 'on' : ''}></i>`)}</div>
        <span class="muted" style="font-size:13px">${diasMes >= RETO ? 'Reto conseguido este mes.' : `Te faltan ${RETO - diasMes}. Racha: ${racha} ${racha === 1 ? 'semana' : 'semanas'} seguidas.`}</span></div>
      ${datos.rutinas.length > 0 && html`<div><h2 style="margin-bottom:6px">Otras rutinas</h2><div class="lista">${datos.rutinas.filter((r) => r !== rutinaHoy).map((r) => html`
        <div class="it"><div class="q"><b>${r.nombre}</b><small>${(r.dias || []).map((d) => DIAS[d]).join(' ') || 'Sin día fijo'} · ${(r.ejercicios || []).length} ejercicios</small></div>
          <button class="btn2" style="min-height:38px" onClick=${() => empezar(r)}>Empezar</button></div>`)}</div></div>`}
      ${!cargado && html`<p class="faint">Cargando tus entrenos…</p>`}`}

    ${vista === 'historial' && html`<${Historial} sesiones=${todas} abrir=${(s) => setHoja({ tipo: 'sesion', s })} />`}
    ${vista === 'records' && html`<${Records} catalogo=${datos.catalogo} M=${M} />`}

    ${hoja?.tipo === 'rutinas' && html`<${HojaRutinas} cambioCat=${cambioCat} sb=${sb} socio=${socio} rutinas=${datos.rutinas} catalogo=${datos.catalogo} cerrar=${() => setHoja(null)} cambio=${() => { recargar(); }} avisar=${avisar} />`}
    ${hoja?.tipo === 'sesion' && html`<${HojaSesion} s=${hoja.s} cerrar=${() => setHoja(null)} borrar=${async () => { await sb.from('sesiones').delete().eq('id', hoja.s.id); setHoja(null); avisar('Sesión borrada'); recargar(); }} />`}
  </div>`;
}

// ---------- sesión en curso ----------
function SesionActiva({ sb, socio, cambioCat, s, set, M, catalogo, terminar, avisar, activo }) {
  const [ahora, setAhora] = useState(Date.now()); const [picker, setPicker] = useState(false); const [abierto, setAbierto] = useState(0);
  const [salir, setSalir] = useState(false);
  useEffect(() => { if (!activo) return; const id = setInterval(() => setAhora(Date.now()), 15000); return () => clearInterval(id); }, [activo]);
  const series = s.ejercicios.reduce((a, e) => a + e.sets.length, 0);
  const vol = s.ejercicios.reduce((a, e) => a + e.sets.reduce((b, x) => b + x.peso * x.reps, 0), 0);
  const cambiar = (fn) => set((x) => { const c = JSON.parse(JSON.stringify(x)); fn(c); return c; });
  const anadirEj = (ej) => { cambiar((c) => c.ejercicios.push({ ejId: ej.id || null, nombre: ej.nombre, sets: [] })); setAbierto(s.ejercicios.length); setPicker(false); };
  return html`<div class="pant">
    <header style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px">
      <div style="min-width:0"><p class="eyebrow">En curso · ${mmss(Math.round((ahora - new Date(s.inicio)) / 1000))}</p><h1 class="serif" style="font-size:34px">${s.titulo}</h1></div>
      <button class="chipbtn" onClick=${() => salir ? (set(null), avisar('Sesión descartada')) : setSalir(true)} style=${salir ? 'color:var(--bad);border-color:var(--bad)' : ''}>${salir ? '¿Descartar?' : 'Descartar'}</button>
    </header>
    <div class="fila" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      ${[['Ejercicios', s.ejercicios.length], ['Series', series], ['Volumen', Math.round(vol) + ' kg']].map(([l, v]) => html`<div class="card" style="min-height:0;padding:12px 14px;gap:2px"><span class="lab">${l}</span><b class="num" style="font-size:18px">${v}</b></div>`)}
    </div>
    ${s.ejercicios.length === 0 && html`<div class="vacio">Añade tu primer ejercicio.</div>`}
    ${s.ejercicios.map((e, i) => html`<${Bloque} key=${i + e.nombre} e=${e} i=${i} M=${M} cat=${catalogo} abierto=${abierto === i} abrir=${() => setAbierto(abierto === i ? -1 : i)}
      anadir=${(peso, reps) => { const r = M.get(clave(e)); const esRec = !r || e1rm({ peso, reps }) > (r.rm?.v || 0) + 0.01; cambiar((c) => c.ejercicios[i].sets.push({ peso, reps })); if (esRec && peso > 0 && r) avisar('¡Récord en ' + e.nombre + '!'); }}
      borrarSerie=${(j) => cambiar((c) => c.ejercicios[i].sets.splice(j, 1))}
      quitar=${() => cambiar((c) => c.ejercicios.splice(i, 1))} />`)}
    <button class="btn2" style="min-height:50px;border-style:dashed;color:var(--gold)" onClick=${() => setPicker(true)}>+ Añadir ejercicio</button>
    <button class="btn" disabled=${!series} onClick=${terminar}>Terminar entreno</button>
    ${picker && html`<${Picker} sb=${sb} socio=${socio} avisar=${avisar} cambioCat=${cambioCat} catalogo=${catalogo} M=${M} elegir=${anadirEj} cerrar=${() => setPicker(false)} />`}
  </div>`;
}

function Bloque({ e, i, M, cat, abierto, abrir, anadir, borrarSerie, quitar }) {
  const r = M.get(clave(e)); const ant = r?.ultima?.sets || [];
  const sug = ant[e.sets.length] || e.sets[e.sets.length - 1] || ant[ant.length - 1];
  const [peso, setPeso] = useState(sug ? fmt(sug.peso) : ''); const [reps, setReps] = useState(sug ? String(sug.reps) : '');
  useEffect(() => { const x = ant[e.sets.length] || e.sets[e.sets.length - 1]; if (x) { setPeso(fmt(x.peso)); setReps(String(x.reps)); } }, [e.sets.length]);
  const info = cat.find((c) => c.id === e.ejId);
  const rmAntes = r?.rm?.v || 0;
  return html`<div class="card" style="gap:10px;padding:14px 16px">
    <button onClick=${abrir} style="display:flex;align-items:center;gap:12px;border:0;background:transparent;color:inherit;padding:0;text-align:left">
      <span class="serif muted" style="font-size:22px;width:26px">${String(i + 1).padStart(2, '0')}</span>
      <span style="flex:1;min-width:0"><b style="font-size:16px">${e.nombre}</b>
        <small class="faint" style="display:block;font-size:12.5px">${info ? [info.equipo, info.maquina_num && 'nº ' + info.maquina_num, info.zona].filter(Boolean).join(' · ') : 'Ejercicio propio'}${r?.rm ? ' · 1RM ' + fmt(Math.round(r.rm.v * 2) / 2) + ' kg' : ''}</small></span>
      <span class="kw num" style="font-size:18px">${e.sets.length}</span>
    </button>
    ${abierto && html`
      ${e.sets.map((x, j) => { const rec = x.peso > 0 && e1rm(x) > rmAntes + 0.01 && r; return html`<div style="display:grid;grid-template-columns:30px 1fr auto auto;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--line)">
        <span class="faint num">${j + 1}</span><b class="num">${fmt(x.peso)} kg × ${x.reps}</b>
        ${rec ? html`<span style="font-size:11px;font-weight:800;color:#0A0900;background:var(--gold);border-radius:6px;padding:2px 7px">RÉCORD</span>` : html`<span class="faint num" style="font-size:12px">1RM ${fmt(Math.round(e1rm(x)))}</span>`}
        <button onClick=${() => borrarSerie(j)} aria-label=${'Borrar serie ' + (j + 1)} style="width:32px;height:32px;border:0;background:transparent;color:var(--faint)">✕</button></div>`; })}
      <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:8px;align-items:end">
        <div class="campo"><label for=${'p' + i}>Peso (kg)</label><input id=${'p' + i} inputmode="decimal" value=${peso} onInput=${(ev) => setPeso(ev.target.value)} style="min-height:48px;width:100%;min-width:0;box-sizing:border-box;text-align:center;font-weight:700" /></div>
        <div class="campo"><label for=${'r' + i}>Reps</label><input id=${'r' + i} inputmode="numeric" value=${reps} onInput=${(ev) => setReps(ev.target.value)} style="min-height:48px;width:100%;min-width:0;box-sizing:border-box;text-align:center;font-weight:700" /></div>
        <button class="btn" style="width:auto;min-height:48px;padding:0 18px" disabled=${!num(reps)} onClick=${() => anadir(num(peso), Math.round(num(reps)))}>+ Serie</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px" class="muted">
        <span>${ant.length ? html`Anterior (${fechaCorta(r.ultima.fecha)}): <b class="num" style="color:var(--ink)">${ant.map((x) => fmt(x.peso) + '×' + x.reps).join(' · ')}</b>` : 'Primera vez con este ejercicio'}</span>
        <button onClick=${quitar} style="border:0;background:transparent;color:var(--faint);font-size:12.5px;min-height:36px">Quitar</button></div>`}
  </div>`;
}

// ---------- elegir ejercicio, por grupo muscular ----------
const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const CSS_P = `.ej-g{display:flex;align-items:center;gap:12px;width:100%;min-height:54px;padding:0;border:0;border-top:1px solid var(--line);background:transparent;color:var(--ink);text-align:left;font-weight:700;font-size:16px}
.ej-g:first-child{border-top:0}.ej-g .c{margin-left:auto;color:var(--faint);font-size:13px;font-weight:600}
.ej-g svg{color:var(--muted);transition:transform .2s;flex:none}.ej-g[aria-expanded="true"] svg{transform:rotate(90deg)}.ej-g[aria-expanded="true"]{color:var(--gold)}
.ej-f{display:flex;align-items:center;border-top:1px solid var(--line)}
.ej-f .el{flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 0 8px 14px;border:0;background:transparent;color:inherit;text-align:left}
.ej-f .q{flex:1;min-width:0}.ej-f b{display:block;overflow-wrap:anywhere}.ej-f small{display:block;color:var(--muted);font-size:12.5px}
.ej-f .ed{min-height:44px;padding:0 10px;border:0;background:transparent;color:var(--muted);font-size:13px}`;
if (!document.getElementById('ej-css')) { const st = document.createElement('style'); st.id = 'ej-css'; st.textContent = CSS_P; document.head.append(st); }

function Picker({ sb, socio, avisar, cambioCat, catalogo, M, elegir, cerrar, multiple, elegidos = [] }) {
  const [q, setQ] = useState(''); const [g, setG] = useState(null); const [ed, setEd] = useState(null);
  const t = norm(q.trim());
  const lista = catalogo.filter((c) => !t || norm([c.nombre, c.grupo, c.equipo, c.maquina_num, c.zona, c.marca].join(' ')).includes(t))
    .sort((a, b) => (M.get(b.id)?.veces || 0) - (M.get(a.id)?.veces || 0) || a.nombre.localeCompare(b.nombre, 'es'));
  const grupos = [...GRUPOS, 'Otros'].map((n) => [n, lista.filter((c) => grupoDe(c) === n)]).filter(([, xs]) => xs.length);
  const nuevo = (grupo) => setEd({ nombre: q.trim(), grupo: grupo || '', equipo: 'Máquina' });
  if (ed) return html`<${EditarEjercicio} sb=${sb} socio=${socio} avisar=${avisar} catalogo=${catalogo} ini=${ed} volver=${() => setEd(null)}
    hecho=${(e, fuera) => { if (e.id) cambioCat(e, fuera); setEd(null); setQ(''); if (!fuera && !ed.id) elegir(e); }} />`;
  return html`<div class="velo" onClick=${cerrar}></div><div class="hoja" role="dialog" aria-label="Elegir ejercicio" style="max-height:88%">
    <span class="asa" aria-hidden="true"></span>
    <h2 class="serif" style="font-size:28px;font-weight:400">Elige <span class="kw">EJERCICIO</span></h2>
    <div class="campo"><input type="search" placeholder="Buscar" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" /></div>
    <button class="btn2" style="min-height:48px;border-style:dashed;color:var(--gold)" onClick=${() => nuevo(g)}>${t ? 'Crear «' + q.trim() + '»' : '+ Nuevo ejercicio'}</button>
    <div>${grupos.length === 0 ? html`<p class="faint" style="margin:0">No hay ninguno con ese nombre.</p>` : grupos.map(([n, xs]) => { const ab = !!t || g === n; return html`<div key=${n}>
      <button class="ej-g" aria-expanded=${ab ? 'true' : 'false'} onClick=${() => !t && setG(g === n ? null : n)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>${n}<span class="c num">${xs.length}</span></button>
      ${ab && xs.map((c) => { const ya = elegidos.includes(c.id); return html`<div class="ej-f" key=${c.id}><button class="el" aria-pressed=${multiple ? (ya ? 'true' : 'false') : undefined} onClick=${() => elegir(c)}>
        <span class="q"><b>${c.nombre}</b><small>${[c.equipo, c.maquina_num && 'nº ' + c.maquina_num, c.zona, c.socio_id && 'Tuyo'].filter(Boolean).join(' · ')}${M.get(c.id)?.rm ? ' · 1RM ' + fmt(Math.round(M.get(c.id).rm.v)) + ' kg' : ''}</small></span>
        <span style=${'font-size:20px;color:' + (ya ? 'var(--gold)' : 'var(--faint)')}>${multiple ? (ya ? '✓' : '+') : '›'}</span></button>${c.socio_id && html`<button class="ed" onClick=${() => setEd({ ...c })}>Editar</button>`}</div>`; })}</div>`; })}</div>
    ${multiple && html`<button class="btn" onClick=${cerrar}>Hecho</button>`}
  </div>`;
}

function EditarEjercicio({ sb, socio, avisar, catalogo, ini, volver, hecho }) {
  const [f, setF] = useState(ini); const [oc, setOc] = useState(false); const [seguro, setSeguro] = useState(false); const [err, setErr] = useState('');
  const chips = (xs, k) => html`<div class="chips" style="margin-top:8px">${xs.map((x) => html`<button class="chip" style="min-height:44px" aria-pressed=${f[k] === x ? 'true' : 'false'} onClick=${() => { setF({ ...f, [k]: x }); setErr(''); }}>${x}</button>`)}</div>`;
  const guardarE = async () => {
    const nombre = f.nombre.trim(); if (nombre.length < 2) return setErr('Ponle un nombre'); if (!f.grupo) return setErr('Elige el grupo muscular');
    if (catalogo.some((c) => c.id !== f.id && norm(c.nombre) === norm(nombre))) return setErr('Ya hay un ejercicio con ese nombre');
    setOc(true); const fila = { nombre, grupo: f.grupo, equipo: f.equipo };
    let r; try { r = await (f.id ? sb.from('ejercicios').update(fila).eq('id', f.id) : sb.from('ejercicios').insert({ ...fila, socio_id: socio.id })).select('id,nombre,grupo,equipo,maquina_num,zona,marca,socio_id').single(); } catch (e) { r = { error: e }; }
    setOc(false);
    if (!r.error) { avisar(f.id ? 'Cambios guardados' : 'Ejercicio creado'); return hecho(r.data); }
    if (r.error.code === '23505') return setErr('Ya hay un ejercicio con ese nombre');
    if (!f.id && (!navigator.onLine || /fetch|network|load failed/i.test(r.error.message || ''))) { avisar('Sin conexión: vale para este entreno, pero no queda en tu lista'); return hecho({ id: null, nombre }); }
    setErr(r.error.message || 'No se ha podido guardar');
  };
  const borrar = async () => { if (!seguro) return setSeguro(true); setOc(true); const { error } = await sb.from('ejercicios').update({ activo: false }).eq('id', f.id); setOc(false); if (error) return setErr('No se ha podido borrar'); avisar('Ejercicio borrado. Tus marcas se conservan'); hecho(f, true); };
  return html`<div class="velo" onClick=${volver}></div><div class="hoja" role="dialog" aria-label=${f.id ? 'Editar ejercicio' : 'Nuevo ejercicio'} style="max-height:88%">
    <span class="asa" aria-hidden="true"></span>
    <h2 class="serif" style="font-size:28px;font-weight:400">${f.id ? 'Editar' : 'Nuevo'} <span class="kw">EJERCICIO</span></h2>
    <div class="campo"><label for="ej-n">Nombre</label><input id="ej-n" maxlength="60" placeholder="Press en máquina" value=${f.nombre} onInput=${(e) => { setF({ ...f, nombre: e.target.value }); setErr(''); }} /></div>
    <div><span class="lab">Grupo muscular</span>${chips([...GRUPOS, 'Otros'], 'grupo')}</div>
    <div><span class="lab">Con qué se hace</span>${chips(TIPOS, 'equipo')}</div>
    ${err && html`<p class="err">${err}</p>`}
    <button class="btn" disabled=${oc} onClick=${guardarE}>${f.id ? 'Guardar' : 'Crear ejercicio'}</button>
    <div class="fila"><button class="btn2" onClick=${volver}>Volver</button>${f.id ? html`<button class="btn2" style="color:var(--bad)" disabled=${oc} onClick=${borrar}>${seguro ? '¿Seguro?' : 'Borrar'}</button>` : html`<span></span>`}</div>
  </div>`;
}

// ---------- rutinas ----------
function HojaRutinas({ cambioCat, sb, socio, rutinas, catalogo, cerrar, cambio, avisar }) {
  const [ed, setEd] = useState(null); const [pick, setPick] = useState(false);
  const nueva = () => setEd({ nombre: '', dias: [], ejercicios: [] });
  const guardarR = async () => {
    if (!ed.nombre.trim()) return avisar('Ponle un nombre a la rutina');
    const fila = { socio_id: socio.id, nombre: ed.nombre.trim(), dias: ed.dias, ejercicios: ed.ejercicios };
    const { error } = ed.id ? await sb.from('rutinas').update(fila).eq('id', ed.id) : await sb.from('rutinas').insert(fila);
    if (error) return avisar('No se ha podido guardar');
    avisar('Rutina guardada'); setEd(null); cambio();
  };
  const borrar = async () => { await sb.from('rutinas').delete().eq('id', ed.id); avisar('Rutina borrada'); setEd(null); cambio(); };
  const toggle = (c) => setEd((x) => ({ ...x, ejercicios: x.ejercicios.some((e) => e.id === c.id && e.nombre === c.nombre) ? x.ejercicios.filter((e) => !(e.id === c.id && e.nombre === c.nombre)) : [...x.ejercicios, { id: c.id, nombre: c.nombre }] }));
  return html`<div class="velo" onClick=${cerrar}></div><div class="hoja" role="dialog" aria-label="Rutinas" style="max-height:90%">
    <span class="asa" aria-hidden="true"></span>
    ${!ed ? html`
      <h2 class="serif" style="font-size:28px;font-weight:400">Mis <span class="kw">RUTINAS</span></h2>
      <p class="muted" style="margin:0;font-size:13.5px">Pon qué entrenas cada día y al abrir la app te dirá qué te toca.</p>
      <div class="lista">${rutinas.length === 0 ? html`<p class="faint">Aún no tienes rutinas.</p>` : rutinas.map((r) => html`<button class="it" style="border-left:0;border-right:0;border-bottom:0;background:transparent;color:inherit;text-align:left;width:100%" onClick=${() => setEd({ ...r, dias: r.dias || [], ejercicios: r.ejercicios || [] })}>
        <span class="q"><b>${r.nombre}</b><small>${(r.dias || []).map((d) => DIAS[d]).join(' ') || 'Sin día'} · ${(r.ejercicios || []).length} ejercicios</small></span><span class="faint">Editar ›</span></button>`)}</div>
      <button class="btn" onClick=${nueva}>+ Nueva rutina</button>` : html`
      <h2 class="serif" style="font-size:28px;font-weight:400">${ed.id ? 'Editar' : 'Nueva'} <span class="kw">RUTINA</span></h2>
      <div class="campo"><label for="rn">Nombre</label><input id="rn" placeholder="Pierna y glúteo" value=${ed.nombre} onInput=${(e) => setEd({ ...ed, nombre: e.target.value })} /></div>
      <div><span class="lab">Días</span><div class="chips" style="margin-top:8px">${DIAS.map((d, i) => html`<button class="chip" style="min-width:44px" aria-pressed=${ed.dias.includes(i) ? 'true' : 'false'} onClick=${() => setEd({ ...ed, dias: ed.dias.includes(i) ? ed.dias.filter((x) => x !== i) : [...ed.dias, i].sort() })}>${d}</button>`)}</div></div>
      <div><span class="lab">Ejercicios (${ed.ejercicios.length})</span><div class="lista" style="margin-top:4px">${ed.ejercicios.map((e, i) => html`<div class="it"><span class="q"><b>${i + 1}. ${e.nombre}</b></span>
        <button class="btn2" style="min-height:34px;font-size:12px" onClick=${() => setEd({ ...ed, ejercicios: ed.ejercicios.filter((_, j) => j !== i) })}>Quitar</button></div>`)}</div>
        <button class="btn2" style="width:100%;margin-top:8px;border-style:dashed;color:var(--gold)" onClick=${() => setPick(true)}>+ Añadir ejercicios</button></div>
      <button class="btn" onClick=${guardarR}>Guardar rutina</button>
      <div class="fila"><button class="btn2" onClick=${() => setEd(null)}>Volver</button>${ed.id ? html`<button class="btn2" style="color:var(--bad)" onClick=${borrar}>Borrar</button>` : html`<span></span>`}</div>`}
    ${pick && html`<${Picker} sb=${sb} socio=${socio} avisar=${avisar} cambioCat=${cambioCat} catalogo=${catalogo} M=${new Map()} multiple=${true} elegidos=${ed.ejercicios.map((e) => e.id)} elegir=${toggle} cerrar=${() => setPick(false)} />`}
  </div>`;
}

// ---------- historial, récords, resumen ----------
function Historial({ sesiones, abrir }) {
  const ss = sesiones.filter((s) => s.ejercicios.some((e) => e.sets.length));
  if (!ss.length) return html`<div class="vacio">Aquí aparecerán tus entrenos cuando termines el primero.</div>`;
  return html`<div class="lista">${ss.slice(0, 60).map((s) => { const n = s.ejercicios.reduce((a, e) => a + e.sets.length, 0); const v = s.ejercicios.reduce((a, e) => a + e.sets.reduce((b, x) => b + x.peso * x.reps, 0), 0);
    return html`<button class="it" style="border-left:0;border-right:0;border-bottom:0;background:transparent;color:inherit;text-align:left;width:100%" onClick=${() => abrir(s)}>
      <span class="q"><b>${s.titulo || 'Entreno'}</b><small class="num">${fechaCorta(s.fecha)} · ${s.ejercicios.length} ejercicios · ${n} series · ${Math.round(v)} kg</small></span><span class="faint">›</span></button>`; })}</div>`;
}
function Records({ M, catalogo }) {
  const xs = [...M].filter(([, r]) => r.rm && r.rm.v > 0).map(([k, r]) => ({ ...r, g: grupoDe(catalogo.find((c) => c.id === k) || catalogo.find((c) => norm(c.nombre) === norm(r.nombre))) })).sort((a, b) => b.rm.v - a.rm.v);
  if (!xs.length) return html`<div class="vacio">Tus mejores marcas aparecerán aquí: 1RM estimado y peso máximo de cada ejercicio.</div>`;
  return html`<div style="display:flex;flex-direction:column;gap:22px">${[...GRUPOS, 'Otros'].filter((g) => xs.some((r) => r.g === g)).map((g) => html`<div key=${g}><span class="lab" style="color:var(--gold)">${g}</span><div class="lista">${xs.filter((r) => r.g === g).map((r) => html`<div class="it"><span class="q"><b>${r.nombre}</b><small class="num">Máx. ${fmt(r.max.peso)} kg × ${r.max.reps} · ${fechaCorta(r.rm.fecha)}</small></span>
    <span style="text-align:right"><b class="kw num" style="font-size:20px">${fmt(Math.round(r.rm.v * 2) / 2)}</b><small class="faint" style="display:block;font-size:11px">1RM kg</small></span></div>`)}</div></div>`)}</div>`;
}
function HojaSesion({ s, cerrar, borrar }) {
  const [seguro, setSeguro] = useState(false);
  return html`<div class="velo" onClick=${cerrar}></div><div class="hoja" role="dialog" aria-label=${s.titulo} style="max-height:88%">
    <span class="asa" aria-hidden="true"></span>
    <div><p class="eyebrow">${fechaCorta(s.fecha)}</p><h2 class="serif" style="font-size:30px;font-weight:400">${s.titulo || 'Entreno'}</h2></div>
    ${s.ejercicios.map((e) => html`<div class="card" style="padding:12px 14px;gap:4px"><b>${e.nombre}</b><span class="num muted" style="font-size:13.5px">${e.sets.map((x) => fmt(x.peso) + ' kg × ' + x.reps).join(' · ')}</span></div>`)}
    <button class="btn2" style="color:var(--bad)" onClick=${() => seguro ? borrar() : setSeguro(true)}>${seguro ? '¿Seguro? Pulsa otra vez para borrarla' : 'Borrar esta sesión'}</button>
  </div>`;
}
function Resumen({ r, cerrar }) {
  const n = r.ejercicios.reduce((a, e) => a + e.sets.length, 0);
  return html`<div class="pant">
    <header><div><p class="eyebrow">Entreno guardado</p><h1 class="serif">${r.titulo.split(' ')[0]} <span class="kw">HECHO</span></h1></div></header>
    <div class="card oro" style="gap:14px">
      <div class="fila" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        ${[['Duración', r.mins + ' min'], ['Series', n], ['Volumen', Math.round(r.vol) + ' kg']].map(([l, v]) => html`<div><span class="lab">${l}</span><div class="kw num" style="font-size:22px;color:var(--ink)">${v}</div></div>`)}</div>
      ${r.recs > 0 && html`<span style="font-weight:700;color:var(--gold)">${r.recs} ${r.recs === 1 ? 'récord nuevo' : 'récords nuevos'}</span>`}
    </div>
    ${r.ejercicios.map((e) => html`<div class="it" style="border-top:1px solid var(--line)"><span class="q"><b>${e.nombre}</b><small class="num">${e.sets.map((x) => fmt(x.peso) + '×' + x.reps).join(' · ')}</small></span></div>`)}
    <button class="btn" onClick=${cerrar}>Hecho</button>
  </div>`;
}
