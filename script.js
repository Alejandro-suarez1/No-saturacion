// ════════════════════════════════════════════════════
// CONSTANTES
// ════════════════════════════════════════════════════
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const COL = ['#00d4ff','#7b61ff','#ff6b35'];

// TABLA DE PRIORIDADES DEL EXCEL (estado base × ciclo)
const PRIORIDAD = [
  {eb:'IDEAL',       ciclo:'EXPLOSION',    rank:1,  dec:'ENTRY',   cls:'entry',   ico:'🔥', forBES:'R1 · ENTRAR INMEDIATO'},
  {eb:'IDEAL',       ciclo:'CRECIENTE',    rank:2,  dec:'ENTRY',   cls:'entry',   ico:'🔥', forBES:'R1 · ENTRAR'},
  {eb:'SANA',        ciclo:'EXPLOSION',    rank:3,  dec:'ENTRY',   cls:'entry',   ico:'✅', forBES:'R2 · ENTRAR'},
  {eb:'IDEAL',       ciclo:'REACTIVACION', rank:4,  dec:'ENTRY',   cls:'entry',   ico:'✅', forBES:'R2 · ENTRAR'},
  {eb:'SANA',        ciclo:'CRECIENTE',    rank:5,  dec:'ENTRY',   cls:'entry',   ico:'✅', forBES:'R2 · ENTRAR'},
  {eb:'SANA',        ciclo:'REACTIVACION', rank:6,  dec:'ENTRY',   cls:'entry',   ico:'✅', forBES:'R2 · ENTRAR'},
  {eb:'IDEAL',       ciclo:'ESTABLE',      rank:7,  dec:'ENTRY',   cls:'entry',   ico:'✅', forBES:'R2 · ENTRAR'},
  {eb:'SANA',        ciclo:'ESTABLE',      rank:8,  dec:'ESPERAR', cls:'esperar', ico:'⏳', forBES:'R3 · ESPERAR'},
  {eb:'ADVERTENCIA', ciclo:'CRECIENTE',    rank:9,  dec:'ESPERAR', cls:'esperar', ico:'⏳', forBES:'R3 · ESPERAR'},
  {eb:'ADVERTENCIA', ciclo:'REACTIVACION', rank:10, dec:'ESPERAR', cls:'esperar', ico:'⏳', forBES:'R3 · ESPERAR'},
];

const ECOL = {IDEAL:'var(--green)',SANA:'var(--c1)',ADVERTENCIA:'var(--gold)',PELIGRO:'var(--red)'};
const CICO = {EXPLOSION:'🔥',CRECIENTE:'⚡',REACTIVACION:'↺',ESTABLE:'→',DECRECIENTE:'↘',PELIGROSO:'⚠','SIN DATOS':'—',NORMAL:'→'};

// ════════════════════════════════════════════════════
// ESTADO GLOBAL
// ════════════════════════════════════════════════════
let T = [];       // tiradas
let HIST = [];    // historial
let charts = {};
let curPage = 'senal';
let modoJuego = '2docenas'; // '1docena' | '2docenas' | 'sesion'
// Estado modo sesión
let sesionActiva = false;    // hay sesión en curso
let sesionDocena = null;     // docena de la sesión activa
let sesionTiros = 0;         // tiros jugados en la sesión actual
let sesionGanadas = 0;
let sesionPerdidas = 0;
let rachaSessionesPerd = 0;
const MAX_TIROS_SESION = 3;
const PAUSA_TRAS_2_SESIONES = 10;

// ════════════════════════════════════════════════════
// CÁLCULO BASE
// ════════════════════════════════════════════════════
function doc(n){ return n===0?0:n<=12?1:n<=24?2:3 }
function fDoc(arr){ const f=[0,0,0]; arr.forEach(n=>{const x=doc(n);if(x>0)f[x-1]++;}); return f; }

function calc(){
  const n=T.length; if(!n) return null;
  const t50=T.slice(-50), t30=T.slice(-30), t20=T.slice(-20), t10=T.slice(-10), t5=T.slice(-5);
  const f50=fDoc(t50), f30=fDoc(t30), f20=fDoc(t20), f10=fDoc(t10), f5=fDoc(t5);
  const v50=t50.filter(x=>x>0).length||1, v30=t30.filter(x=>x>0).length||1,
        v20=t20.filter(x=>x>0).length||1, v10=t10.filter(x=>x>0).length||1;
  const p50=f50.map(x=>x/v50), p30=f30.map(x=>x/v30),
        p20=f20.map(x=>x/v20), p10=f10.map(x=>x/v10);
  // ranking por frecuencia 50T
  const rank=[0,1,2].sort((a,b)=>f50[b]-f50[a]);
  const [iA,iM,iB]=rank;
  const sumaAM=p50[iA]+p50[iM];
  const aus50=[v50-f50[0],v50-f50[1],v50-f50[2]];
  const nf={}; T.forEach(x=>nf[x]=(nf[x]||0)+1);
  const topN=Object.entries(nf).sort((a,b)=>b[1]-a[1]).slice(0,7);
  const ciclos=[0,1,2].map(i=>calcCiclo(i));
  const nivel=n<5?0:n<10?1:n<20?2:n<30?3:4;
  return{n,nivel,iA,iM,iB,rank,
    f50,f30,f20,f10,f5,p50,p30,p20,p10,
    v50,v30,v20,v10,
    sumaAM, aus50, nf, topN, ciclos,
    difAM50:f50[iA]-f50[iM], difAB50:f50[iA]-f50[iB], difMB50:f50[iM]-f50[iB],
    difAM30:f30[iA]-f30[iM], difAB30:f30[iA]-f30[iB], difMB30:f30[iM]-f30[iB],
    difAM20:f20[iA]-f20[iM], difAB20:f20[iA]-f20[iB], difMB20:f20[iM]-f20[iB],
  };
}

function calcCiclo(di){
  const arr=T.filter(x=>x>0).slice(-30);
  if(arr.length<6) return{c1:0,c2:0,c3:0,estado:'SIN DATOS',fBES:'ESPERAR',fc:'r3'};
  const sz=Math.floor(arr.length/3);
  const c1=arr.slice(0,sz).filter(x=>doc(x)===di+1).length;
  const c2=arr.slice(sz,sz*2).filter(x=>doc(x)===di+1).length;
  const c3=arr.slice(sz*2).filter(x=>doc(x)===di+1).length;
  let estado,fBES,fc;
  if(c3>c1+c2&&c3>0)                   {estado='EXPLOSION';   fBES='🔥 R1 · ENTRAR INMEDIATO'; fc='r1';}
  else if(c1<c2&&c2<=c3&&c3>0)         {estado='CRECIENTE';   fBES='⚡ R2 · ENTRAR';             fc='r2';}
  else if(c1>=c2+c3&&c1>1)            {estado='PELIGROSO';   fBES='❌ NO ENTRAR';              fc='no';}
  else if(c1>c2&&c3>c2&&c3>0)         {estado='REACTIVACION';fBES='⚡ R2 · ENTRAR';             fc='r2';}
  else if(Math.abs(c1-c2)<=1&&Math.abs(c2-c3)<=1&&(c1+c2+c3)>0)
                                        {estado='ESTABLE';     fBES='⚡ R2 · ENTRAR';             fc='r2';}
  else if(c1>=c2&&c2>=c3&&c1>c3)      {estado='DECRECIENTE'; fBES='⏳ R3 · ESPERAR';           fc='r3';}
  else                                  {estado='NORMAL';      fBES='⏳ R3 · ESPERAR';           fc='r3';}
  return{c1,c2,c3,estado,fBES,fc};
}

// ════════════════════════════════════════════════════
// ESTADO BASE DE DOCENA (IDEAL / SANA / ADVERTENCIA / PELIGRO)
// Usando porcentaje REAL normalizado a 50T
// ════════════════════════════════════════════════════
function estadoBase(b, di){
  if(!b || b.v50 === 0) return 'SIN DATOS';
  const pct = b.p50[di]; // porcentaje real de aparición (0-1)

  // AUSENCIA REAL = tiros consecutivos desde el ÚLTIMO impacto hasta ahora
  // (no el total de tiros sin aparecer en la ventana)
  const recents = T.filter(x=>x>0).slice(-50);
  let ausConsec = 0;
  for(let i = recents.length-1; i >= 0; i--){
    if(doc(recents[i]) === di+1) break;
    ausConsec++;
  }

  // PELIGRO: saturada (>44%) o desaparecida (<10%)
  if(pct > 0.44) return 'PELIGRO';
  if(pct < 0.10) return 'PELIGRO';

  // IDEAL: porcentaje 20-34% Y ausencia consecutiva baja (0-4)
  if(pct >= 0.20 && pct <= 0.34 && ausConsec <= 4) return 'IDEAL';

  // SANA: porcentaje 18-42% Y ausencia consecutiva moderada (0-12)
  if(pct >= 0.18 && pct <= 0.42 && ausConsec <= 12) return 'SANA';

  // ADVERTENCIA: porcentaje en rango pero ausencia larga
  if(pct >= 0.15 && pct <= 0.44) return 'ADVERTENCIA';

  return 'PELIGRO';
}

function mapCiclo(estado){
  const m={EXPLOSION:'EXPLOSION',CRECIENTE:'CRECIENTE',REACTIVACION:'REACTIVACION',
    ESTABLE:'ESTABLE',DECRECIENTE:'DECRECIENTE',PELIGROSO:'PELIGROSO',
    NORMAL:'ESTABLE','SIN DATOS':'DECRECIENTE'};
  return m[estado]||'DECRECIENTE';
}

// ════════════════════════════════════════════════════
// DECISIÓN PRINCIPAL — SISTEMA v3 VALIDADO
// Tests: 10.000 tiradas simuladas · MaxRacha=2 · WR≈31-36%
// ════════════════════════════════════════════════════

