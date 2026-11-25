import { useState } from 'react';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { AuswahlFenster } from '@ui/bedienung/OptionWaehlen';
import { LeisesPlus } from '@ui/bedienung/LeisesPlus';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { Icon } from '@ui/icons/icons';
import { tagKurz } from '@shared/ct/datum';
import { GRENZEN, type Erinnerungspunkt } from '@shared/dienstplan/abfragen';
import {
  PLATZHALTER_BETREFF,
  PLATZHALTER_TEXT,
  STANDARD_BETREFF,
  STANDARD_TEXT,
  unbekannteStellen,
} from '@shared/dienstplan/abfrageMail';
import {
  ART_NAMEN,
  artenZumHinzufuegen,
  belegteVorFristTage,
  mitGeaendertemPunkt,
  mitNeuemPunkt,
  ohnePunkt,
  vorschau,
  wirksamerPlan,
  type Punktart,
} from '@shared/dienstplan/abfragePlan';
import type { ErinnerungsplanZustand } from './useErinnerungsplan';
import styles from './ErinnerungsplanAbschnitt.module.scss';

const bereich = (g: { min: number; max: number }) =>
  Array.from({ length: g.max - g.min + 1 }, (_, i) => g.min + i);

const HINZUFUEGEN: Record<Punktart, string> = {
  oeffnen: ART_NAMEN.oeffnen,
  vorFrist: 'Einige Tage vor der Frist',
  frist: ART_NAMEN.frist,
  nachFrist: 'Nach der Frist, wiederholt',
};

/**
 * **Abschnitt „Abfragen – Erinnerungen“** im Fenster „Einstellungen“ (R-4, Entwurf `runden-entwurf.html` Schritt 1): je
 * Dienstgruppe frei einstellbar, wann erinnert wird, dazu Betreff und Text der Mail und eine kleine Vorschau. Das Rechnen
 * steht in `shared/dienstplan/abfragePlan.ts`, Lesen und Speichern im Hook `useErinnerungsplan`; gespeichert wird mit dem
 * einen „Speichern“ des Fensters.
 */
