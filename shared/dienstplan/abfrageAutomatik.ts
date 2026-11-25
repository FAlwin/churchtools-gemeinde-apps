/**
 * **Erinnerungen in ChurchTools einrichten – die reinen Regeln** (Bauplan R-5a, 25.11.2026). Je Dienstgruppe legt die App in
 * ChurchTools eine **Hilfsgruppe** (Gruppentyp „Dienstplaner“) und eine **Routine** daran an; die Routine verschickt später die
 * Erinnerungen (R-5b baut ihre Schritte, hier entsteht sie ohne). Dazu werden alle **Planer** der Dienstgruppe als **Leiter**
 * der Hilfsgruppe eingetragen – ohne das könnten sie die Routine nicht ändern („Dienstbereich“ vererbt keine Rechte, gemessen
 * 25.11.2026). Gespeichert wird nur Gruppen- und Routinen-Nummer (`AbfragenInhalt.einrichtung`); geschrieben wird in
 * `dienstplaner/src/einrichtenAbfragen.ts`.
 *
 * Hier stehen nur Namen, Texte und Rechenregeln:
 * - **Die Planer-Liste** (`planerListe`) aus zwei Quellen: wer das globale Recht „Dienste einzelner Dienstkategorien
 *   bearbeiten“ für die Dienstgruppe hat, und wer eine ChurchTools-Gruppe der Dienste **leitet** – dieselbe Regel wie
 *   `darfDienstPlanen` (Termin-Admins planen nur einzelne Termine und zählen nicht).
 * - **Soll gegen Ist** (`einrichtenPlan`): was beim Einrichten zu tun ist. **Nie entfernt:** Wer Leiter ist, aber kein Planer
 *   mehr, wird nur gemeldet.
 */
import { ctId } from '../ct/ctId';

/** Der Gruppentyp der Hilfsgruppen – legt ein Admin einmal in ChurchTools an (Anleitung `docs/betrieb/DIENSTPLANER.md`). */
export const HILFSGRUPPEN_TYP = 'Dienstplaner';

/** Passt der Name eines Gruppentyps? (Ohne Rücksicht auf Leerzeichen am Rand, sonst genau.) */
export const istHilfsgruppenTyp = (name: unknown): boolean =>
  typeof name === 'string' && name.trim() === HILFSGRUPPEN_TYP;

/** Der Name der Hilfsgruppe – er muss für sich sprechen: Mitarbeitende sehen sie in ChurchTools unter „Meine Gruppen“. */
export const hilfsgruppenName = (dienstgruppe: string): string =>
  `Dienstplaner: Antwort fehlt – ${dienstgruppe}`;

/** Der Name der Routine an der Hilfsgruppe. */
export const routinenName = (dienstgruppe: string): string =>
  `Dienstplaner: Erinnerungen ${dienstgruppe}`;

/** Ist das eine Routine dieser App? (Erkennbar am Namen – fremde Routinen fasst die App nie an.) */
export const istUnsereRoutine = (name: unknown): boolean =>
  typeof name === 'string' && name.startsWith('Dienstplaner: ');

/** Die Beschreibung der Hilfsgruppe in ChurchTools (`information.note`): was, warum, wer sie führt. */
export const hilfsgruppenBeschreibung = (dienstgruppe: string): string =>
  `Hilfsgruppe des Dienstplaners für ${dienstgruppe}: Hier steht nur, wem in einer laufenden Abfrage noch Antworten fehlen. ` +
  `Die Erweiterung Dienstplaner trägt Personen ein und wieder aus. Eine Routine an dieser Gruppe verschickt die Erinnerungen; ` +
  `wer ausgetragen wird oder die Gruppe verlässt, bekommt ab sofort keine mehr.`;

// ── Die Planer ──────────────────────────────────────────────────────────────

/** Das globale Recht, mit dem man eine Dienstgruppe plant – die Nummer wird je Instanz aus den Definitionen gelesen. */
export const PLANER_RECHT = {
  modul: 'churchservice',
  recht: 'edit servicegroup',
  name: 'Dienste einzelner Dienstkategorien bearbeiten',
} as const;

/** `GET`-Adresse: alle Personen, die das Recht für diese Dienstgruppe haben (braucht „Berechtigungen verwalten“). */
export const planerRechtPfad = (authId: number, dienstgruppeId: number): string =>
  `/permissions/global/auths/${authId}/persons?data_id=${dienstgruppeId}`;

/**
 * Personennummern aus der Antwort auf `planerRechtPfad` – **streng:** Eine Liste, deren Einträge Nummern sind (oder Objekte mit
 * `personId`/`id`). `null`, wenn die Antwort keine Liste ist oder ein Eintrag keine Nummer hat: Eine halbe Liste darf nie
 * „weniger Planer“ heißen (dann entstünde eine Gruppe ohne Leiter, und Soll/Ist meldete „nichts fehlt“).
 */
