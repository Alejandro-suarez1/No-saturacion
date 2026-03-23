// ════ CONSTANTES ════
const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const C=['#00d4ff','#7b61ff','#ff6b35'];
let T=[],charts={},curPage='senal',prevDec=null;
// Historial: cada entrada = {idx, num, docena, resultado: 'ganado'|'perdido'|null, apuesta, ts}
let HIST=[];

// ════ CALC ════
function d(n){return n===0?0:n<=12?1:n<=24?2:3}
function fD(arr){const f=[0,0,0];arr.forEach(n=>{const x=d(n);if(x>0)f[x-1]++;});return f}

function calc(){
  const n=T.length;if(!n)return null;
  const t50=T.slice(-50),t30=T.slice(-30),t20=T.slice(-20),t10=T.slice(-10);
  const f50=fD(t50),f30=fD(t30),f20=fD(t20),f10=fD(t10);
  const v50=t50.filter(x=>x>0).length||1,v30=t30.filter(x=>x>0).length||1,
        v20=t20.filter(x=>x>0).length||1,v10=t10.filter(x=>x>0).length||1;
  const p50=f50.map(x=>x/v50),p30=f30.map(x=>x/v30),p20=f20.map(x=>x/v20),p10=f10.map(x=>x/v10);
  const rank=[0,1,2].sort((a,b)=>f50[b]-f50[a]);
  const[iA,iM,iB]=rank;
  const sumaAM=p50[iA]+p50[iM];
  const saturada=p50[iA]>0.44||(f50[iA]-f50[iB])>12;
  const aus50=[v50-f50[0],v50-f50[1],v50-f50[2]];
  const nf={};T.forEach(x=>nf[x]=(nf[x]||0)+1);
  const topN=Object.entries(nf).sort((a,b)=>b[1]-a[1]).slice(0,7);
  const ciclos=[0,1,2].map(i=>calcCiclo(i));
  const nivel=n<5?0:n<10?1:n<20?2:n<30?3:4;
  return{n,nivel,iA,iM,iB,rank,f50,f30,f20,f10,p50,p30,p20,p10,v50,v30,v20,v10,
    sumaAM,saturada,aus50,nf,topN,ciclos,
    difAM50:f50[iA]-f50[iM],difAB50:f50[iA]-f50[iB],difMB50:f50[iM]-f50[iB],
    difAM30:f30[iA]-f30[iM],difAB30:f30[iA]-f30[iB],difMB30:f30[iM]-f30[iB],
    difAM20:f20[iA]-f20[iM],difAB20:f20[iA]-f20[iB],difMB20:f20[iM]-f20[iB]};
}

function calcCiclo(di){
  const arr=T.filter(x=>x>0).slice(-30);
  if(arr.length<6)return{c1:0,c2:0,c3:0,estado:'SIN DATOS',fBES:'ESPERAR',fc:'r3'};
  const sz=Math.floor(arr.length/3);
  const c1=arr.slice(0,sz).filter(x=>d(x)===di+1).length;
  const c2=arr.slice(sz,sz*2).filter(x=>d(x)===di+1).length;
  const c3=arr.slice(sz*2).filter(x=>d(x)===di+1).length;
  let estado,fBES,fc;
  if(c3>c1+c2)                        {estado='EXPLOSION';   fBES='🔥 R1 · ENTRAR INMEDIATO';fc='r1';}
  else if(c1<c2&&c2<c3)               {estado='CRECIENTE';   fBES='⚡ R2 · ENTRAR';            fc='r2';}
  else if(c1>=c2+c3&&c1>2)           {estado='PELIGROSO';   fBES='❌ NO ENTRAR';             fc='no';}
  else if(c1>c2&&c3>c2&&c3>0)        {estado='REACTIVACION';fBES='⚡ R2 · ENTRAR';            fc='r2';}
  else if(Math.abs(c1-c2)<=1&&Math.abs(c2-c3)<=1&&c2>0){estado='ESTABLE';fBES='⚡ R2 · ENTRAR';fc='r2';}
  else if(c1>c2&&c2>c3)              {estado='DECRECIENTE'; fBES='⏳ R3 · ESPERAR';          fc='r3';}
  else                                {estado='NORMAL';      fBES='⏳ R3 · ESPERAR';          fc='r3';}
  return{c1,c2,c3,estado,fBES,fc};
}

// ════ SEÑALES ════
function sDif(v){return v<=5?{t:'ÓPTIMA',c:'optima'}:v<=8?{t:'MEDIA',c:'media'}:{t:'SATURACIÓN',c:'sat'}}
function sSuma(s){return s>=0.65&&s<=0.77?{t:'ENTRY',c:'entry'}:s>0.77?{t:'NO ENTRY (alta)',c:'noentry'}:{t:'NO ENTRY (baja)',c:'noentry'}}
function sPct(p){return p>=0.20&&p<=0.34?{t:'ENTRY',c:'entry'}:p>0.34&&p<=0.42?{t:'CUIDADO',c:'esperar'}:{t:'NO ENTRY',c:'noentry'}}
function sAus(a){return a<=2?{t:'OK',c:'entry'}:a<=4?{t:'ESP 3-4',c:'esperar'}:a<=6?{t:'ESP 4-6',c:'esperar'}:a<=8?{t:'ESP 6-8',c:'esperar'}:{t:'CRÍTICA',c:'noentry'}}
function sig(s){return`<span class="sig ${s.c}">${s.t}</span>`}
function eCls(e){return{CRECIENTE:'entry',EXPLOSION:'entry',REACTIVACION:'esperar',ESTABLE:'esperar',DECRECIENTE:'noentry',PELIGROSO:'noentry',NORMAL:'nd','SIN DATOS':'nd'}[e]||'nd'}

