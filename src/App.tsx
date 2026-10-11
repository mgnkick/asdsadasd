import React, { useState, useEffect } from 'react';
import { Header, ActiveTab } from './components/Header';
import { WifiAnalyzerView } from './components/WifiAnalyzerView';
import { SpeedtestDashboard } from './components/SpeedtestDashboard';
import { RecommendationsView } from './components/RecommendationsView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { SupportReportView } from './components/SupportReportView';
import { LanScannerView } from './components/LanScannerView';
import { NetworkStatusGuard } from './components/NetworkStatusGuard';
import { DonateModal } from './components/DonateModal';
import { WifiAccuracyDisclaimer } from './components/WifiAccuracyDisclaimer';
import { ThemeProvider } from './context/ThemeContext';
import { wifiScanner } from './services/wifiScan';
import { WifiNetwork, SpeedtestResult, WifiBand } from './types/wifi';
import { fetchIpAndIspInfo } from './services/networkTester';
import { openRouterWebDirect } from './utils/routerNav';

import { androidSystem } from './services/androidSystem';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyzer');
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [speedtestResult, setSpeedtestResult] = useState<SpeedtestResult | null>(null);
  const [ispName, setIspName] = useState<string>('');

  // Real connection status
  const [isWifiConnected, setIsWifiConnected] = useState<boolean>(true);
  const [isCellular, setIsCellular] = useState<boolean>(false);
  const [isVpn, setIsVpn] = useState<boolean>(false);
  
  // Modals
  const [isDonateOpen, setIsDonateOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);

  // 1. Request all permissions immediately upon launch (Geolocation, Notifications, etc.)
  useEffect(() => {
    androidSystem.requestAllStartupPermissions();
  }, []);

  // 2. Subscribe to Wi-Fi scanner events
  useEffect(() => {
    const unsubscribe = wifiScanner.subscribe(updatedNetworks => {
      setNetworks(updatedNetworks);
    });

    // Detect ISP and IP info
    fetchIpAndIspInfo().then(info => {
      if (info?.isp) setIspName(info.isp);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 3. Keep Wi-Fi scanner synchronized with connection state
  useEffect(() => {
    if (isWifiConnected) {
      wifiScanner.populateConnectedWifi({
        isp: ispName,
        gatewayIp: '192.168.1.1',
      });
    } else {
      wifiScanner.clearNetworks();
    }
  }, [isWifiConnected, ispName]);

  // Direct router opening without intermediate windows: opens browser at default gateway
  const handleOpenRouter = (_band?: WifiBand | React.MouseEvent) => {
    openRouterWebDirect('192.168.1.1');
  };

  // If Wi-Fi is NOT connected: NO STUBS! Dashboards are completely empty!
  const visibleNetworks = isWifiConnected ? networks : [];
  const connectedNet = isWifiConnected ? (networks.find(n => n.isConnected) || null) : null;
  const hasConnectedWifi = isWifiConnected && !!connectedNet;

  return (
    <ThemeProvider>
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
        
        {/* Navigation & Header (Scenario dropdown removed) */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenDonate={() => setIsDonateOpen(true)}
          onOpenApkModal={() => setIsApkModalOpen(true)}
          onOpenRouterWeb={handleOpenRouter}
          connectedSsid={connectedNet?.ssid}
          connectedSignalDbm={connectedNet?.level}
          isWifiConnected={isWifiConnected}
          isCellular={isCellular}
          isVpn={isVpn}
        />

        {/* Main Content Area (Tailored for mobile Android & responsive, no horizontal scroll) */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-6 pb-28 lg:pb-8 space-y-4 sm:space-y-6 overflow-x-hidden">
          
          {/* Built-in network status guard: Wi-Fi connection check, Cellular/Mobile data check, VPN detector */}
          <NetworkStatusGuard 
            ispName={ispName} 
            hasConnectedWifi={hasConnectedWifi}
            onRefreshWifiScan={() => wifiScanner.triggerScan()}
            onConnectionStatusChange={status => {
              setIsWifiConnected(status.isWifiConnected);
              setIsCellular(status.isCellular);
              setIsVpn(status.isVpn);
            }}
          />

          {/* Active View Router */}
          {activeTab === 'analyzer' && (
            <WifiAnalyzerView 
              networks={visibleNetworks} 
              onNavigateToRouter={handleOpenRouter}
              isCellular={isCellular}
            />
          )}

          {activeTab === 'scanner' && (
            <LanScannerView 
              gatewayIp="192.168.1.1"
              isWifiConnected={isWifiConnected}
              isCellular={isCellular}
            />
          )}

          {activeTab === 'speedtest' && (
            <SpeedtestDashboard />
          )}

          {activeTab === 'recommendations' && (
            <RecommendationsView 
              networks={visibleNetworks} 
              onNavigateToRouter={handleOpenRouter}
              isCellular={isCellular}
            />
          )}

          {activeTab === 'report' && (
            <SupportReportView 
              networks={visibleNetworks} 
              speedtestResult={speedtestResult}
              isCellular={isCellular}
              isWifiConnected={isWifiConnected}
              isVpn={isVpn}
            />
          )}

          {activeTab === 'knowledge' && (
            <KnowledgeBaseView />
          )}

        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500 w-full max-w-full overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <div>
              <span className="font-semibold text-slate-400">WiFi Expert &amp; Helper</span> — карманный помощник монтажника и сервисной службы ШПД
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
              <button 
                onClick={handleOpenRouter}
                className="hover:text-indigo-400 transition-colors cursor-pointer"
                title="Открыть веб-интерфейс роутера (шлюз 192.168.1.1)"
              >
                Веб-интерфейс роутера (192.168.1.1)
              </button>
              <span className="hidden xs:inline">•</span>
              <button 
                onClick={() => setIsApkModalOpen(true)}
                className="hover:text-cyan-400 transition-colors cursor-pointer"
              >
                Сборка Android APK на GitHub
              </button>
              <span className="hidden xs:inline">•</span>
              <button 
                onClick={() => setIsDonateOpen(true)}
                className="hover:text-emerald-400 transition-colors cursor-pointer font-semibold"
              >
                Поддержать проект (Сбер)
              </button>
            </div>
          </div>
        </footer>

        {/* Modals (Only Donate and GitHub APK Guide) */}
        <DonateModal 
          isOpen={isDonateOpen} 
          onClose={() => setIsDonateOpen(false)} 
        />

        <WifiAccuracyDisclaimer 
          isOpen={isApkModalOpen} 
          onClose={() => setIsApkModalOpen(false)} 
        />

      </div>
    </ThemeProvider>
  );
}
