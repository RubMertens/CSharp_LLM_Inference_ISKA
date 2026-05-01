import { loadAllSlides } from './loader.js';

class PresentationEngine {
  #slides = [];
  #currentIndex = 0;
  #container = null;
  #progressBar = null;
  #slideCounter = null;
  #wheelCooldown = false;

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

    const highestIndex = this.#highestFragmentIndex(visible);

    const toHide = highestIndex === null
      ? [visible[visible.length - 1]]
      : visible.filter(f => f.dataset.fragmentIndex === highestIndex);

    toHide.forEach(f => {
      f.classList.remove('fragment-visible');
      f.classList.add('fragment-hidden');
    });

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

    this.#slides.forEach((slide, i) => {
      const thumb = document.createElement('button');
      thumb.className = 'slide-overview-item';
      if (i === this.#currentIndex) thumb.classList.add('current');
      thumb.textContent = `${i + 1}. ${slide.title ?? slide.id}`;
      thumb.addEventListener('click', () => { overview.remove(); this.goTo(i); });
      overview.appendChild(thumb);
    });

    document.body.appendChild(overview);
  }
}

const engine = new PresentationEngine();
await engine.init();

export { engine };
