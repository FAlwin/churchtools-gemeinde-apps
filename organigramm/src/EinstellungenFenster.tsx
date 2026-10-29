import { useMemo, useState, type ReactNode } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import type { Versioniert } from '@shared/ct/versionierterWert';
import type { Knoten } from '@shared/organigramm/gruppen';
import { ALLES_SICHTBAR, type Sichtbarkeit } from '@shared/organigramm/sichtbarkeit';
import { speichereSichtbarkeit } from './sichtbarkeitSpeicher';
import { planFehlerText, type Gespeichertes } from './planTexte';
import type { Start } from './start';
import fenster from './GruppenFenster.module.scss';
import styles from './EinstellungenFenster.module.scss';

const SICHTBAR: Gespeichertes = {
  akk: 'die Einstellung',
  alt: 'die alte Einstellung',
  kategorie: 'Was das Organigramm zeigt',
};

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

interface Props {
  start: Start;
  /** Was jetzt gilt – `null`, wenn noch nie gespeichert. */
  stand: Versioniert<Sichtbarkeit> | null;
  /** Nach dem Speichern – oder bei einem Konflikt mit dem, was jetzt dasteht. */
  onStand: (stand: Versioniert<Sichtbarkeit> | null) => void;
  onSchliessen: () => void;
}

/**
 * **Was das Organigramm zeigt** (Bauplan O7b-7, Entwurf `o7b-6-7-v1.html`, entschieden 29.10.2026) – nur für
 * Gruppen-Admins: Gruppentypen und einzelne Gruppen für **alle** ausblenden, im Reiter, in der Präsentation und in der
 * PDF. Eine ausgeblendete Gruppe nimmt ihre Untergruppen mit (die stehen dann ausgegraut da). Die Typ-Schildchen über
 * dem Baum bleiben zusätzlich – sie gelten nur im eigenen Gerät. Hat inzwischen ein anderer gespeichert, wird nichts
 * überschrieben: Das Fenster zeigt dann dessen Stand.
 */
