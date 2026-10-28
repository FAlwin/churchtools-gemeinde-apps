import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
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
  useBlockNoteEditor,
  useComponentsContext,
  useCreateBlockNote,
  useExtensionState,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import type { Block } from '@shared/protokolle/dokument';
import { Icon } from '@ui/icons/icons';
import {
  abschnittAblegen,
  abschnittLinie,
  abschnittSchieben,
  blockGrenze,
  abschnittZiehenBeginnt,
  abschnittZiehenEndet,
  kannSchieben,
} from './abschnittZiehen';
import { aufgabenIdsSetzen, schema, type ProtokollEditor } from './editorSchema';
import { blockInhalt, griffVersatz } from './griffLage';
import { FESTE_PUNKTE } from './anzeige';
import { FESTE, festenPunktEinfuegen } from './festenPunktEinfuegen';
import { EIGENE, Werkzeugleiste } from './Werkzeugleiste';
import { istWordHtml, wordListenUmbauen } from './wordListen';
import './DokumentEditor.scss';
import styles from './ProtokollSchreiben.module.scss';

/**
 * **Das Protokoll als Dokument bearbeiten** (Bauplan S4-1, Entwurf 7) – BlockNote mit unserem Schema, der festen
 * Werkzeugleiste, dem „/“-Menü und Griffen zum Verschieben. Speichern und Sperre regelt der Bildschirm darüber
 * (`ProtokollSchreiben`); hier wird nur gemeldet, dass sich der Text geändert hat.
 *
 * - **Normaler Text hat keinen Griff** (Alwin 22.10.2026): Verschieben gibt es für Überschriften, Listen, Zitate und
 *   die eigenen Blöcke – ein Absatz ist einfach Text.
 * - Das Griff-Menü kennt nur „Löschen“ – Farben gäbe es zwar in BlockNote, Lese-Ansicht und PDF zeigen sie aber nicht.
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
    paragraph: { ...de.slash_menu.paragraph, title: 'Text', subtext: 'Normaler Text' },
    bullet_list: { ...de.slash_menu.bullet_list, title: 'Aufzählung' },
    numbered_list: { ...de.slash_menu.numbered_list, title: 'Nummerierung' },
  },
};

/** Was das „/“-Menü anbietet – die Blockarten aus `editorSchema`, nichts sonst. */
const MENUE = new Set(
  (
    [
      'paragraph',
      'heading',
      'heading_2',
      'heading_3',
      'bullet_list',
      'numbered_list',
      'check_list',
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
const FESTE_ALIASE = {
  'offene-aufgaben': ['offen', 'todos', 'to-dos', 'fest'],
  'letztes-protokoll': ['letztes', 'protokoll', 'fest'],
} as const;
const EIGENE_ALIASE = {
  aufgabe: ['todo', 'to-do', 'aufgabe', 'aufgaben'],
  beschluss: ['beschluss', 'entscheidung'],
  termin: ['termin', 'datum'],
} as const;

/**
 * Der Griff steht oben am Block – ohne BlockNotes Versatz für Überschriften (S4-3b, beim Durchklicken gefunden). BlockNote
 * schiebt ihn bei Überschrift 1 um 39 px nach unten, passend zu seinen großen Überschriften; unsere sind kleiner (S4-1),
 * und so stand der Griff neben dem nächsten Block: Wer „Punkt 2“ ziehen wollte, zog Punkt 1.
 */
const GRIFF_LAGE = { useFloatingOptions: { middleware: [] } };

/** Lage der Blöcke unter `wurzel` auf dem Bildschirm – fürs Ablegen und für die Linie beim Ziehen. */
const lageIn =
  (wurzel: ParentNode) =>
  (id: string): { top: number; bottom: number } | null =>
    wurzel.querySelector(`.bn-block-outer[data-id="${CSS.escape(id)}"]`)?.getBoundingClientRect() ??
    null;

type GriffBlock = { block?: { id?: string; type?: string } } | undefined;

/** „Nach oben“ / „Nach unten“ im Griff-Menü einer Überschrift (S4-3b) – fehlt, wenn es in die Richtung nicht geht. */
function SchiebenEintrag({
  id,
  richtung,
  children,
}: {
  id: string;
  richtung: 'hoch' | 'runter';
  children: ReactNode;
}) {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor() as unknown as ProtokollEditor;
  if (!kannSchieben(editor, id, richtung)) return null;
  return (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      onClick={() => abschnittSchieben(editor, id, richtung)}
    >
      {children}
    </Components.Generic.Menu.Item>
  );
}

/**
 * Griff nur an Blöcken, die man verschieben soll – nicht an normalem Text. An einer Überschrift zieht er den ganzen
 * Abschnitt (S4-3b, `abschnittZiehen.ts`), und das Menü kann ihn nach oben und unten schieben. Er steht auf Höhe der
 * ersten Textzeile (`griffVersatz`, K1).
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
  if (!art || !id || art === 'paragraph') return null;
  const ueberschrift = art === 'heading';
  return (
    <div ref={rahmen} style={{ transform: `translateY(${versatz}px)` }}>
      <SideMenu>
        <AddBlockButton />
        <span onDragStartCapture={() => abschnittZiehenBeginnt(editor, id)}>
          <DragHandleButton
            dragHandleMenu={() => (
              <DragHandleMenu>
                {ueberschrift && (
                  <SchiebenEintrag id={id} richtung="hoch">
                    Nach oben
                  </SchiebenEintrag>
                )}
                {ueberschrift && (
                  <SchiebenEintrag id={id} richtung="runter">
                    Nach unten
                  </SchiebenEintrag>
                )}
                <RemoveBlockItem>Löschen</RemoveBlockItem>
              </DragHandleMenu>
            )}
          />
        </span>
      </SideMenu>
    </div>
  );
}

/** Hell oder dunkel – folgt `html[data-theme]` (das setzt die Erweiterung nach ChurchTools). */
function useThema(): 'light' | 'dark' {
  const lies = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const [thema, setThema] = useState<'light' | 'dark'>(lies);
  useEffect(() => {
    const b = new MutationObserver(() => setThema(lies()));
    b.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => b.disconnect();
  }, []);
  return thema;
}

/** Was der Bildschirm am Editor braucht. */
export interface EditorGriff {
  dokument(): Block[];
  /** Den Inhalt ersetzen (Mitlesen, Übernehmen) – zählt nicht als Änderung. */
  ersetzen(dokument: readonly Block[]): void;
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
  const editor: ProtokollEditor = useCreateBlockNote(
    {
      schema,
      dictionary: TEXTE,
      initialContent: start.length ? (start as Teil[]) : undefined,
      // Beim Ziehen eines Abschnitts steht die Linie dort, wo er landet (K1) – dieselbe Rechnung wie beim Ablegen.
      dropCursor: {
        hooks: {
          computeDropPosition: ({ editor: e, event, view, defaultPosition }) => {
            const l = abschnittLinie(e as ProtokollEditor, event.clientY, lageIn(view.dom));
            if (l === 'frei') return defaultPosition;
            if (l === 'keine') return null;
            const pos =
              'vor' in l
                ? blockGrenze(view.state.doc, l.vor, 'vor')
                : blockGrenze(view.state.doc, l.nach, 'nach');
            return pos === null ? null : { pos, orientation: 'block-horizontal' };
          },
        },
      },
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
  const blatt = useRef<HTMLDivElement>(null);
  // Ein gezogener Abschnitt (S4-3b) wird beim Loslassen von uns gesetzt – an der nächsten Abschnittsgrenze. Das Blatt
  // hört vor dem Editor (Einfangphase); was keine Überschrift ist, legt BlockNote wie bisher ab.
  useEffect(() => {
    const el = blatt.current;
    if (!el) return;
    const ablegen = (e: DragEvent) => {
      if (!abschnittAblegen(editor, e.clientY, lageIn(el))) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const vorbei = () => abschnittZiehenEndet(editor);
    el.addEventListener('drop', ablegen, true);
    document.addEventListener('dragend', vorbei, true);
    return () => {
      el.removeEventListener('drop', ablegen, true);
      document.removeEventListener('dragend', vorbei, true);
    };
  }, [editor]);
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
      <div className={styles.blatt} ref={blatt}>
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
                    ...FESTE.map(
                      (f): DefaultReactSuggestionItem => ({
                        title: FESTE_PUNKTE[f.art].titel,
                        subtext: FESTE_PUNKTE[f.art].hinweis,
                        aliases: [...FESTE_ALIASE[f.art]],
                        group: 'Feste Punkte',
                        icon: <Icon name={f.icon} size={18} />,
                        onItemClick: () => festenPunktEinfuegen(editor, f.art),
                      }),
                    ),
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
