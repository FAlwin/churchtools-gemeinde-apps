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
import { Marke } from './Marke';
import styles from './Haken.module.scss';

const ZEICHEN = { offen: 'kreis', arbeit: 'kreis-halb', erledigt: 'kreis-haken' } as const;
const ART = { offen: 'leise', arbeit: 'info', erledigt: 'gut' } as const;
const FARBE = { offen: '', arbeit: styles.arbeit, erledigt: styles.erledigt } as const;
const gross = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * **Der Haken eines To-Dos** (W8a, Alwin 19.11.2026: Haken statt Weiterschalten) – eine Stelle für die To-Do-Übersicht
 * (`art="marke"`, mit Wort), den Protokoll-Editor und den festen Punkt (`art="kreis"`). Ein Klick hakt ab (offen oder in
 * Arbeit → erledigt) oder nimmt zurück (erledigt → offen); **nie** in „in Arbeit“ – das stellt man im Fenster oder im Board
 * ein. Bei „Jeder für sich“ ist es **mein Teil** (nur wenn ich zuständig bin; sonst nur der Fortschritt „2/5“). Ohne
 * `onSchritt` nur Anzeige. Was ein Klick bewirkt, sagt `hakenSchritt` – hier wird es nicht nachgerechnet.
 */
export function Haken({
  a,
  ich,
  art = 'kreis',
  onSchritt,
  beschaeftigt = false,
}: {
  a: Aufgabe;
  ich: number;
  art?: 'kreis' | 'marke';
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
  const fortschritt = stand ? `${stand.fertig}/${stand.gesamt}` : null;
  const aktiv = !!onSchritt && !!schritt && !beschaeftigt;
  const wort = gross(statusText(a.status));

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
    ? `${stand ? `${stand.fertig} von ${stand.gesamt} fertig` : ''}${schritt ? `, mein Teil: ${gesetzt ? 'erledigt' : 'offen'}` : ''}${onSchritt ? hinweis : ''}`
    : `Status: ${statusText(a.status)}${onSchritt ? hinweis : ''}`;

  const zeigeFortschritt = fortschritt && (
    <span className={styles.fortschritt} title={`${stand?.fertig} von ${stand?.gesamt} fertig`}>
      {fortschritt}
    </span>
  );

  // Nicht zuständig bei „Jeder für sich“: kein Haken, nur der Stand.
  if (jeder && !schritt)
    return (
      <span className={styles.reihe} role="img" aria-label={label}>
        <span className={`${styles.kreis} ${FARBE[a.status]}`}>
          <Icon name={ZEICHEN[a.status]} size={art === 'marke' ? 16 : 20} />
        </span>
        {zeigeFortschritt}
      </span>
    );

  const klick = () => {
    if (schritt && onSchritt) onSchritt(schritt);
  };

  if (art === 'marke')
    return (
      <button
        type="button"
        className={styles.knopf}
        disabled={!aktiv}
        aria-busy={beschaeftigt || undefined}
        aria-label={label}
        onClick={klick}
      >
        <Marke art={ART[a.status]}>
          <span className={styles.innen}>
            <Icon name={ZEICHEN[zeichenStatus]} size={16} />
            {wort}
            {fortschritt ? ` · ${fortschritt}` : ''}
          </span>
        </Marke>
      </button>
    );

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
