# UniSave - Universal Media Downloader

A cross-platform mobile app for downloading media from YouTube, Instagram, TikTok, and more.

## Project Structure

```
abcgravity/
├── docs/                        # Documentation
│   ├── 01-PRODUCT_REQUIREMENTS.md
│   ├── 02-TECHNICAL_SPECIFICATION.md
│   └── 03-UI_UX_DESIGN.md
│
├── unisave-mobile/              # React Native (Expo) Mobile App
│   ├── app/                     # Expo Router screens
│   ├── components/              # UI components
│   ├── services/                # API, download, database services
│   ├── store/                   # Zustand state management
│   ├── hooks/                   # Custom React hooks
│   ├── constants/               # Theme, platforms config
│   └── utils/                   # Utilities
│
└── unisave-server/              # Node.js Backend API
    ├── src/
    │   ├── routes/              # Express routes
    │   ├── handlers/            # Platform handlers
    │   ├── middleware/          # Express middleware
    │   └── utils/               # Utilities
    ├── Dockerfile
    └── docker-compose.yml
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- yt-dlp (for backend)
- Docker (optional, for deployment)

### Mobile App Setup

```bash
cd unisave-mobile
npm install
npx expo start
```

### Backend Server Setup

```bash
cd unisave-server
npm install
cp .env.example .env
npm run dev
```

### Docker Deployment

```bash
cd unisave-server
docker-compose up -d
```

## Features

- ✅ Smart Clipboard Monitor
- ✅ Multi-platform support (YouTube, Instagram, TikTok, Facebook, Reddit)
- ✅ Multiple quality/format options
- ✅ Multi-threaded chunked downloads
- ✅ In-app browser for private content
- ✅ Local SQLite database for download history
- ✅ Background downloads
- ✅ Dark/Light theme

## Tech Stack

| Component | Technology |
|-----------|------------|
| Mobile Framework | React Native + Expo |
| State Management | Zustand |
| Navigation | Expo Router |
| Backend | Node.js + Express |
| Download Engine | yt-dlp |
| Database | SQLite (mobile), Redis (server cache) |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/parse` | Parse URL and get formats |
| GET | `/api/stream/:id` | Proxy stream download |
| POST | `/api/batch` | Parse playlist |
| GET | `/api/health` | Health check |

## License

This project is for educational purposes. Ensure compliance with platform Terms of Service.
