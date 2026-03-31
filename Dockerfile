# Frontend Dockerfile
# Stage 1: Build the Vite application
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm i
COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Completely suppress Nginx Docker entrypoint startup info logs
ENV NGINX_ENTRYPOINT_QUIET_LOGS=1

RUN rm -rf /usr/share/nginx/html/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80

# Run nginx in foreground and suppress global notice logs!
CMD ["nginx", "-g", "daemon off; error_log /dev/stderr warn;"]
