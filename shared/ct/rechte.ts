/**
 * Die Rechte des Nutzers aus ChurchTools lesen – geteilt von Server und ChurchTools-Extension (#335).
 * Lag bis dahin in `server/src/services/ctCapabilities.ts`; dort bleiben die Teile, die Gruppen,
 * Zwischenspeicher und die Konfiguration des Servers brauchen.
 */
import type { UserCapabilities } from '../types/index';
import { ctId } from './ctId';

/** Das Admin-Recht, wenn nichts anderes eingestellt ist (Server: `ADMIN_PERMISSION`). */
export const STANDARD_ADMIN_RECHT = 'churchcore:administer persons';

/**
 * Was das ChurchTools-Recht `edit songcategory` hergibt (#322).
 *
 * **Die EINZIGE Stelle, die dieses Recht liest.** `parseCapabilities` verdichtet es zu
 * `canEditSongs` (ja/nein), das Anlege-Formular braucht die **Liste** der erlaubten Kategorien.
 * Stünde die Auswertung zweimal da, wäre genau das die Fehlerklasse, die dieses Projekt am
 * häufigsten getroffen hat – eine der beiden Stellen zieht bei einer Änderung nicht mit.
 *
 * Gemessen (11.08.2026): Der Wert ist eine **Liste von Kategorie-IDs**, bei Alwin `[0,1]`.
 */
export interface SongEditRight {
  /** Darf der Nutzer Lieder bearbeiten? */
  erlaubt: boolean;
  /**
   * Die genannten Kategorie-IDs, oder **`null` = ChurchTools hat keine Liste genannt**.
   *
   * `null` ist nicht dasselbe wie `[]`: Eine leere Liste heißt „keine einzige Kategorie erlaubt"
   * (also kein Recht), `null` heißt „das Recht besteht, aber ohne Aufzählung". Im zweiten Fall darf
   * die App **nicht selbst eingrenzen** – sie würde sonst Kategorien verstecken, die erlaubt sind.
   * Gemessen kommt immer eine Liste; `null` deckt eine andere Antwortform ab, ohne dass jemand
   * ausgesperrt wird („vorübergehend ist nicht ungültig", vgl. #270).
   */
  ids: number[] | null;
}

export function parseSongEditRight(
  data: Record<string, Record<string, unknown>> | null | undefined,
): SongEditRight {
  const wert = data?.churchservice?.['edit songcategory'];
  if (Array.isArray(wert)) {
    // Über `ctId`, NICHT über `map(Number)`: `Number(null)` ist 0, und 0 ist bei den Kategorien eine
    // echte ID („Aktive Songs"). Ein `null` in der Liste hätte sonst ein Recht erfunden.
    const ids = wert.map(ctId).filter((n): n is number => n !== null);
    return { erlaubt: ids.length > 0, ids };
  }
  // Kein Array: `undefined`/`false` heißt kein Recht, alles andere Wahre ein Recht ohne Aufzählung.
  // Diese Unterscheidung stand vorher in `has()` und muss hier gleich ausfallen – sonst ändert sich
  // `canEditSongs` als Nebenwirkung dieser Umstellung.
  return wert ? { erlaubt: true, ids: null } : { erlaubt: false, ids: [] };
}

/**
 * Wertet die ChurchTools-Rechte-Antwort (`/api/permissions/global`) aus.
 *
 * WICHTIG: Eine gültige Antwort enthält für jeden angemeldeten Nutzer IMMER mindestens einen
 * Modul-Block. Eine komplett leere Antwort ist daher NICHT „der Nutzer hat keine Rechte", sondern
 * ein vorübergehender Aussetzer (kurz überlastetes/inkonsistentes ChurchTools, wackelige
 * Verbindung). Wir werfen dann, damit der Client automatisch neu versucht – statt fälschlich das
 * endgültige „keine Berechtigung"-Schloss zu zeigen. Fehlt hingegen nur der churchservice-Block
 * (andere Module sind vorhanden), hat der Nutzer wirklich keine Lieder-/Ablauf-Rechte → reguläre
 * false-Werte ohne Wurf.
 */
export function rechteAus(
  data: Record<string, Record<string, unknown>> | null | undefined,
  /** Das Admin-Recht in der Form `modul:recht` (Server: `config.adminPermission`). */
  adminPermission: string,
  fehler: (status: number, meldung: string) => Error,
): UserCapabilities {
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    throw fehler(502, 'Leere Rechte-Antwort von ChurchTools – bitte erneut versuchen.');
  }
  const cs = data.churchservice ?? {};
  const has = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : Boolean(v));
  // Admin-Recht aus der Konfiguration (Form `modul:recht`).
  const [adminModule, adminPerm] = adminPermission.split(':');
  const isAdmin = has(data[adminModule]?.[adminPerm]);
  // Ein Admin darf ohnehin alles – auch ohne explizit zugewiesene Kategorie-/Kalender-Rechte.
  // Nicht `has(cs['edit songcategory'])`, sondern über `parseSongEditRight` – sonst wäre dies eine
  // ZWEITE Stelle, die dasselbe Recht auswertet, und die beiden könnten auseinanderlaufen (#322).
  const canEditSongs = isAdmin || parseSongEditRight(data).erlaubt;
  const canViewSongs = isAdmin || has(cs['view songcategory']);
  const canViewAgendas = isAdmin || has(cs['view agenda']);
  return {
    canViewSongs,
    canViewAgendas,
    canEditAgendas: isAdmin || has(cs['edit agenda']),
    canEditSongs,
    // Dasselbe Recht, eigens benannt (siehe `UserCapabilities.canEditTempo`) – NICHT neu ausgewertet.
    canEditTempo: canEditSongs,
    // `use ccli` ist ein eigenes Recht und NICHT vom Admin-Recht abgedeckt: Ohne SongSelect-Abo der
    // Gemeinde hilft auch Administrator sein nichts (#322).
    canUseCcli: has(cs['use ccli']),
    isAdmin,
    // Default; die tatsächliche Gruppen-/Rollen-Prüfung ergänzt getCapabilities (braucht Cookie + Config).
    canUseGlobalNotes: false,
    canUseAvailability: false,
    keineLiedRechte: !canViewSongs && !canViewAgendas && irgendeinRecht(data),
  };
}

/**
 * Ist in der Rechte-Antwort **irgendein** Recht gesetzt (`true` oder eine nicht leere Liste)? Dann ist
 * sie echt – auch wenn Lieder und Abläufe fehlen (#444). ChurchTools liefert für jeden Nutzer alle
 * Module mit allen Schlüsseln, leer als `false`/`[]` (gemessen 08.10.2026 an einer Testperson); eine
 * Antwort, in der gar nichts gesetzt ist, ist der Aussetzer aus #99.
 */
export function irgendeinRecht(data: Record<string, Record<string, unknown>>): boolean {
  return Object.values(data).some(
    (modul) =>
      !!modul &&
      typeof modul === 'object' &&
      Object.values(modul).some((v) => (Array.isArray(v) ? v.length > 0 : v === true)),
  );
}
