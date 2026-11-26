import { useState } from 'react';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import {
  abfragenAus,
  laufendeAbfrage,
  type AbfragenInhalt,
  type VerfuegbarkeitArt,
} from '@shared/dienstplan/abfragen';
import {
  entwuerfeGleich,
  entwurfGeaendert,
  entwurfVon,
  planFuerSpeicher,
  type PlanEntwurf,
} from '@shared/dienstplan/abfragePlan';
import { standardInhalt, type AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import type { AbfrageAnschluss } from './AbfrageFenster';
import type { EinrichtenAnschluss } from './einrichtenAbfragen';
import { ABFRAGE_UNLESBAR, abfragenFehlerText } from './abfragenTexte';

/** Was der Abschnitt „Verfügbarkeit & Erinnerungen“ von außen braucht. */
export interface ErinnerungenAnschluss {
  anschluss: AbfrageAnschluss;
  /** Die Dienstgruppen, die man planen darf (`planbareDienstgruppen`, wie Startseite und „Abfrage starten“). */
  gruppen: readonly Dienstgruppe[];
  /** Heute (Zeitzone der Gemeinde) – für die Vorschau. */
  heute: string;
  /**
   * „In ChurchTools einrichten“ (R-5a). Ohne: Der Kasten zeigt nur den Stand und bittet um einen Admin. `darf`: Recht
   * „Berechtigungen verwalten“ (wie die App es sonst prüft: `start.verwalten`).
   */
  einrichten?: {
    darf: boolean;
    anschluss: EinrichtenAnschluss;
    /** Die ChurchTools-Gruppen der Dienste einer Dienstgruppe. */
    gruppenIds: (dienstgruppeId: number) => number[];
  };
}

/** Ergebnis von `speichern`: nichts zu tun, gespeichert oder der Satz für den Planer. */
export type TeilErgebnis = { art: 'nichts' } | { art: 'ok' } | { art: 'fehler'; text: string };

/**
 * **Der Erinnerungsplan einer Dienstgruppe auf der Seite „Einstellungen“** (R-4): frisch lesen beim Öffnen und mit jeder Gruppe,
 * bearbeiten (Entwurf), speichern. Hausregeln wie `AbfrageFenster`/`EinstellungenSeite`: ein Lesefehler sperrt den Abschnitt,
 * ein **unlesbarer** Wert wird nie überschrieben (kann aus einer neueren Fassung stammen), bei einem Konflikt wird nichts
 * überschrieben und der neue Stand erscheint, nichts wird automatisch wiederholt.
 *
 * Gespeichert werden nur Plan und Art der Verfügbarkeits-Abfrage (V-2) der gewählten Gruppe – ein Dokument, ein Schreiben;
 * `abfragen` und `einrichtung` des Dokuments bleiben, wie gelesen, mit der gelesenen Version. **Gruppenwechsel mit ungespeicherten Änderungen:** erst Rückfrage (`wechselFrage`), dann verwerfen – schlichter
 * als Entwürfe je Gruppe zu merken, die einzeln scheitern könnten.
 */
export function useErinnerungsplan(a: ErinnerungenAnschluss | undefined) {
  const gruppen = a?.gruppen ?? [];
  const [gewaehlt, setGewaehlt] = useState<number | null>(gruppen[0]?.id ?? null);
  const [wechselFrage, setWechselFrage] = useState<number | null>(null);
  const [einrichtenOffen, setEinrichtenOffen] = useState(false);
  const [bearb, setBearb] = useState<{ fuer: AbfragenStand; wert: PlanEntwurf } | null>(null);
  const [bearbArt, setBearbArt] = useState<{ fuer: AbfragenStand; wert: VerfuegbarkeitArt } | null>(
    null,
  );

  const lesen = a?.anschluss.lesen;
  const gruppe = gruppen.find((g) => g.id === gewaehlt) ?? null;
  const gruppeId = gruppe?.id ?? null;
  const { stand, neu, setze } = useLaden<AbfragenStand>(
    () => (lesen && gruppeId !== null ? lesen(gruppeId) : null),
    [lesen, gruppeId],
  );
  const lese = stand.art === 'fertig' ? stand.daten : null;
  const lesefehler =
    stand.art === 'fehler'
      ? stand.fehler.text
      : lese?.fehler
        ? abfragenFehlerText(lese.fehler, true)
        : null;
  const unlesbar = lese?.unlesbar === true;
  const schreibbar = lese !== null && lese.fehler === null && !lese.unlesbar;

  const entwurf: PlanEntwurf | null = lese
    ? bearb?.fuer === lese
      ? bearb.wert
      : entwurfVon(lese.inhalt)
    : null;
  const setEntwurf = (wert: PlanEntwurf) => {
    if (lese) setBearb({ fuer: lese, wert });
  };
  const planGeaendert = schreibbar && entwurf !== null && entwurfGeaendert(entwurf, lese.inhalt);

  // Die Art der Verfügbarkeits-Abfrage (V-2): wie der Plan ein Entwurf zum gelesenen Stand, gilt aber nach dem Speichern sofort.
  const art: VerfuegbarkeitArt | null = lese
    ? bearbArt?.fuer === lese
      ? bearbArt.wert
      : lese.inhalt.verfuegbarkeit
    : null;
  const setArt = (wert: VerfuegbarkeitArt) => {
    if (lese) setBearbArt({ fuer: lese, wert });
  };
  const artGeaendert = schreibbar && art !== null && art !== lese.inhalt.verfuegbarkeit;
  const geaendert = planGeaendert || artGeaendert;
  /** Alle Änderungen zurück auf den gelesenen Stand („Verwerfen“ in der Leiste der Einstellungen-Seite). */
  const verwerfen = () => {
    setBearb(null);
    setBearbArt(null);
  };

  const waehle = (id: number) => {
    if (id === gewaehlt) return;
    if (geaendert) setWechselFrage(id);
    else setGewaehlt(id);
  };
  const wechselBestaetigen = () => {
    if (wechselFrage !== null) setGewaehlt(wechselFrage);
    setWechselFrage(null);
  };

  const laufend = schreibbar ? laufendeAbfrage(lese.inhalt, a?.heute ?? '') : null;

  /** Speichert Plan und Art, wenn sich etwas geändert hat – ein Versuch, nie automatisch wiederholt. */
  const speichern = async (): Promise<TeilErgebnis> => {
    if (!a || !gruppe || !lese || !schreibbar || entwurf === null || art === null || !geaendert)
      return { art: 'nichts' };
    try {
      // Gespreizt: `abfragen` und `einrichtung` bleiben, wie gelesen. Der Plan wird nur neu gerechnet, wenn er geändert ist
      // (sonst bliebe ein ausdrücklich gespeicherter Standard-Plan nicht erhalten, wie er ist).
      const wunsch: AbfragenInhalt = {
        ...lese.inhalt,
        plan: planGeaendert ? planFuerSpeicher(entwurf) : lese.inhalt.plan,
        verfuegbarkeit: art,
      };
      const r = await a.anschluss.speichern(
        gruppe.id,
        wunsch,
        a.anschluss.ich,
        lese.gespeichert?.version ?? null,
      );
      if (r.ok) {
        if (r.daten)
          setze({ inhalt: r.daten.inhalt, gespeichert: r.daten, unlesbar: false, fehler: null });
        else neu();
        return { art: 'ok' };
      }
      if (r.grund === 'konflikt') {
        if (r.jetzt === undefined) {
          neu();
          return { art: 'fehler', text: abfragenFehlerText('konflikt', false) };
        }
        const jetzt = r.jetzt;
        const inhalt = jetzt ? abfragenAus(jetzt.inhalt) : null;
        // Steht schon genau das da, was gewünscht war (ein früherer Versuch kam doch an): fertig.
        if (
          jetzt &&
          inhalt &&
          entwuerfeGleich(entwurfVon(inhalt), entwurf) &&
          inhalt.verfuegbarkeit === art
        ) {
          setze({ inhalt, gespeichert: { ...jetzt, inhalt }, unlesbar: false, fehler: null });
          return { art: 'ok' };
        }
        setze(
          jetzt === null
            ? { inhalt: standardInhalt(), gespeichert: null, unlesbar: false, fehler: null }
            : inhalt
              ? { inhalt, gespeichert: { ...jetzt, inhalt }, unlesbar: false, fehler: null }
              : {
                  inhalt: standardInhalt(),
                  gespeichert: { ...jetzt, inhalt: standardInhalt() },
                  unlesbar: true,
                  fehler: null,
                },
        );
        return {
          art: 'fehler',
          text: `${jetzt?.von.name ?? 'Ein anderer'} hat das inzwischen geändert – nichts überschrieben. Hier steht jetzt der neue Stand.`,
        };
      }
      return { art: 'fehler', text: abfragenFehlerText(r.grund, false) };
    } catch (e) {
      return { art: 'fehler', text: fehlerMeldung(e).text };
    }
  };

  return {
    gruppen,
    gruppe,
    gewaehlt,
    waehle,
    wechselFrage,
    wechselBestaetigen,
    wechselAbbrechen: () => setWechselFrage(null),
    laedt: stand.art === 'laedt',
    lesefehler,
    unlesbarText: unlesbar ? ABFRAGE_UNLESBAR : null,
    neuLesen: neu,
    schreibbar,
    entwurf,
    setEntwurf,
    art,
    setArt,
    geaendert,
    // Einzeln: Die Leiste der Einstellungen-Seite zählt Plan und Art je als eine Änderung (`anzahlAenderungen`).
    planGeaendert,
    artGeaendert,
    verwerfen,
    laufend,
    heute: a?.heute ?? '',
    // Eingerichtet = die Einrichtung steht im Dokument; bei Lesefehler/unlesbar sagt der Kasten nichts (kein Doppel-Einrichten).
    eingerichtet: schreibbar && lese.inhalt.einrichtung !== null,
    einrichtung: schreibbar ? lese.inhalt.einrichtung : null,
    einrichten: a?.einrichten ?? null,
    einrichtenOffen,
    einrichtenOeffnen: () => setEinrichtenOffen(true),
    einrichtenSchliessen: () => setEinrichtenOffen(false),
    speichern,
  };
}

export type ErinnerungsplanZustand = ReturnType<typeof useErinnerungsplan>;
