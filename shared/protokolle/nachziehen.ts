/**
 * **Ein To-Do aus dem Fenster im Protokoll-Entwurf nachziehen** (Bauplan S7-2b, entschieden 30.10.2026). Im Entwurf führt
 * das Protokoll (`aufgabenAbgleich`): Was im Fenster an Text, Gruppe oder Löschen geändert wird, muss deshalb auch im
 * Dokument stehen – sonst dreht das nächste Speichern es zurück (eine stehengebliebene Aufgabe holt ihr gelöschtes
 * To-Do wieder).
 * - **Text** → der Text der Aufgabe wird ersetzt;
 * - **Löschen** → die Aufgabe kommt ganz raus (wie Löschen im Editor);
 * - **Gruppe gewechselt** → die Aufgabe wird ein Absatz „… – an „Jugend“ abgegeben“; das To-Do lebt dort weiter.
 *
 * Unterpunkte einer Aufgabe bleiben in jedem Fall erhalten (beim Herausnehmen rücken sie an ihre Stelle). Rein, ohne
 * ChurchTools – geschrieben wird über den normalen Speicherweg (`protokolle/src/nachziehen.ts`).
 */
import { BLOCK, type Block } from './dokument';

export type Nachziehen =
  | { art: 'text'; text: string }
  | { art: 'raus' }
  | { art: 'abgegeben'; text: string; gruppe: string };

const textStueck = (text: string) => [{ type: 'text', text, styles: {} }];

/** Der Absatz, der von einer abgegebenen Aufgabe bleibt. */
export function abgegebenText(text: string, gruppe: string): string {
  return `${text.trim()} – an „${gruppe}“ abgegeben`;
}

/**
 * Die Aufgabe mit `props.aufgabe === aufgabe` (auch in Unterpunkten, jede Fundstelle) ändern. `gefunden: false` →
 * Dokument unverändert (die Aufgabe steht nicht mehr im Entwurf – dann gibt es nichts nachzuziehen).
 */
export function aufgabeNachziehen(
  dokument: readonly Block[],
  aufgabe: string,
  n: Nachziehen,
): { dokument: Block[]; gefunden: boolean } {
  let gefunden = false;
  const liste = (bloecke: readonly Block[]): Block[] =>
    bloecke.flatMap((b): Block[] => {
      const kinder = liste(b.children ?? []);
      if (b.type !== BLOCK.aufgabe || b.props?.aufgabe !== aufgabe)
        return [{ ...b, children: kinder }];
      gefunden = true;
      if (n.art === 'raus') return kinder;
      if (n.art === 'text') return [{ ...b, content: textStueck(n.text.trim()), children: kinder }];
      return [
        {
          id: b.id,
          type: 'paragraph',
          content: textStueck(abgegebenText(n.text, n.gruppe)),
          children: kinder,
        },
      ];
    });
  const neu = liste(dokument);
  return { dokument: gefunden ? neu : [...dokument], gefunden };
}
