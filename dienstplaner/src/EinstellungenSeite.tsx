import { useCallback, useEffect, useState } from 'react';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { STANDARD_BETRIEBSART, type Betriebsart } from '@shared/ct/liveAgenda';
import { einstellungenAus, type EinstellungenStand } from '@shared/dienstplan/liveEinstellungen';
import { ladeEinstellungen, speichereEinstellungen } from './ladeEinstellungen';
import { useMeineAnzeigeAendern, type MeineAnzeige } from './meineAnzeige';
import {
  aenderungenText,
  anzahlAenderungen,
  BETRIEBSART_WAHL,
  einstellungenFehlerText,
} from './einstellungenTexte';
import { ErinnerungsplanAbschnitt } from './ErinnerungsplanAbschnitt';
import { useErinnerungsplan, type ErinnerungenAnschluss } from './useErinnerungsplan';
import styles from './EinstellungenSeite.module.scss';

interface Props {
  /** Darf ändern, wer plant – die App prüft es (ChurchTools prüft zusätzlich die Rechte der Kategorie). */
  darfAendern: boolean;
  ich: { personId: number; name: string };
  /**
   * Der Abschnitt „Verfügbarkeit & Erinnerungen“ (R-4): die Dienstgruppen, die man planen darf, und der Anschluss zu den Abfragen.
   * Ohne ihn (oder ohne Planer-Recht) gibt es den Abschnitt nicht.
   */
  abfragen?: ErinnerungenAnschluss;
  /**
   * Meldet der App, ob es ungespeicherte Änderungen gibt (Leiste sichtbar) – die App fragt damit beim Reiterklick und bei
   * „Zurück“ im Browser nach. Beim Verlassen der Seite kommt `false`.
   */
  onGeaendert?: (geaendert: boolean) => void;
  /** Nur für Tests. */
  lesen?: typeof ladeEinstellungen;
  speichern?: typeof speichereEinstellungen;
}

/**
 * **Einstellungen als Seite** (V-6, Entwurf V v2 Abschnitt 4; Adresse `#/einstellungen`, vorher ein Fenster – L4-2, R13: der
 * letzte Reiter öffnet sie). Von oben: **„Meine Anzeige“** (L4-5, A15: jeder stellt für sich ein, was er sehen will – gilt je
 * Person auf allen Geräten, `MeineAnzeigeAnschluss`; die Schalter wirken sofort, zählen nie als Änderung; scheitert
 * ChurchTools, bleibt die Wahl auf diesem Gerät stehen und wird nachgeholt), dann **„Live-Ansicht – für alle“** (die drei
 * Betriebsarten; alle sehen die Wahl, **ändern dürfen nur Planer**), dann der Abschnitt „Verfügbarkeit & Erinnerungen“ (nur
 * Planer, `ErinnerungsplanAbschnitt`).
 *
 * **Eine Leiste unten statt Fenster-Knöpfen**, nur für Planer und nur, solange es Ungespeichertes gibt: „N Änderung(en) nicht
 * gespeichert · Verwerfen · Speichern“. N zählt `anzahlAenderungen` (Live-Ansicht, Art der Abfrage, Erinnerungsplan – je eine).
 * Nach dem Speichern schließt nichts mehr: Der Stand ist nachgezogen, die Leiste verschwindet. Gelesen wird beim Öffnen frisch;
 * ein Lesefehler sperrt das Speichern (es gilt der Standard, nichts wird auf „kein Wert“ hin überschrieben). Hat inzwischen
 * ein anderer gespeichert, wird nichts überschrieben: Die Seite zeigt dann dessen Stand.
 *
 * **Wege aus der Seite:** Reiterklick und „Zurück“ fragt die App ab (`onGeaendert`), Neuladen/Tab schließen der
 * `beforeunload`-Hinweis des Browsers (hier, nur solange es Änderungen gibt). Den Gruppenwechsel im Erinnerungs-Abschnitt
 * fragt der Abschnitt selbst ab – nicht doppelt. **„Einrichten …“** (Fenster über der Seite) liest den Stand danach neu, was
 * ungespeicherte Plan-/Art-Änderungen still verwerfen würde; der Knopf ist aber gesperrt, solange es welche gibt („Erst
 * speichern, dann einrichten“) – so geht dort nichts verloren. Die Betriebsart ist davon nicht berührt.
 */
