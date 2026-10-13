import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { darfDienstgruppePlanen } from '@shared/ct/dienstRechte';
import { kachel, tagKurz } from '@shared/ct/datum';
import { isoTag } from '@shared/ct/zeit';
import { decktTermin } from '@shared/absences/index';
import type { CtAbsence } from '@shared/ct/typen';
import type { TerminZeile } from '@shared/dienstplan/termine';
import { bisDahin, startUebersicht, type DienstAmTermin } from '@shared/dienstplan/start';
import type { Start } from './start';
import type { TermineZustand } from './Termine';
import { ladeAbwesenheiten, ladeLieder, ladeMusikApp } from './ladeBeiwerk';
import { Plakette } from './Plakette';
import { adresseFuer, type ReiterId } from './reiter';
import styles from './Startseite.module.scss';

interface Props {
  start: Start;
  termine: TermineZustand | null;
  /** Heute als `YYYY-MM-DD` in Ortszeit. */
  heute: string;
  /** Termine neu laden (nach einem Fehler). */
  onNochmal: () => void;
  /** „Alle“ bei „Deine nächsten Dienste“: zur Termine-Liste, Ansicht „Meine“. */
  onMeineTermine: () => void;
}

/** So viele aus dem Team stehen im Kasten „Als Nächstes“; der Rest als „und N weitere“. */
const TEAM_ZEIGEN = 5;

/**
 * **Die Startseite des Dienstplaners** (Bauplan E3-3, Entwurf v17): „Als Nächstes“, deine offenen
 * Anfragen, deine nächsten Dienste, Abwesenheiten und – für Planer – wie viel in den nächsten sechs Wochen
 * noch frei ist. Nur lesen: Zusagen/Absagen kommt mit E7 (bis dahin in der ChurchTools-App), Live und
 * „Ablauf & Dienste“ mit der Termin-Ansicht.
 */
