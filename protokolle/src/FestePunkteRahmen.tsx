import { useMemo, useState, type ReactNode } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { tagPunkt } from '@shared/ct/datum';
import { heuteImKalender, tagAusIso } from '@shared/ct/zeit';
import { fruehereProtokolle, letztesProtokoll } from '@shared/protokolle/festePunkte';
import { dokumentDerSitzung, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import { FestePunkteKontext, type FestePunkteWert } from './festePunkteKontext';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import { FruehesWahl } from './FruehesWahl';
import ansicht from './SitzungAnsicht.module.scss';

/**
 * **Rahmen für die festen Punkte einer Sitzung** (S4-3a) – stellt den Kontext für `FesterPunkt` bereit (Editor und
 * Lese-Ansicht) und zeigt „Letztes Protokoll → Ansehen“ im Fenster. Im Fenster stehen die festen Punkte des alten
 * Protokolls so, wie sie für dessen Sitzung gelten – nur ohne „Ansehen“ (kein Fenster im Fenster).
 *
 * Seit K3b-2: Unten im Fenster springt **„Öffnen“** zu dieser Sitzung (`onZuSitzung`), und das Fenster **„Früheres
 * Protokoll“** (`FruehesWahl`) für Einfügen und „Ändern“ hängt hier – einmal für Editor, Leiste und „/“-Menü.
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
  onZuSitzung,
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
  /** „Öffnen“ im Fenster: zu dieser Sitzung springen (K3b-2) – fehlt, bleibt das Fenster ohne Knopf. */
  onZuSitzung?: (s: Sitzung) => void;
  children: ReactNode;
}) {
  const [offen, setOffen] = useState<Sitzung | null>(null);
  const [wahl, setWahl] = useState<{
    titel: string;
    knopf: string;
    vorgewaehlt: string | null;
    fertig: (s: Sitzung) => void;
  } | null>(null);
  const wert = useMemo<FestePunkteWert>(
    () => ({
      sitzung: sitzung.kopf?.sitzung ?? '',
      gruppe,
      heute: heuteImKalender(),
      zeitzone,
      aufgaben,
      protokolle,
      letztes: letztesProtokoll(protokolle, sitzung),
      fruehere: fruehereProtokolle(protokolle, sitzung),
      name,
      status,
      oeffnen: imFenster ? undefined : setOffen,
      waehlen: imFenster ? undefined : (q, fertig) => setWahl({ ...q, fertig }),
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
          knoepfe={
            onZuSitzung ? (
              <FensterKnopf
                onClick={() => {
                  setOffen(null);
                  onZuSitzung(offen);
                }}
              >
                Öffnen
              </FensterKnopf>
            ) : null
          }
          cancelLabel={null}
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
      {wahl && (
        <FruehesWahl
          titel={wahl.titel}
          knopf={wahl.knopf}
          protokolle={wert.fruehere}
          letztes={wert.letztes?.kopf?.sitzung ?? null}
          vorgewaehlt={wahl.vorgewaehlt}
          zeitzone={zeitzone}
          onClose={() => setWahl(null)}
          onWahl={(s) => {
            setWahl(null);
            wahl.fertig(s);
          }}
        />
      )}
    </FestePunkteKontext.Provider>
  );
}
