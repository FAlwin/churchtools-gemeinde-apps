import { useState } from 'react';
import { datumText } from '@shared/ct/datum';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import { vorschlaegeSichtbar, vorschlagNoch, warumVon } from '@shared/protokolle/todoVorschlag';
import { bereichOffen } from '@shared/protokolle/vorschlaege';
import {
  BereichKopf,
  VorschlagZeile,
  type VorschlagAktionen,
  type ZeilenDaten,
  type ZeilenTexte,
} from './Vorschlaege';
import { useAusgeblendet, useBereichWahl } from './vorschlaegeMerken';
import styles from './Vorschlaege.module.scss';

/** Eine Zeile des Bereichs: die Anzeigedaten der Vorschlag-Zeile und der Vorschlag dahinter. */
export type ToDoVorschlagZeile = ZeilenDaten & { aufgabe: Aufgabe };

const TEXTE: ZeilenTexte = {
  uebernehmen: 'Übernehmen …',
  ablehnen: 'Ablehnen …',
  leer: 'Ohne Notiz.',
};

/**
 * **Bereich „Vorgeschlagen“** im Reiter „To-Dos“ (W9b, Entwurf `todos-rechte-w9-v1`): über der Liste und über dem Board. Die
 * Leitung sieht alle offenen Vorschläge ihrer Gruppen („N warten auf dich“), Mitarbeiter nur die eigenen („wartet auf die
 * Leitung“); Abgelehnte sieben Tage lang. Ein Vorschlag ist **kein To-Do** – er steht nur hier. Dieselben Regeln und dieselbe
 * Zeile wie bei den Vorschlägen für Tagesordnungspunkte (`Vorschlaege.tsx`, `vorschlaegeSichtbar`, `vorschlaegeMerken`). Gibt
 * es nichts zu zeigen, fehlt der Bereich ganz.
 */
export function ToDoVorschlaege({
  ich,
  liste,
  leitungIn,
  irgendwoLeitung,
  heute,
  zeitzone,
  aktionen,
}: {
  ich: number;
  /** Alle To-Do-Vorschläge im Blick (`GruppenUebersicht.todoVorschlaege`) – nicht gelöschte. */
  liste: readonly Aufgabe[];
  /** Entscheide ich in dieser Gruppe als Leitung? */
  leitungIn: (gruppe: number) => boolean;
  /** Bin ich in irgendeiner Gruppe Leitung? Dann zählt der Kopf „warten auf dich“, sonst „offen“. */
  irgendwoLeitung: boolean;
  heute: string;
  zeitzone: string;
  /** Was ich mit diesem Vorschlag tun kann – die Leitungs-Aktionen nur, wo ich Leitung bin. */
  aktionen: (a: Aufgabe) => VorschlagAktionen<ToDoVorschlagZeile>;
}) {
  const [aufId, setAufId] = useState<string | null>(null);
  // Das Gerät merkt Aufklappen und Ausblenden über alle Gruppen (Gruppe 0).
  const [wahl, setWahl] = useBereichWahl(ich, 0, 'todovorschlaege');
  const [aus, ausblenden] = useAusgeblendet(ich, 0, 'todovorschlaege');
  const { offen, abgelehnt } = vorschlaegeSichtbar(liste, {
    ich,
    leitungIn,
    heute,
    zeitzone,
    ausgeblendet: aus,
  });
  if (!offen.length && !abgelehnt.length) return null;
  const warten = offen.filter((a) => leitungIn(a.gruppe)).length;
  const auf = bereichOffen(wahl, offen.length);
  const zeile = (a: Aufgabe): ToDoVorschlagZeile => {
    const v = a.vorschlag!;
    return {
      id: a.id,
      titel: a.text,
      text: warumVon(a),
      von: v.von,
      name: v.name,
      stand: v.stand,
      grund: v.grund ?? '',
      verlauf: [],
      zusatz:
        v.stand === 'offen'
          ? `${a.bis ? `bis ${datumText(a.bis)}` : 'ohne Frist'}${leitungIn(a.gruppe) ? '' : ' · wartet auf die Leitung'}`
          : undefined,
      aufgabe: a,
    };
  };
  const umschalten = (id: string) => setAufId(aufId === id ? null : id);
  return (
    <section className={styles.karte} aria-label="Vorgeschlagen">
      <BereichKopf
        titel="Vorgeschlagen"
        anzahl={irgendwoLeitung ? `${warten} warten auf dich` : `${offen.length} offen`}
        auf={auf}
        onKlick={() => setWahl(!auf)}
      />
      {auf && (
        <div className={styles.rumpf}>
          {offen.length > 0 && (
            <ul className={styles.liste}>
              {offen.map((a) => (
                <VorschlagZeile
                  key={a.id}
                  v={zeile(a)}
                  ich={ich}
                  direkt={false}
                  aktionen={aktionen(a)}
                  ohneMarke
                  texte={TEXTE}
                  auf={aufId === a.id}
                  onKlick={() => umschalten(a.id)}
                />
              ))}
            </ul>
          )}
          {abgelehnt.length > 0 && (
            <div>
              <div className={styles.gruppe}>Abgelehnt · verschwindet nach 7 Tagen</div>
              <ul className={styles.liste}>
                {abgelehnt.map((a) => (
                  <VorschlagZeile
                    key={a.id}
                    v={zeile(a)}
                    ich={ich}
                    direkt={false}
                    aktionen={{}}
                    texte={TEXTE}
                    auf={aufId === a.id}
                    onKlick={() => umschalten(a.id)}
                    abgelehnt={{
                      noch: vorschlagNoch(a, heute, zeitzone),
                      onWeg: () =>
                        ausblenden(
                          a.id,
                          liste.filter((x) => x.vorschlag?.stand === 'abgelehnt').map((x) => x.id),
                        ),
                    }}
                  />
                ))}
              </ul>
            </div>
          )}
          {!irgendwoLeitung && (
            <p className={styles.leer}>
              Übernimmt die Leitung deinen Vorschlag, wird er ein To-Do der Gruppe und verschwindet
              hier.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
