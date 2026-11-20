import { useMemo, useState } from 'react';
import { Etikett } from '@ui/bedienung/Etikett';
import { Segment } from '@ui/bedienung/Segment';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import type { Schreiber } from '@shared/ct/sperre';
import { freigabeListe, type Eintrag, type EintragArt, type Ziel } from '@shared/website/freigabe';
import type { Seite } from '@shared/website/modell';
import { menueOhneSeite } from '@shared/website/seitenListe';
import { ANMERKUNG_MAX } from '@shared/website/status';
import type { WebsiteStand } from '@shared/website/speicher';
import { darfFreigeben, type Zugang } from '@shared/website/zugang';
import { FreigabeBand } from './FreigabeLeiste';
import { eintragEtikett, misserfolg, werUndWann } from './freigabeAnzeige';
import { Hinweis, Leise } from './Hinweis';
import { ListenZeile } from './ListenZeile';
import { Vorschau, type Ansicht } from './Vorschau';
import {
  entferneSeiteUndOnline,
  entferneStatus,
  gebeAllesFrei,
  gebeFrei,
  setzeStatus,
  speichereMenue,
  type FreigabeKategorien,
} from './daten';
import { Feld } from './Felder';
import fenster from './Fenster.module.scss';
import baender from './SperrBaender.module.scss';
import seitenStyles from './Seiten.module.scss';
import styles from './Freigabe.module.scss';

/** Die Überschriften der Liste – in der Reihenfolge von `EINTRAG_ARTEN`; Änderungen (`geaendert`, `neu`) stehen zusammen. */
const GRUPPEN: { titel: string; arten: readonly EintragArt[] }[] = [
  { titel: 'Eingereicht', arten: ['eingereicht'] },
  { titel: 'Löschen angefragt', arten: ['loeschenAngefragt'] },
  { titel: 'Zurückgegeben', arten: ['zurueck'] },
  { titel: 'Änderungen', arten: ['geaendert', 'neu'] },
  { titel: 'Menü und Aussehen', arten: ['menue', 'einstellungen'] },
  { titel: 'Nur noch online', arten: ['nurOnline'] },
];

/** Ein Fehler, dessen Wortlaut schon fertig ist (z. B. „3 von 5 sind online …“) – `misserfolg` würde ihn zu „ChurchTools antwortet nicht“ machen. */
class Gemeldet extends Error {}

type Dialog =
  | { art: 'zurueck'; eintrag: Eintrag }
  | { art: 'loeschen'; eintrag: Eintrag }
  | { art: 'offline'; eintrag: Eintrag }
  | { art: 'alle' };

/**
 * **Der Reiter „Freigaben“** (Bauplan Website W3b-2): links alles, was vom Online-Stand abweicht (oder bei einem Redakteur: seine
 * eingereichten und zurückgegebenen Seiten), rechts die Vorschau mit dem echten Renderer und – für die Leitung – die Knöpfe.
 *
 * - **Freigeben / Veröffentlichen** schreibt den Entwurf unverändert nach „Veröffentlicht“ und liest nach (`gibFrei`); der
 *   Status verschwindet erst danach. **Mit Anmerkung zurück** (nur bei eingereichten Seiten) gibt die Seite mit einer Anmerkung
 *   zurück, die der Redakteur an der Seite sieht. Bei **„Löschen angefragt“**: „Löschen und offline nehmen“ oder „Ablehnen“.
 * - **Alles freigeben** nimmt die **eingereichten** Seiten, das Menü und die Einstellungen – nacheinander, es bricht beim ersten
 *   Fehler ab. Nicht eingereichte Entwürfe gehören nicht dazu: Ein Entwurf ohne Einreichen ist vielleicht noch nicht fertig, und
 *   was er enthält, hat noch niemand gesehen.
 * - **Redakteure** sehen hier nur ihre eigenen Seiten und können nichts tun – zum Ansehen, wie es steht.
 *
 * Die Daten (`daten`) gehören dem Rahmen (`App`): Er liest beide Kategorien auch für den Zähler am Reiter und liest nach jeder
 * Handlung neu (`onGeaendert`). Nichts gilt als erledigt, was nicht nachgelesen ist.
 */
