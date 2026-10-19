import { useEffect, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { AblaufListe } from '@ui/ablauf/AblaufListe';
import { ablaufZeileAus } from '@shared/ct/ablaufZeile';
import { datumText, kachel } from '@shared/ct/datum';
import type { CtAgenda } from '@shared/ct/typen';
import { gruppenName } from '@shared/dienstplan/plan';
import { ladeTermin, type TermineDaten } from './ladeTermine';
import { ladeAblauf, ladeMusikApp } from './ladeBeiwerk';
import { Plaetze } from './Planen';
import type { Start } from './start';
import styles from './TerminAnsicht.module.scss';

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; daten: TermineDaten; ablauf: CtAgenda | null };

/**
 * **Die Termin-Ansicht** (Bauplan E6-1b, Entwurf `e6-entwurf.html` Bild 1): oben der Ablauf – derselbe Baustein wie in
 * der Musik-App (`ui/ablauf/AblaufListe`), die Dauer neben der Zeit (Alwin, 17.10.2026) –, darunter die Dienste des
 * Termins mit denselben Plätzen wie in „Planen“. Nur ansehen; Bearbeiten kommt mit E6-3. ‹ › blättert durch die
 * geladenen Termine.
 *
 * Geladen wird der Termin frisch (`ladeTermin`, dieselbe Regel wie Liste und Matrix) – er kann auch außerhalb des
 * geladenen Zeitraums liegen (aus „Planen“ mit eigenem Zeitraum).
 */
export function TerminAnsicht({
  start,
  terminId,
  zeitzone,
  vorher,
  nachher,
  zurueck,
  onTermin,
  onZurueck,
}: {
  start: Start;
  terminId: number;
  zeitzone: string;
  /** Voriger/nächster geladener Termin – `null`, wenn es keinen gibt (oder der Termin nicht in der Liste steht). */
  vorher: number | null;
  nachher: number | null;
  /** Wohin „zurück“ führt, z. B. „Termine“. */
  zurueck: string;
  onTermin: (id: number) => void;
  onZurueck: () => void;
}) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [versuch, setVersuch] = useState(0);
  const [musikApp, setMusikApp] = useState<string | null>(null);

  useEffect(() => {
    let aktuell = true;
    setZustand({ art: 'laedt' });
    Promise.all([ladeTermin(start, terminId, zeitzone), ladeAblauf(terminId)]).then(
      ([daten, ablauf]) => aktuell && setZustand({ art: 'fertig', daten, ablauf }),
      (e: unknown) => aktuell && setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    return () => {
      aktuell = false;
    };
  }, [start, terminId, zeitzone, versuch]);

  // Beiwerk wie auf der Startseite: scheitert es, fehlt nur der Knopf.
  useEffect(() => {
    let aktuell = true;
    ladeMusikApp().then(
      (url) => aktuell && setMusikApp(url),
      () => {},
    );
    return () => {
      aktuell = false;
    };
  }, []);

  const blaettern = (
    <span className={styles.blaettern}>
      <button
        type="button"
        className={styles.rund}
        aria-label="Voriger Termin"
        disabled={vorher === null}
        onClick={() => vorher !== null && onTermin(vorher)}
      >
        <Icon name="chev-left" size={16} />
      </button>
      <button
        type="button"
        className={styles.rund}
        aria-label="Nächster Termin"
        disabled={nachher === null}
        onClick={() => nachher !== null && onTermin(nachher)}
      >
        <Icon name="chev-right" size={16} />
      </button>
    </span>
  );
  const zurueckKnopf = (
    <button type="button" className={styles.zurueck} onClick={onZurueck}>
      <Icon name="chev-left" size={16} /> {zurueck}
    </button>
  );

  if (zustand.art !== 'fertig') {
    return (
      <div className={styles.seite}>
        <div className={styles.kopf}>
          {zurueckKnopf}
          {blaettern}
        </div>
        {zustand.art === 'laedt' ? (
          <p className={styles.hinweis}>Termin wird geladen …</p>
        ) : (
          <FehlerKasten fehler={zustand.fehler} onNochmal={() => setVersuch((v) => v + 1)} />
        )}
      </div>
    );
  }

  const { plan } = zustand.daten;
  const s = plan.spalten[0];
  const k = kachel(s.tag);
  // Nur Dienste, die es an diesem Termin gibt: `planAus` lässt die übrigen schon weg (ein Termin = eine Spalte).
  const gruppen = plan.gruppen;
  const ende = zustand.daten.zeilen[0]?.endeUhrzeit ?? null;
  const ablauf = zustand.ablauf;
  const items = ablauf?.items ?? []; // null = kein Ablauf

  return (
    <div className={styles.seite}>
      <div className={styles.kopf}>
        {zurueckKnopf}
        <div className={styles.termin}>
          <DatumKachel tag={k.tag} monat={k.monat} />
          <div className={styles.titel}>
            <h2>{s.name}</h2>
            <p>
              {datumText(s.tag)} · {s.uhrzeit} Uhr
              {ende && ` · Ende ca. ${ende} Uhr`}
              {s.abgesagt && <b className={styles.abgesagt}> · abgesagt</b>}
            </p>
          </div>
        </div>
        {blaettern}
      </div>

      <section className={styles.karte} aria-label="Ablauf">
        <div className={styles.kartenKopf}>
          <h3>Ablauf</h3>
          {musikApp && (
            <a className={styles.leise} href={musikApp}>
              <Icon name="music" size={16} /> Musik-App
            </a>
          )}
        </div>
        {ablauf === null ? (
          <p className={styles.hinweis}>Noch kein Ablauf.</p>
        ) : items.length === 0 ? (
          <p className={styles.hinweis}>Der Ablauf ist noch leer.</p>
        ) : (
          // Auf grauem Grund wie in der Musik-App – sonst stünden die Karten-Zeilen weiß auf weiß.
          <div className={styles.ablaufGrund}>
            <AblaufListe
              zeilen={items.map((i) => ablaufZeileAus(i, terminId, zeitzone))}
              beginn={s.uhrzeit}
              dauerNebenZeit
            />
          </div>
        )}
      </section>

      <section className={styles.karte} aria-label="Dienste">
        <div className={styles.kartenKopf}>
          <h3>Dienste</h3>
        </div>
        {gruppen.length === 0 ? (
          <p className={styles.hinweis}>
            An diesem Termin stehen keine Dienste, die du sehen darfst.
          </p>
        ) : (
          gruppen.map((g) => (
            <div key={g.gruppe?.id ?? 'weitere'} className={styles.gruppe}>
              <h4>{gruppenName(g)}</h4>
              {g.zeilen.map((z) => (
                <div key={z.dienst.id} className={styles.dienst}>
                  <span>{z.dienst.name}</span>
                  <Plaetze plaetze={z.zellen[0] ?? []} ichId={start.ichId} />
                </div>
              ))}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
