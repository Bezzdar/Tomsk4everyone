/**
 * article-editor.js
 * Полноценный редактор статей: выбор шаблона → метаданные → контент (WYSIWYG/HTML)
 * Зависимости: config.js, session.js (authHelper), Quill CDN
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

  let quillInstance = null;
  let currentMode = 'wysiwyg'; // 'wysiwyg' | 'html'
  let selectedTemplate = 'classic';
  let uploadedCoverUrl = '';
  let onSuccessCallback = null;

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

    _initQuill();
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
          <p style="margin:0;color:#555;font-size:.9rem">Выберите шаблон, который определяет структуру вашей статьи:</p>
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
            <label for="ae-excerpt-input">Краткое описание (анонс)</label>
            <textarea id="ae-excerpt-input" rows="2" maxlength="300" placeholder="Пару предложений для карточки статьи..."></textarea>
          </div>
          <div class="ae-group">
            <label for="ae-tags-input">Теги (через запятую)</label>
            <input type="text" id="ae-tags-input" maxlength="200" placeholder="Томск, история, прогулки">
          </div>
          <div class="ae-group">
            <label>Обложка статьи</label>
            <div class="ae-cover-upload">
              <img id="ae-cover-preview" class="ae-cover-preview" src="" alt="Обложка">
              <label class="ae-upload-btn">
                <span>📷</span> Загрузить изображение
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
        <div class="ae-panel" id="ae-panel-content">
          <div class="ae-editor-mode-bar">
            <span style="font-weight:600;font-size:.9rem;color:#333">Редактор:</span>
            <button class="ae-mode-btn active" id="ae-btn-wysiwyg">Визуальный (WYSIWYG)</button>
            <button class="ae-mode-btn" id="ae-btn-html">HTML-код</button>
          </div>
          <div id="ae-quill-container"></div>
          <textarea id="ae-html-textarea" placeholder="Введите HTML-разметку статьи..."></textarea>
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

  // ─── Quill ────────────────────────────────────────────────────────────────

  function _initQuill() {
    if (typeof Quill === 'undefined') return;

    quillInstance = new Quill('#ae-quill-container', {
      theme: 'snow',
      placeholder: 'Начните писать статью здесь...',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          ['blockquote', 'code-block'],
          ['link', 'image'],
          [{ align: [] }],
          ['clean'],
        ],
      },
    });
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

    // Step navigation buttons
    overlay.querySelectorAll('[data-next]').forEach(btn => {
      btn.addEventListener('click', () => _goToPanel(btn.dataset.next));
    });

    // Step bar buttons
    overlay.querySelectorAll('.ae-step-btn').forEach(btn => {
      btn.addEventListener('click', () => _goToPanel(btn.dataset.panel));
    });

    // Template selection
    overlay.querySelectorAll('.ae-template-card').forEach(card => {
      card.addEventListener('click', () => {
        overlay.querySelectorAll('.ae-template-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        card.querySelector('input[type="radio"]').checked = true;
        selectedTemplate = card.dataset.template;
      });
    });

    // Editor mode toggle
    document.getElementById('ae-btn-wysiwyg').addEventListener('click', () => _setMode('wysiwyg'));
    document.getElementById('ae-btn-html').addEventListener('click', () => _setMode('html'));

    // Cover image upload
    document.getElementById('ae-cover-file').addEventListener('change', _handleCoverUpload);

    // Submit and draft
    document.getElementById('ae-submit-btn').addEventListener('click', () => _submit('submitted'));
    document.getElementById('ae-save-draft').addEventListener('click', () => _submit('draft'));
  }

  function _goToPanel(panelName) {
    const panels = document.querySelectorAll('.ae-panel');
    const stepBtns = document.querySelectorAll('.ae-step-btn');
    panels.forEach(p => p.classList.remove('active'));
    stepBtns.forEach(b => b.classList.toggle('active', b.dataset.panel === panelName));
    const target = document.getElementById(`ae-panel-${panelName}`);
    if (target) target.classList.add('active');
  }

  function _setMode(mode) {
    currentMode = mode;
    const quillEl = document.getElementById('ae-quill-container');
    const htmlEl = document.getElementById('ae-html-textarea');
    const btnWys = document.getElementById('ae-btn-wysiwyg');
    const btnHtml = document.getElementById('ae-btn-html');

    if (mode === 'wysiwyg') {
      if (quillInstance && htmlEl.value) {
        quillInstance.clipboard.dangerouslyPasteHTML(htmlEl.value);
      }
      quillEl.style.display = '';
      htmlEl.style.display = 'none';
      btnWys.classList.add('active');
      btnHtml.classList.remove('active');
    } else {
      if (quillInstance) {
        htmlEl.value = quillInstance.root.innerHTML;
      }
      quillEl.style.display = 'none';
      htmlEl.style.display = 'block';
      btnWys.classList.remove('active');
      btnHtml.classList.add('active');
    }
  }

  function _getBody() {
    if (currentMode === 'wysiwyg' && quillInstance) {
      return quillInstance.root.innerHTML;
    }
    return document.getElementById('ae-html-textarea').value;
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
      status.textContent = 'Изображение загружено ✓';
    } catch (err) {
      status.textContent = `Ошибка: ${err.message}`;
      console.error(err);
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
    const body = _getBody().trim();

    if (!title) {
      _goToPanel('meta');
      feedback.textContent = 'Введите заголовок статьи';
      feedback.classList.add('error');
      return;
    }

    const plainBody = body.replace(/<[^>]+>/g, '');
    if (!plainBody || plainBody.length < 200) {
      _goToPanel('content');
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          body,
          excerpt,
          tags,
          templateType: selectedTemplate,
          coverImage: uploadedCoverUrl,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');

      feedback.textContent = data.message || 'Готово!';
      feedback.classList.add('success');

      if (onSuccessCallback) onSuccessCallback(data.article);

      setTimeout(() => {
        _close();
        _reset();
      }, 1200);
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
    currentMode = 'wysiwyg';

    const titleEl = document.getElementById('ae-title-input');
    const excerptEl = document.getElementById('ae-excerpt-input');
    const tagsEl = document.getElementById('ae-tags-input');
    const preview = document.getElementById('ae-cover-preview');
    const statusEl = document.getElementById('ae-upload-status');
    const htmlEl = document.getElementById('ae-html-textarea');

    if (titleEl) titleEl.value = '';
    if (excerptEl) excerptEl.value = '';
    if (tagsEl) tagsEl.value = '';
    if (preview) { preview.src = ''; preview.classList.remove('visible'); }
    if (statusEl) statusEl.textContent = '';
    if (htmlEl) htmlEl.value = '';
    if (quillInstance) quillInstance.setContents([]);

    document.querySelectorAll('.ae-template-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.template === 'classic');
    });
  }
})();
