import { useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Etikett, type EtikettTon } from '@ui/bedienung/Etikett';
import { leseEvent, speichereInfos } from '@ui/ct/terminInfosPort';
import { useLaden } from '@ui/ct/useLaden';
import { datumText } from '@shared/ct/datum';
import { vorschau, type Themenreihe, type VorschauArt } from '@shared/protokolle/themenreihe';
import {
  ladeEventLagen,
  uebertragen,
  type Ergebnis,
  type EventRechte,
  type UebertragenPort,
} from './reiheUebertragen';
import { hervorgehoben } from './reiheHervorheben';
import felder from './Fensterfelder.module.scss';
import styles from './ReiheUebertragenFenster.module.scss';

const BROWSER_PORT: UebertragenPort = { event: leseEvent, speichern: speichereInfos };

const ETIKETT: Record<VorschauArt, { text: string; ton: EtikettTon }> = {
  neu: { text: 'neu', ton: 'blau' },
  geaendert: { text: 'geändert', ton: 'blau' },
  aktuell: { text: 'aktuell', ton: 'neutral' },
  ohneEvent: { text: 'ohne Event', ton: 'neutral' },
  nichtGelesen: { text: 'nicht gelesen', ton: 'rot' },
  keinRecht: { text: 'darfst du nicht', ton: 'neutral' },
  beschaedigt: { text: 'beschädigt', ton: 'rot' },
  zuLang: { text: 'zu lang', ton: 'rot' },
  doppelt: { text: 'doppelt', ton: 'rot' },
};

const ERKLAERUNG: Partial<Record<VorschauArt, string>> = {
  ohneEvent: 'Erst ein Event wählen. Die anderen werden trotzdem übertragen.',
  nichtGelesen: 'Das Event ließ sich gerade nicht lesen. Bitte das Fenster neu öffnen.',
  keinRecht:
    'Für diesen Kalender fehlt dir das Recht, Events zu ändern. Die anderen werden trotzdem übertragen.',
  beschaedigt: 'Abschnitt beschädigt – bitte in ChurchTools prüfen. Es wird nichts geschrieben.',
  zuLang: 'Mit der Reihe wären die Infos länger als 4000 Zeichen – ChurchTools nähme sie nicht an.',
  doppelt: 'Dieses Event gehört schon zu einem anderen Abend der Reihe.',
};

const ERGEBNIS: Record<Ergebnis['art'], { text: string; ton: EtikettTon }> = {
  ok: { text: 'übertragen', ton: 'gruen' },
  konflikt: { text: 'inzwischen in ChurchTools geändert – Fenster neu öffnen', ton: 'rot' },
  verweigert: { text: 'ChurchTools hat es abgelehnt (kein Recht)', ton: 'rot' },
  nichtUebernommen: { text: 'ChurchTools hat es nicht übernommen – bitte noch einmal', ton: 'rot' },
  fehler: { text: 'nicht übertragen, bitte noch einmal', ton: 'rot' },
};

/**
 * **Fenster „In Events übertragen“** (Entwurf `reihe-events-v1`): liest jedes zugeordnete Event **frisch**, zeigt je Event den
 * neuen Text (neue und geänderte Zeilen hervorgehoben), ein Häkchen je Event, ein Etikett (neu · geändert · darfst du nicht ·
 * ohne Event · zu lang · beschädigt) und „Unverändert: …“ zusammengefasst. „N Events übertragen“ schreibt **nacheinander**;
 * ein Konflikt, ein 403 oder ein Fehler bei einem Event bricht die anderen nicht ab (`uebertragen`).
 */
