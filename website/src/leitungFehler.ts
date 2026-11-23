import { ApiError } from '@ui/ct/fehler';

/**
 * Die Rechte sind gesetzt und nachgelesen, aber **welche Rollen die Leitung sind, ließ sich nicht festhalten** (W3b-3). Eine
 * eigene Klasse, damit die Oberfläche nicht „Noch nicht gesetzt“ sagt: gesetzt ist es. Ein zweites „Rechte setzen“ holt das
 * Festhalten nach (es ändert sonst nichts).
 */
export class LeitungNichtFestgehalten extends ApiError {
  constructor() {
    super(
      422,
      'Die Rechte sind gesetzt. ChurchTools hat aber nicht festgehalten, welche Rollen die Leitung sind – die Mails im Freigabe-Weg gehen dann an die Rollen mit Leiter-Kennzeichen. „Rechte setzen“ noch einmal versucht es erneut.',
    );
    this.name = 'LeitungNichtFestgehalten';
  }
}

/**
 * Die Untergruppe ist eingerichtet (Kategorie + Rechte ihrer Rollen nachgelesen), aber **die Rollen der Website ließen sich
 * noch nicht nachziehen** (W3b-4a) – sie lesen bzw. schreiben die neue Kategorie also noch nicht. Eigene Klasse aus demselben
 * Grund wie oben: Gesetzt ist schon etwas, „Noch nicht gesetzt“ wäre falsch. Ein zweiter Versuch holt den Rest nach.
 */
export class WebsiteNichtNachgezogen extends ApiError {
  constructor(untergruppe: string) {
    super(
      422,
      `Die Untergruppe „${untergruppe}“ ist eingerichtet. Die Rollen der Website haben ihre Rechte daran aber noch nicht bekommen – „Rechte setzen“ bei der Untergruppe noch einmal versucht es erneut.`,
    );
    this.name = 'WebsiteNichtNachgezogen';
  }
}
