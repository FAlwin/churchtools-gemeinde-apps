import { useState } from 'react';
import type { AbsagePlan, Mail, NachrueckPlan } from '@shared/anmeldung/bewegung';
import { mailtoLink } from '@shared/anmeldung/bewegung';
import { euroText } from '@shared/anmeldung/preis';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import { mailHinweis } from './anzeige';

/**
 * **Rückfragen und Mail im Fenster einer Anmeldung** (A7-3, Entwurf `a7-3-nachruecken-v1`) – sie ersetzen den Inhalt
 * des Fensters, bis man bestätigt oder abbricht (kein Fenster im Fenster).
 */

function Knoepfe({
  arbeitet,
  ja,
  gefahr,
  onJa,
  onAbbrechen,
}: {
  arbeitet: boolean;
  ja: string;
  gefahr?: boolean;
  onJa: () => void;
  onAbbrechen: () => void;
}) {
  return (
    <div className={a.knoepfe}>
      <button type="button" className={a.linkKnopf} disabled={arbeitet} onClick={onAbbrechen}>
        Abbrechen
      </button>
      <button
        type="button"
        className={gefahr ? a.gefahrKnopf : f.knopf}
        disabled={arbeitet}
        onClick={onJa}
      >
        {arbeitet ? 'Einen Moment …' : ja}
      </button>
    </div>
  );
}

const platzText = (belegt: number, max: number | null) =>
  max === null ? `${belegt}` : `${belegt} von ${max}`;

export function NachrueckenFrage({
  plan,
  vor,
  arbeitet,
  fehler,
  onJa,
  onAbbrechen,
  mitBestaetigung = false,
}: {
  plan: NachrueckPlan;
  vor: string;
  arbeitet: boolean;
  fehler: string | null;
  onJa: () => void;
  onAbbrechen: () => void;
  /** Bestätigungsmails eingerichtet (A9-1) – dann schickt ChurchTools die Bestätigung mit Betrag. */
  mitBestaetigung?: boolean;
}) {
  const max = plan.neuesMax ?? plan.max;
  return (
    <section className={a.teil}>
      {plan.neuesMax !== null && (
        <p className={a.hinweisBlau}>
          <b>Alle {plan.max} Plätze sind belegt.</b> {vor} rückt trotzdem nach – die Plätze werden
          dabei auf <b>{plan.neuesMax}</b> erhöht. Neue Anmeldungen kommen danach weiter auf die
          Warteliste.
        </p>
      )}
      {plan.vorher.length > 0 && (
        <p className={a.hinweisBlau}>
          {vor} wartet nicht als Erste – vor {vor} {plan.vorher.length === 1 ? 'wartet' : 'warten'}{' '}
          {plan.vorher.join(', ')}.
        </p>
      )}
      <p className={a.summe}>
        <span>Plätze</span>
        <span>
          {platzText(plan.belegt, plan.max)} → <b>{platzText(plan.belegt + 1, max)}</b>
        </span>
      </p>
      {plan.zahlung && (
        <p className={a.summe}>
          <span>
            {plan.zahlung.art === 'eigene' ? `Neue Zahlung für ${vor}` : 'Zahlung der Anmeldung'}
          </span>
          <b>{euroText(plan.zahlung.betragCent)}</b>
        </p>
      )}
      {plan.zahlung?.art === 'eigene' && (
        <p className={a.leise}>
          Wie eine neue Anmeldung: {vor} bekommt eine eigene Zahlung („offen“). Die bisherige
          Zahlung der Anmeldung bleibt, wie sie ist.
        </p>
      )}
      {plan.auswahlFehlt && (
        <p className={f.fehler}>
          Die gespeicherte Auswahl gibt es nicht mehr – der Betrag ist nach den heutigen Preisen
          gerechnet. Bitte danach prüfen.
        </p>
      )}
      <p className={a.leise}>
        {mailHinweis('nachruecken', mitBestaetigung, vor)} Nachrücken lässt sich{' '}
        <b>nicht rückgängig</b> machen (ChurchTools würde sonst „Du stehst auf der Warteliste“
        schicken).
      </p>
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
      <Knoepfe
        arbeitet={arbeitet}
        ja={plan.neuesMax !== null ? 'Plätze erhöhen und nachrücken' : 'Nachrücken lassen'}
        onJa={onJa}
        onAbbrechen={onAbbrechen}
      />
    </section>
  );
}

