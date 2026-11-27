import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { FilterKnopf } from '@ui/bedienung/FilterKnopf';
import { HinzufuegenMenue, type Option } from '@ui/bedienung/OptionWaehlen';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { gemeindeZeitzone } from '@shared/ct/zeit';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { protokollSchluessel } from '@shared/protokolle/sitzungen';
import { darfSchreibenIn } from '@shared/protokolle/zugang';
import { ladeUebersicht, type GruppenUebersicht } from './lesen';
import { ProtokollNeu } from './ProtokollNeu';
import { SitzungZeile } from './SitzungZeile';
import { useToDoEinstellungen } from './useToDoEinstellungen';
import styles from './Sitzungen.module.scss';

/** Der Wert der Gruppenwahl für „Alle Gruppen“ – eine Gruppen-ID ist immer eine Zahl, kollidiert also nie. */
export const ALLE = 'alle';
/** So viele Protokolle zeigt „Alle Gruppen“ zuerst – der Rest hinter „Weitere Protokolle zeigen“. */
const ANFANG = 8;

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; uebersicht: GruppenUebersicht[] };

/**
 * **„Alle Gruppen“ im Reiter „Sitzungen“** (Alwin 27.11.2026, Entwurf `sitzungen-alle-gruppen-v1`): vorher öffnete der
 * Reiter immer die erste Gruppe – erst umschalten, dann suchen. Hier stehen die kommenden Sitzungen und die freigegebenen
 * Protokolle aller Gruppen in je einer Liste, jede Zeile mit dem Namen ihrer Gruppe. Ein Tipp wechselt in die Gruppe und
 * öffnet die Sitzung (`onOeffnen`, derselbe Weg wie der Sprung von Startseite und Suche). Der Filter blendet Gruppen
 * aus, die einen nicht betreffen – gemerkt je Person auf allen Geräten (`sitzungenAus`). Geladen wird wie auf der
 * Startseite (`ladeUebersicht`), „Kommend“ enthält wie in der Gruppe auch begonnene Protokolle aus der Vergangenheit.
 */
