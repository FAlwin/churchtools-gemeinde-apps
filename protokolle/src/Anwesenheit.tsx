import { useRef, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { Segment } from '@ui/bedienung/Segment';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { useLaden } from '@ui/ct/useLaden';
import {
  gaesteAus,
  kurzform,
  nachTipp,
  ohneAus,
  ohneAusgeblendete,
  type AnwesenheitsStatus,
  type TreffenStand,
} from '@shared/protokolle/anwesenheit';
import type { Antwort } from '@shared/protokolle/sitzungen';
import { anwesenheitLesen, statusSetzen, vorbelegen } from './anwesenheitSchreiben';
import type { FestePunkteWert } from './festePunkteKontext';
import styles from './Anwesenheit.module.scss';

/**
 * **Fester Punkt „Anwesenheit“** (Bauplan S5-3, Entwurf `s5-3-anwesenheit-v2`, Alwin 05.11.2026):
 * - Die Mitglieder aus dem **Gruppentreffen** mit ihrer Antwort auf die Einladung; beim Schreiben je Person
 *   **Anwesend / Abwesend** (nochmal tippen = wieder offen) – jeder Tipp steht sofort im Gruppentreffen.
 * - **Von selbst vorbelegt** aus den Zusagen, solange am Treffen niemand etwas eingetragen hat (`vorbelegen`).
 * - **Gäste** sind freie Namen und stehen nur im Protokoll (`props.gaeste`).
 * - **Aus dem Protokoll nehmen** (Alwin 17.11.2026): je Person ein Knopf, der sie aus der Anwesenheit DIESES Protokolls
 *   ausblendet (`props.ohne`, Personen-IDs) – etwa ein Gemeinschaftskonto, das als Gruppenmitglied in jedem Treffen
 *   steht. Im Gruppentreffen bleibt sie unverändert; unter der Liste steht „n ausgeblendet · Zeigen“ zum
 *   Zurückholen. Das geht auch bei abgeschlossenem Treffen (anders als das Tippen): Es betrifft nur das Protokoll,
 *   nicht die in ChurchTools gesperrte Anwesenheit – und das Protokoll selbst ist dann noch bearbeitbar (der Knopf
 *   erscheint nur, wo der Editor schreibbar ist). Beim Lesen (Ansicht, PDF) erscheinen Ausgeblendete gar nicht.
 * - **Einklappbar:** zugeklappt die Kurzform „Anwesend (n): … · Abwesend: … · Offen: … · Gäste: …“ – beim Lesen
 *   zugeklappt, beim Schreiben offen; aufgeklappt nur eine Zeile mit den Zahlen.
 * - Ohne Gruppentreffen: „Gruppentreffen anlegen“ (nur beim Schreiben).
 */

type Laden =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'fertig'; stand: TreffenStand };

const ANTWORT: Record<Antwort, string> = {
  zugesagt: 'zugesagt',
  abgesagt: 'abgesagt',
  vielleicht: 'vielleicht',
  offen: 'keine Antwort',
};

