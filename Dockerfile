FROM node:20-bookworm-slim

# Prisma engines need OpenSSL; slim Debian image requires installing it
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# --- LLM configuration ---
# Safe default is MOCK mode (no key needed) so the public image runs on any laptop.
# Pass LLM_PROVIDER=openrouter + a key as build args for a live demo image.
ARG LLM_PROVIDER=mock
ARG LLM_BASE_URL=
ARG LLM_API_KEY=
ARG LLM_MODEL=nex-agi/nex-n2.5-pro:free
ARG LLM_SMALL_MODEL=nex-agi/nex-n2.5-pro:free
ENV LLM_PROVIDER=$LLM_PROVIDER \
    LLM_BASE_URL=$LLM_BASE_URL \
    LLM_API_KEY=$LLM_API_KEY \
    LLM_MODEL=$LLM_MODEL \
    LLM_SMALL_MODEL=$LLM_SMALL_MODEL \
    DATABASE_URL=file:./dev.db

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# Normalize line endings (guards against Windows CRLF from git checkout)
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Start the app (seed runs automatically via docker-entrypoint.sh)
CMD ["sh", "docker-entrypoint.sh"]
