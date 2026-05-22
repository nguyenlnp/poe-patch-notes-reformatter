import { parseHtml } from './server/parser.js';
import fs from 'fs';

async function testUrl(url) {
  console.log(`\n=== Testing URL: ${url} ===`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      }
    });
    const html = await response.text();
    const result = parseHtml(html);
    console.log('Title:', result.title);
    console.log('Version:', result.version);
    console.log('Date:', result.date);
    console.log('Total Changes:', result.totalChanges);
    console.log('Summary:', result.summary);
    
    // Find all media elements
    const mediaItems = [];
    result.sections.forEach(sec => {
      sec.changes.forEach(c => {
        if (c.type === 'image' || c.type === 'video') mediaItems.push(c);
      });
      sec.subsections.forEach(sub => {
        sub.changes.forEach(c => {
          if (c.type === 'image' || c.type === 'video') mediaItems.push(c);
        });
      });
    });
    console.log('Extracted Media Items count:', mediaItems.length);
    console.log('Sample Media Items:', mediaItems.slice(0, 5));
    
    fs.writeFileSync('parsed_result.json', JSON.stringify(result, null, 2));
    console.log('Saved full parsed result to parsed_result.json');
  } catch (err) {
    console.error(`Error:`, err);
  }
}

async function run() {
  await testUrl('https://www.pathofexile.com/forum/view-thread/3924293');
}

run();
