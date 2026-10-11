import React, { useState, useEffect } from 'react';
import { 
  ExternalLink, 
  Globe, 
  Zap, 
  Gauge, 
  ShieldCheck, 
  Server, 
  Smartphone, 
  CheckCircle2, 
  Copy, 
  Check, 
  Share2 
} from 'lucide-react';
import { fetchIpAndIspInfo } from '../services/networkTester';

interface ExternalSpeedtestService {
  id: string;
  name: string;
  title: string;
  description: string;
  url: string;
  badge: string;
  badgeColor: string;
  recommendedFor: string;
  iconBg: string;
}

const SPEEDTEST_SERVICES: ExternalSpeedtestService[] = [
  {
    id: 'yandex',
    name: 'Яндекс Интернетометр',
    title: 'yandex.ru/internet',
    description: 'Официальный эталонный замер скорости в Рунете. Серверы в Москве, Санкт-Петербурге и регионах РФ. Отображает точный входящий и исходящий трафик, IPv4/IPv6 и задержку.',
    url: 'https://yandex.ru/internet',
    badge: '№1 в России',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    recommendedFor: 'Для акта сдачи абоненту в РФ',
    iconBg: 'from-rose-500 to-amber-600',
  },
  {
    id: 'ookla',
    name: 'Speedtest by Ookla',
    title: 'speedtest.net',
    description: 'Мировой стандарт замера скорости. Автоматический выбор ближайшего узла связи провайдера (Ростелеком, МТС, МегаФон, Билайн, Дом.ru). Тестирует пинг под нагрузкой.',
    url: 'https://www.speedtest.net',
    badge: 'Мировой стандарт',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    recommendedFor: 'Независимый международный аудит',
    iconBg: 'from-cyan-500 to-blue-600',
  },
  {
    id: '2ip',
    name: '2ip.ru — Тест скорости',
    title: '2ip.ru/speed',
    description: 'Популярный российский сетевой сервис проверки интернет-соединения, реального провайдера, открытых портов и маршрутизации.',
    url: 'https://2ip.ru/speed/',
    badge: '2IP Сервис',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    recommendedFor: 'Быстрая проверка пинга и потерь',
    iconBg: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'fast',
    name: 'Fast.com (Netflix)',
    title: 'fast.com',
    description: 'Минималистичный мгновенный замер пропускной способности через CDN серверы стриминга. Запускается в 1 клик без рекламы.',
    url: 'https://fast.com/ru/',
    badge: 'Без рекламы',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    recommendedFor: 'Мгновенная проверка скорости потока',
    iconBg: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'google',
    name: 'Google Fiber Speed Test',
    title: 'fiber.google.com/speedtest',
    description: 'Высокоскоростной замер без перегрузки браузера на магистральных узлах Google. Проверяет гигабитные каналы.',
    url: 'https://fiber.google.com/speedtest/',
    badge: 'Google Edge',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    recommendedFor: 'Проверка гигабитных тарифов ШПД',
    iconBg: 'from-blue-500 to-indigo-500',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Speed Test',
    title: 'speed.cloudflare.com',
    description: 'Глубокий технический анализ качества линии: джиттер, распределение задержек (Bufferbloat 90th percentile), потеря пакетов на пакетах разного размера.',
    url: 'https://speed.cloudflare.com/',
    badge: 'Bufferbloat аудит',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    recommendedFor: 'Анализ задержек для геймеров и звонков',
    iconBg: 'from-amber-500 to-orange-600',
  },
  {
    id: 'rt',
    name: 'Ростелеком — Сервер замера',
    title: 'speedtest.rt.ru',
    description: 'Прямой тест скорости внутри магистральной сети ПАО «Ростелеком» без выхода в зарубежный сегмент.',
    url: 'http://speedtest.rt.ru/',
    badge: 'Провайдер РФ',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    recommendedFor: 'Проверка договора ШПД Ростелеком',
    iconBg: 'from-indigo-500 to-purple-600',
  },
];

export const SpeedtestDashboard: React.FC = () => {
  const [netInfo, setNetInfo] = useState<{
    ip?: string;
    isp?: string;
    city?: string;
  }>({});
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchIpAndIspInfo().then(info => {
      if (info) {
        setNetInfo({
          ip: info.ip,
          isp: info.isp,
          city: info.city,
        });
      }
    });
  }, []);

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedUrl(id);
    setTimeout(() => {
      setCopiedUrl(prev => prev === id ? null : prev);
    }, 2000);
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
      
      {/* Top Banner: Current Network Details */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 shrink-0">
              <Gauge className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                Замер скорости интернета
              </h2>
              <p className="text-xs text-slate-400">
                Прямые ссылки на независимые эталонные сервисы проверки пропускной способности
              </p>
            </div>
          </div>

          {/* Current IP & ISP badge */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 text-xs font-mono space-y-1 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-slate-400">
              <span>Провайдер:</span>
              <strong className="text-cyan-300 font-sans">{netInfo.isp || 'Определение...'}</strong>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span>IP устройства:</span>
              <strong className="text-slate-200">{netInfo.ip || '—'}</strong>
              {netInfo.city && <span className="text-slate-500 font-sans">• {netInfo.city}</span>}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200/90 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            Для получения точных результатов замера отключите VPN и закройте фоновые загрузки (торренты, обновления).
          </span>
        </div>
      </div>

      {/* Grid of External Speedtest Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SPEEDTEST_SERVICES.map(service => (
          <div
            key={service.id}
            className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col justify-between space-y-4 shadow-lg group hover:shadow-cyan-500/5"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl bg-gradient-to-tr ${service.iconBg} text-white shadow-md shrink-0`}>
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-100 group-hover:text-cyan-300 transition-colors">
                      {service.name}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400">
                      {service.title}
                    </span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${service.badgeColor} shrink-0`}>
                  {service.badge}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {service.description}
              </p>

              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <span className="text-slate-500">Назначение:</span>
                <span className="text-slate-300">{service.recommendedFor}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
              <a
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 transition-all cursor-pointer active:scale-95 select-none"
              >
                <span>Запустить замер</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => handleCopy(service.url, service.id)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                title="Скопировать ссылку"
              >
                {copiedUrl === service.id ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
