# Development Dockerfile for Next.js
FROM node:18-alpine

WORKDIR /webapp

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Next.js default port
EXPOSE 3000

# Start the development server
CMD ["npm", "run", "dev"]