function decision(b){
  if(!b||b.nivel===0)return{dec:'SIN DATOS',cls:'nd',ico:'◈',sub:'Ingresa números para comenzar',reasons:[]};
  if(b.saturada)return{dec:'NO ENTRY',cls:'noentry',ico:'⛔',sub:`D${b.iA+1} saturada (${(b.p50[b.iA]*100).toFixed(0)}%)`,reasons:[{t:'Saturación detectada',ok:false}]};
  let ok=0,no=0,esp=0,reasons=[];
  // Suma AM
  const ss=sSuma(b.sumaAM);
  ss.c==='entry'?(ok++,reasons.push({t:`Suma A+M ${(b.sumaAM*100).toFixed(0)}%`,ok:true})):(no++,reasons.push({t:`Suma A+M ${(b.sumaAM*100).toFixed(0)}%`,ok:false}));
  // % baja
  b.p50[b.iB]<=0.26?(ok++,reasons.push({t:`%Baja ${(b.p50[b.iB]*100).toFixed(0)}% (<26%)`,ok:true})):(no++,reasons.push({t:`%Baja ${(b.p50[b.iB]*100).toFixed(0)}% (≥26%)`,ok:false}));
  // 10 sal alta
  const sa=b.f10[b.iA];
  sa>5?(no++,reasons.push({t:`10T Alta: ${sa} (>5)`,ok:false})):sa>=3?(ok++,reasons.push({t:`10T Alta: ${sa} (3-5)`,ok:true})):(esp++,reasons.push({t:`10T Alta: ${sa} (bajo)`,ok:null}));
  // Dif AM50
  const sd=sDif(b.difAM50);
  sd.c==='optima'?(ok++,reasons.push({t:`Dif AM50: ${b.difAM50} Óptima`,ok:true})):sd.c==='media'?(esp++,reasons.push({t:`Dif AM50: ${b.difAM50} Media`,ok:null})):(no++,reasons.push({t:`Dif AM50: ${b.difAM50} Sat`,ok:false}));
  // Ciclo docena media
  if(b.nivel>=3){const ci=b.ciclos[b.iM];
    ['EXPLOSION','CRECIENTE','REACTIVACION'].includes(ci.estado)?(ok++,reasons.push({t:`Ciclo D${b.iM+1}: ${ci.estado}`,ok:true})):['PELIGROSO','DECRECIENTE'].includes(ci.estado)?(no++,reasons.push({t:`Ciclo D${b.iM+1}: ${ci.estado}`,ok:false})):(esp++,reasons.push({t:`Ciclo D${b.iM+1}: ${ci.estado}`,ok:null}));}
  let dec,cls,ico;
  if(no>=3||(no>ok&&no>=2)){dec='NO ENTRY';cls='noentry';ico='⛔';}
  else if(ok>=3&&no<=1){dec='ENTRY';cls='entry';ico='✅';}
  else{dec='ESPERAR';cls='esperar';ico='⏳';}
  return{dec,cls,ico,sub:`${ok} ✓ · ${no} ✗ · ${esp} ~`,reasons};
}

// ════ RENDER ════
function renderAll(){
  const b=calc();
  // Update UI
  const s=document.getElementById('strip');
  if(!T.length){s.innerHTML='<span class="strip-empty">Ingresa los números de la ruleta...</span>';}
  else{s.innerHTML=T.map((n,i)=>`<div class="tc ${n===0?'z':RED.has(n)?'r':'b'}${i===T.length-1?' new':''}" title="#${i+1}">${n}</div>`).join('');s.scrollLeft=s.scrollWidth;}
  document.getElementById('cnt').textContent=`${T.length} tiradas`;
  document.getElementById('sbcnt').textContent=`${T.length} tiradas`;
  const dg=b?decision(b):{dec:'—',cls:'nd'};
  const badge=document.getElementById('badge');badge.textContent=dg.dec;badge.className='ni-badge '+dg.cls;
  // historial badge
  const bh=document.getElementById('badge-hist');
  const gan=HIST.filter(h=>h.resultado==='ganado').length;
  const per=HIST.filter(h=>h.resultado==='perdido').length;
  if(bh){bh.textContent=HIST.length?`${gan}G/${per}P`:'0';bh.className='ni-badge '+(gan>per?'entry':per>gan?'noentry':'nd');}
  // Render current page
  const b2=b;
  if(curPage==='senal')rSenal(b2);
  else if(curPage==='frecuencias')rFrec(b2);
  else if(curPage==='ciclos')rCiclos(b2);
  else if(curPage==='diferencias')rDif(b2);
  else if(curPage==='porcentajes')rPct(b2);
  else if(curPage==='tablero')rTablero(b2);
  else if(curPage==='grafica')rGrafica(b2);
  else if(curPage==='martingala')rMart();
  else if(curPage==='historial')rHistorial();
}

function empty(){return`<div style="text-align:center;padding:50px 20px;color:var(--t3)"><div style="font-size:36px;margin-bottom:10px;opacity:.35">◈</div><div style="font-size:13px">Ingresa números en la barra superior</div></div>`}

function mwHTML(n,need,col='var(--gold)'){return n<need?`<div class="mwarn"><div class="mwi">📊</div><div class="mwt" style="color:${col}">Análisis más preciso con ${need} tiradas · Ahora: ${n} · Faltan ${need-n}</div><div class="mwp"><div class="mwpt"><div class="mwpf" style="width:${Math.min(100,n/need*100).toFixed(0)}%;background:${col}"></div></div></div></div>`:''}

