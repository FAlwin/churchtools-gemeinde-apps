import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  anordnen,
  HOEHE,
  type AnordnungsArt,
  type SichtKnoten,
} from '@shared/organigramm/ansichten';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { anfang, ganz, verschieben, zoomen, type Blick, type Flaeche } from './leinwand';
import { DiagrammBild } from './DiagrammBild';
import { messung, useSchrift } from './messung';
import styles from './Diagramm.module.scss';

interface Props {
  art: AnordnungsArt;
  sicht: SichtKnoten;
  onUmklappen: (schluessel: string) => void;
  onGruppe: (id: number) => void;
}

/** Erst ab so viel Bewegung ist es Ziehen statt Klicken. */
const ZIEHEN_AB = 4;

/**
 * **Das Organigramm als Diagramm** (O7b-3, Entwurf `o7b-ansichten-v1.html`): von oben, von links oder als Mindmap –
 * gerechnet in `shared/organigramm/ansichten.ts`, hier gezeichnet. Ziehen verschiebt, Mausrad und zwei Finger zoomen,
 * dazu − / + / „Ganz zeigen“. Klick (oder Enter) auf ein Kästchen öffnet die Gruppe, das runde +/− klappt auf und zu.
 * Beim Wechsel von Ansicht oder Spitze fängt der Blick neu an (lesbar groß, `leinwand.ts`); Auf- und Zuklappen lässt
 * ihn, wo er ist.
 */
