# Use Node 18 Alpine (lightweight Linux)
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first (better caching)
COPY package*.json ./

# Install ONLY production dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on (Render uses 10000 by default)
EXPOSE 10000

# Set environment variable for port (optional, but good practice)
ENV PORT=10000
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
