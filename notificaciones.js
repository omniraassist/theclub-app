// Notificaciones en el móvil: activar, desactivar y elegir cuáles.
import { html, useState, useEffect } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
const de64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const a64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const puede = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
const instalada = () => navigator.standalone || matchMedia('(display-mode: standalone)').matches;
const actual = async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? r.pushManager.getSubscription() : null; };
const guardar = async (sb, s) => { const { error } = await sb.rpc('push_guardar', { p_endpoint: s.endpoint, p_p256dh: a64(s.getKey('p256dh')), p_auth: a64(s.getKey('auth')) }); if (error) throw error; };

// Al abrir la app: si este móvil ya tiene permiso, se asegura de que el club lo tiene apuntado a esta cuenta.
export async function sincronizarPush(sb) { try { if (!puede() || Notification.permission !== 'granted') return; const s = await actual(); if (s) await guardar(sb, s); } catch {} }
// Al cerrar sesión: este móvil deja de recibir las de esa cuenta.
export async function soltarPush(sb) { try { if (!puede()) return; const s = await actual(); if (s) { await sb.rpc('push_borrar', { p_endpoint: s.endpoint }); await s.unsubscribe(); } } catch {} }

export function Notificaciones({ sb, avisar, compacto, activo }) {
  const [on, setOn] = useState(null); const [oc, setOc] = useState(false); const [uid, setUid] = useState(null); const [p, setP] = useState({ citas: true, avisos: true, cuota: true });
  const [clave, setClave] = useState(null); const [no, setNo] = useState(() => { try { return localStorage.getItem('theclub-push-no') === '1'; } catch { return false; } });
  useEffect(() => { if (activo === false) return; let vivo = true; (async () => {
    const s = puede() && Notification.permission === 'granted' ? await actual() : null; if (!vivo) return; setOn(!!s);
    const { data: { session } } = await sb.auth.getSession(); if (!vivo || !session) return; setUid(session.user.id);
    if (!s) sb.rpc('push_clave_publica').then((r) => vivo && setClave(r.data || null));
    if (!compacto) sb.from('push_prefs').select('citas,avisos,cuota').eq('user_id', session.user.id).maybeSingle().then((r) => vivo && r.data && setP(r.data));
  })().catch(() => vivo && setOn(false)); return () => { vivo = false; }; }, [activo]);
  const activar = async () => {
    setOc(true);
    try {
      // el permiso se pide lo primero: el iPhone solo lo enseña justo después de tocar
      if (await Notification.requestPermission() !== 'granted') { avisar('Permiso no concedido. Actívalo en Ajustes del móvil'); return; }
      const reg = await navigator.serviceWorker.ready; const k = clave || (await sb.rpc('push_clave_publica')).data;
      if (!k) throw new Error('Aún no están disponibles');
      const s = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: de64(k) });
      await guardar(sb, s); setOn(true); await sb.rpc('push_prueba'); avisar('Activadas. Te llegará una de prueba en un minuto');
    } catch (e) { avisar('No se han podido activar: ' + (e.message || e)); } finally { setOc(false); }
  };
  const apagar = async () => { setOc(true); await soltarPush(sb); setOn(false); setOc(false); avisar('Notificaciones desactivadas'); };
  const pref = async (k, v) => { const n = { ...p, [k]: v }; setP(n); const { error } = await sb.from('push_prefs').upsert({ user_id: uid, ...n }); if (error) { setP(p); avisar('No se ha guardado'); } };
  const hayQueInstalar = iPhone && !instalada();
  if (on === null && compacto) return null;
  if (compacto) {
    if (on || no || !puede() || Notification.permission === 'denied' || !clave) return null;
    return html`<div class="card"><b>Que no se te pase una cita</b><span class="muted" style="font-size:13.5px">Te avisamos de tus citas, tus clases y las novedades del club.</span>
      <div style="display:flex;gap:10px;margin-top:6px"><button class="btn2" style="flex:1;color:var(--gold)" disabled=${oc} onClick=${activar}>Activar avisos</button><button class="btn2" style="border-color:transparent;color:var(--muted)" onClick=${() => { try { localStorage.setItem('theclub-push-no', '1'); } catch {} setNo(true); }}>Ahora no</button></div></div>`;
  }
  return html`<div class="card"><span class="lab">Notificaciones</span>
    ${hayQueInstalar ? html`<span class="muted" style="font-size:13.5px">Añade la app a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde allí para activarlas.</span>`
      : !puede() ? html`<span class="muted" style="font-size:13.5px">Este navegador no las admite.</span>`
      : Notification.permission === 'denied' ? html`<span class="muted" style="font-size:13.5px">Están bloqueadas. Actívalas en Ajustes del móvil → Notificaciones → The Club.</span>`
      : on ? html`${[['citas', 'Citas y clases'], ['avisos', 'Novedades del club']].map(([k, n]) => html`<label style="display:flex;align-items:center;gap:12px;min-height:44px"><span style="flex:1">${n}</span><input type="checkbox" style="width:20px;height:20px;accent-color:#E8D070" checked=${p[k]} onChange=${(e) => pref(k, e.target.checked)} /></label>`)}
        <button class="btn2" disabled=${oc} onClick=${apagar}>Desactivar en este móvil</button>`
      : html`<span class="muted" style="font-size:13.5px">Recordatorios de tus citas y clases, y novedades del club.</span><button class="btn2" style="color:var(--gold)" disabled=${oc} onClick=${activar}>Activar avisos</button>`}</div>`;
}
