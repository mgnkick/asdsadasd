/**
 * Прямое открытие веб-интерфейса роутера по IP-адресу основного шлюза
 * Без промежуточных окон и модалок — сразу переход в браузере
 */
export const openRouterWebDirect = (defaultGateway: string = '192.168.1.1') => {
  const storedIp = localStorage.getItem('router_gateway_ip');
  const ip = storedIp && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(storedIp) 
    ? storedIp 
    : defaultGateway;
  
  const targetUrl = `http://${ip}`;

  try {
    // 1. Попытка открыть в новой вкладке браузера
    const newWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    
    // 2. Если браузер или Android WebView блокирует window.open через попап-фильтр:
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      const link = document.createElement('a');
      link.href = targetUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (err) {
    // 3. Прямой переход если другие методы заблокированы
    window.location.href = targetUrl;
  }
};
