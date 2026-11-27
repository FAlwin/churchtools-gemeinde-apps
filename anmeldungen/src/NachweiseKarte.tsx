import { useRef, useState } from 'react';
import { useLaden } from '@ui/ct/useLaden';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { SchalterKnopf } from '@ui/bedienung/SchalterKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { MehrfachWahl } from '@ui/bedienung/MehrfachWahl';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { filterAntworten } from '@shared/anmeldung/tabellenFilter';
import {
  mitNachweisBedarf,
  nachweisBedarfSatz,
  nachweisBedarfVon,
  nachweisBedingungSatz,
  nachweisFragen,
  nachweisProblemText,
  type NachweisBedarf,
} from '@shared/anmeldung/nachweisBedarf';
import { aendereEinstellungen } from './einrichten';
import { nachweisArtenKurz, type NachweisArtKurz } from './nachweisArten';
import { Karte, Zeile } from './VeranstaltungKarte';
import { Fehler } from './Bearbeiten';
import { useSpeichern } from './useSpeichern';
import f from './Formular.module.scss';
import n from './Nachweise.module.scss';
import s from './Startseite.module.scss';
import v from './VeranstaltungSeite.module.scss';

/**
 * **Karte „Nachweise“ in der Veranstaltung** (N3b, Entwurf `n-nachweise-v2`, Ansicht „Nachweise · AC 2027“): je
 * Nachweis-Art, ob und für wen die Veranstaltung sie braucht – „alle Angemeldeten“ oder „nur wenn …“ eine Frage des
 * Formulars so beantwortet wurde. Hier wird nur eingestellt; eingetragen wird in N3c, die Ampel kommt in N3d.
 *
 * Die Arten kommen aus ChurchTools (`nachweisArtenKurz`). Was eingestellt ist, steht in den Einstellungen der
 * Veranstaltung (`nachweise`, E20) – auch für Arten, die diese Person nicht sieht: Sie bleiben beim Speichern unberührt.
 */
const FUER_WEN_TEXT =
  'Eingetragen wird, sobald eine Vertrauensperson oder ein Admin die Erweiterung öffnet. Wer schon in der Nachweis-Gruppe ist, bekommt keine neue Aufforderung.';

const unbekannt = (id: number) => `Nachweis-Art Nr. ${id}`;

/** Die Zeilen der Karte, eine je Art – dazu eingeschaltete Arten, die diese Person nicht sieht. */
export function NachweiseKarte({
  id,
  name,
  e,
  darf,
  onGespeichert,
}: {
  id: number;
  /** Name der Veranstaltung – steht im Titel des Fensters. */
  name: string;
  e: OeffentlicheEinstellungen;
  /** Wer Anmeldungen nicht bearbeiten darf, sieht die Karte nur. */
  darf: boolean;
  onGespeichert: () => void;
}) {
  const { stand, neu } = useLaden(() => nachweisArtenKurz(), []);
  const [offen, setOffen] = useState(false);
  const arten = stand.art === 'fertig' ? stand.daten : null;
  const eingestellt = e.nachweise ?? [];
  const bekannt = new Set((arten ?? []).map((a) => a.id));
  const fremde = eingestellt.filter((b) => !bekannt.has(b.artGruppeId));

  const zeile = (titel: string, b: NachweisBedarf | undefined) => {
    const problem = b ? nachweisProblemText(e, b) : null;
    return (
      <Zeile key={titel} titel={titel}>
        {b ? nachweisBedarfSatz(e, b) : <span className={v.klein}>aus</span>}
        {problem && (
          <small className={v.klein}>
            <span className={v.fehlt}>{problem}</span>
          </small>
        )}
      </Zeile>
    );
  };

  return (
    <>
      <Karte
        titel="Nachweise"
        onBearbeiten={darf && arten && arten.length > 0 ? () => setOffen(true) : undefined}
      >
        {stand.art === 'laedt' && !eingestellt.length && (
          <Zeile titel="Nachweise">wird geladen …</Zeile>
        )}
        {stand.art === 'fehler' && (
          <Zeile titel="Nachweise">
            konnten nicht gelesen werden · <TextKnopf onClick={neu}>Nochmal</TextKnopf>
          </Zeile>
        )}
        {arten?.map((a) => zeile(a.name, nachweisBedarfVon(e, a.id)))}
        {fremde.map((b) => zeile(unbekannt(b.artGruppeId), b))}
        {arten && arten.length === 0 && !fremde.length && (
          <Zeile titel="Nachweise">
            Es gibt noch keine Nachweis-Art, die du sehen kannst. Arten legst du auf der Seite{' '}
            <a className={s.link} href="#/nachweise">
              „Nachweise“
            </a>{' '}
            an.
          </Zeile>
        )}
      </Karte>
      {offen && arten && (
        <NachweiseFenster
          id={id}
          name={name}
          e={e}
          arten={arten}
          onClose={() => setOffen(false)}
          onGespeichert={() => {
            setOffen(false);
            onGespeichert();
          }}
        />
      )}
    </>
  );
}

