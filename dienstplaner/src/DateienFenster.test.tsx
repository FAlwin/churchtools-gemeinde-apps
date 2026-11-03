// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { FakeXhr } from '@ui/ct/xhr.testutil';
import { dateienAusListe, DATEI_MAX_BYTES, type TerminDatei } from '@shared/ct/terminDateien';
import { DateienFenster } from './DateienFenster';

/**
 * **Dateien am Termin ändern** (T2b) – über die ganze Kette: Fenster → Kern → Browser-Anschluss → ChurchTools. Ersetzt
 * ist nur ChurchTools, nachgebaut wie gemessen (02.11.2026): `fetch` für Liste, Link, Umbenennen, Löschen;
 * `XMLHttpRequest` fürs Hochladen mit Fortschritt.
 */
function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const download = (id: number) => `${window.location.origin}/?q=public/filedownload&id=${id}`;

function ct(start: { id: number; name: string; type: 'file' | 'link'; size: number | null }[]) {
  // `meta` wie gemessen: wann und von wem angehängt (für das kleine Fenster einer Datei).
  const meta = {
    createdDate: '2026-11-02T21:28:45Z',
    createdPerson: { title: 'Alwin Friesen', domainType: 'person', domainIdentifier: '1' },
  };
  type Eintrag = (typeof start)[number] & { fileUrl: string; meta?: typeof meta };
  let dateien: Eintrag[] = start.map((d) => ({
    ...d,
    fileUrl: d.type === 'link' ? 'https://example.org/x' : download(d.id),
    meta,
  }));
  let naechste = 100;
  const anfragen: { methode: string; pfad: string; rumpf: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input));
    const methode = init?.method ?? 'GET';
    if (url.pathname.endsWith('/csrftoken')) return Promise.resolve(json(200, { data: 't' }));
    const rumpf = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    if (methode !== 'GET') anfragen.push({ methode, pfad: url.pathname, rumpf });
    if (url.pathname === '/api/files/service/160' && methode === 'GET') {
      return Promise.resolve(json(200, { data: dateien }));
    }
    if (url.pathname === '/api/files/service/160/link') {
      const r = rumpf as { name: string; url: string };
      dateien = [
        ...dateien,
        { id: naechste++, name: r.name, type: 'link', size: null, fileUrl: r.url },
      ];
      return Promise.resolve(json(201, { data: dateien.at(-1) }));
    }
    const m = /^\/api\/files\/(\d+)$/.exec(url.pathname);
    if (m) {
      const id = Number(m[1]);
      if (!dateien.some((d) => d.id === id))
        return Promise.resolve(json(404, { message: 'not found' }));
      if (methode === 'PATCH') {
        dateien = dateien.map((d) =>
          d.id === id ? { ...d, name: (rumpf as { name: string }).name } : d,
        );
      } else {
        dateien = dateien.filter((d) => d.id !== id);
      }
      return Promise.resolve(json(204, null));
    }
    return Promise.resolve(json(200, { data: [] }));
  });
  return {
    anfragen,
    /** Was ChurchTools nach dem Hochladen anlegt. */
    angelegt: (name: string, size: number) => {
      dateien = [
        ...dateien,
        { id: naechste++, name, type: 'file', size, fileUrl: download(naechste) },
      ];
    },
    liste: () => dateienAusListe(dateien),
  };
}

const FOLIEN = { id: 21, name: 'Folien.pdf', type: 'file' as const, size: 2048 };
const LIEDTEXTE = { id: 22, name: 'Liedtexte', type: 'link' as const, size: null };

function zeige(o: { darf?: boolean; dateien?: TerminDatei[] } = {}) {
  const onAktuell = vi.fn();
  const onClose = vi.fn();
  render(
    <DateienFenster
      fuer="Gottesdienst · So, 08.11.2026"
      terminId={160}
      dateien={o.dateien ?? []}
      darf={o.darf ?? true}
      onAktuell={onAktuell}
      onClose={onClose}
    />,
  );
  return { onAktuell, onClose };
}

