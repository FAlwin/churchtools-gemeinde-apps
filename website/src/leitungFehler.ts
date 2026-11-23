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
