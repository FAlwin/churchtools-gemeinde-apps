import { useEffect, useMemo, useRef } from 'react';
import { BodyPortal } from '@ui/fenster/BodyPortal';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { useVollbild } from '@ui/bedienung/useVollbild';
import { useWakeLock } from '@ui/bedienung/useWakeLock';
import { itemTitleParts, type AblaufZeile } from '@shared/ct/ablaufZeile';
import { tagKurz } from '@shared/ct/datum';
import {
  abweichungText,
  liveLage,
  liveListe,
  restText,
  type LiveGrund,
  type LivePunkt,
} from '@shared/ct/liveAgenda';
import { ortszeitAus } from '@shared/ct/zeit';
import type { CtAgendaItem } from '@shared/ct/typen';
import type { InfoGruppe } from '@shared/types/index';
import { ladeLive } from './ladeLive';
import { useLive } from './useLive';
import styles from './LiveAnsicht.module.scss';

/** Uhrzeit eines Zeitpunkts (ms) in der Zeitzone der Gemeinde: „10:08“. */
const uhrzeit = (ms: number, zeitzone: string) =>
  ortszeitAus(new Date(ms).toISOString(), zeitzone).slice(11, 16);

/** Was über der Ansicht steht, wenn ChurchTools nicht wie erwartet antwortet. */
function fehlerText(grund: LiveGrund, standVon: string | null): string {
  switch (grund) {
    case 'voruebergehend':
      return standVon
        ? `Keine Verbindung – Stand von ${standVon} Uhr. Wird wieder versucht.`
        : 'ChurchTools antwortet gerade nicht – „Jetzt“ folgt bis dahin der Uhr. Wird wieder versucht.';
    case 'abgemeldet':
      return 'Du bist bei ChurchTools abgemeldet. Bitte neu anmelden und „Live“ wieder öffnen.';
    case 'kein-recht':
      return 'ChurchTools lässt dich die Live-Agenda dieses Termins nicht sehen.';
    case 'unlesbar':
    case 'nicht-angekommen':
      return 'ChurchTools antwortet anders als erwartet – „Live“ geht gerade nicht.';
  }
}

/**
 * **„Live“ zum Folgen** (Bauplan E6b-2 L2, Entwurf `e6b-2-live.html` Variante A, Alwin 02.11.2026): der Live-Stand von
 * ChurchTools – derselbe wie in dessen „Live-Agenda“ – im Aufbau der Live-Agenda, aber im Look der App: **Jetzt** mit
 * Zuständigen und den Infos der unter „Spalten“ gewählten Gruppen, **Dann**, der Kreis mit der Restzeit, die
 * Abweichung in Worten und darunter der ganze Ablauf mit erledigten Punkten. Nachgefragt wird alle 2,5 s
 * (`useLive`); die Regeln stehen in `shared/ct/liveAgenda.ts`. Solange niemand gestartet hat, folgt „Jetzt“ der Uhr.
 * Steuern kommt mit L3. Bildschirm bleibt an; Vollbild, wo der Browser es kann.
 */
