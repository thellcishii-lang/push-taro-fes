import { describe, expect, it } from 'vitest';
import {
  channelTopic,
  normalizeEventChannels,
  parseEventChannels,
} from './event';

describe('channelTopic', () => {
  it('イベント・チャンネル・言語を含む', () => {
    expect(channelTopic('ev1', 'chA', 'ja')).toBe('event_ev1_ch_chA_ja');
  });
});

describe('normalizeEventChannels', () => {
  it('未指定は空配列', () => {
    expect(normalizeEventChannels(undefined)).toEqual([]);
    expect(normalizeEventChannels(null)).toEqual([]);
  });
  it('名前が空の枠は読み飛ばす（空欄は作られない）', () => {
    expect(
      normalizeEventChannels([{ name: 'メインステージ' }, { name: ' ' }, { name: '' }]),
    ).toHaveLength(1);
  });
  it('id は保持し、無いものには振る', () => {
    const result = normalizeEventChannels([
      { id: 'stage-main', name: 'メインステージ' },
      { name: '物販エリア' },
    ]);
    expect(result[0].id).toBe('stage-main');
    expect(result[1].id).toMatch(/^ch/);
    expect(result[1].name).toBe('物販エリア');
  });
  it('重複 id は振り直す', () => {
    const result = normalizeEventChannels([
      { id: 'same', name: 'A' },
      { id: 'same', name: 'B' },
    ]);
    expect(result[0].id).toBe('same');
    expect(result[1].id).not.toBe('same');
  });
  it('11件以上はエラー', () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ name: `ch${i}` }));
    expect(() => normalizeEventChannels(items)).toThrow(/最大10件/);
  });
  it('名前が長すぎるとエラー', () => {
    expect(() => normalizeEventChannels([{ name: 'あ'.repeat(51) }])).toThrow(
      /50文字/,
    );
  });
  it('配列でないとエラー', () => {
    expect(() => normalizeEventChannels('x')).toThrow();
  });
});

describe('parseEventChannels', () => {
  it('不正な要素は落とす', () => {
    expect(
      parseEventChannels([
        { id: 'a', name: 'A' },
        { id: '', name: 'B' },
        { name: 'C' },
        'junk',
        { id: 'a', name: '重複' },
      ]),
    ).toEqual([{ id: 'a', name: 'A' }]);
  });
  it('配列でなければ空配列', () => {
    expect(parseEventChannels(undefined)).toEqual([]);
    expect(parseEventChannels('x')).toEqual([]);
  });
});
