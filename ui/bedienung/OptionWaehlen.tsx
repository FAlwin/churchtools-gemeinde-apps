import { useState, type ReactNode } from 'react';
import { Icon } from '../icons/icons';
import { KopfKnopf } from './KopfKnopf';
import { useAufklapp } from './useAufklapp';
import { useEscape } from './useEscape';
import styles from './OptionWaehlen.module.scss';

/** Eine Möglichkeit in „Option wählen“ („Programmpunkt hinzufügen“). */
export interface Option {
  label: string;
  onClick: () => void;
  /** Ein Symbol vor dem Wort (Menü „⋯“ der Werkzeugzeile, R6: jeder Eintrag mit Symbol und Wort). */
  symbol?: ReactNode;
  /** Diese Möglichkeit gilt gerade (Ansichtswahl am Handy) – fett und blau. */
  gewaehlt?: boolean;
  /** Ausgegraut und nicht tippbar (z. B. „Teilen“, solange nichts zu teilen da ist). */
  gesperrt?: boolean;
  /** Eine Linie davor – trennt „… dahinter“ von „… davor einfügen“ wie in ChurchTools (Alwin, 30.10.2026). */
  trenner?: boolean;
}

/**
 * **Die Möglichkeiten als kleines Menü unter einem Knopf** – eine Stelle für „+ … hinzufügen“ im Seitenkopf und das
 * Plus an einer Ablauf-Zeile (`SortableRow`, Alwin 30.10.2026). Das Aufklappen selbst (`useAufklapp`) bleibt beim
 * Aufrufer, der den Rahmen um Knopf und Menü legt.
 */
