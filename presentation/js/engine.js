import { loadAllSlides } from './loader.js';

class PresentationEngine {
  #slides = [];
  #currentIndex = 0;
  #container = null;
  #progressBar = null;
  #slideCounter = null;
  #wheelCooldown = false;
  #touchStartX = 0;
  #touchStartY = 0;
  #touchTracking = false;

  async init() {
    this.#container = document.getElementById('presentation');
    this.#progressBar = document.getElementById('progress');
    this.#slideCounter = document.getElementById('slide-counter');

    try {
      this.#slides = await loadAllSlides();
    } catch (err) {
      this.#container.innerHTML = `
        <div class="error">
          <h2>Could not load slides</h2>
          <p>${err.message}</p>
          <p style="margin-top: 1rem;">Start a local server:</p>
          <pre><code>python3 -m http.server 8000</code></pre>
        </div>`;
      return;
    }

    this.#bindKeys();
    this.#bindWheel();
    this.#bindTouch();
    this.#bindHash();

    const hash = location.hash.slice(1);
    const startIndex = hash
      ? this.#slides.findIndex(s => s.id === hash)
      : 0;
    this.goTo(Math.max(startIndex, 0));
  }

  goTo(index, { revealFragments = false } = {}) {
    if (index < 0 || index >= this.#slides.length) return;

    const direction = index >= this.#currentIndex ? 'right' : 'left';

    this.#container.querySelectorAll('.slide:not(.active)').forEach(s => s.remove());
    const prev = this.#container.querySelector('.slide.active');

    this.#currentIndex = index;
    location.hash = this.#slides[index].id;

    const el = document.createElement('div');
    el.className = `slide slide-enter-${direction}`;
    el.innerHTML = this.#slides[index].html;

    el.querySelectorAll('.speaker-notes').forEach(n => n.hidden = true);
    if (revealFragments) {
      el.querySelectorAll('.fragment').forEach(f => {
        f.classList.remove('fragment-hidden');
        f.classList.add('fragment-visible');
      });
      const cv = [...el.querySelectorAll('.fragment.current-visible')];
      if (cv.length > 0) {
        const highest = this.#highestFragmentIndex(cv);
        cv.forEach(f => {
          if (f.dataset.fragmentIndex !== highest) {
            f.classList.remove('fragment-visible');
            f.classList.add('fragment-hidden');
          }
        });
      }
    } else {
      el.querySelectorAll('.fragment').forEach(f => f.classList.add('fragment-hidden'));
    }

    if (prev) {
      prev.classList.remove('active');
      prev.classList.add(`slide-${direction === 'right' ? 'left' : 'right'}`);
      prev.addEventListener('transitionend', () => prev.remove(), { once: true });
      setTimeout(() => prev.remove(), 600);
    }

    this.#container.appendChild(el);
    requestAnimationFrame(() => {
      el.classList.remove(`slide-enter-${direction}`);
      el.classList.add('active');
    });

    if (typeof hljs !== 'undefined') {
      el.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }

    this.#updateProgress();
  }

  #updateProgress() {
    const total = this.#slides.length;
    const pct = total > 1 ? (this.#currentIndex / (total - 1)) * 100 : 100;
    if (this.#progressBar) this.#progressBar.style.width = `${pct}%`;
    if (this.#slideCounter) this.#slideCounter.textContent = `${this.#currentIndex + 1} / ${total}`;
  }

  #revealNextFragment() {
    const slide = this.#container.querySelector('.slide.active');
    if (!slide) return false;

    // Only persistent fragments drive progression — current-visible get re-hidden each step
    const hidden = [...slide.querySelectorAll('.fragment.fragment-hidden:not(.current-visible)')];
    if (hidden.length === 0) return false;

    const nextIndex = this.#lowestFragmentIndex(hidden);

    // Reveal all fragments at nextIndex (including current-visible ones)
    const allHidden = [...slide.querySelectorAll('.fragment.fragment-hidden')];
    const toReveal = nextIndex === null
      ? [hidden[0]]
      : allHidden.filter(f => f.dataset.fragmentIndex === nextIndex);

    // Hide current-visible fragments from previous indices
    slide.querySelectorAll('.fragment.fragment-visible.current-visible').forEach(f => {
      f.classList.remove('fragment-visible');
      f.classList.add('fragment-hidden');
    });

    toReveal.forEach(f => {
      f.classList.remove('fragment-hidden');
      f.classList.add('fragment-visible');
    });

    return true;
  }

  #hideLastFragment() {
    const slide = this.#container.querySelector('.slide.active');
    if (!slide) return false;
    const visible = [...slide.querySelectorAll('.fragment.fragment-visible')];
    if (visible.length === 0) return false;

    // Unindexed fragments were revealed last, so hide them first
    const unindexed = visible.filter(f => !f.dataset.fragmentIndex);
    if (unindexed.length > 0) {
      const last = unindexed[unindexed.length - 1];
      last.classList.remove('fragment-visible');
      last.classList.add('fragment-hidden');
    } else {
      const highestIndex = this.#highestFragmentIndex(visible);
      const toHide = highestIndex === null
        ? [visible[visible.length - 1]]
        : visible.filter(f => f.dataset.fragmentIndex === highestIndex);
      toHide.forEach(f => {
        f.classList.remove('fragment-visible');
        f.classList.add('fragment-hidden');
      });
    }

    // Re-show current-visible fragments at the new highest visible index
    const stillVisible = [...slide.querySelectorAll('.fragment.fragment-visible')];
    if (stillVisible.length > 0) {
      const prevIndex = this.#highestFragmentIndex(stillVisible);
      if (prevIndex !== null) {
        slide.querySelectorAll(`.fragment.fragment-hidden.current-visible[data-fragment-index="${prevIndex}"]`).forEach(f => {
          f.classList.remove('fragment-hidden');
          f.classList.add('fragment-visible');
        });
      }
    }

    return true;
  }

