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

  it('in der installierten App reicht das Polster bis unter das Unschärfe-Band, sonst 0', () => {
    const v = lies('ui/design/_variables.scss');
    expect(v).toMatch(/^\s*--reiter-oben-polster:\s*0px;/m);
    const standalone = v.slice(v.indexOf('@media (display-mode: standalone) {'));
    // Nur die Statusleiste (bis 12.11.2026 abends) war zu wenig: Die Reiter lagen im Band und waren weich.
    expect(standalone).toMatch(/--reiter-oben-polster:\s*var\(--band-unten\);/);
    expect(standalone).toMatch(
      /--band-unten:\s*calc\(var\(--sat, env\(safe-area-inset-top, 0px\)\) \+ 36px\);/,
    );
    // Köpfe und Reiter rechnen mit DERSELBEN Unterkante – keine zweite Formel.
    expect(standalone).toMatch(/--inhalt-pad-top:\s*var\(--band-unten\);/);
  });

  it('keine Geräte-Ausnahme: --inhalt-pad-top steht in der installierten App genau einmal (Alwin am iPad, 26.11.2026)', () => {
    // Bis zum 26.11.2026 setzte ein eigener iPad-Block den Wert auf Safe-Area + 4 px – die Köpfe ohne Reiter (Ablauf,
    // Liedblatt) lagen dadurch im Unschärfe-Band von iPadOS 26 und waren weich.
    const v = lies('ui/design/_variables.scss');
    const standalone = v.slice(v.indexOf('@media (display-mode: standalone) {'));
    expect(standalone.match(/--inhalt-pad-top:/g)).toHaveLength(1);
    expect(v).not.toMatch(/@media \(display-mode: standalone\) and/);
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
