import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useEditorState } from '@blocknote/react';
import { Icon, type IconName } from '@ui/icons/icons';
import { BodyPortal } from '@ui/fenster/BodyPortal';
import { useAufklapp } from '@ui/bedienung/useAufklapp';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { useThema } from '@ui/design/useThema';
import { FESTE_PUNKTE } from './anzeige';
import type { ProtokollEditor } from './editorSchema';
import { farbWert, MARKIER_FARBEN, type FarbArt } from './farben';
import { FESTE, festenPunktEinfuegen } from './festenPunktEinfuegen';
import { tabelleEinfuegen } from './tabelleEinfuegen';
import styles from './Werkzeugleiste.module.scss';

/**
 * **Die feste Werkzeugleiste über dem Blatt** (Bauplan S4-1, Entwurf 7; Alwin 24.10.2026: fest oben statt schwebend).
 *
 * **Seit K3a in Gruppen, Variante B** (Entwurf `k3-leiste-v1.html`, Alwin 04.11.2026): Rückgängig, Textart und
 * Fett · Kursiv · Unterstrichen · Durchgestrichen · Formatierung entfernen stehen direkt da; **Markieren ▾ · Absatz ▾ ·
 * Einfügen ▾** klappen als Menüs auf. Am PC passt das in eine Zeile. Am Handy: Fett direkt, der Rest der Schrift unter
 * „Aa ▾“, die drei Menüs nur als Zeichen (Absatz = Zeilen, nicht ¶ – Alwin). „/“-Menü, Kürzel und Tab bleiben.
 *
 * Knöpfe und Menüs nehmen dem Text den Fokus nicht weg (`onMouseDown` → `preventDefault`), sonst ginge die Markierung
 * verloren, bevor „Fett“ oder eine Farbe wirkt. Die Menüs hängen an `body` – in der wischbaren Leiste würden sie
 * abgeschnitten.
 */

/** Die Textarten – auch Listen und Zitat, damit die Auswahl zeigt, was unter dem Cursor steht, und es zurück zu Text geht. */
const TEXTARTEN = [
  { wert: 'paragraph', text: 'Text' },
  { wert: 'heading-1', text: 'Tagesordnungspunkt' },
  { wert: 'heading-2', text: 'Unterpunkt' },
  { wert: 'heading-3', text: 'Überschrift' },
  { wert: 'bulletListItem', text: 'Aufzählung' },
  { wert: 'numberedListItem', text: 'Nummerierung' },
  { wert: 'checkListItem', text: 'Checkliste' },
  { wert: 'quote', text: 'Zitat' },
] as const;

type Textart = (typeof TEXTARTEN)[number]['wert'];

/** Was die Auswahl anbietet (K3a). Listen und Zitat stehen unter „Absatz“; die Checkliste gibt es nur noch in alten Protokollen. */
const ZUR_WAHL: readonly Textart[] = ['paragraph', 'heading-1', 'heading-2', 'heading-3'];

const istTextart = (x: string): x is Textart => TEXTARTEN.some((t) => t.wert === x);
const textartText = (x: Textart): string => TEXTARTEN.find((t) => t.wert === x)?.text ?? x;

function artVon(b: { type: string; props: Record<string, unknown> }): string {
  return b.type === 'heading' ? `heading-${Number(b.props.level ?? 1)}` : b.type;
}

function ausgewaehlt(editor: ProtokollEditor) {
  return editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
}

/** To-Do, Beschluss, Termin (S4-2; seit K3a heißt die Aufgabe überall „To-Do“) – im Menü „Einfügen“ und im „/“-Menü. */
export const EIGENE = [
  { art: 'aufgabe', titel: 'To-Do', icon: 'aufgabe' },
  { art: 'beschluss', titel: 'Beschluss', icon: 'stempel' },
  { art: 'termin', titel: 'Termin', icon: 'calendar' },
] as const;

type Eigene = (typeof EIGENE)[number]['art'];