  #lowestFragmentIndex(fragments) {
    let lowest = null;
    for (const f of fragments) {
      const idx = f.dataset.fragmentIndex;
      if (idx !== undefined) {
        const n = Number(idx);
        if (lowest === null || n < Number(lowest)) lowest = idx;
      }
    }
    return lowest;
  }

  #highestFragmentIndex(fragments) {
    let highest = null;
    for (const f of fragments) {
      const idx = f.dataset.fragmentIndex;
      if (idx !== undefined) {
        const n = Number(idx);
        if (highest === null || n > Number(highest)) highest = idx;
      }
    }
    return highest;
  }

  next() {
    if (!this.#revealNextFragment()) {
      this.goTo(this.#currentIndex + 1);
    }
  }

  prev() {
    if (!this.#hideLastFragment()) {
      this.goTo(this.#currentIndex - 1, { revealFragments: true });
    }
  }

  getCurrentSlide() {
    return { index: this.#currentIndex, slide: this.#slides[this.#currentIndex] ?? null };
  }

  #bindKeys() {
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          this.next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          this.prev();
          break;
        case 'Escape':
          e.preventDefault();
          this.#toggleOverview();
          break;
      }
    });
  }

  #bindWheel() {
    document.addEventListener('wheel', (e) => {
      if (this.#wheelCooldown) return;
      e.preventDefault();
      this.#wheelCooldown = true;
      setTimeout(() => { this.#wheelCooldown = false; }, 300);
      if (e.deltaY > 0) this.next();
      else if (e.deltaY < 0) this.prev();
    }, { passive: false });
  }

  #bindTouch() {
    const SWIPE_THRESHOLD = 50;   // min horizontal distance (px) to count as swipe
    const HORIZONTAL_RATIO = 1.5; // horizontal travel must dominate vertical

    document.addEventListener('touchstart', (e) => {
      // Ignore multi-touch (pinch/zoom) and swipes while overview is open
      if (e.touches.length !== 1 || document.querySelector('.slide-overview')) {
        this.#touchTracking = false;
        return;
      }
      this.#touchTracking = true;
      this.#touchStartX = e.touches[0].clientX;
      this.#touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!this.#touchTracking) return;
      this.#touchTracking = false;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - this.#touchStartX;
      const dy = touch.clientY - this.#touchStartY;

      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return; // mostly vertical, let it scroll

      if (dx < 0) this.next();  // swipe left → forward
      else this.prev();         // swipe right → back
    }, { passive: true });
  }

  #bindHash() {
    window.addEventListener('hashchange', () => {
      const id = location.hash.slice(1);
      const idx = this.#slides.findIndex(s => s.id === id);
      if (idx >= 0 && idx !== this.#currentIndex) {
        this.goTo(idx);
      }
    });
  }

  #toggleOverview() {
    const existing = document.querySelector('.slide-overview');
    if (existing) { existing.remove(); return; }

    const overview = document.createElement('div');
    overview.className = 'slide-overview';
    document.body.appendChild(overview);

    const SLIDE_W = 1280;
    const SLIDE_H = 720;

    this.#slides.forEach((slide, i) => {
      const item = document.createElement('div');
      item.className = 'slide-overview-item';
      if (i === this.#currentIndex) item.classList.add('current');

      const inner = document.createElement('div');
      inner.className = 'slide';
      inner.innerHTML = slide.html;

      inner.querySelectorAll('.speaker-notes').forEach(n => n.hidden = true);
      inner.querySelectorAll('.fragment').forEach(f => {
        f.classList.remove('fragment-hidden');
        f.classList.add('fragment-visible');
      });

      inner.style.width = `${SLIDE_W}px`;
      inner.style.height = `${SLIDE_H}px`;
      inner.style.pointerEvents = 'none';

      item.appendChild(inner);
      item.addEventListener('click', () => { overview.remove(); this.goTo(i); });
      overview.appendChild(item);
    });

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const items = [...overview.querySelectorAll('.slide-overview-item')];
      const widths = items.map(el => el.getBoundingClientRect().width);
      items.forEach((el, i) => {
        el.style.height = `${widths[i] * 9 / 16}px`;
        const inner = el.querySelector('.slide');
        if (inner) inner.style.transform = `scale(${widths[i] / SLIDE_W})`;
      });
    }));
  }
}

const engine = new PresentationEngine();
await engine.init();

export { engine };
