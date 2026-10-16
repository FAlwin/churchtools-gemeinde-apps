import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  erziehungAus,
  unterschriftAus,
  type Antwort,
  type Erziehungsberechtigter,
  type Feld,
} from '@shared/anmeldung/formular';
import {
  BREITE,
  HOEHE,
  unterschriftLesen,
  unterschriftText,
  type Punkt,
  type Strich,
} from '@shared/anmeldung/unterschrift';
import { useMedienAbfrage } from '../bedienung/useMedienAbfrage';
import s from './AnmeldeFormular.module.scss';

/**
 * **Zusammengesetzte Bausteine des Formulars** (A6-2b, Entwurf `a6-2b-entwurf-v2`, Alwin 14./15.10.2026):
 * „Erziehungsberechtigte“ und „Unterschrift“. Beide gibt es einmal je Anmeldung; die Regeln (Pflicht, Ablage in
 * ChurchTools) stehen in `@shared/anmeldung` – hier nur, wie Gäste sie ausfüllen.
 */

interface Props {
  feld: Feld;
  wert: Antwort;
  onWert: (w: Antwort) => void;
  pfad: string;
  fehler: string[];
  gesperrt: boolean;
  /** Hinter der Überschrift – im Baukasten das ⓘ. */
  zusatz: ReactNode;
}

function Kopf({ feld: f, zusatz }: { feld: Feld; zusatz: ReactNode }) {
  return (
    <div className={s.bausteinKopf}>
      <b>
        {f.frage}
        {f.zustand === 'pflicht' ? (
          <span className={s.req} aria-hidden="true">
            *
          </span>
        ) : (
          <span className={s.opt}> (freiwillig)</span>
        )}
        {zusatz}
      </b>
      {f.hilfe && <span className={s.help}>{f.hilfe}</span>}
    </div>
  );
}

const LEER: Erziehungsberechtigter = { vor: '', nach: '', tel: '' };

/**
 * **Erziehungsberechtigte**: die erste Person (Name, Telefon) und das Häkchen sind Pflicht, eine zweite Person
 * freiwillig – „+ Zweite erziehungsberechtigte Person“ wie im Entwurf.
 */
