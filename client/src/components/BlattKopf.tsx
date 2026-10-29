import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { HeadInfoPart } from '../utils/activeSongView';
import { BpmPulse } from './BpmPulse';
import { AblaufLeiste, type LeistenLied } from './AblaufLeiste';
import { VollbildKopfKnopf } from './VollbildKnopf';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf, KopfZurueck } from '@ui/bedienung/KopfKnopf';
import {
  WERKZEUG_KURZ,
  WERKZEUG_NAME,
  kopfAufbau,
  type KopfAufbau,
  verfuegbareWerkzeuge,
  type WerkzeugId,
} from '../utils/werkzeuge';
import styles from './BlattKopf.module.scss';

/** Was der Aufrufer über den Kopf sagt (`App.tsx`): woher man kommt und was oben steht (Scheibe B1). */
export interface BlattKopfAngaben {
  /** Aus dem Ablauf: der Termin („So 01.11.2026, 10:00 – Gottesdienst“); aus der Liederliste: der Liedname. */
  titel: string;
  /** Wohin „Zurück“ führt – steht auf dem Knopf („Ablauf“, „Lieder“). */
  zurueckZiel: string;
}

/** `gross`: am Handy hochkant (Raster) größere Symbole – Entwurf B, 29.10.2026. */
function werkzeugSymbol(id: WerkzeugId, zeichnen: boolean, gross: boolean): ReactNode {
  const s = gross ? 21 : 17;
  switch (id) {
    case 'aussehen':
      return <b className={styles.aa}>Aa</b>;
    case 'tempo':
      return <Icon name="metronome" size={s} stroke={1.9} />;
    case 'zoom':
      return <Icon name="zoom-reset" size={s} stroke={2} />;
    case 'team':
      return <Icon name="people" size={s} stroke={2} />;
    case 'anmerken':
      return zeichnen ? (
        <Icon name="check" size={s} stroke={2.6} />
      ) : (
        <Icon name="pencil" size={s} stroke={2.2} />
      );
  }
}

interface BlattKopfProps {
  kopf: BlattKopfAngaben;
  /** Die Lieder der Leiste – im Ablauf alle, aus der Liederliste das eine (Scheibe B2). */
  lieder: LeistenLied[];
  mitNummer: boolean;
  sichtbar: ReadonlySet<number>;
  /** Das gewählte Lied (Index im Ablauf) – darauf wirken Knöpfe und Lied-Menü. */
  gewaehlt: number;
  onLiedTipp: (idx: number) => void;
  /** Info des gewählten Lieds aus `deriveActiveSongView` – reine Daten, die Darstellung macht diese Komponente. */
  headInfo: HeadInfoPart[];
  /** Lied-Menü offen (für `aria-expanded`). */
  menuOpen: boolean;
  /** Lied-Menü oder eines seiner Fenster (Tonart, Kapo, Dateien …) offen. */
  liedFensterOffen: boolean;
  /** Welches Werkzeug-Fenster gerade offen ist – sein Knopf ist dann hellblau. */
  offenesWerkzeug: 'aussehen' | 'tempo' | null;
  /** Es werden gerade fremde Notizen angesehen. */
  viewing: boolean;
  /** Statt der Akkorde wird ein hochgeladenes Dokument gezeigt. */
  showsDocument: boolean;
  canUseGlobalNotes: boolean;
  drawMode: boolean;
  /** Eine sichtbare Seite ist reingezoomt. */
  zoomed: boolean;
  /** Läuft der Tempo-Puls? (#145) */
  bpmPulse: boolean;
  /**
   * EINGESTELLTES Tempo (aus dem Tempo-Menü). Weicht es vom gespeicherten ab, gilt es hier: Anzeige und Puls folgen
   * dem, was gerade eingestellt ist. `null` heißt „wie im Lied".
   */
  pulsBpm: number | null;
  /** GEZÄHLTES Tempo – damit schlägt der Puls (bei Dreiergruppen ein Drittel des angezeigten). */
  klickBpm: number | null;
  /** Nullpunkt des gemeinsamen Takt-Rasters (`performance.now()`-ms) – Puls und Klick teilen ihn. */
  taktStartMs: number | null;
  /** Länge des Takts in GEZÄHLTEN Schlägen – der Puls markiert damit die Eins. */
  schlaegeProTakt: number;
  /** Läuft irgendetwas Tempo-Bezogenes (Puls oder Klick)? Hebt den Tempo-Knopf hervor. */
  tempoAktiv: boolean;
  onBack: () => void;
  /**
   * Die Werkzeuge. **Jeder Aufruf schaltet sein Fenster selbst um** – alle Fenster teilen sich ein Zustandsfeld
   * (`useChartOverlay`); ein Schließen hinterher setzte das gerade geöffnete sofort wieder zurück (05.08.2026).
   */
  onAppearance: () => void;
  onTempo: () => void;
  onResetZoom: () => void;
  onToggleTeamNotes: () => void;
  onToggleDraw: () => void;
  /**
   * Vollbild der ganzen App (nur Erweiterung, `useAppVollbild`). Ohne `onVollbild` kein Knopf – in der
   * Homescreen-App fehlt die ChurchTools-Leiste, die er verdecken könnte. Kein Werkzeug: Er steht ganz rechts.
   */
  vollbildAn?: boolean;
  onVollbild?: () => void;
}

