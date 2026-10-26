import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import {
  STATUS,
  archivListe,
  istGruppenAdmin,
  loeschenEndgueltig,
  setzeStatus,
  type Archiviert,
} from './einrichten';
import { Fehler } from './Bearbeiten';
import { useSpeichern } from './useSpeichern';
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
  const [bestaetigung, setBestaetigung] = useState('');
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

  const { arbeitet, fehler: loeschFehler, speichern } = useSpeichern(() => {});

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
                      <button
                        type="button"
                        className={v.bearbeiten}
                        onClick={() => void wiederherstellen(x)}
                      >
                        Wiederherstellen
                      </button>
                      {admin && (
                        <button
                          type="button"
                          className={v.endgueltig}
                          onClick={() => {
                            setBestaetigung('');
                            setLoeschen(x);
                          }}
                        >
                          Endgültig löschen
                        </button>
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
        <Sheet
          title="Endgültig löschen?"
          onClose={() => setLoeschen(null)}
          beschaeftigt={arbeitet}
          knoepfe={
            <FensterKnopf
              art="gefahr"
              disabled={bestaetigung.trim() !== loeschen.name.trim() || arbeitet}
              onClick={() =>
                speichern(
                  () => loeschenEndgueltig(loeschen.id),
                  () => {
                    onGeaendert({
                      text: `„${loeschen.name}“ wurde endgültig gelöscht.`,
                      rueckgaengig: null,
                    });
                    setLoeschen(null);
                    laden();
                  },
                )
              }
            >
              {arbeitet ? 'Wird gelöscht …' : 'Endgültig löschen'}
            </FensterKnopf>
          }
        >
          <p className={f.fehler}>
            „{loeschen.name}“ wird mit <b>allen Anmeldungen</b> aus ChurchTools gelöscht. Das lässt
            sich nicht rückgängig machen.
          </p>
          <label className={f.feld}>
            <span>Zum Bestätigen den Namen eintippen</span>
            <input
              className={f.eingabe}
              value={bestaetigung}
              autoComplete="off"
              onChange={(e) => setBestaetigung(e.target.value)}
            />
          </label>
          <Fehler text={loeschFehler} />
        </Sheet>
      )}
    </div>
  );
}
