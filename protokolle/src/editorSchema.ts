import {
  BlockNoteSchema,
  createHeadingBlockSpec,
  defaultBlockSpecs,
  type BlockNoteEditor,
} from '@blocknote/core';
import { createExtension } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { BLOCK } from '@shared/protokolle/dokument';
import { aufgabenIdsVergeben } from '@shared/protokolle/aufgaben';
import {
  AufgabeBlock,
  BeschlussBlock,
  ReiheBlock,
  TerminBlock,
  VerweisBlock,
} from './EditorBloecke';
import { ohneVerlauf } from './ohneVerlauf';
import { einrueckenTasten } from './einruecken';
import { punktNummern } from './punktNummern';
import { tabellenZeile } from './tabellenZeile';
import { zellenListe } from './zellenListe';

/**
 * **Was im Protokoll-Editor stehen kann** (Bauplan S4-1, BlockNote 0.56): Text, Überschrift 1–6 (Stufe 1 = Tagesordnungs-
 * punkt, 2/4/5/6 = Unterpunkt 4.1 bis 4.1.1.1.1 seit K3b, 3 = Überschrift ohne Nummer), Aufzählung, Nummerierung, Zitat, Trennlinie, **Tabelle** (K3a) – und unsere
 * eigenen Blöcke aus `BLOCK`. Die **Checkliste** bleibt im Schema, damit alte Protokolle lesbar und bearbeitbar bleiben;
 * Leiste und „/“-Menü bieten sie seit K3a nicht mehr an (nur noch To-Do).
 *
 * Bewusst **nicht** dabei: Bilder, Videos, Dateien, Code. Die Lese-Ansicht und das PDF zeigen sie nicht, und was der
 * Editor annimmt, aber keine Ansicht zeigt, wäre still verschwunden. Tabellen zeigt die Lese-Ansicht seit K3a
 * (`tabellenZeilen`); Tabellen aus Word kommen damit als Tabelle an.
 *
 * Die eigenen Blöcke tragen ihre Daten in `props` wie in `@shared/protokolle/dokument`; Aufgabe und Termin werden seit
 * S4-2 bedient (`EditorBloecke.tsx`), die festen Punkte (Verweis) seit S4-3a. **„[] “ + Leertaste macht eine Aufgabe**
 * (Alwin 24.10.2026, wie Entwurf 7) – die Regel läuft vor der von BlockNotes Checkliste.
 */

const aufgabeKuerzel = createExtension({
  key: 'protokoll-aufgabe-kuerzel',
  runsBefore: ['check-list-item-shortcuts'],
  inputRules: [{ find: /^\s?\[\s*\]\s$/, replace: () => ({ type: BLOCK.aufgabe, props: {} }) }],
});

const aufgabeBlock = createReactBlockSpec(
  {
    type: BLOCK.aufgabe,
    // `vorab`: Wer/Bis, gewählt bevor es das To-Do gab (JSON, K1) – das Anlegen übernimmt sie.
    propSchema: { aufgabe: { default: '' }, vorab: { default: '' } },
    content: 'inline',
  },
  { render: AufgabeBlock },
  [aufgabeKuerzel],
);

const beschlussBlock = createReactBlockSpec(
  { type: BLOCK.beschluss, propSchema: {}, content: 'inline' },
  { render: BeschlussBlock },
);

const terminBlock = createReactBlockSpec(
  { type: BLOCK.termin, propSchema: { datum: { default: '' } }, content: 'inline' },
  { render: TerminBlock },
);

const verweisBlock = createReactBlockSpec(
  {
    type: BLOCK.verweis,
    // `fest`: was der Punkt bei der Freigabe zeigte (JSON, `festePunkteFesthalten`) – leer = live (S4-3a).
    // `gaeste`: freie Namen beim festen Punkt „Anwesenheit“ (JSON, S5-3).
    // `ohne`: Personen-IDs, die aus der Anwesenheit DIESES Protokolls genommen sind (JSON) – nur hier, nie im Treffen.
    // `schnappschuss`: die Anwesenheit, wie sie beim Schreiben im Gruppentreffen stand (JSON, W16) – für alle, die das
    // Gruppentreffen in ChurchTools nicht sehen dürfen.
    propSchema: {
      art: { default: 'offene-aufgaben' },
      fest: { default: '' },
      gaeste: { default: '' },
      ohne: { default: '' },
      schnappschuss: { default: '' },
    },
    content: 'none',
  },
  { render: VerweisBlock },
);

