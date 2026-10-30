import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import type { Sortierung, Summe, TabellenSpalte } from '@shared/anmeldung/tabelle';
import t from './AnmeldungenTabelle.module.scss';

/**
 * **Die Tabelle des Bereichs „Anmeldungen“** (U2-1, Entwurf `u2-tabelle-v1`) – Kopf oben und Summe unten bleiben beim
 * Scrollen stehen, die angehefteten Spalten links (U2-3: mehrere, am Handy nur die erste; ohne Angabe die erste
 * Spalte). Was in den Zellen steht, liefert der Aufrufer; Spalten, Summen und Sortierung rechnet
 * `@shared/anmeldung/tabelle`.
 *
 * Die erste Zelle einer Zeile ist ein Knopf (Tastatur, Vorleser); ein Klick irgendwo in der Zeile tut dasselbe. Mit
 * `anheften` (U2-4) steht davor eine schmale Spalte mit der Stecknadel – sie bleibt immer links stehen, auch am Handy.
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
  anheften,
}: {
  /** Beschriftung für Vorleser („Anmeldungen“, „Absagen“). */
  name: string;
  /** `fest`: angeheftet – angeheftete Spalten stehen vorn (`gezeigteSpalten`). */
  spalten: (TabellenSpalte & { fest?: boolean })[];
  zeilen: Z[];
  schluessel: (z: Z) => string;
  zelle: (spalte: string, z: Z) => ReactNode;
  summe: (spalte: string) => Summe | null;
  sortierung?: Sortierung;
  /** Ohne: nicht sortierbar. */
  onSortieren?: (s: Sortierung) => void;
  /** Ohne: Zeilen nur zum Ansehen. */
  onZeile?: (z: Z) => void;
  /**
   * Zeilen anheften (U2-4): `an` – angeheftet (der Aufrufer stellt sie nach oben, `obenZuerst`). Ohne: keine Nadel
   * (Absagen).
   */
  anheften?: { an: (z: Z) => boolean; umschalten: (z: Z) => void };
}) {
  // Aufsteigend → absteigend → wie die Liste (ohne Wahl).
  const weiter = (k: string): Sortierung =>
    sortierung?.schluessel !== k
      ? { schluessel: k, absteigend: false }
      : !sortierung.absteigend
        ? { schluessel: k, absteigend: true }
        : null;
  // Angeheftet sind die vorderen Spalten mit `fest` – ohne Angabe nur die erste (Absagen).
  const istFest = spalten.map((s, i) => s.fest ?? i === 0);
  const festeVorn = istFest.indexOf(false) === -1 ? spalten.length : istFest.indexOf(false);
  const klasse = (s: TabellenSpalte, i: number) =>
    [
      s.zahl ? t.zahl : '',
      i < festeVorn ? t.fest : '',
      i === 0 && festeVorn > 0 ? t.ersteFest : '',
      i === festeVorn - 1 ? t.festEnde : '',
    ]
      .filter(Boolean)
      .join(' ');
  // Die Nadel-Spalte zählt zu den stehenden Zellen vorn – gemessen wird in Zellen der Zeile, nicht in Spalten.
  const nadel = anheften ? 1 : 0;
  const festeZellen = festeVorn + nadel;
  const nadelKlasse = `${t.nadelSpalte} ${t.fest}${festeVorn === 0 ? ` ${t.festEnde}` : ''}`;
  // Die letzte angeheftete Zeile trägt die Trennlinie zu den übrigen.
  const letzteOben = anheften ? zeilen.filter(anheften.an).length - 1 : -1;

  // Wo eine angeheftete Spalte stehen bleibt, hängt an der Breite der Spalten links davon – gemessen, nicht geschätzt.
  const tabelle = useRef<HTMLTableElement>(null);
  useLayoutEffect(() => {
    const tab = tabelle.current;
    if (!tab || festeZellen < 2) return;
    const messen = () => {
      const koepfe = Array.from(tab.rows[0]?.cells ?? []);
      let links = 0;
      for (let i = 0; i < festeZellen; i++) {
        for (const zeile of Array.from(tab.rows)) {
          const zelle = zeile.cells[i];
          if (zelle) zelle.style.left = `${links}px`;
        }
        links += koepfe[i]?.getBoundingClientRect().width ?? 0;
      }
    };
    messen();
    if (typeof ResizeObserver === 'undefined') return;
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(tab);
    return () => beobachter.disconnect();
  });

  return (
    <div className={t.rahmen}>
      <table ref={tabelle} className={t.tabelle} aria-label={name}>
        <thead>
          <tr>
            {anheften && (
              <th
                scope="col"
                className={`${t.kopf} ${nadelKlasse}`}
                aria-label="Angeheftet"
                title="Zeile oben anheften"
              />
            )}
            {spalten.map((s, i) => {
              const an = sortierung?.schluessel === s.schluessel;
              return (
                <th
                  key={s.schluessel}
                  scope="col"
                  className={`${t.kopf} ${klasse(s, i)}`}
                  // Fragen sind oft lang (Prüfstand: „An welchen Tagen bist du da? (nur bei …)“) – höchstens zwei
                  // Zeilen, ganz beim Darüberfahren.
                  title={s.titel}
                  aria-sort={an ? (sortierung.absteigend ? 'descending' : 'ascending') : undefined}
                >
                  {onSortieren ? (
                    <button
                      type="button"
                      className={t.sortKnopf}
                      onClick={() => onSortieren(weiter(s.schluessel))}
                    >
                      <span className={t.titel}>{s.titel}</span>
                      {an && (
                        <span className={t.pfeil} aria-hidden>
                          {sortierung.absteigend ? '▼' : '▲'}
                        </span>
                      )}
                    </button>
                  ) : (
                    <span className={t.titel}>{s.titel}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z, nr) => (
            <tr
              key={schluessel(z)}
              className={
                [
                  onZeile ? t.zeile : '',
                  anheften?.an(z) ? t.oben : '',
                  nr === letzteOben ? t.trenn : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              onClick={onZeile ? () => onZeile(z) : undefined}
            >
              {anheften && (
                <td className={`${t.zelle} ${nadelKlasse}`}>
                  <button
                    type="button"
                    className={t.nadelKnopf}
                    aria-pressed={anheften.an(z)}
                    // Ohne Namen: Die Nadel steht in der Zeile, und der Name gehört dem Knopf daneben, der sie öffnet.
                    aria-label={
                      anheften.an(z) ? 'Zeile nicht mehr anheften' : 'Zeile oben anheften'
                    }
                    title={
                      anheften.an(z)
                        ? 'Nicht mehr anheften'
                        : 'Zeile oben anheften (nur auf diesem Gerät)'
                    }
                    onClick={(ev) => {
                      ev.stopPropagation();
                      anheften.umschalten(z);
                    }}
                  >
                    <Icon name="nadel" size={15} />
                  </button>
                </td>
              )}
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
            {anheften && <td className={`${t.summe} ${nadelKlasse}`} />}
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
