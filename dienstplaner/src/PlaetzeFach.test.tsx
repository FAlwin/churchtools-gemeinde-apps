// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { terminVorlagenAus, type TerminVorlage } from '@shared/ct/terminVorlagen';
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import { PlaetzeFach, type PlaetzeZeile } from './PlaetzeFach';
import { anzahlFehlerText } from './plaetzeTexte';
import { knopfFolge } from '@ui/fenster/fenster.testutil';

const LICHT: PlaetzeZeile = { serviceId: 7, name: 'Licht', anzahl: 1, belegt: 0, entwuerfe: 0 };
const TON: PlaetzeZeile = { serviceId: 6, name: 'Ton', anzahl: 1, belegt: 1, entwuerfe: 0 };
const VIDEO: PlaetzeZeile = { serviceId: 8, name: 'Video', anzahl: 0, belegt: 0, entwuerfe: 0 };
const KAMERA: PlaetzeZeile = { serviceId: 9, name: 'Kamera', anzahl: 1, belegt: 0, entwuerfe: 1 };
type Aendern = (z: PlaetzeZeile, gesehen: number, neu: number) => Promise<AnzahlErgebnis>;

function zeige(aendern: Aendern = (_z, _g, neu) => Promise.resolve({ ok: true, anzahl: neu })) {
  const p = { aendern: vi.fn(aendern), onGespeichert: vi.fn(), onClose: vi.fn() };
  render(
    <PlaetzeFach
      titel="Technik · Plätze"
      unter="Gottesdienst · So, 25.10."
      zeilen={[LICHT, TON, VIDEO, KAMERA]}
      {...p}
    />,
  );
  return p;
}
const knopf = (name: string) => screen.getByRole('button', { name });
const zahl = (dienst: string) =>
  screen.getByLabelText(new RegExp(`^${dienst}: \\d+ Plätze$`)).textContent;

describe('PlaetzeFach (E4-5-3)', () => {
  it('je Dienst Zahl und Stand; „−“ gesperrt bei belegten und bei 0', () => {
    zeige();
    expect(screen.getAllByText('frei')).toHaveLength(2); // Licht und Kamera
    expect(screen.getByText('1 belegt')).toBeTruthy();
    expect(screen.getByText('nicht vorgesehen')).toBeTruthy();
    expect(knopf('Ton: ein Platz weniger')).toHaveProperty('disabled', true);
    expect(knopf('Video: ein Platz weniger')).toHaveProperty('disabled', true);
    expect(knopf('Licht: ein Platz weniger')).toHaveProperty('disabled', false);
  });

  it('liegen Entwürfe dort, bleibt die Zahl (ChurchTools nummeriert sonst die Plätze neu) – mit Hinweis', () => {
    zeige();
    expect(knopf('Kamera: ein Platz mehr')).toHaveProperty('disabled', true);
    expect(knopf('Kamera: ein Platz weniger')).toHaveProperty('disabled', true);
    expect(screen.getByText(/Hier liegt ein Entwurf – erst senden oder entfernen\./)).toBeTruthy();
  });

  it('„+“ speichert sofort mit der gesehenen Zahl; danach zählt die neue, der Aufrufer sagt Bescheid', async () => {
    const p = zeige();
    fireEvent.click(knopf('Licht: ein Platz mehr'));
    await waitFor(() => expect(zahl('Licht')).toBe('2'));
    expect(p.aendern).toHaveBeenLastCalledWith(LICHT, 1, 2);
    expect(p.onGespeichert).toHaveBeenCalledWith('Licht: jetzt 2 Plätze.');
    fireEvent.click(knopf('Licht: ein Platz weniger'));
    await waitFor(() => expect(p.aendern).toHaveBeenLastCalledWith(LICHT, 2, 1));
    expect(p.onGespeichert).toHaveBeenLastCalledWith('Licht: jetzt 1 Platz.');
    fireEvent.click(knopf('Fenster schließen'));
    expect(p.onClose).toHaveBeenCalledWith(true);
  });

  it('während des Speicherns: alle Knöpfe gesperrt, Schließen geht nicht', async () => {
    let fertig!: (r: AnzahlErgebnis) => void;
    const p = zeige(() => new Promise((r) => (fertig = r)));
    fireEvent.click(knopf('Licht: ein Platz mehr'));
    expect(knopf('Ton: ein Platz mehr')).toHaveProperty('disabled', true);
    expect(zahl('Licht')).toBe('…');
    // Sichtbar gesperrt wie im ConfirmDialog (E6-O F2, #720), nicht nur wirkungslos.
    expect(knopf('Fenster schließen')).toHaveProperty('disabled', true);
    expect(knopf('Fenster schließen')).toHaveProperty('disabled', true);
    fireEvent.click(knopf('Fenster schließen'));
    expect(p.onClose).not.toHaveBeenCalled();
    await act(async () => fertig({ ok: true, anzahl: 2 }));
    expect(knopf('Ton: ein Platz mehr')).toHaveProperty('disabled', false);
  });

  it('Konflikt: sagt es, übernimmt die Zahl aus ChurchTools – der nächste Tipp geht von ihr aus', async () => {
    const aendern = vi
      .fn<Aendern>()
      .mockResolvedValueOnce({ ok: false, grund: 'konflikt', jetzt: 3 })
      .mockResolvedValueOnce({ ok: true, anzahl: 4 });
    const p = zeige(aendern);
    fireEvent.click(knopf('Licht: ein Platz mehr'));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Licht: Jemand hat die Zahl eben geändert – jetzt 3. Nichts geändert.',
    );
    expect(zahl('Licht')).toBe('3');
    fireEvent.click(knopf('Licht: ein Platz mehr'));
    await waitFor(() => expect(aendern).toHaveBeenLastCalledWith(LICHT, 3, 4));
    expect(p.onGespeichert).toHaveBeenCalledTimes(1);
  });

  it('nichts geändert (Fehler ohne neue Zahl) → Schließen meldet „nichts geändert“', async () => {
    const p = zeige(() => Promise.resolve({ ok: false, grund: 'kein-recht' }));
    fireEvent.click(knopf('Licht: ein Platz mehr'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/erlaubt dir nicht/);
    expect(zahl('Licht')).toBe('1');
    fireEvent.click(knopf('Fenster schließen'));
    expect(p.onClose).toHaveBeenCalledWith(false);
  });
});

