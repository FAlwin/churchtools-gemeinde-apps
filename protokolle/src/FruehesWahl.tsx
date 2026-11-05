import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { tagPunkt } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import wahl from './AnfangWahl.module.scss';

/**
 * **Fenster „Früheres Protokoll“** (Bauplan K3b-2, Entwurf `k3b-v1`): alle freigegebenen Protokolle der Gruppe, neueste
 * zuerst, das letzte vorgewählt und als „letzte Sitzung“ markiert. Beim Einfügen („Einfügen“) und am Kasten („Ändern“ →
 * „Übernehmen“) dasselbe Fenster; die Knöpfe sehen aus wie „Womit beginnen?“ (`AnfangWahl`).
 */
export function FruehesWahl({
  titel,
  knopf,
  protokolle,
  letztes,
  vorgewaehlt,
  zeitzone,
  onWahl,
  onClose,
}: {
  titel: string;
  knopf: string;
  protokolle: readonly Sitzung[];
  /** `kopf.sitzung` des letzten Protokolls vor dieser Sitzung – bekommt den Hinweis „letzte Sitzung“. */
  letztes: string | null;
  vorgewaehlt: string | null;
  zeitzone: string;
  onWahl: (s: Sitzung) => void;
  onClose: () => void;
}) {
  const [gewaehlt, setGewaehlt] = useState(
    vorgewaehlt ?? letztes ?? protokolle[0]?.kopf?.sitzung ?? null,
  );
  const s = protokolle.find((p) => p.kopf?.sitzung === gewaehlt) ?? null;
  const tag = (iso: string) => tagPunkt(tagAusIso(iso, zeitzone));
  return (
    <Sheet
      title={titel}
      onClose={onClose}
      knoepfe={
        <FensterKnopf disabled={!s} onClick={() => s && onWahl(s)}>
          {knopf}
        </FensterKnopf>
      }
    >
      <div className={wahl.liste} role="group" aria-label="Welches Protokoll?">
        {protokolle.map((p) => (
          <button
            key={p.schluessel}
            type="button"
            className={wahl.wahl}
            aria-pressed={p.kopf?.sitzung === gewaehlt}
            onClick={() => setGewaehlt(p.kopf?.sitzung ?? null)}
          >
            <b>
              {p.titel} · {tag(p.beginn)}
              {p.kopf?.sitzung === letztes ? ' · letzte Sitzung' : ''}
            </b>
            {p.kopf?.freigabe && <small>freigegeben am {tag(p.kopf.freigabe.am)}</small>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
