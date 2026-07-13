/**
 * Match the original SPA's article DOM: each Markdown h2/h3 is preceded by a
 * zero-height `.toc-anchor` carrying the generated slug id. Inline HTML is not
 * touched. Moving (rather than copying) the id avoids duplicate identifiers.
 */
export default function rehypeHeadingAnchors() {
  return (tree) => {
    function visit(parent) {
      if (!parent?.children) return;
      for (let index = 0; index < parent.children.length; index += 1) {
        const node = parent.children[index];
        if (
          node?.type === 'element' &&
          (node.tagName === 'h2' || node.tagName === 'h3') &&
          typeof node.properties?.id === 'string'
        ) {
          const id = node.properties.id;
          delete node.properties.id;
          parent.children.splice(index, 0, {
            type: 'element',
            tagName: 'div',
            properties: { id, className: ['toc-anchor'] },
            children: [],
          });
          index += 1;
        }
        visit(node);
      }
    }
    visit(tree);
  };
}
