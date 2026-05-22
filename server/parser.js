import * as cheerio from 'cheerio';

// ─── Classification Patterns ────────────────────────────────────────────────

const CLASSIFICATION_PATTERNS = {
  fix: [
    /^fixed\b/i,
    /^resolved\b/i,
    /fixed a bug/i,
    /fixed an issue/i,
    /fixed a crash/i,
    /no longer incorrectly/i,
    /no longer erroneously/i,
    /should no longer crash/i,
    /now correctly/i,
    /now properly/i,
  ],
  new: [
    /^added\b/i,
    /^new\b/i,
    /^introducing\b/i,
    /^introduced\b/i,
    /has been added/i,
    /have been added/i,
    /now available/i,
  ],
  rework: [
    /\breworked\b/i,
    /\bchanged to\b/i,
    /\breplaced\b/i,
    /\bconverted to\b/i,
    /\bis now a\b/i,
    /\bhas been changed\b/i,
    /\bhas been reworked\b/i,
    /\bhas been redesigned\b/i,
    /\bhas been replaced\b/i,
    /\bcompletely redesigned\b/i,
    /\bnow instead\b/i,
  ],
  nerf: [
    /\breduced\b/i,
    /\bdecreased\b/i,
    /\bno longer\b/i,
    /\bremoved\b/i,
    /\blowered\b/i,
    /\bless effective\b/i,
    /\bnow deals less\b/i,
    /\bhas been nerfed\b/i,
    /\bhas less\b/i,
    /\bcan no longer\b/i,
    /\bwill no longer\b/i,
  ],
  buff: [
    /\bincreased\b/i,
    /\badded bonus\b/i,
    /\bnow grants more\b/i,
    /\bimproved\b/i,
    /\bnow deals more\b/i,
    /\bhas been buffed\b/i,
    /\bhas more\b/i,
    /\bnow grants additional\b/i,
    /\badditional\b.*\bgranted\b/i,
    /\bbuff(?:ed)?\b/i,
    /\bhigher\b/i,
  ],
};

// Order matters: fix > new > rework > nerf > buff > neutral
// "no longer" could be nerf OR fix, so fix patterns checked first
const CLASSIFICATION_ORDER = ['fix', 'new', 'rework', 'nerf', 'buff'];

// ─── Numerical Value Extraction ─────────────────────────────────────────────

const VALUE_PATTERNS = [
  // "now X (previously Y)" or "now X (was Y)"
  {
    regex: /now\s+([\d.]+%?)\s*\((?:previously|was|from)\s+([\d.]+%?)\)/i,
    newIdx: 1,
    oldIdx: 2,
  },
  // "increased from X to Y" or "reduced from X to Y"
  {
    regex: /(?:increased|raised|improved|grown|bumped)\s+from\s+([\d.]+%?)\s+to\s+([\d.]+%?)/i,
    oldIdx: 1,
    newIdx: 2,
    forceDirection: 'up',
  },
  {
    regex: /(?:reduced|decreased|lowered|dropped|cut)\s+from\s+([\d.]+%?)\s+to\s+([\d.]+%?)/i,
    oldIdx: 1,
    newIdx: 2,
    forceDirection: 'down',
  },
  // "from X to Y" (generic)
  {
    regex: /from\s+([\d.]+%?)\s+to\s+([\d.]+%?)/i,
    oldIdx: 1,
    newIdx: 2,
  },
  // "X% (previously Y%)" or "X (previously Y)"
  {
    regex: /([\d.]+%?)\s*\((?:previously|was|from)\s+([\d.]+%?)\)/i,
    newIdx: 1,
    oldIdx: 2,
  },
  // "changed from X to Y"
  {
    regex: /changed\s+from\s+([\d.]+%?)\s+to\s+([\d.]+%?)/i,
    oldIdx: 1,
    newIdx: 2,
  },
];

/**
 * Extract old/new numerical values and determine direction from change text.
 */
