FROM node:18-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --verbose

# Copy all files
COPY . .

# Copy the database file
COPY calendar.db ./

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "calendar-api.js"]