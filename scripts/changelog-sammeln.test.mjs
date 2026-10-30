import { describe, expect, it } from 'vitest';
import { eintragFehler, ordnen, zusammenfuehren } from './changelog-sammeln.mjs';

describe('CHANGELOG-Einträge als Dateien (22.10.2026)', () => {
  const ALT =
    '# Changelog\n\nVorwort\n\n## [Unreleased]\n\n### Neu (alt)\n\n- noch von früher\n\n## [2.37.0] – 2026-10-22\n\n- x\n';

  it('setzt die Version unter [Unreleased] – neueste Einträge zuerst, Altes darunter, Rest unverändert', () => {
    const neu = zusammenfuehren(
      ALT,
      [
        { name: 'a.md', zeit: 100, text: '### Neu (A)\n\n- a\n' },
        { name: 'b.md', zeit: 200, text: '### Behoben (B)\n\n- b\n' },
      ],
      { version: '2.38.0', datum: '2026-10-25' },
    );
    expect(neu).toBe(
      '# Changelog\n\nVorwort\n\n## [Unreleased]\n\n## [2.38.0] – 2026-10-25\n\n### Behoben (B)\n\n- b\n\n### Neu (A)\n\n- a\n\n### Neu (alt)\n\n- noch von früher\n\n## [2.37.0] – 2026-10-22\n\n- x\n',
    );
  });

  it('ohne [Unreleased] bricht es ab, statt irgendwo einzufügen', () => {
    expect(() => zusammenfuehren('# Changelog\n', [], { version: '1.0.0', datum: 'x' })).toThrow(
      'Unreleased',
    );
  });

  it('gleiche Zeit: nach Namen – das Ergebnis hängt nicht vom Zufall ab', () => {
    expect(
      ordnen([
        { name: 'b', zeit: 1 },
        { name: 'a', zeit: 1 },
      ]).map((e) => e.name),
    ).toEqual(['a', 'b']);
  });

  it('prüft das Format eines Eintrags', () => {
    expect(eintragFehler('x.md', '### Neu (Musik-App)\n\n- etwas\n')).toEqual([]);
    expect(eintragFehler('x.md', '  ')).toEqual(['x.md: leer']);
    expect(eintragFehler('x.md', '- ohne Überschrift')[0]).toContain('Überschrift');
    expect(eintragFehler('x.md', '### Neu\n\n## [2.0.0]')[0]).toContain('##');
  });

  it('verlangt die App in jeder gezeigten Überschrift – auch in der zweiten (30.10.2026)', () => {
    expect(eintragFehler('x.md', '### Neu (Musik-App)\n\n- a\n\n### Intern\n\n- b\n')).toEqual([]);
    const fehler = eintragFehler(
      'x.md',
      '### Neu (Musik-App)\n\n- a\n\n### Behoben (S7-3)\n\n- b\n',
    );
    expect(fehler).toHaveLength(1);
    expect(fehler[0]).toContain('fehlt die App');
  });
});
