import { useState } from 'react';
import type { AbmeldeDaten } from '@shared/anmeldung/oeffentlich';
import { kannEtwasKosten } from '@shared/anmeldung/preis';
import { mailGueltig } from '@shared/anmeldung/formular';
import { ibanText, verwendungszweck } from '@shared/anmeldung/bezahlung';
import { FormularRahmen, type Ansicht } from './AnmeldeFormular';
import s from './AnmeldeFormular.module.scss';

/**
 * **„Deine Anmeldung“** (A6-4, Entwurf `a6-4-deine-anmeldung-v1`, Alwin 16.10.2026) – die Seite hinter „Austreten“
 * in der Mail von ChurchTools, im Design der Veranstaltung (`FormularRahmen`). Ohne Login.
 *
 * Gemessen: Zum Schlüssel aus der Mail gibt ChurchTools heraus, wer angemeldet hat und wen man abmelden darf –
 * keine Antworten, keinen Betrag. Absagen geht, Ändern nicht. Die Seite zeigt deshalb:
 * - **Angemeldet:** jede Person mit „Absagen“ – mit Rückfrage direkt darunter; danach grau „abgesagt“.
 * - **Bezahlung:** nur wenn die Veranstaltung etwas kostet und ein Konto hat – Bankdaten und Verwendungszweck.
 * - **Etwas ändern?** an wen man schreibt (Kontakt der Veranstaltung) und „Weitere Person anmelden“.
 */
export function DeineAnmeldung({
  ansicht,
  daten,
  formularLink,
  onAbsagen,
}: {
  ansicht: Ansicht;
  daten: AbmeldeDaten;
  /** Link zum Anmeldeformular derselben Veranstaltung („Weitere Person anmelden“). */
  formularLink: string;
  /** Sagt eine Person ab und gibt den neuen Stand zurück; wirft mit einer Meldung für Menschen. */
  onAbsagen: (personId: number) => Promise<AbmeldeDaten>;
}) {
  const e = ansicht.einstellungen;
  const [personen, setPersonen] = useState(daten.personen);
  const [abgesagt, setAbgesagt] = useState<{ id: number; name: string }[]>([]);
  const [rueckfrage, setRueckfrage] = useState<number | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const b = e.bezahlung;
  const bankZeigen = kannEtwasKosten(e.preis) && !!b.iban;

  async function absagen(p: { id: number; name: string }) {
    setArbeitet(true);
    setFehler(null);
    try {
      const neu = await onAbsagen(p.id);
      setPersonen(neu.personen);
      setAbgesagt((a) => [...a, p]);
      setRueckfrage(null);
    } catch (x) {
      // Vorübergehend ist nicht endgültig: Die Rückfrage bleibt offen, ein zweiter Klick versucht es noch einmal.
      setFehler(x instanceof Error ? x.message : 'Das hat nicht geklappt.');
    } finally {
      setArbeitet(false);
    }
  }

  const vorname = (name: string) => name.split(' ')[0];

  return (
    <FormularRahmen
      ansicht={ansicht}
      titel={ansicht.name}
      info={
        <div className={s.info}>
          <p className={s.intro}>Deine Anmeldung</p>
        </div>
      }
    >
      <div className={s.formstack}>
        <section className={s.sec} aria-label="Angemeldet">
          <h2>Angemeldet</h2>
          {daten.mail && (
            <p className={s.help}>
              Angemeldet über <b>{daten.mail}</b>.
            </p>
          )}
          {personen.map((p) => (
            <div key={p.id} className={s.person}>
              <div className={s['person-top']}>
                <span>
                  <b>{p.name}</b>
                  <span className={s.angemeldet}> ✓ angemeldet</span>
                </span>
                {rueckfrage !== p.id && (
                  <button
                    type="button"
                    className={s.absagenKnopf}
                    onClick={() => {
                      setRueckfrage(p.id);
                      setFehler(null);
                    }}
                  >
                    Absagen
                  </button>
                )}
              </div>
              {rueckfrage === p.id && (
                <div className={s.rueckfrage} role="group" aria-label={`${p.name} absagen?`}>
                  <p>
                    <b>{vorname(p.name)} wirklich absagen?</b> Wieder anmelden geht nur mit einer
                    neuen Anmeldung – falls dann noch Plätze frei sind.
                  </p>
                  {fehler && (
                    <p className={s.err} role="alert">
                      {fehler}
                    </p>
                  )}
                  <button
                    type="button"
                    className={`${s.go} ${s.goRot}`}
                    disabled={arbeitet}
                    onClick={() => void absagen(p)}
                  >
                    {arbeitet ? 'Wird abgesagt …' : 'Ja, absagen'}
                  </button>
                  <button
                    type="button"
                    className={s.addbtn}
                    disabled={arbeitet}
                    onClick={() => setRueckfrage(null)}
                  >
                    Nein, angemeldet bleiben
                  </button>
                </div>
              )}
            </div>
          ))}
          {abgesagt.map((p) => (
            <div key={`weg-${p.id}`} className={`${s.person} ${s.abgesagt}`}>
              <span>
                <b>{p.name}</b> – abgesagt
              </span>
            </div>
          ))}
          {personen.length === 0 && abgesagt.length === 0 && (
            <p className={s.help}>
              Über diesen Link ist niemand mehr angemeldet – die Anmeldung wurde schon abgesagt.
            </p>
          )}
        </section>

        {bankZeigen && (
          <section className={s.sec} aria-label="Bezahlung">
            <h2>Bezahlung</h2>
            <p className={s.help}>
              Bitte überweise den Betrag aus deiner Anmeldung
              {b.fristTage > 0 ? ` bis ${b.fristTage} Tage nach der Anmeldung` : ''}.
            </p>
            <dl className={s.bank}>
              {b.kontoinhaber && (
                <>
                  <dt>Empfänger</dt>
                  <dd>{b.kontoinhaber}</dd>
                </>
              )}
              <dt>IBAN</dt>
              <dd className={s.mono}>{ibanText(b.iban)}</dd>
              {b.bic && (
                <>
                  <dt>BIC</dt>
                  <dd className={s.mono}>{b.bic}</dd>
                </>
              )}
              <dt>Verwendungszweck</dt>
              <dd className={s.mono}>{verwendungszweck(b.zweck, daten.nachname)}</dd>
            </dl>
          </section>
        )}

        <section className={s.sec} aria-label="Etwas ändern?">
          <h2>Etwas ändern?</h2>
          <p className={s.help}>
            Angaben ändern geht hier nicht – ChurchTools erlaubt es ohne Anmeldung nicht.{' '}
            {mailGueltig(e.kontakt) ? (
              <>
                Schreib dafür an <a href={`mailto:${e.kontakt}`}>{e.kontakt}</a>.
              </>
            ) : (
              'Wende dich dafür an die Gemeinde.'
            )}{' '}
            Wer noch mitkommt, meldet sich einfach zusätzlich an.
          </p>
          <a className={s.addbtn} href={formularLink}>
            Weitere Person anmelden
          </a>
        </section>
      </div>
    </FormularRahmen>
  );
}
