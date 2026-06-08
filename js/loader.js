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
    html: section.innerHTML,
  };
}

export async function loadAllSlides() {
  const paths = await loadManifest();
  return Promise.all(paths.map(loadSlide));
}
