import type { ReactNode } from 'react';
import { Schalter } from '@ui/bedienung/Schalter';
import type { HandLage, HandPlatz } from '@shared/anmeldung/vonHand';
import a from './AnmeldungenReiter.module.scss';
import k from './Baukasten.module.scss';

/**
 * **Platz und Betrag** beim Anmelden von Hand (A7-4a/b) und Zurückholen (A7-4c) – EINE Darstellung: Plätze, wohin die
 * Person kommt (`handPlatz`), „Trotzdem einen Platz geben“ und die Zeile mit dem Betrag. Hinweise des Aufrufers stehen
 * darunter (`children`).
 */
export function PlatzWahl({
  lage,
  platz,
  trotzdem,
  onTrotzdem,
  vor,
  betrag,
  children,
}: {
  lage: HandLage;
  platz: HandPlatz;
  trotzdem: boolean;
  onTrotzdem: (an: boolean) => void;
  vor: string;
  /** Beschriftung und Wert der Betragszeile – `null`, wenn nichts kostet. */
  betrag: { titel: string; wert: string } | null;
  children?: ReactNode;
}) {
  return (
    <section className={a.teil}>
      <h3>Platz und Betrag</h3>
      <p className={a.summe}>
        <span>Plätze</span>
        <span>
          {lage.max === null ? lage.belegt : `${lage.belegt} von ${lage.max}`}
          {lage.wartende > 0 && ` · ${lage.wartende} ${lage.wartende === 1 ? 'wartet' : 'warten'}`}
        </span>
      </p>
      <p className={a.summe}>
        <span>{vor} kommt auf</span>
        {platz.status === 'active' ? (
          <span className={`${a.pille} ${a.pilleOk}`}>
            einen Platz{platz.neuesMax !== null ? ` (Plätze → ${platz.neuesMax})` : ''}
          </span>
        ) : (
          <span className={`${a.pille} ${a.pilleWarte}`}>Warteliste {platz.warteplatz}</span>
        )}
      </p>
      {platz.wuerdeWarten && !platz.nurMitPlatz && (
        <button
          type="button"
          className={k.schalterZeile}
          aria-pressed={trotzdem}
          onClick={() => onTrotzdem(!trotzdem)}
        >
          <Schalter an={trotzdem} />
          Trotzdem einen Platz geben
          {lage.max !== null && lage.belegt >= lage.max
            ? ` (Plätze auf ${lage.belegt + 1} erhöhen)`
            : ''}
        </button>
      )}
      {platz.nurMitPlatz && (
        <p className={a.leise}>
          Kein Platz frei und keine Warteliste – {vor} bekommt einen Platz
          {platz.neuesMax !== null ? `, die Plätze werden auf ${platz.neuesMax} erhöht` : ''}.
        </p>
      )}
      {betrag && (
        <p className={a.summe}>
          <span>{betrag.titel}</span>
          <b>{betrag.wert}</b>
        </p>
      )}
      {children}
    </section>
  );
}
