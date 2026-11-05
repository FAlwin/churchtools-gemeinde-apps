# Zwei Stufen (#849): Die erste baut die Web-App mit allen Werkzeugen, die zweite enthält nur, was zur Laufzeit
# gebraucht wird – Server, geteilte Regeln, die fertige Web-App und die Laufzeit-Abhängigkeiten. Vorher steckten
# Vite, Vitest, ESLint & Co. im ausgelieferten Image (und damit jede ihrer Lücken); `npm audit --omit=dev` sah sie
# nicht, obwohl sie im Container lagen. Geprüft wird das Image in der CI (`ci.yml`, Job „docker-start“).

# ── Stufe 1: die Web-App bauen ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS bau
WORKDIR /app
# Erst nur die Manifeste kopieren (besseres Caching der Installation)
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
RUN npm ci
COPY . .
# App-Version: vom CI aus dem Git-Tag als Build-Arg übergeben (z. B. v2.1.5); lokal „dev".
# Vite stellt VITE_*-Variablen zur Build-Zeit als import.meta.env bereit → Anzeige im Mehr-Tab.
ARG APP_VERSION=dev
RUN VITE_APP_VERSION="$APP_VERSION" npm run build --workspace=client

# ── Stufe 2: Laufzeit ────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine

# su-exec: erlaubt dem Entrypoint, nach dem Übereignen des Volumes die Rechte sauber abzugeben
# und die App als unprivilegierten Benutzer „node" zu starten.
RUN apk add --no-cache su-exec

WORKDIR /app

# Nur die Laufzeit-Abhängigkeiten von Server und geteilten Regeln. `tsx` gehört dazu (der Server läuft als
# TypeScript, siehe `server/package.json` → `start`).
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
RUN npm ci --omit=dev --workspace=server --workspace=shared && npm cache clean --force

# Server + geteilte Regeln als Quelltext (tsx liest die Pfade aus server/tsconfig.json → tsconfig.base.json),
# die Web-App fertig gebaut aus Stufe 1.
COPY tsconfig.base.json ./
COPY server ./server
COPY shared ./shared
COPY --from=bau /app/client/dist ./client/dist

# Auch der Server kennt seine Version – Staging (`staging-…`) zieht die alte Ablage nicht nach ChurchTools um.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

ENV NODE_ENV=production
ENV PORT=3001
# HOME + npm-Cache auf beschreibbare Pfade legen, damit npm auch als non-root „node" läuft.
ENV HOME=/home/node
ENV npm_config_cache=/tmp/.npm
# Laufzeit-Branding (White-Label) + kontobezogene Anmerkungen liegen im Volume /app/data – überstehen Updates.
ENV SITE_CONFIG_PATH=/app/data/site.json
ENV ANNOTATIONS_PATH=/app/data/annotations
ENV CAPABILITIES_CACHE_PATH=/app/data/capabilities-cache.json
ENV SEEN_SETLISTS_PATH=/app/data/seen-setlists.json
EXPOSE 3001
VOLUME ["/app/data"]

# Lebenszeichen-Check: Docker/Container-Manager erkennt, ob die App wirklich antwortet
# (busybox-wget ist in node:alpine vorhanden). Greift auf den öffentlichen Health-Endpunkt zu.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3001/api/health || exit 1

# Entrypoint übereignet das Daten-Volume dem node-User und startet die App dann als node (non-root).
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]

# Server starten (liefert /api + die gebaute App unter client/dist aus)
CMD ["npm", "run", "start", "--workspace=server"]