function extractValues(text) {
  for (const pattern of VALUE_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      const oldValue = match[pattern.oldIdx];
      const newValue = match[pattern.newIdx];

      let changeDirection = pattern.forceDirection || null;

      if (!changeDirection) {
        const oldNum = parseFloat(oldValue);
        const newNum = parseFloat(newValue);
        if (!isNaN(oldNum) && !isNaN(newNum)) {
          if (newNum > oldNum) changeDirection = 'up';
          else if (newNum < oldNum) changeDirection = 'down';
        }
      }

      return { oldValue, newValue, changeDirection };
    }
  }
  return { oldValue: null, newValue: null, changeDirection: null };
}

/**
 * Classify a single change line into buff/nerf/fix/new/rework/neutral.
 * Uses value direction to override keyword classification when appropriate.
 */
function classifyChange(text, valueInfo) {
  // First check pattern-based classification
  let keywordType = 'neutral';

  for (const type of CLASSIFICATION_ORDER) {
    const patterns = CLASSIFICATION_PATTERNS[type];
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        keywordType = type;
        break;
      }
    }
    if (keywordType !== 'neutral') break;
  }

  // If we have numerical values, use direction to potentially refine the type
  if (valueInfo.changeDirection && keywordType === 'neutral') {
    keywordType = valueInfo.changeDirection === 'up' ? 'buff' : 'nerf';
  }

  // Handle the "no longer" ambiguity: if "no longer" is a fix context, keep fix
  // If classified as nerf due to "no longer" but values show an increase, override to buff
  if (keywordType === 'nerf' && valueInfo.changeDirection === 'up') {
    keywordType = 'buff';
  }
  if (keywordType === 'buff' && valueInfo.changeDirection === 'down') {
    keywordType = 'nerf';
  }

  return keywordType;
}

/**
 * Process a single change text string into a structured change object.
 */
function processChangeItem(text) {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return null;

  const valueInfo = extractValues(cleanText);
  const type = classifyChange(cleanText, valueInfo);

  return {
    text: cleanText,
    type,
    oldValue: valueInfo.oldValue,
    newValue: valueInfo.newValue,
    changeDirection: valueInfo.changeDirection,
  };
}

// ─── Version & Date Extraction ──────────────────────────────────────────────

const VERSION_REGEX = /(\d+\.\d+\.\d+[a-z]?(?:\.\d+)?)/i;

function extractVersion(title) {
  const match = title.match(VERSION_REGEX);
  return match ? match[1] : null;
}

function extractDateFromText(text) {
  // Common date patterns in patch notes
  const patterns = [
    /(\w+ \d{1,2},?\s*\d{4})/,           // "January 15, 2025"
    /(\d{4}-\d{2}-\d{2})/,                // "2025-01-15"
    /(\d{1,2}\/\d{1,2}\/\d{4})/,          // "01/15/2025"
    /(\d{1,2}\s+\w+\s+\d{4})/,            // "15 January 2025"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ─── Summary Counter ────────────────────────────────────────────────────────

function buildSummary(sections) {
  const summary = { buffs: 0, nerfs: 0, fixes: 0, new: 0, reworks: 0, neutral: 0 };
  let totalChanges = 0;

  for (const section of sections) {
    for (const change of section.changes) {
      totalChanges++;
      incrementSummary(summary, change.type);
    }
    for (const subsection of section.subsections) {
      for (const change of subsection.changes) {
        totalChanges++;
        incrementSummary(summary, change.type);
      }
    }
  }

  return { totalChanges, summary };
}

function incrementSummary(summary, type) {
  switch (type) {
    case 'buff': summary.buffs++; break;
    case 'nerf': summary.nerfs++; break;
    case 'fix': summary.fixes++; break;
    case 'new': summary.new++; break;
    case 'rework': summary.reworks++; break;
    default: summary.neutral++; break;
  }
}

// ─── HTML Parser Helpers ────────────────────────────────────────────────────

function parseVideoUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const ytRegexes = [
    /^(?:https?:)?\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i,
    /^(?:https?:)?\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i,
    /^(?:https?:)?\/\/(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]+)/i,
    /^(?:https?:)?\/\/youtu\.be\/([a-zA-Z0-9_-]+)/i
  ];

  for (const regex of ytRegexes) {
    const match = url.match(regex);
    if (match) {
      const id = match[1];
      return {
        embedUrl: `https://www.youtube.com/embed/${id}`,
        originalUrl: url
      };
    }
  }

  const vimeoRegexes = [
    /^(?:https?:)?\/\/(?:www\.)?vimeo\.com\/(\d+)/i,
    /^(?:https?:)?\/\/player\.vimeo\.com\/video\/(\d+)/i
  ];

  for (const regex of vimeoRegexes) {
    const match = url.match(regex);
    if (match) {
      const id = match[1];
      return {
        embedUrl: `https://player.vimeo.com/video/${id}`,
        originalUrl: url
      };
    }
  }

  return null;
}

