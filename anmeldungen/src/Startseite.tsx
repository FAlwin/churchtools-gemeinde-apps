import { useState } from 'react';
import { Segment } from '@ui/bedienung/Segment';
import { Icon } from '@ui/icons/icons';
import { ctBasis } from '@ui/ct/basis';
import type { Hinweis, Veranstaltung } from '@shared/anmeldung/uebersicht';
import type { Start } from './start';
import type { Uebersicht } from './veranstaltungen';
import { STAND_TEXT, anzahlText, datumText, kachel, monatTitel, schlussText } from './anzeige';
import styles from './Startseite.module.scss';

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

function HinweisZeile({
  h,
  gruppenName,
  onOeffnen,
}: {
  h: Hinweis;
  gruppenName: (id: number) => string;
  onOeffnen: (id: number) => void;
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
  const text =
    h.art === 'freigabe'
      ? {
          titel: `${v.name} wartet auf Freigabe`,
          zeile: h.darfFreigeben
            ? `${gruppenName(v.gruppeId)} · Freigeben kannst du als Leitung der Gruppe.`
            : `${gruppenName(v.gruppeId)} · Freigeben kann die Leitung der Gruppe.`,
        }
      : h.art === 'nachruecken'
        ? {
            titel: `${v.name}: ${anzahlText(h.frei, 'Platz', 'Plätze')} frei`,
            zeile: `${anzahlText(h.wartend, 'Anmeldung wartet', 'Anmeldungen warten')} auf der Warteliste. Wer rückt nach?`,
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
        <button type="button" className={styles.oeffnen} onClick={() => onOeffnen(v.id)}>
          Ansehen
        </button>
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

export function Startseite({ start, uebersicht, heute, zeitzone, onOeffnen, onArchiv }: Props) {
  const [reiter, setReiter] = useState<Reiter>('anstehend');
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
              {hinweise.map((h) => (
                <HinweisZeile
                  key={`${h.art}-${h.art === 'kaputt' ? h.id : h.v.id}`}
                  h={h}
                  gruppenName={gruppenName}
                  onOeffnen={onOeffnen}
                />
              ))}
            </div>
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
    </div>
  );
}
