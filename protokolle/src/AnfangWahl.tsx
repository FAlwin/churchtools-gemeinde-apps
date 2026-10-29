import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { tagPunkt } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import { ableiten, type Block } from '@shared/protokolle/dokument';
import type { Anfang } from '@shared/protokolle/beginnen';
import { letztesProtokoll } from '@shared/protokolle/festePunkte';
import { dokumentDerSitzung, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { Vorlage } from '@shared/protokolle/vorlagen';
import { ladeVorlagen } from './vorlagen';
import styles from './AnfangWahl.module.scss';

type Laden =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; vorlagen: Vorlage[] };

/** Die Tagesordnungspunkte eines Dokuments – für die kleine Zeile unter jeder Wahl. */
const punkte = (dok: readonly Block[]): string =>
  ableiten(dok)
    .punkte.map((p) => p.titel)
    .join(' · ');

/**
 * **Womit ein Protokoll anfängt** – eine **Vorlage**, **„Wie letztes Mal“** (Tagesordnung des letzten freigegebenen
 * Protokolls vor `beginn`) oder **leer**; vorbelegt „Wie letztes Mal“, sonst die erste Vorlage (S5-1). Die eine Stelle für
 * „Protokoll beginnen“ (S5-1) und „Neues Protokoll“ (K2a).
 */
export function useAnfangWahl(q: {
  modul: number;
  protokolle: readonly Sitzung[];
  teile: readonly ProtokollTeil[];
  /** Beginn des neuen Protokolls – „Wie letztes Mal“ nimmt das letzte davor. */
  beginn: string;
  zeitzone: string;
}): {
  laden: Laden;
  /** Der gewählte Anfang – `null`, solange nichts gewählt ist (Vorlagen laden noch). */
  anfang: () => Anfang | null;
  /** Die Knöpfe zur Wahl (`gesperrt`, solange angelegt wird). */
  auswahl: (gesperrt: boolean) => ReactNode;
} {
  const { modul, protokolle, teile, beginn, zeitzone } = q;
  const [laden, setLaden] = useState<Laden>({ art: 'laedt' });
  const [wahl, setWahl] = useState<string | null>(null);

  const letztes = useMemo(() => {
    const s = letztesProtokoll(protokolle, { beginn, kopf: null });
    const dok = s ? dokumentDerSitzung(s.kopf, teile) : null;
    return s && dok ? { sitzung: s, dokument: dok } : null;
  }, [protokolle, beginn, teile]);

  useEffect(() => {
    let aktiv = true;
    ladeVorlagen(modul).then(
      ({ vorlagen }) => {
        if (aktiv) setLaden({ art: 'fertig', vorlagen: vorlagen.map((v) => v.vorlage) });
      },
      (e: unknown) => aktiv && setLaden({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    return () => {
      aktiv = false;
    };
  }, [modul]);

  // Vorbelegt: „Wie letztes Mal“, wenn es ein letztes Protokoll gibt – sonst die erste Vorlage. Abgeleitet statt einmal
  // gesetzt: Kommen die Protokolle der Gruppe erst nach den Vorlagen an („Neues Protokoll“, K2a), stand sonst die erste
  // Vorlage fest (beim Durchklicken 29.10.2026 gefunden).
  const vorbelegt =
    laden.art !== 'fertig'
      ? null
      : letztes
        ? 'letztes'
        : laden.vorlagen[0]
          ? `v:${laden.vorlagen[0].id}`
          : 'leer';
  const gewaehlt = wahl ?? vorbelegt;

  const anfang = (): Anfang | null => {
    if (gewaehlt === 'leer') return { art: 'leer' };
    if (gewaehlt === 'letztes')
      return letztes ? { art: 'letztes', dokument: letztes.dokument } : null;
    const v =
      laden.art === 'fertig' ? laden.vorlagen.find((x) => `v:${x.id}` === gewaehlt) : undefined;
    return v ? { art: 'vorlage', vorlage: v } : null;
  };

  const knopf = (id: string, titel: string, klein: string, gesperrt: boolean) => (
    <button
      key={id}
      type="button"
      className={styles.wahl}
      aria-pressed={gewaehlt === id}
      disabled={gesperrt}
      onClick={() => setWahl(id)}
    >
      <b>{titel}</b>
      <small>{klein}</small>
    </button>
  );

  const auswahl = (gesperrt: boolean) => {
    if (laden.art === 'laedt') return <p className={styles.leise}>Vorlagen werden geladen …</p>;
    if (laden.art === 'fehler')
      return (
        <p className={styles.fehler} role="alert">
          {laden.fehler.text}
        </p>
      );
    return (
      <div className={styles.liste} role="group" aria-label="Womit beginnen?">
        {laden.vorlagen.map((v) => knopf(`v:${v.id}`, v.name, punkte(v.bloecke), gesperrt))}
        {letztes &&
          knopf(
            'letztes',
            'Wie letztes Mal',
            `Tagesordnung vom ${tagPunkt(tagAusIso(letztes.sitzung.beginn, zeitzone))}: ${punkte(letztes.dokument)}`,
            gesperrt,
          )}
        {knopf('leer', 'Leer', 'Ohne Vorlage beginnen', gesperrt)}
      </div>
    );
  };

  return { laden, anfang, auswahl };
}
