import { useState, type ReactNode } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { KachelLink, TitelLink } from './TerminLink';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { kachel, plusTage, tagKurz } from '@shared/ct/datum';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import { gemeindeZeitzone } from '@shared/ct/zeit';
import { abwesendAm as deckt } from '@shared/dienstplan/abfrageStand';
import type { CtAbsence } from '@shared/ct/typen';
import type { Plan, PlanGruppe } from '@shared/dienstplan/plan';
import {
  abfrageKartenEtikett,
  abfrageZeilenTitel,
  naechsteErinnerungText,
} from '@shared/dienstplan/abfrageStand';
import type { TerminZeile } from '@shared/dienstplan/termine';
import { bisDahin, startUebersicht, type DienstAmTermin } from '@shared/dienstplan/start';
import { planbareDienstgruppen, type Start } from './start';
import type { TermineZustand } from './Termine';
import { ladeAbwesenheiten, ladeAblauf, ladeLieder } from './ladeBeiwerk';
import { ladeLiveLaeuft } from './ladeLive';
import { liveKnopfOffen } from './liveFenster';
import { LivePunkt } from './LivePunkt';
import { useMusikApp } from './useMusikApp';
import { Plakette } from './Plakette';
import { plaketteArt } from './plaketteArt';
import { AntwortKnoepfe } from './AntwortKnoepfe';
import { Toast } from '@ui/fenster/Toast';
import type { Antworten } from './useAntworten';
import type { Tausch } from './useTausch';
import { TauschAmDienst, TauschEingang, TauschGetauscht, type EigenerDienst } from './TauschTeile';
import type { VertretungZugriff } from './useVertretung';
import { VertretungEingang } from './VertretungTeile';
import {
  adresseFuer,
  adresseFuerAbwesenheitenAbfrage,
  adresseFuerPlanenGruppe,
  type ReiterId,
} from './reiter';
import { AbfrageKarte } from './AbfrageKarte';
import { AbfrageFensterStart } from './AbfrageFensterStart';
import type { AbfrageAnschluss } from './AbfrageFenster';
import type { AntwortenLader } from './ladeAntworten';
import type { PersonenLader } from './ladePersonen';
import type { TermineDaten } from './ladeTermine';
import { useStartAbfragen } from './useAbfragen';
import { KlickZeile } from '@ui/bedienung/KlickZeile';
import { Etikett } from '@ui/bedienung/Etikett';
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
  /** „Ablauf & Dienste“ → Termin-Ansicht (E6-1b). */
  onTermin?: (id: number) => void;
  /** „Live-Ansicht“ → Termin-Ansicht mit gleich geöffneter Live-Ansicht – ohne: kein Knopf. */
  onLive?: (id: number) => void;
  /** Anfragen beantworten (E7-1) – ohne: nur ansehen. */
  antworten?: Antworten;
  /** Dienste tauschen (E7-3) – ohne: kein „Tauschen“, keine Tausch-Anfragen. */
  tausch?: Tausch;
  /** Vertretung suchen (E5c-6) – ohne: kein „Vertretung suchen“, kein „Übernehmen“. */
  vertretung?: VertretungZugriff;
  /** Zeitzone der Gemeinde – für die Tage der Tausch-Anfragen. */
  zeitzone?: string;
  /**
   * Die Zeile „Abfrage …“ in der Karte „Planen“ öffnet das Fenster „Abfrage“ (R-3) – dafür braucht es dieselben Lader wie in
   * Planen. Ohne: keine Zeile (die Karte für Mitarbeitende gibt es trotzdem).
   */
  abfrage?: {
    anschluss: AbfrageAnschluss;
    ladeZeitraum: (von: string, bis: string) => Promise<TermineDaten>;
    ladePersonen: PersonenLader;
    ladeAntworten: AntwortenLader;
  };
}

/** Der eigene Dienst einer Zeile, wie der Tausch ihn braucht – `null` ohne bekannten Platz. */
function eigener(d: DienstAmTermin): EigenerDienst | null {
  return d.mein.ort
    ? {
        terminId: d.termin.id,
        termin: d.termin.name,
        tag: d.termin.tag,
        uhrzeit: d.termin.uhrzeit,
        dienst: d.dienst,
        ort: d.mein.ort,
      }
    : null;
}

/** Solange keine Termine da sind: ein leerer Plan – das Fenster „Abfrage“ lädt den Zeitraum der Abfrage dann selbst. */
const KEIN_PLAN: Plan = { spalten: [], gruppen: [] };

/** Die Dienstgruppe im Plan; fehlt sie dort (keine Dienste in diesen Wochen), eine leere – die Zahlen kommen aus dem Nachladen. */
const gruppeImPlan = (plan: Plan, gruppe: Dienstgruppe): PlanGruppe =>
  plan.gruppen.find((g) => g.gruppe?.id === gruppe.id) ?? {
    gruppe,
    planbar: true,
    zeilen: [],
    frei: [],
  };