export function Diagramm({ art, sicht, onUmklappen, onGruppe }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const schrift = useSchrift(svg);
  const [blick, setBlick] = useState<Blick>({ s: 1, x: 0, y: 0 });
  const [zieht, setZieht] = useState(false);

  const { breite, kuerzen } = useMemo(() => messung(schrift), [schrift]);
  const anordnung = useMemo(() => anordnen(art, sicht, breite), [art, sicht, breite]);

  const flaeche = (): Flaeche => {
    const r = svg.current?.getBoundingClientRect();
    return { breite: r?.width ?? 0, hoehe: r?.height ?? 0 };
  };

  // Neue Ansicht oder neue Spitze → der Blick fängt neu an; Auf- und Zuklappen lässt ihn stehen.
  const wofuer = `${art}|${sicht.schluessel}`;
  const [eingepasst, setEingepasst] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (eingepasst === wofuer) return;
    setBlick(anfang(anordnung, flaeche()));
    setEingepasst(wofuer);
  }, [wofuer, eingepasst, anordnung]);

  // Mausrad zoomt um den Mauszeiger. Nicht über React: dort ist das Ereignis „passiv“, die Seite scrollte mit.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const rad = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setBlick((b) =>
        zoomen(b, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top),
      );
    };
    el.addEventListener('wheel', rad, { passive: false });
    return () => el.removeEventListener('wheel', rad);
  }, []);

  // Ziehen (ein Finger / Maus) und Zoomen mit zwei Fingern.
  const zeiger = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ x: number; y: number } | null>(null);
  const bewegt = useRef(false);
  const abstand = useRef(0);
  const zweiAbstand = () => {
    const [a, b] = [...zeiger.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const runter = (e: PointerEvent<SVGSVGElement>) => {
    zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (zeiger.current.size === 1) {
      bewegt.current = false;
      start.current = { x: e.clientX, y: e.clientY };
    }
    if (zeiger.current.size === 2) abstand.current = zweiAbstand();
  };
  const bewegen = (e: PointerEvent<SVGSVGElement>) => {
    const alt = zeiger.current.get(e.pointerId);
    if (!alt) return;
    zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (zeiger.current.size === 1 && start.current) {
      if (
        !bewegt.current &&
        Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > ZIEHEN_AB
      ) {
        bewegt.current = true;
        // Erst jetzt festhalten – sonst landete auch ein einfacher Klick auf der Fläche statt auf dem Kästchen. Klappt das
        // nicht (Zeiger schon losgelassen, ältere Browser), geht das Ziehen trotzdem weiter – nur ohne Festhalten
        // (Test-Instanz 28.10.2026: ein Fehler hier brach das Ziehen ab).
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // ohne Festhalten
        }
        setZieht(true);
      }
      if (bewegt.current) {
        const dx = e.clientX - alt.x;
        const dy = e.clientY - alt.y;
        setBlick((b) => verschieben(b, dx, dy));
      }
    } else if (zeiger.current.size === 2) {
      bewegt.current = true;
      const d = zweiAbstand();
      const [a, b] = [...zeiger.current.values()];
      const r = e.currentTarget.getBoundingClientRect();
      const faktor = abstand.current ? d / abstand.current : 1;
      abstand.current = d;
      setBlick((bl) => zoomen(bl, faktor, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top));
    }
  };
  const hoch = (e: PointerEvent<SVGSVGElement>) => {
    zeiger.current.delete(e.pointerId);
    if (!zeiger.current.size) setZieht(false);
  };

  const knopf = (z: 'aus' | 'ein' | 'ganz') => {
    const f = flaeche();
    if (z === 'ganz') setBlick(ganz(anordnung.rahmen, f));
    else setBlick((b) => zoomen(b, z === 'ein' ? 1.25 : 0.8, f.breite / 2, f.hoehe / 2));
  };

  // Mit der Tastatur zu einem Kästchen außerhalb des Blicks → dorthin schieben.
  const sichtbarMachen = (x: number, y: number, w: number) => {
    const f = flaeche();
    if (!f.breite) return;
    setBlick((b) => {
      const links = x * b.s + b.x;
      const oben = y * b.s + b.y;
      const drin =
        links >= 0 && oben >= 0 && links + w * b.s <= f.breite && oben + HOEHE * b.s <= f.hoehe;
      if (drin) return b;
      return { ...b, x: f.breite / 2 - (x + w / 2) * b.s, y: f.hoehe / 2 - (y + HOEHE / 2) * b.s };
    });
  };
  const taste = (e: KeyboardEvent, tun: () => void) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    tun();
  };

  return (
    <div className={styles.leinwand}>
      <svg
        ref={svg}
        className={`${styles.flaeche}${zieht ? ' ' + styles.zieht : ''}`}
        role="group"
        aria-label="Organigramm"
        onPointerDown={runter}
        onPointerMove={bewegen}
        onPointerUp={hoch}
        onPointerCancel={hoch}
      >
        <g transform={`translate(${blick.x} ${blick.y}) scale(${blick.s})`}>
          <DiagrammBild
            anordnung={anordnung}
            kuerzen={kuerzen}
            knoten={({ knoten: k, x, y, breite: w }) => ({
              role: 'button',
              tabIndex: 0,
              'aria-label': k.name,
              onClick: () => {
                if (!bewegt.current && k.id !== null) onGruppe(k.id);
              },
              onKeyDown: (e) => taste(e, () => k.id !== null && onGruppe(k.id)),
              onFocus: () => sichtbarMachen(x, y, w),
            })}
            schalter={({ knoten: k }) => ({
              role: 'button',
              tabIndex: 0,
              'aria-label': `${k.name} ${k.offen ? 'zuklappen' : 'aufklappen'}`,
              'aria-expanded': k.offen,
              onClick: () => {
                if (!bewegt.current) onUmklappen(k.schluessel);
              },
              onKeyDown: (e) => taste(e, () => onUmklappen(k.schluessel)),
            })}
          />
        </g>
      </svg>
      <div className={styles.zoom}>
        <ZeilenKnopf label="Verkleinern" onClick={() => knopf('aus')}>
          <Icon name="minus" size={16} />
        </ZeilenKnopf>
        <ZeilenKnopf label="Vergrößern" onClick={() => knopf('ein')}>
          <Icon name="plus" size={16} />
        </ZeilenKnopf>
        <KopfKnopf
          label="Ganz zeigen"
          symbol={<Icon name="zoom-reset" size={16} />}
          onClick={() => knopf('ganz')}
        />
      </div>
    </div>
  );
}
