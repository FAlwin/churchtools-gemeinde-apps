import type { ReactNode } from 'react';
import { Icon } from '../icons/icons';
import styles from './KopfKnopf.module.scss';

/**
 * Die Stufe eines Knopfs (R2): Haupt (`haupt`, gefüllt blau), Neu (`neu`, gefüllt grün), Gefahr (`gefahr`, roter Rand),
 * Neben (ohne Angabe, weiß mit Rand) und **Still** (`still`). Still und die gefüllten Stufen schließen sich aus – das
 * sagt der Typ, damit es gar nicht erst im Code steht (ein stiller Knopf mit gefülltem Rahmen wäre ein Widerspruch).
 * Setzt man es trotzdem (über einen Cast), gewinnt die lautere Stufe: `still` wird dann ignoriert.
 */
type Stufe =
  | {
      /** Blau: die Hauptaktion der Seite („Fertig“ im Bearbeiten des Ablaufs) – höchstens eine je Kopf. */
      haupt?: boolean;
      /** Grün: etwas Neues anlegen – wie „+ Gruppe erstellen“ in ChurchTools (Scheibe S2). */
      neu?: boolean;
      /** Rot: etwas geht verloren („Löschen“ am Protokoll, W6) – roter Rand und rote Schrift, ohne Fläche wie der Hauptknopf. */
      gefahr?: boolean;
      still?: never;
    }
  | {
      /**
       * **Still** (R2, „Ruhige Bedienung“ B1): ohne Rand und ohne Fläche, Schrift in der normalen Knopffarbe, erst beim
       * Darüberfahren (nur Maus) hellblau hinterlegt – der Normalfall in Werkzeugzeilen. Am Handy bekommt er einen Rahmen
       * (R12/E8: „kein Knopf ohne Rahmen“), das macht das CSS von selbst. `aktiv`/`offen` bleiben hellblau hinterlegt.
       */
      still?: boolean;
      haupt?: never;
      neu?: never;
      gefahr?: never;
    };

type KopfKnopfProps = Stufe & {
  onClick: () => void;
  /** Sichtbare Beschriftung („Teilen“, „Bearbeiten“). Am Handy nur das Symbol (CSS) – der Name bleibt für Screenreader. */
  label: string;
  /** Ausführlicherer Name für Screenreader und Tooltip („Alle Lieder als PDF teilen“); sonst die Beschriftung. */
  title?: string;
  symbol: ReactNode;
  disabled?: boolean;
  /** Öffnet der Knopf ein Menü? Dann `aria-expanded` mit dessen Zustand. */
  menuOffen?: boolean;
  /** Hier gilt gerade etwas (Ablauf abgeschlossen, Vollbild an) – hellblau mit blauem Rand. */
  aktiv?: boolean;
  /** Sein Fenster ist gerade offen (Aussehen, Tempo im Liedblatt) – hellblau, ohne blauen Rand (Scheibe B1). */
  offen?: boolean;
  /** Immer nur das Symbol, auch am iPad (Vollbild – Entwurf S). */
  nurSymbol?: boolean;
  /**
   * Klein in einer Tabellenzeile: nur das Symbol, 26 px – so groß wie Zauberstab und Regler der Matrix (das grüne Plus
   * neben „N Punkte“; Alwin 29.10.2026: in voller Knopfhöhe „zu groß und nicht schön“).
   */
  klein?: boolean;
  /**
   * Im Raster am Handy (Liedblatt, Scheibe B1): Symbol über einem Kurzwort, auch unter `HANDY_BREITE` mit Text – dort
   * sind die Knöpfe sonst nur Symbole und im Liedblatt nicht zu unterscheiden.
   */
  raster?: boolean;
  /** Kurzwort im Raster („Notizen“ statt „Notizen von …“); sonst die Beschriftung. */
  kurz?: string;
  /** Ziel der geführten Einführung (`utils/onboarding.ts`). */
  dataTour?: string;
  /** Das Symbol hinter der Beschriftung („Weiter ›“ in der Fußleiste des Liedblatts, Scheibe B3). */
  symbolHinten?: boolean;
  /**
   * Eine Zahl neben dem Symbol, **auch am Handy** – wie die Büroklammer mit der Zahl der Dateien in ChurchTools (T2a,
   * 02.11.2026). Der Knopf wird dafür so breit wie nötig.
   */
  zahl?: number;
  /**
   * Ein Pfeil nach unten hinter der Beschriftung – „Neu ⌄“ (R3, Protokolle B6): Der Knopf klappt ein Menü auf. Auch am Handy
   * zu sehen (dort steht nur das Symbol, der Pfeil sagt, dass noch etwas aufgeht).
   */
  pfeil?: boolean;
};

