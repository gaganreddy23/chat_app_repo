FROM node:18.0.0-alpine

# Set working directory
WORKDIR /

# Copy the package.json files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the backend code
COPY . .

# Set memory limits for Node.js (optional but helpful for large apps)
ENV NODE_OPTIONS=--max_old_space_size=1024

# Expose the port for the backend
EXPOSE 8080

# Start the app in development mode
CMD ["npm", "run", "start"] 
