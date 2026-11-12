import { describe, expect, it } from 'vitest';
import { beitragsGruppenAus, beitragsText, freigabeBeitrag } from './beitrag';

const LINK = 'https://ct.test/ccm/protokolle/#/sitzungen/194/s1';

describe('freigabeBeitrag', () => {
  it('Überschrift, Satz und Link – Tag in der Zeitzone der Gemeinde', () => {
    // 23:30 UTC ist in Berlin schon der nächste Tag.
    expect(
      freigabeBeitrag({
        titel: 'Leitungssitzung',
        beginn: '2026-11-10T23:30:00Z',
        zeitzone: 'Europe/Berlin',
        link: LINK,
      }),
    ).toEqual({
      titel: 'Protokoll vom 11.11.2026 ist freigegeben',
      satz: 'Das Protokoll „Leitungssitzung“ vom Mi, 11.11.2026 ist freigegeben.',
      link: LINK,
    });
  });

  it('ohne Titel: „Sitzung“', () => {
    expect(
      freigabeBeitrag({ titel: '  ', beginn: '2026-11-11T18:00:00Z', zeitzone: 'UTC', link: LINK })
        .satz,
    ).toBe('Das Protokoll „Sitzung“ vom Mi, 11.11.2026 ist freigegeben.');
  });
});

describe('beitragsText (Markdown, gemessen 11.11.2026)', () => {
  it('Satz, Leerzeile, Link', () => {
    expect(beitragsText({ titel: 'x', satz: 'Das Protokoll ist frei.', link: LINK })).toBe(
      `Das Protokoll ist frei.\n\n[Protokoll öffnen](${LINK})`,
    );
  });

  it('Auszeichnung im Titel der Sitzung bleibt Text', () => {
    expect(
      beitragsText({ titel: 'x', satz: 'Das Protokoll „*Team* [neu]“ ist frei.', link: LINK }),
    ).toBe(`Das Protokoll „\\*Team\\* \\[neu\\]“ ist frei.\n\n[Protokoll öffnen](${LINK})`);
  });
});

describe('beitragsGruppenAus (`/post/groups`)', () => {
  it('nur Einträge mit `postPossible` und gültiger Gruppe', () => {
    expect([
      ...beitragsGruppenAus([
        { group: { domainIdentifier: '262' }, type: 'postPossible' },
        { group: { domainIdentifier: '7' }, type: 'etwasAnderes' },
        { group: { domainIdentifier: 'x' }, type: 'postPossible' },
        { type: 'postPossible' },
        null,
      ]),
    ]).toEqual([262]);
  });

  it('keine Liste: keine Gruppe', () => {
    expect(beitragsGruppenAus(null).size).toBe(0);
    expect(beitragsGruppenAus({ data: [] }).size).toBe(0);
  });
});