/**
 * **Ein Knopf im Seitenkopf** im ChurchTools-Stil (Scheibe S, 26.10.2026 – Alwin: die runden Knöpfe „sehen eher wie
 * eine iOS-App aus“): eckig mit Rahmen, Symbol und Beschriftung wie „Zum Event gehen“ in ChurchTools. Löst
 * `RundKnopf` in den Seiten ab.
 */
export function KopfKnopf({
  onClick,
  label,
  title,
  symbol,
  haupt,
  neu,
  gefahr,
  still,
  disabled,
  menuOffen,
  aktiv,
  offen,
  nurSymbol,
  klein,
  raster,
  kurz,
  dataTour,
  symbolHinten,
  zahl,
  pfeil,
}: KopfKnopfProps) {
  return (
    <button
      type="button"
      className={`${styles.knopf}${
        haupt
          ? ' ' + styles.haupt
          : neu
            ? ' ' + styles.neu
            : gefahr
              ? ' ' + styles.gefahr
              : aktiv
                ? ' ' + styles.aktiv
                : offen
                  ? ' ' + styles.offen
                  : ''
      }${still && !haupt && !neu && !gefahr ? ' ' + styles.still : ''}${nurSymbol ? ' ' + styles.nurSymbol : ''}${klein ? ' ' + styles.klein : ''}${raster ? ' ' + styles.raster : ''}${
        zahl !== undefined ? ' ' + styles.mitZahl : ''
      }`}
      onClick={onClick}
      title={title ?? label}
      aria-label={title ?? label}
      aria-pressed={aktiv === undefined ? undefined : aktiv}
      aria-haspopup={menuOffen === undefined ? undefined : 'menu'}
      aria-expanded={menuOffen}
      disabled={disabled}
      data-tour={dataTour}
    >
      {!symbolHinten && symbol}
      {zahl !== undefined && (
        <span className={styles.zahl} aria-hidden>
          {zahl}
        </span>
      )}
      {!nurSymbol && !klein && (
        <span className={styles.text}>{raster ? (kurz ?? label) : label}</span>
      )}
      {symbolHinten && symbol}
      {pfeil && <Icon name="chev-down" size={14} stroke={2.4} />}
    </button>
  );
}

/**
 * **Ein Verweis im Seitenkopf, der aussieht wie die Knöpfe daneben** – „Musik-App“ über dem Ablauf im Dienstplaner
 * (Alwin, 05.11.2026: „sollte aussehen wie die anderen Buttons“; vorher blauer Text ohne Rahmen). Ein Verweis bleibt ein
 * Verweis (`<a>`): Er führt woandershin und lässt sich in einem neuen Tab öffnen. Am Handy nur das Symbol, wie die Knöpfe.
 */
export function KopfLink({
  href,
  label,
  title,
  symbol,
}: {
  href: string;
  label: string;
  title?: string;
  symbol: ReactNode;
}) {
  return (
    <a className={styles.knopf} href={href} title={title ?? label} aria-label={title ?? label}>
      {symbol}
      <span className={styles.text}>{label}</span>
    </a>
  );
}

/**
 * **„← Termine“** – zurück mit Ziel als Beschriftung, auch am Handy (dort ist er der einzige Weg zurück und das Ziel
 * soll lesbar bleiben). Ohne Ziel heißt er „Zurück“.
 */
export function KopfZurueck({ onClick, ziel }: { onClick: () => void; ziel?: string }) {
  return (
    <button
      type="button"
      className={`${styles.knopf} ${styles.zurueck}`}
      onClick={onClick}
      aria-label={ziel ? `Zurück zu ${ziel}` : 'Zurück'}
    >
      <Icon name="pfeil-links" size={16} stroke={2.2} />
      <span>{ziel ?? 'Zurück'}</span>
    </button>
  );
}
