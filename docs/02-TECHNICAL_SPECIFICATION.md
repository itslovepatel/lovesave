# UniSave - Technical Specification

**Version:** 1.0  
**Date:** January 3, 2026

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CLIENT (React Native + Expo)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │Clipboard │  │  Zustand │  │  SQLite  │  │  Media   │            │
│  │ Monitor  │  │  Store   │  │ Database │  │  Player  │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       └──────────────┴──────────────┴──────────────┘                │
│                      Download Manager Service                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS / REST API
┌───────────────────────────┴─────────────────────────────────────────┐
│                     SERVER (Node.js + Express)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Parse   │  │  Stream  │  │  Batch   │  │  Health  │            │
│  │  Route   │  │  Route   │  │  Route   │  │  Route   │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       └──────────────┴──────────────┴──────────────┘                │
│                      Platform Handlers                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│  │YouTube │ │Insta   │ │TikTok  │ │Facebook│ │ Audio  │            │
│  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘            │
│      └──────────┴──────────┴──────────┴──────────┘                  │
│                      yt-dlp Wrapper                                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Mobile App Structure (React Native + Expo)

```
unisave-mobile/
├── app/                          # Expo Router screens
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab navigator config
│   │   ├── index.tsx             # Home screen
│   │   ├── library.tsx           # Library screen
│   │   ├── browser.tsx           # In-app browser
│   │   └── settings.tsx          # Settings screen
│   ├── download/[id].tsx         # Download modal
│   ├── player/[id].tsx           # Media player
│   └── _layout.tsx               # Root layout
├── components/
│   ├── ui/                       # Button, Card, Modal, Toast
│   ├── download/                 # DownloadCard, FormatSelector
│   ├── library/                  # FileGrid, FileContextMenu
│   ├── player/                   # VideoPlayer, AudioTrimmer
│   └── home/                     # URLInput, RecentDownloads
├── services/
│   ├── api/                      # API client
│   ├── clipboard/                # Monitor, validator
│   ├── download/                 # Manager, chunker
│   ├── storage/                  # MediaStore, filesystem
│   └── database/                 # SQLite operations
├── store/                        # Zustand stores
├── hooks/                        # Custom hooks
├── utils/                        # Helpers
└── constants/                    # Colors, fonts
```

---

## Backend Structure (Node.js + Express)

```
unisave-server/
├── src/
│   ├── index.ts                  # Entry point
│   ├── routes/
│   │   ├── parse.ts              # POST /api/parse
│   │   ├── stream.ts             # GET /api/stream/:id
│   │   └── batch.ts              # POST /api/batch
│   ├── handlers/
│   │   ├── youtube.ts            # YouTube (yt-dlp)
│   │   ├── instagram.ts          # Instagram
│   │   ├── tiktok.ts             # TikTok
│   │   ├── facebook.ts           # Facebook
│   │   ├── reddit.ts             # Reddit
│   │   └── audio.ts              # SoundCloud/Spotify
│   ├── services/
│   │   ├── ytdlp/                # yt-dlp CLI wrapper
│   │   └── cache/                # Redis caching
│   └── middleware/               # Rate limiter, CORS
├── Dockerfile
└── docker-compose.yml
```

---

## API Endpoints

### POST /api/parse

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=xyz",
  "cookies": "optional_for_private"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "unique_id",
    "platform": "youtube",
    "title": "Video Title",
    "thumbnail": "https://...",
    "duration": 240,
    "formats": [
      { "formatId": "22", "quality": "1080p", "type": "video", "filesize": 45000000 },
      { "formatId": "140", "quality": "320kbps", "type": "audio", "filesize": 5000000 }
    ]
  }
}
```

### GET /api/stream/:id?formatId=22

Returns proxied binary stream with proper headers for download.

### POST /api/batch

For parsing playlists/profiles - returns list of items with metadata.

---

## Database Schema (SQLite)

```sql
CREATE TABLE downloads (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  file_path TEXT UNIQUE,
  file_size INTEGER,
  file_type TEXT CHECK (file_type IN ('video','audio','image')),
  quality TEXT,
  duration INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  metadata TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX idx_downloads_type ON downloads(file_type);
CREATE INDEX idx_downloads_created ON downloads(created_at DESC);
```

---

## Key Dependencies

**Mobile (package.json):**
```json
{
  "expo": "~50.0.0",
  "expo-av": "~14.0.0",
  "expo-clipboard": "~5.0.0",
  "expo-file-system": "~16.0.0",
  "expo-media-library": "~16.0.0",
  "expo-sqlite": "~13.0.0",
  "expo-router": "~3.4.0",
  "zustand": "^4.5.0",
  "axios": "^1.6.0",
  "react-native-webview": "^13.8.0"
}
```

**Backend (package.json):**
```json
{
  "express": "^4.18.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "express-rate-limit": "^7.1.0",
  "redis": "^4.6.0",
  "zod": "^3.22.0"
}
```

---

## Platform URL Patterns

```typescript
const PATTERNS = {
  youtube: /(?:youtube\.com\/(?:watch|shorts)|youtu\.be)\//,
  instagram: /instagram\.com\/(p|reel|stories)/,
  tiktok: /tiktok\.com\/@[\w.-]+\/video/,
  facebook: /facebook\.com\/.*\/videos/,
  reddit: /reddit\.com\/r\/.*\/comments/,
  soundcloud: /soundcloud\.com\//,
  spotify: /open\.spotify\.com\/(track|album|playlist)/,
};
```

---

## Docker Deployment

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip ffmpeg
RUN pip3 install yt-dlp
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
ENV PORT=3000
CMD ["node", "dist/index.js"]
```
