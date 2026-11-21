import { monatName, tagKurz } from '@shared/ct/datum';
import type { Plan, PlanGruppe, PlanPlatz, PlanSpalte, PlanZeile } from '@shared/dienstplan/plan';
import type { Besetzung, Entwurf } from '@shared/dienstplan/entwuerfe';
import type { Personenliste } from '@shared/dienstplan/personenliste';
import type { Modus } from '@shared/dienstplan/modusVorgabe';
import type { Dienst } from '@shared/ct/dienste';
import type { Schild } from '@shared/dienstplan/vertretung';
import type { ZellenAktion } from '@shared/dienstplan/personenEintragen';
import type { RasterGast, RasterZelle } from '@shared/dienstplan/personenRaster';
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
  /** Was ein Klick in diese Zelle tut – `null`: nichts (kein Recht, Entwürfe nicht bereit, Entwurf veraltet …). */
  aktion: (
    spalte: number,
    zeile: PlanZeile,
    personId: number,
    zustand: RasterZelle['zustand'],
  ) => ZellenAktion;
  /** Was ein Klick auf einen Gast tut (P2b) – dieselben Rechte wie `aktion`. */
  gast: (spalte: number, zeile: PlanZeile, gast: RasterGast) => ZellenAktion;
  /**
   * Was ein Klick auf die **leere Gäste-Zelle** (oder das „+“ in einer vollen, P2d) tut: `eintragen` (freier Platz),
   * `voll` (Fenster „Dienst voll“), `null` – kein Recht, Entwürfe nicht bereit, Termin abgesagt, Dienst nicht vorgesehen.
   * Dieselben Rechte wie `aktion`.
   */
  gastNeu: (spalte: number, zeile: PlanZeile) => ZellenAktion;
  /**
   * Entwurf für die Person – oder den Gast (P2d: `{ art: 'gast', name }`, derselbe Weg wie die Gast-Wahl in „Wer kann?“) –
   * auf den Platz `nr` (1-basiert); meldet selbst „eingetragen“ bzw. den Fehler. `ersetzt`: die Version des
   * „Zurückziehen“-Entwurfs an diesem Platz, den der Eintrag ersetzt („X durch Y ersetzen“).
   */
  eintragen: (
    spalte: number,
    zeile: PlanZeile,
    nr: number,
    wer: Besetzung,
    ersetzt?: number,
  ) => Promise<void>;
  /**
   * Den eigenen Entwurf auf „direkt“ umstellen (P2m, zweiter Klick) – derselbe Weg wie „Beim Senden“ im Entwurfs-Fach,
   * mit Versions-Schutz; meldet selbst den Fehler.
   */
  direkt: (zeile: PlanZeile, entwurf: Entwurf) => Promise<void>;
  /** Den eigenen Entwurf wieder wegnehmen – meldet selbst „entfernt“ bzw. den Fehler. */
  wegnehmen: (zeile: PlanZeile, entwurf: Entwurf) => Promise<void>;
  /**
   * **Platz dazunehmen und eintragen** (P2c, Dienst voll): erst die Platzzahl in ChurchTools um 1 erhöhen (sofort, derselbe
   * Weg wie der Regler – `anzahlAendern`), dann – **nach dem Neuladen des Termins**, wenn der neue Platz wirklich da ist – den
   * Entwurf für die Person anlegen (derselbe Weg wie `eintragen`). Meldet selbst alle Fehler; scheitert das Erhöhen, entsteht
   * kein Entwurf. Fehlt, wo es keinen Anschluss zum Ändern der Plätze gibt.
   */
  dazunehmen?: (spalte: number, zeile: PlanZeile, wer: Besetzung) => Promise<void>;
}

/**
 * **„Liste bearbeiten“ in „Personen“** (PL-2, Entwurf `personenliste.html` Variante B). Im Modus bekommt jede obere Zeile
 * einer Dienstgruppe, deren Liste man ändern darf, einen Griff zum Ziehen, und der Klick auf den Namen öffnet das
 * Personen-Fenster (Tags und Pause) statt des Fokus. Gespeichert wird in der Personenliste der Dienstgruppe – für alle Planer.
 */
