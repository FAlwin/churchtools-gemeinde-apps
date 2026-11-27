/**
 * **Ein Ablaufpunkt zum Ansehen** (Bauplan „Ruhige Bedienung“ B8, E16/E19/E20/E21; Alwin 22.11.2026 „P1“ – wie die
 * ChurchTools-App): „Position 3/10“ mit „Davor / Danach“ zum Weiterklicken, und **alle** Infos des Punkts: Uhrzeit, Dauer,
 * Zuständige, Bemerkung, Lied und die Infos je Dienstgruppe.
 *
 * **Überall eine Seite** (`PunktSeite`, alle Breiten): oben „‹ Ablauf“ und „Position n/m“, der Titel groß, darunter
 * `PunktInhalt` (die Feldliste), unten „Davor / Danach“. Auf breiten Bildschirmen steht der Inhalt in **Lesebreite**
 * mittig, die Leiste unten geht über die ganze Breite; am Rechner blättern **← →**, Escape geht zurück. Das kleine Fenster
 * in der Mitte (iPad/Rechner) gibt es nicht mehr.
 *
 * Bearbeiten bleibt beim `PunktFenster` (E18) – das hier ist nur das Ansehen. Der Hook `usePunktAnsicht` gibt der Liste
 * (`AblaufListe onPunkt`) ihr Ziel und den Aufrufern die Überlagerung.
 */
import { useEffect } from 'react';
import { itemLabel, zeitPlus, zustaendigeText, type AblaufZeile } from '@shared/ct/ablaufZeile';
import type { InfoGruppe } from '@shared/types/index';
import { Icon } from '../icons/icons';
import { BodyPortal } from '../fenster/BodyPortal';
import { useEscape } from '../bedienung/useEscape';
import { Etikett } from '../bedienung/Etikett';
import { NachbarKnopf } from './NachbarKnopf';
import { Kreis, LiedKarte, WeggelassenHinweis } from './AblaufTeile';
import styles from './PunktAnsicht.module.scss';

/** Die Zeit eines Punkts als Text: „10:04 – 10:07“, nur der Beginn, oder nichts. */
function zeitText(p: Pick<AblaufZeile, 'time' | 'durationMin'>): string | null {
  if (!p.time) return null;
  const bis = p.durationMin ? zeitPlus(p.time, p.durationMin) : null;
  return bis ? `${p.time} – ${bis}` : p.time;
}

/** „1 Minute“ / „3 Minuten“. */
function dauerText(min: number): string {
  return min === 1 ? '1 Minute' : `${min} Minuten`;
}

/**
 * Die Zeile eines Nachbarn für „Davor“ / „Danach“: „10:00 · 4 min“, der Titel und – wie die Karte der ChurchTools-App
 * (27.11.2026) – die Zuständigen.
 */
function nachbarZeile(p: AblaufZeile): { zeit: string; titel: string; wer: string } {
  const teile = [p.weggelassen ? null : p.time, p.durationMin ? `${p.durationMin} min` : null];
  return { zeit: teile.filter(Boolean).join(' · '), titel: itemLabel(p), wer: zustaendigeText(p) };
}

interface InhaltProps {
  punkt: AblaufZeile;
  /** Die Dienstgruppen, deren Infos man sieht – es stehen die mit einem Text da (nicht nur die als Spalten gewählten). */
  infoGruppen?: readonly InfoGruppe[];
  /** Fotos in den Kreisen – nur in ChurchTools selbst (wie `AblaufListe fotos`). */
  fotos?: boolean;
  /** Tipp auf das Lied (Liedblatt bzw. Lied-Ansicht); ohne: nur Anzeige. */
  onLied?: () => void;
}

/**
 * **Der Inhalt – alle Infos des Punkts** (E21), in beiden Hüllen gleich. Es stehen nur Zeilen da, zu denen es etwas gibt:
 * ein Punkt ohne Bemerkung zeigt keine leere Bemerkung (es ist ein Ansehen, kein Formular).
 */
