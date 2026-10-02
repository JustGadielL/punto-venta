FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build typescript to dist
RUN npm run build

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Create local data folder fallback
RUN mkdir -p /app/data

EXPOSE 4000

CMD ["node", "dist/index.js"]
