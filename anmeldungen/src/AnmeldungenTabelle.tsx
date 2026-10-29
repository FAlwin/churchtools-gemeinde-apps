import type { ReactNode } from 'react';
import type { Sortierung, Summe, TabellenSpalte } from '@shared/anmeldung/tabelle';
import t from './AnmeldungenTabelle.module.scss';

/**
 * **Die Tabelle des Bereichs „Anmeldungen“** (U2-1, Entwurf `u2-tabelle-v1`) – Kopf oben und Summe unten bleiben beim
 * Scrollen stehen, die erste Spalte (Name) links. Was in den Zellen steht, liefert der Aufrufer; Spalten, Summen und
 * Sortierung rechnet `@shared/anmeldung/tabelle`.
 *
 * Die erste Zelle einer Zeile ist ein Knopf (Tastatur, Vorleser); ein Klick irgendwo in der Zeile tut dasselbe.
 */
export function AnmeldungenTabelle<Z>({
  name,
  spalten,
  zeilen,
  schluessel,
  zelle,
  summe,
  sortierung,
  onSortieren,
  onZeile,
}: {
  /** Beschriftung für Vorleser („Anmeldungen“, „Absagen“). */
  name: string;
  spalten: TabellenSpalte[];
  zeilen: Z[];
  schluessel: (z: Z) => string;
  zelle: (spalte: string, z: Z) => ReactNode;
  summe: (spalte: string) => Summe | null;
  sortierung?: Sortierung;
  /** Ohne: nicht sortierbar. */
  onSortieren?: (s: Sortierung) => void;
  /** Ohne: Zeilen nur zum Ansehen. */
  onZeile?: (z: Z) => void;
}) {
  // Aufsteigend → absteigend → wie die Liste (ohne Wahl).
  const weiter = (k: string): Sortierung =>
    sortierung?.schluessel !== k
      ? { schluessel: k, absteigend: false }
      : !sortierung.absteigend
        ? { schluessel: k, absteigend: true }
        : null;
  const klasse = (s: TabellenSpalte, i: number) =>
    [s.zahl ? t.zahl : '', i === 0 ? t.fest : ''].filter(Boolean).join(' ');

  return (
    <div className={t.rahmen}>
      <table className={t.tabelle} aria-label={name}>
        <thead>
          <tr>
            {spalten.map((s, i) => {
              const an = sortierung?.schluessel === s.schluessel;
              return (
                <th
                  key={s.schluessel}
                  scope="col"
                  className={`${t.kopf} ${klasse(s, i)}`}
                  aria-sort={an ? (sortierung.absteigend ? 'descending' : 'ascending') : undefined}
                >
                  {onSortieren ? (
                    <button
                      type="button"
                      className={t.sortKnopf}
                      onClick={() => onSortieren(weiter(s.schluessel))}
                    >
                      {s.titel}
                      {an && (
                        <span className={t.pfeil} aria-hidden>
                          {sortierung.absteigend ? '▼' : '▲'}
                        </span>
                      )}
                    </button>
                  ) : (
                    s.titel
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr
              key={schluessel(z)}
              className={onZeile ? t.zeile : undefined}
              onClick={onZeile ? () => onZeile(z) : undefined}
            >
              {spalten.map((s, i) => (
                <td key={s.schluessel} className={`${t.zelle} ${klasse(s, i)}`}>
                  {i === 0 && onZeile ? (
                    <button
                      type="button"
                      className={t.oeffnen}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onZeile(z);
                      }}
                    >
                      {zelle(s.schluessel, z)}
                    </button>
                  ) : (
                    zelle(s.schluessel, z)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            {spalten.map((s, i) => {
              const w = summe(s.schluessel);
              return (
                <td key={s.schluessel} className={`${t.summe} ${klasse(s, i)}`}>
                  {w && (
                    <>
                      {w.text}
                      {w.klein && <small className={t.klein}>{w.klein}</small>}
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
