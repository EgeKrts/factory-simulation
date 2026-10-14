import { defineConfig } from 'vite';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep, extname } from 'node:path';

// Local development snapshots stay outside the production/public assets.
const artifactDirectory = fileURLToPath(new URL('./.artifacts/', import.meta.url));
const assetDirectory = fileURLToPath(new URL('./public/assets/', import.meta.url));
export default defineConfig({
  server: { host: '127.0.0.1', watch: { ignored: [/[/\\]public[/\\]assets(?:[/\\]|$)/] } },
  plugins: [{
    name: 'local-scene-capture', apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        // New/copied assets must be served immediately, even though their folder is excluded
        // from Vite's watcher to avoid Windows EBUSY crashes during large model copies.
        if(url.startsWith('/assets/') && (req.method==='GET'||req.method==='HEAD')) {
          try {
            const path=resolve(assetDirectory,decodeURIComponent(url.split('?')[0].slice('/assets/'.length)));
            if(!path.startsWith(resolve(assetDirectory)+sep)){res.statusCode=403;res.end();return;}
            const info=await stat(path);if(!info.isFile()){res.statusCode=404;res.end();return;}
            const mime:Record<string,string>={'.glb':'model/gltf-binary','.gltf':'model/gltf+json','.json':'application/json','.bin':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
            const etag=`"${info.size}-${info.mtimeMs}"`;
            res.setHeader('Content-Type',mime[extname(path).toLowerCase()]??'application/octet-stream');res.setHeader('ETag',etag);res.setHeader('Cache-Control','no-cache');
            if(req.headers['if-none-match']===etag){res.statusCode=304;res.end();return;}
            res.setHeader('Content-Length',info.size);
            if(req.method==='HEAD'){res.end();return;}
            const stream=createReadStream(path);stream.on('error',()=>res.destroy());stream.pipe(res);return;
          } catch {res.statusCode=404;res.end();return;}
        }
        if (!url.startsWith('/__capture')) { next(); return; }
        try {
          if (req.method === 'POST' && url === '/__capture') {
            const chunks: Buffer[] = []; let length = 0;
            for await (const chunk of req) {
              const data = Buffer.from(chunk); length += data.length;
              if (length > 10 * 1024 * 1024) { res.statusCode = 413; res.end('PNG too large'); return; }
              chunks.push(data);
            }
            const data = Buffer.concat(chunks);
            if (!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) { res.statusCode = 400; res.end('PNG required'); return; }
            const slug = String(req.headers['x-scene'] ?? 'yerleske').replace(/[^a-z0-9-]/g, '').slice(0,40) || 'yerleske';
            const filename = `dokuma-${slug}-${Date.now()}.png`;
            await mkdir(artifactDirectory, { recursive: true }); await writeFile(join(artifactDirectory, filename), data);
            res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ url: `/__capture/${filename}` })); return;
          }
          const filename = url.slice('/__capture/'.length);
          if (req.method === 'GET' && /^dokuma-[a-z0-9-]+-\d+\.png$/.test(filename)) {
            res.setHeader('Content-Type','image/png'); res.end(await readFile(join(artifactDirectory, filename))); return;
          }
          res.statusCode = 404; res.end();
        } catch { res.statusCode = 500; res.end('Capture unavailable'); }
      });
    },
  }],
});
