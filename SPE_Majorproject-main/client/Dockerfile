# --- Stage 1: Build the React Application ---
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies first
COPY package.json .
COPY package-lock.json .
RUN npm install

# Copy application source and build the static files
COPY . .
RUN npm run build 

# --- Stage 2: Serve the Static Files with Nginx (Production Ready) ---
FROM nginx:alpine

# Copy the built files from the 'builder' stage into Nginx's serving directory
COPY --from=builder /app/build /usr/share/nginx/html

# Expose Nginx port 
EXPOSE 80

# Command to start Nginx
CMD ["nginx", "-g", "daemon off;"]