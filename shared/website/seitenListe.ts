/**
 * **Die Seitenliste der Website** (Bauplan Website W3a-1) – was „Neue Seite“, „Startseite anlegen“ und „Seite löschen“
 * rechnen, ohne etwas zu speichern (das tut `speicher.ts`). Rein, damit es ohne ChurchTools geprüft werden kann.
 */
import { SLUG, type Einstellungen, type Menue, type Seite } from './modell';
import { findeVorlage } from './vorlagen';

/** Die Vorlage der Startseite, wenn die Website noch keine hat. */
export const STARTSEITEN_VORLAGE = 'start-schriftzug';

/** Pfad der Startseite beim Anlegen (die Startseite selbst heißt in der Adresse `/`). */
export const STARTSEITEN_PFAD = 'start';

const ERSATZ: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/**
 * Aus einem Titel den Pfad der Seite: Kleinbuchstaben, Umlaute ausgeschrieben, alles Übrige zu Bindestrichen. Ein Titel
 * ohne verwertbare Zeichen („???“) ergibt `seite`. Höchstens 80 Zeichen (Grenze des Modells), ohne Bindestrich am Ende.
 */
export function pfadAusTitel(titel: string): string {
  const roh = titel
    .toLowerCase()
    .replace(/[äöüß]/g, (z) => ERSATZ[z])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return SLUG.test(roh) ? roh : 'seite';
}

/** Der Pfad, der noch frei ist: bei Streit `-2`, `-3` … (der Platz für die Endung bleibt im Rahmen der 80 Zeichen). */
export function freierPfad(pfad: string, belegt: readonly string[]): string {
  const weg = new Set(belegt);
  if (!weg.has(pfad)) return pfad;
  for (let n = 2; ; n++) {
    const endung = `-${n}`;
    const kandidat = `${pfad.slice(0, 80 - endung.length).replace(/-+$/g, '')}${endung}`;
    if (!weg.has(kandidat)) return kandidat;
  }
}

/** Eine neue leere Seite. Der Titel wird beschnitten wie das Modell es verlangt (1–150 Zeichen). */
export function neueLeereSeite(
  titel: string,
  seiten: readonly Seite[],
  neueId: () => string,
): Seite {
  const t = titel.trim().slice(0, 150);
  return {
    id: neueId(),
    titel: t,
    pfad: freierPfad(
      pfadAusTitel(t),
      seiten.map((s) => s.pfad),
    ),
    abschnitte: [],
  };
}

/** Die Startseite aus der Vorlage `start-schriftzug` – Titel „Startseite“, Pfad `start` (oder der nächste freie). */
export function neueStartseite(seiten: readonly Seite[], neueId: () => string): Seite {
  const vorlage = findeVorlage(STARTSEITEN_VORLAGE);
  if (!vorlage) throw new Error(`Die Vorlage „${STARTSEITEN_VORLAGE}“ gibt es nicht.`);
  return {
    id: neueId(),
    titel: 'Startseite',
    pfad: freierPfad(
      STARTSEITEN_PFAD,
      seiten.map((s) => s.pfad),
    ),
    startseite: true,
    abschnitte: [vorlage.erzeugen(neueId)],
  };
}

/** Hat die Website eine Startseite? */
export function hatStartseite(seiten: readonly Seite[]): boolean {
  return seiten.some((s) => s.startseite === true);
}

/**
 * Die Seiten für die Liste: erst die im Menü (in der Reihenfolge des Menüs), dann die weiteren (Startseite zuerst, sonst
 * nach Titel). Eine Seite steht höchstens einmal da, auch wenn das Menü sie mehrfach nennt.
 */
export function seitenFuerListe(
  seiten: readonly Seite[],
  menue: Menue | null,
): { imMenue: Seite[]; weitere: Seite[] } {
  const nachId = new Map(seiten.map((s) => [s.id, s]));
  const imMenue: Seite[] = [];
  for (const e of menue?.eintraege ?? []) {
    for (const ziel of [e.ziel, ...(e.unter ?? []).map((u) => u.ziel)]) {
      const s = ziel.art === 'seite' ? nachId.get(ziel.seiteId) : undefined;
      if (s && !imMenue.includes(s)) imMenue.push(s);
    }
  }
  const weitere = seiten
    .filter((s) => !imMenue.includes(s))
    .sort(
      (a, b) =>
        Number(b.startseite === true) - Number(a.startseite === true) ||
        a.titel.localeCompare(b.titel, 'de'),
    );
  return { imMenue, weitere };
}

/**
 * Wie eine Seite in einer Auswahl heißt: der Titel, bei der Startseite mit dem Zusatz „(Startseite)“ – **außer ihr Titel
 * sagt es schon** („Startseite“ ergäbe „Startseite (Startseite)“).
 */
export function seitenAuswahlText(s: Pick<Seite, 'titel' | 'startseite'>): string {
  if (!s.startseite || s.titel.toLowerCase().includes('startseite')) return s.titel;
  return `${s.titel} (Startseite)`;
}

/**
 * Das Menü ohne die Einträge, die auf diese Seite zeigen (auch unter einem Eintrag). Ein Eintrag, der selbst auf die
 * Seite zeigt, fällt mit seinen Unterpunkten weg; ein Unterpunkt fällt allein weg. `null`, wenn sich nichts ändert – dann
 * muss das Menü nicht neu gespeichert werden.
 */
export function menueOhneSeite(menue: Menue | null, seiteId: string): Menue | null {
  if (!menue) return null;
  const zeigtHin = (z: { art: string; seiteId?: string }) =>
    z.art === 'seite' && z.seiteId === seiteId;
  let geaendert = false;
  const eintraege = menue.eintraege.flatMap((e) => {
    if (zeigtHin(e.ziel)) {
      geaendert = true;
      return [];
    }
    const unter = e.unter?.filter((u) => !zeigtHin(u.ziel));
    if (unter && unter.length !== e.unter!.length) {
      geaendert = true;
      return [{ ...e, unter }];
    }
    return [e];
  });
  return geaendert ? { eintraege } : null;
}

/**
 * Einstellungen, solange die Gemeinde noch keine gespeichert hat – damit die Vorschau etwas zu zeigen hat. **Nicht
 * gespeichert**: Name, Farben und Schriften kommen mit „Aussehen“ (W3a-3). `noindex`, weil es noch keine
 * veröffentlichte Adresse gibt, die Suchmaschinen aufnehmen sollen.
 */
export function vorlaeufigeEinstellungen(gemeindeName: string | null): Einstellungen {
  return {
    name: gemeindeName?.trim() || 'Deine Gemeinde',
    fusszeile: [],
    noindex: true,
    sprache: 'de',
  };
}
