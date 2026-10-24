import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { Icon } from '@ui/icons/icons';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { wannText } from '@shared/ct/zeit';
import type { SpeicherErgebnis, Versioniert } from '@shared/ct/versionierterWert';
import { gruppenFarbe } from '@shared/organigramm/farbe';
import {
  KEINE_AENDERUNGEN,
  planBaum,
  planGruppen,
  planUnterschied,
  type Heute,
  type PlanAenderungen,
  type PlanGruppe,
  type PlanKnoten,
  type PlanMarke,
  type Ref,
} from '@shared/organigramm/plan';
import { ladePlan, speicherePlan, verwerfePlan } from './plan';
import { konfliktText, planFehlerText } from './planTexte';
import { NeuerBereichFenster, PlanFenster, type PlanSchritt } from './PlanFenster';
import type { Start } from './start';
import baum from './Organigramm.module.scss';
import styles from './NeueGliederung.module.scss';

type Stand =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'da'; plan: Versioniert<PlanAenderungen> | null };

const MARKE_STIL: Record<PlanMarke, string> = {
  neu: styles.mNeu,
  umgehängt: styles.mUm,
  umbenannt: styles.mName,
  'wird archiviert': styles.mArch,
};

const zeitzone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * **Reiter „Neue Gliederung“** (Bauplan O7-2, Entwurf `o7-plan-v1` abgenommen 24.10.2026) – nur für Gruppen-Admins.
 * Der Plan ist eine Kopie von heute plus Änderungen; jede Änderung wird sofort gespeichert (mit Version, Konflikt und
 * Nachlesen) und gilt dann für alle Gruppen-Admins. ChurchTools selbst ändert sich hier nicht – das macht der Umbau
 * (O7-3).
 *
 * Scheitert das Speichern, bleibt die Änderung als Schritt erhalten: „Nochmal“ wendet sie auf den Stand an, der jetzt
 * dasteht – auch nach einem Konflikt, ohne die Änderung des anderen zu überschreiben.
 */
