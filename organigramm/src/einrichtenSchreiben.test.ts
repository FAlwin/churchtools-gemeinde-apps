import { describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { KeinSpeicherRecht } from '@ui/ct/verbindung';
import { einrichtungsPlan } from '@shared/organigramm/einrichtungPlan';
import {
  LEITER_RECHTE,
  REGELN,
  sommerferienAus,
  GRUNDWERTE,
  wechseljahre,
} from '@shared/organigramm/gruppenwechsel';
import {
  fehlerSortieren,
  schreibeEinrichtung,
  SchrittFehler,
  type Eingabe,
  type Lauf,
} from './einrichtenSchreiben';
import {
  anschluss,
  BEREICH,
  einrichtenEingabe,
  einstellungMit,
  FakeCt,
  FakeSpeicher,
  lageAus,
  S2,
  S3,
  SOLL3,
  VON,
} from './einrichtenSchreiben.testutil';

/** Ohne Ziffern: so lässt sich die Reihenfolge der schreibenden Aufrufe vergleichen. */
const art = (a: { methode: string; pfad: string }) => `${a.methode} ${a.pfad.replace(/\d+/g, '#')}`;

const gelaufen = (l: Lauf) => {
  if (l.art !== 'gelaufen') throw new Error(`gestoppt: ${l.grund}`);
  return l;
};

/** Das erste Einrichten gegen ein frisches, gefälschtes ChurchTools. */
async function einrichten(
  f = new FakeCt(),
  s = new FakeSpeicher(),
  e: Eingabe = einrichtenEingabe(),
) {
  const lauf = await schreibeEinrichtung(e, anschluss(f, s, e));
  return { f, s, lauf };
}

describe('Einrichten – der ganze Lauf gegen ein gefälschtes ChurchTools', () => {
  it('schreibt in der Reihenfolge der Messung O9-5a – exakt die Schritte des Plans', async () => {
    const { f, lauf } = await einrichten();
    const l = gelaufen(lauf);
    expect(l.ok).toBe(true);
    expect(l.ergebnisse.every((x) => x.ausgang.art === 'ok')).toBe(true);
    // Die Schritte des Laufs sind die des Plans – nicht eine zweite Liste.
    const plan = einrichtungsPlan(SOLL3, {
      typ: { ok: true, wert: false },
      alt: null,
      gruppen: new Map(),
      stand: null,
      jahre: [2031, 2032],
    });
    expect(l.ergebnisse.map((x) => x.schritt.art)).toEqual(plan.schritte.map((x) => x.art));
    // …und die schreibenden Aufrufe kommen in genau dieser Ordnung.
    expect(f.aufrufe.map(art)).toEqual([
      'POST /group/grouptypes',
      ...LEITER_RECHTE.map(() => 'PUT /permissions/group_type_role/#'),
      'POST /groups',
      'POST /groups',
      'POST /routines',
      'PATCH /routines/#',
      'POST /routines',
      'PATCH /routines/#',
      'PUT /dynamicgroups/#/ruleset',
      'PUT /dynamicgroups/#/ruleset',
      'PUT /dynamicgroups/#/status',
      'PUT /dynamicgroups/#/status',
      'PUT /dynamicgroups/#/ruleset',
      'PUT /dynamicgroups/#/ruleset',
      'PUT /dynamicgroups/#/ruleset',
      'PUT /dynamicgroups/#/status',
      'PUT /dynamicgroups/#/status',
      'PUT /dynamicgroups/#/status',
      'POST /dynamicgroups/#/refresh',
      'POST /dynamicgroups/#/refresh',
    ]);
  });

  it('die Routine kommt vor den Regeln, die Regeln der Wechsel-Gruppen vor denen der Stufen, der Status nach den Regeln', async () => {
    const { f } = await einrichten();
    const i = (pfad: RegExp) => f.aufrufe.findIndex((a) => pfad.test(`${a.methode} ${a.pfad}`));
    expect(i(/PATCH \/routines/)).toBeLessThan(i(/ruleset/));
    expect(i(/PUT \/dynamicgroups\/100\/ruleset/)).toBeLessThan(
      i(/PUT \/dynamicgroups\/1\/ruleset/),
    );
    expect(i(/PUT \/dynamicgroups\/100\/ruleset/)).toBeLessThan(
      i(/PUT \/dynamicgroups\/100\/status/),
    );
    expect(i(/PUT \/dynamicgroups\/1\/ruleset/)).toBeLessThan(i(/PUT \/dynamicgroups\/1\/status/));
    expect(i(/refresh/)).toBeGreaterThan(i(/PUT \/dynamicgroups\/3\/status/));
  });

  it('legt den Typ mit den vorläufig gemessenen Werten an – ohne Beiträge, Pflicht-Leiter und neue Personen', async () => {
    const { f } = await einrichten();
    const typ = f.aufrufe.find((a) => a.pfad === '/group/grouptypes')!.json as Record<
      string,
      unknown
    >;
    expect(typ).toMatchObject({
      name: 'Gruppenwechsel',
      namePlural: 'Gruppenwechsel',
      shorty: 'GW',
      postsEnabled: false,
      isLeaderNecessary: false,
      availableForNewPerson: false,
      permissionDepth: 1,
      color: 'gray',
      sortKey: 6, // der größte vorhandene (5) + 1
    });
  });

  it('die Rechte der Leitung: genau die drei aus LEITER_RECHTE an der Rolle „Leiter“, Stufe nur wo vorgesehen', async () => {
    const { f } = await einrichten();
    const puts = f.aufrufe.filter((a) => a.pfad.startsWith('/permissions/'));
    expect(puts.map((a) => a.pfad)).toEqual(
      LEITER_RECHTE.map(() => '/permissions/group_type_role/48'),
    );
    expect(puts.map((a) => a.json)).toEqual(
      LEITER_RECHTE.map((r) =>
        r.dataId === null ? { authId: r.authId } : { authId: r.authId, dataId: [r.dataId] },
      ),
    );
    expect(f.aufrufe.some((a) => a.pfad.includes('/45'))).toBe(false); // Teilnehmer: keine Rechte
  });

  it('die Wechsel-Gruppen: versteckt, Typ „Gruppenwechsel“, direkt unter dem Bereich', async () => {
    const { f } = await einrichten();
    const posts = f.aufrufe.filter((a) => a.methode === 'POST' && a.pfad === '/groups');
    expect(posts.map((a) => a.json)).toEqual([
      {
        name: 'Schäfchen → Fische',
        groupTypeId: 9,
        groupStatusId: 1,
        parentGroupId: BEREICH,
        visibility: 'hidden',
      },
      {
        name: 'Fische → Jungschar',
        groupTypeId: 9,
        groupStatusId: 1,
        parentGroupId: BEREICH,
        visibility: 'hidden',
      },
    ]);
  });

  it('Status „aktiv“ überall: Jede Wechsel-Gruppe und jede Stufe bekommt dynamicGroupStatus active – nie „manual“', async () => {
    const { f } = await einrichten();
    const bodies = f.aufrufe.filter((a) => a.pfad.endsWith('/status')).map((a) => a.json);
    expect(bodies).toHaveLength(5);
    expect(bodies.every((b) => JSON.stringify(b) === '{"dynamicGroupStatus":"active"}')).toBe(true);
    expect([...f.status.values()]).toEqual(['active', 'active', 'active', 'active', 'active']);
  });

  it('ChurchTools gibt `remove-member` mit actionData null zurück – das zählt als dasselbe wie {}', async () => {
    const { f, lauf } = await einrichten();
    expect(gelaufen(lauf).ok).toBe(true);
    const steps = [...f.routinen.values()].flat()[0].routine.steps;
    expect(steps.find((x) => x.actionKey === 'remove-member')?.actionData).toBeNull();
  });

  it('speichert die Einrichtung sofort nach JEDER neuen Wechsel-Gruppe – und am Ende nicht ein drittes Mal, wenn nichts Neues dazukam', async () => {
    const { s, lauf } = await einrichten();
    const l = gelaufen(lauf);
    expect(s.gespeichert.map((x) => x.inhalt.wechselGruppen.map((w) => w.gruppeId))).toEqual([
      [100],
      [100, 101],
    ]);
    // Die Version, die gelesen wurde, wird erwartet: erst „keine“, dann die eigene.
    expect(s.gespeichert.map((x) => x.erwartet)).toEqual([null, 1]);
    expect(l.gespeichert?.wechselGruppen).toHaveLength(2);
  });

  it('Fortschritt: nach jedem Schritt wird der Stand gemeldet', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    const e = einrichtenEingabe();
    const gemeldet: number[] = [];
    await schreibeEinrichtung(
      e,
      anschluss(f, s, e, {
        fortschritt: (erg) => gemeldet.push(erg.filter((x) => x.ausgang.art === 'ok').length),
      }),
    );
    expect(gemeldet[0]).toBe(1);
    expect(gemeldet[gemeldet.length - 1]).toBe(gemeldet.length);
  });
});

