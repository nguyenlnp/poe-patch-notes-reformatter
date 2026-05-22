import { getIconForType, formatDiff } from './utils/classify.js';

/**
 * Renders the Table of Contents sidebar
 */
export function renderTOC(sections) {
  if (!sections || sections.length === 0) return '';
  
  return sections.map((section, idx) => `
    <li>
      <a href="#section-${idx}" class="toc-link">
        ${escapeHtml(section.name)}
      </a>
    </li>
  `).join('');
}

/**
 * Renders the sticky navigation pills
 */
export function renderNavPills(sections) {
  if (!sections || sections.length === 0) return '';
  
  return sections.map((section, idx) => `
    <a href="#section-${idx}" class="nav-pill">
      ${escapeHtml(section.name)}
    </a>
  `).join('');
}

/**
 * Renders the main changelog content (sections, subsections, changes)
 */
export function renderChangelog(sections) {
  if (!sections || sections.length === 0) return '';

  return sections.map((section, sectionIdx) => `
    <section id="section-${sectionIdx}" class="section-card animate-fade-in-up stagger-${(sectionIdx % 10) + 1}">
      <div class="section-card__header">
        <svg class="section-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <h2 class="section-card__title">${escapeHtml(section.name)}</h2>
        <span class="section-card__badge">${countSectionChanges(section)} changes</span>
      </div>

      ${renderSubsections(section.subsections)}
      
      ${section.changes && section.changes.length > 0 ? `
        <div class="subsection__list">
          ${renderChanges(section.changes)}
        </div>
      ` : ''}
    </section>
  `).join('');
}

function renderSubsections(subsections) {
  if (!subsections || subsections.length === 0) return '';

  return subsections.map(sub => `
    <div class="subsection">
      <h3 class="subsection__title">${escapeHtml(sub.name)}</h3>
      <div class="subsection__list">
        ${renderChanges(sub.changes)}
      </div>
    </div>
  `).join('');
}

function renderChanges(changes) {
  if (!changes || changes.length === 0) return '';

  return changes.map(change => {
    if (change.type === 'image') {
      return `
        <div class="change-media change-media--image animate-fade-in">
          <img src="${change.src}" alt="${escapeHtml(change.alt)}" loading="lazy" />
        </div>
      `;
    }

    if (change.type === 'video') {
      return `
        <div class="change-media change-media--video animate-fade-in">
          <div class="video-container">
            <iframe src="${change.src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
          </div>
        </div>
      `;
    }

    const typeClass = `change-item--${change.type || 'neutral'}`;
    const iconHtml = getIconForType(change.type);
    const diffHtml = formatDiff(change.oldValue, change.newValue, change.changeDirection, change.type);
    
    // Process text to remove the "from X to Y" part if we have a diff block, 
    // or just let it render naturally if it's too complex to strip safely.
    // For now, we'll just render it naturally and append the diff block.
    
    return `
      <div class="change-item ${typeClass}">
        <div class="change-item__icon-wrapper">
          ${iconHtml}
        </div>
        <div class="change-item__content">
          <div class="change-item__text">${highlightKeywords(escapeHtml(change.text))}</div>
          ${diffHtml}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Highlights common keywords in the text (like 'increased', 'reduced')
 */
function highlightKeywords(text) {
  return text
    .replace(/\b(increased|added|now grants|improved)\b/gi, '<strong>$1</strong>')
    .replace(/\b(reduced|decreased|removed|no longer|lowered)\b/gi, '<strong>$1</strong>')
    .replace(/\b(Fixed a bug|Fixed a crash)\b/gi, '<strong>$1</strong>');
}

/**
 * Helper to count total changes in a section (including its subsections)
 */
function countSectionChanges(section) {
  let count = (section.changes || []).length;
  if (section.subsections) {
    count += section.subsections.reduce((acc, sub) => acc + (sub.changes || []).length, 0);
  }
  return count;
}

/**
 * Escapes HTML characters
 */
function escapeHtml(unsafe) {
  return (unsafe || '').toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
