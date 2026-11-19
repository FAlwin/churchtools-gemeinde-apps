import { Sheet } from '@ui/fenster/Sheet';
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import { plaetzeGrenze } from './plaetzeGrenze';
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
 * nachgelesen, − nicht unter die Belegten und die Entwürfe auf freien Plätzen, + ohne Obergrenze – auch mit Entwürfen (der
 * Dienstplaner trägt sie dabei um, 19.11.2026); gesperrt nur, wo die Entwürfe der Gruppe nicht umgetragen werden dürfen
 * (`plaetzeGrenze`). `onClose(true)`, wenn sich etwas geändert hat.
 */
export function PlatzFenster({
  titel,
  unter,
  z,
  mitEntwuerfen = null,
  aendern,
  onGespeichert,
  onClose,
}: {
  titel: string;
  unter: string;
  z: PlaetzeZeile;
  /**
   * Belegt und frei, gezählt wie die Zeile „Plätze“ (`plaetzeStand`, Entwürfe zählen mit). Liegen Entwürfe vor, zeigt das
   * Fenster die belegten samt Entwürfen – sonst stünde „frei 0“ neben einer roten Zeile „1 von 2“ (17.11.2026); „frei“
   * rechnet es mit der Zahl im Fenster (die sich mit „+“ ändert, `frei` hier ist die vom Öffnen). Ohne Entwürfe sind beide
   * Zählungen gleich.
   */
  mitEntwuerfen?: { belegt: number; frei: number } | null;
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
  const grenze = plaetzeGrenze(z, n);
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
        {z.entwuerfe > 0 && mitEntwuerfen
          ? `belegt ${mitEntwuerfen.belegt} · Plätze ${n} · frei ${Math.max(n - mitEntwuerfen.belegt, 0)} (mit Entwürfen)`
          : `belegt ${z.belegt} · Plätze ${n} · frei ${Math.max(n - z.belegt, 0)}`}
      </p>
      {grenze.hinweis && <p className={eigen.gesperrtText}>{grenze.hinweis}</p>}
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
