# Frontend image: build the Vite app, then serve the static files with nginx.
# Build context is frontend/ (see infra/docker-compose.yml).

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# In the container the frontend calls the backend through nginx at /api (see nginx.conf).
ARG VITE_API_URL=/api
ARG VITE_USE_MOCK=false
ENV VITE_API_URL=$VITE_API_URL \
    VITE_USE_MOCK=$VITE_USE_MOCK

RUN npm run build

# ---- Serve stage ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=infra nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
