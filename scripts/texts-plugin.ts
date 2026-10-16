/**
 * Dev-server endpoints for the local translation editor (tools/prevodi/index.html, opened at
 * /prevodi). Edits are kept in `text-edits.json` at the project root until they are applied to the
 * source; the production build is unaffected.
 *
 *   GET /__texts        → { entries, edits }  (entries are re-read from the source on every request)
 *   PUT /__texts/edits  ← { [id]: edit }       (the whole set; an empty set removes the file)
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { exportTexts } from './export-texts.ts';

export const EDITS_FILE = 'text-edits.json';

export function textsPlugin(): Plugin {
  return {
    name: 'vassal-texts',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root;
      const editsPath = resolve(root, EDITS_FILE);
      const readEdits = () =>
        existsSync(editsPath) ? JSON.parse(readFileSync(editsPath, 'utf8')) : {};

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };

        if (url === '/prevodi' || url === '/prevodi/') {
          res.statusCode = 302;
          res.setHeader('Location', '/tools/prevodi/');
          res.end();
        } else if (url === '/__texts' && req.method === 'GET') {
          try {
            send(200, { entries: exportTexts(root), edits: readEdits() });
          } catch (err) {
            send(500, { error: String(err) });
          }
        } else if (url === '/__texts/edits' && req.method === 'PUT') {
          let body = '';
          req.setEncoding('utf8');
          req.on('data', (chunk: string) => (body += chunk));
          req.on('end', () => {
            try {
              const edits = JSON.parse(body) as Record<string, unknown>;
              if (Object.keys(edits).length === 0) rmSync(editsPath, { force: true });
              else writeFileSync(editsPath, JSON.stringify(edits, null, 2) + '\n');
              send(200, { saved: Object.keys(edits).length });
            } catch (err) {
              send(400, { error: String(err) });
            }
          });
        } else {
          next();
        }
      });
    },
  };
}