/**
 * Die markierten Textblöcke zu To-Do, Beschluss oder Termin machen – der Text bleibt. Sind schon alle von dieser Art,
 * werden sie wieder normaler Text (ein To-Do verschwindet damit aus den To-Dos; Rückgängig holt es zurück).
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

/** Farbe setzen (`null` = keine) – BlockNote speichert den Namen als Auszeichnung. */
function farbeSetzen(editor: ProtokollEditor, art: FarbArt, name: string | null): void {
  const stil = art === 'hintergrund' ? 'backgroundColor' : 'textColor';
  if (name) editor.addStyles({ [stil]: name });
  else editor.removeStyles({ [stil]: '' });
  editor.focus();
}

const behalteFokus = (e: { preventDefault(): void }) => e.preventDefault();

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
      onMouseDown={behalteFokus}
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

/** So breit wird ein Menü höchstens (px) – damit es am Handy nicht über den Rand ragt. */
const MENUE_BREITE = 264;

/**
 * **Ein Menü an der Leiste** (K3a) – auf, zu, zu bei Tipp daneben, Escape oder Scrollen (`useAufklapp`). Es hängt an
 * `body` und steht unter dem Knopf, nach links verschoben, wenn rechts der Platz fehlt.
 */
function Menue({
  titel,
  zeichen,
  mitWort,
  aus,
  children,
}: {
  titel: string;
  /** Was der Knopf zeigt (Symbol) – am PC steht dazu das Wort. */
  zeichen?: ReactNode;
  mitWort?: boolean;
  aus?: boolean;
  children: (zu: () => void) => ReactNode;
}) {
  const { offen, setOffen, rahmen, menue } = useAufklapp();
  const knopf = useRef<HTMLButtonElement>(null);
  const [stelle, setStelle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!offen) return;
    const zu = () => setOffen(false);
    window.addEventListener('scroll', zu, true);
    window.addEventListener('resize', zu);
    return () => {
      window.removeEventListener('scroll', zu, true);
      window.removeEventListener('resize', zu);
    };
  }, [offen, setOffen]);

  function umschalten(): void {
    const r = knopf.current?.getBoundingClientRect();
    if (r) {
      const links = Math.max(8, Math.min(r.left, window.innerWidth - MENUE_BREITE - 8));
      setStelle({ top: r.bottom + 4, left: links });
    }
    setOffen((o) => !o);
  }

  return (
    <span ref={rahmen} className={styles.menueRahmen}>
      <button
        ref={knopf}
        type="button"
        className={`${styles.knopf}${mitWort ? ` ${styles.wort}` : ''}`}
        title={titel}
        aria-label={titel}
        aria-haspopup="menu"
        aria-expanded={offen}
        disabled={aus}
        onMouseDown={behalteFokus}
        onClick={umschalten}
      >
        {zeichen}
        {mitWort && <span>{titel}</span>}
        <Icon name="chev-down" size={14} className={styles.pfeil} />
      </button>
      {offen && (
        <BodyPortal>
          <div
            ref={menue}
            role="menu"
            aria-label={titel}
            className={styles.menue}
            style={{ ...stelle, maxWidth: MENUE_BREITE }}
            onMouseDown={behalteFokus}
          >
            {children(() => setOffen(false))}
          </div>
        </BodyPortal>
      )}
    </span>
  );
}

function MenuePunkt({
  icon,
  zeichen,
  text,
  aktiv,
  aus,
  onKlick,
}: {
  icon?: IconName;
  zeichen?: ReactNode;
  text: string;
  aktiv?: boolean;
  aus?: boolean;
  onKlick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={styles.punkt}
      aria-pressed={aktiv === undefined ? undefined : aktiv}
      disabled={aus}
      onMouseDown={behalteFokus}
      onClick={onKlick}
    >
      <span className={styles.punktZeichen} aria-hidden>
        {icon ? <Icon name={icon} size={18} /> : zeichen}
      </span>
      {text}
    </button>
  );
}

const Abschnitt = ({ children }: { children: ReactNode }) => (
  <div className={styles.abschnitt}>{children}</div>
);

