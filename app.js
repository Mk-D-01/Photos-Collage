/**
 * app.js — Main Application Logic
 * Handles: file upload, drag & drop, lightbox, layout switching,
 *          captions, local storage persistence, toasts,
 *          and Google Drive link import (files + folders).
 */

// ─── State ────────────────────────────────────────────────────────────────────
let photos       = [];
let currentIndex = 0;
let currentLayout= 'masonry';
let dragCounter  = 0;

// ─── DOM Elements ─────────────────────────────────────────────────────────────
const fileInput       = document.getElementById('fileInput');
const collageGrid     = document.getElementById('collageGrid');
const collageWrapper  = document.getElementById('collageWrapper');
const emptyState      = document.getElementById('emptyState');
const statsBar        = document.getElementById('statsBar');
const photoCount      = document.getElementById('photoCount');
const layoutLabel     = document.getElementById('layoutLabel');
const dropOverlay     = document.getElementById('dropOverlay');
const lightbox        = document.getElementById('lightbox');
const lightboxImg     = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxDate    = document.getElementById('lightboxDate');
const lightboxClose   = document.getElementById('lightboxClose');
const lightboxPrev    = document.getElementById('lightboxPrev');
const lightboxNext    = document.getElementById('lightboxNext');
const btnClearAll     = document.getElementById('btnClearAll');
const btnShuffle      = document.getElementById('btnShuffle');
const toastContainer  = document.getElementById('toastContainer');
// Drive
const btnDriveImport  = document.getElementById('btnDriveImport');
const driveModal      = document.getElementById('driveModal');
const driveModalClose = document.getElementById('driveModalClose');
const driveModalCancel= document.getElementById('driveModalCancel');
const driveUrlInput   = document.getElementById('driveUrlInput');
const driveImportBtn  = document.getElementById('driveImportBtn');
const driveStatus     = document.getElementById('driveStatus');
const emptyDriveBtn   = document.getElementById('emptyDriveBtn');
const driveApiKeySection = document.getElementById('driveApiKeySection');
const driveApiKeyToggle  = document.getElementById('driveApiKeyToggle');
const driveApiKeyInput   = document.getElementById('driveApiKeyInput');
const driveApiKeySave    = document.getElementById('driveApiKeySave');
const apiKeyBadge        = document.getElementById('apiKeyBadge');
const driveDetectBar     = document.getElementById('driveDetectBar');

// ─── Bootstrap ────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  renderUI();
  bindEvents();
  initDriveUI();
  spawnAmbientParticles();
});

// ─── Storage ──────────────────────────────────────────────────────────────────
function saveToStorage() {
  try {
    localStorage.setItem('memoire_photos', JSON.stringify(
      photos.map(p => ({ id: p.id, dataUrl: p.dataUrl, caption: p.caption, addedAt: p.addedAt }))
    ));
  } catch(e) { /* quota exceeded — ignore */ }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('memoire_photos');
    if (raw) photos = JSON.parse(raw);
  } catch(e) { photos = []; }
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
  fileInput.addEventListener('change', e => {
    processFiles(e.target.files);
    fileInput.value = '';
  });

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

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
  lightboxNext.addEventListener('click', () => navigateLightbox(1));
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  lightboxCaption.addEventListener('blur', saveLightboxCaption);
  lightboxCaption.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); lightboxCaption.blur(); }
  });

  document.addEventListener('keydown', e => {
    if (lightbox.classList.contains('active')) {
      if (e.key === 'ArrowLeft')  navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
      if (e.key === 'Escape')     closeLightbox();
    }
    if (e.key === 'Escape' && driveModal.classList.contains('active')) closeDriveModal();
  });

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

  btnShuffle.addEventListener('click', () => {
    if (!photos.length) return;
    shuffleArray(photos);
    saveToStorage();
    renderUI();
    showToast('🔀 Memories shuffled!');
  });

  btnClearAll.addEventListener('click', () => {
    if (!photos.length) return;
    if (!confirm(`Remove all ${photos.length} memories? This cannot be undone.`)) return;
    photos = [];
    saveToStorage();
    renderUI();
    showToast('🗑 All memories cleared');
  });

  // Drive modal open/close
  const openDriveModal = () => {
    driveStatus.innerHTML = '';
    driveDetectBar.innerHTML = '';
    driveUrlInput.value = '';
    driveModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => driveUrlInput.focus(), 100);
  };

  btnDriveImport.addEventListener('click', openDriveModal);
  emptyDriveBtn.addEventListener('click', openDriveModal);
  driveModalClose.addEventListener('click', closeDriveModal);
  driveModalCancel.addEventListener('click', closeDriveModal);
  driveModal.addEventListener('click', e => { if (e.target === driveModal) closeDriveModal(); });
  driveImportBtn.addEventListener('click', handleDriveImport);
}

