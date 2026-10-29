import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { Segment } from '@ui/bedienung/Segment';
import { Icon } from '@ui/icons/icons';
import { tagPunkt, datumText } from '@shared/ct/datum';
import { ortszeitAus } from '@shared/ct/zeit';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { naechsteNach } from '@shared/protokolle/planen';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import { ladeAufgaben, ladeSitzungen, type GruppenSitzungen } from './lesen';
import { kachelVon, uhrzeit } from './anzeige';
import { Marke } from './Marke';
import { SitzungAnsicht } from './SitzungAnsicht';
import { ProtokollBeginnen } from './ProtokollBeginnen';
import { SitzungFestlegen } from './SitzungFestlegen';
import { SitzungBearbeiten } from './SitzungBearbeiten';
import { NaechsteSitzung } from './NaechsteSitzung';
import { ProtokollNeu } from './ProtokollNeu';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import styles from './Sitzungen.module.scss';

// Der Editor (BlockNote, gut 1 MB) wird erst geladen, wenn die Leitung ein Protokoll schreibt (S4-1) – wer nur liest,
// lädt ihn nie.
const ProtokollSchreiben = lazy(() =>
  import('./ProtokollSchreiben').then((m) => ({ default: m.ProtokollSchreiben })),
);

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

/**
 * Von der Startseite (S3-3) oder der Suche (S3-4b) gewählt: diese Gruppe – und, wenn angegeben, gleich diese Sitzung
 * öffnen und zu diesem Tagesordnungspunkt springen.
 */
export interface SitzungsAuswahl {
  gruppe: number;
  sitzung?: string;
  /** Block-ID des Tagesordnungspunkts. */
  punkt?: string | null;
}

/**
 * **Reiter „Sitzungen“** (Bauplan S3-2, Entwurf 7): je Gruppe „Kommend“ (Termine mit Besprechungsanfrage,
 * Gruppentreffen, begonnene Protokolle) und „Protokolle“ (freigegeben). Ein Tipp öffnet die Sitzung zum Lesen – einen
 * Entwurf, wenn man schreiben darf (die Leitung), im Editor (S4-1). Ohne Protokoll kann die Leitung es dort beginnen
 * (S5-1); danach öffnet es sich gleich im Editor. Die Leitung legt die nächste Sitzung fest – im Protokoll (Bereich
 * Termine) oder außerordentlich über „Neue Sitzung“ (S5-2, dasselbe Fenster) – und ändert oder sagt sie ab (K2b).
 * Bei mehreren Gruppen wählt man sie oben.
 */
