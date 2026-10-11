import React, { useState } from 'react';
import { ShieldAlert, X, Info } from 'lucide-react';

interface VpnBannerProps {
  ispName?: string;
}

export const VpnBanner: React.FC<VpnBannerProps> = ({ ispName }) => {
  const [dismissed, setDismissed] = useState(false);

  // Detect potential VPN / Proxy
  const isVpn = /datacenter|hosting|ovh|digitalocean|linode|hetzner|m247|vpn|wireguard|cloudflare|fastly/i.test(ispName || '');

  if (!isVpn || dismissed) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start justify-between gap-3 text-xs text-amber-300 animate-in fade-in">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-200">
            Внимание: Обнаружено промежуточное соединение / VPN
          </span>
          <p className="text-amber-300/90 mt-0.5 leading-relaxed">
            Ваш текущий провайдер определен как датацентр ({ispName}). 
            Если включен VPN, скорость и пинг измеряются до зарубежного VPN-сервера, а не до вашего домашнего роутера! 
            Для точного замера домашней линии отключите VPN.
          </p>
        </div>
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded-lg text-amber-400/80 hover:text-amber-200 hover:bg-amber-500/20 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
