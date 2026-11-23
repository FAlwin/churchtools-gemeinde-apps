import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import * as V from '@ui/ct/verbindung';
import * as MS from '@ui/ct/mailSenden';
import { leitungSetzen, mailSchalterSetzen } from '@shared/website/mailWerte';
import type { Wert } from '@shared/ct/modulDaten';
import { fakeSpeicher } from '@shared/website/speicher.testutil';
import { mailAnLeitung, mailFreigaben, mailZurueck } from './mailVersand';

/**
 * Das Senden der Mails im Freigabe-Weg (W3b-3) gegen ein nachgestelltes ChurchTools: Werte (Schalter, Leitung), Rollen und
 * Mitglieder der Website-Gruppe. Der Versand selbst (`mailSenden`, im Baustein getestet) ist hier ersetzt – wir prüfen, WAS an
 * WEN geht und welcher der fünf Ausgänge gemeldet wird. Die Werte entstehen mit den Schreibfunktionen, nicht als Literale.
 */
vi.mock('@ui/ct/verbindung', async (original) => ({
  ...(await original<typeof import('@ui/ct/verbindung')>()),
  ctDaten: vi.fn(),
  ctAlleSeiten: vi.fn(),
  ctBasis: () => 'https://ecg.church.tools',
}));
vi.mock('@ui/ct/mailSenden', async (original) => ({
  ...(await original<typeof import('@ui/ct/mailSenden')>()),
  mailSenden: vi.fn(),
}));
const ct = vi.mocked(V);
const senden = vi.mocked(MS.mailSenden);

const MODUL = 7;
const ENTWUERFE = 20;
const GRUPPE = 344;
const O = { modul: MODUL, entwuerfe: ENTWUERFE, gruppe: GRUPPE };
const WERTE_PFAD = `/custommodules/${MODUL}/customdatacategories/${ENTWUERFE}/customdatavalues`;
const HELENE = { person: 1, name: 'Helene Wiebe', fenster: 'f1' };
const RITA = { person: 5, name: 'Rita Redakteurin', fenster: 'f2' };

/**
 * Wie auf der Test-Instanz gemessen (23.11.2026): `id` ist die `group_role` (daran hängen Rechte und der Wert
 * `website-leitung`), die Mitglieder tragen die `groupTypeRoleId`. Absichtlich verschiedene Zahlen – mit gleichen fiele die
 * Verwechslung nicht auf (so war es im ersten Bau).
 */
const ROLLEN_ROH = [
  { id: 3290, groupTypeRoleId: 16, name: 'Leiter', isLeader: true, isActive: true },
  { id: 3291, groupTypeRoleId: 17, name: 'Co-Leiter', isLeader: true, isActive: true },
  { id: 3287, groupTypeRoleId: 15, name: 'Mitarbeiter', isLeader: false, isActive: true },
];
const TYP = { 3290: 16, 3291: 17, 3287: 15 } as const;
const mitglied = (personId: number, rolle: number, email?: string, status = 'active') => ({
  personId,
  groupTypeRoleId: rolle,
  groupMemberStatus: status,
  person: { title: `Person ${personId}`, ...(email ? { email } : {}) },
});

let werte: Wert[];
let mitglieder: unknown[];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('BASE_URL', '/ccm/website/');
  werte = [];
  mitglieder = [
    mitglied(1, TYP[3290], 'helene@example.org'), // Leitung
    mitglied(2, TYP[3291]), // Co-Leitung
    mitglied(5, TYP[3287]), // Rita, Mitarbeiterin
    mitglied(6, TYP[3290], undefined, 'requested'), // nur angefragt – kein Mitglied
  ];
  ct.ctDaten.mockImplementation((pfad: string) => {
    if (pfad === WERTE_PFAD) return Promise.resolve(werte.map((w) => ({ ...w })) as never);
    if (pfad === `/groups/${GRUPPE}/roles`) return Promise.resolve(ROLLEN_ROH as never);
    return Promise.reject(new Error(`unerwartet: ${pfad}`));
  });
  ct.ctAlleSeiten.mockImplementation((pfad: string) =>
    pfad === `/groups/${GRUPPE}/members`
      ? Promise.resolve(mitglieder as never)
      : Promise.reject(new Error(`unerwartet: ${pfad}`)),
  );
  senden.mockResolvedValue({ bestaetigt: null });
});

