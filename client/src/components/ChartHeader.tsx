import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { HeadInfoPart } from '../utils/activeSongView';
import { BpmPulse } from './BpmPulse';
import { Icon } from '@ui/icons/icons';
import { RundKnopf, ZurueckKnopf } from '@ui/bedienung/KnopfReihe';
import { WerkzeugMenu, type Werkzeug } from './WerkzeugMenu';
import { VollbildRundKnopf } from './VollbildKnopf';
import {
  WERKZEUG_NAME,
  verfuegbareWerkzeuge,
  werkzeugeEinzeln,
  type WerkzeugId,
} from '../utils/werkzeuge';
import styles from '../pages/ChordChart.module.scss';

function werkzeugSymbol(id: WerkzeugId): ReactNode {
  switch (id) {
    case 'aussehen':
      return <b>Aa</b>;
    case 'tempo':
      return <Icon name="metronome" size={19} stroke={1.9} />;
    case 'zoom':
      return <Icon name="zoom-reset" size={18} stroke={2} />;
    case 'team':
      return <Icon name="people" size={18} stroke={2} />;
    case 'anmerken':
      return <Icon name="pencil" size={18} stroke={2.2} />;
  }
}

/**
 * Die ANDERE Hälfte im Querformat (#421): ein zweites sichtbares Lied neben dem aktiven. Ihr Tipp
 * macht dieses Lied zum aktiven – für Werkzeuge, Anmerken und Lied-Menü.
 */
export interface AndereHaelfte {
  /** Links (0) oder rechts (1) – die aktive Kapsel steht auf der jeweils anderen Seite. */
  slot: 0 | 1;
  titel: string;
  info: HeadInfoPart[];
  /** Zeigt dieses Lied ein Dokument statt Akkorden? Dann fehlen Aussehen und Team-Notizen. */
  zeigtDokument: boolean;
  onWaehlen: () => void;
  /** Ein Werkzeug dieses Lieds: wählt das Lied UND öffnet das Werkzeug (Querformat, 03.10.2026). */
  onWerkzeug: (id: WerkzeugId) => void;
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
  /**
   * Querformat: Die Werkzeuge stehen EINZELN neben dem Titel (je Lied), nicht hinter dem einen
   * Werkzeuge-Knopf (Alwin, 03.10.2026). Im Hochformat entscheidet die Breite des Kopfs
   * (`werkzeugeEinzeln`, Alwin 05.10.2026): einzeln, solange der Titel genug Platz behält.
   */
  querformat?: boolean;
  /** Welches Werkzeug-Fenster gerade offen ist – färbt seinen einzelnen Knopf hellblau. */
  offenesWerkzeug?: 'aussehen' | 'tempo' | null;
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
  /**
   * Vollbild der ganzen App (nur Erweiterung, `useAppVollbild`). Ohne `onVollbild` kein Knopf – in
   * der Homescreen-App fehlt die ChurchTools-Leiste, die er verdecken könnte. **Kein Werkzeug:** Er
   * steht abgesetzt ganz rechts, auf jeder Seite an derselben Stelle, und wandert am iPhone NICHT ins
   * Werkzeug-Menü – man braucht ihn zum Ein- UND Ausschalten (Entwurf mit Alwin, 08.10.2026).
   */
  vollbildAn?: boolean;
  onVollbild?: () => void;
}

