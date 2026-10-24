import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import {
  angelegt,
  ausfuehrbar,
  nichtAngelegt,
  umbauSchritte,
  type NeueGruppePlan,
  type PlanAenderungen,
  type PlanGruppe,
  type Schritt,
} from '@shared/organigramm/plan';
import {
  rueckgaengig,
  schrittAusfuehren,
  type Ausgefuehrt,
  type UmbauStatus,
} from '@shared/organigramm/umbau';
import { ladeGruppenbaum } from './start';
import { ladeUmbauStatus, umbauZugriff } from './struktur';
import { schrittText } from './umbauTexte';
import type { PlanSchritt } from './PlanFenster';
import baum from './Organigramm.module.scss';
import styles from './NeueGliederung.module.scss';

/** Status und archivierte Gruppen (`ladeUmbauStatus`) – `null` solange sie laden oder nicht ladbar sind. */
export type UmbauDaten = UmbauStatus & { archivierteGruppen: Map<number, string> | null };

const GRUPPEN: [Schritt['art'], string][] = [
  ['neu', '1 · Neue Gruppen anlegen'],
  ['um', '2 · Umhängen'],
  ['name', '3 · Umbenennen'],
  ['arch', '4 · Archivieren'],
];

const schluessel = (s: Schritt) => `${s.art}:${s.id}`;

interface Props {
  plan: readonly PlanGruppe[];
  schritte: Schritt[];
  daten: UmbauDaten | null;
  datenFehler: boolean;
  typName: (id: number) => string;
  /** Der zuletzt gespeicherte Plan (für „Alle“, das über mehrere Schritte läuft). */
  aktuellerPlan: () => PlanAenderungen | null;
  planAendern: (schritt: PlanSchritt) => Promise<boolean>;
  /** Nach dem Ausführen: ChurchTools neu lesen (Baum der Seite und Status/Archivierte). */
  onNeu: () => Promise<void>;
  onDatenNochmal: () => void;
}

/**
 * **Der Umbau** (Bauplan O7-3, Entwurf `o7-plan-v1`): die Schritte vom Plan nach ChurchTools mit Fortschritt,
 * „Ausführen“ je Schritt und „Alle offenen nacheinander“. Jeder Schritt ändert ChurchTools sofort und wird nachgelesen;
 * erledigt ist, was ChurchTools schon so zeigt – auch wenn es jemand direkt dort gemacht hat.
 *
 * Nach einem einzelnen Schritt gibt es „Rückgängig“ (Alwin, 24.10.2026); nach „Alle“ nicht. „Alle“ liest vor jedem
 * Schritt ChurchTools neu und hält beim ersten Fehler an.
 */
