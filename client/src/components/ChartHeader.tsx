import type { HeadInfoPart } from '../utils/activeSongView';
import { BpmPulse } from './BpmPulse';
import { Icon } from './icons';
import { RundKnopf, ZurueckKnopf } from './KnopfReihe';
import { WerkzeugMenu, type Werkzeug } from './WerkzeugMenu';
import styles from '../pages/ChordChart.module.scss';

/**
 * Die ANDERE Hälfte im Querformat (#421): ein zweites sichtbares Lied neben dem aktiven. Ihr Tipp
 * macht dieses Lied zum aktiven – für Werkzeuge, Anmerken und Lied-Menü.
 */
export interface AndereHaelfte {
  /** Links (0) oder rechts (1) – die aktive Kapsel steht auf der jeweils anderen Seite. */
  slot: 0 | 1;
  titel: string;
  info: HeadInfoPart[];
  onWaehlen: () => void;
}

/**
 * Die Kopfzeile der Lied-Anzeige (#314 – vorher inline in `pages/ChordChart.tsx`).
 *
 * Links zurück, daneben der Lied-Knopf mit Info-Zeile, rechts **ein** runder Knopf für alle
 * Werkzeuge (02.10.2026, Alwin: „Ein Knopf für alles"). Der Kopf liegt unter dem Unschärfe-Band von
 * iOS 26/27 – vorher stand er darin und war milchig, auch die Symbole. Der Werkzeuge-Knopf zeigt den
 * Zustand, den früher die einzelnen Knöpfe zeigten: blau, solange Puls oder Klick laufen; beim
 * Zeichnen wird er zum Haken „Anmerken beenden", beim Ansehen fremder Notizen zum Personen-Knopf
 * zurück zu den eigenen – sonst gäbe es aus beiden Modi keinen sichtbaren Ausweg mehr.
 *
 * Welche Werkzeuge im Menü erscheinen, hängt an drei Zuständen, die sich gegenseitig ausschließen:
 *
 *  - **Ein Dokument statt Akkorden** → „Aussehen" und Team-Notizen entfallen; beide wirken auf den
 *    ChordPro-Satz, den es hier nicht gibt.
 *  - **Fremde Notizen ansehen** → Titel-Menü und Stift sind gesperrt. Man sieht gerade nicht die
 *    eigene Ebene; ein Strich würde dort landen, wo man ihn nicht erwartet.
 *  - **Reingezoomt** → nur dann gibt es überhaupt etwas zurückzusetzen.
 */
interface ChartHeaderProps {
  songTitle: string;
  /**
   * Querformat mit zwei verschiedenen Liedern nebeneinander: Dann steht über JEDER Hälfte eine
   * Titel-Kapsel (#421, Entwurf mit Alwin 03.10.2026) – die aktive hervorgehoben, die andere
   * zurückgenommen. Ohne diese Angabe gibt es eine Kapsel wie bisher.
   */
  andereHaelfte?: AndereHaelfte | null;
  /** Info-Zeile aus `deriveActiveSongView` – reine Daten, die Klassen setzt diese Komponente. */
  headInfo: HeadInfoPart[];
  /** Lied-Menü offen (für `aria-expanded`). */
  menuOpen: boolean;
  /** Es werden gerade fremde Notizen angesehen. */
  viewing: boolean;
  /** Statt der Akkorde wird ein hochgeladenes Dokument gezeigt. */
  showsDocument: boolean;
  canUseGlobalNotes: boolean;
  drawMode: boolean;
  /** Eine sichtbare Seite ist reingezoomt. */
  zoomed: boolean;
  /** Läuft der Tempo-Puls? (#145) – färbt den Punkt neben der Tempo-Angabe. */
  bpmPulse: boolean;
  /**
   * EINGESTELLTES Tempo (aus dem Tempo-Menü). Weicht es vom gespeicherten ab, gilt es hier: Anzeige
   * und Puls folgen dem, was gerade eingestellt ist – sonst zeigte die Kopfzeile eine Zahl und der
   * Puls schlüge eine andere. `null` heißt „wie im Lied".
   */
  pulsBpm: number | null;
  /** GEZÄHLTES Tempo – damit schlägt der Puls (bei Dreiergruppen ein Drittel des angezeigten). */
  klickBpm: number | null;
  /** Nullpunkt des gemeinsamen Takt-Rasters (`performance.now()`-ms) – Puls und Klick teilen ihn. */
  taktStartMs: number | null;
  /** Länge des Takts in GEZÄHLTEN Schlägen – der Puls markiert damit die Eins. */
  schlaegeProTakt: number;
  /** Ist das Werkzeuge-Menü offen? */
  werkzeugeOffen: boolean;
  /**
   * Ist ein Fenster offen, das über den Werkzeuge-Knopf geht (Menü, Aussehen, Tempo)? Dann ist der
   * Knopf hellblau hinterlegt – man sieht, woher das offene Fenster kommt (Alwin, 02.10.2026).
   */
  werkzeugFensterOffen: boolean;
  /** Dasselbe für die Titel-Kapsel: Lied-Menü oder eines seiner Fenster (Tonart, Kapo, Dateien …) offen. */
  liedFensterOffen: boolean;
  /** Läuft irgendetwas Tempo-Bezogenes (Puls oder Klick)? Färbt den Metronom-Knopf. */
  tempoAktiv: boolean;
  onBack: () => void;
  onToggleMenu: () => void;
  onToggleWerkzeuge: () => void;
  onCloseWerkzeuge: () => void;
  /**
   * Die Werkzeuge. **Jeder Aufruf schaltet das Fenster selbst um** – das Menü ruft danach NICHT
   * noch `onCloseWerkzeuge`. Alle Fenster teilen sich ein Zustandsfeld (`overlay`); ein Schließen
   * hinterher setzte das gerade geöffnete Fenster sofort wieder zurück (Lehre vom 05.08.2026).
   */
  onAppearance: () => void;
  onTempo: () => void;
  onResetZoom: () => void;
  onToggleTeamNotes: () => void;
  onToggleDraw: () => void;
}

