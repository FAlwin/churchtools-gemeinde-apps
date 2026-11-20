import { useState } from 'react';
import { Etikett } from '@ui/bedienung/Etikett';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import { LEITER_RECHTE } from '@shared/organigramm/gruppenwechsel';
import { FertigAnsicht, Schritte } from './EinrichtenFertig';
import { Hinweis } from './KjHinweis';
import type { Start } from './start';
import { useSchreibLauf } from './useSchreibLauf';
import kj from './KinderJugend.module.scss';
import styles from './Einrichten.module.scss';

const SCHRITTE = ['Vorschau', 'Fertig'] as const;

/**
 * **„Rechte der Leitung setzen“** (Bauplan O9-5d, O9-F4, Entwurf `o9-5-einrichten-v1`, „reparieren“) – ein kurzes Fenster:
 * Es zeigt die drei Rechte der Rolle „Leiter“ am Typ „Gruppenwechsel“ (die fehlenden als „ergänzen“), der Admin bestätigt
 * mit dem Haken „geprüft“, dann werden **nur die fehlenden** gesetzt und nachgelesen. Andere Rechte, die jemand von Hand
 * gesetzt hat, bleiben stehen; entzogen wird nie etwas. Die Leserechte der Leitungen (O9-F12) setzt es nicht.
 *
 * `fehlend`: die Rechte, die der Stand der Seite als fehlend gemeldet hat (`fehlendeLeiterRechte`).
 */
export function RechteFenster({
  start,
  fehlend,
  onSchliessen,
  onGeschrieben,
}: {
  start: Start;
  fehlend: readonly { authId: number; name: string; dataId: number | null }[];
  onSchliessen: () => void;
  onGeschrieben: () => void;
}) {
  const [schritt, setSchritt] = useState<1 | 2>(1);
  const [haken, setHaken] = useState(false);
  const { stand, starten, geschrieben } = useSchreibLauf({
    art: 'rechte',
    soll: null,
    ausgang: null,
    von: { personId: start.ichId, name: start.vorname },
  });
  const laeuft = stand?.art === 'laeuft';
  const schliessen = () => {
    onSchliessen();
    if (geschrieben()) onGeschrieben();
  };
  const schreiben = () => {
    setSchritt(2);
    void starten();
  };
  const fehlt = new Set(fehlend.map((r) => r.authId));
  const nochNichtFertig =
    stand?.art === 'vorbei' && (stand.lauf.art === 'gestoppt' || !stand.lauf.ok);
  const nurGestoppt = stand?.art === 'vorbei' && stand.lauf.art === 'gestoppt';

  return (
    <Sheet
      title="Rechte der Leitung setzen"
      onClose={schliessen}
      onHintergrund={schritt === 2 ? () => {} : schliessen}
      beschaeftigt={laeuft}
      cancelLabel={schritt === 2 ? null : undefined}
      breit
      zurueck={schritt === 2 && nurGestoppt ? () => setSchritt(1) : undefined}
      knoepfe={
        schritt === 1 ? (
          <FensterKnopf disabled={!haken || fehlend.length === 0} onClick={schreiben}>
            {fehlend.length === 1 ? 'Recht setzen' : 'Rechte setzen'}
          </FensterKnopf>
        ) : laeuft || !stand ? (
          <FensterKnopf disabled>Es wird geschrieben …</FensterKnopf>
        ) : nochNichtFertig ? (
          <>
            <FensterKnopf art="zweit" onClick={schliessen}>
              Später
            </FensterKnopf>
            <FensterKnopf onClick={schreiben}>Nochmal versuchen</FensterKnopf>
          </>
        ) : (
          <FensterKnopf onClick={schliessen}>Fertig</FensterKnopf>
        )
      }
    >
      <Schritte namen={SCHRITTE} schritt={schritt} />
      {schritt === 1 ? (
        <div className={styles.stapel}>
          <p>
            An der Rolle „Leiter“ des Typs „Gruppenwechsel“{' '}
            {fehlend.length === 1 ? 'fehlt ein Recht' : 'fehlen Rechte'}. So wird es danach
            aussehen:
          </p>
          <ul className={`${styles.anlage} ${kj.karte}`} aria-label="Rechte der Rolle Leiter">
            {LEITER_RECHTE.map((r) => (
              <li key={r.authId}>
                <Etikett ton={fehlt.has(r.authId) ? 'blau' : 'gruen'}>
                  {fehlt.has(r.authId) ? 'ergänzen' : 'vorhanden'}
                </Etikett>
                <span className={styles.anlageMitte}>
                  <b>{r.name}</b>
                </span>
              </li>
            ))}
          </ul>
          <Hinweis>
            Andere Rechte, die jemand von Hand an diese Rolle gesetzt hat, bleiben stehen.
            Teilnehmer bekommen keine Rechte.
          </Hinweis>
          <label className={styles.haken}>
            <input type="checkbox" checked={haken} onChange={(e) => setHaken(e.target.checked)} />
            <span>
              Ich habe die <b>Rechte der Leitung</b> geprüft. Wer Leiter einer Wechsel-Gruppe ist,
              darf dort die Kinder sehen und Ausnahmen setzen – sonst nichts.
            </span>
          </label>
        </div>
      ) : stand ? (
        <FertigAnsicht stand={stand} mitLeseRechten={false} />
      ) : null}
    </Sheet>
  );
}
