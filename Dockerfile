FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/user-authentication/package*.json ./backend/user-authentication/
COPY backend/admin-service/package*.json ./backend/admin-service/
COPY backend/client-service/package*.json ./backend/client-service/
COPY backend/llm-booking-service/package*.json ./backend/llm-booking-service/

# Install dependencies
RUN npm install
RUN cd backend/user-authentication && npm install
RUN cd ../admin-service && npm install
RUN cd ../client-service && npm install
RUN cd ../llm-booking-service && npm install

# Copy application code
COPY . .

# Create database directory
RUN mkdir -p backend/shared-db

# Expose ports
EXPOSE 5001 6001 7005 5003

# Start script
CMD ["node", "backend/server.js"]