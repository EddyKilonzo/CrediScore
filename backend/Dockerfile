# ── Build stage ──────────────────────────────────────────────────────────────
# Build context is repo root; Dockerfile lives at backend/Dockerfile
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# .npmrc (legacy-peer-deps=true) is included in the COPY below
COPY backend/package*.json backend/.npmrc ./
COPY backend/prisma ./prisma/

# Install all deps
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy backend source and build
COPY backend/ .
RUN npm run build

# Prune devDependencies for the final image
RUN npm prune --omit=dev

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

# Copy pruned node_modules from builder — preserves all transitive/peer deps
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled output (nest build includes .ejs templates via nest-cli.json assets)
COPY --from=builder /app/dist ./dist

# Schema + migrations so `prisma migrate deploy` can run at container start (Neon/Postgres)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node

EXPOSE 3000

# Apply pending DB migrations before boot (fixes 500 when FraudReport columns are missing)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
