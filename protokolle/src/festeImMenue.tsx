import type { DefaultReactSuggestionItem } from '@blocknote/react';
import { Icon } from '@ui/icons/icons';
import { FESTE_PUNKTE } from './anzeige';
import type { ProtokollEditor } from './editorSchema';
import { FESTE } from './festenPunktEinfuegen';
import type { FestePunkteWert } from './festePunkteKontext';
import { festenPunktAnbieten } from './fruehesProtokoll';

/**
 * Die festen Punkte im „/“-Menü – wie in der Leiste über `festenPunktAnbieten`: „Früheres Protokoll“ fragt, welches
 * (K3b-2). Herausgezogen, damit es ohne den ganzen Editor prüfbar ist.
 */
export function festeImMenue(
  editor: ProtokollEditor,
  feste: FestePunkteWert | null,
): DefaultReactSuggestionItem[] {
  return FESTE.map((f) => ({
    title: FESTE_PUNKTE[f.art].menue,
    subtext: FESTE_PUNKTE[f.art].hinweis,
    aliases: [...FESTE_ALIASE[f.art]],
    group: 'Feste Punkte',
    icon: <Icon name={f.icon} size={18} />,
    onItemClick: () => festenPunktAnbieten(editor, f.art, feste),
  }));
}

const FESTE_ALIASE = {
  'offene-aufgaben': ['offen', 'todos', 'to-dos', 'fest'],
  'letztes-protokoll': ['letztes', 'protokoll', 'fest', 'früher', 'frueher'],
  anwesenheit: ['anwesend', 'anwesenheit', 'teilnehmer', 'fest'],
} as const;
