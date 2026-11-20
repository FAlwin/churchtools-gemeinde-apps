/**
 * **Nur zum Entwickeln** (`npm run dev -w website`, dann `…/ccm/website/?demo`): spielt die ChurchTools-Antworten nach,
 * in der Form, die an der Test-Instanz gemessen wurde (Messung W0, 19.11.2026), damit die Seite ohne Instanz zu sehen
 * ist. Wird nie mitgebaut (`main.tsx`). Gespeichert wird nur im Browser-Speicher. Fälle:
 *  - `?demo` – Admin, noch nicht eingerichtet; „Einrichten“ legt die Kategorien im Speicher an.
 *  - `?demo=leer` – Admin, eingerichtet, noch keine Seite (Hinweis „Startseite anlegen“).
 *  - `?demo=seiten` – Admin, eingerichtet, Startseite plus zwei Seiten, eine im Menü.
 *  - `?demo=leitung` – Leitung der Gruppe (kein Admin), sonst wie `seiten`.
 *  - `?demo=mitglied` – Mitglied der Gruppe, sieht den Editor nicht.
 *  - `?demo=kaputt` – wie `seiten`, aber ein Wert in „Entwürfe“ ist beschädigt (Hinweis „stimmt etwas nicht“).
 *  - `?demo=gesperrt` – wie `seiten`, aber die Startseite bearbeitet gerade jemand anderes („Gerade bearbeitet von …“,
 *    nur ansehen). Die Sperre gilt zehn Minuten ab dem Laden der Seite.
 *  - `?demo=eigene` – wie `gesperrt`, aber die Sperre ist die eigene aus einem anderen Fenster (so sieht es nach dem Neuladen
 *    aus, wenn die Freigabe beim Verlassen nicht durchkam): „Hier weiterbearbeiten“ nimmt sie.
 *  - `?demo=wackelt` – wie `seiten`, aber das erste Speichern einer Seite scheitert vorübergehend (503): „Nicht gespeichert“,
 *    die Änderung bleibt stehen, „Erneut versuchen“ klappt.
 *  - `?demo=aussehen-gesperrt` – wie `seiten`, aber das Aussehen (die Einstellungen) bearbeitet gerade jemand anderes.
 *  - `?demo=fehler` – ChurchTools antwortet nicht.
 *
 * Alle Fälle mit Seiten haben gespeicherte Einstellungen (Farben, Schriften Quicksand und Caveat Brush) – der Reiter „Aussehen“
 * zeigt damit etwas. Die Schriften werden im Entwicklungsmodus wie im Bau als `data:`-Adresse nachgeladen.
 *
 * **Im Demo-Modus geht keine Anfrage ins Netz:** `fetch` wird vor dem ersten Zeichnen ersetzt und beantwortet jeden Pfad
 * selbst – was nicht bekannt ist, bekommt 404 und wird in der Konsole genannt, statt an einen Server zu gehen.
 */
import { teileBauen } from '@shared/ct/teile';
import { sperreVon } from '@shared/ct/sperre';
import { kategorienFuer } from '@shared/website/einrichten';
import {
  einstellungenAlsText,
  seiteAlsText,
  menueAlsText,
  type Einstellungen,
  type Menue,
  type Seite,
} from '@shared/website/modell';
import {
  EINSTELLUNGEN_ID,
  MENUE_ID,
  type Einheit,
  type WebsiteKopf,
  type WebsiteTeil,
} from '@shared/website/speicher';
import { neueStartseite, vorlaeufigeEinstellungen } from '@shared/website/seitenListe';
import type { WebsiteSperre } from '@shared/website/sperre';

