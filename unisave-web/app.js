// ===================================
// UniSave Web - Application JavaScript
// ===================================

// Configuration
const CONFIG = {
    // API Base URL - Production server on Render
    API_BASE_URL: 'https://lovesave-api.onrender.com',
    // For local development: 'http://localhost:3000'

    // Request timeout in milliseconds
    TIMEOUT: 60000,
};

// State
let currentVideoData = null;

// DOM Elements
const elements = {
    urlInput: null,
    downloadBtn: null,
    pasteBtn: null,
    clearBtn: null,
    resultSection: null,
    errorMessage: null,
    serverStatus: null,
};

// ===================================
// Initialize App
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initEventListeners();
    checkServerStatus();
    initFAQ();
});

function initElements() {
    elements.urlInput = document.getElementById('urlInput');
    elements.downloadBtn = document.getElementById('downloadBtn');
    elements.pasteBtn = document.getElementById('pasteBtn');
    elements.clearBtn = document.getElementById('clearBtn');
    elements.resultSection = document.getElementById('resultSection');
    elements.errorMessage = document.getElementById('errorMessage');
    elements.serverStatus = document.getElementById('serverStatus');
}

function initEventListeners() {
    // URL Input
    elements.urlInput.addEventListener('input', handleInputChange);
    elements.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !elements.downloadBtn.disabled) {
            handleDownload();
        }
    });

    // Buttons
    elements.downloadBtn.addEventListener('click', handleDownload);
    elements.pasteBtn.addEventListener('click', handlePaste);
    elements.clearBtn.addEventListener('click', handleClear);
    document.getElementById('errorClose').addEventListener('click', hideError);
    document.getElementById('newDownloadBtn').addEventListener('click', handleNewDownload);

    // Smooth scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const navHeight = document.querySelector('.navbar').offsetHeight;
                const targetPos = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;
                window.scrollTo({ top: targetPos, behavior: 'smooth' });
            }
        });
    });
}

// ===================================
// Input Handlers
// ===================================
function handleInputChange() {
    const url = elements.urlInput.value.trim();
    const isValid = isValidUrl(url);

    elements.downloadBtn.disabled = !isValid;

    // Toggle paste/clear buttons
    if (url.length > 0) {
        elements.pasteBtn.classList.add('hidden');
        elements.clearBtn.classList.remove('hidden');
    } else {
        elements.pasteBtn.classList.remove('hidden');
        elements.clearBtn.classList.add('hidden');
    }

    // Hide error if input changes
    hideError();
}

async function handlePaste() {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            elements.urlInput.value = text;
            handleInputChange();

            // Auto-submit if valid URL
            if (isValidUrl(text)) {
                handleDownload();
            }
        }
    } catch (err) {
        console.log('Clipboard access denied');
        elements.urlInput.focus();
    }
}

function handleClear() {
    elements.urlInput.value = '';
    handleInputChange();
    elements.urlInput.focus();
}

function handleNewDownload() {
    elements.resultSection.classList.add('hidden');
    elements.urlInput.value = '';
    handleInputChange();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
        elements.urlInput.focus();
    }, 500);
}

