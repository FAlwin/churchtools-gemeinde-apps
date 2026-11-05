import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Fragment, useState } from 'react';
import { Segment } from '@ui/bedienung/Segment';
import { Icon } from '@ui/icons/icons';
import { ctBasis } from '@ui/ct/basis';
import type { Hinweis, Veranstaltung } from '@shared/anmeldung/uebersicht';
import type { Start } from './start';
import type { Uebersicht } from './veranstaltungen';
import type { Aenderung } from './Rueckgaengig';
import { EinrichtenFenster } from './EinrichtenFenster';
import { EndgueltigLoeschenFenster } from './EndgueltigLoeschenFenster';
import { insArchiv } from './archiv';
import { STATUS } from './einrichten';
import { fehlerMeldung } from './zustand';
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

function ZurGruppe({
  id,
  name,
  text = 'In ChurchTools',
}: {
  id: number;
  name: string;
  text?: string;
}) {
  return (
    // Schmal nur das Symbol; für Screenreader steht dran, WOHIN es geht – drei gleiche „Öffnen“ helfen nicht.
    <a className={styles.link} href={gruppenUrl(id)} aria-label={`${name} in ChurchTools öffnen`}>
      <span className={styles.linkText}>{text}</span>
      <Icon name="external" size={14} />
    </a>
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
    <div className={styles.zeile}>
      <Kachel tag={null} grau />
      <div className={styles.mitte}>
        <b>{anzahl} Veranstaltungen: Mails und Löschen einrichten</b>
        <small>Bisher löscht ChurchTools ihre Anmeldungen nie.</small>
      </div>
      <FensterKnopf art="zweit" aria-expanded={offen} onClick={onUmschalten}>
        {offen ? 'Ausblenden' : 'Anzeigen'}
      </FensterKnopf>
    </div>
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
      <div className={styles.zeile}>
        <Kachel tag={null} grau />
        <div className={styles.mitte}>
          <b>{h.name}: Einstellungen lassen sich nicht lesen</b>
          <small>
            {gruppenName(h.gruppeId)} · Die Beschreibung der Gruppe wurde wohl in ChurchTools
            geändert. Bis das behoben ist, fehlt die Veranstaltung in der Liste.
          </small>
        </div>
        <ZurGruppe id={h.id} name={h.name} />
      </div>
    );
  }
  const v = h.v;
  if (h.art === 'endgueltig') {
    // A9-4 (D3, D4, D8): Wer darf, löscht gleich; die Leitung ohne Recht legt ins Archiv, dort löscht ein Admin.
    const archiv = !h.darf && darfArchivieren(v.gruppeId);
    return (
      <div className={styles.zeile}>
        <Kachel tag={v.tag} grau />
        <div className={styles.mitte}>
          <b>{v.name}: Anmeldungen gelöscht</b>
          <small>
            Seit dem {datumText(h.seit)} – die Antworten stehen aber noch im Verlauf der Gruppe.{' '}
            {h.darf ? 'Jetzt endgültig löschen?' : 'Endgültig löschen kann ein Admin – im Archiv.'}
          </small>
        </div>
        {h.darf ? (
          <FensterKnopf art="loeschen" onClick={() => onEndgueltig(v)}>
            Endgültig löschen
          </FensterKnopf>
        ) : archiv ? (
          <FensterKnopf art="zweit" onClick={() => onInsArchiv(v)}>
            Ins Archiv
          </FensterKnopf>
        ) : (
          <ZurGruppe id={v.id} name={v.name} />
        )}
      </div>
    );
  }
  if (h.art === 'einrichten')
    // A9-5 (F1, F3): für alle in der Gruppe; den Knopf hat, wer Routinen verwalten darf – er öffnet gleich die Rückfrage.
    return (
      <div className={styles.zeile}>
        <Kachel tag={v.tag} grau={v.phase === 'vorbei'} />
        <div className={styles.mitte}>
          <b>{v.name}: Mails und Löschen einrichten</b>
          <small>
            Bisher löscht ChurchTools die Anmeldungen nie.
            {!h.darf && ' Einrichten kann, wer in ChurchTools Routinen verwalten darf.'}
          </small>
        </div>
        {h.darf ? (
          <FensterKnopf art="zweit" onClick={() => onEinrichten(v)}>
            Einrichten
          </FensterKnopf>
        ) : (
          <FensterKnopf art="zweit" onClick={() => onOeffnen(v.id)}>
            Ansehen
          </FensterKnopf>
        )}
      </div>
    );
  const text =
    h.art === 'freigabe'
      ? {
          titel: `${v.name} wartet auf Freigabe`,
          // Admins dürfen jede freigeben (A3-Abnahme: Alwin las „kann die Leitung“, obwohl er selbst darf).
          zeile: h.darfFreigeben
            ? `${gruppenName(v.gruppeId)} · Freigeben kannst du als Leitung der Gruppe.`
            : admin
              ? `${gruppenName(v.gruppeId)} · Freigeben kannst du als Admin.`
              : `${gruppenName(v.gruppeId)} · Freigeben kann die Leitung der Gruppe.`,
        }
      : h.art === 'nachruecken'
        ? {
            titel:
              h.frei === null
                ? `${v.name}: Plätze frei`
                : `${v.name}: ${anzahlText(h.frei, 'Platz', 'Plätze')} frei`,
            zeile: `${anzahlText(h.wartend, 'Person wartet', 'Personen warten')} auf der Warteliste. Wer rückt nach?`,
          }
        : {
            titel: `${v.name}: ${anzahlText(h.offen, 'Zahlung', 'Zahlungen')} offen`,
            zeile: 'In der Liste „bezahlt“ abhaken, sobald das Geld da ist.',
          };
  return (
    <div className={styles.zeile}>
      <Kachel tag={v.tag} />
      <div className={styles.mitte}>
        <b>{text.titel}</b>
        <small>{text.zeile}</small>
      </div>
      {h.art === 'freigabe' ? (
        <FensterKnopf art="zweit" onClick={() => onOeffnen(v.id)}>
          Ansehen
        </FensterKnopf>
      ) : (
        // Nachrücken und Zahlungen gehen bis zur Anmeldungsliste (A7) in ChurchTools.
        <ZurGruppe id={v.id} name={v.name} />
      )}
    </div>
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
    <div className={styles.zeile}>
      <Kachel tag={v.tag} grau={v.phase === 'vorbei'} />
      <div className={styles.mitte}>
        <button type="button" className={styles.titelKnopf} onClick={() => onOeffnen(v.id)}>
          {v.name}
        </button>
        <small>{teile.join(' · ')}</small>
        <span className={styles.chips}>
          {v.phase === 'entwurf' && <span className={styles.chip}>Entwurf</span>}
          {v.anmeldung && (
            <span
              className={`${styles.chip}${v.anmeldung === 'offen' ? ' ' + styles.chipGruen : ''}${v.anmeldung === 'voll' ? ' ' + styles.chipRot : ''}`}
            >
              {STAND_TEXT[v.anmeldung]}
            </span>
          )}
          {schluss && <small>{schluss}</small>}
          {wartend > 0 && <small>{wartend} auf der Warteliste</small>}
          {v.termin?.ort && <small>{v.termin.ort}</small>}
        </span>
      </div>
      <Belegung v={v} />
      <ZurGruppe id={v.id} name={v.name} />
    </div>
  );
}

