import { type Abgeschickt, type PersonErgebnis } from '@shared/anmeldung/senden';
import s from './AnmeldeFormular.module.scss';

const ERGEBNIS_TEXT: Record<PersonErgebnis, string> = {
  angemeldet: '✓ angemeldet',
  warteliste: 'Warteliste',
  bestaetigen: 'per Mail bestätigen',
  ausgebucht: 'kein Platz mehr',
  offen: 'nicht angemeldet',
};

/**
 * **Die Seite nach dem Abschicken** (#602): je Person, was herauskam. Alle angemeldet → „Danke“ wie bisher; sonst die
 * Liste. Offen gebliebene schickt „Noch einmal“ erneut – nur sie, keine Doppelanmeldung.
 */
export function Ergebnis({
  fertig,
  echt,
  hinweis,
  sendet,
  fehler,
  onNochmal,
  onZurueck,
}: {
  fertig: Abgeschickt;
  echt: boolean;
  /** „Vorschau“ / „Probelauf“ – abgeschickt wurde nichts. */
  hinweis: string | null;
  sendet: boolean;
  fehler: string | null;
  onNochmal: (offen: number[]) => void;
  onZurueck: () => void;
}) {
  const p = fertig.personen;
  const hat = (x: PersonErgebnis) => p.some((y) => y.ergebnis === x);
  const offen = p.filter((x) => x.ergebnis === 'offen');
  const liste = p.length > 1 || p.some((x) => x.ergebnis !== 'angemeldet');
  const titel = offen.length
    ? 'Fast fertig'
    : hat('bestaetigen') && p.every((x) => x.ergebnis === 'bestaetigen')
      ? 'Fast geschafft!'
      : hat('angemeldet') || hat('bestaetigen')
        ? 'Danke für die Anmeldung!'
        : hat('warteliste')
          ? 'Auf der Warteliste'
          : 'Nicht angemeldet';
  const namen = (l: { name: string }[]) =>
    l.length === 1
      ? l[0].name
      : `${l
          .slice(0, -1)
          .map((x) => x.name)
          .join(', ')} und ${l[l.length - 1].name}`;
  return (
    <div className={`${s.sec} ${s.done}`} role="status">
      <h2>{titel}</h2>
      {liste && (
        <ul className={s.ergebnisListe}>
          {p.map((x) => (
            <li key={x.index}>
              <b>{x.name}</b>
              <span className={s[`ergebnis-${x.ergebnis}`]}>{ERGEBNIS_TEXT[x.ergebnis]}</span>
            </li>
          ))}
        </ul>
      )}
      {hat('bestaetigen') && (
        <p>
          {p.length > 1
            ? 'Wer schon bekannt ist, bestätigt'
            : 'Du bist bei der Gemeinde schon bekannt. Bitte bestätige'}{' '}
          die Anmeldung über den Link in der E-Mail{fertig.mail ? ` an ${fertig.mail}` : ''} – erst
          dann ist sie gültig.
        </p>
      )}
      {hat('warteliste') && <p>Auf der Warteliste rückt man nach, sobald ein Platz frei wird.</p>}
      {hat('ausgebucht') && <p>{fertig.meldung}</p>}
      {(hat('angemeldet') || hat('warteliste')) && (
        <p>
          Die Bestätigung kommt per E-Mail{fertig.mail ? ` an ${fertig.mail}` : ''}
          {p.length > 1 ? ' – für jede Person eine eigene' : ''}.
        </p>
      )}
      {offen.length > 0 && (
        <>
          <p>{fertig.meldung}</p>
          {fehler && (
            <p className={s.warnline} role="alert">
              {fehler}
            </p>
          )}
          <button
            type="button"
            className={s.go}
            disabled={sendet}
            aria-busy={sendet}
            onClick={() => onNochmal(offen.map((x) => x.index))}
          >
            {sendet ? 'Wird gesendet …' : `${namen(offen)} noch einmal anmelden`}
          </button>
        </>
      )}
      {hinweis && <p className={s.vorschauhinweis}>{hinweis} – abgeschickt wurde nichts.</p>}
      {/* Nach einer echten Anmeldung kein „Zurück“ – ein zweites Abschicken wäre eine zweite Anmeldung. */}
      {!echt && (
        <button type="button" className={s.addbtn} onClick={onZurueck}>
          Zurück zum Formular
        </button>
      )}
    </div>
  );
}
