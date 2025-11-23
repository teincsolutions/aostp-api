# Build stage
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Build argument for DATABASE_URL
ARG DATABASE_URL

# Set environment variable for Prisma generation
ENV DATABASE_URL=$DATABASE_URL

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install msmtp for email delivery
RUN apk add --no-cache msmtp ca-certificates gettext

# Set working directory
WORKDIR /app

# Copy package files
COPY --from=build /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy necessary files from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/scripts ./scripts
# Copy email templates for notifications
COPY --from=build /app/src/templates ./src/templates

# Copy msmtp template and startup script
COPY --from=build /app/msmtprc /etc/msmtprc.template
COPY --from=build /app/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port (can be overridden by PORT env var)
EXPOSE 3000

# Start the production server with msmtp setup
CMD ["/app/start.sh"]
