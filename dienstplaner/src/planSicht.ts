import { monatName, tagKurz } from '@shared/ct/datum';
import type { Plan, PlanGruppe, PlanPlatz, PlanSpalte, PlanZeile } from '@shared/dienstplan/plan';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import type { ZellenAktion } from '@shared/dienstplan/personenEintragen';
import type { RasterZelle } from '@shared/dienstplan/personenRaster';
import type { FreierPlatz } from './WerKann';
import type { MatrixAblauf } from './useMatrixAblauf';
import type { MatrixInfos } from './useMatrixInfos';

/** Ein Entwurf an einem Platz – und ob er veraltet ist (in ChurchTools steht inzwischen etwas anderes). */
export type EntwurfAmPlatz = { entwurf: Entwurf; veraltet: boolean };

export { gruppenSchluessel as schluessel } from '@shared/dienstplan/plan';

/**
 * Schlüssel eines Dienst-Blocks in „Personen“ im Satz der zugeklappten Einträge (`Sicht.zugeklappt`) – derselbe Satz wie
 * für die Gruppen der Matrix, die Gruppenschlüssel (Zahl oder `ohne`) kommen damit nicht in die Quere.
 */
export const blockSchluessel = (dienstId: number) => `dienst:${dienstId}`;

/**
 * Eintragen per Klick in „Personen“ (P2a). Die Regeln und das Anlegen des Entwurfs kommen aus `useEinteilen` – dieselben
 * wie bei „Wer kann?“; „Personen“ zeigt nur die Zelle und die Fenster.
 */
export interface PersonenEintragen {
  /** Was ein Klick in diese Zelle tut – `null`: nichts (kein Recht, Entwürfe nicht bereit, bestehende Einteilung …). */
  aktion: (
    spalte: number,
    zeile: PlanZeile,
    personId: number,
    zustand: RasterZelle['zustand'],
  ) => ZellenAktion;
  /** Entwurf für die Person auf den freien Platz `nr` (1-basiert) – meldet selbst „eingetragen“ bzw. den Fehler. */
  eintragen: (
    spalte: number,
    zeile: PlanZeile,
    nr: number,
    person: { personId: number; name: string },
  ) => Promise<void>;
  /** Den eigenen Entwurf wieder wegnehmen – meldet selbst „entfernt“ bzw. den Fehler. */
  wegnehmen: (zeile: PlanZeile, entwurf: Entwurf) => Promise<void>;
}

/** Was die Matrix gerade zeigt – aus Plan, Filtern und Fenster. */
export interface Sicht {
  plan: Plan;
  /** Indizes der sichtbaren Spalten in `plan.spalten`. */
  spalten: number[];
  gruppen: PlanGruppe[];
  zugeklappt: Set<string>;
  /** Spalten einer anderen Veranstaltung als der häufigsten – abgesetzt (Entwurf: Gebetsabende). */
  neben: (s: PlanSpalte) => boolean;
  onUmschalten: (k: string) => void;
  /** Freien Platz antippen → „Wer kann?“ (nur wo man den Dienst planen darf). */
  onFrei: (spalte: number, zeile: PlanZeile, nr: number) => void;
  /** Der Entwurf an einem Platz – mit „veraltet“, wenn in ChurchTools inzwischen etwas anderes steht. */
  entwurf: (spalte: number, zeile: PlanZeile, p: PlanPlatz) => EntwurfAmPlatz | null;
  /** Einen Entwurf antippen → Entwurfs-Fach (E4-3-3; nur wo man planen und die Schublade ändern darf). */
  onEntwurf: (spalte: number, zeile: PlanZeile, nr: number) => void;
  /** Einen belegten Platz antippen → zurückziehen oder ersetzen (E4-5; nur wo man den Dienst planen darf). */
  onBelegt: (spalte: number, zeile: PlanZeile, nr: number) => void;
  /** Entwürfe ohne Platz an diesem Termin und Dienst (#582) – Schild darunter. */
  ohnePlatz: (spalte: number, zeile: PlanZeile) => Entwurf[];
  /** Schild antippen → Entwurfs-Fach mit „Entwurf verwerfen“ (nur wo man planen und ändern darf). */
  onOhnePlatz: (spalte: number, zeile: PlanZeile, e: Entwurf) => void;
  /** Regler in der Gruppenzeile → Plätze-Fach (E4-5-3); `undefined`, wo man keinen Dienst der Gruppe plant. */
  onPlaetze: (spalte: number, gruppe: PlanGruppe) => (() => void) | undefined;
  /**
   * Zauberstab (E5-2): automatische Planung für diese Termine der Gruppe; `undefined`, wo es nichts zu füllen gibt
   * (kein freier Platz ohne Entwurf, den man planen und als Entwurf eintragen darf).
   */
  onZauberstab: (spalten: number[], gruppe: PlanGruppe) => (() => void) | undefined;
  darfAendern: (zeile: PlanZeile) => boolean;
  /** Die eigene Person – eigene Entwürfe stehen ohne „von …“. */
  ichId: number | null;
  /** Termin öffnen → Termin-Ansicht (E6-1b). */
  onTermin?: (id: number) => void;
  /** Der Ablauf oben in der Matrix (E6-6a); `null` ohne Anschluss. */
  ablauf: MatrixAblauf | null;
  /** Fokus-Modus (Wunsch 11): wessen Plätze umrandet sind (`personId`); `null`/fehlt: niemand. */
  fokusId?: number | null;
  /** Eine Person in den Fokus nehmen (Symbol am Namen, langes Drücken) – fehlt, wo es keinen Fokus gibt (Termin-Ansicht). */
  onFokus?: (personId: number, name: string) => void;
  /** Den Fokus beenden (in „Personen“ nimmt ein zweites Antippen des Namens ihn zurück). */
  onFokusAus?: () => void;
  /** „Infos & Dateien“ über dem Ablauf (T1b); `null` ohne Anschluss. */
  infos: MatrixInfos | null;
  /** Eintragen per Klick in „Personen“ (P2a) – fehlt, wo es das nicht gibt (Termin-Ansicht, ohne Anschluss). */
  personen?: PersonenEintragen;
}