export function ErinnerungsplanAbschnitt({
  z,
  gesperrt,
}: {
  z: ErinnerungsplanZustand;
  /** Das Fenster speichert gerade. */
  gesperrt: boolean;
}) {
  const [hinzufuegen, setHinzufuegen] = useState(false);
  const [textOffen, setTextOffen] = useState(false);
  const e = z.entwurf;
  const aus = gesperrt || !z.schreibbar;

  const punkte = (neu: Erinnerungspunkt[]) => e && z.setEntwurf({ ...e, punkte: neu });
  const arten = e ? artenZumHinzufuegen(e.punkte) : [];

  const hinweise =
    e === null
      ? []
      : [
          ...unbekannteStellen(e.betreff, PLATZHALTER_BETREFF).map((s) => `${s} im Betreff`),
          ...unbekannteStellen(e.text, PLATZHALTER_TEXT).map((s) => `${s} im Text`),
        ];
  const mailStandard =
    e !== null &&
    wirksamerPlan(e).mail?.betreff === STANDARD_BETREFF &&
    wirksamerPlan(e).mail?.text === STANDARD_TEXT;

  const v = e && z.schreibbar ? vorschau(wirksamerPlan(e), z.laufend, z.heute) : null;

  return (
    <section aria-labelledby="erinnerungen-titel" className={styles.abschnitt}>
      <div className={styles.kopf}>
        <h3 id="erinnerungen-titel">Abfragen – Erinnerungen</h3>
        {z.gruppen.length > 1 && (
          <select
            className={styles.wahl}
            aria-label="Dienstgruppe"
            value={z.gewaehlt ?? ''}
            disabled={gesperrt}
            onChange={(ev) => z.waehle(Number(ev.target.value))}
          >
            {z.gruppen.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {z.gruppen.length === 1 && <p className={styles.leise}>Für {z.gruppen[0].name}.</p>}

      {z.laedt && (
        <p className={styles.leise} role="status">
          Erinnerungen werden geladen …
        </p>
      )}
      {z.unlesbarText && (
        <p className={styles.fehler} role="alert">
          {z.unlesbarText}
        </p>
      )}
      {z.lesefehler && (
        <>
          <p className={styles.fehler} role="alert">
            {z.lesefehler}
          </p>
          <TextKnopf onClick={z.neuLesen}>Nochmal versuchen</TextKnopf>
        </>
      )}
      {(z.unlesbarText || z.lesefehler) && (
        <p className={styles.leise}>Die Erinnerungen lassen sich so nicht ändern.</p>
      )}

      {e && z.schreibbar && (
        <>
          {e.punkte.length === 0 ? (
            <p className={styles.leise}>
              Keine Erinnerung – die Abfrage erscheint nur auf der Startseite.
            </p>
          ) : (
            <ul className={styles.liste} aria-label="Erinnerungen">
              {e.punkte.map((p, i) => (
                <li key={`${p.art}-${p.art === 'vorFrist' ? p.tage : i}`}>
                  <span className={styles.zeile}>
                    {p.art === 'oeffnen' && ART_NAMEN.oeffnen}
                    {p.art === 'frist' && ART_NAMEN.frist}
                    {p.art === 'vorFrist' && (
                      <>
                        <select
                          className={styles.zahl}
                          aria-label="Tage vor der Frist"
                          value={p.tage}
                          disabled={aus}
                          onChange={(ev) =>
                            punkte(
                              mitGeaendertemPunkt(e.punkte, i, {
                                art: 'vorFrist',
                                tage: Number(ev.target.value),
                              }),
                            )
                          }
                        >
                          {bereich(GRENZEN.tage).map((n) => (
                            <option
                              key={n}
                              value={n}
                              disabled={belegteVorFristTage(e.punkte, i).includes(n)}
                            >
                              {n}
                            </option>
                          ))}
                        </select>
                        {p.tage === 1 ? 'Tag' : 'Tage'} vor der Frist
                      </>
                    )}
                    {p.art === 'nachFrist' && (
                      <>
                        Nach der Frist
                        <select
                          className={styles.zahl}
                          aria-label="Wie oft nach der Frist"
                          value={p.alleTage}
                          disabled={aus}
                          onChange={(ev) =>
                            punkte(
                              mitGeaendertemPunkt(e.punkte, i, {
                                ...p,
                                alleTage: Number(ev.target.value),
                              }),
                            )
                          }
                        >
                          {bereich(GRENZEN.tage).map((n) => (
                            <option key={n} value={n}>
                              {n === 1 ? 'jeden Tag' : `alle ${n} Tage`}
                            </option>
                          ))}
                        </select>
                        , höchstens
                        <select
                          className={styles.zahl}
                          aria-label="Höchstens wie viele Erinnerungen nach der Frist"
                          value={p.hoechstens}
                          disabled={aus}
                          onChange={(ev) =>
                            punkte(
                              mitGeaendertemPunkt(e.punkte, i, {
                                ...p,
                                hoechstens: Number(ev.target.value),
                              }),
                            )
                          }
                        >
                          {bereich(GRENZEN.hoechstens).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        -mal
                      </>
                    )}
                  </span>
                  <ZeilenKnopf
                    label="Erinnerung entfernen"
                    disabled={aus}
                    onClick={() => punkte(ohnePunkt(e.punkte, i))}
                  >
                    <Icon name="x" size={16} />
                  </ZeilenKnopf>
                </li>
              ))}
            </ul>
          )}
          <LeisesPlus
            label="Erinnerung hinzufügen"
            disabled={aus || arten.length === 0}
            title={
              arten.length === 0 && e.punkte.length >= GRENZEN.punkte
                ? `Mehr als ${GRENZEN.punkte} Erinnerungen gehen nicht.`
                : undefined
            }
            onClick={() => setHinzufuegen(true)}
          />

          <label className={styles.feldName} htmlFor="erinnerung-betreff">
            Mail – Betreff
          </label>
          <input
            id="erinnerung-betreff"
            type="text"
            className={styles.feld}
            value={e.betreff}
            placeholder={STANDARD_BETREFF}
            maxLength={GRENZEN.betreff}
            disabled={aus}
            onChange={(ev) => z.setEntwurf({ ...e, betreff: ev.target.value })}
          />
          <div className={styles.stille}>
            <TextKnopf onClick={() => setTextOffen((o) => !o)}>
              {textOffen ? 'Text verbergen' : 'Text ändern'}
            </TextKnopf>
            {!mailStandard && (
              <TextKnopf
                disabled={aus}
                onClick={() =>
                  z.setEntwurf({ ...e, betreff: STANDARD_BETREFF, text: STANDARD_TEXT })
                }
              >
                Auf Standard zurücksetzen
              </TextKnopf>
            )}
          </div>
          {textOffen && (
            <>
              <label className={styles.feldName} htmlFor="erinnerung-text">
                Mail – Text
              </label>
              <textarea
                id="erinnerung-text"
                className={`${styles.feld} ${styles.text}`}
                value={e.text}
                placeholder={STANDARD_TEXT}
                maxLength={GRENZEN.mailText}
                disabled={aus}
                onChange={(ev) => z.setEntwurf({ ...e, text: ev.target.value })}
              />
              <p className={styles.leise}>
                Platzhalter: {'{zeitraum}'}, {'{frist}'}, {'{gruppe}'}, {'{vorname}'} (im Betreff
                ohne {'{vorname}'}). Eine Leerzeile macht einen neuen Absatz; der Knopf „Im
                Dienstplaner eintragen“ steht unter dem zweiten Absatz.
              </p>
            </>
          )}
          {hinweise.length > 0 && (
            <p className={styles.leise} role="status">
              Diesen Platzhalter gibt es nicht: {hinweise.join(', ')}. Er würde so in der Mail
              stehen.
            </p>
          )}
          <p className={styles.leise}>
            Mails kommen gegen 0:15 Uhr am jeweiligen Tag. Wer alles beantwortet hat oder pausiert,
            bekommt keine.
            {!z.automatik &&
              ' Automatisch verschickt wird erst, wenn die Erinnerungen in ChurchTools eingerichtet sind.'}
          </p>
          {v && (
            <p className={styles.vorschau} aria-label="Vorschau">
              {v.kopf} →{' '}
              {v.tage.length > 0
                ? `Erinnerungen am ${v.tage.map(tagKurz).join(' · ')}`
                : 'keine Erinnerung'}
            </p>
          )}
        </>
      )}

      {hinzufuegen && e && (
        <AuswahlFenster
          titel="Erinnerung hinzufügen"
          onClose={() => setHinzufuegen(false)}
          optionen={arten.map((art) => ({
            label: HINZUFUEGEN[art],
            onClick: () => {
              setHinzufuegen(false);
              punkte(mitNeuemPunkt(e.punkte, art));
            },
          }))}
        />
      )}
      {z.wechselFrage !== null && (
        <ConfirmDialog
          title="Änderungen verwerfen?"
          message={`Die Erinnerungen für ${z.gruppe?.name ?? 'diese Dienstgruppe'} sind noch nicht gespeichert. Beim Wechsel gehen die Änderungen verloren.`}
          confirmLabel="Verwerfen und wechseln"
          onConfirm={z.wechselBestaetigen}
          onCancel={z.wechselAbbrechen}
        />
      )}
    </section>
  );
}
