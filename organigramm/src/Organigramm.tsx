import { useMemo, useState, type ReactNode } from 'react';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { gruppenFarbe } from '@shared/organigramm/farbe';
import { baumOhneTypen, nachfahren, type Knoten } from '@shared/organigramm/gruppen';
import { istLeitung, rollenRang } from '@shared/organigramm/mitglieder';
import { gruppenPersonen, teilbaumPersonen, type Mitglied } from '@shared/organigramm/personen';
import { offenVonGruppe, type Einsaetze } from '@shared/organigramm/einsaetze';
import type { MitgliederDaten, MitgliederStand } from './ladeMitglieder';
import { leseAusgeblendet, merkeAusgeblendet } from './auswahl';
import type { Start } from './start';
import styles from './Organigramm.module.scss';

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

interface Props {
  start: Start;
  /** `null`, solange die Mitglieder laden. */
  mitglieder: MitgliederDaten | null;
  /** Einsätze und offene Plätze (O3) – `null`, solange sie laden oder wenn sie gerade nicht ladbar sind. */
  einsaetze: Einsaetze | null;
  onNachladen: () => void;
  onGruppe: (id: number) => void;
}

/**
 * **Das Organigramm** (Bauplan O2): je Bereich (oberste Gruppe) eine Karte, darin die Gruppen als Zeilen mit
 * Baumlinien – in der Farbe der Gruppe, mit Leitung, Zahl der Personen und den Diensten der Gruppe. Über dem Baum
 * lassen sich Gruppentypen ausblenden (z. B. Verteiler). Klick auf eine Gruppe → Gruppenfenster.
 */
