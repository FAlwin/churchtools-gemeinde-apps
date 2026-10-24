import { useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { kandidatenAus, kandidatHinweis, type Kandidat } from '@shared/dienstplan/werKann';
import {
  zielText,
  type Besetzung,
  type Entwurf,
  type EntwurfErgebnis,
} from '@shared/dienstplan/entwuerfe';
import type { Belegung } from '@shared/dienstplan/einteilen';
import { ladeWerKann, vergissWerKann } from './ladeWerKann';
import { StiftKnopf, VorliebenFach } from './VorliebenFach';
import type { EntwurfAnschluss } from './ladeEntwuerfe';
import { grundText } from './ladeEntwuerfe';
import { useInsBild } from './useInsBild';
import styles from './WerKann.module.scss';

/** Welcher freie Platz – alles, was das Fach zum Laden und für die Überschrift braucht. */
export interface FreierPlatz {
  eventId: number;
  serviceId: number;
  dienst: string;
  termin: string;
  /** z. B. „So 08.11.“ */
  tag: string;
  uhrzeit: string;
  /** `JJJJ-MM` – für „N× im Monat“. */
  monat: string;
  monatName: string;
  /** Platz 1 … n dieses Dienstes an diesem Termin. */
  nr: number;
  von: number;
  /** Wer an diesem Dienst schon eingeteilt ist – steht nicht in der Liste. */
  schonDa: number[];
  /** `index` des Platzes in ChurchTools – damit findet der Entwurf ihn wieder (nie die Platz-ID). */
  index: number | null;
  /** Die Dienstgruppe – in deren Schublade liegt der Entwurf. */
  gruppeId: number;
  /**
   * Wer jetzt in ChurchTools dort steht (E4-5) – dann ersetzt die Wahl diese Person, und der Entwurf merkt sich
   * die Belegung als „gesehen“. Fehlt bei freien Plätzen (und bei verborgenen Namen).
   */
  bisher?: { belegung: Belegung; name: string; gast: boolean };
  /** Plant man die Dienstgruppe (nicht nur als Termin-Admin)? Nur dann gibt es den Stift (E5-3). */
  stift?: boolean;
}

/**
 * Ob und wie man hier eintragen kann (E4-3-2). Ohne Angabe ist das Fach nur zum Ansehen (wie E4-2).
 * `bereit.onWahl` speichert den Entwurf; bei Erfolg schließt der Aufrufer das Fach.
 */
export type Eintragen =
  | { art: 'laedt' }
  | { art: 'gesperrt'; text: string; onNochmal?: () => void }
  | { art: 'einrichten'; gruppe: string; onEinrichten: () => Promise<void> }
  | {
      art: 'bereit';
      onWahl: (ziel: Besetzung, erwartet: number | null) => Promise<EntwurfErgebnis>;
      /** Ersetzt einen Entwurf („Andere Person wählen“, E4-3-3): dessen Version. Sonst `null` (neu). */
      erwartet?: number | null;
    };

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; liste: Kandidat[] };

/** Ab so vielen Kandidaten gibt es ein Suchfeld (wie im Entwurf). */
const SUCHE_AB = 7;

/**
 * **Das Fach „Wer kann?“** (Bauplan E4-2, Entwurf v17): die Kandidaten für einen freien Platz, „frei und
 * selten dran“ zuerst, mit Abwesenheit, Diensten am selben Tag und Einsätzen im Monat. Frühere Absagen
 * stehen bewusst nicht da (siehe `werKann.ts`).
 *
 * **Eintragen (E4-3-2):** Person antippen = Entwurf, „Jemand ohne ChurchTools-Konto“ = Gast. Hat ein anderer
 * Planer den Platz eben geändert, steht das da – „lassen“ oder bewusst „trotzdem“ (Alwin, 14.10.2026). Die
 * Wahl geht bei einem Fehler nie verloren: Das Fach bleibt offen, ein zweiter Tipp versucht es erneut.
 */