const themenreiheBlock = createReactBlockSpec(
  {
    type: BLOCK.themenreihe,
    // `reihe`: die ID des Werts in „Mitarbeit“ (wie `props.aufgabe`) – die Reihe selbst liegt dort, nicht im Protokoll.
    propSchema: { reihe: { default: '' } },
    content: 'none',
  },
  { render: ReiheBlock },
);

const { paragraph, bulletListItem, numberedListItem, checkListItem, quote, divider, table } =
  defaultBlockSpecs;

// Überschriften tragen die Nummern im Editor und Tab/Umschalt+Tab für Punkt ⇄ Unterpunkt (K3b).
const ueberschrift = createHeadingBlockSpec({
  levels: [1, 2, 3, 4, 5, 6],
  allowToggleHeadings: false,
});
const heading = {
  ...ueberschrift,
  extensions: [
    ...(ueberschrift.extensions ?? []),
    einrueckenTasten,
    punktNummern,
    zellenListe,
    tabellenZeile,
  ],
};

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph,
    heading,
    bulletListItem,
    numberedListItem,
    checkListItem,
    quote,
    divider,
    table,
    [BLOCK.aufgabe]: aufgabeBlock(),
    [BLOCK.beschluss]: beschlussBlock(),
    [BLOCK.termin]: terminBlock(),
    [BLOCK.verweis]: verweisBlock(),
    [BLOCK.themenreihe]: themenreiheBlock(),
  },
});

/**
 * Tabellen (K3a): Kopfzeile und -spalte umschaltbar; seit W11 auch **Zellen farbig füllen** (nur der Hintergrund – das
 * Menü an Zelle, Zeile und Spalte bietet „Farben“). Die **Schriftfarbe je Zelle** bleibt aus: das PDF kennt sie nicht,
 * markierter Text hat seine eigene Schriftfarbe. Verbundene Zellen bewusst nicht – einfach halten.
 * Eine Stelle für den Editor und die Tests, die ihn nachbauen.
 */
export const TABELLEN = { headers: true, cellBackgroundColor: true } as const;

export type ProtokollEditor = BlockNoteEditor<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

/** Die Blockarten, die der Editor kennt – für `fremdeTypen` (nichts öffnen, was er beim Speichern verlöre). */
export const EDITOR_TYPEN: ReadonlySet<string> = new Set(Object.keys(schema.blockSpecs));

/**
 * **Aufgaben-IDs im Editor setzen** (S4-2, Regel `aufgabenIdsVergeben`): neue, kopierte oder aus einer anderen Sitzung
 * eingefügte Aufgaben bekommen eine eigene ID – so gibt es das To-Do schon, wenn jemand gleich „Wer?“ wählt.
 * **Nicht im Rückgängig-Verlauf** (`ohneVerlauf`, beim Durchklicken 24.10.2026 gefunden): sonst nähme „Rückgängig“ die ID wieder weg,
 * die Aufgabe bekäme eine neue, und ihr To-Do (mit Wer/Bis/Status) wäre als gelöscht vermerkt. `true`, wenn gesetzt wurde.
 */
export function aufgabenIdsSetzen(
  editor: ProtokollEditor,
  fremd: (id: string) => boolean,
  neueId: () => string = () => crypto.randomUUID(),
): boolean {
  const ids = aufgabenIdsVergeben(editor.document, fremd, neueId);
  if (!ids.length) return false;
  ohneVerlauf(editor, () => {
    for (const x of ids) editor.updateBlock(x.blockId, { props: { aufgabe: x.aufgabe } });
  });
  return true;
}
