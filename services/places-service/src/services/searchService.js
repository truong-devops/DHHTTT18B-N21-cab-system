const { normalizeText } = require('../utils/normalize');
const { searchCatalog } = require('../providers/localCatalogProvider');

function dedupeByLabel(items, limit) {
  const unique = [];
  const seen = new Set();

  items.forEach((item) => {
    const key = normalizeText(item?.label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });

  return unique.slice(0, limit);
}

function createSearchService({ externalProvider, localSearch = searchCatalog }) {
  async function search(params) {
    const limit = params.limit;
    const localItems = localSearch(params);

    if (!externalProvider) {
      return localItems.slice(0, limit);
    }

    const externalItems = await externalProvider.search(params);
    return dedupeByLabel([...externalItems, ...localItems], limit);
  }

  return { search };
}

module.exports = { createSearchService, dedupeByLabel };