/** Eine Datei mit vorgetäuschter Größe – ohne 128 MB wirklich anzulegen. */
function datei(name: string, groesse: number): File {
  const f = new File(['x'], name);
  Object.defineProperty(f, 'size', { value: groesse });
  return f;
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  FakeXhr.zuruecksetzen();
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Dateien am Termin ändern (T2b)', () => {
  it('ohne Recht: die Datei öffnet sich direkt, kein kleines Fenster, kein „Anhang hinzufügen“', async () => {
    const c = ct([FOLIEN]);
    zeige({ darf: false, dateien: c.liste() });
    expect(await screen.findByText('PDF · 2 KB')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Folien\.pdf/ }).getAttribute('href')).toBe(
      download(21),
    );
    expect(screen.queryByRole('button', { name: /Folien|Anhang/ })).toBeNull();
  });

  it('mit Recht: ein Tipp auf die Datei zeigt ihr kleines Fenster – wie in ChurchTools (03.11.2026)', async () => {
    const c = ct([FOLIEN]);
    zeige({ dateien: c.liste() });
    fireEvent.click(await screen.findByRole('button', { name: /Folien\.pdf/ }));
    const f = screen.getByRole('dialog', { name: 'Folien.pdf' });
    expect(within(f).getByText('PDF · 2 KB')).toBeTruthy();
    expect(
      within(f).getByText(/^Angehängt am \d\d\.11\.2026 \d\d:\d\d von Alwin Friesen$/),
    ).toBeTruthy();
    const oeffnen = within(f).getByRole('link', { name: 'Öffnen' });
    expect([oeffnen.getAttribute('href'), oeffnen.getAttribute('target')]).toEqual([
      download(21),
      '_blank',
    ]);
    expect(within(f).getByRole('button', { name: 'Umbenennen' })).toBeTruthy();
    expect(within(f).getByRole('button', { name: 'Löschen' })).toBeTruthy();
    // „‹“ führt zur Liste.
    fireEvent.click(within(f).getByRole('button', { name: 'Zurück' }));
    expect(screen.getByRole('dialog', { name: 'Dateien' })).toBeTruthy();
  });

  it('umbenennen: die Endung steht fest daneben; PATCH mit dem ganzen Namen, die Liste zeigt ihn', async () => {
    const c = ct([FOLIEN, LIEDTEXTE]);
    const { onAktuell } = zeige({ dateien: c.liste() });
    fireEvent.click(await screen.findByRole('button', { name: /Folien\.pdf/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Umbenennen' }));
    // „‹“ führt zurück zum kleinen Fenster der Datei, nicht zur Liste.
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Folien.pdf' })).getByRole('button', {
        name: 'Umbenennen',
      }),
    );
    const f = screen.getByRole('dialog', { name: 'Datei umbenennen' });
    const feld = within(f).getByRole('textbox', { name: 'Name' });
    expect(feld).toHaveProperty('value', 'Folien');
    expect(within(f).getByText('.pdf')).toBeTruthy();
    expect(within(f).getByRole('button', { name: 'Umbenennen' }).hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.change(feld, { target: { value: 'Predigt' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Umbenennen' }));
    expect(await screen.findByRole('button', { name: /Predigt\.pdf/ })).toBeTruthy();
    expect(c.anfragen).toEqual([
      { methode: 'PATCH', pfad: '/api/files/21', rumpf: { name: 'Predigt.pdf' } },
    ]);
    expect(onAktuell).toHaveBeenLastCalledWith(c.liste());
  });

  it('löschen: erst nachfragen, dann DELETE – die Datei ist aus der Liste', async () => {
    const c = ct([FOLIEN, LIEDTEXTE]);
    zeige({ dateien: c.liste() });
    fireEvent.click(await screen.findByRole('button', { name: /Liedtexte/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    const f = screen.getByRole('dialog', { name: 'Link löschen' });
    // Ein Link wird nicht hochgeladen – wiederherstellen heißt hier „erneut anhängen“.
    expect(
      within(f).getByText(/„Liedtexte“ löschen\? Das lässt sich nicht rückgängig machen/)
        .textContent,
    ).toMatch(/nur durch erneutes Anhängen\.$/);
    expect(c.anfragen).toHaveLength(0);
    fireEvent.click(within(f).getByRole('button', { name: 'Löschen' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Liedtexte/ })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Dateien' })).toBeTruthy();
    expect(c.anfragen).toEqual([{ methode: 'DELETE', pfad: '/api/files/22', rumpf: null }]);
  });

  it('hochladen: zu groß steht rot da und geht nicht hoch; die andere mit Fortschritt in %, danach in der Liste', async () => {
    const c = ct([FOLIEN]);
    const { onAktuell } = zeige({ dateien: c.liste() });
    fireEvent.click(screen.getByRole('button', { name: 'Anhang hinzufügen' }));
    const f = screen.getByRole('dialog', { name: 'Anhang hinzufügen' });
    fireEvent.change(f.querySelector('input[type=file]')!, {
      target: { files: [datei('Video.mp4', DATEI_MAX_BYTES + 1), datei('Plakat.png', 3000)] },
    });
    expect(
      within(f).getByText(
        /„Video\.mp4" ist zu groß\. Erlaubt sind bis zu 128 MB\. Diese Datei wird nicht hochgeladen\./,
      ),
    ).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: '1 Datei hochladen' }));
    await waitFor(() => expect(FakeXhr.letzte?.rumpf).toBeTruthy());
    const xhr = FakeXhr.letzte!;
    expect((xhr.rumpf as FormData).get('files[]')).toHaveProperty('name', 'Plakat.png');
    xhr.fortschritt(50, 100);
    const balken = await within(f).findByRole('progressbar', {
      name: '„Plakat.png“ wird hochgeladen',
    });
    expect(balken.getAttribute('aria-valuenow')).toBe('50');
    expect(balken.textContent).toBe('50 %');
    c.angelegt('Plakat.png', 3000);
    xhr.gesendet();
    xhr.antworte(200, { data: [] });
    // Geschafft: aus der Auswahl weg, die neue Liste geht zurück; die zu große bleibt rot stehen.
    await waitFor(() => expect(within(f).queryByText('Plakat.png')).toBeNull());
    expect(onAktuell).toHaveBeenLastCalledWith(c.liste());
    expect(within(f).getByText('Video.mp4')).toBeTruthy();
    expect(FakeXhr.alle).toHaveLength(1);
    // Die zu große wegnehmen, zurück zur Liste.
    fireEvent.click(within(f).getByRole('button', { name: '„Video.mp4“ nicht hochladen' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('button', { name: /Plakat\.png/ })).toBeTruthy();
  });

  it('alles geschafft → zurück zur Liste; gescheitert → die Meldung bleibt an der Datei stehen', async () => {
    const c = ct([FOLIEN]);
    zeige({ dateien: c.liste() });
    fireEvent.click(screen.getByRole('button', { name: 'Anhang hinzufügen' }));
    let f = screen.getByRole('dialog', { name: 'Anhang hinzufügen' });
    fireEvent.change(f.querySelector('input[type=file]')!, {
      target: { files: [datei('a.txt', 5)] },
    });
    fireEvent.click(within(f).getByRole('button', { name: '1 Datei hochladen' }));
    await waitFor(() => expect(FakeXhr.letzte?.rumpf).toBeTruthy());
    // ChurchTools scheitert, nichts angekommen.
    FakeXhr.letzte!.antworte(500, { message: 'kaputt' });
    expect((await within(f).findByRole('alert')).textContent).toMatch(/antwortet gerade nicht/);
    expect(within(f).getByText('a.txt')).toBeTruthy();
    // Noch einmal – jetzt klappt es, und das Fenster geht zur Liste.
    fireEvent.click(within(f).getByRole('button', { name: '1 Datei hochladen' }));
    await waitFor(() => expect(FakeXhr.alle).toHaveLength(2));
    c.angelegt('a.txt', 5);
    FakeXhr.letzte!.antworte(200, { data: [] });
    f = await screen.findByRole('dialog', { name: 'Dateien' });
    expect(within(f).getByRole('button', { name: /a\.txt/ })).toBeTruthy();
  });

  it('Link anhängen: ohne https:// gesperrt mit Hinweis; mit Adresse → POST, danach in der Liste', async () => {
    const c = ct([FOLIEN]);
    zeige({ dateien: c.liste() });
    fireEvent.click(screen.getByRole('button', { name: 'Anhang hinzufügen' }));
    const f = screen.getByRole('dialog', { name: 'Anhang hinzufügen' });
    fireEvent.click(within(f).getByRole('button', { name: 'Link anhängen', pressed: false }));
    // Unten derselbe Wortlaut wie im Umschalter (Entwurf) – der Knopf unten hat kein `aria-pressed`.
    const anhaengen = () =>
      within(f)
        .getAllByRole('button', { name: 'Link anhängen' })
        .find((b) => !b.hasAttribute('aria-pressed'))!;
    fireEvent.change(within(f).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Liedtexte' },
    });
    const adresse = within(f).getByRole('textbox', { name: 'Adresse' });
    fireEvent.change(adresse, { target: { value: 'example.org/l' } });
    expect(within(f).getByText('Bitte die ganze Adresse angeben, mit https://')).toBeTruthy();
    expect(anhaengen().hasAttribute('disabled')).toBe(true);
    fireEvent.change(adresse, { target: { value: 'https://example.org/l' } });
    fireEvent.click(anhaengen());
    expect(await screen.findByRole('button', { name: /Liedtexte/ })).toBeTruthy();
    expect(c.anfragen).toEqual([
      {
        methode: 'POST',
        pfad: '/api/files/service/160/link',
        rumpf: { name: 'Liedtexte', url: 'https://example.org/l' },
      },
    ]);
  });

  it('noch keine Dateien und man darf: gleich „Anhang hinzufügen“, „Abbrechen“ schließt', async () => {
    ct([]);
    const { onClose } = zeige({ dateien: [] });
    const f = screen.getByRole('dialog', { name: 'Anhang hinzufügen' });
    expect(within(f).queryByRole('button', { name: 'Zurück' })).toBeNull();
    // Nichts gewählt: grau und ohne „0 Dateien“ (Test-Instanz, 03.11.2026).
    expect(within(f).getByRole('button', { name: 'Hochladen' }).hasAttribute('disabled')).toBe(
      true,
    );
    // Ein angefangener Link-Name geht durch einen Tipp daneben nicht verloren.
    fireEvent.click(within(f).getByRole('button', { name: 'Link anhängen', pressed: false }));
    fireEvent.change(within(f).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Lied' },
    });
    fireEvent.click(f.parentElement!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(f).getByRole('button', { name: 'Abbrechen' }));
    expect(onClose).toHaveBeenCalled();
  });
});