export function AbsagenFrage({
  plan,
  vor,
  uebergabeAn,
  belegt,
  max,
  arbeitet,
  fehler,
  onJa,
  onAbbrechen,
}: {
  plan: AbsagePlan;
  vor: string;
  /** Vorname der Person, die Kontakt, Unterschrift und Zahlung bekommt. */
  uebergabeAn: string | null;
  belegt: number;
  max: number | null;
  arbeitet: boolean;
  fehler: string | null;
  onJa: () => void;
  onAbbrechen: () => void;
}) {
  const h = plan.haupt;
  return (
    <section className={a.teil}>
      <p className={a.hinweisRot}>
        {vor} wird aus der Gruppe entfernt. ChurchTools schickt dabei <b>keine Mail</b> – danach
        gibt es hier „Mail schreiben“. Die Antworten bleiben im Verlauf (Filter „Abgesagt“).
      </p>
      {h && h.vorherCent !== h.betragCent && (
        <p className={a.summe}>
          <span>Zahlung der Anmeldung</span>
          <span>
            <s>{h.vorherCent === null ? '–' : euroText(h.vorherCent)}</s>{' '}
            <b>{euroText(h.betragCent)}</b>
          </span>
        </p>
      )}
      {(h?.rueckzahlungCent ?? plan.rueckzahlungOhneRestCent) > 0 && (
        <p className={a.leise}>
          Schon bezahlt – <b>{euroText(h?.rueckzahlungCent ?? plan.rueckzahlungOhneRestCent)}</b>{' '}
          zurückzahlen (von Hand
          {h ? '; steht danach in der Aufschlüsselung' : ''}).
        </p>
      )}
      {uebergabeAn && (
        <p className={a.leise}>
          Kontakt, Unterschrift und Zahlung stehen bisher bei {vor} – sie gehen an {uebergabeAn}.
        </p>
      )}
      {plan.letzte && <p className={a.leise}>{vor} ist die letzte Person dieser Anmeldung.</p>}
      {plan.hatPlatz && (
        <p className={a.summe}>
          <span>Plätze</span>
          <span>
            {platzText(belegt, max)} → <b>{platzText(belegt - 1, max)}</b>
          </span>
        </p>
      )}
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
      <Knoepfe arbeitet={arbeitet} ja="Ja, absagen" gefahr onJa={onJa} onAbbrechen={onAbbrechen} />
    </section>
  );
}

/** **Die fertige Mail** – öffnet das Mailprogramm (`mailto:`) oder kopiert den Text. */
export function MailAnsicht({ mail, onZurueck }: { mail: Mail; onZurueck: () => void }) {
  const [kopiert, setKopiert] = useState<'ja' | 'nein' | null>(null);
  const kopieren = () =>
    navigator.clipboard.writeText(`${mail.betreff}\n\n${mail.text}`).then(
      () => setKopiert('ja'),
      () => setKopiert('nein'),
    );
  return (
    <section className={a.teil}>
      <div className={a.mail}>
        <div className={a.mailKopf}>
          An <b>{mail.an ?? '– keine E-Mail-Adresse –'}</b>
          <br />
          Betreff <b>{mail.betreff}</b>
        </div>
        <div className={a.mailText}>{mail.text}</div>
      </div>
      <p className={a.leise}>
        {mail.an
          ? 'Öffnet dein Mailprogramm mit diesem Text – du schickst selbst ab und kannst vorher noch ändern.'
          : 'Ohne E-Mail-Adresse: Text kopieren und auf anderem Weg weitergeben (z. B. per Nachricht).'}
      </p>
      {kopiert === 'ja' && <p className={f.gut}>Kopiert.</p>}
      {kopiert === 'nein' && (
        <p className={f.fehler}>Kopieren ging nicht – bitte den Text oben markieren.</p>
      )}
      <div className={a.knoepfe}>
        <button type="button" className={a.linkKnopf} onClick={onZurueck}>
          Zurück
        </button>
        <button type="button" className={a.linkKnopf} onClick={() => void kopieren()}>
          Text kopieren
        </button>
        {mail.an && (
          <a className={f.knopf} href={mailtoLink(mail)}>
            Im Mailprogramm öffnen
          </a>
        )}
      </div>
    </section>
  );
}
