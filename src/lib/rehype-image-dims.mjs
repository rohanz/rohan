// Article images are below the header, so they load lazily and decode off the
// main thread; their intrinsic width/height are filled in from the file so the
// browser reserves the space before the pixels arrive (CSS keeps height: auto).
// Runs after rehype-root-assets, which makes local paths root-relative.
import { resolve } from 'node:path';
import sharp from 'sharp';

const cache = new Map();

function dimensions(src) {
  if (!cache.has(src)) {
    cache.set(src, sharp(resolve('public', `.${src.split(/[?#]/)[0]}`)).metadata()
      .then(({ width, height }) => (width && height ? { width, height } : null))
      .catch(() => null));
  }
  return cache.get(src);
}

export default function rehypeImageDims() {
  return async function transform(tree) {
    const images = [];
    const visit = (node) => {
      if (node?.type === 'element' && node.tagName === 'img') images.push(node);
      node?.children?.forEach(visit);
    };
    visit(tree);
    await Promise.all(images.map(async (img) => {
      const props = img.properties;
      props.loading ??= 'lazy';
      props.decoding ??= 'async';
      if (typeof props.src !== 'string' || !props.src.startsWith('/') || (props.width && props.height)) return;
      const size = await dimensions(props.src);
      if (size) { props.width = size.width; props.height = size.height; }
    }));
  };
}
