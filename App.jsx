import { useState, useEffect, useRef } from "react";

// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
const FB_URL = "https://turnero-infinito-default-rtdb.firebaseio.com";

const fb = {
  async get(path) {
    const r = await fetch(`${FB_URL}/${path}.json`);
    return r.json();
  },
  async set(path, data) {
    await fetch(`${FB_URL}/${path}.json`, { method: "PUT", body: JSON.stringify(data) });
  },
  async push(path, data) {
    const r = await fetch(`${FB_URL}/${path}.json`, { method: "POST", body: JSON.stringify(data) });
    return r.json();
  },
  async delete(path) {
    await fetch(`${FB_URL}/${path}.json`, { method: "DELETE" });
  },
  listen(path, cb) {
    const es = new EventSource(`${FB_URL}/${path}.json?accept=text/event-stream`);
    es.addEventListener("put", e => { try { cb(JSON.parse(e.data).data); } catch {} });
    es.addEventListener("patch", e => { try { cb(null, JSON.parse(e.data)); } catch {} });
    return () => es.close();
  },
};

// ─── NOTIFICACIONES ───────────────────────────────────────────────────────────
const Notif = {
  async pedir() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const perm = await Notification.requestPermission();
    return perm === "granted";
  },
  enviar(titulo, cuerpo, icono = "📅") {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const n = new Notification(titulo, {
      body: cuerpo,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>" + icono + "</text></svg>",
      badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📅</text></svg>",
      requireInteraction: false,
      silent: false,
    });
    setTimeout(() => n.close(), 6000);
    return n;
  },
};

// ─── DATOS INICIALES ──────────────────────────────────────────────────────────
const INIT_PROFESIONALES = {
  admin: { nombre: "Administrador", especialidad: "Administración", clave: "admin123", color: "#6366F1", rol: "admin", horario: { lun: ["09:00","18:00"], mar: ["09:00","18:00"], mie: ["09:00","18:00"], jue: ["09:00","18:00"], vie: ["09:00","18:00"], sab: [], dom: [] } },
  p1: { nombre: "Dra. Ana López", especialidad: "Médica clínica", clave: "ana123", color: "#EC4899", rol: "profesional", horario: { lun: ["08:00","13:00"], mar: ["08:00","13:00"], mie: [], jue: ["08:00","13:00"], vie: ["08:00","13:00"], sab: [], dom: [] } },
  p2: { nombre: "Prof. Carlos Ruiz", especialidad: "Fisioterapia", clave: "carlos123", color: "#F59E0B", rol: "profesional", horario: { lun: ["14:00","20:00"], mar: ["14:00","20:00"], mie: ["14:00","20:00"], jue: [], vie: ["14:00","20:00"], sab: ["09:00","13:00"], dom: [] } },
};

const INIT_TURNOS = {
  t1: { cliente: "María García", telefono: "5491112345678", email: "maria@email.com", servicio: "Consulta clínica", fecha: "2026-05-21", hora: "09:30", notas: "Primera visita", estado: "confirmado", profesionalId: "p1" },
  t2: { cliente: "Juan Pérez", telefono: "5491187654321", email: "", servicio: "Fisioterapia", fecha: "2026-05-21", hora: "15:00", notas: "", estado: "pendiente", profesionalId: "p2" },
  t3: { cliente: "Laura Torres", telefono: "5491155443322", email: "laura@email.com", servicio: "Consulta clínica", fecha: "2026-05-22", hora: "10:00", notas: "Control", estado: "confirmado", profesionalId: "p1" },
};

const ESTADOS = ["pendiente", "confirmado", "cancelado"];
const DIAS_LABEL = { dom: "Dom", lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue", vie: "Vie", sab: "Sáb" };
const EST_COLOR = {
  pendiente: { bg: "#2D1F00", border: "#92400E", text: "#FCD34D", dot: "#F59E0B" },
  confirmado: { bg: "#022C22", border: "#065F46", text: "#6EE7B7", dot: "#10B981" },
  cancelado:  { bg: "#2D0000", border: "#7F1D1D", text: "#FCA5A5", dot: "#EF4444" },
};

function fmt(f) { if (!f) return ""; const [y,m,d] = f.split("-"); return `${d}/${m}/${y}`; }
function waMsg(t, p) {
  return encodeURIComponent(`¡Hola ${t.cliente}! 👋\n\nTe recordamos tu turno:\n📅 Fecha: ${fmt(t.fecha)}\n🕐 Hora: ${t.hora}hs\n💼 Servicio: ${t.servicio}\n👨‍⚕️ Profesional: ${p?.nombre || ""}\n\nConfirmá respondiendo este mensaje. ¡Te esperamos! 😊`);
}

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
function Modal({ children, onClose, wide }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",animation:"fi .2s ease" }}>
      <div style={{ background:"#0D1117",border:"1px solid #21262D",borderRadius:"20px",width:"100%",maxWidth:wide?"780px":"520px",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.7)",animation:"su .25s ease" }}>
        {children}
      </div>
    </div>
  );
}

function Btn({ children, onClick, variant="primary", small, style={}, disabled }) {
  const base = { border:"none",borderRadius:"10px",cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:"700",transition:"all .15s",display:"inline-flex",alignItems:"center",gap:"6px",padding:small?"8px 14px":"12px 20px",fontSize:small?"13px":"14px",opacity:disabled?.5:1 };
  const variants = {
    primary: { background:"linear-gradient(135deg,#2563EB,#7C3AED)",color:"#fff",boxShadow:"0 4px 14px rgba(37,99,235,.35)" },
    ghost:   { background:"#161B22",color:"#8B949E",border:"1px solid #21262D" },
    danger:  { background:"#1A0000",color:"#FCA5A5",border:"1px solid #7F1D1D" },
    yellow:  { background:"#2D1F00",color:"#FCD34D",border:"1px solid #92400E" },
  };
  return <button onClick={!disabled ? onClick : undefined} style={{...base,...variants[variant],...style}}>{children}</button>;
}

function Input({ label, ...props }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:"5px" }}>
      {label && <label style={{ fontSize:"11px",color:"#6E7681",textTransform:"uppercase",letterSpacing:".05em" }}>{label}</label>}
      <input {...props} style={{ background:"#161B22",border:"1px solid #21262D",borderRadius:"10px",padding:"11px 14px",color:"#E6EDF3",fontSize:"14px",outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box",...props.style }} />
    </div>
  );
}

