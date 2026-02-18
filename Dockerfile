# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock .yarnrc ./
COPY scripts ./scripts
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# Production stage
FROM caddy:2-alpine
COPY --from=builder /app/dist /srv/dist
COPY Caddyfile /etc/caddy/Caddyfile
ENV NODE_ENV=production
