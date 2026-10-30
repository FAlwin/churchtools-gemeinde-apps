import { useCallback, useEffect, useRef, useState } from 'react';
import { ChordProInput, type AkkordAntippen, type ChordProHandle } from './ChordProInput';
import { PdfPreview } from './PdfPreview';
import { Icon } from '@ui/icons/icons';
import { Spinner } from './Spinner';
import { useOverlayKeyboardInset } from '@ui/fenster/useOverlayKeyboardInset';
import styles from './ChordEditor.module.scss';
import { shiftKey } from '../utils/transpose';
import { akkordVerschieben, flowSetzen, neuerTeilName, parseMetadata } from '../utils/chordpro';
import { AkkordMenue } from './AkkordMenue';
import { AkkordLeiste } from './AkkordLeiste';
import { AkkordFenster } from './AkkordFenster';
import { AblaufKarte } from './AblaufKarte';
import { EinfuegenMenue } from './EinfuegenMenue';
import type { Einfuegen } from '../utils/einfuegen';
import { getLiedansicht } from '../utils/devicePrefs';
import { useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { useTastaturOffen } from '@ui/fenster/useTastaturOffen';
import { Segment } from '@ui/bedienung/Segment';
import { liedinfoZeilenEntfernen } from '@shared/ct/liedinfo';
import type { LiedinfoVergleich } from '@shared/ct/liedinfo';
import { LiedinfoKarte } from './LiedinfoKarte';
import {
  liedinfoAusFormular,
  liedinfoSpeichern,
  liedinfoStart,
  type LiedinfoFormular,
  type LiedinfoQuelle,
} from '../utils/liedinfoFormular';

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
  /**
   * **Liedinfo aus ChurchTools** (L4): Lied-Stammdaten und Arrangement. Lädt die aufrufende Seite; solange sie fehlt,
   * gibt es keinen Bereich „Liedinfo“ und die Kopfzeilen bleiben im Text sichtbar.
   */
  liedinfo?: LiedinfoQuelle;
}

