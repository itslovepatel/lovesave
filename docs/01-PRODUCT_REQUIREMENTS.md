# UniSave - Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** January 3, 2026  
**Author:** Product Team

---

## Executive Summary

UniSave is a cross-platform mobile application that enables users to download media content from popular social media and streaming platforms. The app focuses on speed, automation, and a seamless user experience, positioning itself as the "Swiss Army Knife" for media downloading.

---

## Product Vision

> "Save anything, anywhere, instantly."

UniSave empowers users to effortlessly save their favorite content for offline access, eliminating the friction of platform-specific limitations and complex download processes.

---

## Target Users

### Primary Personas

| Persona | Description | Pain Points |
|---------|-------------|-------------|
| **Content Creator** | Repurposes content across platforms | Needs quick access to source files, hates watermarks |
| **Music Enthusiast** | Builds offline playlists | Wants high-quality audio, proper metadata |
| **Casual User** | Saves memes, videos to share | Frustrated by complicated download websites |
| **Traveler** | Downloads content before flights | Needs batch downloading, offline access |

---

## Supported Platforms

| Platform | Content Types | Priority |
|----------|---------------|----------|
| **YouTube** | Videos, Shorts, Music, Playlists | P0 (Must Have) |
| **Instagram** | Reels, Posts, Stories, IGTV | P0 (Must Have) |
| **TikTok** | Videos (watermark-free) | P0 (Must Have) |
| **Facebook** | Videos, Reels | P1 (Should Have) |
| **Reddit** | Videos, GIFs | P1 (Should Have) |
| **SoundCloud** | Audio tracks, Playlists | P2 (Nice to Have) |
| **Spotify** | Track metadata only* | P2 (Nice to Have) |

*Spotify DRM prevents direct download; app fetches metadata for library organization.

---

## Functional Requirements

### FR-001: Smart Clipboard Monitor

| ID | Requirement |
|----|-------------|
| FR-001.1 | App SHALL run a background service that monitors clipboard changes |
| FR-001.2 | App SHALL detect when a supported URL is copied |
| FR-001.3 | App SHALL display a toast notification with "Download" action within 500ms |
| FR-001.4 | User SHALL be able to disable clipboard monitoring in settings |
| FR-001.5 | Service SHALL NOT consume more than 1% battery over 24 hours |

### FR-002: URL Parsing & Platform Detection

| ID | Requirement |
|----|-------------|
| FR-002.1 | App SHALL accept URLs via clipboard, manual paste, or share intent |
| FR-002.2 | App SHALL identify platform from URL within 100ms client-side |
| FR-002.3 | App SHALL handle shortened URLs (bit.ly, t.co, etc.) |
| FR-002.4 | App SHALL display appropriate error for unsupported URLs |

### FR-003: Download Engine

| ID | Requirement |
|----|-------------|
| FR-003.1 | App SHALL support concurrent downloads (configurable 1-5) |
| FR-003.2 | App SHALL split large files (>50MB) into chunks for faster download |
| FR-003.3 | App SHALL resume interrupted downloads automatically |
| FR-003.4 | App SHALL display accurate progress (percentage, speed, ETA) |
| FR-003.5 | App SHALL support background downloading when app is minimized |

### FR-004: Format Selection

**Video Formats:**

| Container | Codecs | Resolutions |
|-----------|--------|-------------|
| MP4 | H.264, VP9 | 360p, 480p, 720p, 1080p, 1440p, 4K |

**Audio Formats:**

| Format | Bitrates |
|--------|----------|
| MP3 | 128kbps, 192kbps, 256kbps, 320kbps |
| M4A/AAC | Original quality |
| WAV | Lossless (optional) |

**Image Formats:**

| Format | Quality |
|--------|---------|
| JPG | Original, 80%, 60% |
| PNG | Lossless |
| WEBP | Original |

### FR-005: Metadata Handling

| ID | Requirement |
|----|-------------|
| FR-005.1 | Audio downloads SHALL include embedded ID3 tags (Title, Artist, Album) |
| FR-005.2 | Audio downloads SHALL include embedded cover art when available |
| FR-005.3 | Video downloads SHALL preserve or generate descriptive filename |
| FR-005.4 | User SHALL be able to edit metadata before/after download |

### FR-006: Batch Downloading

