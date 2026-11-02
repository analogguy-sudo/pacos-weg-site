// Nur für Demo und Tests. In der Cloud rechnet ausschließlich die Datenbank.
export const demoRewardRules=Object.freeze({practiceStars:1,independentBonus:1,targets:[5,15,30]});
export function taskRewards(entries,module,awards={},rules=demoRewardRules){
 return module.criteria.map((name,index)=>{
  const daily=new Map();
  for(const entry of entries){
   if(entry.moduleId!==module.id||![0,1,2].includes(entry.ratings[index]))continue;
   const points=rules.practiceStars+(entry.ratings[index]===2?rules.independentBonus:0);
   daily.set(entry.date,Math.max(daily.get(entry.date)??0,points));
  }
  const stars=[...daily.values()].reduce((a,b)=>a+b,0);
  return {name,group:module.groups.find(g=>g.indices.includes(index))?.name??'',stars,
   levels:rules.targets.map((target,i)=>({tier:i+1,target,earned:stars>=target||awards[module.id+':'+index]?.includes(i+1)===true})),
  };
 });
}
export function rememberDemoAwards(entries,modules,previous={}){
 const awards=structuredClone(previous);
 for(const m of modules)taskRewards(entries,m,awards).forEach((task,index)=>{awards[m.id+':'+index]=task.levels.filter(l=>l.earned).map(l=>l.tier);});
 return awards;
}
