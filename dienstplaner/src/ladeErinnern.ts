/**
 * **Der Anschluss von „Erinnern“ an ChurchTools** (E5c-5): `POST /events/send` (Mail zu Terminen, Absender = der
 * angemeldete Planer) und die volle Adresse des Knopfs in der Mail. Was beim Verschicken mit den Antworten geschieht,
 * steht in `erinnernSenden.ts`.
 */
import { ctAnfrage, ctBasis } from '@ui/ct/verbindung';
import { erweiterungsLink } from '@ui/erweiterung/kuerzel';
import type { ErinnernAnschluss } from './ErinnernFenster';
import type { MailSender } from './erinnernSenden';
import { adresseFuer, adresseFuerAbwesenheitenAbfrage } from './reiter';
import { MODUL_KUERZEL } from './start';

/** Verschickt einen Auftrag – wirft bei jedem Fehler (`ApiError`, Netz), liefert sonst den Rumpf der Antwort. */
export const ctMailSenden: MailSender = (auftrag) =>
  ctAnfrage('/events/send', {
    method: 'POST',
    body: JSON.stringify(auftrag),
    verweigert: 'ChurchTools erlaubt dir nicht, Mails zu Terminen zu schicken.',
  });

/** „Verfügbarkeit“ – die Seite, auf die der Knopf in der Mail führt (Instanz + `/ccm/<Kürzel>/#/abwesenheiten`). */
export const erinnernLink = (): string =>
  erweiterungsLink(ctBasis(), MODUL_KUERZEL, adresseFuer('abwesenheiten'));

/** „Verfügbarkeit“ mit der Abfrage der Dienstgruppe – der Knopf in der Erinnerungs-Mail (`mailFuer`, R-4). */
export const abfrageLink = (dienstgruppeId: number): string =>
  erweiterungsLink(ctBasis(), MODUL_KUERZEL, adresseFuerAbwesenheitenAbfrage(dienstgruppeId));

export const ERINNERN: ErinnernAnschluss = { senden: ctMailSenden, link: erinnernLink };