// ── SEÑAL ──
function rSenal(b){
  const el=document.getElementById('c-senal');
  if(!b){el.innerHTML=`<div style="text-align:center;padding:60px 20px;color:var(--t3)"><div style="font-size:48px;margin-bottom:14px;opacity:.35">⚡</div><div style="font-size:14px">Ingresa los números que van saliendo en la ruleta</div><div style="font-size:11px;margin-top:6px;font-family:var(--fm)">La señal aparece desde el primer número</div></div>`;return;}
  const dg=decision(b);
  el.innerHTML=mwHTML(b.n,10)+`
  <div class="dec-card ${dg.cls}">
    <div class="dec-main">
      <div class="dec-ico">${dg.ico}</div>
      <div>
        <div class="dec-lbl">SEÑAL PRINCIPAL · NO SATURACIÓN</div>
        <div class="dec-val ${dg.cls}">${dg.dec}</div>
        <div class="dec-sub">${dg.sub}</div>
        <div class="dec-docs">
          <div class="dc rec">D${b.iM+1} jugar</div>
          <div class="dc rec">D${b.iA+1} jugar</div>
          <div class="dc evit">D${b.iB+1} evitar</div>
        </div>
      </div>
    </div>
    <div class="dec-reasons">${dg.reasons.map(r=>`<div class="dec-r"><div class="dec-dot" style="background:${r.ok===true?'var(--green)':r.ok===false?'var(--red)':'var(--gold)'}"></div>${r.t}</div>`).join('')}</div>
  </div>
  <div class="g4">
    <div class="metric mc1"><div class="mlbl">Docena Alta</div><div class="mval" style="color:var(--c1)">D${b.iA+1}</div><div class="msub">${b.f50[b.iA]} hits · ${(b.p50[b.iA]*100).toFixed(1)}%</div></div>
    <div class="metric mc2"><div class="mlbl">Docena Media</div><div class="mval" style="color:var(--c2)">D${b.iM+1}</div><div class="msub">${b.f50[b.iM]} hits · ${(b.p50[b.iM]*100).toFixed(1)}%</div></div>
    <div class="metric mg"><div class="mlbl">Docena Baja</div><div class="mval" style="color:var(--gold)">D${b.iB+1}</div><div class="msub">${b.f50[b.iB]} hits · ${(b.p50[b.iB]*100).toFixed(1)}%</div></div>
    <div class="metric ${b.saturada?'mred':'mgreen'}"><div class="mlbl">Saturación</div><div class="mval" style="color:${b.saturada?'var(--red)':'var(--green)'}">${b.saturada?'SÍ':'NO'}</div><div class="msub">${b.saturada?'Sobre umbral':'Sistema estable'}</div></div>
  </div>
  <div class="card card-last">
    <div class="ct">10 SALIENTES · ÚLTIMAS 10 TIRADAS</div>
    <table class="tbl"><thead><tr><th>Categoría</th><th>Docena</th><th>Cantidad</th><th>Señal</th><th>Regla Excel</th></tr></thead><tbody>
      <tr><td>Alta</td><td class="hl">D${b.iA+1}</td><td class="${b.f10[b.iA]>5?'rt':b.f10[b.iA]>=3?'gt':''}">${b.f10[b.iA]}</td><td>${sig(b.f10[b.iA]>5?{t:'NO ENTRY',c:'noentry'}:b.f10[b.iA]>=3?{t:'ENTRY',c:'entry'}:{t:'BAJO',c:'esperar'})}</td><td style="color:var(--t3)">ENTRY 3-5 · NO si >5</td></tr>
      <tr><td>Media</td><td class="hl">D${b.iM+1}</td><td class="${b.f10[b.iM]>=2&&b.f10[b.iM]<=4?'gt':''}">${b.f10[b.iM]}</td><td>${sig(b.f10[b.iM]>=2&&b.f10[b.iM]<=4?{t:'ENTRY',c:'entry'}:{t:'REVISAR',c:'esperar'})}</td><td style="color:var(--t3)">ENTRY 2-4</td></tr>
      <tr><td>Baja</td><td class="hl">D${b.iB+1}</td><td class="${b.f10[b.iB]<=2?'gt':''}">${b.f10[b.iB]}</td><td>${sig(b.f10[b.iB]<=2?{t:'ENTRY',c:'entry'}:{t:'NO ENTRY',c:'noentry'})}</td><td style="color:var(--t3)">ENTRY ≤2</td></tr>
    </tbody></table>
  </div>`;}

