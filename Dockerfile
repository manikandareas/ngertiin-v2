# syntax=docker/dockerfile:1
# Build from the monorepo root; workspace packages export TypeScript sources.
FROM oven/bun:1.3.10 AS source
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/www/package.json ./apps/www/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/storage/package.json ./packages/storage/package.json

FROM source AS build
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker
COPY packages ./packages
COPY tsconfig.base.json ./
RUN cd apps/api && bun run build
RUN cd apps/worker && bun run build

FROM source AS runtime
ENV NODE_ENV=production
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --production
COPY packages ./packages
USER bun

FROM runtime AS api
COPY --from=build /app/apps/api/dist /app/apps/api/dist
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["bun", "dist/main.js"]

FROM runtime AS worker
COPY --from=build /app/apps/worker/dist /app/apps/worker/dist
WORKDIR /app/apps/worker
CMD ["bun", "dist/main.js"]

# Drizzle Kit is a development dependency, retained only in this release target.
FROM build AS migrate
ENV NODE_ENV=production
USER bun
WORKDIR /app/packages/database
CMD ["bun", "run", "db:migrate"]
