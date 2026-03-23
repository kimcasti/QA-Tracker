FROM node:20-bookworm-slim AS build
WORKDIR /app

ARG VITE_API_URL
ARG VITE_GEMINI_API_KEY
ARG VITE_API_IDENTIFIER
ARG VITE_API_PASSWORD
ARG VITE_USE_SERVICE_AUTH=false

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
ENV VITE_API_IDENTIFIER=$VITE_API_IDENTIFIER
ENV VITE_API_PASSWORD=$VITE_API_PASSWORD
ENV VITE_USE_SERVICE_AUTH=$VITE_USE_SERVICE_AUTH

COPY . .

RUN rm -rf node_modules package-lock.json

# Recreate a clean Linux dependency tree inside the container so native optional
# packages like Rollup and Lightning CSS resolve correctly on Railway.
RUN npm install

RUN npm run build

FROM nginx:1.27-alpine AS runtime
ENV PORT=8080

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