export function Umbau({
  plan,
  schritte,
  daten,
  datenFehler,
  typName,
  aktuellerPlan,
  planAendern,
  onNeu,
  onDatenNochmal,
}: Props) {
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [zurueck, setZurueck] = useState<{
    text: string;
    ergebnis: Ausgefuehrt;
    neu: NeueGruppePlan | null;
  } | null>(null);
  const [alleFragen, setAlleFragen] = useState(false);
  const [fortschritt, setFortschritt] = useState<string | null>(null);

  const fertig = schritte.filter((s) => s.erledigt).length;
  const offen = schritte.filter(ausfuehrbar);
  const archivNamen = daten?.archivierteGruppen ?? null;
  const text = (s: Schritt) => schrittText(s, plan, typName, archivNamen);

  /** Nach dem Anlegen: die eigene ID im Plan durch die echte ersetzen. */
  const anlegenVermerken = async (r: Ausgefuehrt): Promise<boolean> => {
    if (!r.angelegt) return true;
    const { id, ctId } = r.angelegt;
    if (await planAendern((a) => angelegt(a, id, ctId))) return true;
    setMeldung(
      'In ChurchTools angelegt, aber der Plan ließ sich nicht speichern. Der Schritt erscheint als „gibt es schon“ – dort „Im Plan übernehmen“.',
    );
    return false;
  };

  const einzeln = async (s: Schritt) => {
    if (!daten) return;
    setLaeuft(schluessel(s));
    setMeldung(null);
    setZurueck(null);
    const neu = s.art === 'neu' ? (aktuellerPlan()?.neu.find((x) => x.id === s.id) ?? null) : null;
    try {
      const r = await schrittAusfuehren(umbauZugriff, s, daten);
      if (await anlegenVermerken(r)) setZurueck({ text: text(s).titel, ergebnis: r, neu });
    } catch (e) {
      setMeldung(fehlerMeldung(e).text);
    } finally {
      // Auch nach einem Fehler: ChurchTools kann halb geändert sein – neu lesen, was dasteht.
      await onNeu();
      setLaeuft(null);
    }
  };

  const zuruecknehmen = async () => {
    if (!zurueck) return;
    setLaeuft('zurueck');
    setMeldung(null);
    try {
      await rueckgaengig(umbauZugriff, zurueck.ergebnis.rueckweg);
      const a = zurueck.ergebnis.angelegt;
      const n = zurueck.neu;
      if (a && n && !(await planAendern((p) => nichtAngelegt(p, n, a.ctId)))) {
        setMeldung('In ChurchTools zurückgenommen, aber der Plan ließ sich nicht speichern.');
      }
      setZurueck(null);
    } catch (e) {
      setMeldung(fehlerMeldung(e).text);
    } finally {
      await onNeu();
      setLaeuft(null);
    }
  };

  const alle = async () => {
    setAlleFragen(false);
    setLaeuft('alle');
    setMeldung(null);
    setZurueck(null);
    let gemacht = 0;
    let zuletzt: string | null = null;
    try {
      // Vor jedem Schritt frisch: was ChurchTools jetzt zeigt, und der zuletzt gespeicherte Plan.
      for (let runde = 0; runde < 500; runde++) {
        const [heute, st] = await Promise.all([ladeGruppenbaum(), ladeUmbauStatus()]);
        const a = aktuellerPlan();
        if (!a) break;
        const naechster = umbauSchritte(heute, a, st.archivierteGruppen).find(ausfuehrbar);
        if (!naechster) break;
        // Derselbe Schritt noch einmal: ausgeführt, aber ChurchTools zeigt ihn nicht als erledigt → anhalten.
        if (schluessel(naechster) === zuletzt) {
          setMeldung(
            `${text(naechster).titel}: ausgeführt, aber ChurchTools zeigt es noch nicht so. Der Umbau hält hier an.`,
          );
          break;
        }
        zuletzt = schluessel(naechster);
        setFortschritt(`${text(naechster).titel} …`);
        const r = await schrittAusfuehren(umbauZugriff, naechster, st);
        gemacht++;
        if (!(await anlegenVermerken(r))) break;
      }
    } catch (e) {
      setMeldung(
        `Nach ${gemacht} ${gemacht === 1 ? 'Schritt' : 'Schritten'} angehalten: ${fehlerMeldung(e).text}`,
      );
    } finally {
      setFortschritt(null);
      await onNeu();
      setLaeuft(null);
    }
  };

  if (schritte.length === 0) {
    return (
      <section className={`${baum.karte} ${styles.leerKarte}`}>
        <p>
          <b>Plan und ChurchTools sind gleich.</b>
        </p>
        <p className={baum.meta}>
          Ändert den Plan – dann steht hier, was in ChurchTools zu tun ist.
        </p>
      </section>
    );
  }

  const beschaeftigt = laeuft !== null;
  let nr = 0;
  return (
    <>
      <div className={styles.leiste}>
        <div
          className={styles.fortschritt}
          role="progressbar"
          aria-valuenow={fertig}
          aria-valuemin={0}
          aria-valuemax={schritte.length}
          aria-label="Fortschritt des Umbaus"
        >
          <div style={{ width: `${Math.round((fertig / schritte.length) * 100)}%` }} />
        </div>
        <b>
          {fertig} von {schritte.length} erledigt
        </b>
        <span className={styles.rechts}>
          <FensterKnopf
            art="haupt"
            className={styles.alleKnopf}
            disabled={beschaeftigt || offen.length === 0 || !daten}
            onClick={() => setAlleFragen(true)}
          >
            {laeuft === 'alle' ? 'Läuft …' : 'Alle offenen nacheinander ausführen'}
          </FensterKnopf>
        </span>
      </div>
      <p className={baum.meta}>
        Jeder Schritt ändert ChurchTools sofort und wird danach nachgelesen. Ein Schritt ist
        erledigt, sobald ChurchTools so aussieht wie der Plan – auch wenn ihn jemand direkt in
        ChurchTools gemacht hat.
      </p>
      {datenFehler && (
        <div className={baum.hinweis} role="alert">
          Welche Gruppen archiviert sind, ließ sich gerade nicht laden – Ausführen geht erst danach.
          <button type="button" className={baum.nochmal} onClick={onDatenNochmal}>
            Erneut versuchen
          </button>
        </div>
      )}
      {fortschritt && (
        <p className={baum.meta} role="status">
          {fortschritt}
        </p>
      )}
      {meldung && (
        <div className={`${baum.hinweis} ${styles.warnung}`} role="alert">
          {meldung}
        </div>
      )}
      {zurueck && (
        <div className={baum.hinweis} role="status">
          Ausgeführt: {zurueck.text}.
          <button
            type="button"
            className={baum.nochmal}
            disabled={beschaeftigt}
            onClick={() => void zuruecknehmen()}
          >
            Rückgängig
          </button>
        </div>
      )}
      <section className={baum.karte} aria-label="Umbau-Schritte">
        {GRUPPEN.map(([art, titel]) => {
          const teil = schritte.filter((s) => s.art === art);
          if (!teil.length) return null;
          return (
            <div key={art} className={styles.umbauGruppe}>
              <div className={styles.gruppenkopf}>{titel}</div>
              <ol className={styles.schritte}>
                {teil.map((s) => {
                  nr++;
                  const t = text(s);
                  const frei = ausfuehrbar(s);
                  return (
                    <li
                      key={schluessel(s)}
                      className={`${styles.schritt} ${s.erledigt ? styles.erledigt : ''} ${
                        !s.erledigt && !frei ? styles.gesperrt : ''
                      }`}
                    >
                      <span className={styles.nr}>{s.erledigt ? '✓' : nr}</span>
                      <span className={styles.schrittText}>
                        {t.titel}
                        {t.wo && <small>{t.wo}</small>}
                      </span>
                      {s.erledigt && s.art === 'neu' && !s.vermerkt && s.gefunden !== null ? (
                        <button
                          type="button"
                          className={baum.nochmal}
                          disabled={beschaeftigt}
                          onClick={() => {
                            const ctId = s.gefunden as number;
                            void planAendern((a) => angelegt(a, s.id, ctId));
                          }}
                        >
                          Im Plan übernehmen
                        </button>
                      ) : s.erledigt ? (
                        <span className={`${styles.marke} ${styles.mNeu}`}>erledigt</span>
                      ) : (
                        <button
                          type="button"
                          className={frei ? styles.ausfuehren : baum.nochmal}
                          disabled={!frei || beschaeftigt || !daten}
                          onClick={() => void einzeln(s)}
                        >
                          {laeuft === schluessel(s) ? 'Läuft …' : 'Ausführen'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </section>
      {alleFragen && (
        <Sheet
          title={`${offen.length} ${offen.length === 1 ? 'Schritt' : 'Schritte'} ausführen?`}
          onClose={() => setAlleFragen(false)}
          knoepfe={
            <FensterKnopf art="haupt" onClick={() => void alle()}>
              Ausführen
            </FensterKnopf>
          }
        >
          <p className={baum.meta}>
            Die Schritte ändern ChurchTools sofort, einer nach dem anderen – auch die, die erst
            danach frei werden. Bei einem Fehler hält der Umbau an. Danach gibt es kein
            „Rückgängig“.
          </p>
        </Sheet>
      )}
    </>
  );
}
