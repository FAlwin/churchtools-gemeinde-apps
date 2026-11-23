/**
 * **Eigene Ansichten des Teams** (U3, Entwurf `r2-u3-filter-ansichten-v1`, abgenommen 23.11.2026) – anlegen, ändern,
 * umbenennen, verschieben, löschen, ohne Oberfläche. Gespeichert in den Einstellungen der Veranstaltung wie die
 * Spaltenwahl (Entscheidungsliste E2), höchstens `ANSICHTEN_MAX` (E3). Was eine Ansicht zeigt, rechnen dieselben Regeln
 * wie in den festen Reitern: Filter `tabellenFilter.ts`, Spalten `spaltenWahl` (`tabelle.ts`).
 */
import {
  ANSICHT_NAME_MAX,
  ANSICHTEN_MAX,
  type EigeneAnsicht,
  type OeffentlicheEinstellungen,
  type SpaltenFilter,
  type TabellenWahl,
} from './formular';
import { filterBereinigt } from './tabellenFilter';
import { spaltenKatalog, spaltenWahl, type Sortierung, type TabellenModus } from './tabelle';

export { ANSICHTEN_MAX, ANSICHT_NAME_MAX, type EigeneAnsicht };

/** Die festen Reiter – kein eigener Name darf so heißen. */
const FESTE_NAMEN = ['Alle', 'Zahlung offen', 'Warteliste', 'Abgesagt'];

/** Was in einer Ansicht eingestellt ist – und was „Änderungen speichern“ übernimmt. */
export interface AnsichtStand {
  filter: SpaltenFilter[];
  sortierung: Sortierung;
  jePerson: boolean;
}

/**
 * **Die Ansichten, bereinigt** – wie die Spaltenwahl: Filter auf gelöschte Fragen fallen still weg (`filterBereinigt`),
 * eine Sortierung nach einer Spalte, die es nicht mehr gibt, ebenso. Die Ansicht selbst bleibt.
 */
export function ansichtenAus(e: OeffentlicheEinstellungen): EigeneAnsicht[] {
  return (e.ansichten ?? []).map((a) => {
    const katalog = spaltenKatalog(e, a.jePerson ? 'person' : 'anmeldung');
    const sortierung =
      a.sortierung && katalog.some((s) => s.schluessel === a.sortierung!.schluessel)
        ? a.sortierung
        : undefined;
    const neu: EigeneAnsicht = { ...a, filter: filterBereinigt(e, a.filter) };
    if (sortierung) neu.sortierung = sortierung;
    else delete neu.sortierung;
    return neu;
  });
}

/** Der Stand einer Ansicht, so wie der Reiter ihn beim Öffnen übernimmt. */
export function ansichtStand(a: EigeneAnsicht): AnsichtStand {
  return { filter: a.filter, sortierung: a.sortierung ?? null, jePerson: !!a.jePerson };
}

const gleich = (u: unknown, w: unknown) => JSON.stringify(u) === JSON.stringify(w);

/** **Weicht der Stand von der gespeicherten Ansicht ab?** Dann gibt es „Änderungen speichern / Verwerfen“. */
export function ansichtGeaendert(a: EigeneAnsicht, jetzt: AnsichtStand): boolean {
  return !gleich(ansichtStand(a), jetzt);
}

/** **Die Spalten einer Ansicht** – ihre eigenen, sonst die des Teams; bereinigt wie dort (`spaltenWahl`). */
export function ansichtSpalten(
  e: OeffentlicheEinstellungen,
  a: EigeneAnsicht,
  modus: TabellenModus,
): TabellenWahl {
  return spaltenWahl({ ...e, tabelle: { ...e.tabelle, ...a.tabelle } }, modus);
}

/**
 * **Ist der Name in Ordnung?** Leer, zu lang oder schon vergeben (auch die festen Reiter, ohne Groß und klein) – dann
 * der Satz für das Fenster, sonst `null`. `ausser`: die Ansicht, die gerade umbenannt wird.
 */