export interface ListeBearbeiten {
  /** Der Modus ist an. */
  an: boolean;
  /** Es wird gerade gespeichert – bis dahin sind die Griffe gesperrt. */
  laeuft: boolean;
  /** Darf man die Liste dieser Dienstgruppe ändern? `null`: Dienst ohne Dienstgruppe – nein. */
  darf: (dienstgruppeId: number | null) => boolean;
  /**
   * Eine Person im Block verschieben: `block` sind die Personen **oben** im Block (ohne die blassen), `von` und `nach` Stellen
   * darin. Speichert die neue Reihenfolge der Dienstgruppe und meldet selbst einen Fehler.
   */
  verschieben: (
    dienstgruppeId: number,
    block: readonly number[],
    von: number,
    nach: number,
  ) => void;
  /** Der Name wurde angetippt: das Personen-Fenster dieser Person bei diesem Dienst. */
  person: (dienst: Dienst, personId: number, name: string) => void;
}

/** Was die Matrix gerade zeigt – aus Plan, Filtern und Fenster. */
export interface Sicht {
  plan: Plan;
  /** Indizes der sichtbaren Spalten in `plan.spalten`. */
  spalten: number[];
  gruppen: PlanGruppe[];
  /** Die Personenliste je Dienstgruppe (ID, PL-1) – Reihenfolge, Tags und Pause in „Personen“; fehlt ohne Schublade/Liste. */
  personenlisten?: ReadonlyMap<number, Personenliste>;
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
  /**
   * „Vertretung gesucht“ (E5c-6): die Schilder an den freien Plätzen dieses Dienstes an diesem Termin – nur, solange ein Platz
   * frei ist (`schilder`). Fehlt, wo es das nicht gibt (Termin-Ansicht, ohne Anschluss): dann gibt es keine Schilder.
   */
  vertretung?: (spalte: number, zeile: PlanZeile) => Schild[];
  /** Entwürfe ohne Platz an diesem Termin und Dienst (#582) – Schild darunter. */
  ohnePlatz: (spalte: number, zeile: PlanZeile) => Entwurf[];
  /** Schild antippen → Entwurfs-Fach mit „Entwurf verwerfen“ (nur wo man planen und ändern darf). */
  onOhnePlatz: (spalte: number, zeile: PlanZeile, e: Entwurf) => void;
  /** Regler in der Gruppenzeile → Plätze-Fach (E4-5-3); `undefined`, wo man keinen Dienst der Gruppe plant. */
  onPlaetze: (spalte: number, gruppe: PlanGruppe) => (() => void) | undefined;
  /**
   * Zeile „Plätze“ und roter Tag in „Personen“ (P2c) → Fenster mit dem Regler für **diesen** Dienst an diesem Termin;
   * `undefined`, wo man es nicht darf (dieselben Rechte wie `onPlaetze`, dazu nicht an abgesagten Terminen) oder es das
   * nicht gibt (Termin-Ansicht).
   */
  onPlatz?: (spalte: number, zeile: PlanZeile) => (() => void) | undefined;
  /**
   * Zauberstab (E5-2): automatische Planung für diese Termine der Gruppe; `undefined`, wo es nichts zu füllen gibt
   * (kein freier Platz ohne Entwurf, den man planen und als Entwurf eintragen darf). Mit `dienstId` nur für diesen
   * Dienst der Gruppe („Personen“, P2z) – dieselbe Funktion, dasselbe Fenster.
   */
  onZauberstab: (
    spalten: number[],
    gruppe: PlanGruppe,
    dienstId?: number,
  ) => (() => void) | undefined;
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
  /** „Liste bearbeiten“ (PL-2) – fehlt, wo es das nicht gibt (Termin-Ansicht, ohne Anschluss). */
  liste?: ListeBearbeiten;
  /**
   * Die Vorgabe „Anfrage | direkt“ je Dienst (P2m, nur Matrix): womit ein neuer Entwurf beginnt, und das Fenster dazu.
   * Fehlt, wo man keine Entwürfe anlegen kann – dann steht am Dienstnamen auch kein Symbol.
   */
  vorgabe?: {
    modus: (dienstId: number) => Modus;
    oeffnen: (zeile: PlanZeile) => void;
  };
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