/** Was am schmalen Bildschirm zu sehen ist – breit stehen Text und Vorschau nebeneinander. */
type Bereich = 'text' | 'ablauf' | 'vorschau' | 'infos';

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
  liedinfo,
}: ChordEditorProps) {
  const [text, setText] = useState(initialText);
  const [name, setName] = useState(initialName);
  const [semitones, setSemitones] = useState(0);
  const [zuletzt, setZuletzt] = useState<string[]>([]); // nur in dieser Sitzung
  const [openMenu, setOpenMenu] = useState<'einfuegen' | null>(null);
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
  // „Nur Text“ (29.10.2026, Entwurf Variante B): Akkorde unsichtbar, nur Text und Zeilen bearbeiten – dieselben zwei
  // Wörter wie unter „Anzeige“ im Lied-Menü. Gilt für diese Bearbeitung; beim nächsten Öffnen wieder mit Akkorden.
  const [nurText, setNurText] = useState(false);
  const wide = useMedienAbfrage('(min-width: 768px)', true);
  // **Schreibansicht** (23.10.2026, Alwin am iPad: „das Bearbeitungsfenster ist bei aufgeklappter Tastatur deutlich
  // zu klein“, Entwurf A): Solange im Text getippt wird, verschwinden Ablauf, Fassung und Umschalter, und Werkzeuge
  // und Akkorde rücken in EINE Zeile. Tastatur zu → alles wie vorher.
  const tastaturOffen = useTastaturOffen();
  const [textFokus, setTextFokus] = useState(false);
  // Beginnt, wenn im Text getippt wird, und endet erst, wenn die Tastatur zugeht – nicht schon, wenn der Text kurz
  // den Fokus verliert (ein Tipp auf einen Knopf kann ihn unter iOS nehmen, während die Tastatur offen bleibt; sonst
  // spränge die Ansicht mitten im Tippen zurück).
  const [schreiben, setSchreiben] = useState(false);
  useEffect(() => {
    if (!tastaturOffen) setSchreiben(false);
    else if (textFokus) setSchreiben(true);
  }, [tastaturOffen, textFokus]);
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
  // Breit: rechts umschaltbar „Vorschau | Liedinfo“ (Entwurf C); schmal: eigener Reiter „Infos“.
  const [rechts, setRechts] = useState<'vorschau' | 'liedinfo'>('vorschau');
  // Welches Feld der Liedinfo das Menü „Einfügen“ zuletzt angefordert hat (L6).
  const [liFokus, setLiFokus] = useState<{ feld: string; n: number } | null>(null);
  const [li, setLi] = useState<{
    formular: LiedinfoFormular;
    vergleich: LiedinfoVergleich[];
  } | null>(null);
  // Sobald die Stammdaten da sind: Formular aus ChurchTools, leere Felder aus der Datei vorbelegt. Verglichen wird
  // mit dem Text beim Öffnen – was danach getippt wird, ist keine „Datei“ mehr.
  useEffect(() => {
    if (liedinfo && !li) setLi(liedinfoStart(liedinfo, initialText));
  }, [liedinfo, li, initialText]);
  const [liLaeuft, setLiLaeuft] = useState(false);
  const [liFehler, setLiFehler] = useState<string | null>(null);
  /**
   * Speichern (L4-3): erst die Liedinfo nach ChurchTools, dann – mit dem Stand, den ChurchTools meldet – die
   * Kopfzeilen aus dem Text, dann der Text. Scheitert die Liedinfo, wird gar nichts gespeichert (`liedinfoSpeichern`).
   */
  async function speichern(): Promise<void> {
    setLiFehler(null);
    let fertig = text;
    if (li && liedinfo) {
      setLiLaeuft(true);
      try {
        fertig = await liedinfoSpeichern(li.formular, liedinfo, text);
      } catch (e) {
        setLiFehler(
          `Die Liedinfo wurde nicht gespeichert – das Notenblatt auch nicht: ${
            e instanceof Error ? e.message : 'unbekannter Fehler'
          }`,
        );
        return;
      } finally {
        setLiLaeuft(false);
      }
    }
    onSave(fertig, name.trim());
  }
  const zeigeInfo = !!li && (wide ? rechts === 'liedinfo' : bereich === 'infos');
  const showPreview = wide ? !zeigeInfo : bereich === 'vorschau';
  // Die Vorschau zeigt das Blatt, wie es NACH dem Speichern aussieht: Kopf aus der Liedinfo, deren Zeilen nicht mehr
  // in der Datei – dieselbe Regel wie beim Speichern (`liedinfoZeilenEntfernen`).
  const nachher = li && liedinfo?.darf ? liedinfoAusFormular(li.formular) : null;
  const vorschauText = nachher ? liedinfoZeilenEntfernen(text, nachher) : text;
  const vorschauKopf = li
    ? {
        author: li.formular.lied.author.trim(),
        bpm: Number(li.formular.arrangement.tempo) || null,
        timeSig: li.formular.arrangement.beat.trim(),
      }
    : undefined;

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
  /**
   * Menü „Einfügen“ (L6): Ein neuer Teil kommt HINTER die Zeile des Cursors (nicht mitten hinein) und bringt eine
   * leere Zeile mit, in der der Cursor steht; der Pedal-Halt und die übrigen Angaben wie bisher an den Cursor. Eine
   * Kopfangabe öffnet die Liedinfo bei ihrem Feld – ohne Liedinfo kommt sie wie früher als Angabe in den Text.
   */
  function einfuegen(e: Einfuegen) {
    setOpenMenu(null);
    if (e.art === 'liedinfo' && li) {
      if (wide) setRechts('liedinfo');
      else setBereich('infos');
      setLiFokus((f) => ({ feld: e.feld, n: (f?.n ?? 0) + 1 }));
      return;
    }
    const ed = editorRef.current;
    if (!ed) return;
    if (e.art === 'teil')
      ed.insert(`{comment: ${neuerTeilName(text, e.name)}}\n`, { block: true, amZeilenende: true });
    else if (e.art === 'pedal') ed.insert('----', { block: true });
    else if (e.art === 'liedinfo') ed.insert(`{${e.tag}: }`, { block: true, caretBack: 1 });
    else if (e.mitWert) ed.insert(`{${e.tag}: }`, { block: true, caretBack: 1 });
    else ed.insert(`{${e.tag}}`, { block: true });
  }

  // Knöpfe rund um den Text nehmen ihm den Fokus nicht – sonst ginge am iPad die Tastatur zu (und die
  // Schreibansicht mit ihr), bevor der Knopf überhaupt wirkt.
  const ohneFokus = (e: React.MouseEvent) => e.preventDefault();
  const akkordLeiste = (
    <AkkordLeiste
      kompakt={schreiben}
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
  );

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
          onClick={() => void speichern()}
          disabled={saving || liLaeuft || !canSave}
        >
          {saving || liLaeuft ? <Spinner /> : 'Speichern'}
        </button>
      </header>

      {(liFehler ?? error) && <div className={styles.error}>{liFehler ?? error}</div>}

      {!wide && !schreiben && (
        <Segment
          verbunden
          className={styles.umschalter}
          ariaLabel="Ansicht"
          value={bereich}
          onChange={setBereich}
          options={[
            { value: 'text', label: 'Text' },
            { value: 'ablauf', label: 'Ablauf' },
            ...(li ? [{ value: 'infos' as const, label: 'Infos' }] : []),
            { value: 'vorschau', label: 'Vorschau' },
          ]}
        />
      )}

      <div className={styles.inhalt}>
        {/* Breit: links Ablauf + Text untereinander. Schmal: Ablauf als eigener Bereich (L2). */}
        <div
          className={`${styles.links}${showEditor || showAblauf ? '' : ' ' + styles.paneHidden}`}
        >
          {showAblauf && !schreiben && (
            <AblaufKarte text={text} setzen={ablaufSetzen} kompakt={!wide} />
          )}
          {/* Die Text-Karte bleibt immer gemountet (Verlauf/Cursor erhalten), nur ausgeblendet. */}
          <section
            aria-label="Text"
            className={`${styles.karte} ${styles.textKarte}${showEditor ? '' : ' ' + styles.paneHidden}`}
          >
            {mitVersionsname && !schreiben && (
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
            <div
              className={`${styles.toolbar}${schreiben ? ' ' + styles.schreiben : ''}`}
              ref={toolbarRef}
            >
              {/* Wie im Entwurf B: der Umschalter vorn, dann Einfügen. */}
              {!schreiben && !roh && (
                <Segment
                  verbunden
                  ariaLabel="Darstellung"
                  className={styles.nurText}
                  value={nurText ? 'text' : 'akkorde'}
                  onChange={(w) => setNurText(w === 'text')}
                  options={[
                    { value: 'akkorde', label: 'Akkorde & Text' },
                    { value: 'text', label: 'Nur Text' },
                  ]}
                />
              )}
              <EinfuegenMenue
                offen={openMenu === 'einfuegen'}
                umschalten={() => setOpenMenu((m) => (m === 'einfuegen' ? null : 'einfuegen'))}
                waehlen={einfuegen}
                mitLiedinfo={!!li}
              />
              {schreiben && !nurText && akkordLeiste}

              {!schreiben && (
                <button
                  type="button"
                  className={`${styles.rohKnopf}${roh ? ' ' + styles.rohAn : ''}`}
                  aria-pressed={roh}
                  onClick={() => setRoh((r) => !r)}
                  title="Den Text so zeigen, wie er gespeichert wird – mit [Akkorden] und {Angaben}"
                >
                  ChordPro-Text
                </button>
              )}
              {/* Rückgängig/Wiederholen gehören zum Text – hier statt im Kopf, damit der Titel am Handy Platz hat. */}
              <div className={styles.verlauf}>
                <button
                  className={styles.iconBtn}
                  onMouseDown={ohneFokus}
                  onClick={() => editorRef.current?.undo()}
                  disabled={!canUndo}
                  title="Rückgängig"
                  aria-label="Rückgängig"
                >
                  <Icon name="undo" size={18} stroke={2} />
                </button>
                <button
                  className={styles.iconBtn}
                  onMouseDown={ohneFokus}
                  onClick={() => editorRef.current?.redo()}
                  disabled={!canRedo}
                  title="Wiederholen"
                  aria-label="Wiederholen"
                >
                  <Icon name="redo" size={18} stroke={2} />
                </button>
              </div>
            </div>
            {!schreiben && !nurText && akkordLeiste}

            <div className={styles.editPane}>
              <ChordProInput
                ref={editorRef}
                initialText={initialText}
                roh={roh}
                nurText={nurText}
                onChange={setText}
                onAkkord={setMenue}
                onFokus={setTextFokus}
                kopfAusblenden={!!li && !!liedinfo?.darf}
                onHistory={(u, r) => {
                  setCanUndo(u);
                  setCanRedo(r);
                }}
              />
            </div>
          </section>
        </div>

        {(showPreview || zeigeInfo) && (
          <div className={styles.rechts}>
            {wide && li && (
              <Segment
                verbunden
                ariaLabel="Rechte Spalte"
                value={rechts}
                onChange={setRechts}
                options={[
                  { value: 'vorschau', label: 'Vorschau' },
                  { value: 'liedinfo', label: 'Liedinfo' },
                ]}
              />
            )}
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
                <PdfPreview
                  title={li ? li.formular.lied.name.trim() || songTitle : songTitle}
                  text={vorschauText}
                  semitones={semitones}
                  rolle={rolle}
                  kopf={vorschauKopf}
                />
              </section>
            )}
            {zeigeInfo && li && liedinfo && (
              <div className={styles.infoPane}>
                <LiedinfoKarte
                  formular={li.formular}
                  vergleich={li.vergleich}
                  darf={liedinfo.darf}
                  aendern={(formular) => setLi({ ...li, formular })}
                  fokus={liFokus}
                />
              </div>
            )}
          </div>
        )}
      </div>
      {menue && (
        <AkkordMenue
          name={menue.name}
          x={menue.x}
          y={menue.y}
          oben={menue.oben}
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
