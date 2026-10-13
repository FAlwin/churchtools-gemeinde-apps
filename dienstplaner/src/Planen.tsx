import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { kachel, tagKurz } from '@shared/ct/datum';
import type { Plan, PlanGruppe, PlanPlatz, PlanSpalte } from '@shared/dienstplan/plan';
import type { TermineZustand } from './Termine';
import styles from './Planen.module.scss';

interface Props {
  zustand: TermineZustand;
  /** Schmaler Bildschirm: ein Termin auf einmal statt der Tabelle (Entwurf v17). */
  handy: boolean;
  onNochmal: () => void;
  onMehr: () => void;
}

/** Schlüssel einer Gruppe – `null` (ohne Dienstgruppe) bekommt einen eigenen. */
const schluessel = (g: PlanGruppe) => (g.gruppe ? String(g.gruppe.id) : 'ohne');

/**
 * **Planen** (Bauplan E3-4, Entwurf v17): Termine als Spalten, Dienstgruppen und Dienste als Zeilen, in
 * jeder Zelle die Plätze (zugesagt, angefragt, frei, Gast). **Nur lesen** – Einteilen, Zauberstab und
 * Plätze ändern kommen mit E4/E5. Gruppen, die man plant, sind aufgeklappt, die übrigen zu.
 * Am Handy: eine Datumsleiste und darunter ein Termin.
 */
export function Planen({ zustand, handy, onNochmal, onMehr }: Props) {
  const plan = zustand.art === 'fertig' ? zustand.plan : null;
  const [zu, setZu] = useState<Set<string> | null>(null);
  // Vorgabe beim ersten Anzeigen: was man nicht plant, ist zugeklappt.
  const zugeklappt = zu ?? new Set(plan?.gruppen.filter((g) => !g.planbar).map(schluessel) ?? []);
  const umschalten = (k: string) => {
    const neu = new Set(zugeklappt);
    if (neu.has(k)) neu.delete(k);
    else neu.add(k);
    setZu(neu);
  };

  if (zustand.art === 'laedt') return <p className={styles.hinweis}>Termine werden geladen …</p>;
  if (zustand.art === 'fehler')
    return <FehlerKasten fehler={zustand.fehler} onNochmal={onNochmal} />;
  if (!plan || plan.spalten.length === 0) {
    return (
      <section className={styles.karte}>
        <p className={styles.hinweis} style={{ padding: 14 }}>
          In den nächsten {zustand.wochen} Wochen stehen keine Termine an.
        </p>
      </section>
    );
  }

  return (
    <div>
      {handy ? (
        <HandyPlan plan={plan} zugeklappt={zugeklappt} onUmschalten={umschalten} />
      ) : (
        <TabellenPlan plan={plan} zugeklappt={zugeklappt} onUmschalten={umschalten} />
      )}
      <div className={styles.mehr}>
        <button type="button" className={styles.knopf} onClick={onMehr}>
          Weitere Termine laden
        </button>
      </div>
      <p className={styles.hinweis}>
        Welche Dienste du siehst, entscheidet ChurchTools. Planen darfst du, wo du die Dienstgruppe
        bearbeiten darfst, die Gruppe eines Dienstes leitest oder Admin des Termins bist. Einteilen
        kommt als Nächstes.
      </p>
    </div>
  );
}

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

function GruppenKnopf({
  g,
  offen,
  onUmschalten,
}: {
  g: PlanGruppe;
  offen: boolean;
  onUmschalten: () => void;
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
      {g.gruppe?.name ?? 'Weitere Dienste'}
      {g.planbar && <span className={styles.duPlanst}>du planst</span>}
    </button>
  );
}