export function WerKann({
  platz,
  onClose,
  eintragen,
  stift,
}: {
  platz: FreierPlatz;
  onClose: () => void;
  eintragen?: Eintragen;
  /** Der Stift (E5-3): Vorlieben der Kandidaten für diese Dienstgruppe ändern. Ohne Angabe kein Stift. */
  stift?: { vorlieben: EntwurfAnschluss['vorlieben']; gruppe: { id: number; name: string } };
}) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [versuch, setVersuch] = useState(0);
  const [suche, setSuche] = useState('');
  const [gast, setGast] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [konflikt, setKonflikt] = useState<{ ziel: Besetzung; jetzt: Entwurf | null } | null>(null);
  const [stiftFuer, setStiftFuer] = useState<{ id: number; name: string } | null>(null);
  const [notiz, setNotiz] = useState<string | null>(null);

  // Ein Hinweis (Konflikt, Fehler) steht unter der langen Liste – ins Bild rollen (`useInsBild`).
  const hinweisRef = useInsBild<HTMLDivElement>(meldung ?? konflikt);

  const bereit = eintragen?.art === 'bereit' ? eintragen : null;
  const waehle = async (ziel: Besetzung, erwartet: number | null) => {
    if (!bereit || laeuft) return;
    setLaeuft(true);
    setMeldung(null);
    setKonflikt(null);
    const r = await bereit.onWahl(ziel, erwartet);
    setLaeuft(false);
    if (r.ok) return;
    if (r.grund === 'konflikt') setKonflikt({ ziel, jetzt: r.jetzt ?? null });
    else setMeldung(grundText(r.grund));
  };

  useEffect(() => {
    let aktuell = true;
    setZustand({ art: 'laedt' });
    ladeWerKann(platz.eventId, platz.serviceId).then(
      (roh) => {
        if (!aktuell) return;
        const liste = kandidatenAus(roh, { monat: platz.monat, schonDa: new Set(platz.schonDa) });
        setZustand({ art: 'fertig', liste });
      },
      (e: unknown) => aktuell && setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    return () => {
      aktuell = false;
    };
  }, [platz.eventId, platz.serviceId, platz.monat, platz.schonDa, versuch]);

  const q = suche.trim().toLowerCase();
  return (
    <Sheet
      title={`${platz.dienst} · ${platz.tag}`}
      onClose={onClose}
      cancelLabel="Schließen"
      knoepfe={null}
    >
      <p className={styles.unter}>
        {platz.termin} um {platz.uhrzeit} Uhr · Platz {platz.nr} von {platz.von}
        {platz.bisher && <> · statt {platz.bisher.name}</>}
      </p>
      {zustand.art === 'laedt' && <p className={styles.hinweis}>„Wer kann?“ wird geladen …</p>}
      {zustand.art === 'fehler' && (
        <FehlerKasten fehler={zustand.fehler} onNochmal={() => setVersuch((v) => v + 1)} />
      )}
      {zustand.art === 'fertig' && (
        <>
          {zustand.liste.length >= SUCHE_AB && (
            <input
              className={styles.suche}
              type="search"
              placeholder="Name suchen"
              aria-label="Name suchen"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              autoComplete="off"
            />
          )}
          {notiz && <p className={styles.notiz}>{notiz}</p>}
          <h3 className={styles.titel}>Wer kann? Oben: frei und selten dran</h3>
          {zustand.liste.length === 0 ? (
            <p className={styles.hinweis}>
              Für diesen Dienst schlägt ChurchTools niemanden vor – in der ChurchTools-Gruppe des
              Dienstes ist sonst niemand.
            </p>
          ) : (
            <ul className={styles.liste} aria-label="Wer kann?">
              {zustand.liste
                .filter((k) => q === '' || k.name.toLowerCase().includes(q))
                .map((k) => {
                  const h = kandidatHinweis(k);
                  const inhalt = (
                    <>
                      <span className={styles.wer}>
                        <b>{k.name}</b>
                        <small className={h.warnung ? styles.warnung : undefined}>{h.text}</small>
                      </span>
                      <span className={styles.anzahl}>
                        {k.imMonat}× im {platz.monatName}
                      </span>
                    </>
                  );
                  const klasse = `${styles.kandidat}${k.abwesend ? ' ' + styles.blass : ''}`;
                  return (
                    <li key={k.personId} className={stift ? styles.mitStift : undefined}>
                      {bereit ? (
                        <button
                          type="button"
                          className={`${klasse} ${styles.waehlbar}`}
                          disabled={laeuft}
                          onClick={() =>
                            void waehle(
                              { art: 'person', personId: k.personId, name: k.name },
                              bereit.erwartet ?? null,
                            )
                          }
                        >
                          {inhalt}
                        </button>
                      ) : (
                        <div className={klasse}>{inhalt}</div>
                      )}
                      {stift && (
                        <StiftKnopf
                          name={k.name}
                          disabled={laeuft}
                          onKlick={() => setStiftFuer({ id: k.personId, name: k.name })}
                        />
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
          {bereit && (
            <form
              className={styles.gastZeile}
              onSubmit={(e) => {
                e.preventDefault();
                if (bereit && gast.trim().length >= 2)
                  void waehle({ art: 'gast', name: gast.trim() }, bereit.erwartet ?? null);
              }}
            >
              <h3 className={styles.titel}>Jemand ohne ChurchTools-Konto</h3>
              <div className={styles.gastFeld}>
                <input
                  className={styles.suche}
                  placeholder="z. B. Andreas Reimer"
                  aria-label="Name eines Gastes"
                  value={gast}
                  onChange={(e) => setGast(e.target.value)}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className={styles.knopf}
                  disabled={laeuft || gast.trim().length < 2}
                >
                  Eintragen
                </button>
              </div>
              <p className={styles.hinweis}>
                Zum Beispiel ein Gastprediger. Er bekommt keine Anfrage, sein Name steht im Plan.
              </p>
            </form>
          )}
        </>
      )}
      <EintragenStand eintragen={eintragen} laeuft={laeuft} />
      <div ref={hinweisRef}>
        {meldung && (
          <p className={styles.fehler} role="alert">
            {meldung}
          </p>
        )}
        {konflikt && (
          <div className={styles.konflikt} role="alert">
            <p>
              <b>
                {konflikt.jetzt
                  ? `${konflikt.jetzt.von.name} hat diesen Platz eben geändert:`
                  : 'Jemand hat diesen Platz eben geändert.'}
              </b>{' '}
              {konflikt.jetzt && `Entwurf „${zielText(konflikt.jetzt.ziel)}“. `}
              Dein „{konflikt.ziel.name}“ wurde nicht gespeichert.
            </p>
            <div className={styles.knoepfe}>
              <button
                type="button"
                className={`${styles.knopf} ${styles.primaer}`}
                onClick={onClose}
              >
                {konflikt.jetzt ? `Entwurf von ${konflikt.jetzt.von.name} lassen` : 'So lassen'}
              </button>
              <button
                type="button"
                className={styles.knopf}
                disabled={laeuft}
                onClick={() => void waehle(konflikt.ziel, konflikt.jetzt?.version ?? null)}
              >
                Trotzdem {konflikt.ziel.name} eintragen
              </button>
            </div>
          </div>
        )}
      </div>
      {stiftFuer && stift && (
        <VorliebenFach
          person={stiftFuer}
          gruppe={stift.gruppe}
          vorlieben={stift.vorlieben}
          onClose={(gespeichert) => {
            setStiftFuer(null);
            if (!gespeichert) return;
            // ChurchTools rechnet mit der neuen Vorliebe neue Punkte – die Liste neu laden.
            vergissWerKann(platz.eventId, platz.serviceId);
            setNotiz(`Vorlieben von ${stiftFuer.name} gespeichert.`);
            setVersuch((v) => v + 1);
          }}
        />
      )}
    </Sheet>
  );
}

/** Was unter der Liste steht, wenn (noch) nicht eingetragen werden kann – auch im Fenster am belegten Platz. */
export function EintragenStand({ eintragen, laeuft }: { eintragen?: Eintragen; laeuft: boolean }) {
  const [einrichten, setEinrichten] = useState<
    { art: 'bereit' } | { art: 'laeuft' } | { art: 'fehler'; text: string }
  >({ art: 'bereit' });
  if (!eintragen) {
    return <p className={styles.hinweis}>Eintragen kann hier nur, wer diesen Dienst plant.</p>;
  }
  if (eintragen.art === 'bereit') {
    return laeuft ? <p className={styles.hinweis}>Wird eingetragen …</p> : null;
  }
  if (eintragen.art === 'laedt') return <p className={styles.hinweis}>Entwürfe werden geladen …</p>;
  if (eintragen.art === 'gesperrt') {
    return (
      <div className={styles.konflikt}>
        <p>{eintragen.text}</p>
        {eintragen.onNochmal && (
          <button type="button" className={styles.knopf} onClick={eintragen.onNochmal}>
            Erneut versuchen
          </button>
        )}
      </div>
    );
  }
  const los = async () => {
    setEinrichten({ art: 'laeuft' });
    try {
      await eintragen.onEinrichten();
      setEinrichten({ art: 'bereit' });
    } catch (e) {
      setEinrichten({
        art: 'fehler',
        text: e instanceof Error ? e.message : 'Einrichten hat nicht geklappt.',
      });
    }
  };
  return (
    <div className={styles.konflikt}>
      <p>
        <b>Entwürfe für „{eintragen.gruppe}“ einrichten.</b> Für diese Dienstgruppe gibt es in
        ChurchTools noch keinen Platz für Entwürfe – oder du darfst ihn nur nicht sehen. Dann bitte
        erst nach dem Recht fragen, sonst entsteht ein zweiter. Danach stellst du in ChurchTools
        ein, welche Planer ihn sehen und ändern dürfen.
      </p>
      <button
        type="button"
        className={`${styles.knopf} ${styles.primaer}`}
        disabled={einrichten.art === 'laeuft'}
        onClick={() => void los()}
      >
        {einrichten.art === 'laeuft' ? 'Wird eingerichtet …' : 'Einrichten'}
      </button>
      {einrichten.art === 'fehler' && (
        <p className={styles.fehler} role="alert">
          {einrichten.text}
        </p>
      )}
    </div>
  );
}
