import { useCallback, useState } from 'react';
import type { PlanSpalte } from '@shared/dienstplan/plan';
import { dateienSchluessel, type TerminDatei } from '@shared/ct/terminDateien';
import { terminAenderbar, type Start } from './start';

/** Was Matrix und Handy-Ansicht über die Infos brauchen – aus `useMatrixInfos`. */
export interface MatrixInfos {
  zu: boolean;
  setZu: (zu: boolean) => void;
  /** Die Infos eines Termins – nach dem Speichern der neue Text, bis der Plan ihn selbst bringt. */
  text: (s: PlanSpalte) => string;
  /** Darf ich die Infos dieses Termins ändern (`terminAenderbar`)? */
  darf: (s: PlanSpalte) => boolean;
  gespeichert: (s: PlanSpalte, text: string) => void;
  /** Die Dateien eines Termins – nach dem Öffnen des Fensters die frische Liste, bis der Plan sie selbst bringt (T2a). */
  dateien: (s: PlanSpalte) => readonly TerminDatei[];
  dateienAktuell: (s: PlanSpalte, dateien: TerminDatei[]) => void;
}

/**
 * **„Infos & Dateien“ in der Matrix** (Scheibe T1b, Entwurf `matrix-infos.html` Variante 2, Alwin 02.11.2026). Die
 * Infos stehen schon an der Spalte (`PlanSpalte.infos`, aus derselben Abfrage wie der Plan); hier nur, was nach dem
 * Speichern neu ist. Ein gespeicherter Text gilt, solange der Plan noch den alten bringt – liest er neu und steht dort
 * etwas anderes, zählt der Plan. Dieselbe Regel für die Dateien (T2a): Die frische Liste aus dem Fenster gilt, solange
 * der Plan noch dieselbe alte bringt (`dateienSchluessel`). Ohne `anschluss` (Tests der Matrix ohne ChurchTools) `null`.
 */
export function useMatrixInfos(
  anschluss: { start: Start } | undefined,
  zu: boolean,
  setZu: (zu: boolean) => void,
): MatrixInfos | null {
  const [neu, setNeu] = useState<ReadonlyMap<number, { von: string; text: string }>>(new Map());
  const [dateienNeu, setDateienNeu] = useState<
    ReadonlyMap<number, { von: string; dateien: TerminDatei[] }>
  >(new Map());
  const start = anschluss?.start;
  const text = useCallback(
    (s: PlanSpalte) => {
      const n = neu.get(s.id);
      return n && n.von === s.infos ? n.text : s.infos;
    },
    [neu],
  );
  const gespeichert = useCallback((s: PlanSpalte, t: string) => {
    setNeu((alt) => new Map(alt).set(s.id, { von: s.infos, text: t }));
  }, []);
  const dateien = useCallback(
    (s: PlanSpalte) => {
      const n = dateienNeu.get(s.id);
      return n && n.von === dateienSchluessel(s.dateien) ? n.dateien : s.dateien;
    },
    [dateienNeu],
  );
  const dateienAktuell = useCallback((s: PlanSpalte, d: TerminDatei[]) => {
    setDateienNeu((alt) =>
      new Map(alt).set(s.id, { von: dateienSchluessel(s.dateien), dateien: d }),
    );
  }, []);
  if (!start) return null;
  return {
    zu,
    setZu,
    text,
    gespeichert,
    darf: (s) => terminAenderbar(start, s.ablaufTermin),
    dateien,
    dateienAktuell,
  };
}