function closeDriveModal() {
  driveModal.classList.remove('active');
  document.body.style.overflow = '';
}

// ─── Card Events ──────────────────────────────────────────────────────────────
function bindCardEvents() {
  collageGrid.addEventListener('click', handleCardClick);
}

function handleCardClick(e) {
  const deleteBtn = e.target.closest('[data-action="delete"]');
  const card      = e.target.closest('.photo-card');
  if (!card) return;
  const id    = card.dataset.id;
  const index = photos.findIndex(p => p.id === id);
  if (index === -1) return;
  if (deleteBtn) { e.stopPropagation(); deletePhoto(index); return; }
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
  lightboxDate.textContent = photo.addedAt ? `Added ${formatDate(photo.addedAt)}` : '';
  const polaroid = document.querySelector('.lightbox-polaroid');
  if (polaroid) {
    polaroid.style.animation = 'none';
    void polaroid.offsetHeight;
    polaroid.style.animation = '';
  }
}

function saveLightboxCaption() {
  if (!photos[currentIndex]) return;
  const newCaption = lightboxCaption.value.trim();
  if (photos[currentIndex].caption !== newCaption) {
    photos[currentIndex].caption = newCaption;
    saveToStorage();
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
  for (let i = 0; i < 18; i++) {
    const dot = document.createElement('div');
    const size = Math.random() * 4 + 1;
    const x    = Math.random() * 100;
    const y    = Math.random() * 100;
    const dur  = Math.random() * 14 + 8;
    const del  = Math.random() * -14;
    const opacity = Math.random() * 0.3 + 0.05;
    dot.style.cssText = `
      position:absolute; width:${size}px; height:${size}px;
      left:${x}%; top:${y}%; border-radius:50%;
      background:hsl(${Math.random() > 0.5 ? 270 : 330},80%,75%);
      opacity:${opacity};
      animation:floatDot ${dur}s ${del}s ease-in-out infinite alternate;
      pointer-events:none;
    `;
    bg.appendChild(dot);
  }
  if (!document.getElementById('ambientKF')) {
    const style = document.createElement('style');
    style.id = 'ambientKF';
    style.textContent = `
      @keyframes floatDot {
        from { transform: translate(0,0) scale(1); }
        to   { transform: translate(20px,-15px) scale(0.9); }
      }
    `;
    document.head.appendChild(style);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE DRIVE IMPORT
// ═══════════════════════════════════════════════════════════════════════════════

function initDriveUI() {
  // Load saved API key
  const saved = localStorage.getItem('memoire_drive_api_key') || '';
  if (saved) {
    driveApiKeyInput.value = saved;
    updateApiKeyBadge(true);
  }

  // Collapsible API key section
  driveApiKeyToggle.addEventListener('click', () => {
    driveApiKeySection.classList.toggle('open');
  });

  // Save button
  driveApiKeySave.addEventListener('click', () => {
    const key = driveApiKeyInput.value.trim();
    if (!key) { showToast('⚠ Enter a valid API key first'); return; }
    localStorage.setItem('memoire_drive_api_key', key);
    updateApiKeyBadge(true);
    driveApiKeySection.classList.remove('open');
    showToast('🔑 API key saved!');
  });
  driveApiKeyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') driveApiKeySave.click();
  });

  // Live detect bar — debounced as user types
  let detectTimer;
  driveUrlInput.addEventListener('input', () => {
    clearTimeout(detectTimer);
    detectTimer = setTimeout(updateDetectBar, 350);
  });
}

function updateApiKeyBadge(isSet) {
  apiKeyBadge.textContent = isSet ? '✓ saved' : 'not set';
  apiKeyBadge.classList.toggle('set', isSet);
}

/** Render a chip per line showing detected link type */
function updateDetectBar() {
  const lines = driveUrlInput.value.split('\n').map(l => l.trim()).filter(Boolean);
  driveDetectBar.innerHTML = '';
  lines.forEach(line => {
    const type  = detectLinkType(line);
    const label = type === 'folder' ? '📁 Folder' : type === 'file' ? '🖼 File' : '❓ Unknown';
    const chip  = document.createElement('span');
    chip.className = `detect-chip ${type}`;
    chip.title = line;
    chip.textContent = `${label}: ${truncate(line, 32)}`;
    driveDetectBar.appendChild(chip);
  });
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

/**
 * Detect whether a Drive URL is a file, folder, or unknown.
 */
function detectLinkType(url) {
  if (!url) return 'unknown';
  if (/drive\.google\.com\/(drive\/(u\/\d+\/)?)?folders\//i.test(url)) return 'folder';
  if (/folderview/i.test(url) && /[?&]id=/i.test(url))                  return 'folder';
  if (/drive\.google\.com\/file\/d\//i.test(url))                        return 'file';
  if (/drive\.google\.com\/(open|uc)\?/i.test(url))                      return 'file';
  if (/lh3\.googleusercontent\.com/i.test(url))                          return 'file';
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim()))                           return 'file';
  return 'unknown';
}

/** Extract folder ID from a Drive folder URL */
function extractDriveFolderId(url) {
  url = url.trim();
  let m = url.match(/\/folders\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  if (/folderview/i.test(url)) {
    m = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
    if (m) return m[1];
  }
  return null;
}

/** Extract file ID from a Drive file URL */
function extractDriveFileId(url) {
  url = url.trim();
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;
  return null;
}

/** Build candidate image src URLs for a Drive file ID (tried in order) */
function driveImageUrls(fileId) {
  return [
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
  ];
}

/**
 * Use Drive API v3 to list all image files in a folder (paginated).
 */
async function listFolderImages(folderId, apiKey) {
  const MIME_TYPES = [
    'image/jpeg','image/png','image/gif',
    'image/webp','image/heic','image/bmp','image/tiff',
  ];
  const mimeQ  = MIME_TYPES.map(m => `mimeType='${m}'`).join(' or ');
  const q      = encodeURIComponent(`'${folderId}' in parents and (${mimeQ}) and trashed=false`);
  const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType)');

  let allFiles  = [];
  let pageToken = '';

  do {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100&key=${apiKey}${tokenParam}`;
    const res  = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${res.status}`);
    }
    const data = await res.json();
    allFiles   = allFiles.concat(data.files || []);
    pageToken  = data.nextPageToken || '';
  } while (pageToken);

  return allFiles;
}

