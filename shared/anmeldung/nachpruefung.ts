/**
 * **Nachprüfung** (A6-5c, #623; Entwurf `a6-5c-nachpruefung-v1`, Alwin 17.10.2026: „nachrechnen + markieren“) –
 * was Gäste ohne Server geschickt haben, gegen die Regeln gerechnet. Geändert wird nichts.
 *
 * Gerechnet wird mit denselben Regeln wie im Formular (`betragAus`, `optionenBelegt`, `optionRest`) – aus dem, was in
 * ChurchTools steht: Geburtstag, Auswahl, Extras, wer einen Platz hat, Anmeldetag. Zusammengehalten über die
 * Anmelde-Nr. (A6-5a); Anmeldungen ohne Nr. (vor dem 17.10.2026) werden beim Betrag nicht geprüft – dort weiß man nicht,
 * wer dazugehörte, und jede Prüfung wäre ein Fehlalarm.
 */
import type { Antworten, OeffentlicheEinstellungen } from './formular';
import { optionenBelegt } from './kontingent';
import { centAusEuroText, kannEtwasKosten } from './preis';
import { betragAus } from './senden';

/** Ein Mitglied der Veranstaltung, wie die Nachprüfung es braucht. */
export interface PruefMitglied {
  personId: number;
  name: string;
  status: 'aktiv' | 'wartet' | 'sonst';
  /** Seit wann Mitglied (`YYYY-MM-DD`) – der Anmeldetag. */
  seit: string | null;
  geburtstag: string | null;
  /** Werte der Systemfelder (Schlüssel wie `ctFelder`: nr, kontakt, betrag, aufschluesselung, auswahl, extras). */
  felder: Partial<
    Record<'nr' | 'kontakt' | 'betrag' | 'aufschluesselung' | 'auswahl' | 'extras', string>
  >;
}

/** Plätze, wie ChurchTools sie zählt (ohne Leitung). */
export interface PlatzZahlen {
  belegt: number;
  wartend: number;
  max: number | null;
}

/**
 * `auswahl`: Die gespeicherte Auswahl gibt es nicht (mehr) – nachrechnen geht nicht (echter Test 17.10.2026: Preise von
 * „fest“ auf „nach Auswahl“ umgestellt, ältere Anmeldungen haben keine Auswahl). Keine geratene Zahl.
 */
export type BetragsGrund = 'nachgerueckt' | 'preise' | 'weniger' | 'abweichend' | 'auswahl';

export interface Betragsbefund {
  grund: BetragsGrund;
  nr: string;
  /** „Angemeldet von“, sonst die erste Person. */
  name: string;
  /** Person, bei der der Betrag steht (Link „In ChurchTools“). */
  personId: number;
  gemeldetCent: number | null;
  /** `null`, wenn sich nicht nachrechnen lässt (Grund `auswahl`, oder `preise` mit fehlender Auswahl). */
  sollCent: number | null;
  /** Bei `auswahl`: was gespeichert ist (`null` = nichts). */
  auswahl?: string | null;
  /** Bei `nachgerueckt`: wer. Bei `preise`: Anmeldetag und Tag der Preisänderung. */
  nachgerueckt?: string[];
  angemeldetAm?: string;
  preiseGeaendert?: string;
}

export interface AuswahlBelegung {
  name: string;
  belegt: number;
  /** 0 = unbegrenzt. */
  kontingent: number;
  zustand: 'frei' | 'ausgebucht' | 'ueberbucht' | 'unbegrenzt';
}

export interface Nachpruefung {
  plaetze: PlatzZahlen & { wartenTrotzPlatz: boolean };
  /** `null`, wenn es keinen Grundpreis „nach Auswahl“ gibt. */
  auswahl: { name: string; optionen: AuswahlBelegung[] } | null;
  betraege: Betragsbefund[];
  /** Wie viele Anmeldungen beim Betrag geprüft wurden. */
  geprueft: number;
  /** Was Aufmerksamkeit braucht – `preise` ist nur eine Info und zählt nicht. */
  hinweise: number;
}

/** Wer in der Aufschlüsselung als „Warteliste – Betrag folgt beim Nachrücken“ steht (`wartelistenZeile`). */
function wartendeAus(aufschluesselung: string | undefined): string[] {
  return (aufschluesselung ?? '')
    .split('\n')
    .map((z) => /^(.+): Warteliste – Betrag folgt beim Nachrücken$/.exec(z.trim())?.[1])
    .filter((n): n is string => !!n);
}

