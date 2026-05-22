import { fetchChangelog, parseText } from './utils/api.js';
import { renderTOC, renderNavPills, renderChangelog } from './render.js';
import { initScrollSpy } from './utils/scroll-spy.js';

// DOM Elements
const els = {
  urlInput: document.getElementById('changelog-url'),
  fetchBtn: document.getElementById('fetch-btn'),
  inputError: document.getElementById('input-error'),
  loadingIndicator: document.getElementById('loading-indicator'),
  emptyState: document.getElementById('empty-state'),
  mainContent: document.getElementById('main-content'),
  statsBar: document.getElementById('stats-bar'),
  sectionNav: document.getElementById('section-nav'),
  tocList: document.getElementById('toc-list'),
  navPills: document.getElementById('section-nav-pills'),
  changelogContent: document.getElementById('changelog-content'),
  scrollTopBtn: document.getElementById('scroll-top-btn'),
  
  // Stats
  statTotal: document.querySelector('#stat-total .stat__value'),
  statBuffs: document.querySelector('#stat-buffs .stat__value'),
  statNerfs: document.querySelector('#stat-nerfs .stat__value'),
  statFixes: document.querySelector('#stat-fixes .stat__value'),
  statNew: document.querySelector('#stat-new .stat__value'),
  
  // Stat filter buttons
  statBtns: document.querySelectorAll('.stat--clickable'),
  
  // Paste Modal
  pasteModal: document.getElementById('paste-modal'),
  pasteTextarea: document.getElementById('paste-textarea'),
  pasteSubmit: document.getElementById('paste-submit'),
  pasteCancel: document.getElementById('paste-cancel'),
  exampleLinks: document.querySelectorAll('.example-link')
};

// Event Listeners
document.addEventListener('DOMContentLoaded', init);

function init() {
  els.fetchBtn.addEventListener('click', handleFetchClick);
  els.urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleFetchClick();
  });
  
  // Detect pasted text in input
  els.urlInput.addEventListener('paste', handleInputPaste);

  // Modal events
  els.pasteSubmit.addEventListener('click', handlePasteSubmit);
  els.pasteCancel.addEventListener('click', () => els.pasteModal.close());
  
  // Example links
  els.exampleLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const url = e.target.getAttribute('data-url');
      els.urlInput.value = url;
      handleFetchClick();
    });
  });

  // Scroll to top
  window.addEventListener('scroll', handleScroll);
  els.scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  });

  // Stat filter buttons
  els.statBtns.forEach(btn => {
    btn.addEventListener('click', () => handleFilterClick(btn.dataset.filter));
  });

  // Check for URL parameter
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('url');
  if (urlParam) {
    els.urlInput.value = urlParam;
    handleFetchClick();
  }

  // Launch countdown
  initCountdown();
}

function handleInputPaste(e) {
  // If user pastes something that looks like raw text instead of a URL,
  // open the paste modal and put it there.
  const pastedData = (e.clipboardData || window.clipboardData).getData('text');
  
  if (pastedData.length > 200 && !pastedData.trim().startsWith('http')) {
    e.preventDefault();
    els.urlInput.value = '';
    els.pasteTextarea.value = pastedData;
    els.pasteModal.showModal();
  }
}

async function handlePasteSubmit() {
  const text = els.pasteTextarea.value.trim();
  if (!text) return;
  
  els.pasteModal.close();
  setLoadingState(true);
  
  try {
    const data = await parseText(text);
    renderApp(data);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoadingState(false);
  }
}

async function handleFetchClick() {
  const url = els.urlInput.value.trim();
  
  if (!url) {
    showError('Please enter a URL or paste patch notes.');
    return;
  }

  // Quick validation
  if (url.startsWith('http') && !isSupportedForumUrl(url)) {
    showError('Only pathofexile.com or pathofexile2.com forum thread URLs are supported.');
    return;
  }

  hideError();
  setLoadingState(true);

  try {
    const data = await fetchChangelog(url);
    
    // Update URL hash without reload
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('url', url);
    window.history.pushState({}, '', newUrl);

    renderApp(data);
  } catch (err) {
    showError(err.message || 'Failed to fetch changelog. Make sure the URL is correct.');
  } finally {
    setLoadingState(false);
  }
}

