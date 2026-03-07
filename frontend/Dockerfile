# ── Frontend Dockerfile (multi-stage) ────────────────────────────────────────
# Stage 1 — build the Vite/React app
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline

# Copy source and build (VITE_API_BASE_URL injected at build time via --build-arg)
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# Stage 2 — serve with Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built bundle
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
