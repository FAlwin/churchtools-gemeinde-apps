import { useState } from 'react';
import type { GruppenRolle } from '@shared/ct/rollenRechte';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import {
  wahlAus,
  type Kategorien,
  type RolleIst,
  type RollenStufe,
  type Stufe,
} from '@shared/website/rechte';
import { RollenStufen } from './RollenStufen';
import { LeitungNichtFestgehalten, WebsiteNichtNachgezogen } from './leitungFehler';
import { ladeWerDarfWas, rechteSetzen, untergruppeRechteSetzen } from './rechte';
import fenster from './Fenster.module.scss';
import styles from './Rechte.module.scss';

/**
 * **„Wer darf was“** im Fenster „Einstellungen“ (Bauplan Website W3b-1, E-W21) – nur für Admins, die in ChurchTools Rechte
 * setzen dürfen (`darfVerwalten`; die App zeigt den Bereich sonst gar nicht).
 *
 * Die Stufen werden **nicht gespeichert**, sondern aus den Rechten in ChurchTools abgeleitet (`ladeWerDarfWas`). „Rechte
 * setzen“ wirkt **sofort** und unabhängig vom „Speichern“ des Fensters; danach wird neu gelesen – erst was beim Nachlesen
 * dasteht, zählt als gesetzt. Scheitert es, bleibt die Wahl stehen und die Meldung sagt warum.
 *
 * **Untergruppen (W3b-4a, E-W28):** Unter der Gruppe „Website“ steht je direkte Untergruppe ein eigener Abschnitt mit
 * denselben Bausteinen (`StufenBereich`, `RollenStufen`). Noch nicht eingerichtet → Hinweis, Stufen mit der Vorbelegung und
 * „Rechte setzen“, das die Untergruppe einrichtet (Kategorie + Rechte, danach die Website-Rollen nachziehen). Während ein
 * Bereich setzt, warten die anderen – beide ändern die Rechte der Website-Rollen.
 */