/** Die Werte mit den echten Schreibfunktionen erzeugen (nicht als Literale). */
async function werteSetzen(opt: { leitung?: number[]; mail?: boolean }) {
  const s = fakeSpeicher();
  if (opt.leitung) await leitungSetzen(s.ort, opt.leitung);
  if (opt.mail !== undefined) await mailSchalterSetzen(s.ort, opt.mail);
  werte = s.werte;
}

const empfaenger = (nr = 0) => senden.mock.calls[nr][1].map((x) => x.personId);

describe('Einreichen und Löschen anfragen: Mail an die Leitung', () => {
  it('geht an die Leitung (Rollen aus dem Wert), nicht an den Handelnden; mit Link, Gruppe und Meldung bei „verweigert“', async () => {
    await werteSetzen({ leitung: [3290] });
    const r = await mailAnLeitung(O, { art: 'eingereicht', seite: 'Jugendabend' }, RITA);
    expect(r).toEqual({ art: 'gesendet' });
    expect(senden).toHaveBeenCalledTimes(1);
    expect(senden.mock.calls[0][0]).toBe(GRUPPE);
    expect(empfaenger()).toEqual([1]);
    expect(senden.mock.calls[0][2]).toBe('Website: „Jugendabend“ wartet auf Freigabe');
    expect(senden.mock.calls[0][3]).toContain('href="https://ecg.church.tools/ccm/website/"');
    expect(senden.mock.calls[0][4]?.verweigert).toMatch(/Mails über ChurchTools/);
  });

  it('die Adresse reist mit, wenn ChurchTools sie dem Leser zeigt – sonst nicht', async () => {
    await werteSetzen({ leitung: [3290, 3291] });
    await mailAnLeitung(O, { art: 'eingereicht', seite: 'A' }, RITA);
    expect(senden.mock.calls[0][1]).toEqual([
      { personId: 1, email: 'helene@example.org' },
      { personId: 2 },
    ]);
  });

  it('Löschen anfragen geht ebenfalls an die Leitung – mit eigenem Betreff', async () => {
    await mailAnLeitung(O, { art: 'loeschenAngefragt', seite: 'Alte Seite' }, RITA);
    expect(empfaenger()).toEqual([1, 2]);
    expect(senden.mock.calls[0][2]).toBe('Website: „Alte Seite“ – Löschen angefragt');
  });

  it('kein Wert: die Vorbelegung – die Rollen mit Leiter-Kennzeichen', async () => {
    await werteSetzen({});
    await mailAnLeitung(O, { art: 'eingereicht', seite: 'A' }, RITA);
    expect(empfaenger()).toEqual([1, 2]);
  });

  it('ein gespeicherter Wert geht der Vorbelegung vor', async () => {
    await werteSetzen({ leitung: [3287] });
    const r = await mailAnLeitung(O, { art: 'eingereicht', seite: 'A' }, HELENE);
    expect(empfaenger()).toEqual([5]);
    expect(r).toEqual({ art: 'gesendet' });
  });

  it('sich selbst nicht: reicht die einzige Leitung selbst ein, ist niemand übrig – kein Aufruf, kein Fehler', async () => {
    mitglieder = [mitglied(1, TYP[3290]), mitglied(5, TYP[3287])];
    const r = await mailAnLeitung(O, { art: 'eingereicht', seite: 'A' }, HELENE);
    expect(r).toEqual({ art: 'niemand' });
    expect(senden).not.toHaveBeenCalled();
  });

  it('Schalter aus: gar kein Aufruf – auch kein Lesen von Rollen und Mitgliedern', async () => {
    await werteSetzen({ mail: false });
    const r = await mailAnLeitung(O, { art: 'eingereicht', seite: 'A' }, RITA);
    expect(r).toEqual({ art: 'aus' });
    expect(senden).not.toHaveBeenCalled();
    expect(ct.ctAlleSeiten).not.toHaveBeenCalled();
  });

  it('Schalter ausdrücklich an: es geht', async () => {
    await werteSetzen({ mail: true });
    expect((await mailAnLeitung(O, { art: 'eingereicht', seite: 'A' }, RITA)).art).toBe('gesendet');
  });

  it('Titel mit HTML: bleibt Text im Mailtext', async () => {
    await mailAnLeitung(O, { art: 'eingereicht', seite: '<script>x</script>' }, RITA);
    expect(senden.mock.calls[0][3]).not.toContain('<script>');
  });

  it('abgelehnt / kein Recht: „nicht verschickt“ mit Grund – und es wird nicht noch einmal versucht', async () => {
    senden.mockRejectedValue(
      new ApiError(422, 'ChurchTools hat die Mails nicht angenommen: Keine Empfänger'),
    );
    const r = await mailAnLeitung(O, { art: 'eingereicht', seite: 'A' }, RITA);
    expect(r).toEqual({
      art: 'nichtVerschickt',
      grund: 'ChurchTools hat die Mails nicht angenommen: Keine Empfänger',
    });
    expect(senden).toHaveBeenCalledTimes(1);
  });

  it('keine Antwort und nichts im Protokoll: „unklar“ – nichts wird wiederholt', async () => {
    senden.mockRejectedValue(new MS.UnklarObVerschickt());
    const r = await mailAnLeitung(O, { art: 'eingereicht', seite: 'A' }, RITA);
    expect(r).toEqual({ art: 'unklar' });
    expect(senden).toHaveBeenCalledTimes(1);
  });

  it('Schalter lässt sich nicht lesen (503): nicht verschickt – nie „an“ aus einem Aussetzer geraten', async () => {
    ct.ctDaten.mockRejectedValue(new ApiError(503, 'weg'));
    const r = await mailAnLeitung(O, { art: 'eingereicht', seite: 'A' }, RITA);
    expect(r.art).toBe('nichtVerschickt');
    expect(senden).not.toHaveBeenCalled();
  });

  it('Mitglieder lassen sich nicht lesen (403): nicht verschickt, mit Grund; die Handlung bleibt Sache des Aufrufers – hier wirft nichts', async () => {
    ct.ctAlleSeiten.mockRejectedValue(new ApiError(403, 'Mitglieder verborgen'));
    const r = await mailAnLeitung(O, { art: 'eingereicht', seite: 'A' }, RITA);
    expect(r).toEqual({ art: 'nichtVerschickt', grund: 'Mitglieder verborgen' });
    expect(senden).not.toHaveBeenCalled();
  });

  it('keine Namen, IDs oder Adressen in console.*', async () => {
    const spaeher = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
    ];
    senden.mockRejectedValue(new MS.UnklarObVerschickt());
    await mailAnLeitung(O, { art: 'eingereicht', seite: 'Jugendabend' }, RITA);
    for (const s of spaeher) {
      expect(JSON.stringify(s.mock.calls)).not.toMatch(/Rita|Helene|helene@|Jugendabend/);
      s.mockRestore();
    }
  });
});

