const permanent={upper:['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'],lower:['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38']};
const primary={upper:['55','54','53','52','51','61','62','63','64','65'],lower:['85','84','83','82','81','71','72','73','74','75']};
const conditionDefs={
 caries:{label:'Caries',color:'#df4b45'},restoration:{label:'Obturación',color:'#2f7de1'},crown:{label:'Corona',color:'#c9a552'},
 endo:{label:'Endodoncia',color:'#8057c9'},implant:{label:'Implante',color:'#71797c'},sealant:{label:'Sellador',color:'#43b6ad'},
 extraction:{label:'Extracción indicada',color:'#e5823d'},fracture:{label:'Fractura',color:'#f0b927'},missing:{label:'Ausente',color:'#555d60'},healthy:{label:'Sano',color:'#2faa63'}
};
const surfaceLabels={m:'Mesial',d:'Distal',v:'Vestibular',l:'Palatino/Lingual',o:'Oclusal/Incisal'};
const perioSites=[['mb','MV'],['b','V'],['db','DV'],['ml','MP/ML'],['l','P/L'],['dl','DP/DL']];
let state={screen:'home',dentition:'permanent',explorationDentition:'permanent',activePatientId:null,selectedTooth:null,selectedSurfaces:new Set(),selectedCondition:'caries',dictationParsed:[],perioTooth:'16',explorationTooth:'16'};
let deferredPrompt=null,dbCache=[];
const $=id=>document.getElementById(id);const $$=sel=>[...document.querySelectorAll(sel)];

function uid(){return crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}
function escapeHtml(s=''){return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2300)}
function ageFromBirth(b){if(!b)return '';const d=new Date(b+'T00:00:00'),now=new Date();let a=now.getFullYear()-d.getFullYear();const m=now.getMonth()-d.getMonth();if(m<0||(m===0&&now.getDate()<d.getDate()))a--;return `${a} años`}
function getTeeth(d=state.dentition){return d==='primary'?primary:permanent}
function allTeeth(d=state.dentition){const t=getTeeth(d);return [...t.upper,...t.lower]}
function getPatient(){return dbCache.find(p=>p.id===state.activePatientId)||null}
function ensurePatientData(p){
 if(!p.chart)p.chart={permanent:{},primary:{},updatedAt:new Date().toISOString(),history:[]};
 if(!p.chart.permanent)p.chart.permanent={};if(!p.chart.primary)p.chart.primary={};if(!p.chart.history)p.chart.history=[];
 if(!p.exploration)p.exploration={permanent:{},primary:{}};if(!p.exploration.permanent)p.exploration.permanent={};if(!p.exploration.primary)p.exploration.primary={};
 if(!p.perio)p.perio={permanent:{},history:[]};if(!p.perio.permanent)p.perio.permanent={};if(!p.perio.history)p.perio.history=[];
 return p;
}
function addHistory(p,entry){ensurePatientData(p);p.chart.history.push({id:uid(),date:new Date().toISOString(),...entry})}

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('goldent-odontograma',3);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('patients'))db.createObjectStore('patients',{keyPath:'id'});if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings',{keyPath:'key'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function loadPatients(){const db=await openDB(),tx=db.transaction('patients','readonly'),req=tx.objectStore('patients').getAll();dbCache=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result||[]);req.onerror=()=>rej(req.error)});dbCache.forEach(ensurePatientData);dbCache.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));renderPatients()}
async function savePatientRecord(p){ensurePatientData(p);p.updatedAt=new Date().toISOString();const db=await openDB(),tx=db.transaction('patients','readwrite');tx.objectStore('patients').put(p);await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});const i=dbCache.findIndex(x=>x.id===p.id);if(i>=0)dbCache[i]=p;else dbCache.unshift(p);dbCache.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));renderPatients();renderActivePatient()}
async function loadSettings(){const db=await openDB(),tx=db.transaction('settings','readonly'),req=tx.objectStore('settings').get('doctor');return await new Promise(res=>{req.onsuccess=()=>res(req.result?.value||'Dr. Shadrach');req.onerror=()=>res('Dr. Shadrach')})}
async function saveSetting(k,v){const db=await openDB(),tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({key:k,value:v});return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}

