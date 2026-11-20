import { Fragment, useState } from 'react';
import { AnsichtWahl } from '@ui/bedienung/AnsichtWahl';
import { FilterKnopf } from '@ui/bedienung/FilterKnopf';
import { KlickZeile } from '@ui/bedienung/KlickZeile';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { Werkzeugzeile } from '@ui/bedienung/Werkzeugzeile';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { Icon } from '@ui/icons/icons';
import { ctBasis } from '@ui/ct/basis';
import type { Hinweis, Veranstaltung } from '@shared/anmeldung/uebersicht';
import {
  aufmerksamkeitEtiketten,
  aufmerksamkeitZaehlen,
  brauchenDichText,
  zaehlText,
} from '@shared/anmeldung/nachweisStand';
import type { Start } from './start';
import type { Uebersicht } from './veranstaltungen';
import type { Aenderung } from './Rueckgaengig';
import { EinrichtenFenster } from './EinrichtenFenster';
import { EndgueltigLoeschenFenster } from './EndgueltigLoeschenFenster';
import { insArchiv } from './archiv';
import { STATUS } from './einrichten';
import { fehlerMeldung } from './zustand';
import type { NachweisEinstiegDaten } from './nachweisArten';
import { personenMitStand } from './nachweisPersonen';
import type { NachweisFilter } from './NachweisSeite';
import { Etikett } from '@ui/bedienung/Etikett';
import { STAND_TEXT, anzahlText, datumText, kachel, monatTitel, schlussText } from './anzeige';
import styles from './Startseite.module.scss';
import f from './Formular.module.scss';

/**
 * **Die Startseite der Anmeldungen** (A2, #480) – wie im Entwurf: links „Braucht deine Aufmerksamkeit“
 * und die Veranstaltungen, rechts „Deine Gruppen“. In A2 nur lesen: Wer etwas ändern will, springt über
 * „In ChurchTools“ zur Gruppe; Anlegen, Freigeben und Bearbeiten kommen mit A3.
 */

type Reiter = 'anstehend' | 'entwuerfe' | 'vorbei';

interface Props {
  start: Start;
  uebersicht: Uebersicht;
  heute: string;
  zeitzone: string;
  /** Eine Veranstaltung zum Einrichten öffnen (A3). */
  onOeffnen: (id: number) => void;
  /** Zum Archiv der gelöschten Veranstaltungen (A4-Nachtrag); fehlt, wenn es die Gruppenart nicht gibt. */
  onArchiv?: () => void;
  /** Zur Seite „Nachweise“ (N1b), mit der Ansicht (N2a: „Braucht Aufmerksamkeit“); fehlt, wenn die Person sie nicht sehen darf. */
  onNachweise?: (filter: NachweisFilter) => void;
  /** Der Stand der Nachweise (N2a): ohne ihn (nicht lesbar) bleibt die Karte wie in N1b, ohne Zahlen. */
  nachweise?: NachweisEinstiegDaten;
  /** Gruppen-Admin: darf jede Veranstaltung freigeben (A5). */
  admin?: boolean;
  /** Nach einer Änderung von hier aus (A9-4: endgültig gelöscht, ins Archiv) – meldet sie und lädt neu. */
  onGeaendert?: (a: Aenderung) => void;
}

function gruppenUrl(id: number): string {
  return `${ctBasis()}/groups/${id}`;
}

function Kachel({ tag, grau }: { tag: string | null; grau?: boolean }) {
  if (!tag) {
    return (
      <span className={`${styles.kachel} ${styles.kachelGrau}`} aria-hidden="true">
        <Icon name="calendar" size={18} />
      </span>
    );
  }
  const k = kachel(tag);
  return (
    <span className={`${styles.kachel}${grau ? ' ' + styles.kachelGrau : ''}`} aria-hidden="true">
      <b>{k.tag}</b>
      <small>{k.monat}</small>
    </span>
  );
}

