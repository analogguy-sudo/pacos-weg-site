import {supabaseConfig} from './config.js';
import {safeChildSummary} from './child-view.js';
const storageKey='pacos-child-device-v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class ChildAccess{
 constructor(config=supabaseConfig,storage=globalThis.localStorage,request=globalThis.fetch.bind(globalThis)){this.config=config;this.storage=storage;this.request=request;}
 pairing(){
  try{const p=JSON.parse(this.storage.getItem(storageKey));return p&&uuid.test(p.deviceId)&&/^[0-9a-f]{64}$/i.test(p.deviceSecret)?{deviceId:p.deviceId,deviceSecret:p.deviceSecret}:null;}catch{return null;}
 }
 async setup(repository,pin){
  if(!/^[0-9]{6}$/.test(pin))throw new Error('Bitte eine PIN mit sechs Ziffern wählen.');
  const data=await repository.api('rpc/paco_create_child_device',{method:'POST',body:{target_child:repository.context.childId,new_pin:pin,replace_device:this.pairing()?.deviceId??null}});
  if(!data||!uuid.test(data.deviceId)||! /^[0-9a-f]{64}$/i.test(data.deviceSecret))throw new Error('Der Kinderzugang konnte nicht eingerichtet werden.');
  try{this.storage.setItem(storageKey,JSON.stringify({deviceId:data.deviceId,deviceSecret:data.deviceSecret}));}
  catch{await repository.api('rpc/paco_revoke_child_device',{method:'POST',body:{target_device:data.deviceId}});throw new Error('Der Browser kann die Gerätefreigabe nicht speichern. Bitte den Browser-Speicher erlauben.');}
 }
 async remove(repository){
  const device=this.pairing();if(device)await repository.api('rpc/paco_revoke_child_device',{method:'POST',body:{target_device:device.deviceId}});
  this.storage.removeItem(storageKey);
 }
 async unlock(pin){
  const device=this.pairing();if(!device)throw new Error('Mama oder Papa müssen die Kinder-PIN zuerst auf diesem Gerät einrichten.');
  if(!/^[0-9]{6}$/.test(pin))throw new Error('Bitte deine sechsstellige Kinder-PIN eingeben.');
  let response;
  try{response=await this.request(this.config.url+'/functions/v1/child-unlock',{
   method:'POST',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(20000),
   headers:{apikey:this.config.publishableKey,'Content-Type':'application/json'},
   body:JSON.stringify({...device,pin}),
  });}catch{throw new Error('Keine Verbindung. Bitte versuche es noch einmal.');}
  if(response.status===429)throw new Error('Zu viele Versuche. Bitte warte 15 Minuten oder bitte Mama oder Papa um Hilfe.');
  if(response.status===401)throw new Error('Die PIN stimmt nicht oder die Gerätefreigabe wurde aufgehoben. Bitte versuche es erneut oder frage Mama oder Papa.');
  if(!response.ok)throw new Error('Der Kinderbereich ist gerade nicht erreichbar. Bitte versuche es später noch einmal.');
  const data=await response.json();return safeChildSummary(data.summary);
 }
}
