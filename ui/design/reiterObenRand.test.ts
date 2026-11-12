import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL } from './quelltexte.testutil';

/**
 * **Reiter oben am Bildschirmrand lassen Platz für die Statusleiste** (Alwin am iPad, 12.11.2026).
 *
 * Seit „Reiter am iPad oben“ (#739, 26.10.2026) stand die Reiterleiste der Musik-App ganz oben – in der installierten
 * App vom NAS zeichnet sie hinter die Statusleiste (`black-translucent`), und die Reiter lagen unter Uhr und Akku.
 * Der Inhalt darunter hielt dagegen weiter Abstand zur Safe-Area, als gäbe es keine Leiste. Beides hängt zusammen:
 * Die Leiste nimmt den Platz für die Statusleiste, der Bereich darunter gibt ihn wieder ab.
 */
const lies = (p: string) => readFileSync(join(WURZEL, p), 'utf8');

describe('Reiter oben am Rand', () => {
  it('die Leiste polstert oben mit --reiter-oben-polster', () => {
    expect(lies('ui/bedienung/ReiterLeiste.module.scss')).toMatch(
      /&\.rand\s*\{\s*padding-top:\s*var\(--reiter-oben-polster\);/,
    );
  });

  it('in der installierten App ist das Polster die Safe-Area, sonst 0', () => {
    const v = lies('ui/design/_variables.scss');
    expect(v).toMatch(/^\s*--reiter-oben-polster:\s*0px;/m);
    const standalone = v.slice(v.indexOf('@media (display-mode: standalone) {'));
    expect(standalone).toMatch(
      /--reiter-oben-polster:\s*var\(--sat, env\(safe-area-inset-top, 0px\)\);/,
    );
  });

  it('die Musik-App setzt ihre oberen Reiter an den Rand', () => {
    expect(lies('client/src/components/TabBar.tsx')).toMatch(/amRand=\{oben\}/);
  });

  it('der Bereich unter den Reitern beginnt wie unter einer Leiste – ohne die Safe-Area noch einmal', () => {
    expect(lies('client/src/App.tsx')).toContain(
      "'--inhalt-pad-top': 'var(--inhalt-pad-unter-reiter)'",
    );
  });
});
