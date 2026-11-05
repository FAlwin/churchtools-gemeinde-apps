import { tagPunkt } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import { textAus, type Block, type VerweisArt } from '@shared/protokolle/dokument';
import {
  festesProtokollAus,
  festesProtokollWert,
  fruehererTitel,
  istFruehererTitel,
} from '@shared/protokolle/festePunkte';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { ProtokollEditor } from './editorSchema';
import { festenPunktEinfuegen } from './festenPunktEinfuegen';
import type { FestePunkteWert } from './festePunkteKontext';

/**
 * **Ein früheres Protokoll einfügen oder ändern** (Bauplan K3b-2, Entwurf `k3b-v1`) – die eine Stelle für „Einfügen ▾“,
 * das „/“-Menü und „Ändern“ am Kasten. Die Wahl steht gleich in `props.fest` (wie sonst bei der Freigabe), der Titel
 * darüber heißt „Protokoll der letzten Sitzung“ oder „Protokoll vom 09.09.2026“.
 */

/** Titel und `fest` für die Wahl `s`. */
export function fruehererPunkt(w: FestePunkteWert, s: Sitzung): { titel: string; fest: string } {
  const id = s.kopf?.sitzung ?? '';
  return {
    titel: fruehererTitel(
      id,
      w.letztes?.kopf?.sitzung ?? null,
      tagPunkt(tagAusIso(s.beginn, w.zeitzone)),
    ),
    fest: festesProtokollWert(id),
  };
}

/**
 * „Früheres Protokoll“ einfügen: das Fenster fragt, welches. Gibt es noch keins (oder keinen Rahmen), kommt der Kasten
 * wie bisher – er zeigt dann live das letzte Protokoll („Keine frühere Sitzung mit Protokoll.“).
 */
export function fruehesEinfuegen(editor: ProtokollEditor, w: FestePunkteWert | null): void {
  if (!w?.waehlen || !w.fruehere.length) {
    festenPunktEinfuegen(editor, 'letztes-protokoll');
    return;
  }
  w.waehlen(
    {
      titel: 'Früheres Protokoll einfügen',
      knopf: 'Einfügen',
      vorgewaehlt: w.letztes?.kopf?.sitzung ?? null,
    },
    (s) => festenPunktEinfuegen(editor, 'letztes-protokoll', fruehererPunkt(w, s)),
  );
}

/**
 * „Ändern“ am Kasten: ein anderes Protokoll wählen. Der Titel darüber zieht nur mit, wenn er einer der
 * selbstgesetzten ist – einen eigenen Titel lässt er stehen.
 */
export function fruehesAendern(editor: ProtokollEditor, blockId: string, w: FestePunkteWert): void {
  const block = editor.getBlock(blockId);
  if (!block || !w.waehlen) return;
  const jetzt = festesProtokollAus((block.props as { fest?: unknown }).fest)?.sitzung;
  w.waehlen(
    {
      titel: 'Anderes Protokoll wählen',
      knopf: 'Übernehmen',
      vorgewaehlt: jetzt ?? w.letztes?.kopf?.sitzung ?? null,
    },
    (s) => {
      const p = fruehererPunkt(w, s);
      editor.transact(() => {
        editor.updateBlock(blockId, { props: { fest: p.fest } });
        const davor = editor.getPrevBlock(blockId);
        if (
          davor?.type === 'heading' &&
          istFruehererTitel(textAus((davor as Block).content).trim())
        )
          editor.updateBlock(davor, { content: p.titel });
      });
    },
  );
}

/** Einen festen Punkt einfügen, wie Leiste und „/“-Menü ihn anbieten – beim früheren Protokoll mit Auswahl. */
export function festenPunktAnbieten(
  editor: ProtokollEditor,
  art: VerweisArt,
  w: FestePunkteWert | null,
): void {
  if (art === 'letztes-protokoll') fruehesEinfuegen(editor, w);
  else festenPunktEinfuegen(editor, art);
}
