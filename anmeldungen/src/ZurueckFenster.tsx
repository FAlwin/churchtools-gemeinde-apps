import { useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { bescheidMail, zurueckPlan } from '@shared/anmeldung/bewegung';
import type { Absage, CtGruppenfeld, ListenAnmeldung } from '@shared/anmeldung/liste';
import { euroText, kannEtwasKosten } from '@shared/anmeldung/preis';
import { handPlatz, type HandLage } from '@shared/anmeldung/vonHand';
import { tagPunkt } from '@shared/ct/datum';
import { gruppenfelderLaden } from './mitglieder';
import { vonHandAnmelden } from './vonHand';
import { PlatzWahl } from './PlatzWahl';
import type { VonHandFertig } from './VonHandFenster';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';

/**
 * **Eine Abgesagte zurückholen** (A7-4c, Entwurf `a7-4-von-hand-v1`) – mit allen Antworten von damals, Platz nach der
 * Regel des Formulars (`PlatzWahl`), Zahlung nach `zurueckPlan`. ChurchTools schickt dabei keine Mail (gemessen
 * 19.10.2026: Wieder-Aufnehmen per `PUT`); danach „Mail schreiben“ und „Rückgängig“ im Fenster der Anmeldung.
 */
export function ZurueckFenster({
  id,
  e,
  veranstaltung,
  heute,
  lage,
  b,
  liste,
  onClose,
  onFertig,
}: {
  id: number;
  e: OeffentlicheEinstellungen;
  veranstaltung: string;
  heute: string;
  lage: HandLage;
  b: Absage;
  liste: ListenAnmeldung[];
  onClose: () => void;
  onFertig: (x: VonHandFertig) => void;
}) {
  const [felder, setFelder] = useState<ReadonlyMap<number, CtGruppenfeld> | null>(null);
  const [trotzdem, setTrotzdem] = useState(false);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    gruppenfelderLaden(id).then(setFelder, (x: unknown) => setFehler(fehlerMeldung(x).text));
  }, [id]);

  const platz = handPlatz(lage, trotzdem);
  const mitPlatz = platz.status === 'active';
  const plan = felder ? zurueckPlan(e, b, liste, felder, mitPlatz, heute) : null;
  const vor = b.name.split(' ')[0];
  const nr = e.ctFelder.nr === undefined ? undefined : b.werte[e.ctFelder.nr];
  const x = plan?.zuAnmeldung ?? null;

  async function zurueckholen() {
    if (!plan) return;
    setArbeitet(true);
    setFehler(null);
    try {
      const r = await vonHandAnmelden(
        id,
        {
          person: { art: 'da', personId: b.personId, geburtstagNachtragen: null },
          felder: plan.felder,
          nrFeld: e.ctFelder.nr,
          platz,
        },
        heute,
      );
      const kontakt = e.ctFelder.kontakt === undefined ? undefined : b.werte[e.ctFelder.kontakt];
      const [pv, ...pn] = b.name.split(' ');
      onFertig({
        // Ohne Anmelde-Nr. (ältere Anmeldung) heißt die Zeile der Liste nach der Person.
        nr: nr ?? `p${b.personId}`,
        aenderung: {
          text: `${b.name} ist zurück – ${
            r.warteplatz === null ? 'hat einen Platz' : `Warteliste ${r.warteplatz}`
          }.`,
          rueckgaengig: r.rueckgaengig,
        },
        mail: bescheidMail(e, {
          art: 'angemeldet',
          veranstaltung,
          x: x
            ? { email: x.email, wer: x.wer, nr: x.nr }
            : { email: b.email, wer: kontakt || b.name, nr: nr ?? null },
          person: { vor: pv, nach: pn.join(' ') },
          betragCent: mitPlatz ? (plan.zahlung?.betragCent ?? 0) : 0,
          rueckzahlungCent: 0,
          heute,
          warteplatz: r.warteplatz,
        }),
      });
    } catch (y) {
      setFehler(fehlerMeldung(y).text);
    } finally {
      setArbeitet(false);
    }
  }

  const kostet = kannEtwasKosten(e.preis);
  return (
    <Sheet
      title={`${b.name} zurückholen?`}
      onClose={onClose}
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf disabled={arbeitet || !plan} onClick={() => void zurueckholen()}>
          {arbeitet ? 'Einen Moment …' : 'Zurückholen'}
        </FensterKnopf>
      }
    >
      <p className={a.unterTitel}>
        hat am {tagPunkt(b.am)} {b.selbst ? 'selbst abgesagt' : 'abgesagt (vom Team entfernt)'}
        {nr ? ` · Anmelde-Nr. ${nr}` : ''}
      </p>
      {/* Erst wenn der Plan steht – vorher stand kurz der Satz für „allein“ da. */}
      {plan ? (
        <p className={a.leise}>
          {vor} kommt mit allen Antworten von damals zurück
          {x
            ? ` – in die Anmeldung von ${x.wer}. Kontakt, Unterschrift und Auswahl gelten von dort.`
            : ' (Kontakt, Unterschrift, Fragen). Ändern geht danach wie gewohnt in ChurchTools.'}
        </p>
      ) : (
        !fehler && <p className={a.leise}>Einen Moment …</p>
      )}
      {plan?.warBezahlt && (
        <p className={a.hinweisBlau}>
          <b>Hatte vor der Absage schon bezahlt</b> ({plan.warBezahlt}). Die Zahlung ist jetzt neu
          und offen – bitte prüfen, ob schon zurückgezahlt wurde.
        </p>
      )}
      {plan && plan.verloren.length > 0 && (
        <p className={f.fehler}>
          Diese Antworten gibt es in ChurchTools nicht mehr und bleiben leer:{' '}
          {plan.verloren.join('; ')}.
        </p>
      )}
      {plan?.auswahlFehlt && (
        <p className={f.fehler}>
          Die gespeicherte Auswahl gibt es nicht mehr – der Betrag ist nach den heutigen Preisen
          gerechnet. Bitte danach prüfen.
        </p>
      )}
      <PlatzWahl
        lage={lage}
        platz={platz}
        trotzdem={trotzdem}
        onTrotzdem={setTrotzdem}
        vor={vor}
        betrag={
          kostet
            ? {
                titel: x ? `Neue Zahlung für ${vor}` : 'Zahlung der Anmeldung',
                wert: !mitPlatz
                  ? 'folgt beim Nachrücken'
                  : plan
                    ? euroText(plan.zahlung?.betragCent ?? 0)
                    : '…',
              }
            : null
        }
      >
        <p className={a.leise}>
          {x
            ? `Wie bei „Person dazu“: ${vor} bekommt eine eigene Zahlung – um so viel wird die Anmeldung teurer.`
            : 'Wie eine neue Anmeldung: der Betrag nach den Regeln, offen.'}{' '}
          ChurchTools schickt dabei keine Mail – danach gibt es „Mail schreiben“.
        </p>
      </PlatzWahl>
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