// ── FRECUENCIAS ──
function rFrec(b){
  const el=document.getElementById('c-frecuencias');
  if(!b){el.innerHTML=empty();return;}
  el.innerHTML=`
  <div class="card">
    <div class="ct">TABLA DE FRECUENCIAS · TODAS LAS VENTANAS</div>
    <table class="tbl"><thead><tr><th>Docena</th><th>F10T</th><th>F20T</th><th>F30T</th><th>F50T</th><th>Aus 50T</th><th>% 50T</th><th>Señal</th></tr></thead><tbody>
      ${[0,1,2].map(i=>`<tr>
        <td style="color:${C[i]};font-weight:700">D${i+1} (${i===0?'1-12':i===1?'13-24':'25-36'})</td>
        <td class="${i===b.iA?'gt':i===b.iB?'rt':''}">${b.f10[i]}</td>
        <td class="${i===b.iA?'gt':i===b.iB?'rt':''}">${b.f20[i]}</td>
        <td class="${i===b.iA?'gt':i===b.iB?'rt':''}">${b.f30[i]}</td>
        <td class="${i===b.iA?'gt':i===b.iB?'rt':''}">${b.f50[i]}</td>
        <td>${sig(sAus(b.aus50[i]))}</td>
        <td>${(b.p50[i]*100).toFixed(1)}%</td>
        <td>${sig(sPct(b.p50[i]))}</td>
      </tr>`).join('')}
    </tbody></table>
  </div>
  <div class="g3">
    ${['10T','20T','30T'].map((p,pi)=>{const fs=[b.f10,b.f20,b.f30][pi];return`<div class="metric ${['mc1','mc2','mc3'][pi]}"><div class="mlbl">Distribución ${p}</div><div style="display:flex;justify-content:space-between;margin-top:8px">${[0,1,2].map(i=>`<div style="text-align:center"><div style="font-size:9px;color:var(--t3);margin-bottom:2px">D${i+1}</div><div style="font-family:var(--ft);font-size:20px;font-weight:800;color:${C[i]}">${fs[i]}</div></div>`).join('')}</div></div>`;}).join('')}
  </div>
  <div class="card card-last">
    <div class="ct">RANGOS DE REFERENCIA DEL EXCEL</div>
    <table class="tbl"><thead><tr><th>Período</th><th>ALTA esperada</th><th>MEDIA esperada</th><th>BAJA esperada</th></tr></thead><tbody>
      <tr><td>50T</td><td class="gt">18-20</td><td class="yt">15-17</td><td style="color:var(--amber)">13-15</td></tr>
      <tr><td>30T</td><td class="gt">11-13</td><td class="yt">8-10</td><td style="color:var(--amber)">7-9</td></tr>
      <tr><td>20T</td><td class="gt">7-9</td><td class="yt">5-7</td><td style="color:var(--amber)">4-6</td></tr>
    </tbody></table>
  </div>`;}

// ── CICLOS ──
function rCiclos(b){
  const el=document.getElementById('c-ciclos');
  if(!b){el.innerHTML=empty();return;}
  el.innerHTML=mwHTML(b.n,20,'var(--c2)')+`
  <div class="g3">${[0,1,2].map(i=>{const ci=b.ciclos[i];const mx=Math.max(ci.c1,ci.c2,ci.c3,1);return`
    <div class="cc ${ci.estado}">
      <div class="cc-h">
        <div class="cc-name" style="color:${C[i]}">Docena ${i+1}</div>
        <span class="sig ${eCls(ci.estado)}">${ci.estado}</span>
      </div>
      <div class="cc-bars">${[{l:'C1',v:ci.c1},{l:'C2',v:ci.c2},{l:'C3',v:ci.c3}].map(({l,v})=>`
        <div class="cc-b">
          <div class="cc-bl">${l}</div>
          <div class="cc-bv" style="color:${C[i]}">${v}</div>
          <div class="cc-bt"><div class="cc-bf" style="width:${(v/mx*100).toFixed(0)}%;background:${C[i]}"></div></div>
        </div>`).join('')}</div>
      <div class="cc-f ${ci.fc}">${ci.fBES}</div>
    </div>`;}).join('')}</div>
  <div class="card card-last">
    <div class="ct">ESTADOS Y FÓRMULAS · TABLA DEL EXCEL</div>
    <table class="tbl"><thead><tr><th>Estado</th><th>Condición</th><th>Fórmula FOR BES</th></tr></thead><tbody>
      <tr><td>${sig({t:'EXPLOSION',c:'entry'})}</td><td>C3 > C1+C2</td><td class="gt">🔥 R1 · ENTRAR INMEDIATO</td></tr>
      <tr><td>${sig({t:'CRECIENTE',c:'entry'})}</td><td>C1 &lt; C2 &lt; C3</td><td class="gt">⚡ R2 · ENTRAR</td></tr>
      <tr><td>${sig({t:'REACTIVACION',c:'esperar'})}</td><td>C1>C2, C3>C2</td><td class="yt">⚡ R2 · ENTRAR</td></tr>
      <tr><td>${sig({t:'ESTABLE',c:'esperar'})}</td><td>C1≈C2≈C3</td><td class="yt">⚡ R2 · ENTRAR</td></tr>
      <tr><td>${sig({t:'DECRECIENTE',c:'noentry'})}</td><td>C1>C2>C3</td><td class="rt">⏳ R3 · ESPERAR</td></tr>
      <tr><td>${sig({t:'PELIGROSO',c:'noentry'})}</td><td>C1 >> C2+C3</td><td class="rt">❌ NO ENTRAR</td></tr>
    </tbody></table>
  </div>`;}

// ── DIFERENCIAS ──
function rDif(b){
  const el=document.getElementById('c-diferencias');
  if(!b){el.innerHTML=empty();return;}
  const rows=[['50T ALT-MED',b.difAM50],['50T ALT-BAJ',b.difAB50],['50T MED-BAJ',b.difMB50],['30T ALT-MED',b.difAM30],['30T ALT-BAJ',b.difAB30],['30T MED-BAJ',b.difMB30],['20T ALT-MED',b.difAM20],['20T ALT-BAJ',b.difAB20],['20T MED-BAJ',b.difMB20]];
  el.innerHTML=`
  <div class="g4">${[['50T ALT-MED',b.difAM50],['50T ALT-BAJ',b.difAB50],['30T ALT-MED',b.difAM30],['20T ALT-MED',b.difAM20]].map(([n,v])=>{const s=sDif(v);return`<div class="metric ${s.c==='optima'?'mgreen':s.c==='media'?'mg':'mred'}"><div class="mlbl">${n}</div><div class="mval" style="color:${v<=5?'var(--green)':v<=8?'var(--gold)':'var(--red)'}">${v}</div><div class="msub">${sig(s)}</div></div>`;}).join('')}</div>
  <div class="card card-last">
    <div class="ct">TABLA COMPLETA DE DIFERENCIAS</div>
    <table class="tbl"><thead><tr><th>Diferencia</th><th>Valor</th><th>Umbral Excel</th><th>Estado</th></tr></thead><tbody>
      ${rows.map(([n,v])=>{const s=sDif(v);return`<tr><td class="hl">${n}</td><td style="color:${v<=5?'var(--green)':v<=8?'var(--gold)':'var(--red)'};font-weight:700;font-size:13px">${v}</td><td style="color:var(--t3);font-size:10px">≤5 Óptima · 6-8 Media · >8 Sat</td><td>${sig(s)}</td></tr>`;}).join('')}
    </tbody></table>
  </div>`;}

