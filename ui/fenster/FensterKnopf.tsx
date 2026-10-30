import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import styles from './FensterKnopf.module.scss';

/**
 * - `haupt`: blau, das, wofür das Fenster da ist („Anlegen“, „Speichern“).
 * - `gefahr`: rot, wenn etwas verloren geht („Löschen“, „Ersetzen“).
 * - `zweit`: mit Rahmen und blauer Schrift („Abbrechen“).
 * - `hell`: hellblau, ein zweiter Weg neben dem Hauptknopf („Nur für diesen Termin neu“).
 * - `loeschen`: roter Text ganz links in der Fußzeile (`Sheet links`), abgesetzt von „Abbrechen · Speichern“ („Eintrag
 *   löschen“, E6-O O3 – wie im Entwurf B). Am Handy und wenn die Knöpfe untereinander stehen, steht er unten.
 * - `link`: blauer Text ohne Fläche, vor „Eintrag löschen“ ganz links („Darunter einfügen“, Alwin 30.10.2026).
 */
export type FensterKnopfArt = 'haupt' | 'gefahr' | 'zweit' | 'hell' | 'loeschen' | 'link';

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

/**
 * **Derselbe Knopf als Link** – wo er etwas öffnet, statt etwas zu tun: „Im Mailprogramm öffnen“ (`mailto:`, E6-O F4).
 * Ein echter Link bleibt einer (Adresse sichtbar, mit Rechtsklick kopierbar), sieht aber aus wie die Knöpfe daneben.
 */
export function FensterLink({
  art = 'haupt',
  className,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { art?: FensterKnopfArt }) {
  return (
    <a className={`${styles.knopf} ${styles[art]}${className ? ' ' + className : ''}`} {...rest} />
  );
}