export function PunktInhalt({ punkt, infoGruppen = [], fotos = false, onLied }: InhaltProps) {
  const zeit = punkt.weggelassen ? null : zeitText(punkt);
  const infos = infoGruppen.flatMap((g) => {
    const text = punkt.infos?.find((i) => i.gruppeId === g.id)?.text ?? '';
    return text ? [{ gruppe: g, text }] : [];
  });
  const kreise = punkt.responsible;
  const karte = punkt.song ? <LiedKarte song={punkt.song} flach /> : null;
  const leer =
    !zeit &&
    !punkt.durationMin &&
    kreise.length === 0 &&
    !punkt.note &&
    !punkt.song &&
    infos.length === 0 &&
    !punkt.vorBeginn &&
    !punkt.weggelassen;
  return (
    <div className={styles.liste} data-testid="punkt-inhalt">
      {punkt.weggelassen && (
        <div className={styles.zeile}>
          <span className={styles.lab}>Uhrzeit</span>
          <span className={styles.wert}>
            <WeggelassenHinweis />
          </span>
        </div>
      )}
      {zeit && (
        <div className={styles.zeile}>
          <span className={styles.lab}>Uhrzeit</span>
          <span className={styles.wert}>{zeit}</span>
        </div>
      )}
      {punkt.durationMin ? (
        <div className={styles.zeile}>
          <span className={styles.lab}>Dauer</span>
          <span className={styles.wert}>{dauerText(punkt.durationMin)}</span>
        </div>
      ) : null}
      {punkt.vorBeginn && (
        <div className={styles.zeile}>
          <span className={styles.lab}>Vor Gottesdienstbeginn</span>
          <span className={styles.wert}>Läuft vor dem Beginn.</span>
        </div>
      )}
      {kreise.length > 0 && (
        <div className={styles.zeile}>
          <span className={styles.lab}>Zuständig</span>
          <ul className={`${styles.wert} ${styles.personen}`}>
            {kreise.map((e, i) => (
              <li key={i} className={styles.person}>
                {e.open ? (
                  <>
                    <span className={styles.offen}>{e.label} ?</span>
                    <Etikett ton="rot">offen</Etikett>
                  </>
                ) : (
                  <>
                    {e.kuerzel && <Kreis person={e} fotos={fotos} />}
                    <span className={styles.name}>{e.label}</span>
                    {e.dienst && <span className={styles.dienst}>{e.dienst}</span>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {punkt.note && (
        <div className={styles.zeile}>
          <span className={styles.lab}>Bemerkung</span>
          <span className={`${styles.wert} ${styles.text}`}>{punkt.note}</span>
        </div>
      )}
      {karte && (
        <div className={styles.zeile}>
          <span className={styles.lab}>Lied</span>
          <span className={styles.wert}>
            {onLied ? (
              <button type="button" className={styles.liedKnopf} onClick={onLied}>
                {karte}
                <Icon name="chev-right" size={18} className={styles.pfeil} />
              </button>
            ) : (
              karte
            )}
          </span>
        </div>
      )}
      {infos.length > 0 && <div className={styles.abschnitt}>Infos je Gruppe</div>}
      {infos.map(({ gruppe, text }) => (
        <div key={gruppe.id} className={styles.zeile}>
          <span className={styles.lab}>{gruppe.name}</span>
          <span className={`${styles.wert} ${styles.text}`}>{text}</span>
        </div>
      ))}
      {leer && <p className={styles.leer}>Zu diesem Punkt gibt es keine weiteren Angaben.</p>}
    </div>
  );
}

interface SeiteProps extends InhaltProps {
  /** „Position 3/10“ – `onVorher`/`onNachher` fehlen am Rand der Liste (erster/letzter Punkt). */
  position: { nr: number; von: number; onVorher?: () => void; onNachher?: () => void };
  onClose: () => void;
  /** Wohin „‹“ führt – „Ablauf“. */
  zurueckLabel: string;
  davor?: AblaufZeile;
  danach?: AblaufZeile;
}

/** Liegt der Fokus in einem Feld, das Pfeiltasten selbst braucht (Cursor, Auswahl)? */
function imEingabefeld(ziel: EventTarget | null): boolean {
  if (!(ziel instanceof HTMLElement)) return false;
  return ziel.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName);
}

/** Der Knopf „Davor“ / „Danach“ unten auf der Seite – mit Zeit und Titel des Nachbarn. */
function Nachbar({
  art,
  nachbar,
  onClick,
}: {
  art: 'davor' | 'danach';
  nachbar: AblaufZeile | undefined;
  onClick: (() => void) | undefined;
}) {
  const z = nachbar ? nachbarZeile(nachbar) : null;
  return (
    <NachbarKnopf
      richtung={art}
      label={art === 'davor' ? 'DAVOR' : 'DANACH'}
      zeit={z?.zeit}
      titel={z?.titel}
      wer={z?.wer}
      onClick={onClick}
      ariaLabel={art === 'davor' ? 'Davor' : 'Danach'}
    />
  );
}

/**
 * **Die Seite** (alle Breiten) wie in der ChurchTools-App – oben „‹ Ablauf“ und „Position 3/10“, der Titel groß, darunter
 * die Feldliste, unten „Davor / Danach“ mit Zeit und Titel des Nachbarn. Breit: Inhalt in Lesebreite, **← →** blättern
 * (nicht, solange der Fokus in einem Eingabefeld liegt), Escape geht zurück.
 */
export function PunktSeite({
  punkt,
  position,
  onClose,
  zurueckLabel,
  davor,
  danach,
  ...inhalt
}: SeiteProps) {
  useEscape(true, onClose);
  const { onVorher, onNachher } = position;
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (imEingabefeld(e.target)) return;
      const weiter =
        e.key === 'ArrowRight' ? onNachher : e.key === 'ArrowLeft' ? onVorher : undefined;
      if (!weiter) return;
      e.preventDefault();
      weiter();
    };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  }, [onVorher, onNachher]);
  return (
    <BodyPortal>
      <div className={styles.seite} role="dialog" aria-modal="true" aria-label={itemLabel(punkt)}>
        <div className={styles.seitenKopf}>
          <button type="button" className={styles.zurueck} onClick={onClose}>
            <Icon name="chev-left" size={20} /> {zurueckLabel}
          </button>
          <span className={styles.seitenPosition}>
            Position {position.nr}/{position.von}
          </span>
        </div>
        <div className={styles.seitenInhalt}>
          <div className={styles.lesebreite}>
            <h1 className={styles.seitenTitel}>{itemLabel(punkt)}</h1>
            <PunktInhalt punkt={punkt} {...inhalt} />
          </div>
        </div>
        <div className={styles.nachbarn}>
          <Nachbar art="davor" nachbar={davor} onClick={position.onVorher} />
          <Nachbar art="danach" nachbar={danach} onClick={position.onNachher} />
        </div>
      </div>
    </BodyPortal>
  );
}
