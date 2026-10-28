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
  /** Blau: die Hauptaktion der Seite („Bearbeiten“) – höchstens eine je Kopf. */
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
   * Im Raster am Handy (Liedblatt, Scheibe B1): Symbol über einem Kurzwort, auch unter `HANDY_BREITE` mit Text – dort
   * sind die Knöpfe sonst nur Symbole und im Liedblatt nicht zu unterscheiden.
   */
  raster?: boolean;
  /** Kurzwort im Raster („Notizen“ statt „Notizen von …“); sonst die Beschriftung. */
  kurz?: string;
  /** Ziel der geführten Einführung (`utils/onboarding.ts`). */
  dataTour?: string;
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
  raster,
  kurz,
  dataTour,
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
      }${nurSymbol ? ' ' + styles.nurSymbol : ''}${raster ? ' ' + styles.raster : ''}`}
      onClick={onClick}
      title={title ?? label}
      aria-label={title ?? label}
      aria-pressed={aktiv === undefined ? undefined : aktiv}
      aria-haspopup={menuOffen === undefined ? undefined : 'menu'}
      aria-expanded={menuOffen}
      disabled={disabled}
      data-tour={dataTour}
    >
      {symbol}
      {!nurSymbol && <span className={styles.text}>{raster ? (kurz ?? label) : label}</span>}
    </button>
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
