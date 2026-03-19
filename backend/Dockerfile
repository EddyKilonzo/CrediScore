# ── Build stage ──────────────────────────────────────────────────────────────
# Build context is repo root; Dockerfile lives at backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install all deps (including devDeps needed for build)
RUN npm ci --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate

# Copy backend source and build
COPY backend/ .
RUN npm run build

# Prune devDependencies so node_modules is production-only for the final image
RUN npm prune --omit=dev

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy pruned node_modules from builder — preserves all transitive/peer deps
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled output (nest build includes .ejs templates via nest-cli.json assets)
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
