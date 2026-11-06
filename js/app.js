import {taskRewards,rememberDemoAwards,demoRewardRules} from './rewards.js';
import {getLanguage,getLocale,setLanguage,translateText,translateTree,translationUrl,languageSwitcher} from './i18n.js';
import {ChildAccess} from './child-access.js';
import {renderWelcome} from './welcome.js';
import {renderChildSummary, safeChildSummary} from './child-view.js';
import {FamilyRepository} from './repository.js';
import {moduleDefinitions, labels, exampleData, localDate, statistics, isoWeek, indicesForGroup, scopedEntries, totals} from './data.js';

const root=document.querySelector('#app'), editor=document.querySelector('#editor'), gate=document.querySelector('#gate');
const repository = new FamilyRepository();
const childAccess = new ChildAccess();
const key='pacos-weg-demo-v1';
let modules=structuredClone(moduleDefinitions), state={entries:[],parent:'',phasesByModule:{}}, cloud=false, child=false, childSummary=null, welcome=true;
let page='today', selectedModule='school', selectedGroup='', selectedTask='';
let filters={parent:'',from:'',to:''}, busy=false, trainingBusy=false, loginBusy=false, toastTimer;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Installierte Apps geben Adressen außerhalb ihres Bereichs selbst an den Browser; im Browser-Tab bleibt die App mit neuem Tab geöffnet.
const externalTarget=()=>globalThis.navigator?.standalone||globalThis.matchMedia?.('(display-mode: standalone)').matches?'':' target="_blank"';
const button=(action,text,css='')=>`<button class="${css}" data-action="${action}">${text}</button>`;
const exerciseCount=n=>`${n} ${n===1?'Übung':'Übungen'}`;
const fmt=date=>new Date(date+'T12:00:00').toLocaleDateString(getLocale(),{day:'numeric',month:'short',year:'numeric'});
const current=()=>modules.find(m=>m.id===selectedModule)??modules[0];
const phaseIndex=()=>state.phasesByModule?.[current().id]??0;
const groupName=(m,id)=>m.groups.find(g=>g.id===id)?.name??'Alle Unterbereiche';
const sorted=entries=>entries.slice().sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
function areaEntries(m=current(),group=selectedGroup){
  return sorted(state.entries.filter(e=>e.moduleId===m.id&&(!group||!e.groupId||e.groupId===group)));
}
function restoreDemo(){
  welcome=false;
  modules=structuredClone(moduleDefinitions);
  try{state=JSON.parse(localStorage.getItem(key));}catch{state=null;}
  if(!state||!Array.isArray(state.entries))state={entries:exampleData(),parent:'Mama',phase:0};
  state.rewardAwards=rememberDemoAwards(state.entries,modules,state.rewardAwards);
  state.phasesByModule??={school:state.phase??0};
  selectedModule=modules.some(m=>m.id===selectedModule)?selectedModule:'school';
}
function adoptLoaded(loaded){
  setLanguage(loaded.language??'de');
  modules=loaded.modules;
  state={entries:loaded.entries,parent:loaded.parent,phasesByModule:loaded.phasesByModule};
  if(!modules.some(m=>m.id===selectedModule))selectedModule=modules[0].id;
}
function saveDemo(next=state){
  if(cloud)return;
  next.rewardAwards=rememberDemoAwards(next.entries,modules,next.rewardAwards);
  try{localStorage.setItem(key,JSON.stringify(next));}catch{throw new Error('Browser-Speicher nicht verfügbar. Die Änderung wurde nicht gespeichert.');}
}
function toast(message){
  const el=document.querySelector('#toast');el.textContent=message;translateTree(el);el.style.display='block';
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.style.display='none',5000);
}
function changeModule(id){
  if(!modules.some(m=>m.id===id))return;
  selectedModule=id;selectedGroup='';selectedTask='';render();
}
function scopePicker(withTask=false){
  const m=current(), indices=indicesForGroup(m,selectedGroup);
  return `<div class="scope-picker"><label>Bereich<select id="area-select" aria-label="Bereich">${modules.map(a=>`<option value="${esc(a.id)}" ${a.id===m.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>
    <label>Unterbereich<select id="group-select" aria-label="Unterbereich"><option value="">Alle Unterbereiche</option>${m.groups.map(g=>`<option value="${esc(g.id)}" ${g.id===selectedGroup?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>
    ${withTask?`<label>Aufgabe<select id="task-select" aria-label="Aufgabe"><option value="">Alle Aufgaben</option>${indices.map(i=>`<option value="${i}" ${String(i)===selectedTask?'selected':''}>${esc(m.criteria[i])}</option>`).join('')}</select></label>`:''}</div>`;
}
function dots(entry){
  const m=modules.find(m=>m.id===entry.moduleId);
  return `<div class="dots">${indicesForGroup(m,entry.groupId).map(i=>`<span class="dot s${entry.ratings[i]??3}" title="${esc(m.criteria[i])}: ${labels[entry.ratings[i]??3]}" aria-label="${esc(m.criteria[i])}: ${labels[entry.ratings[i]??3]}"></span>`).join('')}</div>`;
}
function render(){
  if(welcome){root.innerHTML=renderWelcome();translateTree(root);return;}
  const view=child?childView():page==='today'?today():page==='diary'?diary():page==='stats'?stats():settings();
  root.innerHTML=`<div class="shell"><header><div class="brand"><img src="icon.png" alt=""><div>PACOS WEG<small>Schritt für Schritt selbstständig.</small></div></div>
    <div class="account">${languageSwitcher()}${cloud&&!child?`<span class="profile-name">${esc(state.parent)}</span>`:''}${!cloud&&!child?button('welcome-home','Startseite','small'):''}${!child?button(cloud?'logout':'login',cloud?'Abmelden':'Eltern anmelden','small'):''}${child&&cloud?button('child-home','Startseite','small'):''}${button(child?'exit':'child',child?'Elternbereich ↗':'Pacos Ansicht ☀','small')}</div></header>
    ${view}<p class="demo">${cloud?child?'PACOS ANSICHT · ELTERNBEREICH GESPERRT':'FAMILIENDATENBANK · '+esc(state.parent):'DEMO · ERFUNDENE BEISPIELDATEN'}</p></div>
    ${child?'':`<nav class="nav" aria-label="Hauptnavigation">${[['today','⌂','Heute'],['diary','▤','Tagebuch'],['stats','▥','Statistik'],['settings','⚙','Einstellungen']].map(([id,icon,name])=>`<button data-page="${id}" class="${id===page?'active':''}" ${id===page?'aria-current="page"':''}><b aria-hidden="true">${icon}</b>${name}</button>`).join('')}</nav>`}`;
  translateTree(root);
}
function today(){
  const m=current(), list=areaEntries(), phase=m.phases[phaseIndex()];
  return `<div class="intro"><span class="eyebrow">Ein kleiner Schritt. Ein großer Erfolg.</span><h1>Hallo, ${esc(state.parent)}!</h1><p class="muted">Pacos Weg in die Selbstständigkeit</p></div>
    <div class="area-cards">${modules.map(a=>`<button data-module="${esc(a.id)}" class="area-card ${a.id===m.id?'chosen':''}" aria-pressed="${a.id===m.id}"><span class="area-icon">${a.icon}</span><strong>${esc(a.name)}</strong><small>${a.groups.length} Unterbereiche · ${exerciseCount(state.entries.filter(e=>e.moduleId===a.id).length)}</small></button>`).join('')}</div>
    ${scopePicker()}<div class="grid"><section><div class="card hero"><div class="hero-content"><span class="pill">${m.icon} &nbsp; <span>${esc(m.name.toUpperCase())}</span></span><h2>${esc(selectedGroup?groupName(m,selectedGroup):m.name)}</h2>
    ${phase?`<p><strong>Woche ${phaseIndex()+1} · ${esc(phase.name)}</strong></p><p class="muted">${esc(phase.goal)}</p>`:'<p class="muted">Wählt eine Aufgabe und übt gemeinsam. Ihr bestimmt das Tempo – jeden Tag ein kleines Stück selbstständiger.</p>'}
    ${button('new',m.hasPhases?'Training starten →':'Übung erfassen →','primary')}</div></div>
    <div class="metrics"><div class="metric"><strong>${list.length}</strong><span>Übungen in dieser Auswahl</span></div><div class="metric"><strong>${list[0]?new Date(list[0].date+'T12:00:00').toLocaleDateString(getLocale(),{day:'2-digit',month:'2-digit'}):'–'}</strong><span>Zuletzt geübt</span></div><div class="metric"><strong>${indicesForGroup(m,selectedGroup).length}</strong><span>Aufgaben in dieser Auswahl</span></div></div>
    <div class="card"><h3>Kleine Schritte zählen.</h3><p class="muted">Bewertet nur, was ihr heute geübt oder beobachtet habt. Alles andere bleibt „nicht beobachtet“.</p></div></section><aside>
    ${phase?`<div class="card"><h2>Euer Trainingsplan</h2>${m.phases.map((p,i)=>`<div class="phase ${i===phaseIndex()?'active':''}"><div class="phase-num">${i+1}</div><div><h3>Woche ${i+1} · ${esc(p.name)}</h3><p>${i===phaseIndex()?'Aktueller Schwerpunkt':'In eurem Tempo · jederzeit wiederholbar'}</p></div></div>`).join('')}${button('plan','Trainingsphase anpassen','small')}<p class="note">Die Entscheidung über den alleinigen Schulweg bleibt bei euch Eltern.</p></div>`:''}
    <div class="card"><h2>Unterbereiche</h2>${m.groups.map(g=>`<div class="group-card"><h3>${esc(g.name)}</h3><p class="note">${g.indices.map(i=>esc(m.criteria[i])).join(' · ')}</p>${button('new-group:'+g.id,'Hier üben →','small')}</div>`).join('')}</div></aside></div>`;
}
function diary(){
  const m=current(), list=areaEntries().filter(e=>(!filters.parent||e.parent===filters.parent)&&(!filters.from||e.date>=filters.from)&&(!filters.to||e.date<=filters.to));
  return `<div class="intro"><span class="eyebrow">Gemeinsame Schritte festhalten</span><div class="row"><h1>Tagebuch</h1>${button('new','+ Übung','primary')}</div></div>${scopePicker()}
    <div class="filters"><label>Begleitperson<select data-filter="parent"><option value="">Alle</option>${['Mama','Papa'].map(p=>`<option ${filters.parent===p?'selected':''}>${p}</option>`).join('')}</select></label><label>Von<input type="date" data-filter="from" value="${filters.from}"></label><label>Bis<input type="date" data-filter="to" value="${filters.to}"></label></div>
    <div class="card"><div class="row"><h2>${exerciseCount(list.length)} · ${esc(m.name)}</h2>${button('clear-filters','Filter zurücksetzen','small')}</div>
    ${list.length?list.map(e=>`<article class="entry"><div class="row"><div><h3>${fmt(e.date)} · ${esc(e.time)}</h3><span class="muted">${esc(e.parent)} · ${esc(groupName(m,e.groupId))}${m.hasPhases?' · Woche '+(e.phase+1):''}</span></div>${button('edit:'+e.id,'Öffnen','small')}</div>${dots(e)}<p class="muted">${e.note?`<span data-original>${esc(e.note)}</span> <a class="note-translate" href="${esc(translationUrl(e.note))}"${externalTarget()} rel="noopener noreferrer" title="Öffnet die Notiz im Google Übersetzer">Übersetzen</a>`:'Keine zusätzlichen Beobachtungen.'}</p></article>`).join(''):'<p class="empty">Noch keine Einträge für diese Auswahl.</p>'}</div>
    <p class="note">Grün: selbstständig · Gelb: mit Unterstützung · Rot: noch nicht · Grau: nicht beobachtet. Die Einzelbewertungen stehen im Eintrag.</p>`;
}
function bar(name,result){
  return `<div class="bar-row"><div class="row"><span>${esc(name)}</span><strong>${result.percent===null?'–':result.percent+' %'}</strong></div><div class="progress"><i style="width:${result.percent??0}%"></i></div><span class="note">${result.success} von ${result.total} bewerteten Beobachtungen selbstständig</span></div>`;
}
function stats(){
  const m=current(), raw=areaEntries();
  const indices=selectedTask===''?indicesForGroup(m,selectedGroup):[Number(selectedTask)];
  const list=raw.map(e=>({...e,ratings:indices.map(i=>e.ratings[i]??3)}));
  const weeks=[...new Set(list.slice().reverse().map(e=>isoWeek(e.date)))];
  const series=list.slice().reverse().map(e=>({...e,result:totals([e])}));
  const points=series.map((e,i)=>e.result.percent===null?null:`${40+i*520/Math.max(1,series.length-1)},${135-e.result.percent*1.1}`);
  return `<div class="intro"><span class="eyebrow">Entwicklung verstehen</span><h1>Jeder Schritt zählt.</h1><p class="muted">${esc(m.name)} · ${esc(groupName(m,selectedGroup))}${selectedTask!==''?' · '+esc(m.criteria[Number(selectedTask)]):''}</p></div>${scopePicker(true)}
    <div class="metrics"><div class="metric"><strong>${list.length}</strong><span>Übungen in dieser Auswahl</span></div><div class="metric"><strong>${totals(list).total}</strong><span>Tatsächliche Bewertungen</span></div><div class="metric"><strong>${weeks.length}</strong><span>Kalenderwochen</span></div></div>
    <div class="grid stats-grid"><section><div class="card"><h2>Selbstständig geschafft</h2><p class="muted">Zeitlicher Verlauf für die gewählte Auswahl</p>
    <svg class="chart" viewBox="0 0 600 160" role="img" aria-label="Anteil selbstständiger Bewertungen je Übung; genaue Werte unter dem Diagramm"><path d="M40 25H570M40 80H570M40 135H570" stroke="#e3e8df" fill="none"/><text x="0" y="29" font-size="11" fill="#718078">100%</text><text x="9" y="139" font-size="11" fill="#718078">0%</text>${points.map((p,i)=>p&&i&&points[i-1]?`<path d="M${points[i-1]} L${p}" fill="none" stroke="#719579" stroke-width="3"/>`:'').join('')}${points.map(p=>p?`<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="4" fill="#285c48"/>`:'').join('')}</svg>
    <details><summary class="note">Daten zum Verlauf anzeigen</summary>${series.map(e=>`<p class="note">${fmt(e.date)}: ${e.result.percent===null?'Nicht bewertet':e.result.percent+' %'} · ${e.result.success}/${e.result.total}</p>`).join('')}</details></div>
    <div class="card"><h2>Wochen im Vergleich</h2><table class="week-table"><thead><tr><th>Kalenderwoche</th><th>Übungen</th><th>Selbstständig</th></tr></thead><tbody>${weeks.map(w=>{const group=list.filter(e=>isoWeek(e.date)===w),r=totals(group);return `<tr><td>${w}</td><td>${group.length}</td><td>${r.percent===null?'–':r.percent+' %'} · ${r.success}/${r.total}</td></tr>`;}).join('')}</tbody></table></div>
    ${!selectedGroup&&selectedTask===''?`<div class="card"><h2>Unterbereiche · ${esc(m.name)}</h2>${m.groups.map(g=>bar(g.name,totals(scopedEntries(state.entries,m,g.id)))).join('')}</div>`:''}</section>
    <div class="card"><h2>Aufgaben im Überblick</h2>${indices.map(i=>bar(m.criteria[i],statistics(raw,i))).join('')}<p class="note">Nicht beobachtete und fehlende Werte zählen nicht zum Nenner. Die Daten anderer Bereiche werden nicht mitgerechnet.${m.hasPhases?' Die Statistik ist keine Sicherheitsfreigabe.':''}</p></div></div>`;
}
function settings(){
  const m=current();
  return `<div class="intro"><span class="eyebrow">Euer gemeinsamer Rahmen</span><h1>Einstellungen</h1></div>${scopePicker()}
    <div class="grid"><div class="card"><h2>${cloud?'Angemeldet als '+esc(state.parent):'Demo-Elternbereich'}</h2>
    ${!cloud?`<label>Erfassung als<select id="parent">${['Mama','Papa'].map(p=>`<option ${p===state.parent?'selected':''}>${p}</option>`).join('')}</select></label>`:'<p class="muted">Beide Eltern können die Übungen aller Bereiche erfassen und bearbeiten.</p><h3>Gemeinsame Daten</h3><p class="note">Mama und Papa sehen dieselben gespeicherten Übungen. Bereits geöffnete Ansichten über „Familiendaten neu laden“ aktualisieren.</p>'}
    ${m.hasPhases?`<label>Trainingsphase · ${esc(m.name)}<select id="phase">${m.phases.map((p,i)=>`<option value="${i}" ${i===phaseIndex()?'selected':''}>Woche ${i+1} · ${esc(p.name)}</option>`).join('')}</select></label><p class="note">Phasen können verlängert und wiederholt werden.</p>`:'<p class="muted">Für diesen Alltagsbereich gibt es keine Wochenphasen. Ihr bewertet einzelne Aufgaben in eurem Tempo.</p>'}
    ${cloud?button('refresh','Familiendaten neu laden','small'):button('reset','Beispieldaten zurücksetzen','danger small')}</div>
    <div class="card"><h2>Pacos Ansicht</h2><p class="muted">Erfolge werden nach Bereichen getrennt angezeigt. Elternnotizen bleiben im Elternbereich.</p>${button('child','Kinderansicht öffnen ☀')}
    ${cloud?`<div class="pin-settings"><h3>Kinder-PIN auf diesem Gerät</h3><p class="note">${childAccess.pairing()?'Für diesen Browser eingerichtet.':'Noch nicht eingerichtet.'}</p>${button('setup-child-pin',childAccess.pairing()?'Kinder-PIN ändern':'Kinder-PIN einrichten','small')}${childAccess.pairing()?button('remove-child-pin','Kinderzugang entfernen','danger small'):''}</div>`:''}
    <p class="note">${cloud?'Beim Wechsel wird die Elternsitzung beendet. Zurück geht es nur mit erneuter Anmeldung.':'Die Demo enthält nur erfundene Daten. Demo-PIN für die Rückkehr: 1234. Kein echter Zugriffsschutz.'}</p></div></div>`;
}
function childView(){return renderChildSummary(childSummary);}
function demoChildSummary(){
  const areas=modules.map(m=>{const list=state.entries.filter(e=>e.moduleId===m.id);return {
    id:m.id,nickname:'Paco',module:m.name,trainingCount:list.length,taskRewards:taskRewards(list,m,state.rewardAwards),rewardRules:demoRewardRules,badges:m.id==='school'?[
      {name:'Ampel-Profi',code:'traffic',earned:list.some(e=>e.ratings[0]===2)},
      {name:'Wegfinder',code:'direction',earned:list.some(e=>e.ratings[2]===2)},
      {name:'Aufmerksamkeitsheld',code:'attention',earned:list.some(e=>e.ratings[3]===2)},
      {name:'Schulweg-Entdecker',code:'explorer',earned:list.length>0},
    ]:[],successes:m.criteria.map((name,i)=>({name,count:statistics(list,i).success,group:m.groups.find(g=>g.indices.includes(i))?.name??''})).filter(s=>s.count>0),milestones:[],
  };});
  return safeChildSummary({nickname:'Paco',module:'Dein Alltag',trainingCount:state.entries.length,areas});
}

function openEditor(id,requestedGroup=selectedGroup){
  const original=state.entries.find(e=>e.id===id), m=current();
  const draft=structuredClone(original??{
    date:localDate(),time:new Date().toTimeString().slice(0,5),parent:state.parent,
    route:m.hasPhases?'Ruhiger Übungsweg':'',phase:m.hasPhases?phaseIndex():null,
    groupId:requestedGroup||(m.hasPhases?'':m.groups[0].id),ratings:m.criteria.map(()=>3),note:'',
  });
  draft.groupId??='';
  const captureRatings=()=>editor.querySelectorAll('input[type=radio]:checked').forEach(input=>{draft.ratings[Number(input.name.slice(6))]=Number(input.value);});
  const ratingFields=()=>{
    const allowed=indicesForGroup(m,draft.groupId);
    return m.groups.filter(g=>!draft.groupId||g.id===draft.groupId).map(g=>`<section class="rating-group"><h3>${esc(g.name)}</h3>${g.indices.filter(i=>allowed.includes(i)).map(i=>`<fieldset class="rating"><legend>${esc(m.criteria[i])}</legend><div class="choices">${[2,1,0,3].map(v=>`<label class="choice"><input required type="radio" name="rating${i}" value="${v}" ${draft.ratings[i]===v?'checked':''}><span>${['🔴','🟡','🟢','○'][v]}<br>${labels[v]}</span></label>`).join('')}</div></fieldset>`).join('')}</section>`).join('');
  };
  editor.innerHTML=`<form id="training"><div class="row"><h2>${original?'Übung bearbeiten':esc(m.name)+' üben'}</h2><button type="button" data-close aria-label="Schließen">×</button></div>
    <p class="muted">Bewertet nur die heute beobachteten Aufgaben.</p>
    <label>Unterbereich<select name="groupId" id="editor-group"><option value="">Alle Unterbereiche</option>${m.groups.map(g=>`<option value="${esc(g.id)}" ${g.id===draft.groupId?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>
    <div class="two form-spaced"><label>Datum<input required type="date" name="date" max="${localDate()}" value="${esc(draft.date)}"></label><label>Uhrzeit<input required type="time" name="time" value="${esc(draft.time)}"></label>
    <label>Begleitperson<select name="parent">${(cloud?repository.context.members.map(m=>m.display_label):['Mama','Papa']).map(p=>`<option ${p===draft.parent?'selected':''}>${esc(p)}</option>`).join('')}</select></label>
    ${m.hasPhases?`<label>Trainingsphase<select name="phase">${m.phases.map((p,i)=>`<option value="${i}" ${i===draft.phase?'selected':''}>Woche ${i+1} · ${esc(p.name)}</option>`).join('')}</select></label>`:''}</div>
    ${m.hasPhases?`<label class="form-spaced">Route · allgemeine Bezeichnung ohne Adresse<input required name="route" maxlength="120" value="${esc(draft.route)}"></label>`:''}
    <p class="note">Aufgaben außerhalb der Auswahl werden in dieser Übung nicht bewertet.</p><div id="rating-fields">${ratingFields()}</div>
    <label class="form-spaced">Elternnotiz · nur für Eltern<textarea name="note" maxlength="3000" placeholder="Was ist dir aufgefallen?">${esc(draft.note)}</textarea></label>
    <div class="actions">${original?'<button type="button" class="danger" id="delete">Löschen</button>':''}<button type="button" data-close>Abbrechen</button><button class="primary" type="submit">Übung speichern</button></div></form>`;
  editor.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>editor.close());
  editor.querySelector('#editor-group').onchange=event=>{captureRatings();draft.groupId=event.target.value;editor.querySelector('#rating-fields').innerHTML=ratingFields();translateTree(editor.querySelector('#rating-fields'));};
  const lock=value=>{trainingBusy=value;editor.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value);};
  editor.querySelector('form').onsubmit=async event=>{
    event.preventDefault();captureRatings();
    const data=new FormData(event.target), indices=indicesForGroup(m,draft.groupId);
    let item={id:original?.id??crypto.randomUUID(),moduleId:m.id,groupId:draft.groupId,
      date:data.get('date'),time:data.get('time'),parent:data.get('parent'),
      phase:m.hasPhases?Number(data.get('phase')):null,route:m.hasPhases?data.get('route').trim():'',
      note:data.get('note').trim(),ratings:m.criteria.map((_,i)=>indices.includes(i)?draft.ratings[i]??3:3),
    };
    lock(true);
    try{
      if(cloud)item=await repository.putTraining(item,original);
      const next={...state,entries:original?state.entries.map(e=>e.id===id?item:e):[...state.entries,item]};
      saveDemo(next);state=next;editor.close();editor.innerHTML='';render();toast('Übung gespeichert. Ein weiterer gemeinsamer Schritt!');
    }catch(error){toast(error.message);}finally{lock(false);}
  };
  if(original)editor.querySelector('#delete').onclick=async()=>{
    if(!confirm(translateText('Diese Übung wirklich löschen?')))return;
    lock(true);
    try{
      if(cloud)await repository.deleteTraining(id,m.id);
      const next={...state,entries:state.entries.filter(e=>e.id!==id)};saveDemo(next);state=next;
      editor.close();editor.innerHTML='';render();toast('Übung gelöscht.');
    }catch(error){toast(error.message);}finally{lock(false);}
  };
  showDialog(editor);
}

async function openChildView(){
  busy=true;root.inert=true;root.setAttribute('aria-busy','true');
  try{
    const summary=cloud?await repository.enterChildMode():demoChildSummary();
    if(cloud){state={entries:[],parent:'',phasesByModule:{}};editor.close();editor.innerHTML='';gate.close();gate.innerHTML='';}
    childSummary=summary;child=true;filters={parent:'',from:'',to:''};render();window.scrollTo(0,0);
  }catch(error){toast(error.message);}finally{busy=false;root.inert=false;root.removeAttribute('aria-busy');}
}
function exitGate(){
  if(cloud){openLogin();return;}
  gate.innerHTML='<form><h2>Zurück zu den Eltern</h2><p class="note">Demo-PIN 1234 · kein echter Zugriffsschutz.</p><label>Eltern-PIN<input name="pin" type="password" inputmode="numeric" maxlength="4" required autocomplete="off"></label><p id="pin-error" role="alert"></p><div class="actions"><button id="cancel-gate" type="button">Abbrechen</button><button type="submit" class="primary">Entsperren</button></div></form>';
  gate.querySelector('#cancel-gate').onclick=()=>gate.close();
  gate.querySelector('form').onsubmit=event=>{
    event.preventDefault();
    if(new FormData(event.target).get('pin')!=='1234'){gate.querySelector('#pin-error').textContent='Diese PIN stimmt noch nicht.';translateTree(gate);return;}
    child=false;childSummary=null;gate.close();gate.innerHTML='';render();
  };showDialog(gate);
}
function openChildPin(){
 const paired=Boolean(childAccess.pairing());
 gate.innerHTML=paired?'<form><h2>Hallo, Paco! ☀</h2><p class="muted">Gib deine Kinder-PIN ein.</p><label>Kinder-PIN<input class="pin-input" type="password" name="pin" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required></label><p id="child-pin-error" role="alert"></p><div class="actions"><button type="button" id="cancel-child-pin">Abbrechen</button><button type="submit" class="primary">Meine Erfolge ansehen →</button></div></form>':'<h2>Kinder-PIN noch nicht eingerichtet</h2><p class="muted">Mama oder Papa melden sich einmal im Elternbereich an. Unter Einstellungen können sie deine Kinder-PIN für diesen Browser einrichten.</p><div class="actions"><button id="cancel-child-pin">Zurück</button><button id="setup-parent-login" class="primary">Zum Elternbereich</button></div>';
 gate.querySelector('#cancel-child-pin').onclick=()=>{gate.close();gate.innerHTML='';};
 if(!paired)gate.querySelector('#setup-parent-login').onclick=()=>{gate.close();gate.innerHTML='';openLogin();};
 else gate.querySelector('form').onsubmit=async event=>{
  event.preventDefault();const data=new FormData(event.target);loginBusy=true;gate.querySelectorAll('button').forEach(b=>b.disabled=true);gate.querySelector('#child-pin-error').textContent='';
  try{
   const summary=await childAccess.unlock(data.get('pin'));
   state={entries:[],parent:'',phasesByModule:{}};modules=structuredClone(moduleDefinitions);
   cloud=true;child=true;childSummary=summary;welcome=false;editor.close();editor.innerHTML='';
   gate.close();gate.innerHTML='';render();window.scrollTo(0,0);
  }catch(error){gate.querySelector('#child-pin-error').textContent=error.message;translateTree(gate);}
  finally{loginBusy=false;gate.querySelectorAll('button').forEach(b=>b.disabled=false);}
 };
 showDialog(gate);
}
function openPinSetup(){
 if(!cloud||child||!repository.session)return;
 gate.innerHTML='<form><h2>Kinder-PIN einrichten</h2><p class="muted">Wählt zusammen sechs Ziffern für Paco. Die PIN öffnet nur seine Erfolge auf diesem Gerät.</p><label>Neue Kinder-PIN<input class="pin-input" name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="new-password" required></label><label class="form-spaced">Kinder-PIN wiederholen<input class="pin-input" name="repeat" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="new-password" required></label><p id="setup-pin-error" role="alert"></p><div class="actions"><button id="cancel-pin-setup" type="button">Abbrechen</button><button type="submit" class="primary">Kinder-PIN speichern</button></div></form>';
 gate.querySelector('#cancel-pin-setup').onclick=()=>{gate.close();gate.innerHTML='';};
 gate.querySelector('form').onsubmit=async event=>{
  event.preventDefault();const data=new FormData(event.target);
  if(data.get('pin')!==data.get('repeat')){gate.querySelector('#setup-pin-error').textContent='Die beiden PIN-Eingaben stimmen nicht überein.';translateTree(gate);return;}
  loginBusy=true;gate.querySelectorAll('button').forEach(b=>b.disabled=true);gate.querySelector('#setup-pin-error').textContent='';
  try{await childAccess.setup(repository,data.get('pin'));gate.close();gate.innerHTML='';render();toast('Kinder-PIN eingerichtet. Paco kann sich auf der Startseite mit seiner PIN anmelden.');}
  catch(error){gate.querySelector('#setup-pin-error').textContent=error.message;translateTree(gate);}
  finally{loginBusy=false;gate.querySelectorAll('button').forEach(b=>b.disabled=false);}
 };showDialog(gate);
}
function openLogin(){
  gate.innerHTML='<form><h2>Eltern anmelden</h2><p class="muted">Mit eurem eingerichteten Elternkonto. Es gibt keine öffentliche Registrierung.</p><label>E-Mail<input required type="email" name="email" autocomplete="username"></label><label class="form-spaced">Passwort<input required type="password" name="password" autocomplete="current-password"></label><p class="note">Nach Neuladen bitte erneut anmelden.</p><p id="login-error" role="alert"></p><div class="actions"><button type="button" id="cancel-login">Abbrechen</button><button type="submit" class="primary">Anmelden</button></div></form>';
  gate.querySelector('#cancel-login').onclick=()=>{gate.close();gate.innerHTML='';};
  gate.querySelector('form').onsubmit=async event=>{
    event.preventDefault();const data=new FormData(event.target);loginBusy=true;
    gate.querySelectorAll('button').forEach(b=>b.disabled=true);gate.querySelector('#login-error').textContent='';
    try{
      const loaded=await repository.login(data.get('email').trim(),data.get('password'));
      adoptLoaded(loaded);cloud=true;child=false;childSummary=null;
      welcome=false;page='today';selectedGroup='';selectedTask='';
      gate.close();gate.innerHTML='';render();toast('Hallo, '+state.parent+'!');
    }catch(error){gate.querySelector('#login-error').textContent=error.message;translateTree(gate);}
    finally{loginBusy=false;gate.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };showDialog(gate);
}
editor.addEventListener('cancel',event=>{if(trainingBusy)event.preventDefault();});
gate.addEventListener('cancel',event=>{if(loginBusy)event.preventDefault();});
gate.addEventListener('close',()=>{if(child&&!loginBusy)gate.innerHTML='';});
function showWelcome(){
  welcome=true;cloud=false;child=false;childSummary=null;
  state={entries:[],parent:'',phasesByModule:{}};modules=structuredClone(moduleDefinitions);
  page='today';selectedModule='school';selectedGroup='';selectedTask='';filters={parent:'',from:'',to:''};
  editor.close();editor.innerHTML='';gate.close();gate.innerHTML='';render();window.scrollTo(0,0);
}
root.onclick=async event=>{
  if(busy)return;
  if(welcome){
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='welcome-parent')openLogin();
    else if(action==='welcome-child')openChildPin();
    else if(action==='welcome-demo'){restoreDemo();render();}
    return;
  }
  const navigation=event.target.closest('[data-page]');
  if(navigation&&!child){page=navigation.dataset.page;render();window.scrollTo(0,0);return;}
  if(!child){const area=event.target.closest('[data-module]');if(area){changeModule(area.dataset.module);return;}}
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(!action)return;
  if(action==='exit'){exitGate();return;}
  if(action==='child-home'&&child&&cloud){showWelcome();return;}
  if(child)return;
  try{
    if(action==='welcome-home'){showWelcome();}
    else if(action==='login')openLogin();
    else if(action==='child')await openChildView();
    else if(action==='setup-child-pin')openPinSetup();
    else if(action==='remove-child-pin'){busy=true;await childAccess.remove(repository);render();toast('Kinderzugang auf diesem Gerät entfernt.');}
    else if(action==='new')openEditor();
    else if(action.startsWith('new-group:'))openEditor(undefined,action.slice(10));
    else if(action.startsWith('edit:'))openEditor(action.slice(5));
    else if(action==='plan'){page='settings';render();}
    else if(action==='clear-filters'){filters={parent:'',from:'',to:''};render();}
    else if(action==='logout'){
      busy=true;await repository.logout();showWelcome();toast('Abgemeldet.');
    }else if(action==='refresh'){
      busy=true;adoptLoaded(await repository.load());render();toast('Familiendaten aktualisiert.');
    }else if(action==='reset'&&!cloud&&confirm(translateText('Alle lokalen Einträge durch die erfundenen Beispieldaten ersetzen?'))){
      const next={entries:exampleData(),parent:state.parent,phasesByModule:{school:0}};saveDemo(next);state=next;render();
    }
  }catch(error){toast(error.message);}finally{busy=false;}
};
root.onchange=async event=>{
  if(welcome||child||busy)return;
  const el=event.target;
  if(el.id==='area-select'){changeModule(el.value);return;}
  if(el.id==='group-select'){selectedGroup=el.value;selectedTask='';render();return;}
  if(el.id==='task-select'){selectedTask=el.value;render();return;}
  if(el.dataset.filter){filters[el.dataset.filter]=el.value;render();return;}
  try{
    if(el.id==='parent'&&!cloud){const next={...state,parent:el.value};saveDemo(next);state=next;}
    else if(el.id==='phase'){
      busy=true;el.disabled=true;const index=Number(el.value);
      if(cloud)await repository.setPhase(index,current().id);
      const next={...state,phasesByModule:{...state.phasesByModule,[current().id]:index}};saveDemo(next);state=next;
    }
  }catch(error){toast(error.message);}finally{busy=false;render();}
};

function showDialog(dialog){
 if(!dialog.querySelector('.language-switch'))dialog.insertAdjacentHTML('afterbegin',languageSwitcher());
 translateTree(dialog);dialog.showModal();
}
let languageSave=Promise.resolve();
document.addEventListener('click',async event=>{
 const control=event.target.closest('[data-language]');if(!control||loginBusy||trainingBusy||busy)return;
 const language=control.dataset.language;if(!['de','es'].includes(language)||language===getLanguage())return;
 event.preventDefault();setLanguage(language);render();translateTree(editor);translateTree(gate);
 if(cloud&&!child&&repository.session){
  const userId=repository.session.user.id,generation=repository.generation;
  languageSave=languageSave.catch(()=>{}).then(async()=>{if(repository.session?.user.id===userId&&repository.generation===generation)await repository.setPreferredLanguage(language);});
  try{await languageSave;}catch{toast('Sprache nur auf diesem Gerät geändert. Die Kontoeinstellung konnte nicht gespeichert werden.');}
 }
});
setLanguage(getLanguage());
render();