/**
 * Führt eine Zeile nach ChurchTools, steht das klein dabei (E24) – die Zeile selbst ist der Link
 * (`KlickZeile href`), kein eigener Knopf daneben.
 */
function NachCt() {
  return (
    <small className={styles.nachCt}>
      in ChurchTools <Icon name="external" size={12} />
    </small>
  );
}

/**
 * Ab so vielen Veranstaltungen ohne Abläufe steht auf der Startseite eine Zeile für alle (Alwin, 05.11.2026 – in der
 * Test-Instanz waren es acht, „Braucht deine Aufmerksamkeit“ lief damit voll). Aufgeklappt stehen sie einzeln da.
 */
const EINRICHTEN_ZUSAMMEN = 3;

function EinrichtenSammelZeile({
  anzahl,
  offen,
  onUmschalten,
}: {
  anzahl: number;
  offen: boolean;
  onUmschalten: () => void;
}) {
  return (
    <KlickZeile
      className={styles.zeile}
      onClick={onUmschalten}
      ariaExpanded={offen}
      pfeil={offen ? 'auf' : 'zu'}
    >
      <Kachel tag={null} grau />
      <div className={styles.mitte}>
        <b>{anzahl} Veranstaltungen: Mails und Löschen einrichten</b>
        <small>Bisher löscht ChurchTools ihre Anmeldungen nie.</small>
      </div>
    </KlickZeile>
  );
}