// ===================================
// Download Handler
// ===================================
async function handleDownload() {
    const url = elements.urlInput.value.trim();

    if (!isValidUrl(url)) {
        showError('Please enter a valid URL');
        return;
    }

    // Show loading state
    setLoading(true);
    hideError();

    try {
        // Parse the URL
        const response = await fetchWithTimeout(`${CONFIG.API_BASE_URL}/api/parse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to parse URL');
        }

        // Store the video data
        currentVideoData = data.data;

        // Display results
        displayResults(data.data);

    } catch (error) {
        console.error('Download error:', error);
        showError(error.message || 'Failed to analyze the URL. Please try again.');
    } finally {
        setLoading(false);
    }
}

// ===================================
// Display Results
// ===================================
function displayResults(data) {
    // Update thumbnail
    const thumbnail = document.getElementById('videoThumbnail');
    thumbnail.src = data.thumbnail || '';
    thumbnail.alt = data.title || 'Video thumbnail';

    // Update title
    document.getElementById('videoTitle').textContent = data.title || 'Untitled';

    // Update duration
    const durationBadge = document.getElementById('videoDuration');
    durationBadge.textContent = formatDuration(data.duration);

    // Update platform
    const platformBadge = document.getElementById('platformBadge');
    platformBadge.querySelector('.platform-name').textContent = capitalizeFirst(data.platform);
    platformBadge.className = `platform-badge ${data.platform}`;

    // Update author
    document.getElementById('videoAuthor').innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>
        ${data.uploader || data.author || 'Unknown'}
    `;

    // Update views (if available)
    const viewsEl = document.getElementById('videoViews');
    if (data.viewCount) {
        viewsEl.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
            ${formatNumber(data.viewCount)} views
        `;
        viewsEl.style.display = 'flex';
    } else {
        viewsEl.style.display = 'none';
    }

    // Populate formats
    populateFormats(data);

    // Show result section
    elements.resultSection.classList.remove('hidden');

    // Scroll to results
    setTimeout(() => {
        elements.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function populateFormats(data) {
    const videoFormatsList = document.getElementById('videoFormatsList');
    const audioFormatsList = document.getElementById('audioFormatsList');
    const videoFormatsSection = document.getElementById('videoFormats');
    const audioFormatsSection = document.getElementById('audioFormats');

    videoFormatsList.innerHTML = '';
    audioFormatsList.innerHTML = '';

    const formats = data.formats || [];

    // Separate video and audio formats
    const videoFormats = formats.filter(f =>
        f.type === 'video' ||
        (f.ext === 'mp4' && !f.audioOnly) ||
        f.quality?.includes('p') ||
        f.resolution
    );

    const audioFormats = formats.filter(f =>
        f.type === 'audio' ||
        f.audioOnly ||
        f.ext === 'mp3' ||
        f.ext === 'm4a' ||
        f.quality?.toLowerCase().includes('audio')
    );

    // Add "Best" option for video
    if (data.type !== 'image') {
        videoFormatsList.appendChild(createFormatOption({
            formatId: 'best',
            quality: 'Best Quality',
            size: 'Recommended',
            ext: 'mp4',
        }, data.url));
    }

    // Populate video formats
    videoFormats.forEach(format => {
        const option = createFormatOption({
            formatId: format.formatId || format.format_id || 'best',
            quality: format.quality || format.resolution || format.format_note || 'Video',
            size: format.filesize ? formatBytes(format.filesize) : (format.size || ''),
            ext: format.ext || 'mp4',
        }, data.url);
        videoFormatsList.appendChild(option);
    });

    // Populate audio formats
    audioFormats.forEach(format => {
        const option = createFormatOption({
            formatId: format.formatId || format.format_id || 'bestaudio',
            quality: format.quality || format.abr ? `${format.abr}kbps` : 'Audio',
            size: format.filesize ? formatBytes(format.filesize) : (format.size || ''),
            ext: format.ext || 'mp3',
        }, data.url);
        audioFormatsList.appendChild(option);
    });

    // Add default audio option if none exist
    if (audioFormatsList.children.length === 0 && data.type !== 'image') {
        audioFormatsList.appendChild(createFormatOption({
            formatId: 'bestaudio',
            quality: 'Best Audio',
            size: 'MP3',
            ext: 'mp3',
        }, data.url));
    }

    // Show/hide sections based on available formats
    videoFormatsSection.style.display = videoFormatsList.children.length > 0 ? 'block' : 'none';
    audioFormatsSection.style.display = audioFormatsList.children.length > 0 ? 'block' : 'none';
}

function createFormatOption(format, videoUrl) {
    const option = document.createElement('div');
    option.className = 'format-option';
    option.innerHTML = `
        <div class="format-info">
            <span class="format-quality">${format.quality}</span>
            <span class="format-size">${format.size || format.ext.toUpperCase()}</span>
        </div>
        <button class="format-download-btn" title="Download">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
        </button>
    `;

    const downloadBtn = option.querySelector('.format-download-btn');
    downloadBtn.addEventListener('click', () => {
        downloadFormat(videoUrl, format.formatId);
    });

    return option;
}

function downloadFormat(videoUrl, formatId) {
    // Create download URL
    const streamId = Date.now().toString(36);
    const downloadUrl = `${CONFIG.API_BASE_URL}/api/stream/${streamId}?videoUrl=${encodeURIComponent(videoUrl)}&formatId=${encodeURIComponent(formatId)}`;

    // Open in new tab to trigger download
    window.open(downloadUrl, '_blank');
}

// ===================================
// Server Status
// ===================================
async function checkServerStatus() {
    const statusDot = elements.serverStatus.querySelector('.status-dot');
    const statusText = elements.serverStatus.querySelector('.status-text');

    try {
        const response = await fetchWithTimeout(`${CONFIG.API_BASE_URL}/api/health`, {
            method: 'GET',
        }, 5000);

        if (response.ok) {
            statusDot.classList.add('online');
            statusDot.classList.remove('offline');
            statusText.textContent = 'Server Online';
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        statusDot.classList.add('offline');
        statusDot.classList.remove('online');
        statusText.textContent = 'Server Offline';
    }
}

// ===================================
// FAQ Toggle
// ===================================
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            // Close other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });

            // Toggle current item
            item.classList.toggle('active');
        });
    });
}

// ===================================
// UI Helpers
// ===================================
function setLoading(loading) {
    const btnText = elements.downloadBtn.querySelector('.btn-text');
    const btnLoader = elements.downloadBtn.querySelector('.btn-loader');

    if (loading) {
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        elements.downloadBtn.disabled = true;
        elements.urlInput.disabled = true;
    } else {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        elements.downloadBtn.disabled = !isValidUrl(elements.urlInput.value);
        elements.urlInput.disabled = false;
    }
}

function showError(message) {
    const errorText = document.getElementById('errorText');
    errorText.textContent = message;
    elements.errorMessage.classList.remove('hidden');
}

function hideError() {
    elements.errorMessage.classList.add('hidden');
}

// ===================================
// Utilities
// ===================================
function isValidUrl(string) {
    if (!string) return false;

    try {
        const url = new URL(string);

        // Check for supported platforms
        const supportedDomains = [
            'youtube.com', 'youtu.be', 'www.youtube.com', 'm.youtube.com',
            'instagram.com', 'www.instagram.com',
            'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
            'facebook.com', 'www.facebook.com', 'fb.watch', 'm.facebook.com',
            'reddit.com', 'www.reddit.com', 'v.redd.it', 'old.reddit.com',
        ];

        return supportedDomains.some(domain => url.hostname.includes(domain));
    } catch {
        return false;
    }
}

async function fetchWithTimeout(url, options = {}, timeout = CONFIG.TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.');
        }
        throw error;
    }
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return '';

    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function formatNumber(num) {
    if (!num) return '0';

    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Log startup
console.log('🚀 UniSave Web loaded');
console.log(`📡 API: ${CONFIG.API_BASE_URL}`);
