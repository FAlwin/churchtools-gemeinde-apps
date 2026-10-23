import type { ButtonHTMLAttributes } from 'react';
import styles from './FensterKnopf.module.scss';

/**
 * - `haupt`: blau, das, wofür das Fenster da ist („Anlegen“, „Speichern“).
 * - `gefahr`: rot, wenn etwas verloren geht („Löschen“, „Ersetzen“).
 * - `zweit`: mit Rahmen und blauer Schrift („Abbrechen“).
 * - `hell`: hellblau, ein zweiter Weg neben dem Hauptknopf („Nur für diesen Termin neu“).
 */
export type FensterKnopfArt = 'haupt' | 'gefahr' | 'zweit' | 'hell';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  art?: FensterKnopfArt;
}

/**
 * **Ein Knopf unten rechts im Fenster** (E6-O F1, #716; Vorbild: Fenster der ChurchTools-Weboberfläche). EINE Bauart
 * für `Sheet` und `ConfirmDialog` in allen Apps – die Fenster reichen ihre Knöpfe herein, statt sie selbst zu gestalten.
 */
export function FensterKnopf({ art = 'haupt', className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`${styles.knopf} ${styles[art]}${className ? ' ' + className : ''}`}
      {...rest}
    />
  );
}
