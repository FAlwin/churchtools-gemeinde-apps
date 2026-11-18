import { describe, expect, it } from 'vitest';
import {
  OHNE_EIGENEN_TEXT,
  ablaufMails,
  durchlassSchritte,
  eigenerTextAlsBeschreibung,
  eigenerTextAus,
  routinenSchritte,
  schrittFolge,
  warteBeschreibung,
  warteFehler,
  wegfallendeWarten,
  zweiteMailAus,
  zweiteWannText,
  type AblaufMail,
  type RoutinenSchritt,
  type ZweiteMail,
  type ZweiteWann,
} from './ablaeufe';
import { einstellungen } from './senden.testdaten';

/**
 * F7b – die zweite Mail (Klick-Runde 11, Alwin 18.11.2026, Messung M3). Geprüft über die Erzeuger: Beschreibungen
 * schreiben → lesen, Schritte bauen → wiedererkennen, so wie die Erweiterung sie in ChurchTools schreibt.
 */
const z = (wann: ZweiteWann, text = 'Hallo [Vorname]!'): ZweiteMail => ({
  wann,
  betreff: 'Infos',
  text,
});
const M = (betreff: string): AblaufMail => ({ betreff, html: `<p>${betreff}</p>` });
const LOESCHEN = '2027-02-15';
const ER = {
  mail: M('Erinnerung'),
  liste: [
    { tage: 14, datum: '2026-11-01', an: true },
    { tage: 3, datum: '2026-11-12', an: true },
  ],
};

/** Schritte mit Nummern, wie ChurchTools sie zurückgibt – fehlende Nummern bekommen neue. */
let naechste = 1;
function gespeichert(s: RoutinenSchritt[]) {
  return s.map((x) => ({ ...x, id: x.id ?? 1000 + naechste++ }));
}
const kurz = (s: RoutinenSchritt[]) =>
  s.map((x) =>
    x.actionKey === 'special:wait'
      ? 'duration' in x.actionData
        ? `warten ${x.actionData.duration.numDays} Tage`
        : `warten ${x.actionData.untilDate}`
      : x.actionKey === 'send-member-email'
        ? `mail ${x.actionData.subject}${x.isEnabled ? '' : ' (aus)'}`
        : x.actionKey,
  );
const bauen = (
  zw: ZweiteMail | null,
  vorher: { id: number; actionKey: string }[] = [],
  vw: ZweiteWann | null = null,
  er = ER,
) =>
  routinenSchritte(
    M('Bestätigung'),
    7,
    vorher,
    LOESCHEN,
    true,
    er,
    zw && { mail: M(zw.betreff), wann: zw.wann, an: true },
    vw,
  );

describe('Speichern in den Beschreibungen', () => {
  it('„wann“ in „Platz“, Betreff + Text in „Warteliste“ – zusammen gelesen wieder dieselbe Mail', () => {
    for (const wann of [
      { art: 'sofort' },
      { art: 'tage', tage: 3 },
      { art: 'datum', datum: '2027-05-01' },
    ] as ZweiteWann[]) {
      const platz = eigenerTextAlsBeschreibung(OHNE_EIGENEN_TEXT, OHNE_EIGENEN_TEXT, z(wann));
      const warte = warteBeschreibung(OHNE_EIGENEN_TEXT, z(wann));
      expect(JSON.parse(platz!)).not.toHaveProperty('zweite');
      expect(JSON.parse(warte!)).not.toHaveProperty('zweiteWann');
      expect(zweiteMailAus(platz, warte)).toEqual(z(wann));
    }
  });

  it('eine Hälfte fehlt → aus (lieber keine Mail als eine leere); ältere Beschreibungen → aus', () => {
    const platz = eigenerTextAlsBeschreibung(
      OHNE_EIGENEN_TEXT,
      OHNE_EIGENEN_TEXT,
      z({ art: 'sofort' }),
    );
    const warte = warteBeschreibung(OHNE_EIGENEN_TEXT, z({ art: 'sofort' }));
    expect(zweiteMailAus(platz, null)).toBeNull();
    expect(zweiteMailAus(null, warte)).toBeNull();
    const alt = JSON.stringify({ v: 1, betreff: '', absatz: 'Hallo', gruss: '' });
    expect(zweiteMailAus(alt, alt)).toBeNull();
    // Der eigene Text der Mails bleibt davon unberührt.
    expect(eigenerTextAus(warte)).toEqual(OHNE_EIGENEN_TEXT);
  });

  it('ohne zweite Mail ändert sich nichts an den Beschreibungen', () => {
    const t = { ...OHNE_EIGENEN_TEXT, absatz: 'Hallo' };
    expect(warteBeschreibung(t, null)).toBe(eigenerTextAlsBeschreibung(t));
    expect(warteBeschreibung(OHNE_EIGENEN_TEXT, null)).toBeNull();
  });
});

