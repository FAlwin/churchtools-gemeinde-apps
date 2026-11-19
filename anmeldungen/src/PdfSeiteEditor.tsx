import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Segment } from '@ui/bedienung/Segment';
import {
  PDF_FELDER_MAX,
  PDF_FELD_ARTEN,
  PDF_FELD_NAME,
  PDF_SCHRIFTEN,
  PDF_UNTERSCHRIFT_BREITEN,
  PDF_UNTERSCHRIFT_STANDARD,
  PDF_VORSATZ_MAX,
  pdfFeldBeispiel,
  pdfFeldStil,
  pdfHintergrundStil,
  pdfNeuesFeld,
  pdfSeitenStil,
  type PdfFeld,
  type PdfFeldArt,
  type PdfSeite,
} from '@shared/anmeldung/nachweisAntrag';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import n from './Nachweise.module.scss';

/** 1 mm in CSS-Pixeln (96 dpi). */
const PX_JE_MM = 96 / 25.4;
/** Schritt der Pfeiltasten in Prozent der Seite (mit Umschalt größer). */
const SCHRITT = 0.5;
const SCHRITT_GROSS = 2;

const klemm = (x: number, von: number, bis: number) => Math.min(Math.max(x, von), bis);
const rund = (x: number) => Math.round(x * 100) / 100;

/**
 * **Die Seite der eigenen PDF mit ziehbaren Platzhaltern** (N1d, Entwurf `n-nachweise-v2`, Ansicht 3). Das Hintergrundbild
 * und jeder Platzhalter liegen genau so wie im HTML für ChurchTools: dieselben Stilfunktionen (`pdfFeldStil`, `pdfSeitenStil`,
 * `pdfHintergrundStil` aus `nachweisAntrag.ts`), **Anker = linke obere Ecke**, Positionen in Prozent der Seite. Die Seite wird
 * in ihrer wirklichen Größe (mm) gezeichnet und per `transform` auf die Fensterbreite verkleinert – Schrift und Lage stimmen
 * dadurch auch am Handy.
 *
 * Bedienung: Ziehen mit Maus oder Finger (Pointer-Events, `touch-action: none` an den Platzhaltern – die Seite selbst lässt
 * das Scrollen zu), Pfeiltasten verschieben den gewählten Platzhalter (Umschalt: größere Schritte), Entf entfernt ihn.
 * Schrift, Breite der Unterschrift und „Text davor“ stehen unter der Seite – dort ist auch „Entfernen“ mit großer Fläche.
 */