/**
 * **Die Kopfkarte des Liedblatts** (Scheibe B1+B2, Entwurf Variante B und Prototyp mit Alwin, 26.–28.10.2026) –
 * löst die Titel-Kapseln und runden Knöpfe ab (`ChartHeader`, Alwin: „eher wie eine eigenständige iPhone-App“).
 *
 * Eine weiße Karte wie „Events › Ablaufpläne“ in ChurchTools:
 * - **breit** (iPad quer und hochkant, Rechner): Titelzeile „← Ablauf · Termin · Vollbild“; darunter in EINER Zeile
 *   die Ablauf-Leiste (`AblaufLeiste`, scrollt) und rechts die beschrifteten Knöpfe.
 * - **kompakt** (Handy): keine Titelzeile – Zurück und Vollbild als Symbol neben der Leiste, die Knöpfe im Raster
 *   mit Kurzwort darunter.
 * - **flach** (Handy quer): alles in einer Zeile, die Knöpfe nur als Symbol.
 *
 * Welcher Aufbau gilt, sagt `kopfAufbau` (gemessene Breite und Höhe).
 *
 * Die Knöpfe wirken auf das **gewählte** Lied – im Querformat wählt man das andere über die Leiste (vorher hatte
 * jede Hälfte eigene Knöpfe, #421). Welche Knöpfe es gibt, sagt `verfuegbareWerkzeuge`.
 *
 * **Die Unterkante wird gemessen** (`--blatt-kopf-unten`): Die Karte ist je Größe verschieden hoch; darunter gehen
 * Lied-Menü, Aussehen und Tempo auf, und der Hinweis „Ablauf geändert“ hängt dort.
 */
