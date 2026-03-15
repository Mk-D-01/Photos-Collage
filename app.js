/**
 * app.js — Main Application Logic
 * Handles: file upload, drag & drop, lightbox, layout switching,
 *          captions, local storage persistence, toasts,
 *          and Google Drive link import.
 */

// ─── State ────────────────────────────────────────────────────────────────────
let photos       = [];           // Array of photo objects
let currentIndex = 0;            // Lightbox index
let currentLayout= 'masonry';    // Active layout mode
let dragCounter  = 0;            // Track nested dragenter/leave events

// ─── DOM Elements ─────────────────────────────────────────────────────────────
const fileInput      = document.getElementById('fileInput');
const collageGrid    = document.getElementById('collageGrid');
const collageWrapper = document.getElementById('collageWrapper');
const emptyState     = document.getElementById('emptyState');
const statsBar       = document.getElementById('statsBar');
const photoCount     = document.getElementById('photoCount');
const layoutLabel    = document.getElementById('layoutLabel');
const dropOverlay    = document.getElementById('dropOverlay');
const lightbox       = document.getElementById('lightbox');
const lightboxImg    = document.getElementById('lightboxImg');
const lightboxCaption= document.getElementById('lightboxCaption');
const lightboxDate   = document.getElementById('lightboxDate');
const lightboxClose  = document.getElementById('lightboxClose');
const lightboxPrev   = document.getElementById('lightboxPrev');
const lightboxNext   = document.getElementById('lightboxNext');
const btnClearAll    = document.getElementById('btnClearAll');
const btnShuffle     = document.getElementById('btnShuffle');
const toastContainer = document.getElementById('toastContainer');
// Drive
const btnDriveImport = document.getElementById('btnDriveImport');
const driveModal     = document.getElementById('driveModal');
const driveModalClose= document.getElementById('driveModalClose');
const driveModalCancel=document.getElementById('driveModalCancel');
const driveUrlInput  = document.getElementById('driveUrlInput');
const driveImportBtn = document.getElementById('driveImportBtn');
const driveStatus    = document.getElementById('driveStatus');
const emptyDriveBtn  = document.getElementById('emptyDriveBtn');

// ─── Bootstrap ────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  renderUI();
  bindEvents();
  spawnAmbientParticles();
});