export function ReiheUebertragenFenster({
  reihe,
  rechte,
  onClose,
  port = BROWSER_PORT,
}: {
  reihe: Themenreihe;
  rechte: EventRechte;
  onClose: () => void;
  /** Nur für Tests. */
  port?: UebertragenPort;
}) {
  const { stand, neu: neuLesen } = useLaden(
    () => ladeEventLagen(port, reihe, rechte),
    [reihe, port, rechte],
  );
  const [aus, setAus] = useState<ReadonlySet<number>>(new Set());
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<ReadonlyMap<number, Ergebnis>>(new Map());

  const karten = useMemo(
    () =>
      stand.art !== 'fertig'
        ? []
        : reihe.zeilen.map((z, i) => ({
            z,
            v: vorschau(
              reihe,
              i,
              z.eventId === null ? null : (stand.daten.get(z.eventId)?.lage ?? null),
            ),
          })),
    [stand, reihe],
  );
  const schreibbar = karten.filter(
    (k): k is typeof k & { z: { eventId: number } } =>
      (k.v.art === 'neu' || k.v.art === 'geaendert') && k.z.eventId !== null,
  );
  const gewaehlt = schreibbar.filter((k) => !aus.has(k.z.eventId));
  const aktuell = karten.filter((k) => k.v.art === 'aktuell');
  const fertig = ergebnis.size > 0 && !laeuft;
  const alleOk = fertig && [...ergebnis.values()].every((e) => e.art === 'ok');

  async function los(): Promise<void> {
    setLaeuft(true);
    setErgebnis(new Map());
    await uebertragen(
      port,
      gewaehlt.map((k) => ({
        eventId: k.z.eventId,
        neuerText: k.v.neuerText as string,
        gesehen: k.v.alterText as string,
      })),
      (id, e) => setErgebnis((alt) => new Map(alt).set(id, e)),
    );
    setLaeuft(false);
  }

  const name = (eventId: number | null, fallback: string) =>
    (eventId !== null && stand.art === 'fertig' ? stand.daten.get(eventId)?.name : '') || fallback;

  return (
    <Sheet
      title="In Events übertragen"
      onClose={onClose}
      breit
      beschaeftigt={laeuft}
      cancelLabel={fertig ? null : 'Abbrechen'}
      knoepfe={
        fertig ? (
          <FensterKnopf
            onClick={() => {
              if (alleOk) onClose();
              else {
                setErgebnis(new Map());
                neuLesen();
              }
            }}
          >
            {alleOk ? 'Fertig' : 'Neu lesen'}
          </FensterKnopf>
        ) : (
          <FensterKnopf
            disabled={laeuft || stand.art !== 'fertig' || gewaehlt.length === 0}
            onClick={() => void los()}
          >
            {laeuft
              ? 'Überträgt …'
              : `${gewaehlt.length} ${gewaehlt.length === 1 ? 'Event' : 'Events'} übertragen`}
          </FensterKnopf>
        )
      }
    >
      {stand.art === 'laedt' && <p className={styles.stand}>Die Events werden gelesen …</p>}
      {stand.art === 'fehler' && (
        <p className={felder.fehler} role="alert">
          {stand.fehler.text}
        </p>
      )}
      {stand.art === 'fertig' && (
        <>
          <p className={styles.stand}>
            Grün hinterlegt ist, was neu oder geändert ist. Was schon in den Infos steht, bleibt
            stehen.
          </p>
          {karten
            .filter((k) => k.v.art !== 'aktuell')
            .map(({ z, v }) => {
              const schreib = v.art === 'neu' || v.art === 'geaendert';
              const res = z.eventId !== null ? ergebnis.get(z.eventId) : undefined;
              const titel = `${z.datum ? datumText(z.datum) : 'ohne Datum'}${
                z.eventId !== null ? ` · ${name(z.eventId, z.eventTitel)}` : ''
              }`;
              const zustand = z.eventId !== null ? stand.daten.get(z.eventId) : undefined;
              return (
                <section
                  key={z.id}
                  className={schreib ? styles.karte : `${styles.karte} ${styles.aus}`}
                  aria-label={titel}
                >
                  <div className={styles.oben}>
                    <label className={styles.wahl}>
                      <input
                        type="checkbox"
                        className={styles.haken}
                        checked={schreib && z.eventId !== null && !aus.has(z.eventId)}
                        disabled={!schreib || laeuft || fertig}
                        onChange={(e) => {
                          const id = z.eventId as number;
                          setAus((alt) => {
                            const n = new Set(alt);
                            if (e.target.checked) n.delete(id);
                            else n.add(id);
                            return n;
                          });
                        }}
                      />
                      {titel}
                    </label>
                    {res ? (
                      <Etikett ton={ERGEBNIS[res.art].ton}>{ERGEBNIS[res.art].text}</Etikett>
                    ) : (
                      <Etikett ton={ETIKETT[v.art].ton}>{ETIKETT[v.art].text}</Etikett>
                    )}
                  </div>
                  {schreib && v.neuerText !== undefined ? (
                    <pre className={styles.text}>
                      {hervorgehoben(v).map((t, i) =>
                        t.neu ? <mark key={i}>{t.text}</mark> : <span key={i}>{t.text}</span>,
                      )}
                    </pre>
                  ) : (
                    <p className={styles.stand}>
                      {zustand?.fehler && v.art === 'nichtGelesen'
                        ? zustand.fehler
                        : (ERKLAERUNG[v.art] ?? '')}
                    </p>
                  )}
                </section>
              );
            })}
          {aktuell.length > 0 && (
            <p className={styles.stand}>
              Unverändert: {aktuell.map((k) => datumText(k.z.datum)).join(', ')}
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
