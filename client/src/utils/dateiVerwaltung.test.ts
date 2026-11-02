import { describe, it, expect } from 'vitest';
import type { ArrangementFileEntry } from '@shared/types/index';
import { MAX_FILE_BYTES } from '@shared/dateien/index';
import { nameTeilen, neuerDateiname, versionFileName } from '@shared/ct/arrangementFiles';
import {
  DATEI_ART,
  DATEI_SYMBOL,
  loeschFolge,
  loeschFrage,
  pruefeUpload,
  umbenennPruefung,
  umbenennVorlage,
} from './dateiVerwaltung';

/**
 * #321, Schritt 4.
 *
 * **Warum das die wichtigsten Tests dieses Schritts sind:** Die Dateiliste ist auf Alwins Wunsch
 * flach – sie schützt nichts, jede Datei ist löschbar. Damit ist der **Wortlaut der Rückfrage** die
 * einzige Bremse davor, dem Lied sein Notenblatt zu nehmen. Ein Text, der das nicht sagt, ist hier
 * kein Schönheitsfehler, sondern der fehlende Schutz.
 */
const datei = (
  name: string,
  kind: ArrangementFileEntry['kind'],
  size: number | null = 1024,
): ArrangementFileEntry => ({ fileId: 1, name, label: name, size, kind });

describe('loeschFolge – was nach dem Löschen fehlt', () => {
  it('nennt beim Original-ChordPro, dass danach das Notenblatt fehlt', () => {
    const folge = loeschFolge('chordpro-original');
    expect(folge).toMatch(/Quelle des Notenblatts/);
    expect(folge).toMatch(/keine Akkorde mehr/);
  });

  it('nennt bei einer Version, dass sie aus dem Menü verschwindet', () => {
    expect(loeschFolge('chordpro-version')).toMatch(/aus dem Lied-Menü/);
  });

  it('erfindet bei PDF, Bild und Sonstigem keine Folge', () => {
    // Dort ist das Löschen selbsterklärend. Ein zusätzlicher Satz würde die Warnung abstumpfen –
    // eine Meldung, die immer leuchtet, wird ignoriert.
    expect(loeschFolge('pdf')).toBeNull();
    expect(loeschFolge('image')).toBeNull();
    expect(loeschFolge('other')).toBeNull();
  });
});

describe('loeschFrage – der Text der Rückfrage', () => {
  it('nennt Namen, Folge und dass nur erneutes Hochladen hilft', () => {
    const frage = loeschFrage(datei('Treu.chordpro', 'chordpro-original'));
    expect(frage).toContain('„Treu.chordpro" wird aus ChurchTools entfernt.');
    expect(frage).toMatch(/Quelle des Notenblatts/);
    expect(frage).toMatch(/erneutes Hochladen/);
  });

  it('bleibt bei einem PDF knapp, sagt aber die Unumkehrbarkeit', () => {
    const frage = loeschFrage(datei('Treu - E.pdf', 'pdf'));
    expect(frage).toBe(
      '„Treu - E.pdf" wird aus ChurchTools entfernt. Wiederherstellen geht nur durch erneutes Hochladen.',
    );
  });
});

describe('pruefeUpload – vor der Übertragung, nicht danach', () => {
  const vorhandene = [datei('Treu - E.pdf', 'pdf'), datei('Treu.chordpro', 'chordpro-original')];

  it('lässt eine normale Datei durch', () => {
    expect(pruefeUpload({ name: 'neu.pdf', size: 1024 }, vorhandene)).toBeNull();
  });

  it('lehnt eine leere Datei ab', () => {
    // Eine 0-Byte-Datei in ChurchTools sieht aus wie eine echte und wäre nur Ärger.
    expect(pruefeUpload({ name: 'leer.pdf', size: 0 }, [])).toEqual({
      art: 'fehler',
      text: '„leer.pdf" ist leer und wurde nicht hochgeladen.',
    });
  });

  it('lehnt eine zu große Datei ab und nennt die Grenze in Worten', () => {
    const b = pruefeUpload({ name: 'scan.pdf', size: MAX_FILE_BYTES + 1 }, []);
    expect(b?.art).toBe('fehler');
    // „52428800" wäre für niemanden eine Auskunft.
    expect(b?.text).toContain('50 MB');
  });

  it('lässt genau die Grenze noch durch', () => {
    // Sonst wäre die erlaubte Größe faktisch eine andere als die genannte.
    expect(pruefeUpload({ name: 'gross.pdf', size: MAX_FILE_BYTES }, [])).toBeNull();
  });

  it('warnt bei gleichem Namen – aber verbietet nicht', () => {
    const b = pruefeUpload({ name: 'Treu - E.pdf', size: 1024 }, vorhandene);
    expect(b?.art).toBe('warnung');
    expect(b?.text).toMatch(/NICHT ersetzt/);
  });

  it('prüft den Namen genau, nicht nur ungefähr', () => {
    // „Treu - E (1).pdf" ist eine andere Datei und darf nicht als Doppel gemeldet werden.
    expect(pruefeUpload({ name: 'Treu - E (1).pdf', size: 1024 }, vorhandene)).toBeNull();
  });

  it('meldet die Größe VOR dem Doppel – der schwerere Grund gewinnt', () => {
    // Sonst bestätigt man das Doppel und bekommt danach erst die Größenmeldung.
    const b = pruefeUpload({ name: 'Treu - E.pdf', size: MAX_FILE_BYTES + 1 }, vorhandene);
    expect(b?.art).toBe('fehler');
  });
});