function Toast({ items }) {
  return (
    <div style={{ position:"fixed",bottom:"20px",right:"20px",zIndex:999,display:"flex",flexDirection:"column",gap:"8px",pointerEvents:"none" }}>
      {items.map(t => {
        const colors = { ok:"#10B981", err:"#EF4444", info:"#3B82F6", warn:"#F59E0B" };
        const icons  = { ok:"✓", err:"✕", info:"ℹ", warn:"⚠" };
        return (
          <div key={t.id} style={{ background:"#0D1117",border:`1px solid ${colors[t.tipo]||colors.info}`,borderRadius:"12px",padding:"12px 18px",color:"#E6EDF3",fontSize:"13px",fontWeight:"600",boxShadow:"0 8px 30px rgba(0,0,0,.5)",animation:"su .25s ease",display:"flex",alignItems:"center",gap:"8px" }}>
            <span style={{ color:colors[t.tipo]||colors.info,fontSize:"15px" }}>{icons[t.tipo]||icons.info}</span>
            {t.msg}
          </div>
        );
      })}
    </div>
  );
}

// Banner para pedir permiso de notificaciones
function NotifBanner({ onAceptar, onIgnorar }) {
  return (
    <div style={{ background:"#1C2D4F",border:"1px solid #2563EB",borderRadius:"14px",padding:"14px 18px",margin:"0 0 16px",display:"flex",alignItems:"center",gap:"14px",flexWrap:"wrap" }}>
      <span style={{ fontSize:"24px" }}>🔔</span>
      <div style={{ flex:1,minWidth:"160px" }}>
        <div style={{ color:"#E6EDF3",fontWeight:"700",fontSize:"14px" }}>Activar notificaciones</div>
        <div style={{ color:"#8B949E",fontSize:"12px",marginTop:"2px" }}>Recibí avisos cuando se creen, modifiquen o cancelen turnos</div>
      </div>
      <div style={{ display:"flex",gap:"8px" }}>
        <Btn small onClick={onAceptar}>Activar 🔔</Btn>
        <Btn small variant="ghost" onClick={onIgnorar}>Ahora no</Btn>
      </div>
    </div>
  );
}

function WAIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.522 5.849L.057 23.457c-.076.295.196.569.49.49l5.637-1.464A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.793 9.793 0 01-4.997-1.367l-.358-.214-3.717.966.991-3.624-.234-.372A9.78 9.78 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ profesionales, onLogin }) {
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = () => {
    setLoading(true); setError("");
    setTimeout(() => {
      const entry = Object.entries(profesionales).find(([, p]) => p.clave === clave.trim());
      if (entry) onLogin({ id: entry[0], ...entry[1] });
      else { setError("Clave incorrecta. Intentá de nuevo."); setLoading(false); }
    }, 500);
  };

  return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#010409",fontFamily:"'Outfit',sans-serif" }}>
      <div style={{ position:"fixed",inset:0,background:"radial-gradient(ellipse 60% 50% at 50% 0%,rgba(37,99,235,.15),transparent)",pointerEvents:"none" }} />
      <div style={{ width:"100%",maxWidth:"380px",padding:"20px",animation:"su .4s ease" }}>
        <div style={{ textAlign:"center",marginBottom:"32px" }}>
          <div style={{ width:"64px",height:"64px",borderRadius:"18px",background:"linear-gradient(135deg,#2563EB,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"28px",margin:"0 auto 14px" }}>📅</div>
          <h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:"28px",color:"#E6EDF3",margin:0 }}>TurnosPro</h1>
          <p style={{ color:"#6E7681",fontSize:"14px",marginTop:"6px" }}>Ingresá tu clave de acceso</p>
        </div>
        <div style={{ background:"#0D1117",border:"1px solid #21262D",borderRadius:"20px",padding:"28px" }}>
          <Input label="Clave de acceso" type="password" placeholder="••••••••" value={clave}
            onChange={e => setClave(e.target.value)} onKeyDown={e => e.key==="Enter" && handle()} />
          {error && <p style={{ color:"#F85149",fontSize:"13px",marginTop:"8px",background:"#2D0000",padding:"8px 12px",borderRadius:"8px",border:"1px solid #7F1D1D" }}>⚠️ {error}</p>}
          <Btn onClick={handle} disabled={loading} style={{ width:"100%",marginTop:"16px",justifyContent:"center" }}>
            {loading ? "Verificando..." : "Ingresar →"}
          </Btn>
        </div>
        <p style={{ textAlign:"center",color:"#484F58",fontSize:"12px",marginTop:"14px" }}>Demo: admin123 · ana123 · carlos123</p>
      </div>
    </div>
  );
}

