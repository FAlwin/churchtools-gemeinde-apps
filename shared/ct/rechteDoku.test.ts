import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dienstgruppenSichtAus } from './dienstRechte';
import { rechteAus, STANDARD_ADMIN_RECHT } from './rechte';

/**
 * **Jedes Recht, das die Musik App auswertet, steht in der Rechte-Übersicht** (`docs/betrieb/ERWEITERUNG.md`,
 * Abschnitt „Rechte einrichten“, 05.11.2026). Die Übersicht ist die eine Stelle, an der eine Gemeinde nachliest, was
 * sie in ChurchTools vergeben muss – braucht eine neue Funktion ein neues Recht, wird diese Prüfung rot, bis es dort
 * steht.
 *
 * Gefunden wird gegen die Erzeuger, nicht gegen eine Liste: Die Rechte-Antwort ist ein Proxy, der mitschreibt, welche
 * Schlüssel gelesen werden. Es zählt nur, was das Ergebnis ändert – `dienstRechteAus` liest auch `edit events` und
 * `manage absent` für den Dienstplaner, die Musik App wertet sie nicht aus.
 *
 * Nicht erfasst sind die Rechte am eigenen Modul („Daten in Kategorie …“): Die liest die Musik App nicht vorab, sie
 * versucht es und meldet ein 403. Die stehen von Hand in der Tabelle der Erweiterung.
 */
type Roh = Record<string, Record<string, unknown>>;

const UEBERSICHT = fileURLToPath(new URL('../../docs/betrieb/ERWEITERUNG.md', import.meta.url));

/** Die Musik App liest ihre Rechte an genau diesen zwei Stellen (`ctLesen.meineRechte`, Server `ctCapabilities`). */
const MUSIK_APP: Record<string, (roh: Roh) => unknown> = {
  rechteAus: (roh) => rechteAus(roh, STANDARD_ADMIN_RECHT, (_s, meldung) => new Error(meldung)),
  dienstgruppenSichtAus: (roh) =>
    dienstgruppenSichtAus(roh, [{ id: 1, name: 'Technik', viewAll: false, sortKey: 1 }]),
};

/**
 * Eine Rechte-Antwort, in der genau `gesetzt` erlaubt ist. Ein festes Recht in `churchcore` ist immer da: Eine Antwort
 * ganz ohne Recht hält `rechteAus` für einen Aussetzer.
 */
function antwort(gesetzt: ReadonlySet<string>, gelesen: Set<string>): Roh {
  const modul = (name: string) => {
    const fest: Record<string, unknown> = { grundrecht: name === 'churchcore' };
    return new Proxy(fest, {
      get(ziel, schluessel) {
        if (typeof schluessel !== 'string') return undefined;
        if (Object.hasOwn(ziel, schluessel)) return ziel[schluessel];
        gelesen.add(`${name}:${schluessel}`);
        return gesetzt.has(`${name}:${schluessel}`);
      },
    });
  };
  const module: Roh = { churchcore: modul('churchcore'), churchservice: modul('churchservice') };
  return new Proxy(module, {
    get(ziel, name) {
      if (typeof name !== 'string') return undefined;
      return (ziel[name] ??= modul(name));
    },
  });
}

/**
 * Die Rechte (`modul:recht`), die das Ergebnis von `f` ändern. In beide Richtungen: einzeln vergeben (ohne alle anderen)
 * **und** einzeln weggenommen (bei allen anderen) – sonst fiele ein Recht durch, das nur zusammen mit einem anderen
 * wirkt (`a && b`), und eines, das ein Admin-Recht überdeckt (`isAdmin || …`), fände nur die erste Richtung.
 */
function wirksameRechte(f: (roh: Roh) => unknown): string[] {
  const gelesen = new Set<string>();
  const lauf = (gesetzt: string[]) => JSON.stringify(f(antwort(new Set(gesetzt), gelesen)));
  const wirksam = new Set<string>();
  // Ein gesetztes Recht kann weitere Lesezugriffe auslösen – so lange, bis nichts Neues mehr gelesen wird.
  for (let bekannt = -1; bekannt !== gelesen.size; ) {
    bekannt = gelesen.size;
    const ohne = lauf([]);
    const alle = [...gelesen];
    const mit = lauf(alle);
    for (const k of alle) {
      if (lauf([k]) !== ohne || lauf(alle.filter((x) => x !== k)) !== mit) wirksam.add(k);
    }
  }
  return [...wirksam].sort();
}

const alleRechte = () => [...new Set(Object.values(MUSIK_APP).flatMap(wirksameRechte))].sort();

/** Der Abschnitt „Rechte einrichten“ bis zur nächsten Hauptüberschrift. */
function uebersicht(): string {
  const text = readFileSync(UEBERSICHT, 'utf8');
  const start = text.indexOf('## Rechte einrichten');
  const ende = text.indexOf('\n## ', start + 1);
  return text.slice(start, ende === -1 ? undefined : ende);
}

describe('Rechte-Übersicht der Musik App', () => {
  it('findet die Rechte, die die Musik App auswertet – und nur die', () => {
    const rechte = alleRechte();
    // Sonst prüfte der Test unten eine leere Liste und wäre immer grün.
    expect(rechte).toEqual(
      expect.arrayContaining([
        'churchcore:administer persons',
        'churchservice:view songcategory',
        'churchservice:view agenda',
        'churchservice:edit agenda',
        'churchservice:edit songcategory',
        'churchservice:use ccli',
        'churchservice:view song statistics',
        'churchservice:view servicegroup',
      ]),
    );
    expect(rechte).not.toContain('churchservice:edit events');
    expect(rechte).not.toContain('churchservice:manage absent');
  });

  it('jedes davon steht in docs/betrieb/ERWEITERUNG.md unter „Rechte einrichten“', () => {
    const text = uebersicht();
    expect(text).toContain('## Rechte einrichten');
    const fehlen = alleRechte().filter((r) => !text.includes(`\`${r.split(':')[1]}\``));
    expect(fehlen, 'Diese Rechte in die Rechte-Übersicht eintragen').toEqual([]);
  });
});
