import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { useLaden } from '@ui/ct/useLaden';
import { Sheet } from '@ui/fenster/Sheet';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import {
  ABSCHNITT_TITEL,
  abschnitteAus,
  kandidatenAus,
  kandidatHinweis,
  nachListe,
  pauseDerPerson,
  werKannTitel,
  type Kandidat,
  type ListenBezug,
  type WerKannAbschnitt,
} from '@shared/dienstplan/werKann';
import {
  antwortenFuerPlatz,
  antwortZeile,
  type ZellenAntwort,
} from '@shared/dienstplan/personenAntworten';
import {
  zielText,
  type Besetzung,
  type Entwurf,
  type EntwurfErgebnis,
} from '@shared/dienstplan/entwuerfe';
import type { Belegung } from '@shared/dienstplan/einteilen';
import { hatReihenfolge, tagsFuer, type Personenliste } from '@shared/dienstplan/personenliste';
import { ladeWerKann, vergissWerKann } from './ladeWerKann';
import { StiftKnopf, VorliebenFach } from './VorliebenFach';
import type { EntwurfAnschluss } from './ladeEntwuerfe';
import { grundText } from './ladeEntwuerfe';
import { GastFeld } from './GastFeld';
import { GAST_HINWEIS, gastNameAus } from './gastName';
import { useInsBild } from './useInsBild';
import type { AntwortenLader } from './ladeAntworten';
import { usePersonenAntworten } from './usePersonenAntworten';
import styles from './WerKann.module.scss';

