import { describe, expect, it } from 'vitest';
import {
  normalizeEventPins,
  normalizeVenueMap,
  parseEventPins,
  parseVenueMap,
} from './event';

describe('normalizeVenueMap', () => {
  it('未指定は null', () => {
    expect(normalizeVenueMap(undefined)).toBeNull();
    expect(normalizeVenueMap(null)).toBeNull();
  });
  it('座標とズームを保持し、ズームは 1〜19 に収める', () => {
    expect(normalizeVenueMap({ lat: 35.6, lng: 139.7, zoom: 16 })).toEqual({
      lat: 35.6,
      lng: 139.7,
      zoom: 16,
    });
    expect(normalizeVenueMap({ lat: 35.6, lng: 139.7, zoom: 30 })?.zoom).toBe(19);
    expect(normalizeVenueMap({ lat: 35.6, lng: 139.7 })?.zoom).toBe(16);
  });
  it('座標が範囲外ならエラー', () => {
    expect(() => normalizeVenueMap({ lat: 91, lng: 139 })).toThrow();
    expect(() => normalizeVenueMap({ lat: 35, lng: 181 })).toThrow();
    expect(() => normalizeVenueMap({ lat: '35', lng: 139 })).toThrow();
  });
});

describe('parseVenueMap', () => {
  it('不正な値は null', () => {
    expect(parseVenueMap(undefined)).toBeNull();
    expect(parseVenueMap({ lat: 999, lng: 0 })).toBeNull();
    expect(parseVenueMap('x')).toBeNull();
  });
});

describe('normalizeEventPins', () => {
  it('ラベル空のピンは読み飛ばす', () => {
    expect(
      normalizeEventPins([
        { label: 'メインステージ', lat: 35.6, lng: 139.7 },
        { label: ' ', lat: 35.6, lng: 139.7 },
      ]),
    ).toHaveLength(1);
  });
  it('id は保持し、無いものには振る', () => {
    const pins = normalizeEventPins([
      { id: 'stage-1', label: 'A', lat: 35, lng: 139 },
      { label: 'B', lat: 35, lng: 139 },
    ]);
    expect(pins[0].id).toBe('stage-1');
    expect(pins[1].id).toMatch(/^pin/);
  });
  it('座標が不正なピンはエラー', () => {
    expect(() =>
      normalizeEventPins([{ label: 'A', lat: 123, lng: 139 }]),
    ).toThrow();
  });
  it('31件以上はエラー', () => {
    const items = Array.from({ length: 31 }, (_, i) => ({
      label: `p${i}`,
      lat: 35,
      lng: 139,
    }));
    expect(() => normalizeEventPins(items)).toThrow(/最大30件/);
  });
});

describe('parseEventPins', () => {
  it('不正な要素は落とす', () => {
    expect(
      parseEventPins([
        { id: 'a', label: 'A', lat: 35, lng: 139 },
        { id: 'b', label: 'B', lat: 999, lng: 139 },
        { label: 'C', lat: 35, lng: 139 },
      ]),
    ).toEqual([{ id: 'a', label: 'A', lat: 35, lng: 139 }]);
  });
});
