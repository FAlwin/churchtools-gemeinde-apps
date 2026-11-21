import { cloneElement, type ReactElement, type ReactNode } from 'react';
import { TableHandlesExtension } from '@blocknote/core/extensions';
import {
  TableHandle,
  TableHandleMenu,
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
  type TableHandleMenuProps,
  type TableHandleProps,
} from '@blocknote/react';
import { tabellenZeilen } from '@shared/protokolle/dokument';
import { zeilenArten, type ZeilenArt } from '@shared/protokolle/tabellenZeile';
import type { ProtokollEditor } from './editorSchema';
import { zeileUmschalten } from './tabellenZeile';

/**
 * **Das Zeilenmenü der Tabelle mit „Nur zur Info“ und „Als Unterzeile“** (W13, Alwin 21.11.2026). BlockNote kennt für die
 * Griffe der Tabelle ein eigenes Menü (`TableHandle` → `tableHandleMenu`); wir behalten alle seine Einträge (Löschen,
 * Einfügen, Kopfzeile, Farben) und hängen die beiden unten an – nur am **Zeilen**griff, nicht an dem der Spalten.
 *
 * Warum so und nicht ein eigenes Menü: die Einträge „Farben“ und „Kopfzeile“ des Standardmenüs sind nicht exportiert; sie
 * nachzubauen hieße, W11 (Zellfarben) ein zweites Mal zu schreiben. Das Standardmenü liefert ein `Dropdown` mit seinen
 * Einträgen als Kinder – wir geben ihm unsere dazu (`cloneElement`). Ändert ein BlockNote-Update das Menü, fehlen die
 * Einträge sichtbar (beim Durchklicken im Browser geprüft; jsdom kann das Mantine-Menü nicht öffnen).
 */

/** Ein Eintrag mit Haken, wenn das Kennzeichen an der Zeile gesetzt ist. */
function Eintrag({ welches, children }: { welches: keyof ZeilenArt; children: ReactNode }) {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor() as unknown as ProtokollEditor;
  const { id, zeile } = useExtensionState(TableHandlesExtension, {
    selector: (s) => ({ id: s?.block.id, zeile: s?.rowIndex }),
  });
  if (id === undefined || zeile === undefined) return null;
  // Frisch aus dem Dokument gelesen – der Zustand des Griffs kann einen Anschlag hinterherhinken.
  const zeilen = tabellenZeilen(editor.getBlock(id)?.content);
  const gesetzt = !!zeilen && zeilenArten(zeilen)[zeile]?.[welches];
  return (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      checked={gesetzt}
      onClick={() => {
        zeileUmschalten(editor, id, zeile, welches);
      }}
    >
      {children}
    </Components.Generic.Menu.Item>
  );
}

/** BlockNotes Zeilenmenü plus unsere beiden Einträge. */
export function ZeilenMenue(props: TableHandleMenuProps) {
  const standard: ReactElement<{ children?: ReactNode }> = TableHandleMenu({
    orientation: props.orientation,
  });
  return cloneElement(
    standard,
    undefined,
    standard.props.children,
    <Eintrag key="info" welches="info">
      Nur zur Info
    </Eintrag>,
    <Eintrag key="unter" welches="unter">
      Als Unterzeile
    </Eintrag>,
  );
}

/** BlockNote reicht dem Menü keine Eigenschaften mit (Typ `FC`) – der Zeilengriff weiß selbst, dass er einer ist. */
const MenueDerZeile = () => <ZeilenMenue orientation="row" />;

/** Der Griff der Tabelle: am Zeilengriff unser Menü, am Spaltengriff das von BlockNote. */
export function TabellenGriff(props: TableHandleProps) {
  return (
    <TableHandle
      {...props}
      tableHandleMenu={props.orientation === 'row' ? MenueDerZeile : undefined}
    />
  );
}
