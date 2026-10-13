import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { Segment } from '@ui/bedienung/Segment';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { kachel, tagKurz } from '@shared/ct/datum';
import type { Plan, PlanGruppe, PlanPlatz, PlanSpalte } from '@shared/dienstplan/plan';
import { artVon, veranstaltungsArten, WEITERE } from '@shared/dienstplan/termine';
import {
  DIENST_SPALTE,
  passendeAnzahl,
  schritt,
  sichtbar,
  SPALTENBREITE,
  type Breite,
  type Fenster,
  type FensterSchritt,
} from '@shared/dienstplan/fenster';
import { werWieOft } from '@shared/dienstplan/werWieOft';
import type { TermineZustand } from './Termine';
import { leseAnsicht, merkeAnsicht, type PlanenAnsicht } from './planenAnsicht';
import { useBreite } from './useBreite';
import { FilterChips } from './FilterChips';
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
const gruppenName = (g: PlanGruppe) => g.gruppe?.name ?? 'Weitere Dienste';

/** Was die Matrix gerade zeigt – aus Plan, Filtern und Fenster. */
interface Sicht {
  plan: Plan;
  /** Indizes der sichtbaren Spalten in `plan.spalten`. */
  spalten: number[];
  gruppen: PlanGruppe[];
  zugeklappt: Set<string>;
  /** Spalten einer anderen Veranstaltung als der häufigsten – abgesetzt (Entwurf: Gebetsabende). */
  neben: (s: PlanSpalte) => boolean;
  onUmschalten: (k: string) => void;
}

/**
 * **Planen** (Bauplan E3-4/E3-5, Entwurf v17): Termine als Spalten, Dienstgruppen und Dienste als Zeilen,
 * in jeder Zelle die Plätze. Darüber die Terminleiste (‹ ＋ Zeitraum ＋ ›, „passend zur Fensterbreite“),
 * Filter nach Veranstaltung und Gruppe, Spaltenbreite und „Wer wie oft?“. **Nur lesen** – Einteilen kommt
 * mit E4. Am Handy: eine Datumsleiste und darunter ein Termin.
 */