function navigate(screen){
 state.screen=screen;$$('.screen').forEach(s=>s.classList.toggle('active',s.dataset.screen===screen));
 const bottomTarget=['chart','perio','exploration'].includes(screen)?'chart':screen;$$('.bottom-nav [data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===bottomTarget));
 window.scrollTo({top:0,behavior:'smooth'});
 if(screen==='chart')renderOdontogram();if(screen==='perio')renderPerio();if(screen==='exploration')renderExploration();if(screen==='history')renderHistory();
}
$$('[data-nav]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.nav)));

function patientRow(p){const row=document.createElement('div');row.className='patient-row';const age=ageFromBirth(p.birth);row.innerHTML=`<div class="patient-avatar">${(p.name||'?').trim().charAt(0).toUpperCase()}</div><div class="meta"><b>${escapeHtml(p.name||'Sin nombre')}</b><small>${escapeHtml(p.record||'Sin expediente')} ${age?'· '+age:''}${p.sex?' · '+escapeHtml(p.sex):''}</small></div><div class="row-actions"><button data-open>Clínica</button></div>`;row.querySelector('[data-open]').onclick=()=>{state.activePatientId=p.id;renderActivePatient();navigate('chart')};return row}
function filterPatients(){const q=($('patientSearch')?.value||'').trim().toLowerCase();return !q?dbCache:dbCache.filter(p=>(p.name||'').toLowerCase().includes(q)||(p.record||'').toLowerCase().includes(q))}
function renderPatients(){const recent=$('recentPatients'),all=$('allPatients');recent.innerHTML='';all.innerHTML='';const filtered=filterPatients();if(!dbCache.length){recent.innerHTML='<div class="empty-card">Aún no hay pacientes. Crea el primero para iniciar el expediente.</div>';all.innerHTML=recent.innerHTML;return}dbCache.slice(0,4).forEach(p=>recent.appendChild(patientRow(p)));if(!filtered.length)all.innerHTML='<div class="empty-card">No encontramos pacientes con esa búsqueda.</div>';else filtered.forEach(p=>all.appendChild(patientRow(p)))}
$('patientSearch').addEventListener('input',renderPatients);

function openPatientDialog(edit=false){const p=edit?getPatient():null;$('patientDialogTitle').textContent=p?'Editar paciente':'Nuevo paciente';$('patientInternalId').value=p?.id||'';$('patientNameInput').value=p?.name||'';$('patientRecordInput').value=p?.record||'';$('patientBirthInput').value=p?.birth||'';$('patientSexInput').value=p?.sex||'';$('patientPhoneInput').value=p?.phone||'';$('patientDialog').showModal()}
$('newPatientBtn').onclick=()=>openPatientDialog(false);$('newPatientBtn2').onclick=()=>openPatientDialog(false);$('editPatientBtn').onclick=()=>getPatient()?openPatientDialog(true):openPatientDialog(false);
$('closePatientDialogBtn').onclick=()=>$('patientDialog').close();$('cancelPatientBtn').onclick=()=>$('patientDialog').close();
$('patientForm').addEventListener('submit',async e=>{e.preventDefault();const name=$('patientNameInput').value.trim();if(!name){toast('Escribe el nombre del paciente.');return}const id=$('patientInternalId').value||uid(),existing=dbCache.find(p=>p.id===id);const p={...(existing||{}),id,name,record:$('patientRecordInput').value.trim(),birth:$('patientBirthInput').value,sex:$('patientSexInput').value,phone:$('patientPhoneInput').value.trim(),createdAt:existing?.createdAt||new Date().toISOString()};ensurePatientData(p);await savePatientRecord(p);state.activePatientId=id;$('patientDialog').close();renderActivePatient();navigate('chart');toast('Paciente guardado')});
function renderActivePatient(){const p=getPatient();const name=p?.name||'Sin paciente seleccionado';const meta=p?[p.record&&`Exp. ${p.record}`,ageFromBirth(p.birth),p.sex].filter(Boolean).join(' · '):'Crea o selecciona un paciente para comenzar.';$('activePatientName').textContent=name;$('activePatientMeta').textContent=meta||'Expediente activo';$('perioPatientName').textContent=name;$('explorationPatientName').textContent=name}

function toothDescription(n){const num=Number(n[1]),quad=Number(n[0]),primaryMode=quad>=5;const pos=primaryMode?{1:'incisivo central',2:'incisivo lateral',3:'canino',4:'primer molar',5:'segundo molar'}:{1:'incisivo central',2:'incisivo lateral',3:'canino',4:'primer premolar',5:'segundo premolar',6:'primer molar',7:'segundo molar',8:'tercer molar'};const arch=[1,2,5,6].includes(quad)?'superior':'inferior',side=[1,4,5,8].includes(quad)?'derecho':'izquierdo';return `${pos[num]||'pieza'} ${arch} ${side}`}
function toothType(n){const d=Number(n[1]);if(d<=2)return'incisor';if(d===3)return'canine';if(d===4||d===5)return Number(n[0])>=5?'molar':'premolar';return'molar'}
function latestSurfaceColor(records,s){const rec=[...(records||[])].reverse().find(r=>(r.surfaces||[]).includes(s));return rec?conditionDefs[rec.condition]?.color:null}
function hasCondition(records,c){return (records||[]).some(r=>r.condition===c)}
function toothSvgMarkup(num,records=[]){
 const type=toothType(num);let root='',crown='';
 if(type==='incisor'){root='M27 39 Q31 73 35 88 Q39 73 43 39 Z';crown='M20 10 Q35 4 50 10 L47 36 Q35 43 23 36 Z'}
 else if(type==='canine'){root='M25 40 Q31 76 35 90 Q40 76 45 40 Z';crown='M18 24 Q25 9 35 4 Q45 9 52 24 L47 39 Q35 46 23 39 Z'}
 else if(type==='premolar'){root='M23 40 Q27 71 30 88 L35 70 L40 88 Q44 71 47 40 Z';crown='M14 21 Q22 7 31 15 Q35 4 39 15 Q48 7 56 21 L51 40 Q35 47 19 40 Z'}
 else{root='M17 41 Q20 68 25 86 L31 62 L35 90 L40 62 L47 86 Q51 68 53 41 Z';crown='M10 23 Q15 9 25 15 Q31 4 35 15 Q40 4 46 15 Q56 9 60 23 L55 42 Q35 49 15 42 Z'}
 const zone=(s,d)=>{const c=latestSurfaceColor(records,s);return c?`<path class="tooth-status-zone" d="${d}" fill="${c}"/>`:''};
 const zones=zone('v','M23 21 Q35 14 47 21 L44 27 Q35 24 26 27 Z')+zone('m','M22 22 L27 28 L27 36 L22 38 Q18 31 22 22 Z')+zone('o','M27 28 Q35 24 43 28 L43 35 Q35 38 27 35 Z')+zone('d','M48 22 Q52 31 48 38 L43 35 L43 28 Z')+zone('l','M27 35 Q35 38 43 35 L46 40 Q35 44 24 40 Z');
 const endo=hasCondition(records,'endo')?'<path class="root-canal" d="M35 39 Q35 60 35 82"/>':'';
 const implant=hasCondition(records,'implant')?'<path d="M29 43 L41 43 L39 78 L31 78 Z" fill="#8a9290"/><path d="M28 50 H42 M29 58 H41 M30 66 H40 M31 74 H39" stroke="#fff" stroke-width="1"/>':'';
 const crownFill=hasCondition(records,'crown')?'#ead28c':'#fffdfa';
 return `<path class="tooth-root" d="${root}"/>${implant}<path class="tooth-crown" d="${crown}" style="fill:${crownFill}"/>${zones}${endo}`;
}
function renderOdontogram(){renderActivePatient();const teeth=getTeeth();renderArch($('upperArch'),teeth.upper);renderArch($('lowerArch'),teeth.lower);renderToothEditor()}
function renderArch(container,list){container.innerHTML='';const p=getPatient(),chart=p?ensurePatientData(p).chart[state.dentition]:{};list.forEach(num=>{const node=$('toothTemplate').content.firstElementChild.cloneNode(true);node.dataset.tooth=num;node.querySelector('.tooth-number').textContent=num;if(state.selectedTooth===num)node.classList.add('selected');const records=chart?.[num]?.records||[];if(hasCondition(records,'missing'))node.classList.add('has-missing');node.querySelector('.tooth-svg').innerHTML=toothSvgMarkup(num,records);const conditions=[...new Set(records.map(r=>r.condition))],badges=node.querySelector('.tooth-badges');conditions.slice(0,4).forEach(c=>{const b=document.createElement('i');b.className='badge-dot';b.style.background=conditionDefs[c]?.color||'#777';badges.appendChild(b)});node.onclick=()=>{if(!p){toast('Primero selecciona o crea un paciente.');return}state.selectedTooth=num;state.selectedSurfaces=new Set();const latest=records.at(-1);state.selectedCondition=latest?.condition||'caries';$('toothNote').value=latest?.note||'';renderOdontogram()};container.appendChild(node)})}
function buildConditionGrid(){const g=$('conditionGrid');g.innerHTML='';Object.entries(conditionDefs).forEach(([key,d])=>{const b=document.createElement('button');b.type='button';b.className='condition-btn';b.dataset.condition=key;b.innerHTML=`<i class="swatch" style="background:${d.color}"></i>${d.label}`;b.onclick=()=>{state.selectedCondition=key;renderConditionSelection()};g.appendChild(b)});renderConditionSelection();const lg=$('fullLegend');lg.innerHTML='';Object.entries(conditionDefs).forEach(([,d])=>{const el=document.createElement('div');el.className='legend-entry';el.innerHTML=`<i style="background:${d.color}"></i><span>${d.label}</span>`;lg.appendChild(el)})}
function renderConditionSelection(){$$('.condition-btn').forEach(b=>b.classList.toggle('selected',b.dataset.condition===state.selectedCondition))}
function renderToothEditor(){const has=!!state.selectedTooth;$('emptyToothState').hidden=has;$('toothEditor').hidden=!has;if(!has)return;$('selectedToothNumber').textContent=state.selectedTooth;$('selectedToothLabel').textContent=toothDescription(state.selectedTooth);$$('.surface-zone').forEach(z=>z.classList.toggle('selected',state.selectedSurfaces.has(z.dataset.surface)));renderConditionSelection()}
$$('.surface-zone').forEach(z=>{const toggle=()=>{const s=z.dataset.surface;state.selectedSurfaces.has(s)?state.selectedSurfaces.delete(s):state.selectedSurfaces.add(s);renderToothEditor()};z.addEventListener('click',toggle);z.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}})});
function neighborTooth(step){const all=allTeeth();const i=all.indexOf(state.selectedTooth);if(i<0)return;state.selectedTooth=all[(i+step+all.length)%all.length];state.selectedSurfaces=new Set();renderOdontogram()}
$('prevToothBtn').onclick=()=>neighborTooth(-1);$('nextToothBtn').onclick=()=>neighborTooth(1);
$('saveToothBtn').onclick=async()=>{const p=getPatient();if(!p||!state.selectedTooth)return;ensurePatientData(p);const bucket=p.chart[state.dentition],surfaces=[...state.selectedSurfaces],note=$('toothNote').value.trim(),now=new Date().toISOString();if(state.selectedCondition==='healthy')bucket[state.selectedTooth]={records:[{id:uid(),condition:'healthy',surfaces:[],note,createdAt:now}]};else{const existing=bucket[state.selectedTooth]?.records||[],rec={id:uid(),condition:state.selectedCondition,surfaces,note,createdAt:now};bucket[state.selectedTooth]={records:[...existing.filter(r=>r.condition!=='healthy'),rec]}}p.chart.updatedAt=now;addHistory(p,{dentition:state.dentition,tooth:state.selectedTooth,summary:`${conditionDefs[state.selectedCondition].label}${surfaces.length?' · '+surfaces.map(s=>surfaceLabels[s]).join(', '):''}${note?' · '+note:''}`});await savePatientRecord(p);state.selectedSurfaces=new Set();renderOdontogram();toast('Hallazgo guardado')};
$('clearToothBtn').onclick=async()=>{const p=getPatient();if(!p||!state.selectedTooth)return;delete p.chart[state.dentition][state.selectedTooth];addHistory(p,{dentition:state.dentition,tooth:state.selectedTooth,summary:'Registro odontológico limpiado'});await savePatientRecord(p);$('toothNote').value='';state.selectedSurfaces=new Set();renderOdontogram();toast('Pieza limpiada')};
$$('[data-dentition]').forEach(b=>b.onclick=()=>{state.dentition=b.dataset.dentition;state.selectedTooth=null;state.selectedSurfaces=new Set();$$('[data-dentition]').forEach(x=>x.classList.toggle('active',x===b));renderOdontogram()});
$('showLegendBtn').onclick=()=>$('legendDialog').showModal();
$('openExplorationForTooth').onclick=()=>{if(!state.selectedTooth)return;state.explorationDentition=state.dentition;state.explorationTooth=state.selectedTooth;syncExplorationDentitionTabs();navigate('exploration')};

