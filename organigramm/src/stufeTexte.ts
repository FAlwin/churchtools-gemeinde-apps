/**
 * **Wie die Stufen für Personen ohne Leitung heißen** (#915 Scheibe C, entschieden 12.11.2026) – EINE Stelle für das
 * Fenster „Einstellungen“ und den Hinweis über dem Baum. Die Regel selbst steht in `@shared/organigramm/personen`
 * (`mitNamen`).
 */
import type { PersonenStufe } from '@shared/organigramm/personen';

export const STUFE_WAHL: { value: PersonenStufe; label: string; erklaerung: string }[] = [
  {
    value: 'alle',
    label: 'Alle Namen',
    erklaerung: 'Wie bisher – alle sehen die Namen, so weit ChurchTools sie zeigt.',
  },
  {
    value: 'rollen',
    label: 'Wie „Rollen“',
    erklaerung:
      'Namen nur in den besonderen Rollen (Leitung, Organisator …); Mitarbeiter und Teilnehmer nur als Zahl.',
  },
  {
    value: 'zahl',
    label: 'Nur Zahlen',
    erklaerung: 'Keine Namen, auch nicht die der Leitung – z. B. „1 Leiter, 6 Mitarbeiter“.',
  },
  {
    value: 'aus',
    label: 'Keine Personen',
    erklaerung:
      'In Kästchen, Listen und im Gruppenfenster keine Personen; die Leitung steht nur als Zahl.',
  },
];

/** Was über dem Baum unter „Für alle ausgeblendet“ dazukommt – `null` bei allen Namen. */
export function stufeBand(stufe: PersonenStufe): string | null {
  switch (stufe) {
    case 'alle':
      return null;
    case 'rollen':
      return 'die Namen von Mitarbeitern und Teilnehmern';
    case 'zahl':
      return 'die Namen von Personen';
    case 'aus':
      return 'die Personen';
  }
}