describe('Jeder Schritt zählt erst, wenn das Nachlesen es zeigt (ein 200 ist kein Beleg)', () => {
  // `ignoriere`: ChurchTools meldet Erfolg und übernimmt nichts.
  it.each([
    ['den Gruppentyp', 'POST /group/grouptypes', 'typ'],
    ['die Rechte', 'PUT /permissions', 'rechte'],
    ['die Wechsel-Gruppe (keine Nummer)', 'POST /groups', 'wechselGruppe'],
    ['die Routine-Schritte', 'PATCH /routines', 'routine'],
    ['die Regeln der Wechsel-Gruppe', '/ruleset', 'regelnWechselGruppe'],
    ['den Status', '/status', 'statusWechselGruppe'],
    ['das Neuberechnen', '/refresh', 'neuBerechnen'],
  ])(
    'ChurchTools nimmt %s „an“, übernimmt aber nichts → Fehler, der Rest bleibt offen',
    async (_, ignoriere, schritt) => {
      const f = new FakeCt();
      f.ignoriere = [ignoriere];
      if (schritt === 'neuBerechnen') f.refresh = () => [];
      const { lauf } = await einrichten(f);
      const l = gelaufen(lauf);
      expect(l.ok).toBe(false);
      const i = l.ergebnisse.findIndex((x) => x.ausgang.art === 'fehler');
      expect(l.ergebnisse[i].schritt.art).toBe(schritt);
      expect(l.ergebnisse[i].ausgang).toMatchObject({ art: 'fehler', grund: 'anderer' });
      expect(l.ergebnisse.slice(i + 1).every((x) => x.ausgang.art === 'offen')).toBe(true);
      expect(l.ergebnisse.slice(0, i).every((x) => x.ausgang.art === 'ok')).toBe(true);
    },
  );

  it('Regeln: stimmt auch nur ein Zeichen nicht, ist es ein Fehler (Zeichenvergleich)', async () => {
    const f = new FakeCt();
    const echt = f.schicken;
    f.schicken = async (pfad, methode, json) => {
      const r = await echt(pfad, methode, json);
      // ChurchTools „verbessert“ eine Beschreibung beim Speichern.
      if (pfad.endsWith('/ruleset')) {
        const id = Number(/(\d+)/.exec(pfad)![1]);
        const regeln = f.regeln.get(id) as { description: string }[];
        regeln[0] = { ...regeln[0], description: `${regeln[0].description}.` };
      }
      return r;
    };
    const { lauf } = await einrichten(f);
    const l = gelaufen(lauf);
    expect(l.ok).toBe(false);
    const fehler = l.ergebnisse.find((x) => x.ausgang.art === 'fehler')!;
    expect(fehler.schritt.art).toBe('regelnWechselGruppe');
  });

  it('der Typ ohne die Rolle „Leiter“ ist kein fertiger Typ', async () => {
    const f = new FakeCt();
    const echt = f.schicken;
    f.schicken = async (pfad, methode, json) => {
      const r = await echt(pfad, methode, json);
      if (pfad === '/group/grouptypes')
        f.rollen = f.rollen.filter((x) => x.groupTypeId !== 9 || !x.isLeader);
      return r;
    };
    const { lauf } = await einrichten(f);
    const l = gelaufen(lauf);
    expect(l.ergebnisse[0].ausgang).toMatchObject({ art: 'fehler', grund: 'anderer' });
  });

  it('die Gruppe mit anderem Typ oder anderem Namen, als verlangt, wird nicht angenommen', async () => {
    for (const verbiege of [
      (g: { typId: number; name: string }) => (g.typId = 7),
      (g: { typId: number; name: string }) => (g.name = 'Etwas anderes'),
    ]) {
      const f = new FakeCt();
      const echt = f.schicken;
      f.schicken = async (pfad, methode, json) => {
        const r = await echt(pfad, methode, json);
        if (pfad === '/groups') verbiege(f.gruppen.get(100)!);
        return r;
      };
      const { lauf } = await einrichten(f);
      const l = gelaufen(lauf);
      expect(l.ergebnisse.find((x) => x.ausgang.art === 'fehler')?.schritt.art).toBe(
        'wechselGruppe',
      );
    }
  });

  it('die Routine, deren Schritte nach dem Schreiben fehlen, wird nicht angenommen – auch bei vorhandener Routine', async () => {
    const f = new FakeCt();
    f.ignoriere = ['PATCH /routines'];
    const { lauf } = await einrichten(f);
    const fehler = gelaufen(lauf).ergebnisse.find((x) => x.ausgang.art === 'fehler')!;
    expect(fehler.schritt.art).toBe('routine');
    expect(JSON.stringify(fehler.ausgang)).toContain('Schritte');
  });

  it('die Gruppe unter der falschen Obergruppe oder mit falschem Typ wird nicht angenommen', async () => {
    const f = new FakeCt();
    const echt = f.schicken;
    f.schicken = async (pfad, methode, json) => {
      const r = await echt(pfad, methode, json);
      if (pfad === '/groups') f.gruppen.get(100)!.parent = null; // ChurchTools hängt sie nicht an
      return r;
    };
    const { lauf } = await einrichten(f);
    const l = gelaufen(lauf);
    expect(l.ergebnisse.find((x) => x.ausgang.art === 'fehler')?.schritt.art).toBe('wechselGruppe');
  });
});

