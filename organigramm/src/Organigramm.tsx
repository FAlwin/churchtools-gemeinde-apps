import { useMemo, type ReactNode } from 'react';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { Icon } from '@ui/icons/icons';
import { gruppenFarbe, sichtFarbe } from '@shared/organigramm/farbe';
import type { Knoten } from '@shared/organigramm/gruppen';
import { knotenAmPfad, spitzenWahl, type SichtKnoten } from '@shared/organigramm/ansichten';
import { Segment } from '@ui/bedienung/Segment';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { rollenRang } from '@shared/organigramm/mitglieder';
import {
  gruppenLeitung,
  teilbaumPersonen,
  type Mitglied,
  type PersonenWahl,
} from '@shared/organigramm/personen';
import { offenVonGruppe, type Einsaetze } from '@shared/organigramm/einsaetze';
import type { MitgliederDaten, MitgliederStand } from './ladeMitglieder';
import type { Start } from './start';
import { ANSICHT_NAMEN, BAUM_ANSICHTEN, PERSONEN_WAHL, type BaumAnsicht } from './auswahl';
import { personenInhalt } from './kastenPersonen';
import { Liste } from './Liste';
import { Diagramm } from './Diagramm';
import styles from './Organigramm.module.scss';

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;
const ANSICHTEN = BAUM_ANSICHTEN.map((a) => ({ value: a, label: ANSICHT_NAMEN[a] }));

interface Props {
  start: Start;
  /** `null`, solange die Mitglieder laden. */
  mitglieder: MitgliederDaten | null;
  /** Einsätze und offene Plätze (O3) – `null`, solange sie laden oder wenn sie gerade nicht ladbar sind. */
  einsaetze: Einsaetze | null;
  /** Lesbare Mitglieder je Gruppe – dieselbe Grundlage wie Personen, Hinweise und Präsentation. */
  lesbar: ReadonlyMap<number, readonly Mitglied[]>;
  /** Ausgeblendete Gruppentypen – liegen in `App`, weil die Präsentation dieselben ausblendet (O4). */
  ausgeblendet: ReadonlySet<number>;
  /** Der Baum ohne ausgeblendete Typen, große Bereiche zuerst – EINE Rechnung in `App` für Karten, Liste und Fenster. */
  baum: readonly Knoten[];
  /** Ansicht, Spitze und was aufgeklappt ist (O7b-2) – liegt in `App`, weil das Gruppenfenster „Hier anfangen“ kann. */
  ansicht: BaumAnsicht;
  onAnsicht: (a: BaumAnsicht) => void;
  /** Personen in Diagramm und Liste (O7b-6) – je Gerät gemerkt, liegt in `App`. */
  personen: PersonenWahl;
  onPersonen: (w: PersonenWahl) => void;
  /** Pfad der Spitze – `null` = ganze Gemeinde. Eine verschwundene Spitze setzt `App` zurück. */
  spitze: string | null;
  onSpitze: (pfad: string | null) => void;
  /** Was die Liste zeigt (ab der Spitze, auf- und zugeklappt). */
  sicht: SichtKnoten;
  onUmklappen: (schluessel: string) => void;
  onAlleAuf: () => void;
  onAlleZu: () => void;
  onTypUmschalten: (typ: number) => void;
  onNachladen: () => void;
  onGruppe: (id: number) => void;
}

/**
 * **Das Organigramm** (Bauplan O2): je Bereich (oberste Gruppe) eine Karte, darin die Gruppen als Zeilen mit
 * Baumlinien – in der Farbe der Gruppe, mit Leitung, Zahl der Personen und den Diensten der Gruppe. Über dem Baum
 * lassen sich Gruppentypen ausblenden (z. B. Verteiler). Klick auf eine Gruppe → Gruppenfenster.
 */
