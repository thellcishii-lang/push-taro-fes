// app/api/events/[eventId]/coupons/public/route.test.ts
// 来場者向けクーポンカタログ: 有効（active）なクーポンだけが返り、
// 非公開のクーポンはクライアントに渡らないことを検証する。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEvent: vi.fn(),
  listCoupons: vi.fn(),
}));

vi.mock('@/lib/event-store', () => ({
  getEvent: mocks.getEvent,
}));

vi.mock('@/lib/event-coupon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/event-coupon')>();
  return {
    ...actual,
    listCoupons: mocks.listCoupons,
  };
});

const { GET } = await import('./route');

function request() {
  return new Request('http://localhost/api/events/event-1/coupons/public');
}

function params() {
  return { params: Promise.resolve({ eventId: 'event-1' }) };
}

function coupon(id: string, exhibitorId: string, active = true) {
  return {
    id,
    exhibitorId,
    exhibitorName: `出店者${exhibitorId}`,
    title: `クーポン${id}`,
    description: '',
    titleI18n: {},
    descriptionI18n: {},
    keywords: [],
    active,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getEvent.mockResolvedValue({ id: 'event-1', defaultLocale: 'ja' });
  mocks.listCoupons.mockResolvedValue([
    coupon('c1', 'shop-1'),
    coupon('c2', 'shop-2'),
    coupon('c3', 'shop-1', false),
  ]);
});

describe('GET /api/events/[eventId]/coupons/public', () => {
  it('有効なクーポンだけが返り、非公開のクーポンは返らない', async () => {
    const res = await GET(request(), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.coupons.map((c: { id: string }) => c.id);
    expect(ids).toEqual(['c1', 'c2']); // c3 は非公開
  });
});
