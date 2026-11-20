/**
 * **Einstieg einer Veranstaltung** (U1, Entwurf `ux-umbau-v1`, Alwin 28.10.2026: Variante D „je nach Stand“) – vor der
 * Freigabe eine Schrittleiste mit dem nächsten Schritt, danach Kennzahlen. Hier steht nur, was sich rechnen lässt;
 * gezeichnet wird in `Einstieg.tsx`.
 */
import { nurText, type Feld, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { kannEtwasKosten } from '@shared/anmeldung/preis';
import { datumText } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import type { AnmeldeEinstellungen } from './einrichten';

export type SchrittId = 'termin' | 'anmeldung' | 'formular' | 'bezahlung' | 'freigeben';

export interface Schritt {
  id: SchrittId;
  titel: string;
  /** Was dazu eingestellt ist – oder was fehlt. */
  text: string;
  fertig: boolean;
}

/** Fragen, die jemand beantworten kann: an, und nicht nur Text (Überschrift, Hinweis, Trenner). */
const fragen = (felder: Feld[]) =>
  felder.filter((f) => f.zustand !== 'aus' && !nurText(f.typ)).length;

/**
 * **Die Schritte bis zur Freigabe.** Fertig heißt: Ohne das nimmt die Anmeldung nichts an oder schickt Falsches –
 * kein Termin (kein Datum im Formular, kein Löschdatum), kein Anmeldebeginn (ChurchTools nimmt sonst keine Anmeldung
 * an, A0), keine Bankverbindung, obwohl etwas kostet. Das Formular hat immer seine festen Felder und gilt darum als
 * fertig; „Bezahlung“ kommt nur vor, wenn etwas kosten kann. Freigeben ist nie „fertig“ – es ist der letzte Schritt.
 */
export function schritteBisZurFreigabe(
  e: OeffentlicheEinstellungen,
  a: Pick<AnmeldeEinstellungen, 'ab'>,
  zeitzone: string,
): Schritt[] {
  const proAnmeldung = fragen(e.formular.anmeldung);
  const proPerson = fragen(e.formular.person);
  const schritte: Schritt[] = [
    {
      id: 'termin',
      titel: 'Termin',
      text: e.termin ? datumText(e.termin.beginn.slice(0, 10)) : 'noch keiner',
      fertig: !!e.termin,
    },
    {
      id: 'anmeldung',
      titel: 'Anmeldung',
      text: a.ab ? `ab ${datumText(tagAusIso(a.ab, zeitzone))}` : 'Beginn fehlt',
      fertig: !!a.ab,
    },
    {
      id: 'formular',
      titel: 'Formular',
      text:
        e.wer === 'einzeln'
          ? `${proAnmeldung + proPerson} Fragen`
          : `${proAnmeldung} Fragen · ${proPerson} je Person`,
      fertig: true,
    },
  ];
  if (kannEtwasKosten(e.preis))
    schritte.push({
      id: 'bezahlung',
      titel: 'Bezahlung',
      text: e.bezahlung.iban ? 'Bankverbindung da' : 'Bankverbindung fehlt',
      fertig: !!e.bezahlung.iban,
    });
  schritte.push({
    id: 'freigeben',
    titel: 'Freigeben',
    text: 'Leitung, dann Link verschicken',
    fertig: false,
  });
  return schritte;
}

/** Was der nächste Schritt verlangt – Satz und Knopf. Der erste nicht fertige; zuletzt immer „Freigeben“. */
export const NAECHSTER: Record<SchrittId, { satz: string; knopf: string }> = {
  termin: {
    satz: 'Wähl einen Termin – er steht im Formular und bestimmt, wann gelöscht wird.',
    knopf: 'Termin wählen',
  },
  anmeldung: {
    satz: 'Leg fest, ab wann man sich anmelden kann – ohne Beginn nimmt ChurchTools nichts an.',
    knopf: 'Anmeldung einstellen',
  },
  formular: { satz: 'Sieh dir das Formular an.', knopf: 'Formular öffnen' },
  bezahlung: {
    satz: 'Trag die Bankverbindung ein – sie steht in der Bestätigung.',
    knopf: 'Bezahlung eintragen',
  },
  freigeben: {
    satz: 'Alles da – jetzt freigeben, dann kannst du den Link verschicken.',
    knopf: 'Freigeben',
  },
};

export function naechsterSchritt(schritte: Schritt[]): Schritt {
  return schritte.find((s) => !s.fertig) ?? schritte[schritte.length - 1];
}

/**
 * **Der eine blaue Knopf einer Veranstaltung** (E24, „Ruhige Bedienung“ B7: „ein wandernder blauer Knopf“) – welcher
 * Schritt gerade gefüllt im Band „Nächster Schritt“ steht. Nur vor der Freigabe und nur, wer einrichten darf; danach
 * (Kennzahlen, Anmeldungen) gibt es auf der Seite keinen gefüllten Knopf dieser Art, ohne Recht ebenso wenig. Die eine
 * Stelle dafür: Das Band (`SchrittLeiste`) und die Kopfzeile fragen beide hier.
 */
export function blauerSchritt(
  schritte: Schritt[],
  entwurf: boolean,
  darf: boolean,
): SchrittId | null {
  return entwurf && darf ? naechsterSchritt(schritte).id : null;
}

/**
 * **Wo „Freigeben“ steht** (E24): als blauer Knopf im Band, sobald es dran ist (alle anderen Schritte sind erledigt) –
 * vorher im „⋯“-Menü, damit niemand versehentlich zu früh freigibt, aber jede, die es muss, es findet. Nach der Freigabe
 * oder ohne Recht gibt es „Freigeben“ nirgends (`null`).
 */
export function freigebenPlatz(
  schritte: Schritt[],
  entwurf: boolean,
  darf: boolean,
): 'band' | 'menue' | null {
  if (!entwurf || !darf) return null;
  return blauerSchritt(schritte, entwurf, darf) === 'freigeben' ? 'band' : 'menue';
}
