/**
 * collage.js — Layout Engine for Memory Book
 * Handles masonry, grid, and scattered layouts.
 * Also manages the sticker and polaroid assignment logic.
 */

const STICKERS = ['🌸', '💫', '🌟', '❤️', '🎉', '🌈', '✨', '🦋', '🌙', '🎈', '🍀', '🌺'];
const TILTS    = [-3, -2, -1.5, -1, 0, 1, 1.5, 2, 3]; // degrees for scattered mode

/**
 * Determine card style variant based on index
 * Every 7th card → polaroid, every 5th → sticker
 */
function getCardVariant(index) {
  return {
    isPolaroid : (index % 7 === 0),
    hasSticker : (index % 5 === 3),
    sticker    : STICKERS[index % STICKERS.length],
    tilt       : TILTS[index % TILTS.length],
    animDelay  : `${Math.min(index * 0.05, 1.2)}s`,
  };
}

/**
 * Build a single photo card DOM element
 */
function buildPhotoCard(photo, index, currentLayout) {
  const variant = getCardVariant(index);
  const card = document.createElement('div');
  card.className = 'photo-card';
  card.dataset.id = photo.id;
  card.style.animationDelay = variant.animDelay;

  // Set CSS tilt variable
  card.style.setProperty('--tilt', `${variant.tilt}deg`);

  // Polaroid styling
  if (variant.isPolaroid) {
    card.classList.add('polaroid-style');
  }

  // Sticker
  if (variant.hasSticker) {
    card.classList.add('has-sticker');
    card.dataset.sticker = variant.sticker;
  }

  const img = document.createElement('img');
  img.src = photo.dataUrl;
  img.alt = photo.caption || `Memory ${index + 1}`;
  img.loading = 'lazy';
  // Let masonry breathe — don't force height
  img.style.maxHeight = getMaxHeight(index);

  const overlay = document.createElement('div');
  overlay.className = 'photo-card-overlay';

  const captionEl = document.createElement('div');
  captionEl.className = 'card-caption';
  captionEl.textContent = photo.caption || '';

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'card-btn';
  editBtn.textContent = '✏ Caption';
  editBtn.dataset.action = 'open';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'card-btn delete';
  deleteBtn.textContent = '🗑';
  deleteBtn.dataset.action = 'delete';

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  overlay.appendChild(captionEl);
  overlay.appendChild(actions);

  card.appendChild(img);
  card.appendChild(overlay);

  // Polaroid label
  if (variant.isPolaroid) {
    const label = document.createElement('div');
    label.className = 'polaroid-label';
    label.textContent = photo.caption || formatDate(photo.addedAt);
    card.appendChild(label);
  }

  return card;
}

/**
 * Vary image heights for a natural masonry feel
 */
function getMaxHeight(index) {
  // Alternate between tall, medium, short for visual rhythm
  const heights = ['380px', '260px', '320px', '480px', '200px', '340px', '290px'];
  return heights[index % heights.length];
}

/**
 * Render the entire collage grid
 */
function renderCollage(photos, container, layout = 'masonry') {
  container.innerHTML = '';

  // Set layout class
  container.className = `collage-grid ${layout}`;

  photos.forEach((photo, index) => {
    const card = buildPhotoCard(photo, index, layout);
    container.appendChild(card);
  });
}

/**
 * Format a date timestamp to a readable string.
 */
function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
}

/**
 * Shuffle array in-place (Fisher-Yates)
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
