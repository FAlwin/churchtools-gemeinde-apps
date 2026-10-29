/**
 * **Wie groß ein Kästchen im Diagramm wird** (O7b) – EINE Messung für Bildschirm (O7b-3) und PDF (O7b-4), mit der
 * Schrift der Seite. Seit O7b-6 stehen unter dem Namen auf Wunsch die Personen nach Rollen: Dann wird das Kästchen
 * breiter und höher, die Namen brechen nach Kommas um (Entwurf `o7b-6-7-v1.html`, abgenommen 29.10.2026).
 */
import { useEffect, useState, type RefObject } from 'react';
import { HOEHE, SCHALTER, type SichtKnoten } from '@shared/organigramm/ansichten';
import { rollenZahl } from '@shared/organigramm/personen';
import type { KastenInhalt } from './kastenPersonen';
import { textBreite } from './textBreite';

/** Nur der Name (Alwin, 26.10.2026) – mit diesem Rand links und rechts, zwischen diesen Breiten. */
const INNEN = 28;
const SCHMALST = 72;
const BREITEST = 220;
/** Die Spitze darf breiter sein – dort steht oft der lange Name der Gemeinde (Test-Instanz 28.10.2026: gekürzt). */
const BREITEST_SPITZE = 320;
/** Mit Personen (O7b-6): breiter, damit die Namen nicht nach jedem Komma umbrechen. */
const SCHMALST_PERSONEN = 150;
const BREITEST_PERSONEN = 260;

/** Schriftgrößen und Zeilen unter dem Namen – wie im Entwurf. */
const ROLLE_PT = 10.5;
const PERSON_PT = 12.5;
const ROLLE_ZEILE = 15;
const PERSON_ZEILE = 16;
const BLOCK_ABSTAND = 4;
/** Vom Trennstrich unter dem Namen bis zur ersten Zeile. */
const TRENN_ABSTAND = 8;
/**
 * Unter der letzten Zeile: so viel, dass das runde +/− (Halbmesser `SCHALTER`, sitzt bei „von oben“ auf dem unteren Rand
 * links) keine Zeile verdeckt (Demo 29.10.2026: über „2 Mitarbeiter“).
 */
const UNTEN = SCHALTER + 3;
/** Abstand der Zeilen vom linken Rand des Kästchens. */
export const ZEILEN_EINZUG = 14;

/** Spitze und die Ebene darunter sind fett. */
export const fett = (k: SichtKnoten) => k.ebene <= 1;

export interface Schrift {
  name: string;
  /** Zählt hoch, sobald die Schrift geladen ist – dann wird neu gemessen. */
  stand: number;
}

/** Eine Zeile unter dem Namen: `y` ist ihre Mitte, gemessen vom oberen Rand des Kästchens. */
export interface KastenZeile {
  art: 'rolle' | 'person' | 'zahl' | 'hinweis';
  text: string;
  y: number;
}

export interface Kasten {
  breite: number;
  hoehe: number;
  /** Leer = nur der Name. */
  zeilen: KastenZeile[];
}

/** Die Schrift der Seite (`--ui`) am Element – und neu messen, sobald sie geladen ist. */
export function useSchrift(ref: RefObject<Element | null>): Schrift {
  const [schrift, setSchrift] = useState<Schrift>({ name: 'Lato, sans-serif', stand: 0 });
  useEffect(() => {
    const el = ref.current;
    const ui = el ? getComputedStyle(el).getPropertyValue('--ui').trim() : '';
    if (ui) setSchrift((s) => ({ ...s, name: ui }));
    let weg = false;
    if ('fonts' in document) {
      void document.fonts.ready.then(() => {
        if (!weg) setSchrift((s) => ({ ...s, stand: s.stand + 1 }));
      });
    }
    return () => {
      weg = true;
    };
  }, [ref]);
  return schrift;
}

/**
 * Wie breit und hoch ein Kästchen wird, was darin steht und wie sein Name gekürzt wird – EINE Messung für Bildschirm
 * und PDF. `inhalt` liefert je Gruppe die Personen (O7b-6); ohne steht im Kästchen nur der Name.
 */
