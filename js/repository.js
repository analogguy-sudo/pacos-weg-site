import { supabaseConfig } from './config.js';
import { safeChildSummary } from './child-view.js';
import { moduleDefinitions, indicesForGroup } from './data.js';

// Kleine REST-Anbindung ohne zusätzliche Bibliothek oder Build-Schritt.
// Zugangstokens und Familiendaten bleiben ausschließlich im Arbeitsspeicher.
export class FamilyRepository {
  constructor(config = supabaseConfig, request = globalThis.fetch.bind(globalThis)) {
    this.config = config;
    this.request = request;
    this.session = null;
    this.context = null;
    this.refreshing = null;
    this.generation = 0;
    this.switching = false;
  }

  async auth(path, body, token) {
    const response = await this.request(`${this.config.url}/auth/v1/${path}`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      headers: { apikey: this.config.publishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error('Anmeldung fehlgeschlagen. Bitte Zugangsdaten und Verbindung prüfen.');
    return data;
  }

  async login(email, password) {
    const generation = ++this.generation;
    const session = await this.auth('token?grant_type=password', { email, password });
    if (generation !== this.generation) throw new Error('Diese Anmeldung wurde beendet.');
    this.session = session;
    this.session.expires_at = Date.now() + this.session.expires_in * 1000;
    try { return await this.load(); }
    catch (error) { await this.logout(); throw error; }
  }

  async accessToken() {
    if (!this.session) throw new Error('Bitte zuerst anmelden.');
    if (Date.now() > this.session.expires_at - 60000) {
      const generation = this.generation;
      this.refreshing ??= this.auth('token?grant_type=refresh_token', { refresh_token: this.session.refresh_token })
        .then(session => {
          if (generation !== this.generation) throw new Error('Diese Sitzung wurde beendet.');
          this.session = { ...session, expires_at: Date.now() + session.expires_in * 1000 };
        })
        .finally(() => { this.refreshing = null; });
      await this.refreshing;
    }
    return this.session.access_token;
  }

  async api(path, { method = 'GET', body, headers = {}, childTransition = false } = {}) {
    const generation = this.generation;
    if (this.switching && !childTransition) throw new Error('Der Wechsel in Pacos Ansicht läuft.');
    const token = await this.accessToken();
    if (generation !== this.generation) throw new Error('Diese Sitzung wurde beendet.');
    let response;
    try {
      response = await this.request(`${this.config.url}/rest/v1/${path}`, {
        method,
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
        headers: { apikey: this.config.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch { throw new Error('Keine Verbindung. Deine Eingabe wurde nicht als gespeichert bestätigt. Bitte erneut versuchen.'); }
    const data = await response.json().catch(() => null);
    if (generation !== this.generation || (this.switching && !childTransition)) throw new Error('Diese Sitzung wurde beendet.');
    if (!response.ok) {
      if (response.status === 401) throw new Error('Anmeldung abgelaufen. Bitte abmelden und erneut anmelden.');
      if (response.status === 403) throw new Error('Für diese Daten fehlt die Elternberechtigung.');
      throw new Error('Daten konnten nicht gespeichert oder geladen werden. Bitte Eingaben und Verbindung prüfen.');
    }
    return data;
  }

  async load() {
    const generation = this.generation;
    const [members, children, moduleRows, profiles] = await Promise.all([
      this.api('paco_memberships?select=user_id,family_id,role,display_label'),
      this.api('paco_children?select=id,family_id,nickname'),
      this.api('paco_modules?select=id,family_id,slug,name,uses_phases&active=eq.true'),
      this.api(`paco_profiles?select=preferred_language&id=eq.${this.session.user.id}`),
    ]);
    const self = members.find(m => m.user_id === this.session?.user.id && m.role === 'parent');
    if (!self) throw new Error('Das Konto ist noch keiner Familie als Mama oder Papa zugeordnet.');
    const child = children.find(c => c.family_id === self.family_id);
    if (!child) throw new Error('Das Kinderprofil muss zuerst eingerichtet werden.');
    const filter = `family_id=eq.${self.family_id}`;
    const [groups, criteria, phases, plans, sessions] = await Promise.all([
      this.api(`paco_subareas?select=id,module_id,slug,name,position&${filter}&order=position`),
      this.api(`paco_criteria?select=id,module_id,subarea_id,name,position&${filter}&order=position`),
      this.api(`paco_phases?select=id,module_id,name,goal,position&${filter}&order=position`),
      this.api(`paco_plans?select=id,module_id,phase_id&${filter}&child_id=eq.${child.id}`),
      this.readSessions(`${filter}&child_id=eq.${child.id}`),
    ]);
    const modules = moduleRows.filter(m => m.family_id === self.family_id).map(m => {
      const tasks = criteria.filter(c => c.module_id === m.id);
      const stages = phases.filter(p => p.module_id === m.id);
      const plan = plans.find(p => p.module_id === m.id);
      return {
        id:m.slug, dbId:m.id, name:m.name, icon:moduleDefinitions.find(d => d.id === m.slug)?.icon ?? '◇',
        hasPhases:m.uses_phases, phases:stages, criteria:tasks.map(t => t.name), criterionIds:tasks.map(t => t.id),
        groups:groups.filter(g => g.module_id === m.id).map(g => ({id:g.slug, dbId:g.id, name:g.name, indices:tasks.map((t,i) => t.subarea_id === g.id ? i : -1).filter(i => i >= 0)})),
        planId:plan?.id, currentPhase:Math.max(0, stages.findIndex(p => p.id === plan?.phase_id)),
      };
    }).sort((a,b) => (moduleDefinitions.findIndex(d => d.id===a.id)+100)%100 - (moduleDefinitions.findIndex(d => d.id===b.id)+100)%100);
    if (!modules.length || modules.some(m => !m.criteria.length || !m.groups.length || (m.hasPhases && (!m.phases.length || !m.planId)))) throw new Error('Die Trainingsbereiche sind noch nicht vollständig eingerichtet.');
    if (generation !== this.generation || this.switching) throw new Error('Diese Sitzung wurde beendet.');
    this.context = {familyId:self.family_id, childId:child.id, modules, members:members.filter(m => m.family_id === self.family_id && m.role === 'parent')};
    return {
      parent:self.display_label, modules, language:profiles[0]?.preferred_language??'de',
      phasesByModule:Object.fromEntries(modules.filter(m => m.hasPhases).map(m => [m.id,m.currentPhase])),
      entries:sessions.flatMap(s => {
        const module=modules.find(m => m.dbId===s.module_id);
        if (!module) return [];
        return [{
          id:s.id, moduleId:module.id, groupId:module.groups.find(g => g.dbId===s.subarea_id)?.id ?? '',
          date:s.training_date,time:s.training_time.slice(0,5),
          parent:members.find(m => m.user_id===s.accompanied_by)?.display_label ?? 'Elternteil',
          phase:module.hasPhases ? module.phases.findIndex(p => p.id===s.phase_id) : null,
          route:s.route_label ?? '', ratings:module.criterionIds.map(id => s.paco_ratings.find(r => r.criterion_id===id)?.value ?? 3),
          note:s.paco_parent_comments[0]?.body ?? '',
        }];
      }),
    };
  }

  module(id) {
    const module=this.context?.modules.find(m => m.id===id);
    if (!module) throw new Error('Trainingsbereich nicht verfügbar.');
    return module;
  }

  async readSessions(filter) {
    // PostgREST begrenzt Antworten: explizite Seiten verhindern unbemerkte Statistik-Lücken.
    const result = [];
    const size = 250;
    for (let offset = 0; ; offset += size) {
      const rows = await this.api(`paco_sessions?select=id,module_id,subarea_id,phase_id,accompanied_by,training_date,training_time,route_label,paco_ratings(criterion_id,value),paco_parent_comments(body)&${filter}&order=training_date.desc,id.desc&limit=${size}&offset=${offset}`);
      result.push(...rows);
      if (rows.length < size) break;
    }
    return result;
  }

  async putTraining(entry, original) {
    const c=this.context, module=this.module(entry.moduleId);
    const companion=c.members.find(m => m.display_label===entry.parent);
    const group=entry.groupId ? module.groups.find(g => g.id===entry.groupId) : null;
    if (!companion || (entry.groupId && !group) || (module.hasPhases && !module.phases[entry.phase])) throw new Error('Begleitperson, Unterbereich oder Phase ist nicht verfügbar.');
    const indices=indicesForGroup(module,entry.groupId);
    const id=await this.api('rpc/paco_save_training', {method:'POST',body:{payload:{
      id:original?.id ?? null, family_id:c.familyId, module_id:module.dbId, child_id:c.childId,
      subarea_id:group?.dbId ?? null, phase_id:module.hasPhases ? module.phases[entry.phase].id : null,
      accompanied_by:companion.user_id,date:entry.date,time:entry.time,route:module.hasPhases ? entry.route : null,note:entry.note,
      ratings:indices.map(i => ({criterion_id:module.criterionIds[i],value:entry.ratings[i] ?? 3})),
    }}});
    return {...entry,id};
  }

  async deleteTraining(id, moduleId) {
    const c=this.context, module=this.module(moduleId);
    const rows=await this.api(`paco_sessions?id=eq.${id}&family_id=eq.${c.familyId}&child_id=eq.${c.childId}&module_id=eq.${module.dbId}`,{method:'DELETE',headers:{Prefer:'return=representation'}});
    if (rows.length!==1) throw new Error('Der Eintrag wurde bereits gelöscht oder ist nicht mehr zugänglich.');
  }

  async setPhase(index, moduleId='school') {
    const module=this.module(moduleId), phase=module.phases[index];
    if (!module.hasPhases || !phase || !module.planId) throw new Error('Für diesen Bereich ist keine Trainingsphase vorgesehen.');
    const rows=await this.api(`paco_plans?id=eq.${module.planId}`,{method:'PATCH',body:{phase_id:phase.id},headers:{Prefer:'return=representation'}});
    if (rows.length!==1) throw new Error('Trainingsplan konnte nicht geändert werden.');
  }

  async setPreferredLanguage(language) {
    if(!['de','es'].includes(language))throw new Error('Ungültige Sprache.');
    const rows=await this.api(`paco_profiles?id=eq.${this.session.user.id}`,{method:'PATCH',body:{preferred_language:language},headers:{Prefer:'return=representation'}});
    if(rows.length!==1)throw new Error('Sprache konnte nicht gespeichert werden.');
  }

  async enterChildMode() {
    if (!this.context || !this.session || this.switching) throw new Error('Bitte zuerst als Elternteil anmelden.');
    this.switching = true;
    try {
      const data = await this.api('rpc/paco_child_summary', {
        method: 'POST', childTransition: true,
        body: { target_child: this.context.childId, target_module: null },
      });
      const summary = safeChildSummary(data);
      // Ohne bestätigte serverseitige Abmeldung darf die Kinderansicht nicht öffnen.
      await this.logout({ strict: true });
      return summary;
    } finally { this.switching = false; }
  }

  clearSession() {
    this.generation++;
    this.session = null;
    this.context = null;
    this.refreshing = null;
  }

  async logout({ strict = false } = {}) {
    if (strict) {
      const token = await this.accessToken();
      try { await this.auth('logout?scope=local', undefined, token); }
      catch { throw new Error('Die Abmeldung konnte nicht bestätigt werden. Bitte das Gerät noch nicht an Paco übergeben und den Wechsel erneut versuchen.'); }
      this.clearSession();
      return;
    }
    const token = this.session?.access_token;
    this.clearSession();
    if (!token) return;
    try { await this.auth('logout?scope=local', undefined, token); }
    catch { /* Lokal immer abmelden; das Token wird nicht gespeichert. */ }
  }
}
