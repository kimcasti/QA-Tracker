FROM node:20-alpine AS build
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

COPY package.json package-lock.json* yarn.lock* ./

RUN if [ -f package-lock.json ]; then npm ci; else yarn install --frozen-lockfile; fi

COPY . .

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
