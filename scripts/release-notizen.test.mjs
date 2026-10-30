import { describe, expect, it } from 'vitest';
import { zusammenfuehren } from './changelog-sammeln.mjs';
import { abschnitte, notizen, ueberschriftFehler, vorigerTag } from './release-notizen.mjs';

describe('Release-Beschreibung je App (30.10.2026)', () => {
  const EINTRAG = [
    '### Neu (Musik-App)\n\n- Lied-Menü\n',
    '### Neu (Organigramm, O7b-8)\n\n- Kachel\n',
    '### Behoben (alle Apps)\n\n- Hover\n',
    '### Geändert (Musik-App + Dienstplaner)\n\n- Ablauf\n',
    '### Intern (Musik-App)\n\n- Umbau\n',
  ].join('\n');
  const jetzt = abschnitte(EINTRAG);

  it('zeigt nur, was die App nennt oder alle betrifft – „Intern“ nie', () => {
    expect(notizen(jetzt, [], 'musik-app')).toBe(
      '### Neu\n\n- Lied-Menü\n\n### Geändert\n\n- Ablauf\n\n### Behoben\n\n- Hover',
    );
    expect(notizen(jetzt, [], 'organigramm')).toBe('### Neu\n\n- Kachel\n\n### Behoben\n\n- Hover');
    expect(notizen(jetzt, [], 'dienstplaner')).toBe(
      '### Geändert\n\n- Ablauf\n\n### Behoben\n\n- Hover',
    );
    expect(notizen(jetzt, [], 'protokolle')).toBe('### Behoben\n\n- Hover');
  });

  it('was es beim vorigen Tag schon gab, steht nicht noch einmal da', () => {
    const vorher = abschnitte('### Neu (Musik-App)\n\n- Lied-Menü\n');
    expect(notizen(jetzt, vorher, 'musik-app')).toBe(
      '### Geändert\n\n- Ablauf\n\n### Behoben\n\n- Hover',
    );
  });

  /**
   * Der Weg, der es sonst kaputt machen würde: Eine Erweiterung wird veröffentlicht, solange ihr Eintrag noch als
   * Datei in changelog.d/ liegt; der nächste Musik-App-Release schiebt ihn mit `zusammenfuehren` ins CHANGELOG. Beim
   * nächsten Release der Erweiterung darf er nicht wieder als neu erscheinen.
   */
  it('ein Eintrag, den der Musik-App-Release aus changelog.d/ ins CHANGELOG schiebt, gilt nicht als neu', () => {
    const changelog =
      '# Changelog\n\n## [Unreleased]\n\n## [2.37.0] – 2026-10-22\n\n### Neu (Musik-App)\n\n- alt\n';
    const datei = {
      name: 'o.md',
      zeit: 1,
      text: '### Neu (Organigramm, O8)\n\n- Kachel  \n  mit Umbruch\n',
    };
    const vorher = [...abschnitte(changelog), ...abschnitte(datei.text)];
    const nachher = abschnitte(
      zusammenfuehren(changelog, [datei], { version: '2.38.0', datum: '2026-10-30' }),
    );
    expect(notizen(nachher, vorher, 'organigramm')).toBe('');
    // Gegenprobe: ohne den vorigen Stand stünde er da – die Prüfung oben misst also etwas.
    expect(notizen(nachher, [], 'organigramm')).toContain('Kachel');
  });

  it('`##`-Überschriften und der Überblick gehören zu keinem Abschnitt', () => {
    expect(
      abschnitte(
        '## [2.38.0]\n\n**Überblick.** alles\n\n### Neu (Musik-App)\n\n- a\n\n## [2.37.0]\n\nalt\n',
      ),
    ).toEqual([{ kopf: '### Neu (Musik-App)', rumpf: '- a' }]);
  });

  it('der vorige Tag: gleiche App, stabil, älter – auch über Zehnerstellen', () => {
    const tags = [
      'v2.9.0',
      'v2.10.0',
      'v2.11.0-rc1',
      'v2.11.0',
      'organigramm-v0.1.0',
      'organigramm-v0.1.1',
    ];
    expect(vorigerTag('v2.11.0', tags)).toBe('v2.10.0');
    expect(vorigerTag('v2.10.0', tags)).toBe('v2.9.0');
    expect(vorigerTag('organigramm-v0.1.1', tags)).toBe('organigramm-v0.1.0');
    expect(vorigerTag('organigramm-v0.1.0', tags)).toBeUndefined();
    expect(vorigerTag('protokolle-v0.1.0', tags)).toBeUndefined();
  });

  it('eine Vorabversion ist nie der Vergleichsstand – sonst fehlte, was zwischen ihr und dem vorigen Release kam', () => {
    expect(vorigerTag('v2.12.0', ['v2.10.0', 'v2.11.0-rc1'])).toBe('v2.10.0');
    expect(vorigerTag('v2.12.0', ['v2.11.0-rc1', 'v2.11.0'])).toBe('v2.11.0');
  });

  it('prüft, dass eine gezeigte Überschrift die App nennt', () => {
    expect(ueberschriftFehler('### Neu (Dienstplaner, E6b-1 – Alwin, 30.10.2026)')).toBeNull();
    expect(ueberschriftFehler('### Behoben (alle Erweiterungen)')).toBeNull();
    expect(ueberschriftFehler('### Intern (E6b-1)')).toBeNull();
    expect(ueberschriftFehler('### Intern')).toBeNull();
    expect(ueberschriftFehler('### Behoben')).toContain('fehlt die App');
    expect(ueberschriftFehler('### Neu (S7-3)')).toContain('fehlt die App');
    expect(ueberschriftFehler('### Neues (Musik-App)')).toContain('unbekannt');
  });
});
