FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy all files
COPY . .

# Install all dependencies
RUN npm install

# Install backend service dependencies
RUN cd backend/user-authentication && npm install
RUN cd backend/admin-service && npm install  
RUN cd backend/client-service && npm install
RUN cd backend/llm-booking-service && npm install

# Create database directory
RUN mkdir -p backend/shared-db

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "backend/server.js"]