import { WifiNetwork, DeviceRole, SsidGroup } from '../types/wifi';

/**
 * Check if capabilities string indicates 802.11k / 802.11v / 802.11r fast roaming
 */
export function hasRoamingCapabilities(capabilities?: string): boolean {
  if (!capabilities) return false;
  const caps = capabilities.toUpperCase();
  return (
    caps.includes('RRM') || // 802.11k Radio Resource Management
    caps.includes('FT-PSK') || // 802.11r Fast Transition
    caps.includes('FT-SAE') || 
    caps.includes('802.11R') || 
    caps.includes('802.11K') || 
    caps.includes('802.11V') ||
    caps.includes('WNM') // Wireless Network Management
  );
}

/**
 * Check if SSID name indicates a repeater / extender
 */
export function isRepeaterSsid(ssid: string): boolean {
  const lower = ssid.toLowerCase();
  return (
    lower.endsWith('_ext') ||
    lower.endsWith('-ext') ||
    lower.endsWith('_re') ||
    lower.endsWith('-re') ||
    lower.endsWith('_rpt') ||
    lower.endsWith('_repeater') ||
    lower.endsWith('_plus') ||
    lower.includes('repeater') ||
    lower.includes('extender')
  );
}

/**
 * Check if a MAC address has the "Locally Administered" bit set (bit 1 of 1st byte)
 * Many cheap repeaters flip this bit when cloning the primary router's BSSID
 */
export function isLocallyAdministeredMac(bssid: string): boolean {
  if (!bssid || bssid.length < 2) return false;
  const firstByte = parseInt(bssid.slice(0, 2), 16);
  if (isNaN(firstByte)) return false;
  // Bit 1 (0b00000010 = 0x02) indicates locally administered
  return (firstByte & 0x02) === 0x02;
}

/**
 * Check if two MAC addresses belong to the same physical router (e.g., dual-band radio 2.4G and 5G)
 * Typically, routers use consecutive MACs: AA:BB:CC:DD:EE:10 and AA:BB:CC:DD:EE:11
 */
export function isSameHardwareMac(bssid1: string, bssid2: string): boolean {
  if (!bssid1 || !bssid2) return false;
  const parts1 = bssid1.toLowerCase().split(':');
  const parts2 = bssid2.toLowerCase().split(':');
  if (parts1.length !== 6 || parts2.length !== 6) return false;

  // First 5 octets must match
  for (let i = 0; i < 5; i++) {
    if (parts1[i] !== parts2[i]) return false;
  }

  // Last octet within +/- 4
  const last1 = parseInt(parts1[5], 16);
  const last2 = parseInt(parts2[5], 16);
  return Math.abs(last1 - last2) <= 4;
}

/**
 * Classify a list of networks and assign deviceRole, roamingSupported, nodeLabel
 */
export function classifyWifiNetworks(networks: WifiNetwork[]): WifiNetwork[] {
  // Group by exact SSID first
  const ssidMap = new Map<string, WifiNetwork[]>();
  networks.forEach(net => {
    const list = ssidMap.get(net.ssid) || [];
    list.push(net);
    ssidMap.set(net.ssid, list);
  });

  return networks.map(net => {
    const group = ssidMap.get(net.ssid) || [net];
    const hasRoaming = Boolean(
      hasRoamingCapabilities(net.capabilities) || 
      (net.vendor && /ubiquiti|unifi|keenetic|deco|aimesh|eero|mikrotik|cisco|aruba/i.test(net.vendor))
    );

    let role: DeviceRole = 'standalone';
    let label = `Одиночный роутер (${net.band})`;
    let reason = 'Единственный BSSID с данным именем сети.';

    // Rule 1: Repeater SSID suffix
    if (isRepeaterSsid(net.ssid)) {
      role = 'repeater';
      label = `Wi-Fi Репитер / Усилитель (${net.band})`;
      reason = 'Суффикс в имени сети (_EXT / _re) указывает на программный или аппаратный репитер.';
    } 
    // Rule 2: Multi-node with same SSID (identical name, multiple physical BSSIDs)
    else if (group.length > 1) {
      // Check if nodes in this group belong to the exact same dual-band router (1 on 2.4G and 1 on 5G with consecutive MAC)
      const isDualBandSingleBox = group.length === 2 && 
        group[0].band !== group[1].band && 
        isSameHardwareMac(group[0].bssid, group[1].bssid);

      if (isDualBandSingleBox) {
        role = 'dual_band';
        label = `Двухдиапазонный роутер (${net.band})`;
        reason = 'Один физический роутер (соседние MAC-адреса на 2.4 ГГц и 5 ГГц).';
      } else {
        // Different devices / BSSIDs under the exact same network name!
        // "Если имя сети одинаковое, а устройства разные = предполагаем меш либо репитер, либо роутер + точка доступа"
        if (hasRoaming) {
          role = 'mesh';
          const sorted = [...group].sort((a, b) => b.level - a.level);
          const isPrimary = sorted[0].bssid === net.bssid;
          label = isPrimary ? `Основной Mesh-роутер (${net.band})` : `Дополнительный Mesh-узел (${net.band})`;
          reason = 'Одинаковый SSID, разные устройства: обнаружены протоколы 802.11k/v/r или Mesh-вендор (бесшовный роуминг).';
        } 
        else if (isLocallyAdministeredMac(net.bssid)) {
          role = 'repeater';
          label = `Репитер-клон (${net.band})`;
          reason = 'Одинаковый SSID, разные устройства: локально администрируемый MAC (характерно для клонирующих репитеров).';
        } 
        else {
          role = 'router_with_ap';
          const sorted = [...group].sort((a, b) => b.level - a.level);
          const isPrimary = sorted[0].bssid === net.bssid;
          label = isPrimary ? `Основной роутер (${net.band})` : `Дополнительный роутер (${net.band})`;
          reason = 'Одинаковый SSID, разные устройства: предполагаем связку роутер + дополнительный роутер (в режиме AP/моста) либо репитер.';
        }
      }
    }

    return {
      ...net,
      deviceRole: role,
      roamingSupported: hasRoaming,
      nodeLabel: label,
      detectionReason: reason,
    };
  });
}

