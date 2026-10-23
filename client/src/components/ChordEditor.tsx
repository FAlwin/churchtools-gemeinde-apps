import { useCallback, useEffect, useRef, useState } from 'react';
import { ChordProInput, type AkkordAntippen, type ChordProHandle } from './ChordProInput';
import { PdfPreview } from './PdfPreview';
import { Icon } from '@ui/icons/icons';
import { Spinner } from './Spinner';
import { useOverlayKeyboardInset } from '@ui/fenster/useOverlayKeyboardInset';
import styles from './ChordEditor.module.scss';
import { shiftKey } from '../utils/transpose';
import { akkordVerschieben, flowSetzen, parseMetadata } from '../utils/chordpro';
import { AkkordMenue } from './AkkordMenue';
import { AkkordLeiste } from './AkkordLeiste';
import { AkkordFenster } from './AkkordFenster';
import { AblaufKarte } from './AblaufKarte';
import { getLiedansicht } from '../utils/devicePrefs';
import { useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { Segment } from '@ui/bedienung/Segment';

interface ChordEditorProps {
  songTitle: string;
  initialText: string;
  initialName: string;
  isNew: boolean;
  saving: boolean;
  error: string | null;
  onSave: (text: string, name: string) => void;
  onDelete?: () => void;
  onClose: () => void;
  /**
   * Das Feld „Versionsname" zeigen? Standard ja – der Editor legt sonst eigene Fassungen `(App)` an.
   * `false`, wenn das **Original**-Notenblatt geschrieben wird (Editor nach dem Anlegen, 04.09.2026):
   * Ein Original hat keinen Versionsnamen, das Feld wäre eine Frage ohne Antwort.
   */
  mitVersionsname?: boolean;
  /**
   * Die Tonart, in der der Text im Editor steht (#398) – wird über dem Text angesagt. Mit `kapo`
   * zusätzlich die gegriffene Tonart, damit niemand rätselt, warum das Blatt andere Akkorde zeigt.
   * Fehlt `tonart`, gibt es keine Zeile (Original-Notenblatt aus dem Stammdaten-Blatt).
   */
  tonart?: string;
  kapo?: number;
}

// Format-Bausteine (echte ChordPro-Direktiven, chordpro.org) mit deutscher Erklärung.
// `value` = mit Doppelpunkt-Wert. Hinweis: comment, flow, title/artist/key/tempo/time und `----` wirken in
// der App-Vorschau; die übrigen sind gültiges ChordPro und werden gespeichert (SongSelect/andere Tools).
// `art` = Baustein mit eigener Einfüge-Regel statt „an der Cursorstelle" (#606).
// Den Ablauf (`{flow}`) setzt seit L2 die Ablauf-Karte, nicht mehr dieses Menü.
const FORMATS: { tag: string; label: string; value: boolean; art?: 'trenner' }[] = [
  { tag: 'comment', label: 'Abschnitt / Überschrift', value: true },
  { tag: '----', label: 'Weiterschalt-Punkt fürs Pedal', value: false, art: 'trenner' },
  { tag: 'title', label: 'Titel des Lieds', value: true },
  { tag: 'subtitle', label: 'Untertitel', value: true },
  { tag: 'artist', label: 'Interpret / Künstler', value: true },
  { tag: 'key', label: 'Tonart', value: true },
  { tag: 'capo', label: 'Kapo (Bund)', value: true },
  { tag: 'tempo', label: 'Tempo (BPM)', value: true },
  { tag: 'time', label: 'Taktart', value: true },
  { tag: 'ccli', label: 'CCLI-Nummer', value: true },
  { tag: 'copyright', label: 'Copyright', value: true },
  { tag: 'column_break', label: 'Neue Spalte beginnen', value: false },
  { tag: 'new_page', label: 'Neuer Seitenumbruch', value: false },
];

/** Was am schmalen Bildschirm zu sehen ist – breit stehen Text und Vorschau nebeneinander. */
type Bereich = 'text' | 'ablauf' | 'vorschau';

/** Vollbild-Editor für eine ChordPro-Version: CodeMirror mit Syntax-Farben, Akkord-Leiste (L5),
 *  Format-Menü, Rückgängig/Wiederholen und eine „wie gedruckt"-PDF-Vorschau mit Transponieren.
 *
 *  **Aufbau seit L1 (neuer Lied-Editor, 22.10.2026, Entwurf C):** Kopf im ChurchTools-Look (weiß,
 *  Titel + Fassung + Tonart), darunter Karten – breit Text links und Vorschau rechts, schmal ein
 *  Umschalter „Text | Vorschau“. Bauplan: `gemeinde-apps/musik-planung/docs/bauplan-lied-editor.md`. */
export function ChordEditor({
  songTitle,
  initialText,
  initialName,
  isNew,
  saving,
  error,
  onSave,
  onDelete,
  onClose,
  mitVersionsname = true,
  tonart,
  kapo = 0,
}: ChordEditorProps) {
  const [text, setText] = useState(initialText);
  const [name, setName] = useState(initialName);
  const [semitones, setSemitones] = useState(0);
  const [zuletzt, setZuletzt] = useState<string[]>([]); // nur in dieser Sitzung
  const [openMenu, setOpenMenu] = useState<'format' | null>(null);
  // „Anderer Akkord“ (neu) oder „Ändern“ eines angetippten Kärtchens (`ziel` = seine Stelle im Text).
  const [akkordFenster, setAkkordFenster] = useState<{ ziel?: AkkordAntippen } | null>(null);
  // Angetipptes Akkord-Kärtchen (L5-2): Menü ← → Ändern Entfernen.
  const [menue, setMenue] = useState<AkkordAntippen | null>(null);
  const menueZu = useCallback(() => setMenue(null), []);
  // Das angetippte Kärtchen umrahmen, solange sein Menü offen ist.
  const markiert = menue ? `${menue.von}-${menue.bis}` : '';
  useEffect(() => {
    const [von, bis] = markiert.split('-').map(Number);
    editorRef.current?.markieren(markiert ? { von, bis } : null);
  }, [markiert]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [bereich, setBereich] = useState<Bereich>('text');
  // L3: Kärtchen und Bänder – oder der rohe ChordPro-Text für alle, die ihn direkt bearbeiten wollen.
  const [roh, setRoh] = useState(false);
  const wide = useMedienAbfrage('(min-width: 768px)', true);
  const editorRef = useRef<ChordProHandle>(null);
  // Die Vorschau zeigt das Blatt so, wie es im Liederheft dieses Geräts erscheint (#607).
  const [rolle] = useState(() => getLiedansicht() === 'scrollen');
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Ohne Versionsname-Feld (Original-Notenblatt) darf der fehlende Name nicht sperren – sonst ist
  // Speichern dauerhaft grau. Im Browser gefunden (04.09.2026), 1034 grüne Tests hatten den Editor gemockt.
  const canSave = (!mitVersionsname || name.trim().length > 0) && text.trim().length > 0;
  const transposeLabel = semitones === 0 ? '±0' : semitones > 0 ? `+${semitones}` : `${semitones}`;
  // Breit stehen Text und Vorschau nebeneinander; schmal zeigt der Umschalter eines von beiden.
  const showEditor = wide || bereich === 'text';
  const showAblauf = wide || bereich === 'ablauf';
  const showPreview = wide || bereich === 'vorschau';

  // iOS-Tastatur: Der Overlay bleibt VOLLBILD (fixed, inset 0) – so schimmert hinter der
  // halbtransparenten Tastatur nichts von der dahinterliegenden Ansicht durch. Statt den Overlay
  // zu verschieben (das „sprang" sichtbar), bekommt er unten einen Innenabstand in Höhe der
  // Tastatur (--kb) → Kopf-/Werkzeugleiste bleiben stehen, nur der intern scrollende
  // Editor-Bereich wird kürzer. Die Mechanik liegt in `useOverlayKeyboardInset` (seit #207 gemeinsam mit
  // den Dialogen genutzt, damit die Kopien nicht auseinanderlaufen).
  const overlayRef = useOverlayKeyboardInset();

  // Menüs bei Klick außerhalb schließen
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: PointerEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [openMenu]);

  /**
   * Akkord an der Cursorstelle einfügen (L5) – und für „Im Lied“ vorne merken. Ist ein Kärtchen angetippt (L5-2),
   * wird stattdessen DIESES ersetzt (wie im Entwurf: Kärtchen antippen, anderen Akkord in der Leiste wählen).
   */
  function akkordSetzen(akkord: string, ziel: AkkordAntippen | null = menue) {
    if (ziel) {
      editorRef.current?.aendern(ziel.von, ziel.bis, `[${akkord}]`);
      setMenue(null);
    } else editorRef.current?.insert(`[${akkord}]`);
    setZuletzt((z) => [akkord, ...z.filter((a) => a !== akkord)].slice(0, 8));
  }
  /** Das angetippte Kärtchen eine Stelle weiter – das Menü wandert mit (mehrmals tippen geht). */
  function schieben(richtung: -1 | 1) {
    if (!menue) return;
    const a = akkordVerschieben(text, menue.von, menue.bis, richtung);
    if (!a) return;
    editorRef.current?.aendern(a.from, a.to, a.insert);
    const ort = editorRef.current?.stelle(a.neuVon);
    setMenue({
      ...menue,
      von: a.neuVon,
      bis: a.neuVon + (menue.bis - menue.von),
      ...(ort ?? {}),
    });
  }
  // Die Tonart, in der die Akkorde stehen: vom Aufrufer, sonst aus `{key}` des Texts.
  const textTonart = tonart ?? parseMetadata(text).key;
  /** Ablauf-Karte (L2): die Kärtchen-Reihenfolge als EINE Änderung am Text – Rückgängig inklusive. */
  function ablaufSetzen(eintraege: string[]) {
    const a = flowSetzen(text, eintraege);
    if (a) editorRef.current?.aendern(a.from, a.to, a.insert);
  }
  function pickFormat(f: (typeof FORMATS)[number]) {
    setOpenMenu(null);
    if (f.art === 'trenner') {
      editorRef.current?.insert('----', { block: true });
      return;
    }
    if (f.value) editorRef.current?.insert(`{${f.tag}: }`, { block: true, caretBack: 1 });
    else editorRef.current?.insert(`{${f.tag}}`, { block: true });
  }

  return (
    <div ref={overlayRef} className={styles.overlay}>
      <header className={styles.kopf}>
        <button className={styles.abbrechen} onClick={onClose} disabled={saving}>
          Abbrechen
        </button>
        <div className={styles.kopfText}>
          <span className={styles.title}>{songTitle}</span>
          {/* Die Tonart, in der der Text steht – dieselbe wie im Kopf des Blatts (#398). Was hier
              gespeichert wird, steht in genau dieser Tonart; die Vorschau beginnt bei ±0. */}
          {tonart && (
            <span className={styles.tonartZeile}>
              Tonart <strong>{tonart}</strong>
              {kapo > 0 && (
                <>
                  {' '}
                  · mit Kapo {kapo} gegriffen als <strong>{shiftKey(tonart, -kapo)}</strong>
                </>
              )}
            </span>
          )}
        </div>
        {!isNew && onDelete && (
          <button
            className={styles.iconBtn}
            onClick={onDelete}
            disabled={saving}
            title="Diese Version löschen"
            aria-label="Diese Version löschen"
          >
            <Icon name="trash" size={18} stroke={2} />
          </button>
        )}
        <button
          className={styles.save}
          onClick={() => onSave(text, name.trim())}
          disabled={saving || !canSave}
        >
          {saving ? <Spinner /> : 'Speichern'}
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {!wide && (
        <Segment
          verbunden
          className={styles.umschalter}
          ariaLabel="Ansicht"
          value={bereich}
          onChange={setBereich}
          options={[
            { value: 'text', label: 'Text' },
            { value: 'ablauf', label: 'Ablauf' },
            { value: 'vorschau', label: 'Vorschau' },
          ]}
        />
      )}

      <div className={styles.inhalt}>
        {/* Breit: links Ablauf + Text untereinander. Schmal: Ablauf als eigener Bereich (L2). */}
        <div
          className={`${styles.links}${showEditor || showAblauf ? '' : ' ' + styles.paneHidden}`}
        >
          {showAblauf && <AblaufKarte text={text} setzen={ablaufSetzen} kompakt={!wide} />}
          {/* Die Text-Karte bleibt immer gemountet (Verlauf/Cursor erhalten), nur ausgeblendet. */}
          <section
            aria-label="Text"
            className={`${styles.karte} ${styles.textKarte}${showEditor ? '' : ' ' + styles.paneHidden}`}
          >
            {mitVersionsname && (
              <div className={styles.kartenKopf}>
                <label className={styles.fassung} htmlFor="versionName">
                  Fassung
                </label>
                <input
                  id="versionName"
                  className={styles.nameInput}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name, z. B. Akustik oder Jugend"
                  aria-label="Versionsname"
                  maxLength={60}
                  spellCheck={false}
                />
              </div>
            )}

            {/* Eingabe-Toolbar */}
            <div className={styles.toolbar} ref={toolbarRef}>
              <div className={styles.dd}>
                <button
                  className={styles.ddBtn}
                  onClick={() => setOpenMenu((m) => (m === 'format' ? null : 'format'))}
                  aria-expanded={openMenu === 'format'}
                >
                  Format ▾
                </button>
                {openMenu === 'format' && (
                  <div className={`${styles.ddPanel} ${styles.ddPanelWide}`}>
                    {FORMATS.map((f) => (
                      <button key={f.tag} className={styles.ddFormat} onClick={() => pickFormat(f)}>
                        <span className={styles.ddFormatLabel}>{f.label}</span>
                        <code className={styles.ddFormatTag}>{f.tag}</code>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className={`${styles.rohKnopf}${roh ? ' ' + styles.rohAn : ''}`}
                aria-pressed={roh}
                onClick={() => setRoh((r) => !r)}
                title="Den Text so zeigen, wie er gespeichert wird – mit [Akkorden] und {Angaben}"
              >
                ChordPro-Text
              </button>
              {/* Rückgängig/Wiederholen gehören zum Text – hier statt im Kopf, damit der Titel am Handy Platz hat. */}
              <div className={styles.verlauf}>
                <button
                  className={styles.iconBtn}
                  onClick={() => editorRef.current?.undo()}
                  disabled={!canUndo}
                  title="Rückgängig"
                  aria-label="Rückgängig"
                >
                  <Icon name="undo" size={18} stroke={2} />
                </button>
                <button
                  className={styles.iconBtn}
                  onClick={() => editorRef.current?.redo()}
                  disabled={!canRedo}
                  title="Wiederholen"
                  aria-label="Wiederholen"
                >
                  <Icon name="redo" size={18} stroke={2} />
                </button>
              </div>
            </div>
            <AkkordLeiste
              tonart={textTonart}
              text={text}
              zuletzt={zuletzt}
              waehlen={akkordSetzen}
              anderer={() => {
                // Mit angetipptem Kärtchen ersetzt auch „Anderer Akkord“ dieses Kärtchen – wie die Leiste.
                setAkkordFenster({ ziel: menue ?? undefined });
                setMenue(null);
              }}
            />

            <div className={styles.editPane}>
              <ChordProInput
                ref={editorRef}
                initialText={initialText}
                roh={roh}
                onChange={setText}
                onAkkord={setMenue}
                onHistory={(u, r) => {
                  setCanUndo(u);
                  setCanRedo(r);
                }}
              />
            </div>
          </section>
        </div>

        {showPreview && (
          <section aria-label="Vorschau" className={`${styles.karte} ${styles.previewPane}`}>
            <div className={styles.previewHead}>
              <span className={styles.paneLbl}>Vorschau</span>
              <div className={styles.transpose}>
                <span className={styles.tLbl}>Transponieren</span>
                <button
                  className={styles.tBtn}
                  onClick={() => setSemitones((s) => Math.max(-11, s - 1))}
                  aria-label="Tiefer transponieren"
                >
                  −
                </button>
                <button
                  className={styles.tVal}
                  onClick={() => setSemitones(0)}
                  title="Zurücksetzen"
                >
                  {transposeLabel}
                </button>
                <button
                  className={styles.tBtn}
                  onClick={() => setSemitones((s) => Math.min(11, s + 1))}
                  aria-label="Höher transponieren"
                >
                  +
                </button>
              </div>
            </div>
            <PdfPreview title={songTitle} text={text} semitones={semitones} rolle={rolle} />
          </section>
        )}
      </div>
      {menue && (
        <AkkordMenue
          name={menue.name}
          x={menue.x}
          y={menue.y}
          kannLinks={!!akkordVerschieben(text, menue.von, menue.bis, -1)}
          kannRechts={!!akkordVerschieben(text, menue.von, menue.bis, 1)}
          links={() => schieben(-1)}
          rechts={() => schieben(1)}
          aendern={() => {
            setAkkordFenster({ ziel: menue });
            setMenue(null);
          }}
          entfernen={() => {
            editorRef.current?.aendern(menue.von, menue.bis, '');
            setMenue(null);
          }}
          schliessen={menueZu}
        />
      )}
      {akkordFenster && (
        <AkkordFenster
          start={akkordFenster.ziel?.name}
          knopf={akkordFenster.ziel ? 'Übernehmen' : 'Einfügen'}
          grundton={textTonart?.replace(/m$/, '') || undefined}
          fertig={(a) => {
            akkordSetzen(a, akkordFenster.ziel ?? null);
            setAkkordFenster(null);
          }}
          onClose={() => setAkkordFenster(null)}
        />
      )}
    </div>
  );
}