export function Freigaben({
  kategorien,
  daten,
  zugang,
  ich,
  gemeinde,
  onGeaendert,
}: {
  kategorien: FreigabeKategorien;
  daten: { entwurf: WebsiteStand; online: WebsiteStand };
  zugang: Zugang;
  ich: Schreiber;
  gemeinde: string | null;
  /** Nach jeder gelungenen Handlung: Der Rahmen liest beide Kategorien neu. */
  onGeaendert: () => void;
}) {
  const leitung = darfFreigeben(zugang);
  const liste = useMemo(
    () => freigabeListe(daten.entwurf, daten.online, zugang, ich.person),
    [daten, zugang, ich.person],
  );
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState<Ansicht>('computer');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const aktuell = liste.find((e) => e.schluessel === gewaehlt) ?? liste[0] ?? null;

  /** Eine Handlung: Fehler und Meldung einheitlich – **was nicht nachgelesen ist, gilt nicht als geschehen**. */
  const handle = async (tun: () => Promise<string | void>, nichtGeschehen: string) => {
    setLaeuft(true);
    setFehler(null);
    setMeldung(null);
    try {
      const m = await tun();
      if (m) setMeldung(m);
      setDialog(null);
      onGeaendert();
    } catch (e) {
      setFehler(e instanceof Gemeldet ? e.message : misserfolg(e, nichtGeschehen));
    } finally {
      setLaeuft(false);
    }
  };

  /** Ein Fenster öffnen – ohne den Fehler von vorhin. */
  const oeffne = (d: Dialog) => {
    setFehler(null);
    setDialog(d);
  };

  const ziel = (e: Eintrag): Ziel => ({ einheit: e.einheit, id: e.id });

  const freigeben = (e: Eintrag) =>
    handle(async () => {
      const r = await gebeFrei(kategorien, ziel(e));
      if (r.statusEntfernt) return `„${e.titel}“ ist online.`;
      return r.grund === 'geaendert'
        ? `„${e.titel}“ ist online. Danach wurde die Seite noch einmal geändert – die neue Fassung ist noch nicht freigegeben und bleibt eingereicht.`
        : `„${e.titel}“ ist online. Der Status ließ sich gerade nicht zurücksetzen – versuch es gleich noch einmal mit „Freigeben“.`;
    }, `„${e.titel}“ wurde nicht veröffentlicht – online steht weiter die bisherige Fassung.`);

  const zurueckgeben = (e: Eintrag, anmerkung: string) =>
    handle(async () => {
      await setzeStatus(
        kategorien,
        e.id,
        {
          zustand: 'zurueck',
          anmerkung: anmerkung.trim(),
          ...(e.status ? { einreicher: { von: e.status.von, name: e.status.name } } : {}),
        },
        ich,
      );
      return `„${e.titel}“ ist mit deiner Anmerkung zurückgegeben.`;
    }, `„${e.titel}“ wurde nicht zurückgegeben.`);

  const ablehnen = (e: Eintrag) =>
    handle(async () => {
      await entferneStatus(kategorien, e.id);
      return `Die Anfrage zum Löschen von „${e.titel}“ ist abgelehnt – die Seite bleibt.`;
    }, `Die Anfrage wurde nicht abgelehnt.`);

  const entfernen = (e: Eintrag) =>
    handle(async () => {
      // Erst das Menü (ohne die Seite), dann online, dann der Entwurf: nie ein Menüpunkt im Entwurf, der ins Leere zeigt.
      const menue = menueOhneSeite(daten.entwurf.menue, e.id);
      if (menue && e.art !== 'nurOnline')
        await speichereMenue({ modul: kategorien.modul, kategorie: kategorien.entwuerfe }, menue);
      await entferneSeiteUndOnline(kategorien, e.id);
      return `„${e.titel}“ ist gelöscht und nicht mehr online.`;
    }, `„${e.titel}“ wurde nicht gelöscht.`);

  /** Was „Alles freigeben“ nimmt: eingereichte Seiten, das Menü und die Einstellungen (nie nicht eingereichte Entwürfe). */
  const fuerAlle = liste.filter(
    (e) => e.lesbar && (e.art === 'eingereicht' || e.art === 'menue' || e.art === 'einstellungen'),
  );
  const alleFreigeben = () =>
    handle(async () => {
      const r = await gebeAllesFrei(kategorien, fuerAlle.map(ziel));
      if (r.fehler) {
        const titel = fuerAlle.find(
          (e) => e.schluessel === `${r.fehler!.ziel.einheit}:${r.fehler!.ziel.id}`,
        )?.titel;
        // Abgebrochen: Was geschafft ist, ist geschafft – der Dialog bleibt mit der Meldung offen.
        onGeaendert();
        throw new Gemeldet(
          `${r.geschafft.length} von ${fuerAlle.length} sind online. Bei „${titel ?? r.fehler.ziel.id}“ ist es abgebrochen (${
            r.offen > 0 ? `${r.offen} weitere nicht mehr versucht` : 'keine weitere offen'
          }): ${misserfolg(r.fehler.fehler, '').trim()}`,
        );
      }
      return `Alles ist online: ${r.geschafft.length} ${r.geschafft.length === 1 ? 'Eintrag' : 'Einträge'}.`;
    }, 'Nicht alles ist freigegeben.');

  return (
    <div className={styles.freigaben}>
      {fehler && (
        <FehlerKasten fehler={{ text: fehler, nochmal: true }} onNochmal={() => setFehler(null)} />
      )}
      {meldung && (
        <div role="status">
          <Leise>{meldung}</Leise>
        </div>
      )}

      {liste.length === 0 ? (
        <Hinweis titel="Freigaben">
          <Leise>
            {leitung
              ? 'Alles ist so online, wie es im Entwurf steht. Eingereichte Seiten und Änderungen erscheinen hier.'
              : 'Du hast gerade nichts eingereicht, und nichts wurde dir zurückgegeben. Was du einreichst, siehst du hier.'}
          </Leise>
        </Hinweis>
      ) : (
        <>
          {leitung && (
            <div className={styles.kopf}>
              <p>
                {liste.length} {liste.length === 1 ? 'Eintrag weicht' : 'Einträge weichen'} vom
                Online-Stand ab.
              </p>
              <FensterKnopf
                art="zweit"
                disabled={laeuft || fuerAlle.length === 0}
                onClick={() => oeffne({ art: 'alle' })}
              >
                Alles freigeben
              </FensterKnopf>
            </div>
          )}
          <div className={seitenStyles.raster}>
            <aside className={seitenStyles.liste} aria-label="Freigaben">
              {GRUPPEN.map((g) => {
                const eintraege = liste.filter((e) => g.arten.includes(e.art));
                if (eintraege.length === 0) return null;
                return (
                  <div className={seitenStyles.gruppe} key={g.titel}>
                    <h3 className={seitenStyles.gruppenTitel}>{g.titel}</h3>
                    {eintraege.map((e) => {
                      const et = eintragEtikett(e);
                      return (
                        <ListenZeile
                          key={e.schluessel}
                          titel={e.titel}
                          symbol={
                            e.einheit === 'seite'
                              ? 'dokument'
                              : e.einheit === 'menue'
                                ? 'liste'
                                : 'regler'
                          }
                          aktiv={e.schluessel === aktuell?.schluessel}
                          onClick={() => setGewaehlt(e.schluessel)}
                          etikett={
                            <Etikett ton={et.ton} title={et.title}>
                              {et.text}
                            </Etikett>
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}
            </aside>

            {aktuell && (
              <section className={styles.arbeit} aria-label="Prüfen">
                <div className={styles.werkzeug}>
                  <div className={styles.name}>
                    <strong>{aktuell.titel}</strong>
                    <span>{unterzeile(aktuell)}</span>
                  </div>
                  <Segment
                    value={ansicht}
                    options={[
                      { value: 'computer', label: 'Computer' },
                      { value: 'handy', label: 'Handy' },
                    ]}
                    onChange={setAnsicht}
                    ariaLabel="Vorschau-Ansicht"
                    verbunden
                  />
                </div>

                <FreigabeBand status={aktuell.status} darfFreigeben={leitung} />
                {aktuell.warnung && (
                  <div className={baender.band} role="status">
                    <p>{aktuell.warnung}</p>
                  </div>
                )}
                {leitung && (
                  <div className={styles.aktionen}>
                    <Aktionen
                      e={aktuell}
                      aus={laeuft}
                      onFreigeben={() => void freigeben(aktuell)}
                      onZurueck={() => oeffne({ art: 'zurueck', eintrag: aktuell })}
                      onLoeschen={() => oeffne({ art: 'loeschen', eintrag: aktuell })}
                      onAblehnen={() => void ablehnen(aktuell)}
                      onOffline={() => oeffne({ art: 'offline', eintrag: aktuell })}
                    />
                  </div>
                )}
                <Ansichtsfeld e={aktuell} daten={daten} gemeinde={gemeinde} ansicht={ansicht} />
              </section>
            )}
          </div>
        </>
      )}

      {dialog?.art === 'zurueck' && (
        <ZurueckFenster
          titel={dialog.eintrag.titel}
          laeuft={laeuft}
          fehler={fehler}
          onClose={() => setDialog(null)}
          onZurueck={(a) => void zurueckgeben(dialog.eintrag, a)}
        />
      )}
      {dialog?.art === 'loeschen' && (
        <ConfirmDialog
          title="Löschen und offline nehmen?"
          message={`Die Seite „${dialog.eintrag.titel}“ wird gelöscht und nimmt die Website offline, falls sie dort steht. Der Menüpunkt dazu wird entfernt. Das lässt sich nicht rückgängig machen.`}
          confirmLabel={laeuft ? 'Wird gelöscht …' : 'Löschen und offline nehmen'}
          beschaeftigt={laeuft}
          onCancel={() => setDialog(null)}
          onConfirm={() => void entfernen(dialog.eintrag)}
        >
          {fehler && (
            <p className={fenster.fehler} role="alert">
              {fehler}
            </p>
          )}
        </ConfirmDialog>
      )}
      {dialog?.art === 'offline' && (
        <ConfirmDialog
          title="Offline nehmen?"
          message={`Die Seite „${dialog.eintrag.titel}“ ist online, ihr Entwurf aber gelöscht. Offline genommen ist sie von der Website verschwunden.`}
          confirmLabel={laeuft ? 'Wird offline genommen …' : 'Offline nehmen'}
          beschaeftigt={laeuft}
          onCancel={() => setDialog(null)}
          onConfirm={() => void entfernen(dialog.eintrag)}
        >
          {fehler && (
            <p className={fenster.fehler} role="alert">
              {fehler}
            </p>
          )}
        </ConfirmDialog>
      )}
      {dialog?.art === 'alle' && (
        <ConfirmDialog
          title="Alles freigeben?"
          message={`Nacheinander gehen online: ${fuerAlle.map((e) => `„${e.titel}“`).join(', ')}. Bricht etwas ab, siehst du, was schon geschafft ist.`}
          confirmLabel={laeuft ? 'Wird veröffentlicht …' : 'Alles freigeben'}
          harmlos
          beschaeftigt={laeuft}
          onCancel={() => setDialog(null)}
          onConfirm={() => void alleFreigeben()}
        >
          {fehler && (
            <p className={fenster.fehler} role="alert">
              {fehler}
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

/** „Eingereicht von Rita am …“ – oder, wo es keinen Status gibt, wo die Einheit steht. */
function unterzeile(e: Eintrag): string {
  if (e.status) return `${statusWort(e)} ${werUndWann(e.status)}`;
  if (e.einheit !== 'seite')
    return e.lage === 'nie' ? 'Noch nicht online' : 'Online steht noch die frühere Fassung';
  if (e.art === 'nurOnline') return 'Steht noch online, der Entwurf ist gelöscht';
  return e.lage === 'nie' ? 'Noch nicht online' : 'Online steht noch die frühere Fassung';
}

function statusWort(e: Eintrag): string {
  return e.status?.zustand === 'eingereicht'
    ? 'Eingereicht'
    : e.status?.zustand === 'zurueck'
      ? 'Zurückgegeben'
      : 'Löschen angefragt';
}

/** Die Knöpfe zu einem Eintrag – je nach Art (nur für Leitung und Admin). */
function Aktionen({
  e,
  aus,
  onFreigeben,
  onZurueck,
  onLoeschen,
  onAblehnen,
  onOffline,
}: {
  e: Eintrag;
  aus: boolean;
  onFreigeben: () => void;
  onZurueck: () => void;
  onLoeschen: () => void;
  onAblehnen: () => void;
  onOffline: () => void;
}) {
  if (e.art === 'loeschenAngefragt')
    return (
      <>
        <FensterKnopf art="gefahr" disabled={aus} onClick={onLoeschen}>
          Löschen und offline nehmen
        </FensterKnopf>
        <FensterKnopf art="zweit" disabled={aus} onClick={onAblehnen}>
          Ablehnen
        </FensterKnopf>
      </>
    );
  if (e.art === 'nurOnline')
    return (
      <FensterKnopf art="gefahr" disabled={aus} onClick={onOffline}>
        Offline nehmen
      </FensterKnopf>
    );
  return (
    <>
      <FensterKnopf disabled={aus || !e.lesbar} onClick={onFreigeben}>
        {e.art === 'eingereicht' ? 'Freigeben' : 'Veröffentlichen'}
      </FensterKnopf>
      {e.art === 'eingereicht' && (
        <FensterKnopf art="zweit" disabled={aus} onClick={onZurueck}>
          Mit Anmerkung zurück
        </FensterKnopf>
      )}
    </>
  );
}

/** Die Vorschau zum Eintrag – mit dem echten Renderer, wie bei „Seiten“, nur ohne Bearbeiten-Ebene. */
function Ansichtsfeld({
  e,
  daten,
  gemeinde,
  ansicht,
}: {
  e: Eintrag;
  daten: { entwurf: WebsiteStand; online: WebsiteStand };
  gemeinde: string | null;
  ansicht: Ansicht;
}) {
  // Nur noch online: die Seite, wie sie online steht. Sonst der Entwurf; Menü und Einstellungen zeigen die Startseite damit.
  const quelle = e.art === 'nurOnline' ? daten.online : daten.entwurf;
  const seite: Seite | null =
    e.einheit === 'seite'
      ? (quelle.seiten.find((s) => s.id === e.id) ?? null)
      : (quelle.seiten.find((s) => s.startseite) ?? quelle.seiten[0] ?? null);
  if (!seite)
    return (
      <Leise>
        {e.lesbar
          ? 'Es gibt noch keine Seite, an der sich das zeigen ließe.'
          : 'Diesen Entwurf kann ich gerade nicht lesen – darum gibt es keine Vorschau und nichts freizugeben.'}
      </Leise>
    );
  return (
    <Vorschau
      key={e.schluessel}
      seite={seite}
      stand={{ seiten: quelle.seiten, menue: quelle.menue, einstellungen: quelle.einstellungen }}
      gemeinde={gemeinde}
      ansicht={ansicht}
    />
  );
}

/** „Mit Anmerkung zurück“: eine Anmerkung ist Pflicht – sonst weiß der Redakteur nicht, was er ändern soll. */
function ZurueckFenster({
  titel,
  laeuft,
  fehler,
  onZurueck,
  onClose,
}: {
  titel: string;
  laeuft: boolean;
  fehler: string | null;
  onZurueck: (anmerkung: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const bereit = text.trim() !== '' && !laeuft;
  return (
    <Sheet
      title="Mit Anmerkung zurück"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={!bereit} onClick={() => onZurueck(text)}>
          {laeuft ? 'Wird zurückgegeben …' : 'Zurückgeben'}
        </FensterKnopf>
      }
      mittel
    >
      <Feld label={`Was soll bei „${titel}“ noch geändert werden?`}>
        {(id) => (
          <textarea
            id={id}
            className={styles.anmerkung}
            value={text}
            maxLength={ANMERKUNG_MAX}
            autoFocus
            disabled={laeuft}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Feld>
      {fehler && (
        <p className={styles.fehlerText} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
