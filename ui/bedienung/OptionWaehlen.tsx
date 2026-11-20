import { useState, type ReactNode } from 'react';
import { Icon } from '../icons/icons';
import { Sheet } from '../fenster/Sheet';
import { KopfKnopf } from './KopfKnopf';
import { SchwebePlus } from './SchwebePlus';
import { useAufklapp } from './useAufklapp';
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
 * **„Option wählen“ als Fenster** – am Handy öffnen „⋯“, „Matrix ⌄“ und „Neu ⌄“ ihre Möglichkeiten hier, **nicht mehr als
 * Blatt von unten** (Alwin am iPhone, 20.11.2026: „alles mit Modalen machen und nicht mit Drawer“ – Fenster sind immer
 * Modale). Dasselbe `Sheet` wie jedes andere Fenster: Titel, ✕, darunter die Möglichkeiten als Liste; ✕, Escape und ein
 * Tipp daneben schließen. Es liegt wie jedes Fenster ganz oben (`FensterEbene`). Am iPad/Rechner bleibt das kleine Menü
 * am Knopf (`KnopfMitMenue`).
 *
 * Ein Tipp auf einen Eintrag ruft nur `onClick` – **das Schließen ist Sache des Aufrufers** (erst zu, dann die Aktion:
 * eine Aktion, die ein Fenster öffnet, darf nicht vom Schließen zurückgesetzt werden, Lehre 05.08.2026).
 */
export function AuswahlFenster({
  titel = 'Option wählen',
  optionen,
  onClose,
}: {
  titel?: string;
  optionen: Option[];
  onClose: () => void;
}) {
  return (
    <Sheet title={titel} onClose={onClose} knoepfe={null}>
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
    </Sheet>
  );
}

/**
 * **„+ … hinzufügen“ im Seitenkopf** (iPad/Rechner): grüner Knopf wie „+ Gruppe erstellen“ in ChurchTools, der die
 * Möglichkeiten als kleines Menü darunter aufklappt. `gesperrt` statt Menü, wenn nichts hinzugefügt werden darf (z. B.
 * abgeschlossener Ablauf – dann der Hinweis des Aufrufers). `klein` für die Gruppenzeile der Matrix (E6-6c): nur das
 * Symbol, 26 px – dann sagt `title`, wofür das Plus ist.
 *
 * **„Neu ⌄“** (R3/E14, Protokolle B6): `pfeil` setzt den Pfeil hinter das Wort, `handy` lässt die Möglichkeiten dort als Fenster
 * kommen (`AuswahlFenster`, wie beim „⋯“-Menü) statt als Menü am Rand – und der grüne Knopf wird am Handy zum **schwebenden
 * Plus** (`SchwebePlus`, R3: „Neu anlegen“ ist dort immer der grüne Kreis unten rechts, nie ein Quadrat im Kopf). `titel` ist der Name von Menü und Fenster.
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
  const [fenster, setFenster] = useState(false);
  if (optionen.length === 0 && !gesperrt) return null;
  const symbol = <Icon name="plus" size={16} stroke={2.4} />;
  if (handy)
    return (
      <>
        <SchwebePlus
          label={label}
          onClick={gesperrt ?? (() => setFenster(true))}
          dataTour={dataTour}
        />
        {fenster && (
          <AuswahlFenster
            titel={titel ?? label}
            optionen={optionen.map((o) => ({
              ...o,
              // Erst geht das Fenster zu, dann läuft die Aktion – eine Aktion, die ein Fenster öffnet, wird nicht vom Schließen zurückgesetzt.
              onClick: () => {
                setFenster(false);
                o.onClick();
              },
            }))}
            onClose={() => setFenster(false)}
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
