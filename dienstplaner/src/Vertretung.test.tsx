// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LEERER_PLAN, mein, zeile } from '@shared/dienstplan/zeile.testutil';
import { ApiError } from '@ui/ct/fehler';
import { Startseite } from './Startseite';
import { startFuer } from './start.testutil';
import { tauschAttrappe } from './tausch.testutil';
import { TauschAmDienst, type EigenerDienst } from './TauschTeile';
import type { VertretungLage } from './ladeVertretung';
import { VertretungFenster } from './VertretungFenster';
import type { MailBericht } from './vertretungAblauf';
import {
  alleMailsRaus,
  anschlussAttrappe,
  ENTWURFS_LAGE,
  offeneVertretung,
  vertretungAttrappe,
} from './vertretung.testutil';

// Testing Library räumt nicht von selbst auf (kein `globals`) – ohne das blieben Fenster und Knöpfe des vorigen Tests stehen
// und mischten sich in die Abfragen des nächsten.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TAG = '2026-12-13';
const D: EigenerDienst = {
  terminId: 246,
  termin: 'Gottesdienst',
  tag: TAG,
  uhrzeit: '10:00',
  dienst: 'Gesang',
  ort: { serviceId: 9, index: 1 },
};

const haken = (name: string) => screen.getByRole<HTMLInputElement>('checkbox', { name });
const knopf = (name: string | RegExp) => screen.getByRole<HTMLButtonElement>('button', { name });

function oeffne(
  v = vertretungAttrappe(),
  onClose = vi.fn(),
): { v: ReturnType<typeof vertretungAttrappe>; onClose: ReturnType<typeof vi.fn> } {
  render(<VertretungFenster d={D} vertretung={v} onClose={onClose} />);
  return { v, onClose };
}

