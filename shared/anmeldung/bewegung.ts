/**
 * **Nachrücken und Absagen planen** (A7-3, Entwurf `a7-3-nachruecken-v1`) – was geschrieben wird, ohne zu schreiben.
 * Entschieden 19.10.2026 (Alwin):
 * - Voll → Rückfrage, dann nachrücken **und die Plätze erhöhen**.
 * - Nachgerückte bekommen **eine eigene Zahlung** („als ob ein Kind neu angemeldet wurde“): der Betrag, um den die
 *   Anmeldung nach den Regeln teurer wird (`sollBetrag`, Geschwisterrabatt eingerechnet).
 * - Absagen: Die Zahlung der Anmeldung wird neu gerechnet; war schon bezahlt, steht die Rückzahlung in der
 *   Aufschlüsselung. Sagt die erste Person ab, gehen Kontakt, Unterschrift und Zahlung an die nächste.
 * - Bescheid per fertiger Mail (`bescheidMail`) – ChurchTools schickt beim Nachrücken nur „war erfolgreich“, beim
 *   Entfernen nichts (gemessen 19.10.2026).
 */
import { tagPunkt, plusTage } from '../ct/datum';
import { ibanText, verwendungszweck } from './bezahlung';
import type { OeffentlicheEinstellungen } from './formular';
import type { ListenAnmeldung, ListenPerson } from './liste';
import { euroText, kannEtwasKosten } from './preis';
import { aufschluesselungText, wartelistenZeile } from './senden';
import { sollBetrag } from './sollbetrag';
import { absageZeile, nachrueckKopf } from './zahlung';

const ganz = (p: { vor: string; nach: string }) => `${p.vor} ${p.nach}`.trim();

/** Was die Anmeldung nach den Regeln kostet, wenn `mitPlatz` sagt, wer einen Platz hat. */
function soll(
  e: OeffentlicheEinstellungen,
  x: ListenAnmeldung,
  personen: ListenPerson[],
  mitPlatz: (p: ListenPerson) => boolean,
  heute: string,
) {
  const f = e.ctFelder;
  return sollBetrag(e, {
    personen: personen.map((p) => ({ geburtstag: p.geburtstag, mitPlatz: mitPlatz(p) })),
    auswahl: f.auswahl === undefined ? null : x.einmal[f.auswahl],
    extras: f.extras === undefined ? null : x.einmal[f.extras],
    angemeldetAm: x.angemeldetAm ?? heute,
  });
}

/** Eine Zahlung, die geschrieben wird – bei `personId`. */
export interface ZahlungNeu {
  personId: number;
  betragCent: number;
  aufschluesselung: string;
}

// ── Nachrücken ──────────────────────────────────────────────────────────────────────────────────

export interface NachrueckPlan {
  personId: number;
  name: string;
  /** Plätze vorher; `max: null` = unbegrenzt. */
  belegt: number;
  max: number | null;
  /** Voll → so viele Plätze danach (Alwin: „dann ändert sich auch das Limit“); sonst `null`. */
  neuesMax: number | null;
  /** Wer vorher dran wäre (Warteliste) – Hinweis, wenn jemand übersprungen wird. */
  vorher: string[];
  /** `eigene`: neue Zahlung der Nachgerückten; `anmeldung`: sie trägt die Zahlung der Anmeldung (alle warteten). */
  zahlung: (ZahlungNeu & { art: 'eigene' | 'anmeldung' }) | null;
  /** Die gespeicherte Auswahl gibt es nicht mehr – der Betrag ist dann nicht verlässlich. */
  auswahlFehlt: boolean;
}

