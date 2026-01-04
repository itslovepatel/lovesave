FROM node:20-slim

# Install yt-dlp, ffmpeg, and deno (for YouTube JS extraction)
RUN apt-get update && apt-get install -y \
  python3 \
  python3-pip \
  ffmpeg \
  curl \
  unzip \
  && rm -rf /var/lib/apt/lists/*

# Install Deno (required for yt-dlp YouTube extraction)
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev for build)
RUN npm ci

# Copy app source
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV DENO_INSTALL=/usr/local
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# Start the server
CMD ["node", "dist/index.js"]
