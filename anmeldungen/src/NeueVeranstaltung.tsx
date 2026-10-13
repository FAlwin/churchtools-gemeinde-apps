import { useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import type { MeineGruppe } from '@shared/ct/gruppen';
import { VORLAGEN, type Vorlage } from '@shared/anmeldung/vorlagen';
import { kopiereVeranstaltung, legeVeranstaltungAn, veranstaltungenVon } from './einrichten';
import { felderAnlegen } from './formularFelder';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';

/**
 * **„Neue Veranstaltung“** (A3, #486) wie im Entwurf: Name, zu welchem Team sie gehört, und womit sie
 * beginnt – einer Vorlage oder wie eine frühere. Angelegt wird ein Entwurf; danach öffnet sich die
 * Veranstaltung zum Einrichten.
 */
export function NeueVeranstaltung({
  teams,
  artId,
  onFertig,
  onClose,
}: {
  /** Nur Teams, unter denen die Person anlegen darf. */
  teams: MeineGruppe[];
  artId: number;
  onFertig: (id: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState(teams[0]?.id ?? 0);
  const [start, setStart] = useState<Vorlage | 'kopie'>('einfach');
  const [fruehere, setFruehere] = useState<{ id: number; name: string }[] | null>(null);
  const [quelleId, setQuelleId] = useState<number | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Frühere Veranstaltungen des Teams erst holen, wenn „wie eine frühere“ gewählt ist.
  useEffect(() => {
    if (start !== 'kopie') return;
    let aktuell = true;
    setFruehere(null);
    veranstaltungenVon(teamId).then(
      (liste) => {
        if (!aktuell) return;
        setFruehere(liste);
        setQuelleId(liste[0]?.id ?? null);
      },
      (e: unknown) => aktuell && setFehler(fehlerMeldung(e).text),
    );
    return () => {
      aktuell = false;
    };
  }, [start, teamId]);

  const bereit = name.trim() !== '' && teamId !== 0 && (start !== 'kopie' || quelleId !== null);

  async function anlegen() {
    setArbeitet(true);
    setFehler(null);
    try {
      const id =
        start === 'kopie'
          ? await kopiereVeranstaltung(quelleId!, name.trim())
          : await legeVeranstaltungAn({ name: name.trim(), teamId, artId, vorlage: start });
      // Die Spalten für Telefon, Bemerkungen, Allergien … (A5). Die Kopie bringt sie schon mit.
      if (start !== 'kopie') await felderAnlegen(id);
      onFertig(id);
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setArbeitet(false);
    }
  }

  return (
    <Sheet title="Neue Veranstaltung" onClose={onClose}>
      <p className={f.hinweis}>
        Sie wird als Entwurf angelegt – Gäste sehen sie erst, wenn sie freigegeben ist.
      </p>
      <label className={f.feld}>
        <span>Name</span>
        <input
          className={f.eingabe}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Gemeindeessen im November"
          maxLength={100}
        />
      </label>
      <label className={f.feld}>
        <span>Gehört zur Gruppe</span>
        <select
          className={f.eingabe}
          value={teamId}
          onChange={(e) => setTeamId(Number(e.target.value))}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div className={f.feld} role="group" aria-label="Wie anfangen?">
        <span>Wie anfangen?</span>
        <div className={f.optionen}>
          {VORLAGEN.map((v) => (
            <button
              key={v.id}
              type="button"
              className={f.option}
              aria-pressed={start === v.id}
              onClick={() => setStart(v.id)}
            >
              {v.name}
              <small>{v.beschreibung}</small>
            </button>
          ))}
          <button
            type="button"
            className={f.option}
            aria-pressed={start === 'kopie'}
            onClick={() => setStart('kopie')}
          >
            Wie eine frühere Veranstaltung
            <small>Felder, Preise und Gestaltung werden übernommen, Anmeldungen nicht</small>
          </button>
        </div>
      </div>
      {start === 'kopie' && (
        <label className={f.feld}>
          <span>Welche?</span>
          {fruehere === null ? (
            <span className={f.hinweis}>Wird geladen …</span>
          ) : fruehere.length === 0 ? (
            <span className={f.hinweis}>Diese Gruppe hat noch keine Veranstaltung.</span>
          ) : (
            <select
              className={f.eingabe}
              value={quelleId ?? ''}
              onChange={(e) => setQuelleId(Number(e.target.value))}
            >
              {fruehere.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </label>
      )}
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
      <button type="button" className={f.knopf} disabled={!bereit || arbeitet} onClick={anlegen}>
        {arbeitet ? 'Wird angelegt …' : 'Anlegen'}
      </button>
    </Sheet>
  );
}