describe('Beim ersten Fehler wird aufgehört – vorübergehend ist nicht ungültig', () => {
  it('Zeitüberschreitung mitten drin: „vorübergehend“, alles Weitere „offen“, nichts mehr geschrieben, nichts zurückgerollt', async () => {
    const f = new FakeCt();
    f.ausfall = (a) =>
      a.pfad === '/dynamicgroups/1/ruleset'
        ? new ApiError(504, 'ChurchTools antwortet nicht')
        : undefined;
    const { lauf, s } = await einrichten(f);
    const l = gelaufen(lauf);
    expect(l.ok).toBe(false);
    const i = l.ergebnisse.findIndex((x) => x.ausgang.art === 'fehler');
    expect(l.ergebnisse[i].schritt.art).toBe('regelnStufe');
    expect(l.ergebnisse[i].ausgang).toMatchObject({ art: 'fehler', grund: 'voruebergehend' });
    expect(l.ergebnisse.slice(i + 1).every((x) => x.ausgang.art === 'offen')).toBe(true);
    // Der fehlgeschlagene Aufruf war der letzte schreibende; vorher Geschriebenes steht noch da.
    expect(art(f.aufrufe[f.aufrufe.length - 1])).toBe('PUT /dynamicgroups/#/ruleset');
    expect(f.gruppen.has(100)).toBe(true);
    expect(f.typen.some((t) => t.name === 'Gruppenwechsel')).toBe(true);
    expect(f.aufrufe.every((a) => !a.methode.startsWith('DELETE'))).toBe(true);
    // Die Gruppen sind schon eingetragen – ohne den Rest.
    expect(s.inhalt?.wechselGruppen).toHaveLength(2);
  });

  it.each([
    ['504 Zeitüberschreitung', new ApiError(504, 'x'), 'voruebergehend'],
    ['502', new ApiError(502, 'x'), 'voruebergehend'],
    ['429 Drosselung', new ApiError(503, 'ChurchTools bremst'), 'voruebergehend'],
    ['403 ohne ChurchTools-Rumpf', new ApiError(403, 'x'), 'voruebergehend'],
    ['Netz', new TypeError('Failed to fetch'), 'voruebergehend'],
    ['401 abgemeldet', new ApiError(401, 'x'), 'abgelehnt'],
    ['kein Recht (ChurchTools-403)', new KeinSpeicherRecht('nein'), 'abgelehnt'],
    ['422', new ApiError(422, 'Unprocessable'), 'anderer'],
    ['400', new ApiError(400, 'Bad request'), 'anderer'],
  ])('%s → %s', (_, fehler, grund) => {
    expect(fehlerSortieren(fehler).grund).toBe(grund);
  });

  it('abgelehnt sagt, dass das Recht fehlt; vorübergehend sagt, dass nichts kaputt ist', () => {
    expect(fehlerSortieren(new KeinSpeicherRecht('x')).text).toContain('Recht');
    expect(fehlerSortieren(new ApiError(401, 'x')).text).toContain('angemeldet');
    expect(fehlerSortieren(new ApiError(504, 'x')).text).toContain('Nichts ist kaputt');
    expect(fehlerSortieren(new SchrittFehler('anderer', 'Mein Satz')).text).toBe('Mein Satz');
  });

  it('kein Recht beim Schreiben: „abgelehnt“ am betroffenen Schritt', async () => {
    const f = new FakeCt();
    f.ausfall = (a) => (a.pfad === '/group/grouptypes' ? new KeinSpeicherRecht('nein') : undefined);
    const { lauf } = await einrichten(f);
    const l = gelaufen(lauf);
    expect(l.ergebnisse[0].ausgang).toMatchObject({ art: 'fehler', grund: 'abgelehnt' });
    expect(l.ergebnisse.slice(1).every((x) => x.ausgang.art === 'offen')).toBe(true);
    expect(f.aufrufe).toHaveLength(1);
  });
});

