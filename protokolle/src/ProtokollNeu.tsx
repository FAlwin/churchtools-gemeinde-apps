import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { KeinSpeicherRecht } from '@ui/ct/verbindung';
import { tagAusIso } from '@shared/ct/zeit';
import { anfangsDokument } from '@shared/protokolle/beginnen';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import {
  planungFehler,
  schonBelegt,
  vorbelegung,
  zeitraum,
  type Planung,
} from '@shared/protokolle/planen';
import { protokollBeginnen } from './beginnen';
import { ladeSitzungen, type GruppenSitzungen } from './lesen';
import { treffenAnlegen } from './planen';
import { useAnfangWahl } from './AnfangWahl';
import felder from './Fensterfelder.module.scss';

type Daten =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; daten: GruppenSitzungen };

const LEER: GruppenSitzungen = {
  kommend: [],
  protokolle: [],
  teile: [],
  kalender: null,
  treffenNichtFreigegeben: false,
};

/**
 * **Fenster „Neues Protokoll“** (K2a, Alwin 29.10.2026) – ein Protokoll ohne Termin: Gruppe wählen (nur die, in denen man
 * schreiben darf), Titel, Datum und Uhrzeit (vorbelegt wie „Neue Sitzung“), Vorlage / „Wie letztes Mal“ / leer und auf
 * Wunsch ein Gruppentreffen für die Anwesenheit. Keine Mail, kein Kalendertermin; danach öffnet sich der Editor.
 *
 * Geschrieben wird wie bei „Protokoll beginnen“ (`protokollBeginnen`). Das Treffen entsteht vorher – scheitert danach das
 * Protokoll, merkt sich das Fenster das Treffen, damit ein zweiter Versuch kein zweites anlegt.
 */