// ─── FICHA TURNO ──────────────────────────────────────────────────────────────
function FichaTurno({ turno, profesionales, onClose, onEdit, onDelete }) {
  const p = profesionales[turno.profesionalId];
  const est = EST_COLOR[turno.estado];
  return (
    <Modal onClose={onClose}>
      <div style={{ padding:"28px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"18px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"14px" }}>
            <div style={{ width:"50px",height:"50px",borderRadius:"50%",background:`linear-gradient(135deg,${p?.color||"#6366F1"},#7C3AED)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:"800",color:"#fff" }}>{turno.cliente.charAt(0)}</div>
            <div>
              <h2 style={{ margin:0,fontSize:"20px",fontWeight:"700",color:"#E6EDF3",fontFamily:"'Playfair Display',serif" }}>{turno.cliente}</h2>
              <p style={{ margin:"3px 0 0",color:"#6E7681",fontSize:"13px" }}>{turno.email||"Sin email"}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"transparent",border:"none",color:"#6E7681",fontSize:"20px",cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"inline-flex",alignItems:"center",gap:"6px",background:est.bg,border:`1px solid ${est.border}`,color:est.text,borderRadius:"20px",padding:"4px 14px",fontSize:"12px",fontWeight:"700",marginBottom:"16px" }}>
          <span style={{ width:"7px",height:"7px",borderRadius:"50%",background:est.dot,display:"inline-block" }} />
          {turno.estado.charAt(0).toUpperCase()+turno.estado.slice(1)}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"14px" }}>
          {[["📅","Fecha",fmt(turno.fecha)],["🕐","Hora",turno.hora+"hs"],["💼","Servicio",turno.servicio||"—"],["📱","Teléfono","+"+turno.telefono],["👨‍⚕‍","Profesional",p?.nombre||"—"],["🎨","Especialidad",p?.especialidad||"—"]].map(([ic,lb,val])=>(
            <div key={lb} style={{ background:"#161B22",border:"1px solid #21262D",borderRadius:"12px",padding:"12px" }}>
              <div style={{ fontSize:"15px",marginBottom:"3px" }}>{ic}</div>
              <div style={{ fontSize:"10px",color:"#6E7681",textTransform:"uppercase",letterSpacing:".05em" }}>{lb}</div>
              <div style={{ fontSize:"13px",fontWeight:"600",color:"#C9D1D9",marginTop:"2px" }}>{val}</div>
            </div>
          ))}
        </div>
        {turno.notas && (
          <div style={{ background:"#161B22",border:"1px solid #21262D",borderRadius:"12px",padding:"14px",marginBottom:"14px" }}>
            <div style={{ fontSize:"10px",color:"#6E7681",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"6px" }}>📝 Notas</div>
            <p style={{ margin:0,color:"#8B949E",fontSize:"13px",lineHeight:"1.6" }}>{turno.notas}</p>
          </div>
        )}
        <div style={{ display:"flex",gap:"8px",flexWrap:"wrap" }}>
          <a href={`https://wa.me/${turno.telefono}?text=${waMsg(turno,p)}`} target="_blank" rel="noopener noreferrer"
            style={{ flex:1,minWidth:"130px",background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",borderRadius:"10px",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",textDecoration:"none",fontWeight:"700",fontSize:"13px",boxShadow:"0 4px 14px rgba(37,211,102,.3)" }}>
            <WAIcon /> Recordatorio WA
          </a>
          <Btn variant="ghost" small onClick={() => onEdit(turno)}>✏️ Editar</Btn>
          <Btn variant="danger" small onClick={() => { onDelete(turno.id); onClose(); }}>🗑️</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── FORM TURNO ───────────────────────────────────────────────────────────────
function FormTurno({ initial, profesionales, usuarioId, esAdmin, onSave, onClose, saving }) {
  const [f, setF] = useState(initial || { cliente:"",telefono:"",email:"",servicio:"",fecha:"",hora:"",notas:"",estado:"pendiente",profesionalId:esAdmin?"":usuarioId });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const inp = { background:"#161B22",border:"1px solid #21262D",borderRadius:"10px",padding:"11px 14px",color:"#E6EDF3",fontSize:"14px",outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box" };
  const profList = Object.entries(profesionales).filter(([,p]) => p.rol==="profesional");

  return (
    <Modal onClose={onClose}>
      <div style={{ padding:"28px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px" }}>
          <h2 style={{ margin:0,color:"#E6EDF3",fontFamily:"'Playfair Display',serif",fontSize:"20px" }}>{f.id?"✏️ Editar turno":"➕ Nuevo turno"}</h2>
          <button onClick={onClose} style={{ background:"transparent",border:"none",color:"#6E7681",fontSize:"20px",cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px" }}>
          <div style={{ gridColumn:"1/-1" }}><Input label="Cliente *" placeholder="Nombre completo" value={f.cliente} onChange={set("cliente")} /></div>
          <div>
            <Input label="Teléfono WA *" placeholder="5491112345678" value={f.telefono} onChange={set("telefono")} />
            <p style={{ margin:"3px 0 0",fontSize:"11px",color:"#484F58" }}>Sin + ni espacios</p>
          </div>
          <Input label="Email" placeholder="correo@mail.com" value={f.email} onChange={set("email")} />
          <Input label="Fecha *" type="date" value={f.fecha} onChange={set("fecha")} />
          <Input label="Hora *" type="time" value={f.hora} onChange={set("hora")} />
          <div style={{ gridColumn:"1/-1" }}><Input label="Servicio" placeholder="Ej: Consulta, Masaje..." value={f.servicio} onChange={set("servicio")} /></div>
          {esAdmin && (
            <div>
              <label style={{ fontSize:"11px",color:"#6E7681",textTransform:"uppercase",letterSpacing:".05em",display:"block",marginBottom:"5px" }}>Profesional</label>
              <select value={f.profesionalId} onChange={set("profesionalId")} style={{...inp,cursor:"pointer"}}>
                <option value="">— Seleccionar —</option>
                {profList.map(([id,p]) => <option key={id} value={id}>{p.nombre}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ fontSize:"11px",color:"#6E7681",textTransform:"uppercase",letterSpacing:".05em",display:"block",marginBottom:"5px" }}>Estado</label>
            <select value={f.estado} onChange={set("estado")} style={{...inp,cursor:"pointer"}}>
              {ESTADOS.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase()+e.slice(1)}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={{ fontSize:"11px",color:"#6E7681",textTransform:"uppercase",letterSpacing:".05em",display:"block",marginBottom:"5px" }}>Notas</label>
            <textarea value={f.notas} onChange={set("notas")} style={{...inp,minHeight:"72px",resize:"vertical"}} placeholder="Observaciones..." />
          </div>
        </div>
        <div style={{ display:"flex",gap:"10px",marginTop:"18px" }}>
          <Btn onClick={() => onSave(f)} disabled={saving} style={{ flex:1,justifyContent:"center" }}>
            {saving ? "Guardando..." : (f.id ? "Guardar cambios" : "Crear turno")}
          </Btn>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── FORM PROFESIONAL ─────────────────────────────────────────────────────────
function FormProfesional({ initial, onSave, onClose, saving }) {
  const blank = { nombre:"",especialidad:"",clave:"",color:"#6366F1",rol:"profesional",horario:{ lun:[],mar:[],mie:[],jue:[],vie:[],sab:[],dom:[] }};
  const [f, setF] = useState(initial ? { ...blank, ...initial } : blank);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const toggleDia = dia => setF(p => ({ ...p, horario:{ ...p.horario, [dia]: p.horario[dia]?.length ? [] : ["09:00","18:00"] }}));
  const setHora = (dia, idx, val) => setF(p => { const h=[...(p.horario[dia]||[])]; h[idx]=val; return {...p,horario:{...p.horario,[dia]:h}}; });

  return (
    <Modal onClose={onClose} wide>
      <div style={{ padding:"28px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px" }}>
          <h2 style={{ margin:0,color:"#E6EDF3",fontFamily:"'Playfair Display',serif",fontSize:"20px" }}>{f.id?"✏️ Editar profesional":"👤 Nuevo profesional"}</h2>
          <button onClick={onClose} style={{ background:"transparent",border:"none",color:"#6E7681",fontSize:"20px",cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"18px" }}>
          <Input label="Nombre *" value={f.nombre} onChange={set("nombre")} placeholder="Nombre completo" />
          <Input label="Especialidad" value={f.especialidad} onChange={set("especialidad")} placeholder="Médico, Kinesiólogo..." />
          <Input label="Clave de acceso *" value={f.clave} onChange={set("clave")} placeholder="Contraseña" />
          <div>
            <label style={{ fontSize:"11px",color:"#6E7681",textTransform:"uppercase",letterSpacing:".05em",display:"block",marginBottom:"5px" }}>Color</label>
            <div style={{ display:"flex",gap:"8px",alignItems:"center" }}>
              <input type="color" value={f.color} onChange={set("color")} style={{ width:"40px",height:"36px",border:"none",borderRadius:"8px",cursor:"pointer",background:"transparent" }} />
              <span style={{ color:"#8B949E",fontSize:"13px" }}>Color en el calendario</span>
            </div>
          </div>
        </div>
        <div style={{ background:"#161B22",border:"1px solid #21262D",borderRadius:"14px",padding:"18px",marginBottom:"18px" }}>
          <h3 style={{ margin:"0 0 14px",color:"#C9D1D9",fontSize:"14px",fontWeight:"700" }}>🕐 Horarios de atención</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
            {["lun","mar","mie","jue","vie","sab","dom"].map(dia => {
              const activo = f.horario[dia]?.length > 0;
              return (
                <div key={dia} style={{ display:"flex",alignItems:"center",gap:"12px" }}>
                  <button onClick={() => toggleDia(dia)} style={{ width:"44px",height:"26px",borderRadius:"20px",border:"none",cursor:"pointer",background:activo?"#2563EB":"#21262D",transition:"background .2s",flexShrink:0,position:"relative" }}>
                    <div style={{ width:"20px",height:"20px",borderRadius:"50%",background:"#fff",position:"absolute",top:"3px",transition:"left .2s",left:activo?"21px":"3px" }} />
                  </button>
                  <span style={{ width:"32px",fontSize:"13px",fontWeight:"700",color:activo?"#C9D1D9":"#484F58" }}>{DIAS_LABEL[dia]}</span>
                  {activo ? (
                    <>
                      <input type="time" value={f.horario[dia][0]||"09:00"} onChange={e=>setHora(dia,0,e.target.value)} style={{ background:"#0D1117",border:"1px solid #21262D",borderRadius:"8px",padding:"6px 10px",color:"#E6EDF3",fontSize:"13px",outline:"none" }} />
                      <span style={{ color:"#484F58",fontSize:"13px" }}>a</span>
                      <input type="time" value={f.horario[dia][1]||"18:00"} onChange={e=>setHora(dia,1,e.target.value)} style={{ background:"#0D1117",border:"1px solid #21262D",borderRadius:"8px",padding:"6px 10px",color:"#E6EDF3",fontSize:"13px",outline:"none" }} />
                    </>
                  ) : <span style={{ color:"#484F58",fontSize:"13px" }}>No trabaja</span>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display:"flex",gap:"10px" }}>
          <Btn onClick={() => onSave(f)} disabled={saving} style={{ flex:1,justifyContent:"center" }}>
            {saving ? "Guardando..." : (f.id ? "Guardar" : "Crear profesional")}
          </Btn>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── CALENDARIO ───────────────────────────────────────────────────────────────
function Calendario({ turnos, profesionales, usuarioActual, onClickTurno, onNuevoTurno }) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const [semana, setSemana] = useState(0);
  const esAdmin = usuarioActual.rol === "admin";
  const inicioSemana = new Date(hoy);
  const dow = inicioSemana.getDay();
  inicioSemana.setDate(inicioSemana.getDate() - (dow===0?6:dow-1) + semana*7);
  const dias = Array.from({length:7},(_,i) => { const d=new Date(inicioSemana); d.setDate(d.getDate()+i); return d; });
  const hoyStr = hoy.toISOString().slice(0,10);
  const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
  const profVisibles = esAdmin ? Object.entries(profesionales).filter(([,p])=>p.rol==="profesional") : [[usuarioActual.id, usuarioActual]];
  const turnosArr = Object.entries(turnos).map(([id,t])=>({id,...t}));

  return (
    <div>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px" }}>
        <Btn variant="ghost" small onClick={()=>setSemana(s=>s-1)}>← Anterior</Btn>
        <div style={{ textAlign:"center" }}>
          <span style={{ color:"#E6EDF3",fontWeight:"700",fontSize:"14px" }}>
            {inicioSemana.toLocaleDateString("es-AR",{day:"numeric",month:"long"})} – {dias[6].toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"})}
          </span>
          {semana!==0 && <button onClick={()=>setSemana(0)} style={{ background:"transparent",border:"none",color:"#2563EB",fontSize:"12px",cursor:"pointer",marginLeft:"8px" }}>Hoy</button>}
        </div>
        <Btn variant="ghost" small onClick={()=>setSemana(s=>s+1)}>Siguiente →</Btn>
      </div>
      {esAdmin && (
        <div style={{ display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"12px" }}>
          {profVisibles.map(([id,p])=>(
            <div key={id} style={{ display:"flex",alignItems:"center",gap:"6px",background:"#161B22",border:"1px solid #21262D",borderRadius:"20px",padding:"4px 12px" }}>
              <span style={{ width:"10px",height:"10px",borderRadius:"50%",background:p.color,display:"inline-block" }} />
              <span style={{ color:"#C9D1D9",fontSize:"12px",fontWeight:"600" }}>{p.nombre}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ overflowX:"auto" }}>
        <div style={{ minWidth:"580px" }}>
          <div style={{ display:"grid",gridTemplateColumns:"52px repeat(7,1fr)",gap:"2px",marginBottom:"2px" }}>
            <div />
            {dias.map((d,i) => {
              const ds = d.toISOString().slice(0,10);
              const esHoy = ds===hoyStr;
              return (
                <div key={i} style={{ textAlign:"center",padding:"8px 4px",background:esHoy?"#1C2D4F":"#161B22",borderRadius:"8px",border:`1px solid ${esHoy?"#2563EB":"#21262D"}` }}>
                  <div style={{ fontSize:"10px",color:esHoy?"#60A5FA":"#6E7681",fontWeight:"700",textTransform:"uppercase" }}>{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"][i]}</div>
                  <div style={{ fontSize:"17px",fontWeight:"800",color:esHoy?"#60A5FA":"#C9D1D9" }}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
          {HORAS.map(hora => (
            <div key={hora} style={{ display:"grid",gridTemplateColumns:"52px repeat(7,1fr)",gap:"2px",marginBottom:"2px",minHeight:"50px" }}>
              <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingRight:"6px",paddingTop:"4px" }}>
                <span style={{ color:"#484F58",fontSize:"10px",fontWeight:"600" }}>{hora}</span>
              </div>
              {dias.map((d,di) => {
                const ds = d.toISOString().slice(0,10);
                const diaKey = ["dom","lun","mar","mie","jue","vie","sab"][d.getDay()];
                const hayHorario = profVisibles.some(([,p]) => p.horario?.[diaKey]?.length && p.horario[diaKey][0]<=hora && hora<p.horario[diaKey][1]);
                const tsDia = turnosArr.filter(t => t.fecha===ds && t.hora===hora && (esAdmin||t.profesionalId===usuarioActual.id));
                return (
                  <div key={di} onClick={() => hayHorario && onNuevoTurno(ds,hora)}
                    style={{ background:hayHorario?"#0D1117":"#080C12",borderRadius:"6px",border:"1px solid #21262D",minHeight:"50px",padding:"3px",cursor:hayHorario?"pointer":"default",transition:"background .1s" }}
                    onMouseEnter={e=>{ if(hayHorario) e.currentTarget.style.background="#161B22"; }}
                    onMouseLeave={e=>{ if(hayHorario) e.currentTarget.style.background="#0D1117"; }}
                  >
                    {tsDia.map(t => {
                      const p = profesionales[t.profesionalId];
                      return (
                        <div key={t.id} onClick={e=>{e.stopPropagation();onClickTurno(t);}}
                          style={{ background:p?.color||"#6366F1",borderRadius:"5px",padding:"3px 6px",marginBottom:"2px",cursor:"pointer",opacity:t.estado==="cancelado"?.4:1 }}>
                          <div style={{ fontSize:"11px",fontWeight:"700",color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{t.cliente}</div>
                          {esAdmin && <div style={{ fontSize:"9px",color:"rgba(255,255,255,.7)" }}>{p?.nombre.split(" ").pop()}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── LISTA TURNOS ─────────────────────────────────────────────────────────────
function ListaTurnos({ turnos, profesionales, usuarioActual, onVer, onNuevo }) {
  const esAdmin = usuarioActual.rol==="admin";
  const [busq, setBusq] = useState("");
  const [filtEst, setFiltEst] = useState("todos");
  const [filtProf, setFiltProf] = useState("todos");
  const turnosArr = Object.entries(turnos).map(([id,t])=>({id,...t}));
  const lista = turnosArr.filter(t => {
    if (!esAdmin && t.profesionalId !== usuarioActual.id) return false;
    const b = t.cliente?.toLowerCase().includes(busq.toLowerCase()) || (t.servicio||"").toLowerCase().includes(busq.toLowerCase());
    const e = filtEst==="todos" || t.estado===filtEst;
    const p = filtProf==="todos" || t.profesionalId===filtProf;
    return b && e && p;
  }).sort((a,b) => new Date(`${a.fecha}T${a.hora}`) - new Date(`${b.fecha}T${b.hora}`));
  const profList = Object.entries(profesionales).filter(([,p])=>p.rol==="profesional");

  return (
    <div>
      <div style={{ display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap" }}>
        <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="🔍 Buscar..." style={{ flex:1,minWidth:"150px",background:"#161B22",border:"1px solid #21262D",borderRadius:"10px",padding:"9px 14px",color:"#E6EDF3",fontSize:"13px",outline:"none",fontFamily:"inherit" }} />
        {["todos",...ESTADOS].map(e=>(
          <button key={e} onClick={()=>setFiltEst(e)} style={{ background:filtEst===e?"#1C2D4F":"transparent",color:filtEst===e?"#60A5FA":"#484F58",border:`1px solid ${filtEst===e?"#2563EB":"#21262D"}`,borderRadius:"8px",padding:"8px 12px",cursor:"pointer",fontSize:"12px",fontWeight:"700" }}>
            {e==="todos"?"Todos":e.charAt(0).toUpperCase()+e.slice(1)}
          </button>
        ))}
        {esAdmin && (
          <select value={filtProf} onChange={e=>setFiltProf(e.target.value)} style={{ background:"#161B22",border:"1px solid #21262D",borderRadius:"8px",padding:"8px 12px",color:"#C9D1D9",fontSize:"12px",outline:"none",cursor:"pointer",fontFamily:"inherit" }}>
            <option value="todos">Todos los profesionales</option>
            {profList.map(([id,p])=><option key={id} value={id}>{p.nombre}</option>)}
          </select>
        )}
        <Btn small onClick={onNuevo}>+ Nuevo turno</Btn>
      </div>
      {lista.length===0 ? (
        <div style={{ textAlign:"center",padding:"50px",color:"#484F58" }}>
          <div style={{ fontSize:"40px",marginBottom:"10px" }}>📋</div>
          <p style={{ fontWeight:"700",fontSize:"16px" }}>Sin turnos</p>
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
          {lista.map((t,i) => {
            const p = profesionales[t.profesionalId];
            const est = EST_COLOR[t.estado];
            return (
              <div key={t.id} onClick={()=>onVer(t)} style={{ background:"#0D1117",border:"1px solid #21262D",borderRadius:"12px",padding:"13px 16px",display:"flex",alignItems:"center",gap:"12px",animation:`si .18s ease ${i*.03}s both`,transition:"border-color .15s,transform .12s",cursor:"pointer" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#30363D";e.currentTarget.style.transform="translateY(-1px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#21262D";e.currentTarget.style.transform="translateY(0)";}}>
                <div style={{ width:"40px",height:"40px",flexShrink:0,borderRadius:"50%",background:`linear-gradient(135deg,${p?.color||"#6366F1"},#7C3AED)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",fontWeight:"800",color:"#fff" }}>{t.cliente?.charAt(0)}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap" }}>
                    <span style={{ fontWeight:"700",color:"#E6EDF3",fontSize:"14px" }}>{t.cliente}</span>
                    <span style={{ background:est.bg,border:`1px solid ${est.border}`,color:est.text,borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontWeight:"700",display:"inline-flex",alignItems:"center",gap:"4px" }}>
                      <span style={{ width:"6px",height:"6px",borderRadius:"50%",background:est.dot,display:"inline-block" }} />{t.estado?.charAt(0).toUpperCase()+t.estado?.slice(1)}
                    </span>
                  </div>
                  <div style={{ display:"flex",gap:"10px",marginTop:"4px",flexWrap:"wrap" }}>
                    <span style={{ color:"#6E7681",fontSize:"12px" }}>📅 {fmt(t.fecha)}</span>
                    <span style={{ color:"#6E7681",fontSize:"12px" }}>🕐 {t.hora}hs</span>
                    {t.servicio && <span style={{ color:"#6E7681",fontSize:"12px" }}>💼 {t.servicio}</span>}
                    {esAdmin && p && <span style={{ color:p.color,fontSize:"12px",fontWeight:"600" }}>👤 {p.nombre}</span>}
                  </div>
                </div>
                <a href={`https://wa.me/${t.telefono}?text=${waMsg(t,p)}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                  style={{ background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",borderRadius:"8px",padding:"7px 11px",display:"flex",alignItems:"center",gap:"4px",textDecoration:"none",fontWeight:"700",fontSize:"12px",flexShrink:0 }}>
                  <WAIcon /> WA
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PANEL PROFESIONALES ──────────────────────────────────────────────────────
function PanelProfesionales({ profesionales, turnos, onAgregar, onEditar, onEliminar }) {
  const turnosArr = Object.entries(turnos).map(([id,t])=>({id,...t}));
  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px" }}>
        <h3 style={{ margin:0,color:"#E6EDF3",fontSize:"16px",fontWeight:"700" }}>Profesionales del equipo</h3>
        <Btn small onClick={onAgregar}>+ Agregar profesional</Btn>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:"12px" }}>
        {Object.entries(profesionales).filter(([,p])=>p.rol==="profesional").map(([id,p])=>{
          const qty = turnosArr.filter(t=>t.profesionalId===id).length;
          const conf = turnosArr.filter(t=>t.profesionalId===id&&t.estado==="confirmado").length;
          return (
            <div key={id} style={{ background:"#0D1117",border:"1px solid #21262D",borderRadius:"16px",overflow:"hidden",transition:"transform .15s,border-color .15s" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=p.color;e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="#21262D";e.currentTarget.style.transform="translateY(0)";}}>
              <div style={{ height:"5px",background:p.color }} />
              <div style={{ padding:"16px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px" }}>
                  <div style={{ width:"42px",height:"42px",borderRadius:"50%",background:p.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"17px",fontWeight:"800",color:"#fff",flexShrink:0 }}>{p.nombre.charAt(0)}</div>
                  <div>
                    <div style={{ fontWeight:"700",color:"#E6EDF3",fontSize:"14px" }}>{p.nombre}</div>
                    <div style={{ color:"#6E7681",fontSize:"12px" }}>{p.especialidad}</div>
                  </div>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"12px" }}>
                  {[["Turnos",qty,"#C9D1D9"],["Confirmados",conf,"#6EE7B7"]].map(([l,v,c])=>(
                    <div key={l} style={{ background:"#161B22",borderRadius:"8px",padding:"8px",textAlign:"center" }}>
                      <div style={{ fontSize:"18px",fontWeight:"800",color:c }}>{v}</div>
                      <div style={{ fontSize:"10px",color:"#6E7681" }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom:"12px" }}>
                  <div style={{ fontSize:"10px",color:"#6E7681",textTransform:"uppercase",marginBottom:"5px",fontWeight:"700" }}>Horarios</div>
                  <div style={{ display:"flex",gap:"3px",flexWrap:"wrap" }}>
                    {["lun","mar","mie","jue","vie","sab","dom"].map(dia=>{
                      const act = p.horario?.[dia]?.length>0;
                      return <span key={dia} style={{ background:act?p.color+"33":"#161B22",color:act?p.color:"#484F58",border:`1px solid ${act?p.color:"#21262D"}`,borderRadius:"6px",padding:"2px 5px",fontSize:"10px",fontWeight:"700" }}>{DIAS_LABEL[dia]}</span>;
                    })}
                  </div>
                </div>
                <div style={{ background:"#161B22",borderRadius:"8px",padding:"8px",marginBottom:"12px" }}>
                  <div style={{ fontSize:"10px",color:"#6E7681",marginBottom:"3px" }}>🔑 Clave</div>
                  <div style={{ fontSize:"13px",fontWeight:"700",color:"#C9D1D9",fontFamily:"monospace",letterSpacing:"1px" }}>{p.clave}</div>
                </div>
                <div style={{ display:"flex",gap:"6px" }}>
                  <Btn small variant="ghost" onClick={()=>onEditar({id,...p})} style={{ flex:1,justifyContent:"center" }}>✏️ Editar</Btn>
                  <Btn small variant="danger" onClick={()=>onEliminar(id)}>🗑️</Btn>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [profesionales, setProfesionales] = useState({});
  const [turnos, setTurnos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [tab, setTab] = useState("calendario");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [notifPermiso, setNotifPermiso] = useState(false);
  const [mostrarBanner, setMostrarBanner] = useState(false);
  const turnosRef = useRef({});
  const inicializado = useRef(false);
  const toastId = useRef(0);

  const addToast = (msg, tipo="ok") => {
    const id = ++toastId.current;
    setToasts(p => [...p, {id,msg,tipo}]);
    setTimeout(() => setToasts(p => p.filter(t=>t.id!==id)), 3500);
  };

  // ── Inicializar Firebase ──
  useEffect(() => {
    let unsubProfs, unsubTurnos;

    const init = async () => {
      const profs = await fb.get("profesionales");
      if (!profs) {
        await fb.set("profesionales", INIT_PROFESIONALES);
        await fb.set("turnos", INIT_TURNOS);
      }
      setCargando(false);
    };
    init();

    unsubProfs = fb.listen("profesionales", data => {
      if (data) setProfesionales(data);
    });

    unsubTurnos = fb.listen("turnos", data => {
      const nuevo = data || {};

      // Detectar cambios para notificaciones (solo después de la carga inicial)
      if (inicializado.current) {
        const anterior = turnosRef.current;

        // Turno nuevo
        Object.entries(nuevo).forEach(([id, t]) => {
          if (!anterior[id]) {
            Notif.enviar("📅 Nuevo turno", `${t.cliente} · ${fmt(t.fecha)} ${t.hora}hs`, "📅");
            addToast(`Nuevo turno: ${t.cliente}`, "ok");
          }
        });

        // Turno modificado
        Object.entries(nuevo).forEach(([id, t]) => {
          if (anterior[id] && JSON.stringify(anterior[id]) !== JSON.stringify(t)) {
            if (anterior[id].estado !== t.estado) {
              const iconos = { confirmado:"✅", cancelado:"❌", pendiente:"⏳" };
              Notif.enviar(`${iconos[t.estado]||"✏️"} Turno ${t.estado}`, `${t.cliente} · ${fmt(t.fecha)} ${t.hora}hs`);
              addToast(`Turno ${t.estado}: ${t.cliente}`, t.estado==="cancelado"?"err":t.estado==="confirmado"?"ok":"info");
            } else {
              Notif.enviar("✏️ Turno modificado", `${t.cliente} · ${fmt(t.fecha)} ${t.hora}hs`);
              addToast(`Turno editado: ${t.cliente}`, "info");
            }
          }
        });

        // Turno eliminado
        Object.entries(anterior).forEach(([id, t]) => {
          if (!nuevo[id]) {
            Notif.enviar("🗑️ Turno eliminado", `${t.cliente} · ${fmt(t.fecha)} ${t.hora}hs`);
            addToast(`Turno eliminado: ${t.cliente}`, "err");
          }
        });
      } else {
        inicializado.current = true;
      }

      turnosRef.current = nuevo;
      setTurnos(nuevo);
    });

    return () => {
      if (unsubProfs) unsubProfs();
      if (unsubTurnos) unsubTurnos();
    };
  }, []);

  // ── Pedir permiso de notificaciones al loguearse ──
  useEffect(() => {
    if (!usuario) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      setNotifPermiso(true);
    } else if (Notification.permission !== "denied") {
      setMostrarBanner(true);
    }
  }, [usuario]);

  const activarNotificaciones = async () => {
    const ok = await Notif.pedir();
    setNotifPermiso(ok);
    setMostrarBanner(false);
    if (ok) addToast("🔔 Notificaciones activadas", "ok");
    else addToast("Notificaciones bloqueadas por el navegador", "warn");
  };

  const esAdmin = usuario?.rol === "admin";

  // ── TURNOS ──
  const guardarTurno = async (data) => {
    setSaving(true);
    try {
      if (data.id) {
        const { id, ...rest } = data;
        await fb.set(`turnos/${id}`, rest);
      } else {
        await fb.push("turnos", data);
      }
      setModal(null);
    } catch { addToast("Error al guardar", "err"); }
    setSaving(false);
  };

  const eliminarTurno = async (id) => {
    if (!confirm("¿Eliminar este turno?")) return;
    await fb.delete(`turnos/${id}`);
  };

  // ── PROFESIONALES ──
  const guardarProf = async (data) => {
    setSaving(true);
    try {
      if (data.id) {
        const { id, ...rest } = data;
        await fb.set(`profesionales/${id}`, rest);
        if (usuario?.id === id) setUsuario({ id, ...rest });
      } else {
        await fb.push("profesionales", data);
      }
      setModal(null);
      addToast("Profesional guardado ✓", "ok");
    } catch { addToast("Error al guardar", "err"); }
    setSaving(false);
  };

  const eliminarProf = async (id) => {
    if (!confirm("¿Eliminar profesional y sus turnos?")) return;
    await fb.delete(`profesionales/${id}`);
    const entries = Object.entries(turnos).filter(([,t])=>t.profesionalId===id);
    for (const [tid] of entries) await fb.delete(`turnos/${tid}`);
  };

  // ── RENDER ──
  if (cargando) return (
    <div style={{ minHeight:"100vh",background:"#010409",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Outfit',sans-serif" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      <div style={{ width:"64px",height:"64px",borderRadius:"18px",background:"linear-gradient(135deg,#2563EB,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"28px",marginBottom:"20px",animation:"pulse 1.5s ease infinite" }}>📅</div>
      <p style={{ color:"#6E7681",fontSize:"15px" }}>Conectando con Firebase...</p>
    </div>
  );

  if (!usuario) return <Login profesionales={profesionales} onLogin={p => setUsuario(p)} />;

  const todayStr = new Date().toISOString().slice(0,10);
  const turnosArr = Object.entries(turnos).map(([id,t])=>({id,...t}));
  const todayCount = turnosArr.filter(t => t.fecha===todayStr && (esAdmin||t.profesionalId===usuario.id)).length;
  const pendientesCount = turnosArr.filter(t => t.estado==="pendiente" && (esAdmin||t.profesionalId===usuario.id)).length;

  const TABS = esAdmin
    ? [["calendario","📅","Calendario"],["turnos","📋","Turnos"],["profesionales","👥","Profesionales"]]
    : [["calendario","📅","Calendario"],["turnos","📋","Mis Turnos"]];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Outfit:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#010409;}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        @keyframes su{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes si{from{transform:translateX(-10px);opacity:0}to{transform:translateX(0);opacity:1}}
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator{filter:invert(.5);}
        select option{background:#161B22;}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#0D1117}
        ::-webkit-scrollbar-thumb{background:#21262D;border-radius:3px}
      `}</style>

      <div style={{ minHeight:"100vh",background:"#010409",color:"#E6EDF3",display:"flex",flexDirection:"column",fontFamily:"'Outfit',sans-serif" }}>
        {/* Top bar */}
        <div style={{ background:"#0D1117",borderBottom:"1px solid #21262D",padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:"54px",flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
            <span style={{ fontSize:"20px" }}>📅</span>
            <span style={{ fontFamily:"'Playfair Display',serif",fontSize:"17px",fontWeight:"700",color:"#E6EDF3" }}>TurnosPro</span>
            <span style={{ background:"#0A2A0A",color:"#6EE7B7",fontSize:"10px",fontWeight:"700",padding:"2px 8px",borderRadius:"10px",border:"1px solid #065F46",marginLeft:"4px" }}>● EN VIVO</span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
            {/* Indicador notificaciones */}
            <button onClick={notifPermiso ? null : activarNotificaciones}
              title={notifPermiso ? "Notificaciones activas" : "Activar notificaciones"}
              style={{ background:notifPermiso?"#0A2A0A":"#2D1F00",border:`1px solid ${notifPermiso?"#065F46":"#92400E"}`,borderRadius:"8px",padding:"6px 10px",cursor:notifPermiso?"default":"pointer",fontSize:"14px",color:notifPermiso?"#6EE7B7":"#FCD34D" }}>
              {notifPermiso ? "🔔" : "🔕"}
            </button>
            <div style={{ display:"flex",alignItems:"center",gap:"8px",background:"#161B22",border:"1px solid #21262D",borderRadius:"10px",padding:"6px 12px" }}>
              <div style={{ width:"26px",height:"26px",borderRadius:"50%",background:usuario.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:"800",color:"#fff" }}>{usuario.nombre.charAt(0)}</div>
              <span style={{ fontSize:"13px",fontWeight:"600",color:"#C9D1D9" }}>{usuario.nombre}</span>
              {esAdmin && <span style={{ background:"#1C2D4F",color:"#60A5FA",fontSize:"10px",fontWeight:"700",padding:"2px 7px",borderRadius:"10px",border:"1px solid #2563EB" }}>ADMIN</span>}
            </div>
            <Btn small variant="ghost" onClick={()=>setUsuario(null)}>Salir</Btn>
          </div>
        </div>

        <div style={{ display:"flex",flex:1,overflow:"hidden" }}>
          {/* Sidebar */}
          <div style={{ width:"200px",flexShrink:0,background:"#0D1117",borderRight:"1px solid #21262D",padding:"14px 10px",display:"flex",flexDirection:"column",gap:"3px" }}>
            {TABS.map(([id,ic,lb])=>(
              <button key={id} onClick={()=>setTab(id)} style={{ background:tab===id?"#161B22":"transparent",border:`1px solid ${tab===id?"#21262D":"transparent"}`,borderRadius:"10px",padding:"10px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",color:tab===id?"#E6EDF3":"#6E7681",fontFamily:"inherit",fontWeight:tab===id?"700":"500",fontSize:"13px",textAlign:"left",transition:"all .15s" }}>
                {ic} {lb}
              </button>
            ))}
            <div style={{ flex:1 }} />
            <div style={{ background:"#161B22",border:"1px solid #21262D",borderRadius:"12px",padding:"12px" }}>
              <div style={{ fontSize:"10px",color:"#6E7681",textTransform:"uppercase",fontWeight:"700",marginBottom:"8px" }}>Hoy</div>
              {[["Turnos",todayCount,"#60A5FA"],["Pendientes",pendientesCount,"#FCD34D"]].map(([l,v,c])=>(
                <div key={l} style={{ display:"flex",justifyContent:"space-between",marginBottom:"5px" }}>
                  <span style={{ fontSize:"12px",color:"#8B949E" }}>{l}</span>
                  <span style={{ fontSize:"13px",fontWeight:"800",color:c }}>{v}</span>
                </div>
              ))}
            </div>
            <Btn small style={{ justifyContent:"center",marginTop:"4px" }} onClick={()=>setModal({tipo:"turno",data:{profesionalId:esAdmin?"":usuario.id}})}>+ Nuevo turno</Btn>
          </div>

          {/* Main */}
          <div style={{ flex:1,overflowY:"auto",padding:"18px 20px" }}>
            {/* Banner notificaciones */}
            {mostrarBanner && (
              <NotifBanner onAceptar={activarNotificaciones} onIgnorar={()=>setMostrarBanner(false)} />
            )}

            {tab==="calendario" && (
              <Calendario turnos={turnos} profesionales={profesionales} usuarioActual={usuario}
                onClickTurno={t=>setModal({tipo:"ficha",data:t})}
                onNuevoTurno={(fecha,hora)=>setModal({tipo:"turno",data:{fecha,hora,estado:"pendiente",profesionalId:esAdmin?"":usuario.id}})}
              />
            )}
            {tab==="turnos" && (
              <ListaTurnos turnos={turnos} profesionales={profesionales} usuarioActual={usuario}
                onVer={t=>setModal({tipo:"ficha",data:t})}
                onNuevo={()=>setModal({tipo:"turno",data:{profesionalId:esAdmin?"":usuario.id}})}
              />
            )}
            {tab==="profesionales" && esAdmin && (
              <PanelProfesionales profesionales={profesionales} turnos={turnos}
                onAgregar={()=>setModal({tipo:"prof",data:null})}
                onEditar={p=>setModal({tipo:"prof",data:p})}
                onEliminar={eliminarProf}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modales */}
      {modal?.tipo==="ficha" && (
        <FichaTurno turno={modal.data} profesionales={profesionales} onClose={()=>setModal(null)}
          onEdit={t=>setModal({tipo:"turno",data:t})}
          onDelete={id=>{eliminarTurno(id);setModal(null);}} />
      )}
      {modal?.tipo==="turno" && (
        <FormTurno initial={modal.data} profesionales={profesionales} usuarioId={usuario.id} esAdmin={esAdmin}
          onSave={guardarTurno} onClose={()=>setModal(null)} saving={saving} />
      )}
      {modal?.tipo==="prof" && (
        <FormProfesional initial={modal.data} onSave={guardarProf} onClose={()=>setModal(null)} saving={saving} />
      )}

      <Toast items={toasts} />
    </>
  );
}