export function NeueGliederung({ start }: { start: Start }) {
  const heute = useMemo<Heute>(() => ({ gruppen: start.gruppen, eltern: start.eltern }), [start]);
  const [stand, setStand] = useState<Stand>({ art: 'laedt' });
  const [problem, setProblem] = useState<{ text: string; nochmal: PlanSchritt | null } | null>(
    null,
  );
  const [arbeitet, setArbeitet] = useState(false);
  const [offen, setOffen] = useState<Ref | null>(null);
  const [neuerBereich, setNeuerBereich] = useState(false);
  const [verwerfenFragen, setVerwerfenFragen] = useState(false);

  const laden = useCallback(() => {
    setStand({ art: 'laedt' });
    setProblem(null);
    ladePlan().then(
      (r) =>
        setStand(
          r.ok ? { art: 'da', plan: r.daten } : { art: 'fehler', text: planFehlerText(r.grund) },
        ),
      (e: unknown) => setStand({ art: 'fehler', text: fehlerMeldung(e).text }),
    );
  }, []);
  useEffect(laden, [laden]);

  const plan = useMemo(
    () => (stand.art === 'da' && stand.plan ? planGruppen(heute, stand.plan.inhalt) : []),
    [stand, heute],
  );
  const knoten = useMemo(() => planBaum(plan), [plan]);
  const ctGruppe = useMemo(() => new Map(start.gruppen.map((g) => [g.id, g])), [start.gruppen]);
  const farbe = (g: PlanGruppe) =>
    gruppenFarbe(
      {
        farbe: typeof g.ref === 'number' ? (ctGruppe.get(g.ref)?.farbe ?? null) : null,
        typId: g.typId,
      },
      start.typFarben,
    );
  const heuteName = (id: number) => ctGruppe.get(id)?.name ?? '';

  const schreiben = async (
    tun: () => Promise<SpeicherErgebnis<PlanAenderungen>>,
    nochmal: PlanSchritt | null,
  ) => {
    setArbeitet(true);
    setProblem(null);
    setOffen(null);
    setNeuerBereich(false);
    setVerwerfenFragen(false);
    try {
      const r = await tun();
      if (r.ok) {
        setStand({ art: 'da', plan: r.daten });
        return;
      }
      // Was jetzt dasteht, gilt – sonst scheitert das nächste Speichern an der alten Version.
      if (r.jetzt !== undefined) setStand({ art: 'da', plan: r.jetzt });
      if (r.grund === 'konflikt') {
        const jetzt = r.jetzt ?? null;
        setProblem({
          text: konfliktText(jetzt?.von.name ?? null),
          nochmal: jetzt ? nochmal : null,
        });
      } else {
        const nochmalSinnvoll = r.grund === 'voruebergehend' || r.grund === 'nicht-angekommen';
        setProblem({ text: planFehlerText(r.grund), nochmal: nochmalSinnvoll ? nochmal : null });
      }
    } catch (e) {
      // Modul oder Kategorie nicht erreichbar (`speicherePlan` sucht sie vorher) – nichts geschrieben.
      const m = fehlerMeldung(e);
      setProblem({ text: m.text, nochmal: m.nochmal ? nochmal : null });
    } finally {
      setArbeitet(false);
    }
  };

  const aendern = (schritt: PlanSchritt) => {
    if (stand.art !== 'da') return;
    const basis = stand.plan;
    const neu = schritt(basis?.inhalt ?? KEINE_AENDERUNGEN);
    const von = { personId: start.ichId, name: start.vorname };
    void schreiben(() => speicherePlan(neu, von, basis?.version ?? null), schritt);
  };

  const verwerfen = () => {
    if (stand.art !== 'da' || !stand.plan) return;
    const version = stand.plan.version;
    void schreiben(() => verwerfePlan(version), null);
  };

  const problemZeile = problem && (
    <div className={`${baum.hinweis} ${styles.warnung}`} role="alert">
      <span>{problem.text}</span>
      {problem.nochmal && (
        <button
          type="button"
          className={baum.nochmal}
          disabled={arbeitet}
          onClick={() => problem.nochmal && aendern(problem.nochmal)}
        >
          Nochmal auf dem neuen Stand
        </button>
      )}
    </div>
  );

  const zeile = (k: PlanKnoten, bereich: boolean): ReactNode => {
    const g = k.gruppe;
    const u = planUnterschied(g, heuteName);
    const inhalt = (
      <>
        <GruppenKachel name={g.name} farbe={farbe(g)} groesse={bereich ? 40 : undefined} />
        <span className={baum.text}>
          <b className={`${bereich ? baum.bereichName : ''} ${g.archiv ? styles.archiv : ''}`}>
            {g.name}
          </b>
          {u.vorher && <span className={baum.meta}>{u.vorher}</span>}
        </span>
        <span className={styles.marken}>
          {u.marken.map((m) => (
            <span key={m} className={`${styles.marke} ${MARKE_STIL[m]}`}>
              {m}
            </span>
          ))}
        </span>
      </>
    );
    return (
      <button
        type="button"
        className={bereich ? baum.kopf : baum.zeile}
        onClick={() => setOffen(g.ref)}
      >
        {inhalt}
      </button>
    );
  };
  const zeilen = (liste: PlanKnoten[]): ReactNode => (
    <ul className={baum.zeilen}>
      {liste.map((k) => (
        <li key={String(k.gruppe.ref)}>
          {zeile(k, false)}
          {k.kinder.length > 0 && zeilen(k.kinder)}
        </li>
      ))}
    </ul>
  );

  const offeneGruppe = offen === null ? undefined : plan.find((g) => g.ref === offen);

  return (
    <div className={baum.seite}>
      <p className={styles.einleitung}>
        Nur für Gruppen-Admins. Hier entsteht der Plan, wie die Gemeinde künftig gegliedert ist –
        ChurchTools ändert sich erst, wenn ihr einen Schritt im Umbau ausführt.
      </p>

      {stand.art === 'laedt' && <p className={baum.leer}>Plan wird geladen …</p>}

      {stand.art === 'fehler' && (
        <div className={baum.hinweis} role="alert">
          {stand.text}
          <button type="button" className={baum.nochmal} onClick={laden}>
            Erneut versuchen
          </button>
        </div>
      )}

      {stand.art === 'da' && problemZeile}

      {stand.art === 'da' && !stand.plan && (
        <section className={`${baum.karte} ${styles.leerKarte}`}>
          <p>
            <b>Noch kein Plan.</b>
          </p>
          <p className={baum.meta}>
            „Plan anlegen“ kopiert die heutige Gliederung aus ChurchTools. Daran ändert ihr dann,
            was neu werden soll.
          </p>
          <FensterKnopf art="haupt" disabled={arbeitet} onClick={() => aendern((a) => a)}>
            {arbeitet ? 'Wird angelegt …' : 'Plan anlegen'}
          </FensterKnopf>
        </section>
      )}

      {stand.art === 'da' && stand.plan && (
        <>
          <div className={styles.leiste}>
            <span className={baum.meta}>
              {arbeitet
                ? 'Wird gespeichert …'
                : `Gespeichert von ${stand.plan.von.name}, ${wannText(stand.plan.zeit, zeitzone())} · für alle Gruppen-Admins`}
            </span>
            <span className={styles.rechts}>
              <button
                type="button"
                className={baum.praesentieren}
                disabled={arbeitet}
                onClick={() => setNeuerBereich(true)}
              >
                <Icon name="plus" size={16} />
                Neuer Bereich
              </button>
              <button
                type="button"
                className={baum.nochmal}
                disabled={arbeitet}
                onClick={() => setVerwerfenFragen(true)}
              >
                Plan verwerfen
              </button>
            </span>
          </div>
          <p className={baum.meta}>
            Klick auf eine Gruppe: umbenennen, woanders einhängen, Untergruppe anlegen, archivieren.
          </p>
          <div className={baum.bereiche}>
            {knoten.map((b) => (
              <section key={String(b.gruppe.ref)} className={baum.karte} aria-label={b.gruppe.name}>
                {zeile(b, true)}
                {b.kinder.length > 0 ? (
                  zeilen(b.kinder)
                ) : (
                  <p className={baum.keine}>Keine Untergruppen.</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      {neuerBereich && (
        <NeuerBereichFenster
          start={start}
          heute={heute}
          farbe={farbe}
          arbeitet={arbeitet}
          onAendern={aendern}
          onSchliessen={() => setNeuerBereich(false)}
        />
      )}
      {offeneGruppe && (
        <PlanFenster
          key={String(offeneGruppe.ref)}
          start={start}
          heute={heute}
          plan={plan}
          gruppe={offeneGruppe}
          farbe={farbe}
          arbeitet={arbeitet}
          onAendern={aendern}
          onSchliessen={() => setOffen(null)}
        />
      )}
      {verwerfenFragen && (
        <Sheet
          title="Plan verwerfen?"
          onClose={() => setVerwerfenFragen(false)}
          knoepfe={
            <FensterKnopf art="gefahr" disabled={arbeitet} onClick={verwerfen}>
              Verwerfen
            </FensterKnopf>
          }
        >
          <p className={baum.meta}>
            Der Plan wird für alle Gruppen-Admins gelöscht. ChurchTools bleibt, wie es ist.
          </p>
        </Sheet>
      )}
    </div>
  );
}