describe('„Nochmal versuchen“ – liest neu, schreibt nur, was fehlt, legt nie eine zweite Gruppe an', () => {
  /** Ein zweiter Versuch mit dem, was der erste gespeichert hat. */
  const nochmal = (f: FakeCt, s: FakeSpeicher, l: Lauf, e = einrichtenEingabe()) => {
    const e2: Eingabe = { ...e, ausgang: gelaufen(l).gespeichert };
    return schreibeEinrichtung(e2, anschluss(f, s, e2));
  };

  it('nach einem Abbruch bei den Regeln der Stufen: der zweite Versuch legt weder Typ noch Gruppen noch Routinen neu an', async () => {
    const f = new FakeCt();
    let aus = true;
    f.ausfall = (a) =>
      aus && a.pfad === '/dynamicgroups/2/ruleset' ? new ApiError(504, 'x') : undefined;
    const s = new FakeSpeicher();
    const { lauf } = await einrichten(f, s);
    expect(gelaufen(lauf).ok).toBe(false);
    aus = false;
    const davor = f.aufrufe.length;
    const l2 = gelaufen(await nochmal(f, s, lauf));
    expect(l2.ok).toBe(true);
    const neu = f.aufrufe.slice(davor);
    expect(neu.some((a) => a.pfad === '/group/grouptypes')).toBe(false);
    expect(neu.some((a) => a.pfad === '/groups')).toBe(false);
    expect(neu.some((a) => a.pfad === '/routines' || a.pfad.startsWith('/routines/'))).toBe(false);
    expect(neu.some((a) => a.pfad.startsWith('/permissions/'))).toBe(false);
    // Die Regeln der Wechsel-Gruppen laufen schon (Status aktiv) – nur der Rest steht in den Schritten.
    expect(l2.ergebnisse.filter((x) => x.schritt.art === 'statusWechselGruppe')).toHaveLength(0);
    expect(f.status.get(2)).toBe('active');
    // Zwei Wechsel-Gruppen, nicht vier.
    expect([...f.gruppen.values()].filter((g) => g.typId === 9)).toHaveLength(2);
  });

  it('Lücke 1: Gruppe angelegt, die Einrichtung ließ sich nicht speichern → der zweite Versuch ÜBERNIMMT die Gruppe', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    s.scheitere = (n) => (n === 1 ? { ok: false, grund: 'voruebergehend' } : undefined);
    const { lauf } = await einrichten(f, s);
    const l = gelaufen(lauf);
    const fehler = l.ergebnisse.find((x) => x.ausgang.art === 'fehler')!;
    expect(fehler.schritt.art).toBe('wechselGruppe');
    expect(fehler.ausgang).toMatchObject({ art: 'fehler', grund: 'voruebergehend' });
    // Die Meldung sagt, welche Gruppe da ist und dass keine zweite entsteht.
    expect(JSON.stringify(fehler.ausgang)).toContain('Nummer 100');
    expect(JSON.stringify(fehler.ausgang)).toContain('keine zweite');
    expect(f.anzahl('POST', '/groups')).toBe(1);
    expect(s.inhalt).toBeNull();

    const l2 = gelaufen(await nochmal(f, s, lauf));
    expect(l2.ok).toBe(true);
    // Zwei Wechsel-Gruppen für zwei Übergänge – die erste übernommen, nur die zweite neu angelegt.
    expect(f.anzahl('POST', '/groups')).toBe(2);
    expect(
      [...f.gruppen]
        .filter(([, g]) => g.typId === 9)
        .map(([, g]) => g.name)
        .sort(),
    ).toEqual(['Fische → Jungschar', 'Schäfchen → Fische']);
    expect(s.inhalt?.wechselGruppen.map((w) => w.gruppeId)).toEqual([100, 101]);
  });

  it('Lücke 2: ChurchTools legt die Gruppe an, die Antwort geht verloren (Zeitüberschreitung) → der zweite Versuch findet sie wieder', async () => {
    const f = new FakeCt();
    f.antwortVerloren = (a) => a.pfad === '/groups';
    const s = new FakeSpeicher();
    const { lauf } = await einrichten(f, s);
    const l = gelaufen(lauf);
    expect(l.ergebnisse.find((x) => x.ausgang.art === 'fehler')?.ausgang).toMatchObject({
      grund: 'voruebergehend',
    });
    expect(f.anzahl('POST', '/groups')).toBe(1);
    f.antwortVerloren = null;
    const l2 = gelaufen(await nochmal(f, s, lauf));
    expect(l2.ok).toBe(true);
    expect([...f.gruppen.values()].filter((g) => g.typId === 9)).toHaveLength(2);
    expect(f.anzahl('POST', '/groups')).toBe(2);
  });

  it('gibt es zwei gleichnamige, nicht eingetragene Gruppen, wird nicht geraten, sondern gestoppt', async () => {
    const f = new FakeCt().mitTyp();
    f.wechselGruppe('Schäfchen → Fische');
    f.wechselGruppe('Schäfchen → Fische');
    const { lauf } = await einrichten(f);
    const l = gelaufen(lauf);
    const fehler = l.ergebnisse.find((x) => x.ausgang.art === 'fehler')!;
    expect(fehler.schritt.art).toBe('wechselGruppe');
    expect(JSON.stringify(fehler.ausgang)).toContain('2 Gruppen');
    expect(f.anzahl('POST', '/groups')).toBe(0);
  });

  it('eine Gruppe gleichen Namens ANDERS (anderer Typ, andere Obergruppe) wird nicht übernommen', async () => {
    const f = new FakeCt().mitTyp();
    f.gruppen.set(300, { name: 'Schäfchen → Fische', typId: 7, parent: BEREICH });
    f.gruppen.set(301, { name: 'Fische → Jungschar', typId: 9, parent: S2 });
    const { lauf } = await einrichten(f);
    expect(gelaufen(lauf).ok).toBe(true);
    expect(f.anzahl('POST', '/groups')).toBe(2);
  });
});

