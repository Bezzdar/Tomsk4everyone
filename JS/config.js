(function () {
  const fromGlobal = window.__TOMSK_CONFIG__?.API_BASE;
  const fromMeta = document.querySelector('meta[name="api-base"]')?.getAttribute('content');
  const fallback = 'http://77.222.43.106:5000/api';

  window.APP_CONFIG = {
    API_BASE: (fromGlobal || fromMeta || fallback).replace(/\/$/, ''),
  };
})();