export function ChartHeader({
  songTitle,
  andereHaelfte = null,
  querformat = false,
  offenesWerkzeug = null,
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
  vollbildAn = false,
  onVollbild,
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

  /** Was ein Werkzeug des AKTIVEN Lieds tut. */
  const aktion: Record<WerkzeugId, () => void> = {
    aussehen: onAppearance,
    tempo: onTempo,
    zoom: onResetZoom,
    team: onToggleTeamNotes,
    anmerken: onToggleDraw,
  };
  const aktiveWerkzeuge = verfuegbareWerkzeuge({
    zeigtDokument: showsDocument,
    ansehen: viewing,
    gezoomt: zoomed,
    teamNotizen: canUseGlobalNotes,
  });

  /**
   * **Hochformat: einzeln oder hinter einem Knopf?** Gemessen an der echten Breite des Kopfs, laufend
   * (Alwin, 05.10.2026: im kleinen Stage-Manager-Fenster am iPad wie am iPhone). Knopfgröße und Abstand
   * kommen aus dem CSS, damit die Rechnung nicht eine zweite Zahl neben `--rundknopf` pflegt.
   * Vor der ersten Messung (und ohne Layout, etwa in jsdom) bleibt es beim einen Knopf.
   */
  const kopfRef = useRef<HTMLDivElement>(null);
  const [kopf, setKopf] = useState<{ breite: number; knopf: number; abstand: number } | null>(null);
  useLayoutEffect(() => {
    const el = kopfRef.current;
    if (!el) return;
    const messen = () => {
      const cs = getComputedStyle(el);
      const breite =
        el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      const knopf = parseFloat(cs.getPropertyValue('--rundknopf')) || 44;
      const abstand = parseFloat(cs.columnGap) || 8;
      setKopf((alt) =>
        alt && alt.breite === breite && alt.knopf === knopf && alt.abstand === abstand
          ? alt
          : { breite, knopf, abstand },
      );
    };
    messen();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const einzeln =
    querformat ||
    (kopf !== null &&
      werkzeugeEinzeln({
        kopfBreite: kopf.breite,
        knopf: kopf.knopf,
        abstand: kopf.abstand,
        // Der Vollbild-Knopf belegt rechts einen Platz wie ein Werkzeug.
        anzahl: aktiveWerkzeuge.length + (onVollbild ? 1 : 0),
      }));
  // Wird das Fenster breiter, während das Werkzeuge-Menü offen ist, verschwindet sein Knopf – dann
  // darf das Menü nicht ohne Knopf stehen bleiben.
  useEffect(() => {
    if (einzeln && werkzeugeOffen) onCloseWerkzeuge();
  }, [einzeln, werkzeugeOffen, onCloseWerkzeuge]);

  /**
   * Die Werkzeuge im Menü (Hochformat). Beim Zeichnen und beim Ansehen fremder Notizen öffnet der
   * Knopf das Menü gar nicht (siehe unten).
   */
  const werkzeuge: Werkzeug[] = aktiveWerkzeuge.map((id) => ({
    id,
    label: WERKZEUG_NAME[id],
    symbol: werkzeugSymbol(id),
    onClick: aktion[id],
  }));

  /** Die Werkzeuge des aktiven Lieds als einzelne runde Knöpfe, mit ihrem Zustand. */
  const aktiveKnoepfe = aktiveWerkzeuge.map((id) => (
    <RundKnopf
      key={id}
      title={id === 'anmerken' && drawMode ? 'Anmerken beenden' : WERKZEUG_NAME[id]}
      onClick={aktion[id]}
      aktiv={
        (id === 'tempo' && tempoAktiv) ||
        (id === 'team' && viewing) ||
        (id === 'anmerken' && drawMode)
      }
      offen={offenesWerkzeug === id}
    >
      {werkzeugSymbol(id)}
    </RundKnopf>
  ));

  /** Querformat: die Werkzeuge des ANDEREN Lieds – blass; ein Tipp wählt das Lied und öffnet sie. */
  const andereKnoepfe =
    andereHaelfte &&
    verfuegbareWerkzeuge({
      zeigtDokument: andereHaelfte.zeigtDokument,
      ansehen: false,
      gezoomt: false,
      teamNotizen: canUseGlobalNotes,
    }).map((id) => (
      <RundKnopf
        key={id}
        title={`${WERKZEUG_NAME[id]} – ${andereHaelfte.titel}`}
        onClick={() => andereHaelfte.onWerkzeug(id)}
        blass
      >
        {werkzeugSymbol(id)}
      </RundKnopf>
    ));

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

  /**
   * **Das Lied-Menü öffnet unter SEINEM Titel** (Alwin, 03.10.2026 – im Querformat stand es mittig
   * zwischen den Liedern). Die Mitte der aktiven Kapsel wird gemessen, sobald ein Lied-Fenster
   * aufgeht, und als `--liedmenue-x` gesetzt; `.modeMenu` richtet sich danach (am Rand begrenzt).
   * Im Hochformat steht die Kapsel mittig – dort ändert sich nichts.
   */
  const aktiveKapselRef = useRef<HTMLButtonElement>(null);

  /**
   * Dasselbe für Aussehen und Tempo, wenn sie einzeln stehen: Ihre Fenster öffnen unter IHREM Knopf,
   * also über dem Lied, zu dem sie gehören – sonst klebten sie am rechten Rand, beim linken Lied über
   * dem falschen Blatt. Hinter dem Werkzeuge-Knopf (rechts) bleiben sie rechts; dafür werden die
   * Variablen entfernt und `.appMenu` fällt auf `right: 12px` zurück. Gesucht wird im ganzen Kopf:
   * Die Knöpfe des anderen Lieds tragen den Liedtitel im Namen und passen deshalb nicht.
   */
  useLayoutEffect(() => {
    const wurzel = document.documentElement.style;
    const knopf =
      einzeln && offenesWerkzeug
        ? kopfRef.current?.querySelector<HTMLElement>(`[title="${WERKZEUG_NAME[offenesWerkzeug]}"]`)
        : null;
    const r = knopf?.getBoundingClientRect();
    if (!r) {
      for (const v of ['--werkzeug-links', '--werkzeug-rechts', '--werkzeug-verschub']) {
        wurzel.removeProperty(v);
      }
      return;
    }
    wurzel.setProperty(
      '--werkzeug-links',
      `clamp(180px, ${r.left + r.width / 2}px, calc(100% - 180px))`,
    );
    wurzel.setProperty('--werkzeug-rechts', 'auto');
    wurzel.setProperty('--werkzeug-verschub', '-50% 0');
  }, [einzeln, offenesWerkzeug, andereHaelfte?.slot]);
  useLayoutEffect(() => {
    if (!liedFensterOffen) return;
    const r = aktiveKapselRef.current?.getBoundingClientRect();
    if (r) document.documentElement.style.setProperty('--liedmenue-x', `${r.left + r.width / 2}px`);
  }, [liedFensterOffen, querformat, andereHaelfte?.slot]);

  /** Die Kapsel des AKTIVEN Lieds – öffnet das Lied-Menü, trägt Tempo und Puls. */
  const aktiveKapsel = (
    <button
      className={`${styles.menuBtn}${liedFensterOffen ? ' ' + styles.menuBtnOffen : ''}${
        andereHaelfte ? ' ' + styles.kapselAktiv : ''
      }`}
      ref={aktiveKapselRef}
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

  /**
   * Die einzelnen Werkzeuge des aktiven Lieds – in EINEM Behälter, damit die Einführung sie als Ganzes
   * zeigen kann (der eine Werkzeuge-Knopf hat dafür sein eigenes Ziel).
   */
  const aktiveKnopfReihe = (
    <div className={styles.knoepfe} data-tour="chart-werkzeuge-einzeln">
      {aktiveKnoepfe}
    </div>
  );

  /** Querformat: Titel + einzelne Werkzeuge eines Lieds als eine Gruppe über seiner Hälfte. */
  const aktiveGruppe = (
    <div className={styles.gruppe}>
      {aktiveKapsel}
      {aktiveKnopfReihe}
    </div>
  );
  const andereGruppe = andereHaelfte && (
    <div className={styles.gruppe}>
      {andereKapsel}
      {andereKnoepfe}
    </div>
  );

  return (
    <>
      <div className={styles.hdr} ref={kopfRef}>
        <ZurueckKnopf onClick={onBack} />
        {querformat && andereHaelfte ? (
          // Querformat, zwei Lieder: je Hälfte Titel UND Werkzeuge, mittig über ihrem Blatt
          // (#421, Alwin 03.10.2026: „bitte immer über dem Lied, auch bei kleinen iPads").
          <div className={styles.kapselPaar}>
            {andereHaelfte.slot === 1 ? aktiveGruppe : andereGruppe}
            {andereHaelfte.slot === 1 ? andereGruppe : aktiveGruppe}
          </div>
        ) : querformat ? (
          // Querformat, ein Lied: Titel und Werkzeuge mittig.
          <div className={styles.gruppeMitte}>{aktiveGruppe}</div>
        ) : einzeln ? (
          // Hochformat mit Platz (iPad hochkant, breites Fenster): Werkzeuge einzeln rechts.
          <>
            {aktiveKapsel}
            {aktiveKnopfReihe}
          </>
        ) : (
          <>
            {aktiveKapsel}
            {werkzeugKnopf}
          </>
        )}
        {onVollbild && (
          <span className={styles.vollbildPlatz}>
            <VollbildRundKnopf an={vollbildAn} onClick={onVollbild} />
          </span>
        )}
      </div>
      {werkzeugeOffen && !einzeln && !drawMode && !viewing && (
        <WerkzeugMenu werkzeuge={werkzeuge} onClose={onCloseWerkzeuge} />
      )}
    </>
  );
}