describe('Die gespeicherte Einrichtung: Konflikt = melden, nicht überschreiben', () => {
  it('Versionskonflikt beim Speichern: Fehler am Schritt, nichts überschrieben, kein weiterer Aufruf', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    s.scheitere = () => ({ ok: false, grund: 'konflikt' });
    const { lauf } = await einrichten(f, s);
    const l = gelaufen(lauf);
    const fehler = l.ergebnisse.find((x) => x.ausgang.art === 'fehler')!;
    expect(fehler.ausgang).toMatchObject({ art: 'fehler', grund: 'anderer' });
    expect(JSON.stringify(fehler.ausgang)).toContain('nichts überschrieben');
    expect(s.inhalt).toBeNull();
    expect(f.anzahl('POST', '/groups')).toBe(1);
    expect(f.anzahl('PUT', /ruleset/)).toBe(0);
  });

  it('hat jemand anderes inzwischen eine Einrichtung gespeichert: gestoppt, bevor irgendetwas geschrieben ist', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    s.inhalt = { ...SOLL3, wechselGruppen: [] };
    s.version = 4;
    const e = einrichtenEingabe(); // erwartet: noch keine
    const lauf = await schreibeEinrichtung(e, anschluss(f, s, e));
    expect(lauf).toMatchObject({ art: 'gestoppt' });
    expect(f.aufrufe).toHaveLength(0);
    expect(s.gespeichert).toHaveLength(0);
  });

  it('Ändern: stimmt die gespeicherte nicht mehr mit der überein, aus der das Formular stammt → gestoppt', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    const erst = einrichtenEingabe();
    const l1 = gelaufen(await schreibeEinrichtung(erst, anschluss(f, s, erst)));
    // Ein anderer Admin ändert die Stufen.
    s.inhalt = {
      ...l1.gespeichert!,
      einstellung: einstellungMit(2),
      wechselGruppen: [l1.gespeichert!.wechselGruppen[0]],
    };
    s.version += 1;
    const e: Eingabe = { art: 'aendern', soll: SOLL3, ausgang: l1.gespeichert, von: VON };
    const davor = f.aufrufe.length;
    const lauf = await schreibeEinrichtung(e, anschluss(f, s, e));
    expect(lauf).toMatchObject({ art: 'gestoppt' });
    expect(f.aufrufe).toHaveLength(davor);
  });

  it('die Einrichtung ließ sich nicht lesen / hat ein fremdes Format: nichts geschrieben; Lesefehler darf wiederholt werden, Format nicht', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    const e = einrichtenEingabe();
    const a = anschluss(f, s, e);
    const mit = (g: Awaited<ReturnType<typeof lageAus>>['gespeichert']) =>
      schreibeEinrichtung(e, {
        ...a,
        lage: async () => ({ ...(await lageAus(f, s, e)), gespeichert: g }),
      });
    expect(await mit({ art: 'fehler', grund: 'voruebergehend' })).toMatchObject({
      art: 'gestoppt',
      nochmal: true,
    });
    expect(await mit({ art: 'unlesbar' })).toMatchObject({ art: 'gestoppt', nochmal: false });
    expect(f.aufrufe).toHaveLength(0);
  });
});