describe('Fenster „Vertretung suchen“', () => {
  it('Kopf, Satz mit Dienst · Termin · Tag lang, Abschnitte mit Kommentar; „Ja“ vorab angehakt, sonst nicht', async () => {
    oeffne();
    expect(await screen.findByText('Hat Ja gesagt')).toBeTruthy();
    // Der Kopf des Fensters (modal) trägt den Titel – das Fenster heißt „Vertretung suchen“.
    expect(screen.getByRole('dialog', { name: 'Vertretung suchen' })).toBeTruthy();
    expect(screen.getByText('Gesang · Gottesdienst · Sonntag, 13. Dezember')).toBeTruthy();
    expect(
      screen.getByText(/wähle, wen du fragst\. Dein Dienst wird dabei abgesagt\./),
    ).toBeTruthy();
    for (const titel of ['Hat Ja gesagt', 'Vielleicht', 'Ohne Antwort'])
      expect(screen.getByRole('region', { name: titel })).toBeTruthy();
    expect(screen.getByText('„nur bis 12 Uhr“')).toBeTruthy();
    expect(screen.getByText('„falls niemand sonst kann“')).toBeTruthy();
    expect([haken('Ben Test'), haken('Finn Test')].map((h) => h.checked)).toEqual([true, true]);
    expect(
      [haken('Clara Test'), haken('David Test'), haken('Ella Test')].map((h) => h.checked),
    ).toEqual([false, false, false]);
  });

  it('EIN gefüllter Knopf: „Absagen und fragen“ – ist niemand angehakt, heißt er nur „Absagen“; der Hinweis folgt', async () => {
    oeffne();
    await screen.findByText('Hat Ja gesagt');
    expect(knopf('Absagen und fragen')).toBeTruthy();
    expect(
      screen.getByText(
        'Ben Test und Finn Test bekommen eine Mail, die Leitung des Lobpreisteam eine Kopie.',
      ),
    ).toBeTruthy();
    fireEvent.click(haken('Ben Test'));
    expect(
      screen.getByText('Finn Test bekommt eine Mail, die Leitung des Lobpreisteam eine Kopie.'),
    ).toBeTruthy();
    fireEvent.click(haken('Finn Test'));
    expect(knopf('Absagen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Absagen und fragen' })).toBeNull();
    expect(screen.getByText(/Niemand wird angeschrieben/)).toBeTruthy();
    // Nur „Abbrechen“ und dieser eine Knopf (plus das X): kein zweiter gefüllter Knopf.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(
      expect.arrayContaining(['Abbrechen', 'Absagen']),
    );
    fireEvent.click(haken('Clara Test'));
    expect(knopf('Absagen und fragen')).toBeTruthy();
  });

  it('der Knopf schickt genau die Angehakten, in Listenreihenfolge, mit Nachricht, Leitung und Termin', async () => {
    const { v } = oeffne();
    await screen.findByText('Hat Ja gesagt');
    fireEvent.click(haken('Finn Test')); // ab
    fireEvent.click(haken('Clara Test')); // an
    fireEvent.change(screen.getByLabelText('Nachricht (freiwillig)'), {
      target: { value: 'Bin krank' },
    });
    await act(async () => {
      fireEvent.click(knopf('Absagen und fragen'));
    });
    const [a, dienst] = vi.mocked(v.anschluss.suchen).mock.calls[0];
    expect(a.gefragt.map((g) => g.name)).toEqual(['Ben Test', 'Clara Test']);
    expect(a.nachricht).toBe('Bin krank');
    expect(a.leitung.map((l) => l.name)).toEqual(['Alwin Friesen']);
    expect(a.termin).toEqual({ id: 246, name: 'Gottesdienst', tag: TAG, uhrzeit: '10:00' });
    expect(a.dienst).toEqual({ id: 9, name: 'Gesang', index: 1 }); // der abgesagte Platz
    expect(a.ich).toEqual({ id: 46, name: 'Anna Test' });
    expect(dienst).toBe(D);
  });

  it('Markierung oder Absage gescheitert: das Fenster bleibt, sagt es, nichts wird neu geladen – und man kann es noch einmal versuchen', async () => {
    const v = vertretungAttrappe({
      anschluss: anschlussAttrappe({
        suchen: vi.fn(() =>
          Promise.resolve({
            art: 'nichtAbgesagt' as const,
            text: 'Speicher nicht eingerichtet. Es wurde nichts abgesagt und niemand gefragt.',
          }),
        ),
      }),
    });
    const { onClose } = oeffne(v);
    await screen.findByText('Hat Ja gesagt');
    await act(async () => {
      fireEvent.click(knopf('Absagen und fragen'));
    });
    expect((await screen.findByRole('alert')).textContent).toMatch(/nichts abgesagt/);
    expect(knopf('Absagen und fragen').disabled).toBe(false);
    expect(v.geaendert).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('abgesagt, alle Mails raus: sagt es – und lädt erst beim Schließen neu (sonst verschwindet das Fenster mit dem Dienst)', async () => {
    const { v, onClose } = oeffne();
    await screen.findByText('Hat Ja gesagt');
    await act(async () => {
      fireEvent.click(knopf('Absagen und fragen'));
    });
    const stand = await screen.findByRole('status');
    expect(stand.textContent).toMatch(/Abgesagt\./);
    expect(stand.textContent).toMatch(
      /Mail verschickt an Ben Test und Finn Test – die Leitung hat eine Kopie\./,
    );
    expect(v.geaendert).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Erneut senden' })).toBeNull();
    fireEvent.click(knopf('Fertig'));
    expect(v.geaendert).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Mails nicht (alle) raus: „Abgesagt. Mail an … nicht verschickt“ und „Erneut senden“ – nur auf Klick, danach der Erfolg', async () => {
    const teilweise: MailBericht = {
      ziele: [
        { personId: 47, name: 'Ben Test', rolle: 'gefragt', antwort: 'ja' },
        { personId: 48, name: 'Finn Test', rolle: 'gefragt', antwort: 'ja' },
      ],
      ergebnisse: new Map([
        [47, { art: 'verschickt' as const }],
        [48, { art: 'unklar' as const }],
      ]),
      angehalten:
        'ChurchTools hat nicht geantwortet. Bei Finn Test ist unklar, ob die Mail rausging.',
    };
    const erneut = vi.fn(() => Promise.resolve(alleMailsRaus([47, 48])));
    const v = vertretungAttrappe({
      anschluss: anschlussAttrappe({
        suchen: vi.fn(() => Promise.resolve({ art: 'abgesagt' as const, mails: teilweise })),
        erneut,
      }),
    });
    oeffne(v);
    await screen.findByText('Hat Ja gesagt');
    await act(async () => {
      fireEvent.click(knopf('Absagen und fragen'));
    });
    const stand = await screen.findByRole('status');
    expect(stand.textContent).toMatch(/Abgesagt\./);
    expect(stand.textContent).toMatch(/Mail an Finn Test nicht verschickt\./);
    expect(stand.textContent).toMatch(/Bei Finn Test ist unklar, ob die Mail angekommen ist/);
    expect(erneut).not.toHaveBeenCalled(); // nichts läuft von allein
    await act(async () => {
      fireEvent.click(knopf('Erneut senden'));
    });
    expect(erneut).toHaveBeenCalledTimes(1);
    expect(erneut.mock.calls[0]).toEqual([expect.objectContaining({ nachricht: '' }), teilweise]);
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/Mail verschickt an/),
    );
    expect(screen.queryByRole('button', { name: 'Erneut senden' })).toBeNull();
  });

  it('ohne Mail-Adresse: gesagt, kein „Erneut senden“ (Wiederholen ändert daran nichts)', async () => {
    const b: MailBericht = {
      ziele: [{ personId: 47, name: 'Ben Test', rolle: 'gefragt', antwort: null }],
      ergebnisse: new Map([[47, { art: 'ohneMail' as const }]]),
      angehalten: null,
    };
    oeffne(
      vertretungAttrappe({
        anschluss: anschlussAttrappe({
          suchen: vi.fn(() => Promise.resolve({ art: 'abgesagt' as const, mails: b })),
        }),
      }),
    );
    await screen.findByText('Hat Ja gesagt');
    await act(async () => {
      fireEvent.click(knopf('Absagen und fragen'));
    });
    const stand = (await screen.findByRole('status')).textContent ?? '';
    expect(stand).toMatch(/keine Mail-Adresse/);
    expect(stand).not.toMatch(/Mail verschickt/); // niemand hat eine bekommen
    expect(screen.queryByRole('button', { name: 'Erneut senden' })).toBeNull();
  });

  it('teils verschickt, teils ohne Adresse: der Satz „Mail verschickt“ nennt NUR die, die sie wirklich bekamen (nie beides widersprüchlich)', async () => {
    const b: MailBericht = {
      ziele: [
        { personId: 47, name: 'Ben Test', rolle: 'gefragt', antwort: null },
        { personId: 48, name: 'Finn Test', rolle: 'gefragt', antwort: null },
        { personId: 1, name: 'Alwin Friesen', rolle: 'leitung', antwort: null },
      ],
      ergebnisse: new Map([
        [47, { art: 'verschickt' as const }],
        [48, { art: 'ohneMail' as const }],
        [1, { art: 'verschickt' as const }],
      ]),
      angehalten: null,
    };
    oeffne(
      vertretungAttrappe({
        anschluss: anschlussAttrappe({
          suchen: vi.fn(() => Promise.resolve({ art: 'abgesagt' as const, mails: b })),
        }),
      }),
    );
    await screen.findByText('Hat Ja gesagt');
    await act(async () => {
      fireEvent.click(knopf('Absagen und fragen'));
    });
    const text = (await screen.findByRole('status')).textContent ?? '';
    expect(text).toMatch(/Mail verschickt an Ben Test – die Leitung hat eine Kopie\./);
    expect(text).not.toMatch(/Mail verschickt an Ben Test und Finn/);
    expect(text).toMatch(/Für Finn Test hat ChurchTools keine Mail-Adresse/);
    expect(screen.queryByRole('button', { name: 'Erneut senden' })).toBeNull();
  });

  it('niemand gefragt: „Absagen“ sagt ab, das Ergebnis nennt es ehrlich', async () => {
    oeffne();
    await screen.findByText('Hat Ja gesagt');
    fireEvent.click(haken('Ben Test'));
    fireEvent.click(haken('Finn Test'));
    await act(async () => {
      fireEvent.click(knopf('Absagen'));
    });
    expect((await screen.findByRole('status')).textContent).toMatch(
      /Es wurde niemand direkt gefragt\./,
    );
  });

  it('Team lädt nicht (vorübergehend): Fehler mit „Erneut versuchen“, kein Knopf zum Absagen – nichts erfunden', async () => {
    const lage = vi
      .fn<() => Promise<VertretungLage>>()
      .mockRejectedValueOnce(new ApiError(503, 'gerade nicht'))
      .mockResolvedValueOnce(ENTWURFS_LAGE);
    oeffne(vertretungAttrappe({ anschluss: anschlussAttrappe({ lage }) }));
    const kasten = await screen.findByRole('alert');
    expect(kasten.textContent).toMatch(/antwortet gerade nicht/);
    expect(knopf(/Absagen/).disabled).toBe(true);
    expect(screen.queryByText('Hat Ja gesagt')).toBeNull();
    fireEvent.click(within(kasten).getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Hat Ja gesagt')).toBeTruthy();
  });

  it('Antworten nicht lesbar: nur „Team“ ohne Einordnung, mit Hinweis; Abwesenheiten unbekannt: Hinweis', async () => {
    const lage: VertretungLage = {
      ...ENTWURFS_LAGE,
      vorschlaege: {
        art: 'ohneAntworten',
        team: [
          { personId: 47, name: 'Ben Test', a: null, notiz: null },
          { personId: 50, name: 'David Test', a: null, notiz: null },
        ],
        grund: 'nichtLesbar',
      },
      abwesenheitenUnbekannt: true,
    };
    oeffne(
      vertretungAttrappe({ anschluss: anschlussAttrappe({ lage: () => Promise.resolve(lage) }) }),
    );
    expect(await screen.findByText(/nicht lesbar – darum steht hier das ganze Team/)).toBeTruthy();
    expect(screen.getByText(/Wer abwesend ist, konnte nicht geprüft werden/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Team' })).toBeTruthy();
    expect(screen.queryByText('Hat Ja gesagt')).toBeNull();
    // Nichts vorab angehakt – es gibt kein „Ja“.
    expect(haken('Ben Test').checked).toBe(false);
    expect(knopf('Absagen')).toBeTruthy();
  });

  it('„Nur abwesend“ (V-5): „Team“ ohne Einordnung und OHNE den Hinweis „nicht lesbar“', async () => {
    const lage: VertretungLage = {
      ...ENTWURFS_LAGE,
      vorschlaege: {
        art: 'ohneAntworten',
        team: [{ personId: 47, name: 'Ben Test', a: null, notiz: null }],
        grund: 'nurAbwesend',
      },
    };
    oeffne(
      vertretungAttrappe({ anschluss: anschlussAttrappe({ lage: () => Promise.resolve(lage) }) }),
    );
    expect(await screen.findByRole('region', { name: 'Team' })).toBeTruthy();
    expect(screen.queryByText(/nicht lesbar/)).toBeNull();
    expect(screen.queryByText('Hat Ja gesagt')).toBeNull();
    expect(haken('Ben Test').checked).toBe(false);
  });

  it('Team nicht sichtbar oder niemand in Frage: ehrlicher Satz', async () => {
    oeffne(
      vertretungAttrappe({
        anschluss: anschlussAttrappe({ lage: () => Promise.resolve({ art: 'keineMitglieder' }) }),
      }),
    );
    expect(await screen.findByText(/für dich nicht zu sehen/)).toBeTruthy();
    expect(knopf(/Absagen/).disabled).toBe(true);
    cleanup();
    const leer: VertretungLage = {
      ...ENTWURFS_LAGE,
      vorschlaege: { art: 'liste', ja: [], vielleicht: [], ohne: [] },
    };
    oeffne(
      vertretungAttrappe({ anschluss: anschlussAttrappe({ lage: () => Promise.resolve(leer) }) }),
    );
    expect(await screen.findByText(/Gerade kommt niemand aus dem Team in Frage/)).toBeTruthy();
    expect(knopf('Absagen').disabled).toBe(false);
  });
});

describe('„Vertretung suchen“ neben „Tauschen“', () => {
  const zeigeKnopf = (zugesagt: boolean, mitVertretung = true) =>
    render(
      <TauschAmDienst
        d={D}
        tausch={tauschAttrappe()}
        zeitzone="Europe/Berlin"
        vertretung={mitVertretung ? vertretungAttrappe() : undefined}
        zugesagt={zugesagt}
      />,
    );

  it('an einem zugesagten Dienst steht der zweite Knopf neben „Tauschen“ und öffnet das Fenster', async () => {
    zeigeKnopf(true);
    expect(screen.getByRole('button', { name: /Tauschen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Vertretung suchen/ }));
    expect(await screen.findByText('Hat Ja gesagt')).toBeTruthy();
  });

  it('an einer offenen Anfrage (nicht zugesagt) gibt es ihn nicht – dafür gibt es „Absagen“', () => {
    zeigeKnopf(false);
    expect(screen.queryByRole('button', { name: /Vertretung suchen/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Tauschen/ })).toBeTruthy();
  });

  it('ohne den Zustand (Tests, ältere Aufrufer) bleibt alles wie vorher', () => {
    zeigeKnopf(true, false);
    expect(screen.queryByRole('button', { name: /Vertretung suchen/ })).toBeNull();
  });
});

describe('Startseite – „Für dich offen“ bei einer gesuchten Vertretung', () => {
  const tag = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const termin = zeile(3, 'Gottesdienst', tag(10), {
    uhrzeit: '10:00',
    freiePlaetze: [{ serviceId: 9, index: 1 }],
  });
  const zeigeStart = (v = vertretungAttrappe()) => {
    render(
      <Startseite
        start={startFuer()}
        termine={{ art: 'fertig', zeilen: [termin], plan: LEERER_PLAN, wochen: 8 }}
        heute={tag(0)}
        onNochmal={() => {}}
        onMeineTermine={() => {}}
        vertretung={v}
      />,
    );
    return v;
  };

  it('Zeile mit Kachel, Dienst, „Termin · Tag · Uhrzeit“, Band „Anna sucht eine Vertretung“ und EINEM gefüllten Knopf „Übernehmen“', () => {
    const v = zeigeStart(vertretungAttrappe({ offen: [offeneVertretung(termin)] }));
    const offen = screen.getByRole('region', { name: 'Für dich offen' });
    expect(within(offen).getByText('Gesang')).toBeTruthy();
    expect(within(offen).getByText(/Gottesdienst · .* · 10:00 Uhr/)).toBeTruthy();
    expect(within(offen).getByText('Anna Test').closest('span')!.textContent).toBe(
      'Anna Test sucht eine Vertretung',
    );
    const uebernehmen = within(offen).getByRole('button', { name: 'Übernehmen' });
    expect(within(offen).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(uebernehmen);
    expect(v.uebernehmen).toHaveBeenCalledWith(v.offen[0]);
  });

  it('läuft das Übernehmen, ist der Knopf gesperrt; ein Fehler steht darunter (z. B. ohne Recht)', () => {
    zeigeStart(
      vertretungAttrappe({
        offen: [offeneVertretung(termin)],
        laeuft: () => true,
        fehler: () => 'Du darfst dich hier nicht selbst eintragen – frag die Leitung.',
      }),
    );
    const k = screen.getByRole<HTMLButtonElement>('button', { name: 'Wird übernommen …' });
    expect(k.disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe(
      'Du darfst dich hier nicht selbst eintragen – frag die Leitung.',
    );
  });

  it('keine gesuchte Vertretung: keine Zeile (und ohne anderes Offenes auch kein Kasten)', () => {
    zeigeStart();
    expect(screen.queryByRole('region', { name: 'Für dich offen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).toBeNull();
  });

  it('eigene zugesagte Dienste unter „Deine nächsten Dienste“ tragen „Vertretung suchen“; offene Anfragen nicht', () => {
    const z = [
      zeile(4, 'Gottesdienst', tag(5), {
        meine: [mein('Gesang', true, { ort: { serviceId: 9, index: 1 } })],
      }),
      zeile(5, 'Gottesdienst', tag(6), {
        meine: [mein('Gesang', false, { ort: { serviceId: 9, index: 1 } })],
      }),
      zeile(6, 'Gebetsabend', tag(7), {
        meine: [mein('Ton', true, { ort: { serviceId: 6, index: null } })],
      }),
    ];
    render(
      <Startseite
        start={startFuer()}
        termine={{ art: 'fertig', zeilen: z, plan: LEERER_PLAN, wochen: 8 }}
        heute={tag(0)}
        onNochmal={() => {}}
        onMeineTermine={() => {}}
        tausch={tauschAttrappe()}
        vertretung={vertretungAttrappe()}
      />,
    );
    // 4 ist „Als Nächstes“ (Termin oben), 6 steht unter „Deine nächsten Dienste“ – dort einmal; die offene Anfrage (5) keinmal.
    const knoepfe = screen.getAllByRole('button', { name: /Vertretung suchen/ });
    expect(knoepfe).toHaveLength(1);
    const nachste = screen.getByRole('region', { name: 'Deine nächsten Dienste' });
    expect(within(nachste).getByRole('button', { name: /Vertretung suchen/ })).toBeTruthy();
    const offen = screen.getByRole('region', { name: 'Für dich offen' });
    expect(within(offen).queryByRole('button', { name: /Vertretung suchen/ })).toBeNull();
  });
});