export function BlattKopf({
  kopf,
  lieder,
  mitNummer,
  sichtbar,
  gewaehlt,
  onLiedTipp,
  headInfo,
  menuOpen,
  liedFensterOffen,
  offenesWerkzeug,
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
  tempoAktiv,
  onBack,
  onAppearance,
  onTempo,
  onResetZoom,
  onToggleTeamNotes,
  onToggleDraw,
  vollbildAn = false,
  onVollbild,
}: BlattKopfProps) {
  const kopfRef = useRef<HTMLDivElement>(null);

  // ── breit oder kompakt: laufend gemessen ──
  const [aufbau, setAufbau] = useState<KopfAufbau>('breit');
  useLayoutEffect(() => {
    const el = kopfRef.current;
    if (!el) return;
    const messen = () =>
      setAufbau(kopfAufbau({ breite: el.clientWidth, hoehe: window.innerHeight }));
    messen();
    window.addEventListener('resize', messen);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(messen);
    ro?.observe(el);
    return () => {
      window.removeEventListener('resize', messen);
      ro?.disconnect();
    };
  }, []);
  const kompakt = aufbau === 'kompakt';
  // Ohne Titelzeile (Zurück und Vollbild als Symbol in der Zeile der Leiste): kompakt und flach.
  const ohneTitelzeile = aufbau !== 'breit';
  const flach = aufbau === 'flach';

  // ── Unterkante für die Fenster darunter: im Liedblatt (relativ) und für Schwebendes (Bildschirm) ──
  useLayoutEffect(() => {
    const el = kopfRef.current;
    if (!el) return;
    const wurzel = document.documentElement.style;
    const messen = () => {
      const r = el.getBoundingClientRect();
      const oben = (el.offsetParent as HTMLElement | null)?.getBoundingClientRect().top ?? 0;
      wurzel.setProperty('--blatt-kopf-unten', `${Math.round(r.bottom - oben)}px`);
      wurzel.setProperty('--blatt-kopf-unten-fix', `${Math.round(r.bottom)}px`);
    };
    messen();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(messen);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      wurzel.removeProperty('--blatt-kopf-unten');
      wurzel.removeProperty('--blatt-kopf-unten-fix');
    };
  }, []);

  /**
   * Tempo-Angabe samt Puls. Als Funktion, weil sie an ZWEI Stellen gebraucht wird: im Teil, den das Lied mitbringt,
   * und – wenn das Lied gar keins hat – als eigener Teil für ein nur eingestelltes.
   */
  const tempoAnzeige = (bpm: number) => (
    <>
      <Icon name="metronome" size={14} stroke={1.9} className={styles.infoMetronom} />
      {bpm}
      {/* Angezeigt werden die GRUNDSCHLÄGE (so steht es auch in ChurchTools), gepulst wird im GEZÄHLTEN Tempo. */}
      <BpmPulse
        bpm={klickBpm ?? bpm}
        active={bpmPulse}
        taktStartMs={taktStartMs}
        schlaegeProTakt={schlaegeProTakt}
      />
    </>
  );
  /**
   * Hat das Lied selbst ein Tempo? Wenn nicht, steht in `headInfo` kein Tempo-Teil – dann fehlten Anzeige UND Puls,
   * obwohl eins eingestellt war („Der Puls wird erst sichtbar, wenn ich in ChurchTools gespeichert habe.").
   */
  const hatEigenesTempo = headInfo.some((p) => p.art === 'bpm');
  const info =
    headInfo.length > 0 || pulsBpm !== null ? (
      <span className={styles.info}>
        {headInfo.map((part, i) => (
          <span key={i} className={styles.infoTeil}>
            {i > 0 && <span className={styles.infoPunkt}>·</span>}
            {part.art === 'key' && <span className={styles.infoKey}>{part.text}</span>}
            {part.art === 'capo' && <span className={styles.infoCapo}>{part.text}</span>}
            {part.art === 'bpm' && tempoAnzeige(pulsBpm ?? part.bpm)}
            {part.art === 'plain' && part.text}
          </span>
        ))}
        {!hatEigenesTempo && pulsBpm !== null && (
          <span className={styles.infoTeil}>
            {headInfo.length > 0 && <span className={styles.infoPunkt}>·</span>}
            {tempoAnzeige(pulsBpm)}
          </span>
        )}
      </span>
    ) : null;

  // ── Knöpfe ──
  const aktion: Record<WerkzeugId, () => void> = {
    aussehen: onAppearance,
    tempo: onTempo,
    zoom: onResetZoom,
    team: onToggleTeamNotes,
    anmerken: onToggleDraw,
  };
  const werkzeuge = verfuegbareWerkzeuge({
    zeigtDokument: showsDocument,
    ansehen: viewing,
    gezoomt: zoomed,
    teamNotizen: canUseGlobalNotes,
  });
  /** Beschriftung je Zustand: Beim Zeichnen und beim Ansehen fremder Notizen führt der Knopf wieder heraus. */
  const beschriftung = (id: WerkzeugId): { label: string; kurz: string } =>
    id === 'anmerken' && drawMode
      ? { label: 'Anmerken beenden', kurz: 'Fertig' }
      : id === 'team' && viewing
        ? { label: 'Zurück zu den eigenen Notizen', kurz: 'Eigene' }
        : { label: WERKZEUG_NAME[id], kurz: WERKZEUG_KURZ[id] };
  const knoepfe = (
    <div
      className={kompakt ? styles.raster : styles.knoepfe}
      style={
        kompakt ? { gridTemplateColumns: `repeat(${werkzeuge.length}, minmax(0, 1fr))` } : undefined
      }
      data-tour="chart-werkzeuge"
    >
      {werkzeuge.map((id) => {
        const { label, kurz } = beschriftung(id);
        return (
          <KopfKnopf
            key={id}
            onClick={aktion[id]}
            label={label}
            kurz={kurz}
            raster={kompakt}
            nurSymbol={flach}
            symbol={werkzeugSymbol(id, drawMode, kompakt)}
            aktiv={
              (id === 'tempo' && tempoAktiv) ||
              (id === 'team' && viewing) ||
              (id === 'anmerken' && drawMode)
            }
            offen={offenesWerkzeug === id}
          />
        );
      })}
    </div>
  );

  /**
   * **Aussehen und Tempo öffnen unter IHREM Knopf.** Die Mitte wird gemessen und als Variable gesetzt (`.appMenu`); am
   * Rand begrenzt das CSS. Das Lied-Menü ist seit 29.10.2026 ein Fenster in der Mitte und braucht keine Messung mehr. Gesucht wird über den Namen des Knopfs – derselbe, den Screenreader vorlesen.
   */
  useLayoutEffect(() => {
    const wurzel = document.documentElement.style;
    const knopf = offenesWerkzeug
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
  }, [offenesWerkzeug, aufbau]);

  const vollbild = onVollbild ? <VollbildKopfKnopf an={vollbildAn} onClick={onVollbild} /> : null;
  const leiste = (
    <AblaufLeiste
      lieder={lieder}
      mitNummer={mitNummer}
      sichtbar={sichtbar}
      gewaehlt={gewaehlt}
      info={info}
      menuOffen={menuOpen}
      liedFensterOffen={liedFensterOffen}
      onTipp={onLiedTipp}
    />
  );

  return (
    <div
      className={`${styles.kopf}${ohneTitelzeile ? ' ' + styles.kopfKompakt : ''}${flach ? ' ' + styles.kopfFlach : ''}`}
      ref={kopfRef}
    >
      <div className={styles.karte}>
        {!ohneTitelzeile && (
          <div className={styles.titelZeile}>
            <KopfZurueck onClick={onBack} ziel={kopf.zurueckZiel} />
            <span className={styles.titel}>{kopf.titel}</span>
            {vollbild}
          </div>
        )}
        <div className={styles.zeile}>
          {ohneTitelzeile && (
            <KopfKnopf
              onClick={onBack}
              label={`Zurück zu ${kopf.zurueckZiel}`}
              nurSymbol
              symbol={<Icon name="pfeil-links" size={kompakt ? 20 : 17} stroke={2.2} />}
            />
          )}
          {leiste}
          {kompakt && vollbild}
          {knoepfe}
          {flach && vollbild}
        </div>
      </div>
    </div>
  );
}
