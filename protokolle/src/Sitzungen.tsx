import { useCallback, useEffect, useRef, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { Segment } from '@ui/bedienung/Segment';
import { Icon } from '@ui/icons/icons';
import { tagPunkt, datumText } from '@shared/ct/datum';
import { ortszeitAus } from '@shared/ct/zeit';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import { ladeAufgaben, ladeSitzungen, type GruppenSitzungen } from './lesen';
import { kachelVon, uhrzeit } from './anzeige';
import { Marke } from './Marke';
import { SitzungAnsicht } from './SitzungAnsicht';
import styles from './Sitzungen.module.scss';

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; daten: GruppenSitzungen; aufgaben: Aufgabe[] };

const zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function SitzungZeile({ s, onOeffnen }: { s: Sitzung; onOeffnen: () => void }) {
  const k = kachelVon(s.beginn, zeitzone);
  const status = s.kopf?.status;
  return (
    <li>
      <button type="button" className={styles.zeile} onClick={onOeffnen}>
        <DatumKachel tag={k.tag} monat={k.monat} gedimmt={!s.kopf} />
        <span className={styles.text}>
          <b>{s.titel}</b>
          <small>
            {datumText(ortszeitAus(s.beginn, zeitzone).slice(0, 10))} ·{' '}
            {uhrzeit(s.beginn, zeitzone)}
            {status === 'frei' && s.kopf?.freigabe
              ? ` · freigegeben am ${tagPunkt(s.kopf.freigabe.am.slice(0, 10))}`
              : ''}
          </small>
        </span>
        {status === 'entwurf' && <Marke art="leise">Entwurf</Marke>}
        {status === 'geplant' && <Marke art="leise">geplant</Marke>}
        {status === 'frei' && <Marke art="gut">freigegeben</Marke>}
        <Icon name="chev-right" size={18} />
      </button>
    </li>
  );
}

/** Von der Startseite gewählt (S3-3): diese Gruppe – und, wenn angegeben, gleich diese Sitzung öffnen. */
export interface SitzungsAuswahl {
  gruppe: number;
  sitzung?: string;
}

/**
 * **Reiter „Sitzungen“** (Bauplan S3-2, Entwurf 7): je Gruppe „Kommend“ (Termine mit Besprechungsanfrage,
 * Gruppentreffen, begonnene Protokolle) und „Protokolle“ (freigegeben). Ein Tipp öffnet die Sitzung zum Lesen.
 * Bei mehreren Gruppen wählt man sie oben.
 */
export function Sitzungen({
  modul,
  gruppen,
  auswahl = null,
}: {
  modul: number;
  gruppen: ProtokollGruppe[];
  auswahl?: SitzungsAuswahl | null;
}) {
  const [gruppeId, setGruppeId] = useState<number | null>(
    auswahl?.gruppe ?? gruppen[0]?.id ?? null,
  );
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [offen, setOffen] = useState<Sitzung | null>(null);
  // Die gewünschte Sitzung gilt nur für das erste Laden – danach bestimmt die Bedienung hier.
  const wunsch = useRef(auswahl?.sitzung);
  const gruppe = gruppen.find((g) => g.id === gruppeId) ?? gruppen[0] ?? null;

  const laden = useCallback(() => {
    if (!gruppe) return;
    setZustand({ art: 'laedt' });
    setOffen(null);
    Promise.all([ladeSitzungen(modul, gruppe, zeitzone), ladeAufgaben(modul, gruppe)]).then(
      ([daten, aufgaben]) => {
        setZustand({ art: 'fertig', daten, aufgaben });
        const s = [...daten.kommend, ...daten.protokolle].find(
          (x) => x.schluessel === wunsch.current,
        );
        wunsch.current = undefined;
        if (s) setOffen(s);
      },
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [modul, gruppe]);

  useEffect(laden, [laden]);

  if (!gruppe)
    return (
      <p className={styles.ruhig}>Du bist in keiner Gruppe, die hier Protokolle führen kann.</p>
    );

  if (offen && zustand.art === 'fertig')
    return (
      <SitzungAnsicht
        sitzung={offen}
        gruppe={gruppe.name}
        teile={zustand.daten.teile}
        aufgaben={zustand.aufgaben}
        zeitzone={zeitzone}
        onZurueck={() => setOffen(null)}
      />
    );

  return (
    <div className={styles.seite}>
      <div className={styles.kopf}>
        <h2>{gruppe.name}</h2>
        {gruppen.length > 1 && (
          <Segment
            value={String(gruppe.id)}
            options={gruppen.map((g) => ({ value: String(g.id), label: g.name }))}
            onChange={(v) => setGruppeId(Number(v))}
            ariaLabel="Gruppe"
            verbunden
          />
        )}
      </div>
      {zustand.art === 'laedt' && <p className={styles.ruhig}>Wird geladen …</p>}
      {zustand.art === 'fehler' && <FehlerKasten fehler={zustand.fehler} onNochmal={laden} />}
      {zustand.art === 'fertig' && (
        <>
          <section className={styles.karte} aria-labelledby="kommend">
            <div className={styles.kartenkopf}>
              <h3 id="kommend">Kommend</h3>
              <span className={styles.anzahl}>{zustand.daten.kommend.length}</span>
            </div>
            {zustand.daten.kommend.length ? (
              <ul className={styles.liste}>
                {zustand.daten.kommend.map((s) => (
                  <SitzungZeile key={s.schluessel} s={s} onOeffnen={() => setOffen(s)} />
                ))}
              </ul>
            ) : (
              <p className={styles.innen}>Keine kommenden Sitzungen.</p>
            )}
            {zustand.daten.kalender === null && (
              <p className={styles.fuss}>
                Für diese Gruppe ist noch kein Kalender gewählt – Termine erscheinen, sobald ein
                Admin ihn in der Verwaltung festlegt.
              </p>
            )}
            {zustand.daten.treffenNichtFreigegeben && (
              <p className={styles.fuss}>
                Die Gruppentreffen dieser Gruppe sind für dich in ChurchTools nicht freigegeben –
                hier stehen nur die Termine aus dem Kalender.
              </p>
            )}
          </section>
          <section className={styles.karte} aria-labelledby="protokolle">
            <div className={styles.kartenkopf}>
              <h3 id="protokolle">Protokolle</h3>
              <span className={styles.anzahl}>{zustand.daten.protokolle.length}</span>
            </div>
            {zustand.daten.protokolle.length ? (
              <ul className={styles.liste}>
                {zustand.daten.protokolle.map((s) => (
                  <SitzungZeile key={s.schluessel} s={s} onOeffnen={() => setOffen(s)} />
                ))}
              </ul>
            ) : (
              <p className={styles.innen}>Noch keine freigegebenen Protokolle.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