export function ansichtNameFehler(
  e: OeffentlicheEinstellungen,
  name: string,
  ausser?: string,
): string | null {
  const n = name.trim();
  if (!n) return 'Bitte einen Namen eingeben.';
  if (n.length > ANSICHT_NAME_MAX) return `Höchstens ${ANSICHT_NAME_MAX} Zeichen.`;
  const vergeben = [
    ...FESTE_NAMEN,
    ...(e.ansichten ?? []).filter((a) => a.id !== ausser).map((a) => a.name),
  ];
  if (vergeben.some((x) => x.toLocaleLowerCase('de') === n.toLocaleLowerCase('de')))
    return `„${n}“ gibt es schon.`;
  return null;
}

/** Ist noch Platz für eine Ansicht? Sonst der Satz für das Fenster. */
export function ansichtPlatzFehler(e: OeffentlicheEinstellungen): string | null {
  return (e.ansichten?.length ?? 0) >= ANSICHTEN_MAX
    ? `Höchstens ${ANSICHTEN_MAX} eigene Ansichten je Veranstaltung – lösche vorher eine.`
    : null;
}

/** Eine neue, freie Kennung (kurz, nur Buchstaben und Ziffern). */
export function neueAnsichtId(e: OeffentlicheEinstellungen, zufall = Math.random): string {
  const da = new Set((e.ansichten ?? []).map((a) => a.id));
  for (;;) {
    const id = zufall().toString(36).slice(2, 8) || 'a';
    if (!da.has(id)) return id;
  }
}

const mitListe = (
  e: OeffentlicheEinstellungen,
  liste: EigeneAnsicht[],
): OeffentlicheEinstellungen => {
  const neu: OeffentlicheEinstellungen = { ...e, ansichten: liste };
  if (liste.length === 0) delete neu.ansichten;
  return neu;
};

/** Der Stand als Teil einer Ansicht – nur, was nicht die Vorgabe ist (hält die Einstellungen kurz). */
const standTeil = (s: AnsichtStand): Pick<EigeneAnsicht, 'filter' | 'jePerson' | 'sortierung'> => ({
  filter: s.filter,
  ...(s.jePerson ? { jePerson: true } : {}),
  ...(s.sortierung ? { sortierung: s.sortierung } : {}),
});

/**
 * **Neue Ansicht** hinten anhängen – mit Name, Filter, Sortierung, „je Person“ und den Spalten, die gerade gelten (nur
 * wenn sie von der Spaltenwahl des Teams abweichen). Wirft, wenn Name oder Platz nicht passen – das Fenster prüft vorher.
 */
export function mitNeuerAnsicht(
  e: OeffentlicheEinstellungen,
  neu: { id: string; name: string; stand: AnsichtStand; spalten?: TabellenWahl },
): OeffentlicheEinstellungen {
  const fehler = ansichtPlatzFehler(e) ?? ansichtNameFehler(e, neu.name);
  if (fehler) throw new Error(fehler);
  const modus: TabellenModus = neu.stand.jePerson ? 'person' : 'anmeldung';
  const eigene =
    neu.spalten && !gleich(neu.spalten, spaltenWahl(e, modus))
      ? { tabelle: { [modus]: neu.spalten } }
      : {};
  return mitListe(e, [
    ...(e.ansichten ?? []),
    { id: neu.id, name: neu.name.trim(), ...standTeil(neu.stand), ...eigene },
  ]);
}

/** Eine Ansicht ändern – was `aendern` aus ihr macht; fehlt sie (inzwischen gelöscht), bleibt alles, wie es ist. */
function ansichtAendern(
  e: OeffentlicheEinstellungen,
  id: string,
  aendern: (a: EigeneAnsicht) => EigeneAnsicht,
): OeffentlicheEinstellungen {
  if (!(e.ansichten ?? []).some((a) => a.id === id)) return e;
  return mitListe(
    e,
    (e.ansichten ?? []).map((a) => (a.id === id ? aendern(a) : a)),
  );
}

