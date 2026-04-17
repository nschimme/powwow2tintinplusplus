import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import MarkdownIt from 'markdown-it';
import { globSync } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

// Custom plugin to support header IDs and auto-slugging
const originalHeadingOpen = md.renderer.rules.heading_open || function(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.heading_open = function(tokens, idx, options, env, self) {
  const inlineToken = tokens[idx + 1];
  if (inlineToken && inlineToken.type === 'inline') {
    // Check for explicit ID: ## Title { #id }
    const match = inlineToken.content.match(/\{\s*#([\w-]+)\s*\}/);
    if (match) {
      const id = match[1];
      tokens[idx].attrPush(['id', id]);
      inlineToken.content = inlineToken.content.replace(match[0], '').trim();
      if (inlineToken.children) {
        inlineToken.children.forEach(child => {
           if (child.type === 'text') child.content = child.content.replace(match[0], '').trim();
        });
      }
    } else {
      // Auto-slugify: ## My Title -> id="my-title"
      const id = inlineToken.content
        .toLowerCase()
        .replace(/#+/g, '') // remove # from JMC commands
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      if (id) tokens[idx].attrPush(['id', id]);
    }
  }
  return originalHeadingOpen(tokens, idx, options, env, self);
};

function getPartial(name) {
  return fs.readFileSync(resolve(__dirname, `docs/partials/${name}.html`), 'utf-8');
}

// Function to generate documentation pages from markdown
function generateDocPages() {
  const mdFiles = globSync('docs/src/**/*.md');
  const layout = fs.readFileSync(resolve(__dirname, 'docs/layouts/doc-layout.html'), 'utf-8');
  const navbar = getPartial('navbar');
  const meta = getPartial('meta');

  const pages = {};

  mdFiles.forEach(file => {
    const content = fs.readFileSync(resolve(__dirname, file), 'utf-8');
    const htmlContent = md.render(content);
    const filename = file.split('/').pop().replace('.md', '.html');

    // Simple logic to determine title
    let title = filename.replace('.html', '').replace(/_/g, ' ');
    if (filename.includes('jmc')) title = 'JMC Help';
    else if (filename.includes('powwow')) title = 'Powwow Help';
    else if (filename.includes('tutorial')) title = 'TinTin++ Tutorial';
    else if (filename.includes('help')) title = 'TinTin++ Help';

    const pageHtml = layout
      .replace('<!-- __TITLE__ -->', title)
      .replace('<!-- __DESCRIPTION__ -->', `Documentation for ${title} in TinTin++ Script Converter`)
      .replace('<!-- __KEYWORDS__ -->', `TinTin++, MUD, ${title}, migration, converter`)
      .replace('<!-- __CONTENT__ -->', htmlContent)
      .replace('<!-- __NAVBAR__ -->', navbar)
      .replace('<!-- __META__ -->', meta);

    fs.writeFileSync(resolve(__dirname, filename), pageHtml);
    pages[filename.replace('.html', '')] = resolve(__dirname, filename);
  });

  return pages;
}

const docPages = generateDocPages();

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...docPages
      }
    }
  },
  plugins: [
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        if (html.includes('<!-- __NAVBAR__ -->')) {
           return html
             .replace('<!-- __NAVBAR__ -->', getPartial('navbar'))
             .replace('<!-- __META__ -->', getPartial('meta'))
             .replace('<!-- __TITLE__ -->', 'TinTin++ Script Converter | Migrate Powwow & JMC Scripts');
        }
        return html;
      }
    }
  ]
});