/**
 * Group classified networks by SSID for the hierarchical SSID view
 */
export function groupNetworksBySsid(classifiedNetworks: WifiNetwork[]): SsidGroup[] {
  const map = new Map<string, WifiNetwork[]>();
  
  classifiedNetworks.forEach(net => {
    const list = map.get(net.ssid) || [];
    list.push(net);
    map.set(net.ssid, list);
  });

  const groups: SsidGroup[] = [];

  map.forEach((nodes, ssid) => {
    // Sort nodes within group by signal strength (strongest first)
    nodes.sort((a, b) => b.level - a.level);

    const bestLevel = nodes[0].level;
    const hasConnectedNode = nodes.some(n => n.isConnected);
    const bands = Array.from(new Set(nodes.map(n => n.band)));
    const channels = Array.from(new Set(nodes.map(n => n.channel)));
    const vendors = Array.from(new Set(nodes.map(n => n.vendor).filter(Boolean))) as string[];
    const securityTypes = Array.from(new Set(nodes.map(n => n.securityType)));

    // Group role priority: mesh > router_with_ap > repeater > dual_band > standalone
    let groupRole: DeviceRole = 'standalone';
    let groupReason = 'Одиночный роутер с одним BSSID.';

    if (nodes.some(n => n.deviceRole === 'mesh')) {
      groupRole = 'mesh';
      groupReason = 'Одинаковый SSID, разные устройства: Mesh-система с поддержкой быстрого роуминга (802.11k/v/r).';
    } else if (nodes.some(n => n.deviceRole === 'router_with_ap')) {
      groupRole = 'router_with_ap';
      groupReason = 'Одинаковый SSID, разные устройства: предполагаем Mesh, репитер либо роутер + дополнительный роутер.';
    } else if (nodes.some(n => n.deviceRole === 'repeater')) {
      groupRole = 'repeater';
      groupReason = 'Одинаковый SSID, разные устройства: обнаружен Wi-Fi репитер/повторитель.';
    } else if (nodes.some(n => n.deviceRole === 'dual_band')) {
      groupRole = 'dual_band';
      groupReason = 'Один двухдиапазонный роутер (диапазоны 2.4 ГГц и 5 ГГц с одного устройства).';
    }

    const roamingSupported = nodes.some(n => n.roamingSupported);

    groups.push({
      ssid,
      deviceRole: groupRole,
      roamingSupported,
      bestLevel,
      totalNodes: nodes.length,
      nodes,
      hasConnectedNode,
      bands,
      channels,
      vendor: vendors[0] || 'Неизвестно',
      securityType: securityTypes[0] || 'WPA2',
      detectionReason: groupReason,
    });
  });

  // Sort groups: connected network first, then by strongest signal
  groups.sort((a, b) => {
    if (a.hasConnectedNode && !b.hasConnectedNode) return -1;
    if (!a.hasConnectedNode && b.hasConnectedNode) return 1;
    return b.bestLevel - a.bestLevel;
  });

  return groups;
}