export function Startseite({
  start,
  uebersicht,
  heute,
  zeitzone,
  onOeffnen,
  onArchiv,
  admin = false,
  onGeaendert = () => {},
}: Props) {
  const [reiter, setReiter] = useState<Reiter>('anstehend');
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

  const zaehler = (r: Reiter, text: string) => (
    <>
      {text}
      {einteilung[r].length > 0 && <span className={styles.zaehler}>{einteilung[r].length}</span>}
    </>
  );

  const umschalten = (id: number) =>
    setAuswahl((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });

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
        {hinweise.length > 0 && (
          <section className={styles.karte} aria-labelledby="aufmerksamkeit">
            <div className={styles.kopf}>
              <h2 id="aufmerksamkeit">Braucht deine Aufmerksamkeit</h2>
              <span className={styles.leise}>{hinweise.length}</span>
            </div>
            <div className={styles.liste}>
              {hinweise.map((h, i) => {
                // Viele ohne Abläufe: an der Stelle der ersten eine Sammelzeile, die einzelnen erst aufgeklappt.
                if (h.art === 'einrichten' && sammeln) {
                  const erste = hinweise.findIndex((x) => x.art === 'einrichten') === i;
                  if (!erste && !einrichtenOffen) return null;
                  if (erste)
                    return (
                      <Fragment key="einrichten-alle">
                        <EinrichtenSammelZeile
                          anzahl={zahlEinrichten}
                          offen={einrichtenOffen}
                          onUmschalten={() => setEinrichtenOffen((x) => !x)}
                        />
                        {einrichtenOffen && zeile(h)}
                      </Fragment>
                    );
                }
                return zeile(h);
              })}
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
            <Segment<Reiter>
              className={styles.reiter}
              ariaLabel="Auswahl"
              value={reiter}
              onChange={setReiter}
              options={[
                { value: 'anstehend', label: zaehler('anstehend', 'Anstehend') },
                { value: 'entwuerfe', label: zaehler('entwuerfe', 'Entwürfe') },
                { value: 'vorbei', label: zaehler('vorbei', 'Vorbei') },
              ]}
            />
          </div>
          {start.gruppen.length > 1 && (
            <div className={styles.filter} role="group" aria-label="Gruppen">
              <span className={styles.leise}>Gruppen</span>
              {start.gruppen.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={styles.filterChip}
                  aria-pressed={auswahl.has(g.id)}
                  onClick={() => umschalten(g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
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
                  <span className={g.leitung ? styles.rolleLeitung : styles.rolle}>
                    {g.leitung ? 'Leitung' : 'Mitglied'}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.hinweis}>
            Alle in der Gruppe: Anmeldungen bearbeiten (bezahlt, nachrücken, absagen). Die Leitung
            ändert außerdem Eckdaten, Preise, Formular und Gestaltung und gibt frei.
          </p>
        </section>
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
