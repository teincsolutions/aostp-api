#!/bin/sh
set -e

echo "🚀 Starting database migration and seeding process..."

# Run database migrations
echo "🗃️ Running database migrations..."
npm run prisma:migrate:deploy

# Seed the database
echo "🌱 Seeding the database..."
node dist/seed.command.js

echo "✅ Database migration and seeding completed successfully!"
