/**
 * **Ein Protokoll beginnen** (Bauplan S5-1, Entwurf 7) – die Regeln ohne ChurchTools: womit das Dokument anfängt und wie
 * der Kopf aussieht. Geschrieben wird in `protokolle/src/beginnen.ts`.
 *
 * Entschieden 28.10.2026 (Alwin): Die Leitung beginnt ein Protokoll zu einem Termin oder Gruppentreffen ohne Protokoll
 * (oder zu einem geplanten) mit einer **Vorlage**, **„wie letztes Mal“** oder **leer**. Feste Aufgaben der Vorlage
 * bekommen gleich ihre IDs – beim Beginnen werden daraus To-Dos, nicht erst beim ersten Tippen.
 */
import { aufgabenIdsVergeben } from './aufgaben';
import type { Block } from './dokument';
import type { ProtokollKopf } from './speicher';
import { startDokument, wieLetztesMal, type Vorlage } from './vorlagen';

/** Womit das Protokoll anfängt. `letztes` = das Dokument des letzten Protokolls der Gruppe. */
export type Anfang =
  | { art: 'vorlage'; vorlage: Vorlage }
  | { art: 'letztes'; dokument: readonly Block[] }
  | { art: 'leer' };

/** Aufgaben-IDs in die Blöcke schreiben (auch eingerückt). */
function idsSetzen(dokument: Block[], ids: ReadonlyMap<string, string>): Block[] {
  return dokument.map((b) => ({
    ...b,
    ...(ids.has(b.id) ? { props: { ...b.props, aufgabe: ids.get(b.id) } } : {}),
    children: idsSetzen(b.children ?? [], ids),
  }));
}

/**
 * **Das erste Dokument** – jeder Block mit neuer ID, jede Aufgabe mit einer eigenen To-Do-ID (`aufgabenIdsVergeben`).
 * „Wie letztes Mal“ nimmt nur Tagesordnungspunkte und feste Punkte mit (`wieLetztesMal`).
 */
export function anfangsDokument(anfang: Anfang, neueId: () => string): Block[] {
  const dok =
    anfang.art === 'vorlage'
      ? startDokument(anfang.vorlage, neueId)
      : anfang.art === 'letztes'
        ? wieLetztesMal(anfang.dokument, neueId)
        : [];
  const ids = aufgabenIdsVergeben(dok, () => false, neueId);
  return ids.length ? idsSetzen(dok, new Map(ids.map((x) => [x.blockId, x.aufgabe]))) : dok;
}

/** Was eine Sitzung für den Kopf mitbringt (Teil von `Sitzung`). */
export interface BeginnSitzung {
  titel: string;
  beginn: string;
  termin: { kalender: number; id: number } | null;
  treffen: number | null;
}

/** **Der Kopf eines neu begonnenen Protokolls** – Entwurf, ohne Sperre (die entsteht mit dem ersten Tippen). */
export function neuerKopf(s: BeginnSitzung, sitzung: string, stand: string): ProtokollKopf {
  return {
    art: 'protokoll',
    fassung: 1,
    sitzung,
    titel: s.titel,
    status: 'entwurf',
    beginn: s.beginn,
    termin: s.termin,
    treffen: s.treffen,
    freigabe: null,
    sperre: null,
    stand,
  };
}
