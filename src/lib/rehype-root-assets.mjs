import rehypeRaw from 'rehype-raw';

const ROOT_ASSET_PREFIX = /^(?:assets|downloads|docs)\//;
const SRCSET_ASSET_PREFIX = /(^|,\s*)((?:assets|downloads|docs)\/)/g;

function rootAssetPath(value) {
  return typeof value === 'string' && ROOT_ASSET_PREFIX.test(value) ? `/${value}` : value;
}

function rootAssetSrcset(value) {
  return typeof value === 'string'
    ? value.replace(SRCSET_ASSET_PREFIX, '$1/$2')
    : value;
}

export default function rehypeRootAssets() {
  const parseRawHtml = rehypeRaw();

  return function transform(tree, file) {
    // Astro runs custom rehype plugins before its own rehype-raw pass. Parse raw
    // article HTML here so attributes on both Markdown images and literal HTML
    // elements go through the same normalization below.
    const parsedTree = parseRawHtml(tree, file) ?? tree;

    const rewrittenImagePaths = new Set();
    const visit = (node) => {
      if (node?.type === 'element' && node.properties) {
        const originalSrc = node.properties.src;
        node.properties.src = rootAssetPath(originalSrc);
        if (node.properties.src !== originalSrc) rewrittenImagePaths.add(originalSrc);
        node.properties.href = rootAssetPath(node.properties.href);

        if ('srcset' in node.properties) {
          node.properties.srcset = rootAssetSrcset(node.properties.srcset);
        }
        if ('srcSet' in node.properties) {
          node.properties.srcSet = rootAssetSrcset(node.properties.srcSet);
        }
      }

      if (Array.isArray(node?.children)) node.children.forEach(visit);
    };

    visit(parsedTree);

    // Astro collected Markdown image imports before rehype ran. Remove only the
    // paths normalized above so public/ assets are emitted as root URLs instead
    // of being resolved as files beside the content source.
    const astroData = file?.data?.astro;
    if (Array.isArray(astroData?.localImagePaths)) {
      astroData.localImagePaths = astroData.localImagePaths.filter(
        (path) => !rewrittenImagePaths.has(path),
      );
    }

    return parsedTree;
  };
}