describe('Zurückgeben: Mail an den Einreichenden', () => {
  it('geht an die Person, die eingereicht hatte – ohne Mitglieder zu lesen; mit der Anmerkung', async () => {
    const r = await mailZurueck(
      O,
      { seite: 'Jugendabend', anmerkung: 'Foto tauschen.', einreicher: 5 },
      HELENE,
    );
    expect(r).toEqual({ art: 'gesendet' });
    expect(senden.mock.calls[0][1]).toEqual([{ personId: 5 }]);
    expect(senden.mock.calls[0][2]).toBe('Website: „Jugendabend“ zurückgegeben');
    expect(senden.mock.calls[0][3]).toContain('Foto tauschen.');
    expect(ct.ctAlleSeiten).not.toHaveBeenCalled();
  });

  it('hat die Leitung selbst eingereicht, geht nichts an sich selbst', async () => {
    const r = await mailZurueck(O, { seite: 'A', anmerkung: 'x', einreicher: 1 }, HELENE);
    expect(r).toEqual({ art: 'niemand' });
    expect(senden).not.toHaveBeenCalled();
  });

  it('Einreichender unbekannt: keine Mail', async () => {
    const r = await mailZurueck(O, { seite: 'A', anmerkung: 'x', einreicher: null }, HELENE);
    expect(r).toEqual({ art: 'niemand' });
  });

  it('Schalter aus: kein Aufruf', async () => {
    await werteSetzen({ mail: false });
    const r = await mailZurueck(O, { seite: 'A', anmerkung: 'x', einreicher: 5 }, HELENE);
    expect(r).toEqual({ art: 'aus' });
    expect(senden).not.toHaveBeenCalled();
  });
});

