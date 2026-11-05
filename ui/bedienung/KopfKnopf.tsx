import type { ReactNode } from 'react';
import { Icon } from '../icons/icons';
import styles from './KopfKnopf.module.scss';

interface KopfKnopfProps {
  onClick: () => void;
  /** Sichtbare Beschriftung („Teilen“, „Bearbeiten“). Am Handy nur das Symbol (CSS) – der Name bleibt für Screenreader. */
  label: string;
  /** Ausführlicherer Name für Screenreader und Tooltip („Alle Lieder als PDF teilen“); sonst die Beschriftung. */
  title?: string;
  symbol: ReactNode;
  /** Blau: die Hauptaktion der Seite („Fertig“ im Bearbeiten des Ablaufs) – höchstens eine je Kopf. */
  haupt?: boolean;
  /** Grün: etwas Neues anlegen – wie „+ Gruppe erstellen“ in ChurchTools (Scheibe S2). */
  neu?: boolean;
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
}

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
}: KopfKnopfProps) {
  return (
    <button
      type="button"
      className={`${styles.knopf}${
        haupt
          ? ' ' + styles.haupt
          : neu
            ? ' ' + styles.neu
            : aktiv
              ? ' ' + styles.aktiv
              : offen
                ? ' ' + styles.offen
                : ''
      }${nurSymbol ? ' ' + styles.nurSymbol : ''}${klein ? ' ' + styles.klein : ''}${raster ? ' ' + styles.raster : ''}${
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