/** Darf man an diesem Termin diesen Dienst planen – über Recht, Leitung oder als Admin des Termins? */
export const darfPlanen = (z: PlanZeile, s: PlanSpalte) => z.planbar || s.admin;

/** Darf man in dieser Gruppe an keinem der gezeigten Termine einteilen? Dieselbe Regel wie `darfPlanen`. */
export const nurAnsehen = (g: PlanGruppe, spalten: PlanSpalte[]) =>
  !g.zeilen.some((z) => spalten.some((s) => darfPlanen(z, s)));

/** Was das Fach „Wer kann?“ über den angetippten Platz wissen muss. */
export function freierPlatz(
  s: PlanSpalte,
  z: PlanZeile,
  plaetze: PlanPlatz[],
  nr: number,
): FreierPlatz {
  return {
    eventId: s.id,
    serviceId: z.dienst.id,
    dienst: z.dienst.name,
    termin: s.name,
    tag: tagKurz(s.tag),
    datum: s.tag,
    uhrzeit: s.uhrzeit,
    monat: s.tag.slice(0, 7),
    monatName: monatName(s.tag),
    nr,
    von: plaetze.length,
    schonDa: plaetze.flatMap((p) => (p.personId !== null ? [p.personId] : [])),
    index: plaetze[nr - 1]?.index ?? null,
    gruppeId: z.dienst.dienstgruppeId ?? 0,
    stift: z.planbar,
    ...bisherAus(plaetze[nr - 1]),
  };
}

/** Wer jetzt dort steht (E4-5) – nur bei belegten Plätzen mit sichtbarem Namen (verborgene haben keinen). */
function bisherAus(p: PlanPlatz | undefined): Pick<FreierPlatz, 'bisher'> {
  if (!p || p.art === 'frei' || p.name === null) return {};
  return { bisher: { belegung: p.belegung, name: p.name, gast: p.gast } };
}

/** Untertitel des Zauberstab-Fensters: ein Termin mit Namen, sonst die Spanne mit Anzahl. */
export function zauberUnter(plan: Plan, idx: number[]): string {
  const sp = [...idx].sort((a, b) => a - b).map((i) => plan.spalten[i]);
  if (sp.length === 1) return `${tagKurz(sp[0].tag)} · ${sp[0].name} · ${sp[0].uhrzeit} Uhr`;
  return `${tagKurz(sp[0].tag)} – ${tagKurz(sp[sp.length - 1].tag)} · ${sp.length} Termine`;
}

/** Was jetzt in ChurchTools am Platz steht – für das Fach eines veralteten Entwurfs. */
export function stehtInChurchTools(p: PlanPlatz): string {
  if (p.art === 'frei') return 'Der Platz ist dort wieder frei.';
  if (p.verborgen) return 'Dort ist jemand eingetragen (Name nicht sichtbar).';
  if (p.gast) return `${p.name} steht dort als Gast.`;
  return p.art === 'zugesagt' ? `${p.name} hat dort zugesagt.` : `${p.name} ist dort angefragt.`;
}