// Pausa adaptativa global (tiros a esperar tras pérdidas seguidas)
let pausaRestante = 0;
let rachaPerdidasActual = 0;

// Posición de impactos en últimas 5 tiradas
// Ideal: impacto en posiciones 2-4 (ni el más viejo ni sobrecargado al final)
function posicionF5(di){
  const ult5 = T.filter(x=>x>0).slice(-5);
  const hits = ult5.map((x,i)=>doc(x)===di+1?i:-1).filter(i=>i>=0);
  if(!hits.length) return {count:0, posOk:false};
  const tieneViejo = hits.includes(0);
  const tieneMedio = hits.some(h=>h>=1&&h<=3);
  return {count:hits.length, posOk: tieneMedio && !tieneViejo};
}

function decision(b){
  const empty={dec:'SIN DATOS',cls:'nd',ico:'◈',sub:'Ingresa números para comenzar',
    reasons:[],tablaScore:null,recD1:null,recD2:null,evitD:null,combo:'—',forBES:'—',
    globalScore:0, filtroRazon:null};
  if(!b||b.nivel===0) return empty;

  // ── Datos auxiliares ──
  const f10=[0,1,2].map(i=>{
    const a=T.filter(x=>x>0).slice(-10);
    return a.filter(x=>doc(x)===i+1).length;
  });

  // ── Evaluar cada docena ──
  const evals=[0,1,2].map(di=>{
    const eb  = estadoBase(b, di);
    const ci  = b.ciclos[di];
    const cicloN = mapCiclo(ci.estado);
    const combo = PRIORIDAD.find(p=>p.eb===eb&&p.ciclo===cicloN)||null;
    const rank  = combo?combo.rank:99;
    const f5info = posicionF5(di);
    return {di, eb, ci, cicloN, combo, rank,
      pct:b.p50[di], f10:f10[di], f5:f5info.count, f5ok:f5info.posOk};
  });

  evals.sort((a,z)=>a.rank-z.rank);
  const best=evals[0], second=evals[1], worst=evals[2];

  // ── Combinación de ciclos activa ──
  function combActiva(ci){
    const {c1,c2,c3}=ci;
    if(c1>0&&c2>0&&c3>0) return 'C1+C2+C3';
    if(c1>0&&c2>0)        return 'C1+C2';
    if(c2>0&&c3>0)        return 'C2+C3';
    return '—';
  }

  const tablaScore=evals.map(e=>({
    di:e.di, eb:e.eb, cicloN:e.cicloN, cicloRaw:e.ci.estado,
    rank:e.rank===99?'—':e.rank,
    dec:e.combo?e.combo.dec:'NO ENTRY',
    decCls:e.combo?e.combo.cls:'noentry',
    pct:e.pct, f10:e.f10, f5:e.f5,
    c1:e.ci.c1, c2:e.ci.c2, c3:e.ci.c3,
    combActiva:combActiva(e.ci),
    fBES:e.ci.fBES,
  }));

  // ── Aplicar filtros al mejor candidato ──
  const di = best.di;
  let dec,cls,ico,forBES,combo,filtroRazon=null;

  // Sin combo válida
  if(!best.combo || best.rank>7){
    dec='ESPERAR'; cls='esperar'; ico='⏳';
    forBES='Sin combinación de prioridad válida';
    combo=`${best.eb}+${best.ci.estado}`;
    filtroRazon='Sin combo válida (rank>7)';
  }
  // Pausa activa tras pérdidas seguidas
  else if(pausaRestante>0){
    dec='ESPERAR'; cls='esperar'; ico='⏳';
    forBES=`Pausa ${pausaRestante} tiro(s) · Protección racha`;
    combo=`${best.eb}+${best.ci.estado}`;
    filtroRazon=`Pausa activa (${pausaRestante}T)`;
  }
  // FILTRO 1: F10 momentum — debe tener 2-4 hits en últimas 10
  else if(best.f10<2){
    dec='ESPERAR'; cls='esperar'; ico='⏳';
    forBES='F10 insuficiente · Sin momentum'; filtroRazon=`F10=${best.f10}<2`;
    combo=`${best.eb}+${best.ci.estado}`;
  }
  else if(best.f10>4){
    dec='ESPERAR'; cls='esperar'; ico='⏳';
    forBES='F10 excesivo · Docena sobrecalentada'; filtroRazon=`F10=${best.f10}>4`;
    combo=`${best.eb}+${best.ci.estado}`;
  }
  // FILTRO 2: F5 presencia — debe tener al menos 1 en últimas 5
  else if(best.f5===0){
    dec='ESPERAR'; cls='esperar'; ico='⏳';
    forBES='Ausente en últimas 5 tiradas'; filtroRazon='F5=0';
    combo=`${best.eb}+${best.ci.estado}`;
  }
  else if(best.f5>3){
    dec='ESPERAR'; cls='esperar'; ico='⏳';
    forBES='F5 excesivo · Sobrecalentada corta'; filtroRazon=`F5=${best.f5}>3`;
    combo=`${best.eb}+${best.ci.estado}`;
  }
  // FILTRO 3: Ciclo válido
  else if(['PELIGROSO','DECRECIENTE'].includes(best.ci.estado)){
    dec='ESPERAR'; cls='esperar'; ico='⏳';
    forBES=`Ciclo ${best.ci.estado} · No favorable`; filtroRazon=`Ciclo ${best.ci.estado}`;
    combo=`${best.eb}+${best.ci.estado}`;
  }
  // FILTRO 4: Rank 7 (IDEAL+ESTABLE) más estricto
  else if(best.rank===7 && (best.f10<3||!best.f5ok)){
    dec='ESPERAR'; cls='esperar'; ico='⏳';
    forBES='ESTABLE requiere F10≥3 y posición F5 ideal'; filtroRazon='ESTABLE strict';
    combo=`${best.eb}+${best.ci.estado}`;
  }
  // ✅ TODOS LOS FILTROS PASADOS → ENTRY
  else{
    const mainCombo=best.combo;
    dec=mainCombo.dec; cls=mainCombo.cls; ico=mainCombo.ico; forBES=mainCombo.forBES;
    combo=`${best.eb}+${best.ci.estado}`;
  }

  const recD1 = best.di+1;
  const recD2 = modoJuego==='2docenas' ? second.di+1 : null;
  const evitD = modoJuego==='2docenas' ? worst.di+1 : null;

  // Si no es ENTRY, en modo 2 docenas también reportar
  if(dec!=='ENTRY'){
    // En modo 2 docenas, si la segunda docena pasa los filtros, intentar con ella
    if(modoJuego==='2docenas' && second.combo && second.rank<=7){
      const di2=second.di;
      const f2ok = second.f10>=2&&second.f10<=4&&second.f5>=1&&second.f5<=3;
      const ci2ok = !['PELIGROSO','DECRECIENTE'].includes(second.ci.estado);
      if(f2ok&&ci2ok&&pausaRestante===0){
        dec=second.combo.dec; cls=second.combo.cls;
        ico=second.combo.ico; forBES=second.combo.forBES+' (D2)';
        combo=`${second.eb}+${second.ci.estado}`;
        filtroRazon=`Principal bloqueada, D${di2+1} activa`;
      }
    }
  }

  const reasons=evals.map(e=>{
    const ok=e.rank<=5?true:e.rank<=8?null:false;
    return{t:`D${e.di+1}: ${e.eb} + ${e.ci.estado} → ${e.combo?e.combo.dec:'NO ENTRY'} (#${e.rank===99?'—':e.rank}) · F10:${e.f10} F5:${e.f5}`,ok};
  });
  if(filtroRazon) reasons.push({t:`⚠ Filtro: ${filtroRazon}`,ok:false});

  const sub=filtroRazon&&dec!=='ENTRY'
    ? `${filtroRazon} · D${recD1} espera`
    : `${combo} · #${best.combo?best.rank:'—'} · ${forBES}`;

  return{dec,cls,ico,sub,reasons,tablaScore,
    recD1,recD2,evitD,combo,forBES,globalScore:best.combo?(11-best.rank):0,filtroRazon};
}

// Actualizar pausa cuando se registra resultado en historial
function actualizarPausa(resultado){
  if(resultado==='ganado'){ rachaPerdidasActual=0; pausaRestante=Math.max(0,pausaRestante-1); }
  else if(resultado==='perdido'){
    rachaPerdidasActual++;
    if(rachaPerdidasActual>=3) pausaRestante=3;
    else if(rachaPerdidasActual>=2) pausaRestante=2;
  } else { pausaRestante=Math.max(0,pausaRestante-1); }
}

// ════════════════════════════════════════════════════
// SEÑALES HELPERS
// ════════════════════════════════════════════════════
function sDif(v){return v<=5?{t:'ÓPTIMA',c:'optima'}:v<=8?{t:'MEDIA',c:'media'}:{t:'SATURACIÓN',c:'sat'}}
function sAus(a){return a<=2?{t:'OK',c:'entry'}:a<=5?{t:'ESP 3-5',c:'esperar'}:a<=8?{t:'ESP 6-8',c:'esperar'}:{t:'CRÍTICA',c:'noentry'}}
function sPct(p){return p>=0.20&&p<=0.34?{t:'ENTRY',c:'entry'}:p>0.34&&p<=0.42?{t:'CUIDADO',c:'esperar'}:{t:'NO ENTRY',c:'noentry'}}
function sig(s){return`<span class="sig ${s.c}">${s.t}</span>`}
function eCls(e){return{EXPLOSION:'entry',CRECIENTE:'entry',REACTIVACION:'esperar',ESTABLE:'esperar',DECRECIENTE:'noentry',PELIGROSO:'noentry',NORMAL:'nd','SIN DATOS':'nd'}[e]||'nd'}