export function Organigramm({ start, mitglieder, einsaetze, onNachladen, onGruppe }: Props) {
  const [ausgeblendet, setAusgeblendet] = useState(leseAusgeblendet);
  const rang = useMemo(() => rollenRang(start.rollen), [start.rollen]);
  const name = (id: number) => mitglieder?.personen.get(id)?.name ?? '';
  // Große Bereiche zuerst (die meisten Gruppen darunter), dann nach Name – wie im abgenommenen Entwurf.
  const baum = useMemo(
    () =>
      baumOhneTypen(start.baum, ausgeblendet).sort(
        (a, b) =>
          nachfahren(b).length - nachfahren(a).length ||
          a.gruppe.name.localeCompare(b.gruppe.name, 'de'),
      ),
    [start.baum, ausgeblendet],
  );

  // Gruppentypen, die es gibt – mit Zahl, für den Filter.
  const typen = useMemo(() => {
    const zahl = new Map<number, number>();
    for (const g of start.gruppen)
      if (g.typId !== null) zahl.set(g.typId, (zahl.get(g.typId) ?? 0) + 1);
    return [...zahl].sort((a, b) => b[1] - a[1]);
  }, [start.gruppen]);
  const umschalten = (typ: number) => {
    const neu = new Set(ausgeblendet);
    if (neu.has(typ)) neu.delete(typ);
    else neu.add(typ);
    merkeAusgeblendet(neu);
    setAusgeblendet(neu);
  };

  const stand = (id: number): MitgliederStand | undefined => mitglieder?.je.get(id);
  const sichtbare = (id: number): Mitglied[] => {
    const s = stand(id);
    return s?.art === 'sichtbar' ? s.mitglieder : [];
  };
  const mitgliederMap = useMemo(() => {
    const m = new Map<number, Mitglied[]>();
    for (const [id, s] of mitglieder?.je ?? []) if (s.art === 'sichtbar') m.set(id, s.mitglieder);
    return m;
  }, [mitglieder]);
  const leitung = (id: number) =>
    gruppenPersonen(sichtbare(id), name, rang).filter((m) => istLeitung(start.rollen, m.rolleId));
  const dienste = (id: number) =>
    start.dienste ? [...start.dienste.values()].filter((d) => d.gruppenIds.includes(id)) : [];
  const offen = (id: number) =>
    einsaetze ? offenVonGruppe(start.dienste, einsaetze.offenJeDienst, id) : 0;
  const fehlerZahl = mitglieder
    ? [...mitglieder.je.values()].filter((s) => s.art === 'fehler').length
    : 0;

  const meta = (k: Knoten) => {
    const s = stand(k.gruppe.id);
    if (!mitglieder) return 'Mitglieder werden geladen …';
    if (s?.art === 'verborgen') return 'Mitglieder nicht sichtbar';
    if (s?.art === 'fehler') return 'Mitglieder gerade nicht ladbar';
    const n = sichtbare(k.gruppe.id).length;
    const l = leitung(k.gruppe.id);
    const teile = [n ? anzahl(n, 'Person', 'Personen') : 'keine Mitglieder sichtbar'];
    if (l.length) teile.push('Leitung: ' + l.map((m) => name(m.personId)).join(', '));
    return teile.join(' · ');
  };

  const zeile = (k: Knoten, ebene: number): ReactNode => (
    <li key={`${k.gruppe.id}-${ebene}`}>
      <button type="button" className={styles.zeile} onClick={() => onGruppe(k.gruppe.id)}>
        <GruppenKachel name={k.gruppe.name} farbe={gruppenFarbe(k.gruppe, start.typFarben)} />
        <span className={styles.text}>
          <b>{k.gruppe.name}</b>
          <span className={styles.meta}>{meta(k)}</span>
        </span>
        <span className={styles.dienste}>
          {dienste(k.gruppe.id).map((d) => (
            <span key={d.id} className={styles.dienst}>
              {d.name}
            </span>
          ))}
          {offen(k.gruppe.id) > 0 && (
            <span className={styles.offen} title="Freie Plätze in den nächsten 3 Monaten">
              {offen(k.gruppe.id)} offen
            </span>
          )}
        </span>
      </button>
      {k.kinder.length > 0 && (
        <ul className={styles.zeilen}>{k.kinder.map((c) => zeile(c, ebene + 1))}</ul>
      )}
    </li>
  );

  return (
    <div className={styles.seite}>
      {typen.length > 1 && (
        <div className={styles.filter} role="group" aria-label="Gruppentypen">
          {typen.map(([typ, n]) => (
            <button
              key={typ}
              type="button"
              className={styles.typ}
              aria-pressed={!ausgeblendet.has(typ)}
              onClick={() => umschalten(typ)}
            >
              {start.typNamen.get(typ) ?? `Typ ${typ}`} <span className={styles.zahl}>{n}</span>
            </button>
          ))}
        </div>
      )}

      {fehlerZahl > 0 && (
        <div className={styles.hinweis} role="status">
          Bei {anzahl(fehlerZahl, 'Gruppe', 'Gruppen')} ließen sich die Mitglieder gerade nicht
          laden.
          <button type="button" className={styles.nochmal} onClick={onNachladen}>
            Erneut versuchen
          </button>
        </div>
      )}

      {baum.length === 0 && <p className={styles.leer}>Hier ist keine Gruppe zu sehen.</p>}

      <div className={styles.bereiche}>
        {baum.map((b) => {
          const l = leitung(b.gruppe.id);
          const personen = mitglieder
            ? teilbaumPersonen(b, mitgliederMap, name, rang).length
            : null;
          return (
            <section key={b.gruppe.id} className={styles.karte} aria-label={b.gruppe.name}>
              <button type="button" className={styles.kopf} onClick={() => onGruppe(b.gruppe.id)}>
                <GruppenKachel
                  name={b.gruppe.name}
                  farbe={gruppenFarbe(b.gruppe, start.typFarben)}
                  groesse={40}
                />
                <span className={styles.text}>
                  <b className={styles.bereichName}>{b.gruppe.name}</b>
                  <span className={styles.meta}>
                    {[
                      b.kinder.length ? anzahl(b.kinder.length, 'Gruppe', 'Gruppen') : null,
                      personen === null
                        ? null
                        : personen
                          ? anzahl(personen, 'Person', 'Personen')
                          : null,
                      l.length ? 'Leitung: ' + l.map((m) => name(m.personId)).join(', ') : null,
                      // Der Bereich selbst nicht lesbar oder gerade nicht ladbar → hier sagen, nicht nur oben.
                      stand(b.gruppe.id)?.art === 'verborgen' ||
                      stand(b.gruppe.id)?.art === 'fehler'
                        ? meta(b)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || meta(b)}
                  </span>
                </span>
                <span className={styles.bilder}>
                  {l.map((m) => {
                    const p = mitglieder?.personen.get(m.personId);
                    return p ? (
                      <PersonBild key={p.id} name={p.name} bild={p.bild} initialen={p.initialen} />
                    ) : null;
                  })}
                </span>
              </button>
              {b.kinder.length > 0 ? (
                <ul className={styles.zeilen}>{b.kinder.map((k) => zeile(k, 1))}</ul>
              ) : (
                <p className={styles.keine}>Keine Untergruppen.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