/**
 * Try loading an image from a list of fallback URLs.
 * Resolves to { dataUrl, srcUrl }.
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
          const canvas  = document.createElement('canvas');
          canvas.width  = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.88), srcUrl: url });
        } catch(e) {
          // CORS taint — keep the remote URL directly
          resolve({ dataUrl: url, srcUrl: url });
        }
      };
      img.onerror = tryNext;
      img.src = url;
    }
    tryNext();
  });
}

/** Add or update a status row in the Drive modal */
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

/** Import one file by ID → push to photos[] */
async function importSingleFile(fileId, sid, fileName) {
  const label = fileName || fileId.slice(0, 16);
  setDriveStatusItem(sid, 'loading', `Loading "${label}"…`);
  const { dataUrl } = await tryLoadImageUrls(driveImageUrls(fileId));
  photos.push({
    id      : `drive_${fileId}_${Date.now()}`,
    dataUrl,
    caption : fileName ? fileName.replace(/\.[^.]+$/, '') : '',
    addedAt : Date.now(),
    source  : 'google_drive',
  });
  setDriveStatusItem(sid, 'success', `✓ "${label}" added`);
}

/** Main import handler — dispatches file vs folder paths per line */
async function handleDriveImport() {
  const raw = driveUrlInput.value.trim();
  if (!raw) { showToast('⚠ Paste at least one Drive link first'); return; }

  const lines  = raw.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return;

  const apiKey = (localStorage.getItem('memoire_drive_api_key') || '').trim();

  driveStatus.innerHTML   = '';
  driveImportBtn.disabled = true;
  driveImportBtn.textContent = 'Importing…';

  let successCount = 0;

  const tasks = lines.map(async (line, idx) => {
    const sid  = `ln_${idx}`;
    const type = detectLinkType(line);

    // ── UNKNOWN ───────────────────────────────────────────────────
    if (type === 'unknown') {
      setDriveStatusItem(sid, 'error', `Not a recognised Drive link: ${truncate(line, 55)}`);
      return;
    }

    // ── FOLDER ────────────────────────────────────────────────────
    if (type === 'folder') {
      const folderId = extractDriveFolderId(line);
      if (!folderId) {
        setDriveStatusItem(sid, 'error', `Cannot extract folder ID from: ${truncate(line, 50)}`);
        return;
      }
      if (!apiKey) {
        setDriveStatusItem(sid, 'error', 'Folder detected — save your API key above first');
        driveApiKeySection.classList.add('open');
        return;
      }

      setDriveStatusItem(sid, 'loading', `Scanning folder "${folderId.slice(0, 14)}"…`);
      let files;
      try {
        files = await listFolderImages(folderId, apiKey);
      } catch(err) {
        setDriveStatusItem(sid, 'error', `Folder listing failed: ${err.message}`);
        return;
      }

      if (!files.length) {
        setDriveStatusItem(sid, 'error', `No images found in folder (${folderId.slice(0, 14)})`);
        return;
      }

      setDriveStatusItem(sid, 'loading', `Found ${files.length} image(s) — importing…`);

      let folderOk = 0;
      for (let fi = 0; fi < files.length; fi++) {
        const f    = files[fi];
        const fsid = `folder_${idx}_${fi}`;
        try {
          await importSingleFile(f.id, fsid, f.name);
          folderOk++;
          successCount++;
          setDriveStatusItem(sid, 'loading', `Folder: ${folderOk}/${files.length} imported…`);
        } catch(err) {
          setDriveStatusItem(fsid, 'error', `"${f.name}" failed — check sharing`);
        }
      }
      setDriveStatusItem(sid, 'success', `📁 Folder done: ${folderOk}/${files.length} images added`);
      return;
    }

    // ── FILE ──────────────────────────────────────────────────────
    const fileId = extractDriveFileId(line);
    if (!fileId) {
      setDriveStatusItem(sid, 'error', `Cannot extract file ID from: ${truncate(line, 50)}`);
      return;
    }
    try {
      await importSingleFile(fileId, sid);
      successCount++;
    } catch(err) {
      setDriveStatusItem(sid, 'error', `"${fileId.slice(0, 14)}" failed — check sharing settings`);
    }
  });

  await Promise.allSettled(tasks);

  driveImportBtn.disabled    = false;
  driveImportBtn.textContent = 'Import Photos →';

  if (successCount > 0) {
    saveToStorage();
    renderUI();
    showToast(`📁 ${successCount} Drive ${successCount === 1 ? 'photo' : 'photos'} imported!`);
    if (successCount === lines.length || lines.length === 1) {
      setTimeout(() => closeDriveModal(), 1800);
    }
  } else {
    showToast('⚠ No photos imported — check sharing settings & API key');
  }
}
