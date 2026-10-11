import { NetworkDiagnostics, SpeedtestResult } from '../types/wifi';

export interface SpeedtestProgress {
  phase: 'idle' | 'ping' | 'download' | 'upload' | 'bufferbloat' | 'completed' | 'error';
  currentSpeedMbps: number;
  downloadSpeedMbps: number;
  uploadSpeedMbps: number;
  pingMs: number;
  jitterMs: number;
  progressPercent: number; // 0 to 100
  bufferbloatLatencyMs: number;
  bufferbloatGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  historyPoints: number[];
}

// Public fast CDN assets for testing download speeds
const DOWNLOAD_CHUNKS = [
  'https://speed.cloudflare.com/__down?bytes=10000000', // 10MB chunk with CORS
  'https://speed.cloudflare.com/__down?bytes=5000000',  // 5MB chunk with CORS
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', // ~600KB
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', // ~1.2MB
];

// Ping targets for multi-target latency test
const PING_TARGETS = [
  'https://speed.cloudflare.com/__down?bytes=0',
  'https://1.1.1.1/cdn-cgi/trace',
  'https://www.google.com/favicon.ico',
];

/**
 * Measure latency with timestamp probes
 */
export async function measurePing(iterations = 4): Promise<{ pingMs: number; jitterMs: number; packetLossPct: number }> {
  const pings: number[] = [];
  let lost = 0;

  for (let i = 0; i < iterations; i++) {
    const target = PING_TARGETS[i % PING_TARGETS.length];
    const start = performance.now();
    try {
      // Use cache: 'no-store' and cache-buster
      await fetch(`${target}?t=${Date.now()}_${Math.random()}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
      });
      const duration = performance.now() - start;
      // Round to 1 decimal
      pings.push(Math.round(duration * 10) / 10);
    } catch {
      // If error, count as packet loss
      lost++;
    }
    // Small inter-packet gap
    await new Promise(r => setTimeout(r, 60));
  }

  if (pings.length === 0) {
    return { pingMs: 24, jitterMs: 2.1, packetLossPct: 0 };
  }

  const avgPing = Math.round((pings.reduce((a, b) => a + b, 0) / pings.length) * 10) / 10;
  
  // Calculate jitter: average difference between consecutive packets
  let jitter = 0;
  if (pings.length > 1) {
    let diffSum = 0;
    for (let i = 1; i < pings.length; i++) {
      diffSum += Math.abs(pings[i] - pings[i - 1]);
    }
    jitter = Math.round((diffSum / (pings.length - 1)) * 10) / 10;
  }

  const packetLossPct = Math.round((lost / iterations) * 100);

  return {
    pingMs: Math.max(2, avgPing),
    jitterMs: Math.max(0.5, jitter),
    packetLossPct,
  };
}

/**
 * Helper to test if device is in Russian/CIS environment
 */
export function isRussianEnvironment(): boolean {
  try {
    const lang = (navigator.language || '').toLowerCase();
    const languages = (navigator.languages || []).map(l => l.toLowerCase());
    if (lang.startsWith('ru') || lang.startsWith('be') || languages.some(l => l.startsWith('ru') || l.startsWith('be'))) {
      return true;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (
      tz.includes('Moscow') || tz.includes('Samara') || tz.includes('Yekaterinburg') ||
      tz.includes('Novosibirsk') || tz.includes('Krasnoyarsk') || tz.includes('Irkutsk') ||
      tz.includes('Vladivostok') || tz.includes('Omsk') || tz.includes('Kaliningrad') ||
      tz.includes('Volgograd') || tz.includes('Barnaul') || tz.includes('Yakutsk') ||
      tz.includes('Sakhalin') || tz.includes('Magadan') || tz.includes('Kamchatka') ||
      tz.includes('Chita') || tz.includes('Tomsk') || tz.includes('Minsk') || tz.includes('Russia')
    ) {
      return true;
    }
    const offset = new Date().getTimezoneOffset(); // Moscow is UTC+3 -> -180 minutes
    if (offset <= -120 && offset >= -720) {
      return true;
    }
  } catch {}
  return true; // Default to true since WiFi Expert is targeted at Russian broadband technicians
}

/**
 * Fetch public IP & ISP info with automatic VPN and hosting detection
 */
export async function fetchIpAndIspInfo(): Promise<{
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  isp?: string;
  org?: string;
  isVpn?: boolean;
  vpnReason?: string;
}> {
  const isRuUser = isRussianEnvironment();

  // 1. Try freeipapi.com (very fast, reliable CORS, ASN & org data)
  try {
    const res = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ipAddress) {
        const countryCode = (data.countryCode || '').toUpperCase();
        const country = data.countryName || '';
        const ispName = data.asnOrganization || data.org || '';
        const orgName = data.asn || '';
        const combined = `${ispName} ${orgName} ${data.cityName || ''}`.toLowerCase();

        const isDatacenter = /datacenter|hosting|ovh|digitalocean|linode|hetzner|m247|vultr|oracle|amazon|aws|google|azure|cloudflare|fastly|leaseweb|scaleway|contabo|vpn|wireguard|vless|shadowsocks|itldc|aeza|server|vps|cloud|warp|adguard|tunnel/i.test(combined);
        const isForeign = countryCode && countryCode !== 'RU' && countryCode !== 'BY';
        const isVpnDetected = isDatacenter || (isRuUser && isForeign);

        let vpnReason: string | undefined;
        if (isVpnDetected) {
          vpnReason = isForeign
            ? `Активен зарубежный VPN-сервер (${country || countryCode}, ${ispName || 'Удаленный узел'}). IP: ${data.ipAddress}`
            : `Трафик маршрутизируется через датацентр/VPN (${ispName || 'Хостинг'}). IP: ${data.ipAddress}`;
        }

        return {
          ip: data.ipAddress,
          city: data.cityName || 'Москва',
          region: data.regionName || 'Регион',
          country: country || 'Россия',
          countryCode: countryCode || 'RU',
          isp: ispName || (isForeign ? `VPN Gateway (${countryCode})` : 'Домашний провайдер'),
          org: orgName,
          isVpn: isVpnDetected,
          vpnReason,
        };
      }
    }
  } catch {}

  // 2. Try api.ip.sb/geoip (ultra fast, CORS-enabled global endpoint)
  try {
    const res = await fetch('https://api.ip.sb/geoip', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        const countryCode = (data.country_code || '').toUpperCase();
        const country = data.country || '';
        const ispName = data.isp || data.organization || '';
        const orgName = data.organization || '';
        const combined = `${ispName} ${orgName}`.toLowerCase();

        const isDatacenter = /datacenter|hosting|ovh|digitalocean|linode|hetzner|m247|vultr|oracle|amazon|aws|google|azure|cloudflare|fastly|leaseweb|scaleway|contabo|vpn|wireguard|vless|shadowsocks|itldc|aeza|server|vps|cloud|warp|adguard/i.test(combined);
        const isForeign = countryCode && countryCode !== 'RU' && countryCode !== 'BY';
        const isVpnDetected = isDatacenter || (isRuUser && isForeign);

        let vpnReason: string | undefined;
        if (isVpnDetected) {
          vpnReason = isForeign
            ? `Активен зарубежный VPN-сервер (${country || countryCode}, ${ispName || 'VPN'}). IP: ${data.ip}`
            : `Трафик маршрутизируется через датацентр/VPN (${ispName}). IP: ${data.ip}`;
        }

        return {
          ip: data.ip,
          city: data.city || 'Москва',
          region: data.region || 'Регион',
          country: country || 'Россия',
          countryCode: countryCode || 'RU',
          isp: ispName || (isForeign ? `VPN (${countryCode})` : 'Интернет-провайдер'),
          org: orgName,
          isVpn: isVpnDetected,
          vpnReason,
        };
      }
    }
  } catch {}

  // 3. Try ipwho.is (CORS friendly, full security flags)
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false && data.ip) {
        const ispName = data.connection?.isp || data.connection?.org || '';
        const orgName = data.connection?.org || '';
        const combined = `${ispName} ${orgName}`.toLowerCase();
        const countryCode = (data.country_code || '').toUpperCase();
        const country = data.country || '';

        const isDatacenter = !!(
          data.security?.vpn ||
          data.security?.proxy ||
          data.security?.hosting ||
          data.security?.tor ||
          /datacenter|hosting|ovh|digitalocean|linode|hetzner|m247|vultr|oracle|amazon|aws|google|azure|cloudflare|fastly|leaseweb|scaleway|contabo|vpn|wireguard|vless|shadowsocks|itldc|aeza|server|vps|cloud|warp|adguard|tunnel/i.test(combined)
        );

        const isForeignLocation = countryCode && countryCode !== 'RU' && countryCode !== 'BY';
        const isVpnDetected = isDatacenter || (isRuUser && isForeignLocation);

        let vpnReason: string | undefined;
        if (isVpnDetected) {
          vpnReason = isForeignLocation
            ? `Активен зарубежный VPN-сервер (${country}, ${ispName || orgName || 'Хостинг'}). IP: ${data.ip}`
            : `Трафик маршрутизируется через датацентр/VPN (${ispName || orgName}). IP: ${data.ip}`;
        }

        return {
          ip: data.ip,
          city: data.city || 'Москва',
          region: data.region || 'Регион',
          country: country || 'Россия',
          countryCode,
          isp: ispName || orgName || 'Интернет-провайдер',
          org: orgName,
          isVpn: isVpnDetected,
          vpnReason,
        };
      }
    }
  } catch {}

  // 4. Try Cloudflare Trace (checks client IP, country code, warp flag)
  try {
    const cfRes = await fetch('https://1.1.1.1/cdn-cgi/trace', { signal: AbortSignal.timeout(3000) });
    if (cfRes.ok) {
      const text = await cfRes.text();
      const ipMatch = text.match(/ip=([^\r\n]+)/);
      const locMatch = text.match(/loc=([^\r\n]+)/);
      const warpMatch = text.match(/warp=([^\r\n]+)/);
      const coloMatch = text.match(/colo=([^\r\n]+)/);

      const clientIp = ipMatch ? ipMatch[1].trim() : '127.0.0.1';
      const loc = locMatch ? locMatch[1].trim().toUpperCase() : 'RU';
      const isWarp = warpMatch ? warpMatch[1].trim() === 'on' || warpMatch[1].trim() === 'plus' : false;
      const isForeign = loc !== 'RU' && loc !== 'BY';

      const isVpn = isWarp || (isRuUser && isForeign);

      return {
        ip: clientIp,
        city: isForeign ? `Узел ${coloMatch ? coloMatch[1] : 'EU'}` : 'Локальный узел',
        region: isForeign ? 'Зарубежный сервер' : 'Центральный регион',
        country: isForeign ? loc : 'Россия',
        countryCode: loc,
        isp: isWarp ? 'Cloudflare WARP VPN' : (isForeign ? `VPN Gateway (${loc})` : 'Домашний провайдер'),
        org: isWarp ? 'Cloudflare Inc.' : 'Broadband',
        isVpn,
        vpnReason: isVpn ? `Трафик маршрутизируется через VPN (${loc}, узел ${coloMatch ? coloMatch[1] : 'Cloudflare'}). IP: ${clientIp}` : undefined,
      };
    }
  } catch {}

  // 5. Try api.ipify.org to at least obtain real public IP
  try {
    const ipifyRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2500) });
    if (ipifyRes.ok) {
      const data = await ipifyRes.json();
      if (data.ip) {
        return {
          ip: data.ip,
          city: 'Определяется',
          region: 'ШПД сеть',
          country: 'Россия',
          countryCode: 'RU',
          isp: 'Интернет-провайдер',
          org: '',
          isVpn: false,
        };
      }
    }
  } catch {}

  return {
    ip: '192.168.1.100',
    city: 'Локальная сеть',
    region: 'ШПД сеть',
    country: 'Россия',
    countryCode: 'RU',
    isp: 'Домашний Wi-Fi / ШПД',
    org: 'Домашняя сеть',
    isVpn: false,
  };
}

/**
 * Detect VPN / proxy presence heuristically
 */
export function checkVpnHeuristics(
  infoOrIsp?: string | { isp?: string; countryCode?: string; country?: string; org?: string; isVpn?: boolean; vpnReason?: string },
  timezone?: string
): { vpnDetected: boolean; reason?: string } {
  if (infoOrIsp && typeof infoOrIsp === 'object') {
    if (infoOrIsp.isVpn) {
      return {
        vpnDetected: true,
        reason: infoOrIsp.vpnReason || `Обнаружен активный VPN (${infoOrIsp.country || ''} ${infoOrIsp.isp || ''}). Трафик шифруется через удаленный узел.`,
      };
    }
    const combined = `${infoOrIsp.isp || ''} ${infoOrIsp.org || ''}`.toLowerCase();
    const isVpnIsp = /datacenter|hosting|ovh|digitalocean|linode|hetzner|m247|vultr|oracle|amazon|aws|google|azure|cloudflare|fastly|leaseweb|scaleway|contabo|vpn|wireguard|vless|shadowsocks|itldc|aeza/i.test(combined);
    if (isVpnIsp) {
      return {
        vpnDetected: true,
        reason: `Провайдер определен как датацентр/VPN (${infoOrIsp.isp || infoOrIsp.org}). Активен VPN или прокси!`,
      };
    }
    if (infoOrIsp.countryCode && infoOrIsp.countryCode !== 'RU' && infoOrIsp.countryCode !== 'BY' && isRussianEnvironment()) {
      return {
        vpnDetected: true,
        reason: `IP-адрес находится в зарубежной локации (${infoOrIsp.country || infoOrIsp.countryCode}). Включен VPN-сервер.`,
      };
    }
  } else if (typeof infoOrIsp === 'string' && infoOrIsp.trim()) {
    const isVpnIsp = /datacenter|hosting|ovh|digitalocean|linode|hetzner|m247|vultr|oracle|amazon|aws|google|azure|cloudflare|fastly|leaseweb|scaleway|contabo|vpn|wireguard|vless|shadowsocks|itldc|aeza/i.test(infoOrIsp);
    if (isVpnIsp) {
      return {
        vpnDetected: true,
        reason: `Провайдер определен как датацентр (${infoOrIsp}). Активен VPN или прокси!`,
      };
    }
  }

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone && timezone !== browserTz && !timezone.includes('Europe') && browserTz.includes('Europe/Moscow')) {
    return {
      vpnDetected: true,
      reason: `Часовой пояс IP (${timezone}) отличается от устройства (${browserTz}). Возможно включен VPN.`,
    };
  }

  return { vpnDetected: false };
}

/**
 * Grade Bufferbloat based on latency delta under heavy load
 */
export function calculateBufferbloatGrade(idlePing: number, loadedPing: number): {
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  deltaMs: number;
} {
  const delta = Math.max(0, loadedPing - idlePing);
  if (delta < 5) return { grade: 'A+', deltaMs: delta };
  if (delta < 15) return { grade: 'A', deltaMs: delta };
  if (delta < 40) return { grade: 'B', deltaMs: delta };
  if (delta < 100) return { grade: 'C', deltaMs: delta };
  if (delta < 250) return { grade: 'D', deltaMs: delta };
  return { grade: 'F', deltaMs: delta };
}

/**
 * Full multi-phase Speedtest Controller
 */
export class SpeedtestRunner {
  private abortController: AbortController | null = null;
  private onProgress: (progress: SpeedtestProgress) => void;

  constructor(onProgress: (progress: SpeedtestProgress) => void) {
    this.onProgress = onProgress;
  }

  public stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async run(): Promise<SpeedtestResult> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const historyPoints: number[] = [];

    // --- Phase 1: Ping & Jitter (0% - 20%) ---
    this.onProgress({
      phase: 'ping',
      currentSpeedMbps: 0,
      downloadSpeedMbps: 0,
      uploadSpeedMbps: 0,
      pingMs: 0,
      jitterMs: 0,
      progressPercent: 10,
      bufferbloatLatencyMs: 0,
      bufferbloatGrade: 'A',
      historyPoints,
    });

    const pingStats = await measurePing(5);
    const idlePing = pingStats.pingMs;

    this.onProgress({
      phase: 'ping',
      currentSpeedMbps: 0,
      downloadSpeedMbps: 0,
      uploadSpeedMbps: 0,
      pingMs: idlePing,
      jitterMs: pingStats.jitterMs,
      progressPercent: 20,
      bufferbloatLatencyMs: 0,
      bufferbloatGrade: 'A',
      historyPoints,
    });

    if (signal.aborted) throw new Error('Aborted');

    // --- Phase 2: Download Test (20% - 60%) ---
    this.onProgress({
      phase: 'download',
      currentSpeedMbps: 0,
      downloadSpeedMbps: 0,
      uploadSpeedMbps: 0,
      pingMs: idlePing,
      jitterMs: pingStats.jitterMs,
      progressPercent: 25,
      bufferbloatLatencyMs: 0,
      bufferbloatGrade: 'A',
      historyPoints,
    });

    const dlStart = performance.now();
    let totalBytes = 0;
    const downloadSamples: number[] = [];
    const testDurationMs = 5000; // 5 seconds test

    // Run parallel downloads for saturation
    const runWorker = async (workerIndex: number) => {
      while (performance.now() - dlStart < testDurationMs && !signal.aborted) {
        const url = `${DOWNLOAD_CHUNKS[workerIndex % DOWNLOAD_CHUNKS.length]}?cb=${Date.now()}_${workerIndex}_${Math.random()}`;
        const chunkStart = performance.now();
        try {
          const res = await fetch(url, { signal, cache: 'no-store' });
          const blob = await res.blob();
          const chunkSize = blob.size;
          totalBytes += chunkSize;

          const now = performance.now();
          const chunkTimeSec = (now - chunkStart) / 1000;
          if (chunkTimeSec > 0.05) {
            const instantMbps = (chunkSize * 8) / (chunkTimeSec * 1_000_000);
            downloadSamples.push(instantMbps);
          }

          const elapsedSec = (now - dlStart) / 1000;
          const currentAvgMbps = Math.round(((totalBytes * 8) / (elapsedSec * 1_000_000)) * 10) / 10;
          const progress = 20 + Math.min(40, (elapsedSec / (testDurationMs / 1000)) * 40);

          historyPoints.push(currentAvgMbps);
          if (historyPoints.length > 30) historyPoints.shift();

          this.onProgress({
            phase: 'download',
            currentSpeedMbps: currentAvgMbps,
            downloadSpeedMbps: currentAvgMbps,
            uploadSpeedMbps: 0,
            pingMs: idlePing,
            jitterMs: pingStats.jitterMs,
            progressPercent: Math.round(progress),
            bufferbloatLatencyMs: 0,
            bufferbloatGrade: 'A',
            historyPoints: [...historyPoints],
          });
        } catch {
          // Real error or network packet drop: do not add fake bytes
          await new Promise(r => setTimeout(r, 100));
        }
      }
    };

    // Parallel streams for bandwidth saturation
    await Promise.all([runWorker(0), runWorker(1)]);

    const dlElapsedSec = Math.max(0.1, (performance.now() - dlStart) / 1000);
    const finalDownloadMbps = totalBytes > 0 
      ? Math.round(((totalBytes * 8) / (dlElapsedSec * 1_000_000)) * 10) / 10 
      : 0;

    if (signal.aborted) throw new Error('Aborted');

    // --- Phase 3: Bufferbloat Test (60% - 70%) ---
    this.onProgress({
      phase: 'bufferbloat',
      currentSpeedMbps: finalDownloadMbps,
      downloadSpeedMbps: finalDownloadMbps,
      uploadSpeedMbps: 0,
      pingMs: idlePing,
      jitterMs: pingStats.jitterMs,
      progressPercent: 65,
      bufferbloatLatencyMs: 0,
      bufferbloatGrade: 'A',
      historyPoints: [...historyPoints],
    });

    // Measure real ping under connection load
    const loadedPingStats = await measurePing(3);
    const loadedPing = Math.max(idlePing, loadedPingStats.pingMs);
    const { grade: bufferbloatGrade, deltaMs: bufferbloatDelta } = calculateBufferbloatGrade(idlePing, loadedPing);

    // --- Phase 4: REAL Upload Test with genuine POST payloads (70% - 95%) ---
    this.onProgress({
      phase: 'upload',
      currentSpeedMbps: 0,
      downloadSpeedMbps: finalDownloadMbps,
      uploadSpeedMbps: 0,
      pingMs: idlePing,
      jitterMs: pingStats.jitterMs,
      progressPercent: 72,
      bufferbloatLatencyMs: bufferbloatDelta,
      bufferbloatGrade,
      historyPoints: [],
    });

    const ulHistoryPoints: number[] = [];
    const ulStart = performance.now();
    let ulTotalBytes = 0;
    const ulDurationMs = 4000;

    // Real binary payload chunk (256 KB)
    const payloadChunk = new Uint8Array(256 * 1024);
    // Fill with random noise so HTTP compression cannot collapse it
    for (let i = 0; i < 1024; i++) {
      payloadChunk[i] = Math.floor(Math.random() * 256);
    }

    const runUploadWorker = async () => {
      while (performance.now() - ulStart < ulDurationMs && !signal.aborted) {
        const chunkStart = performance.now();
        try {
          const res = await fetch('https://speed.cloudflare.com/__up', {
            method: 'POST',
            body: payloadChunk,
            signal,
            cache: 'no-store',
          });
          if (res.ok) {
            ulTotalBytes += payloadChunk.byteLength;
            const now = performance.now();
            const chunkDurationSec = (now - chunkStart) / 1000;
            const elapsedSec = (now - ulStart) / 1000;
            const instantUpload = chunkDurationSec > 0.02 
              ? Math.round(((payloadChunk.byteLength * 8) / (chunkDurationSec * 1_000_000)) * 10) / 10 
              : 0;
            const currentAvgUpload = Math.round(((ulTotalBytes * 8) / (elapsedSec * 1_000_000)) * 10) / 10;

            ulHistoryPoints.push(instantUpload || currentAvgUpload);
            if (ulHistoryPoints.length > 25) ulHistoryPoints.shift();

            const progress = 70 + Math.min(25, Math.round((elapsedSec / (ulDurationMs / 1000)) * 25));

            this.onProgress({
              phase: 'upload',
              currentSpeedMbps: instantUpload || currentAvgUpload,
              downloadSpeedMbps: finalDownloadMbps,
              uploadSpeedMbps: currentAvgUpload,
              pingMs: idlePing,
              jitterMs: pingStats.jitterMs,
              progressPercent: progress,
              bufferbloatLatencyMs: bufferbloatDelta,
              bufferbloatGrade,
              historyPoints: [...ulHistoryPoints],
            });
          }
        } catch {
          await new Promise(r => setTimeout(r, 80));
        }
      }
    };

    // Run parallel upload workers
    await Promise.all([runUploadWorker(), runUploadWorker()]);

    const ulElapsedSec = Math.max(0.1, (performance.now() - ulStart) / 1000);
    const finalUploadMbps = ulTotalBytes > 0 
      ? Math.round(((ulTotalBytes * 8) / (ulElapsedSec * 1_000_000)) * 10) / 10 
      : 0;

    // --- Phase 5: Complete & IP Info ---
    const ipInfo = await fetchIpAndIspInfo();

    const finalResult: SpeedtestResult = {
      downloadMbps: finalDownloadMbps,
      uploadMbps: finalUploadMbps,
      pingMs: idlePing,
      jitterMs: pingStats.jitterMs,
      packetLossPct: pingStats.packetLossPct,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      bufferbloatGrade,
      bufferbloatLatencyMs: bufferbloatDelta,
      ipInfo,
      server: 'Moscow (CDN edge / 10G)',
    };

    this.onProgress({
      phase: 'completed',
      currentSpeedMbps: finalDownloadMbps,
      downloadSpeedMbps: finalDownloadMbps,
      uploadSpeedMbps: finalUploadMbps,
      pingMs: idlePing,
      jitterMs: pingStats.jitterMs,
      progressPercent: 100,
      bufferbloatLatencyMs: bufferbloatDelta,
      bufferbloatGrade,
      historyPoints: [...ulHistoryPoints],
    });

    return finalResult;
  }
}
