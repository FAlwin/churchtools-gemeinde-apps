import type { ReactNode } from 'react';
import { useEditorState } from '@blocknote/react';
import { Icon, type IconName } from '@ui/icons/icons';
import type { ProtokollEditor } from './editorSchema';
import styles from './Werkzeugleiste.module.scss';

/**
 * **Die feste Werkzeugleiste über dem Blatt** (Bauplan S4-1, Entwurf 7; Alwin 24.10.2026: fest oben statt schwebend).
 * Am Handy lässt sie sich waagrecht wischen – die schwebende Leiste von BlockNote lief im S0-Durchstich rechts aus dem
 * Bild, die Einrück-Knöpfe waren nicht erreichbar. „/“-Menü, Kürzel und Tastenkürzel bleiben zusätzlich.
 *
 * Die Knöpfe nehmen dem Text den Fokus nicht weg (`onMouseDown` → `preventDefault`), sonst ginge die Markierung
 * verloren, bevor „Fett“ wirkt.
 */

/** Die Textarten der Auswahl – nur die Standardblöcke; eigene Blöcke (Aufgabe, Beschluss …) wechseln hier nicht. */
const TEXTARTEN = [
  { wert: 'paragraph', text: 'Text' },
  { wert: 'heading-1', text: 'Tagesordnungspunkt' },
  { wert: 'heading-2', text: 'Überschrift 2' },
  { wert: 'heading-3', text: 'Überschrift 3' },
  { wert: 'bulletListItem', text: 'Aufzählung' },
  { wert: 'numberedListItem', text: 'Nummerierung' },
  { wert: 'checkListItem', text: 'Checkliste' },
  { wert: 'quote', text: 'Zitat' },
] as const;

type Textart = (typeof TEXTARTEN)[number]['wert'];

const istTextart = (x: string): x is Textart => TEXTARTEN.some((t) => t.wert === x);

function artVon(b: { type: string; props: Record<string, unknown> }): string {
  return b.type === 'heading' ? `heading-${Number(b.props.level ?? 1)}` : b.type;
}

function ausgewaehlt(editor: ProtokollEditor) {
  return editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
}

/** Aufgabe, Beschluss, Termin (S4-2) – Knöpfe in der Leiste, Einträge im „/“-Menü. */
export const EIGENE = [
  { art: 'aufgabe', titel: 'Aufgabe', icon: 'aufgabe' },
  { art: 'beschluss', titel: 'Beschluss', icon: 'stempel' },
  { art: 'termin', titel: 'Termin', icon: 'calendar' },
] as const;

type Eigene = (typeof EIGENE)[number]['art'];

/**
 * Die markierten Textblöcke zu Aufgabe, Beschluss oder Termin machen – der Text bleibt. Sind schon alle von dieser Art,
 * werden sie wieder normaler Text (eine Aufgabe verschwindet damit aus den To-Dos; Rückgängig holt sie zurück).
 */
function eigeneArt(editor: ProtokollEditor, art: Eigene): void {
  const bloecke = ausgewaehlt(editor).filter(
    (b) => istTextart(artVon(b)) || EIGENE.some((e) => e.art === b.type),
  );
  const zurueck = bloecke.length > 0 && bloecke.every((b) => b.type === art);
  for (const b of bloecke) {
    if (zurueck) editor.updateBlock(b, { type: 'paragraph', props: {} });
    else if (b.type !== art) editor.updateBlock(b, { type: art, props: {} });
  }
  editor.focus();
}

/** Die markierten Blöcke in diese Textart bringen – eigene Blöcke bleiben, was sie sind. */
function artSetzen(editor: ProtokollEditor, art: Textart): void {
  for (const b of ausgewaehlt(editor)) {
    if (!istTextart(artVon(b))) continue;
    if (art.startsWith('heading-'))
      editor.updateBlock(b, { type: 'heading', props: { level: Number(art.slice(8)) } });
    else editor.updateBlock(b, { type: art as Exclude<Textart, `heading-${number}`> });
  }
  editor.focus();
}

function Knopf({
  titel,
  aktiv,
  aus,
  onKlick,
  children,
}: {
  titel: string;
  aktiv?: boolean;
  aus?: boolean;
  onKlick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.knopf}
      title={titel}
      aria-label={titel}
      aria-pressed={aktiv === undefined ? undefined : aktiv}
      disabled={aus}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onKlick}
    >
      {children}
    </button>
  );
}

const SymbolKnopf = (p: {
  titel: string;
  icon: IconName;
  aktiv?: boolean;
  aus?: boolean;
  onKlick: () => void;
}) => (
  <Knopf {...p}>
    <Icon name={p.icon} size={18} />
  </Knopf>
);