export function Startseite({ start, termine, heute, onNochmal, onMeineTermine }: Props) {
  const planbar = start.dienstgruppen.filter((g) => darfDienstgruppePlanen(start.rechte, g.id));
  const zeilen = termine?.art === 'fertig' ? termine.zeilen : [];
  const u = startUebersicht(zeilen, { jetzt: new Date(), heute, planbar });
  const abwesenheiten = useAbwesenheiten(start.ichId, heute);
  const abwesendAm = (z: TerminZeile) =>
    !!abwesenheiten?.some((a) =>
      decktTermin(
        {
          startDate: a.startDate,
          endDate: a.endDate,
          startTime: a.startTime ?? null,
          endTime: a.endTime ?? null,
        },
        { startDate: z.beginn, endDate: z.ende, date: z.tag },
      ),
    );
  const kommendeAbwesenheiten = abwesenheiten?.filter((a) => a.endDate >= heute).length;

  return (
    <div className={styles.raster}>
      <div className={styles.spalte}>
        {(termine === null || termine.art === 'laedt') && (
          <section className={styles.karte}>
            <p className={styles.hinweis}>Termine werden geladen …</p>
          </section>
        )}
        {termine?.art === 'fehler' && (
          <FehlerKasten fehler={termine.fehler} onNochmal={onNochmal} />
        )}
        {termine?.art === 'fertig' &&
          (u.naechster ? (
            <AlsNaechstes termin={u.naechster} heute={heute} />
          ) : (
            <section className={styles.karte}>
              <p className={styles.hinweis}>
                In den nächsten {termine.wochen} Wochen stehen keine Termine an.
              </p>
            </section>
          ))}

        {u.offen.length > 0 && (
          <section className={styles.karte} aria-labelledby="offen">
            <div className={styles.kopf}>
              <h2 id="offen">Für dich offen</h2>
            </div>
            <ul className={styles.liste}>
              {u.offen.map((d, i) => (
                <DienstZeile key={i} d={d} abwesend={abwesendAm(d.termin)} />
              ))}
            </ul>
            <p className={styles.hinweis}>
              Zu- und absagen kannst du vorerst in der ChurchTools-App; hier kommt es als Nächstes
              dazu.
            </p>
          </section>
        )}
      </div>

      <div className={styles.spalte}>
        <section className={styles.karte} aria-labelledby="dienste">
          <div className={styles.kopf}>
            <h2 id="dienste">Deine nächsten Dienste</h2>
            <button type="button" className={styles.klein} onClick={onMeineTermine}>
              Alle <Icon name="chev-right" size={14} />
            </button>
          </div>
          <ul className={styles.liste}>
            {u.naechsteDienste.map((d, i) => (
              <DienstZeile key={i} d={d} />
            ))}
            {termine?.art === 'fertig' && u.naechsteDienste.length === 0 && (
              <li className={styles.zeile}>
                <span className={styles.leise}>Keine weiteren zugesagten Dienste.</span>
              </li>
            )}
          </ul>
        </section>

        <section className={styles.karte}>
          <ReiterLink reiter="abwesenheiten" icon="user-slash" titel="Abwesenheiten">
            {kommendeAbwesenheiten === undefined
              ? 'Trag ein, wann du nicht kannst.'
              : kommendeAbwesenheiten > 0
                ? `${kommendeAbwesenheiten} eingetragen – rechtzeitig nachtragen hilft den Planern`
                : 'Noch nichts eingetragen'}
          </ReiterLink>
        </section>

        {planbar.length > 0 && (
          <section className={styles.karte} aria-labelledby="planen">
            <div className={styles.kopf}>
              <h2 id="planen">Planen</h2>
              <span className={styles.leise}>nächste 6 Wochen</span>
            </div>
            {u.planen.map(({ gruppe, frei }) => (
              <ReiterLink key={gruppe.id} reiter="planen" titel={gruppe.name}>
                {termine?.art !== 'fertig' ? (
                  ' '
                ) : frei > 0 ? (
                  <span className={styles.frei}>
                    {frei} {frei === 1 ? 'Platz' : 'Plätze'} frei
                  </span>
                ) : (
                  <span className={styles.besetzt}>alles besetzt</span>
                )}
              </ReiterLink>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function AlsNaechstes({ termin: z, heute }: { termin: TerminZeile; heute: string }) {
  const k = kachel(z.tag);
  const [lieder, setLieder] = useState<string[] | null | undefined>(undefined);
  const [musikApp, setMusikApp] = useState<string | null>(null);

  useEffect(() => {
    let aktuell = true;
    setLieder(undefined);
    // Beiwerk: scheitert es, fehlt die Angabe – „noch kein Ablauf“ stünde sonst falsch da.
    ladeLieder(z.id).then(
      (l) => aktuell && setLieder(l),
      () => undefined,
    );
    return () => {
      aktuell = false;
    };
  }, [z.id]);

  useEffect(() => {
    ladeMusikApp().then(setMusikApp, () => setMusikApp(null));
  }, []);

  const team = z.team.slice(0, TEAM_ZEIGEN).map((t) => `${t.name} (${t.dienst})`);
  const mehr = z.team.length - team.length;

  return (
    <section className={`${styles.karte} ${styles.held}`} aria-labelledby="als-naechstes">
      <span className={styles.vorzeile}>Als Nächstes · {bisDahin(heute, z.tag)}</span>
      <div className={styles.heldKopf}>
        <DatumKachel tag={k.tag} monat={k.monat} />
        <div>
          <h2 id="als-naechstes">{z.name}</h2>
          <p className={styles.leise}>
            {tagKurz(z.tag)} · {z.uhrzeit} Uhr{z.endeUhrzeit && ` · Ende ca. ${z.endeUhrzeit} Uhr`}
          </p>
        </div>
      </div>
      <div className={styles.tags}>
        {z.meine.length > 0 ? (
          z.meine.map((d, i) => (
            <Plakette key={i} art={d.zugesagt ? 'zugesagt' : 'angefragt'} gross>
              Du: <b>{d.dienst}</b> · {d.zugesagt ? 'zugesagt' : 'angefragt'}
            </Plakette>
          ))
        ) : (
          <span className={styles.leise}>Du hast an diesem Termin keinen Dienst.</span>
        )}
      </div>
      {musikApp && (
        <div className={styles.knoepfe}>
          <a className={styles.knopf} href={musikApp}>
            <Icon name="music" size={18} /> Musik-App
          </a>
        </div>
      )}
      <div className={styles.info}>
        {team.length > 0 && (
          <div>
            Mit dabei: {team.join(', ')}
            {mehr > 0 && ` und ${mehr} weitere`}
          </div>
        )}
        {lieder && lieder.length > 0 && <div>Lieder: {lieder.join(' · ')}</div>}
        {lieder === null && <div className={styles.leise}>Noch kein Ablauf.</div>}
      </div>
    </section>
  );
}

function DienstZeile({ d, abwesend = false }: { d: DienstAmTermin; abwesend?: boolean }) {
  const k = kachel(d.termin.tag);
  return (
    <li className={styles.zeile}>
      <DatumKachel tag={k.tag} monat={k.monat} />
      <div className={styles.mitte}>
        <b>
          {d.dienst} · {d.termin.name}
        </b>
        <small>
          {tagKurz(d.termin.tag)} · {d.termin.uhrzeit} Uhr
        </small>
        {abwesend && (
          <small className={styles.warnung}>Du bist an dem Tag als abwesend eingetragen.</small>
        )}
      </div>
    </li>
  );
}

function ReiterLink({
  reiter,
  icon,
  titel,
  children,
}: {
  reiter: ReiterId;
  icon?: 'user-slash';
  titel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.linkZeile}
      onClick={() => {
        window.location.hash = adresseFuer(reiter);
      }}
    >
      {icon && (
        <span className={`${styles.kachel} ${styles.kachelGrau}`} aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className={styles.mitte}>
        <b>{titel}</b>
        <small>{children}</small>
      </span>
      <Icon name="chev-right" size={18} />
    </button>
  );
}

/** Die eigenen Abwesenheiten ab heute (ein Jahr voraus); `undefined`, solange unbekannt oder gescheitert. */
function useAbwesenheiten(ichId: number, heute: string): CtAbsence[] | undefined {
  const [liste, setListe] = useState<CtAbsence[] | undefined>(undefined);
  useEffect(() => {
    let aktuell = true;
    // Ein Jahr voraus – über einen Zeitpunkt, nicht als Text (am 29.02. gäbe es sonst keinen Tag).
    const bis = isoTag(new Date(Date.parse(`${heute}T12:00:00Z`) + 365 * 86_400_000));
    ladeAbwesenheiten(ichId, heute, bis).then(
      (l) => aktuell && setListe(l),
      () => undefined,
    );
    return () => {
      aktuell = false;
    };
  }, [ichId, heute]);
  return liste;
}
