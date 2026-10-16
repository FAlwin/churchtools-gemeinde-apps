import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { kandidatHinweis, type RohKandidat } from '@shared/dienstplan/werKann';
import {
  bewerte,
  vorschlagen,
  type Bewertet,
  type Eingeplant,
  type ZauberPlatz,
} from '@shared/dienstplan/zauberstab';
import type { EntwurfErgebnis } from '@shared/dienstplan/entwuerfe';
import type { Belegung } from '@shared/dienstplan/einteilen';
import { abfrageSchluessel, ladeZauberstab } from './ladeZauberstab';
import { grundText } from './ladeEntwuerfe';
import styles from './ZauberstabFach.module.scss';

/** Ein freier Platz im Fenster – was der Kern braucht und was die Zeile zeigt. */
export interface ZauberZeile {
  /** `ortSchluessel` des Platzes. */
  schluessel: string;
  terminId: number;
  serviceId: number;
  /** `JJJJ-MM-TT` in Ortszeit. */
  tag: string;
  schonDa: number[];
  dienst: string;
  /** Platz `nr` von `von` dieses Dienstes am Termin. */
  nr: number;
  von: number;
  /** Überschrift des Termins, z. B. „So, 25.10. · Gottesdienst · 10:00 Uhr“ – Zeilen mit gleichem Kopf stehen zusammen. */
  kopf: string;
  /** „Oktober“ – für „N× im Oktober“. */
  monatName: string;
  /** Wo der Entwurf hinkommt: `index` des Platzes, die Dienstgruppe (Schublade) und was dort jetzt steht. */
  index: number | null;
  gruppeId: number;
  gesehen: Belegung;
}

/** Was übernommen wird. */
export interface Wahl {
  zeile: ZauberZeile;
  personId: number;
  name: string;
}

type Zustand =
  | { art: 'laedt'; fertig: number; gesamt: number }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'pruefen' }
  | { art: 'speichert' }
  | { art: 'fertig' };

/** Warum jemand eher nicht passt – die Texte von „Wer kann?“ und ChurchTools, dazu was der Lauf beiträgt. */
function eherNichtText(k: Bewertet): string {
  const h = kandidatHinweis(k);
  if (h.warnung) return h.text;
  if (k.laufGrund === 'am-tag') return 'an diesem Tag schon vorgeschlagen';
  if (k.laufGrund === 'hoechstens') return `höchstens ${k.hoechstensImMonat}× im Monat`;
  // ChurchTools unterscheidet nicht, ob jemand selbst abgesagt hat oder vom Planer herausgenommen wurde (E4-0).
  if (k.frueherAbgesagt < 0) return 'hat zuvor abgesagt oder wurde herausgenommen';
  return k.hauptGrund ?? 'passt laut ChurchTools nicht';
}

/**
 * **Das Zauberstab-Fenster** (Bauplan E5-2, Entwurf `e5-entwurf.html`, Alwin 16.10.2026): erst „Wer kann?“ für
 * alle freien Plätze laden (mit Fortschritt, abbrechbar), dann die Vorschläge zum Prüfen – je Platz eine Auswahl,
 * oben „Passt“, darunter „Passt eher nicht“ mit Grund. „Neu vorschlagen“ rechnet mit den von Hand gewählten Namen
 * neu; „Übernehmen“ legt **Entwürfe** an (gesendet wird wie immer mit „Ansehen und senden“). Die Regeln stehen im
 * Kern (`zauberstab.ts`), hier wird nur gezeigt und gewählt.
 *
 * `onClose(n)`: wie viele Entwürfe eingetragen wurden (0 = nichts).
 */
