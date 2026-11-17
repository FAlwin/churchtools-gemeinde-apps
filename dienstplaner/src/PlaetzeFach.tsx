import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { useLaden } from '@ui/ct/useLaden';
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import { vorlagenFuerKalender, type TerminVorlage } from '@shared/ct/terminVorlagen';
import { vorlageRechnen, vorlagenGrundText, type VorlagenStand } from '@shared/dienstplan/vorlage';
import { anzahlFehlerText, plaetzeText, sperreText } from './plaetzeTexte';
import { PlatzRegler } from './PlatzRegler';
import { useAnzahlSetzen } from './useAnzahlSetzen';
import { useInsBild } from './useInsBild';
// Dieselben Fach-Bausteine wie die anderen Fächer – ein Aussehen für alle.
import styles from './WerKann.module.scss';
import eigen from './PlaetzeFach.module.scss';

/** Ein Dienst im Fach: wie viele Plätze, wie viele belegt, und wie viele Entwürfe dort liegen. */
export interface PlaetzeZeile {
  serviceId: number;
  name: string;
  anzahl: number;
  belegt: number;
  /**
   * Entwürfe an diesem Dienst und Termin (gültig oder veraltet). Dann bleibt die Zahl, wie sie ist: Gemessen
   * (15.10.2026) nummeriert ChurchTools die Plätze beim Ändern neu (ein einzelner Platz hat keine Nummer, ab zwei
   * heißen sie 1, 2, …) – ein Entwurf fände seinen Platz nicht mehr.
   */
  entwuerfe: number;
}

/**
 * **Die Plätze eines Termins** (Bauplan E4-5-3, Entwurf `e4-5-entwurf.html` Abschnitt 4): je Dienst der Gruppe
 * − und +. Jeder Tipp wird **sofort** gespeichert und nachgelesen (Alwin, 15.10.2026) – ChurchTools verschickt
 * dabei nichts (gemessen). Belegte Plätze lassen sich nicht wegnehmen. Kein „Auf Vorlage zurücksetzen“: Ein
 * Termin kennt seine Vorlage nicht (gemessen). `onClose(true)`, wenn sich etwas geändert hat.
 *
 * **Alle Dienste der Gruppe** stehen da, auch die ohne Platz an diesem Termin (Anzahl 0, „nicht vorgesehen“) – „+“ schaltet
 * sie ein, „−“ bis 0 aus. Oben kann man eine **ChurchTools-Terminvorlage übernehmen** (13.11.2026): erst die Vorschau,
 * dann „Übernehmen“; sie **nimmt nur dazu** (nie weniger), **nur bei den Diensten dieser Gruppe** (Alwin, 16.11.2026 – andere
 * Gruppen übergeht sie still), und lässt Dienste mit Entwürfen aus (`vorlageRechnen`). Jeder Dienst wird einzeln gespeichert – scheitert einer, laufen die anderen weiter.
 */
