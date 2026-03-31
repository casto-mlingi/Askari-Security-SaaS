# Frontend Dockerfile
# This Dockerfile is designed to build the Vite/React SPA and serve it using Nginx,
# whilst silencing the noisy [notice] startup logs requested by the user.

# Stage 1: Build the Vite application
FROM node:22-alpine AS builder

WORKDIR /app
# Copy dependency maps and install
COPY package.json package-lock.json* ./
# Try to install dependencies; fallback to npm i if package-lock is out of sync or missing
RUN npm ci || npm i

# Copy the rest of the application code
COPY . .

# Build the project
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the custom nginx configuration which suppresses [notice] logs and fixes SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