export function ZauberstabFach({
  titel,
  unter,
  zeilen,
  eingeplant,
  mitEntwurf,
  uebernehmen,
  onClose,
}: {
  titel: string;
  unter: string;
  zeilen: ZauberZeile[];
  /** Was im Lauf schon feststeht – vorhandene Entwürfe der Gruppe (zählen mit, Alwin 16.10.). */
  eingeplant: Eingeplant[];
  /** Freie Plätze mit Entwurf – bleiben, wie sie sind. */
  mitEntwurf: number;
  uebernehmen: (
    wahlen: Wahl[],
    melde: (index: number, ergebnis: EntwurfErgebnis) => void,
  ) => Promise<void>;
  onClose: (eingetragen: number) => void;
}) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt', fertig: 0, gesamt: 0 });
  const [versuch, setVersuch] = useState(0);
  const [roh, setRoh] = useState<Map<string, RohKandidat[]> | null>(null);
  const [wahl, setWahl] = useState<Map<string, number | null>>(new Map());
  const [hand, setHand] = useState<Set<string>>(new Set());
  const [ergebnisse, setErgebnisse] = useState<Map<string, EntwurfErgebnis>>(new Map());
  const [eingetragen, setEingetragen] = useState(0);

  const plaetze = useMemo<ZauberPlatz[]>(
    () =>
      roh
        ? zeilen.map((z) => ({
            ...z,
            roh: roh.get(abfrageSchluessel(z.terminId, z.serviceId)) ?? [],
          }))
        : [],
    [roh, zeilen],
  );

  // Abbrechen hält die Abfragen selbst an – nicht erst, wenn der Aufrufer das Fenster entfernt.
  const abbruch = useRef<AbortController | null>(null);
  useEffect(() => {
    const ab = new AbortController();
    abbruch.current = ab;
    setZustand({ art: 'laedt', fertig: 0, gesamt: 0 });
    ladeZauberstab(zeilen, {
      signal: ab.signal,
      fortschritt: (fertig, gesamt) =>
        !ab.signal.aborted && setZustand({ art: 'laedt', fertig, gesamt }),
    }).then(
      (m) => {
        if (ab.signal.aborted) return;
        const p = zeilen.map((z) => ({
          ...z,
          roh: m.get(abfrageSchluessel(z.terminId, z.serviceId)) ?? [],
        }));
        setRoh(m);
        setWahl(vorschlagen(p, { eingeplant }));
        setHand(new Set());
        setZustand({ art: 'pruefen' });
      },
      (e: unknown) => {
        if (ab.signal.aborted) return;
        setZustand({ art: 'fehler', fehler: fehlerMeldung(e) });
      },
    );
    return () => ab.abort();
    // `zeilen`/`eingeplant` stehen beim Öffnen fest; neu geladen wird nur über „Erneut versuchen“.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versuch]);

  /** Die Auswahl eines Platzes: alle anderen gewählten Namen zählen mit, dieser nicht. */
  const optionen = (p: ZauberPlatz): Bewertet[] => {
    const andere: Eingeplant[] = [...eingeplant];
    for (const q of plaetze) {
      const person = wahl.get(q.schluessel);
      if (q.schluessel !== p.schluessel && person != null)
        andere.push({ personId: person, tag: q.tag });
    }
    return bewerte(p, andere);
  };

  const neuVorschlagen = () => {
    const fest = new Map([...hand].map((k) => [k, wahl.get(k) ?? null] as const));
    setWahl(vorschlagen(plaetze, { eingeplant, fest }));
  };

  const waehle = (k: string, person: number | null) => {
    setWahl((alt) => new Map(alt).set(k, person));
    setHand((alt) => new Set(alt).add(k));
  };

  const zeilenMitOptionen = plaetze.map((p) => ({ p, opts: optionen(p) }));
  const wahlen: Wahl[] = zeilenMitOptionen.flatMap(({ p, opts }) => {
    const person = wahl.get(p.schluessel);
    const k = opts.find((o) => o.personId === person);
    const zeile = zeilen.find((z) => z.schluessel === p.schluessel)!;
    return person != null && k ? [{ zeile, personId: person, name: k.name }] : [];
  });
  const ohnePassende = zeilenMitOptionen.filter(
    ({ p, opts }) => wahl.get(p.schluessel) == null && !opts.some((o) => o.passt),
  ).length;

  const los = async () => {
    const liste = wahlen;
    setZustand({ art: 'speichert' });
    let ok = 0;
    await uebernehmen(liste, (i, r) => {
      if (r.ok) ok++;
      setErgebnisse((alt) => new Map(alt).set(liste[i].zeile.schluessel, r));
    });
    setEingetragen(ok);
    if (ok === liste.length) onClose(ok);
    else setZustand({ art: 'fertig' });
  };

  const schliessen = () => {
    if (zustand.art === 'speichert') return;
    abbruch.current?.abort();
    onClose(eingetragen);
  };

  // Nach Terminen geordnet (die Zeilen kommen schon sortiert).
  const gruppen: { kopf: string; zeilen: typeof zeilenMitOptionen }[] = [];
  for (const z of zeilenMitOptionen) {
    const kopf = zeilen.find((x) => x.schluessel === z.p.schluessel)!.kopf;
    const letzte = gruppen.at(-1);
    if (letzte?.kopf === kopf) letzte.zeilen.push(z);
    else gruppen.push({ kopf, zeilen: [z] });
  }
  const zeileVon = (k: string) => zeilen.find((x) => x.schluessel === k)!;
  const zeigtListe =
    zustand.art === 'pruefen' || zustand.art === 'speichert' || zustand.art === 'fertig';

  return (
    <Sheet
      title={titel}
      onClose={schliessen}
      cancelLabel={
        zustand.art === 'speichert'
          ? 'Bitte warten – wird eingetragen …'
          : zustand.art === 'fertig'
            ? 'Schließen'
            : 'Abbrechen'
      }
    >
      <p className={styles.unter}>{unter}</p>

      {zustand.art === 'laedt' && (
        <>
          <p className={styles.zusammen}>
            Vorschläge werden berechnet …{' '}
            {zustand.gesamt > 0 && (
              <b>
                {zustand.fertig} von {zustand.gesamt}
              </b>
            )}
          </p>
          <div className={styles.fortschritt} aria-hidden>
            <i style={{ width: `${(100 * zustand.fertig) / Math.max(1, zustand.gesamt)}%` }} />
          </div>
          {mitEntwurf > 0 && (
            <p className={styles.hinweis}>
              Plätze, an denen schon ein Entwurf liegt, bleiben, wie sie sind.
            </p>
          )}
        </>
      )}

      {zustand.art === 'fehler' && (
        <FehlerKasten fehler={zustand.fehler} onNochmal={() => setVersuch((v) => v + 1)} />
      )}

      {zeigtListe && (
        <>
          {zustand.art === 'pruefen' && (
            <p className={styles.zusammen}>
              <b>
                {wahlen.length} {wahlen.length === 1 ? 'Vorschlag' : 'Vorschläge'}
              </b>
              {ohnePassende > 0 && (
                <span className={styles.warnung}>
                  {' '}
                  · <b>{ohnePassende}</b> ohne passende Person
                </span>
              )}
              {mitEntwurf > 0 && (
                <span className={styles.leise}>
                  {' '}
                  · {mitEntwurf} {mitEntwurf === 1 ? 'Platz' : 'Plätze'} mit Entwurf bleiben, wie
                  sie sind
                </span>
              )}
              <small>Nichts wird gesendet: „Übernehmen“ legt Entwürfe an.</small>
            </p>
          )}
          {zustand.art === 'speichert' && (
            <div className={styles.fortschritt} aria-hidden>
              <i style={{ width: `${(100 * ergebnisse.size) / Math.max(1, wahlen.length)}%` }} />
            </div>
          )}
          {zustand.art === 'fertig' && (
            <p className={styles.zusammen}>
              <b>{eingetragen} eingetragen</b>, {ergebnisse.size - eingetragen} nicht – siehe unten.
            </p>
          )}

          {gruppen.map((g) => (
            <section key={g.kopf} className={styles.termin} aria-label={g.kopf}>
              <h4>{g.kopf}</h4>
              {g.zeilen.map(({ p, opts }) => {
                const z = zeileVon(p.schluessel);
                const person = wahl.get(p.schluessel) ?? null;
                const gewaehlt = opts.find((o) => o.personId === person) ?? null;
                const passt = opts.filter((o) => o.passt);
                const eher = opts.filter((o) => !o.passt);
                const r = ergebnisse.get(p.schluessel);
                const label = `${z.dienst}${z.von > 1 ? ` (Platz ${z.nr} von ${z.von})` : ''} – ${g.kopf}`;
                return (
                  <div key={p.schluessel} className={styles.zeile}>
                    <span className={styles.dienst}>
                      {z.dienst}
                      {z.von > 1 && (
                        <small>
                          Platz {z.nr} von {z.von}
                        </small>
                      )}
                    </span>
                    <select
                      className={`${styles.auswahl} ${person === null ? styles.leer : ''}`}
                      aria-label={label}
                      value={person ?? ''}
                      disabled={zustand.art !== 'pruefen'}
                      onChange={(e) =>
                        waehle(p.schluessel, e.target.value === '' ? null : Number(e.target.value))
                      }
                    >
                      <option value="">— frei lassen —</option>
                      {passt.length > 0 && (
                        <optgroup label="Passt">
                          {passt.map((o) => (
                            <option key={o.personId} value={o.personId}>
                              {o.name} ({o.imMonat}×)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {eher.length > 0 && (
                        <optgroup label="Passt eher nicht">
                          {eher.map((o) => (
                            <option key={o.personId} value={o.personId}>
                              {o.name} – {eherNichtText(o)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <small
                      className={
                        r
                          ? r.ok
                            ? styles.ok
                            : styles.warnung
                          : person === null
                            ? passt.length === 0
                              ? styles.warnung
                              : undefined
                            : gewaehlt && !gewaehlt.passt
                              ? styles.warnung
                              : undefined
                      }
                    >
                      {r
                        ? r.ok
                          ? 'als Entwurf eingetragen'
                          : grundText(r.grund)
                        : person === null
                          ? passt.length === 0
                            ? 'Niemand Passendes frei – frei lassen oder bewusst jemanden wählen.'
                            : 'bleibt frei'
                          : gewaehlt && !gewaehlt.passt
                            ? `Achtung: ${eherNichtText(gewaehlt)}`
                            : `${gewaehlt?.imMonat ?? 0}× im ${z.monatName} eingeteilt · bekommt beim Senden eine Anfrage`}
                    </small>
                  </div>
                );
              })}
            </section>
          ))}

          {zustand.art === 'pruefen' && (
            <div className={styles.knoepfe}>
              <button type="button" className={styles.zweit} onClick={neuVorschlagen}>
                Neu vorschlagen
              </button>
              <button
                type="button"
                className={styles.primaer}
                disabled={wahlen.length === 0}
                onClick={() => void los()}
              >
                {wahlen.length === 1
                  ? '1 als Entwurf übernehmen'
                  : `${wahlen.length} als Entwurf übernehmen`}
              </button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
