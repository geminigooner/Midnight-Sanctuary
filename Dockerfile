FROM node:22-slim

WORKDIR /app

# Copy package manifests and install all dependencies required to build and run
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy application source and configuration
COPY . .

# Build Vite frontend client and esbuild production server bundle (dist/server.cjs)
RUN npm run build

# Cloud Run injects PORT (defaults to 8080 in container; server.ts falls back to 3000 in local dev)
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