/* Periodontograma */
function perioRecord(p,tooth){ensurePatientData(p);return p.perio.permanent[tooth]||null}
function depthColor(d){if(!d)return'#c8d1cc';if(d<=3)return'#2faa63';if(d<=5)return'#d49a35';return'#df4b45'}
function renderPerio(){renderActivePatient();const p=getPatient();if(!permanent.upper.includes(state.perioTooth)&&!permanent.lower.includes(state.perioTooth))state.perioTooth='16';renderPerioTeeth();renderPerioEditor();renderPerioCharts();const done=p?Object.values(p.perio.permanent).filter(r=>Object.values(r.sites||{}).some(s=>Number(s.depth)>0)).length:0;$('perioCompletion').textContent=`${done} / 32`}
function renderPerioTeeth(){const box=$('perioTeeth');box.innerHTML='';const p=getPatient();[...permanent.upper,...permanent.lower].forEach((n,i)=>{if(i===16){const br=document.createElement('span');br.style.gridColumn='1/-1';br.style.height='2px';br.style.background='#d8dfd9';box.appendChild(br)}const b=document.createElement('button');b.type='button';b.className='perio-tooth-btn';b.textContent=n;if(n===state.perioTooth)b.classList.add('active');if(p&&perioRecord(p,n)&&Object.values(perioRecord(p,n).sites||{}).some(s=>Number(s.depth)>0))b.classList.add('done');b.onclick=()=>{state.perioTooth=n;renderPerio()};box.appendChild(b)})}
function renderPerioEditor(){const p=getPatient();$('perioSelectedTooth').textContent=state.perioTooth;$('perioToothLabel').textContent=toothDescription(state.perioTooth);const rec=p?perioRecord(p,state.perioTooth):null,grid=$('perioSiteGrid');grid.innerHTML='';perioSites.forEach(([key,label])=>{const s=rec?.sites?.[key]||{};const row=document.createElement('div');row.className='perio-site-row';row.innerHTML=`<span class="perio-site-name">${label}</span><input class="perio-depth" data-site="${key}" type="number" inputmode="numeric" min="0" max="12" step="1" value="${s.depth??''}" placeholder="0"><label class="site-check"><input data-bop="${key}" type="checkbox" ${s.bleeding?'checked':''}></label><label class="site-check"><input data-sup="${key}" type="checkbox" ${s.suppuration?'checked':''}></label>`;grid.appendChild(row)});$('perioMobility').value=rec?.mobility??'0';$('perioFurcation').value=rec?.furcation??'0';$('perioNote').value=rec?.note||''}
function collectPerioEditor(){const sites={};perioSites.forEach(([key])=>{let d=Number(document.querySelector(`[data-site="${key}"]`)?.value||0);d=Math.max(0,Math.min(12,d));sites[key]={depth:d,bleeding:!!document.querySelector(`[data-bop="${key}"]`)?.checked,suppuration:!!document.querySelector(`[data-sup="${key}"]`)?.checked}});return{sites,mobility:$('perioMobility').value,furcation:$('perioFurcation').value,note:$('perioNote').value.trim(),updatedAt:new Date().toISOString()}}
function nextPerio(step){const all=[...permanent.upper,...permanent.lower],i=all.indexOf(state.perioTooth);state.perioTooth=all[(i+step+all.length)%all.length];renderPerio()}
$('prevPerioTooth').onclick=()=>nextPerio(-1);$('nextPerioTooth').onclick=()=>nextPerio(1);
$('savePerioTooth').onclick=async()=>{const p=getPatient();if(!p){toast('Selecciona un paciente.');navigate('patients');return}ensurePatientData(p);p.perio.permanent[state.perioTooth]=collectPerioEditor();addHistory(p,{tooth:state.perioTooth,summary:'Periodontograma actualizado'});await savePatientRecord(p);toast('Sondaje guardado');nextPerio(1)};
$('clearPerioTooth').onclick=async()=>{const p=getPatient();if(!p)return;delete p.perio.permanent[state.perioTooth];addHistory(p,{tooth:state.perioTooth,summary:'Registro periodontal limpiado'});await savePatientRecord(p);renderPerio();toast('Registro periodontal limpiado')};
function perioChartSvg(title,list,siteKeys){const p=getPatient(),W=720,H=165,L=28,T=12,B=24,usableW=W-L-8,usableH=H-T-B,pts=[],circles=[],labels=[];for(let d=0;d<=12;d+=3){const y=T+(d/12)*usableH;pts.push(`<line class="perio-grid-line ${d===6?'alert':''}" x1="${L}" y1="${y}" x2="${W-6}" y2="${y}"/><text class="perio-axis-label" x="2" y="${y+3}">${d}</text>`)}let pathPts=[];list.forEach((tooth,i)=>{siteKeys.forEach((key,j)=>{const d=Number(p?.perio?.permanent?.[tooth]?.sites?.[key]?.depth||0),idx=i*siteKeys.length+j,x=L+(idx/((list.length*siteKeys.length)-1))*usableW;if(d>0){const y=T+(d/12)*usableH;pathPts.push(`${x},${y}`);circles.push(`<circle class="perio-point" cx="${x}" cy="${y}" r="3.6" fill="${depthColor(d)}"><title>${tooth} ${key.toUpperCase()}: ${d} mm</title></circle>`)}if(j===1){labels.push(`<text class="perio-axis-label" x="${x}" y="${H-5}" text-anchor="middle">${tooth}</text>`)}})});const poly=pathPts.length>1?`<polyline class="perio-line" points="${pathPts.join(' ')}"/>`:'';return `<div class="perio-chart-card"><h4>${title}</h4><svg class="perio-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${pts.join('')}${poly}${circles.join('')}${labels.join('')}</svg></div>`}
function renderPerioCharts(){const box=$('perioCharts');box.innerHTML=perioChartSvg('Superior · vestibular',permanent.upper,['mb','b','db'])+perioChartSvg('Superior · palatino',permanent.upper,['ml','l','dl'])+perioChartSvg('Inferior · vestibular',permanent.lower,['mb','b','db'])+perioChartSvg('Inferior · lingual',permanent.lower,['ml','l','dl'])}

