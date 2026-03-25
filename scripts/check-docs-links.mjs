import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOC_ROOTS = [
  'README.md',
  'AGENT.md',
  'CONTRIBUTING.md',
  'client/README.md',
  'server/README.md',
  'tests/integration/README.md',
  'wiki',
  'docs',
];

const MARKDOWN_LINK_RE = /!?\[[^\]]*]\(([^)]+)\)/g;

function isMarkdownFile(filePath) {
  return filePath.toLowerCase().endsWith('.md');
}

function walkMarkdownFiles(entryPath, files) {
  const fullPath = path.join(ROOT, entryPath);
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(fullPath)) {
      walkMarkdownFiles(path.join(entryPath, child), files);
    }
    return;
  }
  if (stat.isFile() && isMarkdownFile(entryPath)) {
    files.push(entryPath);
  }
}

function shouldIgnoreTarget(target) {
  return (
    !target ||
    target.startsWith('#') ||
    target.startsWith('http://') ||
    target.startsWith('https://') ||
    target.startsWith('mailto:') ||
    target.startsWith('tel:') ||
    target.startsWith('data:')
  );
}

function resolveTarget(filePath, rawTarget) {
  const noAnchor = rawTarget.split('#')[0];
  const cleanTarget = noAnchor.split('?')[0];
  return path.resolve(path.dirname(path.join(ROOT, filePath)), cleanTarget);
}

const markdownFiles = [];
for (const root of DOC_ROOTS) {
  if (fs.existsSync(path.join(ROOT, root))) {
    walkMarkdownFiles(root, markdownFiles);
  }
}

const errors = [];

for (const filePath of markdownFiles) {
  const content = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
  for (const match of content.matchAll(MARKDOWN_LINK_RE)) {
    const target = String(match[1] || '').trim();
    if (shouldIgnoreTarget(target)) continue;
    const resolved = resolveTarget(filePath, target);
    if (!fs.existsSync(resolved)) {
      errors.push(`${filePath} -> ${target}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Broken local Markdown links detected:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`docs:check OK (${markdownFiles.length} markdown files checked)`);
