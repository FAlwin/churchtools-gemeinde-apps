import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import { anzahlFehlerText } from './plaetzeTexte';
import { useInsBild } from './useInsBild';
// Dieselben Fach-Bausteine wie die anderen Fächer – ein Aussehen für alle.
import styles from './WerKann.module.scss';
import eigen from './PlaetzeFach.module.scss';

/** Ein Dienst im Fach: wie viele Plätze, wie viele belegt, und wie viele Entwürfe dort liegen. */
export interface PlaetzeZeile {
  serviceId: number;
  name: string;
  anzahl: number;
  belegt: number;
  /**
   * Entwürfe an diesem Dienst und Termin (gültig oder veraltet). Dann bleibt die Zahl, wie sie ist: Gemessen
   * (15.10.2026) nummeriert ChurchTools die Plätze beim Ändern neu (ein einzelner Platz hat keine Nummer, ab zwei
   * heißen sie 1, 2, …) – ein Entwurf fände seinen Platz nicht mehr.
   */
  entwuerfe: number;
}

/**
 * **Die Plätze eines Termins** (Bauplan E4-5-3, Entwurf `e4-5-entwurf.html` Abschnitt 4): je Dienst der Gruppe
 * − und +. Jeder Tipp wird **sofort** gespeichert und nachgelesen (Alwin, 15.10.2026) – ChurchTools verschickt
 * dabei nichts (gemessen). Belegte Plätze lassen sich nicht wegnehmen. Kein „Auf Vorlage zurücksetzen“: Ein
 * Termin kennt seine Vorlage nicht (gemessen). `onClose(true)`, wenn sich etwas geändert hat.
 */
export function PlaetzeFach({
  titel,
  unter,
  zeilen,
  aendern,
  onGespeichert,
  onClose,
}: {
  titel: string;
  unter: string;
  zeilen: PlaetzeZeile[];
  aendern: (z: PlaetzeZeile, gesehen: number, neu: number) => Promise<AnzahlErgebnis>;
  onGespeichert: (text: string) => void;
  onClose: (geaendert: boolean) => void;
}) {
  const [anzahl, setAnzahl] = useState(() => new Map(zeilen.map((z) => [z.serviceId, z.anzahl])));
  const [laeuft, setLaeuft] = useState<number | null>(null);
  const [geaendert, setGeaendert] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const hinweisRef = useInsBild<HTMLDivElement>(meldung);

  const setze = async (z: PlaetzeZeile, neu: number) => {
    if (laeuft !== null) return;
    const gesehen = anzahl.get(z.serviceId) ?? z.anzahl;
    setLaeuft(z.serviceId);
    setMeldung(null);
    const r = await aendern(z, gesehen, neu);
    setLaeuft(null);
    if (r.ok) {
      setAnzahl((alt) => new Map(alt).set(z.serviceId, r.anzahl));
      setGeaendert(true);
      onGespeichert(`${z.name}: jetzt ${r.anzahl} ${r.anzahl === 1 ? 'Platz' : 'Plätze'}.`);
      return;
    }
    // Was jetzt dasteht, gilt – damit der nächste Tipp vom richtigen Stand ausgeht.
    if (r.jetzt !== undefined) {
      const jetzt = r.jetzt;
      setAnzahl((alt) => new Map(alt).set(z.serviceId, jetzt));
      if (jetzt !== gesehen) setGeaendert(true);
    }
    setMeldung(`${z.name}: ${anzahlFehlerText(r)}`);
  };

  return (
    <Sheet
      title={titel}
      onClose={() => laeuft === null && onClose(geaendert)}
      cancelLabel="Schließen"
    >
      <p className={styles.unter}>{unter}</p>
      <ul className={eigen.liste} aria-label="Plätze je Dienst">
        {zeilen.map((z) => {
          const n = anzahl.get(z.serviceId) ?? z.anzahl;
          return (
            <li key={z.serviceId} className={eigen.zeile}>
              <span className={eigen.dienst}>
                {z.name}
                <small>
                  {n === 0 ? 'nicht vorgesehen' : z.belegt > 0 ? `${z.belegt} belegt` : 'frei'}
                </small>
                {z.entwuerfe > 0 && (
                  <small className={eigen.gesperrt}>
                    {z.entwuerfe === 1
                      ? 'Hier liegt ein Entwurf'
                      : `Hier liegen ${z.entwuerfe} Entwürfe`}{' '}
                    – erst senden oder entfernen.
                  </small>
                )}
              </span>
              <button
                type="button"
                className={eigen.rund}
                disabled={laeuft !== null || n <= z.belegt || z.entwuerfe > 0}
                aria-label={`${z.name}: ein Platz weniger`}
                onClick={() => void setze(z, n - 1)}
              >
                −
              </button>
              <span className={eigen.zahl} aria-label={`${z.name}: ${n} Plätze`}>
                {laeuft === z.serviceId ? '…' : n}
              </span>
              <button
                type="button"
                className={eigen.rund}
                disabled={laeuft !== null || z.entwuerfe > 0}
                aria-label={`${z.name}: ein Platz mehr`}
                onClick={() => void setze(z, n + 1)}
              >
                +
              </button>
            </li>
          );
        })}
      </ul>
      <p className={styles.hinweis}>
        Belegte Plätze lassen sich nicht wegnehmen – erst die Person zurückziehen, dann den Platz.
        Jede Änderung gilt sofort; ChurchTools schickt dabei niemandem etwas.
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
