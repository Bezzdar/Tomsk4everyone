/**
 * Article editor for the first external user test.
 * One supported format, one persistence path, explicit draft/resubmit states.
 */
(function () {
  'use strict';

  const STARTER = `<h2>Заголовок раздела</h2>
<p>Напишите вступление — краткий анонс того, о чём пойдёт речь.</p>
<h3>Подзаголовок</h3>
<p>Основной текст статьи.</p>
<p>Заключение статьи.</p>`;

  const ALLOWED_PREVIEW_TAGS = new Set([
    'P', 'BR', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'U',
    'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'IMG', 'FIGURE', 'FIGCAPTION',
  ]);

  let editingArticle = null;
  let onSuccessCallback = null;
  let uploadedCoverUrl = '';

  window.ArticleEditor = {
    open(opts = {}) {
      editingArticle = opts.article || null;
      onSuccessCallback = opts.onSuccess || null;
      uploadedCoverUrl = editingArticle?.coverImage || '';
      buildAndOpen();
    },
    close,
  };

  function buildAndOpen() {
    document.getElementById('ae-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'ae-overlay';
    overlay.className = 'article-editor-overlay';
    overlay.innerHTML = renderDialog();
    document.body.appendChild(overlay);
    bindEvents(overlay);
    fillForm();
    updatePreview();
    document.body.style.overflow = 'hidden';
  }

  function renderDialog() {
    const isEdit = Boolean(editingArticle);
    const needsRevision = editingArticle?.status === 'needs_revision';
    const draft = editingArticle?.status === 'draft';
    const submitText = needsRevision ? 'Отправить повторно' : draft ? 'Отправить на модерацию' : 'Отправить на модерацию';

    return `
      <div class="article-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="ae-title">
        <header class="ae-header">
          <div>
            <h2 id="ae-title">${isEdit ? 'Редактирование статьи' : 'Новая статья'}</h2>
            <p class="ae-hint">Для первой тестовой версии доступен классический формат статьи.</p>
          </div>
          <button class="ae-close" id="ae-close-btn" aria-label="Закрыть">&times;</button>
        </header>

        ${needsRevision && editingArticle.moderatorComment ? `
          <div class="ae-feedback error" style="display:block;margin:1rem">
            Комментарий модератора: ${escapeHtml(editingArticle.moderatorComment)}
          </div>` : ''}

        <div class="ae-panel active ae-panel--content" style="display:block">
          <div class="ae-group">
            <label for="ae-title-input">Заголовок статьи *</label>
            <input type="text" id="ae-title-input" maxlength="150" autocomplete="off">
          </div>
          <div class="ae-group">
            <label for="ae-excerpt-input">Краткое описание</label>
            <textarea id="ae-excerpt-input" rows="2" maxlength="300"></textarea>
          </div>
          <div class="ae-group">
            <label for="ae-tags-input">Теги — через запятую</label>
            <input type="text" id="ae-tags-input" maxlength="200">
          </div>
          <div class="ae-group">
            <label>Обложка статьи</label>
            <div class="ae-cover-upload">
              <img id="ae-cover-preview" class="ae-cover-preview" alt="Обложка">
              <label class="ae-upload-btn">
                Загрузить обложку
                <input type="file" id="ae-cover-file" accept="image/png,image/jpeg,image/gif,image/webp" hidden>
              </label>
              <span class="ae-upload-progress" id="ae-upload-status"></span>
            </div>
          </div>

          <div class="ae-toolbar">
            <button type="button" data-wrap="strong"><strong>B</strong></button>
            <button type="button" data-wrap="em"><em>I</em></button>
            <button type="button" data-block="h2">H2</button>
            <button type="button" data-block="h3">H3</button>
            <button type="button" id="ae-btn-img-upload">Изображение</button>
          </div>
          <input type="file" id="ae-content-file" accept="image/png,image/jpeg,image/gif,image/webp" hidden>

          <div class="ae-editor-split">
            <div class="ae-editor-side">
              <div class="ae-side-label">HTML-редактор</div>
              <textarea id="ae-html-textarea" spellcheck="true"></textarea>
            </div>
            <div class="ae-preview-side">
              <div class="ae-side-label">Предпросмотр</div>
              <div id="ae-live-preview" class="ae-live-preview"></div>
            </div>
          </div>

          <div class="ae-footer">
            <span class="ae-feedback" id="ae-feedback"></span>
            <div class="ae-footer-actions">
              <button class="ae-btn ae-btn--outline" id="ae-save-btn">${isEdit ? 'Сохранить изменения' : 'Сохранить черновик'}</button>
              <button class="ae-btn ae-btn--primary" id="ae-submit-btn">${submitText}</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function bindEvents(overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    document.getElementById('ae-close-btn').addEventListener('click', close);
    document.getElementById('ae-html-textarea').addEventListener('input', updatePreview);
    document.getElementById('ae-cover-file').addEventListener('change', handleCoverUpload);
    document.getElementById('ae-btn-img-upload').addEventListener('click', () => document.getElementById('ae-content-file').click());
    document.getElementById('ae-content-file').addEventListener('change', handleContentImageUpload);
    document.getElementById('ae-save-btn').addEventListener('click', saveOnly);
    document.getElementById('ae-submit-btn').addEventListener('click', saveAndSubmit);

    overlay.querySelectorAll('[data-wrap]').forEach((button) => {
      button.addEventListener('click', () => wrapSelection(button.dataset.wrap));
    });
    overlay.querySelectorAll('[data-block]').forEach((button) => {
      button.addEventListener('click', () => wrapSelection(button.dataset.block));
    });
  }

  function fillForm() {
    document.getElementById('ae-title-input').value = editingArticle?.title || '';
    document.getElementById('ae-excerpt-input').value = editingArticle?.excerpt || '';
    document.getElementById('ae-tags-input').value = editingArticle?.tags || '';
    document.getElementById('ae-html-textarea').value = editingArticle?.content || STARTER;

    const preview = document.getElementById('ae-cover-preview');
    if (uploadedCoverUrl) {
      preview.src = uploadedCoverUrl;
      preview.classList.add('visible');
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safePreview(rawHtml) {
    const doc = new DOMParser().parseFromString(`<div>${rawHtml || ''}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    root.querySelectorAll('*').forEach((element) => {
      if (!ALLOWED_PREVIEW_TAGS.has(element.tagName)) {
        element.replaceWith(...element.childNodes);
        return;
      }
      [...element.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const allowed = ['href', 'src', 'alt', 'title', 'width', 'height'];
        if (!allowed.includes(name) || name.startsWith('on')) element.removeAttribute(attribute.name);
      });
      if (element.tagName === 'A') element.setAttribute('rel', 'nofollow noopener');
    });
    return root.innerHTML;
  }

  function updatePreview() {
    const raw = document.getElementById('ae-html-textarea')?.value || '';
    document.getElementById('ae-live-preview').innerHTML = safePreview(raw);
  }

  function wrapSelection(tag) {
    const textarea = document.getElementById('ae-html-textarea');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || 'Текст';
    const replacement = `<${tag}>${selected}</${tag}>`;
    textarea.setRangeText(replacement, start, end, 'end');
    textarea.focus();
    updatePreview();
  }

  function insertAtCursor(html) {
    const textarea = document.getElementById('ae-html-textarea');
    const start = textarea.selectionStart;
    textarea.setRangeText(html, start, textarea.selectionEnd, 'end');
    textarea.focus();
    updatePreview();
  }

  async function uploadImage(file) {
    if (!file) throw new Error('Файл не выбран');
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${window.APP_CONFIG?.API_BASE || '/api'}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${window.authHelper?.getToken() || ''}` },
      body: form,
    });
    if (window.authHelper?.handleUnauthorized(response)) throw new Error('Сессия истекла');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Ошибка загрузки изображения');
    return payload.url;
  }

  async function handleCoverUpload(event) {
    const status = document.getElementById('ae-upload-status');
    try {
      status.textContent = 'Загрузка...';
      uploadedCoverUrl = await uploadImage(event.target.files[0]);
      const preview = document.getElementById('ae-cover-preview');
      preview.src = uploadedCoverUrl;
      preview.classList.add('visible');
      status.textContent = 'Загружено';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      event.target.value = '';
    }
  }

  async function handleContentImageUpload(event) {
    try {
      const url = await uploadImage(event.target.files[0]);
      const caption = prompt('Подпись к изображению:', '') || '';
      insertAtCursor(`<figure><img src="${url}" alt="${escapeHtml(caption)}"><figcaption>${escapeHtml(caption)}</figcaption></figure>`);
    } catch (error) {
      setFeedback(error.message, true);
    } finally {
      event.target.value = '';
    }
  }

  function collectPayload() {
    return {
      title: document.getElementById('ae-title-input').value.trim(),
      excerpt: document.getElementById('ae-excerpt-input').value.trim(),
      tags: document.getElementById('ae-tags-input').value.trim(),
      body: document.getElementById('ae-html-textarea').value.trim(),
      templateType: 'classic',
      coverImage: uploadedCoverUrl,
    };
  }

  function validatePayload(payload) {
    if (!payload.title) throw new Error('Введите заголовок статьи');
    const textLength = payload.body.replace(/<[^>]+>/g, '').trim().length;
    if (textLength < 200) throw new Error('Текст статьи должен быть не менее 200 символов');
  }

  async function request(path, options) {
    const response = await fetch(`${window.APP_CONFIG?.API_BASE || '/api'}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${window.authHelper?.getToken() || ''}`,
        ...(options.headers || {}),
      },
    });
    if (window.authHelper?.handleUnauthorized(response)) throw new Error('Сессия истекла');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const suffix = payload.requestId ? ` Код обращения: ${payload.requestId}` : '';
      throw new Error((payload.error || 'Ошибка сервера') + suffix);
    }
    return payload;
  }

  async function persist(payload, createStatus = 'draft') {
    if (!editingArticle) {
      return request('/articles', {
        method: 'POST',
        body: JSON.stringify({ ...payload, status: createStatus }),
      });
    }
    return request(`/articles/${editingArticle.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async function saveOnly() {
    const button = document.getElementById('ae-save-btn');
    try {
      button.disabled = true;
      const payload = collectPayload();
      validatePayload(payload);
      const data = await persist(payload, 'draft');
      editingArticle = data.article;
      setFeedback(data.message || 'Сохранено');
      if (onSuccessCallback) await onSuccessCallback(data.article);
    } catch (error) {
      setFeedback(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  async function saveAndSubmit() {
    const button = document.getElementById('ae-submit-btn');
    try {
      button.disabled = true;
      const payload = collectPayload();
      validatePayload(payload);

      if (!editingArticle) {
        const data = await persist(payload, 'submitted');
        setFeedback(data.message || 'Статья отправлена');
        if (onSuccessCallback) await onSuccessCallback(data.article);
      } else {
        const saved = await persist(payload, 'draft');
        const submitted = await request(`/articles/${saved.article.id}/submit`, {
          method: 'POST',
          body: '{}',
        });
        setFeedback(submitted.message || 'Статья отправлена');
        if (onSuccessCallback) await onSuccessCallback(submitted.article);
      }
      setTimeout(close, 450);
    } catch (error) {
      setFeedback(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  function setFeedback(message, isError = false) {
    const feedback = document.getElementById('ae-feedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle('error', isError);
    feedback.classList.toggle('success', !isError);
  }

  function close() {
    document.getElementById('ae-overlay')?.remove();
    document.body.style.overflow = '';
    editingArticle = null;
    onSuccessCallback = null;
    uploadedCoverUrl = '';
  }
})();