export function EinstellungenFenster({ start, stand, onStand, onSchliessen }: Props) {
  const anfang = stand?.inhalt ?? ALLES_SICHTBAR;
  const [typen, setTypen] = useState(() => new Set(anfang.typen));
  const [gruppen, setGruppen] = useState(() => new Set(anfang.gruppen));
  const [basis, setBasis] = useState(stand);
  const [suche, setSuche] = useState('');
  const [arbeitet, setArbeitet] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Gruppentypen, die es gibt – mit Zahl, die größten zuerst (wie die Schildchen über dem Baum).
  const typZahlen = useMemo(() => {
    const zahl = new Map<number, number>();
    for (const g of start.gruppen)
      if (g.typId !== null) zahl.set(g.typId, (zahl.get(g.typId) ?? 0) + 1);
    return [...zahl].sort((a, b) => b[1] - a[1]);
  }, [start.gruppen]);

  const umschalten = (menge: Set<number>, id: number) => {
    const neu = new Set(menge);
    if (!neu.delete(id)) neu.add(id);
    return neu;
  };

  const such = suche.trim().toLocaleLowerCase('de');
  const passt = (k: Knoten): boolean =>
    !such || k.gruppe.name.toLocaleLowerCase('de').includes(such) || k.kinder.some(passt);

  const zweig = (k: Knoten, pfad: string, obenAus: boolean): ReactNode => {
    if (!passt(k)) return null;
    const typAus = k.gruppe.typId !== null && typen.has(k.gruppe.typId);
    const selbstAus = gruppen.has(k.gruppe.id);
    const aus = obenAus || typAus || selbstAus;
    const typName = k.gruppe.typId === null ? null : start.typNamen.get(k.gruppe.typId);
    const warum = typAus ? 'Typ ausgeblendet' : obenAus ? 'mit der Obergruppe' : null;
    return (
      <li key={pfad} className={aus ? styles.aus : undefined}>
        <label>
          <input
            type="checkbox"
            checked={!aus}
            disabled={obenAus || typAus}
            onChange={() => setGruppen((g) => umschalten(g, k.gruppe.id))}
          />
          {k.gruppe.name}
          <small>{[typName, warum].filter(Boolean).join(' – ')}</small>
        </label>
        {k.kinder.length > 0 && (
          <ul>{k.kinder.map((c) => zweig(c, `${pfad}/${c.gruppe.id}`, aus))}</ul>
        )}
      </li>
    );
  };

  const n = typen.size + gruppen.size;
  const zusammenfassung = n
    ? [
        typen.size ? anzahl(typen.size, 'Gruppentyp', 'Gruppentypen') : '',
        gruppen.size ? anzahl(gruppen.size, 'Gruppe', 'Gruppen') : '',
      ]
        .filter(Boolean)
        .join(' und ') + ' ausgeblendet'
    : 'Alles sichtbar';

  const speichern = async () => {
    setArbeitet(true);
    setProblem(null);
    try {
      const neu: Sichtbarkeit = {
        typen: [...typen].sort((a, b) => a - b),
        gruppen: [...gruppen].sort((a, b) => a - b),
      };
      const r = await speichereSichtbarkeit(
        neu,
        { personId: start.ichId, name: start.vorname },
        basis?.version ?? null,
      );
      if (r.ok) {
        onStand(r.daten);
        onSchliessen();
        return;
      }
      if (r.grund === 'konflikt' && r.jetzt !== undefined) {
        // Nichts überschreiben: Was jetzt dasteht, gilt – und steht im Fenster.
        const jetzt = r.jetzt;
        onStand(jetzt);
        setBasis(jetzt);
        setTypen(new Set(jetzt?.inhalt.typen ?? []));
        setGruppen(new Set(jetzt?.inhalt.gruppen ?? []));
        setProblem(
          `${jetzt?.von.name ?? 'Ein anderer'} hat das inzwischen geändert – nichts überschrieben. Hier steht jetzt der neue Stand.`,
        );
        return;
      }
      if (r.jetzt !== undefined) {
        onStand(r.jetzt);
        setBasis(r.jetzt);
      }
      setProblem(planFehlerText(r.grund, SICHTBAR));
    } catch (e) {
      // Modul oder Kategorie nicht erreichbar – nichts geschrieben, die Auswahl bleibt.
      setProblem(fehlerMeldung(e).text);
    } finally {
      setArbeitet(false);
    }
  };

  return (
    <Sheet
      title="Was das Organigramm zeigt"
      onClose={onSchliessen}
      mittel
      beschaeftigt={arbeitet}
      links={<span className={fenster.leise}>{zusammenfassung}</span>}
      knoepfe={
        <FensterKnopf disabled={arbeitet} onClick={() => void speichern()}>
          {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      <p className={fenster.leise}>
        Gilt für <b>alle</b>, die das Organigramm öffnen – im Reiter, in der Präsentation und in der
        PDF. Ausgeblendet heißt nur: hier nicht zu sehen; in ChurchTools bleibt alles, wie es ist.
        Damit alle es sehen, braucht die Kategorie „Was das Organigramm zeigt“ der Erweiterung in
        ChurchTools Leserecht für sie.
      </p>
      <div className={fenster.abschnitt}>
        <h3>Gruppentypen</h3>
        <p className={fenster.leise}>
          Ein ausgeblendeter Typ verschwindet samt allem, was darunter hängt. Zusätzlich kann jede
          Person für sich weitere Typen über die Schildchen ausblenden.
        </p>
        <div className={styles.typen}>
          {typZahlen.map(([typ, zahl]) => (
            <label key={typ}>
              <input
                type="checkbox"
                checked={!typen.has(typ)}
                onChange={() => setTypen((t) => umschalten(t, typ))}
              />
              {start.typNamen.get(typ) ?? `Typ ${typ}`}
              <small>{anzahl(zahl, 'Gruppe', 'Gruppen')}</small>
            </label>
          ))}
        </div>
      </div>
      <div className={fenster.abschnitt}>
        <h3>Einzelne Gruppen</h3>
        <p className={fenster.leise}>Eine ausgeblendete Gruppe nimmt ihre Untergruppen mit.</p>
        <input
          className={fenster.feld}
          type="search"
          placeholder="Gruppe suchen"
          aria-label="Gruppe suchen"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
        <ul className={styles.baum}>
          {start.baum.map((k) => zweig(k, String(k.gruppe.id), false))}
        </ul>
      </div>
      {problem && (
        <p className={fenster.fehler} role="alert">
          {problem}
        </p>
      )}
    </Sheet>
  );
}
