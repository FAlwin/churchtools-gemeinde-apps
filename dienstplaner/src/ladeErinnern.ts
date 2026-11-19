/**
 * **Der Anschluss von „Erinnern“ an ChurchTools** (E5c-5): `POST /events/send` (Mail zu Terminen, Absender = der
 * angemeldete Planer) und die volle Adresse des Knopfs in der Mail. Was beim Verschicken mit den Antworten geschieht,
 * steht in `erinnernSenden.ts`.
 */
import { ctAnfrage, ctBasis } from '@ui/ct/verbindung';
import { erweiterungsLink } from '@ui/erweiterung/kuerzel';
import type { ErinnernAnschluss } from './ErinnernFenster';
import type { MailSender } from './erinnernSenden';
import { adresseFuer } from './reiter';
import { MODUL_KUERZEL } from './start';

/** Verschickt einen Auftrag – wirft bei jedem Fehler (`ApiError`, Netz), liefert sonst den Rumpf der Antwort. */
export const ctMailSenden: MailSender = (auftrag) =>
  ctAnfrage('/events/send', {
    method: 'POST',
    body: JSON.stringify(auftrag),
    verweigert: 'ChurchTools erlaubt dir nicht, Mails zu Terminen zu schicken.',
  });

/** „Wann kann ich?“ – die Seite, auf die der Knopf in der Mail führt (Instanz + `/ccm/<Kürzel>/#/abwesenheiten`). */
export const erinnernLink = (): string =>
  erweiterungsLink(ctBasis(), MODUL_KUERZEL, adresseFuer('abwesenheiten'));

export const ERINNERN: ErinnernAnschluss = { senden: ctMailSenden, link: erinnernLink };
