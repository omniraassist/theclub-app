// Clases en grupo: lo que ve el socio dentro de Reservas.
import { html, useState, useEffect } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
const p2 = (n) => String(n).padStart(2, '0');
const local = (t) => { const d = new Date(t); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
const hh = (t) => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const SEM = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

export async function misClases(sb) {
  const { data, error } = await sb.rpc('clases_disponibles'); if (error) throw error;
  return data.filter((c) => c.mi_reserva).map((c) => ({ id: c.mi_reserva, servicio: c.clase, inicio: c.inicio, clase: true, nota: c.cancelada ? 'Cancelada por el club' + (c.motivo ? ': ' + c.motivo : '') : c.mi_estado === 'espera' ? 'En lista de espera · puesto ' + c.mi_puesto : '' }));
}
export function Clases({ sb, avisar, puede, activo, alCambiar, version }) {
  const [l, setL] = useState(null); const [dia, setDia] = useState(null); const [oc, setOc] = useState(null); const [err, setErr] = useState(false);
  const cargar = async () => { const { data, error } = await sb.rpc('clases_disponibles'); if (error) return setErr(true); setErr(false); const xs = data.filter((c) => !c.cancelada); setL(xs); setDia((d) => xs.some((c) => local(c.inicio) === d) ? d : xs[0] ? local(xs[0].inicio) : null); };
  useEffect(() => { if (activo) cargar(); }, [activo, version]);
  const hacer = async (c) => {
    setOc(c.id);
    const r = c.mi_reserva ? await sb.rpc('cancelar_clase', { p_reserva: c.mi_reserva }) : await sb.rpc('reservar_clase', { p_sesion: c.id });
    setOc(null); avisar(r.error ? r.error.message : c.mi_reserva ? 'Plaza anulada' : r.data === 'espera' ? 'Estás en lista de espera' : 'Plaza reservada'); cargar(); alCambiar();
  };
  if (err) return html`<div class="vacio">No se han podido cargar las clases.</div>`;
  if (l === null) return html`<p class="faint">Buscando clases…</p>`;
  if (!l.length) return html`<div class="vacio">Todavía no hay clases publicadas.</div>`;
  const dias = [...new Set(l.map((c) => local(c.inicio)))];
  return html`<div style="display:flex;flex-direction:column;gap:16px">
    <div class="dias">${dias.map((d) => { const f = new Date(d + 'T12:00:00'); return html`<button class="dia" aria-pressed=${d === dia ? 'true' : 'false'} onClick=${() => setDia(d)}><span>${SEM[f.getDay()]}</span><b>${f.getDate()}</b></button>`; })}</div>
    ${!puede && html`<p class="err">Para reservar, tu cuota tiene que estar al día.</p>`}
    ${l.filter((c) => local(c.inicio) === dia).map((c) => { const libres = Math.max(0, c.plazas - c.ocupadas); return html`<div class=${'card' + (c.mi_reserva ? ' oro' : '')} key=${c.id}>
      <div style="display:flex;gap:12px;align-items:center"><b class="num" style="font-size:20px">${hh(c.inicio)}</b><div style="flex:1;min-width:0"><b>${c.clase}</b><div class="muted" style="font-size:13px">${[c.monitor, 'hasta las ' + hh(c.fin)].filter(Boolean).join(' · ')}</div></div></div>
      <div style="display:flex;gap:12px;align-items:center"><span class="muted" style="flex:1;font-size:13.5px">${c.mi_estado === 'espera' ? 'En espera · puesto ' + c.mi_puesto : c.mi_estado ? 'Tienes plaza' : libres ? libres + (libres === 1 ? ' plaza libre' : ' plazas libres') : 'Completa'}</span>
        ${c.reservable || c.mi_reserva ? html`<button class="btn2" disabled=${oc === c.id || (!puede && !c.mi_reserva)} onClick=${() => hacer(c)}>${c.mi_reserva ? 'Anular' : libres ? 'Reservar' : 'Lista de espera'}</button>` : html`<span class="muted" style="font-size:13px">Apúntate en recepción</span>`}</div></div>`; })}
  </div>`;
}
