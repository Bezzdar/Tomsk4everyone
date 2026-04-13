(function () {
  const fallbackApiBase = 'http://46.17.102.10:5000/api';
  const fromGlobal = window.__TOMSK_CONFIG__?.API_BASE;
  const fromMeta = document.querySelector('meta[name="api-base"]')?.getAttribute('content');
  const apiBase = (fromGlobal || fromMeta || fallbackApiBase).replace(/\/$/, '');

  window.APP_CONFIG = {
    API_BASE: apiBase,
  };
})();