/** Ein Farbfeld: „keine“ und die neun Farben des Editors, jeweils als „A“ in dieser Farbe gezeigt. */
function Farbfeld({
  art,
  aktiv,
  onWahl,
}: {
  art: FarbArt;
  aktiv: string | null;
  onWahl: (name: string | null) => void;
}) {
  const thema = useThema();
  return (
    <div
      className={styles.farben}
      role="group"
      aria-label={art === 'hintergrund' ? 'Hintergrund' : 'Schrift'}
    >
      <button
        type="button"
        className={`${styles.farbe} ${styles.keine}`}
        title={art === 'hintergrund' ? 'Kein Hintergrund' : 'Schrift automatisch'}
        aria-pressed={!aktiv}
        onMouseDown={behalteFokus}
        onClick={() => onWahl(null)}
      >
        {art === 'hintergrund' ? 'keine' : 'auto'}
      </button>
      {MARKIER_FARBEN.map((f) => (
        <button
          key={f.name}
          type="button"
          className={styles.farbe}
          title={f.titel}
          aria-label={f.titel}
          aria-pressed={aktiv === f.name}
          style={
            art === 'hintergrund'
              ? { backgroundColor: farbWert(f.name, 'hintergrund', thema) }
              : { color: farbWert(f.name, 'schrift', thema) }
          }
          onMouseDown={behalteFokus}
          onClick={() => onWahl(f.name)}
        >
          A
        </button>
      ))}
    </div>
  );
}

const farbName = (x: unknown): string | null =>
  typeof x === 'string' && x && x !== 'default' ? x : null;

