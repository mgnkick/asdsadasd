import React, { useState } from 'react';
import { 
  Wifi, 
  Lock, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  X, 
  ShieldCheck, 
  Radio, 
  Sparkles,
  Smartphone
} from 'lucide-react';
import { WifiNetwork } from '../types/wifi';
import { androidSystem } from '../services/androidSystem';

interface ConnectWifiModalProps {
  network: WifiNetwork | null;
  onClose: () => void;
  onConnected?: (ssid: string) => void;
}

export const ConnectWifiModal: React.FC<ConnectWifiModalProps> = ({
  network,
  onClose,
  onConnected,
}) => {
  if (!network) return null;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectSuccess, setConnectSuccess] = useState(false);

  // Android standard Wi-Fi QR payload
  const authType = network.securityType === 'Open' ? 'nopass' : 'WPA';
  const qrPayload = `WIFI:S:${network.ssid};T:${authType};P:${password};;`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrPayload)}&margin=8`;

  const handleCopyPassword = () => {
    if (!password) return;
    navigator.clipboard.writeText(password).then(() => {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    });
  };

  const handleConnect = () => {
    setIsConnecting(true);

    // If password provided, copy to clipboard for convenience
    if (password) {
      navigator.clipboard.writeText(password).catch(() => {});
    }

    // Launch Android Wi-Fi intent
    androidSystem.openWifiSettings();

    setTimeout(() => {
      setIsConnecting(false);
      setConnectSuccess(true);
      onConnected?.(network.ssid);
    }, 700);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0">
              <Wifi className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-slate-100 truncate">
                {network.ssid}
              </h3>
              <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                <span className="font-mono text-cyan-300">{network.band} (канал {network.channel})</span>
                <span>•</span>
                <span>{network.level} dBm</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Network Details Card */}
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-400">
            <span>Безопасность:</span>
            <span className="font-semibold text-slate-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{network.securityType} {network.capabilities || ''}</span>
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Стандарт:</span>
            <span className="font-mono text-slate-300">{network.standard || '802.11'}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>BSSID (MAC):</span>
            <span className="font-mono text-slate-300">{network.bssid}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Ширина канала:</span>
            <span className="font-mono text-slate-300">{network.channelWidth} МГц</span>
          </div>
        </div>

        {/* Password Entry */}
        {network.securityType !== 'Open' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Пароль от сети Wi-Fi:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Введите пароль..."
                className="w-full pl-9 pr-20 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                {password && (
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Скопировать пароль"
                  >
                    {copiedPass ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {copiedPass && (
              <p className="text-[11px] text-emerald-400 font-medium animate-in fade-in">
                ✓ Пароль скопирован в буфер обмена!
              </p>
            )}
          </div>
        )}

        {/* QR Code toggle */}
        {showQrCode ? (
          <div className="p-4 rounded-2xl bg-white text-slate-950 text-center space-y-2.5 shadow-xl animate-in zoom-in-95">
            <div className="font-bold text-xs text-slate-800">
              Наведите камеру смартфона для быстрого подключения Android:
            </div>
            <div className="flex justify-center p-2 bg-white rounded-xl">
              <img 
                src={qrCodeUrl} 
                alt={`Wi-Fi QR ${network.ssid}`} 
                className="w-44 h-44 rounded-lg shadow-sm"
              />
            </div>
            <p className="text-[11px] text-slate-600">
              Стандартный формат Wi-Fi QR. Android подключится в 1 касание без ручного ввода.
            </p>
            <button
              onClick={() => setShowQrCode(false)}
              className="text-xs text-slate-600 hover:text-slate-950 font-semibold underline cursor-pointer"
            >
              Скрыть QR-код
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowQrCode(true)}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>Сформировать QR-код для подключения камеры/Android</span>
          </button>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <a
            href={androidSystem.getWifiSettingsIntentUrl()}
            onClick={handleConnect}
            className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer select-none active:scale-95"
          >
            <ExternalLink className="w-4 h-4" />
            <span>
              {isConnecting ? 'Открытие настроек Android...' : 'Подключиться к сети в Android'}
            </span>
          </a>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>Как завершить подключение на смартфоне:</span>
            </div>
            <p>
              1. Нажмите кнопку выше — откроется системный экран Wi-Fi Android.<br />
              2. Выберите сеть <strong>{network.ssid}</strong> из списка.<br />
              3. {network.securityType !== 'Open' ? 'Вставьте скопированный пароль и нажмите «Подключить».' : 'Нажмите для автоматического подключения.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>

        {connectSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs text-center font-medium animate-in fade-in">
            ✓ Окно системы Android открыто. После подключения статус обновится автоматически!
          </div>
        )}
      </div>
    </div>
  );
};
