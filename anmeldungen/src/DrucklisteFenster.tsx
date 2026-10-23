import { useEffect, useMemo, useState } from 'react';
import type { jsPDF } from 'jspdf';
import { Sheet } from '@ui/fenster/Sheet';
import { Segment } from '@ui/bedienung/Segment';
import { listenPdf } from '@ui/teilen/listenPdf';
import { downloadPdf, sharePdf } from '@ui/teilen/sharePdf';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { listenZahlen, type ListenAnmeldung } from '@shared/anmeldung/liste';
import {
  druckDateiname,
  druckTabelle,
  druckWahlFuer,
  listenAngebot,
  teilnehmerSpalten,
  type DruckSortierung,
  type ListenArt,
  type DruckWahl,
} from '@shared/anmeldung/druckliste';
import { aendereEinstellungen } from './einrichten';
import { fehlerMeldung } from './zustand';
import s from './Startseite.module.scss';
import a from './AnmeldungenReiter.module.scss';
import f from './Formular.module.scss';
import d from './DrucklisteFenster.module.scss';

const stempel = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * **Druckliste** (A8, Entwurf `a8-druckliste-v1`, abgenommen 23.10.2026) – Listen als PDF, auf Wunsch mit Warteliste;
 * Vorschau und PDF kommen aus derselben Tabelle (`druckTabelle`). Vorn stehen die Listen, die zum Formular passen,
 * „＋ weitere“ öffnet den Rest (A8-2). Bei den Teilnehmern: Spalten aus den Fragen und Sortierung – die Wahl merkt sich
 * die Veranstaltung, gespeichert beim Teilen/Herunterladen, wenn sie sich geändert hat und man sie ändern darf.
 *
 * Das PDF entsteht, sobald sich etwas ändert, nicht erst beim Antippen: iOS öffnet das Teilen-Menü nur direkt nach
 * dem Tippen (wie im Teilen-Fenster der Musik-App).
 */
