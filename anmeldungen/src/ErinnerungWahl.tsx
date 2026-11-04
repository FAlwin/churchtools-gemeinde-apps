import { Icon } from '@ui/icons/icons';
import { Schalter } from '@ui/bedienung/Schalter';
import { Segment } from '@ui/bedienung/Segment';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { datumText } from '@shared/ct/datum';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import {
  ERINNERUNGEN_MAX,
  ERINNERUNG_VORGABE,
  ERINNERUNG_VORSCHLAEGE,
  erinnerungen,
} from '@shared/anmeldung/ablaeufe';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import bk from './Baukasten.module.scss';
import styles from './ErinnerungWahl.module.scss';

const tageText = (n: number) => (n === 1 ? '1 Tag' : `${n} Tage`);

/**
 * **Reiter „Erinnerung“ im Fenster „Mails“** (A9-3b, Entwurf `a9-3b-erinnerung-v1`, Alwin 04.11.2026): bis zu drei
 * Erinnerungen, je Vorschlag oder eigene Zahl; beim Einschalten „3 Tage“. Zeigt je Erinnerung ihren Tag und, ob sie
 * schon vorbei ist (R7: nur die zuletzt fällige geht noch an Spätangemeldete). `null` in `tage`: Feld noch leer. Den
 * Tag rechnet `erinnerungen` – dieselbe Regel, nach der die Routine geschrieben wird.
 */
export function ErinnerungWahl({
  tage,
  onTage,
  e,
  heute,
}: {
  tage: (number | null)[];
  onTage: (tage: (number | null)[]) => void;
  e: Pick<OeffentlicheEinstellungen, 'termin'>;
  heute: string;
}) {
  const an = tage.length > 0;
  const liste = erinnerungen(
    { termin: e.termin, erinnerungTage: tage.filter((n): n is number => n !== null) },
    heute,
  );
  const zu = (n: number | null) => liste.find((x) => x.tage === n);
  const setze = (i: number, n: number | null) => onTage(tage.map((x, j) => (j === i ? n : x)));

  if (!e.termin)
    return (
      <>
        <button type="button" className={bk.schalterZeile} aria-pressed={false} disabled>
          <Schalter an={false} />
          Erinnerung vor dem Termin
        </button>
        <p className={a.leise}>
          Ohne Termin gibt es keine Erinnerung. Erst in der Karte „Termin“ einen Termin wählen.
        </p>
      </>
    );

  const faellig = liste.filter((x) => x.datum <= heute).at(-1);
  const erste = liste[0];
  return (
    <>
      <button
        type="button"
        className={bk.schalterZeile}
        aria-pressed={an}
        onClick={() => onTage(an ? [] : [ERINNERUNG_VORGABE])}
      >
        <Schalter an={an} />
        Erinnerung vor dem Termin
      </button>
      {tage.map((n, i) => {
        const x = zu(n);
        const vorbei = !!x && x.datum <= heute;
        const eigen = n !== null && !(ERINNERUNG_VORSCHLAEGE as readonly number[]).includes(n);
        return (
          <div key={i} className={`${styles.erinnerung}${vorbei ? ' ' + styles.vorbei : ''}`}>
            <div className={styles.kopf}>
              <b>
                {i + 1}. Erinnerung
                {x && <span className={styles.datum}>{datumText(x.datum)}</span>}
              </b>
              <ZeilenKnopf
                label={`${i + 1}. Erinnerung entfernen`}
                onClick={() => onTage(tage.filter((_, j) => j !== i))}
              >
                <Icon name="x" size={16} />
              </ZeilenKnopf>
            </div>
            <Segment<string>
              value={n === null ? '' : String(n)}
              ariaLabel={`${i + 1}. Erinnerung: Tage vorher`}
              options={ERINNERUNG_VORSCHLAEGE.map((v) => ({
                value: String(v),
                label: tageText(v),
              }))}
              onChange={(v) => setze(i, Number(v))}
            />
            <label className={styles.eigen}>
              oder
              <input
                className={f.eingabe}
                inputMode="numeric"
                aria-label={`${i + 1}. Erinnerung: eigene Zahl`}
                placeholder="…"
                value={eigen ? String(n) : ''}
                onChange={(ev) => {
                  const z = ev.target.value.replace(/\D/g, '');
                  setze(i, z ? Number(z) : null);
                }}
              />
              Tage vorher
            </label>
            {vorbei && (
              <span className={x === faellig ? `${styles.marke} ${styles.geht}` : styles.marke}>
                {x === faellig ? 'vorbei – geht noch an Spätangemeldete' : 'vorbei – aus'}
              </span>
            )}
          </div>
        );
      })}
      {an && (
        <button
          type="button"
          className={a.linkKnopf}
          disabled={tage.length >= ERINNERUNGEN_MAX}
          onClick={() => onTage([...tage, [14, 7, 1, 3].find((v) => !tage.includes(v)) ?? null])}
        >
          ＋ Weitere Erinnerung
          {tage.length >= ERINNERUNGEN_MAX ? ` (höchstens ${ERINNERUNGEN_MAX})` : ''}
        </button>
      )}
      {an && erste && (
        <p className={a.leise}>
          {faellig
            ? `Wer sich ab jetzt anmeldet, bekommt die Erinnerung vom ${datumText(faellig.datum)} gleich mit der Bestätigung.`
            : `Wer sich ab dem ${datumText(erste.datum)} anmeldet, bekommt die Erinnerung gleich mit der Bestätigung. Schon Angemeldete bekommen sie auch.`}{' '}
          Jede Person bekommt ihre eigene – wie die Bestätigung.
        </p>
      )}
    </>
  );
}
