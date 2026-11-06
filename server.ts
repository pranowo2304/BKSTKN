import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const distDir = path.join(__dirname, 'dist');
const ROOT = fs.existsSync(path.join(distDir, 'index.html')) ? distDir : __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
};

const getStats = async (filePath) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile() ? stats : null;
  } catch {
    return null;
  }
};

const serveFile = (req, res, filePath, stats, statusCode = 200) => {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  const mtime = stats.mtime.toUTCString();
  res.setHeader('Last-Modified', mtime);

  if (req.headers['if-modified-since'] === mtime) {
    res.statusCode = 304;
    res.end();
    return;
  }

  if (ext === '.html' || ext === '.htm' || path.basename(filePath) === 'sw.js') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  res.statusCode = statusCode;
  const stream = fs.createReadStream(filePath);
  stream.on('error', (err) => {
    console.error('Stream error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
    }
    res.end();
  });
  stream.pipe(res);
};

const server = http.createServer(async (req, res) => {
  try {
    const rawUrl = req.url || '/';
    const requestUrl = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
    const decodedPath = decodeURIComponent(requestUrl.pathname);

    if (decodedPath === '/health' || decodedPath === '/healthz') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('OK');
      return;
    }

    const relativePath = decodedPath.replace(/^\/+/, '');
    const absolutePath = path.resolve(ROOT, relativePath);

    if (absolutePath !== ROOT && !absolutePath.startsWith(ROOT + path.sep)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    let stats = await getStats(absolutePath);
    if (stats) {
      serveFile(req, res, absolutePath, stats);
      return;
    }

    const dirIndexPath = path.join(absolutePath, 'index.html');
    stats = await getStats(dirIndexPath);
    if (stats) {
      serveFile(req, res, dirIndexPath, stats);
      return;
    }

    if (path.extname(absolutePath)) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    const spaIndexPath = path.join(ROOT, 'index.html');
    stats = await getStats(spaIndexPath);
    if (stats) {
      serveFile(req, res, spaIndexPath, stats, 200);
      return;
    }

    res.statusCode = 404;
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT} (serving ${ROOT})`);
});
