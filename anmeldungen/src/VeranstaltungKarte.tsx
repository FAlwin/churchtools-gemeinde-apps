import { TextKnopf } from '@ui/bedienung/TextKnopf';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';

/**
 * **Die Karte der Veranstaltung** (Reiter „Vorbereiten“): Titel, rechts „Bearbeiten“, darunter Zeilen „Name – Wert“. Aus
 * `VeranstaltungSeite.tsx` herausgelöst, damit auch die Karte „Nachweise“ (N3b) sie nutzt, ohne dass die Dateien einander
 * einbinden.
 */
export function Karte({
  titel,
  onBearbeiten,
  knopf = 'Bearbeiten',
  children,
}: {
  titel: string;
  onBearbeiten?: () => void;
  /** Beschriftung des Knopfs – „Ansehen“, wo auch ohne Recht etwas zu sehen ist (Formular, U1). */
  knopf?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={s.karte} aria-label={titel}>
      <div className={s.kopf}>
        <h2>{titel}</h2>
        {onBearbeiten && <TextKnopf onClick={onBearbeiten}>{knopf}</TextKnopf>}
      </div>
      <dl className={v.kv}>{children}</dl>
    </section>
  );
}

export function Zeile({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{titel}</dt>
      <dd>{children}</dd>
    </>
  );
}