export function nachrueckPlan(
  e: OeffentlicheEinstellungen,
  x: ListenAnmeldung,
  personId: number,
  plaetze: { belegt: number; max: number | null; wartende: { personId: number; name: string }[] },
  heute: string,
): NachrueckPlan {
  const p = x.personen.find((y) => y.personId === personId);
  if (!p || p.status !== 'wartet') throw new Error('Diese Person wartet nicht.');
  const voll = plaetze.max !== null && plaetze.belegt >= plaetze.max;
  const davor = plaetze.wartende
    .slice(
      0,
      plaetze.wartende.findIndex((w) => w.personId === personId),
    )
    .map((w) => w.name);
  const basis = {
    personId,
    name: ganz(p),
    belegt: plaetze.belegt,
    max: plaetze.max,
    neuesMax: voll ? plaetze.belegt + 1 : null,
    vorher: davor,
  };
  if (!kannEtwasKosten(e.preis)) return { ...basis, zahlung: null, auswahlFehlt: false };

  const s = soll(e, x, x.personen, (y) => y.status === 'aktiv' || y.personId === personId, heute);
  const bisher = x.zahlungen.reduce((summe, z) => summe + (z.betragCent ?? 0), 0);
  if (x.zahlungBei === personId) {
    // Alle warteten – sie trägt die Zahlung der Anmeldung: neu gerechnet, ohne die eigenen anderer.
    const eigeneAndere = x.zahlungen
      .filter((z) => z.personId !== personId)
      .reduce((summe, z) => summe + (z.betragCent ?? 0), 0);
    const nochWartend = x.personen.filter((y) => y.status === 'wartet' && y.personId !== personId);
    return {
      ...basis,
      auswahlFehlt: s.auswahlFehlt,
      zahlung: {
        art: 'anmeldung',
        personId,
        betragCent: Math.max(0, s.cent - eigeneAndere),
        aufschluesselung: [
          aufschluesselungText(s.preis),
          ...nochWartend.map((y) => wartelistenZeile(ganz(y))),
          `${ganz(p)}: nachgerückt am ${tagPunkt(heute)}`,
        ].join('\n'),
      },
    };
  }
  const betrag = Math.max(0, s.cent - bisher);
  return {
    ...basis,
    auswahlFehlt: s.auswahlFehlt,
    zahlung: {
      art: 'eigene',
      personId,
      betragCent: betrag,
      aufschluesselung: [
        nachrueckKopf(heute),
        `Neu gerechnet für die Anmeldung: ${euroText(s.cent)}`,
        `Bisher gemeldet: ${euroText(bisher)}`,
        `Für ${p.vor}: ${euroText(betrag)}`,
      ].join('\n'),
    },
  };
}

// ── Absagen ─────────────────────────────────────────────────────────────────────────────────────

export interface AbsagePlan {
  personId: number;
  name: string;
  hatPlatz: boolean;
  /** Sagt die erste Person ab: wer Kontakt, Unterschrift und die Zahlung der Anmeldung bekommt. */
  uebergabeAn: number | null;
  /** Neue Zahlung der Anmeldung – `null`, wenn sie bleibt, wie sie ist (oder niemand mehr da ist). */
  haupt: (ZahlungNeu & { vorherCent: number | null; rueckzahlungCent: number }) | null;
  /** Bereits bezahlt, und niemand bleibt übrig: alles zurückzahlen. */
  rueckzahlungOhneRestCent: number;
  /** Die letzte Person der Anmeldung. */
  letzte: boolean;
}

export function absagePlan(
  e: OeffentlicheEinstellungen,
  x: ListenAnmeldung,
  personId: number,
  heute: string,
): AbsagePlan {
  const p = x.personen.find((y) => y.personId === personId);
  if (!p) throw new Error('Diese Person gehört nicht zur Anmeldung.');
  const rest = x.personen.filter((y) => y.personId !== personId);
  const hauptZahlung = x.zahlungen.find(
    (z) => z.wofuer === 'anmeldung' && z.personId === x.zahlungBei,
  );
  const eigene = x.zahlungen.find((z) => z.personId === personId && z !== hauptZahlung);
  const bezahltWeg =
    (eigene?.bezahlt ? (eigene.betragCent ?? 0) : 0) +
    (x.zahlungBei === personId && rest.length === 0 && hauptZahlung?.bezahlt
      ? (hauptZahlung.betragCent ?? 0)
      : 0);
  const basis = {
    personId,
    name: ganz(p),
    hatPlatz: p.status === 'aktiv',
    letzte: rest.length === 0,
  };
  if (rest.length === 0)
    return { ...basis, uebergabeAn: null, haupt: null, rueckzahlungOhneRestCent: bezahltWeg };

  // Übergabe an jemanden ohne eigene Zahlung (sonst würde sie überschrieben), am liebsten mit Platz.
  const ohneEigene = rest.filter((y) => !x.zahlungen.some((z) => z.personId === y.personId));
  const uebergabeAn =
    x.zahlungBei === personId
      ? ([...ohneEigene, ...rest].find((y) => y.status === 'aktiv') ?? ohneEigene[0] ?? rest[0])
          .personId
      : null;
  const halter = uebergabeAn ?? x.zahlungBei;
  if (!kannEtwasKosten(e.preis) || !hauptZahlung || halter === null)
    return { ...basis, uebergabeAn, haupt: null, rueckzahlungOhneRestCent: 0 };

  const vorherCent = hauptZahlung.betragCent;
  let neu = vorherCent ?? 0;
  if (p.status === 'aktiv') {
    const s = soll(e, x, rest, (y) => y.status === 'aktiv', heute);
    const eigeneRest = x.zahlungen
      .filter((z) => z !== hauptZahlung && z.personId !== personId && z.personId !== halter)
      .reduce((summe, z) => summe + (z.betragCent ?? 0), 0);
    neu = Math.max(0, s.cent - eigeneRest);
  }
  const rueck =
    (hauptZahlung.bezahlt ? Math.max(0, (vorherCent ?? 0) - neu) : 0) +
    (eigene?.bezahlt ? (eigene.betragCent ?? 0) : 0);
  const geaendert = neu !== (vorherCent ?? 0);
  if (!geaendert && rueck === 0 && uebergabeAn === null)
    return { ...basis, uebergabeAn, haupt: null, rueckzahlungOhneRestCent: 0 };
  return {
    ...basis,
    uebergabeAn,
    rueckzahlungOhneRestCent: 0,
    haupt: {
      personId: halter,
      betragCent: neu,
      vorherCent,
      rueckzahlungCent: rueck,
      aufschluesselung: [
        ...(hauptZahlung.aufschluesselung ? [hauptZahlung.aufschluesselung] : []),
        absageZeile(ganz(p), heute, {
          neuCent: geaendert ? neu : null,
          rueckzahlungCent: rueck,
        }),
      ].join('\n'),
    },
  };
}

