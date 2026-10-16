// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { einstellungenAlsText } from '@shared/anmeldung/formular';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { App } from './App';

/**
 * Echt anmelden (A6-2, #548) gegen ein nachgestelltes ChurchTools – Token, Formular-Aufbau, Anmeldung, so wie am
 * 14.10.2026 an der Test-Instanz gemessen. Jeder Fehlerfall einzeln; die Eingaben bleiben stehen.
 */
function einstellungen() {
  const e = neueEinstellungen('einfach');
  e.ctFelder = { kontakt: 580, tel: 603, note: 606, allergy: 609 };
  return e;
}
const GRUPPE = {
  id: 66,
  name: 'Gemeindeessen',
  information: { note: einstellungenAlsText(einstellungen()), imageUrl: null },
  maxMemberCount: null,
  currentMemberCount: 0,
  allowWaitinglist: false,
  canSignUp: true,
};
const FORM = {
  form: [
    { id: 2, type: 'person', name: 'firstName' },
    { id: 3, type: 'person', name: 'lastName' },
    { id: 14, type: 'person', name: 'email' },
    { id: 580, type: 'custom', name: 'Angemeldet von' },
    { id: 603, type: 'custom', name: 'Telefon' },
    { id: 606, type: 'custom', name: 'Bemerkungen' },
    { id: 609, type: 'custom', name: 'Allergien' },
    { id: -2, type: 'privacy', name: 'privacy' },
  ],
  addChildForm: [{ id: 16, type: 'person', name: 'birthday' }],
};

type Antwort = { status: number; body?: unknown } | 'netz';
let antworten: Record<string, Antwort[]>;
let aufrufe: { methode: string; pfad: string; body?: unknown; credentials?: string }[];

