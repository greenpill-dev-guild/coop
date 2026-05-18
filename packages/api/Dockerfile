FROM oven/bun:1.3.10-alpine
WORKDIR /app
# Build context must be the repo root so the lockfile is available.
# Deploy with: fly deploy -c packages/api/fly.toml from repo root
COPY package.json bun.lock bunfig.toml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/app/package.json packages/app/
COPY packages/extension/package.json packages/extension/
COPY docs/package.json docs/
RUN bun install --frozen-lockfile
COPY packages/shared/src/ packages/shared/src/
RUN bun run --filter @coop/shared build
COPY packages/api/src/ packages/api/src/
COPY packages/api/config.ts packages/api/
WORKDIR /app/packages/api
EXPOSE 8080
ENV HOST=0.0.0.0
ENV PORT=8080
CMD ["bun", "run", "src/index.ts"]