const MODUL = 40;
const GRUPPE = 7;
const ENTWUERFE = 201;
const VEROEFFENTLICHT = 202;

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  const eingerichtet = [
    'leer',
    'seiten',
    'leitung',
    'mitglied',
    'kaputt',
    'gesperrt',
    'eigene',
    'wackelt',
    'aussehen-gesperrt',
  ].includes(fall);
  const admin = [
    '',
    'leer',
    'seiten',
    'kaputt',
    'gesperrt',
    'eigene',
    'wackelt',
    'aussehen-gesperrt',
  ].includes(fall);
  const kategorien: { id: number; shorty: string; name: string }[] = [];
  const [e, v] = kategorienFuer(GRUPPE, 'Website');
  if (eingerichtet)
    kategorien.push(
      { id: ENTWUERFE, shorty: e.kuerzel, name: e.name },
      { id: VEROEFFENTLICHT, shorty: v.kuerzel, name: v.name },
    );

  const werte = new Map<number, { id: number; dataCategoryId: number; value: string }[]>([
    [ENTWUERFE, []],
    [VEROEFFENTLICHT, []],
  ]);
  let naechsteId = 1000;
  /** Eine Einheit so ablegen, wie `einheitSpeichern` es tut: Teile und Kopf. */
  const lege = (einheit: Einheit, id: string, text: string) => {
    const { stand, werte: teile } = teileBauen(
      text,
      (t) =>
        ({
          art: 'website-teil',
          fassung: 1,
          einheit,
          id,
          stand: t.stand,
          nr: t.nr,
          von: t.von,
          daten: t.daten,
        }) satisfies WebsiteTeil,
      'Ein Website-Teil',
    );
    const liste = werte.get(ENTWUERFE)!;
    for (const value of teile) liste.push({ id: naechsteId++, dataCategoryId: ENTWUERFE, value });
    const kopf: WebsiteKopf = {
      art: 'website-kopf',
      fassung: 1,
      einheit,
      id,
      stand,
      zeit: new Date().toISOString(),
    };
    liste.push({ id: naechsteId++, dataCategoryId: ENTWUERFE, value: JSON.stringify(kopf) });
  };

  if (
    [
      'seiten',
      'leitung',
      'mitglied',
      'kaputt',
      'gesperrt',
      'eigene',
      'wackelt',
      'aussehen-gesperrt',
    ].includes(fall)
  ) {
    let n = 0;
    const id = () => `demo-${++n}`;
    const start = neueStartseite([], id);
    const gruppen: Seite = {
      id: 'demo-gruppen',
      titel: 'Unsere Gruppen',
      pfad: 'unsere-gruppen',
      abschnitte: [],
    };
    const impressum: Seite = {
      id: 'demo-impressum',
      titel: 'Impressum',
      pfad: 'impressum',
      abschnitte: [],
    };
    for (const s of [start, gruppen, impressum]) lege('seite', s.id, seiteAlsText(s));
    const menue: Menue = {
      eintraege: [{ titel: 'Unsere Gruppen', ziel: { art: 'seite', seiteId: gruppen.id } }],
    };
    lege('menue', MENUE_ID, menueAlsText(menue));
    const aussehen: Einstellungen = {
      ...vorlaeufigeEinstellungen('Demo-Gemeinde'),
      noindex: false,
      farben: {
        haupt: '#00434c',
        akzent: '#e3aa1d',
        grund: '#ffffff',
        sanft: '#eef3f3',
        text: '#1e2a2b',
      },
      schriften: {
        text: { art: 'auswahl', name: 'Quicksand' },
        ueberschrift: { art: 'auswahl', name: 'Quicksand' },
        akzent: { art: 'auswahl', name: 'Caveat Brush' },
      },
    };
    lege('einstellungen', EINSTELLUNGEN_ID, einstellungenAlsText(aussehen));
    if (fall === 'aussehen-gesperrt') {
      const sperre: WebsiteSperre = {
        art: 'website-sperre',
        fassung: 1,
        einheit: 'einstellungen',
        id: EINSTELLUNGEN_ID,
        sperre: sperreVon(
          { person: 2, name: 'Jonas Peters', fenster: 'anderes-fenster' },
          new Date(),
        ),
      };
      werte
        .get(ENTWUERFE)!
        .push({ id: naechsteId++, dataCategoryId: ENTWUERFE, value: JSON.stringify(sperre) });
    }
    if (fall === 'gesperrt' || fall === 'eigene') {
      // Jemand anderes (oder `eigene`: dieselbe Person 1 in einem anderen Fenster) hat die Startseite gerade offen.
      const sperre: WebsiteSperre = {
        art: 'website-sperre',
        fassung: 1,
        einheit: 'seite',
        id: start.id,
        sperre: sperreVon(
          fall === 'eigene'
            ? { person: 1, name: 'Helene Wiebe', fenster: 'anderes-fenster' }
            : { person: 2, name: 'Jonas Peters', fenster: 'anderes-fenster' },
          new Date(),
        ),
      };
      werte
        .get(ENTWUERFE)!
        .push({ id: naechsteId++, dataCategoryId: ENTWUERFE, value: JSON.stringify(sperre) });
    }
    if (fall === 'kaputt')
      werte
        .get(ENTWUERFE)!
        .push({ id: naechsteId++, dataCategoryId: ENTWUERFE, value: 'kein JSON' });
  }

  const rechte = () => ({
    churchdb: { 'administer groups': admin },
    website: {
      view: true,
      'create custom category': admin,
      'view custom data': kategorien.map((k) => k.id),
      'create custom data': [ENTWUERFE],
      'edit custom data': [ENTWUERFE],
      'delete custom data': [ENTWUERFE],
    },
  });

  const antwort = (daten: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify({ data: daten }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

  /** `?demo=wackelt`: Das erste Schreiben eines Seiteninhalts scheitert vorübergehend (wie ein 503 von ChurchTools). */
  let ausfaelle = fall === 'wackelt' ? 1 : 0;

  window.fetch = (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const pfad = url.pathname.replace(/^.*\/api/, '');
    const method = init?.method ?? 'GET';
    if (fall === 'fehler' && pfad === '/custommodules') return antwort(null, 502);
    if (pfad === '/csrftoken') return antwort('demo-csrf');
    if (pfad === '/whoami') return antwort({ id: 1, firstName: 'Helene', lastName: 'Wiebe' });
    if (pfad === '/persons/1/groups')
      return antwort(
        fall === 'leitung' || fall === 'mitglied'
          ? [
              {
                group: { domainIdentifier: String(GRUPPE), title: 'Website' },
                groupTypeRoleId: fall === 'leitung' ? 2 : 3,
                groupMemberStatus: 'active',
                memberEndDate: null,
              },
            ]
          : [],
      );
    if (pfad === '/group/roles')
      return antwort([
        { id: 2, isLeader: true },
        { id: 3, isLeader: false },
      ]);
    if (pfad === '/info') return antwort({ shortName: 'Demo-Gemeinde' });
    if (pfad === '/config') return antwort({});
    if (pfad === '/permissions/global') return antwort(rechte());
    if (pfad === '/groups')
      return antwort([
        { id: 3, name: 'Gottesdienstteam' },
        { id: GRUPPE, name: 'Website' },
        { id: 9, name: 'Jugend' },
      ]);
    if (pfad === '/custommodules') return antwort([{ id: MODUL, shorty: 'website' }]);
    if (pfad === '/calendars')
      return antwort([
        { id: 1, name: 'Gemeindeveranstaltungen' },
        { id: 2, name: 'Jugend' },
      ]);
    if (pfad === `/custommodules/${MODUL}/customdatacategories`) {
      if (method === 'POST' && typeof init?.body === 'string') {
        const k = JSON.parse(init.body) as { shorty: string; name: string };
        kategorien.push({ id: ENTWUERFE + kategorien.length, shorty: k.shorty, name: k.name });
        return antwort(kategorien.at(-1), 201);
      }
      return antwort(kategorien);
    }
    const wertePfad =
      /^\/custommodules\/\d+\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
        pfad,
      );
    if (wertePfad) {
      const kat = Number(wertePfad[1]);
      const liste = werte.get(kat) ?? [];
      const rumpf =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as { value: string }) : null;
      if (
        ausfaelle > 0 &&
        (method === 'POST' || method === 'PUT') &&
        rumpf?.value.includes('"art":"website-teil"')
      ) {
        ausfaelle--;
        return antwort(null, 503);
      }
      if (method === 'POST' && rumpf) {
        liste.push({ id: naechsteId++, dataCategoryId: kat, value: rumpf.value });
        werte.set(kat, liste);
        return antwort(liste.at(-1), 201);
      }
      if (method === 'PUT' && rumpf) {
        const w = liste.find((x) => x.id === Number(wertePfad[2]));
        if (!w) return antwort(null, 404);
        w.value = rumpf.value;
        return antwort(w);
      }
      if (method === 'DELETE') {
        const i = liste.findIndex((x) => x.id === Number(wertePfad[2]));
        if (i < 0) return antwort(null, 404);
        liste.splice(i, 1);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return antwort(liste);
    }
    // Nichts geht ins Netz: Was hier nicht bekannt ist, bekommt 404 – und wird genannt, damit es auffällt.
    console.warn('Demo: unbekannte Anfrage', method, pfad);
    return antwort(null, 404);
  };
}