export function PlaetzeFach({
  titel,
  unter,
  zeilen,
  vorlage,
  aendern,
  onGespeichert,
  onClose,
}: {
  titel: string;
  unter: string;
  zeilen: PlaetzeZeile[];
  /**
   * Die Vorlagen von ChurchTools: `laden` einmal beim Öffnen, `kalenderId` der Kalender des Termins (nur dessen Vorlagen
   * werden angeboten), `namen` alle Dienste der Gemeinde, `gruppenDienste` die Dienste dieser Gruppe – nur die ändert die
   * Vorlage, alles andere in ihr wird still übergangen. Ohne `vorlage`: kein Vorlagen-Bereich.
   */
  vorlage?: {
    kalenderId: number;
    laden: () => Promise<TerminVorlage[]>;
    namen: ReadonlyMap<number, string>;
    gruppenDienste: ReadonlySet<number>;
  };
  aendern: (z: PlaetzeZeile, gesehen: number, neu: number) => Promise<AnzahlErgebnis>;
  onGespeichert: (text: string) => void;
  onClose: (geaendert: boolean) => void;
}) {
  const [vorlageLaeuft, setVorlageLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<{ geklappt: string[]; fehler: string[] } | null>(null);
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  // Plätze ändern: dieselbe Stelle wie im Fenster eines einzelnen Dienstes in „Personen“ (`PlatzFenster`).
  const {
    anzahl,
    setAnzahl,
    laeuft,
    geaendert,
    setGeaendert,
    meldung,
    setMeldung,
    beschaeftigt,
    setze: setzeEinen,
  } = useAnzahlSetzen({ zeilen, aendern, onGespeichert, gesperrt: vorlageLaeuft });
  const hinweisRef = useInsBild<HTMLDivElement>(meldung ?? ergebnis);

  // Einmal beim Öffnen (und je Kalender): `vorlage` selbst ist bei jedem Zeichnen ein neues Objekt.
  const vorlagen = useLaden(
    () =>
      vorlage ? vorlage.laden().then((v) => vorlagenFuerKalender(v, vorlage.kalenderId)) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu laden nur, wenn der Kalender wechselt
    [vorlage?.kalenderId],
  );

  /** Wie der Termin jetzt dasteht – die Zahlen aus diesem Fenster, nicht die vom Öffnen. */
  const standJetzt = (): Map<number, VorlagenStand> =>
    new Map(
      zeilen.map((z) => [
        z.serviceId,
        { name: z.name, anzahl: anzahl.get(z.serviceId) ?? z.anzahl, entwuerfe: z.entwuerfe },
      ]),
    );

  const setze = (z: PlaetzeZeile, neu: number) => {
    setErgebnis(null);
    return setzeEinen(z, neu);
  };

  const rechnung =
    vorlage && vorlagen.stand.art === 'fertig' && gewaehlt !== null
      ? (() => {
          const v = vorlagen.stand.daten.find((x) => x.id === gewaehlt);
          return v
            ? {
                v,
                r: vorlageRechnen(
                  // Nur die Dienste dieser Gruppe – die anderen Dienste der Vorlage gehen das Fach nichts an.
                  { dienste: v.dienste.filter((d) => vorlage.gruppenDienste.has(d.serviceId)) },
                  { stand: standJetzt(), namen: vorlage.namen },
                ),
                keine: !v.dienste.some((d) => vorlage.gruppenDienste.has(d.serviceId)),
              }
            : null;
        })()
      : null;

  /** Die Vorlage übernehmen: Dienst für Dienst, jeder mit frisch lesen und nachlesen – ein Fehler hält die anderen nicht auf. */
  const uebernehmen = async () => {
    if (!rechnung || beschaeftigt || rechnung.r.aendern.length === 0) return;
    const alle = new Map(zeilen.map((z) => [z.serviceId, z]));
    const jetzt = new Map(anzahl);
    const geklappt: string[] = [];
    const fehler: string[] = [];
    setVorlageLaeuft(true);
    setMeldung(null);
    setErgebnis(null);
    for (const schritt of rechnung.r.aendern) {
      const z = alle.get(schritt.serviceId);
      if (!z) continue;
      let r: AnzahlErgebnis;
      try {
        r = await aendern(z, jetzt.get(z.serviceId) ?? z.anzahl, schritt.nach);
      } catch {
        r = { ok: false, grund: 'voruebergehend' };
      }
      if (r.ok) {
        jetzt.set(z.serviceId, r.anzahl);
        geklappt.push(`${z.name}: ${plaetzeText(r.anzahl)}`);
      } else {
        // Was jetzt dasteht, gilt – auch wenn es nicht das ist, was wir wollten.
        if (r.jetzt !== undefined) jetzt.set(z.serviceId, r.jetzt);
        fehler.push(`${z.name}: ${anzahlFehlerText(r)}`);
      }
    }
    setAnzahl(jetzt);
    if ([...jetzt].some(([id, n]) => n !== (anzahl.get(id) ?? n))) setGeaendert(true);
    setVorlageLaeuft(false);
    setGewaehlt(null);
    setErgebnis({ geklappt, fehler });
    if (geklappt.length > 0) {
      onGespeichert(
        `Vorlage „${rechnung.v.name}“ übernommen: ${geklappt.length} ${geklappt.length === 1 ? 'Dienst' : 'Dienste'}.`,
      );
    }
  };

  return (
    <Sheet
      title={titel}
      onClose={() => !beschaeftigt && onClose(geaendert)}
      knoepfe={null}
      beschaeftigt={beschaeftigt}
    >
      <p className={styles.unter}>{unter}</p>
      {vorlage && vorlagen.stand.art === 'fehler' && (
        <div className={eigen.vorlage}>
          <p className={styles.hinweis}>
            Die Vorlagen von ChurchTools sind gerade nicht zu erreichen – die Plätze lassen sich
            trotzdem ändern.
          </p>
          {vorlagen.stand.fehler.nochmal && (
            <button type="button" className={styles.knopf} onClick={vorlagen.neu}>
              Nochmal versuchen
            </button>
          )}
        </div>
      )}
      {vorlage && vorlagen.stand.art === 'fertig' && vorlagen.stand.daten.length > 0 && (
        <section className={eigen.vorlage} aria-label="Vorlage übernehmen">
          <p className={styles.titel}>Vorlage übernehmen</p>
          <select
            className={eigen.auswahl}
            aria-label="Vorlage"
            value={gewaehlt ?? ''}
            disabled={beschaeftigt}
            onChange={(e) => {
              setGewaehlt(e.target.value === '' ? null : Number(e.target.value));
              setErgebnis(null);
            }}
          >
            <option value="">— Vorlage wählen —</option>
            {vorlagen.stand.daten.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {rechnung && (
            <div className={eigen.vorschau}>
              {rechnung.r.aendern.length > 0 ? (
                <p>
                  {rechnung.r.aendern.map((a) => `${a.name}: ${a.von} → ${a.nach}`).join(' · ')}
                </p>
              ) : rechnung.keine ? (
                <p>Diese Vorlage hat keine Dienste dieser Gruppe.</p>
              ) : (
                <p>Der Termin hat schon alles aus der Vorlage.</p>
              )}
              {rechnung.r.uebersprungen.length > 0 && (
                <small>
                  Übersprungen:{' '}
                  {rechnung.r.uebersprungen
                    .map((u) => `${u.name} – ${vorlagenGrundText(u.grund)}`)
                    .join(' · ')}
                </small>
              )}
              {rechnung.r.aendern.length > 0 && (
                <button
                  type="button"
                  className={`${styles.knopf} ${styles.primaer}`}
                  disabled={beschaeftigt}
                  onClick={() => void uebernehmen()}
                >
                  {vorlageLaeuft ? 'Wird übernommen …' : 'Übernehmen'}
                </button>
              )}
            </div>
          )}
        </section>
      )}
      <ul className={eigen.liste} aria-label="Plätze je Dienst">
        {zeilen.map((z) => {
          const n = anzahl.get(z.serviceId) ?? z.anzahl;
          return (
            <li key={z.serviceId} className={eigen.zeile}>
              <span className={eigen.dienst}>
                {z.name}
                <small>
                  {n === 0 ? 'nicht vorgesehen' : z.belegt > 0 ? `${z.belegt} belegt` : 'frei'}
                </small>
                {z.entwuerfe > 0 && (
                  <small className={eigen.gesperrt}>{sperreText(z.entwuerfe)}</small>
                )}
              </span>
              <PlatzRegler
                z={z}
                n={n}
                laeuft={laeuft === z.serviceId}
                beschaeftigt={beschaeftigt}
                onSetze={(neu) => void setze(z, neu)}
              />
            </li>
          );
        })}
      </ul>
      <p className={styles.hinweis}>
        Belegte Plätze lassen sich nicht wegnehmen – erst die Person zurückziehen, dann den Platz.
        Jede Änderung gilt sofort; ChurchTools schickt dabei niemandem etwas.
        {vorlage &&
          vorlagen.stand.art === 'fertig' &&
          vorlagen.stand.daten.length > 0 &&
          ' Eine Vorlage nimmt nur dazu, was fehlt – nichts wird weniger, und nur bei den Diensten dieser Gruppe.'}
      </p>
      <div ref={hinweisRef}>
        {meldung && (
          <p className={styles.fehler} role="alert">
            {meldung}
          </p>
        )}
        {ergebnis && ergebnis.geklappt.length > 0 && (
          <p className={styles.hinweis} role="status">
            Übernommen – {ergebnis.geklappt.join(' · ')}.
          </p>
        )}
        {ergebnis?.fehler.map((f) => (
          <p key={f} className={styles.fehler} role="alert">
            {f}
          </p>
        ))}
      </div>
    </Sheet>
  );
}