export function PdfSeiteEditor({
  seite,
  hintergrund,
  unterschrift,
  heute,
  onFelder,
}: {
  seite: PdfSeite;
  /** Erste Seite der PDF als Bild (`null`: wird nicht angezeigt, z. B. bisheriges Bild nicht lesbar). */
  hintergrund: string | null;
  unterschrift: string | null;
  /** „19. November 2026“ – für das Beispiel von `[Heute]`. */
  heute: string;
  onFelder: (felder: PdfFeld[]) => void;
}) {
  const rahmen = useRef<HTMLDivElement>(null);
  const seiteEl = useRef<HTMLDivElement>(null);
  const zieh = useRef<{
    id: string;
    px: number;
    py: number;
    x: number;
    y: number;
    breite: number;
    hoehe: number;
    chipB: number;
    chipH: number;
  } | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const breitePx = seite.breiteMm * PX_JE_MM;
  const hoehePx = seite.hoeheMm * PX_JE_MM;
  const [skala, setSkala] = useState(0.5);
  useEffect(() => {
    const el = rahmen.current;
    if (!el) return;
    const messen = () => setSkala(Math.min(1, el.clientWidth / breitePx) || 0.5);
    messen();
    if (typeof ResizeObserver === 'undefined') return;
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [breitePx]);

  const felder = seite.felder;
  const sel = felder.find((pf) => pf.id === gewaehlt) ?? null;
  const aendern = (id: string, teil: Partial<PdfFeld>) =>
    onFelder(felder.map((pf) => (pf.id === id ? { ...pf, ...teil } : pf)));
  const entfernen = (id: string) => {
    onFelder(felder.filter((pf) => pf.id !== id));
    setGewaehlt(null);
  };
  const dazu = (art: PdfFeldArt) => {
    // Neue Platzhalter erscheinen links oben, jeder etwas tiefer – gut zu sehen, nie genau übereinander.
    const neu = pdfNeuesFeld(felder, art, 10, Math.min(90, 8 + 5 * felder.length));
    onFelder([...felder, neu]);
    setGewaehlt(neu.id);
  };

  function runter(e: PointerEvent<HTMLElement>, pf: PdfFeld) {
    e.preventDefault();
    e.stopPropagation();
    setGewaehlt(pf.id);
    const r = seiteEl.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return;
    const c = e.currentTarget.getBoundingClientRect();
    zieh.current = {
      id: pf.id,
      px: e.clientX,
      py: e.clientY,
      x: pf.x,
      y: pf.y,
      breite: r.width,
      hoehe: r.height,
      chipB: (c.width / r.width) * 100,
      chipH: (c.height / r.height) * 100,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function bewegt(e: PointerEvent<HTMLElement>) {
    const z = zieh.current;
    if (!z) return;
    const x = klemm(z.x + ((e.clientX - z.px) / z.breite) * 100, 0, Math.max(0, 100 - z.chipB));
    const y = klemm(z.y + ((e.clientY - z.py) / z.hoehe) * 100, 0, Math.max(0, 100 - z.chipH));
    aendern(z.id, { x: rund(x), y: rund(y) });
  }
  const los = () => {
    zieh.current = null;
  };
  function taste(e: KeyboardEvent<HTMLElement>, pf: PdfFeld) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      return entfernen(pf.id);
    }
    const s = e.shiftKey ? SCHRITT_GROSS : SCHRITT;
    const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0;
    const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    aendern(pf.id, { x: rund(klemm(pf.x + dx, 0, 100)), y: rund(klemm(pf.y + dy, 0, 100)) });
  }

  const hatUnterschrift = felder.some((pf) => pf.art === 'Unterschrift');
  return (
    <div className={n.pdfEditor}>
      <p className={a.leise}>
        Platzhalter dazu:{' '}
        {PDF_FELD_ARTEN.map((art) => (
          <button
            key={art}
            type="button"
            className={`${a.pille} ${a.platzhalterKnopf}`}
            disabled={
              (art === 'Unterschrift' && hatUnterschrift) || felder.length >= PDF_FELDER_MAX
            }
            onClick={() => dazu(art)}
          >
            {PDF_FELD_NAME[art]}
          </button>
        ))}
      </p>
      <div
        ref={rahmen}
        className={n.pdfRahmen}
        style={{ height: hoehePx * skala }}
        data-testid="pdf-rahmen"
      >
        <div
          ref={seiteEl}
          className={n.pdfSeite}
          data-testid="pdf-seite"
          style={{
            ...pdfSeitenStil(seite),
            position: 'absolute',
            transform: `scale(${skala})`,
          }}
          onPointerDown={() => setGewaehlt(null)}
        >
          {hintergrund && (
            <img
              src={hintergrund}
              alt="Erste Seite der hochgeladenen PDF"
              draggable={false}
              style={pdfHintergrundStil(seite)}
            />
          )}
          {felder.map((pf) => (
            <span
              key={pf.id}
              role="button"
              tabIndex={0}
              data-feld={pf.id}
              aria-label={`${PDF_FELD_NAME[pf.art]} – mit Maus, Finger oder Pfeiltasten verschieben, Entf entfernt`}
              aria-pressed={gewaehlt === pf.id}
              className={`${n.pdfChip} ${gewaehlt === pf.id ? n.pdfChipGewaehlt : ''}`}
              style={pdfFeldStil(pf)}
              onPointerDown={(e) => runter(e, pf)}
              onPointerMove={bewegt}
              onPointerUp={los}
              onPointerCancel={los}
              onKeyDown={(e) => taste(e, pf)}
              onFocus={() => setGewaehlt(pf.id)}
            >
              {pf.art === 'Unterschrift' ? (
                unterschrift ? (
                  <img
                    src={unterschrift}
                    alt=""
                    draggable={false}
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                  />
                ) : (
                  <span className={n.pdfUnterschriftLeer}>Unterschrift</span>
                )
              ) : (
                pdfFeldBeispiel(pf, heute)
              )}
            </span>
          ))}
        </div>
      </div>

      {sel ? (
        <div className={n.pdfWerkzeug} role="group" aria-label="Ausgewählter Platzhalter">
          <b>{PDF_FELD_NAME[sel.art]}</b>
          {sel.art === 'Unterschrift' ? (
            <Segment<string>
              ariaLabel="Breite der Unterschrift in Millimetern"
              value={String(sel.breiteMm ?? PDF_UNTERSCHRIFT_STANDARD)}
              onChange={(v) => aendern(sel.id, { breiteMm: Number(v) })}
              options={PDF_UNTERSCHRIFT_BREITEN.map((b) => ({
                value: String(b),
                label: `${b} mm`,
              }))}
            />
          ) : (
            <Segment<string>
              ariaLabel="Schriftgröße"
              value={String(sel.pt)}
              onChange={(v) => aendern(sel.id, { pt: Number(v) })}
              options={PDF_SCHRIFTEN.map((p) => ({ value: String(p), label: `${p} pt` }))}
            />
          )}
          {sel.art === 'Heute' && (
            <input
              className={n.pdfDavor}
              aria-label="Text vor dem Datum"
              placeholder="Text davor, z. B. Lohmar, "
              value={sel.vorsatz ?? ''}
              maxLength={PDF_VORSATZ_MAX}
              onChange={(ev) =>
                aendern(sel.id, {
                  vorsatz: ev.target.value === '' ? undefined : ev.target.value,
                })
              }
            />
          )}
          <button
            type="button"
            className={f.textKnopf}
            aria-label={`${PDF_FELD_NAME[sel.art]} entfernen`}
            onClick={() => entfernen(sel.id)}
          >
            Entfernen
          </button>
        </div>
      ) : (
        <p className={a.leise}>
          Einen Platzhalter antippen, um Schrift oder Breite zu ändern – oder ihn an die richtige
          Stelle ziehen.
        </p>
      )}
    </div>
  );
}
