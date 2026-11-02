// Gleicher Katalog für Demo und initiale Datenbankeinrichtung.
// In der Datenbank besitzen alle Bereiche, Unterbereiche und Aufgaben eigene UUIDs.
const phases = [
  {name:'Orientierung',goal:'Paco läuft voraus und erklärt den Weg. Du bleibst in unmittelbarer Eingreifnähe.'},
  {name:'Entscheidungen',goal:'Paco entscheidet über sichere Übergänge, Ampeln und den richtigen Weg.'},
  {name:'Ablenkung',goal:'Achte besonders darauf, wie Paco bei anderen Kindern aufmerksam bleibt.'},
  {name:'Überprüfung',goal:'Beobachte, ob Paco die geübten Verhaltensweisen wiederholt zuverlässig umsetzt.'},
];
function area(id,name,icon,groups,phases=[]){
  let position=0;
  return {id,name,icon,hasPhases:phases.length>0,phases,
    criteria:groups.flatMap(g=>g[2]),
    groups:groups.map(([id,name,tasks])=>({id,name,indices:tasks.map(()=>position++)})),
  };
}
export const moduleDefinitions = [
  area('school','Schulweg','↗',[
    ['traffic','Verkehrsverhalten',['Ampelverhalten','Straßen sicher überqueren']],
    ['orientation','Orientierung & Aufmerksamkeit',['Orientierung','Aufmerksamkeit','Umgang mit Ablenkung']],
  ],phases),
  area('learning','Schule & Lernen','✎',[
    ['preparation','Vorbereitung',['Schulranzen packen','Materialien prüfen']],
    ['homework','Hausaufgaben',['Hausaufgaben beginnen','Hausaufgaben erledigen']],
  ]),
  area('household','Haushalt','⌂',[
    ['table','Rund um den Tisch',['Tisch decken','Tisch abräumen']],
    ['dishes','Geschirr',['Geschirr spülen','Geschirr abtrocknen']],
    ['waste','Müll',['Müll rausbringen']],
  ]),
  area('dressing','Anziehen & Ordnung','☀',[
    ['clothes','Kleidung',['Kleidung heraussuchen','Selbstständig anziehen']],
    ['tidying','Aufräumen',['Kleidung wegräumen','Eigene Sachen wegräumen']],
  ]),
];
export const moduleDefinition=moduleDefinitions[0];
export const labels=['Noch nicht geschafft','Mit Unterstützung','Selbstständig geschafft','Nicht beobachtet'];
export function exampleData(){
  const patterns=[[2,1,2,1,0],[2,1,2,1,1],[2,2,2,1,3],[2,2,2,2,1],[2,2,2,1,1],[2,2,2,2,2],[2,2,2,2,1],[2,2,2,2,2]];
  return patterns.map((ratings,i)=>{const d=new Date();d.setDate(d.getDate()-(10-i));return {id:crypto.randomUUID(),moduleId:'school',groupId:'',date:localDate(d),time:'07:40',parent:i%2?'Papa':'Mama',route:'Ruhiger Übungsweg',phase:i<4?0:1,ratings,note:i===7?'An der Ampel selbstständig gewartet. Bei den anderen Kindern kurz erinnert.':'Gemeinsam den bekannten Weg geübt.'};});
}
export function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function statistics(entries,criterion){const values=entries.map(e=>e.ratings[criterion]).filter(v=>[0,1,2].includes(v));const success=values.filter(v=>v===2).length;return {total:values.length,success,percent:values.length?Math.round(success/values.length*100):null};}
export function isoWeek(date){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+3-(d.getDay()+6)%7);const year=d.getFullYear();const first=new Date(year,0,4);return `${year} · KW ${1+Math.round(((d-first)/86400000-3+(first.getDay()+6)%7)/7)}`;}
export function indicesForGroup(module,groupId){return groupId?module.groups.find(g=>g.id===groupId)?.indices??[]:module.criteria.map((_,i)=>i);}
// Auswertungen filtern zuerst den Bereich, dann die Aufgaben des Unterbereichs.
export function scopedEntries(entries,module,groupId=''){
  const indices=indicesForGroup(module,groupId);
  return entries.filter(e=>e.moduleId===module.id).map(e=>({...e,ratings:indices.map(i=>e.ratings[i]??3)}));
}
export function totals(entries){const values=entries.flatMap(e=>e.ratings).filter(v=>[0,1,2].includes(v));const success=values.filter(v=>v===2).length;return {total:values.length,success,percent:values.length?Math.round(success/values.length*100):null};}