describe('Freigeben: eine Mail je Person', () => {
  it('Alles freigeben: eine Mail je Einreichendem mit allen seinen Seiten – nicht eine je Seite', async () => {
    const r = await mailFreigaben(
      O,
      [
        { titel: 'A', einreicher: 5 },
        { titel: 'B', einreicher: 6 },
        { titel: 'C', einreicher: 5 },
      ],
      HELENE,
    );
    expect(r).toEqual({ art: 'gesendet' });
    expect(senden).toHaveBeenCalledTimes(2);
    expect(empfaenger(0)).toEqual([5]);
    expect(senden.mock.calls[0][2]).toBe('Website: 2 Seiten sind freigegeben');
    expect(senden.mock.calls[0][3]).toContain('„A“');
    expect(senden.mock.calls[0][3]).toContain('„C“');
    expect(empfaenger(1)).toEqual([6]);
    expect(senden.mock.calls[1][2]).toBe('Website: „B“ ist freigegeben');
  });

  it('eigene Seiten und Seiten ohne bekannten Einreichenden: keine Mail', async () => {
    const r = await mailFreigaben(
      O,
      [
        { titel: 'A', einreicher: 1 },
        { titel: 'B', einreicher: null },
      ],
      HELENE,
    );
    expect(r).toEqual({ art: 'niemand' });
    expect(senden).not.toHaveBeenCalled();
  });

  it('scheitert eine der Mails, bekommen die anderen ihre trotzdem – und „unklar“ geht vor „nicht verschickt“ vor „gesendet“', async () => {
    senden
      .mockResolvedValueOnce({ bestaetigt: null })
      .mockRejectedValueOnce(new ApiError(422, 'abgelehnt'))
      .mockRejectedValueOnce(new MS.UnklarObVerschickt());
    const r = await mailFreigaben(
      O,
      [
        { titel: 'A', einreicher: 5 },
        { titel: 'B', einreicher: 6 },
        { titel: 'C', einreicher: 7 },
      ],
      HELENE,
    );
    expect(senden).toHaveBeenCalledTimes(3);
    expect(r).toEqual({ art: 'unklar' });
    senden.mockReset();
    senden
      .mockResolvedValueOnce({ bestaetigt: null })
      .mockRejectedValueOnce(new ApiError(422, 'abgelehnt'));
    const r2 = await mailFreigaben(
      O,
      [
        { titel: 'A', einreicher: 5 },
        { titel: 'B', einreicher: 6 },
      ],
      HELENE,
    );
    expect(r2).toEqual({ art: 'nichtVerschickt', grund: 'abgelehnt' });
  });

  it('Schalter aus: kein Aufruf', async () => {
    await werteSetzen({ mail: false });
    const r = await mailFreigaben(O, [{ titel: 'A', einreicher: 5 }], HELENE);
    expect(r).toEqual({ art: 'aus' });
    expect(senden).not.toHaveBeenCalled();
  });
});
