import { getConfiguredProvider, searchImages } from '@/lib/server/image-search';

describe('image search provider adapter', () => {
  const original = process.env;
  beforeEach(() => { process.env = { ...original }; delete process.env.PEXELS_API_KEY; delete process.env.PIXABAY_API_KEY; });
  afterAll(() => { process.env = original; });

  it('reports a setup state when no provider key is configured', async () => {
    process.env.IMAGE_SEARCH_PROVIDER = 'pexels';
    expect(getConfiguredProvider()).toEqual({ provider: 'pexels', key: undefined });
    await expect(searchImages('flowers')).resolves.toMatchObject({ configured: false, results: [] });
  });

  it('uses Pixabay when explicitly configured', () => {
    process.env.IMAGE_SEARCH_PROVIDER = 'pixabay';
    process.env.PIXABAY_API_KEY = 'test-key';
    expect(getConfiguredProvider()).toEqual({ provider: 'pixabay', key: 'test-key' });
  });
});