describe('anzahlFehlerText', () => {
  it('jeder Grund hat seinen eigenen Text', () => {
    const gruende = [
      'konflikt',
      'belegt',
      'weg',
      'kein-recht',
      'abgemeldet',
      'voruebergehend',
      'nicht-angekommen',
    ] as const;
    const texte = gruende.map((grund) => anzahlFehlerText({ ok: false, grund, jetzt: 2 }));
    expect(new Set(texte).size).toBe(gruende.length);
  });
});

describe('PlaetzeFach im ChurchTools-Aufbau', () => {
  it('nur ansehen: X oben, unten kein „Schließen“ mehr (02.11.2026)', () => {
    zeige();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(knopfFolge()[0]).toBe('Fenster schließen');
    expect(knopfFolge()).not.toContain('Schließen');
  });
});

// ── Dienste ein-/ausschalten und Vorlage übernehmen (13.11.2026) ─────────────
describe('PlaetzeFach – Dienste ohne Platz und Vorlage übernehmen', () => {
  const ABENDMAHL: PlaetzeZeile = {
    serviceId: 24,
    name: 'Abendmahl',
    anzahl: 0,
    belegt: 0,
    entwuerfe: 0,
  };
  const GESANG: PlaetzeZeile = { serviceId: 9, name: 'Gesang', anzahl: 2, belegt: 1, entwuerfe: 0 };
  const PREDIGT: PlaetzeZeile = {
    serviceId: 1,
    name: 'Predigt',
    anzahl: 1,
    belegt: 0,
    entwuerfe: 1,
  };
  const NAMEN = new Map([
    [6, 'Ton'],
    [7, 'Licht'],
    [8, 'Video'],
    [9, 'Gesang'],
    [24, 'Abendmahl'],
    [1, 'Predigt'],
    [50, 'Kaffee'],
  ]);
  // Wie aus ChurchTools – über den Parser, nicht von Hand gebaut.
  const roh = (id: number, templateName: string, services: [number, number][]) => ({
    id,
    templateName,
    calendarId: 1,
    services: services.map(([serviceId, count]) => ({ serviceId, count })),
  });
  const VORLAGEN = terminVorlagenAus([
    roh(3, 'Abendmahl', [
      [24, 1],
      [9, 3],
      [6, 1],
    ]),
    roh(0, 'Standard', [
      [6, 1],
      [9, 1],
    ]), // Gesang hat schon 2 – wird nie verringert
    roh(4, 'Mit Entwurf und Fremdem', [
      [1, 2],
      [50, 1],
      [99, 1],
    ]),
  ]);

  function zeigeMitVorlage(
    aendern: Aendern = (_z, _g, neu) => Promise.resolve({ ok: true, anzahl: neu }),
    laden: () => Promise<TerminVorlage[]> = () => Promise.resolve(VORLAGEN),
  ) {
    const p = { aendern: vi.fn(aendern), onGespeichert: vi.fn(), onClose: vi.fn() };
    render(
      <PlaetzeFach
        titel="Moderation · Plätze"
        unter="Gottesdienst · So, 25.10."
        zeilen={[ABENDMAHL]}
        // Gesang (belegt 1) und Ton gehören einer anderen Gruppe – nur die Vorlage kennt sie.
        weitere={[GESANG, TON, PREDIGT]}
        vorlage={{ kalenderId: 1, laden, namen: NAMEN }}
        {...p}
      />,
    );
    return p;
  }
  const waehle = async (name: string) => {
    const feld = await screen.findByRole('combobox', { name: 'Vorlage' });
    fireEvent.change(feld, {
      target: { value: String(VORLAGEN.find((v) => v.name === name)!.id) },
    });
  };

  it('ein Dienst ohne Platz steht mit 0 („nicht vorgesehen“) da; „+“ schaltet ihn ein, „−“ ist gesperrt', async () => {
    const p = zeigeMitVorlage();
    expect(screen.getByText('nicht vorgesehen')).toBeTruthy();
    expect(knopf('Abendmahl: ein Platz weniger')).toHaveProperty('disabled', true);
    fireEvent.click(knopf('Abendmahl: ein Platz mehr'));
    await waitFor(() => expect(zahl('Abendmahl')).toBe('1'));
    expect(p.aendern).toHaveBeenCalledWith(ABENDMAHL, 0, 1);
    // … und wieder aus: − bis 0.
    fireEvent.click(knopf('Abendmahl: ein Platz weniger'));
    await waitFor(() => expect(p.aendern).toHaveBeenLastCalledWith(ABENDMAHL, 1, 0));
    await waitFor(() => expect(zahl('Abendmahl')).toBe('0'));
  });

  it('die Dienste der anderen Gruppen stehen nicht in der Liste', async () => {
    zeigeMitVorlage();
    await screen.findByRole('combobox', { name: 'Vorlage' });
    expect(screen.queryByLabelText(/^Gesang: \d+ Plätze$/)).toBeNull();
  });

  it('Vorschau: erhöht nur, was fehlt, und nennt Übersprungenes mit Grund; nichts wird geschrieben', async () => {
    const p = zeigeMitVorlage();
    await waehle('Abendmahl');
    expect(screen.getByText('Abendmahl: 0 → 1 · Gesang: 2 → 3')).toBeTruthy(); // Ton hat schon 1
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeTruthy();
    expect(p.aendern).not.toHaveBeenCalled();
    await waehle('Mit Entwurf und Fremdem');
    // Predigt: Entwurf; Kaffee: bekannt, aber nicht planbar (nicht im Stand); 99: gibt es nicht.
    expect(
      screen.getByText(
        'Übersprungen: Predigt – hier liegt ein Entwurf · Kaffee – darfst du nicht planen · Dienst 99 – gibt es in ChurchTools nicht (mehr)',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).toBeNull();
  });

  it('hat der Termin schon alles: „Der Termin hat schon alles aus der Vorlage.“, kein Übernehmen', async () => {
    zeigeMitVorlage();
    await waehle('Standard');
    expect(screen.getByText('Der Termin hat schon alles aus der Vorlage.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).toBeNull();
  });

  it('Übernehmen ruft „aendern“ je Dienst mit der gesehenen Zahl; danach stimmen Liste und Vorschau', async () => {
    const p = zeigeMitVorlage();
    await waehle('Abendmahl');
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(p.aendern).toHaveBeenCalledTimes(2));
    expect(p.aendern).toHaveBeenNthCalledWith(1, ABENDMAHL, 0, 1);
    expect(p.aendern).toHaveBeenNthCalledWith(2, GESANG, 2, 3);
    expect(
      await screen.findByText(/Übernommen – Abendmahl: 1 Platz · Gesang: 3 Plätze\./),
    ).toBeTruthy();
    expect(zahl('Abendmahl')).toBe('1');
    expect(p.onGespeichert).toHaveBeenCalledWith('Vorlage „Abendmahl“ übernommen: 2 Dienste.');
    // Wählt man sie noch einmal, ist nichts mehr zu tun.
    await waehle('Abendmahl');
    expect(screen.getByText('Der Termin hat schon alles aus der Vorlage.')).toBeTruthy();
    fireEvent.click(knopf('Fenster schließen'));
    expect(p.onClose).toHaveBeenCalledWith(true);
  });

  it('Teilfehler: der Fehler wird gemeldet, die anderen Dienste laufen weiter', async () => {
    const aendern = vi.fn<Aendern>((z, _g, neu) =>
      z.serviceId === 24
        ? Promise.resolve({ ok: false as const, grund: 'konflikt' as const, jetzt: 2 })
        : Promise.resolve({ ok: true as const, anzahl: neu }),
    );
    const p = zeigeMitVorlage(aendern);
    await waehle('Abendmahl');
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(aendern).toHaveBeenCalledTimes(2));
    expect(aendern).toHaveBeenLastCalledWith(GESANG, 2, 3); // nach dem Fehler weitergemacht
    expect(
      (await screen.findByText(/^Abendmahl: Jemand hat die Zahl eben geändert/)).getAttribute(
        'role',
      ),
    ).toBe('alert');
    expect(screen.getByText(/Übernommen – Gesang: 3 Plätze\./)).toBeTruthy();
    // Was jetzt in ChurchTools steht, gilt (2), und es hat sich etwas geändert → Neuladen beim Schließen.
    expect(zahl('Abendmahl')).toBe('2');
    fireEvent.click(knopf('Fenster schließen'));
    expect(p.onClose).toHaveBeenCalledWith(true);
  });

  it('wirft „aendern“ bei einem Dienst, ist das ein vorübergehender Fehler – die anderen laufen weiter', async () => {
    const aendern = vi.fn<Aendern>((z, _g, neu) =>
      z.serviceId === 24
        ? Promise.reject(new Error('Netz'))
        : Promise.resolve({ ok: true, anzahl: neu }),
    );
    zeigeMitVorlage(aendern);
    await waehle('Abendmahl');
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(await screen.findByText(/^Abendmahl: ChurchTools antwortet gerade nicht/)).toBeTruthy();
    expect(aendern).toHaveBeenCalledTimes(2);
  });

  it('während des Übernehmens ist alles gesperrt', async () => {
    let fertig!: (r: AnzahlErgebnis) => void;
    const p = zeigeMitVorlage(() => new Promise((r) => (fertig = r)));
    await waehle('Abendmahl');
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(knopf('Abendmahl: ein Platz mehr')).toHaveProperty('disabled', true);
    expect(knopf('Fenster schließen')).toHaveProperty('disabled', true);
    expect(screen.getByRole('combobox', { name: 'Vorlage' })).toHaveProperty('disabled', true);
    await act(async () => fertig({ ok: true, anzahl: 1 }));
    await act(async () => fertig({ ok: true, anzahl: 3 }));
    expect(p.aendern).toHaveBeenCalledTimes(2);
  });

  it('Ladefehler der Vorlagen: ruhiger Hinweis, das Fach bleibt bedienbar; „Nochmal versuchen“ lädt neu', async () => {
    const laden = vi
      .fn<() => Promise<TerminVorlage[]>>()
      .mockRejectedValueOnce(new ApiError(502, 'kaputt'))
      .mockResolvedValue(VORLAGEN);
    const p = zeigeMitVorlage(undefined, laden);
    expect(
      await screen.findByText(/Die Vorlagen von ChurchTools sind gerade nicht zu erreichen/),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(knopf('Abendmahl: ein Platz mehr'));
    await waitFor(() => expect(p.aendern).toHaveBeenCalledWith(ABENDMAHL, 0, 1));
    fireEvent.click(knopf('Nochmal versuchen'));
    expect(await screen.findByRole('combobox', { name: 'Vorlage' })).toBeTruthy();
  });

  it('keine Vorlage für den Kalender oder kein Anschluss: kein Vorlagen-Bereich', async () => {
    zeigeMitVorlage(undefined, () => Promise.resolve([]));
    await waitFor(() => expect(screen.queryByText(/Vorlagen/)).toBeNull());
    expect(screen.queryByRole('combobox', { name: 'Vorlage' })).toBeNull();
    cleanup();
    zeige(); // ohne `vorlage`
    expect(screen.queryByRole('combobox', { name: 'Vorlage' })).toBeNull();
  });

  it('der Hilfetext nennt die Vorlage nur, wenn es eine gibt', async () => {
    zeigeMitVorlage();
    expect(await screen.findByText(/Eine Vorlage nimmt nur dazu, was fehlt/)).toBeTruthy();
  });
});
