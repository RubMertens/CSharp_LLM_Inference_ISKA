export async function loadManifest() {
  const res = await fetch('slides.json');
  return res.json();
}

export async function loadSlide(path) {
  const res = await fetch(path);
  const text = await res.text();

  const doc = new DOMParser().parseFromString(text, 'text/html');
  const section = doc.querySelector('section[data-id]');

  if (!section) {
    throw new Error(`Slide ${path} missing <section data-id="..."> wrapper`);
  }

  return {
    id: section.dataset.id,
    title: section.dataset.title ?? section.dataset.id,
    // Only the section's innerHTML is rendered, so anything on the wrapper
    // itself has to be carried across explicitly. `layout` is a space-
    // separated list of layout hints (e.g. "isks-dark isks-bare") that the
    // engine copies onto the .slide element for CSS to key off.
    layout: section.dataset.layout ?? '',
    cls: section.className ?? '',
    html: section.innerHTML,
  };
}

export async function loadAllSlides() {
  const paths = await loadManifest();
  return Promise.all(paths.map(loadSlide));
}