/** Wie `a` und `b` zusammen gleich sind – zum Erkennen, was geändert ist. */
const gleich = (a: NachweisBedarf | null, b: NachweisBedarf | null) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * **Das Fenster „Nachweise · <Veranstaltung>“** – je Art ein Schalter, darunter „Für wen“. Gespeichert werden nur die Arten,
 * die geändert sind, in die frisch gelesenen Einstellungen (`mitNachweisBedarf`); alle anderen Einträge bleiben stehen.
 */
function NachweiseFenster({
  id,
  name,
  e,
  arten,
  onClose,
  onGespeichert,
}: {
  id: number;
  name: string;
  e: OeffentlicheEinstellungen;
  arten: NachweisArtKurz[];
  onClose: () => void;
  onGespeichert: () => void;
}) {
  const vorher = useRef(new Map(arten.map((a) => [a.id, nachweisBedarfVon(e, a.id) ?? null])));
  const [wahl, setWahl] = useState(() => new Map(vorher.current));
  /** Die Art, deren Bedingung gerade bearbeitet wird. */
  const [aendern, setAendern] = useState<number | null>(null);
  const { arbeitet, fehler, speichern } = useSpeichern(onGespeichert);
  const fragen = nachweisFragen(e);

  const setze = (artId: number, b: NachweisBedarf | null) =>
    setWahl((alt) => new Map(alt).set(artId, b));
  const geaendert = arten.filter(
    (a) => !gleich(wahl.get(a.id) ?? null, vorher.current.get(a.id) ?? null),
  );
  const unvollstaendig = geaendert.some((a) => {
    const b = wahl.get(a.id);
    return b?.fuer === 'nurWenn' && (!b.feld || b.antworten.length === 0);
  });
  const fremde = (e.nachweise ?? []).filter((b) => !arten.some((a) => a.id === b.artGruppeId));

  const speichernKlick = () =>
    speichern(() =>
      aendereEinstellungen(id, (frisch) =>
        geaendert.reduce((x, a) => mitNachweisBedarf(x, a.id, wahl.get(a.id) ?? null), frisch),
      ),
    );

  return (
    <Sheet
      title={`Nachweise · ${name}`}
      onClose={onClose}
      beschaeftigt={arbeitet}
      knoepfe={
        <FensterKnopf
          disabled={arbeitet || !geaendert.length || unvollstaendig}
          onClick={speichernKlick}
        >
          {arbeitet ? 'Wird gespeichert …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      {arten.map((a) => {
        const b = wahl.get(a.id) ?? null;
        const an = b !== null;
        return (
          <div key={a.id} className={n.art}>
            <SchalterKnopf
              an={an}
              disabled={!a.fertig && !an}
              onClick={() => {
                setze(a.id, an ? null : { artGruppeId: a.id, fuer: 'alle' });
                setAendern(null);
              }}
            >
              {a.name}
            </SchalterKnopf>
            {!a.fertig && !an && (
              <small className={f.hinweis}>
                Diese Art ist noch nicht fertig eingerichtet – bitte erst auf der Seite „Nachweise“
                speichern.
              </small>
            )}
            {b && (
              <>
                <div className={f.feld} style={{ marginBottom: 0 }}>
                  <span>Für wen</span>
                  <Segment<'alle' | 'nurWenn'>
                    ariaLabel={`Für wen: ${a.name}`}
                    value={b.fuer}
                    onChange={(fuer) => {
                      if (fuer === b.fuer) return;
                      if (fuer === 'alle') {
                        setze(a.id, { artGruppeId: a.id, fuer: 'alle' });
                        setAendern(null);
                      } else if (fragen.length) {
                        setze(a.id, {
                          artGruppeId: a.id,
                          fuer: 'nurWenn',
                          feld: fragen[0].feld,
                          antworten: [],
                        });
                        setAendern(a.id);
                      }
                    }}
                    options={[
                      { value: 'alle', label: 'Alle Angemeldeten' },
                      { value: 'nurWenn', label: 'Nur wenn …' },
                    ]}
                    dimmed={fragen.length ? [] : ['nurWenn']}
                  />
                </div>
                {!fragen.length && b.fuer === 'alle' && (
                  <small className={f.hinweis}>
                    „Nur wenn …“ geht erst, wenn das Formular eine Frage mit festen Antworten hat
                    (Ja/Nein, Auswahl, Ankreuzen).
                  </small>
                )}
                {b.fuer === 'nurWenn' && (
                  <BedingungEingabe
                    e={e}
                    b={b}
                    fragen={fragen}
                    offen={aendern === a.id}
                    onOffen={(auf) => setAendern(auf ? a.id : null)}
                    onAendern={(neu) => setze(a.id, neu)}
                  />
                )}
                <small className={f.hinweis} style={{ marginBottom: 0 }}>
                  {FUER_WEN_TEXT}
                </small>
              </>
            )}
          </div>
        );
      })}
      {fremde.length > 0 && (
        <small className={f.hinweis}>
          Außerdem eingeschaltet, für dich nicht sichtbar:{' '}
          {fremde.map((b) => unbekannt(b.artGruppeId)).join(', ')} – bleibt unverändert.
        </small>
      )}
      <Fehler text={fehler} />
    </Sheet>
  );
}

