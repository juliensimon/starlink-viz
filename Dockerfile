# --- Build stage ---
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV DEMO_MODE=true
ENV NEXT_PUBLIC_HF_SPACE=true
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- Runtime stage ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV DEMO_MODE=true
ENV PORT=7860
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built app and production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/postcss.config.mjs ./
COPY --from=builder /app/tsconfig.json ./

EXPOSE 7860

CMD ["npx", "tsx", "server.ts"]
