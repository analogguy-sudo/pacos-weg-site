const icons = { traffic: '🚦', direction: '🧭', attention: '☀️', explorer: '🎒' };
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = value => typeof value === 'string' ? value.slice(0, 160) : '';
const number = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

// Nur diese Felder dürfen die abgemeldete Kinderansicht erreichen.
// Insbesondere keine Sessions, Bewertungen, Routen, Elternnamen oder Notizen übernehmen.
export function safeChildSummary(data, depth=0) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Der Fortschritt konnte nicht geladen werden.');
  const summary = {
    nickname: text(data.nickname) || 'Paco',
    module: text(data.module),
    trainingCount: number(data.trainingCount),
    badges: (Array.isArray(data.badges) ? data.badges : []).slice(0, 4).map(b => ({
      name: text(b.name), code: Object.hasOwn(icons, b.code) ? b.code : 'explorer', earned: b.earned === true,
    })),
    successes: (Array.isArray(data.successes) ? data.successes : []).slice(0, 20).map(s => ({ name: text(s.name), count: number(s.count), ...(typeof s.group === 'string' ? {group:text(s.group)} : {}) })).filter(s => s.count > 0),
    milestones: (Array.isArray(data.milestones) ? data.milestones : []).map(m => ({ title: text(m.title) })),
  };
  if(Array.isArray(data.taskRewards))summary.taskRewards=data.taskRewards.slice(0,40).map(task=>({
    name:text(task.name),group:text(task.group),stars:number(task.stars),
    levels:[1,2,3].flatMap(tier=>{
      const level=Array.isArray(task.levels)?task.levels.find(l=>l.tier===tier):null;
      return level&&number(level.target)>0?[{tier,target:number(level.target),earned:level.earned===true}]:[];
    }),
  }));
  if(data.rewardRules)summary.rewardRules={practiceStars:number(data.rewardRules.practiceStars),independentBonus:number(data.rewardRules.independentBonus)};
  if(depth===0&&Array.isArray(data.areas))summary.areas=data.areas.slice(0,20).map(area=>safeChildSummary(area,1));
  return summary;
}