export function Sitzungen({
  modul,
  gruppen,
  ich,
  schreibbar = [],
  auswahl = null,
}: {
  modul: number;
  gruppen: ProtokollGruppe[];
  /** Wer angemeldet ist – für die Schreibsperre („Alwin schreibt gerade“). */
  ich: { person: number; name: string };
  /** Kategorien, in denen man schreiben darf (`Start.schreibbar`) – dort öffnet ein Entwurf im Editor (S4-1). */
  schreibbar?: readonly number[];
  auswahl?: SitzungsAuswahl | null;
}) {
  const [gruppeId, setGruppeId] = useState<number | null>(
    auswahl?.gruppe ?? gruppen[0]?.id ?? null,
  );
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [offen, setOffen] = useState<Sitzung | null>(null);
  const [beginnt, setBeginnt] = useState<Sitzung | null>(null);
  // „Nächste Sitzung festlegen“ (aus dieser Sitzung) oder „Neue Sitzung“ (S5-2).
  // „Neues Protokoll“ ohne Termin (K2a).
  const [neu, setNeu] = useState(false);
  const [festlegen, setFestlegen] = useState<{
    art: 'naechste' | 'neu';
    bis: Sitzung | null;
  } | null>(null);
  // „Sitzung bearbeiten“ (K2b) – aus der Ansicht oder dem Kasten „Nächste Sitzung“.
  const [bearbeiten, setBearbeiten] = useState<Sitzung | null>(null);
  // Die gewünschte Sitzung gilt nur für das erste Laden – danach bestimmt die Bedienung hier.
  const wunsch = useRef(auswahl?.sitzung);
  const [zuPunkt, setZuPunkt] = useState<string | null>(auswahl?.punkt ?? null);
  const gruppe = gruppen.find((g) => g.id === gruppeId) ?? gruppen[0] ?? null;

  const laden = useCallback(() => {
    if (!gruppe) return;
    setZustand({ art: 'laedt' });
    setOffen(null);
    // Das Ziel gilt für das Laden, das es vorfand: Läuft ein zweites Laden schon, bevor das erste fertig ist
    // (React-Prüfmodus, „Erneut versuchen“), hat es dasselbe Ziel – und löscht den Sprung nicht.
    const ziel = wunsch.current;
    Promise.all([ladeSitzungen(modul, gruppe, zeitzone), ladeAufgaben(modul, gruppe)]).then(
      ([daten, aufgaben]) => {
        setZustand({ art: 'fertig', daten, aufgaben });
        if (ziel === undefined) return;
        wunsch.current = undefined;
        const s = [...daten.kommend, ...daten.protokolle].find((x) => x.schluessel === ziel);
        if (s) setOffen(s);
        else setZuPunkt(null);
      },
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [modul, gruppe]);

  useEffect(laden, [laden]);

  // Still nachladen, ohne „Wird geladen …“: Der Editor bleibt offen (er hängt am Zustand „fertig“), nur „Kommend“ und
  // damit die nächste Sitzung sind danach frisch. Scheitert es, bleibt die alte Liste – das nächste Laden holt es nach.
  const nachladen = useCallback(() => {
    if (!gruppe) return;
    Promise.all([ladeSitzungen(modul, gruppe, zeitzone), ladeAufgaben(modul, gruppe)]).then(
      ([daten, aufgaben]) => setZustand({ art: 'fertig', daten, aufgaben }),
      () => {},
    );
  }, [modul, gruppe]);

  const darfSchreibenIn = (g: ProtokollGruppe) =>
    g.protokolle !== null && schreibbar.includes(g.protokolle);

  const alle =
    zustand.art === 'fertig' ? [...zustand.daten.kommend, ...zustand.daten.protokolle] : [];
  const darfFestlegen =
    !!gruppe &&
    darfSchreibenIn(gruppe) &&
    zustand.art === 'fertig' &&
    zustand.daten.kalender !== null;
  // Bearbeiten darf die Leitung, was nicht freigegeben ist und einen Termin oder ein Protokoll hat (K2b).
  const darfBearbeiten = (s: Sitzung) =>
    !!gruppe &&
    darfSchreibenIn(gruppe) &&
    s.kopf?.status !== 'frei' &&
    (s.termin !== null || s.kopf !== null);
  const naechsteVon = (s: Sitzung) => {
    const n = naechsteNach(s, alle);
    return (
      <NaechsteSitzung
        naechste={n}
        zeitzone={zeitzone}
        onFestlegen={
          darfFestlegen && s.kopf?.status !== 'frei'
            ? () => setFestlegen({ art: 'naechste', bis: s })
            : undefined
        }
        onAendern={
          n && darfBearbeiten(n) && s.kopf?.status !== 'frei' ? () => setBearbeiten(n) : undefined
        }
      />
    );
  };
  const bearbeitenFenster = (geoeffnetImEditor: boolean) =>
    bearbeiten &&
    gruppe &&
    gruppe.protokolle !== null &&
    zustand.art === 'fertig' && (
      <SitzungBearbeiten
        gruppe={gruppe}
        modul={modul}
        kategorie={gruppe.protokolle}
        sitzung={bearbeiten}
        sitzungen={alle}
        ich={ich}
        zeitzone={zeitzone}
        onFertig={() => {
          setBearbeiten(null);
          if (geoeffnetImEditor) {
            nachladen();
            return;
          }
          // Neu laden und die offene Sitzung wieder öffnen – nach einer Absage ist sie weg, dann die Liste.
          if (offen) wunsch.current = offen.schluessel;
          laden();
        }}
        onClose={() => setBearbeiten(null)}
      />
    );
  const festlegenFenster = (geoeffnetImEditor: boolean) =>
    festlegen &&
    gruppe &&
    gruppe.protokolle !== null &&
    zustand.art === 'fertig' &&
    zustand.daten.kalender !== null && (
      <SitzungFestlegen
        art={festlegen.art}
        gruppe={gruppe}
        modul={modul}
        kategorie={gruppe.protokolle}
        kalender={zustand.daten.kalender}
        sitzungen={alle}
        bis={festlegen.bis}
        ich={ich}
        zeitzone={zeitzone}
        onFestgelegt={(id) => {
          setFestlegen(null);
          if (geoeffnetImEditor) {
            nachladen();
            return;
          }
          // Aus der Liste oder der Ansicht: neu laden und die neue Sitzung öffnen.
          if (id !== null) wunsch.current = `p:${id}`;
          laden();
        }}
        onClose={() => setFestlegen(null)}
      />
    );

  if (!gruppe)
    return (
      <p className={styles.ruhig}>Du bist in keiner Gruppe, die hier Protokolle führen kann.</p>
    );

  if (
    offen?.kopf?.status === 'entwurf' &&
    zustand.art === 'fertig' &&
    gruppe.protokolle !== null &&
    darfSchreibenIn(gruppe)
  )
    return (
      <Suspense fallback={<p className={styles.ruhig}>Editor wird geladen …</p>}>
        {festlegenFenster(true)}
        {bearbeitenFenster(true)}
        <ProtokollSchreiben
          sitzung={offen}
          gruppe={gruppe.name}
          gruppeId={gruppe.id}
          modul={modul}
          kategorie={gruppe.protokolle}
          mitarbeit={gruppe.mitarbeit}
          protokolle={zustand.daten.protokolle}
          teile={zustand.daten.teile}
          ich={ich}
          zeitzone={zeitzone}
          naechste={naechsteVon(offen)}
          onZurueck={(geaendert) => {
            setOffen(null);
            if (geaendert) laden();
          }}
        />
      </Suspense>
    );

  const darfSchreiben = darfSchreibenIn(gruppe);

  if (offen && zustand.art === 'fertig')
    return (
      <>
        <SitzungAnsicht
          sitzung={offen}
          gruppe={gruppe.name}
          gruppeId={gruppe.id}
          protokolle={zustand.daten.protokolle}
          teile={zustand.daten.teile}
          aufgaben={zustand.aufgaben}
          zeitzone={zeitzone}
          springeZu={zuPunkt}
          naechste={naechsteVon(offen)}
          onBeginnen={darfSchreiben ? () => setBeginnt(offen) : undefined}
          onBearbeiten={darfBearbeiten(offen) ? () => setBearbeiten(offen) : undefined}
          onZurueck={() => {
            setZuPunkt(null);
            setOffen(null);
          }}
        />
        {beginnt && gruppe.protokolle !== null && (
          <ProtokollBeginnen
            sitzung={beginnt}
            gruppeId={gruppe.id}
            modul={modul}
            kategorie={gruppe.protokolle}
            mitarbeit={gruppe.mitarbeit}
            protokolle={zustand.daten.protokolle}
            teile={zustand.daten.teile}
            ich={ich}
            zeitzone={zeitzone}
            onBegonnen={(id) => {
              // Neu laden und gleich dieses Protokoll öffnen – als Entwurf im Editor (S4-1).
              setBeginnt(null);
              wunsch.current = `p:${id}`;
              laden();
            }}
            onClose={() => setBeginnt(null)}
          />
        )}
        {festlegenFenster(false)}
        {bearbeitenFenster(false)}
      </>
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
              {/* „Neue Sitzung“ braucht dazu einen Kalender – wer sie darf, darf also immer auch schreiben. */}
              {darfSchreiben && (
                <span className={styles.aktionen}>
                  <KopfKnopf
                    neu
                    label="Neues Protokoll"
                    title="Neues Protokoll ohne Termin"
                    symbol={<Icon name="plus" size={16} />}
                    onClick={() => setNeu(true)}
                  />
                  {darfFestlegen && (
                    <KopfKnopf
                      neu
                      label="Neue Sitzung"
                      title="Neue Sitzung mit Termin und Einladung"
                      symbol={<Icon name="calendar" size={16} />}
                      onClick={() => setFestlegen({ art: 'neu', bis: null })}
                    />
                  )}
                </span>
              )}
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
          {festlegenFenster(false)}
          {neu && (
            <ProtokollNeu
              modul={modul}
              gruppen={gruppen.filter(darfSchreibenIn)}
              start={gruppe.id}
              ich={ich}
              zeitzone={zeitzone}
              onAngelegt={(g, id) => {
                // Die neue Sitzung gleich im Editor öffnen – auch, wenn im Fenster eine andere Gruppe gewählt wurde.
                setNeu(false);
                wunsch.current = `p:${id}`;
                if (g === gruppe.id) laden();
                else setGruppeId(g);
              }}
              onClose={() => setNeu(false)}
            />
          )}
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
