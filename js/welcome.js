import {languageSwitcher} from './i18n.js';
// Öffentliche Startansicht enthält keine Familien- oder Trainingsdaten.
export function renderWelcome(){
  return `<main class="welcome-shell"><div class="language-toolbar">${languageSwitcher()}</div><div class="welcome-brand"><img src="icon.svg" alt=""><span>PACOS WEG</span></div>
    <div class="welcome-intro"><span class="eyebrow">Schritt für Schritt. Gemeinsam wachsen.</span><h1>Pacos Weg in die<br>Selbstständigkeit</h1><p>Jeder kleine Schritt macht einen Unterschied.<br>Wohin möchtest du heute?</p></div>
    <div class="welcome-options"><section class="welcome-option welcome-parent"><span class="welcome-symbol" aria-hidden="true">⌂</span><h2>Elternbereich</h2><p>Übungen begleiten, Beobachtungen festhalten und Fortschritte entdecken.</p><button class="primary" data-action="welcome-parent">Als Mama oder Papa anmelden →</button><small>Mit E-Mail-Adresse und Passwort</small></section>
    <section class="welcome-option welcome-child"><span class="welcome-symbol" aria-hidden="true">☀</span><h2>Kinderbereich</h2><p>Hallo, Paco! Hier warten deine Erfolge, Abzeichen und kleinen Abenteuer.</p><button data-action="welcome-child">Zu Pacos Ansicht →</button><small>Mit deiner Kinder-PIN · einmalig von Mama oder Papa einrichten.</small></section></div>
    <p class="welcome-privacy">Ein privater Ort für eure Familie.</p><button class="demo-link" data-action="welcome-demo">Demo mit Beispieldaten ansehen</button></main>`;
}
