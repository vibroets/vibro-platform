# Step 1: Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Force install deps with compatibility
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

# Step 2: Production Stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/.next/standalone ./

COPY --from=builder /app/.next/static ./.next/static

COPY --from=builder /app/.next/server ./.next/server

COPY --from=builder /app/public ./public

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]