/* Exploración */
function explorationRecord(p,tooth){ensurePatientData(p);return p.exploration[state.explorationDentition][tooth]||null}
function syncExplorationDentitionTabs(){$$('[data-exploration-dentition]').forEach(b=>b.classList.toggle('active',b.dataset.explorationDentition===state.explorationDentition))}
$$('[data-exploration-dentition]').forEach(b=>b.onclick=()=>{state.explorationDentition=b.dataset.explorationDentition;state.explorationTooth=allTeeth(state.explorationDentition)[0];syncExplorationDentitionTabs();renderExploration()});
function renderExploration(){renderActivePatient();syncExplorationDentitionTabs();const all=allTeeth(state.explorationDentition);if(!all.includes(state.explorationTooth))state.explorationTooth=all[0];renderExplorationTeeth();renderExplorationEditor();const p=getPatient(),count=p?Object.keys(p.exploration[state.explorationDentition]||{}).length:0;$('explorationProgress').textContent=`${count} registros`}
function renderExplorationTeeth(){const box=$('explorationTeeth');box.innerHTML='';const p=getPatient(),all=allTeeth(state.explorationDentition);all.forEach((n,i)=>{if(i===getTeeth(state.explorationDentition).upper.length){const br=document.createElement('span');br.style.gridColumn='1/-1';br.style.height='2px';br.style.background='#d8dfd9';box.appendChild(br)}const b=document.createElement('button');b.type='button';b.className='exploration-tooth-btn';b.textContent=n;if(n===state.explorationTooth)b.classList.add('active');if(p&&explorationRecord(p,n))b.classList.add('done');b.onclick=()=>{state.explorationTooth=n;renderExploration()};box.appendChild(b)})}
function renderExplorationEditor(){const p=getPatient(),r=p?explorationRecord(p,state.explorationTooth):null;$('explorationSelectedTooth').textContent=state.explorationTooth;$('explorationToothLabel').textContent=toothDescription(state.explorationTooth);$('explorationFindings').value=r?.findings||'';$('explorationDiagnosis').value=r?.diagnosis||'';$('explorationSuggested').value=r?.suggested||'';$('explorationPerformed').value=r?.performed||'';$('explorationNotes').value=r?.notes||''}
function nextExploration(step){const all=allTeeth(state.explorationDentition),i=all.indexOf(state.explorationTooth);state.explorationTooth=all[(i+step+all.length)%all.length];renderExploration()}
$('prevExplorationTooth').onclick=()=>nextExploration(-1);$('nextExplorationTooth').onclick=()=>nextExploration(1);
$('saveExploration').onclick=async()=>{const p=getPatient();if(!p){toast('Selecciona un paciente.');navigate('patients');return}ensurePatientData(p);p.exploration[state.explorationDentition][state.explorationTooth]={findings:$('explorationFindings').value.trim(),diagnosis:$('explorationDiagnosis').value.trim(),suggested:$('explorationSuggested').value.trim(),performed:$('explorationPerformed').value.trim(),notes:$('explorationNotes').value.trim(),updatedAt:new Date().toISOString()};addHistory(p,{dentition:state.explorationDentition,tooth:state.explorationTooth,summary:'Exploración/diagnóstico/tratamiento actualizado'});await savePatientRecord(p);renderExploration();toast('Exploración guardada')};
$('clearExploration').onclick=async()=>{const p=getPatient();if(!p)return;delete p.exploration[state.explorationDentition][state.explorationTooth];addHistory(p,{dentition:state.explorationDentition,tooth:state.explorationTooth,summary:'Exploración de pieza limpiada'});await savePatientRecord(p);renderExploration();toast('Exploración limpiada')};
$$('#treatmentChips button').forEach(b=>b.onclick=()=>{const ta=$('explorationSuggested'),v=b.textContent.trim();if(!ta.value.toLowerCase().includes(v.toLowerCase()))ta.value=(ta.value.trim()?ta.value.trim()+'; ':'')+v});

