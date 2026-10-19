import { useState } from 'react';
import { euroText } from '@shared/anmeldung/preis';
import { tagPunkt } from '@shared/ct/datum';
import type { ListenAnmeldung } from '@shared/anmeldung/liste';
import type { Aenderung } from './Rueckgaengig';
import { betragAendern, betragWiederherstellen, zahlungSpeichern } from './zahlung';
import { centAus, euroEingabe } from './anzeige';
import { useSpeichern } from './useSpeichern';
import f from './Formular.module.scss';
import s from './Startseite.module.scss';
import a from './AnmeldungenReiter.module.scss';

/**
 * **Betrag und Zahlung im Fenster einer Anmeldung** (A7-2, Entwurf `a7-anmeldungen-v2`): als bezahlt markieren (Zahlart,
 * Tag), zurücksetzen, Betrag von Hand ändern – jeweils mit „Rückgängig“. Bezahlt gilt für die ganze Anmeldung.
 */
export function AnmeldungZahlung({
  id,
  x,
  zahlarten,
  heute,
  darf,
  onGeaendert,
}: {
  id: number;
  x: ListenAnmeldung;
  /** Die Zahlarten dieser Veranstaltung (Gemeinde ohne abgewählte). */
  zahlarten: string[];
  heute: string;
  darf: boolean;
  onGeaendert: (a: Aenderung) => void;
}) {
  const [art, setArt] = useState(
    x.zahlart && zahlarten.includes(x.zahlart) ? x.zahlart : zahlarten[0],
  );
  const [am, setAm] = useState(heute);
  const [betragOffen, setBetragOffen] = useState(false);
  const [betragText, setBetragText] = useState(euroEingabe(x.betragCent ?? 0));
  const { arbeitet, fehler, speichern } = useSpeichern(() => {});
  const bei = x.zahlungBei;
  const neuerBetrag = centAus(betragText);
  const vorher = { bezahlt: x.bezahlt, am: x.bezahltAm, zahlart: x.zahlart };
  const zurueck = (personId: number) => () => zahlungSpeichern(id, personId, vorher);

  const bezahltText = `bezahlt am ${x.bezahltAm ? tagPunkt(x.bezahltAm) : '–'}${x.zahlart ? ` · ${x.zahlart}` : ''}`;

  return (
    <section className={a.teil}>
      <h3>Betrag</h3>
      {x.aufschluesselung && <p className={a.mehrzeilig}>{x.aufschluesselung}</p>}
      <p className={a.summe}>
        <span>Zu zahlen</span>
        <b>{x.betragCent === null ? '–' : euroText(x.betragCent)}</b>
      </p>

      {bei === null ? (
        <p className={a.leise}>
          Die Person, bei der Betrag und Zahlung stehen, hat abgesagt. Anpassen geht mit dem
          nächsten Schritt – bis dahin in ChurchTools.
        </p>
      ) : !darf ? (
        <p className={a.leise}>{x.bezahlt ? `✓ ${bezahltText}` : 'Noch nicht bezahlt.'}</p>
      ) : (
        <>
          {x.bezahlt ? (
            <div className={a.bezahlt}>
              <span>✓ {bezahltText}</span>
              <button
                type="button"
                className={a.linkKnopf}
                disabled={arbeitet}
                onClick={() =>
                  speichern(
                    () => zahlungSpeichern(id, bei, { bezahlt: false, am: null, zahlart: null }),
                    () =>
                      onGeaendert({
                        text: `${x.wer}: Zahlung zurückgesetzt.`,
                        rueckgaengig: zurueck(bei),
                      }),
                  )
                }
              >
                Zurücksetzen
              </button>
            </div>
          ) : (
            x.betragCent !== null &&
            x.betragCent > 0 && (
              <>
                <div className={f.feld}>
                  <span>Eingegangen per</span>
                  <div className={s.chips} role="group" aria-label="Zahlart">
                    {zahlarten.map((z) => (
                      <button
                        key={z}
                        type="button"
                        className={s.filterChip}
                        aria-pressed={art === z}
                        onClick={() => setArt(z)}
                      >
                        {z}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={a.zahlZeile}>
                  <label className={a.amFeld}>
                    <span>am</span>
                    <input
                      type="date"
                      className={f.eingabe}
                      value={am}
                      max={heute}
                      onChange={(e) => setAm(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className={f.knopf}
                    disabled={arbeitet || !am || !art}
                    onClick={() =>
                      speichern(
                        () => zahlungSpeichern(id, bei, { bezahlt: true, am, zahlart: art }),
                        () =>
                          onGeaendert({
                            text: `${x.wer}: als bezahlt markiert (${art}).`,
                            rueckgaengig: zurueck(bei),
                          }),
                      )
                    }
                  >
                    {arbeitet ? 'Wird gespeichert …' : 'Als bezahlt markieren'}
                  </button>
                </div>
                <p className={a.leise}>Gilt für die ganze Anmeldung.</p>
              </>
            )
          )}

          {betragOffen ? (
            <div className={a.zahlZeile}>
              <label className={a.amFeld}>
                <span>Neuer Betrag (€)</span>
                <input
                  className={f.eingabe}
                  inputMode="decimal"
                  value={betragText}
                  aria-label="Neuer Betrag"
                  onChange={(e) => setBetragText(e.target.value)}
                />
              </label>
              <button
                type="button"
                className={f.knopf}
                disabled={arbeitet || neuerBetrag === null || neuerBetrag === x.betragCent}
                onClick={() =>
                  neuerBetrag !== null &&
                  speichern(
                    () => betragAendern(id, bei, neuerBetrag, x.aufschluesselung, heute),
                    () => (
                      setBetragOffen(false),
                      onGeaendert({
                        text: `${x.wer}: Betrag auf ${euroText(neuerBetrag)} geändert.`,
                        rueckgaengig: () =>
                          betragWiederherstellen(id, bei, {
                            betrag: x.betragCent === null ? null : euroText(x.betragCent),
                            aufschluesselung: x.aufschluesselung,
                          }),
                      })
                    ),
                  )
                }
              >
                Speichern
              </button>
            </div>
          ) : (
            <button type="button" className={a.linkKnopf} onClick={() => setBetragOffen(true)}>
              Betrag ändern
            </button>
          )}
          {betragOffen && neuerBetrag === null && (
            <p className={f.fehler}>Bitte einen Betrag wie „30“ oder „30,50“ eintragen.</p>
          )}
          {betragOffen && (
            <p className={a.leise}>
              Z. B. nach Absprache. In der Aufschlüsselung steht dann „Von Hand geändert am …“, und
              die Nachprüfung meldet den Betrag nicht mehr als abweichend.
            </p>
          )}
          {fehler && (
            <p className={f.fehler} role="alert">
              {fehler}
            </p>
          )}
        </>
      )}
    </section>
  );
}