export function WerDarfWas({ gruppe, kategorien }: { gruppe: number; kategorien: Kategorien }) {
  // Die Nummern einzeln (nicht das Objekt): `kategorien` ist bei jedem Zeichnen ein neues Objekt – das lüde sonst endlos neu.
  const { entwuerfe, veroeffentlicht } = kategorien;
  // `behalten`: Beim Nachlesen nach dem Setzen bleiben die Bereiche stehen (samt ihrer Meldung „gesetzt“).
  const geladen = useLaden(
    () => ladeWerDarfWas(gruppe, { entwuerfe, veroeffentlicht }),
    [gruppe, entwuerfe, veroeffentlicht],
    { behalten: true },
  );
  /** Welcher Bereich gerade setzt (`0` = die Website, sonst die Untergruppe) – die anderen warten. */
  const [laeuftIn, setLaeuftIn] = useState<number | null>(null);
  const stand = geladen.stand;
  const kat: Kategorien = { entwuerfe, veroeffentlicht };

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
      {stand.art === 'fertig' && (
        <>
          {stand.neuFehler && (
            <p className={fenster.fehler} role="alert">
              Neu lesen hat nicht geklappt – {stand.neuFehler.text}
            </p>
          )}
          <StufenBereich
            rollen={stand.daten.rollen}
            ist={stand.daten.ist}
            gesperrt={laeuftIn !== null && laeuftIn !== 0}
            onLaeuft={(an) => setLaeuftIn(an ? 0 : null)}
            setzen={(wahl) => rechteSetzen(gruppe, kategorien, wahl)}
            onGesetzt={geladen.neu}
          />
          {stand.daten.untergruppen.map((u) => (
            <section
              key={u.gruppe}
              aria-label={`Untergruppe ${u.name}`}
              className={styles.untergruppe}
            >
              <h5 className={styles.untergruppenTitel}>{u.name}</h5>
              {u.kategorie === null && (
                <p className={styles.erklaerung}>
                  Diese Untergruppe ist noch nicht eingerichtet. Wähle die Stufen ihrer Rollen –
                  „Rechte setzen“ legt dann ihren Bereich an und vergibt die Rechte. Ihre Leitung
                  veröffentlicht später die Seiten der Untergruppe.
                </p>
              )}
              <StufenBereich
                rollen={u.rollen}
                ist={u.kategorie === null ? undefined : u.ist}
                gesperrt={laeuftIn !== null && laeuftIn !== u.gruppe}
                onLaeuft={(an) => setLaeuftIn(an ? u.gruppe : null)}
                setzen={(wahl) =>
                  untergruppeRechteSetzen(gruppe, kat, { id: u.gruppe, name: u.name }, wahl)
                }
                onGesetzt={geladen.neu}
              />
            </section>
          ))}
          <p className={fenster.unterText}>
            „Rechte setzen“ wirkt sofort – unabhängig vom Speichern der Einstellungen.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * **Ein Bereich von „Wer darf was“:** die Stufen je Rolle einer Gruppe, „Rechte setzen“ und die Meldung danach – dieselben
 * Bausteine für die Website und jede Untergruppe. `ist` fehlt: noch nicht eingerichtet (gewählt ist der Vorschlag).
 */
function StufenBereich({
  rollen,
  ist,
  gesperrt,
  onLaeuft,
  setzen,
  onGesetzt,
}: {
  rollen: readonly GruppenRolle[];
  ist: readonly RolleIst[] | undefined;
  /** Ein anderer Bereich setzt gerade. */
  gesperrt: boolean;
  onLaeuft: (an: boolean) => void;
  setzen: (wahl: readonly RollenStufe[]) => Promise<void>;
  /** Nach dem Setzen (auch nach einem Teilerfolg) neu lesen. */
  onGesetzt: () => void;
}) {
  /** Im Bereich geändert – bis dahin gilt, was ChurchTools zeigt. */
  const [eigene, setEigene] = useState<RollenStufe[] | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [gesetzt, setGesetzt] = useState(false);
  /**
   * Die Rechte sind gesetzt, nur ein Nachschritt ist gescheitert (Leitung festhalten, W3b-3; Website-Rollen nachziehen, W3b-4a)
   * – das ist nicht „noch nicht gesetzt“.
   */
  const [teilweise, setTeilweise] = useState(false);

  const wahl = eigene ?? wahlAus(rollen, ist ?? []);

  const stufeSetzen = (rolle: number, stufe: Stufe) => {
    setGesetzt(false);
    setEigene(wahl.map((r) => (r.rolle === rolle ? { ...r, stufe } : r)));
  };

  const los = () => {
    setLaeuft(true);
    onLaeuft(true);
    setFehler(null);
    setGesetzt(false);
    setTeilweise(false);
    setzen(wahl).then(
      () => {
        setLaeuft(false);
        onLaeuft(false);
        setGesetzt(true);
        setEigene(null);
        onGesetzt();
      },
      (e: unknown) => {
        setLaeuft(false);
        onLaeuft(false);
        setFehler(fehlerMeldung(e));
        // Etwas steht schon – neu lesen, damit die Stufen zeigen, was jetzt gilt.
        if (e instanceof LeitungNichtFestgehalten || e instanceof WebsiteNichtNachgezogen) {
          setTeilweise(true);
          setEigene(null);
          onGesetzt();
        }
      },
    );
  };

  return (
    <>
      <RollenStufen
        rollen={rollen}
        wahl={wahl}
        ist={ist}
        disabled={laeuft || gesperrt}
        onWahl={stufeSetzen}
      />
      {rollen.length > 0 && (
        <div className={styles.knopfreihe}>
          <FensterKnopf art="zweit" disabled={laeuft || gesperrt} onClick={los}>
            {laeuft ? 'Rechte werden gesetzt …' : 'Rechte setzen'}
          </FensterKnopf>
        </div>
      )}
      <div aria-live="polite">
        {gesetzt && <p className={styles.meldung}>Die Rechte sind gesetzt und nachgelesen.</p>}
        {fehler && (
          <p className={`${styles.meldung} ${styles.fehler}`} role="alert">
            {teilweise ? fehler.text : <>Noch nicht gesetzt – {fehler.text}</>}
          </p>
        )}
      </div>
    </>
  );
}