/** **Änderungen speichern** – Filter, Sortierung und „je Person“ der Ansicht übernehmen. */
export function mitAnsichtStand(
  e: OeffentlicheEinstellungen,
  id: string,
  stand: AnsichtStand,
): OeffentlicheEinstellungen {
  return ansichtAendern(e, id, ({ id: i, name, tabelle }) => ({
    id: i,
    name,
    ...standTeil(stand),
    ...(tabelle ? { tabelle } : {}),
  }));
}

/** **Umbenennen.** Wirft bei einem Namen, den es schon gibt. */
export function mitAnsichtName(
  e: OeffentlicheEinstellungen,
  id: string,
  name: string,
): OeffentlicheEinstellungen {
  const fehler = ansichtNameFehler(e, name, id);
  if (fehler) throw new Error(fehler);
  return ansichtAendern(e, id, (a) => ({ ...a, name: name.trim() }));
}

/**
 * **Spalten dieser Ansicht** – gemerkt wie die Spaltenwahl des Teams (`mitSpaltenWahl`): nur, was abweicht – hier von
 * der Wahl des Teams; gleicht die Wahl ihr wieder, fällt sie aus der Ansicht.
 */
export function mitAnsichtSpalten(
  e: OeffentlicheEinstellungen,
  id: string,
  modus: TabellenModus,
  w: TabellenWahl,
): OeffentlicheEinstellungen {
  return ansichtAendern(e, id, (a) => {
    const tabelle = { ...a.tabelle };
    if (gleich(w, spaltenWahl(e, modus))) delete tabelle[modus];
    else tabelle[modus] = w;
    const neu: EigeneAnsicht = { ...a, tabelle };
    if (!tabelle.anmeldung && !tabelle.person) delete neu.tabelle;
    return neu;
  });
}

/** **Nach links (−1) oder rechts (+1)** unter den eigenen Ansichten – am Rand bleibt sie stehen. */
export function mitAnsichtVerschoben(
  e: OeffentlicheEinstellungen,
  id: string,
  um: -1 | 1,
): OeffentlicheEinstellungen {
  const liste = [...(e.ansichten ?? [])];
  const i = liste.findIndex((a) => a.id === id);
  const j = i + um;
  if (i < 0 || j < 0 || j >= liste.length) return e;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  return mitListe(e, liste);
}

/** **Löschen** – mit dem, was „Rückgängig“ braucht (die Ansicht und ihre Stelle). */
export function ohneAnsicht(
  e: OeffentlicheEinstellungen,
  id: string,
): { e: OeffentlicheEinstellungen; weg: { ansicht: EigeneAnsicht; stelle: number } | null } {
  const liste = e.ansichten ?? [];
  const stelle = liste.findIndex((a) => a.id === id);
  if (stelle < 0) return { e, weg: null };
  return {
    e: mitListe(
      e,
      liste.filter((a) => a.id !== id),
    ),
    weg: { ansicht: liste[stelle], stelle },
  };
}

/**
 * **Rückgängig nach dem Löschen** – die Ansicht wieder an ihre Stelle. Gibt es den Namen inzwischen wieder oder ist
 * kein Platz mehr, kommt sie trotzdem zurück (hinten bzw. umbenannt wäre überraschender als ein zweiter gleicher Name).
 */
export function mitAnsichtZurueck(
  e: OeffentlicheEinstellungen,
  weg: { ansicht: EigeneAnsicht; stelle: number },
): OeffentlicheEinstellungen {
  const liste = (e.ansichten ?? []).filter((a) => a.id !== weg.ansicht.id);
  liste.splice(Math.min(weg.stelle, liste.length), 0, weg.ansicht);
  return mitListe(e, liste.slice(0, ANSICHTEN_MAX));
}