// ─── Storage ──────────────────────────────────────────────────────────────────
function saveToStorage() {
  try {
    localStorage.setItem('memoire_photos', JSON.stringify(
      photos.map(p => ({ id: p.id, dataUrl: p.dataUrl, caption: p.caption, addedAt: p.addedAt }))
    ));
  } catch(e) {
    // Storage might be full with large images – silently ignore
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('memoire_photos');
    if (raw) photos = JSON.parse(raw);
  } catch(e) {
    photos = [];
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderUI() {
  const hasPhotos = photos.length > 0;

  emptyState.classList.toggle('visible', !hasPhotos);
  statsBar.classList.toggle('visible', hasPhotos);
  collageWrapper.style.display = hasPhotos ? '' : 'none';

  if (hasPhotos) {
    photoCount.textContent = `${photos.length} ${photos.length === 1 ? 'memory' : 'memories'}`;
    renderCollage(photos, collageGrid, currentLayout);
    bindCardEvents();
  }
}

function updateLayoutLabel() {
  const labels = { masonry: 'Masonry Layout', grid: 'Grid Layout', scattered: 'Scattered Layout' };
  layoutLabel.textContent = labels[currentLayout] || 'Layout';
}

// ─── File Handling ────────────────────────────────────────────────────────────
function processFiles(files) {
  const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!imageFiles.length) { showToast('⚠ No image files found'); return; }

  let loaded = 0;
  imageFiles.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      photos.push({
        id      : `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        dataUrl : e.target.result,
        caption : '',
        addedAt : Date.now(),
      });
      loaded++;
      if (loaded === imageFiles.length) {
        saveToStorage();
        renderUI();
        showToast(`✦ ${loaded} ${loaded === 1 ? 'memory' : 'memories'} added!`);
      }
    };
    reader.readAsDataURL(file);
  });
}

// ─── Bind Global Events ───────────────────────────────────────────────────────
function bindEvents() {
  // File input
  fileInput.addEventListener('change', e => {
    processFiles(e.target.files);
    fileInput.value = ''; // reset so same files can be re-added
  });

  // Drag & drop – window level
  window.addEventListener('dragenter', e => {
    e.preventDefault();
    dragCounter++;
    dropOverlay.classList.add('active');
  });

  window.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; dropOverlay.classList.remove('active'); }
  });

  window.addEventListener('dragover', e => e.preventDefault());

  window.addEventListener('drop', e => {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.classList.remove('active');
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  });

  // Lightbox controls
  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
  lightboxNext.addEventListener('click', () => navigateLightbox(1));

  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  // Caption save on blur/enter
  lightboxCaption.addEventListener('blur', saveLightboxCaption);
  lightboxCaption.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); lightboxCaption.blur(); }
  });

  // Keyboard nav
  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'ArrowLeft')  navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
    if (e.key === 'Escape')     closeLightbox();
  });

  // Layout switcher
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLayout = btn.dataset.layout;
      updateLayoutLabel();
      renderUI();
      showToast(`Layout: ${btn.title}`);
    });
  });

  // Shuffle
  btnShuffle.addEventListener('click', () => {
    if (!photos.length) return;
    shuffleArray(photos);
    saveToStorage();
    renderUI();
    showToast('🔀 Memories shuffled!');
  });

  // Clear all
  btnClearAll.addEventListener('click', () => {
    if (!photos.length) return;
    if (!confirm(`Remove all ${photos.length} memories? This cannot be undone.`)) return;
    photos = [];
    saveToStorage();
    renderUI();
    showToast('🗑 All memories cleared');
  });

  // ── Google Drive modal ──
  const openDriveModal = () => {
    driveStatus.innerHTML = '';
    driveUrlInput.value = '';
    driveModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => driveUrlInput.focus(), 100);
  };
  const closeDriveModal = () => {
    driveModal.classList.remove('active');
    document.body.style.overflow = '';
  };

  btnDriveImport.addEventListener('click', openDriveModal);
  emptyDriveBtn.addEventListener('click', openDriveModal);
  driveModalClose.addEventListener('click', closeDriveModal);
  driveModalCancel.addEventListener('click', closeDriveModal);
  driveModal.addEventListener('click', e => { if (e.target === driveModal) closeDriveModal(); });

  driveImportBtn.addEventListener('click', handleDriveImport);

  // Close Drive modal on Escape (when not lightbox)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && driveModal.classList.contains('active')) closeDriveModal();
  });
}

// ─── Card Events (delegated) ──────────────────────────────────────────────────
function bindCardEvents() {
  collageGrid.addEventListener('click', handleCardClick);
}

function handleCardClick(e) {
  const deleteBtn = e.target.closest('[data-action="delete"]');
  const openBtn   = e.target.closest('[data-action="open"]');
  const card      = e.target.closest('.photo-card');

  if (!card) return;
  const id    = card.dataset.id;
  const index = photos.findIndex(p => p.id === id);
  if (index === -1) return;

  if (deleteBtn) {
    e.stopPropagation();
    deletePhoto(index);
    return;
  }

  // Open lightbox (click anywhere on card or "Caption" btn)
  openLightbox(index);
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function deletePhoto(index) {
  const card = collageGrid.querySelector(`[data-id="${photos[index].id}"]`);
  if (card) {
    card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    card.style.transform  = 'scale(0.8)';
    card.style.opacity    = '0';
    setTimeout(() => {
      photos.splice(index, 1);
      saveToStorage();
      renderUI();
      showToast('Memory removed');
    }, 300);
  }
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function openLightbox(index) {
  currentIndex = index;
  updateLightboxContent();
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  saveLightboxCaption();
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

function navigateLightbox(dir) {
  saveLightboxCaption();
  currentIndex = (currentIndex + dir + photos.length) % photos.length;
  updateLightboxContent();
}

function updateLightboxContent() {
  const photo = photos[currentIndex];
  if (!photo) return;

  lightboxImg.src       = photo.dataUrl;
  lightboxImg.alt       = photo.caption || `Memory ${currentIndex + 1}`;
  lightboxCaption.value = photo.caption || '';
  lightboxDate.textContent = photo.addedAt
    ? `Added ${formatDate(photo.addedAt)}`
    : '';

  // Animate the polaroid
  const polaroid = document.querySelector('.lightbox-polaroid');
  if (polaroid) {
    polaroid.style.animation = 'none';
    void polaroid.offsetHeight; // reflow trick
    polaroid.style.animation = '';
  }
}

function saveLightboxCaption() {
  if (!photos[currentIndex]) return;
  const newCaption = lightboxCaption.value.trim();
  if (photos[currentIndex].caption !== newCaption) {
    photos[currentIndex].caption = newCaption;
    saveToStorage();
    // Update visible card caption if present
    const card = collageGrid.querySelector(`[data-id="${photos[currentIndex].id}"]`);
    if (card) {
      const captionEl = card.querySelector('.card-caption');
      if (captionEl) captionEl.textContent = newCaption;
      const labelEl = card.querySelector('.polaroid-label');
      if (labelEl && newCaption) labelEl.textContent = newCaption;
    }
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, duration = 2800) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ─── Ambient particles ────────────────────────────────────────────────────────
function spawnAmbientParticles() {
  const bg = document.getElementById('ambientBg');
  const count = 18;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    const size = Math.random() * 4 + 1;
    const x    = Math.random() * 100;
    const y    = Math.random() * 100;
    const dur  = Math.random() * 14 + 8;
    const del  = Math.random() * -14;
    const opacity = Math.random() * 0.3 + 0.05;

    dot.style.cssText = `
      position:absolute;
      width:${size}px; height:${size}px;
      left:${x}%; top:${y}%;
      border-radius:50%;
      background: hsl(${Math.random() > 0.5 ? 270 : 330}, 80%, 75%);
      opacity:${opacity};
      animation: floatDot ${dur}s ${del}s ease-in-out infinite alternate;
      pointer-events:none;
    `;
    bg.appendChild(dot);
  }

  // Inject the keyframe if not already present
  if (!document.getElementById('ambientKF')) {
    const style = document.createElement('style');
    style.id = 'ambientKF';
    style.textContent = `
      @keyframes floatDot {
        from { transform: translate(0, 0) scale(1); }
        to   { transform: translate(${Math.random() > 0.5 ? '' : '-'}${Math.floor(Math.random()*30+10)}px,
                                   ${Math.random() > 0.5 ? '' : '-'}${Math.floor(Math.random()*30+10)}px) scale(${(Math.random()*0.5+0.8).toFixed(2)}); }
      }
    `;
    document.head.appendChild(style);
  }
}

// ─── Google Drive Import ───────────────────────────────────────────────────────

/**
 * Extract Google Drive file ID from a sharing URL.
 * Supports formats:
 *   https://drive.google.com/file/d/{ID}/view?...
 *   https://drive.google.com/open?id={ID}
 *   https://drive.google.com/uc?id={ID}&export=...
 *   https://docs.google.com/... (photos sometimes shared via docs)
 */
function extractDriveFileId(url) {
  url = url.trim();

  // Pattern 1: /file/d/{ID}/
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];

  // Pattern 2: ?id={ID} or &id={ID}
  m = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];

  // Pattern 3: raw ID (user just pasted the ID itself)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;

  return null;
}

/**
 * Build candidate image URLs for a Drive file ID.
 * Priority order: thumbnail (fastest) → lh3 direct → uc download.
 */
function driveImageUrls(fileId) {
  return [
    // Google's image CDN — works for publicly shared images
    `https://lh3.googleusercontent.com/d/${fileId}`,
    // Thumbnail (lower quality but widely available)
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
    // Direct download (may be blocked by browser CORS, but worth trying)
    `https://drive.google.com/uc?export=download&id=${fileId}`,
  ];
}

/**
 * Try loading an image from an array of URLs in order.
 * Resolves with a dataURL on success, rejects if all fail.
 */
function tryLoadImageUrls(urlList) {
  return new Promise((resolve, reject) => {
    let i = 0;

    function tryNext() {
      if (i >= urlList.length) { reject(new Error('All URLs failed')); return; }
      const url = urlList[i++];
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          // Convert to dataURL via canvas so we can store it
          const canvas = document.createElement('canvas');
          canvas.width  = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.88), srcUrl: url });
        } catch(e) {
          // Canvas tainted by CORS — store the remote URL directly instead
          resolve({ dataUrl: url, srcUrl: url });
        }
      };
      img.onerror = tryNext;
      img.src = url;
    }
    tryNext();
  });
}