export function Planen({ zustand, handy, onNochmal, onMehr }: Props) {
  const plan = zustand.art === 'fertig' ? zustand.plan : null;
  const [ansicht, setAnsichtRoh] = useState<PlanenAnsicht>(leseAnsicht);
  const setAnsicht = (a: PlanenAnsicht) => {
    setAnsichtRoh(a);
    merkeAnsicht(a);
  };
  const [fenster, setFenster] = useState<Fenster>({ start: 0, anzahl: null });
  const [zu, setZu] = useState<Set<string> | null>(null);
  const [rahmen, platz] = useBreite();

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

  // Filter: Veranstaltungsarten (aus den Terminnamen, wie in der Termine-Liste) und Gruppen.
  const arten = veranstaltungsArten(plan.spalten);
  const haupt = arten[0] !== undefined && arten[0] !== WEITERE ? arten[0] : null;
  const gefiltert = plan.spalten
    .map((_, i) => i)
    .filter((i) => !ansicht.ausgeblendeteArten.includes(artVon(plan.spalten[i], arten)));
  const gruppen = plan.gruppen.filter((g) => !ansicht.ausgeblendeteGruppen.includes(schluessel(g)));

  // Fenster über die gefilterten Termine.
  const passend = passendeAnzahl(platz, ansicht.breite, gefiltert.length);
  const f = sichtbar(fenster, gefiltert.length, passend);
  const imFenster = gefiltert.slice(f.von, f.bis);
  const gehe = (was: FensterSchritt) =>
    setFenster(schritt(fenster, was, gefiltert.length, passend));

  // Vorgabe beim ersten Anzeigen: was man nicht plant, ist zugeklappt.
  const zugeklappt = zu ?? new Set(plan.gruppen.filter((g) => !g.planbar).map(schluessel));
  const umschalten = (k: string) => {
    const neu = new Set(zugeklappt);
    if (neu.has(k)) neu.delete(k);
    else neu.add(k);
    setZu(neu);
  };

  const sicht: Sicht = {
    plan,
    spalten: handy ? gefiltert : imFenster,
    gruppen,
    zugeklappt,
    neben: (s) => haupt !== null && s.name !== haupt,
    onUmschalten: umschalten,
  };

  return (
    <div className={styles.planen}>
      <div className={styles.werkzeug}>
        <Segment
          value={ansicht.unteransicht}
          options={[
            { value: 'matrix', label: 'Matrix' },
            { value: 'personen', label: 'Wer wie oft?' },
          ]}
          onChange={(v) => setAnsicht({ ...ansicht, unteransicht: v })}
          ariaLabel="Ansicht"
        />
        {!handy && (
          <Terminleiste
            plan={plan}
            spalten={imFenster}
            davor={f.davor}
            danach={f.danach}
            festeAnzahl={fenster.anzahl !== null}
            onSchritt={gehe}
          />
        )}
        {!handy && ansicht.unteransicht === 'matrix' && (
          <Segment<Breite>
            value={ansicht.breite}
            options={[
              { value: 's', label: 'S' },
              { value: 'm', label: 'M' },
              { value: 'l', label: 'L' },
            ]}
            onChange={(b) => setAnsicht({ ...ansicht, breite: b })}
            ariaLabel="Spaltenbreite"
          />
        )}
      </div>

      <div className={styles.filter}>
        {arten.length > 1 && (
          <FilterChips
            name="Veranstaltungen"
            optionen={arten.map((art) => ({ wert: art, text: art === WEITERE ? 'Weitere' : art }))}
            aus={ansicht.ausgeblendeteArten}
            onAus={(ausgeblendeteArten) => setAnsicht({ ...ansicht, ausgeblendeteArten })}
          />
        )}
        {plan.gruppen.length > 1 && (
          <FilterChips
            name="Gruppen"
            optionen={plan.gruppen.map((g) => ({ wert: schluessel(g), text: gruppenName(g) }))}
            aus={ansicht.ausgeblendeteGruppen}
            onAus={(ausgeblendeteGruppen) => setAnsicht({ ...ansicht, ausgeblendeteGruppen })}
          />
        )}
      </div>

      <div ref={rahmen}>
        {gefiltert.length === 0 || gruppen.length === 0 ? (
          <section className={styles.karte}>
            <p className={styles.hinweis} style={{ padding: 14 }}>
              Nichts eingeblendet – oben eine Veranstaltung oder Gruppe antippen.
            </p>
          </section>
        ) : ansicht.unteransicht === 'personen' ? (
          <WerWieOft sicht={sicht} />
        ) : handy ? (
          <HandyPlan sicht={sicht} />
        ) : (
          <TabellenPlan sicht={sicht} breite={ansicht.breite} platz={platz} />
        )}
      </div>

      <div className={styles.mehr}>
        <button type="button" className={styles.knopf} onClick={onMehr}>
          Weitere Termine laden
        </button>
      </div>
      <p className={styles.hinweis}>
        Welche Dienste du siehst, entscheidet ChurchTools. Hier stehen nur Dienstgruppen, die du
        ganz sehen darfst – deine eigenen Dienste findest du immer unter Start und Termine. Planen
        darfst du, wo du die Dienstgruppe bearbeiten darfst, die Gruppe eines Dienstes leitest oder
        Admin des Termins bist. Einteilen kommt als Nächstes.
      </p>
    </div>
  );
}

function Terminleiste({
  plan,
  spalten,
  davor,
  danach,
  festeAnzahl,
  onSchritt,
}: {
  plan: Plan;
  spalten: number[];
  davor: boolean;
  danach: boolean;
  festeAnzahl: boolean;
  onSchritt: (was: FensterSchritt) => void;
}) {
  const erster = plan.spalten[spalten[0]];
  const letzter = plan.spalten[spalten[spalten.length - 1]];
  const kurz = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;
  return (
    <div className={styles.leiste} role="group" aria-label="Zeitraum">
      <button
        type="button"
        className={styles.leistenKnopf}
        disabled={!davor}
        aria-label="Einen Termin zurück"
        onClick={() => onSchritt('zurueck')}
      >
        <Icon name="chev-left" size={16} />
      </button>
      <button
        type="button"
        className={styles.leistenKnopf}
        disabled={!davor}
        aria-label="Früheren Termin dazunehmen"
        onClick={() => onSchritt('frueherDazu')}
      >
        <Icon name="plus" size={16} />
      </button>
      <span className={styles.zeitraum}>
        <b>
          {erster && letzter
            ? `${kurz(erster.tag)} – ${kurz(letzter.tag)}${letzter.tag.slice(0, 4)}`
            : '–'}
        </b>
        <small>
          {spalten.length} {spalten.length === 1 ? 'Termin' : 'Termine'}
          {!festeAnzahl && ' · passend zur Fensterbreite'}
        </small>
        {festeAnzahl && (
          <button type="button" className={styles.anpassen} onClick={() => onSchritt('passend')}>
            an Fensterbreite anpassen
          </button>
        )}
      </span>
      <button
        type="button"
        className={styles.leistenKnopf}
        disabled={!danach}
        aria-label="Späteren Termin dazunehmen"
        onClick={() => onSchritt('spaeterDazu')}
      >
        <Icon name="plus" size={16} />
      </button>
      <button
        type="button"
        className={styles.leistenKnopf}
        disabled={!danach}
        aria-label="Einen Termin weiter"
        onClick={() => onSchritt('weiter')}
      >
        <Icon name="chev-right" size={16} />
      </button>
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
      {gruppenName(g)}
      {g.planbar && <span className={styles.duPlanst}>du planst</span>}
    </button>
  );
}