export function Organigramm({
  start,
  mitglieder,
  einsaetze,
  lesbar,
  ausgeblendet,
  baum,
  ansicht,
  onAnsicht,
  personen,
  onPersonen,
  spitze,
  onSpitze,
  sicht,
  onUmklappen,
  onAlleAuf,
  onAlleZu,
  onTypUmschalten,
  onNachladen,
  onGruppe,
}: Props) {
  const rang = useMemo(() => rollenRang(start.rollen), [start.rollen]);
  const farbe = useMemo(() => sichtFarbe(start.typFarben), [start.typFarben]);
  // Was unter dem Namen steht – EINE Regel für Diagramm und Liste. Neu nur, wenn sich Wahl oder Mitglieder ändern: Das
  // Diagramm misst dann alle Kästchen neu.
  const inhalt = useMemo(
    () => personenInhalt(mitglieder, start.rollen, personen),
    [mitglieder, personen, start.rollen],
  );
  const name = (id: number) => mitglieder?.personen.get(id)?.name ?? '';
  // Karten ab der Spitze: ein Bereich (oder eine Gruppe) allein – sonst alle Bereiche wie bisher.
  const spitzenKnoten = spitze === null ? null : knotenAmPfad(baum, spitze);
  const karten = spitzenKnoten ? [spitzenKnoten] : baum;

  // Gruppentypen, die es gibt – mit Zahl, für den Filter.
  const typen = useMemo(() => {
    const zahl = new Map<number, number>();
    for (const g of start.gruppen)
      if (g.typId !== null) zahl.set(g.typId, (zahl.get(g.typId) ?? 0) + 1);
    return [...zahl].sort((a, b) => b[1] - a[1]);
  }, [start.gruppen]);

  const stand = (id: number): MitgliederStand | undefined => mitglieder?.je.get(id);
  const sichtbare = (id: number): readonly Mitglied[] => lesbar.get(id) ?? [];
  const leitung = (id: number) => gruppenLeitung(sichtbare(id), start.rollen, name, rang);
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
      <div className={styles.oben}>
        <Segment
          value={ansicht}
          options={ANSICHTEN}
          onChange={onAnsicht}
          ariaLabel="Ansicht"
          className={styles.ansicht}
          verbunden
        />
        <label className={styles.anfangen}>
          Anfangen bei
          <select
            className={styles.feld}
            value={spitze ?? ''}
            onChange={(e) => onSpitze(e.target.value || null)}
          >
            {spitzenWahl(baum, spitze).map((w) => (
              <option key={w.wert} value={w.wert}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        {/* „Präsentieren“ steht im Seitenkopf (App) – hier hätte die Leiste bei 1280 px nicht mehr in eine Zeile gepasst
            (Alwin, 28.10.2026: Variante B). */}
        {ansicht !== 'karten' && (
          <span className={styles.rechts}>
            <KopfKnopf
              label="Alle aufklappen"
              symbol={<Icon name="chev-down" size={16} />}
              onClick={onAlleAuf}
            />
            <KopfKnopf
              label="Alle zuklappen"
              symbol={<Icon name="chev-right" size={16} />}
              onClick={onAlleZu}
            />
          </span>
        )}
      </div>
      {/* Was zu sehen ist: Gruppentypen (je Gerät) und – in Diagramm und Liste – die Personen (O7b-6). In der Leiste oben
          hätte „Personen“ die Zeile bei 1280 px gesprengt. */}
      {(typen.length > 1 || ansicht !== 'karten') && (
        <div className={styles.wasZeigen}>
          {typen.length > 1 && (
            <div className={styles.filter} role="group" aria-label="Gruppentypen">
              {typen.map(([typ, n]) => (
                <button
                  key={typ}
                  type="button"
                  className={styles.typ}
                  aria-pressed={!ausgeblendet.has(typ)}
                  onClick={() => onTypUmschalten(typ)}
                >
                  {start.typNamen.get(typ) ?? `Typ ${typ}`} <span className={styles.zahl}>{n}</span>
                </button>
              ))}
            </div>
          )}
          {ansicht !== 'karten' && (
            <span className={`${styles.anfangen} ${styles.personen}`}>
              Personen
              <Segment
                value={personen}
                options={PERSONEN_WAHL}
                onChange={onPersonen}
                ariaLabel="Personen"
                verbunden
              />
            </span>
          )}
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

      {ansicht === 'liste' && baum.length > 0 && (
        <Liste
          sicht={sicht}
          onUmklappen={onUmklappen}
          onGruppe={onGruppe}
          farbe={farbe}
          inhalt={inhalt}
        />
      )}

      {(ansicht === 'oben' || ansicht === 'links' || ansicht === 'mindmap') && baum.length > 0 && (
        <Diagramm
          art={ansicht}
          sicht={sicht}
          onUmklappen={onUmklappen}
          onGruppe={onGruppe}
          farbe={farbe}
          personen={{ wahl: personen, inhalt }}
        />
      )}

      {ansicht === 'karten' && (
        <div className={styles.bereiche}>
          {karten.map((b) => {
            const l = leitung(b.gruppe.id);
            const personen = mitglieder ? teilbaumPersonen(b, lesbar, name, rang).length : null;
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
                        <PersonBild
                          key={p.id}
                          name={p.name}
                          bild={p.bild}
                          initialen={p.initialen}
                        />
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
      )}
    </div>
  );
}