export function MenueListe({
  optionen,
  schliessen,
  nachOben = false,
  links = false,
  titel = 'Option wählen',
}: {
  optionen: Option[];
  schliessen: () => void;
  /** Linksbündig mit dem Knopf statt rechtsbündig – für einen Knopf links in der Werkzeugzeile (Ansichtswahl). */
  links?: boolean;
  /** Name des Menüs für Screenreader – „Mehr“ beim „⋯“-Menü der Werkzeugzeile. */
  titel?: string;
  /** Über dem Knopf statt darunter – für einen Knopf in der Fußzeile eines Fensters („Darunter einfügen“). */
  nachOben?: boolean;
}) {
  return (
    <div
      className={`${styles.menue}${nachOben ? ` ${styles.nachOben}` : ''}${links ? ` ${styles.links}` : ''}`}
      role="menu"
      aria-label={titel}
    >
      {optionen.map((o) => (
        <button
          key={o.label}
          type="button"
          role="menuitem"
          className={`${styles.option}${o.trenner ? ` ${styles.trenner}` : ''}`}
          disabled={o.gesperrt}
          aria-current={o.gewaehlt || undefined}
          onClick={() => {
            schliessen();
            o.onClick();
          }}
        >
          {o.symbol}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * **„Option wählen“ als Blatt von unten** – wie in der ChurchTools-App nach dem Plus (Scheibe S2, Screenshots Alwin
 * 26.10.2026): Griff, Titel, ✕ und die Möglichkeiten als Liste. Am Handy; am iPad/Rechner `HinzufuegenMenue`.
 */
export function AuswahlBlatt({
  titel = 'Option wählen',
  optionen,
  onClose,
}: {
  titel?: string;
  optionen: Option[];
  onClose: () => void;
}) {
  useEscape(true, onClose);
  return (
    <div className={styles.hintergrund} onClick={onClose}>
      <div
        className={styles.blatt}
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={styles.griff} aria-hidden="true" />
        <div className={styles.kopf}>
          <h2 className={styles.titel}>{titel}</h2>
          <button type="button" className={styles.zu} aria-label="Schließen" onClick={onClose}>
            <Icon name="x" size={16} stroke={2.2} />
          </button>
        </div>
        <div className={styles.liste}>
          {optionen.map((o) => (
            <button
              key={o.label}
              type="button"
              className={`${styles.option}${o.trenner ? ` ${styles.trenner}` : ''}`}
              disabled={o.gesperrt}
              aria-current={o.gewaehlt || undefined}
              onClick={o.onClick}
            >
              {o.symbol}
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * **„+ … hinzufügen“ im Seitenkopf** (iPad/Rechner): grüner Knopf wie „+ Gruppe erstellen“ in ChurchTools, der die
 * Möglichkeiten als kleines Menü darunter aufklappt. `gesperrt` statt Menü, wenn nichts hinzugefügt werden darf (z. B.
 * abgeschlossener Ablauf – dann der Hinweis des Aufrufers). `klein` für die Gruppenzeile der Matrix (E6-6c): nur das
 * Symbol, 26 px – dann sagt `title`, wofür das Plus ist.
 *
 * **„Neu ⌄“** (R3/E14, Protokolle B6): `pfeil` setzt den Pfeil hinter das Wort, `handy` lässt die Möglichkeiten dort als Blatt von
 * unten kommen (`AuswahlBlatt`, wie beim „⋯“-Menü) statt als Menü am Rand. `titel` ist der Name von Menü und Blatt.
 * Ohne Möglichkeiten (und ohne `gesperrt`) gibt es auch den Knopf nicht.
 */
export function HinzufuegenMenue({
  label,
  title,
  optionen,
  gesperrt,
  klein,
  dataTour,
  pfeil,
  handy,
  titel,
}: {
  label: string;
  title?: string;
  optionen: Option[];
  gesperrt?: () => void;
  klein?: boolean;
  dataTour?: string;
  pfeil?: boolean;
  handy?: boolean;
  titel?: string;
}) {
  const [blatt, setBlatt] = useState(false);
  if (optionen.length === 0 && !gesperrt) return null;
  const symbol = <Icon name="plus" size={16} stroke={2.4} />;
  if (handy)
    return (
      <>
        <KopfKnopf
          onClick={gesperrt ?? (() => setBlatt(true))}
          label={label}
          title={title}
          neu
          klein={klein}
          pfeil={pfeil}
          menuOffen={gesperrt ? undefined : blatt}
          dataTour={dataTour}
          symbol={symbol}
        />
        {blatt && (
          <AuswahlBlatt
            titel={titel ?? label}
            optionen={optionen.map((o) => ({
              ...o,
              // Erst geht das Blatt zu, dann läuft die Aktion – eine Aktion, die ein Fenster öffnet, wird nicht vom Schließen zurückgesetzt.
              onClick: () => {
                setBlatt(false);
                o.onClick();
              },
            }))}
            onClose={() => setBlatt(false)}
          />
        )}
      </>
    );
  return (
    <KnopfMitMenue
      optionen={optionen}
      titel={titel}
      knopf={({ offen, umschalten }) => (
        <KopfKnopf
          onClick={gesperrt ?? umschalten}
          label={label}
          title={title}
          neu
          klein={klein}
          pfeil={pfeil}
          menuOffen={gesperrt ? undefined : offen}
          dataTour={dataTour}
          symbol={symbol}
        />
      )}
    />
  );
}

/**
 * **Ein Knopf, der ein kleines Menü aufklappt** – auf, zu, Tipp daneben, Escape (`useAufklapp`, derselbe Baustein wie
 * Filter- und Zeitraum-Knopf). Für „+ Eintrag hinzufügen“ im Kopf und „Darunter einfügen“ im Punkt-Fenster (am Rechner,
 * Alwin 07.11.2026); der Knopf selbst kommt vom Aufrufer.
 */
export function KnopfMitMenue({
  optionen,
  knopf,
  nachOben = false,
  links = false,
  titel,
}: {
  optionen: Option[];
  knopf: (a: { offen: boolean; umschalten: () => void }) => ReactNode;
  nachOben?: boolean;
  /** Das Menü steht linksbündig unter dem Knopf (`MenueListe`). */
  links?: boolean;
  titel?: string;
}) {
  const { offen, setOffen, rahmen } = useAufklapp();
  return (
    <div className={styles.huelle} ref={rahmen}>
      {knopf({ offen, umschalten: () => setOffen((o) => !o) })}
      {offen && (
        <MenueListe
          optionen={optionen}
          schliessen={() => setOffen(false)}
          nachOben={nachOben}
          links={links}
          titel={titel}
        />
      )}
    </div>
  );
}
