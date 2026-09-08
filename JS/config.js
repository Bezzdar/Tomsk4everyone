(function () {
  const fromGlobal = window.__TOMSK_CONFIG__?.API_BASE;
  const metaValue = document.querySelector('meta[name="api-base"]')?.getAttribute('content')?.trim();
  // Production is served through one origin. Old pages still containing a historical
  // absolute server address must not override that. External API URLs can be supplied
  // explicitly through window.__TOMSK_CONFIG__ when developing locally.
  const fromMeta = metaValue && !/^https?:\/\//i.test(metaValue) ? metaValue : null;
  const fallback = '/api';

  window.APP_CONFIG = {
    API_BASE: (fromGlobal || fromMeta || fallback).replace(/\/$/, ''),
  };
})();
