import { useCallback, useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { STANDARD_BETRIEBSART, type Betriebsart } from '@shared/ct/liveAgenda';
import { einstellungenAus, type EinstellungenStand } from '@shared/dienstplan/liveEinstellungen';
import { ladeEinstellungen, speichereEinstellungen } from './ladeEinstellungen';
import { useMeineAnzeigeAendern, type MeineAnzeige } from './meineAnzeige';
import { BETRIEBSART_WAHL, einstellungenFehlerText } from './einstellungenTexte';
import styles from './EinstellungenFenster.module.scss';

interface Props {
  /** Darf ändern, wer plant – die App prüft es (ChurchTools prüft zusätzlich die Rechte der Kategorie). */
  darfAendern: boolean;
  ich: { personId: number; name: string };
  onSchliessen: () => void;
  /** Nur für Tests. */
  lesen?: typeof ladeEinstellungen;
  speichern?: typeof speichereEinstellungen;
}

/**
 * **Einstellungen** (Live-Ansicht 2, L4-2, Alwin 23.11.2026; R13 – der letzte Reiter öffnet dieses Fenster): bisher
 * „Live-Ansicht – für alle“ mit den drei Betriebsarten. Alle sehen die Wahl, **ändern dürfen nur Planer**. Gelesen wird beim
 * Öffnen frisch; ein Lesefehler sperrt das Speichern (es gilt der Standard, nichts wird auf „kein Wert“ hin überschrieben).
 * Hat inzwischen ein anderer gespeichert, wird nichts überschrieben: Das Fenster zeigt dann dessen Stand.
 *
 * **Meine Anzeige** (L4-5, A15): darunter stellt **jeder** für sich ein, was er sehen will – gilt je Person auf allen Geräten
 * (Personen-Datei, `MeineAnzeigeAnschluss`). Die Schalter wirken sofort (kein „Speichern“); scheitert ChurchTools, bleibt die
 * Wahl auf diesem Gerät stehen und wird nachgeholt – der Hinweis sagt es leise. Der obere Teil bleibt Planern vorbehalten.
 */
export function EinstellungenFenster({
  darfAendern,
  ich,
  onSchliessen,
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

  const { anzeige, setzen: anzeigeSetzen, abgleichFehler } = useMeineAnzeigeAendern();

  const gesperrt = !darfAendern || stand === null || stand.fehler !== null;

  const speichernKlick = async () => {
    if (stand === null) return;
    setArbeitet(true);
    setProblem(null);
    try {
      const r = await speichern({ betriebsart: wahl }, ich, stand.gespeichert?.version ?? null);
      if (r.ok) {
        onSchliessen();
        return;
      }
      if (r.grund === 'konflikt' && r.jetzt !== undefined) {
        const jetzt = r.jetzt;
        const inhalt = jetzt ? einstellungenAus(jetzt.inhalt) : null;
        // Steht schon genau das da, was gewünscht war (etwa ein früherer Versuch war doch angekommen): fertig.
        if (inhalt?.betriebsart === wahl) {
          onSchliessen();
          return;
        }
        setStand({
          betriebsart: inhalt?.betriebsart ?? STANDARD_BETRIEBSART,
          gespeichert: jetzt,
          unlesbar: jetzt !== null && inhalt === null,
          fehler: null,
        });
        setWahl(inhalt?.betriebsart ?? STANDARD_BETRIEBSART);
        setProblem(
          `${jetzt?.von.name ?? 'Ein anderer'} hat das inzwischen geändert – nichts überschrieben. Hier steht jetzt der neue Stand.`,
        );
        return;
      }
      setProblem(einstellungenFehlerText(r.grund, false));
    } catch (e) {
      setProblem(fehlerMeldung(e).text);
    } finally {
      setArbeitet(false);
    }
  };

  return (
    <Sheet
      title="Einstellungen"
      onClose={onSchliessen}
      mittel
      beschaeftigt={arbeitet}
      cancelLabel={darfAendern ? 'Schließen' : null}
      knoepfe={
        stand?.fehler ? (
          <FensterKnopf onClick={laden}>Nochmal versuchen</FensterKnopf>
        ) : darfAendern ? (
          <FensterKnopf disabled={gesperrt || arbeitet} onClick={() => void speichernKlick()}>
            {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
          </FensterKnopf>
        ) : (
          // Wer nicht planen darf, hat oben nichts zu speichern – „Meine Anzeige“ wirkt sofort.
          <FensterKnopf onClick={onSchliessen}>Fertig</FensterKnopf>
        )
      }
    >
      <h3 className={styles.titel}>Live-Ansicht – für alle</h3>
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
        <p className={styles.fehler} role="alert">
          {einstellungenFehlerText(stand.fehler, true)}
        </p>
      )}
      {problem && (
        <p className={styles.fehler} role="alert">
          {problem}
        </p>
      )}
      <MeineAnzeigeTeil anzeige={anzeige} setzen={anzeigeSetzen} abgleichFehler={abgleichFehler} />
    </Sheet>
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
    <section aria-labelledby="meine-anzeige-titel" className={styles.meine}>
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