export function SitzungenAlle({
  modul,
  gruppen,
  ich,
  schreibbar,
  titelWahl,
  onOeffnen,
}: {
  modul: number;
  gruppen: readonly ProtokollGruppe[];
  /** Wer angemeldet ist – der Filter gilt je Person (`ich.person`), `ich.name` trägt „Neues Protokoll“ ein. */
  ich: { person: number; name: string };
  schreibbar: readonly number[];
  /** Die Überschrift mit der Gruppenwahl – gehört dem Reiter. */
  titelWahl: ReactNode;
  /** In diese Gruppe wechseln und die Sitzung (Schlüssel) öffnen. */
  onOeffnen: (gruppe: number, schluessel: string) => void;
}) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [alleProtokolle, setAlleProtokolle] = useState(false);
  const [neu, setNeu] = useState(false);
  const [einst, setzen] = useToDoEinstellungen(ich.person);
  const aus = einst.sitzungenAus;
  const handy = useMedienAbfrage(HANDY_BREITE);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeUebersicht(modul, gruppen, gemeindeZeitzone()).then(
      (uebersicht) => setZustand({ art: 'fertig', uebersicht }),
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [modul, gruppen]);
  useEffect(laden, [laden]);

  const schreibGruppen = gruppen.filter((g) => darfSchreibenIn(g, schreibbar));
  const neuOptionen: Option[] =
    schreibGruppen.length > 0 ? [{ label: 'Neues Protokoll', onClick: () => setNeu(true) }] : [];

  const ue = zustand.art === 'fertig' ? zustand.uebersicht : [];
  const imBlick = ue.filter((u) => !aus.includes(String(u.gruppe.id)));
  // „Kommend“ wie in der Gruppe (`sitzungenOrdnen`), nur gemischt: auch begonnene Protokolle von gestern – NICHT
  // `naechsteSitzungen` der Startseite, das schneidet ab heute ab und ließe einen offenen Entwurf hier verschwinden.
  const kommend = imBlick
    .flatMap((u) => u.sitzungen.kommend.map((sitzung) => ({ gruppe: u.gruppe, sitzung })))
    .sort((a, b) => Date.parse(a.sitzung.beginn) - Date.parse(b.sitzung.beginn));
  const protokolle = imBlick
    .flatMap((u) => u.sitzungen.protokolle.map((sitzung) => ({ gruppe: u.gruppe, sitzung })))
    .sort((a, b) => Date.parse(b.sitzung.beginn) - Date.parse(a.sitzung.beginn));
  const gezeigt = alleProtokolle ? protokolle : protokolle.slice(0, ANFANG);
  const allesAus = ue.length > 0 && imBlick.length === 0;

  return (
    <div className={styles.seite}>
      <div className={styles.kopf}>
        <div className={styles.links}>
          {titelWahl}
          <FilterKnopf
            abschnitte={[
              {
                titel: 'Gruppen',
                optionen: gruppen.map((g) => ({ wert: String(g.id), text: g.name })),
                aus,
                onAus: (x) => setzen({ sitzungenAus: x }),
              },
            ]}
          />
        </div>
        <HinzufuegenMenue label="Neu" titel="Neu" pfeil handy={handy} optionen={neuOptionen} />
      </div>
      {zustand.art === 'laedt' && <p className={styles.ruhig}>Wird geladen …</p>}
      {zustand.art === 'fehler' && <FehlerKasten fehler={zustand.fehler} onNochmal={laden} />}
      {zustand.art === 'fertig' && (
        <>
          <section className={styles.karte} aria-labelledby="kommend">
            <div className={styles.kartenkopf}>
              <h3 id="kommend">Kommend</h3>
              <span className={styles.anzahl}>{kommend.length}</span>
            </div>
            {kommend.length ? (
              <ul className={styles.liste}>
                {kommend.map((k) => (
                  <SitzungZeile
                    key={`${k.gruppe.id}:${k.sitzung.schluessel}`}
                    s={k.sitzung}
                    gruppe={k.gruppe.name}
                    onOeffnen={() => onOeffnen(k.gruppe.id, k.sitzung.schluessel)}
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.innen}>
                {allesAus ? 'Der Filter blendet alle Gruppen aus.' : 'Keine kommenden Sitzungen.'}
              </p>
            )}
          </section>
          <section className={styles.karte} aria-labelledby="protokolle">
            <div className={styles.kartenkopf}>
              <h3 id="protokolle">Protokolle</h3>
              <span className={styles.anzahl}>{protokolle.length}</span>
            </div>
            {gezeigt.length ? (
              <ul className={styles.liste}>
                {gezeigt.map((p) => (
                  <SitzungZeile
                    key={`${p.gruppe.id}:${p.sitzung.schluessel}`}
                    s={p.sitzung}
                    gruppe={p.gruppe.name}
                    onOeffnen={() => onOeffnen(p.gruppe.id, p.sitzung.schluessel)}
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.innen}>
                {allesAus
                  ? 'Der Filter blendet alle Gruppen aus.'
                  : 'Noch keine freigegebenen Protokolle.'}
              </p>
            )}
            {gezeigt.length < protokolle.length && (
              <div className={styles.mehr}>
                <TextKnopf onClick={() => setAlleProtokolle(true)}>
                  Weitere Protokolle zeigen
                </TextKnopf>
              </div>
            )}
          </section>
        </>
      )}
      {neu && (
        <ProtokollNeu
          modul={modul}
          gruppen={schreibGruppen}
          start={schreibGruppen[0]?.id ?? null}
          ich={ich}
          zeitzone={gemeindeZeitzone()}
          onAngelegt={(g, id) => {
            // Die neue Sitzung gleich im Editor öffnen – in der Gruppe, die im Fenster gewählt wurde.
            setNeu(false);
            onOeffnen(g, protokollSchluessel(id));
          }}
          onClose={() => setNeu(false)}
        />
      )}
    </div>
  );
}
