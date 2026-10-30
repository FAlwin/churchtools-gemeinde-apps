import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Keine Behelfszeichen statt Icons** (22.10.2026): Im Lied-Menü stand „Bearbeiten (neue Version)“ mit 🖉 –
 * das Zeichen kennt iOS nicht, Alwin sah ein leeres Kästchen. Daneben ⤴, 📎, ✎, in der Datei-Liste Emoji, im
 * Links-Fenster ⠿. Seit 08.10.2026 gilt: nur die Linien-Icons aus `ui/icons` (fehlt eins, dort ergänzen).
 * Kommentare zählen nicht (dort darf man die Zeichen nennen).
 */
// ⎙ und ✉ seit U2-1 (29.10.2026): am Handy winzig, in der echten Prüfung kaum zu erkennen.
const BEHELF = /[⤴🖉✎⚙⋯⠿♪📎📄🖼🎵⚠📴📅📋🔒⎙✉]|&#x270E;/u;

describe('Icons statt Behelfszeichen', () => {
  it('keine Behelfszeichen in der Oberfläche', () => {
    const funde: string[] = [];
    // Der Server schreibt nur Logzeilen – dort sind Zeichen wie ⚠️ keine Oberfläche.
    for (const ordner of ORDNER.filter((o) => !o.startsWith('server/'))) {
      for (const datei of dateien(ordner, /\.(tsx|ts)$/)) {
        if (/\.test\.|testutil/.test(datei)) continue;
        readFileSync(datei, 'utf8')
          .split('\n')
          .forEach((zeile, i) => {
            const t = zeile.trim();
            if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
            if (BEHELF.test(zeile)) funde.push(`${relative(WURZEL, datei)}:${i + 1}: ${t}`);
          });
      }
    }
    expect(funde).toEqual([]);
  });
});