| ID | Requirement |
|----|-------------|
| FR-006.1 | App SHALL detect playlist/channel/profile URLs |
| FR-006.2 | App SHALL display list of items with select all/none toggles |
| FR-006.3 | App SHALL support "Download First N" for large playlists |
| FR-006.4 | App SHALL download batch items sequentially with unified progress |

### FR-007: Post-Processing Tools

| ID | Requirement |
|----|-------------|
| FR-007.1 | Audio Trimmer: Select start/end timestamps before download |
| FR-007.2 | MP3 Converter: Toggle to extract audio from any video |
| FR-007.3 | Media Player: Native playback with background audio support |
| FR-007.4 | File Manager: Browse, rename, delete, share downloaded files |

### FR-008: In-App Browser

| ID | Requirement |
|----|-------------|
| FR-008.1 | WebView SHALL support login to platform accounts |
| FR-008.2 | Browser SHALL detect media on page and show download overlay |
| FR-008.3 | Browser SHALL pass session cookies to download engine |
| FR-008.4 | User SHALL be able to manually trigger download from current page |

---

## Non-Functional Requirements

### NFR-001: Performance

| Metric | Target |
|--------|--------|
| App cold start | < 2 seconds |
| URL parse response | < 3 seconds |
| Download speed | ≥ 80% of available bandwidth |
| Battery consumption | < 2% per hour during active download |
| Memory usage | < 150MB average |

### NFR-002: Reliability

| Metric | Target |
|--------|--------|
| Crash-free sessions | > 99.5% |
| Download success rate | > 95% |
| Background service uptime | > 99% |

### NFR-003: Compatibility

| Platform | Minimum Version |
|----------|-----------------|
| Android | 8.0 (API 26) |
| iOS | 14.0 |

### NFR-004: Security

| Requirement |
|-------------|
| All API communication SHALL use HTTPS |
| No user credentials SHALL be stored on backend |
| Session cookies SHALL be encrypted at rest |
| App SHALL NOT access contacts, camera, or location |

---

## User Stories

### Epic: Core Download Flow

```
As a USER
I want to copy a YouTube link and see a download prompt
So that I can save videos with minimal friction

Acceptance Criteria:
- Copying link shows toast within 1 second
- Tapping toast opens download modal
- Modal shows thumbnail, title, quality options
- Download completes and saves to library
```

### Epic: Library Management

```
As a USER
I want to browse all my downloaded content in one place
So that I can easily find and replay my saved media

Acceptance Criteria:
- Library shows grid of thumbnails
- Filter by type (Video/Audio/Image)
- Long-press reveals context menu
- Built-in player for instant playback
```

### Epic: Private Content Access

```
As a USER
I want to download my private Instagram stories
So that I can save memories from my own account

Acceptance Criteria:
- In-app browser allows Instagram login
- Logged-in session persists
- Download button appears on private content
- Content saves without errors
```

---

## Out of Scope (v1.0)

| Feature | Reason |
|---------|--------|
| Desktop/Web app | Mobile-first, cross-platform later |
| Cloud sync | Privacy concerns, storage costs |
| Social features | Keep app focused on utility |
| Ad-supported free tier | Premium only model |
| Netflix/Amazon Prime | DRM protection |

---

## Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Monthly Active Users (MAU) | 50,000 |
| Daily Downloads per User | 3.5 |
| App Store Rating | 4.5+ ★ |
| D7 Retention | 40% |
| Download Success Rate | 95%+ |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Platform API changes break parsers | High | Modular handlers, rapid update pipeline |
| App store rejection | High | Clear disclaimer, user responsibility messaging |
| Copyright takedown requests | Medium | Honor DMCA, geo-restrict if needed |
| High server costs | Medium | Aggressive caching, CDN optimization |
| User IP bans from platforms | Low | All scraping on server side |

---

## Appendix: Competitive Analysis

| App | Platforms | Key Differentiator | Weakness |
|-----|-----------|-------------------|----------|
| Snaptube | YT, IG, FB | Large user base | Android only, ads |
| VidMate | 1000+ sites | Breadth | Bloated, security concerns |
| 4K Downloader | YT, FB, TW | Desktop quality | No mobile app |
| **UniSave** | YT, IG, TT, FB, SC | Clean UX, clipboard automation | New entrant |
