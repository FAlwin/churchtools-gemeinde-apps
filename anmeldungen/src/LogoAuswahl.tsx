import { useEffect, useRef, useState } from 'react';
import { titelbildGross } from '@shared/anmeldung/gestaltung';
import {
  istGruppenAdmin,
  logoEntfernen,
  logoHochladen,
  logoListe,
  type EigenesLogo,
} from './einrichten';
import { fehlerMeldung } from './zustand';
import k from './Baukasten.module.scss';

/**
 * **Eigenes Logo** in der Leiste „Design“ (Alwin, 14.10.2026): bisherige Logos zur Auswahl, dazu „Neues
 * hochladen“. Entfernen dürfen nur Gruppen-Admins (wie endgültiges Löschen) – mit Warnung, denn jedes Formular,
 * das das Logo zeigt, hat danach keins mehr. Nichts wird von selbst gelöscht: Kopien nutzen dasselbe Logo.
 */
export function LogoAuswahl({
  veranstaltungId,
  gewaehlt,
  onWaehlen,
  onEntfernt,
}: {
  veranstaltungId: number;
  /** Adresse des gewählten eigenen Logos (oder `null`). */
  gewaehlt: string | null;
  onWaehlen: (url: string) => void;
  /** Ein Logo wurde gelöscht – war es das gewählte, braucht das Formular ein anderes. */
  onEntfernt: (url: string) => void;
}) {
  const [liste, setListe] = useState<EigenesLogo[] | undefined>(undefined);
  const [admin, setAdmin] = useState(false);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [frage, setFrage] = useState<EigenesLogo | null>(null);
  const datei = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let aktuell = true;
    logoListe(veranstaltungId).then(
      (l) => aktuell && setListe(l),
      (e: unknown) => {
        if (!aktuell) return;
        setListe([]);
        setFehler(fehlerMeldung(e).text);
      },
    );
    istGruppenAdmin().then(
      (a) => aktuell && setAdmin(a),
      () => undefined,
    );
    return () => {
      aktuell = false;
    };
  }, [veranstaltungId]);

  async function hochladen(d: File) {
    setArbeitet(true);
    setFehler(null);
    try {
      const neu = await logoHochladen(veranstaltungId, d);
      setListe((l) => [neu, ...(l ?? [])]);
      onWaehlen(neu.url);
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
    }
    setArbeitet(false);
  }

  async function entfernen(l: EigenesLogo) {
    setArbeitet(true);
    setFehler(null);
    try {
      await logoEntfernen(l.id);
      setListe((alt) => (alt ?? []).filter((x) => x.id !== l.id));
      setFrage(null);
      onEntfernt(l.url);
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
    }
    setArbeitet(false);
  }

  return (
    <div className={k.logoAuswahl}>
      {liste === undefined ? (
        <p className={k.klein}>Logos werden geladen …</p>
      ) : (
        <div className={k.logoListe}>
          {liste.map((l) => (
            <button
              key={l.id}
              type="button"
              className={k.logoKachel}
              aria-pressed={l.url === gewaehlt}
              title={l.name}
              disabled={arbeitet}
              onClick={() => onWaehlen(l.url)}
            >
              <img src={titelbildGross(l.url, 160)} alt={l.name} />
            </button>
          ))}
          <button
            type="button"
            className={`${k.logoKachel} ${k.logoNeu}`}
            disabled={arbeitet}
            onClick={() => datei.current?.click()}
          >
            {arbeitet ? 'Lädt …' : '+ Neues hochladen'}
          </button>
        </div>
      )}
      {admin && liste && liste.length > 0 && !frage && (
        <label className={k.logoEntfernen}>
          <span>Ein Logo entfernen:</span>
          <select
            value=""
            aria-label="Logo entfernen"
            onChange={(e) => setFrage(liste.find((l) => String(l.id) === e.target.value) ?? null)}
          >
            <option value="">– wählen –</option>
            {liste.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {frage && (
        <div className={k.logoWarnung} role="alert">
          <p>
            „{frage.name}“ wirklich entfernen? Jedes Formular, das dieses Logo zeigt, hat danach
            keins mehr.
          </p>
          <button type="button" disabled={arbeitet} onClick={() => void entfernen(frage)}>
            Entfernen
          </button>
          <button type="button" disabled={arbeitet} onClick={() => setFrage(null)}>
            Abbrechen
          </button>
        </div>
      )}
      {fehler && (
        <p className={k.logoFehler} role="alert">
          {fehler}
        </p>
      )}
      <input
        ref={datei}
        type="file"
        accept="image/*"
        hidden
        aria-label="Eigenes Logo hochladen"
        onChange={(ev) => {
          const d = ev.target.files?.[0];
          ev.target.value = '';
          if (d) void hochladen(d);
        }}
      />
    </div>
  );
}
