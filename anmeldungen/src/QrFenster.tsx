import { useMemo } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { qrGroesse, qrMuster, qrPfad, qrPng } from '@ui/teilen/qr';
import { sharePdf } from '@ui/teilen/sharePdf';
import { shareOrDownload } from '@ui/teilen/shareFile';
import { druckDateiname } from '@shared/anmeldung/druckliste';
import { aushangPdf, type AushangDaten } from './aushang';
import a from './AnmeldungenReiter.module.scss';
import q from './QrFenster.module.scss';

/**
 * **QR-Code und Aushang** (A8-4, Entwurf `a8-druckliste-v1`, abgenommen 23.10.2026) – vierter Knopf der Karte
 * „Anmeldelink“ (Alwin, 23.10.2026). Groß der QR-Code; „QR-Code als Bild“ für Beamer und Gemeindebrief, „Aushang als
 * PDF“ für Schaukasten und Foyer.
 *
 * Bild und PDF entstehen beim Öffnen, nicht erst beim Antippen: iOS öffnet das Teilen-Menü nur direkt nach dem Tippen
 * (wie bei der Druckliste).
 */
export function QrFenster({ daten, onClose }: { daten: AushangDaten; onClose: () => void }) {
  const muster = useMemo(() => qrMuster(daten.link), [daten.link]);
  const gebaut = useLaden(
    () => Promise.all([qrPng(muster), aushangPdf(daten)]),
    [muster, daten],
  ).stand;
  const [bild, pdf] = gebaut.art === 'fertig' ? gebaut.daten : [null, null];
  const fehler = gebaut.art === 'fehler' ? gebaut.fehler.text : null;

  const seite = qrGroesse(muster);
  return (
    <Sheet
      title="QR-Code"
      onClose={onClose}
      knoepfe={
        <>
          <FensterKnopf
            art="hell"
            disabled={!bild}
            onClick={() =>
              bild && void shareOrDownload(bild, `${druckDateiname(daten.titel, 'QR-Code')}.png`)
            }
          >
            QR-Code als Bild
          </FensterKnopf>
          <FensterKnopf
            disabled={!pdf}
            onClick={() => pdf && void sharePdf(pdf, druckDateiname(daten.titel, 'Aushang'))}
          >
            {pdf ? 'Aushang als PDF' : 'Wird erstellt …'}
          </FensterKnopf>
        </>
      }
    >
      <p className={a.unterTitel}>{daten.titel} · führt zum Anmeldelink</p>
      <div className={q.rahmen}>
        <svg
          className={q.qr}
          viewBox={`0 0 ${seite} ${seite}`}
          role="img"
          aria-label={`QR-Code zu ${daten.link}`}
          shapeRendering="crispEdges"
        >
          {/* bewusst fest: QR immer schwarz auf weiß – umgekehrt lesen ihn viele Handys nicht */}
          <rect width={seite} height={seite} fill="#fff" />
          <path d={qrPfad(muster)} fill="#000" />
        </svg>
      </div>
      <p className={q.link}>{daten.link}</p>
      <p className={a.leise}>
        Zum Ausdrucken, für den Beamer oder den Gemeindebrief. Der Aushang ist ein A4-Blatt mit
        Titel, Termin, QR-Code und Link.
      </p>
      {fehler && (
        <p className={a.hinweisRot} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
