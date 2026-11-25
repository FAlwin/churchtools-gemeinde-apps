import type { SpeicherGrund } from '@shared/ct/versionierterWert';

/** Hinweis, wenn der gespeicherte Wert nicht lesbar ist – er stammt dann womöglich aus einer neueren Fassung: nie überschreiben. */
export const ABFRAGE_UNLESBAR =
  'Die Abfrage wurde mit einer neueren Version des Dienstplaners gespeichert – bitte neu laden.';

/** Was im Fenster „Abfrage“ steht, wenn Lesen oder Speichern scheitert. */
export function abfragenFehlerText(grund: SpeicherGrund, lesen: boolean): string {
  switch (grund) {
    case 'konflikt':
      return 'Ein anderer hat die Abfrage gerade geändert – nichts überschrieben.';
    case 'abgemeldet':
      return 'Nicht mehr bei ChurchTools angemeldet – Seite neu laden.';
    case 'kein-recht':
      return 'ChurchTools erlaubt dir das nicht. Dafür braucht es in ChurchTools die Rechte für die Kategorie „Einstellungen“ des Dienstplaners.';
    case 'voruebergehend':
      return lesen
        ? 'ChurchTools antwortet gerade nicht – die Abfrage konnte nicht gelesen werden.'
        : 'ChurchTools antwortet gerade nicht – nicht gespeichert. Bitte gleich noch einmal.';
    case 'nicht-angekommen':
      return 'ChurchTools hat es angenommen, nachgelesen steht aber der alte Stand da. Bitte neu lesen und prüfen.';
    case 'zu-gross':
      return 'Das ist zu groß für einen Wert in ChurchTools.';
  }
}

/**
 * Der leise Hinweis zu den automatischen Erinnerungen – **die eine Stelle dafür** (Start-Dialog, Stand, Einstellungen). Ehrlich
 * statt versprochen: Auch eingerichtet (R-5a) verschickt der Start einer Abfrage noch nichts selbst – das kommt mit R-5b; dann
 * entfällt die zweite Fassung.
 */
export const automatikHinweis = (gruppe: string, eingerichtet: boolean) =>
  eingerichtet
    ? `Die Erinnerungen für ${gruppe} sind in ChurchTools eingerichtet. Der Start einer Abfrage verschickt aber noch nichts selbst – bis dahin per „Erinnern“.`
    : `Automatische Erinnerungen sind für ${gruppe} noch nicht eingerichtet – bis dahin per „Erinnern“.`;

/** Was die Einrichtung in ChurchTools anlegt und warum – für „Was ist das?“ (Kasten) und das Einrichten-Fenster. */
export const EINRICHTEN_WARUM =
  'Damit Erinnerungen auch dann rausgehen, wenn niemand den Dienstplaner öffnet, legt der Dienstplaner in ChurchTools eine Hilfsgruppe mit einer Routine an.';

/** Die Hilfsgruppe in einem Satz: was drinsteht und was Mitarbeitende davon sehen. */
export const EINRICHTEN_GRUPPE =
  'Darin steht nur, wem in einer laufenden Abfrage noch Antworten fehlen. Der Dienstplaner trägt Personen ein und wieder aus. Mitarbeitende sehen die Gruppe in ChurchTools unter „Meine Gruppen“ und können dort austreten – dann bekommen sie keine Erinnerungen mehr.';

/** Die Routine in einem Satz. */
export const EINRICHTEN_ROUTINE =
  'ChurchTools führt sie selbst aus, auch wenn niemand den Dienstplaner öffnet. Wer aus der Gruppe ausgetragen wird, bekommt ab sofort nichts mehr.';

/** Warum die Planer Leiter werden. */
export const EINRICHTEN_LEITER =
  'Nur Leiter dürfen in ChurchTools die Mitglieder und die Routine der Gruppe ändern.';

/** Der Schlusssatz: alles ist ansehbar, und was passiert, wenn man es entfernt. */
export const EINRICHTEN_ANSEHEN =
  'Alles lässt sich in ChurchTools ansehen. Entfernt man die Gruppe dort, gibt es keine automatischen Erinnerungen mehr – Abfragen und „Erinnern“ per Hand gehen trotzdem.';