function HinweisZeile({
  h,
  gruppenName,
  onOeffnen,
  admin,
  darfArchivieren,
  onEndgueltig,
  onInsArchiv,
  onEinrichten,
}: {
  h: Hinweis;
  gruppenName: (id: number) => string;
  onOeffnen: (id: number) => void;
  admin: boolean;
  /** Leitung der Gruppe oder Admin – nur sie dürfen in ChurchTools archivieren (gemessen 13.10.2026). */
  darfArchivieren: (gruppeId: number) => boolean;
  onEndgueltig: (v: Veranstaltung) => void;
  onInsArchiv: (v: Veranstaltung) => void;
  onEinrichten: (v: Veranstaltung) => void;
}) {
  if (h.art === 'kaputt') {
    return (
      <KlickZeile className={styles.zeile} href={gruppenUrl(h.id)}>
        <Kachel tag={null} grau />
        <div className={styles.mitte}>
          <b>{h.name}</b>
          <span className={styles.chips}>
            <Etikett ton="rot">Einstellungen lassen sich nicht lesen</Etikett>
            <NachCt />
          </span>
          <small>
            {gruppenName(h.gruppeId)} · Die Beschreibung der Gruppe wurde wohl in ChurchTools
            geändert. Bis das behoben ist, fehlt die Veranstaltung in der Liste.
          </small>
        </div>
      </KlickZeile>
    );
  }
  const v = h.v;
  if (h.art === 'endgueltig') {
    // A9-4 (D3, D4, D8): Wer darf, löscht gleich; die Leitung ohne Recht legt ins Archiv, dort löscht ein Admin.
    const archiv = !h.darf && darfArchivieren(v.gruppeId);
    const inhalt = (
      <>
        <Kachel tag={v.tag} grau />
        <div className={styles.mitte}>
          <b>{v.name}</b>
          <span className={styles.chips}>
            <Etikett ton="rot">Anmeldungen gelöscht</Etikett>
            {!h.darf && !archiv && <NachCt />}
          </span>
          <small>
            Seit dem {datumText(h.seit)} – die Antworten stehen aber noch im Verlauf der Gruppe.{' '}
            {h.darf ? 'Jetzt endgültig löschen?' : 'Endgültig löschen kann ein Admin – im Archiv.'}
          </small>
        </div>
      </>
    );
    // „Endgültig löschen“ fragt im Fenster nach (Namen eintippen) – die ganze Zeile darf es öffnen. „Ins Archiv“ legt
    // sofort ab (mit „Rückgängig“): Das bleibt ein eigener, stiller Knopf, damit ein Fehlklick auf die Zeile nichts tut.
    if (h.darf)
      return (
        <KlickZeile className={styles.zeile} onClick={() => onEndgueltig(v)}>
          {inhalt}
        </KlickZeile>
      );
    if (archiv)
      return (
        <div className={styles.zeile}>
          {inhalt}
          <TextKnopf onClick={() => onInsArchiv(v)}>Ins Archiv</TextKnopf>
        </div>
      );
    return (
      <KlickZeile className={styles.zeile} href={gruppenUrl(v.id)}>
        {inhalt}
      </KlickZeile>
    );
  }
  if (h.art === 'einrichten') {
    // A9-5 (F1, F3): für alle in der Gruppe; wer Routinen verwalten darf, öffnet gleich die Rückfrage, alle anderen die Veranstaltung.
    return (
      <KlickZeile
        className={styles.zeile}
        onClick={() => (h.darf ? onEinrichten(v) : onOeffnen(v.id))}
      >
        <Kachel tag={v.tag} grau={v.phase === 'vorbei'} />
        <div className={styles.mitte}>
          <b>{v.name}: Mails und Löschen einrichten</b>
          <small>
            Bisher löscht ChurchTools die Anmeldungen nie.
            {!h.darf && ' Einrichten kann, wer in ChurchTools Routinen verwalten darf.'}
          </small>
        </div>
      </KlickZeile>
    );
  }
  const text =
    h.art === 'freigabe'
      ? {
          etikett: <Etikett ton="blau">wartet auf Freigabe</Etikett>,
          // Admins dürfen jede freigeben (A3-Abnahme: Alwin las „kann die Leitung“, obwohl er selbst darf).
          zeile: h.darfFreigeben
            ? `${gruppenName(v.gruppeId)} · Freigeben kannst du als Leitung der Gruppe.`
            : admin
              ? `${gruppenName(v.gruppeId)} · Freigeben kannst du als Admin.`
              : `${gruppenName(v.gruppeId)} · Freigeben kann die Leitung der Gruppe.`,
        }
      : h.art === 'nachruecken'
        ? {
            etikett: (
              <Etikett ton="blau">
                {h.frei === null ? 'Plätze frei' : `${anzahlText(h.frei, 'Platz', 'Plätze')} frei`}
              </Etikett>
            ),
            zeile: `${anzahlText(h.wartend, 'Person wartet', 'Personen warten')} auf der Warteliste. Wer rückt nach?`,
          }
        : {
            etikett: (
              <Etikett ton="rot">{anzahlText(h.offen, 'Zahlung', 'Zahlungen')} offen</Etikett>
            ),
            zeile: 'In der Liste „bezahlt“ abhaken, sobald das Geld da ist.',
          };
  const inhalt = (
    <>
      <Kachel tag={v.tag} />
      <div className={styles.mitte}>
        <b>{v.name}</b>
        <span className={styles.chips}>
          {text.etikett}
          {h.art !== 'freigabe' && <NachCt />}
        </span>
        <small>{text.zeile}</small>
      </div>
    </>
  );
  return h.art === 'freigabe' ? (
    <KlickZeile className={styles.zeile} onClick={() => onOeffnen(v.id)}>
      {inhalt}
    </KlickZeile>
  ) : (
    // Nachrücken und Zahlungen gehen bis zur Anmeldungsliste (A7) in ChurchTools.
    <KlickZeile className={styles.zeile} href={gruppenUrl(v.id)}>
      {inhalt}
    </KlickZeile>
  );
}