/** „Wenn <Frage> ist <Antworten>“ mit „Bedingung ändern“ – aufgeklappt: die Frage und die Antworten zur Wahl. */
function BedingungEingabe({
  e,
  b,
  fragen,
  offen,
  onOffen,
  onAendern,
}: {
  e: OeffentlicheEinstellungen;
  b: Extract<NachweisBedarf, { fuer: 'nurWenn' }>;
  fragen: ReturnType<typeof nachweisFragen>;
  offen: boolean;
  onOffen: (auf: boolean) => void;
  onAendern: (b: NachweisBedarf) => void;
}) {
  const problem = nachweisProblemText(e, b);
  const frageDa = fragen.some((q) => q.feld === b.feld);
  const moegliche = frageDa ? filterAntworten(e, b.feld) : [];
  // Gewählte Antworten, die es nicht mehr gibt, bleiben sichtbar – so lassen sie sich abwählen.
  const weg = b.antworten.filter((a) => !moegliche.includes(a));
  const optionen = [
    ...moegliche.map((a) => ({ wert: a, text: a })),
    ...weg.map((a) => ({ wert: a, text: `${a} (gibt es nicht mehr)` })),
  ];
  const gewaehlt = new Set(b.antworten);
  return (
    <>
      {offen ? (
        <div className={n.regelEditor}>
          <label className={f.feld} style={{ marginBottom: 0 }}>
            <span>Frage</span>
            <select
              className={f.eingabe}
              value={b.feld}
              onChange={(ev) => onAendern({ ...b, feld: ev.target.value, antworten: [] })}
            >
              {!frageDa && (
                <option value={b.feld} disabled>
                  (Frage fehlt)
                </option>
              )}
              {fragen.map((q) => (
                <option key={q.feld} value={q.feld}>
                  {q.name}
                  {q.jePerson ? ' · je Person' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className={f.feld} style={{ marginBottom: 0 }}>
            <span>Antworten (eine davon reicht)</span>
            <MehrfachWahl
              gruppen={[{ titel: '', optionen }]}
              gewaehlt={gewaehlt}
              onUmschalten={(a) =>
                onAendern({
                  ...b,
                  antworten: gewaehlt.has(a)
                    ? b.antworten.filter((x) => x !== a)
                    : [...b.antworten, a],
                })
              }
              platzhalter="Antworten wählen …"
              titel="Antworten"
              feldKlasse={f.eingabe}
            />
          </div>
          <small className={f.hinweis} style={{ marginBottom: 0 }}>
            Bei Fragen je Person zählt die Antwort der Person, bei Fragen an den Kontakt die der
            Anmeldung.
          </small>
          {b.antworten.length === 0 && (
            <small className={f.fehler} style={{ marginBottom: 0 }}>
              Bitte mindestens eine Antwort wählen.
            </small>
          )}
          <TextKnopf onClick={() => onOffen(false)} disabled={b.antworten.length === 0}>
            Fertig
          </TextKnopf>
        </div>
      ) : (
        <div className={n.regel}>
          <span>
            Wenn <b>{nachweisBedingungSatz(e, b)}</b>
          </span>
          <TextKnopf onClick={() => onOffen(true)}>Bedingung ändern</TextKnopf>
        </div>
      )}
      {problem && (
        <small className={f.fehler} style={{ marginBottom: 0 }}>
          {problem}
        </small>
      )}
    </>
  );
}