const tierNames=['','Starter','Könner','Profi'];
const tierIcons=['','🥉','🥈','🥇'];
function rewardCards(tasks){
 const groups=[...new Set(tasks.map(t=>t.group||'Deine Aufgaben'))];
 return groups.map(group=>`<div class="reward-group"><h3>${escape(group)}</h3><div class="reward-grid">${tasks.filter(t=>(t.group||'Deine Aufgaben')===group).map(task=>{
   const next=task.levels.find(l=>!l.earned),earned=task.levels.filter(l=>l.earned);
   const remaining=next?Math.max(0,next.target-task.stars):0;
   return `<article class="task-reward"><div class="row"><h4>${escape(task.name)}</h4><strong class="star-count">⭐ <span>${task.stars} ${task.stars===1?'Stern':'Sterne'}</span></strong></div>
     ${next?`<p class="reward-next"><span>Noch ${remaining} ${remaining===1?'Stern':'Sterne'} bis zum ${tierNames[next.tier]}-Abzeichen!</span></p><progress max="${next.target}" value="${Math.min(task.stars,next.target)}" aria-label="${escape(task.name)} · ${task.stars} von ${next.target} Sternen"></progress><p class="note">${task.stars} / ${next.target} <span>Sterne</span></p>`:'<p class="reward-next"><strong>Alle drei Abzeichen geschafft!</strong></p>'}
     <div class="reward-levels">${task.levels.map(level=>`<div class="reward-level ${level.earned?'earned':''}"><span aria-hidden="true">${tierIcons[level.tier]}</span><strong>${tierNames[level.tier]}</strong><small><span>${level.target} Sterne</span></small><small>${level.earned?'✓ Erreicht':'Noch vor dir'}</small></div>`).join('')}</div>
     ${!next&&earned.length?'<p class="note">Du kannst weiter Sterne sammeln.</p>':''}
   </article>`;
 }).join('')}</div></div>`).join('');
}
function areaContent(area){
 const groups=[...new Set(area.successes.map(s=>s.group||'Erfolge'))];
 const legacy=area.badges.filter(b=>b.earned);
 return `<section class="child-area"><h2>${escape(area.module)}</h2><p class="muted">${area.trainingCount===1?'Eine gemeinsame Übung':area.trainingCount+' gemeinsame Übungen'}</p>
    ${area.taskRewards?rewardCards(area.taskRewards):''}
    ${legacy.length?`<details class="legacy-badges"><summary>Deine bisherigen Abzeichen</summary><div class="badges">${legacy.map(b=>`<div class="badge"><b aria-hidden="true">${icons[b.code]}</b><h3>${escape(b.name)}</h3><p class="note">Bleibt dein verdienter Erfolg.</p></div>`).join('')}</div></details>`:''}
    ${!area.taskRewards?groups.map(group=>`<div class="card child-success"><h3>${escape(group)}</h3>${area.successes.filter(s=>(s.group||'Erfolge')===group).map(s=>`<p>⭐ ${escape(s.name)}<br><span class="muted">${s.count} Mal selbstständig geschafft</span></p>`).join('')}</div>`).join(''):''}
    ${!area.successes.length&&!area.taskRewards?'<p class="note">Hier beginnt dein nächstes Abenteuer. Gemeinsam üben zählt!</p>':''}
    ${area.milestones.length?`<div class="card child-success"><h3>Deine Meilensteine</h3>${area.milestones.map(m=>`<p>🌟 <span data-original>${escape(m.title)}</span></p>`).join('')}</div>`:''}</section>`;
}
function rewardOverview(areas){
 const tasks=areas.flatMap(a=>a.taskRewards??[]);if(!tasks.length)return '';
 const stars=tasks.reduce((sum,t)=>sum+t.stars,0),badges=tasks.reduce((sum,t)=>sum+t.levels.filter(l=>l.earned).length,0);
 const rules=areas.find(a=>a.rewardRules)?.rewardRules??{practiceStars:1,independentBonus:1};
 return `<div class="card reward-overview"><div class="reward-totals"><div><strong>⭐ ${stars}</strong><span>Deine Sterne insgesamt</span></div><div><strong>🏅 ${badges}</strong><span>Deine Aufgaben-Abzeichen</span></div></div><h2>So sammelst du Sterne</h2><p><span>${rules.practiceStars} Stern${rules.practiceStars===1?'':'e'} fürs Üben</span><br><span>${rules.independentBonus} zusätzliche${rules.independentBonus===1?'r Stern':' Sterne'} fürs selbstständige Schaffen</span></p><p class="note">Pro Aufgabe und Tag zählt die beste Bewertung einmal. Es gibt keine Minuspunkte. Mama und Papa sammeln mit dir gemeinsam.</p><p class="note">Jede Aufgabe hat ihre eigenen Sterne. Verdiente Abzeichen bleiben dir erhalten.</p></div>`;
}

export function renderChildSummary(summary) {
  if(summary.areas)return `<div class="kid"><span class="eyebrow">Deine kleine Abenteuerreise</span><h1>Hallo, ${escape(summary.nickname)}! ☀</h1><p>Du wirst Schritt für Schritt selbstständiger.<br>In deinem Tempo.</p>${rewardOverview(summary.areas)}${summary.areas.map(areaContent).join('')}<p class="note child-footnote">Hier siehst du deinen Fortschritt beim Öffnen dieser Ansicht. Deine Eltern begleiten dich; für den Elternbereich müssen sie sich neu anmelden.</p></div>`;
  return `<div class="kid"><span class="eyebrow">Deine kleine Abenteuerreise</span><h1>Hallo, ${escape(summary.nickname)}! ☀</h1><p>Schritt für Schritt. In deinem Tempo.</p>${rewardOverview([summary])}${areaContent(summary)}<p class="note child-footnote">Deine Eltern begleiten dich und entscheiden, wann du bereit für den nächsten Schritt bist.</p></div>`;
}
