/**
 * article-editor.js
 * Редактор статей: шаблон → метаданные → HTML-редактор с живым превью
 */
(function () {
  'use strict';

  const TEMPLATES = {
    classic: {
      label: 'Классический',
      desc: 'Заголовок → вступление → текст с иллюстрациями',
    },
    photoreport: {
      label: 'Фоторепортаж',
      desc: 'Обложка → фотоблоки с подписями → текст',
    },
    route: {
      label: 'Маршрут / Гид',
      desc: 'Точки маршрута с фото, адресами и описаниями',
    },
  };

  const TEMPLATE_STARTERS = {
    classic:
`<h2>Заголовок раздела</h2>
<p>Напишите вступление — краткий анонс того, о чём пойдёт речь.</p>
<p>💡 Вставьте изображение с помощью кнопок «По URL» или «С компьютера» на панели.</p>
<h3>Подзаголовок</h3>
<p>Основной текст статьи. Используйте кнопки форматирования для <strong>важных слов</strong> или <em>цитат</em>.</p>
<ul>
  <li>Первый пункт</li>
  <li>Второй пункт</li>
  <li>Третий пункт</li>
</ul>
<p>Заключение статьи.</p>`,

    photoreport:
`<h2>Название фоторепортажа</h2>
<p>Краткое описание события или места. Вставьте фотографии с помощью кнопок «По URL» или «С компьютера».</p>
<h3>Первый эпизод</h3>
<p>💡 Вставьте фотографию здесь.</p>
<p>Описание первой фотографии или группы фотографий.</p>
<h3>Второй эпизод</h3>
<p>💡 Вставьте фотографию здесь.</p>
<p>Описание второй фотографии.</p>
<h3>Итоги</h3>
<p>Завершающий текст репортажа.</p>`,

    route:
`<h2>Название маршрута</h2>
<p>Общая информация: сложность, длительность, что понадобится.</p>
<h3>Точка 1 — Название места</h3>
<p>💡 Вставьте фотографию места.</p>
<p>Что здесь интересно, как добраться, сколько времени занимает.</p>
<h3>Точка 2 — Название места</h3>
<p>💡 Вставьте фотографию места.</p>
<p>Описание второй точки маршрута.</p>
<h3>Итоги маршрута</h3>
<p>Что понравилось, советы путешественникам.</p>`,
  };

  let selectedTemplate = 'classic';
  let uploadedCoverUrl = '';
  let onSuccessCallback = null;
  let imageStore = new Map();
  let nextImageId = 1;

  // ─── Public API ───────────────────────────────────────────────────────────

  window.ArticleEditor = {
    open(opts = {}) {
      onSuccessCallback = opts.onSuccess || null;
      _buildAndOpen();
    },
    close: _close,
  };

  // ─── Build modal ──────────────────────────────────────────────────────────

  function _buildAndOpen() {
    if (document.getElementById('ae-overlay')) {
      document.getElementById('ae-overlay').removeAttribute('hidden');
      _goToPanel('template');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'ae-overlay';
    overlay.className = 'article-editor-overlay';
    overlay.innerHTML = _renderDialog();
    document.body.appendChild(overlay);

    _bindEvents(overlay);
    _goToPanel('template');
    document.body.style.overflow = 'hidden';
  }

  function _renderDialog() {
    return `
      <div class="article-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="ae-title">
        <header class="ae-header">
          <h2 id="ae-title">Новая статья</h2>
          <button class="ae-close" id="ae-close-btn" aria-label="Закрыть">&times;</button>
        </header>

        <nav class="ae-steps">
          <button class="ae-step-btn active" data-panel="template">1. Шаблон</button>
          <button class="ae-step-btn" data-panel="meta">2. Основное</button>
          <button class="ae-step-btn" data-panel="content">3. Контент</button>
        </nav>

        <!-- Panel 1: template -->
        <div class="ae-panel active" id="ae-panel-template">
          <p class="ae-hint">Выберите шаблон — он задаёт начальную структуру вашей статьи. Содержимое можно изменить на следующем шаге.</p>
          <div class="ae-templates">
            ${Object.entries(TEMPLATES).map(([key, t]) => `
              <label class="ae-template-card ${key === 'classic' ? 'selected' : ''}" data-template="${key}">
                <input type="radio" name="ae-template" value="${key}" ${key === 'classic' ? 'checked' : ''}>
                <div class="ae-template-preview">${_templatePreview(key)}</div>
                <div class="ae-template-name">${t.label}</div>
                <div class="ae-template-desc">${t.desc}</div>
              </label>
            `).join('')}
          </div>
          <div class="ae-footer">
            <span></span>
            <div class="ae-footer-actions">
              <button class="ae-btn ae-btn--primary" data-next="meta">Далее →</button>
            </div>
          </div>
        </div>

        <!-- Panel 2: meta -->
        <div class="ae-panel" id="ae-panel-meta">
          <div class="ae-group">
            <label for="ae-title-input">Заголовок статьи *</label>
            <input type="text" id="ae-title-input" maxlength="150" placeholder="Введите заголовок..." autocomplete="off">
          </div>
          <div class="ae-group">
            <label for="ae-excerpt-input">Краткое описание <span class="ae-label-hint">— анонс на карточке статьи</span></label>
            <textarea id="ae-excerpt-input" rows="2" maxlength="300" placeholder="Пару предложений для карточки..."></textarea>
          </div>
          <div class="ae-group">
            <label for="ae-tags-input">Теги <span class="ae-label-hint">— через запятую</span></label>
            <input type="text" id="ae-tags-input" maxlength="200" placeholder="Томск, история, прогулки">
          </div>
          <div class="ae-group">
            <label>Обложка статьи <span class="ae-label-hint">— отображается в карточке</span></label>
            <div class="ae-cover-upload">
              <img id="ae-cover-preview" class="ae-cover-preview" src="" alt="Обложка">
              <label class="ae-upload-btn">
                <span>📷</span> Загрузить обложку
                <input type="file" id="ae-cover-file" accept="image/*" style="display:none">
              </label>
              <span class="ae-upload-progress" id="ae-upload-status"></span>
            </div>
          </div>
          <div class="ae-footer">
            <span></span>
            <div class="ae-footer-actions">
              <button class="ae-btn ae-btn--prev" data-next="template">← Назад</button>
              <button class="ae-btn ae-btn--primary" data-next="content">Далее →</button>
            </div>
          </div>
        </div>

        <!-- Panel 3: content -->
        <div class="ae-panel ae-panel--content" id="ae-panel-content">

          <div class="ae-toolbar">
            <div class="ae-tool-group">
              <button type="button" id="ae-btn-bold" title="Жирный — выделите текст"><strong>B</strong></button>
              <button type="button" id="ae-btn-italic" title="Курсив — выделите текст"><em>I</em></button>
              <button type="button" id="ae-btn-underline" title="Подчёркивание — выделите текст"><u>U</u></button>
            </div>
            <div class="ae-tool-group">
              <select id="ae-heading-select" class="ae-toolbar-select">
                <option value="h2">Заголовок H2</option>
                <option value="h3">Подзаголовок H3</option>
                <option value="h4">Малый H4</option>
                <option value="p">Абзац &lt;p&gt;</option>
                <option value="blockquote">Цитата</option>
              </select>
              <button type="button" id="ae-btn-apply-heading">Применить</button>
            </div>
            <div class="ae-tool-group">
              <button type="button" id="ae-btn-ul" class="ae-btn-list">• Список</button>
              <button type="button" id="ae-btn-ol" class="ae-btn-list">1. Список</button>
            </div>
            <div class="ae-tool-group ae-img-group">
              <button type="button" id="ae-btn-img-url" class="ae-btn-img-url">🔗 По URL</button>
              <button type="button" id="ae-btn-img-upload" class="ae-btn-img-upload">📁 С компьютера</button>
            </div>
            <div class="ae-tool-group">
              <button type="button" id="ae-btn-remove-format" class="ae-btn-clear">🧹 Очистить стиль</button>
            </div>
          </div>

          <input type="file" id="ae-content-file" accept="image/*" style="display:none">

          <div class="ae-editor-split">
            <div class="ae-editor-side">
              <div class="ae-side-label">✏️ HTML-редактор</div>
              <textarea id="ae-html-textarea" spellcheck="false" placeholder="HTML-разметка статьи..."></textarea>
            </div>
            <div class="ae-preview-side">
              <div class="ae-side-label">👁 Предпросмотр</div>
              <div id="ae-live-preview" class="ae-live-preview"></div>
            </div>
          </div>

          <div class="ae-footer">
            <span class="ae-feedback" id="ae-feedback"></span>
            <div class="ae-footer-actions">
              <button class="ae-btn ae-btn--prev" data-next="meta">← Назад</button>
              <button class="ae-btn ae-btn--outline" id="ae-save-draft">Сохранить черновик</button>
              <button class="ae-btn ae-btn--primary" id="ae-submit-btn">Отправить на модерацию</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function _templatePreview(key) {
    if (key === 'classic') return `
      <div class="tpl-bar tpl-bar--title"></div>
      <div class="tpl-bar" style="width:40%"></div>
      <div class="tpl-bar tpl-bar--img"></div>
      <div class="tpl-bar tpl-bar--text"></div>
      <div class="tpl-bar tpl-bar--text"></div>
      <div class="tpl-bar tpl-bar--short"></div>`;
    if (key === 'photoreport') return `
      <div class="tpl-bar tpl-bar--img" style="height:48px"></div>
      <div class="tpl-bar tpl-bar--title" style="margin-top:4px"></div>
      <div style="display:flex;gap:4px">
        <div class="tpl-bar tpl-bar--half"></div>
        <div class="tpl-bar tpl-bar--half"></div>
      </div>
      <div class="tpl-bar tpl-bar--text"></div>`;
    if (key === 'route') return `
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:14px;height:14px;border-radius:50%;background:rgba(1,153,52,.45);flex-shrink:0"></div>
        <div class="tpl-bar" style="flex:1;margin:0"></div>
      </div>
      <div class="tpl-bar tpl-bar--half" style="margin-left:20px"></div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
        <div style="width:14px;height:14px;border-radius:50%;background:rgba(1,153,52,.45);flex-shrink:0"></div>
        <div class="tpl-bar" style="flex:1;margin:0"></div>
      </div>
      <div class="tpl-bar tpl-bar--half" style="margin-left:20px"></div>`;
    return '';
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  function _bindEvents(overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) _close();
    });

    document.getElementById('ae-close-btn').addEventListener('click', _close);

    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') {
        _close();
        document.removeEventListener('keydown', onKey);
      }
    });

    overlay.querySelectorAll('[data-next]').forEach(btn => {
      btn.addEventListener('click', () => _goToPanel(btn.dataset.next));
    });

    overlay.querySelectorAll('.ae-step-btn').forEach(btn => {
      btn.addEventListener('click', () => _goToPanel(btn.dataset.panel));
    });

    overlay.querySelectorAll('.ae-template-card').forEach(card => {
      card.addEventListener('click', () => {
        overlay.querySelectorAll('.ae-template-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        card.querySelector('input[type="radio"]').checked = true;
        selectedTemplate = card.dataset.template;
      });
    });

    document.getElementById('ae-cover-file').addEventListener('change', _handleCoverUpload);

    document.getElementById('ae-html-textarea').addEventListener('input', _updatePreview);

    document.getElementById('ae-btn-bold').addEventListener('click', () => _toggleInlineTag('strong', '<strong>', '</strong>'));
    document.getElementById('ae-btn-italic').addEventListener('click', () => _toggleInlineTag('em', '<em>', '</em>'));
    document.getElementById('ae-btn-underline').addEventListener('click', () => _toggleInlineTag('u', '<u>', '</u>'));
    document.getElementById('ae-btn-apply-heading').addEventListener('click', () => {
      _toggleBlock(document.getElementById('ae-heading-select').value);
    });
    document.getElementById('ae-btn-ul').addEventListener('click', () => _convertToList('ul'));
    document.getElementById('ae-btn-ol').addEventListener('click', () => _convertToList('ol'));
    document.getElementById('ae-btn-img-url').addEventListener('click', _insertImageByUrl);
    document.getElementById('ae-btn-img-upload').addEventListener('click', () => {
      document.getElementById('ae-content-file').click();
    });
    document.getElementById('ae-content-file').addEventListener('change', _handleContentImageUpload);
    document.getElementById('ae-btn-remove-format').addEventListener('click', _removeFormatting);

    document.getElementById('ae-submit-btn').addEventListener('click', () => _submit('submitted'));
    document.getElementById('ae-save-draft').addEventListener('click', () => _submit('draft'));
  }

  function _goToPanel(panelName) {
    document.querySelectorAll('.ae-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.ae-step-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.panel === panelName);
    });
    const target = document.getElementById(`ae-panel-${panelName}`);
    if (target) target.classList.add('active');

    if (panelName === 'content') {
      const ta = document.getElementById('ae-html-textarea');
      if (ta && !ta.value.trim()) {
        ta.value = TEMPLATE_STARTERS[selectedTemplate] || '';
        _updatePreview();
      }
    }
  }

  // ─── Live preview ─────────────────────────────────────────────────────────

  function _esc(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  }

  function _updatePreview() {
    const ta = document.getElementById('ae-html-textarea');
    const preview = document.getElementById('ae-live-preview');
    if (!ta || !preview) return;

    let html = ta.value;
    html = html.replace(/<!--\s*image:\s*(\d+)\s*-->/g, (match, id) => {
      const data = imageStore.get(id);
      if (!data) return match;
      const widthStyle = data.width ? `width:${data.width};` : '';
      const img = `<img src="${data.base64}" alt="${_esc(data.caption) || 'Изображение'}" style="${widthStyle}max-width:100%;height:auto;border-radius:8px;">`;
      if (data.caption && data.caption.trim()) {
        return `<figure style="margin:1rem 0;">${img}<figcaption style="font-size:.85rem;color:#666;text-align:center;margin-top:4px;">${_esc(data.caption)}</figcaption></figure>`;
      }
      return img;
    });

    preview.innerHTML = html || '<em style="color:#aaa">Начните вводить текст слева...</em>';
  }

  // ─── Formatting helpers ───────────────────────────────────────────────────

  function _ta() { return document.getElementById('ae-html-textarea'); }

  function _unwrapInline(tagName) {
    const ta = _ta();
    const { selectionStart: s, selectionEnd: e, value } = ta;
    if (s === e) return false;
    const before = value.substring(0, s);
    const after = value.substring(e);
    const om = before.match(new RegExp(`<${tagName}(\\s[^>]*)?>\\s*$`, 'i'));
    const cm = after.match(new RegExp(`^\\s*</${tagName}>`, 'i'));
    if (!om || !cm) return false;
    const inner = value.substring(s, e);
    ta.value = value.substring(0, s - om[0].length) + inner + value.substring(e + cm[0].length);
    ta.selectionStart = s - om[0].length;
    ta.selectionEnd = s - om[0].length + inner.length;
    ta.focus();
    _updatePreview();
    return true;
  }

  function _toggleInlineTag(tagName, open, close) {
    const ta = _ta();
    const { selectionStart: s, selectionEnd: e } = ta;
    if (s === e) { alert('Выделите текст для форматирования'); return; }
    if (_unwrapInline(tagName)) return;
    const sel = ta.value.substring(s, e);
    ta.value = ta.value.substring(0, s) + open + sel + close + ta.value.substring(e);
    ta.selectionStart = s;
    ta.selectionEnd = e + open.length + close.length;
    ta.focus();
    _updatePreview();
  }

  function _toggleBlock(tag) {
    const ta = _ta();
    const { selectionStart: s, selectionEnd: e, value } = ta;
    if (s === e) { alert('Выделите текст для обёртки'); return; }
    const before = value.substring(0, s);
    const after = value.substring(e);
    const om = before.match(new RegExp(`<${tag}(\\s[^>]*)?>\\s*$`, 'i'));
    const cm = after.match(new RegExp(`^\\s*</${tag}>`, 'i'));
    if (om && cm) {
      const inner = value.substring(s, e);
      ta.value = value.substring(0, s - om[0].length) + inner + value.substring(e + cm[0].length);
      ta.selectionStart = s - om[0].length;
      ta.selectionEnd = s - om[0].length + inner.length;
    } else {
      const sel = value.substring(s, e);
      const wrapped = `<${tag}>${sel}</${tag}>`;
      ta.value = value.substring(0, s) + wrapped + value.substring(e);
      ta.selectionStart = s;
      ta.selectionEnd = s + wrapped.length;
    }
    ta.focus();
    _updatePreview();
  }

  function _convertToList(listType) {
    const ta = _ta();
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const lines = (s === e ? [] : value.substring(s, e).split(/\r?\n/).filter(l => l.trim()));
    const items = lines.length ? lines.map(l => `<li>${l}</li>`).join('') : '<li>Новый пункт</li>';
    const list = `<${listType}>${items}</${listType}>`;
    ta.value = value.substring(0, s) + list + value.substring(e);
    ta.selectionStart = s;
    ta.selectionEnd = s + list.length;
    ta.focus();
    _updatePreview();
  }

  function _removeFormatting() {
    const ta = _ta();
    const { selectionStart: s, selectionEnd: e } = ta;
    if (s === e) { alert('Выделите текст для очистки стилей'); return; }
    let text = ta.value.substring(s, e);
    text = text.replace(/<span\b[^>]*>(.*?)<\/span>/gis, '$1');
    for (const tag of ['strong', 'b', 'em', 'i', 'u', 'code', 'mark', 'del']) {
      text = text.replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), '').replace(new RegExp(`</${tag}>`, 'gi'), '');
    }
    ta.value = ta.value.substring(0, s) + text + ta.value.substring(e);
    ta.selectionStart = s;
    ta.selectionEnd = s + text.length;
    ta.focus();
    _updatePreview();
  }

  // ─── Content images ───────────────────────────────────────────────────────

  function _insertAtCursor(text) {
    const ta = _ta();
    const s = ta.selectionStart;
    ta.value = ta.value.substring(0, s) + text + ta.value.substring(ta.selectionEnd);
    ta.selectionStart = ta.selectionEnd = s + text.length;
    ta.focus();
    _updatePreview();
  }

  function _insertImageByUrl() {
    const url = prompt('Вставьте URL изображения:', 'https://');
    if (!url || !url.trim()) return;
    const caption = prompt('Подпись к изображению (можно оставить пустым):', '') || '';
    const width = prompt('Ширина изображения (например: 100%, 400px):', '100%') || '100%';
    const img = `<img src="${url.trim()}" alt="${_esc(caption) || 'Изображение'}" style="width:${width};max-width:100%;height:auto;border-radius:8px;">`;
    const html = caption.trim()
      ? `<figure style="margin:1rem 0;">${img}<figcaption style="font-size:.85rem;color:#666;text-align:center;margin-top:4px;">${_esc(caption)}</figcaption></figure>`
      : img;
    _insertAtCursor(html);
  }

  function _handleContentImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Выберите изображение'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Файл больше 5 МБ'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const caption = prompt('Подпись к изображению:', file.name) || '';
      const width = prompt('Ширина изображения (например: 100%, 400px):', '100%') || '100%';
      const id = String(nextImageId++);
      imageStore.set(id, { base64: ev.target.result, caption, width });
      _insertAtCursor(`<!-- image: ${id} -->`);
    };
    reader.onerror = () => alert('Ошибка чтения файла');
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // ─── Cover upload ─────────────────────────────────────────────────────────

  async function _handleCoverUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.getElementById('ae-upload-status');
    const preview = document.getElementById('ae-cover-preview');
    status.textContent = 'Загрузка...';
    const formData = new FormData();
    formData.append('file', file);
    try {
      const API_BASE = window.APP_CONFIG?.API_BASE || '';
      const token = window.authHelper?.getToken?.() || '';
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      uploadedCoverUrl = data.url;
      preview.src = `${API_BASE.replace('/api', '')}${data.url}`;
      preview.classList.add('visible');
      status.textContent = 'Загружено ✓';
    } catch (err) {
      status.textContent = `Ошибка: ${err.message}`;
    }
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function _submit(status) {
    const feedback = document.getElementById('ae-feedback');
    feedback.textContent = '';
    feedback.className = 'ae-feedback';

    const title = (document.getElementById('ae-title-input').value || '').trim();
    const excerpt = (document.getElementById('ae-excerpt-input').value || '').trim();
    const tags = (document.getElementById('ae-tags-input').value || '').trim();
    const body = (document.getElementById('ae-html-textarea').value || '').trim();

    if (!title) {
      _goToPanel('meta');
      feedback.textContent = 'Введите заголовок статьи';
      feedback.classList.add('error');
      return;
    }
    if (body.replace(/<[^>]+>/g, '').length < 200) {
      feedback.textContent = 'Текст статьи должен быть не менее 200 символов';
      feedback.classList.add('error');
      return;
    }

    const submitBtn = document.getElementById('ae-submit-btn');
    submitBtn.disabled = true;
    feedback.textContent = 'Отправляем...';

    try {
      const API_BASE = window.APP_CONFIG?.API_BASE || '';
      const token = window.authHelper?.getToken?.() || '';
      const res = await fetch(`${API_BASE}/articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, body, excerpt, tags, templateType: selectedTemplate, coverImage: uploadedCoverUrl, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
      feedback.textContent = data.message || 'Готово!';
      feedback.classList.add('success');
      if (onSuccessCallback) onSuccessCallback(data.article);
      setTimeout(() => { _close(); _reset(); }, 1200);
    } catch (err) {
      feedback.textContent = err.message;
      feedback.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function _close() {
    const overlay = document.getElementById('ae-overlay');
    if (overlay) overlay.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function _reset() {
    selectedTemplate = 'classic';
    uploadedCoverUrl = '';
    imageStore.clear();
    nextImageId = 1;

    const byId = id => document.getElementById(id);
    const title = byId('ae-title-input');
    const excerpt = byId('ae-excerpt-input');
    const tags = byId('ae-tags-input');
    const coverPreview = byId('ae-cover-preview');
    const uploadStatus = byId('ae-upload-status');
    const textarea = byId('ae-html-textarea');
    const livePreview = byId('ae-live-preview');

    if (title) title.value = '';
    if (excerpt) excerpt.value = '';
    if (tags) tags.value = '';
    if (coverPreview) { coverPreview.src = ''; coverPreview.classList.remove('visible'); }
    if (uploadStatus) uploadStatus.textContent = '';
    if (textarea) textarea.value = '';
    if (livePreview) livePreview.innerHTML = '<em style="color:#aaa">Начните вводить текст слева...</em>';

    document.querySelectorAll('.ae-template-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.template === 'classic');
    });
  }
})();