/** **Die Nachprüfung einer Veranstaltung.** */
export function nachpruefen(
  e: OeffentlicheEinstellungen,
  mitglieder: PruefMitglied[],
  plaetze: PlatzZahlen,
): Nachpruefung {
  // Plätze: frei, aber jemand wartet → niemand rückt von selbst nach (gemessen 17.10.2026, #619).
  const wartenTrotzPlatz =
    plaetze.wartend > 0 && (plaetze.max === null || plaetze.belegt < plaetze.max);

  // Belegung je Auswahl – dieselbe Zählung, die das Formular sperren lässt.
  const g = e.preis.grundpreis;
  let auswahl: Nachpruefung['auswahl'] = null;
  if (g.art === 'auswahl') {
    const belegt = optionenBelegt(
      g.optionen,
      mitglieder.map((m) => ({
        aktiv: m.status === 'aktiv',
        nr: m.felder.nr ?? null,
        auswahl: m.felder.auswahl ?? null,
      })),
    );
    auswahl = {
      name: g.auswahlName,
      optionen: g.optionen.map((o, i) => ({
        name: o.name,
        belegt: belegt[i],
        kontingent: o.kontingent,
        zustand:
          o.kontingent <= 0
            ? 'unbegrenzt'
            : belegt[i] > o.kontingent
              ? 'ueberbucht'
              : belegt[i] === o.kontingent
                ? 'ausgebucht'
                : 'frei',
      })),
    };
  }

  // Beträge je Anmeldung (Anmelde-Nr.).
  const betraege: Betragsbefund[] = [];
  let geprueft = 0;
  if (kannEtwasKosten(e.preis)) {
    const gruppen = new Map<string, PruefMitglied[]>();
    for (const m of mitglieder) {
      if (!m.felder.nr || m.status === 'sonst') continue;
      gruppen.set(m.felder.nr, [...(gruppen.get(m.felder.nr) ?? []), m]);
    }
    for (const [nr, personen] of gruppen) {
      // Der Betrag steht bei der ersten Person der Anmeldung (Variante A).
      const erste = personen.find((p) => p.felder.betrag !== undefined);
      if (!erste) continue;
      const reihe = [erste, ...personen.filter((p) => p !== erste)];
      const angemeldetAm =
        reihe
          .map((p) => p.seit)
          .filter((s): s is string => !!s)
          .sort()[0] ?? null;
      if (!angemeldetAm) continue;
      const option =
        g.art === 'auswahl' ? g.optionen.findIndex((o) => o.name === erste.felder.auswahl) : 0;
      const gewaehlt = new Set((erste.felder.extras ?? '').split(', ').filter(Boolean));
      const antworten: Antworten = {
        anmeldung: {},
        personen: reihe.map((p) => ({ birth: p.geburtstag ?? undefined })),
      };
      const soll = betragAus(
        e,
        antworten,
        {
          option: Math.max(0, option),
          extras: e.preis.extras.map((x) => gewaehlt.has(x.bezeichnung)),
        },
        angemeldetAm,
        reihe.map((p) => p.status === 'aktiv'),
      ).gesamtCent;
      const gemeldet = centAusEuroText(erste.felder.betrag);
      geprueft++;
      // Die gewählte Option gibt es nicht mehr (umbenannt, entfernt) → nachrechnen geht nicht.
      const unbekannt = option < 0;
      if (gemeldet === soll && !unbekannt) continue;
      const nachgerueckt = wartendeAus(erste.felder.aufschluesselung).filter((name) =>
        reihe.some((p) => p.status === 'aktiv' && p.name === name),
      );
      const spaeterePreise = !!e.preiseGeaendert && e.preiseGeaendert > angemeldetAm;
      const grund: BetragsGrund =
        nachgerueckt.length > 0 && !unbekannt
          ? 'nachgerueckt'
          : spaeterePreise
            ? 'preise'
            : unbekannt
              ? 'auswahl'
              : gemeldet !== null && gemeldet > soll
                ? 'weniger'
                : 'abweichend';
      betraege.push({
        grund,
        nr,
        name: erste.felder.kontakt || erste.name,
        personId: erste.personId,
        gemeldetCent: gemeldet,
        sollCent: unbekannt ? null : soll,
        ...(grund === 'auswahl' ? { auswahl: erste.felder.auswahl ?? null } : {}),
        ...(grund === 'nachgerueckt' ? { nachgerueckt } : {}),
        ...(grund === 'preise' ? { angemeldetAm, preiseGeaendert: e.preiseGeaendert! } : {}),
      });
    }
  }

  const hinweise =
    (wartenTrotzPlatz ? 1 : 0) +
    (auswahl?.optionen.filter((o) => o.zustand === 'ueberbucht').length ?? 0) +
    betraege.filter((b) => b.grund !== 'preise').length;
  return { plaetze: { ...plaetze, wartenTrotzPlatz }, auswahl, betraege, geprueft, hinweise };
}
