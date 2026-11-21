/**
 * **Die Regeln der Info-Tabelle** – eine Stelle für die Ansicht (`AblaufListe`) und die Bearbeiten-Liste
 * (`useAblaufBearbeiten`): Breiten, Mindestbreite, die Info einer Gruppe an einem Punkt und die Messung beim
 * waagerechten Scrollen. Das Raster selbst zeichnet `InfoTabelle.tsx`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import type { InfoGruppe } from '@shared/types/index';
import styles from './AblaufListe.module.scss';

/**
 * Der Punkt behält mindestens so viel Breite (px) – Zeit, Titel, Namen, Kreise und Lied bleiben lesbar. Mit 300 px
 * brachen am iPad hochkant die Namen einzeln um und die Lied-Karte wurde abgeschnitten (Durchklick 02.11.2026).
 */
export const PUNKT_MIN = 380;
/** Breiter wird eine Info-Spalte nicht; längerer Text bricht um. */
export const SPALTE_MAX = 280;
/** So viel Platz plant die Tabelle für eine Spalte mit Text ein, bevor sie waagerecht scrollt … */
export const SPALTE_MIN = 160;
/** … und so viel für eine leere (nur ihr Name im Kopf). */
export const LEER_MIN = 90;

/** Die Info einer Gruppe an einem Punkt – leer, wenn es keine gibt. */
export function infoText(item: Pick<AblaufZeile, 'infos'>, gruppe: number): string {
  return item.infos?.find((i) => i.gruppeId === gruppe)?.text ?? '';
}

/**
 * Die Infos eines Punkts nach einer Änderung (`PunktAenderung.infos`: je Gruppe der neue Text, leer = Info löschen):
 * die Einträge der genannten Gruppen ersetzt, ein leerer Text entfernt den Eintrag – so wie ihn `ablaufZeileAus` nach dem
 * Neuladen liefern würde (nur Gruppen mit Text).
 */
export function infosErsetzt(
  alt: AblaufZeile['infos'],
  neu: Readonly<Record<number, string>>,
): NonNullable<AblaufZeile['infos']> {
  const geaendert = new Set(Object.keys(neu).map(Number));
  const bleibt = (alt ?? []).filter((i) => !geaendert.has(i.gruppeId));
  const dazu = Object.entries(neu)
    .map(([g, text]) => ({ gruppeId: Number(g), text: text.trim() }))
    .filter((i) => i.text !== '');
  return [...bleibt, ...dazu];
}

/**
 * Das Raster: der Punkt `minmax(PUNKT_MIN, 1fr)`, dahinter je Gruppe eine Spalte so breit wie ihr Inhalt (höchstens
 * `SPALTE_MAX`); `minWidth` = was die Tabelle braucht, bevor sie waagerecht scrollt (Spalten mit Text `SPALTE_MIN`, leere
 * `LEER_MIN`).
 */
export function tabellenRaster(
  infos: readonly InfoGruppe[],
  sichtbar: readonly Pick<AblaufZeile, 'infos'>[],
): { gridTemplateColumns: string; minWidth: number } {
  const mindestBreite =
    PUNKT_MIN +
    infos.reduce(
      (summe, g) => summe + (sichtbar.some((z) => infoText(z, g.id)) ? SPALTE_MIN : LEER_MIN),
      0,
    );
  return {
    gridTemplateColumns: `minmax(${PUNKT_MIN}px, 1fr) repeat(${infos.length}, fit-content(${SPALTE_MAX}px))`,
    minWidth: mindestBreite,
  };
}

/**
 * Was beim waagerechten Scrollen zu sehen ist: Spalten, die rechts (oder links unter dem stehenden Punkt) verdeckt sind,
 * und ob rechts noch etwas kommt. Gemessen an den Spaltenköpfen; ohne Maße (Tests, erster Lauf) gilt alles als sichtbar.
 */
export function useSpaltenSicht(anzahl: number) {
  const rahmen = useRef<HTMLDivElement | null>(null);
  const koepfe = useRef(new Map<number, HTMLElement>());
  const [stand, setStand] = useState<{ verdeckt: ReadonlySet<number>; rechtsMehr: boolean }>({
    verdeckt: new Set(),
    rechtsMehr: false,
  });

  const messen = useCallback(() => {
    const r = rahmen.current;
    if (!r) return;
    const punktBreite = r.querySelector<HTMLElement>(`.${styles.infoKopfPunkt}`)?.offsetWidth ?? 0;
    const links = r.scrollLeft + punktBreite;
    const rechts = r.scrollLeft + r.clientWidth;
    const verdeckt = new Set<number>();
    for (const [id, el] of koepfe.current) {
      if (el.offsetLeft + el.offsetWidth > rechts + 1 || el.offsetLeft < links - 1)
        verdeckt.add(id);
    }
    const rechtsMehr = r.scrollWidth - r.clientWidth - r.scrollLeft > 1;
    setStand((alt) =>
      alt.rechtsMehr === rechtsMehr &&
      alt.verdeckt.size === verdeckt.size &&
      [...verdeckt].every((id) => alt.verdeckt.has(id))
        ? alt
        : { verdeckt, rechtsMehr },
    );
  }, []);

  useEffect(() => {
    if (anzahl === 0) return;
    messen();
    window.addEventListener('resize', messen);
    return () => {
      window.removeEventListener('resize', messen);
    };
  }, [anzahl, messen]);

  return {
    rahmenRef: rahmen,
    messen,
    rechtsMehr: stand.rechtsMehr,
    verdeckt: (id: number) => stand.verdeckt.has(id),
    kopfRef: (_i: number, id: number) => (el: HTMLElement | null) => {
      if (el) koepfe.current.set(id, el);
      else koepfe.current.delete(id);
    },
    /** Die Spalte ins Bild holen – rechts neben den stehenden Punkt. */
    zeige: (id: number) => {
      const r = rahmen.current;
      const el = koepfe.current.get(id);
      if (!r || !el) return;
      const punktBreite =
        r.querySelector<HTMLElement>(`.${styles.infoKopfPunkt}`)?.offsetWidth ?? 0;
      r.scrollTo?.({ left: Math.max(0, el.offsetLeft - punktBreite), behavior: 'smooth' });
    },
  };
}

export type SpaltenSicht = ReturnType<typeof useSpaltenSicht>;