/** So viele aus dem Team stehen im Kasten „Als Nächstes“; der Rest als „und N weitere“. */
const TEAM_ZEIGEN = 5;

/**
 * **Die Startseite des Dienstplaners** (Bauplan E3-3, Entwurf v17): „Als Nächstes“, deine offenen
 * Anfragen, deine nächsten Dienste, Abwesenheiten und – für Planer – wie viel in den nächsten sechs Wochen
 * noch frei ist. Offene Anfragen lassen sich zusagen oder absagen (E7-1, `AntwortKnoepfe`, zusätzlich zur
 * ChurchTools-App); „Ablauf & Dienste“ öffnet die Termin-Ansicht (E6-1b).
 */
export function Startseite({
  start,
  termine,
  heute,
  onNochmal,
  onMeineTermine,
  onTermin,
  onLive,
  antworten,
  tausch,
  vertretung,
  zeitzone = gemeindeZeitzone(),
  abfrage,
}: Props) {
  const planbar = planbareDienstgruppen(start);
  const zeilen = termine?.art === 'fertig' ? termine.zeilen : [];
  const u = startUebersicht(zeilen, { jetzt: new Date(), heute, planbar });
  const planFuerAbfrage: Plan = termine?.art === 'fertig' ? termine.plan : KEIN_PLAN;
  const abwesenheiten = useAbwesenheiten(start.ichId, heute);
  const abwesendAm = (z: TerminZeile) => !!abwesenheiten && deckt(abwesenheiten, z);
  // Laufende Abfragen (R-3): Karten für mich, Zeilen für die Gruppen, die ich plane. Scheitert etwas, bleibt beides leer.
  const abfragen = useStartAbfragen(start, heute, zeitzone);
  const [abfrageOffen, setAbfrageOffen] = useState<number | null>(null);
  const offeneAbfrage = abfragen.planer.find((l) => l.gruppe.id === abfrageOffen) ?? null;
  const kommendeAbwesenheiten = abwesenheiten?.filter((a) => a.endDate >= heute).length;
  // „Alle zusagen“ ab zwei unbeantworteten Anfragen (Entwurf E7-1).
  const unbeantwortet = u.offen.filter((d) => d.mein.ort && !d.mein.zugesagt && !d.mein.antwort);

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
            <AlsNaechstes
              termin={u.naechster}
              heute={heute}
              zeitzone={zeitzone}
              onTermin={onTermin}
              onLive={onLive}
            />
          ) : (
            <section className={styles.karte}>
              <p className={styles.hinweis}>
                In den nächsten {termine.wochen} Wochen stehen keine Termine an.
              </p>
            </section>
          ))}

        {abfragen.karten.map((k) => (
          <AbfrageKarte
            key={k.gruppe.id}
            karte={k}
            heute={heute}
            onEintragen={() => {
              window.location.hash = adresseFuerAbwesenheitenAbfrage(k.gruppe.id);
            }}
          />
        ))}

        {(u.offen.length > 0 ||
          !!tausch?.eingang.length ||
          !!tausch?.getauscht.length ||
          !!vertretung?.offen.length) && (
          <section className={styles.karte} aria-labelledby="offen">
            <div className={styles.kopf}>
              <h2 id="offen">Für dich offen</h2>
              {antworten && unbeantwortet.length > 1 && (
                <button
                  type="button"
                  className={styles.klein}
                  onClick={() =>
                    void antworten.alleZusagen(
                      unbeantwortet.map((d) => ({ terminId: d.termin.id, d: d.mein })),
                    )
                  }
                >
                  Alle zusagen
                </button>
              )}
            </div>
            <ul className={styles.liste}>
              {u.offen.map((d, i) => (
                <DienstZeile key={i} d={d} abwesend={abwesendAm(d.termin)} onTermin={onTermin}>
                  {antworten && (
                    <AntwortKnoepfe termin={d.termin} d={d.mein} antworten={antworten} />
                  )}
                  {tausch && eigener(d) && d.mein.antwort?.art !== 'abgesagt' && (
                    <TauschAmDienst
                      d={eigener(d)!}
                      tausch={tausch}
                      zeitzone={zeitzone}
                      vertretung={vertretung}
                      zugesagt={d.mein.zugesagt}
                    />
                  )}
                </DienstZeile>
              ))}
              {vertretung?.offen.map((g) => (
                <VertretungEingang
                  key={`v${g.personId}-${g.terminId}-${g.dienstId}`}
                  g={g}
                  vertretung={vertretung}
                />
              ))}
              {tausch?.getauscht.map((g) => (
                <TauschGetauscht key={`g${g.id}`} text={g.text} />
              ))}
              {tausch?.eingang.map((e) => (
                <TauschEingang key={`t${e.id}`} e={e} tausch={tausch} zeitzone={zeitzone} />
              ))}
            </ul>
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
              <DienstZeile key={i} d={d} onTermin={onTermin}>
                {tausch && eigener(d) && (
                  <TauschAmDienst
                    d={eigener(d)!}
                    tausch={tausch}
                    zeitzone={zeitzone}
                    vertretung={vertretung}
                    zugesagt
                  />
                )}
              </DienstZeile>
            ))}
            {termine?.art === 'fertig' && u.naechsteDienste.length === 0 && (
              <li className={styles.zeile}>
                <span className={styles.leise}>Keine weiteren zugesagten Dienste.</span>
              </li>
            )}
          </ul>
        </section>

        <section className={styles.karte}>
          <ReiterLink reiter="abwesenheiten" icon="user-slash" titel="Verfügbarkeit">
            {kommendeAbwesenheiten === undefined
              ? 'Sag, wann du kannst – und wann nicht.'
              : kommendeAbwesenheiten > 0
                ? `${kommendeAbwesenheiten} ${kommendeAbwesenheiten === 1 ? 'Abwesenheit' : 'Abwesenheiten'} eingetragen – rechtzeitig Bescheid zu sagen hilft den Planern`
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
              <ReiterLink
                key={gruppe.id}
                reiter="planen"
                adresse={adresseFuerPlanenGruppe(gruppe.id)}
                titel={gruppe.name}
              >
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
            {abfrage &&
              abfragen.planer.map((l) => {
                const etikett = abfrageKartenEtikett(l.abfrage, heute);
                const erinnerung = naechsteErinnerungText(l.inhalt, l.abfrage, heute);
                return (
                  <KlickZeile
                    key={`abfrage-${l.gruppe.id}`}
                    className={styles.linkZeile}
                    onClick={() => setAbfrageOffen(l.gruppe.id)}
                  >
                    <span className={styles.mitte}>
                      <b>{abfrageZeilenTitel({ gruppe: l.gruppe.name, abfrage: l.abfrage })}</b>
                      {erinnerung && <small>{erinnerung}</small>}
                    </span>
                    {etikett && <Etikett ton={etikett.ton}>{etikett.text}</Etikett>}
                  </KlickZeile>
                );
              })}
          </section>
        )}
      </div>
      {abfrage && offeneAbfrage && (
        <AbfrageFensterStart
          plan={planFuerAbfrage}
          gruppe={gruppeImPlan(planFuerAbfrage, offeneAbfrage.gruppe)}
          dienstgruppe={offeneAbfrage.gruppe}
          heute={heute}
          ladeZeitraum={abfrage.ladeZeitraum}
          ladePersonen={abfrage.ladePersonen}
          ladeAntworten={abfrage.ladeAntworten}
          anschluss={abfrage.anschluss}
          onClose={() => setAbfrageOffen(null)}
        />
      )}
      <Toast message={antworten?.meldung ?? tausch?.meldung ?? vertretung?.meldung ?? null} />
    </div>
  );
}

