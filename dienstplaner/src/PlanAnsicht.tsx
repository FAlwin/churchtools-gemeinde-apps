import { useEffect, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { kachel, tagKurz } from '@shared/ct/datum';
import { gruppenName, type PlanGruppe, type PlanSpalte } from '@shared/dienstplan/plan';
import { DIENST_SPALTE, SPALTENBREITE, type Breite } from '@shared/dienstplan/fenster';
import { CtSymbol } from './CtSymbol';
import { AblaufZeilen, HandyAblauf } from './MatrixAblauf';
import { HandyInfos, InfosZeilen } from './MatrixInfos';
import { schluessel, type Sicht, darfPlanen, nurAnsehen } from './planSicht';
import { Plaetze } from './PlanPlaetze';
import { useBisUnten } from './useBisUnten';
import styles from './Planen.module.scss';

function standText(s: PlanSpalte): { text: string; offen: boolean } {
  if (s.abgesagt) return { text: 'abgesagt', offen: false };
  const frei = s.plaetze - s.besetzt;
  return frei > 0 ? { text: `${frei} frei`, offen: true } : { text: 'alles besetzt', offen: false };
}

function GruppenStand({ frei }: { frei: number | null }) {
  if (frei === null) return <span className={`${styles.gruppenStand} ${styles.nichts}`}>—</span>;
  return frei > 0 ? (
    <span className={styles.gruppenStand}>{frei} frei</span>
  ) : (
    <span className={`${styles.gruppenStand} ${styles.besetzt}`} aria-label="alles besetzt">
      <Icon name="check" size={14} />
    </span>
  );
}

/** Zauberstab (E5-2) – das Symbol aus ChurchTools (`fa-magic`, Alwin 16.10.), nur wo es etwas zu füllen gibt. */
function ZauberKnopf({ onKlick, text }: { onKlick?: () => void; text: string }) {
  if (!onKlick) return null;
  return (
    <button
      type="button"
      className={styles.zauber}
      onClick={onKlick}
      aria-label={text}
      title={text}
    >
      <CtSymbol name="magic" size={14} />
    </button>
  );
}

/** Regler in der Gruppenzeile (E4-5-3, wie im Gesamtentwurf) – nur, wo man einen Dienst der Gruppe plant. */
function ReglerKnopf({ onKlick, text }: { onKlick?: () => void; text: string }) {
  if (!onKlick) return null;
  return (
    <button
      type="button"
      className={styles.regler}
      onClick={onKlick}
      aria-label={text}
      title={text}
    >
      <Icon name="regler" size={14} />
    </button>
  );
}

/**
 * Kopf einer Gruppe: aufklappen, Name – und rechts „nur ansehen“, wo man nicht einteilen darf (Alwin, 16.10.2026:
 * „du planst“ an jeder planbaren Gruppe war unklar und stand je nach Namenslänge woanders). Planbare Gruppen brauchen
 * kein Schild: Dort sind die Plätze antippbar.
 */
function GruppenKnopf({
  g,
  offen,
  onUmschalten,
  nurAnsehen,
}: {
  g: PlanGruppe;
  offen: boolean;
  onUmschalten: () => void;
  nurAnsehen: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.gruppenKnopf}
      aria-expanded={offen}
      onClick={onUmschalten}
    >
      <span className={styles.chev}>
        <Icon name="chev-down" size={16} />
      </span>
      {gruppenName(g)}
      {nurAnsehen && <span className={styles.nurAnsehen}>nur ansehen</span>}
    </button>
  );
}