// ════════════════════════════════════════════════════
// RENDER ALL
// ════════════════════════════════════════════════════
function renderAll(){
  const b=calc();
  // Strip
  const st=document.getElementById('strip');
  if(!T.length) st.innerHTML='<span class="strip-empty">Ingresa los números de la ruleta...</span>';
  else{ st.innerHTML=T.map((n,i)=>`<div class="tc ${n===0?'z':RED.has(n)?'r':'b'}${i===T.length-1?' new':''}" title="#${i+1}">${n}</div>`).join(''); st.scrollLeft=9999; }
  // Counts
  document.getElementById('cnt').textContent=`${T.length} tiradas`;
  document.getElementById('sbcnt').textContent=`${T.length} tiradas`;
  // Badges
  const dg=b?decision(b):{dec:'—',cls:'nd'};
  const bs=document.getElementById('badge-senal');
  bs.textContent=dg.dec; bs.className='ni-badge '+dg.cls;
  // Desbalance badge
  if(b){ const db=calcDesbalance(b); const bd=document.getElementById('badge-desb');
    bd.textContent=db.dec; bd.className='ni-badge '+db.cls; }
  // Historial badge
  const gan=HIST.filter(h=>h.resultado==='ganado').length;
  const per=HIST.filter(h=>h.resultado==='perdido').length;
  const bh=document.getElementById('badge-hist');
  bh.textContent=HIST.length?`${gan}G/${per}P`:'0';
  bh.className='ni-badge '+(gan>per?'entry':per>gan?'noentry':'nd');
  // Render page
  if(curPage==='senal')       rSenal(b);
  else if(curPage==='frecuencias') rFrec(b);
  else if(curPage==='ciclos')      rCiclos(b);
  else if(curPage==='diferencias') rDif(b);
  else if(curPage==='porcentajes') rPct(b);
  else if(curPage==='desbalance')  rDesbalance(b);
  else if(curPage==='historial')   rHistorial();
  else if(curPage==='tablero')     rTablero(b);
  else if(curPage==='grafica')     rGrafica(b);
  else if(curPage==='martingala')  rMart();
}

function empty(){ return`<div style="text-align:center;padding:40px 20px;color:var(--t3)">
  <div style="font-size:36px;margin-bottom:10px;opacity:.35">◈</div>
  <div style="font-size:13px">Ingresa números en la barra superior</div></div>`; }

function mwarn(n,need){return n<need?`<div class="mwarn"><div style="font-size:16px">📊</div>
  <div class="mwt">${n} tiradas · Análisis más preciso con ${need}+ · Faltan ${Math.max(0,need-n)}</div>
  <div class="mwp"><div class="mwpt"><div class="mwpf" style="width:${Math.min(100,n/need*100).toFixed(0)}%"></div></div></div></div>`:'';}

// ════════════════════════════════════════════════════
// PAGE: SEÑAL
// ════════════════════════════════════════════════════
function setModo(m){
  modoJuego=m;
  // Resetear estado de sesión al cambiar modo
  sesionActiva=false; sesionDocena=null; sesionTiros=0;
  renderAll();
}

