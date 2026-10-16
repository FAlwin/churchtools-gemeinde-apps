import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { tagKurz } from '@shared/ct/datum';
import type { Entwurf, EntwurfErgebnis } from '@shared/dienstplan/entwuerfe';
import { grundText } from './ladeEntwuerfe';
import { aktionText } from './sendenTexte';
import styles from './SendenFach.module.scss';

/** Ein alter Entwurf: wo er lag und warum er nirgends mehr steht. */
export interface AlterEntwurf {
  entwurf: Entwurf;
  gruppeId: number;
  grund: 'vorbei' | 'termin-weg' | 'dienst-weg';
  /** Termin und Tag (`YYYY-MM-DD`), wenn bekannt. */
  termin?: { name: string; tag: string };
  dienst?: string;
}

type Ergebnis = { ok: true } | { ok: false; text: string };

/**
 * **Alte Entwürfe aufräumen** (#582, Entwurf `entwuerfe-ohne-platz.html` Abschnitt 2): Entwürfe, deren Termin vorbei
 * oder gelöscht ist oder deren Dienst nicht mehr zum Termin gehört – sie stehen in keiner Spalte. Bewusst mit Liste
 * und „Alle verwerfen“ (Alwin, 15.10.2026), einer nach dem anderen; in ChurchTools ändert sich nichts.
 */
export function AlteEntwuerfeFach({
  zeilen,
  ichId,
  verwerfen,
  onClose,
}: {
  zeilen: AlterEntwurf[];
  ichId: number | null;
  verwerfen: (a: AlterEntwurf) => Promise<EntwurfErgebnis>;
  onClose: (geaendert: boolean) => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnisse, setErgebnisse] = useState<Map<number, Ergebnis>>(new Map());
  const fertig = ergebnisse.size === zeilen.length;
  const verworfen = [...ergebnisse.values()].filter((r) => r.ok).length;

  const los = async () => {
    setLaeuft(true);
    for (const [i, a] of zeilen.entries()) {
      const r = await verwerfen(a);
      const e: Ergebnis = r.ok
        ? { ok: true }
        : {
            ok: false,
            text:
              r.grund === 'konflikt'
                ? 'Inzwischen geändert – nicht verworfen.'
                : grundText(r.grund),
          };
      setErgebnisse((alt) => new Map(alt).set(i, e));
    }
    setLaeuft(false);
  };

  return (
    <Sheet
      title={fertig ? `${verworfen} von ${zeilen.length} verworfen` : 'Alte Entwürfe'}
      onClose={() => !laeuft && onClose(verworfen > 0)}
      cancelLabel={laeuft ? 'Bitte warten …' : fertig ? 'Schließen' : 'Abbrechen'}
    >
      {!fertig && (
        <p className={styles.zusammen}>
          Diese Entwürfe wurden nie gesendet und stehen nirgends mehr. Verwerfen räumt die Schublade
          auf – in ChurchTools ändert sich nichts.
        </p>
      )}
      <ul className={styles.liste} aria-label="Alte Entwürfe">
        {zeilen.map((a, i) => {
          const e = a.entwurf;
          const r = ergebnisse.get(i);
          return (
            <li key={i} className={styles.zeile}>
              <span className={styles.was}>
                {aktionText(e)}
                <small>
                  {wo(a)}
                  {e.von.personId !== ichId && ` · von ${e.von.name}`}
                </small>
                {r && (
                  <small className={r.ok ? undefined : styles.warnung}>
                    {r.ok ? 'verworfen' : r.text}
                  </small>
                )}
              </span>
              {a.dienst && <span className={styles.dienst}>{a.dienst}</span>}
            </li>
          );
        })}
      </ul>
      {!fertig && (
        <div className={styles.knoepfe}>
          <button
            type="button"
            className={styles.primaer}
            disabled={laeuft}
            onClick={() => void los()}
          >
            {laeuft
              ? 'Wird verworfen …'
              : zeilen.length === 1
                ? 'Verwerfen'
                : `Alle ${zeilen.length} verwerfen`}
          </button>
        </div>
      )}
    </Sheet>
  );
}

function wo(a: AlterEntwurf): string {
  const t = a.termin ? `${a.termin.name}, ${tagKurz(a.termin.tag)} – ` : '';
  if (a.grund === 'termin-weg') return 'Termin gelöscht';
  if (a.grund === 'vorbei') return `${t}vorbei`;
  return `${t}Dienst gehört nicht mehr zum Termin`;
}