describe('Vor dem ersten Schreiben wird noch einmal geprüft – nicht nur der Knopf', () => {
  const mitLage = (
    f: FakeCt,
    s: FakeSpeicher,
    e: Eingabe,
    ueber: Partial<Awaited<ReturnType<typeof lageAus>>>,
  ) =>
    schreibeEinrichtung(e, {
      ...anschluss(f, s, e),
      lage: async () => ({ ...(await lageAus(f, s, e)), ...ueber }),
    });

  it('fremde Regeln in einer Stufe → gestoppt, kein einziger Aufruf', async () => {
    const f = new FakeCt();
    f.regeln.set(S2, [{ shorty: 'jugendliste' }]);
    const e = einrichtenEingabe();
    const lauf = await schreibeEinrichtung(e, anschluss(f, new FakeSpeicher(), e));
    expect(lauf).toMatchObject({ art: 'gestoppt' });
    expect(lauf.art === 'gestoppt' && lauf.grund).toContain('„Fische“');
    expect(f.aufrufe).toHaveLength(0);
  });

  it('Regeln einer Stufe nicht lesbar → gestoppt (wiederholbar), nie „es gibt keine“', async () => {
    const f = new FakeCt();
    const e = einrichtenEingabe();
    const lauf = await mitLage(f, new FakeSpeicher(), e, {
      regeln: new Map([[S2, { ok: false }]]),
    });
    expect(lauf).toMatchObject({ art: 'gestoppt', nochmal: true });
    expect(f.aufrufe).toHaveLength(0);
  });

  it('der Plan ist „unsicher“ (Gruppentyp nicht lesbar) → gestoppt, wiederholbar', async () => {
    const f = new FakeCt();
    const e = einrichtenEingabe();
    const lauf = await mitLage(f, new FakeSpeicher(), e, { typ: { ok: false } });
    expect(lauf).toMatchObject({ art: 'gestoppt', nochmal: true });
    expect(f.aufrufe).toHaveLength(0);
  });

  it('der Ferienkalender nennt keine künftigen Jahre → gestoppt; nicht lesbar → gestoppt und wiederholbar', async () => {
    const f = new FakeCt();
    const e = einrichtenEingabe();
    expect(await mitLage(f, new FakeSpeicher(), e, { jahre: [] })).toMatchObject({
      art: 'gestoppt',
      nochmal: false,
    });
    expect(await mitLage(f, new FakeSpeicher(), e, { jahre: null })).toMatchObject({
      art: 'gestoppt',
      nochmal: true,
    });
    expect(f.aufrufe).toHaveLength(0);
  });

  it('eine Einstellung, die nicht stimmt (zwei Stufen mit gleichem Alter) → gestoppt', async () => {
    const f = new FakeCt();
    const e = einrichtenEingabe({
      bereichGruppeId: BEREICH,
      einstellung: {
        ...einstellungMit(3),
        stufen: einstellungMit(3).stufen.map((x) => ({ ...x, abAlter: 5 })),
      },
    });
    const lauf = await schreibeEinrichtung(e, anschluss(f, new FakeSpeicher(), e));
    expect(lauf).toMatchObject({ art: 'gestoppt' });
    expect(f.aufrufe).toHaveLength(0);
  });

  it('Gruppen nicht lesbar → gestoppt (sonst legte der Lauf eine Gruppe doppelt an)', async () => {
    const f = new FakeCt();
    const e = einrichtenEingabe();
    const lauf = await mitLage(f, new FakeSpeicher(), e, { gruppen: null });
    expect(lauf).toMatchObject({ art: 'gestoppt', nochmal: true });
    expect(f.aufrufe).toHaveLength(0);
  });

  it('beim Lesen scheitert etwas (Netz): gestoppt und wiederholbar; abgemeldet: gestoppt, nicht wiederholbar', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    const e = einrichtenEingabe();
    const a = anschluss(f, s, e);
    expect(
      await schreibeEinrichtung(e, {
        ...a,
        lage: () => Promise.reject(new TypeError('Failed to fetch')),
      }),
    ).toMatchObject({ art: 'gestoppt', nochmal: true });
    expect(
      await schreibeEinrichtung(e, { ...a, lage: () => Promise.reject(new ApiError(401, 'x')) }),
    ).toMatchObject({ art: 'gestoppt', nochmal: false });
  });
});

