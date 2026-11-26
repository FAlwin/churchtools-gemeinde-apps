import type { SpeicherGrund } from '@shared/ct/versionierterWert';
import { PLANER_GRUPPENRECHTE } from '@shared/dienstplan/abfrageAutomatik';
import type { VerfuegbarkeitArt } from '@shared/dienstplan/abfragen';

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
 * Der leise Hinweis zu den automatischen Erinnerungen – **die eine Stelle dafür** (Start-Dialog, Stand, Einstellungen). Eingerichtet
 * verschickt ChurchTools die Erinnerungen selbst (Routine, R-5b); sonst bleibt „Erinnern“ per Hand.
 */
export const automatikHinweis = (gruppe: string, eingerichtet: boolean) =>
  eingerichtet
    ? 'Erinnerungen verschickt ChurchTools gegen 0:15 Uhr an alle, die dann noch offen sind.'
    : `Automatische Erinnerungen sind für ${gruppe} noch nicht eingerichtet – bis dahin per „Erinnern“.`;

/** Im Stand: wer noch in der Hilfsgruppe steht, bekommt noch Erinnerungen. */
export const bekommenErinnerungenText = (n: number): string =>
  n === 0
    ? 'Niemand bekommt noch Erinnerungen.'
    : n === 1
      ? '1 Person bekommt noch Erinnerungen.'
      : `${n} Personen bekommen noch Erinnerungen.`;

/** Der Abgleich beim Öffnen des Stands: wer ausgetragen wurde, weil er inzwischen nicht mehr offen ist. */
export const abgleichText = (n: number): string =>
  n === 1
    ? '1 Person ausgetragen, die inzwischen geantwortet hat.'
    : `${n} Personen ausgetragen, die inzwischen geantwortet haben.`;

/**
 * Die zwei Arten, die Verfügbarkeit zu fragen (V-2) – Wortlaut aus dem abgenommenen Entwurf
 * `verfuegbarkeit-einstellungen-v4.html`. Anders als der Plan gilt die Art sofort.
 */
export const VERFUEGBARKEIT_TITEL = 'Verfügbarkeit fragen';
export const VERFUEGBARKEIT_WAHL: { wert: VerfuegbarkeitArt; label: string; erklaerung: string }[] =
  [
    {
      wert: 'zusagen',
      label: 'Ja · Vielleicht · Nein',
      erklaerung:
        'Jede Person sagt je Termin zu, vielleicht oder ab. Die Planer sehen „Ja“ und „Vielleicht“ beim Einteilen.',
    },
    {
      wert: 'abwesend',
      label: 'Nur abwesend',
      erklaerung:
        'Jede Person hakt nur an, wann sie nicht kann. Alle anderen Termine gelten als „kann“.',
    },
  ];

/** Im Einstellungen-Abschnitt, solange für die Gruppe eine Abfrage läuft. */
export const PLAN_GILT_AB_NAECHSTER =
  'Eine Abfrage läuft gerade – Änderungen am Plan gelten erst für die nächste.';

/** Was die Einrichtung in ChurchTools anlegt und warum – für „Was ist das?“ (Kasten) und das Einrichten-Fenster. */
export const EINRICHTEN_WARUM =
  'Damit Erinnerungen auch dann rausgehen, wenn niemand den Dienstplaner öffnet, legt der Dienstplaner in ChurchTools eine Hilfsgruppe mit einer Routine an.';

/** Die Hilfsgruppe in einem Satz: was drinsteht und was Mitarbeitende davon sehen. */
export const EINRICHTEN_GRUPPE =
  'Darin steht nur, wem in einer laufenden Abfrage noch Antworten fehlen. Der Dienstplaner trägt Personen ein und wieder aus. Mitarbeitende sehen die Gruppe in ChurchTools unter „Meine Gruppen“ und können dort austreten – dann bekommen sie keine Erinnerungen mehr.';

/** Die Routine in einem Satz. */
export const EINRICHTEN_ROUTINE =
  'ChurchTools führt sie selbst aus, auch wenn niemand den Dienstplaner öffnet. Wer aus der Gruppe ausgetragen wird, bekommt ab sofort nichts mehr.';

/**
 * Was die Planer in ChurchTools bekommen – **die zwei Rechte, genau so benannt wie dort**, nur für diese Gruppe. Kein Leiter:
 * Sie sind normale Teilnehmer und werden erinnert wie alle.
 */
export const EINRICHTEN_RECHTE = `Damit Planer die Mitglieder und die Routine der Gruppe ändern dürfen, bekommen sie in ChurchTools zwei Rechte – nur für diese Gruppe: „${PLANER_GRUPPENRECHTE[0].name}“ und „${PLANER_GRUPPENRECHTE[1].name}“. Sie werden dadurch nicht Leiter, sondern bleiben normale Teilnehmer und werden erinnert wie alle.`;

/** Der Schlusssatz: alles ist ansehbar, und was passiert, wenn man es entfernt. */
export const EINRICHTEN_ANSEHEN =
  'Alles lässt sich in ChurchTools ansehen. Entfernt man die Gruppe dort, gibt es keine automatischen Erinnerungen mehr – Abfragen und „Erinnern“ per Hand gehen trotzdem.';
