# Stage 1: Build
FROM node:20-alpine as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Origem do portal mock (iframe mãe em smartkaits.sanjaworks.com/portal/) para postMessage seguro.
ARG VITE_EMBED_ALLOWED_ORIGINS=https://smartkaits.sanjaworks.com
ENV VITE_EMBED_ALLOWED_ORIGINS=$VITE_EMBED_ALLOWED_ORIGINS
ARG BUILD_ID=2026-06-01-n
ENV BUILD_ID=$BUILD_ID

RUN npm run build

# Stage 2: Serve
FROM nginx:stable-alpine as production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx-default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
