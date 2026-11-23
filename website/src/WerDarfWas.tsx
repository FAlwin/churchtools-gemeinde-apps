import { useState } from 'react';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import { wahlAus, type Kategorien, type RollenStufe, type Stufe } from '@shared/website/rechte';
import { RollenStufen } from './RollenStufen';
import { LeitungNichtFestgehalten } from './leitungFehler';
import { ladeWerDarfWas, rechteSetzen } from './rechte';
import fenster from './Fenster.module.scss';
import styles from './Rechte.module.scss';

/**
 * **„Wer darf was“** im Fenster „Einstellungen“ (Bauplan Website W3b-1, E-W21) – nur für Admins, die in ChurchTools Rechte
 * setzen dürfen (`darfVerwalten`; die App zeigt den Bereich sonst gar nicht).
 *
 * Die Stufen werden **nicht gespeichert**, sondern aus den Rechten in ChurchTools abgeleitet (`ladeWerDarfWas`). „Rechte
 * setzen“ wirkt **sofort** und unabhängig vom „Speichern“ des Fensters; danach wird neu gelesen – erst was beim Nachlesen
 * dasteht, zählt als gesetzt. Scheitert es, bleibt die Wahl stehen und die Meldung sagt warum.
 */
export function WerDarfWas({ gruppe, kategorien }: { gruppe: number; kategorien: Kategorien }) {
  // Die Nummern einzeln (nicht das Objekt): `kategorien` ist bei jedem Zeichnen ein neues Objekt – das lüde sonst endlos neu.
  const { entwuerfe, veroeffentlicht } = kategorien;
  const geladen = useLaden(
    () => ladeWerDarfWas(gruppe, { entwuerfe, veroeffentlicht }),
    [gruppe, entwuerfe, veroeffentlicht],
  );
  /** Im Bereich geändert – bis dahin gilt, was ChurchTools zeigt. */
  const [eigene, setEigene] = useState<RollenStufe[] | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [gesetzt, setGesetzt] = useState(false);
  /** Die Rechte sind gesetzt, nur das Festhalten der Leitung (für die Mails) ist gescheitert – das ist nicht „noch nicht gesetzt“. */
  const [leitungOffen, setLeitungOffen] = useState(false);

  const stand = geladen.stand;
  const wahl =
    eigene ?? (stand.art === 'fertig' ? wahlAus(stand.daten.rollen, stand.daten.ist) : null);

  const stufeSetzen = (rolle: number, stufe: Stufe) => {
    if (!wahl) return;
    setGesetzt(false);
    setEigene(wahl.map((r) => (r.rolle === rolle ? { ...r, stufe } : r)));
  };

  const setzen = () => {
    if (!wahl) return;
    setLaeuft(true);
    setFehler(null);
    setGesetzt(false);
    setLeitungOffen(false);
    rechteSetzen(gruppe, kategorien, wahl).then(
      () => {
        setLaeuft(false);
        setGesetzt(true);
        setEigene(null);
        geladen.neu();
      },
      (e: unknown) => {
        setLaeuft(false);
        setFehler(fehlerMeldung(e));
        // Die Rechte stehen – neu lesen, damit die Stufen zeigen, was jetzt gilt.
        if (e instanceof LeitungNichtFestgehalten) {
          setLeitungOffen(true);
          setEigene(null);
          geladen.neu();
        }
      },
    );
  };

  return (
    <section aria-label="Wer darf was">
      <h4 className={fenster.gruppe}>Wer darf was</h4>
      <p className={styles.erklaerung}>
        Redakteure bearbeiten Entwürfe der Seiten. Die Leitung kann zusätzlich veröffentlichen, das
        Aussehen ändern und eigenes HTML einfügen. Die Rechte liegen in ChurchTools; hier siehst du
        sie je Rolle der Gruppe.
      </p>
      {stand.art === 'laedt' && <p className={fenster.leise}>Die Rechte werden gelesen …</p>}
      {stand.art === 'fehler' && (
        <>
          <p className={fenster.fehler} role="alert">
            {stand.fehler.text}
          </p>
          {stand.fehler.nochmal && (
            <FensterKnopf art="zweit" onClick={geladen.neu}>
              Erneut versuchen
            </FensterKnopf>
          )}
        </>
      )}
      {stand.art === 'fertig' && wahl && (
        <>
          <RollenStufen
            rollen={stand.daten.rollen}
            wahl={wahl}
            ist={stand.daten.ist}
            disabled={laeuft}
            onWahl={stufeSetzen}
          />
          <div className={styles.knopfreihe}>
            <FensterKnopf art="zweit" disabled={laeuft} onClick={setzen}>
              {laeuft ? 'Rechte werden gesetzt …' : 'Rechte setzen'}
            </FensterKnopf>
          </div>
          <p className={fenster.unterText}>
            „Rechte setzen“ wirkt sofort – unabhängig vom Speichern der Einstellungen.
          </p>
        </>
      )}
      <div aria-live="polite">
        {gesetzt && <p className={styles.meldung}>Die Rechte sind gesetzt und nachgelesen.</p>}
        {fehler && (
          <p className={`${styles.meldung} ${styles.fehler}`} role="alert">
            {leitungOffen ? fehler.text : <>Noch nicht gesetzt – {fehler.text}</>}
          </p>
        )}
      </div>
    </section>
  );
}
