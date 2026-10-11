import React, { useMemo, useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Radio, 
  Cpu, 
  ShieldCheck, 
  Globe, 
  Compass,
  ArrowRight,
  Sparkles,
  Zap,
  Router,
  RotateCw,
  BookOpen,
  Wifi,
  WifiOff,
  Layers,
  HelpCircle,
  Settings
} from 'lucide-react';
import { WifiNetwork, DiagnosticRecommendation } from '../types/wifi';
import { analyzeChannels, NON_OVERLAPPING_2_4GHZ } from '../utils/channelAdvice';
import { getRandomAuditTips, RandomAuditTip } from '../data/randomAuditTips';
import { androidSystem } from '../services/androidSystem';

interface RecommendationsViewProps {
  networks: WifiNetwork[];
  onNavigateToRouter?: (band: '2.4GHz' | '5GHz') => void;
  isCellular?: boolean;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({ 
  networks,
  onNavigateToRouter,
  isCellular = false,
}) => {
  const connectedNet = networks.find(n => n.isConnected) || null;

  // Random tips state: updates on mount (every time user enters the tab) or via manual refresh
  const [randomTips, setRandomTips] = useState<RandomAuditTip[]>(() => getRandomAuditTips(2));
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh when tab is opened / component mounts
  useEffect(() => {
    setRandomTips(getRandomAuditTips(2));
  }, []);

  const handleRefreshRandomTips = () => {
    setIsRefreshing(true);
    // Exclude currently visible tips so user gets fresh ones
    const currentIds = randomTips.map(t => t.id);
    const newTips = getRandomAuditTips(2, currentIds);
    setRandomTips(newTips);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  // Dynamic audit generator: ALWAYS yields >= 3 high-value recommendations tailored to current connection (empty if Wi-Fi disconnected)
  const recommendations: DiagnosticRecommendation[] = useMemo(() => {
    if (networks.length === 0 || !connectedNet) {
      return [];
    }

    const list: DiagnosticRecommendation[] = [];
    const current: WifiNetwork = connectedNet;

    // 1. Signal level & distance check (RSSI)
    if (current.level < -75) {
      list.push({
        id: 'rec_signal_weak',
        category: 'placement',
        severity: 'critical',
        title: 'Критически слабый уровень сигнала',
        description: `Текущий сигнал составляет ${current.level} dBm. На этом уровне клиентские устройства вынуждены многократно повторять отправку пакетов (Retransmissions до 40%), что резко увеличивает задержки.`,
        actionStep: 'Сократите расстояние до роутера, исключите массивные преграды или подключите дополнительный узел бесшовной Mesh-системы.',
        impact: 'Многократное увеличение скорости и стабилизация связи',
      });
    } else if (current.level < -67) {
      list.push({
        id: 'rec_signal_moderate',
        category: 'placement',
        severity: 'warning',
        title: 'Умеренное затухание сигнала Wi-Fi',
        description: `Уровень сигнала ${current.level} dBm достаточен для просмотра сайтов, но чувствителен к закрытым дверям и перемещению по квартире.`,
        actionStep: 'Разместите роутер на высоте 1.5–2 м от пола. Уберите устройство из ниш, шкафов и из-за радиаторов отопления.',
        impact: '+30% к стабильности пинга и отклику',
      });
    } else {
      list.push({
        id: 'rec_signal_ok',
        category: 'placement',
        severity: 'success',
        title: 'Отличная мощность сигнала Wi-Fi',
        description: `Уровень сигнала ${current.level} dBm обеспечивает стабильный приём и максимальную модуляцию без паразитных переповторов.`,
        actionStep: 'Расположение роутера оптимально для текущей точки замера абонента.',
        impact: 'Максимальная скорость модуляции и отсутствие джиттера',
      });
    }

    // 2. Frequency Band check (2.4GHz vs 5GHz)
    if (current.band === '2.4GHz') {
      const neighbor5G = networks.some(n => n.ssid.includes(current.ssid) && n.band === '5GHz');
      list.push({
        id: 'rec_switch_5g',
        category: 'band',
        severity: 'warning',
        title: 'Подключение в перегруженном диапазоне 2.4 ГГц',
        description: 'Диапазон 2.4 ГГц переполнен сигналами соседских роутеров, Bluetooth и бытовых приборов. Физический предел скорости обычно не превышает 50–90 Мбит/с.',
        actionStep: neighbor5G 
          ? 'Переключите устройство на 5 ГГц версию сети (с окончанием _5G или единый SSID с поддержкой Band Steering)!' 
          : 'Если роутер двухдиапазонный, активируйте сеть 5 ГГц в его веб-интерфейсе для скоростных устройств.',
        impact: 'Увеличение скорости в 3–5 раз и чистый радиоэфир',
      });
    } else {
      list.push({
        id: 'rec_band_5g_ok',
        category: 'band',
        severity: 'success',
        title: 'Используется скоростной диапазон 5 ГГц',
        description: `Подключение на частоте ${current.frequency} МГц (канал ${current.channel}). Диапазон 5 ГГц свободен от бытовых радиопомех и обеспечивает широкую полосу пропускания.`,
        actionStep: 'Учитывайте, что волны 5 ГГц затухают на железобетонных стенах сильнее, чем 2.4 ГГц. Держите двери открытыми при удалении.',
        impact: 'Высокая пропускная способность и низкий джиттер',
      });
    }

    // 3. Channel Selection & Overlapping
    if (current.band === '2.4GHz') {
      const isBadChannel = !NON_OVERLAPPING_2_4GHZ.includes(current.channel);
      if (isBadChannel) {
        list.push({
          id: 'rec_bad_channel_24',
          category: 'channel',
          severity: 'critical',
          title: `Нестандартный перекрывающийся канал ${current.channel}`,
          description: `Канал ${current.channel} накладывается сразу на два соседних сегмента частот. Это приводит к постоянным коллизиям и прерыванию стримов и звонков.`,
          actionStep: 'Откройте веб-интерфейс роутера и зафиксируйте неперекрывающийся канал: 1, 6 или 11.',
          impact: 'Устранение микроразрывов и потерь пакетов',
        });
      } else {
        const neighborsOnSame = networks.filter(n => n.band === '2.4GHz' && n.channel === current.channel && !n.isConnected);
        if (neighborsOnSame.length >= 3) {
          list.push({
            id: 'rec_congested_channel',
            category: 'channel',
            severity: 'warning',
            title: `Высокая плотность сетей на канале ${current.channel}`,
            description: `На вашем канале зафиксировано ${neighborsOnSame.length} соседских сетей. Клиенты вынуждены делить эфирное время (Airtime).`,
            actionStep: 'Проверьте каналы 1, 6 или 11 на вкладке «Анализатор» и выберите наименее загруженный.',
            impact: 'Снижение задержки ожидания эфира (Airtime Delay)',
          });
        } else {
          list.push({
            id: 'rec_clean_channel',
            category: 'channel',
            severity: 'success',
            title: `Оптимальный неперекрывающийся канал ${current.channel}`,
            description: `Сеть работает на стандартном канале ${current.channel} с умеренным уровнем взаимных помех.`,
            actionStep: 'Регулировка канала не требуется. Оставьте текущую настройку частоты.',
            impact: 'Чистый радиообмен без взаимных наложений',
          });
        }
      }
    } else {
      // 5 GHz Channel check (DFS vs UNII-1)
      if (current.channel >= 52 && current.channel <= 144) {
        list.push({
          id: 'rec_dfs_channel_5g',
          category: 'channel',
          severity: 'info',
          title: `Используется канал ${current.channel} с механизмом DFS`,
          description: 'Каналы 52–144 требуют проверки на радары. При обнаружении импульсов роутер может кратковременно переключать частоту.',
          actionStep: 'При возникновении периодических секундных пауз зафиксируйте каналы 36, 40, 44 или 48 (диапазон UNII-1).',
          impact: 'Гарантия бесперебойной работы без пауз на сканирование радаров',
        });
      } else {
        list.push({
          id: 'rec_clean_unii1_5g',
          category: 'channel',
          severity: 'success',
          title: `Базовый стабильный канал ${current.channel} (UNII-1)`,
          description: `Канал ${current.channel} находится в диапазоне 5150–5250 МГц, не требует сканирования DFS и поддерживается 100% мобильных устройств.`,
          actionStep: 'Отличный выбор частоты для диапазона 5 ГГц.',
          impact: 'Моментальное подключение устройств без пауз',
        });
      }
    }

    // 4. Channel Width check
    if (current.band === '2.4GHz' && current.channelWidth > 20) {
      list.push({
        id: 'rec_width_24',
        category: 'channel',
        severity: 'warning',
        title: 'Включена избыточная полоса 40 МГц на частоте 2.4 ГГц',
        description: 'Широкая полоса 40 МГц занимает 8 из 13 каналов всего диапазона 2.4 ГГц, улавливая радиопомехи со всего подъезда.',
        actionStep: 'В настройках роутера установите ширину канала 20 МГц для диапазона 2.4 ГГц.',
        impact: 'Многократное сокращение уровня ошибок и стабильный пинг',
      });
    }

    // 5. Security & Encryption
    if (current.securityType === 'Open') {
      list.push({
        id: 'rec_sec_open',
        category: 'security',
        severity: 'critical',
        title: 'Сеть открыта без пароля (Open)',
        description: 'Открытая сеть позволяет посторонним несанкционированно занимать полосу пропускания и создавать фоновую нагрузку.',
        actionStep: 'В веб-интерфейсе роутера установите защиту WPA2-PSK (AES) с надежным паролем от 8 знаков.',
        impact: 'Защита трафика и сохранение скорости абонента',
      });
    } else if (current.securityType === 'WPA') {
      list.push({
        id: 'rec_sec_wpa1',
        category: 'security',
        severity: 'critical',
        title: 'Устаревший протокол шифрования WPA/TKIP',
        description: 'Алгоритм TKIP аппаратно ограничивает скорость беспроводной передачи на уровне 54 Мбит/с даже на скоростных тарифах.',
        actionStep: 'Переключите тип шифрования в роутере строго на WPA2-PSK с алгоритмом AES (CCMP).',
        impact: 'Снятие аппаратного ограничения скорости в 54 Мбит/с',
      });
    } else {
      list.push({
        id: 'rec_sec_ok',
        category: 'security',
        severity: 'success',
        title: 'Надежный стандарт защиты WPA2-PSK (AES)',
        description: 'Используется криптостойкий алгоритм AES/CCMP с полной совместимостью со всеми типами устройств (ТВ, телефоны, умный дом).',
        actionStep: 'Конфигурация безопасности оптимальна, изменений не требуется.',
        impact: 'Надежная защита без конфликтов оборудования',
      });
    }

    // 6. Guarantee at least 3 connection recommendations: add connection hygiene if needed
    if (list.length < 3) {
      list.push({
        id: 'rec_cable_offload',
        category: 'equipment',
        severity: 'info',
        title: 'Кабельное подключение стационарных устройств',
        description: 'Подключение стационарных ТВ, ПК и игровых консолей по кабелю витой пары Ethernet освобождает драгоценное эфирное время Wi-Fi.',
        actionStep: 'Используйте свободные LAN-порты роутера для устройств потокового видео 4K.',
        impact: 'Разгрузка радиоэфира для смартфонов и планшетов',
      });
    }

    return list;
  }, [connectedNet, networks]);

  const severityBadges = {
    critical: {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      icon: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />,
      border: 'border-rose-500/30',
      headerTag: 'Критично',
    },
    warning: {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
      border: 'border-amber-500/30',
      headerTag: 'Внимание',
    },
    info: {
      bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
      icon: <Layers className="w-5 h-5 text-cyan-400 shrink-0" />,
      border: 'border-cyan-500/30',
      headerTag: 'Совет',
    },
    success: {
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
      border: 'border-emerald-500/30',
      headerTag: 'Норма',
    },
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      
      {/* Header Info & Router Access */}
      <div className="bg-slate-900/80 p-4 sm:p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100 truncate">
              Экспресс-аудит текущего подключения
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            {connectedNet ? (
              <>Автоматический анализ параметров сети <span className="font-semibold text-slate-300 font-mono">«{connectedNet.ssid}»</span>: сигнал ({connectedNet.level} dBm), диапазон {connectedNet.band}, канал {connectedNet.channel}.</>
            ) : (
              <>Устройство не подключено к Wi-Fi. Заглушки параметров сети скрыты, дашборд пуст.</>
            )}
          </p>
        </div>

        {connectedNet && onNavigateToRouter && (
          <button
            onClick={() => onNavigateToRouter(connectedNet.band === '5GHz' ? '5GHz' : '2.4GHz')}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95"
            title="Открыть настройки роутера в браузере (192.168.1.1)"
          >
            <Router className="w-4 h-4" />
            <span>Веб-интерфейс роутера &rarr;</span>
          </button>
        )}
      </div>

      {/* Section 1: Recommendations tailored directly to the current connection (Always >= 3 if connected) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-cyan-400 shrink-0" />
            <h3 className="text-sm font-bold text-slate-200">
              Советы относительно текущего подключения ({recommendations.length})
            </h3>
          </div>
          {recommendations.length > 0 && (
            <span className="text-[11px] text-slate-400 font-mono bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700/60">
              Всегда от 3 советов
            </span>
          )}
        </div>

        {recommendations.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
              <WifiOff className="w-6 h-6 text-rose-400" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-200">Дашборд аудита пуст</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Устройство не подключено к Wi-Fi сети. Отображение заглушек отключено.
                Подключитесь к Wi-Fi для автоматической оценки сигнала, радиопомех и параметров радиоканала.
              </p>
            </div>
            {isCellular && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Подключен мобильный интернет (4G / 5G / LTE)</span>
              </div>
            )}
            <div className="pt-2">
              <a
                href={androidSystem.getWifiSettingsIntentUrl()}
                onClick={() => {
                  androidSystem.openWifiSettings();
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Settings className="w-4 h-4" />
                <span>Открыть настройки Wi-Fi</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map(rec => {
            const badge = severityBadges[rec.severity] || severityBadges.info;
            return (
              <div
                key={rec.id}
                className={`p-4 sm:p-5 rounded-2xl bg-slate-900/70 border ${badge.border} flex flex-col justify-between space-y-4 transition-all hover:bg-slate-900/90 shadow-sm`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {badge.icon}
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-100 leading-snug break-words">
                          {rec.title}
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mt-0.5">
                          Категория: {rec.category}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border shrink-0 ${badge.bg}`}>
                      {badge.headerTag}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pt-1 break-words">
                    {rec.description}
                  </p>
                </div>

                {/* Action and Expected Impact */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-cyan-300">
                    <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
                    <div className="min-w-0 break-words">
                      <span className="font-semibold text-slate-200">Что сделать: </span>
                      {rec.actionStep}
                    </div>
                  </div>

                  <div className="text-[11px] text-emerald-400 font-medium pl-6 break-words">
                    Эффект: {rec.impact}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Section 2: Two Random Educational Tips with Interactive Refresh Button */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-sm font-bold text-slate-200">
              Познавательные советы и сетевые лайфхаки
            </h3>
            <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
              2 случайных
            </span>
          </div>

          <button
            onClick={handleRefreshRandomTips}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-cyan-300 hover:text-cyan-200 border border-slate-700/80 transition-all cursor-pointer shadow-sm active:scale-95 group self-end sm:self-auto"
            title="Показать другие познавательные советы"
          >
            <RotateCw className={`w-3.5 h-3.5 transition-transform duration-300 ${isRefreshing ? 'rotate-180 text-cyan-400' : 'group-hover:rotate-45'}`} />
            <span>Обновить советы</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {randomTips.map((tip, idx) => (
            <div
              key={tip.id}
              className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/60 border border-amber-500/25 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition-all shadow-sm group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {tip.category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Совет #{idx + 1}
                  </span>
                </div>

                <h4 className="font-bold text-sm text-slate-100 group-hover:text-amber-200 transition-colors leading-snug break-words">
                  {tip.title}
                </h4>

                <p className="text-xs text-slate-300 leading-relaxed break-words">
                  {tip.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-start gap-2 text-xs">
                <Zap className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="text-[11px] text-amber-200/95 leading-relaxed break-words">
                  <span className="font-semibold text-amber-300">Практический вывод: </span>
                  {tip.takeaway}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Physics / Obstacles Cheat Sheet */}
      <div className="bg-slate-900/80 p-4 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-cyan-400 shrink-0" />
          <h3 className="font-bold text-sm text-slate-100">
            Памятка: Влияние бытовых препятствий на сигнал Wi-Fi
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center space-y-1 min-w-0">
            <span className="text-slate-400 block text-[11px] truncate">Гипсокартон</span>
            <span className="font-bold text-emerald-400 block font-mono text-sm">-2...-4 dB</span>
            <span className="text-[10px] text-slate-500 block truncate">Почти прозрачно</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center space-y-1 min-w-0">
            <span className="text-slate-400 block text-[11px] truncate">Кирпичная стена</span>
            <span className="font-bold text-cyan-400 block font-mono text-sm">-6...-10 dB</span>
            <span className="text-[10px] text-slate-500 block truncate">Умеренное гашение</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center space-y-1 min-w-0">
            <span className="text-slate-400 block text-[11px] truncate">Железобетон</span>
            <span className="font-bold text-rose-400 block font-mono text-sm">-15...-25 dB</span>
            <span className="text-[10px] text-rose-300 block truncate">Гасит до 95%</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center space-y-1 min-w-0">
            <span className="text-slate-400 block text-[11px] truncate">Зеркала / Шкаф</span>
            <span className="font-bold text-rose-400 block font-mono text-sm">-12...-18 dB</span>
            <span className="text-[10px] text-slate-500 block truncate">Отражают волны</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center space-y-1 min-w-0">
            <span className="text-slate-400 block text-[11px] truncate">Аквариум / Вода</span>
            <span className="font-bold text-rose-400 block font-mono text-sm">-20 dB</span>
            <span className="text-[10px] text-slate-500 block truncate">Вода глушит сигнал</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center space-y-1 min-w-0">
            <span className="text-slate-400 block text-[11px] truncate">Микроволновка</span>
            <span className="font-bold text-rose-500 block font-mono text-sm">Шум +25 dB</span>
            <span className="text-[10px] text-rose-300 block truncate">Рвет 2.4 ГГц</span>
          </div>
        </div>
      </div>

    </div>
  );
};
