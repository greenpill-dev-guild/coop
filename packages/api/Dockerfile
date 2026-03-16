FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --production
COPY src/ src/
COPY config.ts ./
EXPOSE 8080
ENV HOST=0.0.0.0
ENV PORT=8080
CMD ["bun", "run", "src/index.ts"]
