import { useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import {
  stammName,
  vorgabenVollstaendig,
  type NeuePersonVorgaben,
  type Stammdaten,
} from '@shared/anmeldung/vorbereiten';
import { stammdaten } from './einrichten';
import { gemeindeVorgaben, gespeicherteVorgaben, speichereGemeindeVorgaben } from './gemeinde';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';

/**
 * **Einstellungen der Gemeinde** (A6-2, #548) – nur für Gruppen-Admins. Zuerst: welchen Status, Standort und
 * Bereich neue Personen bekommen, die sich anmelden (Alwin, 14.10.2026: „einmal je Gemeinde“). ChurchTools nimmt
 * ohne diese Vorgaben keine Anmeldung an (gemessen).
 */
export function GemeindeFenster({
  onClose,
  onGespeichert,
}: {
  onClose: () => void;
  onGespeichert: (text: string) => void;
}) {
  const [daten, setDaten] = useState<Stammdaten | null>(null);
  const [wahl, setWahl] = useState<Partial<NeuePersonVorgaben>>({});
  const [vorschlag, setVorschlag] = useState(false);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let aktuell = true;
    stammdaten()
      .then(async (s) => {
        const [v, gespeichert] = await Promise.all([gemeindeVorgaben(s), gespeicherteVorgaben()]);
        if (!aktuell) return;
        setDaten(s);
        setWahl(v);
        setVorschlag(!gespeichert);
      })
      .catch((e: unknown) => aktuell && setFehler(fehlerMeldung(e).text));
    return () => {
      aktuell = false;
    };
  }, []);

  const auswahl = (
    titel: string,
    feld: keyof NeuePersonVorgaben,
    liste: { id: number; name: string; nameTranslated?: string | null }[],
  ) => (
    <label className={f.feld}>
      <span>{titel}</span>
      <select
        className={f.eingabe}
        value={wahl[feld] ?? ''}
        onChange={(e) =>
          setWahl({ ...wahl, [feld]: e.target.value === '' ? undefined : Number(e.target.value) })
        }
      >
        <option value="">Bitte wählen …</option>
        {liste.map((x) => (
          <option key={x.id} value={x.id}>
            {stammName(x)}
          </option>
        ))}
      </select>
    </label>
  );

  async function speichern() {
    if (!vorgabenVollstaendig(wahl)) return;
    setArbeitet(true);
    setFehler(null);
    try {
      await speichereGemeindeVorgaben(wahl);
      onGespeichert('Einstellungen der Gemeinde gespeichert.');
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setArbeitet(false);
    }
  }

  return (
    <Sheet title="Einstellungen der Gemeinde" onClose={onClose}>
      <p className={f.hinweis}>
        Wer sich anmeldet und in ChurchTools noch nicht bekannt ist, wird dort neu angelegt – mit
        diesen Angaben. Ohne sie nimmt ChurchTools keine Anmeldung an. Gilt für alle
        Veranstaltungen.
      </p>
      {daten ? (
        <>
          {auswahl(
            'Status',
            'statusId',
            daten.status.filter((x) => !x.isMember),
          )}
          {auswahl('Standort', 'campusId', daten.standorte)}
          {auswahl('Bereich', 'departmentId', daten.bereiche)}
          {vorschlag && (
            <p className={f.hinweis}>
              Noch nicht gespeichert – das ist der Vorschlag. Bis jemand speichert, gilt er so.
            </p>
          )}
        </>
      ) : (
        !fehler && <p className={f.hinweis}>Wird geladen …</p>
      )}
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
      <button
        type="button"
        className={f.knopf}
        disabled={arbeitet || !vorgabenVollstaendig(wahl)}
        onClick={() => void speichern()}
      >
        {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
      </button>
    </Sheet>
  );
}
