import { useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { tagKurz } from '@shared/ct/datum';
import { ortSchluessel, type Entwurf } from '@shared/dienstplan/entwuerfe';
import type { SendeEintrag, SendeErgebnis } from '@shared/dienstplan/senden';
import { aktionText, ergebnisText, wiederholbar } from './sendenTexte';
import type { SendeHinweis } from './sendeHinweise';
import styles from './SendenFach.module.scss';

/** Eine Zeile der Liste: der Entwurf, seine Schublade und wo er hingehört. */
export interface SendeZeile {
  entwurf: Entwurf;
  kategorie: number;
  /** `YYYY-MM-DD` */
  tag: string;
  termin: string;
  dienst: string;
}

type Phase = 'liste' | 'laeuft' | 'fertig';

/**
 * **Das Senden-Fach** (Bauplan E4-4-2, Entwurf `e4-4-entwurf.html`): die Entwürfe nach Terminen mit Häkchen je
 * Zeile (Alwin, 15.10.), Hinweise „abwesend / am Tag schon“ (vorher geprüft), dann senden – einer nach dem
 * anderen mit Fortschritt – und das Ergebnis je Zeile. Nichts wird verworfen; „Erneut senden“ versucht nur, was
 * sich lohnt. `onClose(true)`, wenn etwas gesendet wurde – dann lädt der Aufrufer Matrix und Entwürfe neu.
 */
export function SendenFach({
  zeilen,
  ichId,
  hinweise,
  senden,
  onClose,
}: {
  zeilen: SendeZeile[];
  ichId: number | null;
  hinweise: (zeilen: SendeZeile[]) => Promise<Map<string, SendeHinweis>>;
  senden: (
    eintraege: SendeEintrag[],
    melde: (index: number, ergebnis: SendeErgebnis) => void,
  ) => Promise<SendeErgebnis[]>;
  onClose: (gesendet: boolean) => void;
}) {
  const schluessel = (z: SendeZeile) => ortSchluessel(z.entwurf.ort);
  const [haken, setHaken] = useState<Set<string>>(() => new Set(zeilen.map(schluessel)));
  const [hw, setHw] = useState<Map<string, SendeHinweis> | null>(null);
  const [phase, setPhase] = useState<Phase>('liste');
  const [ergebnisse, setErgebnisse] = useState<Map<string, SendeErgebnis>>(new Map());
  const [jetzt, setJetzt] = useState<string | null>(null);
  // Ab dem ersten Senden zeigt das Fach nur noch, was ausgewählt war – Abgewähltes bleibt einfach Entwurf.
  const [auswahl, setAuswahl] = useState<Set<string> | null>(null);
  const sichtbar = auswahl ? zeilen.filter((z) => auswahl.has(schluessel(z))) : zeilen;

  useEffect(() => {
    let aktuell = true;
    hinweise(zeilen).then(
      (m) => aktuell && setHw(m),
      () => aktuell && setHw(new Map()),
    );
    return () => {
      aktuell = false;
    };
    // Einmal beim Öffnen – die Liste ändert sich im offenen Fach nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gewaehlt = zeilen.filter((z) => haken.has(schluessel(z)));
  const zuSenden =
    phase === 'fertig'
      ? sichtbar.filter((z) => wiederholbar(ergebnisse.get(schluessel(z))))
      : gewaehlt;
  const gesendet = [...ergebnisse.values()].filter((r) => r.art === 'gesendet').length;

  const los = async () => {
    const liste = zuSenden;
    if (!liste.length) return;
    setAuswahl((alt) => alt ?? new Set(liste.map(schluessel)));
    setPhase('laeuft');
    setErgebnisse((alt) => {
      const neu = new Map(alt);
      for (const z of liste) neu.delete(schluessel(z));
      return neu;
    });
    setJetzt(schluessel(liste[0]));
    await senden(
      liste.map((z) => ({ entwurf: z.entwurf, kategorie: z.kategorie })),
      (i, r) => {
        setErgebnisse((alt) => new Map(alt).set(schluessel(liste[i]), r));
        setJetzt(liste[i + 1] ? schluessel(liste[i + 1]) : null);
      },
    );
    setJetzt(null);
    setPhase('fertig');
  };

  const zaehle = (f: (e: Entwurf) => boolean) => gewaehlt.filter((z) => f(z.entwurf)).length;
  const anfragen = zaehle((e) => e.ziel.art === 'person' && e.modus === 'anfrage');
  const direkt = zaehle((e) => e.ziel.art === 'person' && e.modus === 'direkt');
  const gaeste = zaehle((e) => e.ziel.art === 'gast');
  const mitHinweis = gewaehlt.filter((z) => {
    const h = hw?.get(schluessel(z));
    return h && 'text' in h;
  }).length;

  const titel =
    phase === 'liste'
      ? 'Einteilungen senden'
      : phase === 'laeuft'
        ? `Wird gesendet … ${ergebnisse.size} von ${sichtbar.length}`
        : gesendet === sichtbar.length
          ? gesendet === 1
            ? 'Gesendet'
            : `Alle ${gesendet} gesendet`
          : `${gesendet} gesendet, ${sichtbar.length - gesendet} nicht`;

  // Nach Terminen geordnet (die Zeilen kommen schon sortiert).
  const gruppen: { kopf: string; zeilen: SendeZeile[] }[] = [];
  for (const z of sichtbar) {
    const kopf = `${tagKurz(z.tag)} · ${z.termin}`;
    const letzte = gruppen.at(-1);
    if (letzte?.kopf === kopf) letzte.zeilen.push(z);
    else gruppen.push({ kopf, zeilen: [z] });
  }

  return (
    <Sheet
      title={titel}
      onClose={() => phase !== 'laeuft' && onClose(gesendet > 0)}
      cancelLabel={
        phase === 'laeuft'
          ? 'Bitte warten – wird gesendet …'
          : phase === 'fertig'
            ? 'Schließen'
            : 'Abbrechen'
      }
    >
      {phase === 'liste' && (
        <p className={styles.zusammen}>
          {anfragen > 0 && (
            <>
              <b>
                {anfragen} {anfragen === 1 ? 'Anfrage' : 'Anfragen'}
              </b>{' '}
              – bekommen eine Mitteilung in der ChurchTools-App und können zu- oder absagen.{' '}
            </>
          )}
          {direkt > 0 && (
            <>
              <b>{direkt} direkt zugeteilt</b> – bekommen eine Mitteilung und stehen sofort als
              zugesagt im Plan.{' '}
            </>
          )}
          {gaeste > 0 && (
            <>
              <b>
                {gaeste} {gaeste === 1 ? 'Gast' : 'Gäste'}
              </b>{' '}
              – nur der Name im Plan.
            </>
          )}
          {gewaehlt.length === 0 && 'Nichts ausgewählt.'}
        </p>
      )}
      {phase === 'laeuft' && (
        <div className={styles.fortschritt} aria-hidden>
          <i style={{ width: `${(100 * ergebnisse.size) / Math.max(1, sichtbar.length)}%` }} />
        </div>
      )}

      <ul className={styles.liste} aria-label="Einteilungen">
        {gruppen.map((g) => [
          <li key={g.kopf} className={styles.kopf}>
            {g.kopf}
          </li>,
          ...g.zeilen.map((z) => {
            const k = schluessel(z);
            const e = z.entwurf;
            const r = ergebnisse.get(k);
            const h = hw?.get(k);
            const fremd = e.von.personId !== ichId ? `von ${e.von.name}` : null;
            return (
              <li key={k} className={styles.zeile}>
                {phase === 'liste' ? (
                  <input
                    type="checkbox"
                    className={styles.haken}
                    checked={haken.has(k)}
                    aria-label={`${aktionText(e)} – ${z.dienst}`}
                    onChange={() =>
                      setHaken((alt) => {
                        const neu = new Set(alt);
                        if (neu.has(k)) neu.delete(k);
                        else neu.add(k);
                        return neu;
                      })
                    }
                  />
                ) : (
                  <Zeichen r={r} laeuft={jetzt === k} />
                )}
                <span className={styles.was}>
                  {aktionText(e)}
                  {phase === 'liste' ? (
                    <>
                      {fremd && <small>{fremd}</small>}
                      {h && 'text' in h && <small className={styles.warnung}>{h.text}</small>}
                      {/* Ehrlich bleiben: Ohne Antwort ist „kein Hinweis“ nicht dasselbe wie „alles gut“. */}
                      {h && 'ungeprueft' in h && <small>Hinweise nicht geprüft</small>}
                    </>
                  ) : (
                    r && (
                      <small className={r.art === 'gesendet' ? undefined : styles.warnung}>
                        {ergebnisText(r, e)}
                      </small>
                    )
                  )}
                </span>
                <span className={styles.dienst}>{z.dienst}</span>
              </li>
            );
          }),
        ])}
      </ul>

      {phase === 'liste' && hw === null && (
        <p className={styles.hinweis}>
          Hinweise (abwesend, am Tag schon eingeteilt) werden geprüft …
        </p>
      )}
      {phase === 'liste' && mitHinweis > 0 && (
        <div className={styles.kasten}>
          <b>
            {mitHinweis} {mitHinweis === 1 ? 'Einteilung hat' : 'Einteilungen haben'} einen Hinweis
          </b>{' '}
          (abwesend oder am selben Tag schon eingeteilt). Du kannst trotzdem senden – oder sie
          abwählen.
        </div>
      )}

      {phase !== 'laeuft' && zuSenden.length > 0 && (
        <div className={styles.knoepfe}>
          <button type="button" className={styles.primaer} onClick={() => void los()}>
            {phase === 'liste'
              ? `Jetzt senden (${zuSenden.length})`
              : `Erneut senden (${zuSenden.length})`}
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** Stand einer Zeile beim Senden: ✓ gesendet, × nicht, ! Konflikt/geändert, ○ wartet, ◌ läuft. */
function Zeichen({ r, laeuft }: { r: SendeErgebnis | undefined; laeuft: boolean }) {
  if (laeuft)
    return <span className={`${styles.zeichen} ${styles.zLauf}`} aria-label="wird gesendet" />;
  if (!r) return <span className={`${styles.zeichen} ${styles.zWarte}`} aria-label="wartet" />;
  if (r.art === 'gesendet') {
    return (
      <span className={`${styles.zeichen} ${styles.zOk}`} aria-label="gesendet">
        ✓
      </span>
    );
  }
  const gelb =
    r.art === 'nicht-gesendet' && (r.grund === 'konflikt' || r.grund === 'entwurf-geaendert');
  return (
    <span
      className={`${styles.zeichen} ${gelb ? styles.zAchtung : styles.zFehl}`}
      aria-label="nicht gesendet"
    >
      {gelb ? '!' : '×'}
    </span>
  );
}
