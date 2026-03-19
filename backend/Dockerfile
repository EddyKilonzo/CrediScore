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

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy only what's needed at runtime
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install production deps only
RUN npm ci --omit=dev --legacy-peer-deps

# Re-generate Prisma client in production image
RUN npx prisma generate

# Copy compiled output (nest build includes .ejs templates via nest-cli.json assets)
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