describe('warteFehler', () => {
  it('Text fehlt, Tage außerhalb, kein Tag, Tag am Löschdatum oder danach', () => {
    const f = (zw: ZweiteMail) => warteFehler(OHNE_EIGENEN_TEXT, zw, LOESCHEN);
    expect(f(z({ art: 'sofort' }, ' '))).toBe('Die zweite Mail braucht einen Text.');
    expect(f(z({ art: 'tage', tage: 0 }))).toMatch(/1 bis 365 Tage/);
    expect(f(z({ art: 'tage', tage: 366 }))).toMatch(/1 bis 365 Tage/);
    expect(f(z({ art: 'tage', tage: Number.NaN }))).toMatch(/1 bis 365 Tage/);
    expect(f(z({ art: 'datum', datum: '' }))).toBe('Zweite Mail: bitte ein Datum wählen.');
    expect(f(z({ art: 'datum', datum: LOESCHEN }))).toMatch(/Löschdatum/);
    expect(f(z({ art: 'datum', datum: '2027-02-14' }))).toBeNull();
    expect(warteFehler(OHNE_EIGENEN_TEXT, z({ art: 'datum', datum: '2030-01-01' }))).toBeNull();
  });

  it('Warteliste und zweite Mail zusammen höchstens 1.000 Zeichen', () => {
    const t = { ...OHNE_EIGENEN_TEXT, absatz: 'x'.repeat(500) };
    expect(warteFehler(t, z({ art: 'sofort' }, 'y'.repeat(400)))).toBeNull();
    expect(warteFehler(t, z({ art: 'sofort' }, 'y'.repeat(500)))).toMatch(
      /Warteliste und zweite Mail sind zusammen zu lang/,
    );
  });
});

describe('ablaufMails – die zweite Mail', () => {
  it('Betreff, Text mit „Antwort einfügen“, Gruß; ohne Betreff der Standard; aus → null', () => {
    const e = { ...einstellungen(), kontakt: 'info@x.de' };
    const m = ablaufMails(e, 'Kinderfreizeit', new Map(), {
      platz: OHNE_EIGENEN_TEXT,
      warte: OHNE_EIGENEN_TEXT,
      zweite: z({ art: 'sofort' }, 'Hallo [Vorname]!\n\n<b>Bis bald</b>'),
    });
    expect(m.zweite?.betreff).toBe('Infos');
    expect(m.zweite?.html).toBe(
      '<p>Hallo {{person.firstName}}!</p><p>&lt;b&gt;Bis bald&lt;/b&gt;</p><p>Bei Fragen: info@x.de<br>Viele Grüße</p>',
    );
    const ohne = ablaufMails(e, 'Kinderfreizeit', new Map(), {
      platz: OHNE_EIGENEN_TEXT,
      warte: OHNE_EIGENEN_TEXT,
      zweite: { ...z({ art: 'sofort' }), betreff: ' ' },
    });
    expect(ohne.zweite?.betreff).toBe('Kinderfreizeit: Weitere Infos');
    expect(ablaufMails(e, 'K', new Map()).zweite).toBeNull();
  });
});