beforeEach(() => {
  // Nur die Uhr gestellt (A6-3: Mindest-Ausfüllzeit), die Zeitgeber laufen echt – `findBy…` wartet weiter.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
  aufrufe = [];
  antworten = {
    'GET /api/publicgroups/66': [{ status: 200, body: { data: GRUPPE } }],
    'GET /api/info': [{ status: 200, body: { siteName: 'Gemeinde Test' } }],
    'POST /api/publicgroups/66/token': [{ status: 200, body: { data: { token: 'T1' } } }],
    'GET /api/publicgroups/66/form': [{ status: 200, body: { data: { token: 'T1', ...FORM } } }],
    'POST /api/publicgroups/66/signup': [
      { status: 200, body: { verificationNotice: false, verificationEmail: null } },
    ],
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input));
    const methode = (init?.method ?? 'GET').toUpperCase();
    aufrufe.push({
      methode,
      pfad: url.pathname,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      credentials: init?.credentials,
    });
    const liste = antworten[`${methode} ${url.pathname}`] ?? [{ status: 404 }];
    const a = liste.length > 1 ? liste.shift()! : liste[0];
    if (a === 'netz') return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve(
      new Response(JSON.stringify(a.body ?? {}), {
        status: a.status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  window.location.hash = '#test.church.tools/66';
});
afterEach(() => {
  vi.useRealTimers();
  window.location.hash = '';
  window.history.replaceState(null, '', '/');
});

async function ausfuellenUndAbschicken() {
  render(<App />);
  await screen.findByRole('heading', { name: 'Gemeindeessen' });
  const feld = (id: string) => document.getElementById(id) as HTMLInputElement;
  fireEvent.change(feld('af-anmeldung.name-vor'), { target: { value: 'Maria' } });
  fireEvent.change(feld('af-anmeldung.name-nach'), { target: { value: 'Beispiel' } });
  fireEvent.change(feld('af-anmeldung.mail'), { target: { value: 'maria@beispiel.test' } });
  fireEvent.change(feld('af-anmeldung.tel'), { target: { value: '0151 111' } });
  fireEvent.change(feld('af-personen.0.pname-vor'), { target: { value: 'Jonas' } });
  fireEvent.change(feld('af-personen.0.pname-nach'), { target: { value: 'Beispiel' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /einverstanden/ }));
  // Ein Mensch braucht länger als die Mindest-Ausfüllzeit (A6-3).
  vi.setSystemTime(new Date('2026-10-16T10:00:30Z'));
  fireEvent.click(screen.getByRole('button', { name: 'Verbindlich anmelden' }));
}
const geschickt = () => aufrufe.filter((a) => a.pfad.endsWith('/signup'));

describe('Echt anmelden (A6-2)', () => {
  it('Token → Formular → Anmeldung, ohne Login; nur die Teilnehmenden, Kontakt bei der ersten Person', async () => {
    await ausfuellenUndAbschicken();
    expect(await screen.findByText('Danke für die Anmeldung!')).toBeTruthy();
    expect(aufrufe.map((a) => `${a.methode} ${a.pfad}`).slice(2)).toEqual([
      'POST /api/publicgroups/66/token',
      'GET /api/publicgroups/66/form',
      // #602: direkt vor der Anmeldung frisch nachsehen, ob noch ein Platz frei ist.
      'GET /api/publicgroups/66',
      'POST /api/publicgroups/66/signup',
    ]);
    expect(aufrufe.every((a) => a.credentials === 'omit')).toBe(true);
    const body = geschickt()[0].body as {
      token: string;
      forms: { form: { id: string; value: string }[] }[];
      hasAcceptedPrivacyForSelf: boolean;
    };
    expect(body.token).toBe('T1');
    expect(body.hasAcceptedPrivacyForSelf).toBe(true);
    // A6-4: „Austreten“ in der Mail von ChurchTools führt auf „Deine Anmeldung“ – auf unserer Seite.
    expect((body as unknown as { signOutUrlTemplate: string }).signOutUrlTemplate).toBe(
      `${window.location.origin}/#test.church.tools/$groupId/abmelden/$token`,
    );
    expect(body.forms).toHaveLength(1);
    const w = (id: string) => body.forms[0].form.find((x) => x.id === id)?.value;
    expect([w('2'), w('3'), w('14'), w('580'), w('603')]).toEqual([
      'Jonas',
      'Beispiel',
      'maria@beispiel.test',
      'Maria Beispiel',
      '0151 111',
    ]);
    // Nach einer echten Anmeldung kein „Zurück“ (sonst zweite Anmeldung).
    expect(screen.queryByRole('button', { name: 'Zurück zum Formular' })).toBeNull();
  });

  it('schon bekannt → „Fast geschafft“, bitte per Mail bestätigen', async () => {
    antworten['POST /api/publicgroups/66/signup'] = [
      { status: 200, body: { verificationNotice: true, verificationEmail: 'maria@beispiel.test' } },
    ];
    await ausfuellenUndAbschicken();
    expect(await screen.findByText('Fast geschafft!')).toBeTruthy();
    expect(screen.getByText(/bestätige die Anmeldung über den Link/).textContent).toMatch(
      /maria@beispiel\.test/,
    );
  });

  it('vorübergehend (503 beim Anmelden) → Meldung, Eingaben bleiben, zweiter Klick schickt erneut', async () => {
    antworten['POST /api/publicgroups/66/signup'] = [
      { status: 503 },
      { status: 200, body: { verificationNotice: false } },
    ];
    await ausfuellenUndAbschicken();
    expect((await screen.findByRole('alert')).textContent).toMatch(/antwortet gerade nicht/);
    expect((document.getElementById('af-personen.0.pname-vor') as HTMLInputElement).value).toBe(
      'Jonas',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Verbindlich anmelden' }));
    expect(await screen.findByText('Danke für die Anmeldung!')).toBeTruthy();
    expect(geschickt()).toHaveLength(2);
  });

  it('keine Verbindung → eigene Meldung, Eingaben bleiben', async () => {
    antworten['POST /api/publicgroups/66/token'] = ['netz'];
    await ausfuellenUndAbschicken();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Keine Verbindung/);
    expect(geschickt()).toHaveLength(0);
  });

  it('403 (voll oder geschlossen) → endgültige Meldung', async () => {
    antworten['POST /api/publicgroups/66/token'] = [{ status: 403 }];
    await ausfuellenUndAbschicken();
    expect((await screen.findByRole('alert')).textContent).toMatch(/gerade nicht anmelden/);
  });

  it('400 mit Meldung von ChurchTools → die Meldung steht da', async () => {
    antworten['POST /api/publicgroups/66/signup'] = [
      { status: 400, body: { translatedMessage: 'E-Mail ungültig' } },
    ];
    await ausfuellenUndAbschicken();
    expect((await screen.findByRole('alert')).textContent).toMatch(/„E-Mail ungültig“/);
  });

  it('Formular passt nicht zu ChurchTools (Feld fehlt) → nichts abgeschickt, Gemeinde Bescheid geben', async () => {
    antworten['GET /api/publicgroups/66/form'] = [
      { status: 200, body: { data: { ...FORM, form: FORM.form.filter((x) => x.id !== 580) } } },
    ];
    await ausfuellenUndAbschicken();
    expect((await screen.findByRole('alert')).textContent).toMatch(/nicht richtig eingerichtet/);
    expect(geschickt()).toHaveLength(0);
  });

  it('?probe → Trockenlauf: kein Token, keine Anmeldung', async () => {
    window.history.replaceState(null, '', '/?probe#test.church.tools/66');
    await ausfuellenUndAbschicken();
    expect(await screen.findByText(/Probelauf – abgeschickt wurde nichts/)).toBeTruthy();
    await waitFor(() => expect(aufrufe.some((a) => a.pfad.endsWith('/token'))).toBe(false));
  });
});

describe('Mehrere Personen (#602) – jede einzeln, Plätze beim Hinzufügen', () => {
  const gruppe = (aktuell: number, max: number | null, warteliste: boolean) => ({
    status: 200,
    body: {
      data: {
        ...GRUPPE,
        maxMemberCount: max,
        currentMemberCount: aktuell,
        allowWaitinglist: warteliste,
      },
    },
  });
  const feld = (id: string) => document.getElementById(id) as HTMLInputElement;

  async function zweiPersonen() {
    render(<App />);
    await screen.findByRole('heading', { name: 'Gemeindeessen' });
    fireEvent.change(feld('af-anmeldung.name-vor'), { target: { value: 'Maria' } });
    fireEvent.change(feld('af-anmeldung.name-nach'), { target: { value: 'Beispiel' } });
    fireEvent.change(feld('af-anmeldung.mail'), { target: { value: 'maria@beispiel.test' } });
    fireEvent.change(feld('af-anmeldung.tel'), { target: { value: '0151 111' } });
    fireEvent.change(feld('af-personen.0.pname-vor'), { target: { value: 'Jonas' } });
    fireEvent.change(feld('af-personen.0.pname-nach'), { target: { value: 'Beispiel' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Weitere Person' }));
    await waitFor(() => expect(document.getElementById('af-personen.1.pname-vor')).toBeTruthy());
    fireEvent.change(feld('af-personen.1.pname-vor'), { target: { value: 'Lea' } });
    fireEvent.change(feld('af-personen.1.pname-nach'), { target: { value: 'Beispiel' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /einverstanden/ }));
  }
  const abschicken = () => {
    vi.setSystemTime(new Date('2026-10-16T10:00:30Z'));
    fireEvent.click(
      screen.getByRole('button', { name: /Verbindlich anmelden|Auf die Warteliste/ }),
    );
  };
  const vornamen = () =>
    geschickt().map((a) =>
      (a.body as { forms: { form: { id: string; value: string }[] }[] }).forms.map(
        (f) => f.form.find((x) => x.id === '2')?.value,
      ),
    );

  it('zwei Personen → zwei Anmeldungen mit eigenem Token, je eine Person; Kontakt nur bei der ersten', async () => {
    antworten['POST /api/publicgroups/66/token'] = [
      { status: 200, body: { data: { token: 'T1' } } },
      { status: 200, body: { data: { token: 'T2' } } },
    ];
    await zweiPersonen();
    abschicken();
    expect(await screen.findByText('Danke für die Anmeldung!')).toBeTruthy();
    expect(vornamen()).toEqual([['Jonas'], ['Lea']]);
    const b = geschickt().map(
      (a) => a.body as { token: string; forms: { form: { id: string }[] }[] },
    );
    expect(b.map((x) => x.token)).toEqual(['T1', 'T2']);
    const hat = (i: number, id: string) => b[i].forms[0].form.some((x) => x.id === id);
    expect([hat(0, '580'), hat(1, '580'), hat(0, '603'), hat(1, '603')]).toEqual([
      true,
      false,
      true,
      false,
    ]);
    const liste = screen.getByRole('list');
    expect(within(liste).getAllByText('✓ angemeldet')).toHaveLength(2);
    expect(screen.getByText(/für jede Person eine eigene/)).toBeTruthy();
  });

  it('mit Warteliste: beim Hinzufügen frisch gefragt → „Warteliste“ an der Person; danach je Person das Ergebnis', async () => {
    antworten['GET /api/publicgroups/66'] = [
      gruppe(3, 10, true), // Laden: 7 frei
      gruppe(9, 10, true), // „+ Weitere Person“: inzwischen nur noch 1 frei
      gruppe(9, 10, true), // vor Jonas
      gruppe(10, 10, true), // vor Lea: voll → Warteliste
    ];
    await zweiPersonen();
    // Schildchen an Person 2 und der Satz darunter.
    expect(screen.getAllByText('Warteliste').map((x) => x.tagName)).toEqual(['SMALL', 'B']);
    expect(screen.getByText(/Für Person 2 ist kein Platz mehr frei/)).toBeTruthy();
    expect(screen.getByText('bekommt einen Platz')).toBeTruthy();
    abschicken();
    const liste = await screen.findByRole('list');
    expect(within(liste).getByText('✓ angemeldet')).toBeTruthy();
    expect(within(liste).getByText('Warteliste')).toBeTruthy();
    expect(vornamen()).toEqual([['Jonas'], ['Lea']]);
  });

  it('ohne Warteliste und kein Platz mehr → „+ Weitere Person“ fügt nicht hinzu und ist gesperrt, mit Grund', async () => {
    antworten['GET /api/publicgroups/66'] = [gruppe(3, 10, false), gruppe(9, 10, false)];
    render(<App />);
    await screen.findByRole('heading', { name: 'Gemeindeessen' });
    const knopf = screen.getByRole('button', { name: '+ Weitere Person' });
    fireEvent.click(knopf);
    expect(await screen.findByText(/Kein Platz mehr frei/)).toBeTruthy();
    expect(document.getElementById('af-personen.1.pname-vor')).toBeNull();
    expect(knopf).toHaveProperty('disabled', true);
  });

  it('Platz-Abfrage beim Hinzufügen scheitert → trotzdem hinzugefügt (vorübergehend ist nicht ungültig)', async () => {
    antworten['GET /api/publicgroups/66'] = [gruppe(3, 10, false), { status: 503 }];
    await zweiPersonen();
    expect(feld('af-personen.1.pname-vor').value).toBe('Lea');
  });

  it('zweite scheitert (503) → Ergebnis je Person; „noch einmal“ schickt NUR die zweite', async () => {
    antworten['POST /api/publicgroups/66/signup'] = [
      { status: 200, body: { verificationNotice: false } },
      { status: 503 },
      { status: 200, body: { verificationNotice: false } },
    ];
    await zweiPersonen();
    abschicken();
    expect(await screen.findByText('Fast fertig')).toBeTruthy();
    expect(screen.getByText('nicht angemeldet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lea Beispiel noch einmal anmelden' }));
    await waitFor(() => expect(geschickt()).toHaveLength(3));
    expect(vornamen()).toEqual([['Jonas'], ['Lea'], ['Lea']]);
    expect(await screen.findByText('Danke für die Anmeldung!')).toBeTruthy();
    expect(within(screen.getByRole('list')).getAllByText('✓ angemeldet')).toHaveLength(2);
  });

  it('dazwischen voll ohne Warteliste → zweite „kein Platz mehr“, nichts für sie geschickt', async () => {
    antworten['GET /api/publicgroups/66'] = [
      gruppe(3, 10, false),
      gruppe(3, 10, false),
      gruppe(9, 10, false),
      gruppe(10, 10, false),
    ];
    await zweiPersonen();
    abschicken();
    expect(await screen.findByText('kein Platz mehr')).toBeTruthy();
    expect(vornamen()).toEqual([['Jonas']]);
    expect(screen.queryByRole('button', { name: /noch einmal anmelden/ })).toBeNull();
  });

  it('500 → ehrliche Meldung („Fehler gemeldet … Gemeinde Bescheid“), nicht „antwortet gerade nicht“', async () => {
    antworten['POST /api/publicgroups/66/signup'] = [{ status: 500 }];
    await ausfuellenUndAbschicken();
    const meldung = (await screen.findByRole('alert')).textContent;
    expect(meldung).toMatch(/Fehler gemeldet/);
    expect(meldung).toMatch(/Gemeinde Bescheid/);
  });
});