export function messung(schrift: Schrift, inhalt?: (id: number) => KastenInhalt | null) {
  const mass = (text: string, f: boolean, pt = 14) => textBreite(text, f, schrift.name, pt);
  /** So viel passt in eine Zeile – sonst mit „…“ gekürzt. */
  const passend = (text: string, f: boolean, pt: number, platz: number) => {
    if (mass(text, f, pt) <= platz) return text;
    let t = text;
    while (t.length > 1 && mass(t + '…', f, pt) > platz) t = t.slice(0, -1);
    return t + '…';
  };
  /** Namen nach Kommas umbrechen – ein Name wird nie geteilt, nur ein zu langer gekürzt. */
  const umbrechen = (namen: readonly string[], platz: number) => {
    const zeilen: string[] = [];
    let akt = '';
    for (const n of namen) {
      const probe = akt ? `${akt}, ${n}` : n;
      if (akt && mass(probe + ',', false, PERSON_PT) > platz) {
        zeilen.push(akt + ',');
        akt = n;
      } else akt = probe;
    }
    if (akt) zeilen.push(akt);
    return zeilen.map((z) => passend(z, false, PERSON_PT, platz));
  };

  const cache = new WeakMap<SichtKnoten, Kasten>();
  const kasten = (k: SichtKnoten): Kasten => {
    const fertig = cache.get(k);
    if (fertig) return fertig;
    const nurName = Math.max(SCHMALST, Math.ceil(mass(k.name, fett(k))) + INNEN);
    const i = k.id === null || !inhalt ? null : inhalt(k.id);
    let ergebnis: Kasten;
    if (!i) {
      ergebnis = {
        breite: Math.min(k.ebene === 0 ? BREITEST_SPITZE : BREITEST, nurName),
        hoehe: HOEHE,
        zeilen: [],
      };
    } else {
      // Erst die Breite: so breit wie der Name, die längste Rolle und der längste einzelne Name brauchen.
      const bloecke =
        i.art === 'hinweis'
          ? [{ rolle: null, texte: [i.text], art: 'hinweis' as const }]
          : i.gruppen.map((g) => ({
              rolle: g.rolle.toLocaleUpperCase('de'),
              texte: g.nurZahl ? [rollenZahl(g)] : g.namen,
              art: g.nurZahl ? ('zahl' as const) : ('person' as const),
            }));
      const inhaltBreite = Math.max(
        ...bloecke.flatMap((b) => [
          b.rolle === null ? 0 : mass(b.rolle, true, ROLLE_PT),
          ...b.texte.map((t) => mass(t + ',', false, PERSON_PT)),
        ]),
      );
      const breite = Math.min(
        k.ebene === 0 ? BREITEST_SPITZE : BREITEST_PERSONEN,
        Math.max(SCHMALST_PERSONEN, nurName, Math.ceil(inhaltBreite) + INNEN),
      );
      const platz = breite - INNEN;
      const zeilen: KastenZeile[] = [];
      let y = HOEHE + TRENN_ABSTAND;
      for (const b of bloecke) {
        if (b.rolle !== null) {
          zeilen.push({
            art: 'rolle',
            text: passend(b.rolle, true, ROLLE_PT, platz),
            y: y + ROLLE_ZEILE / 2,
          });
          y += ROLLE_ZEILE;
        }
        for (const t of b.art === 'person' ? umbrechen(b.texte, platz) : b.texte) {
          zeilen.push({
            art: b.art,
            text: passend(t, false, PERSON_PT, platz),
            y: y + PERSON_ZEILE / 2,
          });
          y += PERSON_ZEILE;
        }
        y += BLOCK_ABSTAND;
      }
      ergebnis = { breite, hoehe: y - BLOCK_ABSTAND + UNTEN, zeilen };
    }
    cache.set(k, ergebnis);
    return ergebnis;
  };

  const breite = (k: SichtKnoten) => kasten(k).breite;
  const hoehe = (k: SichtKnoten) => kasten(k).hoehe;
  const kuerzen = (k: SichtKnoten, w: number) => passend(k.name, fett(k), 14, w - INNEN + 4);
  return { breite, hoehe, kasten, kuerzen };
}