function TabellenPlan({
  plan,
  zugeklappt,
  onUmschalten,
}: {
  plan: Plan;
  zugeklappt: Set<string>;
  onUmschalten: (k: string) => void;
}) {
  return (
    <div className={styles.rahmen}>
      <table className={styles.plan}>
        <thead>
          <tr>
            <th className={`${styles.svc} ${styles.svcKopf}`} scope="col">
              Dienst
            </th>
            {plan.spalten.map((s) => {
              const k = kachel(s.tag);
              const st = standText(s);
              return (
                <th
                  key={s.id}
                  scope="col"
                  className={`${styles.kopf}${s.abgesagt ? ' ' + styles.abgesagtSpalte : ''}`}
                >
                  <div className={styles.kopfDatum}>
                    <DatumKachel tag={k.tag} monat={k.monat} />
                    <small>
                      {tagKurz(s.tag).slice(0, 2)} · {s.uhrzeit}
                    </small>
                  </div>
                  <span className={styles.kopfName} title={s.name}>
                    {s.name}
                  </span>
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
          {plan.gruppen.map((g) => {
            const k = schluessel(g);
            const offen = !zugeklappt.has(k);
            return [
              <tr key={`g-${k}`} className={styles.gruppe}>
                <th className={styles.svc} style={{ padding: 0 }} scope="row">
                  <GruppenKnopf g={g} offen={offen} onUmschalten={() => onUmschalten(k)} />
                </th>
                {g.frei.map((f, i) => (
                  <td key={i}>
                    <GruppenStand frei={f} />
                  </td>
                ))}
              </tr>,
              ...(offen
                ? g.zeilen.map((z) => (
                    <tr key={`d-${z.dienst.id}`}>
                      <th className={styles.svc} scope="row">
                        <b>{z.dienst.name}</b>
                      </th>
                      {z.zellen.map((zelle, i) => (
                        <td key={i} className={styles.zelle}>
                          {zelle === null ? (
                            <span className={styles.na} aria-label="nicht vorgesehen">
                              –
                            </span>
                          ) : (
                            <Plaetze plaetze={zelle} />
                          )}
                        </td>
                      ))}
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

function HandyPlan({
  plan,
  zugeklappt,
  onUmschalten,
}: {
  plan: Plan;
  zugeklappt: Set<string>;
  onUmschalten: (k: string) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState(plan.spalten[0].id);
  const i = Math.max(
    0,
    plan.spalten.findIndex((s) => s.id === gewaehlt),
  );
  const s = plan.spalten[i];
  const k = kachel(s.tag);
  const st = standText(s);

  return (
    <div>
      <div className={styles.datumsleiste} role="group" aria-label="Termine">
        {plan.spalten.map((x) => {
          const sx = standText(x);
          return (
            <button
              key={x.id}
              type="button"
              className={styles.datumChip}
              aria-pressed={x.id === s.id}
              onClick={() => setGewaehlt(x.id)}
            >
              <b>{tagKurz(x.tag)}</b>
              <small>{x.name}</small>
              <span className={sx.offen ? styles.chipStand : styles.chipBesetzt}>{sx.text}</span>
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
        </div>
        {plan.gruppen.map((g) => {
          const dienste = g.zeilen.filter((z) => z.zellen[i] !== null);
          if (dienste.length === 0) return null;
          const gk = schluessel(g);
          const offen = !zugeklappt.has(gk);
          return (
            <div key={gk} className={styles.handyGruppe}>
              <div className={styles.handyGruppenKopf}>
                <GruppenKnopf g={g} offen={offen} onUmschalten={() => onUmschalten(gk)} />
                <GruppenStand frei={g.frei[i]} />
              </div>
              {offen &&
                dienste.map((z) => (
                  <div key={z.dienst.id} className={styles.handyDienst}>
                    <span>{z.dienst.name}</span>
                    <Plaetze plaetze={z.zellen[i]!} />
                  </div>
                ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Plaetze({ plaetze }: { plaetze: PlanPlatz[] }) {
  return (
    <div className={styles.plaetze}>
      {plaetze.map((p, i) => (
        <Platz key={i} p={p} />
      ))}
    </div>
  );
}

/** Ein Platz – zugesagt (Haken), angefragt („?“), frei, verborgen oder Gast. */
function Platz({ p }: { p: PlanPlatz }) {
  if (p.art === 'frei') return <span className={`${styles.platz} ${styles.frei}`}>frei</span>;
  return (
    <span
      className={`${styles.platz} ${styles[p.art]}${p.ich ? ' ' + styles.ich : ''}`}
      title={p.art === 'zugesagt' ? 'zugesagt' : 'angefragt'}
    >
      <span className={styles.ic} aria-label={p.art}>
        {p.art === 'zugesagt' ? <Icon name="check" size={11} /> : '?'}
      </span>
      {p.verborgen ? (
        <span className={`${styles.name} ${styles.leise}`}>Nicht sichtbar</span>
      ) : (
        <span className={styles.name}>{p.name}</span>
      )}
      {p.gast && <span className={styles.gast}>Gast</span>}
    </span>
  );
}
