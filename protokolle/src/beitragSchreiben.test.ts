import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NichtUebernommen, Unklar } from '@ui/ct/fehler';
import { beitragsText, type Beitrag } from '@shared/protokolle/beitrag';
import { beitragMoeglich, beitragSchritt } from './beitragSchreiben';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';

/** Beitrag in der Gruppe (S6-2) gegen die nachgestellte ChurchTools-Instanz – Wege wie gemessen 11.11.2026. */
let ct: Nachbau;
const G = 262;
const B: Beitrag = {
  titel: 'Protokoll vom 11.11.2026 ist freigegeben',
  satz: 'Das Protokoll „Leitungssitzung“ vom Mi, 11.11.2026 ist freigegeben.',
  link: 'https://ct.test/ccm/protokolle/#/sitzungen/262/s1',
};

beforeEach(() => {
  ct = nachbauStarten();
  ct.beitragsGruppen = [G];
});
afterEach(nachbauEnde);

const posts = () => ct.aufrufe.filter((a) => a === 'POST /posts');

describe('beitragMoeglich', () => {
  it('nur in Gruppen aus `/post/groups`', async () => {
    expect(await beitragMoeglich(G)).toBe(true);
    expect(await beitragMoeglich(194)).toBe(false);
  });

  it('kommt die Liste nicht: Fehler (der Aufrufer zeigt dann kein Häkchen)', async () => {
    ct.fehlerBei = { methode: 'GET', status: 504 };
    await expect(beitragMoeglich(G)).rejects.toThrow();
  });
});

describe('beitragSchritt', () => {
  it('legt an (gruppenintern, ohne Kommentare, Markdown) und liest nach', async () => {
    await beitragSchritt(G, B)();
    expect(ct.beitraege).toEqual([
      expect.objectContaining({
        groupId: G,
        title: B.titel,
        content: beitragsText(B),
        visibility: 'group_intern',
        commentsActive: false,
      }),
    ]);
    expect(ct.aufrufe).toContain(`GET /posts/${ct.beitraege[0].id}`);
  });

  it('abgelehnt (422): nichts angelegt, der Fehler kommt durch – ein zweiter Versuch schickt neu', async () => {
    ct.beitragFehler = { status: 422, angelegt: false };
    const schritt = beitragSchritt(G, B);
    const e = await schritt().catch((x: unknown) => x);
    expect(e).not.toBeInstanceOf(Unklar);
    ct.beitragFehler = null;
    await schritt();
    expect(posts()).toHaveLength(2);
    expect(ct.beitraege).toHaveLength(1);
  });

  it('unklar (504, vielleicht doch angelegt): `Unklar` – nicht einfach wiederholen', async () => {
    ct.beitragFehler = { status: 504, angelegt: true };
    await expect(beitragSchritt(G, B)()).rejects.toBeInstanceOf(Unklar);
  });

  it('Proxy-403 ohne ChurchTools-Rumpf: ebenfalls unklar', async () => {
    ct.beitragFehler = { status: 403, angelegt: true };
    await expect(beitragSchritt(G, B)()).rejects.toBeInstanceOf(Unklar);
  });

  it('angelegt, Nachlesen scheitert vorübergehend: der nächste Versuch liest nur nach, schickt nicht neu', async () => {
    ct.beitragLesenFehler = 502;
    const schritt = beitragSchritt(G, B);
    await expect(schritt()).rejects.toThrow();
    ct.beitragLesenFehler = null;
    await schritt();
    expect(posts()).toHaveLength(1);
    expect(ct.beitraege).toHaveLength(1);
  });

  it('nachgelesen, aber mit anderem Titel: nicht übernommen', async () => {
    ct.beitragTitelAnders = true;
    await expect(beitragSchritt(G, B)()).rejects.toBeInstanceOf(NichtUebernommen);
  });

  it('201, aber nicht da (nachgelesen 404): nicht übernommen – der nächste Versuch schickt neu', async () => {
    ct.beitragSchlucken = true;
    const schritt = beitragSchritt(G, B);
    await expect(schritt()).rejects.toBeInstanceOf(NichtUebernommen);
    ct.beitragSchlucken = false;
    await schritt();
    expect(posts()).toHaveLength(2);
    expect(ct.beitraege).toHaveLength(1);
  });
});
