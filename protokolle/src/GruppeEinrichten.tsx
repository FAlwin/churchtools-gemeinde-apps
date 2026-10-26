import { useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { STUFEN, type PunkteVonMitgliedern, type Stufe } from '@shared/protokolle/einrichten';
import {
  gruppeEinrichten,
  ladeGruppe,
  vorschlag,
  type GruppenRolle,
  type Kalender,
  type VerwaltungsGruppe,
  type Wahl,
} from './einrichten';
import styles from './GruppeEinrichten.module.scss';

type Laden =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; rollen: GruppenRolle[]; gespeichert: boolean };

/**
 * **Fenster „Gruppe einrichten“** (Bauplan S2-2, Entwurf 7): je Rolle Kein Zugriff · Lesen + eigene To-Dos ·
 * Leitung, wie Mitglieder Tagesordnungspunkte einbringen, und der Kalender für die Sitzungstermine. Speichern
 * dauert einige Sekunden (jeder Schritt wird nachgelesen) – solange ist der Knopf gesperrt; scheitert es, bleibt
 * das Fenster offen und sagt warum.
 */
export function GruppeEinrichten({
  modul,
  gruppe,
  kalender,
  onClose,
  onFertig,
}: {
  modul: number;
  gruppe: VerwaltungsGruppe;
  kalender: readonly Kalender[];
  onClose: () => void;
  onFertig: () => void;
}) {
  const [laden, setLaden] = useState<Laden>({ art: 'laedt' });
  const [wahl, setWahl] = useState<Wahl | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);

  useEffect(() => {
    let aktiv = true;
    ladeGruppe(modul, gruppe.id).then(
      ({ rollen, einstellung }) => {
        if (!aktiv) return;
        setLaden({ art: 'fertig', rollen, gespeichert: einstellung !== null });
        const v = vorschlag(rollen);
        // Gespeicherte Stufen übernehmen; neue Rollen bekommen den Vorschlag.
        setWahl(
          einstellung
            ? {
                rollen: v.rollen.map(
                  (r) => einstellung.rollen.find((x) => x.rolle === r.rolle) ?? r,
                ),
                punkte: einstellung.punkte,
                kalender: einstellung.kalender,
              }
            : v,
        );
      },
      (e: unknown) => {
        if (aktiv) setLaden({ art: 'fehler', fehler: fehlerMeldung(e) });
      },
    );
    return () => {
      aktiv = false;
    };
  }, [modul, gruppe.id]);

  const stufeSetzen = (rolle: number, stufe: Stufe) =>
    setWahl(
      (w) => w && { ...w, rollen: w.rollen.map((r) => (r.rolle === rolle ? { ...r, stufe } : r)) },
    );

  const speichern = () => {
    if (!wahl) return;
    setLaeuft(true);
    setFehler(null);
    gruppeEinrichten(modul, gruppe, wahl).then(onFertig, (e: unknown) => {
      setFehler(fehlerMeldung(e));
      setLaeuft(false);
    });
  };

  // „Eingerichtet“ heißt: die Einstellung steht (sie wird als Letztes geschrieben). Die Liste sieht nur die
  // Kategorien – sind die da, die Einstellung aber nicht, ist ein früherer Versuch mittendrin gescheitert.
  // Solange geladen wird, gilt der Stand der Liste – sonst hieße eine eingerichtete Gruppe kurz „einrichten“.
  const gespeichert = laden.art === 'fertig' ? laden.gespeichert : gruppe.eingerichtet;
  const unvollstaendig = laden.art === 'fertig' && !laden.gespeichert && gruppe.eingerichtet;
  const titel = `${gespeichert ? 'Gruppe' : 'Gruppe einrichten'}: ${gruppe.name}`;
  return (
    <Sheet
      title={titel}
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        laden.art === 'fertig' && wahl ? (
          <FensterKnopf disabled={laeuft} onClick={speichern}>
            {laeuft
              ? gespeichert
                ? 'Wird gespeichert …'
                : 'Wird eingerichtet …'
              : gespeichert
                ? 'Speichern'
                : 'Einrichten'}
          </FensterKnopf>
        ) : null
      }
    >
      <p className={styles.unter}>Nur Admins dürfen das in ChurchTools – deshalb liegt es hier.</p>
      {laden.art === 'laedt' && <p className={styles.unter}>Wird geladen …</p>}
      {laden.art === 'fehler' && (
        <p className={styles.fehler} role="alert">
          {laden.fehler.text}
        </p>
      )}
      {laden.art === 'fertig' && wahl && (
        <>
          <div className={styles.abschnitt}>
            <span className={styles.titel}>Was darf welche Rolle?</span>
            {laden.rollen.length === 0 ? (
              <p className={styles.unter}>Die Gruppe hat keine Rollen.</p>
            ) : (
              <table className={styles.tabelle}>
                <thead>
                  <tr>
                    <th scope="col">Rolle</th>
                    {STUFEN.map((s) => (
                      <th key={s.wert} scope="col">
                        {/* geschütztes Trennzeichen: „To-Dos“ bricht nicht mitten im Wort um */}
                        {s.text.replace('-', '\u2011')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {laden.rollen.map((r) => {
                    const stufe = wahl.rollen.find((x) => x.rolle === r.id)?.stufe ?? 'keine';
                    return (
                      <tr key={r.id}>
                        <th scope="row">{r.name}</th>
                        {STUFEN.map((s) => (
                          <td key={s.wert}>
                            <input
                              type="radio"
                              name={`rolle-${r.id}`}
                              aria-label={`${r.name}: ${s.text}`}
                              checked={stufe === s.wert}
                              disabled={laeuft}
                              onChange={() => stufeSetzen(r.id, s.wert)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <small className={styles.klein}>
              Leitung = Protokoll schreiben, freigeben, Anwesenheit, nächste Sitzung festlegen. Wer
              keinen Zugriff hat, sieht die Protokolle nicht – auch nicht über die Schnittstelle.
            </small>
          </div>

          <div className={styles.abschnitt}>
            <span className={styles.titel}>Tagesordnungspunkte von Mitgliedern</span>
            <Segment<PunkteVonMitgliedern>
              value={wahl.punkte}
              options={[
                { value: 'vorschlagen', label: 'Vorschlagen' },
                { value: 'direkt', label: 'Direkt eintragen' },
              ]}
              onChange={(punkte) => setWahl({ ...wahl, punkte })}
              ariaLabel="Tagesordnungspunkte von Mitgliedern"
              verbunden
            />
          </div>

          <div className={styles.abschnitt}>
            <label className={styles.titel} htmlFor="kalender">
              Kalender für die Sitzungstermine
            </label>
            <select
              id="kalender"
              className={styles.auswahl}
              value={wahl.kalender ?? ''}
              disabled={laeuft}
              onChange={(e) =>
                setWahl({ ...wahl, kalender: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">Noch keiner</option>
              {kalender.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            <small className={styles.klein}>
              Die Leitung darf dort Termine anlegen, alle anderen mit Zugriff sehen sie.
            </small>
          </div>

          {gruppe.versteckt && (
            <p className={styles.hinweis}>
              <b>Die Gruppe ist in ChurchTools versteckt.</b> Sie bleibt versteckt. Wer Zugriff hat,
              bekommt zusätzlich „versteckte Gruppe sehen“ – sonst sieht man die eigene Gruppe
              nicht.
            </p>
          )}

          {unvollstaendig && (
            <p className={styles.fehler} role="status">
              Die Einrichtung ist unvollständig – ein früherer Versuch wurde nicht fertig. Bitte
              noch einmal einrichten.
            </p>
          )}

          {fehler && (
            <p className={styles.fehler} role="alert">
              {fehler.text}
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