describe('Stufen ändern – Status, entfernte Stufen, nichts löschen', () => {
  /** Erst einrichten, dann ändern: Der zweite Lauf baut auf dem auf, was der erste hinterlassen hat. */
  async function eingerichtet() {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    const e = einrichtenEingabe();
    const l = gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    return { f, s, l, ausgang: l.gespeichert };
  }

  it('Status „manual“ oder „none“ an Gruppen: das Schreiben stellt sie auf „aktiv“', async () => {
    const { f, s, ausgang } = await eingerichtet();
    f.status.set(1, 'manual');
    f.status.set(100, 'none');
    const e: Eingabe = { art: 'aendern', soll: SOLL3, ausgang, von: VON };
    const l = gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    expect(l.ok).toBe(true);
    expect(l.ergebnisse.filter((x) => x.schritt.art === 'statusStufe')).toHaveLength(1);
    expect(l.ergebnisse.filter((x) => x.schritt.art === 'statusWechselGruppe')).toHaveLength(1);
    expect([...f.status.values()].every((x) => x === 'active')).toBe(true);
  });

  it('Ändern ohne Änderung an den Stufen: Die Einrichtung wird nicht noch einmal gespeichert (keine neue Version)', async () => {
    const { f, s, ausgang } = await eingerichtet();
    const versionDavor = s.version;
    const e: Eingabe = { art: 'aendern', soll: SOLL3, ausgang, von: VON };
    const l = gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    expect(l.ok).toBe(true);
    expect(s.version).toBe(versionDavor);
    expect(l.ergebnisse[l.ergebnisse.length - 1]).toMatchObject({
      schritt: { art: 'speichern' },
      ausgang: { art: 'ok', text: 'steht schon so da' },
    });
  });

  it('eine Stufe fällt weg: nur UNSERE Regeln gehen; fremde bleiben, der Status auch; die Wechsel-Gruppe ohne Übergang wird NICHT gelöscht', async () => {
    const { f, s, ausgang } = await eingerichtet();
    (f.regeln.get(S3) as unknown[]).push({ shorty: 'jugendliste' });
    const e: Eingabe = {
      art: 'aendern',
      soll: { ...SOLL3, einstellung: einstellungMit(2) },
      ausgang,
      von: VON,
    };
    const l = gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    expect(l.ok).toBe(true);
    // Jungschar: unsere Aufnahme-Regel weg, die fremde da, Status unverändert „aktiv“.
    expect((f.regeln.get(S3) as { shorty: string }[]).map((r) => r.shorty)).toEqual([
      'jugendliste',
    ]);
    expect(f.status.get(S3)).toBe('active');
    // Die Wechsel-Gruppe „Fische → Jungschar“ (101): keine Regeln mehr, Status aus, Gruppe und Routine unberührt.
    expect(f.regeln.get(101) ?? []).toEqual([]);
    expect(f.status.get(101)).toBe('none');
    expect(f.gruppen.has(101)).toBe(true);
    expect(f.routinen.get(101)).toHaveLength(1);
    expect(l.nichtMehrGebraucht).toEqual([{ gruppeId: 101, name: 'Fische → Jungschar' }]);
    // Die letzte Stufe (Fische) nimmt nur noch auf, trägt nicht mehr aus.
    expect((f.regeln.get(S2) as { shorty: string }[]).map((r) => r.shorty)).toEqual([
      REGELN.aufnahme.shorty,
    ]);
    // Gespeichert: nur noch der eine Übergang.
    expect(s.inhalt?.wechselGruppen.map((w) => w.gruppeId)).toEqual([100]);
    expect(s.inhalt?.einstellung.stufen).toHaveLength(2);
    // Nirgends ein DELETE.
    expect(f.aufrufe.every((a) => a.methode !== 'DELETE')).toBe(true);
  });

  it('bleibt nach dem Entfernen keine Regel übrig, geht der Status auf „keiner“; bleibt eine fremde, bleibt der Status', async () => {
    const { f, s, ausgang } = await eingerichtet();
    const e: Eingabe = {
      art: 'aendern',
      soll: { ...SOLL3, einstellung: einstellungMit(2) },
      ausgang,
      von: VON,
    };
    gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    expect(f.regeln.get(S3) ?? []).toEqual([]);
    expect(f.status.get(S3)).toBe('none');
  });

  it('eine neue Stufe am Ende: nur ihre Wechsel-Gruppe und die Routine dazu sind neu, die vorhandenen bleiben', async () => {
    const { f, s, ausgang } = await eingerichtet();
    const e: Eingabe = {
      art: 'aendern',
      soll: { ...SOLL3, einstellung: einstellungMit(4) },
      ausgang,
      von: VON,
    };
    const davor = f.aufrufe.length;
    const l = gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    expect(l.ok).toBe(true);
    const neu = f.aufrufe.slice(davor);
    expect(neu.filter((a) => a.pfad === '/groups')).toHaveLength(1);
    expect(neu.filter((a) => a.pfad === '/routines')).toHaveLength(1);
    expect(s.inhalt?.wechselGruppen).toHaveLength(3);
  });
});

