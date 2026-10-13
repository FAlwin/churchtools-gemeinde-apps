import type { Antworten, OeffentlicheEinstellungen } from '@shared/anmeldung/formular';

/** Hilfen zum Anmeldeformular (A5) – getrennt von den Komponenten (React Fast Refresh). */

/** Text auf der Akzentfarbe: schwarz oder weiß, je nach Helligkeit (WCAG-Leuchtdichte). */
export function textAufFarbe(hex: string): string {
  const kanal = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * kanal(1) + 0.7152 * kanal(3) + 0.0722 * kanal(5);
  return l > 0.36 ? '#1a1410' : '#ffffff';
}

/** Leere Antworten: eine Person (bei Familien zwei Zeilen sind Sache der Gäste). */
export function leereAntworten(): Antworten {
  return { anmeldung: {}, personen: [{}] };
}

/**
 * **Musterdaten für die Vorschau** – damit das Team sieht, wie ein ausgefülltes Formular aussieht.
 * Geburtstage passend zum ersten Tag (Erwachsene, ein Kind von 9, eines von 6).
 */
export function musterAntworten(e: OeffentlicheEinstellungen, heute: string): Antworten {
  const stichtag = (e.termin?.beginn ?? heute).slice(0, 10);
  const geboren = (jahre: number) => `${Number(stichtag.slice(0, 4)) - jahre}${stichtag.slice(4)}`;
  const kinder = e.wer === 'kinder';
  const personen =
    e.wer === 'einzeln'
      ? [{ vor: 'Maria', nach: 'Beispiel', alter: 34 }]
      : kinder
        ? [
            { vor: 'Jonas', nach: 'Beispiel', alter: 9 },
            { vor: 'Lea', nach: 'Beispiel', alter: 6 },
          ]
        : [
            { vor: 'Maria', nach: 'Beispiel', alter: 38 },
            { vor: 'Jonas', nach: 'Beispiel', alter: 9 },
          ];
  return {
    anmeldung: {
      name: { vor: 'Maria', nach: 'Beispiel' },
      mail: 'maria@beispiel.de',
      tel: '0151 2345678',
    },
    personen: personen.map((p) => ({
      pname: { vor: p.vor, nach: p.nach },
      birth: geboren(p.alter),
    })),
  };
}
