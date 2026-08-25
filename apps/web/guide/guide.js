const shell = document.querySelector('.guide-shell');
const deck = document.getElementById('guideDeck');
const slides = [...document.querySelectorAll('.slide[data-slide]')];
const rail = document.getElementById('slideRail');
const overviewPanel = document.getElementById('overviewPanel');
const overviewDialog = overviewPanel.querySelector('.overview-dialog');
const overviewGrid = document.getElementById('overviewGrid');
const overviewButton = document.getElementById('overviewButton');
const overviewClose = document.getElementById('overviewClose');
const previousButton = document.getElementById('previousButton');
const nextButton = document.getElementById('nextButton');
const printButton = document.getElementById('printButton');
const fullscreenButton = document.getElementById('fullscreenButton');
const slideCounter = document.getElementById('slideCounter');
const currentSlideTitle = document.getElementById('currentSlideTitle');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

let currentIndex = 0;
let overviewOpen = false;
let touchStartX = null;
let touchStartY = null;

function clampIndex(index) {
  return Math.max(0, Math.min(slides.length - 1, index));
}

function slideFromHash() {
  const match = location.hash.match(/^#slide-(\d+)$/);
  return match ? clampIndex(Number(match[1]) - 1) : 0;
}

function twoDigits(value) {
  return String(value).padStart(2, '0');
}

function shortDescription(slide) {
  const paragraph = slide.querySelector('.slide-heading > p, .lead');
  const text = paragraph?.textContent?.trim() || 'HarnessLab learning chapter';
  return text.length > 86 ? `${text.slice(0, 83).trimEnd()}…` : text;
}

function makeNavigation() {
  const railFragment = document.createDocumentFragment();
  const overviewFragment = document.createDocumentFragment();

  slides.forEach((slide, index) => {
    const number = index + 1;
    const title = slide.dataset.title || `Slide ${number}`;

    const railButton = document.createElement('button');
    railButton.type = 'button';
    railButton.className = 'rail-button';
    railButton.dataset.slideTarget = String(number);
    railButton.setAttribute('aria-label', `Go to slide ${number}: ${title}`);
    railButton.innerHTML = `<span>${twoDigits(number)}</span><span>${title}</span>`;
    railButton.addEventListener('click', () => goTo(index, { focusDeck: true }));
    railFragment.appendChild(railButton);

    const overviewCard = document.createElement('button');
    overviewCard.type = 'button';
    overviewCard.className = 'overview-card';
    overviewCard.dataset.slideTarget = String(number);
    overviewCard.innerHTML = `<span>SLIDE ${twoDigits(number)}</span><strong>${title}</strong><small>${shortDescription(slide)}</small>`;
    overviewCard.addEventListener('click', () => {
      closeOverview({ restoreFocus: false });
      goTo(index, { focusDeck: true });
    });
    overviewFragment.appendChild(overviewCard);
  });

  rail.replaceChildren(railFragment);
  overviewGrid.replaceChildren(overviewFragment);
}

function updateNavigationState() {
  const number = currentIndex + 1;
  const progress = Math.round((number / slides.length) * 100);
  const activeSlide = slides[currentIndex];

  slides.forEach((slide, index) => {
    const active = index === currentIndex;
    slide.hidden = !active;
    slide.classList.toggle('is-active', active);
    slide.classList.toggle('is-before', index < currentIndex);
    slide.setAttribute('aria-hidden', String(!active));
    if (active) slide.scrollTop = 0;
  });

  document.querySelectorAll('[data-slide-target]').forEach((button) => {
    const active = Number(button.dataset.slideTarget) === number;
    button.setAttribute('aria-current', String(active));
  });

  previousButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === slides.length - 1;
  slideCounter.textContent = `${twoDigits(number)} / ${twoDigits(slides.length)}`;
  progressBar.style.width = `${progress}%`;
  progressLabel.textContent = `${progress}% complete`;
  currentSlideTitle.textContent = activeSlide.dataset.title || `Slide ${number}`;
  document.title = `${activeSlide.dataset.title || 'HarnessLab Guide'} — HarnessLab Guide`;
}

function goTo(index, { focusDeck = false, updateHash = true } = {}) {
  currentIndex = clampIndex(index);
  updateNavigationState();

  if (updateHash) {
    const hash = `#slide-${currentIndex + 1}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  if (focusDeck) {
    queueMicrotask(() => deck.focus({ preventScroll: true }));
  }
}

function next() {
  if (currentIndex < slides.length - 1) goTo(currentIndex + 1, { focusDeck: true });
}

function previous() {
  if (currentIndex > 0) goTo(currentIndex - 1, { focusDeck: true });
}

function openOverview() {
  if (overviewOpen) return;
  overviewOpen = true;
  overviewPanel.dataset.open = 'true';
  overviewPanel.setAttribute('aria-hidden', 'false');
  overviewButton.setAttribute('aria-expanded', 'true');
  shell.setAttribute('inert', '');
  shell.setAttribute('aria-hidden', 'true');
  queueMicrotask(() => overviewClose.focus());
}

function closeOverview({ restoreFocus = true } = {}) {
  if (!overviewOpen) return;
  overviewOpen = false;
  overviewPanel.dataset.open = 'false';
  overviewPanel.setAttribute('aria-hidden', 'true');
  overviewButton.setAttribute('aria-expanded', 'false');
  shell.removeAttribute('inert');
  shell.removeAttribute('aria-hidden');
  if (restoreFocus) queueMicrotask(() => overviewButton.focus());
}

function trapOverviewFocus(event) {
  const focusable = [...overviewDialog.querySelectorAll(FOCUSABLE)].filter((element) => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  if (!focusable.length) {
    event.preventDefault();
    overviewDialog.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !overviewDialog.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !overviewDialog.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    fullscreenButton.setAttribute('title', 'Fullscreen is unavailable in this browser');
  }
}

function onKeyDown(event) {
  if (overviewOpen) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeOverview();
    } else if (event.key === 'Tab') {
      trapOverviewFocus(event);
    }
    return;
  }

  const target = event.target;
  if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

  if (event.key === 'ArrowRight' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) {
    event.preventDefault();
    next();
  } else if (event.key === 'ArrowLeft' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) {
    event.preventDefault();
    previous();
  } else if (event.key === 'Home') {
    event.preventDefault();
    goTo(0, { focusDeck: true });
  } else if (event.key === 'End') {
    event.preventDefault();
    goTo(slides.length - 1, { focusDeck: true });
  } else if (event.key.toLowerCase() === 'o') {
    event.preventDefault();
    openOverview();
  } else if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    toggleFullscreen();
  }
}

function onTouchStart(event) {
  const touch = event.changedTouches?.[0];
  if (!touch) return;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}

function onTouchEnd(event) {
  const touch = event.changedTouches?.[0];
  if (!touch || touchStartX === null || touchStartY === null) return;
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;
  touchStartX = null;
  touchStartY = null;

  if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
  if (deltaX < 0) next();
  else previous();
}

previousButton.addEventListener('click', previous);
nextButton.addEventListener('click', next);
overviewButton.addEventListener('click', openOverview);
overviewClose.addEventListener('click', () => closeOverview());
overviewPanel.querySelector('[data-close-overview]').addEventListener('click', () => closeOverview());
printButton.addEventListener('click', () => window.print());
fullscreenButton.addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', onKeyDown);
deck.addEventListener('touchstart', onTouchStart, { passive: true });
deck.addEventListener('touchend', onTouchEnd, { passive: true });
window.addEventListener('hashchange', () => goTo(slideFromHash(), { updateHash: false }));
document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.setAttribute('aria-pressed', String(active));
  fullscreenButton.setAttribute('title', active ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)');
});

makeNavigation();
goTo(slideFromHash(), { updateHash: location.hash.length === 0 });
