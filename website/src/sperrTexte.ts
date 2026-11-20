/**
 * **Die Worte rund um „eine Person bearbeitet, die anderen sehen zu“** – je Gegenstand (Seite, Aussehen). Der Ablauf selbst
 * (`useSperrarbeit`) und die Bänder (`SperrBaender`) sind für alle gleich; nur die Wörter sind es nicht.
 */
import type { Sperre } from '@shared/ct/sperre';

export interface SperrTexte {
  /** Der gespeicherte Gegenstand ist verschwunden (nach dem Nehmen der Sperre gelesen). */
  weg: string;
  /** Jemand hat ihn inzwischen geändert – er wurde neu geladen. */
  neuGeladen: string;
  /** „Gerade bearbeitet von …“ – oder: ein anderes Fenster von dir (`verdraengt`: es hat uns die Sperre abgenommen). */
  fremd: (s: Sperre, ichPerson: number, verdraengt: boolean) => string;
  /** Band, wenn das Speichern abgewiesen wurde, weil jemand anderes inzwischen geändert hat. */
  veraendert: string;
}

export const SEITEN_TEXTE: SperrTexte = {
  weg: 'Diese Seite gibt es nicht mehr. Bitte lade die Seitenliste neu.',
  neuGeladen:
    'Die Seite wurde inzwischen von jemand anderem geändert und ist neu geladen. Bitte versuche es noch einmal.',
  fremd: (s, ichPerson, verdraengt) => {
    if (verdraengt)
      return `Ein anderes Fenster${s.von === ichPerson ? ' von dir' : ` (${s.name})`} hat die Bearbeitung übernommen. Hier wird nichts mehr gespeichert; was du hier noch getippt hast, bleibt nur hier sichtbar.`;
    return s.von === ichPerson
      ? 'Diese Seite ist gerade in einem anderen Fenster von dir geöffnet und wird dort bearbeitet (oder war es beim Neuladen). Du kannst sie hier ansehen.'
      : `Gerade bearbeitet von ${s.name}. Du kannst die Seite ansehen – ändern kannst du sie, sobald ${s.name} fertig ist.`;
  },
  veraendert:
    'Die Seite wurde inzwischen von jemand anderem geändert. Deine Änderungen sind noch nicht gespeichert – sonst gingen seine verloren.',
};

export const AUSSEHEN_TEXTE: SperrTexte = {
  weg: 'Die Einstellungen lassen sich gerade nicht lesen. Bitte lade die Seite neu.',
  neuGeladen:
    'Das Aussehen wurde inzwischen von jemand anderem geändert und ist neu geladen. Bitte versuche es noch einmal.',
  fremd: (s, ichPerson, verdraengt) => {
    if (verdraengt)
      return `Ein anderes Fenster${s.von === ichPerson ? ' von dir' : ` (${s.name})`} hat die Bearbeitung übernommen. Hier wird nichts mehr gespeichert; was du hier noch eingestellt hast, bleibt nur hier sichtbar.`;
    return s.von === ichPerson
      ? 'Das Aussehen ist gerade in einem anderen Fenster von dir geöffnet und wird dort bearbeitet (oder war es beim Neuladen). Du kannst es hier ansehen.'
      : `Das Aussehen bearbeitet gerade ${s.name}. Du kannst es ansehen – ändern kannst du es, sobald ${s.name} fertig ist.`;
  },
  veraendert:
    'Das Aussehen wurde inzwischen von jemand anderem geändert. Deine Änderungen sind noch nicht gespeichert – sonst gingen seine verloren.',
};