describe('Texte je Art – vollständig, damit keine Art durchfällt', () => {
  it('jede Art hat Symbol und Bezeichnung', () => {
    // Ein fehlender Eintrag ergäbe „undefined" in der Liste. Der Compiler fängt das über
    // `Record<ArrangementFileKind, string>` – dieser Test hält es zusätzlich zur Laufzeit fest.
    for (const kind of [
      'chordpro-original',
      'chordpro-version',
      'pdf',
      'image',
      'other',
    ] as const) {
      expect(DATEI_SYMBOL[kind]).toBeTruthy();
      expect(DATEI_ART[kind]).toBeTruthy();
    }
  });
});

/**
 * Umbenennen (31.10.2026). Die Regel `neuerDateiname` gilt im Fenster UND im Kern vor dem Schreiben – hier wird sie
 * selbst geprüft und über das, was das Fenster daraus macht.
 */
describe('neuerDateiname – die Endung bleibt, eine Version entsteht nicht', () => {
  it('hängt die alte Endung an', () => {
    expect(neuerDateiname('Treu - E.pdf', 'Leadsheet E')).toEqual({
      name: 'Leadsheet E.pdf',
      fehler: null,
    });
  });

  it('tippt man die Endung mit, wird sie nicht verdoppelt – auch in anderer Schreibweise', () => {
    expect(neuerDateiname('Bild.JPG', 'Akkorde.jpg').name).toBe('Akkorde.JPG');
  });

  it('eine andere Endung im Namen bleibt Teil des Namens', () => {
    // Aus „Lead.txt“ als Eingabe für ein PDF wird „Lead.txt.pdf“ – ein PDF bleibt ein PDF.
    expect(neuerDateiname('Lead.pdf', 'Lead.txt').name).toBe('Lead.txt.pdf');
  });

  it('leer oder nur verbotene Zeichen → Fehler', () => {
    expect(neuerDateiname('a.pdf', '   ').fehler).toBe('Bitte einen Namen angeben.');
    expect(neuerDateiname('a.pdf', '/:*').fehler).toBe('Bitte einen Namen angeben.');
    expect(neuerDateiname('a.pdf', '.pdf').fehler).toBe('Bitte einen Namen angeben.');
  });

  it('verbotene Zeichen fallen weg – ein Pfad entsteht nicht', () => {
    expect(neuerDateiname('a.pdf', '../geheim').name).toBe('..geheim.pdf');
  });

  it('beim Original-ChordPro ist ein Versions-Name gesperrt', () => {
    // Gegen den Erzeuger: genau so heißt eine Version, wenn die App sie schreibt.
    const versionsName = versionFileName('Treu', 'Live').replace(/\.chordpro$/, '');
    expect(neuerDateiname('Treu.chordpro', versionsName).fehler).toMatch(
      /Versionen aus dem Editor/,
    );
    expect(neuerDateiname('Treu.chordpro', 'Treu - bearbeitet').fehler).toMatch(/Versionen/);
  });

  it('„(App)“ vor einer anderen Endung ist harmlos', () => {
    // Eine Version ist nur eine .chordpro-Datei; ein PDF bleibt ein PDF.
    expect(neuerDateiname('Lead.pdf', 'Lead (App)').name).toBe('Lead (App).pdf');
  });

  it('zu lang → Fehler', () => {
    expect(neuerDateiname('a.pdf', 'x'.repeat(260)).fehler).toBe('Der Name ist zu lang.');
  });
});

describe('nameTeilen', () => {
  it('teilt am letzten Punkt', () => {
    expect(nameTeilen('Treu 1.2.pdf')).toEqual({ basis: 'Treu 1.2', endung: '.pdf' });
  });
  it('ohne Endung bleibt alles Name', () => {
    expect(nameTeilen('Notizen')).toEqual({ basis: 'Notizen', endung: '' });
    expect(nameTeilen('.hidden')).toEqual({ basis: '.hidden', endung: '' });
    expect(nameTeilen('Vers 2. Teil')).toEqual({ basis: 'Vers 2. Teil', endung: '' });
  });
});

describe('umbenennVorlage / umbenennPruefung – was das Fenster zeigt', () => {
  const version = {
    ...datei(versionFileName('Treu', 'Akustik'), 'chordpro-version'),
    label: 'Version „Akustik“',
  };

  it('eine Datei: Name und feste Endung, kein Versionsschlüssel', () => {
    expect(umbenennVorlage(datei('Treu - E.pdf', 'pdf'))).toEqual({
      basis: 'Treu - E',
      endung: '.pdf',
      versionKey: null,
    });
  });

  it('eine Version: nur ihr Name, ohne Endung – und ihr Schlüssel', () => {
    expect(umbenennVorlage(version)).toEqual({
      basis: 'Akustik',
      endung: '',
      versionKey: 'akustik',
    });
  });

  it('unverändert = nichts zu tun, aber auch kein Fehler', () => {
    expect(umbenennPruefung(datei('Treu - E.pdf', 'pdf'), 'Treu - E')).toEqual({
      fehler: null,
      gleich: true,
    });
    expect(umbenennPruefung(version, 'Akustik')).toEqual({ fehler: null, gleich: true });
  });

  it('eine Version prüft hier nur „nicht leer“ – den Rest sagt ChurchTools-seitig `versionAendern`', () => {
    expect(umbenennPruefung(version, ' ').fehler).toBe('Bitte einen Namen angeben.');
    expect(umbenennPruefung(version, 'Live')).toEqual({ fehler: null, gleich: false });
  });

  it('eine Datei nimmt die Regel des Kerns', () => {
    expect(
      umbenennPruefung(datei('Treu.chordpro', 'chordpro-original'), 'Treu — Live (App)').fehler,
    ).toMatch(/Versionen aus dem Editor/);
  });
});
