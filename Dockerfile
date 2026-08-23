# Multi-stage build for KuriScribe
# Stage 1: Build Frontend (Vite + React + TS)
FROM node:20-alpine AS frontend-builder
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .
RUN pnpm build

# Stage 2: Runtime Environment (Python 3.11 + FFmpeg)
FROM python:3.11-slim AS runner

WORKDIR /app

# Install system dependencies including FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy built frontend and server code
COPY --from=frontend-builder /app/dist ./dist
COPY services ./services
COPY server.py .
COPY desktop.py .

EXPOSE 3000

ENV PORT=3000
ENV PYTHONUNBUFFERED=1

CMD ["python", "server.py"]