function Belegung({ v }: { v: Veranstaltung }) {
  if (v.phase === 'entwurf' || !v.belegung) {
    return v.maxPlaetze !== null ? (
      <span className={styles.fuellung}>{anzahlText(v.maxPlaetze, 'Platz', 'Plätze')}</span>
    ) : null;
  }
  const { aktiv } = v.belegung;
  if (v.maxPlaetze === null) {
    return <span className={styles.fuellung}>{aktiv} angemeldet</span>;
  }
  const prozent = Math.min(100, Math.round((aktiv / Math.max(1, v.maxPlaetze)) * 100));
  return (
    <span className={styles.fuellung}>
      <span>
        <b>{aktiv}</b> / {v.maxPlaetze} angemeldet
      </span>
      <span className={`${styles.balken}${aktiv >= v.maxPlaetze ? ' ' + styles.voll : ''}`}>
        <i style={{ width: `${prozent}%` }} />
      </span>
    </span>
  );
}

function VeranstaltungZeile({
  v,
  gruppenName,
  heute,
  zeitzone,
  onOeffnen,
}: {
  v: Veranstaltung;
  gruppenName: (id: number) => string;
  heute: string;
  zeitzone: string;
  onOeffnen: (id: number) => void;
}) {
  const teile = [v.tag ? datumText(v.tag) : 'Datum folgt', gruppenName(v.gruppeId), v.preis];
  const schluss = schlussText(v, heute, zeitzone);
  const wartend = v.belegung?.wartend ?? 0;
  return (
    // Die ganze Zeile öffnet die Veranstaltung (E24). „In ChurchTools“ steht dort im Kopf – ein Klick weiter.
    <KlickZeile className={styles.zeile} onClick={() => onOeffnen(v.id)}>
      <Kachel tag={v.tag} grau={v.phase === 'vorbei'} />
      <div className={styles.mitte}>
        <b>{v.name}</b>
        <small>{teile.join(' · ')}</small>
        <span className={styles.chips}>
          {v.phase === 'entwurf' && <Etikett>Entwurf</Etikett>}
          {v.anmeldung && (
            <Etikett
              ton={v.anmeldung === 'offen' ? 'gruen' : v.anmeldung === 'voll' ? 'rot' : 'neutral'}
            >
              {STAND_TEXT[v.anmeldung]}
            </Etikett>
          )}
          {schluss && <small>{schluss}</small>}
          {wartend > 0 && <small>{wartend} auf der Warteliste</small>}
          {v.termin?.ort && <small>{v.termin.ort}</small>}
        </span>
      </div>
      <Belegung v={v} />
    </KlickZeile>
  );
}

