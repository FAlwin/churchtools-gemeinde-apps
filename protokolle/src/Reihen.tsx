import { useCallback, useMemo, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { useLaden } from '@ui/ct/useLaden';
import { Etikett } from '@ui/bedienung/Etikett';
import { FilterKnopf } from '@ui/bedienung/FilterKnopf';
import { eineWahl } from '@ui/bedienung/filterAbschnitt';
import { KlickZeile } from '@ui/bedienung/KlickZeile';
import { useNeuAnlegen } from '@ui/bedienung/NeuAnlegen';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { Werkzeugzeile } from '@ui/bedienung/Werkzeugzeile';
import { Sheet } from '@ui/fenster/Sheet';
import { mapLimit } from '@shared/ct/mapLimit';
import { heuteImKalender } from '@shared/ct/zeit';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import {
  reihenOrdnen,
  reiheUeberblick,
  reiheZeitraumText,
  type Themenreihe,
} from '@shared/protokolle/themenreihe';
import { darfSchreibenIn } from '@shared/protokolle/zugang';
import { ReiheKarte } from './ReiheKarte';
import { ladeThemenreihen } from './themenreiheSchreiben';
import { ReiheKontext, type ReiheKontextWert } from './themenreiheKontext';
import { useReiheFenster } from './useReiheFenster';
import styles from './Reihen.module.scss';

/** So viele Gruppen gleichzeitig lesen – wie bei `ladeUebersicht` (die API schonen). */
const GLEICHZEITIG = 2;

/** Die Reihen einer Gruppe, wie gelesen. */
interface GruppeMitReihen {
  gruppe: number;
  reihen: Themenreihe[];
}

/** Gerade gespeichert: die Reihe und die Gruppe, in der sie liegt. */
interface Gespeichert {
  gruppe: number;
  reihe: Themenreihe;
}

/** Alle Reihen aller Gruppen mit Mitarbeit-Kategorie – scheitert eine Gruppe, scheitert das Ganze (kein stiller Teilstand). */
async function ladeAlle(
  modul: number,
  gruppen: readonly ProtokollGruppe[],
): Promise<GruppeMitReihen[]> {
  const mit = gruppen.filter((g) => g.mitarbeit !== null);
  const ergebnis = new Map<number, Themenreihe[]>();
  await mapLimit([...mit], GLEICHZEITIG, async (g) => {
    ergebnis.set(g.id, await ladeThemenreihen({ modul, kategorie: g.mitarbeit as number }));
  });
  return mit.map((g) => ({ gruppe: g.id, reihen: ergebnis.get(g.id) ?? [] }));
}

/** „5 Abende“ / „1 Abend“. */
const abendeText = (n: number) => `${n} ${n === 1 ? 'Abend' : 'Abende'}`;

/**
 * **Reiter „Reihen“** (Baustein „Reihe“, Scheibe 2; Entwurf `reihen-reiter-s2-v1`, Variante A): alle Reihen aller Gruppen,
 * nach Gruppe geordnet, darin die nächste zuerst (`reihenOrdnen`). Je Reihe eine Zeile mit Zeitraum, Zahl der Abende und
 * einem Etikett „4 von 5 mit Event“ – **gerechnet aus den Zeilen der Reihe, ohne ein einziges Event zu lesen** (ob alles
 * übertragen ist, zeigt erst „In Events übertragen“). Ein Klick öffnet dieselbe Karte wie im Protokoll mit „Bearbeiten“
 * und „In Events übertragen“; die Fenster sind dieselben wie im Protokoll (`useReiheFenster`).
 *
 * **Rechte:** Bauen darf, wer in der Gruppe **dieser Reihe** im Protokoll schreiben darf (`darfSchreibenIn`). „Neue Reihe“
 * gibt es nur, wenn es mindestens eine Gruppe mit Mitarbeit und Schreibrecht gibt; bei mehreren Gruppen mit dem Feld „Gruppe“
 * (vorbelegt: die Gruppe aus dem Filter, sonst die erste). Eine Reihe aus dem Reiter hängt an keinem Protokoll.
 */
export function Reihen({
  modul,
  ich,
  gruppen,
  schreibbar,
  eventKalender,
  eventAnlegen,
}: {
  modul: number;
  ich: { person: number; name: string };
  gruppen: readonly ProtokollGruppe[];
  schreibbar: readonly number[];
  /** Kalender mit „edit events“ (`null` = alle) – für „In Events übertragen“. */
  eventKalender: readonly number[] | null;
  /** Kalender mit „Termine anlegen“ **und** „Events anlegen“ (`kalenderMitEvents`) – für „Event neu anlegen“. Stabil halten. */
  eventAnlegen: readonly number[];
}) {
  const handy = useMedienAbfrage(HANDY_BREITE);
  const geladen = useLaden(() => ladeAlle(modul, gruppen), [modul, gruppen]);
  const [auswahl, setAuswahl] = useState('alle');
  const [offen, setOffen] = useState<string | null>(null);
  // Gerade gespeichert und noch nicht neu gelesen – gilt über dem Gelesenen.
  const [lokal, setLokal] = useState<ReadonlyMap<string, Gespeichert>>(new Map());

  const daten = geladen.stand.art === 'fertig' ? geladen.stand.daten : null;
  const gruppeVon = useCallback(
    (id: number) => gruppen.find((g) => g.id === id) ?? null,
    [gruppen],
  );
  const ortVon = useCallback(
    (id: number) => {
      const g = gruppeVon(id);
      return g?.mitarbeit != null ? { modul, kategorie: g.mitarbeit } : null;
    },
    [gruppeVon, modul],
  );

  /** Gelesen, darüber das gerade Gespeicherte – je Gruppe. */
  const zusammen = useMemo<GruppeMitReihen[]>(() => {
    if (!daten) return [];
    return daten.map((d) => {
      const eigene = [...lokal.values()].filter((l) => l.gruppe === d.gruppe);
      const ersetzt = new Set(eigene.map((l) => l.reihe.id));
      return {
        gruppe: d.gruppe,
        reihen: [...d.reihen.filter((r) => !ersetzt.has(r.id)), ...eigene.map((l) => l.reihe)],
      };
    });
  }, [daten, lokal]);

  const suche = useCallback(
    (id: string) => zusammen.flatMap((z) => z.reihen).find((r) => r.id === id),
    [zusammen],
  );
  const { setze } = geladen;
  const onFrisch = useCallback(
    (gruppe: number, liste: readonly Themenreihe[]) => {
      setze((alt) => alt.map((d) => (d.gruppe === gruppe ? { gruppe, reihen: [...liste] } : d)));
      setLokal((alt) => new Map([...alt].filter(([, l]) => l.gruppe !== gruppe)));
    },
    [setze],
  );
  const onGespeichert = useCallback(
    (r: Themenreihe) => {
      // Eine bekannte Reihe bleibt in der Gruppe, in der sie gelesen wurde; eine neue kommt in die gewählte.
      const gruppe = daten?.find((d) => d.reihen.some((x) => x.id === r.id))?.gruppe ?? r.gruppe;
      setLokal((alt) => new Map(alt).set(r.id, { gruppe, reihe: r }));
    },
    [daten],
  );
  const fenster = useReiheFenster({
    ortVon,
    bekannt: suche,
    onFrisch,
    onGespeichert,
    ich,
    eventKalender,
    eventAnlegen,
  });

  const mitMitarbeit = gruppen.filter((g) => g.mitarbeit !== null);
  // Hier darf man Reihen anlegen: Mitarbeit-Kategorie da und im Protokoll schreiben dürfen.
  const baubar = mitMitarbeit.filter((g) => darfSchreibenIn(g, schreibbar));
  const vorbelegt = baubar.find((g) => String(g.id) === auswahl) ?? baubar[0];
  // „Neue Reihe“ (R3): am Rechner/iPad grün in der Werkzeugzeile, am Handy das schwebende Plus (`useNeuAnlegen`).
  const neuKnopf = useNeuAnlegen({
    label: 'Neue Reihe',
    onClick: () =>
      vorbelegt &&
      fenster.neu({
        gruppe: vorbelegt.id,
        gruppenwahl:
          baubar.length > 1 ? baubar.map((g) => ({ id: g.id, name: g.name })) : undefined,
      }),
    sichtbar: baubar.length > 0,
  });

  if (geladen.stand.art === 'laedt' || geladen.stand.art === 'aus')
    return <p className={styles.leer}>Reihen werden geladen …</p>;
  if (geladen.stand.art === 'fehler')
    return <FehlerKasten fehler={geladen.stand.fehler} onNochmal={geladen.neu} />;

  const mehrereGruppen = gruppen.length > 1;
  const heute = heuteImKalender();
  const sichtbar = zusammen.filter((z) => auswahl === 'alle' || String(z.gruppe) === auswahl);
  const bloecke = sichtbar
    .map((z) => ({ gruppe: gruppeVon(z.gruppe), reihen: reihenOrdnen(z.reihen, heute) }))
    .filter((b) => b.gruppe && b.reihen.length > 0);

  const aufgemacht = offen ? suche(offen) : undefined;
  const aufGruppe = aufgemacht
    ? (zusammen.find((z) => z.reihen.some((r) => r.id === aufgemacht.id))?.gruppe ?? null)
    : null;
  const kontext: ReiheKontextWert | null =
    aufgemacht && aufGruppe !== null
      ? {
          reihen: new Map([[aufgemacht.id, aufgemacht]]),
          stand: 'fertig',
          // Die Gruppe DIESER Reihe entscheidet, nicht irgendeine.
          darfBauen: (() => {
            const g = gruppeVon(aufGruppe);
            return !!g && darfSchreibenIn(g, schreibbar);
          })(),
          bearbeiten: (id) => fenster.bearbeiten({ id, gruppe: aufGruppe }),
          uebertragen: (id) => fenster.uebertragen({ id, gruppe: aufGruppe }),
          neu: () => undefined,
          neuLaden: () => undefined,
        }
      : null;

  return (
    <div className={styles.seite}>
      {(mehrereGruppen || baubar.length > 0) && (
        <Werkzeugzeile
          handy={handy}
          ariaLabel="Reihen"
          rechts={
            <>
              {mehrereGruppen && (
                <FilterKnopf
                  still
                  abschnitte={[
                    eineWahl(
                      'Gruppe',
                      [
                        { wert: 'alle', text: 'Alle Gruppen' },
                        ...gruppen.map((g) => ({ wert: String(g.id), text: g.name })),
                      ],
                      auswahl,
                      setAuswahl,
                    ),
                  ]}
                />
              )}
              {neuKnopf.kopf}
            </>
          }
        />
      )}
      {neuKnopf.schwebend}
      {!gruppen.length ? (
        <p className={styles.leer}>Du bist in keiner Gruppe, die hier Protokolle führt.</p>
      ) : !bloecke.length ? (
        <p className={styles.leer}>
          Noch keine Reihen. Du legst sie hier mit „Neue Reihe“ an oder im Protokoll als Baustein
          „Reihe“.
        </p>
      ) : (
        <section className={styles.karte} aria-label="Reihen der Gruppen">
          {bloecke.map(({ gruppe, reihen }) => (
            <div key={gruppe?.id} role="group" aria-label={gruppe?.name}>
              {mehrereGruppen && <div className={styles.bereich}>{gruppe?.name}</div>}
              <ul className={styles.liste}>
                {reihen.map((r) => {
                  const u = reiheUeberblick(r);
                  const alle = u.abende > 0 && u.mitEvent === u.abende;
                  return (
                    <li key={r.id}>
                      <KlickZeile className={styles.zeile} onClick={() => setOffen(r.id)}>
                        <span className={styles.inhalt}>
                          <b>{r.name}</b>
                          <small>
                            {reiheZeitraumText(u.von, u.bis)} · {abendeText(u.abende)}
                          </small>
                          {u.abende > 0 && (
                            <progress
                              className={styles.balken}
                              max={u.abende}
                              value={u.mitEvent}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        {u.abende > 0 && (
                          <Etikett ton={alle ? 'gruen' : 'neutral'}>
                            {u.mitEvent} von {u.abende} mit Event
                          </Etikett>
                        )}
                      </KlickZeile>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}
      {aufgemacht && kontext && (
        <ReiheKontext.Provider value={kontext}>
          <Sheet title="Reihe" onClose={() => setOffen(null)} breit knoepfe={null}>
            <ReiheKarte reiheId={aufgemacht.id} />
          </Sheet>
        </ReiheKontext.Provider>
      )}
      {fenster.fenster}
    </div>
  );
}