// ════════════════════════════════════════════════════
// MODO SESIÓN
// WR sesión: 69% en 100 seeds × 500 tiros simulados
// ════════════════════════════════════════════════════
function buildSesionPanel(b, dg){
  const sesTotal=sesionGanadas+sesionPerdidas;
  const sesWR=sesTotal>0?(sesionGanadas/sesTotal*100).toFixed(1):'—';
  const sesColor=parseFloat(sesWR)>=50?'var(--green)':parseFloat(sesWR)>=35?'var(--gold)':'var(--red)';

  let estadoHTML='';
  if(sesionActiva&&sesionDocena!==null){
    const rest=MAX_TIROS_SESION-sesionTiros;
    const dots=Array.from({length:MAX_TIROS_SESION},(_,i)=>{
      if(i<sesionTiros) return `<div style="width:26px;height:26px;border-radius:50%;background:rgba(255,68,85,.25);border:2px solid var(--red);display:flex;align-items:center;justify-content:center;font-size:12px">✗</div>`;
      if(i===sesionTiros) return `<div style="width:26px;height:26px;border-radius:50%;background:rgba(0,230,118,.15);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;animation:blink 1s infinite">▶</div>`;
      return `<div style="width:26px;height:26px;border-radius:50%;background:var(--bg2);border:2px solid var(--border)"></div>`;
    }).join('');
    estadoHTML=`<div style="background:rgba(0,212,255,.07);border:2px solid var(--c1);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="font-size:10px;color:var(--c1);font-family:var(--fm);letter-spacing:1px;margin-bottom:8px">SESIÓN EN CURSO · D${sesionDocena}</div>
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-family:var(--ft);font-size:36px;font-weight:800;color:var(--c1)">D${sesionDocena}</div>
        <div><div style="font-size:10px;color:var(--t2);margin-bottom:6px">Tiro ${sesionTiros+1} / ${MAX_TIROS_SESION}</div>
          <div style="display:flex;gap:5px">${dots}</div></div>
        <div style="margin-left:auto;text-align:center">
          <div style="font-size:9px;color:var(--t3)">Intentos restantes</div>
          <div style="font-family:var(--ft);font-size:28px;font-weight:800;color:var(--gold)">${rest}</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:11px;color:var(--gold);font-family:var(--fm)">
        ⚡ Ingresa el número que salió → el sistema lo evalúa automáticamente
      </div>
    </div>`;
  } else if(pausaRestante>0){
    estadoHTML=`<div style="background:rgba(245,197,24,.07);border:1px solid rgba(245,197,24,.3);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="font-size:11px;color:var(--gold);font-family:var(--fm);font-weight:700">⏸ PAUSA — ${pausaRestante} tiros restantes. No juegues.</div>
      <div style="margin-top:8px;height:3px;background:var(--bg2);border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${Math.max(0,(1-pausaRestante/PAUSA_TRAS_2_SESIONES)*100).toFixed(0)}%;background:var(--gold);transition:width .4s"></div>
      </div>
    </div>`;
  } else if(dg.dec==='ENTRY'&&dg.recD1){
    estadoHTML=`<div style="background:rgba(0,230,118,.07);border:2px solid rgba(0,230,118,.3);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="font-size:11px;color:var(--green);font-family:var(--fm);font-weight:700;margin-bottom:8px">✅ SEÑAL ACTIVA — D${dg.recD1} lista para sesión</div>
      <button onclick="iniciarSesion(${dg.recD1})" style="background:var(--green);color:#000;border:none;border-radius:7px;
        padding:9px 24px;font-weight:800;font-size:13px;cursor:pointer;font-family:var(--ff)">
        🎯 Iniciar Sesión · D${dg.recD1}
      </button>
    </div>`;
  } else {
    estadoHTML=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="font-size:11px;color:var(--t3);font-family:var(--fm)">Esperando señal ENTRY para activar sesión...</div>
    </div>`;
  }

  return `<div class="card" style="border-color:rgba(245,197,24,.2);margin-bottom:12px">
    <div class="ct">🎯 MODO SESIÓN · 69% WR de sesión (100 simulaciones de 500 tiros)</div>
    <div style="display:flex;gap:7px;margin-bottom:10px">
      ${[['SESIONES',sesTotal,'var(--c1)'],['✅ GANADAS',sesionGanadas,'var(--green)'],['❌ PERDIDAS',sesionPerdidas,'var(--red)'],['WR SESIÓN',sesWR+(sesTotal?'%':'')+'',''+sesColor],['RACHA PERD',rachaSessionesPerd,rachaSessionesPerd>=2?'var(--red)':'var(--t2)']].map(([l,v,c])=>`
        <div style="flex:1;background:var(--bg2);border-radius:8px;padding:9px;text-align:center">
          <div style="font-size:8px;color:var(--t3);margin-bottom:2px">${l}</div>
          <div style="font-family:var(--ft);font-size:17px;font-weight:800;color:${c}">${v}</div>
        </div>`).join('')}
    </div>
    ${estadoHTML}
    <div style="background:var(--bg2);border-radius:8px;padding:9px;font-size:10px;color:var(--t3);font-family:var(--fm);line-height:1.8">
      📌 Señal ENTRY → botón "Iniciar Sesión" → ingresa los números tiro a tiro →
      ganas si la docena sale antes del tiro ${MAX_TIROS_SESION} → si no sale: sesión perdida → pausa 5 tiros →
      tras 2 sesiones perdidas: pausa ${PAUSA_TRAS_2_SESIONES} tiros obligatoria
    </div>
  </div>`;
}

function iniciarSesion(docena){
  if(!docena) return;
  sesionActiva=true; sesionDocena=docena; sesionTiros=0;
  toast(`🎯 Sesión D${docena} iniciada`,`Juega D${docena} por hasta ${MAX_TIROS_SESION} tiros. Ingresa cada número.`);
  renderAll();
}

function procesarTiroSesion(numCaido){
  if(!sesionActiva||sesionDocena===null) return false;
  sesionTiros++;
  const gano=doc(numCaido)===sesionDocena;
  const docAntes=sesionDocena;
  const tirosAntes=sesionTiros;
  if(gano){
    sesionGanadas++; rachaSessionesPerd=0;
    sesionActiva=false; sesionDocena=null; sesionTiros=0;
    setTimeout(()=>toast(`✅ SESIÓN GANADA (${tirosAntes}° tiro)`,`D${docAntes} salió. WR: ${(sesionGanadas/(sesionGanadas+sesionPerdidas)*100).toFixed(0)}%`),50);
  } else if(sesionTiros>=MAX_TIROS_SESION){
    sesionPerdidas++; rachaSessionesPerd++;
    sesionActiva=false; sesionDocena=null; sesionTiros=0;
    pausaRestante=rachaSessionesPerd>=2?PAUSA_TRAS_2_SESIONES:5;
    rachaPerdidasActual=rachaSessionesPerd;
    if(rachaSessionesPerd>=2){
      setTimeout(()=>toast(`⏸ 2 SESIONES PERDIDAS`,`Pausa ${PAUSA_TRAS_2_SESIONES} tiros obligatoria. No juegues.`),50);
    } else {
      setTimeout(()=>toast(`❌ Sesión perdida`,`5 tiros de pausa antes de siguiente señal.`),50);
    }
  }
  return true;
}

function rSenal(b){
  const el=document.getElementById('c-senal');
  if(!b){el.innerHTML=`<div style="text-align:center;padding:60px 20px;color:var(--t3)">
    <div style="font-size:48px;margin-bottom:12px;opacity:.35">⚡</div>
    <div style="font-size:14px">Ingresa los números que van saliendo</div></div>`;return;}
  const dg=decision(b);

  // Modo selector
  const modeHTML=`<div class="modo-sel">
    <span>Modo:</span>
    <div class="modo-opts">
      <div class="modo-btn${modoJuego==='2docenas'?' active':''}" onclick="setModo('2docenas')">◉◉ Dos Docenas</div>
      <div class="modo-btn${modoJuego==='1docena'?' active':''}" onclick="setModo('1docena')">◎ Una Docena</div>
      <div class="modo-btn${modoJuego==='sesion'?' active':''}" onclick="setModo('sesion')" style="color:var(--gold)${modoJuego==='sesion'?'':';opacity:.8'}">🎯 Sesión 69%</div>
    </div>
  </div>`;

  // Panel modo sesión
  const sesionHTML = modoJuego==='sesion' ? buildSesionPanel(b,dg) : '';

  // Tabla de estado × ciclo por docena
  const tablaHTML=dg.tablaScore?`
  <div class="card" style="margin-bottom:12px">
    <div class="ct">ESTADO × CICLO · Prioridad: C1+C2+C3 › C1+C2 › C2+C3</div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      ${dg.tablaScore.map(s=>{
        const isRec=s.di+1===dg.recD1||(modoJuego==='2docenas'&&s.di+1===dg.recD2);
        const ec=ECOL[s.eb]||'var(--t2)';
        const ci=CICO[s.cicloRaw]||'?';
        const rankN=typeof s.rank==='number';
        const rankColor=rankN&&s.rank<=2?'var(--green)':rankN&&s.rank<=5?'var(--c1)':rankN&&s.rank<=8?'var(--gold)':'var(--red)';
        return`<div style="flex:1;background:var(--bg2);border-radius:10px;padding:12px;text-align:center;
          border:2px solid ${isRec?ec:'var(--border)'};${isRec?`box-shadow:0 0 14px ${ec}22`:''};transition:all .3s">
          <div style="font-size:9px;color:var(--t3);margin-bottom:4px">D${s.di+1} · ${s.di===0?'1-12':s.di===1?'13-24':'25-36'}</div>
          <div style="font-size:12px;font-weight:800;color:${ec};margin-bottom:2px">${s.eb}</div>
          <div style="font-size:22px;margin:3px 0">${ci}</div>
          <div style="font-size:10px;color:var(--t2);font-family:var(--fm);margin-bottom:6px">${s.cicloRaw}</div>
          <div style="display:flex;justify-content:center;gap:3px;margin-bottom:6px">
            ${['C1','C2','C3'].map((cl,xi)=>`<div style="background:var(--bg3);border-radius:3px;padding:1px 4px;
              font-family:var(--fm);font-size:9px;color:var(--t2)">${cl}:${[s.c1,s.c2,s.c3][xi]}</div>`).join('')}
          </div>
          <div style="font-size:9px;color:var(--t3);margin-bottom:5px">${s.combActiva}</div>
          <div style="font-family:var(--ft);font-size:18px;font-weight:800;color:${rankColor};margin-bottom:5px">
            ${s.rank==='—'?'—':'#'+s.rank}</div>
          ${sig({t:s.dec,c:s.decCls})}
          ${isRec?`<div style="margin-top:5px"><span class="sig entry" style="font-size:8px">✓ ELEGIDA</span></div>`:''}
        </div>`;
      }).join('')}
    </div>
    <div style="padding:8px 12px;background:var(--bg2);border-radius:8px;
      display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
      <div>
        <span style="font-size:9px;color:var(--t3);font-family:var(--fm)">Combinación activa:</span>
        <span style="font-size:13px;font-weight:700;color:var(--c1);margin-left:7px">${dg.combo||'—'}</span>
      </div>
      <span style="font-size:10px;color:var(--t2);font-family:var(--fm)">${dg.forBES}</span>
    </div>
  </div>` : '';

  // Tabla de referencia
  const refHTML=`<div class="card card-last">
    <div class="ct">10 COMBINACIONES PRIORITARIAS DEL EXCEL</div>
    <table class="tbl">
      <thead><tr><th>#</th><th>Estado</th><th>Ciclo</th><th>Señal</th><th>Fórmula</th></tr></thead>
      <tbody>
        ${PRIORIDAD.map(p=>{
          const activa=dg.combo===p.eb+'+'+p.ciclo||dg.combo===p.eb+'+'+p.ciclo;
          return`<tr style="${activa?'background:rgba(0,212,255,.07)':''}">
            <td style="color:${p.rank<=2?'var(--green)':p.rank<=5?'var(--c1)':p.rank<=8?'var(--gold)':'var(--red)'};font-weight:800">#${p.rank}</td>
            <td style="color:${ECOL[p.eb]};font-weight:700">${p.eb}</td>
            <td style="color:var(--t2)">${CICO[p.ciclo]||''} ${p.ciclo}</td>
            <td>${sig({t:p.dec,c:p.cls})}</td>
            <td style="color:var(--t3);font-size:10px">${p.forBES}${activa?' ← ACTIVA':''}</td>
          </tr>`;
        }).join('')}
        <tr><td colspan="5" style="color:var(--t3);font-size:9px;padding:7px 9px">Cualquier otra combinación → NO ENTRY ⛔</td></tr>
      </tbody>
    </table>
  </div>`;

  // Pausa / filtro activo indicator
  const pausaHTML = pausaRestante>0 ? `
    <div style="background:rgba(245,197,24,.08);border:1px solid rgba(245,197,24,.25);border-radius:9px;
      padding:9px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
      <span style="font-size:18px">⏸</span>
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--gold);font-family:var(--fm)">PAUSA ACTIVA — ${pausaRestante} tiro(s) de espera</div>
        <div style="font-size:10px;color:var(--t3);font-family:var(--fm)">Protección tras racha de pérdidas · Racha actual: ${rachaPerdidasActual}</div>
      </div>
    </div>` : (dg.filtroRazon&&dg.dec!=='ENTRY'&&dg.dec!=='SIN DATOS') ? `
    <div style="background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.15);border-radius:9px;
      padding:9px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
      <span style="font-size:16px">⚠</span>
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--c1);font-family:var(--fm)">Filtro activo: ${dg.filtroRazon}</div>
        <div style="font-size:10px;color:var(--t3);font-family:var(--fm)">El sistema espera mejores condiciones antes de dar ENTRY</div>
      </div>
    </div>` : '';

  el.innerHTML=mwarn(b.n,10)+modeHTML+sesionHTML+pausaHTML+`
  <div class="dec-card ${dg.cls}">
    <div class="dec-main">
      <div class="dec-ico">${dg.ico}</div>
      <div>
        <div class="dec-lbl">NO SATURACIÓN · ${modoJuego==='1docena'?'UNA DOCENA':'DOS DOCENAS'}</div>
        <div class="dec-val ${dg.cls}">${dg.dec}</div>
        <div class="dec-sub">${dg.sub}</div>
        <div class="dec-docs">
          ${dg.recD1?`<div class="dc rec">D${dg.recD1} jugar</div>`:''}
          ${dg.recD2?`<div class="dc rec">D${dg.recD2} jugar</div>`:''}
          ${dg.evitD?`<div class="dc evit">D${dg.evitD} evitar</div>`:''}
        </div>
      </div>
    </div>
    <div class="dec-reasons">${dg.reasons.map(r=>`<div class="dec-r">
      <div class="dec-dot" style="background:${r.ok===true?'var(--green)':r.ok===false?'var(--red)':'var(--gold)'}"></div>
      ${r.t}</div>`).join('')}</div>
  </div>
  ${tablaHTML}${refHTML}`;
}

// ════════════════════════════════════════════════════
// PAGE: FRECUENCIAS
// ════════════════════════════════════════════════════
function rFrec(b){
  const el=document.getElementById('c-frecuencias');
  if(!b){el.innerHTML=empty();return;}
  el.innerHTML=`
  <div class="card">
    <div class="ct">TABLA DE FRECUENCIAS · TODAS LAS VENTANAS</div>
    <table class="tbl"><thead><tr><th>Docena</th><th>F5T</th><th>F10T</th><th>F20T</th><th>F30T</th><th>F50T</th><th>Aus 50T</th><th>% 50T</th><th>Estado</th></tr></thead><tbody>
      ${[0,1,2].map(i=>{
        const eb=estadoBase(b,i);
        const aus=b.v50-b.f50[i];
        return`<tr>
          <td style="color:${COL[i]};font-weight:700">D${i+1} (${i===0?'1-12':i===1?'13-24':'25-36'})</td>
          <td>${b.f5[i]}</td>
          <td class="${i===b.iA?'gt':i===b.iB?'rt':''}">${b.f10[i]}</td>
          <td class="${i===b.iA?'gt':i===b.iB?'rt':''}">${b.f20[i]}</td>
          <td class="${i===b.iA?'gt':i===b.iB?'rt':''}">${b.f30[i]}</td>
          <td class="${i===b.iA?'gt':i===b.iB?'rt':''}">${b.f50[i]}</td>
          <td>${sig(sAus(aus))}</td>
          <td>${(b.p50[i]*100).toFixed(1)}%</td>
          <td><span style="color:${ECOL[eb]||'var(--t2)'};font-weight:700;font-size:11px">${eb}</span></td>
        </tr>`;}).join('')}
    </tbody></table>
  </div>
  <div class="g3">
    ${['10T','20T','30T'].map((p,pi)=>{
      const fs=[b.f10,b.f20,b.f30][pi];
      return`<div class="metric ${['mc1','mc2','mc3'][pi]}">
        <div class="mlbl">Distribución ${p}</div>
        <div style="display:flex;justify-content:space-between;margin-top:7px">
          ${[0,1,2].map(i=>`<div style="text-align:center">
            <div style="font-size:9px;color:var(--t3);margin-bottom:2px">D${i+1}</div>
            <div style="font-family:var(--ft);font-size:18px;font-weight:800;color:${COL[i]}">${fs[i]}</div>
          </div>`).join('')}
        </div>
      </div>`;}).join('')}
  </div>
  <div class="card card-last">
    <div class="ct">RANGOS DE REFERENCIA DEL EXCEL (para 50 tiros)</div>
    <table class="tbl"><thead><tr><th>Período</th><th>ALTA</th><th>MEDIA/NORMAL</th><th>BAJA</th></tr></thead><tbody>
      <tr><td>50T</td><td class="gt">18-20</td><td class="yt">15-17</td><td style="color:var(--amber)">13-15</td></tr>
      <tr><td>30T</td><td class="gt">11-13</td><td class="yt">8-10</td><td style="color:var(--amber)">7-9</td></tr>
      <tr><td>20T</td><td class="gt">7-9</td><td class="yt">5-7</td><td style="color:var(--amber)">4-6</td></tr>
      <tr><td>10T</td><td class="gt">4-5</td><td class="yt">3-4</td><td style="color:var(--amber)">2-3</td></tr>
      <tr><td>5T</td><td class="gt">2-3</td><td class="yt">1-2</td><td style="color:var(--amber)">0-1</td></tr>
    </tbody></table>
  </div>`;
}

// ════════════════════════════════════════════════════
// PAGE: CICLOS
// ════════════════════════════════════════════════════
function rCiclos(b){
  const el=document.getElementById('c-ciclos');
  if(!b){el.innerHTML=empty();return;}
  el.innerHTML=mwarn(b.n,20)+`
  <div class="g3">${[0,1,2].map(i=>{
    const ci=b.ciclos[i];const mx=Math.max(ci.c1,ci.c2,ci.c3,1);
    return`<div class="cc ${ci.estado}">
      <div class="cc-h">
        <div class="cc-name" style="color:${COL[i]}">D${i+1}</div>
        ${sig({t:ci.estado,c:eCls(ci.estado)})}
      </div>
      <div class="cc-bars">${[{l:'C1',v:ci.c1},{l:'C2',v:ci.c2},{l:'C3',v:ci.c3}].map(({l,v})=>`
        <div class="cc-b">
          <div class="cc-bl">${l}</div>
          <div class="cc-bv" style="color:${COL[i]}">${v}</div>
          <div class="cc-bt"><div class="cc-bf" style="width:${(v/mx*100).toFixed(0)}%;background:${COL[i]}"></div></div>
        </div>`).join('')}</div>
      <div class="cc-f ${ci.fc}">${ci.fBES}</div>
    </div>`;}).join('')}</div>
  <div class="card card-last">
    <div class="ct">ESTADOS Y SEÑALES</div>
    <table class="tbl"><thead><tr><th>Estado</th><th>Condición</th><th>Señal</th></tr></thead><tbody>
      <tr><td>${sig({t:'EXPLOSION',c:'entry'})}</td><td>C3 > C1+C2</td><td class="gt">🔥 R1 ENTRAR INMEDIATO</td></tr>
      <tr><td>${sig({t:'CRECIENTE',c:'entry'})}</td><td>C1 &lt; C2 ≤ C3</td><td class="gt">⚡ R2 ENTRAR</td></tr>
      <tr><td>${sig({t:'REACTIVACION',c:'esperar'})}</td><td>C1>C2, C3>C2</td><td class="yt">⚡ R2 ENTRAR</td></tr>
      <tr><td>${sig({t:'ESTABLE',c:'esperar'})}</td><td>C1≈C2≈C3</td><td class="yt">⚡ R2 ENTRAR</td></tr>
      <tr><td>${sig({t:'DECRECIENTE',c:'noentry'})}</td><td>C1≥C2≥C3</td><td class="rt">⏳ R3 ESPERAR</td></tr>
      <tr><td>${sig({t:'PELIGROSO',c:'noentry'})}</td><td>C1 >> C2+C3</td><td class="rt">❌ NO ENTRAR</td></tr>
    </tbody></table>
  </div>`;
}

// ════════════════════════════════════════════════════
// PAGE: DIFERENCIAS
// ════════════════════════════════════════════════════
function rDif(b){
  const el=document.getElementById('c-diferencias');
  if(!b){el.innerHTML=empty();return;}
  const rows=[
    ['50T ALT-MED',b.difAM50],['50T ALT-BAJ',b.difAB50],['50T MED-BAJ',b.difMB50],
    ['30T ALT-MED',b.difAM30],['30T ALT-BAJ',b.difAB30],['30T MED-BAJ',b.difMB30],
    ['20T ALT-MED',b.difAM20],['20T ALT-BAJ',b.difAB20],['20T MED-BAJ',b.difMB20],
  ];
  el.innerHTML=`
  <div class="g4">${[['50T A-M',b.difAM50],['50T A-B',b.difAB50],['30T A-M',b.difAM30],['20T A-M',b.difAM20]]
    .map(([n,v])=>{const s=sDif(v);return`<div class="metric ${s.c==='optima'?'mgreen':s.c==='media'?'mg':'mred'}">
      <div class="mlbl">${n}</div>
      <div class="mval" style="color:${v<=5?'var(--green)':v<=8?'var(--gold)':'var(--red)'}">${v}</div>
      <div class="msub">${sig(s)}</div></div>`;}).join('')}</div>
  <div class="card card-last">
    <div class="ct">TABLA COMPLETA</div>
    <table class="tbl"><thead><tr><th>Diferencia</th><th>Valor</th><th>Umbral</th><th>Estado</th></tr></thead><tbody>
      ${rows.map(([n,v])=>{const s=sDif(v);return`<tr>
        <td class="hl">${n}</td>
        <td style="color:${v<=5?'var(--green)':v<=8?'var(--gold)':'var(--red)'};font-weight:700;font-size:13px">${v}</td>
        <td style="color:var(--t3);font-size:10px">≤5 Óptima · 6-8 Media · >8 Saturación</td>
        <td>${sig(s)}</td>
      </tr>`;}).join('')}
    </tbody></table>
  </div>`;
}

// ════════════════════════════════════════════════════
// PAGE: PORCENTAJES
// ════════════════════════════════════════════════════
function rPct(b){
  const el=document.getElementById('c-porcentajes');
  if(!b){el.innerHTML=empty();return;}
  el.innerHTML=`
  <div class="g2">
    <div class="card">
      <div class="ct">PORCENTAJES POR DOCENA (50T)</div>
      ${[0,1,2].map(i=>`<div class="pb">
        <div class="pb-row"><span class="pb-name" style="color:${COL[i]}">D${i+1}</span>
          <span class="pb-val">${(b.p50[i]*100).toFixed(1)}% · ${sig(sPct(b.p50[i]))}</span></div>
        <div class="pb-track"><div class="pb-fill" style="width:${(b.p50[i]*100).toFixed(1)}%;background:${COL[i]}"></div></div>
      </div>`).join('')}
      <div style="height:1px;background:var(--border);margin:10px 0"></div>
      <div class="ct">30T</div>
      ${[0,1,2].map(i=>`<div class="pb">
        <div class="pb-row"><span class="pb-name" style="color:${COL[i]}88">D${i+1}</span>
          <span class="pb-val">${(b.p30[i]*100).toFixed(1)}%</span></div>
        <div class="pb-track"><div class="pb-fill" style="width:${(b.p30[i]*100).toFixed(1)}%;background:${COL[i]}88"></div></div>
      </div>`).join('')}
    </div>
    <div class="card">
      <div class="ct">SUMA ALTA + MEDIA</div>
      <div style="text-align:center;padding:18px 0">
        <div style="font-family:var(--ft);font-size:44px;font-weight:800;
          color:${b.sumaAM>=0.65&&b.sumaAM<=0.77?'var(--green)':'var(--red)'}">${(b.sumaAM*100).toFixed(1)}%</div>
        <div style="margin-top:6px">${sig(b.sumaAM>=0.65&&b.sumaAM<=0.77?{t:'ENTRY',c:'entry'}:{t:'NO ENTRY',c:'noentry'})}</div>
        <div style="font-size:10px;color:var(--t3);margin-top:6px;font-family:var(--fm)">Zona ENTRY: 65%–77%</div>
      </div>
      <div style="height:1px;background:var(--border);margin:10px 0"></div>
      <table class="tbl"><thead><tr><th>Rango</th><th>Señal</th><th>Desc</th></tr></thead><tbody>
        <tr><td class="gt">20-34%</td><td>${sig({t:'ENTRY',c:'entry'})}</td><td style="color:var(--t2)">IDEAL</td></tr>
        <tr><td class="yt">34-42%</td><td>${sig({t:'CUIDADO',c:'esperar'})}</td><td style="color:var(--t2)">SANA/ADVERTENCIA</td></tr>
        <tr><td class="rt">&gt;42%</td><td>${sig({t:'NO ENTRY',c:'noentry'})}</td><td style="color:var(--t2)">PELIGRO</td></tr>
        <tr><td class="rt">&lt;20%</td><td>${sig({t:'NO ENTRY',c:'noentry'})}</td><td style="color:var(--t2)">Baja</td></tr>
      </tbody></table>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════
// ESTRATEGIA: DESBALANCE A LA ALTA
// ════════════════════════════════════════════════════
function calcDesbalance(b){
  if(!b||b.n<5) return{dec:'SIN DATOS',cls:'nd',criterios:[],docena:null,score:0};
  // Evaluar cada docena contra los 8 criterios del Desbalance ALTA
  const resultados=[0,1,2].map(di=>evalDesbalanceDocena(b,di));
  resultados.sort((a,z)=>z.score-a.score);
  const best=resultados[0];
  let dec,cls;
  if(best.score>=7){dec='DESBALANCE ALTA';cls='entry';}
  else if(best.score>=5){dec='POSIBLE';cls='esperar';}
  else{dec='NO APLICA';cls='noentry';}
  return{dec,cls,docena:best.di,score:best.score,criterios:best.criterios,resultados};
}

function evalDesbalanceDocena(b,di){
  const criterios=[];let score=0;
  const n=b.n;
  const v50=b.v50;
  const pct=b.p50[di];
  const f50=b.f50[di],f30=b.f30[di],f20=b.f20[di],f10=b.f10[di],f5=b.f5[di];
  const aus=v50-f50;

  // Normalizar frecuencias a 50T equivalente
  const ratio50=v50>0?50/v50:1;
  const ratio30=(b.v30>0?30/b.v30:1);
  const ratio20=(b.v20>0?20/b.v20:1);
  const ratio10=(b.v10>0?10/b.v10:1);

  const f50n=Math.round(f50*ratio50);
  const f30n=Math.round(f30*ratio30);
  const f20n=Math.round(f20*ratio20);
  const f10n=Math.round(f10*ratio10);

  // 1) % en 50T: 36%-42% ALTA
  const pctOk=pct>=0.36&&pct<=0.42;
  criterios.push({n:'%50T (36-42%)',v:`${(pct*100).toFixed(1)}%`,ok:pctOk,
    sub:pct>=0.30&&pct<0.36?'Normal (30-34%)':pct<0.30?'Baja (<30%)':pctOk?'ALTA ✓':'Sobre umbral'});
  if(pctOk) score++;

  // 2) F50: 18-20 + diferencia ≥3 con la media
  const otros=[0,1,2].filter(x=>x!==di);
  const fMediaOtros=(b.f50[otros[0]]+b.f50[otros[1]])/2;
  const dif50=f50-fMediaOtros;
  const f50Ok=f50n>=18&&f50n<=20&&dif50>=3;
  criterios.push({n:'F50: 18-20, dif≥3 con media',v:`${f50} (eq${f50n}) · dif=${dif50.toFixed(1)}`,ok:f50Ok});
  if(f50Ok) score++;

  // 3) F30: 11-13 + diferencia ≥2 con la media
  const fMedia30=(b.f30[otros[0]]+b.f30[otros[1]])/2;
  const dif30=f30-fMedia30;
  const f30Ok=f30n>=11&&f30n<=13&&dif30>=2;
  criterios.push({n:'F30: 11-13, dif≥2 con media',v:`${f30} (eq${f30n}) · dif=${dif30.toFixed(1)}`,ok:f30Ok});
  if(f30Ok) score++;

  // 4) F20: 7-9
  const f20Ok=f20n>=7&&f20n<=9;
  criterios.push({n:'F20: 7-9',v:`${f20} (eq${f20n})`,ok:f20Ok});
  if(f20Ok) score++;

  // 5) F10: 3-4
  const f10Ok=f10n>=3&&f10n<=4;
  criterios.push({n:'F10 (sal): ≤3',v:`${f10} (eq${f10n})`,ok:f10Ok||f10n<=3});
  if(f10n<=3) score++; else if(f10Ok) score++;

  // 6) F5: 1-2
  const f5Ok=f5>=1&&f5<=2;
  criterios.push({n:'F5: 1-2',v:`${f5}`,ok:f5Ok,
    sub:f5===0?'En 0 → esperar aus 6-8':f5===1?'En 1 → esperar aus 3-5 si próximo a salir':'OK'});
  if(f5Ok) score++;

  // 7) Ausencia: 0-4 (en ventana real)
  const ausNorm=Math.round(aus*ratio50);
  const ausOk=ausNorm>=0&&ausNorm<=4;
  criterios.push({n:'Ausencia: 0-4',v:`${aus} (eq${ausNorm})`,ok:ausOk});
  if(ausOk) score++;

  // 8) Distribución de impactos (del enunciado)
  // F10: de 3 impactos, ≥1 en últimos 4 tiros. No más de 2 en el tercio más viejo.
  // F5: no más de 1 en la posición más vieja, ideal impacto en posiciones 2-4
  let distOk=false;
  const ult10=T.filter(x=>x>0).slice(-10);
  const ult5=T.filter(x=>x>0).slice(-5);
  if(ult10.length>=3){
    const hits10=ult10.map(x=>doc(x)===di+1?1:0);
    const hitsViejos=hits10.slice(0,Math.ceil(hits10.length/3)).filter(x=>x).length;
    const hitsRecientes=hits10.slice(-4).filter(x=>x).length;
    const total10=hits10.filter(x=>x).length;
    distOk=total10>=2&&hitsRecientes>=1&&hitsViejos<=2;
    if(ult5.length>=2){
      const hits5=ult5.map(x=>doc(x)===di+1?1:0);
      const hitMasViejo=hits5[0];
      const hitsPos24=hits5.slice(1,4).filter(x=>x).length;
      distOk=distOk&&hitMasViejo<=1&&(total10===0||hitsPos24>0);
    }
  } else distOk=true; // sin suficientes datos, no penalizar
  criterios.push({n:'Distribución impactos',v:distOk?'Distribuida':'Concentrada',ok:distOk,
    sub:'F10: ≥1 en últ 4 · ≤2 en tercio viejo · F5: ideal posición 2-4'});
  if(distOk) score++;

  return{di,score,criterios};
}

function rDesbalance(b){
  const el=document.getElementById('c-desbalance');
  if(!b){el.innerHTML=empty();return;}
  const db=calcDesbalance(b);

  const docNames=['D1 (1-12)','D2 (13-24)','D3 (25-36)'];

  el.innerHTML=mwarn(b.n,10)+`
  <div class="dec-card ${db.cls}">
    <div class="dec-main">
      <div class="dec-ico">${db.cls==='entry'?'⚖':db.cls==='esperar'?'⏳':'◌'}</div>
      <div>
        <div class="dec-lbl">DESBALANCE A LA ALTA · ESTRATEGIA</div>
        <div class="dec-val ${db.cls}">${db.dec}</div>
        <div class="dec-sub">Score: ${db.score}/8 criterios cumplidos${db.docena!=null?` · D${db.docena+1} es la candidata`:''}</div>
        ${db.docena!=null&&db.cls==='entry'?`<div class="dec-docs"><div class="dc rec">D${db.docena+1} jugar</div></div>`:''}
      </div>
    </div>
  </div>

  <!-- Tabs por docena -->
  <div style="display:flex;gap:6px;margin-bottom:12px">
    ${[0,1,2].map(i=>{
      const r=db.resultados?db.resultados.find(x=>x.di===i):null;
      const sc=r?r.score:0;
      const color=sc>=7?'var(--green)':sc>=5?'var(--gold)':'var(--red)';
      return`<div style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:10px;
        padding:12px;text-align:center;cursor:pointer" onclick="showDTab(${i})" id="dtab-${i}">
        <div style="font-size:10px;color:var(--t3);margin-bottom:3px">D${i+1}</div>
        <div style="font-family:var(--ft);font-size:22px;font-weight:800;color:${color}">${sc}/8</div>
        <div style="font-size:10px;color:var(--t2);margin-top:3px">${sc>=7?'ALTA':sc>=5?'POSIBLE':'Bajo'}</div>
      </div>`;}).join('')}
  </div>

  ${[0,1,2].map(i=>{
    const r=db.resultados?db.resultados.find(x=>x.di===i):null;
    if(!r) return '';
    return`<div id="dtab-content-${i}" style="${i===db.docena||(!db.docena&&i===0)?'':'display:none'}">
      <div class="card card-last">
        <div class="ct">D${i+1} · ${docNames[i]} · CRITERIOS DE DESBALANCE ALTA</div>
        ${r.criterios.map(c=>`
          <div class="criterio-row ${c.ok?'ok':c.v?.includes('Normal')||c.v?.includes('eq')?'warn':'bad'}">
            <div>
              <div class="criterio-name">${c.n}</div>
              ${c.sub?`<div style="font-size:10px;color:var(--t3);font-family:var(--fm);margin-top:2px">${c.sub}</div>`:''}
            </div>
            <div>
              <div class="criterio-val" style="color:${c.ok?'var(--green)':'var(--red)'}">${c.v}</div>
              <div style="text-align:right;margin-top:2px">${sig(c.ok?{t:'OK',c:'entry'}:{t:'FALLA',c:'noentry'})}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;}).join('')}

  <div class="card" style="margin-top:12px">
    <div class="ct">REFERENCIA — DESBALANCE A LA ALTA</div>
    <table class="tbl">
      <thead><tr><th>#</th><th>Criterio</th><th>Valor objetivo</th></tr></thead>
      <tbody>
        <tr><td class="hl">1</td><td>% en 50T</td><td class="gt">36%-42% (ALTA)</td></tr>
        <tr><td class="hl">2</td><td>F50 + diferencia con media</td><td class="gt">18-20 · dif ≥3</td></tr>
        <tr><td class="hl">3</td><td>F30 + diferencia con media</td><td class="gt">11-13 · dif ≥2</td></tr>
        <tr><td class="hl">4</td><td>F20</td><td class="gt">7-9</td></tr>
        <tr><td class="hl">5</td><td>F10 salientes</td><td class="gt">≤3</td></tr>
        <tr><td class="hl">6</td><td>F5 tiros</td><td class="gt">1-2 · Si 0 → esperar aus 6-8</td></tr>
        <tr><td class="hl">7</td><td>Ausencia</td><td class="gt">0-4</td></tr>
        <tr><td class="hl">8</td><td>Distribución impactos</td><td class="gt">F10: ≥1 en últ 4 · F5: ideal pos 2-4</td></tr>
      </tbody>
    </table>
  </div>`;

  // Activar tab correcto
  setTimeout(()=>showDTab(db.docena??0),10);
}

function showDTab(i){
  [0,1,2].forEach(x=>{
    const c=document.getElementById('dtab-content-'+x);
    if(c) c.style.display=x===i?'':'none';
  });
}

// ════════════════════════════════════════════════════
// HISTORIAL — con soporte modo 1 y 2 docenas
// ════════════════════════════════════════════════════
function evalResultado(numCaido, dgPrev, modoAnterior){
  const docCaida=doc(numCaido);
  if(!dgPrev||!dgPrev.recD1) return 'sin_datos';
  if(docCaida===0) return 'perdido';
  if(modoAnterior==='1docena'){
    return docCaida===dgPrev.recD1 ? 'ganado' : 'perdido';
  } else {
    return (docCaida===dgPrev.recD1||docCaida===dgPrev.recD2) ? 'ganado' : 'perdido';
  }
}

function rHistorial(){
  const el=document.getElementById('c-historial');
  const gan=HIST.filter(h=>h.resultado==='ganado').length;
  const per=HIST.filter(h=>h.resultado==='perdido').length;
  const sd =HIST.filter(h=>h.resultado==='sin_datos').length;
  const total=gan+per;
  const wr=total>0?((gan/total)*100).toFixed(1):'—';
  const racha=calcRacha();

  el.innerHTML=`
  <div class="hist-stats">
    <div class="hstat"><div class="hstat-lbl">Total</div><div class="hstat-val" style="color:var(--c1)">${HIST.length}</div></div>
    <div class="hstat"><div class="hstat-lbl">✅ Ganados</div><div class="hstat-val" style="color:var(--green)">${gan}</div></div>
    <div class="hstat"><div class="hstat-lbl">❌ Perdidos</div><div class="hstat-val" style="color:var(--red)">${per}</div></div>
    <div class="hstat"><div class="hstat-lbl">Win Rate</div><div class="hstat-val" style="color:${parseFloat(wr)>=50?'var(--green)':'var(--red)'}">${wr}${total?'%':''}</div></div>
    <div class="hstat"><div class="hstat-lbl">Racha</div><div class="hstat-val" style="color:${racha.tipo==='G'?'var(--green)':racha.tipo==='P'?'var(--red)':'var(--t3)'}">
      ${racha.tipo==='G'?'✅':racha.tipo==='P'?'❌':'—'}${racha.n>1?' ×'+racha.n:''}</div></div>
    <div class="hstat"><div class="hstat-lbl">Sin datos</div><div class="hstat-val" style="color:var(--t3)">${sd}</div></div>
  </div>
  <div style="background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.15);border-radius:8px;
    padding:8px 12px;margin-bottom:10px;font-size:11px;color:var(--t2);font-family:var(--fm)">
    ℹ️ <strong style="color:var(--c1)">GANADO</strong> = número cayó en la docena recomendada antes del tiro (1 o 2 según el modo activo en ese momento).
  </div>
  ${!HIST.length?`<div style="text-align:center;padding:40px;color:var(--t3)">
    <div style="font-size:32px;margin-bottom:10px;opacity:.3">📋</div>
    <div style="font-size:13px">Sin tiradas aún</div></div>`:
  `<div class="hist-toggle">
    <div class="ht-btn active" id="hf-all" onclick="hFilter('all')">Todas (${HIST.length})</div>
    <div class="ht-btn" id="hf-gan" onclick="hFilter('ganado')">✅ (${gan})</div>
    <div class="ht-btn" id="hf-per" onclick="hFilter('perdido')">❌ (${per})</div>
  </div>
  <div id="hist-list">${buildHistList('all')}</div>`}`;
}

function calcRacha(){
  const v=[...HIST].filter(h=>h.resultado==='ganado'||h.resultado==='perdido').reverse();
  if(!v.length) return{tipo:null,n:0};
  const tipo=v[0].resultado==='ganado'?'G':'P';
  let n=0;
  for(const h of v){
    if((h.resultado==='ganado'&&tipo==='G')||(h.resultado==='perdido'&&tipo==='P')) n++;
    else break;
  }
  return{tipo,n};
}

let histFil='all';
function hFilter(f){
  histFil=f;
  ['all','gan','per'].forEach(x=>{
    const e=document.getElementById('hf-'+x);
    if(e) e.className='ht-btn'+(x===f?' active':'');
  });
  const hl=document.getElementById('hist-list');
  if(hl) hl.innerHTML=buildHistList(f);
}

function buildHistList(f){
  let items=[...HIST].reverse();
  if(f==='ganado') items=items.filter(h=>h.resultado==='ganado');
  else if(f==='perdido') items=items.filter(h=>h.resultado==='perdido');
  if(!items.length) return`<div style="text-align:center;padding:20px;color:var(--t3);font-size:12px">Sin tiradas en este filtro</div>`;
  return items.map(h=>{
    const cls=h.num===0?'z':RED.has(h.num)?'r':'b';
    const dname=h.docena===0?'Cero':`D${h.docena}`;
    const rango=h.docena===0?'—':h.docena===1?'1-12':h.docena===2?'13-24':'25-36';
    const rec=h.recD1?`Rec: D${h.recD1}${h.recD2?'+D'+h.recD2:''} (${h.modo==='1docena'?'1D':'2D'})`:'—';
    const sigColor=h.señal==='ENTRY'?'var(--green)':h.señal==='ESPERAR'?'var(--gold)':'var(--red)';
    let resHTML,rowBorder='var(--border)',rowBg='var(--bg2)';
    if(h.resultado==='ganado'){resHTML=`<span class="hist-res ganado">✅ GANADO</span>`;rowBorder='rgba(0,230,118,.25)';rowBg='rgba(0,230,118,.03)';}
    else if(h.resultado==='perdido'){resHTML=`<span class="hist-res perdido">❌ PERDIDO</span>`;rowBorder='rgba(255,68,85,.2)';rowBg='rgba(255,68,85,.03)';}
    else resHTML=`<span class="hist-res nd">— Sin datos</span>`;
    return`<div class="hist-row" style="border-color:${rowBorder};background:${rowBg}">
      <div class="hist-num ${cls}">${h.num}</div>
      <div class="hist-info">
        <div class="hist-doc"><strong style="color:var(--t1)">${dname}</strong> ${rango} · Tiro <strong style="color:var(--c1)">#${h.idx+1}</strong> · <span style="color:${sigColor};font-weight:700">${h.señal}</span></div>
        <div class="hist-idx">${rec} · ${h.ts}</div>
      </div>
      <div>${resHTML}</div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════
// PAGE: TABLERO
// ════════════════════════════════════════════════════
function rTablero(b){
  const el=document.getElementById('c-tablero');
  const nf=b?b.nf:{};const maxF=b?Math.max(...Object.values(nf),1):1;
  el.innerHTML=`
  <div class="g21">
    <div class="card">
      <div class="ct">TABLERO · Clic para registrar</div>
      <div class="ngrid" id="ngrid"></div>
      <div style="display:flex;gap:10px;margin-top:9px;flex-wrap:wrap">
        ${[[COL[0],'D1 1-12'],[COL[1],'D2 13-24'],[COL[2],'D3 25-36'],['#ff8888','Rojo'],['#8899bb','Negro'],['#60f090','Cero']].map(([c,l])=>`<span style="font-size:10px;color:var(--t3)"><span style="color:${c}">■</span> ${l}</span>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="ct">TOP FRECUENTES</div>
      ${b&&b.topN.length?b.topN.map(([n,f])=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div class="tc ${parseInt(n)===0?'z':RED.has(parseInt(n))?'r':'b'}" style="cursor:pointer;flex-shrink:0" onclick="addD(${n})">${n}</div>
        <div style="flex:1"><div class="pb-track"><div class="pb-fill" style="width:${(f/b.topN[0][1]*100).toFixed(0)}%;background:var(--c1)"></div></div></div>
        <span style="font-family:var(--fm);font-size:10px;color:var(--t2)">${f}×</span>
      </div>`).join(''):'<div style="color:var(--t3);font-size:11px">Sin datos</div>'}
      <div style="height:1px;background:var(--border);margin:10px 0"></div>
      <div class="ct">ÚLTIMAS 15</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${T.slice(-15).map(n=>`<div class="tc ${n===0?'z':RED.has(n)?'r':'b'}">${n}</div>`).join('')}
      </div>
    </div>
  </div>`;
  const g=document.getElementById('ngrid');if(!g)return;g.innerHTML='';
  for(let n=0;n<=36;n++){const f=nf[n]||0;const hot=f>0&&f>=maxF*.5;
    const cls=n===0?'z':RED.has(n)?'r':'b';const div=document.createElement('div');
    div.className=`nc ${cls}${hot?' hot':''}`;div.title=`${n} · ${f}×`;
    div.innerHTML=n+(f>0?`<span class="hc">${f}</span>`:'');
    if(f>0)div.style.opacity=0.35+0.65*(f/maxF);
    div.onclick=()=>addD(n);g.appendChild(div);}
}

// ════════════════════════════════════════════════════
// PAGE: GRÁFICA
// ════════════════════════════════════════════════════
function rGrafica(b){
  const el=document.getElementById('c-grafica');
  if(!b){el.innerHTML=empty();return;}
  el.innerHTML=`<div class="card"><div class="ct">EVOLUCIÓN DE FRECUENCIAS</div><div class="cwrap" style="height:250px"><canvas id="chEvol"></canvas></div></div>
  <div class="card card-last"><div class="ct">PORCENTAJES EN EL TIEMPO</div><div class="cwrap" style="height:210px"><canvas id="chPct"></canvas></div></div>`;
  setTimeout(()=>{
    const copts={responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#7a8fb0',font:{family:'Space Grotesk',size:10},padding:7}}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#3a5068',font:{size:9}}},
              y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#3a5068',font:{size:9}}}}};
    const pts=[],d1=[],d2=[],d3=[];
    const step=Math.max(1,Math.floor(b.n/20));
    for(let i=Math.min(5,b.n);i<=b.n;i+=step){const f=fDoc(T.slice(0,i));pts.push(i);d1.push(f[0]);d2.push(f[1]);d3.push(f[2]);}
    if(charts.ev)charts.ev.destroy();
    charts.ev=new Chart(document.getElementById('chEvol'),{type:'line',data:{labels:pts,datasets:[
      {label:'D1',data:d1,borderColor:COL[0],backgroundColor:'rgba(0,212,255,.06)',tension:.4,pointRadius:2,fill:true},
      {label:'D2',data:d2,borderColor:COL[1],tension:.4,pointRadius:2},
      {label:'D3',data:d3,borderColor:COL[2],tension:.4,pointRadius:2}]},options:copts});
    if(charts.pc)charts.pc.destroy();
    charts.pc=new Chart(document.getElementById('chPct'),{type:'line',data:{labels:pts,datasets:[
      {label:'D1%',data:d1.map((v,i)=>pts[i]?v/pts[i]*100:0),borderColor:COL[0],tension:.4,pointRadius:0},
      {label:'D2%',data:d2.map((v,i)=>pts[i]?v/pts[i]*100:0),borderColor:COL[1],tension:.4,pointRadius:0},
      {label:'D3%',data:d3.map((v,i)=>pts[i]?v/pts[i]*100:0),borderColor:COL[2],tension:.4,pointRadius:0},
      {label:'33%',data:pts.map(()=>33.3),borderColor:'rgba(255,255,255,.2)',borderDash:[4,4],pointRadius:0}]},options:copts});
  },50);
}

// ════════════════════════════════════════════════════
// PAGE: MARTINGALA
// ════════════════════════════════════════════════════
function rMart(){
  const el=document.getElementById('c-martingala');
  el.innerHTML=`<div class="g2">
    <div class="card">
      <div class="ct">FRENOS DEL EXCEL</div>
      <table class="tbl"><thead><tr><th>Apuesta</th><th>Estado</th></tr></thead><tbody>
        ${[[5,'nd','NORMAL'],[10,'nd','NORMAL'],[20,'nd','NORMAL'],[40,'esperar','FRENO'],[80,'esperar','POSIBLE FRENO'],[160,'sat','POSIBLE FRENO']].map(([v,c,t])=>`<tr><td class="hl">${v}</td><td>${sig({t,c})}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="card">
      <div class="ct">CALCULADORA</div>
      <div style="margin-bottom:10px"><div style="font-size:10px;color:var(--t3);margin-bottom:4px">Apuesta base (€)</div>
        <input type="number" id="MB" value="5" min="1" style="background:var(--bg2);border:1px solid var(--border);
          border-radius:7px;color:var(--t1);font-family:var(--fm);font-size:15px;padding:6px 9px;
          width:100%;outline:none" oninput="cMart()"></div>
      <div id="MR" style="display:flex;flex-direction:column;gap:5px"></div>
    </div>
  </div>`; cMart(); }

function cMart(){
  const base=parseFloat(document.getElementById('MB')?.value)||5;
  const el=document.getElementById('MR');if(!el)return;
  const labels=['NORMAL','NORMAL','NORMAL','FRENO','POSIBLE FRENO','PELIGRO'];
  const cls=['nd','nd','nd','esperar','esperar','noentry'];
  el.innerHTML=Array.from({length:6},(_,i)=>{const a=base*Math.pow(2,i);
    return`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 9px;
      background:var(--bg2);border-radius:7px;border:1px solid var(--border)">
      <span style="font-size:10px;color:var(--t2)">Pérdida #${i+1}</span>
      <span style="font-family:var(--fm);font-size:13px;font-weight:700;color:${i>=3?'var(--red)':'var(--c1)'}">€${a.toFixed(0)}</span>
      ${sig({t:labels[i],c:cls[i]})}
    </div>`;}).join('');}

// ════════════════════════════════════════════════════
// INPUT / NAV / TOAST
// ════════════════════════════════════════════════════
function pushHist(val, dgPrev, modoAnterior){
  const idx=T.length-1;
  const docVal=doc(val);
  const now=new Date();
  const ts=now.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const resultado=evalResultado(val, dgPrev, modoAnterior);
  // Actualizar pausa adaptativa
  actualizarPausa(resultado);
  HIST.push({idx,num:val,docena:docVal,ts,
    señal:dgPrev?dgPrev.dec:'SIN DATOS',
    recD1:dgPrev?.recD1??null,
    recD2:dgPrev?.recD2??null,
    modo:modoAnterior,
    resultado});
  return resultado;
}

function addN(){
  const inp=document.getElementById('NI');const val=parseInt(inp.value);
  if(isNaN(val)||val<0||val>36){inp.style.borderColor='var(--red)';setTimeout(()=>inp.style.borderColor='',500);return;}
  const bPrev=calc();const dgPrev=bPrev?decision(bPrev):null;const modoAnt=modoJuego;
  T.push(val);
  // Procesar tiro de sesión activa (modo sesión)
  if(modoJuego==='sesion') procesarTiroSesion(val);
  const res=pushHist(val,dgPrev,modoAnt);
  inp.value='';inp.focus();
  renderAll();
  const bNext=calc();
  if(bPrev&&bNext){const d1=decision(bPrev),d2=decision(bNext);if(d1.dec!==d2.dec)toast(`→ Señal: ${d2.dec}`,d2.sub);}
  if(res==='ganado') toast(`✅ Tiro #${HIST.length} GANADO`,`D${doc(val)} estaba recomendada`);
  else if(res==='perdido') toast(`❌ Tiro #${HIST.length} PERDIDO`,`D${doc(val)} · Rec: D${dgPrev?.recD1??'?'}${dgPrev?.recD2?'+D'+dgPrev.recD2:''}`);
}

function addD(n){
  const bPrev=calc();const dgPrev=bPrev?decision(bPrev):null;const modoAnt=modoJuego;
  T.push(n);
  if(modoJuego==='sesion') procesarTiroSesion(n);
  pushHist(n,dgPrev,modoAnt);renderAll();
}

function undo(){ if(!T.length)return; T.pop();HIST.pop();renderAll(); }

function clearNums(){
  if(T.length&&!confirm('¿Limpiar todas las tiradas?'))return;
  T=[];HIST=[];pausaRestante=0;rachaPerdidasActual=0;
  sesionActiva=false;sesionDocena=null;sesionTiros=0;
  sesionGanadas=0;sesionPerdidas=0;rachaSessionesPerd=0;
  renderAll();
}

function reiniciar(){
  if(!confirm('¿Reiniciar todo? Se borrará todo el historial y las tiradas.'))return;
  T=[];HIST=[];charts={};pausaRestante=0;rachaPerdidasActual=0;
  sesionActiva=false;sesionDocena=null;sesionTiros=0;
  sesionGanadas=0;sesionPerdidas=0;rachaSessionesPerd=0;
  renderAll();
  toast('↺ Reiniciado','Sistema limpio y listo');
}

function paste(){
  const raw=document.getElementById('PI').value;
  const nums=raw.split(/[\s,;|\/\\]+/).map(s=>parseInt(s.trim())).filter(n=>!isNaN(n)&&n>=0&&n<=36);
  if(!nums.length){toast('Error','No hay números válidos (0–36)');return;}
  const now=new Date();
  nums.forEach(n=>{
    const bPrev=calc();const dgPrev=bPrev?decision(bPrev):null;const modoAnt=modoJuego;
    T.push(n);pushHist(n,dgPrev,modoAnt);
  });
  document.getElementById('PI').value='';
  renderAll();
  toast(`✓ ${nums.length} números`,`Total: ${T.length} tiradas`);
}

function go(page,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  if(el)el.classList.add('active');
  curPage=page;
  const b=calc();
  if(page==='senal')rSenal(b);
  else if(page==='frecuencias')rFrec(b);
  else if(page==='ciclos')rCiclos(b);
  else if(page==='diferencias')rDif(b);
  else if(page==='porcentajes')rPct(b);
  else if(page==='desbalance')rDesbalance(b);
  else if(page==='historial')rHistorial();
  else if(page==='tablero')rTablero(b);
  else if(page==='grafica')rGrafica(b);
  else if(page==='martingala')rMart();
  sbClose();
}

function sbOpen(){document.getElementById('sb').classList.add('open');document.getElementById('ov').classList.add('open');}
function sbClose(){document.getElementById('sb').classList.remove('open');document.getElementById('ov').classList.remove('open');}

let tT;
function toast(title,body){
  document.getElementById('tt').textContent=title;document.getElementById('tb').textContent=body;
  const t=document.getElementById('toast');t.classList.add('show');
  clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('show'),4000);
}

document.addEventListener('DOMContentLoaded',()=>{
  renderAll();
  document.getElementById('NI').focus();
  document.getElementById('PI').addEventListener('keydown',e=>{if(e.key==='Enter')paste();});
});
