import { useState, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import {
  abgelehntNoch,
  abgelehntSichtbar,
  bereichOffen,
  darfAendern,
  vorschlaegeOrdnen,
  type Vorschlag,
} from '@shared/protokolle/vorschlaege';
import { wannLang } from './anzeige';
import { Etikett } from '@ui/bedienung/Etikett';
import { useAusgeblendet, useBereichWahl } from './vorschlaegeMerken';
import styles from './Vorschlaege.module.scss';

/**
 * Was eine Vorschlag-Zeile zeigt – Vorschläge für Punkte (`Vorschlag`) und für To-Dos (W9b, `ToDoVorschlaege`) sehen gleich
 * aus und benutzen **dieselbe Zeile**. `zusatz` hängt der Aufrufer an die Kleinzeile („bis 3. Dez. · wartet auf die Leitung“).
 */
export type ZeilenDaten = Pick<
  Vorschlag,
  'id' | 'titel' | 'text' | 'von' | 'name' | 'stand' | 'grund' | 'verlauf'
> & { zusatz?: string };

/** Beschriftungen, wo ein To-Do-Vorschlag anders heißt als ein Punkt-Vorschlag. */
export interface ZeilenTexte {
  uebernehmen?: string;
  ablehnen?: string;
  /** Statt „Ohne Text.“ im aufgeklappten Vorschlag. */
  leer?: string;
}

/** Was man mit einem Vorschlag tun kann – fehlt eine Aktion, gibt es den Knopf nicht. */
export interface VorschlagAktionen<T extends ZeilenDaten = Vorschlag> {
  /** Wer vorschlug: ändern (Fenster) und zurückziehen. */
  aendern?: (v: T) => void;
  zurueckziehen?: (v: T) => Promise<void>;
  /** Die Leitung (Gruppe „Vorschlagen“): übernehmen, aufs nächste Mal, ablehnen (Fenster). */
  uebernehmen?: (v: T) => Promise<void>;
  naechstesMal?: (v: T) => Promise<void>;
  ablehnen?: (v: T) => void;
}

/** Das Schild in der Zeile: nur wo es etwas sagt – „offen“ ist der Normalfall der Liste, Übernommene stehen nicht darin. */
function standMarke(v: ZeilenDaten, direkt: boolean): ReactNode {
  if (v.stand === 'offen' && direkt) return <Etikett ton="blau">kommt ins Protokoll</Etikett>;
  if (v.stand === 'abgelehnt') {
    // Am Handy entfällt es: Die Gruppe heißt schon „Abgelehnt“ (Entwurf W8c).
    return (
      <span className={styles.nurBreit}>
        <Etikett ton="rot">abgelehnt</Etikett>
      </span>
    );
  }
  return null;
}

/**
 * **Ein Vorschlag als Zeile** (S5-4, Kurzform seit W8c): Pfeil, Titel (eine Zeile), darunter höchstens eine Zeile Text
 * und „von …“. Antippen klappt auf: ganzer Text und die Knöpfe – **nur dort**. Die Knöpfe hängen an `aktionen`: eigene
 * offene Vorschläge ändern/zurückziehen, die Leitung entscheidet. Läuft eine Aktion, sind die Knöpfe der Zeile gesperrt.
 * Welche Zeile aufgeklappt ist, weiß der Aufrufer (`auf`, `onKlick`) – es ist immer nur eine.
 */
export function VorschlagZeile<T extends ZeilenDaten = Vorschlag>({
  v,
  ich,
  direkt,
  aktionen,
  auf,
  onKlick,
  ohneMarke = false,
  abgelehnt,
  texte = {},
}: {
  v: T;
  ich: number;
  direkt: boolean;
  aktionen: VorschlagAktionen<T>;
  auf: boolean;
  onKlick: () => void;
  /** Im Kasten beim Schreiben: alle offen – das Schild sagte nichts. */
  ohneMarke?: boolean;
  /** In der Gruppe „Abgelehnt“: noch so viele Tage sichtbar, „×“ blendet früher aus. */
  abgelehnt?: { noch: number; onWeg: () => void };
  texte?: ZeilenTexte;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const tun = (f?: (v: T) => Promise<void>) => () => {
    if (!f) return;
    setLaeuft(true);
    void f(v).finally(() => setLaeuft(false));
  };
  const meins = v.von === ich;
  const eigen = darfAendern(v, ich);
  const verschoben = v.stand === 'offen' && v.verlauf[v.verlauf.length - 1]?.art === 'verschoben';
  const entscheiden = v.stand === 'offen' && !direkt;
  const knoepfe = [
    eigen && aktionen.aendern && (
      <button
        key="a"
        type="button"
        className={styles.knopf}
        disabled={laeuft}
        onClick={() => aktionen.aendern!(v)}
      >
        Ändern
      </button>
    ),
    eigen && aktionen.zurueckziehen && (
      <button
        key="z"
        type="button"
        className={`${styles.knopf} ${styles.rot}`}
        disabled={laeuft}
        onClick={tun(aktionen.zurueckziehen)}
      >
        Zurückziehen
      </button>
    ),
    entscheiden && aktionen.uebernehmen && (
      <button
        key="u"
        type="button"
        className={`${styles.knopf} ${styles.blau}`}
        disabled={laeuft}
        onClick={tun(aktionen.uebernehmen)}
      >
        {texte.uebernehmen ?? 'Übernehmen'}
      </button>
    ),
    entscheiden && aktionen.naechstesMal && (
      <button
        key="n"
        type="button"
        className={styles.knopf}
        disabled={laeuft}
        onClick={tun(aktionen.naechstesMal)}
      >
        Nächstes Mal
      </button>
    ),
    entscheiden && aktionen.ablehnen && (
      <button
        key="x"
        type="button"
        className={`${styles.knopf} ${styles.rot}`}
        disabled={laeuft}
        onClick={() => aktionen.ablehnen!(v)}
      >
        {texte.ablehnen ?? 'Ablehnen'}
      </button>
    ),
  ].filter(Boolean);
  const kurz = abgelehnt ? (v.grund ? `Grund: ${v.grund}` : '') : v.text;
  const eineZeile = kurz.split('\n')[0];
  return (
    <li className={styles.vorschlag}>
      <div className={styles.kopfzeile}>
        <button type="button" className={styles.zeile} aria-expanded={auf} onClick={onKlick}>
          <Icon name={auf ? 'chev-down' : 'chev-right'} size={16} />
          <span className={styles.inhalt}>
            <b className={styles.eine}>{v.titel}</b>
            {!auf && eineZeile && (
              <span className={`${styles.eine} ${styles.textzeile}`}>{eineZeile}</span>
            )}
            <small>
              von {v.name}
              {meins ? ' (du)' : ''}
              {verschoben ? ' · verschoben' : ''}
              {v.zusatz ? ` · ${v.zusatz}` : ''}
              {abgelehnt
                ? ` · noch ${abgelehnt.noch} ${abgelehnt.noch === 1 ? 'Tag' : 'Tage'} sichtbar`
                : ''}
            </small>
          </span>
          {!ohneMarke && standMarke(v, direkt)}
        </button>
        {abgelehnt && (
          <button
            type="button"
            className={styles.weg}
            title="Ausblenden"
            aria-label={`„${v.titel}“ ausblenden`}
            onClick={abgelehnt.onWeg}
          >
            <Icon name="x" size={16} />
          </button>
        )}
      </div>
      {auf && (
        <div className={styles.auf}>
          {v.text ? (
            <p className={styles.voll}>{v.text}</p>
          ) : (
            <p className={styles.leise}>{texte.leer ?? 'Ohne Text.'}</p>
          )}
          {v.stand === 'abgelehnt' && v.grund && (
            <p className={styles.grund}>
              <b>Begründung:</b> {v.grund}
            </p>
          )}
          {knoepfe.length > 0 && <div className={styles.knoepfe}>{knoepfe}</div>}
        </div>
      )}
    </li>
  );
}

/**
 * **Der Kopf eines klappbaren Vorschlag-Bereichs** (Karte „Vorschläge“ der Sitzungen, Bereich „Vorgeschlagen“ der To-Dos, W9b):
 * Pfeil, Titel, Zahl – ein Knopf, der den Bereich auf- und zuklappt.
 */
export function BereichKopf({
  titel,
  anzahl,
  auf,
  onKlick,
}: {
  titel: string;
  anzahl: string;
  auf: boolean;
  onKlick: () => void;
}) {
  return (
    <h3 className={styles.kartenkopf}>
      <button type="button" className={styles.klapp} aria-expanded={auf} onClick={onKlick}>
        <Icon name={auf ? 'chev-down' : 'chev-right'} size={16} />
        <span className={styles.titel}>{titel}</span>
        <span className={styles.anzahl}>{anzahl}</span>
      </button>
    </h3>
  );
}

/**
 * **Karte „Vorschläge“** im Reiter „Sitzungen“ (S5-4, Kurzform + Aufräumen W8c): die **offenen** Vorschläge der Gruppe,
 * je kommende Sitzung, dann „Nächste Sitzung“ (noch nicht festgelegt) – darunter, nur für den Vorschlagenden und die
 * Leitung, die kleine Gruppe „Abgelehnt“ (7 Tage). Übernommene stehen nicht hier, sondern als Marke an der Sitzung. Der
 * Kopf klappt den Bereich auf und zu (das Gerät merkt es). Die Leitung kann offene Vorschläge einer festgelegten Sitzung
 * schon hier übernehmen – eingefügt wird beim Öffnen des Protokolls.
 */
export function VorschlaegeKarte({
  gruppe,
  leitung,
  liste,
  kommend,
  heute,
  zeitzone,
  ich,
  direkt,
  aktionen,
  fehler,
}: {
  /** Die Gruppe – das Gerät merkt Einklappen und Ausblenden je Person und Gruppe. */
  gruppe: number;
  /** Darf entscheiden – sieht auch die abgelehnten der anderen. */
  leitung: boolean;
  liste: readonly Vorschlag[];
  kommend: readonly Sitzung[];
  heute: string;
  zeitzone: string;
  ich: number;
  direkt: boolean;
  /** Die Aktionen für eine Sitzung – ohne Sitzung („Nächste Sitzung“) gibt es nichts zu übernehmen. */
  aktionen: (s: Sitzung | null) => VorschlagAktionen;
  fehler: string | null;
}) {
  const [aufId, setAufId] = useState<string | null>(null);
  const [wahl, setWahl] = useBereichWahl(ich, gruppe);
  const [aus, ausblenden] = useAusgeblendet(ich, gruppe);
  const { gruppen } = vorschlaegeOrdnen(liste, kommend, heute, zeitzone);
  const abgelehnt = abgelehntSichtbar(liste, ich, leitung, heute, zeitzone, aus);
  const offen = liste.filter((v) => v.stand === 'offen').length;
  const bereichAuf = bereichOffen(wahl, offen);
  const umschalten = (id: string) => setAufId(aufId === id ? null : id);
  return (
    <section className={styles.karte} aria-label="Vorschläge">
      <BereichKopf
        titel="Vorschläge"
        anzahl={`${offen} offen`}
        auf={bereichAuf}
        onKlick={() => setWahl(!bereichAuf)}
      />
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
      {bereichAuf && (
        <div className={styles.rumpf}>
          {!gruppen.length && !abgelehnt.length && (
            <p className={styles.leer}>
              Keine offenen Vorschläge. Mit „Punkt vorschlagen“ bringst du ein Thema für eine
              Sitzung ein.
            </p>
          )}
          {gruppen.map((g) => (
            <div key={g.sitzung?.schluessel ?? 'naechste'}>
              <div className={styles.gruppe}>
                Für{' '}
                {g.sitzung
                  ? `${g.sitzung.titel} · ${wannLang(g.sitzung.beginn, zeitzone)}`
                  : 'die nächste Sitzung · noch nicht festgelegt'}
              </div>
              <ul className={styles.liste}>
                {g.vorschlaege.map((v) => (
                  <VorschlagZeile
                    key={v.id}
                    v={v}
                    ich={ich}
                    direkt={direkt}
                    aktionen={aktionen(g.sitzung)}
                    auf={aufId === v.id}
                    onKlick={() => umschalten(v.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
          {abgelehnt.length > 0 && (
            <div>
              <div className={styles.gruppe}>Abgelehnt · verschwindet nach 7 Tagen</div>
              <ul className={styles.liste}>
                {abgelehnt.map((v) => (
                  <VorschlagZeile
                    key={v.id}
                    v={v}
                    ich={ich}
                    direkt={direkt}
                    aktionen={{}}
                    auf={aufId === v.id}
                    onKlick={() => umschalten(v.id)}
                    abgelehnt={{
                      noch: abgelehntNoch(v, heute, zeitzone),
                      onWeg: () =>
                        ausblenden(
                          v.id,
                          liste.filter((x) => x.stand === 'abgelehnt').map((x) => x.id),
                        ),
                    }}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * **Kasten „Vorschläge · n“** beim Schreiben (S5-4, Gruppe „Vorschlagen“): die offenen Vorschläge dieser Sitzung in der
 * Kurzform der Karte (W8c) mit Übernehmen / Nächstes Mal / Ablehnen im aufgeklappten Vorschlag; der Kasten selbst ist
 * auch aufklappbar. Ohne offene Vorschläge steht er nicht da.
 */
export function VorschlaegeKasten({
  liste,
  ich,
  aktionen,
  fehler,
}: {
  liste: readonly Vorschlag[];
  ich: number;
  aktionen: VorschlagAktionen;
  fehler: string | null;
}) {
  const [offen, setOffen] = useState(true);
  const [aufId, setAufId] = useState<string | null>(null);
  if (!liste.length && !fehler) return null;
  return (
    <section className={styles.karte} aria-label="Vorschläge">
      <button
        type="button"
        className={styles.klapp}
        aria-expanded={offen}
        onClick={() => setOffen(!offen)}
      >
        <Icon name={offen ? 'chev-down' : 'chev-right'} size={16} />
        Vorschläge <span className={styles.anzahl}>· {liste.length}</span>
      </button>
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
      {offen && liste.length > 0 && (
        <ul className={styles.liste}>
          {liste.map((v) => (
            <VorschlagZeile
              key={v.id}
              v={v}
              ich={ich}
              direkt={false}
              aktionen={aktionen}
              ohneMarke
              auf={aufId === v.id}
              onKlick={() => setAufId(aufId === v.id ? null : v.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
