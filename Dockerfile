# Build the app with Node, then serve the static files with nginx, which also forwards
# /api and /health to the backend so the app and API share one origin.
FROM node:22.23.3-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# --build-arg VITE_DEMO_MODE=true builds the public showcase (one-click sign-in per role).
ARG VITE_DEMO_MODE=false
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
RUN npm run build

FROM nginx:1.31.7-alpine
# The official image fills in ${SETU_API_URL} from the environment when the container starts.
ENV SETU_API_URL=http://host.docker.internal:3000
COPY nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