function isSupportedForumUrl(value) {
  try {
    const parsed = new URL(value);
    const supportedHosts = new Set([
      'pathofexile.com',
      'www.pathofexile.com',
      'pathofexile2.com',
      'www.pathofexile2.com',
    ]);

    return supportedHosts.has(parsed.hostname) && parsed.pathname.startsWith('/forum/view-thread/');
  } catch {
    return false;
  }
}

function renderApp(data) {
  if (!data.sections || data.sections.length === 0) {
    showError('Could not find any patch notes sections in that URL/text.');
    return;
  }

  // Update Title if available
  if (data.title) {
    document.title = `${data.title} — PoE2 Reformatted`;
  }

  // Update Stats
  animateValue(els.statTotal, data.totalChanges);
  animateValue(els.statBuffs, data.summary?.buffs || 0);
  animateValue(els.statNerfs, data.summary?.nerfs || 0);
  animateValue(els.statFixes, data.summary?.fixes || 0);
  animateValue(els.statNew, data.summary?.new || 0);

  // Render components
  els.tocList.innerHTML = renderTOC(data.sections);
  els.navPills.innerHTML = renderNavPills(data.sections);
  els.changelogContent.innerHTML = renderChangelog(data.sections);

  // Hide empty state, show main content
  els.emptyState.hidden = true;
  els.statsBar.hidden = false;
  els.sectionNav.hidden = false;
  els.mainContent.hidden = false;

  // Initialize scroll spy
  initScrollSpy();

  // Initialize filter — reset to 'all'
  applyFilter('all');

  // Smooth scroll to top of content
  setTimeout(() => {
    window.scrollTo({
      top: els.statsBar.offsetTop - 20,
      behavior: 'smooth'
    });
  }, 100);
}

// UI Helpers
function setLoadingState(isLoading) {
  els.fetchBtn.disabled = isLoading;
  els.urlInput.disabled = isLoading;
  els.loadingIndicator.hidden = !isLoading;
  
  if (isLoading) hideError();
}

function showError(msg) {
  els.inputError.textContent = msg;
  els.inputError.hidden = false;
  
  // Flash animation
  els.inputError.style.animation = 'none';
  els.inputError.offsetHeight; /* trigger reflow */
  els.inputError.style.animation = null; 
}

function hideError() {
  els.inputError.hidden = true;
  els.inputError.textContent = '';
}

function handleScroll() {
  // Show scroll-to-top button after 500px
  if (window.scrollY > 500) {
    els.scrollTopBtn.hidden = false;
  } else {
    els.scrollTopBtn.hidden = true;
  }
}

// ── Filter System ──
let currentFilter = 'all';

function handleFilterClick(filter) {
  // Toggle: clicking the active filter resets to 'all'
  const newFilter = (filter === currentFilter && filter !== 'all') ? 'all' : filter;
  applyFilter(newFilter);
}

function applyFilter(filter) {
  currentFilter = filter;

  // Update active state on stat buttons
  els.statBtns.forEach(btn => {
    btn.classList.toggle('stat--active', btn.dataset.filter === filter);
  });

  // Show/hide change items
  const allItems = document.querySelectorAll('.change-item');
  allItems.forEach(item => {
    if (filter === 'all') {
      item.hidden = false;
    } else {
      // Match by the CSS class e.g. change-item--buff
      item.hidden = !item.classList.contains(`change-item--${filter}`);
    }
  });

  // Show/hide sections/subsections that have no visible items
  const allSubsections = document.querySelectorAll('.subsection');
  allSubsections.forEach(sub => {
    const visible = sub.querySelectorAll('.change-item:not([hidden])');
    sub.hidden = visible.length === 0;
  });

  const allSections = document.querySelectorAll('.section-card');
  allSections.forEach(section => {
    const visibleItems = section.querySelectorAll('.change-item:not([hidden])');
    section.hidden = visibleItems.length === 0;
  });

  // Update TOC visibility
  const tocLinks = document.querySelectorAll('.toc-link');
  tocLinks.forEach(link => {
    const targetId = link.getAttribute('href').replace('#', '');
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
      link.parentElement.hidden = targetSection.hidden;
    }
  });

  // Update nav pills visibility
  const navPills = document.querySelectorAll('.nav-pill');
  navPills.forEach(pill => {
    const targetId = pill.getAttribute('href').replace('#', '');
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
      pill.hidden = targetSection.hidden;
    }
  });

  // Show a "no results" message if everything is hidden
  let noResultsEl = document.getElementById('filter-no-results');
  const anyVisible = document.querySelectorAll('.section-card:not([hidden])').length > 0;
  if (!anyVisible) {
    if (!noResultsEl) {
      noResultsEl = document.createElement('p');
      noResultsEl.id = 'filter-no-results';
      noResultsEl.className = 'filter-no-results';
      els.changelogContent.appendChild(noResultsEl);
    }
    noResultsEl.textContent = `No "${filter}" changes found in this patch.`;
    noResultsEl.hidden = false;
  } else if (noResultsEl) {
    noResultsEl.hidden = true;
  }
}