// ── Mail ────────────────────────────────────────────────────────────────────────────────────────

export interface Mail {
  an: string | null;
  betreff: string;
  text: string;
}

/**
 * **Die Mail an die Familie** – nach dem Nachrücken (Betrag, Bankdaten, Frist) oder nach dem Absagen (Rückzahlung).
 * Geschickt wird sie vom Team selbst (`mailto:`); ChurchTools hat dafür keine Schnittstelle (gemessen 19.10.2026).
 */
export function bescheidMail(
  e: OeffentlicheEinstellungen,
  a: {
    art: 'nachgerueckt' | 'abgesagt';
    veranstaltung: string;
    x: ListenAnmeldung;
    person: { vor: string; nach: string };
    betragCent: number;
    rueckzahlungCent: number;
    heute: string;
  },
): Mail {
  const b = e.bezahlung;
  const gruss = [...(e.kontakt ? ['', `Bei Fragen: ${e.kontakt}`] : []), '', 'Viele Grüße'];
  if (a.art === 'nachgerueckt') {
    const zahlen =
      a.betragCent <= 0
        ? []
        : b.iban
          ? [
              '',
              `Bitte überweise ${euroText(a.betragCent)}${
                b.fristTage > 0 ? ` bis zum ${tagPunkt(plusTage(a.heute, b.fristTage))}` : ''
              }:`,
              `Kontoinhaber: ${b.kontoinhaber}`,
              `IBAN: ${ibanText(b.iban)}`,
              ...(b.bic ? [`BIC: ${b.bic}`] : []),
              `Verwendungszweck: ${verwendungszweck(b.zweck, a.person.nach)}`,
            ]
          : ['', `Der Betrag: ${euroText(a.betragCent)}. Wie ihr bezahlt, sagen wir euch noch.`];
    return {
      an: a.x.email,
      betreff: `${a.veranstaltung}: ${a.person.vor} hat einen Platz`,
      text: [
        `Hallo ${a.x.wer},`,
        '',
        `gute Nachricht: Für ${a.person.vor} ist ein Platz frei geworden – ${a.person.vor} ist jetzt bei „${a.veranstaltung}“ dabei.`,
        ...zahlen,
        ...gruss,
      ].join('\n'),
    };
  }
  return {
    an: a.x.email,
    betreff: `${a.veranstaltung}: Absage für ${a.person.vor}`,
    text: [
      `Hallo ${a.x.wer},`,
      '',
      `wie besprochen haben wir ${a.person.vor} von „${a.veranstaltung}“ abgemeldet.`,
      ...(a.rueckzahlungCent > 0
        ? ['', `Bereits bezahlte ${euroText(a.rueckzahlungCent)} überweisen wir euch zurück.`]
        : []),
      ...gruss,
    ].join('\n'),
  };
}

/** Die Mail als `mailto:`-Link (Empfänger, Betreff, Text). */
export function mailtoLink(m: Mail): string {
  const teile = [`subject=${encodeURIComponent(m.betreff)}`, `body=${encodeURIComponent(m.text)}`];
  return `mailto:${m.an ? encodeURIComponent(m.an) : ''}?${teile.join('&')}`;
}
