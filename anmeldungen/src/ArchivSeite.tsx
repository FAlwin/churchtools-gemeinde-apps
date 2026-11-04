import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { STATUS, archivListe, istGruppenAdmin, setzeStatus, type Archiviert } from './einrichten';
import { EndgueltigLoeschenFenster } from './EndgueltigLoeschenFenster';
import { datumText } from './anzeige';
import { fehlerMeldung, type Fehlermeldung } from './zustand';
import type { Aenderung } from './Rueckgaengig';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';
import f from './Formular.module.scss';

/**
 * **Das Archiv** (A4-Nachtrag): gelöschte Veranstaltungen – „Löschen“ verschiebt hierher (Alwin, 13.10.2026:
 * „erst Archiv“). Wiederherstellen kann, wer einrichten darf (ChurchTools prüft es); die Veranstaltung kommt
 * als Entwurf zurück. **Endgültig löschen** nur Gruppen-Admins – mit allen Anmeldungen und ohne Weg zurück,
 * deshalb muss man den Namen zur Bestätigung eintippen.
 */
export function ArchivSeite({
  artId,
  onZurueck,
  onGeaendert,
}: {
  artId: number;
  onZurueck: () => void;
  onGeaendert: (a: Aenderung) => void;
}) {
  const [liste, setListe] = useState<Archiviert[] | null>(null);
  const [admin, setAdmin] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const [loeschen, setLoeschen] = useState<Archiviert | null>(null);
  const [zeilenFehler, setZeilenFehler] = useState<string | null>(null);

  const laden = useCallback(() => {
    setFehler(null);
    Promise.all([archivListe(artId), istGruppenAdmin()]).then(
      ([l, a]) => {
        setListe(l);
        setAdmin(a);
      },
      (e: unknown) => setFehler(fehlerMeldung(e)),
    );
  }, [artId]);
  useEffect(laden, [laden]);

  async function wiederherstellen(x: Archiviert) {
    setZeilenFehler(null);
    try {
      await setzeStatus(x.id, STATUS.entwurf);
      onGeaendert({
        text: `„${x.name}“ ist wieder da – als Entwurf.`,
        rueckgaengig: () => setzeStatus(x.id, STATUS.archiviert),
      });
      laden();
    } catch (e) {
      setZeilenFehler(`„${x.name}“: ${fehlerMeldung(e).text}`);
    }
  }

  const zurueck = (
    <button type="button" className={v.zurueck} onClick={onZurueck}>
      <Icon name="chev-left" size={18} />
      Übersicht
    </button>
  );

  return (
    <div className={v.seite}>
      {zurueck}
      <header className={v.kopf}>
        <div>
          <h1>Archiv</h1>
        </div>
      </header>
      <p className={v.hinweis}>
        Gelöschte Veranstaltungen landen hier. Wiederhergestellt kommen sie als Entwurf zurück und
        lassen sich wieder freigeben.
      </p>
      {fehler && <FehlerKasten fehler={fehler} onNochmal={laden} />}
      {!fehler && liste === null && <p className={s.leise}>Wird geladen …</p>}
      {zeilenFehler && (
        <p className={f.fehler} role="alert">
          {zeilenFehler}
        </p>
      )}
      {liste && (
        <section className={s.karte} aria-label="Archiv">
          {liste.length === 0 ? (
            <p className={v.archivLeer}>Das Archiv ist leer.</p>
          ) : (
            <ul className={v.bausteine}>
              {liste.map((x) => (
                <li key={x.id}>
                  <div className={v.baustein}>
                    <span className={v.bausteinText}>
                      <b>{x.name}</b>
                      <small>
                        {[x.team, x.tag ? datumText(x.tag) : 'ohne Datum']
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    </span>
                    <span className={v.archivKnoepfe}>
                      <FensterKnopf art="zweit" onClick={() => void wiederherstellen(x)}>
                        Wiederherstellen
                      </FensterKnopf>
                      {admin && (
                        <FensterKnopf art="loeschen" onClick={() => setLoeschen(x)}>
                          Endgültig löschen
                        </FensterKnopf>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {loeschen && (
        <EndgueltigLoeschenFenster
          id={loeschen.id}
          name={loeschen.name}
          onClose={() => setLoeschen(null)}
          onGeloescht={() => {
            onGeaendert({
              text: `„${loeschen.name}“ wurde endgültig gelöscht.`,
              rueckgaengig: null,
            });
            setLoeschen(null);
            laden();
          }}
        />
      )}
    </div>
  );
}
