import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Formular } from '@shared/anmeldung/formular';
import { amEnde, bereichVon, type Bereich } from '@shared/anmeldung/baukasten';
import type { NeuerBaustein } from './BaukastenLeiste';

export type Gezogen = { art: 'neu'; b: NeuerBaustein } | { art: 'feld'; id: string };
/**
 * Wo abgelegt wird: vor `vorId` im Bereich (`null` = ganz unten im Bereich, auch unter den Bemerkungen). Immer
 * so ausgedrückt – „nach Feld A“ und „vor Feld B“ sind dieselbe Stelle, sonst spränge die Lücke.
 */
export interface Ziel {
  bereich: Bereich;
  vorId: string | null;
}

/** Wo ein Feld beim Start des Ziehens stand – relativ zur Bühne (scrollt mit). */
interface Platz {
  id: string;
  bereich: Bereich;
  oben: number;
  unten: number;
}

/** Abstand zum Rand, ab dem beim Ziehen mitgescrollt wird, und das Tempo ganz am Rand (Pixel je Bild). */
const RAND_SCROLL = 80;
const TEMPO_SCROLL = 18;
/** Wie lange die Felder zu ihrem neuen Platz gleiten, wenn die Lücke wandert. */
const GLEITEN_MS = 160;

/** Das nächste Element darüber, das scrollt (in ChurchTools ist das nicht das Fenster, sondern der Rahmen). */
function scrollEltern(el: HTMLElement | null): HTMLElement {
  for (let x = el?.parentElement; x; x = x.parentElement) {
    const o = getComputedStyle(x).overflowY;
    if ((o === 'auto' || o === 'scroll') && x.scrollHeight > x.clientHeight) return x;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/**
 * **Ziehen und Ablegen im Baukasten** (#845, Scheibe 4b-1: aus der Komponente herausgezogen, unverändert): Bausteine
 * aus der Leiste und Felder im Formular lassen sich greifen; wo der Mauszeiger ist, öffnet sich eine Lücke (`ziel`),
 * die Felder gleiten dorthin, am Rand scrollt es mit. Abgelegt wird über `einfuegen` bzw. `verschieben` des
 * Baukastens. `buehneRef` gehört an die Bühne, `ueberBuehne` an `onDragEnter`/`onDragOver`, `loslassen` an `onDrop`.
 */
export function useZiehen({
  formularRef,
  einfuegen,
  verschieben,
}: {
  /** Der Stand von jetzt – das Ziehen endet später als das Zeichnen, in dem es begann. */
  formularRef: { readonly current: Formular };
  einfuegen: (b: NeuerBaustein, wohin: { bereich: Bereich; vorId: string | null }) => void;
  verschieben: (feldId: string, bereich: Bereich, vorId: string | null) => void;
}) {
  /** Das Feld, das gerade gezogen wird – es wird blass, damit man sieht, was man bewegt. */
  const [ziehtFeld, setZiehtFeld] = useState<string | null>(null);
  const [ziel, setZiel] = useState<Ziel | null>(null);
  const gezogen = useRef<Gezogen | null>(null);

  // ── Ziehen und Ablegen: Wo der Mauszeiger ist, öffnet sich eine Lücke (wie bei Campflow) ──
  //
  // Die Stelle wird an den Plätzen ausgerechnet, die die Felder beim START des Ziehens hatten – nicht an den
  // Feldern, wie sie gerade stehen. Sonst verschiebt die Lücke die Felder, die neue Rechnung sieht eine andere
  // Stelle, die Lücke springt dorthin … (Alwin, 13.10.2026: „Lücke springt“). So macht es auch SortableJS.
  const plaetze = useRef<Platz[]>([]);
  const buehneRef = useRef<HTMLDivElement>(null);

  /** `mitLagen: false` – nur die Plätze neu, die Lagen fürs Gleiten bleiben (beim Ausblenden des Felds). */
  function plaetzeMerken(mitLagen = true) {
    const b = buehneRef.current;
    if (!b) return;
    const oben = b.getBoundingClientRect().top;
    if (mitLagen)
      lagen.current = new Map(
        [...b.querySelectorAll<HTMLElement>('[data-feld]')].map((el) => [
          el.dataset.feld!,
          el.getBoundingClientRect().top - oben,
        ]),
      );
    const weg = gezogen.current?.art === 'feld' ? gezogen.current.id : null;
    plaetze.current = [...b.querySelectorAll<HTMLElement>('[data-feld][data-bereich]')]
      .filter((el) => el.dataset.ende === undefined && el.dataset.feld !== weg)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.feld!,
          bereich: el.dataset.bereich as Bereich,
          oben: r.top - oben,
          unten: r.bottom - oben,
        };
      });
  }

  /** Die Stelle für eine Höhe `y` (relativ zur Bühne): vor dem ersten Feld, dessen Mitte darunter liegt. */
  function zielAus(y: number): Ziel | null {
    const liste = plaetze.current;
    for (let i = 0; i < liste.length; i++) {
      const p = liste[i];
      if (y >= (p.oben + p.unten) / 2) continue;
      // Zwischen zwei Bereichen entscheidet, welchem der Mauszeiger näher ist.
      const davor = liste[i - 1];
      if (davor && davor.bereich !== p.bereich && y < (davor.unten + p.oben) / 2)
        return { bereich: davor.bereich, vorId: null };
      return { bereich: p.bereich, vorId: p.id };
    }
    const letzte = liste.at(-1);
    return letzte ? { bereich: letzte.bereich, vorId: null } : null;
  }

  function ablegen(z: Ziel | null) {
    const g = gezogen.current;
    gezogen.current = null;
    setZiehtFeld(null);
    setZiel(null);
    if (!g || !z) return;
    // „Ganz unten“ heißt beim Ziehen wirklich ganz unten – auch unter den Bemerkungen, aber vor Preis und
    // Datenschutz (`einordnen` setzt nichts dahinter). Ohne Angabe käme es VOR die Bemerkungen (Antippen).
    const vorId = z.vorId ?? formularRef.current[z.bereich].find(amEnde)?.id ?? null;
    const wohin = { bereich: z.bereich, vorId };
    if (g.art === 'neu') einfuegen(g.b, wohin);
    else verschieben(g.id, z.bereich, vorId);
  }

  // ── Gleiten statt Springen (Alwin: „manchmal ruckelt es noch kräftig“) ──
  // Wandert die Lücke, gleiten die Felder von ihrem alten zu ihrem neuen Platz (FLIP über die Web Animations
  // API), statt schlagartig zu springen. Die Rechnung oben benutzt weiter die Plätze vom Start.
  const lagen = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const b = buehneRef.current;
    if (!b || !gezogen.current) return;
    const oben = b.getBoundingClientRect().top;
    const neu = new Map<string, number>();
    for (const el of b.querySelectorAll<HTMLElement>('[data-feld]')) {
      const id = el.dataset.feld!;
      const jetzt = el.getBoundingClientRect().top - oben;
      neu.set(id, jetzt);
      const vorher = lagen.current.get(id);
      if (vorher !== undefined && Math.abs(vorher - jetzt) > 1)
        el.animate?.([{ transform: `translateY(${vorher - jetzt}px)` }, { transform: 'none' }], {
          duration: GLEITEN_MS,
          easing: 'ease-out',
        });
    }
    lagen.current = neu;
  }, [ziel]);

  // Gleichmäßig mitscrollen, solange der Mauszeiger am Rand ist – je näher am Rand, desto schneller. Vorher
  // gab es je Mausereignis einen festen Schritt, das ruckelte.
  const scrollen = useRef<{ el: HTMLElement; tempo: number; laeuft: boolean }>({
    el: document.documentElement,
    tempo: 0,
    laeuft: false,
  });
  function scrollSchritt() {
    const s = scrollen.current;
    if (!gezogen.current || s.tempo === 0) {
      s.laeuft = false;
      return;
    }
    // `?.`: Nicht jede Umgebung kennt `scrollBy` an Elementen (jsdom) – dann eben ohne Mitscrollen.
    s.el.scrollBy?.(0, s.tempo);
    requestAnimationFrame(scrollSchritt);
  }

  function ueberBuehne(ev: React.DragEvent<HTMLDivElement>) {
    if (!gezogen.current) return;
    ev.preventDefault();
    // Am Rand mitscrollen – in ChurchTools scrollt der Rahmen, nicht das Fenster.
    const sc = scrollEltern(ev.currentTarget);
    const r =
      sc === document.scrollingElement
        ? { top: 0, bottom: window.innerHeight }
        : sc.getBoundingClientRect();
    const vonOben = ev.clientY - r.top;
    const vonUnten = r.bottom - ev.clientY;
    const tempo =
      vonOben < RAND_SCROLL
        ? -Math.ceil(((RAND_SCROLL - vonOben) / RAND_SCROLL) * TEMPO_SCROLL)
        : vonUnten < RAND_SCROLL
          ? Math.ceil(((RAND_SCROLL - vonUnten) / RAND_SCROLL) * TEMPO_SCROLL)
          : 0;
    const s = scrollen.current;
    s.el = sc;
    s.tempo = tempo;
    if (tempo !== 0 && !s.laeuft) {
      s.laeuft = true;
      s.el.scrollBy?.(0, tempo);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(scrollSchritt);
    }
    const z = zielAus(ev.clientY - ev.currentTarget.getBoundingClientRect().top);
    if (z) zielSetzen(z);
  }

  function zielSetzen(z: Ziel) {
    setZiel((alt) => (alt && alt.bereich === z.bereich && alt.vorId === z.vorId ? alt : z));
  }

  const ziehenBeginnen = (g: Gezogen) => {
    gezogen.current = g;
    plaetzeMerken();
    if (g.art !== 'feld') return;
    // Das gezogene Feld verschwindet, an seiner Stelle steht nur die Lücke (Alwin, 14.10.2026: „muss nicht mehr
    // in grau angezeigt werden“). Erst NACH dem Start: Wird es noch während `dragstart` ausgeblendet, bricht
    // Chrome das Ziehen sofort ab (13.10.2026, mit echter Maus nachgestellt). Danach die Plätze ohne das Feld.
    window.setTimeout(() => {
      if (gezogen.current !== g) return;
      flushSync(() => setZiehtFeld(g.id));
      plaetzeMerken(false);
      const bereich = bereichVon(formularRef.current, g.id);
      if (bereich) zielSetzen({ bereich, vorId: g.id });
    }, 0);
  };
  const ziehenEnde = () => {
    scrollen.current.tempo = 0;
    gezogen.current = null;
    setZiehtFeld(null);
    setZiel(null);
  };

  /** Loslassen auf der Bühne: wo die Lücke zu sehen ist; ohne Lücke (kein `dragover` vorher) aus dem Ereignis. */
  const loslassen = (ev: React.DragEvent<HTMLDivElement>) => {
    if (!gezogen.current) return;
    ev.preventDefault();
    ablegen(ziel ?? zielAus(ev.clientY - ev.currentTarget.getBoundingClientRect().top));
  };

  return { ziehtFeld, ziel, buehneRef, ueberBuehne, loslassen, ziehenBeginnen, ziehenEnde };
}
