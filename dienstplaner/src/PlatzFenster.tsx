import { Sheet } from '@ui/fenster/Sheet';
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import { sperreText } from './plaetzeTexte';
import { PlatzRegler } from './PlatzRegler';
import type { PlaetzeZeile } from './PlaetzeFach';
import { useAnzahlSetzen } from './useAnzahlSetzen';
import { useInsBild } from './useInsBild';
// Dieselben Fach-Bausteine wie das Plätze-Fach – ein Aussehen für alle.
import styles from './WerKann.module.scss';
import eigen from './PlaetzeFach.module.scss';

/**
 * **Die Plätze EINES Dienstes an EINEM Termin** (P2c, Entwurf `e9-p2-eintragen.html` Fall 9): aufgerufen von der Zeile
 * „Plätze“ in „Personen“ und vom roten Tag in „Noch offen“. Derselbe Regler und dieselbe Logik wie das Plätze-Fach der
 * Matrix (`PlatzRegler`, `useAnzahlSetzen` → `anzahlAendern`): jeder Tipp wird sofort in ChurchTools gespeichert und
 * nachgelesen, − nicht unter die Belegten, + ohne Obergrenze, bei einem Entwurf an diesem Dienst und Termin gesperrt
 * (ChurchTools nummeriert die Plätze beim Ändern neu). `onClose(true)`, wenn sich etwas geändert hat.
 */
export function PlatzFenster({
  titel,
  unter,
  z,
  aendern,
  onGespeichert,
  onClose,
}: {
  titel: string;
  unter: string;
  z: PlaetzeZeile;
  aendern: (z: PlaetzeZeile, gesehen: number, neu: number) => Promise<AnzahlErgebnis>;
  onGespeichert: (text: string) => void;
  onClose: (geaendert: boolean) => void;
}) {
  const { anzahl, laeuft, geaendert, meldung, beschaeftigt, setze } = useAnzahlSetzen({
    zeilen: [z],
    aendern,
    onGespeichert,
  });
  const hinweisRef = useInsBild<HTMLDivElement>(meldung);
  const n = anzahl.get(z.serviceId) ?? z.anzahl;
  return (
    <Sheet
      title={titel}
      onClose={() => !beschaeftigt && onClose(geaendert)}
      knoepfe={null}
      beschaeftigt={beschaeftigt}
    >
      <p className={styles.unter}>{unter}</p>
      <div className={eigen.einzel}>
        <PlatzRegler
          z={z}
          n={n}
          laeuft={laeuft === z.serviceId}
          beschaeftigt={beschaeftigt}
          onSetze={(neu) => void setze(z, neu)}
        />
      </div>
      <p className={eigen.zahlen}>
        belegt {z.belegt} · Plätze {n} · frei {Math.max(n - z.belegt, 0)}
      </p>
      {z.entwuerfe > 0 && <p className={eigen.gesperrtText}>{sperreText(z.entwuerfe)}</p>}
      {z.entwuerfe === 0 && n <= z.belegt && z.belegt > 0 && (
        <p className={eigen.gesperrtText}>
          Erst jemanden herausnehmen – unter die Zahl der Belegten geht es nicht.
        </p>
      )}
      <p className={styles.hinweis}>
        {n === 0
          ? '0 Plätze: Der Dienst ist an diesem Termin aus.'
          : '0 Plätze würden den Dienst an diesem Termin ausschalten.'}{' '}
        Wird sofort in ChurchTools gespeichert.
      </p>
      <div ref={hinweisRef}>
        {meldung && (
          <p className={styles.fehler} role="alert">
            {meldung}
          </p>
        )}
      </div>
    </Sheet>
  );
}