/* Dictado odontograma */
function normalize(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/([0-9])\s*y\s*([0-9])/g,'$1, $2')}
function parseSegment(segment){const t=normalize(segment),toothMatch=t.match(/(?:pieza|diente)?\s*(\d{2})/);if(!toothMatch)return{ok:false,raw:segment,error:'No identifiqué la pieza'};const tooth=toothMatch[1],valid=allTeeth().includes(tooth);if(!valid)return{ok:false,raw:segment,error:`La pieza ${tooth} no corresponde a esta dentición`};const map=[['caries','caries'],['obturacion','restoration'],['restauracion','restoration'],['resina','restoration'],['amalgama','restoration'],['corona','crown'],['endodoncia','endo'],['conductos','endo'],['implante','implant'],['sellador','sealant'],['extraccion','extraction'],['extraer','extraction'],['fractura','fracture'],['ausente','missing'],['extraido','missing'],['extraida','missing'],['sano','healthy']],pair=map.find(([w])=>t.includes(w));if(!pair)return{ok:false,raw:segment,error:`No identifiqué el hallazgo de la pieza ${tooth}`};const smap=[['mesial','m'],['mesio','m'],['distal','d'],['disto','d'],['vestibular','v'],['vestibulo','v'],['bucal','v'],['palatino','l'],['palatina','l'],['lingual','l'],['oclusal','o'],['ocluso','o'],['incisal','o']],surfaces=[];smap.forEach(([w,k])=>{if(t.includes(w)&&!surfaces.includes(k))surfaces.push(k)});return{ok:true,tooth,condition:pair[1],surfaces,raw:segment}}
function parseDictation(text){const cleaned=text.replace(/\n/g,' ').trim();if(!cleaned)return[];const marked=cleaned.replace(/(?:pieza|diente)\s*(\d{2})/gi,'§pieza $1').replace(/([,.;]\s*)(?=\d{2}\b)/g,'$1§pieza ');const segments=marked.split('§').map(s=>s.replace(/^[,.;\s]+/,'').trim()).filter(Boolean);return segments.map(parseSegment)}
$('parseDictationBtn').onclick=()=>{state.dictationParsed=parseDictation($('dictationText').value);renderDictationPreview()};
function renderDictationPreview(){const box=$('dictationPreview');box.innerHTML='';if(!state.dictationParsed.length){box.innerHTML='<div class="dictation-item error">No encontré comandos clínicos. Prueba: “Pieza 16 caries ocluso-mesial”.</div>';$('applyDictationBtn').hidden=true;return}state.dictationParsed.forEach(r=>{const d=document.createElement('div');d.className='dictation-item'+(r.ok?'':' error');d.textContent=r.ok?`✓ Pieza ${r.tooth} · ${conditionDefs[r.condition].label}${r.surfaces.length?' · '+r.surfaces.map(s=>surfaceLabels[s]).join(' + '):''}`:`⚠ ${r.error}`;box.appendChild(d)});$('applyDictationBtn').hidden=!state.dictationParsed.some(x=>x.ok)}
$('applyDictationBtn').onclick=async()=>{const p=getPatient();if(!p){toast('Selecciona un paciente antes de aplicar el dictado.');navigate('patients');return}ensurePatientData(p);const bucket=p.chart[state.dentition];state.dictationParsed.filter(r=>r.ok).forEach(r=>{if(r.condition==='healthy')bucket[r.tooth]={records:[{id:uid(),condition:'healthy',surfaces:[],note:'',createdAt:new Date().toISOString(),source:'dictation'}]};else{const existing=bucket[r.tooth]?.records||[];bucket[r.tooth]={records:[...existing.filter(x=>x.condition!=='healthy'),{id:uid(),condition:r.condition,surfaces:r.surfaces,note:'',createdAt:new Date().toISOString(),source:'dictation'}]}}addHistory(p,{dentition:state.dentition,tooth:r.tooth,summary:`Dictado: ${conditionDefs[r.condition].label}${r.surfaces.length?' · '+r.surfaces.map(s=>surfaceLabels[s]).join(', '):''}`})});await savePatientRecord(p);toast('Dictado aplicado');navigate('chart')};
$('clearDictationBtn').onclick=()=>{$('dictationText').value='';state.dictationParsed=[];$('dictationPreview').innerHTML='';$('applyDictationBtn').hidden=true};
function setupSpeech(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('micState').textContent='Usa el dictado del teclado';$('micBtn').onclick=()=>{$('dictationText').focus();toast('En este navegador usa el micrófono del teclado.')};return}const rec=new SR();rec.lang='es-MX';rec.continuous=false;rec.interimResults=false;rec.onstart=()=>{$('micBtn').classList.add('listening');$('micState').textContent='Escuchando…'};rec.onend=()=>{$('micBtn').classList.remove('listening');$('micState').textContent='Toca para dictar'};rec.onerror=e=>toast(`Dictado: ${e.error}`);rec.onresult=e=>{$('dictationText').value=e.results[0][0].transcript;$('micState').textContent='Texto reconocido';state.dictationParsed=parseDictation($('dictationText').value);renderDictationPreview()};$('micBtn').onclick=()=>rec.start()}

