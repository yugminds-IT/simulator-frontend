# Robo Coders simulator frontend: build the static site, serve it with nginx.
# /api is proxied to the backend (API_URL), so the sign-in cookie stays on this site's own domain.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# API_URL: where the simulator backend answers, e.g. https://simapi.yugminds.org or http://<backend-container>:3100 (no trailing slash)
ENV API_URL=http://backend:3100
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
