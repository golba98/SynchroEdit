const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const publicRoot = path.join(root, 'public');
const fileReferencePath = path.join(root, 'docs/FILE_REFERENCE.md');

const retiredPublicPaths = [
  'config.example.local.js',
  'config.example.production.js',
  'css/pages/start.css',
  'js/features/auth/pages/signup.js',
  'js/features/auth/pages/start.js',
  'js/features/auth/synchro/SynchroStates.js',
  'pages/start.html',
];

function walk(directory, predicate = () => true) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(entryPath, predicate);
    return predicate(entryPath) ? [entryPath] : [];
  });
}

function assertLocalReferenceExists(sourceFile, reference) {
  if (!reference || /^(?:[a-z]+:|#|data:|\/\/)/i.test(reference)) return;
  const cleanReference = reference.split(/[?#]/, 1)[0];
  if (!cleanReference) return;

  const target = cleanReference.startsWith('/')
    ? path.join(publicRoot, cleanReference.slice(1))
    : path.resolve(path.dirname(sourceFile), cleanReference);

  expect({
    source: path.relative(root, sourceFile),
    reference,
    exists: fs.existsSync(target),
  }).toEqual({
    source: path.relative(root, sourceFile),
    reference,
    exists: true,
  });
}

describe('static asset integrity', () => {
  test('owned browser files no longer reference the retired /scripts tree', () => {
    const files = walk(
      publicRoot,
      (file) => /\.(?:html|js|css)$/.test(file) && !file.includes('/vendor/')
    );
    const offenders = files.filter((file) => fs.readFileSync(file, 'utf8').includes('/scripts/'));
    expect(offenders.map((file) => path.relative(root, file))).toEqual([]);
  });

  test('retired browser files are absent and no longer referenced', () => {
    const ownedFiles = walk(
      publicRoot,
      (file) => /\.(?:html|js|css)$/.test(file) && !file.includes('/vendor/')
    );

    for (const retiredPath of retiredPublicPaths) {
      expect({ retiredPath, exists: fs.existsSync(path.join(publicRoot, retiredPath)) }).toEqual({
        retiredPath,
        exists: false,
      });

      const reference = retiredPath.split('/').at(-1);
      const offenders = ownedFiles.filter((file) =>
        fs.readFileSync(file, 'utf8').includes(reference)
      );
      expect({
        retiredPath,
        offenders: offenders.map((file) => path.relative(root, file)),
      }).toEqual({
        retiredPath,
        offenders: [],
      });
    }
  });

  test('every service-worker precache entry exists', () => {
    const source = fs.readFileSync(path.join(publicRoot, 'sw.js'), 'utf8');
    const list = source.match(/const ASSETS_TO_CACHE = \[([\s\S]*?)\];/)?.[1] || '';
    const urls = [...list.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);

    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const target = url === '/' ? path.join(publicRoot, 'index.html') : path.join(publicRoot, url);
      expect({ url, exists: fs.existsSync(target) }).toEqual({ url, exists: true });
    }
  });

  test('HTML and CSS local asset references resolve to files', () => {
    for (const htmlFile of walk(publicRoot, (file) => file.endsWith('.html'))) {
      const source = fs.readFileSync(htmlFile, 'utf8');
      for (const match of source.matchAll(/\b(?:href|src)=["']([^"']*)["']/g)) {
        assertLocalReferenceExists(htmlFile, match[1]);
      }
    }

    for (const cssFile of walk(publicRoot, (file) => file.endsWith('.css'))) {
      const source = fs.readFileSync(cssFile, 'utf8');
      for (const match of source.matchAll(/(?:url|@import)\(?(?:["']?)([^)'"\s]+)["']?\)?/g)) {
        if (match[1].startsWith('var(')) continue;
        assertLocalReferenceExists(cssFile, match[1]);
      }
    }
  });

  test('the file reference documents every retained first-party file', () => {
    const sourceRoots = [
      '.github',
      'config',
      'docs',
      'migrations',
      'public',
      'src-worker',
      'tests',
    ];
    const rootFiles = [
      '.env.example',
      '.gitignore',
      'README.md',
      'SECURITY.md',
      'package-lock.json',
      'package.json',
      'wrangler.toml',
    ];

    const retainedFiles = sourceRoots.flatMap((sourceRoot) =>
      walk(path.join(root, sourceRoot), (file) => !file.includes('/public/vendor/'))
    );
    retainedFiles.push(...rootFiles.map((file) => path.join(root, file)));

    const guide = fs.readFileSync(fileReferencePath, 'utf8');
    const missing = retainedFiles
      .map((file) => path.relative(root, file))
      .filter((file) => !guide.includes(`\`${file}\``))
      .sort();

    expect(missing).toEqual([]);
  });
});
