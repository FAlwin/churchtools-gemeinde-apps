import { useEffect, useState, type ReactNode } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import {
  vorgabenText,
  vorgabenVollstaendig,
  type NeuePersonVorgaben,
  type Stammdaten,
} from '@shared/anmeldung/vorbereiten';
import {
  anmeldeBedingungen,
  anmeldenVorbereiten,
  freigeben,
  leitungsKandidaten,
  meineId,
  stammdaten,
  type LeitungsKandidat,
} from './einrichten';
import { gemeindeVorgaben } from './gemeinde';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';

/**
 * **Freigeben** (A3, erweitert in A6-2 #548). Vorher richtet es ein, was ChurchTools zum Anmelden braucht
 * (gemessen 14.10.2026): eine **Leitung** – Alwin: „beim Freigeben auswählen“ – und die **Vorgaben für neue
 * Personen** (einmal je Gemeinde, `gemeinde.ts`). Danach fragt es ChurchTools wie ein Gast, ob Anmeldungen
 * angenommen werden, und sagt sonst, was fehlt.
 */
export function FreigebenFenster({
  id,
  formularAdresse,
  hinweis,
  onClose,
  onFreigegeben,
}: {
  id: number;
  /** Formular-Seite der Gemeinde – ohne sie kann sich niemand anmelden, also kein Freigeben (A6-2). */
  formularAdresse: string | null;
  /** Was vor dem Freigeben zu wissen ist (Zeitraum, Termin, Bankverbindung). */
  hinweis: ReactNode;
  onClose: () => void;
  onFreigegeben: (text: string) => void;
}) {
  const [kandidaten, setKandidaten] = useState<LeitungsKandidat[] | null>(null);
  const [gewaehlt, setGewaehlt] = useState<Set<number>>(new Set());
  const [daten, setDaten] = useState<Stammdaten | null>(null);
  const [vorgaben, setVorgaben] = useState<Partial<NeuePersonVorgaben> | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fehlt, setFehlt] = useState<string[] | null>(null);

  useEffect(() => {
    let aktuell = true;
    Promise.all([
      leitungsKandidaten(id),
      meineId(),
      // Die Stammdaten nur einmal laden – die Vorgaben brauchen sie auch.
      stammdaten().then(async (st) => [st, await gemeindeVorgaben(st)] as const),
    ]).then(
      ([k, ich, [s, v]]) => {
        if (!aktuell) return;
        setKandidaten(k);
        // Wer schon Leitung ist, bleibt gewählt; sonst die Person, die gerade freigibt.
        const schon = k.filter((x) => x.leitung).map((x) => x.personId);
        setGewaehlt(new Set(schon.length ? schon : [ich]));
        setDaten(s);
        setVorgaben(v);
      },
      (e: unknown) => aktuell && setFehler(fehlerMeldung(e).text),
    );
    return () => {
      aktuell = false;
    };
  }, [id]);

  const umschalten = (p: number) =>
    setGewaehlt((alt) => {
      const neu = new Set(alt);
      if (neu.has(p)) neu.delete(p);
      else neu.add(p);
      return neu;
    });

  async function los() {
    if (!vorgabenVollstaendig(vorgaben)) return;
    setArbeitet(true);
    setFehler(null);
    try {
      await anmeldenVorbereiten(id, [...gewaehlt], vorgaben);
      await freigeben(id);
      const offen = await anmeldeBedingungen(id);
      if (offen.length === 0) {
        onFreigegeben('Freigegeben – Gäste können sich anmelden, sobald der Zeitraum läuft.');
        return;
      }
      setFehlt(offen);
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
    }
    setArbeitet(false);
  }

  if (fehlt)
    return (
      <Sheet
        title="Freigegeben – aber noch nicht offen"
        onClose={() => onFreigegeben('Freigegeben.')}
      >
        <p className={f.hinweis}>ChurchTools nimmt noch keine Anmeldungen an:</p>
        <ul className={f.liste}>
          {fehlt.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <button type="button" className={f.knopf} onClick={() => onFreigegeben('Freigegeben.')}>
          Verstanden
        </button>
      </Sheet>
    );

  const vorgabenOk = vorgabenVollstaendig(vorgaben);
  return (
    <Sheet title="Freigeben?" onClose={onClose}>
      {hinweis}
      <div className={f.feld}>
        <span>Leitung (Ansprechpartner, sieht die Anmeldungen in ChurchTools)</span>
        {kandidaten === null && !fehler ? (
          <p className={f.hinweis}>Wird geladen …</p>
        ) : (
          <div className={f.optionen}>
            {(kandidaten ?? []).map((k) => (
              <button
                key={k.personId}
                type="button"
                className={f.option}
                aria-pressed={gewaehlt.has(k.personId)}
                onClick={() => umschalten(k.personId)}
              >
                {k.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {daten && vorgaben && (
        <p className={f.hinweis}>
          {vorgabenOk
            ? `Neue Personen bekommen in ChurchTools: ${vorgabenText(vorgaben, daten)}.`
            : 'Für neue Personen ist noch nicht festgelegt, welchen Status, Standort und Bereich sie bekommen. Das legt ein Gruppen-Admin einmal für die Gemeinde fest (Startseite → Einstellungen).'}
        </p>
      )}
      {!formularAdresse && (
        <p className={f.fehler}>
          Es gibt noch keine Adresse für das Anmeldeformular – ohne sie kann sich niemand anmelden.
          Das legt ein Gruppen-Admin einmal fest (Startseite → Einstellungen).
        </p>
      )}
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
      <button
        type="button"
        className={f.knopf}
        disabled={arbeitet || !vorgabenOk || gewaehlt.size === 0 || !formularAdresse}
        onClick={() => void los()}
      >
        {arbeitet ? 'Wird freigegeben …' : 'Jetzt freigeben'}
      </button>
    </Sheet>
  );
}