export function Werkzeugleiste({ editor }: { editor: ProtokollEditor }) {
  const z = useEditorState({
    editor,
    // `editor` aus der Hülle – der Schnappschuss reicht ihn nur untypisiert durch.
    selector: () => {
      const e = editor;
      if (!e.isEditable) return null;
      const bloecke = ausgewaehlt(e);
      const s = e.getActiveStyles();
      return {
        art: artVon(bloecke[0]),
        mitText: bloecke.some((b) => b.content !== undefined),
        typ: bloecke[0].type,
        fett: !!s.bold,
        kursiv: !!s.italic,
        unter: !!s.underline,
        durch: !!s.strike,
        markiert: !!s.backgroundColor && s.backgroundColor !== 'default',
        ein: e.canNestBlock(),
        aus: e.canUnnestBlock(),
      };
    },
  });
  if (!z) return null;

  const stil = (s: 'bold' | 'italic' | 'underline' | 'strike') => () => {
    editor.toggleStyles({ [s]: true });
    editor.focus();
  };
  const textart = istTextart(z.art) ? z.art : '';

  return (
    <div className={styles.leiste} role="toolbar" aria-label="Formatierung">
      <div className={styles.gruppe}>
        <SymbolKnopf titel="Rückgängig" icon="undo" onKlick={() => editor.undo()} />
        <SymbolKnopf titel="Wiederholen" icon="redo" onKlick={() => editor.redo()} />
      </div>
      <select
        className={styles.textart}
        aria-label="Textart"
        value={textart}
        disabled={!textart}
        onChange={(e) => istTextart(e.target.value) && artSetzen(editor, e.target.value)}
      >
        {!textart && <option value="">–</option>}
        {TEXTARTEN.map((t) => (
          <option key={t.wert} value={t.wert}>
            {t.text}
          </option>
        ))}
      </select>
      <div className={styles.gruppe}>
        <Knopf titel="Fett (Strg+B)" aktiv={z.fett} aus={!z.mitText} onKlick={stil('bold')}>
          <b>B</b>
        </Knopf>
        <Knopf titel="Kursiv (Strg+I)" aktiv={z.kursiv} aus={!z.mitText} onKlick={stil('italic')}>
          <i>I</i>
        </Knopf>
        <Knopf
          titel="Unterstrichen (Strg+U)"
          aktiv={z.unter}
          aus={!z.mitText}
          onKlick={stil('underline')}
        >
          <u>U</u>
        </Knopf>
        <Knopf titel="Durchgestrichen" aktiv={z.durch} aus={!z.mitText} onKlick={stil('strike')}>
          <s>S</s>
        </Knopf>
        <SymbolKnopf
          titel="Markieren"
          icon="marker"
          aktiv={z.markiert}
          aus={!z.mitText}
          onKlick={() => {
            if (z.markiert) editor.removeStyles({ backgroundColor: '' });
            else editor.addStyles({ backgroundColor: 'yellow' });
            editor.focus();
          }}
        />
        <SymbolKnopf
          titel="Formatierung entfernen"
          icon="format-weg"
          aus={!z.mitText}
          onKlick={() => {
            editor.removeStyles({
              bold: true,
              italic: true,
              underline: true,
              strike: true,
              backgroundColor: '',
            });
            editor.focus();
          }}
        />
      </div>
      <div className={styles.gruppe}>
        <SymbolKnopf
          titel="Aufzählung"
          icon="liste"
          aktiv={z.art === 'bulletListItem'}
          aus={!textart}
          onKlick={() =>
            artSetzen(editor, z.art === 'bulletListItem' ? 'paragraph' : 'bulletListItem')
          }
        />
        <SymbolKnopf
          titel="Nummerierung"
          icon="nummern"
          aktiv={z.art === 'numberedListItem'}
          aus={!textart}
          onKlick={() =>
            artSetzen(editor, z.art === 'numberedListItem' ? 'paragraph' : 'numberedListItem')
          }
        />
        <SymbolKnopf
          titel="Ausrücken (Umschalt+Tab)"
          icon="ausruecken"
          aus={!z.aus}
          onKlick={() => {
            editor.unnestBlock();
            editor.focus();
          }}
        />
        <SymbolKnopf
          titel="Einrücken (Tab)"
          icon="einruecken"
          aus={!z.ein}
          onKlick={() => {
            editor.nestBlock();
            editor.focus();
          }}
        />
      </div>
      <div className={styles.gruppe}>
        {EIGENE.map((e) => (
          <SymbolKnopf
            key={e.art}
            titel={e.titel}
            icon={e.icon}
            aktiv={z.typ === e.art}
            aus={!textart && z.typ !== e.art && !EIGENE.some((x) => x.art === z.typ)}
            onKlick={() => eigeneArt(editor, e.art)}
          />
        ))}
      </div>
      <div className={styles.gruppe}>
        <SymbolKnopf
          titel="Zitat"
          icon="zitat"
          aktiv={z.art === 'quote'}
          aus={!textart}
          onKlick={() => artSetzen(editor, z.art === 'quote' ? 'paragraph' : 'quote')}
        />
        <SymbolKnopf
          titel="Trennlinie"
          icon="trennlinie"
          onKlick={() => {
            const hier = editor.getTextCursorPosition().block;
            const [, danach] = editor.insertBlocks(
              [{ type: 'divider' }, { type: 'paragraph' }],
              hier,
              'after',
            );
            editor.setTextCursorPosition(danach, 'start');
            editor.focus();
          }}
        />
      </div>
    </div>
  );
}