function renderHistory(){const box=$('historyList'),p=getPatient();box.innerHTML='';if(!p){box.innerHTML='<div class="empty-card">Selecciona un paciente para revisar su historial.</div>';return}const h=[...(ensurePatientData(p).chart.history||[])].sort((a,b)=>b.date.localeCompare(a.date));if(!h.length){box.innerHTML='<div class="empty-card">Todavía no hay cambios registrados en este expediente.</div>';return}h.forEach(x=>{const d=document.createElement('div');d.className='history-card';d.innerHTML=`<b>${new Date(x.date).toLocaleString('es-MX')}</b><small>${x.tooth?'Pieza '+x.tooth+' · ':''}${escapeHtml(x.summary||'Actualización')}</small>`;box.appendChild(d)})}
$('printReportBtn').onclick=()=>{if(!getPatient()){toast('Selecciona un paciente.');return}navigate('chart');setTimeout(()=>window.print(),250)};
$('exportJsonBtn').onclick=()=>{const p=getPatient();if(!p){toast('Selecciona un paciente.');return}const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`goldent-${(p.record||p.name).replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
$('importJsonInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{const p=JSON.parse(r.result);if(!p.id||!p.name)throw new Error('Formato');ensurePatientData(p);await savePatientRecord(p);state.activePatientId=p.id;toast('Expediente importado');navigate('chart')}catch{toast('El archivo no es un expediente válido.')}};r.readAsText(f)};
$('saveSettingsBtn').onclick=async()=>{const v=$('doctorInput').value.trim()||'Dr. Shadrach';await saveSetting('doctor',v);$('doctorName').textContent=v;toast('Preferencias guardadas')};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').hidden=false});$('installBtn').onclick=async()=>{if(!deferredPrompt){toast('Usa “Añadir a pantalla de inicio” en el menú del navegador.');return}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').hidden=true};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

(async function init(){buildConditionGrid();setupSpeech();await loadPatients();const doctor=await loadSettings();$('doctorName').textContent=doctor;$('doctorInput').value=doctor;renderActivePatient();renderOdontogram();})();
// GOLDENT v2.1: eliminar al paciente seleccionado.
(() => {
  const edit = $('editPatientBtn');
  if (!edit || $('deletePatientBtn')) return;

  const button = document.createElement('button');
  button.id = 'deletePatientBtn';
  button.type = 'button';
  button.className = 'btn btn-soft';
  button.textContent = 'Eliminar paciente';
  button.style.color = '#b42318';
  edit.after(button);

  button.onclick = async () => {
    if (button.disabled) return;
    const patient = getPatient();
    if (!patient) return toast('Selecciona un paciente primero.');

    const accepted = window.confirm(
      '¿Eliminar a ' + patient.name + '?\n\n' +
      'Se borrarán su ficha, odontograma, periodontograma e historial ' +
      'de este navegador.\nEsta acción no se puede deshacer desde la app.'
    );
    if (!accepted) return;

    button.disabled = true;
    let db;
    try {
      db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('patients', 'readwrite');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        tx.objectStore('patients').delete(patient.id);
      });
    } catch {
      toast('No se pudo eliminar. Intenta nuevamente.');
      return;
    } finally {
      if (db) db.close();
      button.disabled = false;
    }

    dbCache = dbCache.filter(p => p.id !== patient.id);
    if (state.activePatientId === patient.id) {
      state.activePatientId = null;
      state.selectedTooth = null;
      state.selectedSurfaces.clear();
      $('patientForm').reset();
      $('toothNote').value = '';
      $('clearDictationBtn').click();
    }
    renderPatients();
    renderOdontogram();
    renderPerio();
    renderExploration();
    renderHistory();
    navigate('patients');
    toast('Paciente eliminado de este navegador.');
  };
})();
