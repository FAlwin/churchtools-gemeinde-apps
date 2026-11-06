import { describe, it, expect } from 'vitest';
import * as gemeinsam from '@ui/ct/lieder';
import * as lesen from './ctLesen';
import * as schreiben from './ctSchreiben';
import * as songSelect from './ctSongSelect';

/**
 * Die Lied-Wege der Erweiterung liegen seit LW2a (06.11.2026) in `@ui/ct/lieder` – für Musik-App und Dienstplaner.
 * Die Dienste der Musik-App reichen sie nur weiter. Stünde hier wieder eine eigene Fassung, gäbe es zwei
 * Zwischenspeicher (Statistik, Stammdaten) und zwei Stellen für jede künftige Korrektur.
 */
describe('Musik-App-Dienste reichen die gemeinsamen Lied-Wege weiter (LW2a)', () => {
  it('Lesen', () => {
    expect(lesen.leser).toBe(gemeinsam.leser);
    expect(lesen.lieder).toBe(gemeinsam.lieder);
    expect(lesen.blatt).toBe(gemeinsam.blatt);
    expect(lesen.liedtextVorschau).toBe(gemeinsam.liedtextVorschau);
    expect(lesen.liedNutzung).toBe(gemeinsam.liedNutzung);
    expect(lesen.bearbeitbareKategorien).toBe(gemeinsam.bearbeitbareKategorien);
    expect(lesen.quellen).toBe(gemeinsam.quellen);
    expect(lesen.liedStammdatenAnsicht).toBe(gemeinsam.liedStammdatenAnsicht);
    expect(lesen.arrangementVerwaltung).toBe(gemeinsam.arrangementVerwaltung);
  });

  it('Schreiben', () => {
    expect(schreiben.liedNeu).toBe(gemeinsam.liedNeu);
    expect(schreiben.liedAendern).toBe(gemeinsam.liedAendern);
    expect(schreiben.arrangement).toBe(gemeinsam.arrangement);
    expect(schreiben.notenblatt).toBe(gemeinsam.notenblatt);
    expect(schreiben.notenblattAusCcli).toBe(gemeinsam.notenblattAusCcli);
  });

  it('SongSelect – unter den bisherigen Namen', () => {
    expect(songSelect.songSelect).toBe(gemeinsam.songSelect);
    expect(songSelect.suchen).toBe(gemeinsam.songSelectSuche);
    expect(songSelect.lied).toBe(gemeinsam.songSelectLiedHolen);
    expect(songSelect.liedtext).toBe(gemeinsam.songSelectLiedtextHolen);
  });
});