function AlsNaechstes({
  termin: z,
  heute,
  zeitzone,
  onTermin,
  onLive,
}: {
  termin: TerminZeile;
  heute: string;
  zeitzone: string;
  onTermin?: (id: number) => void;
  onLive?: (id: number) => void;
}) {
  const k = kachel(z.tag);
  // Datum und Titel führen in die Termin-Ansicht (Wunsch 8) – wie „Ablauf & Dienste“.
  const oeffnen = onTermin ? () => onTermin(z.id) : undefined;
  // Beiwerk: scheitert es, fehlt die Angabe (`undefined`) – „noch kein Ablauf“ stünde sonst falsch da.
  const liederStand = useLaden(() => ladeLieder(z.id), [z.id]).stand;
  const lieder: string[] | null | undefined =
    liederStand.art === 'fertig' ? liederStand.daten : undefined;
  const musikApp = useMusikApp();
  // „Live-Ansicht“ (Alwin 23.11.2026): am Tag des Termins ab 0 Uhr bis zu seinem Ende – und nur, wenn es einen Ablauf gibt (ohne
  // ihn hat die Live-Ansicht nichts zu zeigen). Dann einmal nachsehen, ob die Live-Agenda gerade läuft (roter Punkt, wie im Termin):
  // beim Öffnen der Seite, kein Takt; scheitert es, fehlt nur der Punkt.
  const liveOffen = !!onLive && liveKnopfOffen(z, new Date(), zeitzone);
  const liveStand = useLaden(async () => {
    if (!liveOffen) return null;
    const ablauf = await ladeAblauf(z.id);
    if (!ablauf || ablauf.id === undefined) return null;
    const laeuft = await ladeLiveLaeuft(z.id, ablauf.id, ablauf.items).catch(() => false);
    return { laeuft };
  }, [z.id, liveOffen]).stand;
  const live = liveStand.art === 'fertig' ? liveStand.daten : null;

  const team = z.team.slice(0, TEAM_ZEIGEN).map((t) => `${t.name} (${t.dienst})`);
  const mehr = z.team.length - team.length;

  return (
    <section className={`${styles.karte} ${styles.held}`} aria-labelledby="als-naechstes">
      <span className={styles.vorzeile}>Als Nächstes · {bisDahin(heute, z.tag)}</span>
      <div className={styles.heldKopf}>
        <KachelLink tag={k.tag} monat={k.monat} onKlick={oeffnen} />
        <div>
          <h2 id="als-naechstes">
            <TitelLink onKlick={oeffnen}>{z.name}</TitelLink>
          </h2>
          <p className={styles.leise}>
            {/* Nur Tag und Beginn – kein Ende (Alwin, 30.10.2026). Ende heißt überall „wann der letzte Punkt vorbei ist“; das
                steht in der Termin-Ansicht, nicht hier. */}
            {tagKurz(z.tag)} · {z.uhrzeit} Uhr
          </p>
        </div>
      </div>
      <div className={styles.tags}>
        {z.meine.length > 0 ? (
          z.meine.map((d, i) => (
            <Plakette key={i} art={plaketteArt(d)} gross>
              Du: <b>{d.dienst}</b> · {plaketteArt(d)}
            </Plakette>
          ))
        ) : (
          <span className={styles.leise}>Du hast an diesem Termin keinen Dienst.</span>
        )}
      </div>
      {(musikApp || onTermin || live) && (
        <div className={styles.knoepfe}>
          {musikApp && (
            // Eigene Zeile am Handy, damit „Ablauf & Dienste“ und „Live“ daneben in einer Reihe stehen (`musikZeile`).
            <div className={styles.musikZeile}>
              <a className={styles.knopf} href={musikApp}>
                <Icon name="music" size={18} /> Musik-App
              </a>
            </div>
          )}
          {onTermin && (
            <KopfKnopf
              onClick={() => onTermin(z.id)}
              label="Ablauf & Dienste"
              symbol={<Icon name="chev-right" size={16} />}
              symbolHinten
              wortAmHandy
            />
          )}
          {live && onLive && (
            // Wie „Live“ im Termin: dasselbe Symbol, der rote Punkt bei laufender Live-Agenda – am Handy mit dem Wort (`wortAmHandy`).
            <KopfKnopf
              onClick={() => onLive(z.id)}
              label="Live"
              title={
                live.laeuft
                  ? 'Live – läuft gerade in ChurchTools'
                  : 'Live-Agenda von ChurchTools folgen'
              }
              symbol={live.laeuft ? <LivePunkt /> : <Icon name="clock" size={16} stroke={2.2} />}
              wortAmHandy
            />
          )}
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

function DienstZeile({
  d,
  abwesend = false,
  onTermin,
  children,
}: {
  d: DienstAmTermin;
  abwesend?: boolean;
  /** Datum und Titel → Termin-Ansicht (Wunsch 8). */
  onTermin?: (id: number) => void;
  /** Unter dem Text – Zusagen/Absagen (E7-1). */
  children?: ReactNode;
}) {
  const k = kachel(d.termin.tag);
  const oeffnen = onTermin ? () => onTermin(d.termin.id) : undefined;
  return (
    <li className={styles.zeile}>
      <KachelLink tag={k.tag} monat={k.monat} onKlick={oeffnen} />
      <div className={styles.mitte}>
        <TitelLink onKlick={oeffnen}>
          <b>
            {d.dienst} · {d.termin.name}
          </b>
        </TitelLink>
        <small>
          {tagKurz(d.termin.tag)} · {d.termin.uhrzeit} Uhr
        </small>
        {abwesend && (
          <small className={styles.warnung}>Du bist an dem Tag als abwesend eingetragen.</small>
        )}
        {children}
      </div>
    </li>
  );
}

function ReiterLink({
  reiter,
  adresse,
  icon,
  titel,
  children,
}: {
  reiter: ReiterId;
  /** Eine genauere Adresse im Reiter – Planen mit einer Gruppe (Wunsch 7). */
  adresse?: string;
  icon?: 'user-slash';
  titel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.linkZeile}
      onClick={() => {
        window.location.hash = adresse ?? adresseFuer(reiter);
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
  // Ein Jahr voraus – in Tagen gerechnet, nicht als Text (am 29.02. gäbe es sonst keinen Tag).
  const s = useLaden(
    () => ladeAbwesenheiten(ichId, heute, plusTage(heute, 365)),
    [ichId, heute],
  ).stand;
  return s.art === 'fertig' ? s.daten : undefined;
}