export function Anwesenheit({
  w,
  gaeste: gaesteRoh,
  bearbeitbar,
  gaesteSetzen,
  ohne: ohneRoh,
  ohneSetzen,
}: {
  w: FestePunkteWert;
  /** `props.gaeste` des Blocks. */
  gaeste: unknown;
  /** Beim Schreiben: Anwesenheit tippen, Gäste ändern, Treffen anlegen. */
  bearbeitbar: boolean;
  gaesteSetzen?: (gaeste: string[]) => void;
  /** `props.ohne` des Blocks – Personen-IDs, die aus diesem Protokoll genommen sind. */
  ohne?: unknown;
  /** Beim Schreiben: Personen aus dem Protokoll nehmen/zurückholen (fehlt es, wird nur gelesen). */
  ohneSetzen?: (ohne: number[]) => void;
}) {
  const gaeste = gaesteAus(gaesteRoh);
  const ohne = ohneAus(ohneRoh);
  const [auf, setAuf] = useState(bearbeitbar);
  const [laeuft, setLaeuft] = useState<number | 'treffen' | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [neuerGast, setNeuerGast] = useState('');
  const [ausgeblendetZeigen, setAusgeblendetZeigen] = useState(false);
  const { gruppe, treffen, anfragen } = w;
  // Von selbst vorbelegen nur einmal je Treffen und Kasten – auch wenn der Editor neu zeichnet.
  const vorbelegt = useRef<number | null>(null);
  // Wer ausgeblendet ist, zählt bei der Vorbelegung nicht mit – gelesen wird der Stand von JETZT, ohne dass eine neue Liste
  // das Treffen neu laden lässt (jede Zeile des Blocks ist ein neues Feld).
  const ohneJetzt = useRef(ohne);
  ohneJetzt.current = ohne;

  const { stand: geladen, setze } = useLaden(
    () =>
      treffen === null
        ? null
        : (async () => {
            let stand = await anwesenheitLesen(gruppe, treffen);
            if (bearbeitbar && vorbelegt.current !== treffen) {
              vorbelegt.current = treffen;
              stand = await vorbelegen(gruppe, treffen, stand, anfragen, ohneJetzt.current);
            }
            return stand;
          })(),
    [gruppe, treffen, anfragen, bearbeitbar],
  );
  const laden: Laden =
    geladen.art === 'fertig'
      ? { art: 'fertig', stand: geladen.daten }
      : geladen.art === 'fehler'
        ? { art: 'fehler', text: geladen.fehler.text }
        : { art: 'laedt' };

  const antwortVon = new Map(anfragen.map((a) => [a.person, a.antwort]));

  if (treffen === null)
    return (
      <div className={styles.kasten}>
        <p className={styles.leise}>Zu dieser Sitzung gibt es noch kein Gruppentreffen.</p>
        {bearbeitbar && w.treffenAnlegen && (
          <button
            type="button"
            className={styles.knopf}
            disabled={laeuft !== null}
            onClick={() => {
              setLaeuft('treffen');
              setHinweis(null);
              w.treffenAnlegen!().then(
                () => setLaeuft(null),
                (e: unknown) => {
                  setLaeuft(null);
                  setHinweis(fehlerMeldung(e).text);
                },
              );
            }}
          >
            <Icon name="plus" size={15} />
            {laeuft === 'treffen' ? 'Wird angelegt …' : 'Gruppentreffen anlegen'}
          </button>
        )}
        {hinweis && (
          <p className={styles.fehler} role="alert">
            {hinweis}
          </p>
        )}
      </div>
    );

  if (laden.art === 'laedt')
    return (
      <div className={styles.kasten}>
        <p className={styles.leise}>Anwesenheit wird gelesen …</p>
      </div>
    );
  if (laden.art === 'fehler')
    return (
      <div className={styles.kasten}>
        <p className={styles.fehler} role="alert">
          {laden.text}
        </p>
      </div>
    );

  // Der Stand bleibt vollständig (wie ChurchTools ihn liefert); gezeigt, gezählt und gelesen wird ohne die Ausgeblendeten.
  const { stand } = laden;
  const sichtbar = ohneAusgeblendete(stand, ohne);
  const ausgeblendet = stand.personen.filter((p) => ohne.includes(p.person));
  const k = kurzform(sichtbar.personen, gaeste);
  const tippbar = bearbeitbar && !stand.abgeschlossen;

  const tippen = (person: number, jetzt: AnwesenheitsStatus, tipp: AnwesenheitsStatus) => {
    if (tipp === 'offen' || laeuft !== null) return;
    setLaeuft(person);
    setHinweis(null);
    statusSetzen(gruppe, treffen, person, nachTipp(jetzt, tipp)).then(
      (neu) => {
        setLaeuft(null);
        setze(neu);
      },
      (e: unknown) => {
        setLaeuft(null);
        setHinweis(fehlerMeldung(e).text);
      },
    );
  };

  const gastDazu = () => {
    const name = neuerGast.trim();
    if (!name || !gaesteSetzen) return;
    gaesteSetzen([...gaeste, name]);
    setNeuerGast('');
  };

  return (
    <div className={styles.kasten}>
      <button
        type="button"
        className={styles.klapp}
        aria-expanded={auf}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setAuf(!auf)}
      >
        <Icon name={auf ? 'chev-down' : 'chev-right'} size={16} />
        {auf ? (
          // Aufgeklappt eine Zeile mit festen Zahlen – würde hier die Kurzform stehen, rutschte die Liste bei jedem
          // Tipp (eine Zeile „Offen“ fällt weg) und der nächste Tipp träfe daneben (beim Durchklicken gefunden).
          <span className={styles.zahlen}>
            Anwesend {k.anwesend.length} · Abwesend {k.abwesend.length} · Offen {k.offen.length}
            {k.gaeste.length > 0 ? ` · Gäste ${k.gaeste.length}` : ''}
          </span>
        ) : (
          <span className={styles.kurz}>
            <span>
              <b>Anwesend ({k.anwesend.length}):</b> {k.anwesend.join(', ') || '–'}
            </span>
            {k.abwesend.length > 0 && (
              <span>
                <b>Abwesend:</b> {k.abwesend.join(', ')}
              </span>
            )}
            {k.offen.length > 0 && (
              <span>
                <b>Offen:</b> {k.offen.join(', ')}
              </span>
            )}
            {k.gaeste.length > 0 && (
              <span>
                <b>Gäste:</b> {k.gaeste.join(', ')}
              </span>
            )}
          </span>
        )}
      </button>
      {auf && (
        <div className={styles.innen}>
          <ul className={styles.liste}>
            {sichtbar.personen.map((p) => (
              <li key={p.person}>
                <span className={styles.wer}>
                  <b>{p.name}</b>
                  {antwortVon.has(p.person) && (
                    <small className={styles[antwortVon.get(p.person)!]}>
                      {ANTWORT[antwortVon.get(p.person)!]}
                    </small>
                  )}
                </span>
                {tippbar ? (
                  <Segment<AnwesenheitsStatus>
                    ariaLabel={p.name}
                    value={p.status}
                    options={[
                      {
                        value: 'da',
                        label: laeuft === p.person && p.status !== 'da' ? '…' : 'Anwesend',
                      },
                      {
                        value: 'weg',
                        label: laeuft === p.person && p.status !== 'weg' ? '…' : 'Abwesend',
                      },
                    ]}
                    onChange={(v) => tippen(p.person, p.status, v)}
                  />
                ) : (
                  <span className={`${styles.stand} ${styles[p.status]}`}>
                    {{ da: 'anwesend', weg: 'abwesend', offen: 'offen' }[p.status]}
                  </span>
                )}
                {bearbeitbar && ohneSetzen && (
                  <button
                    type="button"
                    className={styles.entfernen}
                    aria-label={`${p.name} aus dem Protokoll nehmen`}
                    title="Aus dem Protokoll nehmen"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => ohneSetzen([...ohne, p.person])}
                  >
                    <Icon name="eye-off" size={15} />
                  </button>
                )}
              </li>
            ))}
            {gaeste.map((g) => (
              <li key={`gast:${g}`}>
                <span className={styles.wer}>
                  <b>{g}</b>
                  <small>Gast</small>
                </span>
                {bearbeitbar && gaesteSetzen ? (
                  <button
                    type="button"
                    className={styles.entfernen}
                    aria-label={`${g} entfernen`}
                    title="Entfernen"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => gaesteSetzen(gaeste.filter((x) => x !== g))}
                  >
                    <Icon name="x" size={15} />
                  </button>
                ) : (
                  <span className={`${styles.stand} ${styles.da}`}>anwesend</span>
                )}
              </li>
            ))}
          </ul>
          {bearbeitbar && ohneSetzen && ausgeblendet.length > 0 && (
            <div className={styles.ausgeblendet}>
              <p className={styles.leise}>
                {ausgeblendet.length} ausgeblendet
                <button
                  type="button"
                  className={styles.link}
                  aria-expanded={ausgeblendetZeigen}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAusgeblendetZeigen(!ausgeblendetZeigen)}
                >
                  {ausgeblendetZeigen ? 'Verbergen' : 'Zeigen'}
                </button>
              </p>
              {ausgeblendetZeigen && (
                <ul className={styles.liste}>
                  {ausgeblendet.map((p) => (
                    <li key={p.person}>
                      <span className={styles.wer}>
                        <b>{p.name}</b>
                        <small>nicht im Protokoll</small>
                      </span>
                      <button
                        type="button"
                        className={styles.link}
                        aria-label={`${p.name} zurückholen`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          ohneSetzen(ohne.filter((x) => x !== p.person));
                          // Die letzte zurückgeholt: die Zeile verschwindet, „Zeigen“ beginnt beim nächsten Mal zu.
                          if (ausgeblendet.length === 1) setAusgeblendetZeigen(false);
                        }}
                      >
                        Zurückholen
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {bearbeitbar && gaesteSetzen && (
            <form
              className={styles.gast}
              onSubmit={(e) => {
                e.preventDefault();
                gastDazu();
              }}
            >
              <input
                value={neuerGast}
                onChange={(e) => setNeuerGast(e.currentTarget.value)}
                placeholder="Name des Gastes"
                aria-label="Gast hinzufügen"
              />
              <button type="submit" className={styles.knopf} disabled={!neuerGast.trim()}>
                Hinzufügen
              </button>
            </form>
          )}
          {stand.abgeschlossen ? (
            <p className={styles.leise}>
              Das Gruppentreffen ist abgeschlossen – die Anwesenheit steht fest.
            </p>
          ) : (
            tippbar && (
              <p className={styles.leise}>
                Zusagen und Absagen sind schon eingetragen. Jeder Tipp steht sofort im
                ChurchTools-Gruppentreffen; nochmal tippen = wieder offen.
              </p>
            )
          )}
          {hinweis && (
            <p className={styles.fehler} role="alert">
              {hinweis}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
