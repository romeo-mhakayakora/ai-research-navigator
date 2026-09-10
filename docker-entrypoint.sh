#!/bin/sh
set -e

echo "=== Euler: AI Research Navigator ==="

# Initialize database schema
echo "Setting up database..."
npx prisma db push --skip-generate

# Seed demo project (idempotent — safe to run every time)
echo "Seeding demo project..."
npm run db:seed

# Start the application
echo "Starting application..."
exec npm run start
