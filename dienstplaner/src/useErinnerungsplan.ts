import { useState } from 'react';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import { abfragenAus, laufendeAbfrage } from '@shared/dienstplan/abfragen';
import {
  entwuerfeGleich,
  entwurfGeaendert,
  entwurfVon,
  planFuerSpeicher,
  type PlanEntwurf,
} from '@shared/dienstplan/abfragePlan';
import { standardInhalt, type AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import type { AbfrageAnschluss } from './AbfrageFenster';
import { ABFRAGE_UNLESBAR, abfragenFehlerText } from './abfragenTexte';

/** Was der Abschnitt „Abfragen – Erinnerungen“ von außen braucht. */
export interface ErinnerungenAnschluss {
  anschluss: AbfrageAnschluss;
  /** Die Dienstgruppen, die man planen darf (`planbareDienstgruppen`, wie Startseite und „Abfrage starten“). */
  gruppen: readonly Dienstgruppe[];
  /** Heute (Zeitzone der Gemeinde) – für die Vorschau. */
  heute: string;
}

/** Ergebnis von `speichern`: nichts zu tun, gespeichert oder der Satz für den Planer. */
export type TeilErgebnis = { art: 'nichts' } | { art: 'ok' } | { art: 'fehler'; text: string };

/**
 * **Der Erinnerungsplan einer Dienstgruppe im Fenster „Einstellungen“** (R-4): frisch lesen beim Öffnen und mit jeder Gruppe,
 * bearbeiten (Entwurf), speichern. Hausregeln wie `AbfrageFenster`/`EinstellungenFenster`: ein Lesefehler sperrt den Abschnitt,
 * ein **unlesbarer** Wert wird nie überschrieben (kann aus einer neueren Fassung stammen), bei einem Konflikt wird nichts
 * überschrieben und der neue Stand erscheint, nichts wird automatisch wiederholt.
 *
 * Gespeichert wird nur der Plan der gewählten Gruppe; die `abfragen` des Dokuments bleiben, wie gelesen, mit der gelesenen
 * Version. **Gruppenwechsel mit ungespeicherten Änderungen:** erst Rückfrage (`wechselFrage`), dann verwerfen – schlichter
 * als Entwürfe je Gruppe zu merken, die einzeln scheitern könnten.
 */
export function useErinnerungsplan(a: ErinnerungenAnschluss | undefined) {
  const gruppen = a?.gruppen ?? [];
  const [gewaehlt, setGewaehlt] = useState<number | null>(gruppen[0]?.id ?? null);
  const [wechselFrage, setWechselFrage] = useState<number | null>(null);
  const [bearb, setBearb] = useState<{ fuer: AbfragenStand; wert: PlanEntwurf } | null>(null);

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
  const geaendert = schreibbar && entwurf !== null && entwurfGeaendert(entwurf, lese.inhalt);

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

  /** Speichert den Plan, wenn er sich geändert hat – ein Versuch, nie automatisch wiederholt. */
  const speichern = async (): Promise<TeilErgebnis> => {
    if (!a || !gruppe || !lese || !schreibbar || entwurf === null || !geaendert)
      return { art: 'nichts' };
    try {
      const wunsch = { plan: planFuerSpeicher(entwurf), abfragen: lese.inhalt.abfragen };
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
        if (jetzt && inhalt && entwuerfeGleich(entwurfVon(inhalt), entwurf)) {
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
    geaendert,
    laufend,
    heute: a?.heute ?? '',
    automatik: gruppe !== null && (a?.anschluss.automatik?.(gruppe.id) ?? false),
    speichern,
  };
}

export type ErinnerungsplanZustand = ReturnType<typeof useErinnerungsplan>;