describe('Rechte setzen – nur ergänzen, nie entziehen', () => {
  it('fehlt eines von dreien, wird genau das gesetzt – Zusätzliches bleibt, kein DELETE', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    const erst = einrichtenEingabe();
    gelaufen(await schreibeEinrichtung(erst, anschluss(f, s, erst)));
    // Jemand hat „Gruppeninfos sehen“ entzogen und ein Zusatzrecht von Hand gesetzt.
    f.rechte.set(48, [
      ...f.rechte.get(48)!.filter((r) => r.authId !== 10102),
      { authId: 99999, dataId: null, isInherited: false, type: 'grant' },
    ]);
    const davor = f.aufrufe.length;
    const e: Eingabe = { art: 'rechte', soll: null, ausgang: null, von: VON };
    const l = gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    expect(l.ok).toBe(true);
    expect(l.ergebnisse.map((x) => x.schritt.art)).toEqual(['rechte']);
    const neu = f.aufrufe.slice(davor);
    expect(neu).toEqual([
      {
        methode: 'PUT',
        pfad: '/permissions/group_type_role/48',
        json: { authId: 10102, dataId: [1] },
      },
    ]);
    expect(f.rechte.get(48)!.some((r) => r.authId === 99999)).toBe(true);
  });

  it('stehen alle drei schon da: nichts zu schreiben', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    const erst = einrichtenEingabe();
    gelaufen(await schreibeEinrichtung(erst, anschluss(f, s, erst)));
    const davor = f.aufrufe.length;
    const e: Eingabe = { art: 'rechte', soll: null, ausgang: null, von: VON };
    const l = gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    expect(l.ergebnisse).toEqual([]);
    expect(f.aufrufe).toHaveLength(davor);
  });

  it('nimmt ChurchTools das Recht nicht an (200 ohne Wirkung), ist es ein Fehler', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    const erst = einrichtenEingabe();
    gelaufen(await schreibeEinrichtung(erst, anschluss(f, s, erst)));
    f.rechte.set(48, f.rechte.get(48)!.slice(1));
    f.ignoriere = ['PUT /permissions'];
    const e: Eingabe = { art: 'rechte', soll: null, ausgang: null, von: VON };
    const l = gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    expect(l.ok).toBe(false);
    expect(l.ergebnisse[0].ausgang).toMatchObject({ art: 'fehler', grund: 'anderer' });
  });

  it('ohne Einrichtung gibt es nichts zu ergänzen', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    const e: Eingabe = { art: 'rechte', soll: null, ausgang: null, von: VON };
    expect(await schreibeEinrichtung(e, anschluss(f, s, e))).toMatchObject({ art: 'gestoppt' });
  });
});

describe('Wechseltage nachtragen – nur die Regeln, Ausnahmen bleiben', () => {
  const DREI = wechseljahre(
    sommerferienAus(
      [2031, 2032, 2033].map((j) => ({
        titel: `Sommerferien NRW ${j}`,
        beginn: `${j}-07-19`,
        ende: `${j}-08-31`,
      })),
      GRUNDWERTE.ferienStichwort,
    ),
    GRUNDWERTE,
  );

  async function eingerichtet() {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    const e = einrichtenEingabe();
    gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    return { f, s };
  }

  it('schreibt die Regeln aller Stufen und Wechsel-Gruppen mit allen Jahren – sonst nichts (keine Gruppe, Routine, Status, kein Speichern)', async () => {
    const { f, s } = await eingerichtet();
    const davor = f.aufrufe.length;
    const gespeichertDavor = s.gespeichert.length;
    const e: Eingabe = { art: 'nachtragen', soll: null, ausgang: null, von: VON };
    const l = gelaufen(
      await schreibeEinrichtung(e, {
        ...anschluss(f, s, e),
        lage: async () => ({ ...(await lageAus(f, s, e)), jahre: DREI }),
      }),
    );
    expect(l.ok).toBe(true);
    const neu = f.aufrufe.slice(davor);
    expect(neu.map(art)).toEqual(Array(5).fill('PUT /dynamicgroups/#/ruleset'));
    expect(l.ergebnisse.map((x) => x.schritt.art).sort()).toEqual([
      'regelnStufe',
      'regelnStufe',
      'regelnStufe',
      'regelnWechselGruppe',
      'regelnWechselGruppe',
    ]);
    expect(s.gespeichert).toHaveLength(gespeichertDavor);
    // Das neue Jahr steht in den Regeln der Wechsel-Gruppe.
    expect(JSON.stringify(f.regeln.get(100))).toContain('2033-');
    expect(JSON.stringify(f.regeln.get(100))).toContain('2031-');
  });

  it('die Regeln fassen die Ausnahme („zu löschen“) nie an: In der Kinder-Regel steht to_delete überall als {}', async () => {
    const { f, s } = await eingerichtet();
    const e: Eingabe = { art: 'nachtragen', soll: null, ausgang: null, von: VON };
    gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    const kinder = (
      f.regeln.get(100) as { shorty: string; process: Record<string, Record<string, unknown>> }[]
    ).find((r) => r.shorty === REGELN.kinder.shorty)!;
    for (const teil of ['groupAndQueryResult', 'groupOnly'])
      expect(kinder.process[teil].to_delete).toEqual({});
  });

  it('fremde Regeln in einer Stufe halten auch das Nachtragen auf – es würde sie ersetzen', async () => {
    const { f, s } = await eingerichtet();
    (f.regeln.get(S2) as unknown[]).push({ shorty: 'jugendliste' });
    const davor = f.aufrufe.length;
    const e: Eingabe = { art: 'nachtragen', soll: null, ausgang: null, von: VON };
    const lauf = await schreibeEinrichtung(e, anschluss(f, s, e));
    expect(lauf).toMatchObject({ art: 'gestoppt' });
    expect(f.aufrufe).toHaveLength(davor);
  });

  it('fehlt eine Wechsel-Gruppe, sagt der Schritt es, statt irgendwohin zu schreiben', async () => {
    const { f, s } = await eingerichtet();
    s.inhalt = { ...s.inhalt!, wechselGruppen: [s.inhalt!.wechselGruppen[0]] };
    f.gruppen.delete(101);
    const e: Eingabe = { art: 'nachtragen', soll: null, ausgang: null, von: VON };
    const l = gelaufen(await schreibeEinrichtung(e, anschluss(f, s, e)));
    expect(l.ok).toBe(false);
    expect(l.ergebnisse.find((x) => x.ausgang.art === 'fehler')?.schritt.art).toBe(
      'regelnWechselGruppe',
    );
    expect(S3).toBe(3);
  });
});