export function DrucklisteFenster({
  id,
  e,
  veranstaltung,
  gemeinde,
  liste,
  darf,
  onGemerkt,
  onClose,
}: {
  id: number;
  e: OeffentlicheEinstellungen;
  veranstaltung: string;
  gemeinde: string | null;
  liste: ListenAnmeldung[];
  darf: boolean;
  /** Die Wahl wurde gespeichert – die Seite liest die Einstellungen neu. */
  onGemerkt: () => void;
  onClose: () => void;
}) {
  const gemerkt = useMemo(() => druckWahlFuer(e), [e]);
  const [wahl, setWahl] = useState<DruckWahl>(gemerkt);
  const [mitWarteliste, setMitWarteliste] = useState(false);
  const angebot = useMemo(() => listenAngebot(e), [e]);
  const [art, setArt] = useState<ListenArt>('teilnehmer');
  const [alleZeigen, setAlleZeigen] = useState(false);
  const gewaehlt = angebot.find((l) => l.art === art) ?? angebot[0];
  const [pdf, setPdf] = useState<jsPDF | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [merkFehler, setMerkFehler] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);

  const spalten = teilnehmerSpalten(e);
  const tabelle = useMemo(
    () => druckTabelle(art, e, liste, wahl, mitWarteliste),
    [art, e, liste, wahl, mitWarteliste],
  );
  // Dieselben Zahlen wie oben im Reiter.
  const { belegt: mitPlatz, wartend } = listenZahlen(e, liste);
  const titel = gemeinde ? `${gemeinde} · ${veranstaltung}` : veranstaltung;
  const [stand] = useState(() => `Stand ${stempel.format(new Date())}`);

  useEffect(() => {
    // Wer während des Bauens umschaltet, bekommt das PDF zur NEUEN Wahl – das alte wird verworfen.
    let aktuell = true;
    setPdf(null);
    setGeladen(false);
    listenPdf({ titel, liste: gewaehlt.titel, stand, ...tabelle }).then(
      (doc) => {
        if (aktuell) {
          setPdf(doc);
          setFehler(null);
        }
      },
      (x: unknown) => {
        if (aktuell) setFehler(fehlerMeldung(x).text);
      },
    );
    return () => {
      aktuell = false;
    };
  }, [titel, stand, tabelle, gewaehlt.titel]);

  const umschalten = (schluessel: string) =>
    setWahl((w) => ({
      ...w,
      // In der Reihenfolge der Spalten, nicht der Klicks – so steht es auch auf dem Blatt.
      spalten: spalten
        .map((x) => x.schluessel)
        .filter((k) => (k === schluessel ? !w.spalten.includes(k) : w.spalten.includes(k))),
    }));

  /** Die Wahl merken – ein Fehler dabei hält das Drucken nicht auf, er wird nur genannt. */
  function merken() {
    const gleich =
      wahl.sortierung === gemerkt.sortierung &&
      wahl.spalten.join('|') === gemerkt.spalten.join('|');
    if (!darf || gleich) return;
    setMerkFehler(null);
    aendereEinstellungen(id, (x) => ({ ...x, druck: wahl })).then(onGemerkt, (x: unknown) =>
      setMerkFehler(`Die Spaltenwahl ist nicht gemerkt: ${fehlerMeldung(x).text}`),
    );
  }

  const datei = druckDateiname(veranstaltung, gewaehlt.titel);
  const sichtbar = angebot.filter((l) => l.passt || alleZeigen || l.art === art);
  const listenKnopf = (l: (typeof angebot)[number]) => (
    <button
      key={l.art}
      type="button"
      className={s.filterChip}
      aria-pressed={l.art === art}
      onClick={() => setArt(l.art)}
    >
      {l.titel}
    </button>
  );

  return (
    <Sheet title="Druckliste" onClose={onClose}>
      <p className={a.unterTitel}>{veranstaltung} · aus ChurchTools, Stand jetzt</p>
      <section className={a.teil}>
        <h3>Liste</h3>
        <div className={d.chips}>
          {sichtbar.map(listenKnopf)}
          {sichtbar.length < angebot.length && (
            <button type="button" className={d.weitere} onClick={() => setAlleZeigen(true)}>
              ＋ weitere
            </button>
          )}
        </div>
        {gewaehlt.hinweis && <p className={a.hinweisBlau}>{gewaehlt.hinweis}</p>}
      </section>
      <section className={a.teil}>
        <h3>Einstellungen</h3>
        {wartend > 0 && (
          <div className={d.zeile}>
            <span>Wer</span>
            <Segment
              value={mitWarteliste ? 'alle' : 'platz'}
              options={[
                { value: 'platz', label: `Mit Platz (${mitPlatz})` },
                { value: 'alle', label: `Auch Warteliste (${mitPlatz + wartend})` },
              ]}
              onChange={(v) => setMitWarteliste(v === 'alle')}
              ariaLabel="Wer"
            />
          </div>
        )}
        {art === 'teilnehmer' && (
          <>
            <div className={d.zeile}>
              <span>Spalten</span>
              <div className={d.chips}>
                {spalten.map((x) => (
                  <button
                    key={x.schluessel}
                    type="button"
                    className={s.filterChip}
                    aria-pressed={wahl.spalten.includes(x.schluessel)}
                    onClick={() => umschalten(x.schluessel)}
                  >
                    {x.titel}
                  </button>
                ))}
              </div>
            </div>
            <div className={d.zeile}>
              <span>Sortiert nach</span>
              <Segment<DruckSortierung>
                value={wahl.sortierung}
                options={[
                  { value: 'nachname', label: 'Nachname' },
                  { value: 'alter', label: 'Alter' },
                  { value: 'anmeldung', label: 'Anmeldung' },
                ]}
                onChange={(v) => setWahl((w) => ({ ...w, sortierung: v }))}
                ariaLabel="Sortiert nach"
              />
            </div>
          </>
        )}
      </section>
      <section className={a.teil}>
        <h3>Vorschau</h3>
        <div className={d.papier} aria-label="Vorschau">
          <div className={d.kopf}>
            <b>{titel}</b>
            <span>{gewaehlt.titel}</span>
          </div>
          {tabelle.oben && <p className={d.oben}>{tabelle.oben}</p>}
          <table>
            <thead>
              <tr>
                {/* Zwei Fragen können gleich heißen (Test-Instanz: zweimal „Anzahl“) – Schlüssel ist die Stelle. */}
                {tabelle.kopf.map((k, i) => (
                  <th key={i}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabelle.zeilen.map((z, i) =>
                'abschnitt' in z ? (
                  <tr key={i} className={d.abschnitt}>
                    <td colSpan={tabelle.kopf.length}>{z.abschnitt}</td>
                  </tr>
                ) : (
                  <tr key={i}>
                    {z.zellen.map((t, j) => (
                      <td key={j}>{t}</td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
          <p className={d.summe}>{tabelle.summe}</p>
          <div className={d.fuss}>
            <span>{stand}</span>
            <span>
              {pdf
                ? `${pdf.getNumberOfPages()} ${pdf.getNumberOfPages() === 1 ? 'Seite' : 'Seiten'}`
                : ''}
            </span>
          </div>
        </div>
        <p className={a.leise}>
          Das PDF verlässt ChurchTools – nur drucken, was gebraucht wird, und nach der Veranstaltung
          wegwerfen.
        </p>
      </section>
      {(fehler || merkFehler) && (
        <p className={a.hinweisRot} role="alert">
          {fehler ?? merkFehler}
        </p>
      )}
      <div className={a.knoepfe}>
        {geladen && <span className={a.leise}>Heruntergeladen</span>}
        <button
          type="button"
          className={a.linkKnopf}
          disabled={!pdf}
          onClick={() => {
            if (!pdf) return;
            downloadPdf(pdf, datei);
            setGeladen(true);
            merken();
          }}
        >
          Herunterladen
        </button>
        <button
          type="button"
          className={f.knopf}
          disabled={!pdf}
          onClick={() => {
            if (!pdf) return;
            void sharePdf(pdf, datei);
            merken();
          }}
        >
          {pdf ? 'Teilen …' : 'PDF wird erstellt …'}
        </button>
      </div>
    </Sheet>
  );
}