export function Werkzeugleiste({ editor }: { editor: ProtokollEditor }) {
  const handy = useMedienAbfrage(HANDY_BREITE);
  const thema = useThema();
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
        hintergrund: farbName(s.backgroundColor),
        schrift: farbName(s.textColor),
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
  const formatWeg = () => {
    editor.removeStyles({
      bold: true,
      italic: true,
      underline: true,
      strike: true,
      backgroundColor: '',
      textColor: '',
    });
    editor.focus();
  };
  const textart = istTextart(z.art) ? z.art : '';
  const wahl: readonly Textart[] =
    textart && !ZUR_WAHL.includes(textart) ? [...ZUR_WAHL, textart] : ZUR_WAHL;
  const umschalten = (art: Textart) => () => artSetzen(editor, z.art === art ? 'paragraph' : art);

  const rueckgaengig = (
    <div className={styles.gruppe}>
      <SymbolKnopf titel="Rückgängig (Strg+Z)" icon="undo" onKlick={() => editor.undo()} />
      <SymbolKnopf titel="Wiederholen (Strg+Y)" icon="redo" onKlick={() => editor.redo()} />
    </div>
  );
  const fett = (
    <Knopf titel="Fett (Strg+B)" aktiv={z.fett} aus={!z.mitText} onKlick={stil('bold')}>
      <b>B</b>
    </Knopf>
  );

  const markieren = (
    <Menue
      titel="Markieren"
      mitWort={!handy}
      aus={!z.mitText}
      zeichen={
        handy && (
          <span className={styles.farbsymbol}>
            <Icon name="marker" size={17} />
            <i style={{ backgroundColor: farbWert(z.hintergrund, 'hintergrund', thema) }} />
          </span>
        )
      }
    >
      {(zu) => (
        <>
          <Abschnitt>Hintergrund</Abschnitt>
          <Farbfeld
            art="hintergrund"
            aktiv={z.hintergrund}
            onWahl={(n) => {
              zu();
              farbeSetzen(editor, 'hintergrund', n);
            }}
          />
          <Abschnitt>Schrift</Abschnitt>
          <Farbfeld
            art="schrift"
            aktiv={z.schrift}
            onWahl={(n) => {
              zu();
              farbeSetzen(editor, 'schrift', n);
            }}
          />
        </>
      )}
    </Menue>
  );

  const absatz = (
    <Menue titel="Absatz" mitWort={!handy} zeichen={handy && <Icon name="align-left" size={18} />}>
      {(zu) => {
        const tun = (f: () => void) => () => {
          zu();
          f();
        };
        return (
          <>
            <MenuePunkt
              icon="liste"
              text="Aufzählung"
              aktiv={z.art === 'bulletListItem'}
              aus={!textart}
              onKlick={tun(umschalten('bulletListItem'))}
            />
            <MenuePunkt
              icon="nummern"
              text="Nummerierung"
              aktiv={z.art === 'numberedListItem'}
              aus={!textart}
              onKlick={tun(umschalten('numberedListItem'))}
            />
            <MenuePunkt
              icon="ausruecken"
              text="Ausrücken (Umschalt+Tab)"
              aus={!z.aus}
              onKlick={tun(() => {
                editor.unnestBlock();
                editor.focus();
              })}
            />
            <MenuePunkt
              icon="einruecken"
              text="Einrücken (Tab)"
              aus={!z.ein}
              onKlick={tun(() => {
                editor.nestBlock();
                editor.focus();
              })}
            />
            <MenuePunkt
              icon="zitat"
              text="Zitat"
              aktiv={z.art === 'quote'}
              aus={!textart}
              onKlick={tun(umschalten('quote'))}
            />
          </>
        );
      }}
    </Menue>
  );

  const einfuegen = (
    <Menue titel="Einfügen" mitWort={!handy} zeichen={handy && <Icon name="plus" size={18} />}>
      {(zu) => (
        <>
          {EIGENE.map((e) => (
            <MenuePunkt
              key={e.art}
              icon={e.icon}
              text={e.titel}
              aktiv={z.typ === e.art}
              aus={!textart && z.typ !== e.art && !EIGENE.some((x) => x.art === z.typ)}
              onKlick={() => {
                zu();
                eigeneArt(editor, e.art);
              }}
            />
          ))}
          <MenuePunkt
            icon="tabelle"
            text="Tabelle"
            onKlick={() => {
              zu();
              tabelleEinfuegen(editor);
            }}
          />
          {FESTE.map((f) => (
            <MenuePunkt
              key={f.art}
              icon={f.icon}
              text={FESTE_PUNKTE[f.art].titel}
              onKlick={() => {
                zu();
                festenPunktEinfuegen(editor, f.art);
              }}
            />
          ))}
          <MenuePunkt
            icon="trennlinie"
            text="Trennlinie"
            onKlick={() => {
              zu();
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
        </>
      )}
    </Menue>
  );

  if (handy) {
    return (
      <div className={styles.leiste} role="toolbar" aria-label="Formatierung">
        {rueckgaengig}
        <div className={styles.gruppe}>
          {fett}
          <Menue titel="Text" zeichen={<b className={styles.aa}>Aa</b>}>
            {(zu) => {
              const tun = (f: () => void) => () => {
                zu();
                f();
              };
              return (
                <>
                  <Abschnitt>Textart</Abschnitt>
                  {wahl.map((t) => (
                    <MenuePunkt
                      key={t}
                      text={textartText(t)}
                      aktiv={z.art === t}
                      aus={!textart}
                      onKlick={tun(() => artSetzen(editor, t))}
                    />
                  ))}
                  <Abschnitt>Schrift</Abschnitt>
                  <MenuePunkt
                    zeichen={<i>I</i>}
                    text="Kursiv"
                    aktiv={z.kursiv}
                    aus={!z.mitText}
                    onKlick={tun(stil('italic'))}
                  />
                  <MenuePunkt
                    zeichen={<u>U</u>}
                    text="Unterstrichen"
                    aktiv={z.unter}
                    aus={!z.mitText}
                    onKlick={tun(stil('underline'))}
                  />
                  <MenuePunkt
                    zeichen={<s>S</s>}
                    text="Durchgestrichen"
                    aktiv={z.durch}
                    aus={!z.mitText}
                    onKlick={tun(stil('strike'))}
                  />
                  <MenuePunkt
                    icon="format-weg"
                    text="Formatierung entfernen"
                    aus={!z.mitText}
                    onKlick={tun(formatWeg)}
                  />
                </>
              );
            }}
          </Menue>
        </div>
        <div className={styles.gruppe}>
          {markieren}
          {absatz}
          {einfuegen}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.leiste} role="toolbar" aria-label="Formatierung">
      {rueckgaengig}
      <select
        className={styles.textart}
        aria-label="Textart"
        value={textart}
        disabled={!textart}
        onChange={(e) => istTextart(e.target.value) && artSetzen(editor, e.target.value)}
      >
        {!textart && <option value="">–</option>}
        {wahl.map((t) => (
          <option key={t} value={t}>
            {textartText(t)}
          </option>
        ))}
      </select>
      <div className={styles.gruppe}>
        {fett}
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
          titel="Formatierung entfernen"
          icon="format-weg"
          aus={!z.mitText}
          onKlick={formatWeg}
        />
      </div>
      <div className={styles.gruppe}>
        {markieren}
        {absatz}
        {einfuegen}
      </div>
    </div>
  );
}
