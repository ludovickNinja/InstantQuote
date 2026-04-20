(function () {
  'use strict';

  // ─── Configuration ─────────────────────────────────────────────────────────
  const CONFIG = {
    WEBHOOK_URL: 'https://crownring.app.n8n.cloud/webhook/instant-quote',
    MAX_FILES: 3,
    MAX_FILE_SIZE_MB: 10,
    ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  };

  // ─── State ──────────────────────────────────────────────────────────────────
  const state = {
    files: [],
    objectUrls: [],
    isLoading: false,
  };

  // ─── DOM Cache ──────────────────────────────────────────────────────────────
  const els = {
    quoteFormSection: document.getElementById('quoteFormSection'),
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    previewStrip: document.getElementById('previewStrip'),
    description: document.getElementById('description'),
    charCount: document.getElementById('charCount'),
    material: document.getElementById('material'),
    pieceType: document.getElementById('pieceType'),
    getQuoteBtn: document.getElementById('getQuoteBtn'),
    formError: document.getElementById('formError'),
    loadingSection: document.getElementById('loadingSection'),
    resultsSection: document.getElementById('resultsSection'),
    errorSection: document.getElementById('errorSection'),
    renderFront: document.getElementById('renderFront'),
    renderSide: document.getElementById('renderSide'),
    renderPerspective: document.getElementById('renderPerspective'),
    priceRange: document.getElementById('priceRange'),
    priceDescription: document.getElementById('priceDescription'),
    errorMessage: document.getElementById('errorMessage'),
    startOverBtn: document.getElementById('startOverBtn'),
    retryBtn: document.getElementById('retryBtn'),
  };

  // ─── Drop Zone ──────────────────────────────────────────────────────────────

  function initDropZone() {
    els.dropZone.addEventListener('click', () => els.fileInput.click());

    els.dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        els.fileInput.click();
      }
    });

    els.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      els.dropZone.classList.add('drag-over');
    });

    els.dropZone.addEventListener('dragleave', (e) => {
      if (!els.dropZone.contains(e.relatedTarget)) {
        els.dropZone.classList.remove('drag-over');
      }
    });

    els.dropZone.addEventListener('dragend', () => {
      els.dropZone.classList.remove('drag-over');
    });

    els.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      els.dropZone.classList.remove('drag-over');
      handleFiles(e.dataTransfer.files);
    });

    els.fileInput.addEventListener('change', () => {
      handleFiles(els.fileInput.files);
      els.fileInput.value = '';
    });
  }

  function handleFiles(fileList) {
    const incoming = Array.from(fileList);
    const rejected = [];
    const accepted = [];

    for (const file of incoming) {
      if (!CONFIG.ACCEPTED_TYPES.includes(file.type)) {
        rejected.push(`${file.name} (unsupported format)`);
        continue;
      }
      if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
        rejected.push(`${file.name} (exceeds ${CONFIG.MAX_FILE_SIZE_MB} MB)`);
        continue;
      }
      accepted.push(file);
    }

    // Deduplicate by name + size, then merge, then cap
    const existing = state.files;
    const merged = [...existing];
    for (const f of accepted) {
      const isDupe = merged.some((e) => e.name === f.name && e.size === f.size);
      if (!isDupe) merged.push(f);
    }
    state.files = merged.slice(0, CONFIG.MAX_FILES);

    if (rejected.length > 0) {
      showFormError(`Could not add: ${rejected.join(', ')}`);
    } else {
      hideFormError();
    }

    renderPreviews();
    validateForm();
  }

  // ─── Preview Strip ──────────────────────────────────────────────────────────

  function renderPreviews() {
    // Revoke previous object URLs to free memory
    state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.objectUrls = [];

    els.previewStrip.innerHTML = '';

    state.files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      state.objectUrls.push(url);

      const wrapper = document.createElement('div');
      wrapper.className = 'preview-item';

      const img = document.createElement('img');
      img.src = url;
      img.alt = file.name;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'preview-remove';
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.files.splice(index, 1);
        renderPreviews();
        validateForm();
      });

      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      els.previewStrip.appendChild(wrapper);
    });
  }

  // ─── Form Validation ────────────────────────────────────────────────────────

  function validateForm() {
    const valid =
      state.files.length >= 1 &&
      els.description.value.trim().length > 0 &&
      els.material.value !== '' &&
      els.pieceType.value !== '';

    els.getQuoteBtn.disabled = !valid;
  }

  function showFormError(msg) {
    els.formError.textContent = msg;
    els.formError.hidden = false;
  }

  function hideFormError() {
    els.formError.hidden = true;
    els.formError.textContent = '';
  }

  // ─── Character Counter ───────────────────────────────────────────────────────

  els.description.addEventListener('input', () => {
    els.charCount.textContent = `${els.description.value.length} / 1000`;
    validateForm();
  });

  els.material.addEventListener('change', validateForm);
  els.pieceType.addEventListener('change', validateForm);

  // ─── Base64 Conversion ───────────────────────────────────────────────────────

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Strip "data:<mime>;base64," prefix — send only raw base64
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // ─── Payload Builder ─────────────────────────────────────────────────────────

  async function buildPayload() {
    const images = await Promise.all(state.files.map(fileToBase64));
    return {
      images,
      imageMimeTypes: state.files.map((f) => f.type),
      description: els.description.value.trim(),
      material: els.material.value,
      pieceType: els.pieceType.value,
    };
  }

  // ─── Response Validation ─────────────────────────────────────────────────────

  function validateResponseShape(data) {
    if (!data || typeof data !== 'object') throw new Error('Response is not an object');
    const { images, price } = data;
    if (!images || typeof images !== 'object') throw new Error('Missing images object');
    if (!images.front || !images.side || !images.perspective) throw new Error('Missing one or more image angles');
    if (!price || typeof price.min !== 'number' || typeof price.max !== 'number') throw new Error('Missing or invalid price');
  }

  // ─── Quote Request ────────────────────────────────────────────────────────────

  async function requestQuote() {
    if (state.isLoading) return;

    showSection('loading');
    hideFormError();

    let payload;
    try {
      payload = await buildPayload();
    } catch {
      showError('Failed to process your images. Please try again.');
      return;
    }

    let response;
    try {
      response = await fetch(CONFIG.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      showError('Network error — please check your connection and try again.');
      return;
    }

    if (!response.ok) {
      showError(`Server error (${response.status}). Please try again.`);
      return;
    }

    let data;
    try {
      data = await response.json();
      validateResponseShape(data);
    } catch {
      showError('Received an unexpected response from the server. Please try again.');
      return;
    }

    renderResults(data);
  }

  // ─── Render Results ───────────────────────────────────────────────────────────

  function renderResults(data) {
    const toSrc = (b64) => `data:image/png;base64,${b64}`;
    els.renderFront.src = toSrc(data.images.front);
    els.renderSide.src = toSrc(data.images.side);
    els.renderPerspective.src = toSrc(data.images.perspective);

    const currency = data.price.currency || 'USD';
    const fmt = (n) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(n);

    els.priceRange.textContent = `${fmt(data.price.min)} – ${fmt(data.price.max)}`;

    if (data.description) {
      els.priceDescription.textContent = data.description;
      els.priceDescription.hidden = false;
    } else {
      els.priceDescription.hidden = true;
    }

    showSection('results');
  }

  // ─── Section Visibility ───────────────────────────────────────────────────────

  function showSection(name) {
    els.quoteFormSection.hidden = name === 'loading' || name === 'results';
    els.loadingSection.hidden = name !== 'loading';
    els.resultsSection.hidden = name !== 'results';
    els.errorSection.hidden = name !== 'error';
    state.isLoading = name === 'loading';
  }

  function showError(msg) {
    els.errorMessage.textContent = msg;
    showSection('error');
  }

  // ─── Reset ────────────────────────────────────────────────────────────────────

  function resetApp() {
    state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.files = [];
    state.objectUrls = [];
    state.isLoading = false;

    els.description.value = '';
    els.material.value = '';
    els.pieceType.value = '';
    els.charCount.textContent = '0 / 1000';
    els.previewStrip.innerHTML = '';
    els.renderFront.src = '';
    els.renderSide.src = '';
    els.renderPerspective.src = '';

    hideFormError();
    validateForm();
    showSection('form');
  }

  // ─── Event Wiring ─────────────────────────────────────────────────────────────

  els.getQuoteBtn.addEventListener('click', requestQuote);
  els.startOverBtn.addEventListener('click', resetApp);
  els.retryBtn.addEventListener('click', () => showSection('form'));

  // ─── Init ─────────────────────────────────────────────────────────────────────

  initDropZone();
  validateForm();
  showSection('form');
})();