export function ProtokollNeu({
  modul,
  gruppen,
  start = null,
  ich,
  zeitzone,
  jetzt,
  onAngelegt,
  onClose,
}: {
  modul: number;
  /** Gruppen, in denen man Protokolle schreiben darf. */
  gruppen: readonly ProtokollGruppe[];
  /** Vorgewählte Gruppe (Reiter „Sitzungen“). */
  start?: number | null;
  ich: { person: number };
  zeitzone: string;
  /** Für Tests; sonst die Uhr. */
  jetzt?: Date;
  onAngelegt: (gruppe: number, sitzung: string) => void;
  onClose: () => void;
}) {
  const [gruppeId, setGruppeId] = useState<number>(start ?? gruppen[0]?.id ?? 0);
  const gruppe = gruppen.find((g) => g.id === gruppeId) ?? gruppen[0];
  const [daten, setDaten] = useState<Daten>({ art: 'laedt' });
  const [heute] = useState(() => tagAusIso((jetzt ?? new Date()).toISOString(), zeitzone));
  const [p, setP] = useState<Planung | null>(null);
  const [mitTreffen, setMitTreffen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [ende, setEnde] = useState<{ sitzung: string; text: string } | null>(null);
  // Schon angelegtes Treffen (je Gruppe und Beginn) – ein zweiter Versuch legt kein zweites an.
  const treffen = useRef<{ schluessel: string; id: number } | null>(null);

  // Die Sitzungen der Gruppe: für die Vorbelegung, „Wie letztes Mal“ und „zu dieser Zeit gibt es schon eine“.
  useEffect(() => {
    if (!gruppe) return;
    let aktiv = true;
    setDaten({ art: 'laedt' });
    setP(null);
    ladeSitzungen(modul, gruppe, zeitzone, jetzt).then(
      (d) => {
        if (!aktiv) return;
        setDaten({ art: 'fertig', daten: d });
        // Wie „Neue Sitzung“: wie die letzte Sitzung, die schon war (S5-2).
        setP(
          vorbelegung({
            sitzungen: [...d.kommend, ...d.protokolle],
            bis: { beginn: (jetzt ?? new Date()).toISOString() },
            heute,
            zeitzone,
          }),
        );
      },
      (e: unknown) => aktiv && setDaten({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    return () => {
      aktiv = false;
    };
  }, [modul, gruppe, zeitzone, jetzt, heute]);

  const d = daten.art === 'fertig' ? daten.daten : LEER;
  const z =
    p && !planungFehler(p, zeitzone, jetzt ?? new Date(), { zukunft: false })
      ? zeitraum(p, zeitzone)
      : null;
  const { laden, anfang, auswahl } = useAnfangWahl({
    modul,
    protokolle: d.protokolle,
    teile: d.teile,
    beginn: z?.beginn ?? (jetzt ?? new Date()).toISOString(),
    zeitzone,
  });
  const problem = p ? planungFehler(p, zeitzone, jetzt ?? new Date(), { zukunft: false }) : null;
  const belegt = !!z && schonBelegt([...d.kommend, ...d.protokolle], z.beginn);
  const bereit =
    !!gruppe && !!p && !!z && !belegt && !laeuft && laden.art === 'fertig' && !!anfang();

  const anlegen = async () => {
    const a = anfang();
    if (!bereit || !gruppe || gruppe.protokolle === null || !p || !z || !a) return;
    setLaeuft(true);
    setFehler(null);
    try {
      let treffenId: number | null = null;
      if (mitTreffen) {
        const schluessel = `${gruppe.id}:${z.beginn}`;
        if (treffen.current?.schluessel !== schluessel)
          treffen.current = {
            schluessel,
            id: await treffenAnlegen(gruppe.id, z.beginn, z.ende, zeitzone),
          };
        treffenId = treffen.current.id;
      }
      const r = await protokollBeginnen({
        modul,
        kategorie: gruppe.protokolle,
        mitarbeit: gruppe.mitarbeit === null ? null : { modul, kategorie: gruppe.mitarbeit },
        gruppe: gruppe.id,
        sitzung: {
          titel: p.titel.trim(),
          beginn: z.beginn,
          termin: null,
          treffen: treffenId,
          kopf: null,
        },
        dokument: anfangsDokument(a, () => crypto.randomUUID()),
        von: ich.person,
      });
      setLaeuft(false);
      if (r.art === 'schon')
        setEnde({
          sitzung: r.sitzung,
          text: 'Zu dieser Sitzung gibt es schon ein Protokoll – es wird geöffnet.',
        });
      else if (r.hinweis) setEnde({ sitzung: r.sitzung, text: r.hinweis });
      else onAngelegt(gruppe.id, r.sitzung);
    } catch (e) {
      setLaeuft(false);
      setFehler(
        e instanceof KeinSpeicherRecht && mitTreffen && !treffen.current
          ? {
              text: 'Das Gruppentreffen wurde nicht angelegt – dir fehlt in ChurchTools das Recht, in dieser Gruppe Gruppentreffen zu pflegen. Ohne das Häkchen geht es.',
              nochmal: false,
            }
          : fehlerMeldung(e),
      );
    }
  };

  const setze = <K extends keyof Planung>(k: K, v: Planung[K]) =>
    setP((x) => (x ? { ...x, [k]: v } : x));

  return (
    <Sheet
      title="Neues Protokoll"
      onClose={ende ? () => gruppe && onAngelegt(gruppe.id, ende.sitzung) : onClose}
      cancelLabel={ende ? null : undefined}
      beschaeftigt={laeuft}
      knoepfe={
        ende ? (
          <FensterKnopf onClick={() => gruppe && onAngelegt(gruppe.id, ende.sitzung)}>
            Protokoll öffnen
          </FensterKnopf>
        ) : (
          <FensterKnopf disabled={!bereit} onClick={() => void anlegen()}>
            {laeuft ? 'Wird angelegt …' : 'Anlegen'}
          </FensterKnopf>
        )
      }
    >
      <p className={felder.unter}>
        {gruppe?.name} · ohne Termin und ohne Einladung – das Protokoll öffnet sich gleich im
        Editor.
      </p>
      {ende ? (
        <p className={felder.hinweis} role="status">
          {ende.text}
        </p>
      ) : (
        <>
          {gruppen.length > 1 && (
            <label className={felder.feld}>
              <span>Gruppe</span>
              <select
                className={felder.eingabe}
                value={gruppeId}
                disabled={laeuft}
                onChange={(e) => setGruppeId(Number(e.target.value))}
              >
                {gruppen.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {daten.art === 'laedt' && <p className={felder.leise}>Wird geladen …</p>}
          {daten.art === 'fehler' && (
            <p className={felder.fehler} role="alert">
              {daten.fehler.text}
            </p>
          )}
          {p && (
            <>
              <label className={felder.feld}>
                <span>Titel</span>
                <input
                  className={felder.eingabe}
                  value={p.titel}
                  disabled={laeuft}
                  onChange={(e) => setze('titel', e.target.value)}
                />
              </label>
              <div className={felder.zeile}>
                <label className={felder.feld}>
                  <span>Datum</span>
                  <input
                    type="date"
                    className={felder.eingabe}
                    value={p.tag}
                    disabled={laeuft}
                    onChange={(e) => setze('tag', e.target.value)}
                  />
                </label>
                <label className={felder.feld}>
                  <span>Uhrzeit</span>
                  <input
                    type="time"
                    className={felder.eingabe}
                    value={p.uhrzeit}
                    disabled={laeuft}
                    onChange={(e) => setze('uhrzeit', e.target.value)}
                  />
                </label>
              </div>
              <div className={felder.feld}>
                <span>Womit beginnen?</span>
                {auswahl(laeuft)}
              </div>
              <label className={felder.schalter}>
                <input
                  type="checkbox"
                  className={felder.haken}
                  checked={mitTreffen}
                  disabled={laeuft}
                  onChange={(e) => setMitTreffen(e.target.checked)}
                />
                <span>
                  Gruppentreffen anlegen
                  <small>Für die Anwesenheit – in ChurchTools, ohne Mail.</small>
                </span>
              </label>
              {problem && <p className={felder.leise}>{problem}</p>}
              {belegt && (
                <p className={felder.fehler} role="alert">
                  Zu dieser Zeit gibt es schon eine Sitzung dieser Gruppe – das Protokoll bitte dort
                  beginnen.
                </p>
              )}
            </>
          )}
        </>
      )}
      {fehler && (
        <p className={felder.fehler} role="alert">
          {fehler.text}
        </p>
      )}
    </Sheet>
  );
}
