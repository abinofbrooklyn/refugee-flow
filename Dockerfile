# Stage 1: builder — compile TypeScript to JavaScript
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files and install all deps (including devDependencies for tsc)
# --legacy-peer-deps: eslint-config-airbnb@19 requires eslint@^8, project uses eslint@10
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy TypeScript config and server source
COPY tsconfig.server.json ./
COPY server/ ./server/
COPY db/ ./db/
COPY scripts/ ./scripts/

# Compile TypeScript to JavaScript, overriding noEmit: true from tsconfig
RUN npx tsc -p tsconfig.server.json --noEmit false --outDir dist-server

# Stage 2: production — lean runtime image
FROM node:22-alpine AS production
WORKDIR /app

# Install production dependencies only
# --legacy-peer-deps: eslint-config-airbnb@19 requires eslint@^8, project uses eslint@10
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy compiled server output
COPY --from=builder /app/dist-server ./dist-server

# Copy db directory for knex migrations at runtime
COPY --from=builder /app/db ./db

# Copy JSON dataset files loaded by dataController at runtime
COPY server/controllers/api/data/datasets/ ./server/controllers/api/data/datasets/

ENV NODE_ENV=production
ENV PORT=2700
EXPOSE 2700

CMD ["node", "dist-server/server.js"]
