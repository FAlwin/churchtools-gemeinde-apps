import { datumText } from '@shared/ct/datum';
import { ortszeitAus, tagAusIso } from '@shared/ct/zeit';
import { vorZeit } from '@shared/protokolle/fruehere';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { uhrzeit } from './anzeige';
import { Marke } from './Marke';
import styles from './Fruehere.module.scss';

/** Zusagen und Absagen der Einladung – „4 Zusagen · 1 Absage“; ohne Einladung leer. */
function antwortenText(s: Pick<Sitzung, 'anfragen'>): string {
  if (!s.anfragen.length) return '';
  const zu = s.anfragen.filter((a) => a.antwort === 'zugesagt').length;
  const ab = s.anfragen.filter((a) => a.antwort === 'abgesagt').length;
  return [
    `${zu} ${zu === 1 ? 'Zusage' : 'Zusagen'}`,
    ab ? `${ab} ${ab === 1 ? 'Absage' : 'Absagen'}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Der Hinweis zur Anwesenheit einer früheren Sitzung (Zeile im Fenster). */
function anwesenheitHinweis(s: Pick<Sitzung, 'termin' | 'treffen' | 'abgeschlossen'>) {
  if (s.treffen !== null && s.abgeschlossen)
    return (
      <>
        <Marke art="gut">Gruppentreffen abgeschlossen</Marke> Anwesenheit steht in ChurchTools fest.
      </>
    );
  return s.termin ? (
    <>Anwesenheit wird aus den Antworten vorbelegt.</>
  ) : (
    <>Anwesenheit trägst du selbst ein.</>
  );
}

/**
 * **Der Text einer früheren Sitzung** – Titel, Datum (mit „vor 2 Tagen“, wenn `heute` gegeben ist), Art
 * (Einladung / Gruppentreffen / beides), Zusagen und ein Hinweis. Für Block und Fenster dieselbe Zeile.
 */
export function FruehereText({
  s,
  zeitzone,
  heute,
  hinweis,
}: {
  s: Sitzung;
  zeitzone: string;
  heute?: string;
  hinweis?: boolean;
}) {
  const tag = tagAusIso(s.beginn, zeitzone);
  const antworten = antwortenText(s);
  return (
    <span className={styles.text}>
      <b>{s.titel}</b>
      <small>
        {datumText(ortszeitAus(s.beginn, zeitzone).slice(0, 10))} · {uhrzeit(s.beginn, zeitzone)}
        {heute ? ` · ${vorZeit(tag, heute)}` : ''}
      </small>
      <span className={styles.marken}>
        {s.termin && (
          <Marke art="info">{s.treffen !== null ? 'Einladung' : 'Termin mit Einladung'}</Marke>
        )}
        {s.treffen !== null && <Marke art="leise">Gruppentreffen</Marke>}
      </span>
      {antworten && <small>{antworten}</small>}
      {hinweis && <small>{anwesenheitHinweis(s)}</small>}
    </span>
  );
}