// ── PORCENTAJES ──
function rPct(b){
  const el=document.getElementById('c-porcentajes');
  if(!b){el.innerHTML=empty();return;}
  el.innerHTML=`
  <div class="g2">
    <div class="card">
      <div class="ct">PORCENTAJES POR DOCENA</div>
      ${[0,1,2].map(i=>`<div class="pb"><div class="pb-row"><span class="pb-name" style="color:${C[i]}">D${i+1} (50T)</span><span class="pb-val">${(b.p50[i]*100).toFixed(1)}% · ${sig(sPct(b.p50[i]))}</span></div><div class="pb-track"><div class="pb-fill" style="width:${(b.p50[i]*100).toFixed(1)}%;background:${C[i]}"></div></div></div>`).join('')}
      <div style="height:1px;background:var(--border);margin:10px 0"></div>
      <div class="ct">PORCENTAJES 30T</div>
      ${[0,1,2].map(i=>`<div class="pb"><div class="pb-row"><span class="pb-name" style="color:${C[i]}88">D${i+1} (30T)</span><span class="pb-val">${(b.p30[i]*100).toFixed(1)}%</span></div><div class="pb-track"><div class="pb-fill" style="width:${(b.p30[i]*100).toFixed(1)}%;background:${C[i]}88"></div></div></div>`).join('')}
    </div>
    <div class="card">
      <div class="ct">SUMA ALTA + MEDIA</div>
      <div style="text-align:center;padding:20px 0">
        <div style="font-family:var(--ft);font-size:46px;font-weight:800;color:${sSuma(b.sumaAM).c==='entry'?'var(--green)':'var(--red)'}">${(b.sumaAM*100).toFixed(1)}%</div>
        <div style="margin-top:8px">${sig(sSuma(b.sumaAM))}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:8px;font-family:var(--fm)">Zona ENTRY: 65% – 77%<br>D${b.iA+1} + D${b.iM+1}</div>
      </div>
      <div style="height:1px;background:var(--border);margin:10px 0"></div>
      <table class="tbl"><thead><tr><th>Rango %</th><th>Señal</th><th>Descripción</th></tr></thead><tbody>
        <tr><td class="gt">20%-34%</td><td>${sig({t:'ENTRY',c:'entry'})}</td><td style="color:var(--t2)">≤2 separados · Ideal</td></tr>
        <tr><td class="yt">34%-42%</td><td>${sig({t:'CUIDADO',c:'esperar'})}</td><td style="color:var(--t2)">3-4 dispersos · Precaución</td></tr>
        <tr><td class="rt">&gt;42%</td><td>${sig({t:'NO ENTRY',c:'noentry'})}</td><td style="color:var(--t2)">5+ juntos · Saturación</td></tr>
      </tbody></table>
    </div>
  </div>`;}