export function LiveAnsicht({
  titel,
  tag,
  beginn,
  terminId,
  agendaId,
  items,
  zeilen,
  infoGruppen,
  zeitzone,
  onSchliessen,
  lesen = ladeLive,
}: {
  titel: string;
  /** Tag des Termins (`JJJJ-MM-TT`, Gemeinde-Zeit). */
  tag: string;
  /** „10:00“. */
  beginn: string;
  terminId: number;
  /** Die ID des Ablaufs – ChurchTools will sie beim Lesen (`agenda_id`). */
  agendaId: number;
  /** Die Punkte wie von ChurchTools – daraus die Liste mit derselben Zählung wie dort (`liveListe`). */
  items: readonly CtAgendaItem[];
  /** Dieselben Punkte als Zeilen – für Zuständige, Lied und Infos. */
  zeilen: readonly AblaufZeile[];
  infoGruppen: readonly InfoGruppe[];
  zeitzone: string;
  onSchliessen: () => void;
  /** Nur für Tests: woher der Stand kommt. */
  lesen?: typeof ladeLive;
}) {
  const wurzel = useRef<HTMLDivElement>(null);
  const aktuell = useRef<HTMLLIElement>(null);
  const vollbild = useVollbild(wurzel);
  const { umschalten: vollbildUmschalten } = vollbild;
  useWakeLock(true);
  const live = useLive(terminId, agendaId, lesen);

  const liste = useMemo(() => liveListe(items, terminId), [items, terminId]);
  const zeileVon = useMemo(() => new Map(zeilen.map((z) => [z.id, z])), [zeilen]);
  // Gerechnet wird in der Uhr von ChurchTools, damit Restzeit und Abweichung auf allen Geräten gleich sind.
  const jetzt = live.jetzt - live.versatz;
  const lage = liveLage(liste, live.stand, jetzt);

  function schliessen(): void {
    vollbild.beenden();
    onSchliessen();
  }

  useEffect(() => {
    wurzel.current?.focus();
    const taste = (ev: KeyboardEvent) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.key === 'f' || ev.key === 'F') vollbildUmschalten();
      else if (ev.key === 'Escape') {
        // Im Vollbild beendet der Browser selbst das Vollbild – nicht zusätzlich schließen.
        if (document.fullscreenElement) return;
        onSchliessen();
      } else return;
      ev.preventDefault();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [vollbildUmschalten, onSchliessen]);

  const jetztPunkt = lage.art === 'ende' ? null : lage.jetzt;
  const index = jetztPunkt ? liste.indexOf(jetztPunkt) : -1;
  // Der aktuelle Punkt bleibt in der Liste zu sehen.
  useEffect(() => {
    aktuell.current?.scrollIntoView?.({ block: 'nearest' });
  }, [index]);

  /** Titel mit Lied („Lied – Treu“) und Zuständige – aus der Zeile, die auch der Ablauf zeigt. */
  const teile = (p: LivePunkt) => {
    const z = zeileVon.get(p.id);
    if (!z) return { titel: p.title, wer: '', zeile: null };
    const { title, songName } = itemTitleParts(z);
    return {
      titel: songName ? `${title} – ${songName}` : title,
      wer: z.responsible.map((r) => r.label).join(', '),
      zeile: z,
    };
  };

  const jetztTeile = jetztPunkt ? teile(jetztPunkt) : null;
  const dann = lage.art === 'ende' ? null : lage.dann;
  const mit = lage.art === 'ende' ? [] : lage.mit;

  // Restzeit: im Lauf aus dem Stand, nach Plan aus der Uhr.
  const rest =
    lage.art === 'laeuft'
      ? { sek: lage.restSek, dauer: lage.dauerSek }
      : lage.art === 'nach-plan' && lage.jetzt && lage.restSek !== null
        ? { sek: lage.restSek, dauer: lage.jetzt.dauerSek }
        : null;
  const ueber = rest !== null && rest.sek < 0;
  const anteil = rest && rest.dauer > 0 ? Math.min(1, Math.max(0, rest.sek / rest.dauer)) : 0;
  const verspaetung = lage.art === 'nach-plan' ? null : lage.verspaetungSek;

  const label =
    lage.art === 'ende' ? 'Ende' : lage.art === 'nach-plan' ? 'Jetzt · nach Plan' : 'Jetzt';
  const grossTitel =
    lage.art === 'ende'
      ? 'Ablauf vorbei'
      : (jetztTeile?.titel ??
        (lage.art === 'nach-plan' && lage.vorbei ? 'Laut Plan vorbei' : 'Noch nicht begonnen'));

  const standVon =
    live.gelesenUm !== null ? uhrzeit(live.gelesenUm - live.versatz, zeitzone) : null;

  return (
    <BodyPortal>
      <div
        ref={wurzel}
        className={styles.live}
        role="dialog"
        aria-modal="true"
        aria-label={`Live: ${titel}`}
        tabIndex={-1}
      >
        <div className={styles.leiste}>
          <div className={styles.was}>
            <span
              className={`${styles.marke}${lage.art === 'laeuft' ? ` ${styles.laeuft}` : ''}`}
              data-laeuft={lage.art === 'laeuft'}
            >
              Live
            </span>
            <b>{titel}</b>
            <span className={styles.wann}>
              {tagKurz(tag)} · Beginn {beginn}
            </span>
          </div>
          <div className={styles.knoepfe}>
            <span className={styles.uhr} aria-label="Uhrzeit">
              {uhrzeit(jetzt, zeitzone)}
            </span>
            {vollbild.kann && (
              <KopfKnopf
                onClick={vollbildUmschalten}
                label={vollbild.an ? 'Vollbild beenden' : 'Vollbild'}
                symbol={<Icon name={vollbild.an ? 'vollbild-aus' : 'vollbild'} size={16} />}
              />
            )}
            <KopfKnopf
              onClick={schliessen}
              label="Schließen"
              symbol={<Icon name="x" size={16} />}
            />
          </div>
        </div>

        {live.fehler && (
          <p className={styles.fehler} role="status">
            {fehlerText(live.fehler, standVon)}
          </p>
        )}

        <div className={styles.rumpf}>
          <div className={styles.links}>
            <section className={styles.jetzt} aria-label="Jetzt">
              <span className={styles.etikett}>{label}</span>
              <h2>{grossTitel}</h2>
              {lage.art === 'nach-plan' && !lage.jetzt && !lage.vorbei && (
                <p className={styles.unter}>Beginn {beginn}</p>
              )}
              {lage.art === 'ende' && lage.seit !== null && (
                <p className={styles.unter}>
                  Fertig um {uhrzeit(lage.seit, zeitzone)}
                  {lage.verspaetungSek !== null && (
                    <>
                      {' · '}
                      <b className={lage.verspaetungSek > 0 ? styles.spaeter : styles.frueher}>
                        {abweichungText(lage.verspaetungSek)}
                      </b>
                    </>
                  )}
                </p>
              )}
              {/* Die Notiz wie in der Live-Agenda von ChurchTools („Thema folgt“, Test-Instanz 02.11.2026). */}
              {jetztTeile?.zeile?.note && <p className={styles.notiz}>{jetztTeile.zeile.note}</p>}
              {jetztTeile?.wer && <p className={styles.wer}>{jetztTeile.wer}</p>}
              {jetztTeile?.zeile &&
                infoGruppen.map((g) => {
                  const text = jetztTeile.zeile?.infos?.find((i) => i.gruppeId === g.id)?.text;
                  return text ? (
                    <p key={g.id} className={styles.info}>
                      <i>{g.name}:</i> {text}
                    </p>
                  ) : null;
                })}
              {mit.length > 0 && (
                <p className={styles.unter}>mit {mit.map((p) => teile(p).titel).join(', ')}</p>
              )}
              {lage.art === 'nach-plan' && (
                <p className={styles.hinweis}>Noch nicht gestartet – „Jetzt“ folgt der Uhr.</p>
              )}
            </section>

            {dann && (
              <section className={styles.dann} aria-label="Dann">
                <span className={styles.etikett}>Dann</span>
                {dann === 'ende' ? (
                  <b>Ende</b>
                ) : (
                  <>
                    <b>{teile(dann).titel}</b>
                    {teile(dann).wer && <span className={styles.wer}>{teile(dann).wer}</span>}
                  </>
                )}
              </section>
            )}

            <ol className={styles.liste} aria-label="Ablauf">
              {liste.map((p, i) => {
                const t = teile(p);
                const erledigt =
                  lage.art === 'ende' || (lage.art === 'laeuft' && i < lage.stelle - 1);
                const klasse = [
                  styles.punkt,
                  p.weggelassen ? styles.weggelassen : erledigt ? styles.erledigt : '',
                  i === index ? styles.aktuell : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li
                    key={p.id}
                    ref={i === index ? aktuell : undefined}
                    className={klasse}
                    aria-current={i === index ? 'step' : undefined}
                  >
                    <span className={styles.zeit}>{t.zeile?.time ?? ''}</span>
                    <span className={styles.titel}>
                      {erledigt && !p.weggelassen && (
                        <Icon name="check" size={14} className={styles.haken} />
                      )}
                      {t.titel}
                    </span>
                    <span className={styles.werKlein}>{t.wer}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className={styles.rechts}>
            {rest && (
              <div
                className={`${styles.ring}${ueber ? ` ${styles.ueber}` : ''}`}
                aria-label="Restzeit"
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle className={styles.spur} cx="50" cy="50" r="44" />
                  {/* Ohne Rest kein Bogen – die runde Kappe ließe sonst einen Punkt oben stehen. */}
                  {anteil > 0 && (
                    <circle
                      className={styles.fortschritt}
                      cx="50"
                      cy="50"
                      r="44"
                      style={{ strokeDasharray: `${(anteil * 276.5).toFixed(1)} 276.5` }}
                    />
                  )}
                </svg>
                <div className={styles.zahl}>
                  <b>{restText(rest.sek)}</b>
                  <span>
                    {ueber ? (
                      'über der Zeit'
                    ) : (
                      <>
                        noch
                        <span className={styles.vonDauer}>
                          , von {Math.round(rest.dauer / 60)} Min
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}
            {verspaetung !== null && (
              <div className={styles.gesamt}>
                Gesamt
                <b
                  className={
                    verspaetung >= 60 ? styles.spaeter : verspaetung <= -60 ? styles.frueher : ''
                  }
                >
                  {abweichungText(verspaetung)}
                </b>
              </div>
            )}
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