export function EinstellungenSeite({
  darfAendern,
  ich,
  abfragen,
  onGeaendert,
  lesen = ladeEinstellungen,
  speichern = speichereEinstellungen,
}: Props) {
  const [stand, setStand] = useState<EinstellungenStand | null>(null);
  const [wahl, setWahl] = useState<Betriebsart>(STANDARD_BETRIEBSART);
  const [arbeitet, setArbeitet] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const laden = useCallback(() => {
    setStand(null);
    setProblem(null);
    lesen().then(
      (s) => {
        setStand(s);
        setWahl(s.betriebsart);
      },
      (e: unknown) => {
        setStand({
          betriebsart: STANDARD_BETRIEBSART,
          gespeichert: null,
          unlesbar: false,
          fehler: 'voruebergehend',
        });
        setProblem(fehlerMeldung(e).text);
      },
    );
  }, [lesen]);
  useEffect(laden, [laden]);

  // Nur Planer mit mindestens einer planbaren Dienstgruppe sehen den Abschnitt.
  const erinnerungen = useErinnerungsplan(
    darfAendern && abfragen && abfragen.gruppen.length > 0 ? abfragen : undefined,
  );
  const zeigeErinnerungen = darfAendern && !!abfragen && abfragen.gruppen.length > 0;

  const { anzeige, setzen: anzeigeSetzen, abgleichFehler } = useMeineAnzeigeAendern();

  const gesperrt = !darfAendern || stand === null || stand.fehler !== null;

  // Was ungespeichert ist – nur Planer, nur mit gelesenem Stand. `wahl` kann sich nur bei `!gesperrt` ändern.
  const liveGeaendert = !gesperrt && wahl !== stand.betriebsart;
  const anzahl = anzahlAenderungen({
    live: liveGeaendert,
    art: darfAendern && erinnerungen.artGeaendert,
    plan: darfAendern && erinnerungen.planGeaendert,
  });
  const zeigeLeiste = darfAendern && anzahl > 0;

  useEffect(() => {
    onGeaendert?.(zeigeLeiste);
    return () => onGeaendert?.(false);
  }, [zeigeLeiste, onGeaendert]);

  // Neu laden oder Tab schließen mit Ungespeichertem: der Hinweis des Browsers – nur solange es Änderungen gibt.
  useEffect(() => {
    if (!zeigeLeiste) return;
    const warnen = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warnen);
    return () => window.removeEventListener('beforeunload', warnen);
  }, [zeigeLeiste]);

  /** Speichert die Betriebsart – `null`: geklappt, sonst der Satz für den Planer. */
  const betriebsartSpeichern = async (aktuell: EinstellungenStand): Promise<string | null> => {
    try {
      const r = await speichern({ betriebsart: wahl }, ich, aktuell.gespeichert?.version ?? null);
      if (r.ok) {
        setStand({
          betriebsart: wahl,
          gespeichert: r.daten ?? aktuell.gespeichert,
          unlesbar: false,
          fehler: null,
        });
        return null;
      }
      if (r.grund === 'konflikt' && r.jetzt !== undefined) {
        const jetzt = r.jetzt;
        const inhalt = jetzt ? einstellungenAus(jetzt.inhalt) : null;
        // Steht schon genau das da, was gewünscht war (etwa ein früherer Versuch war doch angekommen): fertig.
        if (jetzt && inhalt?.betriebsart === wahl) {
          setStand({ betriebsart: wahl, gespeichert: jetzt, unlesbar: false, fehler: null });
          return null;
        }
        setStand({
          betriebsart: inhalt?.betriebsart ?? STANDARD_BETRIEBSART,
          gespeichert: jetzt,
          unlesbar: jetzt !== null && inhalt === null,
          fehler: null,
        });
        setWahl(inhalt?.betriebsart ?? STANDARD_BETRIEBSART);
        return `${jetzt?.von.name ?? 'Ein anderer'} hat das inzwischen geändert – nichts überschrieben. Hier steht jetzt der neue Stand.`;
      }
      return einstellungenFehlerText(r.grund, false);
    } catch (e) {
      return fehlerMeldung(e).text;
    }
  };

  /**
   * **Ein „Speichern“ für die ganze Seite** (R1), aber nur, was sich geändert hat: die Betriebsart und der Erinnerungsplan
   * der gewählten Dienstgruppe sind zwei getrennte Werte. Scheitert einer, sagt die Meldung welcher; der andere bleibt
   * gespeichert (sein Stand ist nachgezogen, ein zweiter Klick schreibt ihn nicht noch einmal). Nichts wird wiederholt.
   */
  const speichernKlick = async () => {
    if (stand === null) return;
    const betriebsartNoetig = wahl !== stand.betriebsart;
    if (!betriebsartNoetig && !erinnerungen.geaendert) return;
    setArbeitet(true);
    setProblem(null);
    try {
      const probleme: string[] = [];
      const gespeichertes: string[] = [];
      if (betriebsartNoetig) {
        const m = await betriebsartSpeichern(stand);
        if (m === null) gespeichertes.push('Live-Ansicht');
        else probleme.push(`Live-Ansicht: ${m}`);
      }
      if (erinnerungen.geaendert) {
        const name = erinnerungen.gruppe?.name ?? 'Dienstgruppe';
        const r = await erinnerungen.speichern();
        if (r.art === 'ok') gespeichertes.push(`Erinnerungen für ${name}`);
        else if (r.art === 'fehler') probleme.push(`Erinnerungen für ${name}: ${r.text}`);
      }
      // Alles geklappt: nichts zu melden, die Leiste verschwindet von selbst (der Stand ist nachgezogen).
      if (probleme.length === 0) return;
      setProblem(
        [
          ...probleme,
          ...(gespeichertes.length ? [`Gespeichert: ${gespeichertes.join(', ')}.`] : []),
        ].join(' '),
      );
    } finally {
      setArbeitet(false);
    }
  };

  /** Alles zurück auf den gelesenen Stand – die Betriebsart hier, Plan und Art im Erinnerungs-Hook. */
  const verwerfen = () => {
    if (stand) setWahl(stand.betriebsart);
    erinnerungen.verwerfen();
    setProblem(null);
  };

  const meldung = problem && (
    <p className={styles.meldung} role="alert">
      {problem}
    </p>
  );

  return (
    <section className={styles.seite} aria-labelledby="einstellungen-titel">
      <h2 id="einstellungen-titel" className={styles.seitenTitel}>
        Einstellungen
      </h2>
      <MeineAnzeigeTeil anzeige={anzeige} setzen={anzeigeSetzen} abgleichFehler={abgleichFehler} />
      <section aria-labelledby="live-titel" className={styles.abschnitt}>
        <h3 id="live-titel" className={styles.titel}>
          Live-Ansicht – für alle
        </h3>
        <p className={styles.leise}>
          {darfAendern ? 'Ändern dürfen Planer. ' : 'Ändern dürfen nur Planer. '}
          Wer weiterklicken darf, steht in ChurchTools am Dienst („Erlaubt, die Live-Agenda zu
          steuern“).
        </p>
        {stand === null ? (
          <p className={styles.leise} role="status">
            Wird geladen …
          </p>
        ) : (
          <div className={styles.wahl} role="radiogroup" aria-label="Live-Ansicht – für alle">
            {BETRIEBSART_WAHL.map((w) => (
              <label key={w.wert}>
                <input
                  type="radio"
                  name="betriebsart"
                  checked={wahl === w.wert}
                  disabled={gesperrt || arbeitet}
                  onChange={() => setWahl(w.wert)}
                />
                <span>
                  {w.label}
                  <small>{w.erklaerung}</small>
                </span>
              </label>
            ))}
          </div>
        )}
        {stand?.fehler && (
          <>
            <p className={styles.fehler} role="alert">
              {einstellungenFehlerText(stand.fehler, true)}
            </p>
            <FensterKnopf art="zweit" onClick={laden}>
              Nochmal versuchen
            </FensterKnopf>
          </>
        )}
      </section>
      {zeigeErinnerungen && <ErinnerungsplanAbschnitt z={erinnerungen} gesperrt={arbeitet} />}
      {zeigeLeiste ? (
        // Die Leiste klebt unten und bleibt beim Scrollen sichtbar – gestaltet nach `.sendeLeiste` in `Planen.module.scss`,
        // Markup nach `useEinteilen.tsx` („N Entwürfe noch nicht gesendet“). Bewusst lokal gebaut, kein geteilter Baustein.
        <div className={styles.leiste} role="group" aria-label="Noch nicht gespeichert">
          {meldung}
          <span role="status">{aenderungenText(anzahl)}</span>
          <span className={styles.leisteKnoepfe}>
            <FensterKnopf art="loeschen" disabled={arbeitet} onClick={verwerfen}>
              Verwerfen
            </FensterKnopf>
            <FensterKnopf disabled={arbeitet} onClick={() => void speichernKlick()}>
              {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
            </FensterKnopf>
          </span>
        </div>
      ) : (
        meldung
      )}
    </section>
  );
}

