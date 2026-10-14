import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { WER_TEXT } from './anzeige';

/**
 * **„Woher kommt das?“** – die Texte hinter dem kleinen ⓘ im Formular-Baukasten (Alwin, 14.10.2026: „nicht ganz
 * klar, was woher kommt und was warum Pflicht ist“; Entwurf v5). Schlüssel sind Feld-IDs oder die Bereiche
 * „teil“ und „preis“. `null`, wo es nichts zu erklären gibt – dort steht auch kein ⓘ.
 */
export function hinweisZu(wo: string, wer: OeffentlicheEinstellungen['wer']): string | null {
  switch (wo) {
    case 'name':
      return 'Pflicht: ChurchTools braucht den Namen, um die Anmeldung anzulegen – es sucht die Person oder legt sie neu an.';
    case 'mail':
      return 'Pflicht: An diese Adresse schickt ChurchTools die Bestätigung. Wer schon bekannt ist, bestätigt einmal.';
    case 'pname':
      return 'Pflicht: Jede Person wird in ChurchTools einzeln als Teilnehmer eingetragen – dafür braucht es ihren Namen.';
    case 'birth':
      return 'Kommt aus „Geburtsdatum abfragen“ unter „Wer meldet sich an?“ (Leiste rechts oder Reiter Veranstaltung). Preise nach Alter und der Geschwister-Rabatt brauchen es.';
    case 'priv':
      return 'Pflicht: Ohne Einwilligung dürfen die Angaben nicht gespeichert werden (Datenschutz). Steht immer direkt vor dem Absenden.';
    case 'kontakt':
      return 'Alles in diesem Kasten gibt es einmal je Anmeldung: wer anmeldet und wie das Team diese Person erreicht. Ein neuer Baustein gehört hierher, wenn die Frage nur einmal gestellt werden soll.';
    case 'preis':
      return 'Kommt aus den Preisen der Veranstaltung (Reiter Veranstaltung → Preise) und erscheint nur, wenn es eine Auswahl oder Extras gibt. Steht immer direkt vor dem Absenden.';
    case 'teil': {
      const woher = `Dieser Bereich kommt aus „Wer meldet sich an?“ (hier: ${WER_TEXT[wer][0]}) – rechts in der Leiste oder im Reiter Veranstaltung.`;
      if (wer === 'einzeln')
        return `${woher} Jede Person meldet sich selbst an, deshalb gibt es kein „+ Weitere Person“.`;
      return `${woher} Der graue Teil wiederholt sich für ${wer === 'kinder' ? 'jedes Kind' : 'jede Person'} – Fragen darin werden je ${wer === 'kinder' ? 'Kind' : 'Person'} gestellt. „+ ${wer === 'kinder' ? 'Weiteres Kind' : 'Weitere Person'}“ gehört dazu.`;
    }
    default:
      return null;
  }
}
