// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
