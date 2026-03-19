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

# Install OpenSSL 1.1 compat so the Prisma linux-musl engine binary can load libssl.so.1.1
RUN apk add --no-cache openssl openssl1.1-compat

WORKDIR /app

# Copy pruned node_modules from builder — preserves all transitive/peer deps
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled output (nest build includes .ejs templates via nest-cli.json assets)
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
