import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Native Linux ICMP Echo Ping plugin for Vite dev server
 */
function icmpPingPlugin(): Plugin {
  return {
    name: 'icmp-ping-plugin',
    configureServer(server) {
      server.middlewares.use('/api/ping', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
          const rawHost = String(urlObj.searchParams.get('host') || 'ya.ru').trim();
          const count = Math.min(10, Math.max(1, parseInt(urlObj.searchParams.get('count') || '4', 10)));

          // Strict validation to avoid command injection: valid hostname or IPv4/IPv6
          if (!/^[a-zA-Z0-9.:-]+$/.test(rawHost) || rawHost.startsWith('-')) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Некорректный адрес хоста для ICMP пинга' }));
            return;
          }

          // Execute genuine Linux ICMP ping
          // Try with -i 0.2 for fast packet dispatch, fallback to default interval if needed
          let stdout = '';
          try {
            const result = await execFileAsync('ping', ['-c', String(count), '-i', '0.2', '-W', '2', rawHost]);
            stdout = result.stdout;
          } catch (firstErr: any) {
            if (firstErr?.stdout && firstErr.stdout.includes('packet loss')) {
              stdout = firstErr.stdout;
            } else {
              // Retry without -i 0.2 in case permissions restrict fast interval
              try {
                const retry = await execFileAsync('ping', ['-c', String(count), '-W', '2', rawHost]);
                stdout = retry.stdout;
              } catch (secondErr: any) {
                stdout = secondErr?.stdout || '';
              }
            }
          }

          // Parse packet lines: "64 bytes from ... icmp_seq=1 ttl=55 time=2.57 ms"
          const packetLines = stdout.split('\n').filter(line => line.includes('bytes from') && line.includes('time='));
          const packets = packetLines.map((line, idx) => {
            const timeMatch = line.match(/time=([0-9.]+)\s*ms/);
            const ttlMatch = line.match(/ttl=([0-9]+)/i);
            const seqMatch = line.match(/icmp_seq=([0-9]+)/i);
            const bytesMatch = line.match(/^([0-9]+)\s*bytes/i);
            return {
              seq: seqMatch ? parseInt(seqMatch[1], 10) : idx + 1,
              sizeBytes: bytesMatch ? parseInt(bytesMatch[1], 10) : 64,
              latencyMs: timeMatch ? parseFloat(timeMatch[1]) : 0,
              ttl: ttlMatch ? parseInt(ttlMatch[1], 10) : 55,
              isLoss: false,
              timestamp: Date.now() - (packetLines.length - idx) * 100,
            };
          });

          // Parse statistics line: "rtt min/avg/max/mdev = 2.296/2.434/2.573/0.138 ms"
          const statsMatch = stdout.match(/rtt min\/avg\/max\/mdev = ([0-9.]+)\/([0-9.]+)\/([0-9.]+)\/([0-9.]+)/i);
          const lossMatch = stdout.match(/([0-9.]+)%\s*packet loss/i);

          const minMs = statsMatch ? parseFloat(statsMatch[1]) : (packets.length ? Math.min(...packets.map(p => p.latencyMs)) : 0);
          const avgMs = statsMatch ? parseFloat(statsMatch[2]) : (packets.length ? Math.round((packets.reduce((a, b) => a + b.latencyMs, 0) / packets.length) * 10) / 10 : 0);
          const maxMs = statsMatch ? parseFloat(statsMatch[3]) : (packets.length ? Math.max(...packets.map(p => p.latencyMs)) : 0);
          const jitterMs = statsMatch ? parseFloat(statsMatch[4]) : 0;
          const lossPct = lossMatch ? parseFloat(lossMatch[1]) : ((count - packets.length) / count) * 100;
          const ttl = packets[0]?.ttl ?? (rawHost.includes('.') ? 56 : undefined);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({
            host: rawHost,
            protocol: 'ICMP (Эхо-запрос RFC 792)',
            isIcmp: true,
            sent: count,
            received: packets.length,
            lossPct: Math.round(lossPct * 10) / 10,
            minMs: Math.round(minMs * 10) / 10,
            avgMs: Math.round(avgMs * 10) / 10,
            maxMs: Math.round(maxMs * 10) / 10,
            jitterMs: Math.round(jitterMs * 10) / 10,
            ttl,
            packets,
            rawOutput: stdout,
          }));
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(e?.message || e) }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), icmpPingPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