/** Die Schalter von „Meine Anzeige“ – Wortlaut aus dem abgenommenen Entwurf `live-2.html`, Abschnitt 8. */
const SCHALTER: { feld: keyof MeineAnzeige; label: string; einruecken?: boolean }[] = [
  {
    feld: 'minutenKnoepfe',
    label: '„−1 / +1 Min“ in der Live-Ansicht zeigen (wie in ChurchTools)',
  },
  { feld: 'schnittBeimPlanen', label: 'Durchschnitt beim Ablauf bearbeiten zeigen' },
  { feld: 'rueckblick', label: 'Rückblick im Termin zeigen' },
  { feld: 'spalteSchnitt', label: 'Spalte „Ø bisher“', einruecken: true },
  { feld: 'spalteAbweichung', label: 'Spalte „±“', einruecken: true },
  { feld: 'infosMeinerGruppen', label: 'Infos meiner Dienstgruppen in der Live-Ansicht' },
];

function MeineAnzeigeTeil({
  anzeige,
  setzen,
  abgleichFehler,
}: {
  anzeige: MeineAnzeige;
  setzen: (teil: Partial<MeineAnzeige>) => void;
  abgleichFehler: boolean;
}) {
  return (
    <section aria-labelledby="meine-anzeige-titel" className={styles.abschnitt}>
      <h3 id="meine-anzeige-titel" className={styles.titel}>
        Meine Anzeige
      </h3>
      <p className={styles.leise}>Gilt für dich auf allen deinen Geräten.</p>
      <div className={styles.haken}>
        {SCHALTER.map((sch) => (
          <label key={sch.feld} className={sch.einruecken ? styles.eingerueckt : undefined}>
            <input
              type="checkbox"
              checked={anzeige[sch.feld]}
              // Die zwei Spalten gehören zum Rückblick: Ist er aus, sind sie ausgegraut (ihr Wert bleibt erhalten).
              disabled={sch.einruecken === true && !anzeige.rueckblick}
              onChange={(e) => setzen({ [sch.feld]: e.target.checked })}
            />
            <span>{sch.label}</span>
          </label>
        ))}
      </div>
      {abgleichFehler && (
        <p className={styles.leise} role="status">
          Noch nicht in ChurchTools gespeichert – deine Auswahl gilt vorerst nur auf diesem Gerät
          und wird nachgeholt.
        </p>
      )}
    </section>
  );
}