export function Startseite({
  start,
  uebersicht,
  heute,
  zeitzone,
  onOeffnen,
  onArchiv,
  onNachweise,
  nachweise,
  admin = false,
  onGeaendert = () => {},
}: Props) {
  const [reiter, setReiter] = useState<Reiter>('anstehend');
  const handy = useMedienAbfrage(HANDY_BREITE);
  const [loeschen, setLoeschen] = useState<Veranstaltung | null>(null);
  const [einrichten, setEinrichten] = useState<Veranstaltung | null>(null);
  const [einrichtenOffen, setEinrichtenOffen] = useState(false);
  const [hinweisFehler, setHinweisFehler] = useState<string | null>(null);
  const leitung = new Set(start.gruppen.filter((g) => g.leitung).map((g) => g.id));
  const darfArchivieren = (gruppeId: number) => admin || leitung.has(gruppeId);
  async function insArchivLegen(v: Veranstaltung) {
    setHinweisFehler(null);
    try {
      // Abgelaufen heißt freigegeben (Status 1) – „Rückgängig“ holt sie samt Abläufen zurück.
      onGeaendert(await insArchiv(v.id, v.name, STATUS.freigegeben));
    } catch (e) {
      setHinweisFehler(`„${v.name}“: ${fehlerMeldung(e).text}`);
    }
  }
  const [auswahl, setAuswahl] = useState<Set<number>>(
    () => new Set(start.gruppen.map((g) => g.id)),
  );

  const namen = new Map(start.gruppen.map((g) => [g.id, g.name]));
  const gruppenName = (id: number) => namen.get(id) ?? 'Gruppe';
  const { einteilung, hinweise } = uebersicht;
  const liste = einteilung[reiter].filter((v) => auswahl.has(v.gruppeId));

  // Monatsüberschriften: eine je Monat, in der Reihenfolge der Liste.
  const monate: { titel: string; eintraege: Veranstaltung[] }[] = [];
  for (const v of liste) {
    const titel = monatTitel(v.tag);
    const letzter = monate[monate.length - 1];
    if (letzter?.titel === titel) letzter.eintraege.push(v);
    else monate.push({ titel, eintraege: [v] });
  }

  // Gruppen im Filter („Gruppen“): ausgeschaltet sind die, die nicht in der Auswahl stehen.
  const gruppenAus = start.gruppen.filter((g) => !auswahl.has(g.id)).map((g) => String(g.id));

  // Nachweise (N2a): je Art, die ich sehen darf, mit dem Stand für heute.
  const nachweisArten = (nachweise?.arten ?? []).flatMap((a) => {
    const personen = personenMitStand(a, heute);
    return personen ? [{ art: a, staende: personen.map((p) => p.stand) }] : [];
  });
  const nachweisFaelle = nachweisArten
    .map((k) => ({ ...k, auf: aufmerksamkeitZaehlen(k.staende) }))
    .filter((k) => k.auf.summe > 0);
  const zahlAufmerksam = hinweise.length + nachweisFaelle.length;

  const zahlEinrichten = hinweise.filter((h) => h.art === 'einrichten').length;
  const sammeln = zahlEinrichten >= EINRICHTEN_ZUSAMMEN;
  const zeile = (h: Hinweis) => (
    <HinweisZeile
      key={`${h.art}-${h.art === 'kaputt' ? h.id : h.v.id}`}
      h={h}
      gruppenName={gruppenName}
      onOeffnen={onOeffnen}
      admin={admin}
      darfArchivieren={darfArchivieren}
      onEndgueltig={setLoeschen}
      onEinrichten={setEinrichten}
      onInsArchiv={(v) => void insArchivLegen(v)}
    />
  );

  return (
    <div className={styles.raster}>
      <div className={styles.spalte}>
        {zahlAufmerksam > 0 && (
          <section className={styles.karte} aria-labelledby="aufmerksamkeit">
            <div className={styles.kopf}>
              <h2 id="aufmerksamkeit">Braucht deine Aufmerksamkeit</h2>
              <span className={styles.leise}>{zahlAufmerksam}</span>
            </div>
            <div className={styles.liste}>
              {hinweise.map((h, i) => {
                // Viele ohne Abläufe: an der Stelle der ersten eine Sammelzeile; aufgeklappt stehen alle gleich darunter –
                // nicht verstreut zwischen den anderen Hinweisen (echte Prüfung 05.11.2026).
                if (h.art !== 'einrichten' || !sammeln) return zeile(h);
                if (hinweise.findIndex((x) => x.art === 'einrichten') !== i) return null;
                return (
                  <Fragment key="einrichten-alle">
                    <EinrichtenSammelZeile
                      anzahl={zahlEinrichten}
                      offen={einrichtenOffen}
                      onUmschalten={() => setEinrichtenOffen((x) => !x)}
                    />
                    {einrichtenOffen && hinweise.filter((x) => x.art === 'einrichten').map(zeile)}
                  </Fragment>
                );
              })}
              {onNachweise &&
                nachweisFaelle.map((k) => (
                  <KlickZeile
                    key={`nachweis-${k.art.id}`}
                    className={styles.zeile}
                    onClick={() => onNachweise('aufmerksam')}
                  >
                    <span className={`${styles.kachel} ${styles.kachelGrau}`} aria-hidden="true">
                      <Icon name="kreis-haken" size={18} />
                    </span>
                    <div className={styles.mitte}>
                      <b>{k.art.name}</b>
                      <span className={styles.chips}>
                        {aufmerksamkeitEtiketten(k.auf).map((e) => (
                          <Etikett key={e.text} ton={e.ton}>
                            {e.text}
                          </Etikett>
                        ))}
                      </span>
                      <small>{brauchenDichText(k.auf.summe)}</small>
                    </div>
                  </KlickZeile>
                ))}
            </div>
            {hinweisFehler && (
              <p className={f.fehler} role="alert">
                {hinweisFehler}
              </p>
            )}
          </section>
        )}

        <section className={styles.karte} aria-labelledby="veranstaltungen">
          <div className={styles.kopf}>
            <h2 id="veranstaltungen">Veranstaltungen</h2>
          </div>
          <div className={styles.werkzeuge}>
            <Werkzeugzeile
              handy={handy}
              ariaLabel="Veranstaltungen"
              links={
                <AnsichtWahl<Reiter>
                  ariaLabel="Auswahl"
                  value={reiter}
                  onChange={setReiter}
                  handy={handy}
                  options={[
                    { value: 'anstehend', label: 'Anstehend', anzahl: einteilung.anstehend.length },
                    { value: 'entwuerfe', label: 'Entwürfe', anzahl: einteilung.entwuerfe.length },
                    { value: 'vorbei', label: 'Vorbei', anzahl: einteilung.vorbei.length },
                  ]}
                />
              }
              rechts={
                <FilterKnopf
                  still
                  abschnitte={[
                    {
                      titel: 'Gruppen',
                      optionen: start.gruppen.map((g) => ({ wert: String(g.id), text: g.name })),
                      aus: gruppenAus,
                      onAus: (aus) =>
                        setAuswahl(
                          new Set(
                            start.gruppen
                              .filter((g) => !aus.includes(String(g.id)))
                              .map((g) => g.id),
                          ),
                        ),
                    },
                  ]}
                />
              }
            />
          </div>
          <div className={styles.liste}>
            {start.gruppen.length === 0 ? (
              <div className={styles.leer}>
                <b>Hier sind noch keine Veranstaltungen für dich.</b>
                <span className={styles.leise}>
                  Jede Veranstaltung gehört zu einer ChurchTools-Gruppe. Du siehst die
                  Veranstaltungen der Gruppen, in denen du Mitglied bist. Fehlt dir eine Gruppe,
                  frag deren Leitung.
                </span>
              </div>
            ) : liste.length === 0 ? (
              <div className={styles.leer}>
                <span className={styles.leise}>
                  {reiter === 'entwuerfe'
                    ? 'Keine Entwürfe.'
                    : reiter === 'vorbei'
                      ? 'Noch nichts vorbei.'
                      : 'Keine anstehenden Veranstaltungen für diese Auswahl.'}
                </span>
              </div>
            ) : (
              monate.map((m) => (
                <div key={m.titel}>
                  <div className={styles.monat}>{m.titel}</div>
                  {m.eintraege.map((v) => (
                    <VeranstaltungZeile
                      key={v.id}
                      v={v}
                      gruppenName={gruppenName}
                      heute={heute}
                      zeitzone={zeitzone}
                      onOeffnen={onOeffnen}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </section>
        <p className={styles.fussnote}>
          Welche Veranstaltungen du siehst, entscheidet ChurchTools: die deiner Gruppen. Bearbeiten
          und freigeben darf die Leitung der Gruppe.
          {onArchiv && (
            <>
              {' '}
              <button type="button" className={styles.titelKnopf} onClick={onArchiv}>
                Gelöschte Veranstaltungen (Archiv)
              </button>
            </>
          )}
        </p>
      </div>

      <div className={styles.spalte}>
        <section className={styles.karte} aria-labelledby="deine-gruppen">
          <div className={styles.kopf}>
            <h2 id="deine-gruppen">Deine Gruppen</h2>
          </div>
          <ul className={styles.liste}>
            {start.gruppen.length === 0 && (
              <li className={styles.zeile}>
                <span className={styles.leise}>
                  Du bist in keiner Gruppe. Veranstaltungen gehören immer zu einer Gruppe – frag die
                  Verantwortlichen deiner Gemeinde, wenn du Anmeldungen anlegen möchtest.
                </span>
              </li>
            )}
            {start.gruppen.map((g) => {
              const n = uebersicht.offen.get(g.id) ?? 0;
              const verborgen = uebersicht.verborgen.get(g.id) ?? 0;
              return (
                <li key={g.id} className={styles.zeile}>
                  <span className={`${styles.kachel} ${styles.kachelGrau}`} aria-hidden="true">
                    <Icon name="people" size={18} />
                  </span>
                  <div className={styles.mitte}>
                    <b>{g.name}</b>
                    <small>
                      {n > 0 ? anzahlText(n, 'Veranstaltung', 'Veranstaltungen') : 'nichts geplant'}
                      {verborgen > 0 && ' · Untergruppen für dich nicht freigegeben'}
                    </small>
                  </div>
                  <Etikett ton={g.leitung ? 'blau' : 'neutral'}>
                    {g.leitung ? 'Leitung' : 'Mitglied'}
                  </Etikett>
                </li>
              );
            })}
          </ul>
          <p className={styles.hinweis}>
            Alle in der Gruppe: Anmeldungen bearbeiten (bezahlt, nachrücken, absagen). Die Leitung
            ändert außerdem Eckdaten, Preise, Formular und Gestaltung und gibt frei.
          </p>
        </section>
        {onNachweise && (
          <section className={styles.karte} aria-labelledby="nachweise-karte">
            <div className={styles.kopf}>
              <h2 id="nachweise-karte">Nachweise</h2>
            </div>
            <ul className={styles.liste}>
              {nachweisArten.length === 0 ? (
                <li>
                  <KlickZeile className={styles.zeile} onClick={() => onNachweise('alle')}>
                    <span className={`${styles.kachel} ${styles.kachelGrau}`} aria-hidden="true">
                      <Icon name="kreis-haken" size={18} />
                    </span>
                    <div className={styles.mitte}>
                      <b>Führungszeugnis &amp; Co.</b>
                      <small>Nachweis-Arten ansehen und einrichten</small>
                    </div>
                  </KlickZeile>
                </li>
              ) : (
                nachweisArten.map((k) => (
                  <li key={k.art.id}>
                    <KlickZeile className={styles.zeile} onClick={() => onNachweise('alle')}>
                      <span className={`${styles.kachel} ${styles.kachelGrau}`} aria-hidden="true">
                        <Icon name="kreis-haken" size={18} />
                      </span>
                      <div className={styles.mitte}>
                        <b>{k.art.name}</b>
                        <small>{zaehlText(k.staende)}</small>
                      </div>
                    </KlickZeile>
                  </li>
                ))
              )}
            </ul>
          </section>
        )}
      </div>
      {einrichten && (
        <EinrichtenFenster
          id={einrichten.id}
          name={einrichten.name}
          onClose={() => setEinrichten(null)}
          onEingerichtet={(text) => {
            onGeaendert({ text: `„${einrichten.name}“: ${text}`, rueckgaengig: null });
            setEinrichten(null);
          }}
        />
      )}
      {loeschen && (
        <EndgueltigLoeschenFenster
          id={loeschen.id}
          name={loeschen.name}
          ohneAnmeldungen
          onClose={() => setLoeschen(null)}
          onGeloescht={() => {
            onGeaendert({
              text: `„${loeschen.name}“ wurde endgültig gelöscht.`,
              rueckgaengig: null,
            });
            setLoeschen(null);
          }}
        />
      )}
    </div>
  );
}