function compactText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function getElementFingerprint($el) {
  if (!$el || $el.length === 0) return '';
  const id = $el.attr('id') || '';
  const className = $el.attr('class') || '';
  return `${id} ${className}`;
}

function scoreContentCandidate($el) {
  const text = compactText($el.text());
  if (text.length < 120) return -1;

  const headingCount = $el.find('h1, h2, h3, h4, h5, h6').length;
  const listItemCount = $el.find('li').length;
  const paragraphCount = $el.find('p').length;
  const fingerprint = getElementFingerprint($el);

  let score = text.length;
  score += headingCount * 700;
  score += listItemCount * 180;
  score += paragraphCount * 80;

  if (/content|post|article|news|thread/i.test(fingerprint)) score += 1200;
  if (/nav|menu|header|footer|sidebar|language|login|account|pagination|breadcrumb/i.test(fingerprint)) {
    score -= 2500;
  }

  return score;
}

function findPostContent($) {
  const contentSelectors = [
    'tr.newsPost .content',
    '.newsPost .content',
    '.newsPost',
    'table.forumPostListTable tr:first-child td.content-container .content',
    '.forumPostListTable tr:first-child .content',
    '.forumPostListTable tr:first-child .content-container',
    '.content-container .content',
    '.content-container',
    '.post_body:first',
    '.postContainer:first .content',
    '.post-content',
    '.postContent',
    '.forum-post-content',
    '.forumPostContent',
    '#newsContent',
    '.newsContent',
    'article:first',
    'main:first',
  ];

  const candidates = [];
  const seen = new Set();

  function addCandidate(el, selectorWeight = 0) {
    if (!el || seen.has(el)) return;
    seen.add(el);
    const $el = $(el);
    const score = scoreContentCandidate($el) + selectorWeight;
    if (score > 0) {
      candidates.push({ el: $el, score });
    }
  }

  contentSelectors.forEach((selector, index) => {
    $(selector).each(function () {
      addCandidate(this, 2000 - index * 20);
    });
  });

  if (candidates.length === 0) {
    $('article, main, section, div, td').each(function () {
      addCandidate(this, 0);
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.el || null;
}

function nextMeaningfulElement($el, $) {
  let node = $el[0] ? $el[0].nextSibling : null;

  while (node) {
    if (node.nodeType === 3) {
      if (node.data && node.data.trim()) return null;
    } else if (node.nodeType === 1) {
      const tagName = (node.tagName || '').toLowerCase();
      if (tagName !== 'br') return $(node);
    }
    node = node.nextSibling;
  }

  return null;
}

function isPlainHeaderBeforeList($el, $) {
  const tagName = $el[0] && $el[0].tagName ? $el[0].tagName.toLowerCase() : '';
  if (!['p', 'div', 'span'].includes(tagName)) return false;
  if ($el.closest('li').length > 0) return false;
  if ($el.children('ul, ol, h1, h2, h3, h4, h5, h6, p, div, iframe, img').length > 0) return false;

  const text = compactText($el.text());
  if (!text || text.length > 90) return false;
  if (/[.!?]$/.test(text)) return false;

  const $next = nextMeaningfulElement($el, $);
  if (!$next || $next.length === 0) return false;

  const nextTagName = ($next[0].tagName || '').toLowerCase();
  return nextTagName === 'ul' || nextTagName === 'ol';
}

function extractReadableText($content, $) {
  const lines = [];

  function pushLine(text) {
    const clean = compactText(text);
    if (clean) lines.push(clean);
  }

  function walk($el) {
    if (!$el || $el.length === 0) return;

    const tagName = ($el[0].tagName || '').toLowerCase();

    if (/^h[1-6]$/.test(tagName)) {
      const level = parseInt(tagName.substring(1), 10);
      pushLine(`${'#'.repeat(level)} ${$el.text()}`);
      return;
    }

    if (tagName === 'li') {
      const $clone = $el.clone();
      $clone.children('ul, ol').remove();
      pushLine(`- ${$clone.text()}`);
      $el.children('ul, ol').each(function () {
        walk($(this));
      });
      return;
    }

    if (tagName === 'br') {
      lines.push('');
      return;
    }

    if (tagName === 'ul' || tagName === 'ol') {
      $el.children('li').each(function () {
        walk($(this));
      });
      return;
    }

    const hasStructuredChildren = $el.children('h1, h2, h3, h4, h5, h6, ul, ol, p, div, section, article, table, tr, td, br').length > 0;
    if (hasStructuredChildren) {
      $el.children().each(function () {
        walk($(this));
      });
      return;
    }

    if (['p', 'div', 'span', 'td', 'section', 'article'].includes(tagName)) {
      pushLine($el.text());
    }
  }

  walk($content);
  return lines
    .filter((line, index, arr) => line || (arr[index - 1] && arr[index + 1]))
    .join('\n');
}

function isStandaloneHeader($el, $) {
  const tagName = $el[0] && $el[0].tagName ? $el[0].tagName.toLowerCase() : '';
  if (tagName !== 'strong' && tagName !== 'b') return false;
  
  if ($el.closest('li').length > 0) return false;
  
  const text = $el.text().trim();
  if (!text || text.length > 120) return false;
  
  const parent = $el.parent();
  const parentTagName = parent[0] && parent[0].tagName ? parent[0].tagName.toLowerCase() : '';
  const parentText = parent.text().trim();
  
  if (parentText === text && (parentTagName === 'p' || parentTagName === 'div')) {
    return true;
  }
  
  const next = $el[0] ? $el[0].nextSibling : null;
  if (next) {
    let curr = next;
    while (curr) {
      if (curr.nodeType === 3) { // text node
        if (curr.data && curr.data.trim()) {
          return false;
        }
      } else if (curr.nodeType === 1) { // element node
        const tag = curr.tagName ? curr.tagName.toLowerCase() : '';
        if (tag === 'br' || tag === 'ul' || tag === 'ol') {
          return true;
        }
        return false;
      }
      curr = curr.nextSibling;
    }
  }
  
  return false;
}

function findHeaders($content, $) {
  const candidates = [];
  
  function scan($el) {
    $el.contents().each(function() {
      if (this.nodeType !== 1) return;
      
      const tagName = (this.tagName || '').toLowerCase();
      const $child = $(this);
      
      if (tagName === 'ul' || tagName === 'ol') {
        return;
      }
      
      if (/^h[1-6]$/.test(tagName)) {
        const text = $child.text().trim();
        if (text) {
          candidates.push({
            el: $child,
            text,
            level: parseInt(tagName.substring(1)),
          });
        }
        return;
      }
      
      if (isStandaloneHeader($child, $)) {
        candidates.push({
          el: $child,
          text: $child.text().trim(),
          level: 7,
        });
        return;
      }
      
      if (tagName === 'p' || tagName === 'div') {
        const $strong = $child.children('strong, b').first();
        if ($strong.length > 0) {
          const text = $child.text().trim();
          const strongText = $strong.text().trim();
          if (text && strongText && text === strongText && text.length < 120) {
            candidates.push({
              el: $child,
              text,
              level: 7,
            });
            return;
          }
        }
      }
      
      if (tagName === 'div' || tagName === 'span' || tagName === 'section') {
        scan($child);
      }
    });
  }
  
  scan($content);
  return candidates;
}

// ─── HTML Parser (Cheerio) ──────────────────────────────────────────────────

/**
 * Parse forum thread HTML and extract structured changelog data.
 * @param {string} html - The raw HTML of the forum page
 * @returns {object} Structured changelog JSON
 */
export function parseHtml(html) {
  const $ = cheerio.load(html);

  // ── Extract title ──
  let title = '';
  const threadTitle = $('h1.topicTitle').first().text().trim()
    || $('h1').first().text().trim()
    || $('title').text().trim();
  title = threadTitle;

  // ── Extract date ──
  let date = null;
  const postDate = $('.post_date').first().text().trim()
    || $('.posted-at').first().text().trim()
    || $('time').first().attr('datetime')
    || $('time').first().text().trim()
    || $('.post_info .date').first().text().trim();
  if (postDate) {
    date = postDate;
  }

  // ── Find the first post content ──
  const $content = findPostContent($);

  if (!$content || $content.length === 0) {
    throw new Error('Could not find post content in the HTML. The page structure may have changed.');
  }

  // ── Dynamic Heading Scanning ──
  const candidates = findHeaders($content, $);
  let sectionLevel = 1;
  let subsectionLevel = 7;
  let hasTitleCandidate = false;
  let titleCandidateText = '';

  if (candidates.length > 0) {
    const levels = [...new Set(candidates.map(c => c.level))].sort((a, b) => a - b);
    const minLevel = levels[0];
    const minLevelCandidates = candidates.filter(c => c.level === minLevel);
    
    if (minLevelCandidates.length === 1 && candidates[0].level === minLevel) {
      hasTitleCandidate = true;
      titleCandidateText = candidates[0].text;
      
      const remaining = candidates.slice(1);
      if (remaining.length > 0) {
        const remainingLevels = [...new Set(remaining.map(c => c.level))].sort((a, b) => a - b);
        sectionLevel = remainingLevels[0];
        subsectionLevel = remainingLevels[1] || 8;
      } else {
        sectionLevel = minLevel;
        subsectionLevel = 8;
        hasTitleCandidate = false;
      }
    } else {
      sectionLevel = minLevel;
      subsectionLevel = levels[1] || 8;
    }
  }

  if (hasTitleCandidate && titleCandidateText) {
    if (!title || title.includes('Forum - Path of Exile') || title.length > 80) {
      title = titleCandidateText;
    }
  }

  // ── Traverse and build sections ──
  const sections = [];
  let currentSection = null;
  let currentSubsection = null;
  let inTableOfContents = false;

  function addSection(name) {
    if (name.toLowerCase() === 'table of contents') {
      inTableOfContents = true;
      return;
    }
    inTableOfContents = false;

    currentSection = {
      id: `section-${sections.length}`,
      name: name,
      changes: [],
      subsections: [],
    };
    currentSubsection = null;
    sections.push(currentSection);
  }

  function addSubsection(name) {
    if (inTableOfContents) return;
    
    if (!currentSection) {
      addSection('General');
    }
    currentSubsection = {
      name: name,
      changes: [],
    };
    currentSection.subsections.push(currentSubsection);
  }

  function addChange(changeItem) {
    if (inTableOfContents) return;
    if (!changeItem) return;

    if (!currentSection) {
      addSection('General');
    }
    if (currentSubsection) {
      currentSubsection.changes.push(changeItem);
    } else {
      currentSection.changes.push(changeItem);
    }
  }

  function traverseNode($el) {
    if ($el.length === 0) return;
    const tagName = ($el[0].tagName || '').toLowerCase();

    // Skip the title candidate header
    if (hasTitleCandidate && $el.text().trim() === titleCandidateText && (/^h[1-6]$/.test(tagName))) {
      return;
    }

    const isHeading = /^h[1-6]$/.test(tagName);
    const isBoldHeader = isStandaloneHeader($el, $);

    if (isHeading || isBoldHeader) {
      const level = isHeading ? parseInt(tagName.substring(1)) : 7;
      const text = $el.text().trim();
      if (text) {
        if (level <= sectionLevel) {
          addSection(text);
        } else {
          addSubsection(text);
        }
      }
      return;
    }

    if (isPlainHeaderBeforeList($el, $)) {
      addSubsection($el.text().trim());
      return;
    }

    if (tagName === 'img') {
      const src = $el.attr('src');
      if (src && !src.includes('/smiley/') && !src.includes('/emoticons/')) {
        const width = parseInt($el.attr('width'));
        const height = parseInt($el.attr('height'));
        if (!(width < 32 || height < 32)) {
          addChange({
            type: 'image',
            src: src,
            alt: $el.attr('alt') || '',
            text: ''
          });
        }
      }
      return;
    }

    if (tagName === 'iframe') {
      const src = $el.attr('src');
      if (src) {
        const videoInfo = parseVideoUrl(src);
        if (videoInfo) {
          addChange({
            type: 'video',
            src: videoInfo.embedUrl,
            originalUrl: videoInfo.originalUrl,
            text: ''
          });
        }
      }
      return;
    }

    if (tagName === 'a') {
      const href = $el.attr('href');
      if (href) {
        const videoInfo = parseVideoUrl(href);
        if (videoInfo) {
          addChange({
            type: 'video',
            src: videoInfo.embedUrl,
            originalUrl: videoInfo.originalUrl,
            text: ''
          });
          return;
        }
      }
    }

    if (tagName === 'ul' || tagName === 'ol') {
      $el.children('li').each(function () {
        const $li = $(this);
        const $clone = $li.clone();
        $clone.children('ul, ol').remove();
        const mainText = $clone.text().trim();

        const change = processChangeItem(mainText);
        if (change) {
          addChange(change);
        }

        $li.find('img, iframe, a').each(function () {
          const $subEl = $(this);
          const subTag = (this.tagName || '').toLowerCase();
          if (subTag === 'img') {
            const src = $subEl.attr('src');
            if (src && !src.includes('/smiley/') && !src.includes('/emoticons/')) {
              addChange({
                type: 'image',
                src: src,
                alt: $subEl.attr('alt') || '',
                text: ''
              });
            }
          } else if (subTag === 'iframe') {
            const src = $subEl.attr('src');
            if (src) {
              const videoInfo = parseVideoUrl(src);
              if (videoInfo) {
                addChange({
                  type: 'video',
                  src: videoInfo.embedUrl,
                  originalUrl: videoInfo.originalUrl,
                  text: ''
                });
              }
            }
          }
        });

        $li.children('ul, ol').each(function () {
          traverseNode($(this));
        });
      });
      return;
    }

    if (tagName === 'p' || tagName === 'div' || tagName === 'span') {
      const hasBlockChildren = $el.children('ul, ol, h1, h2, h3, h4, h5, h6, p, div, iframe').length > 0;
      if (hasBlockChildren) {
        $el.children().each(function () {
          traverseNode($(this));
        });
      } else {
        const text = $el.text().trim();
        if (text) {
          const $img = $el.find('img');
          const imgList = [];
          $img.each(function () {
            const src = $(this).attr('src');
            if (src && !src.includes('/smiley/') && !src.includes('/emoticons/')) {
              imgList.push(src);
            }
          });

          if (imgList.length > 0) {
            imgList.forEach(src => {
              addChange({
                type: 'image',
                src: src,
                alt: '',
                text: ''
              });
            });
          } else {
            const $a = $el.find('a');
            let isVideoLink = false;
            $a.each(function () {
              const href = $(this).attr('href');
              if (href) {
                const videoInfo = parseVideoUrl(href);
                if (videoInfo && text.length < 150) {
                  addChange({
                    type: 'video',
                    src: videoInfo.embedUrl,
                    originalUrl: videoInfo.originalUrl,
                    text: ''
                  });
                  isVideoLink = true;
                }
              }
            });

            if (!isVideoLink) {
              const change = processChangeItem(text);
              if (change && !/return to top|back to top/i.test(text)) {
                addChange(change);
              }
            }
          }
        }
      }
      return;
    }

    $el.children().each(function () {
      traverseNode($(this));
    });
  }

  // Start traversing the content element
  traverseNode($content);

  // Filter out empty sections
  const filteredSections = sections.filter(sec => {
    const hasChanges = sec.changes.length > 0;
    const hasSubsections = sec.subsections.some(sub => sub.changes.length > 0 || sub.changes.some(c => c.type === 'image' || c.type === 'video'));
    return hasChanges || hasSubsections;
  });

  if (filteredSections.length === 0) {
    const fallbackText = extractReadableText($content, $);
    const fallback = fallbackText.trim() ? parseText(fallbackText) : null;

    if (fallback && fallback.sections.length > 0) {
      return {
        title: title || fallback.title,
        version: extractVersion(title) || fallback.version,
        date: date || fallback.date,
        totalChanges: fallback.totalChanges,
        summary: fallback.summary,
        sections: fallback.sections,
      };
    }
  }

  // ── Extract version from title ──
  const version = extractVersion(title);

  // If no date was found from elements, try extracting from text
  if (!date) {
    date = extractDateFromText($content.text());
  }

  // ── Build summary ──
  const { totalChanges, summary } = buildSummary(filteredSections);

  return {
    title: title || 'Untitled Patch Notes',
    version,
    date,
    totalChanges,
    summary,
    sections: filteredSections,
  };
}

// ─── Text Parser ────────────────────────────────────────────────────────────

/**
 * Parse raw text patch notes and extract structured changelog data.
 * @param {string} rawText - The raw text of the patch notes
 * @returns {object} Structured changelog JSON
 */
export function parseText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Invalid input: expected a non-empty string of patch notes text.');
  }

  const lines = rawText.split(/\r?\n/);
  const sections = [];
  let currentSection = null;
  let currentSubsection = null;
  let title = '';
  let date = null;

  // Bullet prefixes
  const bulletRegex = /^\s*[-•*]\s+/;
  const indentedBulletRegex = /^\s{2,}[-•*]\s+/;
  // Section header heuristics
  const allCapsRegex = /^[A-Z][A-Z\s&,:()]{3,}$/;
  const markdownHeadingRegex = /^(#{1,4})\s+(.+)/;
  const colonHeaderRegex = /^([A-Z][A-Za-z\s&]+):$/;
  // Numbered bullet: "1." or "1)"
  const numberedBulletRegex = /^\s*\d+[.)]\s+/;

  function ensureSection() {
    if (!currentSection) {
      currentSection = {
        id: `section-${sections.length}`,
        name: 'General',
        changes: [],
        subsections: [],
      };
      sections.push(currentSection);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // ── Try to detect the title (first non-empty line if it looks like a title) ──
    if (!title && i < 5 && !bulletRegex.test(trimmed) && !allCapsRegex.test(trimmed)) {
      // Check if it looks like a title (contains version or "patch notes" or "update")
      if (/patch|update|hotfix|changelog|version|\d+\.\d+/i.test(trimmed)) {
        title = trimmed.replace(/^#+\s*/, '');
        // Try extracting date from nearby lines
        if (!date) {
          for (let j = Math.max(0, i - 2); j < Math.min(lines.length, i + 3); j++) {
            const d = extractDateFromText(lines[j]);
            if (d) { date = d; break; }
          }
        }
        continue;
      }
    }

    // ── Markdown headings ──
    const mdMatch = trimmed.match(markdownHeadingRegex);
    if (mdMatch) {
      const level = mdMatch[1].length;
      const headingText = mdMatch[2].trim();

      if (level <= 2) {
        // Major section
        currentSection = {
          id: `section-${sections.length}`,
          name: headingText,
          changes: [],
          subsections: [],
        };
        currentSubsection = null;
        sections.push(currentSection);
      } else {
        // Subsection
        ensureSection();
        currentSubsection = { name: headingText, changes: [] };
        currentSection.subsections.push(currentSubsection);
      }
      continue;
    }

    // ── All-caps header ──
    if (allCapsRegex.test(trimmed) && trimmed.length > 3) {
      // Title-case the header for display
      const name = trimmed.replace(/\b\w+/g, w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      );
      currentSection = {
        id: `section-${sections.length}`,
        name,
        changes: [],
        subsections: [],
      };
      currentSubsection = null;
      sections.push(currentSection);
      continue;
    }

    // ── Colon-terminated header ──
    if (colonHeaderRegex.test(trimmed)) {
      const name = trimmed.replace(/:$/, '').trim();
      // Could be section or subsection depending on context
      if (!currentSection) {
        currentSection = {
          id: `section-${sections.length}`,
          name,
          changes: [],
          subsections: [],
        };
        sections.push(currentSection);
      } else {
        currentSubsection = { name, changes: [] };
        currentSection.subsections.push(currentSubsection);
      }
      continue;
    }

    // ── Non-bullet, non-header line that precedes bullet lines = subsection header ──
    if (!bulletRegex.test(trimmed) && !numberedBulletRegex.test(trimmed)) {
      // Peek ahead to see if next non-empty lines are bullets
      let nextIdx = i + 1;
      while (nextIdx < lines.length && !lines[nextIdx].trim()) nextIdx++;

      if (nextIdx < lines.length) {
        const nextTrimmed = lines[nextIdx].trim();
        if (bulletRegex.test(nextTrimmed) || numberedBulletRegex.test(nextTrimmed)) {
          // This line is a subsection header
          ensureSection();
          currentSubsection = { name: trimmed, changes: [] };
          currentSection.subsections.push(currentSubsection);
          continue;
        }
      }

      // If it doesn't precede bullets, check if it could be a standalone change
      // (lines that contain keywords like "fixed", "added", etc.)
      const change = processChangeItem(trimmed);
      if (change && change.type !== 'neutral') {
        ensureSection();
        if (currentSubsection) {
          currentSubsection.changes.push(change);
        } else {
          currentSection.changes.push(change);
        }
      } else if (!title) {
        title = trimmed;
      }
      continue;
    }

    // ── Bullet line ──
    if (bulletRegex.test(trimmed) || numberedBulletRegex.test(trimmed)) {
      const isIndented = indentedBulletRegex.test(raw);
      const cleanText = trimmed.replace(bulletRegex, '').replace(numberedBulletRegex, '').trim();

      const change = processChangeItem(cleanText);
      if (change) {
        ensureSection();

        if (isIndented && currentSubsection) {
          currentSubsection.changes.push(change);
        } else if (currentSubsection) {
          currentSubsection.changes.push(change);
        } else {
          currentSection.changes.push(change);
        }
      }
    }
  }

  // ── Extract version from title ──
  const version = extractVersion(title);

  // ── Attempt date extraction from full text if not found ──
  if (!date) {
    date = extractDateFromText(rawText);
  }

  // ── Build summary ──
  const { totalChanges, summary } = buildSummary(sections);

  return {
    title: title || 'Untitled Patch Notes',
    version,
    date,
    totalChanges,
    summary,
    sections,
  };
}
