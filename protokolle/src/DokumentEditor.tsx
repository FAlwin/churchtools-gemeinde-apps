import {
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from 'react';
import { insertOrUpdateBlockForSlashMenu, type PartialBlock } from '@blocknote/core';
import { filterSuggestionItems } from '@blocknote/core/extensions';
import { SideMenuExtension } from '@blocknote/core/extensions';
import { de } from '@blocknote/core/locales';
import {
  AddBlockButton,
  DragHandleButton,
  DragHandleMenu,
  getDefaultReactSlashMenuItems,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  useBlockNoteEditor,
  useCreateBlockNote,
  useExtensionState,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import type { Block } from '@shared/protokolle/dokument';
import { bloeckeEinfuegen } from './bloeckeEinfuegen';
import { Icon } from '@ui/icons/icons';
import { useThema } from '@ui/design/useThema';
import { aufgabenIdsSetzen, schema, TABELLEN, type ProtokollEditor } from './editorSchema';
import { blockInhalt, griffVersatz } from './griffLage';
import { FestePunkteKontext } from './festePunkteKontext';
import { festeImMenue } from './festeImMenue';
import { tabelleEinfuegen } from './tabelleEinfuegen';
import { hatGriff, nurDieseZeile } from './zeilenGriff';
import { EIGENE, Werkzeugleiste } from './Werkzeugleiste';
import { istWordHtml, wordListenUmbauen } from './wordListen';
import './DokumentEditor.scss';
import styles from './ProtokollSchreiben.module.scss';

/**
 * **Das Protokoll als Dokument bearbeiten** (Bauplan S4-1, Entwurf 7) – BlockNote mit unserem Schema, der festen
 * Werkzeugleiste, dem „/“-Menü und Griffen zum Verschieben. Speichern und Sperre regelt der Bildschirm darüber
 * (`ProtokollSchreiben`); hier wird nur gemeldet, dass sich der Text geändert hat.
 *
 * - **Normaler Text hat keinen Griff** (Alwin 22.10.2026): Verschieben im Text gibt es für Listen, Zitate und die
 *   eigenen Blöcke – ein Absatz ist einfach Text. **Überschriften haben seit W7 keinen Griff:** Tagesordnungspunkte und
 *   Unterpunkte stellt man im Fenster „Punkte ordnen“ um (Werkzeugleiste, `PunkteOrdnen.tsx`).
 * - Das Griff-Menü kennt „Löschen“ und an Tabellen Kopfzeile/Kopfspalte (K3a). Blockfarben bietet es nicht an – markiert
 *   wird Text, über die Leiste („Markieren ▾“).
 * - **Einfügen aus Word**: Listen werden vorher zu echten Listen (`wordListen.ts`).
 */

type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

/** Deutsche Texte von BlockNote, an wenigen Stellen auf unsere Wörter gebracht. */
const TEXTE = {
  ...de,
  placeholders: {
    ...de.placeholders,
    default: 'Schreiben – „/“ für Tagesordnungspunkt, Liste, Zitat …',
    heading: 'Überschrift',
  },
  slash_menu: {
    ...de.slash_menu,
    heading: {
      ...de.slash_menu.heading,
      title: 'Tagesordnungspunkt',
      subtext: 'Überschrift 1 – wird nummeriert',
    },
    // Stufe 2 und 3 heißen seit K3a wie in der Leiste (Alwin 04.11.2026).
    heading_2: { ...de.slash_menu.heading_2, title: 'Unterpunkt', subtext: 'Überschrift 2' },
    heading_3: { ...de.slash_menu.heading_3, title: 'Überschrift', subtext: 'Überschrift 3' },
    paragraph: { ...de.slash_menu.paragraph, title: 'Text', subtext: 'Normaler Text' },
    bullet_list: { ...de.slash_menu.bullet_list, title: 'Aufzählung' },
    numbered_list: { ...de.slash_menu.numbered_list, title: 'Nummerierung' },
  },
};

/**
 * Was das „/“-Menü von BlockNote übernimmt – die Blockarten aus `editorSchema`, nichts sonst. Ohne Checkliste (seit K3a
 * nur noch To-Do) und ohne BlockNotes Tabelle: Die kommt mit Kopfzeile aus `tabelleEinfuegen`, wie in der Leiste.
 */
const MENUE = new Set(
  (
    [
      'paragraph',
      'heading',
      'heading_2',
      'heading_3',
      'bullet_list',
      'numbered_list',
      'quote',
      'divider',
    ] as const
  ).map((k) => TEXTE.slash_menu[k].title),
);

const EIGENE_TEXT = {
  aufgabe: 'To-Do mit Wer und Bis – erscheint gleich bei den Zuständigen',
  beschluss: 'Erscheint unter „Beschlüsse“',
  termin: 'Mit Datum – erscheint unter „Termine“',
} as const;
const EIGENE_ALIASE = {
  aufgabe: ['todo', 'to-do', 'aufgabe', 'aufgaben'],
  beschluss: ['beschluss', 'entscheidung'],
  termin: ['termin', 'datum'],
} as const;

/**
 * Der Griff steht oben am Block – ohne BlockNotes Versatz für Überschriften (S4-3b, beim Durchklicken gefunden). BlockNote
 * schiebt ihn bei Überschrift 1 um 39 px nach unten, passend zu seinen großen Überschriften; unsere sind kleiner (S4-1).
 * Seit W7 hat eine Überschrift keinen Griff mehr; die Lage gilt weiter für die übrigen Blöcke (Listen unter „Punkt 2“
 * standen sonst neben dem falschen Block).
 */
const GRIFF_LAGE = { useFloatingOptions: { middleware: [] } };

type GriffBlock = { block?: { id?: string; type?: string } } | undefined;

/**
 * Griff an den Blöcken, die man im Text verschieben soll (`hatGriff`: nicht an normalem Text und seit W7 nicht an
 * Überschriften – die ordnet man im Fenster „Punkte ordnen“). Er steht auf Höhe der ersten Textzeile (`griffVersatz`, K1);
 * enthält die Markierung eine Überschrift, zieht er nur seine Zeile (`nurDieseZeile`).
 */
function Griff() {
  const editor = useBlockNoteEditor() as unknown as ProtokollEditor;
  const art = useExtensionState(SideMenuExtension, {
    selector: (s: unknown) => (s as GriffBlock)?.block?.type,
  });
  const id = useExtensionState(SideMenuExtension, {
    selector: (s: unknown) => (s as GriffBlock)?.block?.id,
  });
  const rahmen = useRef<HTMLDivElement>(null);
  const [versatz, setVersatz] = useState(0);
  useLayoutEffect(() => {
    const el = rahmen.current;
    setVersatz(el && id ? griffVersatz(blockInhalt(document, id), el.offsetHeight) : 0);
  }, [id, art]);
  if (!id || !hatGriff(art)) return null;
  return (
    <div ref={rahmen} style={{ transform: `translateY(${versatz}px)` }}>
      <SideMenu>
        <AddBlockButton />
        {/* `flex`, nicht inline: Ein Inline-`span` stellt den Knopf auf die Grundlinie – der Griff stand 2 px über dem „+“
            (in Safari und Chrome gemessen 29.10.2026, Alwin: „sitzt zu hoch“). */}
        <span style={{ display: 'flex' }} onDragStartCapture={() => nurDieseZeile(editor, id)}>
          <DragHandleButton
            dragHandleMenu={() => (
              <DragHandleMenu>
                {art === 'table' && <TableRowHeaderItem>Kopfzeile</TableRowHeaderItem>}
                {art === 'table' && <TableColumnHeaderItem>Kopfspalte</TableColumnHeaderItem>}
                <RemoveBlockItem>Löschen</RemoveBlockItem>
              </DragHandleMenu>
            )}
          />
        </span>
      </SideMenu>
    </div>
  );
}

/** Was der Bildschirm am Editor braucht. */
export interface EditorGriff {
  dokument(): Block[];
  /** Den Inhalt ersetzen (Mitlesen, Übernehmen) – zählt nicht als Änderung. */
  ersetzen(dokument: readonly Block[]): void;
  /**
   * Blöcke einfügen – vor den Block `vor` (oberste Ebene), sonst ans Ende. Zählt als Änderung (wird gespeichert); für
   * übernommene Vorschläge (S5-4).
   */
  einfuegen(bloecke: readonly Block[], vor: string | null): void;
}

export function DokumentEditor({
  start,
  bearbeitbar,
  onAenderung,
  griff,
  fremdeAufgabe = () => false,
}: {
  start: readonly Block[];
  bearbeitbar: boolean;
  onAenderung: (dokument: Block[]) => void;
  griff: Ref<EditorGriff>;
  /** Gehört diese To-Do-ID einer anderen Sitzung? (dann bekommt die Aufgabe eine neue, `aufgabenIdsVergeben`) */
  fremdeAufgabe?: (id: string) => boolean;
}) {
  const feste = useContext(FestePunkteKontext);
  const editor: ProtokollEditor = useCreateBlockNote(
    {
      schema,
      dictionary: TEXTE,
      initialContent: start.length ? (start as Teil[]) : undefined,
      tables: TABELLEN,
      pasteHandler: ({ event, editor: e, defaultPasteHandler }) => {
        const html = event.clipboardData?.getData('text/html') ?? '';
        if (!istWordHtml(html)) return defaultPasteHandler();
        e.pasteHTML(wordListenUmbauen(html));
        return true;
      },
    },
    [],
  );
  const thema = useThema();
  // `ersetzen` ist keine Eingabe: Meldet der Editor die Änderung gleich (`stumm`) oder erst danach (`ersetzt` = der
  // Text dieses Stands), wird sie übergangen.
  const stumm = useRef(false);
  const ersetzt = useRef<string | null>(null);

  useImperativeHandle(
    griff,
    () => ({
      dokument: () => editor.document,
      ersetzen: (dok) => {
        stumm.current = true;
        try {
          editor.replaceBlocks(
            editor.document,
            dok.length ? (dok as Teil[]) : [{ type: 'paragraph' }],
          );
        } finally {
          stumm.current = false;
        }
        ersetzt.current = JSON.stringify(editor.document);
      },
      einfuegen: (bloecke, vor) => bloeckeEinfuegen(editor, bloecke, vor),
    }),
    [editor],
  );

  return (
    <>
      {bearbeitbar && (
        <div className={styles.leiste}>
          <Werkzeugleiste editor={editor} />
        </div>
      )}
      <div className={styles.blatt}>
        <BlockNoteView
          editor={editor}
          theme={thema}
          editable={bearbeitbar}
          formattingToolbar={false}
          slashMenu={false}
          sideMenu={false}
          emojiPicker={false}
          onChange={(e) => {
            if (stumm.current) return;
            const dok = e.document as Block[];
            // Neue, kopierte oder fremde Aufgaben bekommen gleich eine eigene ID (S4-2). Das löst eine weitere Meldung
            // aus; erst die zählt als Eingabe.
            if (aufgabenIdsSetzen(e, fremdeAufgabe)) return;
            if (ersetzt.current !== null) {
              const gleich = JSON.stringify(dok) === ersetzt.current;
              ersetzt.current = null;
              if (gleich) return;
            }
            onAenderung(dok);
          }}
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={(q) =>
              Promise.resolve(
                filterSuggestionItems(
                  [
                    ...EIGENE.map(
                      (x): DefaultReactSuggestionItem => ({
                        title: x.titel,
                        subtext: EIGENE_TEXT[x.art],
                        aliases: [...EIGENE_ALIASE[x.art]],
                        group: 'Protokoll',
                        icon: <Icon name={x.icon} size={18} />,
                        onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: x.art }),
                      }),
                    ),
                    {
                      title: 'Tabelle',
                      subtext: 'Mit Kopfzeile – Zeilen und Spalten über die Griffe',
                      aliases: ['tabelle', 'table'],
                      group: 'Protokoll',
                      icon: <Icon name="tabelle" size={18} />,
                      onItemClick: () => tabelleEinfuegen(editor),
                    },
                    ...festeImMenue(editor, feste),
                    ...getDefaultReactSlashMenuItems(editor).filter((i) => MENUE.has(i.title)),
                  ],
                  q,
                ),
              )
            }
          />
          {bearbeitbar && <SideMenuController sideMenu={Griff} floatingUIOptions={GRIFF_LAGE} />}
        </BlockNoteView>
      </div>
    </>
  );
}
