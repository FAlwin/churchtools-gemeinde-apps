import type { AblagePort } from '@shared/ct/personenAblage';

/**
 * Personen-Dateien wie in ChurchTools, im Speicher – für Tests der Ablage und des Umzugs.
 *
 * Verhält sich wie gemessen: Hochladen legt IMMER eine neue Datei an (kein Überschreiben), IDs steigen,
 * die Liste kommt als `{ data: [...] }`. Zählt Hochladen und Löschen, damit Tests „nur das Fehlende"
 * und „ein Schreibvorgang für alle Felder" belegen können.
 */
export class AblageFake {
  private naechsteId = 100;
  /** personId → Dateien */
  readonly dateien = new Map<number, { id: number; name: string; inhalt: Uint8Array }[]>();
  hochgeladen: string[] = [];
  geloescht: number[] = [];

  port(personId: number): AblagePort {
    const url = (id: number) => `https://test.church.tools/files/${id}`;
    return {
      meineId: () => Promise.resolve(personId),
      lesen: (pfad) => {
        const m = pfad.match(/^\/files\/person\/(\d+)$/);
        if (!m) return Promise.reject(new Error(`unerwartet: ${pfad}`));
        const l = this.dateien.get(Number(m[1])) ?? [];
        return Promise.resolve({
          data: l.map((f) => ({ id: f.id, name: f.name, fileUrl: url(f.id) })),
        });
      },
      datei: (fileUrl) => {
        const id = Number(fileUrl.split('/').pop());
        for (const l of this.dateien.values()) {
          const f = l.find((x) => x.id === id);
          if (f) return Promise.resolve(f.inhalt);
        }
        return Promise.reject(new Error('404'));
      },
      hochladen: (pid, name, inhalt) => {
        const l = this.dateien.get(pid) ?? [];
        l.push({ id: this.naechsteId++, name, inhalt: new Uint8Array(inhalt) });
        this.dateien.set(pid, l);
        this.hochgeladen.push(name);
        return Promise.resolve();
      },
      loeschen: (fileId) => {
        for (const [pid, l] of this.dateien) {
          this.dateien.set(
            pid,
            l.filter((f) => f.id !== fileId),
          );
        }
        this.geloescht.push(fileId);
        return Promise.resolve();
      },
      fehler: (status, meldung) => Object.assign(new Error(meldung), { status }),
      istKeinRecht: () => false,
      istNichtGefunden: () => false,
    };
  }

  /** Den Inhalt der (neuesten) Daten-Datei einer Person lesen. */
  daten(personId: number): Record<string, { w: unknown; t: number }> {
    const l = (this.dateien.get(personId) ?? []).filter((f) => f.name === 'musikapp_daten.json');
    const f = l.at(-1);
    if (!f) return {};
    return (
      JSON.parse(new TextDecoder().decode(f.inhalt)) as {
        felder: Record<string, { w: unknown; t: number }>;
      }
    ).felder;
  }

  namen(personId: number): string[] {
    return (this.dateien.get(personId) ?? []).map((f) => f.name);
  }
}

/** Eine winzige, gültige PNG-Bildadresse (der Inhalt ist egal, nur die Form zählt). */
export const BILD = 'data:image/png;base64,iVBORw0KGgo=';
export const BILD2 = 'data:image/png;base64,iVBORw0KGgoA';