export function TabellenPlan({ sicht, breite }: { sicht: Sicht; breite: Breite }) {
  const { plan, spalten, gruppen, zugeklappt, neben, onUmschalten } = sicht;
  const bisUnten = useBisUnten();
  // Schmal/breit ist die Spaltenbreite selbst – fest, ohne Strecken (Alwin, 28.10.2026: „S/M kein Unterschied“; seit
  // 29.10.2026 nur noch zwei Breiten). Vorher füllten die Spalten die Breite; dann sahen S und M fast gleich aus.
  // Wie viele Termine ins Fenster passen, rechnet `passendeAnzahl` mit derselben Breite – übrig bleibt höchstens
  // eine Spalte Platz.
  const cw = SPALTENBREITE[breite];
  const zelleKlasse = (s: PlanSpalte) =>
    `${s.abgesagt ? ' ' + styles.abgesagtSpalte : ''}${neben(s) ? ' ' + styles.neben : ''}`;
  return (
    <div className={styles.rahmen} ref={bisUnten.ref} style={bisUnten.style}>
      {/* Feste Breiten: Sonst dehnt der Inhalt die Spalten, und „passend“ passt nicht mehr – dann rutscht
          der erste Termin beim Wischen unter die Dienst-Spalte (Alwin, 14.10.2026). */}
      <table
        className={styles.plan}
        style={{ ['--cw' as string]: `${cw}px`, width: DIENST_SPALTE + spalten.length * cw }}
      >
        <thead>
          <tr>
            <th className={`${styles.svc} ${styles.svcKopf}`} scope="col">
              Dienst
            </th>
            {spalten.map((i) => {
              const s = plan.spalten[i];
              const k = kachel(s.tag);
              const st = standText(s);
              return (
                <th
                  key={s.id}
                  scope="col"
                  className={`${styles.kopf}${zelleKlasse(s)}`}
                  data-neben={neben(s) || undefined}
                >
                  <div className={styles.kopfDatum}>
                    <DatumKachel tag={k.tag} monat={k.monat} />
                    <small>
                      {tagKurz(s.tag).slice(0, 2)} · {s.uhrzeit}
                    </small>
                  </div>
                  {sicht.onTermin ? (
                    <button
                      type="button"
                      className={`${styles.kopfName} ${styles.kopfLink}`}
                      title={`${s.name} öffnen – Ablauf und Dienste`}
                      onClick={() => sicht.onTermin?.(s.id)}
                    >
                      {s.name}
                    </button>
                  ) : (
                    <span className={styles.kopfName} title={s.name}>
                      {s.name}
                    </span>
                  )}
                  <div className={styles.fuellung} aria-hidden="true">
                    <i
                      style={{
                        width: `${s.plaetze ? Math.round((s.besetzt / s.plaetze) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className={`${styles.stand}${st.offen ? ' ' + styles.offen : ''}`}>
                    {st.text}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Der Ablauf steht oben, über den Dienstgruppen (Entwurf E6-6, Alwin 23.10. und 28.10.2026). Darunter ein
              Streifen in der Seitenfarbe und die Überschrift „Dienste“ – sonst sah man nicht, wo der Ablauf endet
              (Alwin, 29.10.2026, Entwurf `e6-6-trennung.html` C; dazu „Ende“ in jeder Spalte). */}
          {/* „Infos & Dateien“ über dem Ablauf (T1b, Entwurf `matrix-infos.html` Variante 2, Alwin 02.11.2026). */}
          {sicht.infos && (
            <InfosZeilen mi={sicht.infos} plan={plan} spalten={spalten} zelleKlasse={zelleKlasse} />
          )}
          {sicht.ablauf && (
            <>
              <AblaufZeilen
                ma={sicht.ablauf}
                plan={plan}
                spalten={spalten}
                zelleKlasse={zelleKlasse}
              />
              <tr className={styles.abschnittAbstand} aria-hidden="true">
                <td colSpan={spalten.length + 1} />
              </tr>
              <tr className={styles.abschnittKopf}>
                <th className={styles.svc} scope="row">
                  Dienste
                </th>
                {spalten.map((i) => (
                  <td key={plan.spalten[i].id} />
                ))}
              </tr>
            </>
          )}
          {gruppen.map((g) => {
            const k = schluessel(g);
            const offen = !zugeklappt.has(k);
            return [
              <tr key={`g-${k}`} className={styles.gruppe}>
                <th className={styles.svc} style={{ padding: 0 }} scope="row">
                  <div className={styles.gruppenKopfZeile}>
                    <GruppenKnopf
                      g={g}
                      offen={offen}
                      onUmschalten={() => onUmschalten(k)}
                      nurAnsehen={nurAnsehen(
                        g,
                        spalten.map((i) => plan.spalten[i]),
                      )}
                    />
                    {spalten.length > 1 && (
                      <ZauberKnopf
                        onKlick={sicht.onZauberstab(spalten, g)}
                        text={`Automatische Planung ${gruppenName(g)} für alle gezeigten Termine`}
                      />
                    )}
                  </div>
                </th>
                {spalten.map((i) => (
                  <td key={i}>
                    <div className={styles.gruppenZelle}>
                      <GruppenStand frei={g.frei[i]} />
                      <span className={styles.gruppenKnoepfe}>
                        <ZauberKnopf
                          onKlick={sicht.onZauberstab([i], g)}
                          text={`Automatische Planung ${gruppenName(g)} am ${tagKurz(plan.spalten[i].tag)}`}
                        />
                        <ReglerKnopf
                          onKlick={sicht.onPlaetze(i, g)}
                          text={`Plätze ${gruppenName(g)} am ${tagKurz(plan.spalten[i].tag)} ändern`}
                        />
                      </span>
                    </div>
                  </td>
                ))}
              </tr>,
              ...(offen
                ? g.zeilen.map((z) => (
                    <tr key={`d-${z.dienst.id}`}>
                      <th className={styles.svc} scope="row">
                        <b>{z.dienst.name}</b>
                      </th>
                      {spalten.map((i) => {
                        const zelle = z.zellen[i];
                        return (
                          <td key={i} className={`${styles.zelle}${zelleKlasse(plan.spalten[i])}`}>
                            {zelle === null ? (
                              <span className={styles.na} aria-label="nicht vorgesehen">
                                –
                              </span>
                            ) : (
                              <Plaetze
                                plaetze={zelle}
                                onFrei={
                                  darfPlanen(z, plan.spalten[i])
                                    ? (nr) => sicht.onFrei(i, z, nr)
                                    : undefined
                                }
                                entwurf={(p) => sicht.entwurf(i, z, p)}
                                ohnePlatz={sicht.ohnePlatz(i, z)}
                                onOhnePlatz={
                                  darfPlanen(z, plan.spalten[i]) && sicht.darfAendern(z)
                                    ? (e) => sicht.onOhnePlatz(i, z, e)
                                    : undefined
                                }
                                onBelegt={
                                  darfPlanen(z, plan.spalten[i])
                                    ? (nr) => sicht.onBelegt(i, z, nr)
                                    : undefined
                                }
                                onEntwurf={
                                  darfPlanen(z, plan.spalten[i]) && sicht.darfAendern(z)
                                    ? (nr) => sicht.onEntwurf(i, z, nr)
                                    : undefined
                                }
                                ichId={sicht.ichId}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                : []),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

export function HandyPlan({ sicht, amEnde }: { sicht: Sicht; amEnde?: () => void }) {
  const { plan, spalten, gruppen, zugeklappt, neben, onUmschalten } = sicht;
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const id =
    gewaehlt !== null && spalten.some((i) => plan.spalten[i].id === gewaehlt) ? gewaehlt : null;
  const i = id === null ? spalten[0] : spalten.find((x) => plan.spalten[x].id === id)!;
  // Letzten Termin der Datumsleiste gewählt → weitere Wochen im Hintergrund nachladen (statt „Weitere
  // Termine laden“, 14.10.2026).
  const amLetzten = spalten.length > 1 && i === spalten[spalten.length - 1];
  useEffect(() => {
    if (amLetzten && amEnde) amEnde();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Erreichen des letzten Termins
  }, [amLetzten]);
  const s = plan.spalten[i];
  const k = kachel(s.tag);
  const st = standText(s);

  return (
    <div>
      <div className={styles.datumsleiste} role="group" aria-label="Termine">
        {spalten.map((x) => {
          const sx = plan.spalten[x];
          const stx = standText(sx);
          return (
            <button
              key={sx.id}
              type="button"
              className={`${styles.datumChip}${neben(sx) ? ' ' + styles.neben : ''}`}
              aria-pressed={sx.id === s.id}
              onClick={() => setGewaehlt(sx.id)}
            >
              <b>{tagKurz(sx.tag)}</b>
              <small>{sx.name}</small>
              <span className={stx.offen ? styles.chipStand : styles.chipBesetzt}>{stx.text}</span>
            </button>
          );
        })}
      </div>
      <section className={styles.karte} aria-label={`${s.name}, ${tagKurz(s.tag)}`}>
        <div className={styles.handyKopf}>
          <DatumKachel tag={k.tag} monat={k.monat} />
          <div>
            <b>{s.name}</b>
            <small>
              {tagKurz(s.tag)} · {s.uhrzeit} Uhr ·{' '}
              <span className={st.offen ? styles.offen : styles.besetzt}>{st.text}</span>
            </small>
          </div>
          {sicht.onTermin && (
            <button
              type="button"
              className={styles.handyOeffnen}
              onClick={() => sicht.onTermin?.(s.id)}
            >
              Ablauf &amp; Dienste <Icon name="chev-right" size={14} />
            </button>
          )}
        </div>
        {sicht.infos && <HandyInfos mi={sicht.infos} s={s} />}
        {sicht.ablauf && <HandyAblauf ma={sicht.ablauf} s={s} />}
        {gruppen.map((g) => {
          const dienste = g.zeilen.filter((z) => z.zellen[i] !== null);
          if (dienste.length === 0) return null;
          const gk = schluessel(g);
          const offen = !zugeklappt.has(gk);
          return (
            <div key={gk} className={styles.handyGruppe}>
              <div className={styles.handyGruppenKopf}>
                <GruppenKnopf
                  g={g}
                  offen={offen}
                  onUmschalten={() => onUmschalten(gk)}
                  nurAnsehen={nurAnsehen(g, [s])}
                />
                <GruppenStand frei={g.frei[i]} />
                <ZauberKnopf
                  onKlick={sicht.onZauberstab([i], g)}
                  text={`Automatische Planung ${gruppenName(g)} am ${tagKurz(s.tag)}`}
                />
                <ReglerKnopf
                  onKlick={sicht.onPlaetze(i, g)}
                  text={`Plätze ${gruppenName(g)} am ${tagKurz(s.tag)} ändern`}
                />
              </div>
              {offen &&
                dienste.map((z) => (
                  <div key={z.dienst.id} className={styles.handyDienst}>
                    <span>{z.dienst.name}</span>
                    <Plaetze
                      plaetze={z.zellen[i]!}
                      onFrei={darfPlanen(z, s) ? (nr) => sicht.onFrei(i, z, nr) : undefined}
                      entwurf={(p) => sicht.entwurf(i, z, p)}
                      ohnePlatz={sicht.ohnePlatz(i, z)}
                      onOhnePlatz={
                        darfPlanen(z, s) && sicht.darfAendern(z)
                          ? (e) => sicht.onOhnePlatz(i, z, e)
                          : undefined
                      }
                      onBelegt={darfPlanen(z, s) ? (nr) => sicht.onBelegt(i, z, nr) : undefined}
                      onEntwurf={
                        darfPlanen(z, s) && sicht.darfAendern(z)
                          ? (nr) => sicht.onEntwurf(i, z, nr)
                          : undefined
                      }
                      ichId={sicht.ichId}
                    />
                  </div>
                ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
