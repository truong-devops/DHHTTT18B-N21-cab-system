const request = require('supertest');
const { createApp } = require('../src/app');

function createInMemoryRecentRepository() {
  const state = new Map();

  return {
    async listByUser(userId, limit) {
      const items = state.get(userId) || [];
      return items.slice(0, limit);
    },
    async upsertByUser(userId, payload) {
      const current = state.get(userId) || [];
      const deduped = current.filter((item) => item.label.toLowerCase() !== payload.label.toLowerCase());
      state.set(userId, [payload, ...deduped].slice(0, 20));
    }
  };
}

describe('places-service routes', () => {
  it('returns autocomplete items from search service', async () => {
    const searchService = {
      search: jest.fn().mockResolvedValue([
        {
          id: 'p-1',
          label: 'Cho Ben Thanh',
          address: 'Le Loi, District 1, Ho Chi Minh',
          lat: 10.77,
          lng: 106.69
        }
      ])
    };
    const app = createApp({
      searchService,
      recentRepository: createInMemoryRecentRepository(),
      defaultLimit: 8,
      maxLimit: 20
    });

    const response = await request(app).get('/v1/places/autocomplete').query({ q: 'ben', limit: 5 });

    expect(response.status).toBe(200);
    expect(searchService.search).toHaveBeenCalledWith({
      query: 'ben',
      limit: 5,
      lat: null,
      lng: null
    });
    expect(response.body.data.items[0].label).toBe('Cho Ben Thanh');
    expect(response.body.data.items[0].location).toEqual({ lat: 10.77, lng: 106.69 });
  });

  it('validates recent payload label', async () => {
    const app = createApp({
      searchService: { search: jest.fn().mockResolvedValue([]) },
      recentRepository: createInMemoryRecentRepository(),
      defaultLimit: 8,
      maxLimit: 20
    });

    const response = await request(app).post('/v1/places/recent').send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('stores and retrieves recents by user id', async () => {
    const app = createApp({
      searchService: { search: jest.fn().mockResolvedValue([]) },
      recentRepository: createInMemoryRecentRepository(),
      defaultLimit: 8,
      maxLimit: 20
    });

    const saveResponse = await request(app)
      .post('/v1/places/recent')
      .set('x-user-id', 'user-123')
      .send({
        label: 'Landmark 81',
        address: 'Vinhomes Central Park, Binh Thanh, Ho Chi Minh',
        location: { lat: 10.79, lng: 106.72 }
      });

    expect(saveResponse.status).toBe(201);
    expect(saveResponse.body.ok).toBe(true);

    const listResponse = await request(app).get('/v1/places/recent').set('x-user-id', 'user-123');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items[0].label).toBe('Landmark 81');
    expect(listResponse.body.data.items[0].location).toEqual({ lat: 10.79, lng: 106.72 });
  });
});
