import { useMemo, useState, type ReactNode } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { tagPunkt } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import { letztesProtokoll } from '@shared/protokolle/festePunkte';
import { dokumentDerSitzung, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import { FestePunkteKontext, type FestePunkteWert } from './festePunkteKontext';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import ansicht from './SitzungAnsicht.module.scss';

/**
 * **Rahmen für die festen Punkte einer Sitzung** (S4-3a) – stellt den Kontext für `FesterPunkt` bereit (Editor und
 * Lese-Ansicht) und zeigt „Letztes Protokoll → Öffnen“ im Fenster. Im Fenster stehen die festen Punkte des alten
 * Protokolls so, wie sie für dessen Sitzung gelten – nur ohne „Öffnen“ (kein Fenster im Fenster).
 */
export function FestePunkteRahmen({
  sitzung,
  gruppe,
  protokolle,
  teile,
  aufgaben,
  zeitzone,
  name,
  status,
  imFenster = false,
  children,
}: {
  sitzung: Sitzung;
  gruppe: number;
  /** Die freigegebenen Protokolle der Gruppe. */
  protokolle: readonly Sitzung[];
  /** Alle Teile der Gruppe – zum Öffnen eines alten Protokolls. */
  teile: readonly ProtokollTeil[];
  aufgaben: readonly Aufgabe[];
  zeitzone: string;
  name?: FestePunkteWert['name'];
  status?: FestePunkteWert['status'];
  imFenster?: boolean;
  children: ReactNode;
}) {
  const [offen, setOffen] = useState<Sitzung | null>(null);
  const wert = useMemo<FestePunkteWert>(
    () => ({
      sitzung: sitzung.kopf?.sitzung ?? '',
      gruppe,
      heute: tagAusIso(new Date().toISOString(), zeitzone),
      zeitzone,
      aufgaben,
      protokolle,
      letztes: letztesProtokoll(protokolle, sitzung),
      name,
      status,
      oeffnen: imFenster ? undefined : setOffen,
    }),
    [sitzung, gruppe, zeitzone, aufgaben, protokolle, name, status, imFenster],
  );
  const dokument = offen ? dokumentDerSitzung(offen.kopf, teile) : null;
  return (
    <FestePunkteKontext.Provider value={wert}>
      {children}
      {offen && (
        <Sheet
          title={`${offen.titel} · ${tagPunkt(tagAusIso(offen.beginn, zeitzone))}`}
          onClose={() => setOffen(null)}
          cancelLabel="Schließen"
          knoepfe={null}
          breit
        >
          {dokument ? (
            <FestePunkteRahmen
              sitzung={offen}
              gruppe={gruppe}
              protokolle={protokolle}
              teile={teile}
              aufgaben={aufgaben}
              zeitzone={zeitzone}
              name={name}
              imFenster
            >
              <ProtokollAnsicht dokument={dokument} aufgaben={aufgaben} />
            </FestePunkteRahmen>
          ) : (
            <p className={ansicht.fehler} role="alert">
              Das Protokoll ist gerade nicht vollständig lesbar. Bitte gleich noch einmal öffnen.
            </p>
          )}
        </Sheet>
      )}
    </FestePunkteKontext.Provider>
  );
}