export function personenIdsAusRecht(roh: unknown): number[] | null {
  if (!Array.isArray(roh)) return null;
  const ids: number[] = [];
  for (const e of roh as unknown[]) {
    const id =
      e !== null && typeof e === 'object'
        ? (ctId((e as { personId?: unknown }).personId) ?? ctId((e as { id?: unknown }).id))
        : ctId(e);
    if (id === null || id <= 0) return null;
    ids.push(id);
  }
  return ids;
}

/** Aufsteigend, jede Nummer einmal. */
const sortiert = (ids: Iterable<number>): number[] => [...new Set(ids)].sort((a, b) => a - b);

/** **Die Planer einer Dienstgruppe**: Personen-IDs aus beiden Quellen, sortiert, ohne Doppel. */
export function planerListe(quellen: {
  /** Mit dem globalen Recht für diese Dienstgruppe. */
  recht: readonly number[];
  /** Leiter einer ChurchTools-Gruppe der Dienste dieser Dienstgruppe. */
  leitungen: readonly number[];
}): number[] {
  return sortiert([...quellen.recht, ...quellen.leitungen]);
}

/**
 * Die ChurchTools-Gruppen der Dienste einer Dienstgruppe – jede einmal (Kamera Saal/Studio/Mobil teilen sich eine). Von deren
 * Leitung kommt die zweite Quelle der Planer-Liste.
 */
export function gruppenIdsDerDienste(
  dienste: Iterable<{ dienstgruppeId: number | null; gruppenIds: readonly number[] }>,
  dienstgruppeId: number,
): number[] {
  const ids = new Set<number>();
  for (const d of dienste)
    if (d.dienstgruppeId === dienstgruppeId) for (const g of d.gruppenIds) ids.add(g);
  return sortiert(ids);
}

// ── Soll gegen Ist ──────────────────────────────────────────────────────────

/** Was in ChurchTools schon dasteht. */
export interface EinrichtenIst {
  /** Die Hilfsgruppe gibt es (die gespeicherte oder eine übernommene mit gleichem Namen und Typ). */
  gruppe: boolean;
  /** Die Routine der App hängt an der Gruppe (Teilnehmer, aktiv, eingeschaltet). */
  routine: boolean;
  /** Das Dokument verweist auf genau diese Gruppe und Routine. */
  eingetragen: boolean;
  /** Aktive Leiter der Hilfsgruppe (Personen-IDs). */
  leiter: readonly number[];
  /** Aktive Teilnehmer der Hilfsgruppe (Personen-IDs). */
  teilnehmer: readonly number[];
}

/** Was beim Einrichten zu tun ist – jeder Teil einzeln, damit Fenster und Schreiben dasselbe lesen. */
export interface EinrichtenPlan {
  gruppeAnlegen: boolean;
  /** Fehlt die Gruppe, fehlt auch die Routine. */
  routineAnlegen: boolean;
  /** Die Nummern ins Dokument schreiben (noch nicht oder anders eingetragen). */
  einrichtungSchreiben: boolean;
  /** Planer, die noch nicht Leiter sind und noch nicht in der Gruppe stehen – sie werden eingetragen. */
  leiterNachtragen: number[];
  /**
   * Planer, die schon **Teilnehmer** der Hilfsgruppe sind. Die App stellt sie nicht um (das beendete ihren Lauf in der Routine) –
   * sie werden nur gemeldet.
   */
  planerAlsTeilnehmer: number[];
  /** Leiter, die kein Planer (mehr) sind – bleiben stehen, werden nur gemeldet. */
  leiterZuviel: number[];
  /** Es gibt nichts zu schreiben. */
  nichtsZuTun: boolean;
}

/** **Soll gegen Ist.** `planer` kommt aus `planerListe`. */
export function einrichtenPlan(planer: readonly number[], ist: EinrichtenIst): EinrichtenPlan {
  const soll = sortiert(planer);
  const leiter = new Set(ist.leiter);
  const teilnehmer = new Set(ist.teilnehmer);
  const gruppeAnlegen = !ist.gruppe;
  const routineAnlegen = gruppeAnlegen || !ist.routine;
  // Eine gerade angelegte Gruppe hat keine Mitglieder – was in `ist` steht, gilt dann nicht.
  const imMoment = (menge: Set<number>) => (gruppeAnlegen ? new Set<number>() : menge);
  const sollSet = new Set(soll);
  const leiterNachtragen = soll.filter(
    (p) => !imMoment(leiter).has(p) && !imMoment(teilnehmer).has(p),
  );
  const planerAlsTeilnehmer = soll.filter(
    (p) => !imMoment(leiter).has(p) && imMoment(teilnehmer).has(p),
  );
  const leiterZuviel = sortiert([...imMoment(leiter)].filter((p) => !sollSet.has(p)));
  const einrichtungSchreiben = gruppeAnlegen || routineAnlegen || !ist.eingetragen;
  return {
    gruppeAnlegen,
    routineAnlegen,
    einrichtungSchreiben,
    leiterNachtragen,
    planerAlsTeilnehmer,
    leiterZuviel,
    nichtsZuTun:
      !gruppeAnlegen && !routineAnlegen && !einrichtungSchreiben && leiterNachtragen.length === 0,
  };
}