function TabellenPlan({ sicht, breite, platz }: { sicht: Sicht; breite: Breite; platz: number }) {
  const { plan, spalten, gruppen, zugeklappt, neben, onUmschalten } = sicht;
  // Wenige Spalten füllen die Breite (wie im Entwurf), sonst gilt die gewählte Spaltenbreite.
  const cw = Math.max(
    SPALTENBREITE[breite],
    platz > 0 ? Math.floor((platz - DIENST_SPALTE - 2) / Math.max(1, spalten.length)) : 0,
  );
  const zelleKlasse = (s: PlanSpalte) =>
    `${s.abgesagt ? ' ' + styles.abgesagtSpalte : ''}${neben(s) ? ' ' + styles.neben : ''}`;
  return (
    <div className={styles.rahmen}>
      <table className={styles.plan} style={{ ['--cw' as string]: `${cw}px` }}>
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
          {gruppen.map((g) => {
            const k = schluessel(g);
            const offen = !zugeklappt.has(k);
            return [
              <tr key={`g-${k}`} className={styles.gruppe}>
                <th className={styles.svc} style={{ padding: 0 }} scope="row">
                  <GruppenKnopf g={g} offen={offen} onUmschalten={() => onUmschalten(k)} />
                </th>
                {spalten.map((i) => (
                  <td key={i}>
                    <GruppenStand frei={g.frei[i]} />
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
                              <Plaetze plaetze={zelle} />
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

function HandyPlan({ sicht }: { sicht: Sicht }) {
  const { plan, spalten, gruppen, zugeklappt, neben, onUmschalten } = sicht;
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const id =
    gewaehlt !== null && spalten.some((i) => plan.spalten[i].id === gewaehlt) ? gewaehlt : null;
  const i = id === null ? spalten[0] : spalten.find((x) => plan.spalten[x].id === id)!;
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
        </div>
        {gruppen.map((g) => {
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

/** „Wer wie oft?“ – Einsätze je Person im sichtbaren Zeitraum und in den sichtbaren Gruppen. */
function WerWieOft({ sicht }: { sicht: Sicht }) {
  const sichtbar = new Set(sicht.gruppen.map((g) => g.gruppe?.id ?? null));
  const { personen, schnitt } = werWieOft(sicht.plan, {
    spalten: sicht.spalten,
    gruppeSichtbar: (id) => sichtbar.has(id),
  });
  const meiste = Math.max(1, ...personen.map((p) => p.einsaetze.length));
  if (personen.length === 0) {
    return (
      <section className={styles.karte}>
        <p className={styles.hinweis} style={{ padding: 14 }}>
          In diesem Zeitraum ist noch niemand eingeteilt.
        </p>
      </section>
    );
  }
  return (
    <div className={styles.rahmen}>
      <table className={styles.personen}>
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">Dienste</th>
            <th scope="col">Einsätze (Ø {schnitt.toFixed(1).replace('.', ',')})</th>
            <th scope="col">Wann</th>
          </tr>
        </thead>
        <tbody>
          {personen.map((p) => (
            <tr key={`${p.gast ? 'g' : 'p'}${p.name}`}>
              <th scope="row">
                {p.name}
                {p.gast && <span className={styles.gast}>Gast</span>}
              </th>
              <td>
                {p.dienste.map((d) => (
                  <span key={d} className={styles.etikett}>
                    {d}
                  </span>
                ))}
              </td>
              <td>
                <span className={styles.anzahl}>
                  {p.einsaetze.length}
                  <i style={{ width: `${Math.round((p.einsaetze.length / meiste) * 120)}px` }} />
                </span>
              </td>
              <td>
                {p.einsaetze.map((e, i) => (
                  <span key={i} className={styles.etikett}>
                    {tagKurz(e.spalte.tag)} {e.dienst}
                    {!e.zugesagt && ' ?'}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