export function ChartHeader({
  songTitle,
  andereHaelfte = null,
  headInfo,
  menuOpen,
  viewing,
  showsDocument,
  canUseGlobalNotes,
  drawMode,
  zoomed,
  bpmPulse,
  pulsBpm,
  klickBpm,
  taktStartMs,
  schlaegeProTakt,
  werkzeugeOffen,
  werkzeugFensterOffen,
  liedFensterOffen,
  tempoAktiv,
  onBack,
  onToggleMenu,
  onToggleWerkzeuge,
  onCloseWerkzeuge,
  onAppearance,
  onTempo,
  onResetZoom,
  onToggleTeamNotes,
  onToggleDraw,
}: ChartHeaderProps) {
  /**
   * Tempo-Angabe samt Puls. Als Funktion, weil sie an ZWEI Stellen gebraucht wird: im Teil, den das
   * Lied mitbringt, und – wenn das Lied gar keins hat – als eigener Teil für ein nur eingestelltes.
   * Zweimal ausgeschrieben wäre genau die Art Dopplung, bei der später eine Hälfte nachgezogen wird
   * und die andere nicht.
   */
  const tempoAnzeige = (bpm: number) => (
    <>
      <Icon name="metronome" size={15} stroke={1.9} className={styles.infoMetronom} />
      {bpm}
      {/* Angezeigt werden die GRUNDSCHLÄGE (so steht es auch in ChurchTools), gepulst wird im
          GEZÄHLTEN Tempo: Wer in Dreiergruppen zählt, sieht zwei Blitze je Takt und nicht sechs. */}
      <BpmPulse
        bpm={klickBpm ?? bpm}
        active={bpmPulse}
        taktStartMs={taktStartMs}
        schlaegeProTakt={schlaegeProTakt}
      />
    </>
  );

  /**
   * Hat das Lied selbst ein Tempo? Wenn nicht, steht in `headInfo` kein Tempo-Teil – dann fehlten
   * bislang Anzeige UND Puls, obwohl im Menü längst eins eingestellt war und der Klick damit lief.
   * Gemeldet: „Der Puls wird erst sichtbar, wenn ich in ChurchTools gespeichert habe."
   */
  const hatEigenesTempo = headInfo.some((p) => p.art === 'bpm');

  /**
   * Die Werkzeuge im Menü – dieselben Bedingungen wie früher bei den einzelnen Knöpfen. Beim Zeichnen
   * und beim Ansehen fremder Notizen öffnet der Knopf das Menü gar nicht (siehe unten).
   */
  const werkzeuge: Werkzeug[] = [
    ...(!showsDocument
      ? [{ id: 'aussehen', label: 'Aussehen', symbol: <b>Aa</b>, onClick: onAppearance }]
      : []),
    // Tempo bewusst auch ohne gepflegtes Tempo (#145): Genau dann will man eins antippen.
    {
      id: 'tempo',
      label: 'Tempo',
      symbol: <Icon name="metronome" size={19} stroke={1.9} />,
      onClick: onTempo,
    },
    ...(zoomed
      ? [
          {
            id: 'zoom',
            label: 'Zoom zurücksetzen',
            symbol: <Icon name="zoom-reset" size={18} stroke={2} />,
            onClick: onResetZoom,
          },
        ]
      : []),
    ...(canUseGlobalNotes && !showsDocument
      ? [
          {
            id: 'team',
            label: 'Notizen von …',
            symbol: <Icon name="people" size={18} stroke={2} />,
            onClick: onToggleTeamNotes,
          },
        ]
      : []),
    {
      id: 'anmerken',
      label: 'Anmerken',
      symbol: <Icon name="pencil" size={18} stroke={2.2} />,
      onClick: onToggleDraw,
    },
  ];

  /** Der eine Knopf rechts – er zeigt, in welchem Modus man ist, und führt wieder heraus. */
  const werkzeugKnopf = drawMode ? (
    <RundKnopf onClick={onToggleDraw} title="Anmerken beenden" aktiv>
      <Icon name="check" size={20} stroke={2.6} />
    </RundKnopf>
  ) : viewing ? (
    <RundKnopf onClick={onToggleTeamNotes} title="Zurück zu den eigenen Notizen" aktiv>
      <Icon name="people" size={19} stroke={2} />
    </RundKnopf>
  ) : (
    <RundKnopf
      onClick={onToggleWerkzeuge}
      title="Werkzeuge"
      dataTour="chart-werkzeuge"
      aktiv={tempoAktiv}
      offen={werkzeugFensterOffen}
      menuOffen={werkzeugeOffen}
    >
      <Icon name="regler" size={21} stroke={2} />
    </RundKnopf>
  );

  /** Die Kapsel des AKTIVEN Lieds – öffnet das Lied-Menü, trägt Tempo und Puls. */
  const aktiveKapsel = (
    <button
      className={`${styles.menuBtn}${liedFensterOffen ? ' ' + styles.menuBtnOffen : ''}${
        andereHaelfte ? ' ' + styles.kapselAktiv : ''
      }`}
      data-tour="chart-lied"
      onClick={() => !viewing && onToggleMenu()}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
    >
      <span className={styles.menuTitleRow}>
        {/* Ohne kleinen ▾-Pfeil (Alwin, 02.10.2026) – die Kapsel selbst ist der Knopf. */}
        <span className={styles.songTitle}>{songTitle}</span>
      </span>
      {/* Auch dann zeigen, wenn das Lied selbst nichts mitbringt, aber ein Tempo eingestellt
                ist – sonst verschwände die frisch angetippte Angabe samt Puls wieder. */}
      {(headInfo.length > 0 || pulsBpm !== null) && (
        <span className={styles.menuInfo}>
          {headInfo.map((part, i) => (
            <span key={i} className={styles.menuInfoPart}>
              {i > 0 && <span className={styles.menuInfoDot}>·</span>}
              {part.art === 'key' && <span className={styles.infoKey}>{part.text}</span>}
              {part.art === 'capo' && <span className={styles.infoCapo}>{part.text}</span>}
              {part.art === 'bpm' && tempoAnzeige(pulsBpm ?? part.bpm)}
              {part.art === 'plain' && part.text}
            </span>
          ))}
          {!hatEigenesTempo && pulsBpm !== null && (
            <span className={styles.menuInfoPart}>
              {headInfo.length > 0 && <span className={styles.menuInfoDot}>·</span>}
              {tempoAnzeige(pulsBpm)}
            </span>
          )}
        </span>
      )}
    </button>
  );

  /**
   * Die Kapsel des ANDEREN sichtbaren Lieds (#421): zurückgenommen, ohne Puls (der gehört dem
   * aktiven). Ein Tipp wählt dieses Lied – mehr nicht; sein Menü öffnet erst der nächste Tipp.
   */
  const andereKapsel = andereHaelfte && (
    <button
      type="button"
      className={`${styles.menuBtn} ${styles.kapselInaktiv}`}
      onClick={andereHaelfte.onWaehlen}
      aria-label={`${andereHaelfte.titel} auswählen`}
    >
      <span className={styles.menuTitleRow}>
        <span className={styles.songTitle}>{andereHaelfte.titel}</span>
      </span>
      {andereHaelfte.info.length > 0 && (
        <span className={styles.menuInfo}>
          {andereHaelfte.info.map((part, i) => (
            <span key={i} className={styles.menuInfoPart}>
              {i > 0 && <span className={styles.menuInfoDot}>·</span>}
              {part.art === 'key' && <span className={styles.infoKey}>{part.text}</span>}
              {part.art === 'capo' && <span className={styles.infoCapo}>{part.text}</span>}
              {part.art === 'bpm' && (
                <>
                  <Icon name="metronome" size={15} stroke={1.9} className={styles.infoMetronom} />
                  {part.bpm}
                </>
              )}
              {part.art === 'plain' && part.text}
            </span>
          ))}
        </span>
      )}
    </button>
  );

  return (
    <>
      <div className={styles.hdr}>
        <ZurueckKnopf onClick={onBack} />
        {andereHaelfte ? (
          // Querformat, zwei Lieder: je Hälfte eine Kapsel, mittig über ihrem Blatt (#421).
          <div className={styles.kapselPaar}>
            {andereHaelfte.slot === 1 ? aktiveKapsel : andereKapsel}
            {andereHaelfte.slot === 1 ? andereKapsel : aktiveKapsel}
          </div>
        ) : (
          aktiveKapsel
        )}
        {werkzeugKnopf}
      </div>
      {werkzeugeOffen && !drawMode && !viewing && (
        <WerkzeugMenu werkzeuge={werkzeuge} onClose={onCloseWerkzeuge} />
      )}
    </>
  );
}