/** Welcher freie Platz – alles, was das Fach zum Laden und für die Überschrift braucht. */
export interface FreierPlatz {
  eventId: number;
  serviceId: number;
  dienst: string;
  termin: string;
  /** z. B. „So 08.11.“ */
  tag: string;
  /** Der Tag als `YYYY-MM-DD` – für „Einsätze in der Nähe“ (Fokus-Modus); fehlt in alten Aufrufen. */
  datum?: string;
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
  zurueck,
  eintragen,
  stift,
  fokus,
  antworten,
  personenliste,
}: {
  platz: FreierPlatz;
  onClose: () => void;
  /**
   * „‹“ – zurück zum Fenster, aus dem „Wer kann?“ aufging (Entwurf oder belegter Platz, Alwin 02.11.2026). Vom freien
   * Platz aus gibt es keinen Vorgänger, also keinen Pfeil.
   */
  zurueck?: () => void;
  eintragen?: Eintragen;
  /** Der Stift (E5-3): Vorlieben der Kandidaten für diese Dienstgruppe ändern. Ohne Angabe kein Stift. */
  stift?: { vorlieben: EntwurfAnschluss['vorlieben']; gruppe: { id: number; name: string } };
  /**
   * Fokus-Modus (Wunsch 11): je Kandidat eine Mini-Zeile mit seinen Einsätzen rund um den Termin (`mini`) und der
   * Knopf „im Plan zeigen“ (`zeigen` – schließt das Fenster, die Matrix zeigt die Person). Ohne Angabe bleibt das Fach
   * wie es war.
   */
  fokus?: {
    mini: (personId: number) => string;
    zeigen: (k: { personId: number; name: string }) => void;
  };
  /**
   * Die Antworten aus „Verfügbarkeit“ (E5c-4): `lader` ist derselbe wie in „Personen“ (`AntwortenLader`), `dienstName`
   * übersetzt Dienst-IDs in Namen („nur für Gesang“). Ohne Angabe – oder wenn die Antworten dieser Dienstgruppe nicht
   * sichtbar sind – ist die Liste wie vor E5c-4.
   */
  antworten?: { lader: AntwortenLader; dienstName: (id: number) => string | undefined };
  /**
   * Die Personenliste der Dienstgruppe (PL-1): Reihenfolge, Tags und Pause. Ohne Angabe (oder ohne gespeicherte Reihenfolge)
   * ist die Liste „frei und selten dran“ wie bisher.
   */
  personenliste?: Personenliste | null;
}) {
  const bezug: ListenBezug = { liste: personenliste, tag: platz.datum };
  const { stand, neu } = useLaden(
    () =>
      ladeWerKann(platz.eventId, platz.serviceId).then((roh) =>
        kandidatenAus(roh, { monat: platz.monat, schonDa: new Set(platz.schonDa) }),
      ),
    [platz.eventId, platz.serviceId, platz.monat, platz.schonDa],
  );
  // Die Antworten laden unabhängig von den Kandidaten – scheitern sie, steht die Liste trotzdem da (nur ohne Abschnitte).
  // Sie gelten je Dienstgruppe des Platzes; ohne Gruppe (0) gibt es nichts zu laden.
  const antw = usePersonenAntworten(antworten?.lader, platz.gruppeId > 0 ? [platz.gruppeId] : []);
  const zuPlatz = antworten
    ? antwortenFuerPlatz(antw.antworten, {
        gruppeId: platz.gruppeId > 0 ? platz.gruppeId : null,
        terminId: platz.eventId,
        dienstId: platz.serviceId,
        dienstName: antworten.dienstName,
      })
    : null;
  const antwortFehler = antw.fehler ?? antw.neuFehler;
  const zustand: Zustand =
    stand.art === 'fertig'
      ? antw.laedt
        ? { art: 'laedt' } // erst, wenn auch die Antworten da (oder gescheitert) sind – sonst spränge die Liste um
        : { art: 'fertig', liste: stand.daten }
      : stand.art === 'fehler'
        ? stand
        : { art: 'laedt' };
  const [suche, setSuche] = useState('');
  const [kannNichtOffen, setKannNichtOffen] = useState(false);
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

  const q = suche.trim().toLowerCase();
  const passtZurSuche = (x: { kandidat: Kandidat }) =>
    q === '' || x.kandidat.name.toLowerCase().includes(q);
  const abschnitte: WerKannAbschnitt[] | null =
    zustand.art === 'fertig' ? abschnitteAus(zustand.liste, zuPlatz, bezug) : null;

  /** Eine Zeile der Liste – in allen Abschnitten und in der einen Liste dieselbe. */
  const zeile = (k: Kandidat, antwort: ZellenAntwort | null) => {
    const pause = pauseDerPerson(bezug, k.personId);
    const h = kandidatHinweis(k, pause);
    const tags = tagsFuer(personenliste, platz.serviceId, k.personId);
    const zweite = antwortZeile(antwort, k.abwesend !== null);
    const inhalt = (
      <>
        <span className={styles.wer}>
          <span className={styles.nameZeile}>
            <b>{k.name}</b>
            {tags.length > 0 && (
              <i className={styles.kuerzel} title={tags.map((t) => t.name).join(', ')}>
                {tags.map((t) => t.kuerzel).join('')}
              </i>
            )}
          </span>
          <small className={h.warnung ? styles.warnung : undefined}>{h.text}</small>
          {zweite && <small className={styles.antwort}>{zweite}</small>}
          {fokus && <small className={styles.mini}>{fokus.mini(k.personId)}</small>}
        </span>
        <span className={styles.anzahl}>
          {k.imMonat}× im {platz.monatName}
        </span>
      </>
    );
    const klasse = `${styles.kandidat}${k.abwesend || pause ? ' ' + styles.blass : ''}`;
    return (
      <li key={k.personId} className={stift || fokus ? styles.mitStift : undefined}>
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
        {fokus && (
          <button
            type="button"
            className={styles.zeigen}
            onClick={() => fokus.zeigen({ personId: k.personId, name: k.name })}
            aria-label={`Im Plan zeigen: ${k.name}`}
            title="Im Plan zeigen – das Fenster schließt, die Person wird hervorgehoben"
          >
            <Icon name="fokus" size={16} />
          </button>
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
  };
  return (
    <Sheet
      title={`${platz.dienst} · ${platz.tag}`}
      onClose={onClose}
      knoepfe={null}
      zurueck={zurueck}
    >
      <p className={styles.unter}>
        {platz.termin} um {platz.uhrzeit} Uhr · Platz {platz.nr} von {platz.von}
        {platz.bisher && <> · statt {platz.bisher.name}</>}
      </p>
      {zustand.art === 'laedt' && <p className={styles.hinweis}>„Wer kann?“ wird geladen …</p>}
      {zustand.art === 'fehler' && <FehlerKasten fehler={zustand.fehler} onNochmal={neu} />}
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
          {antwortFehler && (
            <p className={styles.hinweis} role="status">
              Antworten aus „Verfügbarkeit“ gerade nicht geladen – die Liste zeigt sie deshalb
              nicht.{' '}
              {antwortFehler.nochmal && (
                <button type="button" className={styles.link} onClick={antw.neuLaden}>
                  Nochmal versuchen
                </button>
              )}
            </p>
          )}
          {zustand.liste.length === 0 ? (
            <>
              <h3 className={styles.titel}>{werKannTitel(personenliste)}</h3>
              <p className={styles.hinweis}>
                Für diesen Dienst schlägt ChurchTools niemanden vor – in der ChurchTools-Gruppe des
                Dienstes ist sonst niemand.
              </p>
            </>
          ) : abschnitte ? (
            <>
              {abschnitte.map((ab) => {
                const treffer = ab.personen.filter(passtZurSuche);
                if (q !== '' && treffer.length === 0) return null;
                const kannNicht = ab.stufe === 'kannNicht';
                const zu = kannNicht && !kannNichtOffen;
                const titel = ABSCHNITT_TITEL[ab.stufe];
                return (
                  <section key={ab.stufe} className={styles.abschnitt} aria-label={titel}>
                    {kannNicht ? (
                      <h3 className={styles.abschnittKopf}>
                        <button
                          type="button"
                          className={styles.aufzu}
                          aria-expanded={!zu}
                          onClick={() => setKannNichtOffen(!kannNichtOffen)}
                        >
                          <i className={`${styles.pfeil} ${zu ? '' : styles.offen}`} aria-hidden />
                          {titel} <span className={styles.zahl}>{treffer.length}</span>
                        </button>
                      </h3>
                    ) : (
                      <h3 className={styles.abschnittKopf}>
                        {titel} <span className={styles.zahl}>{treffer.length}</span>
                      </h3>
                    )}
                    {!zu && treffer.length > 0 && (
                      <ul className={styles.liste} aria-label={titel}>
                        {treffer.map((x) => zeile(x.kandidat, x.antwort))}
                      </ul>
                    )}
                  </section>
                );
              })}
              <p className={styles.hinweis}>
                Die Antwort ersetzt nicht die Prüfung von ChurchTools: Warnungen bleiben rot, ein
                Klick trägt trotzdem ein.
              </p>
              {hatReihenfolge(personenliste) && (
                <p className={styles.hinweis}>
                  In jedem Abschnitt stehen die Personen in der Reihenfolge der Personenliste.
                </p>
              )}
            </>
          ) : (
            <>
              <h3 className={styles.titel}>{werKannTitel(personenliste)}</h3>
              <ul className={styles.liste} aria-label="Wer kann?">
                {nachListe(zustand.liste, bezug)
                  .filter((k) => passtZurSuche({ kandidat: k }))
                  .map((k) => zeile(k, null))}
              </ul>
            </>
          )}
          {bereit && (
            <form
              className={styles.gastZeile}
              onSubmit={(e) => {
                e.preventDefault();
                const name = gastNameAus(gast);
                if (bereit && name) void waehle({ art: 'gast', name }, bereit.erwartet ?? null);
              }}
            >
              <h3 className={styles.titel}>Jemand ohne ChurchTools-Konto</h3>
              <div className={styles.gastFeld}>
                <GastFeld wert={gast} onChange={setGast} />
                <button
                  type="submit"
                  className={styles.knopf}
                  disabled={laeuft || gastNameAus(gast) === null}
                >
                  Eintragen
                </button>
              </div>
              <p className={styles.hinweis}>{GAST_HINWEIS}</p>
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
            neu();
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
