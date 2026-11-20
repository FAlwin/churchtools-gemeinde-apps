import { Icon } from '@ui/icons/icons';
import {
  hakenGesetzt,
  hakenSchritt,
  istJeder,
  statusText,
  teilStand,
  type Aufgabe,
  type AufgabenStatus,
  type HakenSchritt,
} from '@shared/protokolle/aufgaben';
import styles from './Haken.module.scss';

const ZEICHEN = { offen: 'kreis', arbeit: 'kreis-halb', erledigt: 'kreis-haken' } as const;
const FARBE = { offen: '', arbeit: styles.arbeit, erledigt: styles.erledigt } as const;

/**
 * **Der Haken eines To-Dos** (W8a, Alwin 19.11.2026: Haken statt Weiterschalten) – eine Stelle für die To-Do-Übersicht und
 * die Startseite (`art="karte"`: Kreis mit 44 px Treffläche, grün gefüllt = erledigt; „in Arbeit“ zeigt das Schild an der
 * Karte, nicht der Kreis), den Protokoll-Editor und den festen Punkt (`art="kreis"`). Ein Klick hakt ab (offen oder in
 * Arbeit → erledigt) oder nimmt zurück (erledigt → offen); **nie** in „in Arbeit“ – das stellt man im Fenster oder im Board
 * ein. Bei „Jeder für sich“ ist es **mein Teil** (nur wenn ich zuständig bin; sonst nur Anzeige). Ohne `onSchritt` nur
 * Anzeige (bei `art="karte"` kein Knopf – die Startseite steckt ihn in eine Zeile, die selbst ein Knopf ist). Was ein Klick
 * bewirkt, sagt `hakenSchritt` – hier wird es nicht nachgerechnet.
 */
export function Haken({
  a,
  ich,
  art = 'kreis',
  teile = true,
  onSchritt,
  beschaeftigt = false,
}: {
  a: Aufgabe;
  ich: number;
  /** Darf ich den Fortschritt („2 von 14 fertig“) sehen? Ohne (W10, `ToDoRechte.teile`) nennt auch die Beschriftung ihn nicht. */
  teile?: boolean;
  art?: 'kreis' | 'karte';
  onSchritt?: (s: HakenSchritt) => void;
  beschaeftigt?: boolean;
}) {
  const jeder = istJeder(a);
  const stand = teilStand(a);
  const schritt = hakenSchritt(a, ich);
  const gesetzt = hakenGesetzt(a, ich);
  // Mein Zeichen: bei „Jeder für sich“ mein Teil, sonst der Status (in Arbeit bleibt als halber Kreis sichtbar).
  const zeichenStatus: AufgabenStatus =
    jeder && schritt?.art === 'teil' ? (gesetzt ? 'erledigt' : 'offen') : a.status;
  const fortschritt = teile && stand ? `${stand.fertig}/${stand.gesamt}` : null;
  const aktiv = !!onSchritt && !!schritt && !beschaeftigt;

  const hinweis = !schritt
    ? ''
    : schritt.art === 'teil'
      ? schritt.fertig
        ? ' – antippen: mein Teil ist erledigt'
        : ' – antippen: mein Teil wieder offen'
      : schritt.neu === 'erledigt'
        ? ' – antippen zum Abhaken'
        : ' – antippen zum Wiedereröffnen';
  const label = jeder
    ? teile
      ? `${stand ? `${stand.fertig} von ${stand.gesamt} fertig` : ''}${schritt ? `, mein Teil: ${gesetzt ? 'erledigt' : 'offen'}` : ''}${onSchritt ? hinweis : ''}`
      : `Mein Teil: ${gesetzt ? 'erledigt' : 'offen'}${onSchritt ? hinweis : ''}`
    : `Status: ${statusText(a.status)}${onSchritt ? hinweis : ''}`;

  const zeigeFortschritt = fortschritt && (
    <span className={styles.fortschritt} title={`${stand?.fertig} von ${stand?.gesamt} fertig`}>
      {fortschritt}
    </span>
  );

  if (art === 'karte') {
    const ring = (
      <span className={`${styles.ring}${gesetzt ? ' ' + styles.an : ''}`}>
        <Icon name="check" size={13} />
      </span>
    );
    // Nur Anzeige: nicht zuständig bei „Jeder für sich“, kein Schreibrecht, oder die Startseite.
    if (!onSchritt || (jeder && !schritt))
      return (
        <span className={styles.treffer} role="img" aria-label={label}>
          {ring}
        </span>
      );
    return (
      <button
        type="button"
        className={styles.treffer}
        disabled={!aktiv}
        aria-busy={beschaeftigt || undefined}
        aria-label={label}
        onClick={() => schritt && onSchritt(schritt)}
      >
        {ring}
      </button>
    );
  }

  // Nicht zuständig bei „Jeder für sich“: kein Haken, nur der Stand.
  if (jeder && !schritt)
    return (
      <span className={styles.reihe} role="img" aria-label={label}>
        <span className={`${styles.kreis} ${FARBE[a.status]}`}>
          <Icon name={ZEICHEN[a.status]} size={20} />
        </span>
        {zeigeFortschritt}
      </span>
    );

  const klick = () => {
    if (schritt && onSchritt) onSchritt(schritt);
  };

  return (
    <span className={styles.reihe}>
      <button
        type="button"
        className={`${styles.kreis} ${FARBE[zeichenStatus]}`}
        disabled={!aktiv}
        aria-label={label}
        title={jeder ? 'Mein Teil' : statusText(a.status)}
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={klick}
      >
        <Icon name={ZEICHEN[zeichenStatus]} size={20} />
      </button>
      {zeigeFortschritt}
    </span>
  );
}