// Animate numbers counting up
function animateValue(obj, end, duration = 600) {
  let startTimestamp = null;
  const start = parseInt(obj.dataset.count) || 0;
  
  obj.dataset.count = end;
  
  if (start === end) {
    obj.innerHTML = end;
    return;
  }

  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    
    // ease out quad
    const easeProgress = progress * (2 - progress);
    const current = Math.floor(easeProgress * (end - start) + start);
    
    obj.innerHTML = current;
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.innerHTML = end;
      obj.style.animation = 'countPulse 0.4s ease-out';
      setTimeout(() => { obj.style.animation = ''; }, 400);
    }
  };
  window.requestAnimationFrame(step);
}

// ── Launch Countdown ──
// Target: May 29 2026 at 1:00 PM PDT = 20:00 UTC
const LAUNCH_UTC = Date.UTC(2026, 4, 29, 20, 0, 0); // month is 0-indexed

function initCountdown() {
  const section    = document.getElementById('launch-countdown');
  const localTimeEl = document.getElementById('cd-local-time');
  const cdDays     = document.getElementById('cd-days');
  const cdHours    = document.getElementById('cd-hours');
  const cdMinutes  = document.getElementById('cd-minutes');
  const cdSeconds  = document.getElementById('cd-seconds');

  if (!section) return;

  // Show the launch time in device local timezone
  const launchDate = new Date(LAUNCH_UTC);
  const localStr   = launchDate.toLocaleString(undefined, {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
    hour:    'numeric',
    minute:  '2-digit',
    timeZoneName: 'short'
  });
  localTimeEl.innerHTML = `Launches <strong>${localStr}</strong> <span style="opacity:0.6">(your local time)</span>`;

  function pad(n) { return String(n).padStart(2, '0'); }

  function flashTick(el) {
    el.classList.remove('tick');
    // Force reflow so the class re-triggers
    void el.offsetWidth;
    el.classList.add('tick');
    setTimeout(() => el.classList.remove('tick'), 150);
  }

  let prevSeconds = -1;

  function tick() {
    const now  = Date.now();
    const diff = LAUNCH_UTC - now;

    if (diff <= 0) {
      // Already launched!
      section.classList.add('launch-countdown--launched');
      cdDays.textContent    = '00';
      cdHours.textContent   = '00';
      cdMinutes.textContent = '00';
      cdSeconds.textContent = '00';
      document.querySelector('.launch-countdown__badge').textContent = 'Launched!';
      document.querySelector('.launch-countdown__subtitle').textContent = 'Update 0.5 is live — go play!';
      localTimeEl.textContent = '';
      return; // stop ticking
    }

    const totalSecs = Math.floor(diff / 1000);
    const days      = Math.floor(totalSecs / 86400);
    const hours     = Math.floor((totalSecs % 86400) / 3600);
    const minutes   = Math.floor((totalSecs % 3600) / 60);
    const seconds   = totalSecs % 60;

    if (seconds !== prevSeconds) {
      if (prevSeconds !== -1) flashTick(cdSeconds);
      cdSeconds.textContent = pad(seconds);
      prevSeconds = seconds;
    }

    cdDays.textContent    = pad(days);
    cdHours.textContent   = pad(hours);
    cdMinutes.textContent = pad(minutes);

    setTimeout(tick, 1000 - (Date.now() % 1000)); // sync to wall clock
  }

  tick();
}