describe('routinenSchritte + schrittFolge – wo die zweite Mail steht', () => {
  it('sofort / X Tage: direkt nach der Bestätigung; Datum: nach Datum zwischen den Erinnerungen, vor einer am selben Tag', () => {
    expect(kurz(bauen(z({ art: 'sofort' })))).toEqual([
      'mail Bestätigung',
      'mail Infos',
      'warten 2026-11-01',
      'mail Erinnerung',
      'warten 2026-11-12',
      'mail Erinnerung',
      `warten ${LOESCHEN}`,
      'remove-member',
    ]);
    expect(kurz(bauen(z({ art: 'tage', tage: 3 }))).slice(0, 4)).toEqual([
      'mail Bestätigung',
      'warten 3 Tage',
      'mail Infos',
      'warten 2026-11-01',
    ]);
    expect(kurz(bauen(z({ art: 'datum', datum: '2026-11-12' }))).slice(3, 7)).toEqual([
      'warten 2026-11-12',
      'mail Infos',
      'warten 2026-11-12',
      'mail Erinnerung',
    ]);
    expect(kurz(bauen(z({ art: 'datum', datum: '2026-12-01' }))).slice(-4)).toEqual([
      'warten 2026-12-01',
      'mail Infos',
      `warten ${LOESCHEN}`,
      'remove-member',
    ]);
  });

  it('ohne Löschdatum: Bestätigung und zweite Mail, sonst nichts', () => {
    const s = routinenSchritte(M('B'), 7, [], null, true, ER, {
      mail: M('Infos'),
      wann: { art: 'datum', datum: '2026-11-05' },
      an: true,
    });
    expect(kurz(s)).toEqual(['mail B', 'warten 2026-11-05', 'mail Infos']);
  });

  it('schrittFolge erkennt sie wieder – die Erinnerungen bleiben Erinnerungen', () => {
    for (const wann of [
      { art: 'sofort' },
      { art: 'tage', tage: 3 },
      { art: 'datum', datum: '2026-11-05' },
      { art: 'datum', datum: '2026-11-12' },
    ] as ZweiteWann[]) {
      const s = gespeichert(bauen(z(wann)));
      const f = schrittFolge(s, wann);
      const mailNr = s.find(
        (x) => x.actionKey === 'send-member-email' && x.actionData.subject === 'Infos',
      )!.id;
      expect(f.zweite?.mail).toBe(mailNr);
      expect(f.erinnerungen).toHaveLength(2);
      expect(f.loeschWarte).toBe(s.at(-2)!.id);
      // Ohne das „Wann“ wäre ein Datum-Paar eine dritte Erinnerung – darum steht es in der Beschreibung.
      if (wann.art === 'datum') expect(schrittFolge(s).erinnerungen).toHaveLength(3);
    }
  });

  it('gleiche Art, gleiche Stelle → dieselben Nummern; andere Stelle → neue, die alten Warte-Schritte fallen weg', () => {
    const tage = gespeichert(bauen(z({ art: 'tage', tage: 3 })));
    const nochmal = bauen(z({ art: 'tage', tage: 5 }), tage, { art: 'tage', tage: 3 });
    expect(nochmal.map((x) => x.id)).toEqual(tage.map((x) => x.id));
    expect(wegfallendeWarten(tage, nochmal)).toEqual([]);

    const sofort = bauen(z({ art: 'sofort' }), tage, { art: 'tage', tage: 3 });
    expect(wegfallendeWarten(tage, sofort)).toEqual([tage[1].id]);
    expect(sofort[1].id).toBeUndefined();

    const d1 = gespeichert(bauen(z({ art: 'datum', datum: '2026-11-05' })));
    const gleich = bauen(z({ art: 'datum', datum: '2026-11-10' }), d1, {
      art: 'datum',
      datum: '2026-11-05',
    });
    expect(wegfallendeWarten(d1, gleich)).toEqual([]);
    const ueber = bauen(z({ art: 'datum', datum: '2026-11-20' }), d1, {
      art: 'datum',
      datum: '2026-11-05',
    });
    expect(wegfallendeWarten(d1, ueber)).toEqual([d1[3].id]);
    // Die Erinnerungen behalten ihre Nummern.
    expect(
      ueber
        .filter((x) => x.actionKey === 'special:wait')
        .slice(0, 2)
        .map((x) => x.id),
    ).toEqual([d1[1].id, d1[5].id]);

    const aus = bauen(null, tage, { art: 'tage', tage: 3 });
    expect(wegfallendeWarten(tage, aus)).toEqual([tage[1].id]);
  });

  it('Nachstarten: `an: false` schaltet nur die Mail aus', () => {
    const s = routinenSchritte(M('B'), 7, [], LOESCHEN, false, null, {
      mail: M('Infos'),
      wann: { art: 'sofort' },
      an: false,
    });
    expect(kurz(s)).toEqual([
      'mail B (aus)',
      'mail Infos (aus)',
      `warten ${LOESCHEN}`,
      'remove-member',
    ]);
  });
});

describe('durchlassSchritte', () => {
  it('wegfallende Warte-Schritte „bis heute“, die Mail dahinter aus, ohne `emailId`; alles andere unverändert', () => {
    const vorher = [
      {
        id: 1,
        actionKey: 'send-member-email',
        isEnabled: true,
        actionData: { subject: 'B', emailId: 9 },
      },
      {
        id: 2,
        actionKey: 'special:wait',
        isEnabled: true,
        actionData: { duration: { numDays: 3 } },
      },
      {
        id: 3,
        actionKey: 'send-member-email',
        isEnabled: true,
        actionData: { subject: 'Z', emailId: 10 },
      },
      { id: 4, actionKey: 'special:wait', isEnabled: true, actionData: { untilDate: LOESCHEN } },
      { id: 5, actionKey: 'remove-member', isEnabled: true, actionData: null },
    ];
    expect(durchlassSchritte(vorher, [2], '2026-10-28')).toEqual([
      { id: 1, actionKey: 'send-member-email', isEnabled: true, actionData: { subject: 'B' } },
      {
        id: 2,
        actionKey: 'special:wait',
        isEnabled: true,
        actionData: { untilDate: '2026-10-28' },
      },
      { id: 3, actionKey: 'send-member-email', isEnabled: false, actionData: { subject: 'Z' } },
      { id: 4, actionKey: 'special:wait', isEnabled: true, actionData: { untilDate: LOESCHEN } },
      { id: 5, actionKey: 'remove-member', isEnabled: true, actionData: {} },
    ]);
  });
});

describe('zweiteWannText', () => {
  it('nennt den Zeitpunkt', () => {
    expect(zweiteWannText({ art: 'sofort' })).toBe('gleich nach der Bestätigung');
    expect(zweiteWannText({ art: 'tage', tage: 1 })).toBe('1 Tag nach der Anmeldung');
    expect(zweiteWannText({ art: 'tage', tage: 3 })).toBe('3 Tage nach der Anmeldung');
    expect(zweiteWannText({ art: 'datum', datum: '2027-05-01' })).toMatch(/^am .*01\.05\.2027$/);
  });
});