// ── TABLERO ──
function rTablero(b){
  const el=document.getElementById('c-tablero');
  const nf=b?b.nf:{};const maxF=b?Math.max(...Object.values(nf),1):1;
  el.innerHTML=`
  <div class="g21">
    <div class="card">
      <div class="ct">TABLERO · Clic para registrar un número</div>
      <div class="ngrid" id="ngrid"></div>
      <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap">
        ${[[C[0],'D1 1-12'],[C[1],'D2 13-24'],[C[2],'D3 25-36'],['#ff8888','Rojo'],['#8899bb','Negro'],['#60f090','Cero']].map(([c,l])=>`<span style="font-size:10px;color:var(--t3)"><span style="color:${c}">■</span> ${l}</span>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="ct">TOP FRECUENTES</div>
      ${b&&b.topN.length?b.topN.map(([n,f])=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
        <div class="tc ${parseInt(n)===0?'z':RED.has(parseInt(n))?'r':'b'}" style="flex-shrink:0;cursor:pointer" onclick="addD(${n})">${n}</div>
        <div style="flex:1"><div class="pb-track"><div class="pb-fill" style="width:${(f/b.topN[0][1]*100).toFixed(0)}%;background:var(--c1)"></div></div></div>
        <span style="font-family:var(--fm);font-size:11px;color:var(--t2);width:22px;text-align:right">${f}×</span>
      </div>`).join(''):'<div style="color:var(--t3);font-size:11px">Sin datos aún</div>'}
      <div style="height:1px;background:var(--border);margin:10px 0"></div>
      <div class="ct">ÚLTIMAS 15</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${T.slice(-15).map(n=>`<div class="tc ${n===0?'z':RED.has(n)?'r':'b'}">${n}</div>`).join('')}
      </div>
    </div>
  </div>`;
  // Build grid
  const g=document.getElementById('ngrid');if(!g)return;g.innerHTML='';
  for(let n=0;n<=36;n++){const f=nf[n]||0;const hot=f>0&&f>=maxF*.5;
    const cls=n===0?'z':RED.has(n)?'r':'b';const div=document.createElement('div');
    div.className=`nc ${cls}${hot?' hot':''}`;div.title=`${n} · ${f}×`;
    div.innerHTML=n+(f>0?`<span class="hc">${f}</span>`:'');
    if(f>0)div.style.opacity=0.35+0.65*(f/maxF);
    div.onclick=()=>addD(n);g.appendChild(div);}}

// ── GRÁFICA ──
function rGrafica(b){
  const el=document.getElementById('c-grafica');
  if(!b){el.innerHTML=empty();return;}
  el.innerHTML=`<div class="card"><div class="ct">EVOLUCIÓN DE FRECUENCIAS</div><div class="cwrap" style="height:260px"><canvas id="chEvol"></canvas></div></div>
  <div class="card card-last"><div class="ct">PORCENTAJES EN EL TIEMPO</div><div class="cwrap" style="height:220px"><canvas id="chPct"></canvas></div></div>`;
  setTimeout(()=>{
    const copts={responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#7a8fb0',font:{family:'Space Grotesk',size:10},padding:8}}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#3a5068',font:{size:9}}},
              y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#3a5068',font:{size:9}}}}};
    const pts=[],d1=[],d2=[],d3=[];
    const step=Math.max(1,Math.floor(b.n/20));
    for(let i=Math.min(5,b.n);i<=b.n;i+=step){const f=fD(T.slice(0,i));pts.push(i);d1.push(f[0]);d2.push(f[1]);d3.push(f[2]);}
    if(charts.ev)charts.ev.destroy();
    charts.ev=new Chart(document.getElementById('chEvol'),{type:'line',data:{labels:pts,datasets:[
      {label:'D1',data:d1,borderColor:'#00d4ff',backgroundColor:'rgba(0,212,255,.06)',tension:.4,pointRadius:2,fill:true},
      {label:'D2',data:d2,borderColor:'#7b61ff',tension:.4,pointRadius:2},
      {label:'D3',data:d3,borderColor:'#ff6b35',tension:.4,pointRadius:2}]},options:copts});
    if(charts.pc)charts.pc.destroy();
    charts.pc=new Chart(document.getElementById('chPct'),{type:'line',data:{labels:pts,datasets:[
      {label:'D1 %',data:d1.map((v,i)=>pts[i]?v/pts[i]*100:0),borderColor:'#00d4ff',tension:.4,pointRadius:0},
      {label:'D2 %',data:d2.map((v,i)=>pts[i]?v/pts[i]*100:0),borderColor:'#7b61ff',tension:.4,pointRadius:0},
      {label:'D3 %',data:d3.map((v,i)=>pts[i]?v/pts[i]*100:0),borderColor:'#ff6b35',tension:.4,pointRadius:0},
      {label:'33%',data:pts.map(()=>33.3),borderColor:'rgba(255,255,255,.2)',borderDash:[4,4],pointRadius:0}]},options:copts});
  },50);}

// ── MARTINGALA ──
function rMart(){
  const el=document.getElementById('c-martingala');
  el.innerHTML=`
  <div class="g2">
    <div class="card">
      <div class="ct">FRENOS DEL EXCEL</div>
      <table class="tbl"><thead><tr><th>Apuesta</th><th>Señal</th></tr></thead><tbody>
        ${[[5,'nd','NORMAL'],[10,'nd','NORMAL'],[20,'nd','NORMAL'],[40,'esperar','FRENO'],[80,'esperar','POSIBLE FRENO'],[160,'sat','POSIBLE FRENO']].map(([v,c,t])=>`<tr><td class="hl">${v}</td><td>${sig({t,c})}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="card">
      <div class="ct">CALCULADORA</div>
      <div style="margin-bottom:12px"><div style="font-size:11px;color:var(--t3);margin-bottom:5px">Apuesta base (€)</div>
        <input type="number" id="MB" value="5" min="1" style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;color:var(--t1);font-family:var(--fm);font-size:16px;padding:7px 10px;width:100%;outline:none" oninput="cMart()">
      </div>
      <div id="MR" style="display:flex;flex-direction:column;gap:6px"></div>
    </div>
  </div>`;cMart();}

function cMart(){
  const base=parseFloat(document.getElementById('MB')?.value)||5;
  const el=document.getElementById('MR');if(!el)return;
  const levels=['NORMAL','NORMAL','NORMAL','FRENO','POSIBLE FRENO','PELIGRO'];
  const cls=['nd','nd','nd','esperar','esperar','noentry'];
  el.innerHTML=Array.from({length:6},(_,i)=>{const a=base*Math.pow(2,i);
    return`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg2);border-radius:7px;border:1px solid var(--border)">
      <span style="font-size:11px;color:var(--t2)">Pérdida #${i+1}</span>
      <span style="font-family:var(--fm);font-size:14px;font-weight:700;color:${i>=3?'var(--red)':'var(--c1)'}">€${a.toFixed(0)}</span>
      ${sig({t:levels[i],c:cls[i]})}
    </div>`;}).join('');}

// ── HISTORIAL ──
function rHistorial(){
  const el=document.getElementById('c-historial');
  const conDatos = HIST.filter(h=>h.resultado!=='sin_datos');
  const gan  = HIST.filter(h=>h.resultado==='ganado').length;
  const per  = HIST.filter(h=>h.resultado==='perdido').length;
  const sd   = HIST.filter(h=>h.resultado==='sin_datos').length;
  const total= gan+per;
  const wr   = total>0?((gan/total)*100).toFixed(1):'—';
  const racha= calcRacha();

  el.innerHTML=`
  <div class="hist-stats">
    <div class="hstat"><div class="hstat-lbl">Total tiros</div><div class="hstat-val" style="color:var(--c1)">${HIST.length}</div></div>
    <div class="hstat"><div class="hstat-lbl">✅ Ganados</div><div class="hstat-val" style="color:var(--green)">${gan}</div></div>
    <div class="hstat"><div class="hstat-lbl">❌ Perdidos</div><div class="hstat-val" style="color:var(--red)">${per}</div></div>
    <div class="hstat"><div class="hstat-lbl">Win Rate</div><div class="hstat-val" style="color:${parseFloat(wr)>=50?'var(--green)':'var(--red)'}">${wr}${total>0?'%':''}</div></div>
    <div class="hstat"><div class="hstat-lbl">Racha actual</div><div class="hstat-val" style="color:${racha.tipo==='G'?'var(--green)':racha.tipo==='P'?'var(--red)':'var(--t3)'}">${racha.tipo==='G'?'✅':racha.tipo==='P'?'❌':'—'}${racha.n>0?' ×'+racha.n:''}</div></div>
    <div class="hstat"><div class="hstat-lbl">Sin datos previos</div><div class="hstat-val" style="color:var(--t3)">${sd}</div></div>
  </div>

  <div style="background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.15);border-radius:9px;padding:10px 14px;margin-bottom:14px;font-size:11px;color:var(--t2);font-family:var(--fm)">
    ℹ️ <strong style="color:var(--c1)">GANADO</strong> = el número cayó en cualquiera de las <strong>2 docenas recomendadas</strong> por el sistema en ese momento. Se registra siempre, sin importar la señal.
  </div>

  ${HIST.length===0?`<div style="text-align:center;padding:40px 20px;color:var(--t3)">
    <div style="font-size:36px;margin-bottom:10px;opacity:.35">📋</div>
    <div style="font-size:13px">Aún no hay tiradas registradas</div>
    <div style="font-size:11px;margin-top:5px;font-family:var(--fm)">Ingresa números desde la barra superior</div>
  </div>`:`
  <div class="hist-toggle">
    <div class="ht-btn active" id="hf-all"   onclick="hFilter('all')">Todas (${HIST.length})</div>
    <div class="ht-btn"        id="hf-gan"   onclick="hFilter('ganado')">✅ Ganadas (${gan})</div>
    <div class="ht-btn"        id="hf-per"   onclick="hFilter('perdido')">❌ Perdidas (${per})</div>
  </div>
  <div id="hist-list">${buildHistList('all')}</div>`}`;
}

function calcRacha(){
  const validos=[...HIST].filter(h=>h.resultado==='ganado'||h.resultado==='perdido').reverse();
  if(!validos.length) return {tipo:null,n:0};
  const tipo=validos[0].resultado==='ganado'?'G':'P';
  let n=0;
  for(const h of validos){
    if((h.resultado==='ganado'&&tipo==='G')||(h.resultado==='perdido'&&tipo==='P')) n++;
    else break;
  }
  return {tipo,n};
}

let histFilter='all';
function hFilter(f){
  histFilter=f;
  ['all','gan','per'].forEach(x=>{
    const el=document.getElementById('hf-'+x);
    if(el) el.className='ht-btn'+(x===f?' active':'');
  });
  document.getElementById('hist-list').innerHTML=buildHistList(f);
}

function buildHistList(f){
  let items=[...HIST].reverse();
  if(f==='ganado')  items=items.filter(h=>h.resultado==='ganado');
  else if(f==='perdido') items=items.filter(h=>h.resultado==='perdido');
  if(!items.length) return`<div style="text-align:center;padding:20px;color:var(--t3);font-size:12px">No hay tiradas en este filtro</div>`;

  return items.map(h=>{
    const cls=h.num===0?'z':RED.has(h.num)?'r':'b';
    const dname=h.docena===0?'Cero':h.docena===1?'D1':h.docena===2?'D2':'D3';
    const rango=h.docena===0?'—':h.docena===1?'1-12':h.docena===2?'13-24':'25-36';
    const recTxt=h.recD1&&h.recD2?`Rec: D${h.recD1} + D${h.recD2}`:'Primeros tiros';
    const sigColor=h.señal==='ENTRY'?'var(--green)':h.señal==='ESPERAR'?'var(--gold)':h.señal==='SIN DATOS'?'var(--t3)':'var(--red)';

    let resHTML, rowBorder='var(--border)', rowBg='var(--bg2)';
    if(h.resultado==='ganado'){
      resHTML=`<span class="hist-res ganado">✅ GANADO</span>`;
      rowBorder='rgba(0,230,118,.25)'; rowBg='rgba(0,230,118,.03)';
    } else if(h.resultado==='perdido'){
      resHTML=`<span class="hist-res perdido">❌ PERDIDO</span>`;
      rowBorder='rgba(255,68,85,.2)'; rowBg='rgba(255,68,85,.03)';
    } else {
      resHTML=`<span class="hist-res noregistrado">— Sin datos</span>`;
    }

    return`<div class="hist-row" style="border-color:${rowBorder};background:${rowBg}">
      <div class="hist-num ${cls}">${h.num}</div>
      <div class="hist-info">
        <div class="hist-doc">
          <strong style="color:var(--t1)">${dname}</strong>
          <span style="color:var(--t3)"> ${rango}</span>
          · Tiro <strong style="color:var(--c1)">#${h.idx+1}</strong>
          · Señal: <strong style="color:${sigColor}">${h.señal}</strong>
        </div>
        <div class="hist-idx">${recTxt} · ${h.ts}</div>
      </div>
      <div class="hist-res">${resHTML}</div>
    </div>`;
  }).join('');
}

// ════ REINICIAR ════
function reiniciar(){
  if(!confirm('¿Reiniciar todo? Se borrarán todos los números e historial.')) return;
  T=[];HIST=[];prevDec=null;charts={};
  renderAll();
  toast('↺ Sistema reiniciado','Todos los datos han sido limpiados');
}

// ════ LÓGICA DE EVALUACIÓN AUTOMÁTICA ════
// Captura las 2 docenas recomendadas ANTES del tiro y evalúa si el número cayó en ellas.
// GANADO = cayó en D recomendada 1 o 2, sin importar la señal.
function evalResultado(numCaido, señalPrevia, docRec1, docRec2) {
  const docCaida = numCaido===0 ? 0 : numCaido<=12 ? 1 : numCaido<=24 ? 2 : 3;
  if (!señalPrevia || señalPrevia.dec === 'SIN DATOS' || !docRec1) return 'sin_datos';
  // El cero no cuenta como ninguna docena → perdido
  if (docCaida === 0) return 'perdido';
  if (docCaida === docRec1 || docCaida === docRec2) return 'ganado';
  return 'perdido';
}

// ════ INPUT ════
function addN(){
  const inp=document.getElementById('NI');const val=parseInt(inp.value);
  if(isNaN(val)||val<0||val>36){inp.style.borderColor='var(--red)';setTimeout(()=>inp.style.borderColor='',500);return;}

  // 1) Capturar señal ANTES de agregar el número
  const bPrev = calc();
  const dgPrev = bPrev ? decision(bPrev) : null;
  const recD1 = bPrev ? bPrev.iA+1 : null; // docena alta
  const recD2 = bPrev ? bPrev.iM+1 : null; // docena media

  // 2) Agregar número
  const idx = T.length;
  T.push(val);
  const doc = val===0?0:val<=12?1:val<=24?2:3;
  const now = new Date();
  const ts = now.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

  // 3) Evaluar resultado automáticamente
  const resultado = evalResultado(val, dgPrev, recD1, recD2);

  HIST.push({
    idx, num:val, docena:doc, ts,
    señal: dgPrev ? dgPrev.dec : 'SIN DATOS',
    recD1, recD2, resultado
  });

  inp.value=''; inp.focus();
  renderAll();

  // 4) Toast si cambia señal
  const bNext=calc();
  if(bPrev&&bNext){const d1=decision(bPrev),d2=decision(bNext);if(d1.dec!==d2.dec)toast(`→ Señal: ${d2.dec}`,d2.sub);}

  // 5) Toast resultado del tiro
  if(resultado==='ganado') toast(`✅ Tiro #${idx+1} · GANADO`,`Número ${val} · D${doc} estaba recomendada`);
  else if(resultado==='perdido') toast(`❌ Tiro #${idx+1} · PERDIDO`,`Número ${val} · D${doc} · Se recomendaba D${recD1}+D${recD2}`);
  else if(resultado==='sin_datos') toast(`⏭ Tiro #${idx+1}`,`Sin datos previos suficientes para evaluar`);
}

function addD(n){
  const bPrev = calc();
  const dgPrev = bPrev ? decision(bPrev) : null;
  const recD1 = bPrev ? bPrev.iA+1 : null;
  const recD2 = bPrev ? bPrev.iM+1 : null;
  const idx = T.length;
  T.push(n);
  const doc = n===0?0:n<=12?1:n<=24?2:3;
  const now = new Date();
  const ts = now.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const resultado = evalResultado(n, dgPrev, recD1, recD2);
  HIST.push({idx,num:n,docena:doc,ts,señal:dgPrev?dgPrev.dec:'SIN DATOS',recD1,recD2,resultado});
  renderAll();
}

function undo(){if(!T.length)return;T.pop();HIST.pop();renderAll();}
function clearAll(){if(T.length&&!confirm('¿Limpiar todas las tiradas?'))return;T=[];HIST=[];prevDec=null;renderAll();}
function paste(){
  const raw=document.getElementById('PI').value;
  const nums=raw.split(/[\s,;|\/\\]+/).map(s=>parseInt(s.trim())).filter(n=>!isNaN(n)&&n>=0&&n<=36);
  if(!nums.length){toast('Error','No hay números válidos (0–36)');return;}
  const now=new Date();
  nums.forEach(n=>{
    const bPrev=calc();
    const dgPrev=bPrev?decision(bPrev):null;
    const recD1=bPrev?bPrev.iA+1:null;
    const recD2=bPrev?bPrev.iM+1:null;
    const idx=T.length;T.push(n);
    const doc=n===0?0:n<=12?1:n<=24?2:3;
    const ts=now.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const resultado=evalResultado(n,dgPrev,recD1,recD2);
    HIST.push({idx,num:n,docena:doc,ts,señal:dgPrev?dgPrev.dec:'SIN DATOS',recD1,recD2,resultado});
  });
  document.getElementById('PI').value='';renderAll();
  toast(`✓ ${nums.length} números cargados`,`Total: ${T.length} tiradas`);
}

// ════ NAV ════
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
  else if(page==='tablero')rTablero(b);
  else if(page==='grafica')rGrafica(b);
  else if(page==='martingala')rMart();
  else if(page==='historial')rHistorial();
  sbClose();
}
function sbOpen(){document.getElementById('sb').classList.add('open');document.getElementById('ov').classList.add('open');}
function sbClose(){document.getElementById('sb').classList.remove('open');document.getElementById('ov').classList.remove('open');}

// ════ TOAST ════
let tT;
function toast(title,body){
  document.getElementById('tt').textContent=title;document.getElementById('tb').textContent=body;
  const t=document.getElementById('toast');t.classList.add('show');
  clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('show'),4000);}

// INIT
document.addEventListener('DOMContentLoaded',()=>{
  renderAll();document.getElementById('NI').focus();
  document.getElementById('PI').addEventListener('keydown',e=>{if(e.key==='Enter')paste();});
});