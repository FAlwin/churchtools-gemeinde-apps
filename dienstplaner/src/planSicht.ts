import { monatName, tagKurz } from '@shared/ct/datum';
import type { Plan, PlanGruppe, PlanPlatz, PlanSpalte, PlanZeile } from '@shared/dienstplan/plan';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import type { FreierPlatz } from './WerKann';
import type { MatrixAblauf } from './useMatrixAblauf';
import type { MatrixInfos } from './useMatrixInfos';

/** Ein Entwurf an einem Platz – und ob er veraltet ist (in ChurchTools steht inzwischen etwas anderes). */
export type EntwurfAmPlatz = { entwurf: Entwurf; veraltet: boolean };

/** Schlüssel einer Gruppe – `null` (ohne Dienstgruppe) bekommt einen eigenen. */
export const schluessel = (g: PlanGruppe) => (g.gruppe ? String(g.gruppe.id) : 'ohne');

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
  /** „Infos & Dateien“ über dem Ablauf (T1b); `null` ohne Anschluss. */
  infos: MatrixInfos | null;
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