export function ErziehungsEingabe({
  feld: f,
  wert,
  onWert,
  pfad,
  fehler,
  gesperrt,
  zusatz,
}: Props) {
  const e = erziehungAus(wert);
  const personen = e.personen.length ? e.personen : [LEER];
  const pflicht = f.zustand === 'pflicht';
  const id = `af-${pfad}`;
  const hat = (unter: string) => fehler.includes(`${pfad}.${unter}`);
  const setze = (i: number, teil: keyof Erziehungsberechtigter, v: string) =>
    onWert({
      ...e,
      personen: personen.map((p, j) => (j === i ? { ...p, [teil]: v } : p)),
    });

  return (
    <div className={s.baustein}>
      <Kopf feld={f} zusatz={zusatz} />
      {personen.map((p, i) => (
        <div key={i} className={i > 0 ? s.zweitePerson : undefined}>
          {i > 0 && (
            <div className={s['person-top']}>
              <span className={s.help}>Zweite Person (freiwillig)</span>
              {!gesperrt && (
                <button
                  type="button"
                  className={s.xbtn}
                  onClick={() => onWert({ ...e, personen: personen.slice(0, 1) })}
                >
                  Entfernen
                </button>
              )}
            </div>
          )}
          <div className={s.g2}>
            {(['vor', 'nach'] as const).map((teil) => (
              <div key={teil} className={`${s.pf} ${hat(`${i}.${teil}`) ? s.bad : ''}`}>
                <label htmlFor={`${id}-${i}-${teil}`}>
                  {teil === 'vor' ? 'Vorname' : 'Nachname'}
                  {i === 0 && pflicht && (
                    <span className={s.req} aria-hidden="true">
                      *
                    </span>
                  )}
                </label>
                <input
                  id={`${id}-${i}-${teil}`}
                  value={p[teil]}
                  maxLength={60}
                  disabled={gesperrt}
                  autoComplete={i === 0 ? (teil === 'vor' ? 'given-name' : 'family-name') : 'off'}
                  onChange={(ev) => setze(i, teil, ev.target.value)}
                />
                {hat(`${i}.${teil}`) && (
                  <span className={s.err}>
                    {teil === 'vor' ? 'Bitte Vornamen eintragen.' : 'Bitte Nachnamen eintragen.'}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className={`${s.pf} ${hat(`${i}.tel`) ? s.bad : ''}`}>
            <label htmlFor={`${id}-${i}-tel`}>
              {i === 0 ? 'Telefon (während der Veranstaltung erreichbar)' : 'Telefon'}
              {i === 0 && pflicht && (
                <span className={s.req} aria-hidden="true">
                  *
                </span>
              )}
            </label>
            <input
              id={`${id}-${i}-tel`}
              type="tel"
              value={p.tel}
              maxLength={40}
              disabled={gesperrt}
              autoComplete={i === 0 ? 'tel' : 'off'}
              onChange={(ev) => setze(i, 'tel', ev.target.value)}
            />
            {hat(`${i}.tel`) && <span className={s.err}>Bitte eine Telefonnummer eintragen.</span>}
          </div>
        </div>
      ))}
      {personen.length < 2 && (
        <button
          type="button"
          className={s.addbtn}
          disabled={gesperrt}
          onClick={() => onWert({ ...e, personen: [...personen, LEER] })}
        >
          + Zweite erziehungsberechtigte Person
        </button>
      )}
      <label className={`${s.check} ${hat('ok') ? s.bad : ''}`}>
        <input
          type="checkbox"
          checked={e.einverstanden}
          disabled={gesperrt}
          onChange={(ev) => onWert({ ...e, personen, einverstanden: ev.target.checked })}
        />
        <span>
          Ich bin erziehungsberechtigt für die angemeldeten Kinder und mit der Teilnahme
          einverstanden.
          {pflicht && (
            <span className={s.req} aria-hidden="true">
              *
            </span>
          )}
        </span>
      </label>
      {hat('ok') && <span className={s.err}>Bitte ankreuzen.</span>}
    </div>
  );
}

/** Die Striche als Bild – für die Vorschau im Formular (und später Reiter Anmeldungen, Druckliste). */
export function UnterschriftBild({ striche }: { striche: Strich[] }) {
  return (
    <svg
      viewBox={`0 0 ${BREITE} ${HOEHE}`}
      className={s.unterschriftBild}
      role="img"
      aria-label="Unterschrift"
    >
      {striche.map((st, i) =>
        st.length === 1 ? (
          <circle key={i} cx={st[0][0]} cy={st[0][1]} r={2.4} fill="currentColor" />
        ) : (
          <polyline
            key={i}
            points={st.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </svg>
  );
}

/** Striche auf die Leinwand – die Fläche `BREITE × HOEHE` auf die tatsächliche Größe gestreckt (beides 2:1). */
function zeichne(c: HTMLCanvasElement | null, striche: Strich[], aktuell: Punkt[] | null) {
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return;
  const sx = c.width / BREITE;
  const sy = c.height / HOEHE;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.lineWidth = 2.6 * sx;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#17242a';
  for (const st of aktuell ? [...striche, aktuell] : striche) {
    ctx.beginPath();
    st.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)));
    if (st.length === 1) ctx.lineTo(st[0][0] * sx + 0.1, st[0][1] * sy);
    ctx.stroke();
  }
}

/**
 * **Die Zeichenfläche** – Maus, Finger oder Stift (Pointer-Events). Feste Fläche `BREITE × HOEHE` (2:1) auf jedem
 * Bildschirm, sonst würde die Unterschrift verzerrt. Meldet die Striche nach jedem abgesetzten Strich.
 */
function Zeichenflaeche({
  striche,
  onStriche,
}: {
  striche: Strich[];
  onStriche: (s: Strich[]) => void;
}) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const aktuell = useRef<Punkt[] | null>(null);

  // Größe nachführen (Drehen des Handys, Vollbild) und zeichnen – die Fläche selbst bleibt 2:1.
  useEffect(() => {
    const c = leinwand.current;
    if (!c) return;
    const anpassen = () => {
      const r = c.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      c.width = Math.max(1, Math.round(r.width * d));
      c.height = Math.max(1, Math.round(r.height * d));
      zeichne(c, striche, aktuell.current);
    };
    anpassen();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(anpassen);
    ro.observe(c);
    return () => ro.disconnect();
  }, [striche]);

  const punkt = (ev: ReactPointerEvent): Punkt => {
    const r = leinwand.current!.getBoundingClientRect();
    return [
      Math.round(((ev.clientX - r.left) / r.width) * BREITE),
      Math.round(((ev.clientY - r.top) / r.height) * HOEHE),
    ];
  };

  return (
    <div className={s.zeichen}>
      <canvas
        ref={leinwand}
        aria-label="Hier unterschreiben"
        onPointerDown={(ev) => {
          ev.currentTarget.setPointerCapture?.(ev.pointerId);
          aktuell.current = [punkt(ev)];
          zeichne(leinwand.current, striche, aktuell.current);
        }}
        onPointerMove={(ev) => {
          const a = aktuell.current;
          if (!a) return;
          const p = punkt(ev);
          const l = a[a.length - 1];
          if (p[0] !== l[0] || p[1] !== l[1]) {
            a.push(p);
            zeichne(leinwand.current, striche, a);
          }
        }}
        onPointerUp={() => {
          if (!aktuell.current) return;
          const neu = [...striche, aktuell.current];
          aktuell.current = null;
          onStriche(neu);
        }}
        onPointerCancel={() => {
          aktuell.current = null;
          zeichne(leinwand.current, striche, null);
        }}
      />
      <span className={s.zeichenLinie} aria-hidden="true" />
      <span className={s.zeichenX} aria-hidden="true">
        ✕
      </span>
      {striche.length === 0 && (
        <span className={s.zeichenLeer} aria-hidden="true">
          Hier unterschreiben
        </span>
      )}
    </div>
  );
}

/**
 * **Unterschrift**: Am Computer zeichnet man direkt im Formular. **Am Handy** (Touch oder schmaler Bildschirm)
 * steht dort nur „Tippen zum Unterschreiben“ – ein Tipp öffnet die Fläche im Vollbild (Alwin, 15.10.2026: „am Handy
 * muss sich da ein Fenster im Vollbild öffnen“), quer gehalten wird sie groß.
 */
export function UnterschriftEingabe({
  feld: f,
  wert,
  onWert,
  pfad,
  fehler,
  gesperrt,
  zusatz,
}: Props) {
  const text = unterschriftAus(wert);
  const striche = (text && unterschriftLesen(text)) || [];
  const handy = useMedienAbfrage('(pointer: coarse), (max-width: 599px)');
  // Das Vollbild hängt an `body`, außerhalb des Formulars – es nimmt dessen Akzentfarbe mit.
  const [vollbild, setVollbild] = useState<{ vorher: string; akzent: string } | null>(null);
  const kasten = useRef<HTMLDivElement>(null);
  const hat = fehler.includes(pfad);
  const setze = (st: Strich[]) => onWert({ striche: unterschriftText(st) ?? '' });

  return (
    <div ref={kasten} className={`${s.baustein} ${hat ? s.bad : ''}`}>
      <Kopf feld={f} zusatz={zusatz} />
      {gesperrt ? (
        <div className={s.zeichen} aria-label="Hier unterschreiben">
          <span className={s.zeichenLinie} aria-hidden="true" />
          <span className={s.zeichenX} aria-hidden="true">
            ✕
          </span>
          <span className={s.zeichenLeer}>Hier unterschreiben</span>
        </div>
      ) : handy ? (
        <button
          type="button"
          className={s.tippfeld}
          onClick={() =>
            setVollbild({
              vorher: text,
              akzent: kasten.current
                ? getComputedStyle(kasten.current).getPropertyValue('--p-accent').trim()
                : '',
            })
          }
        >
          {striche.length ? <UnterschriftBild striche={striche} /> : '✍️ Tippen zum Unterschreiben'}
        </button>
      ) : (
        <Zeichenflaeche striche={striche} onStriche={setze} />
      )}
      {!gesperrt && striche.length > 0 && (
        <div className={s['person-top']}>
          <span className={s.help}>Unterschrieben</span>
          <button type="button" className={s.xbtn} onClick={() => onWert({ striche: '' })}>
            Löschen
          </button>
        </div>
      )}
      {hat && <span className={s.err}>Bitte unterschreiben.</span>}
      {vollbild &&
        createPortal(
          <div
            className={s.vollbild}
            role="dialog"
            aria-modal="true"
            aria-label="Unterschreiben"
            style={
              vollbild.akzent ? ({ '--p-accent': vollbild.akzent } as CSSProperties) : undefined
            }
          >
            <div className={s.vollbildKopf}>
              <b>{f.frage}</b>
              <button type="button" className={s.vollbildKnopf} onClick={() => setze([])}>
                Löschen
              </button>
            </div>
            <p className={s.quer}>↻ Für mehr Platz das Handy quer halten</p>
            <div className={s.vollbildFlaeche}>
              <Zeichenflaeche striche={striche} onStriche={setze} />
            </div>
            <div className={s.vollbildFuss}>
              <button
                type="button"
                className={s.vollbildKnopf}
                onClick={() => {
                  onWert({ striche: vollbild.vorher });
                  setVollbild(null);
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className={`${s.vollbildKnopf} ${s.vollbildFertig}`}
                onClick={() => setVollbild(null)}
              >
                Fertig
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
