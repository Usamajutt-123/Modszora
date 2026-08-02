# ── build ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/agent/package.json apps/agent/
RUN npm install --omit=optional --workspaces --include-workspace-root

COPY packages/shared ./packages/shared
COPY apps/agent ./apps/agent
RUN npm run build -w @modverse/shared \
 && npm run build -w @modverse/agent

# ── runtime ──────────────────────────────────────────────────────────
# Playwright's image ships Chromium plus every system library it needs.
FROM mcr.microsoft.com/playwright:v1.49.1-jammy AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/apps/agent/package.json ./apps/agent/package.json
COPY --from=builder /repo/apps/agent/dist ./apps/agent/dist

# Run unprivileged — the Playwright image provides this user.
USER pwuser

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/agent/dist/index.js"]
