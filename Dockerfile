# ---------------- base -------
FROM node:20-alpine AS base
WORKDIR /app

# ---------------- deps ----------------
FROM base AS deps
RUN apk add --no-cache libc6-compat

COPY package.json ./
RUN npm install

# ---------------- builder ----------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------------- runner ----------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nestjs

# Copy only required files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
COPY *.json ./

# Copy uploads to a seed directory (volume will overlay /app/uploads)
COPY uploads ./uploads-seed
RUN chown -R nestjs:nodejs /app/uploads-seed

# Create uploads dir (will be overlaid by volume mount)
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nestjs

EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]
