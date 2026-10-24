import { useId, useMemo, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { nameFehler } from '@shared/organigramm/struktur';
import {
  archivieren,
  einhaengen,
  neueEntfernen,
  neueGruppe,
  planZiele,
  umbenennen,
  wieHeute,
  type Heute,
  type PlanAenderungen,
  type PlanGruppe,
  type Ref,
} from '@shared/organigramm/plan';
import type { Start } from './start';
import styles from './GruppenFenster.module.scss';

/** Eine Änderung am Plan – rein, damit sie bei einem Konflikt auf dem neuen Stand wiederholt werden kann. */
export type PlanSchritt = (a: PlanAenderungen) => PlanAenderungen;

interface Gemeinsam {
  start: Start;
  heute: Heute;
  /** Die Farbe einer Gruppe im Plan (bestehende: wie in ChurchTools; neue: nach Typ). */
  farbe: (g: PlanGruppe) => string;
  arbeitet: boolean;
  onAendern: (schritt: PlanSchritt) => void;
  onSchliessen: () => void;
}

/** Die Gruppentypen zum Wählen – der häufigste zuerst (meist „Dienst“), dann nach Namen. */
function typenZurWahl(start: Start): [number, string][] {
  const zahl = new Map<number, number>();
  for (const g of start.gruppen)
    if (g.typId !== null) zahl.set(g.typId, (zahl.get(g.typId) ?? 0) + 1);
  return [...start.typNamen].sort(
    (a, b) => (zahl.get(b[0]) ?? 0) - (zahl.get(a[0]) ?? 0) || a[1].localeCompare(b[1], 'de'),
  );
}

/** Name und Gruppentyp einer neuen Gruppe – ein Formular (Enter legt an); `knopf: null` = der Knopf steht woanders. */
function NameUndTyp({
  formular,
  start,
  typVorgabe,
  knopf,
  arbeitet,
  onAnlegen,
}: {
  formular?: string;
  start: Start;
  typVorgabe: number | null;
  knopf: string | null;
  arbeitet: boolean;
  onAnlegen: (name: string, typId: number) => void;
}) {
  const typen = useMemo(() => typenZurWahl(start), [start]);
  const [name, setName] = useState('');
  const [typ, setTyp] = useState(
    typVorgabe !== null && start.typNamen.has(typVorgabe) ? typVorgabe : (typen[0]?.[0] ?? null),
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const anlegen = () => {
    const f = nameFehler(name);
    if (f || typ === null) return setFehler(f ?? 'Bitte einen Gruppentyp wählen.');
    onAnlegen(name, typ);
  };
  return (
    <form
      id={formular}
      onSubmit={(e) => {
        e.preventDefault();
        if (!arbeitet) anlegen();
      }}
    >
      <label className={styles.beschriftung}>
        Name
        <input
          className={styles.feld}
          value={name}
          placeholder="Name der neuen Gruppe"
          onChange={(e) => {
            setName(e.target.value);
            setFehler(null);
          }}
        />
      </label>
      <label className={styles.beschriftung}>
        Gruppentyp
        <select
          className={styles.feld}
          value={typ ?? ''}
          onChange={(e) => setTyp(Number(e.target.value))}
        >
          {typen.map(([id, n]) => (
            <option key={id} value={id}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {fehler && <p className={styles.fehler}>{fehler}</p>}
      {knopf !== null && (
        <div className={styles.knoepfe}>
          <button type="submit" className={styles.primaer} disabled={arbeitet}>
            {knopf}
          </button>
        </div>
      )}
    </form>
  );
}

/** **Neuer Bereich im Plan** (O7-2): Name und Gruppentyp; die Gruppe gibt es erst nach dem Umbau in ChurchTools. */
export function NeuerBereichFenster({ start, arbeitet, onAendern, onSchliessen }: Gemeinsam) {
  const formular = useId();
  return (
    <Sheet
      title="Neuer Bereich"
      onClose={onSchliessen}
      knoepfe={
        <FensterKnopf type="submit" form={formular} disabled={arbeitet}>
          Im Plan anlegen
        </FensterKnopf>
      }
    >
      <p className={styles.leise}>
        Der Bereich entsteht nur im Plan. In ChurchTools wird er erst angelegt, wenn ihr den Schritt
        im Umbau ausführt.
      </p>
      <NameUndTyp
        formular={formular}
        start={start}
        typVorgabe={null}
        knopf={null}
        arbeitet={arbeitet}
        onAnlegen={(name, typId) => onAendern((a) => neueGruppe(a, name, typId, null).aenderungen)}
      />
    </Sheet>
  );
}

/**
 * **Eine Gruppe im Plan** (Bauplan O7-2, Entwurf `o7-plan-v1`): umbenennen, woanders einhängen, Untergruppe anlegen,
 * archivieren – oder eine neue Gruppe wieder aus dem Plan nehmen; „Wie heute“ nimmt alles zurück. Nur der Plan ändert
 * sich, ChurchTools bleibt, wie es ist. Ziel wählen wie im Gruppenfenster (O5): Liste mit Suche statt Auswahlfeld.
 */
export function PlanFenster({
  start,
  heute,
  plan,
  gruppe: g,
  farbe,
  arbeitet,
  onAendern,
  onSchliessen,
}: Gemeinsam & { plan: readonly PlanGruppe[]; gruppe: PlanGruppe }) {
  const [name, setName] = useState(g.name);
  const [nameFalsch, setNameFalsch] = useState<string | null>(null);
  const [zielWahl, setZielWahl] = useState(false);
  const [suche, setSuche] = useState('');
  const ziele = useMemo(() => planZiele(plan, g.ref), [plan, g.ref]);
  const nameVon = (ref: Ref) => plan.find((x) => x.ref === ref)?.name ?? '';
  const heuteName = (id: number) => heute.gruppen.find((x) => x.id === id)?.name ?? '';
  const id = typeof g.ref === 'number' ? g.ref : null;
  const neuId = typeof g.ref === 'string' ? g.ref : null;
  const s = suche.trim().toLowerCase();
  const treffer = ziele.filter((z) => !s || z.pfad.join(' ').toLowerCase().includes(s));
  const anders = g.heute && (g.heute.name !== g.name || g.heute.eltern !== g.eltern || g.archiv);

  const umbenennenKlick = () => {
    const f = nameFehler(name);
    if (f) return setNameFalsch(f);
    onAendern((a) => umbenennen(heute, a, g.ref, name));
  };

  return (
    <Sheet title={g.name} onClose={onSchliessen} cancelLabel="Schließen" knoepfe={null}>
      <p className={styles.meta}>
        {(g.typId !== null && start.typNamen.get(g.typId)) || 'Gruppe'}
        {g.neu && ' · neu im Plan – gibt es in ChurchTools noch nicht'}
      </p>

      {g.heute && anders && id !== null && (
        <p className={styles.leise}>
          Heute in ChurchTools: „{g.heute.name}“,{' '}
          {g.heute.eltern === null ? 'eigener Bereich' : `unter „${heuteName(g.heute.eltern)}“`}.{' '}
          <button
            type="button"
            className={styles.link}
            disabled={arbeitet}
            onClick={() => onAendern((a) => wieHeute(a, id))}
          >
            Wie heute
          </button>
        </p>
      )}

      <section className={styles.abschnitt} aria-label="Name im Plan">
        <h3>Name im Plan</h3>
        <input
          className={styles.feld}
          value={name}
          aria-label="Name im Plan"
          onChange={(e) => {
            setName(e.target.value);
            setNameFalsch(null);
          }}
        />
        {nameFalsch && <p className={styles.fehler}>{nameFalsch}</p>}
        <div className={styles.knoepfe}>
          <button
            type="button"
            className={styles.zweit}
            disabled={arbeitet || name.trim() === g.name}
            onClick={umbenennenKlick}
          >
            Umbenennen
          </button>
        </div>
      </section>

      <section className={styles.abschnitt} aria-label="Gehört im Plan zu">
        <h3>Gehört im Plan zu</h3>
        <p className={styles.meta}>
          {g.eltern === null ? 'Eigener Bereich' : `„${nameVon(g.eltern)}“`}
        </p>
        {!zielWahl ? (
          <div className={styles.knoepfe}>
            <button type="button" className={styles.zweit} onClick={() => setZielWahl(true)}>
              Woanders einhängen
            </button>
          </div>
        ) : (
          <>
            <input
              className={styles.feld}
              type="search"
              placeholder="Gruppe suchen …"
              aria-label="Gruppe suchen"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              autoFocus
            />
            <ul className={styles.ziele}>
              {g.eltern !== null && !s && (
                <li>
                  <button
                    type="button"
                    className={styles.ziel}
                    disabled={arbeitet}
                    onClick={() => onAendern((a) => einhaengen(heute, a, g.ref, null))}
                  >
                    Eigener Bereich
                  </button>
                </li>
              )}
              {treffer.map((z) => (
                <li key={String(z.gruppe.ref)}>
                  <button
                    type="button"
                    className={styles.ziel}
                    disabled={arbeitet}
                    onClick={() => onAendern((a) => einhaengen(heute, a, g.ref, z.gruppe.ref))}
                  >
                    <GruppenKachel name={z.gruppe.name} farbe={farbe(z.gruppe)} groesse={20} />
                    <span>{z.pfad.join(' › ')}</span>
                  </button>
                </li>
              ))}
            </ul>
            {treffer.length === 0 && s && <p className={styles.leise}>Keine passende Gruppe.</p>}
          </>
        )}
      </section>

      <section className={styles.abschnitt} aria-label="Untergruppe im Plan">
        <h3>Untergruppe im Plan</h3>
        <NameUndTyp
          start={start}
          typVorgabe={g.typId}
          knopf="Im Plan anlegen"
          arbeitet={arbeitet}
          onAnlegen={(n, typId) => onAendern((a) => neueGruppe(a, n, typId, g.ref).aenderungen)}
        />
      </section>

      <section
        className={styles.abschnitt}
        aria-label={g.neu ? 'Aus dem Plan nehmen' : 'Archivieren'}
      >
        <h3>{g.neu ? 'Aus dem Plan nehmen' : 'Archivieren'}</h3>
        <p className={styles.leise}>
          {g.neu
            ? 'Die Gruppe gibt es nur im Plan – sie verschwindet wieder, mit den neuen Gruppen darunter.'
            : 'Die Gruppe bekommt in ChurchTools den Status „archiviert“. Nichts wird gelöscht; Untergruppen hängen vorher woanders ein.'}
        </p>
        <div className={styles.knoepfe}>
          {neuId !== null ? (
            <FensterKnopf
              art="gefahr"
              disabled={arbeitet}
              onClick={() => onAendern((a) => neueEntfernen(heute, a, neuId))}
            >
              Aus dem Plan nehmen
            </FensterKnopf>
          ) : (
            id !== null && (
              <button
                type="button"
                className={styles.zweit}
                disabled={arbeitet}
                onClick={() => onAendern((a) => archivieren(a, id, !g.archiv))}
              >
                {g.archiv ? 'Doch behalten' : 'Im Plan archivieren'}
              </button>
            )
          )}
        </div>
      </section>
    </Sheet>
  );
}
