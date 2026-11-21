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
  DragHandleButton,
  DragHandleMenu,
  getDefaultReactSlashMenuItems,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  TableColumnHeaderItem,
  TableHandlesController,
  TableRowHeaderItem,
  useBlockNoteEditor,
  useCreateBlockNote,
  useExtensionState,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import type { Block } from '@shared/protokolle/dokument';
import type { Einfuegung } from '@shared/protokolle/ki';
import { bloeckeEinfuegen, einfuegungenAusfuehren } from './bloeckeEinfuegen';
import { Icon } from '@ui/icons/icons';
import { useThema } from '@ui/design/useThema';
import { aufgabenIdsSetzen, schema, TABELLEN, type ProtokollEditor } from './editorSchema';
import { blockInhalt, griffVersatz } from './griffLage';
import { FestePunkteKontext } from './festePunkteKontext';
import { festeImMenue } from './festeImMenue';
import { tabelleEinfuegen } from './tabelleEinfuegen';
import { TabellenGriff } from './TabellenZeilenMenue';
import { hatGriff, nurDieseZeile } from './zeilenGriff';
import { EIGENE, Werkzeugleiste } from './Werkzeugleiste';
import { istWordHtml, wordListenUmbauen } from './wordListen';
import './DokumentEditor.scss';
import styles from './ProtokollSchreiben.module.scss';

/**
 * **Das Protokoll als Dokument bearbeiten** (Bauplan S4-1, Entwurf 7) – BlockNote mit unserem Schema, der festen
 * Werkzeugleiste und dem „/“-Menü. Speichern und Sperre regelt der Bildschirm darüber
 * (`ProtokollSchreiben`); hier wird nur gemeldet, dass sich der Text geändert hat.
 *
 * - **Links im Text gibt es weder „+“ noch Griff** (W7, Alwin 18.11.2026): Tagesordnungspunkte und Unterpunkte stellt
 *   man im Fenster „Punkte ordnen“ um (Werkzeugleiste, `PunkteOrdnen.tsx`). Nur **Tabellen** haben einen Griff – sein
 *   Menü kennt Kopfzeile/Kopfspalte (K3a) und „Löschen“.
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
 * Seit W7 haben nur noch Tabellen einen Griff; die Lage gilt für sie weiter.
 */
const GRIFF_LAGE = { useFloatingOptions: { middleware: [] } };

type GriffBlock = { block?: { id?: string; type?: string } } | undefined;

/**
 * Griff nur noch an **Tabellen** (`hatGriff`, W7): sein Menü schaltet Kopfzeile/Kopfspalte. Sonst gibt es links im Text
 * weder „+“ noch Griff – Punkte ordnet man im Fenster „Punkte ordnen“, eingefügt wird über „Einfügen ▾“ und „/“. Er
 * steht auf Höhe der ersten Textzeile (`griffVersatz`, K1); enthält die Markierung eine Überschrift, zieht er nur die
 * Tabelle (`nurDieseZeile`).
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
        {/* `flex`, nicht inline: Ein Inline-`span` stellt den Knopf auf die Grundlinie (gemessen 29.10.2026, Alwin: „sitzt zu
            hoch“). */}
        <span style={{ display: 'flex' }} onDragStartCapture={() => nurDieseZeile(editor, id)}>
          <DragHandleButton
            dragHandleMenu={() => (
              <DragHandleMenu>
                <TableRowHeaderItem>Kopfzeile</TableRowHeaderItem>
                <TableColumnHeaderItem>Kopfspalte</TableColumnHeaderItem>
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
  /**
   * Mehrere Einfügungen samt Ersetzen (W12, „Mit KI füllen“) in EINER Transaktion – ein Rückgängig macht alles zurück.
   * Zählt als Änderung (wird gespeichert).
   */
  einfuegungen(liste: readonly Einfuegung[]): void;
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
      einfuegungen: (liste) => einfuegungenAusfuehren(editor, liste),
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
          tableHandles={false}
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
          {bearbeitbar && <TableHandlesController tableHandle={TabellenGriff} />}
        </BlockNoteView>
      </div>
    </>
  );
}
