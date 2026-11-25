// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { einrichtungAus } from '@shared/website/einrichten';
import { kategorienFuer } from '@shared/website/einrichten';
import { statusSetzen } from '@shared/website/status';
import { seiteSpeichern, websiteAusWerten } from '@shared/website/speicher';
import { gibFrei, nurWebsite } from '@shared/website/freigabe';
import { WEBSITE_LEITUNG, WEBSITE_REDAKTEUR, type Zugang } from '@shared/website/zugang';
import type { FreigabeDaten } from './daten';
import { ENTWUERFE, ONLINE, fakeFreigabeSpeicher } from '@shared/website/freigabe.testutil';
import { baustein, seiteMit } from '@shared/website/website.testdaten';
import { App } from './App';
import { ladeFreigaben } from './daten';
import type { Start } from './start';
import * as S from './start';
import { pruefeRechte } from './rechte';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
// Der Reiter „Freigaben“ ist in `Freigaben.test.tsx` geprüft; hier geht es um den Zähler am Reiter und wer was sieht. Gelesen wird
// über `ladeFreigaben` – sein Ergebnis steht in den Tests fest (aus dem echten Schreiben, nicht aus Literalen).
vi.mock('./daten', () => ({ ladeFreigaben: vi.fn() }));
vi.mock('./Freigaben', () => ({
  // Der Zugang als Wort (W3b-4b: ein Objekt `sieht`/`leitet`) – „leitung“, wer die Website leitet, sonst „redakteur“.
  Freigaben: ({ zugang, gruppe }: { zugang: Zugang; gruppe: number }) => (
    <p data-gruppe={gruppe}>
      FREIGABEN-INHALT {zugang.leitet === 'alle' ? 'leitung' : 'redakteur'}
    </p>
  ),
}));
const freigaben = vi.mocked(ladeFreigaben);
// Die Seiten selbst sind in `Seiten.test.tsx` geprüft – hier geht es um den Rahmen und wer hineindarf.
vi.mock('./Seiten', () => ({
  // Die Rechte, mit denen die Seiten gezeigt werden, stehen als Attribut da – daran sieht der Test, was der Zugang erlaubt.
  Seiten: ({ rechte, freigabe }: { rechte: unknown; freigabe?: { gruppe: number } }) => (
    <p data-rechte={JSON.stringify(rechte)} data-gruppe={freigabe?.gruppe}>
      SEITEN-INHALT
    </p>
  ),
}));
// Die Prüfung der Rechte beim Start liest bei ChurchTools – hier steht ihr Ergebnis fest (`rechte.test.ts` prüft sie selbst).
vi.mock('./rechte', () => ({ pruefeRechte: vi.fn() }));
const pruefung = vi.mocked(pruefeRechte);
vi.mock('./Einrichtung', () => ({ Einrichtung: () => <p>EINRICHTUNG</p> }));
// … ebenso das Aussehen (`Aussehen.test.tsx`).
vi.mock('./Aussehen', () => ({ Aussehen: () => <p>AUSSEHEN-INHALT</p> }));
// Fenster und gemeinsamer Zustand der Einstellungen: eigene Tests (`EinstellungenFenster.test.tsx`).
vi.mock('./EinstellungenFenster', () => ({
  EinstellungenFenster: ({
    onSchliessen,
    werDarfWas,
    zuWerDarfWas,
    mail,
  }: {
    onSchliessen: () => void;
    werDarfWas?: unknown;
    zuWerDarfWas?: boolean;
    mail?: { modul: number; kategorie: number };
  }) => (
    <button
      onClick={onSchliessen}
      data-wer-darf-was={werDarfWas ? 'ja' : 'nein'}
      data-springen={zuWerDarfWas ? 'ja' : 'nein'}
      data-mail={mail ? `${mail.modul}/${mail.kategorie}` : 'nein'}
    >
      EINSTELLUNGEN-FENSTER
    </button>
  ),
}));
vi.mock('./EinstellungenQuelle', () => ({
  EinstellungenProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
const ladeStart = vi.mocked(S.ladeStart);

const einrichtung = einrichtungAus(
  kategorienFuer(7, 'Website').map((k, i) => ({ id: 20 + i, shorty: k.kuerzel, name: k.name })),
);
const start = (o: Partial<Start> = {}): Start => ({
  ichId: 1,
  vorname: 'Helene',
  name: 'Helene Wiebe',
  gemeinde: 'ECG',
  modul: 7,
  einrichtung,
  stand: 'fertig',
  admin: false,
  zugang: WEBSITE_LEITUNG,
  darfRechteSetzen: false,
  leitungOhneRechte: false,
  ...o,
});

/** Entwurf und Online-Stand nach echtem Schreiben: a eingereicht (Person 5), b zurückgegeben an Person 5, c Löschen angefragt (Person 5). */
async function freigabeStand(): Promise<FreigabeDaten> {
  const s = fakeFreigabeSpeicher();
  for (const id of ['a', 'b', 'c'])
    await seiteSpeichern(
      s.entwurfsOrt,
      seiteMit([baustein('text')], { id, pfad: id, titel: id.toUpperCase() }),
    );
  await gibFrei(s.freigabeOrt, 'seite', 'c');
  const rita = { person: 5, name: 'Rita', fenster: 'f' };
  await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'eingereicht' }, rita);
  await statusSetzen(
    s.entwurfsOrt,
    'b',
    { zustand: 'zurueck', anmerkung: 'Bitte ändern', einreicher: { von: 5, name: 'Rita' } },
    { person: 1, name: 'Helene', fenster: 'g' },
  );
  await statusSetzen(s.entwurfsOrt, 'c', { zustand: 'loeschenAngefragt' }, rita);
  const entwurf = websiteAusWerten(s.werte[ENTWUERFE]);
  return { entwurf, online: nurWebsite(entwurf, websiteAusWerten(s.werte[ONLINE])) };
}
const zaehlerAmReiter = () =>
  screen.getByRole('button', { name: /^Freigaben/ }).querySelector('[data-zaehler]');

beforeEach(async () => {
  freigaben.mockResolvedValue({
    entwurf: websiteAusWerten([]),
    online: nurWebsite(websiteAusWerten([]), websiteAusWerten([])),
  });
  ladeStart.mockResolvedValue(start());
  pruefung.mockResolvedValue(null);
});

const rechteDerSeiten = () =>
  JSON.parse(screen.getByText('SEITEN-INHALT').getAttribute('data-rechte') ?? '{}') as {
    html: boolean;
    menue: boolean;
  };

describe('Mails im Freigabe-Weg: der Rahmen reicht Gruppe und Ort weiter (W3b-3)', () => {
  it('Seiten und Freigaben bekommen die Website-Gruppe – an ihre Leitung gehen die Mails', async () => {
    render(<App />);
    expect((await screen.findByText('SEITEN-INHALT')).getAttribute('data-gruppe')).toBe('7');
    fireEvent.click(screen.getByRole('button', { name: 'Freigaben' }));
    expect((await screen.findByText(/FREIGABEN-INHALT/)).getAttribute('data-gruppe')).toBe('7');
  });

  it('das Fenster „Einstellungen“ bekommt den Ort des Schalters (Modul / Kategorie „Entwürfe“)', async () => {
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    expect(screen.getByText('EINSTELLUNGEN-FENSTER').getAttribute('data-mail')).toBe(
      `7/${einrichtung?.entwuerfe}`,
    );
  });
});

describe('Rahmen und Zugang', () => {
  it('Leitung der Gruppe: Reiter „Seiten | Aussehen | Freigaben“, Seiten zuerst', async () => {
    render(<App />);
    expect(await screen.findByText('SEITEN-INHALT')).toBeTruthy();
    for (const name of ['Seiten', 'Aussehen', 'Freigaben'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seiten' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('„Aussehen“ zeigt den Reiter Aussehen, „Freigaben“ den Reiter Freigaben', async () => {
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    fireEvent.click(screen.getByRole('button', { name: 'Aussehen' }));
    expect(screen.getByText('AUSSEHEN-INHALT')).toBeTruthy();
    expect(screen.queryByText('SEITEN-INHALT')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Freigaben' }));
    expect(await screen.findByText(/FREIGABEN-INHALT leitung/)).toBeTruthy();
    expect(screen.queryByText('AUSSEHEN-INHALT')).toBeNull();
  });

  it('Mitglied ohne Leitung: freundlicher Hinweis, KEIN Editor, keine Reiter', async () => {
    ladeStart.mockResolvedValue(start({ zugang: null }));
    render(<App />);
    expect(await screen.findByText(/Die Website bearbeiten dürfen die Admins/)).toBeTruthy();
    expect(screen.queryByText('SEITEN-INHALT')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aussehen' })).toBeNull();
  });

  it('nicht eingerichtet, Admin: die Einrichtung', async () => {
    ladeStart.mockResolvedValue(
      start({ einrichtung: null, stand: 'einrichten', admin: true, zugang: WEBSITE_LEITUNG }),
    );
    render(<App />);
    expect(await screen.findByText('EINRICHTUNG')).toBeTruthy();
    expect(screen.queryByText('SEITEN-INHALT')).toBeNull();
  });

  it('nicht eingerichtet, kein Admin: freundlicher Hinweis statt Einrichtung', async () => {
    ladeStart.mockResolvedValue(start({ einrichtung: null, stand: 'fehlt', zugang: null }));
    render(<App />);
    expect(
      await screen.findByText(/noch nicht eingerichtet, oder dir fehlt das Recht/),
    ).toBeTruthy();
    expect(screen.queryByText('EINRICHTUNG')).toBeNull();
    expect(screen.queryByText('SEITEN-INHALT')).toBeNull();
  });

  it('nur zum Teil eingerichtet, kein Admin: Hinweis „zum Teil eingerichtet“', async () => {
    ladeStart.mockResolvedValue(start({ stand: 'unvollstaendig', zugang: null }));
    render(<App />);
    expect(await screen.findByText(/nur zum Teil eingerichtet/)).toBeTruthy();
  });

  it('ein vorübergehender Fehler beim Laden zeigt „Erneut versuchen“ statt eines leeren Rahmens', async () => {
    ladeStart.mockRejectedValueOnce(new Error('Netz'));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('SEITEN-INHALT')).toBeTruthy();
  });
});

describe('Reiter „Einstellungen“ (W3a-3b)', () => {
  it('ist der letzte Reiter, öffnet das Fenster und ist dabei hervorgehoben', async () => {
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    const reiter = screen.getByRole('button', { name: 'Einstellungen' });
    expect(screen.queryByText('EINSTELLUNGEN-FENSTER')).toBeNull();
    fireEvent.click(reiter);
    expect(screen.getByText('EINSTELLUNGEN-FENSTER')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Einstellungen' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByText('EINSTELLUNGEN-FENSTER'));
    expect(screen.queryByText('EINSTELLUNGEN-FENSTER')).toBeNull();
  });

  it('wer die Website nicht bearbeiten darf, bekommt keinen Reiter', async () => {
    ladeStart.mockResolvedValue(start({ zugang: null }));
    render(<App />);
    await screen.findByText(/Die Website bearbeiten dürfen die Admins/);
    expect(screen.queryByRole('button', { name: 'Einstellungen' })).toBeNull();
  });
});

describe('Rollen in der Oberfläche (W3b-1, E-W22, E-W12)', () => {
  it('Redakteur: nur „Seiten“ und „Freigaben“ – kein Aussehen, kein Reiter Einstellungen', async () => {
    ladeStart.mockResolvedValue(start({ zugang: WEBSITE_REDAKTEUR }));
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    expect(screen.getByRole('button', { name: 'Seiten' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Freigaben' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aussehen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Einstellungen' })).toBeNull();
  });

  it('Redakteur: weder Menü noch Eigenes HTML; „Freigaben“ ist der Reiter für Redakteure', async () => {
    ladeStart.mockResolvedValue(start({ zugang: WEBSITE_REDAKTEUR }));
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    expect(rechteDerSeiten()).toEqual({ html: false, menue: false });
    fireEvent.click(screen.getByRole('button', { name: 'Freigaben' }));
    expect(await screen.findByText(/FREIGABEN-INHALT redakteur/)).toBeTruthy();
  });

  it('Leitung und Admin: Menü und Eigenes HTML, Aussehen und Einstellungen', async () => {
    for (const admin of [false, true]) {
      ladeStart.mockResolvedValue(start({ zugang: WEBSITE_LEITUNG, admin }));
      const { unmount } = render(<App />);
      await screen.findByText('SEITEN-INHALT');
      expect(rechteDerSeiten()).toEqual({ html: true, menue: true });
      expect(screen.getByRole('button', { name: 'Aussehen' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Einstellungen' })).toBeTruthy();
      unmount();
    }
  });

  it('„Wer darf was“ gibt es nur, wenn die Person Rechte setzen darf', async () => {
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    expect(screen.getByText('EINSTELLUNGEN-FENSTER').getAttribute('data-wer-darf-was')).toBe(
      'nein',
    );
    expect(pruefung).not.toHaveBeenCalled();
  });

  it('wer Rechte setzen darf, bekommt „Wer darf was“ im Fenster', async () => {
    ladeStart.mockResolvedValue(
      start({ zugang: WEBSITE_LEITUNG, admin: true, darfRechteSetzen: true }),
    );
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    expect(screen.getByText('EINSTELLUNGEN-FENSTER').getAttribute('data-wer-darf-was')).toBe('ja');
  });

  it('Start-Prüfung (nur Admin): weichen Rechte ab, steht ein ruhiger Hinweis mit Weg zum Fenster', async () => {
    pruefung.mockResolvedValue({ art: 'abweicht', rollen: ['Mitarbeiter'] });
    ladeStart.mockResolvedValue(
      start({ zugang: WEBSITE_LEITUNG, admin: true, darfRechteSetzen: true }),
    );
    render(<App />);
    expect(await screen.findByText(/stimmen die Rechte in ChurchTools nicht/)).toBeTruthy();
    expect(screen.getByText(/Mitarbeiter/)).toBeTruthy();
    expect(pruefung).toHaveBeenCalledWith(7, { entwuerfe: 20, veroeffentlicht: 21 });
    fireEvent.click(screen.getByRole('button', { name: 'Wer darf was' }));
    expect(screen.getByText('EINSTELLUNGEN-FENSTER')).toBeTruthy();
  });

  it('Start-Prüfung: noch keine Rechte vergeben → Hinweis; alles in Ordnung → keiner', async () => {
    ladeStart.mockResolvedValue(
      start({ zugang: WEBSITE_LEITUNG, admin: true, darfRechteSetzen: true }),
    );
    pruefung.mockResolvedValue({ art: 'nichts' });
    const { unmount } = render(<App />);
    expect(await screen.findByText(/noch keine Rechte an der Website/)).toBeTruthy();
    unmount();
    pruefung.mockResolvedValue(null);
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    await waitFor(() => expect(pruefung).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('region', { name: 'Rechte der Website' })).toBeNull();
  });

  it('Start-Prüfung (W3b-4a): nicht eingerichtete und abweichende Untergruppen stehen im Hinweis – auch wenn die Website stimmt', async () => {
    ladeStart.mockResolvedValue(
      start({ zugang: WEBSITE_LEITUNG, admin: true, darfRechteSetzen: true }),
    );
    pruefung.mockResolvedValue({
      art: 'untergruppen',
      untergruppen: [
        { name: 'Website – Technik', art: 'nicht-eingerichtet' },
        { name: 'Website – Jugend', art: 'abweicht', rollen: ['Mitarbeiter'] },
      ],
    });
    render(<App />);
    expect(
      await screen.findByText(/Die Untergruppe „Website – Technik“ ist noch nicht eingerichtet/),
    ).toBeTruthy();
    expect(
      screen.getByText(/In der Untergruppe „Website – Jugend“ weichen die Rechte ab: Mitarbeiter/),
    ).toBeTruthy();
    expect(screen.queryByText(/noch keine Rechte an der Website/)).toBeNull();
    expect(screen.queryByText(/stimmen die Rechte in ChurchTools nicht/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Wer darf was' }));
    expect(screen.getByText('EINSTELLUNGEN-FENSTER')).toBeTruthy();
  });

  it('nach dem Schließen des Fensters „Einstellungen“ wird die Prüfung neu gelesen (Rechte können gesetzt sein)', async () => {
    ladeStart.mockResolvedValue(
      start({ zugang: WEBSITE_LEITUNG, admin: true, darfRechteSetzen: true }),
    );
    pruefung.mockResolvedValueOnce({ art: 'nichts' }).mockResolvedValue(null);
    render(<App />);
    await screen.findByText(/noch keine Rechte an der Website/);
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    fireEvent.click(screen.getByText('EINSTELLUNGEN-FENSTER'));
    await waitFor(() => expect(pruefung).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/noch keine Rechte an der Website/)).toBeNull());
  });

  it('Leitung ohne Rechte: Hinweis, dass ein Admin die Rechte unter „Wer darf was“ einrichtet', async () => {
    ladeStart.mockResolvedValue(start({ zugang: null, leitungOhneRechte: true }));
    render(<App />);
    expect(
      await screen.findByText(/Die Rechte für die Website sind noch nicht eingerichtet/),
    ).toBeTruthy();
    expect(screen.getByText(/Einstellungen → „Wer darf was“/)).toBeTruthy();
    expect(screen.queryByText('SEITEN-INHALT')).toBeNull();
  });
});

describe('Zähler am Reiter „Freigaben“ (W3b-2)', () => {
  it('Leitung: eingereichte Seiten + „Löschen angefragt“ (2), nicht die Zurückgegebenen', async () => {
    freigaben.mockResolvedValue(await freigabeStand());
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    await waitFor(() => expect(zaehlerAmReiter()?.textContent).toBe('2'));
    expect(screen.getByRole('button', { name: 'Freigaben, 2 offen' })).toBeTruthy();
  });

  it('Redakteur (Person 5): nur seine zurückgegebenen Seiten (1)', async () => {
    freigaben.mockResolvedValue(await freigabeStand());
    ladeStart.mockResolvedValue(start({ zugang: WEBSITE_REDAKTEUR, ichId: 5 }));
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    await waitFor(() => expect(zaehlerAmReiter()?.textContent).toBe('1'));
    expect(screen.getByRole('button', { name: 'Freigaben, 1 zurückgegeben' })).toBeTruthy();
  });

  it('Redakteur (eine andere Person): kein Zähler – fremde Seiten zählen nicht', async () => {
    freigaben.mockResolvedValue(await freigabeStand());
    ladeStart.mockResolvedValue(start({ zugang: WEBSITE_REDAKTEUR, ichId: 77 }));
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    await waitFor(() => expect(freigaben).toHaveBeenCalled());
    expect(zaehlerAmReiter()).toBeNull();
  });

  it('nichts zu tun: kein Zähler', async () => {
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    await waitFor(() => expect(freigaben).toHaveBeenCalled());
    expect(zaehlerAmReiter()).toBeNull();
  });
});

describe('Bereiche (W3b-4b)', () => {
  it('Redakteur ohne erkennbaren Bereich: Hinweis statt Editor – keine Seiten, keine Reiter', async () => {
    ladeStart.mockResolvedValue(start({ zugang: { sieht: [], leitet: [] } }));
    render(<App />);
    expect(await screen.findByText(/in keiner ihrer Gruppen eingetragen/)).toBeTruthy();
    expect(screen.getByText(/Leitung der Gruppe „Website“ an/)).toBeTruthy();
    expect(screen.queryByText('SEITEN-INHALT')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Freigaben/ })).toBeNull();
  });

  it('Leitung einer Untergruppe: Seiten und Freigaben, aber weder Aussehen noch Einstellungen, weder Menü noch eigenes HTML', async () => {
    ladeStart.mockResolvedValue(start({ zugang: { sieht: [347], leitet: [347] } }));
    render(<App />);
    await screen.findByText('SEITEN-INHALT');
    expect(rechteDerSeiten()).toEqual({ html: false, menue: false });
    expect(screen.queryByRole('button', { name: 'Aussehen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Einstellungen' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Freigaben/ })).toBeTruthy();
  });

  it('„Wer darf was“ im Start-Hinweis öffnet das Fenster MIT Sprung zum Abschnitt; der Reiter „Einstellungen“ ohne', async () => {
    ladeStart.mockResolvedValue(
      start({ zugang: WEBSITE_LEITUNG, admin: true, darfRechteSetzen: true }),
    );
    pruefung.mockResolvedValue({ art: 'nichts' });
    render(<App />);
    await screen.findByText(/noch keine Rechte an der Website/);
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    expect(screen.getByText('EINSTELLUNGEN-FENSTER').getAttribute('data-springen')).toBe('nein');
    fireEvent.click(screen.getByText('EINSTELLUNGEN-FENSTER'));
    fireEvent.click(await screen.findByRole('button', { name: 'Wer darf was' }));
    expect(screen.getByText('EINSTELLUNGEN-FENSTER').getAttribute('data-springen')).toBe('ja');
  });
});
