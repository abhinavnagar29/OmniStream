# Multi-stage build: builds the Vite frontend AND the Express backend into a
# single image that serves both (server.js already serves dist/ when
# NODE_ENV=production -- see docs/deployment.md "Path A").
#
# If you're doing a split deploy instead (backend on Render, frontend on
# Vercel -- docs/deployment.md "Path B"), this Dockerfile still works fine
# for the backend-only Render service; the frontend build stage's output
# just goes unused there, which costs a bit of build time but nothing else.
# Split it into two Dockerfiles later if that build time starts to matter.

FROM node:20-slim AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS backend-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-deps /app/node_modules ./node_modules
COPY --from=frontend-build /app/dist ./dist
COPY backend ./backend
COPY scripts ./scripts
COPY server.js ./
COPY package*.json ./
EXPOSE 5050
CMD ["node", "server.js"]
