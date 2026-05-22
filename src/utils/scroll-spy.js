/**
 * Scroll Spy Utility
 * Uses IntersectionObserver to track which section is currently in view
 * and updates the Table of Contents (TOC) and Sticky Navigation accordingly.
 */

let observer = null;
const sectionMap = new Map();

export function initScrollSpy() {
  // Disconnect existing observer if re-initializing
  if (observer) {
    observer.disconnect();
    sectionMap.clear();
  }

  const sections = document.querySelectorAll('.section-card');
  if (sections.length === 0) return;

  const tocLinks = document.querySelectorAll('.toc-link');
  const navPills = document.querySelectorAll('.nav-pill');

  // Map elements for quick lookup
  tocLinks.forEach(link => {
    const id = link.getAttribute('href').substring(1);
    sectionMap.set(id, { toc: link, pill: null });
  });

  navPills.forEach(pill => {
    const id = pill.getAttribute('href').substring(1);
    if (sectionMap.has(id)) {
      sectionMap.get(id).pill = pill;
    }
  });

  // Setup observer
  const options = {
    root: null,
    rootMargin: '-100px 0px -60% 0px', // Trigger when section is in top half of viewport
    threshold: 0
  };

  observer = new IntersectionObserver((entries) => {
    // Find the first intersecting entry
    const activeEntry = entries.find(entry => entry.isIntersecting);
    
    if (activeEntry) {
      const id = activeEntry.target.id;
      updateActiveState(id);
    }
  }, options);

  // Observe all sections
  sections.forEach(section => observer.observe(section));
}

function updateActiveState(activeId) {
  // Remove active class from all
  sectionMap.forEach(elements => {
    if (elements.toc) elements.toc.classList.remove('active');
    if (elements.pill) elements.pill.classList.remove('active');
  });

  // Add active class to current
  const activeElements = sectionMap.get(activeId);
  if (activeElements) {
    if (activeElements.toc) {
      activeElements.toc.classList.add('active');
      // Ensure TOC link is visible in scroll container
      ensureVisibleInContainer(activeElements.toc, document.getElementById('toc-sidebar'));
    }
    
    if (activeElements.pill) {
      activeElements.pill.classList.add('active');
      // Ensure nav pill is visible in scroll container
      ensureVisibleInContainer(activeElements.pill, document.getElementById('section-nav-pills'));
    }
  }
}

function ensureVisibleInContainer(element, container) {
  if (!element || !container) return;
  
  const eleTop = element.offsetTop;
  const eleBottom = eleTop + element.clientHeight;
  const containerTop = container.scrollTop;
  const containerBottom = containerTop + container.clientHeight;

  // Horizontal scroll logic for nav pills
  if (container.id === 'section-nav-pills') {
    const eleLeft = element.offsetLeft;
    const eleRight = eleLeft + element.clientWidth;
    const containerLeft = container.scrollLeft;
    const containerRight = containerLeft + container.clientWidth;
    
    if (eleLeft < containerLeft) {
      container.scrollTo({ left: eleLeft - 20, behavior: 'smooth' });
    } else if (eleRight > containerRight) {
      container.scrollTo({ left: eleRight - container.clientWidth + 20, behavior: 'smooth' });
    }
    return;
  }

  // Vertical scroll logic for TOC
  if (eleTop < containerTop) {
    container.scrollTo({ top: eleTop - 20, behavior: 'smooth' });
  } else if (eleBottom > containerBottom) {
    container.scrollTo({ top: eleBottom - container.clientHeight + 20, behavior: 'smooth' });
  }
}
