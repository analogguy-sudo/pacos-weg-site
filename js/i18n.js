import {spanish} from './es.js';
const key='pacos-language-v1';
let language='de';
try{const saved=globalThis.localStorage?.getItem(key);if(saved==='es')language='es';}catch{}
const originalText=new WeakMap(), originalAttributes=new WeakMap();
const upper=new Map(Object.entries(spanish).map(([de,es])=>[de.toLocaleUpperCase('de-DE'),es]));
const phrases=Object.keys(spanish).filter(s=>s.length>25).sort((a,b)=>b.length-a.length);
export const getLanguage=()=>language;
export const getLocale=()=>language==='es'?'es-ES':'de-DE';
// Öffnet nur auf Klick den Google Übersetzer; die Zielsprache folgt der gewählten Oberfläche.
export const translationUrl=(text,target=language)=>`https://translate.google.com/?sl=auto&tl=${target==='es'?'es':'de'}&op=translate&text=${encodeURIComponent(text)}`;
export function setLanguage(value){
 language=value==='es'?'es':'de';
 try{globalThis.localStorage?.setItem(key,language);}catch{}
 if(typeof document!=='undefined'){document.documentElement.lang=language;document.title=translateText('Pacos Weg in die Selbstständigkeit');}
}
// Traducción local de textos de interfaz. Las notas solo salen de la app si se pulsa «Übersetzen».
export function translateText(source,target=language){
 if(target!=='es'||typeof source!=='string')return source;
 const value=source.trim();if(!value)return source;
 const wrap=text=>source.slice(0,source.indexOf(value))+text+source.slice(source.indexOf(value)+value.length);
 if(Object.hasOwn(spanish,value))return wrap(spanish[value]);
 if(value===value.toLocaleUpperCase('de-DE')&&upper.has(value))return wrap(upper.get(value).toLocaleUpperCase('es-ES'));
 let match;
 if((match=value.match(/^(\d+) Sterne?$/)))return wrap(`${match[1]} ${match[1]==='1'?'estrella':'estrellas'}`);
 if((match=value.match(/^(\d+) von (\d+) Sternen$/)))return wrap(`${match[1]} de ${match[2]} estrellas`);
 if((match=value.match(/^Noch (\d+) Sterne? bis zum (Starter|Könner|Profi)-Abzeichen!$/)))return wrap(`¡${match[1]==='1'?'Falta 1 estrella':'Faltan '+match[1]+' estrellas'} para la insignia ${translateText(match[2],target)}!`);
 if((match=value.match(/^(\d+) Sterne? fürs Üben$/)))return wrap(`${match[1]} ${match[1]==='1'?'estrella':'estrellas'} por practicar`);
 if((match=value.match(/^(\d+) zusätzliche(?:r Stern| Sterne) fürs selbstständige Schaffen$/)))return wrap(`${match[1]} ${match[1]==='1'?'estrella adicional':'estrellas adicionales'} por conseguirlo sin ayuda`);
 if((match=value.match(/^Hallo, (.+)!([ ☀]*)$/)))return wrap(`¡Hola, ${translateText(match[1],target)}!${match[2]}`);
 if((match=value.match(/^Angemeldet als (.+)$/)))return wrap('Sesión de '+translateText(match[1],target));
 if((match=value.match(/^(\d+) von (\d+) bewerteten Beobachtungen selbstständig$/)))return wrap(`${match[1]} de ${match[2]} observaciones valoradas sin ayuda`);
 if((match=value.match(/^(\d+) Mal selbstständig geschafft$/)))return wrap(`${match[1]} ${match[1]==='1'?'vez':'veces'} conseguido sin ayuda`);
 if((match=value.match(/^(\d+) gemeinsame Übungen$/)))return wrap(`${match[1]} prácticas juntos`);
 if(value.includes(' · '))return wrap(value.split(' · ').map(part=>translateText(part,target)).join(' · '));
 if(value.includes(': '))return wrap(value.split(': ').map(part=>translateText(part,target)).join(': '));
 if((match=value.match(/^Woche (\d+)$/)))return wrap('Semana '+match[1]);
 if((match=value.match(/^KW (\d+)$/)))return wrap('semana '+match[1]);
 if((match=value.match(/^(\d+) Unterbereiche$/)))return wrap(match[1]+' subáreas');
 if((match=value.match(/^(\d+) (?:Übung|Übungen)$/)))return wrap(`${match[1]} ${match[1]==='1'?'práctica':'prácticas'}`);
 if((match=value.match(/^(.+) üben$/)))return wrap('Practicar: '+translateText(match[1],target));
 if((match=value.match(/^Du übst (.+)\.$/)))return wrap('Practicas: '+translateText(match[1],target)+'.');
 for(const phrase of phrases){if(value.startsWith(phrase+' '))return wrap(spanish[phrase]+' '+translateText(value.slice(phrase.length+1),target));}
 return source;
}
export function languageSwitcher(){
 return `<div class="language-switch" role="group" aria-label="Sprache"><button type="button" data-language="de" aria-label="Deutsch" aria-pressed="${language==='de'}" title="Deutsch"><span aria-hidden="true">🇩🇪</span> DE</button><button type="button" data-language="es" aria-label="Español" aria-pressed="${language==='es'}" title="Español"><span aria-hidden="true">🇪🇸</span> ES</button></div>`;
}
export function translateTree(element){
 if(!element)return;
 // Optionswerte bleiben stabile Datenwerte, auch wenn ihre Beschriftung übersetzt wird.
 element.querySelectorAll('option:not([value])').forEach(option=>{option.value=option.textContent;});
 const walker=element.ownerDocument.createTreeWalker(element,4);
 let node;
 while((node=walker.nextNode())){
  if(node.parentElement?.closest('[data-original],textarea,script,style'))continue;
  if(!originalText.has(node))originalText.set(node,node.textContent);
  node.textContent=translateText(originalText.get(node));
 }
 for(const el of [element,...element.querySelectorAll('*')]){
  if(el.closest('[data-original]'))continue;
  let originals=originalAttributes.get(el);if(!originals){originals={};originalAttributes.set(el,originals);}
  for(const attr of ['aria-label','title','placeholder']){
   if(!el.hasAttribute(attr)||el.hasAttribute('data-language'))continue;
   if(!(attr in originals))originals[attr]=el.getAttribute(attr);
   el.setAttribute(attr,translateText(originals[attr]));
  }
 }
 element.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===language)));
}
