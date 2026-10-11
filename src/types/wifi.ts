export type WifiBand = '2.4GHz' | '5GHz' | '6GHz';

export type WifiStandard = 
  | 'Wi-Fi 4 (802.11n)' 
  | 'Wi-Fi 5 (802.11ac)' 
  | 'Wi-Fi 6 (802.11ax)' 
  | 'Wi-Fi 6E (802.11ax)' 
  | 'Wi-Fi 7 (802.11be)'
  | 'Wi-Fi (Legacy)';

export type DeviceRole = 'mesh' | 'repeater' | 'router_with_ap' | 'dual_band' | 'standalone';

export interface WifiNetwork {
  ssid: string;
  bssid: string;
  level: number; // RSSI in dBm (e.g. -45, -72)
  frequency: number; // MHz
  channel: number;
  channelWidth: 20 | 40 | 80 | 160 | 320; // MHz
  band: WifiBand;
  capabilities: string; // e.g. "[WPA2-PSK-CCMP][ESS]"
  standard: WifiStandard;
  vendor?: string;
  distanceMeters?: number;
  isConnected?: boolean;
  securityType: 'WPA2' | 'WPA' | 'WEP' | 'Open';
  is5GHzCapable?: boolean;
  timestamp?: number;
  deviceRole?: DeviceRole;
  roamingSupported?: boolean; // 802.11k/v/r
  nodeLabel?: string; // e.g. "Основной роутер", "Mesh-узел #2", "Репитер", "Дополнительный роутер"
  detectionReason?: string; // Техническое пояснение для монтажника
}

export interface SsidGroup {
  ssid: string;
  deviceRole: DeviceRole;
  roamingSupported: boolean;
  bestLevel: number;
  totalNodes: number;
  nodes: WifiNetwork[];
  hasConnectedNode: boolean;
  bands: WifiBand[];
  channels: number[];
  vendor?: string;
  securityType: string;
  detectionReason?: string; // Техническое пояснение для монтажника
}

export interface ChannelRating {
  channel: number;
  frequency: number;
  band: WifiBand;
  score: number; // 0 - 100
  stars: number; // 1 - 5
  interferenceLevel: 'none' | 'low' | 'medium' | 'high';
  isRecommended: boolean;
  networksCount: number;
  coChannelNetworks: number; // networks on the exact same channel
  adjacentChannelNetworks: number; // networks overlapping on neighbor channels
  reason: string;
}

export interface SpeedtestResult {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs: number;
  packetLossPct: number;
  timestamp: string;
  bufferbloatGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  bufferbloatLatencyMs: number;
  ipInfo?: {
    ip: string;
    city?: string;
    region?: string;
    country?: string;
    isp?: string;
    org?: string;
  };
  server?: string;
}

export interface NetworkDiagnostics {
  localIp: string;
  publicIp: string;
  ispName: string;
  dnsLatencyMs: number;
  gatewayPingMs: number;
  externalPingMs: number;
  jitterMs: number;
  vpnDetected: boolean;
  vpnReason?: string;
  effectiveType?: string;
  downlinkSpeedMbps?: number;
  rttMs?: number;
}

export interface DiagnosticRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'placement' | 'channel' | 'band' | 'equipment' | 'security' | 'dns';
  severity: 'critical' | 'warning' | 'info' | 'success';
  actionStep: string;
  impact: string;
}

export interface KnowledgeTerm {
  id: string;
  term: string;
  termEn?: string;
  category: 'Физика радиосигнала' | 'Стандарты Wi-Fi' | 'Роутеры и антенны' | 'Безопасность' | 'Сетевые протоколы';
  shortDesc: string;
  detailedDesc: string;
  practicalTip: string;
  recommendedValue?: string;
  tags: string[];
}

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  tag: string;
  connectedSsid: string;
  networks: WifiNetwork[];
}

export interface RoomMeasurement {
  id: string;
  roomName: string;
  signalDbm: number;
  speedMbps?: number;
  pingMs?: number;
  quality: 'Отличный' | 'Хороший' | 'Средний' | 'Слабый' | 'Мертвая зона';
  timestamp: string;
}

export interface PingPacketItem {
  seq: number;
  sizeBytes: number; // 64 bytes
  latencyMs: number;
  isLoss: boolean;
  ttl?: number;
  timestamp: number;
}

export interface DetailedHostPing {
  targetName: string; // 'Шлюз роутера' | 'Яндекс'
  host: string;       // '192.168.1.1' | 'ya.ru'
  packetsCount: number; // 10
  packetSizeBytes: number; // 64
  sent: number;
  received: number;
  lossPct: number;
  minMs: number;
  avgMs: number;
  maxMs: number;
  jitterMs: number;
  protocol?: string; // 'ICMP (Эхо-запрос RFC 792)'
  isIcmp?: boolean;
  ttl?: number;
  rawOutput?: string;
  packets: PingPacketItem[];
}

export interface DualPingResult {
  gateway: DetailedHostPing;
  yandex: DetailedHostPing;
  timestamp: string;
}