/** Add or update a status row in the Drive modal status area */
function setDriveStatusItem(id, state, text) {
  let item = driveStatus.querySelector(`[data-sid="${id}"]`);
  if (!item) {
    item = document.createElement('div');
    item.className = 'drive-status-item';
    item.dataset.sid = id;
    item.innerHTML = `<span class="drive-status-icon"></span><span class="drive-status-text"></span>`;
    driveStatus.appendChild(item);
  }
  item.classList.remove('loading', 'success', 'error');
  item.classList.add(state);

  const icons = { loading: '<span class="spinner">⟳</span>', success: '✅', error: '❌' };
  item.querySelector('.drive-status-icon').innerHTML = icons[state] || '';
  item.querySelector('.drive-status-text').textContent = text;
}

/** Main handler for the Drive Import button click */
async function handleDriveImport() {
  const raw = driveUrlInput.value.trim();
  if (!raw) {
    showToast('⚠ Paste at least one Drive link first');
    return;
  }

  // Split by newlines and filter blank lines
  const lines = raw.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return;

  driveStatus.innerHTML = '';
  driveImportBtn.disabled = true;
  driveImportBtn.textContent = 'Importing…';

  let successCount = 0;

  const tasks = lines.map(async (line, idx) => {
    const sid = `drive_${idx}`;
    // Validate URL
    if (!line.includes('drive.google.com') && !line.includes('docs.google.com') && !/^[a-zA-Z0-9_-]{20,}$/.test(line)) {
      setDriveStatusItem(sid, 'error', `Not a valid Drive link: ${line.slice(0, 60)}`);
      return;
    }

    const fileId = extractDriveFileId(line);
    if (!fileId) {
      setDriveStatusItem(sid, 'error', `Could not extract file ID from: ${line.slice(0, 60)}`);
      return;
    }

    setDriveStatusItem(sid, 'loading', `Loading file ${fileId.slice(0, 16)}…`);

    try {
      const { dataUrl } = await tryLoadImageUrls(driveImageUrls(fileId));
      photos.push({
        id      : `drive_${fileId}_${Date.now()}`,
        dataUrl,
        caption : '',
        addedAt : Date.now(),
        source  : 'google_drive',
      });
      successCount++;
      setDriveStatusItem(sid, 'success', `Added! (ID: ${fileId.slice(0, 16)})`);
    } catch(err) {
      setDriveStatusItem(sid, 'error',
        `Failed: "${fileId.slice(0, 16)}" — Make sure the file is shared publicly.`);
    }
  });

  await Promise.allSettled(tasks);

  driveImportBtn.disabled = false;
  driveImportBtn.textContent = 'Import Photos →';

  if (successCount > 0) {
    saveToStorage();
    renderUI();
    showToast(`📁 ${successCount} Drive ${successCount === 1 ? 'photo' : 'photos'} imported!`);
    // Auto-close after short delay if all succeeded
    if (successCount === lines.length) {
      setTimeout(() => {
        driveModal.classList.remove('active');
        document.body.style.overflow = '';
      }, 1500);
    }
  } else {
    showToast('⚠ No photos could be imported — check sharing settings');
  }
}

