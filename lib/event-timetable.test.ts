import { describe, expect, it } from 'vitest';
import {
  isSignificantTimetableChange,
  sortTimetableEntries,
  timetableChangeNotice,
  timetableDates,
  timetableStages,
  validateTimetableInput,
  type TimetableEntry,
} from './event-timetable';

const entry = (overrides: Partial<TimetableEntry> = {}): TimetableEntry => ({
  id: 'e1',
  date: '2026-08-01',
  stage: 'メインステージ',
  startTime: '12:00',
  endTime: '12:40',
  title: 'テストバンド',
  note: '',
  changedAt: null,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

describe('validateTimetableInput', () => {
  const valid = {
    date: '2026-08-01',
    stage: 'メインステージ',
    startTime: '12:00',
    endTime: '12:40',
    title: 'テストバンド',
  };
  it('正しい入力は null', () => {
    expect(validateTimetableInput(valid)).toBeNull();
  });
  it('日付の形式が違うとエラー', () => {
    expect(validateTimetableInput({ ...valid, date: '2026/08/01' })).toBeTruthy();
  });
  it('終了が開始以前だとエラー', () => {
    expect(validateTimetableInput({ ...valid, endTime: '12:00' })).toBeTruthy();
    expect(validateTimetableInput({ ...valid, endTime: '11:00' })).toBeTruthy();
  });
  it('ステージ名とタイトルは必須', () => {
    expect(validateTimetableInput({ ...valid, stage: ' ' })).toBeTruthy();
    expect(validateTimetableInput({ ...valid, title: '' })).toBeTruthy();
  });
  it('時刻の形式が違うとエラー', () => {
    expect(validateTimetableInput({ ...valid, startTime: '9:00' })).toBeTruthy();
    expect(validateTimetableInput({ ...valid, startTime: '24:00' })).toBeTruthy();
  });
});

describe('sortTimetableEntries / stages / dates', () => {
  const entries = [
    entry({ id: 'a', date: '2026-08-02', stage: 'サブステージ', startTime: '10:00' }),
    entry({ id: 'b', date: '2026-08-01', stage: 'メインステージ', startTime: '13:00' }),
    entry({ id: 'c', date: '2026-08-01', stage: 'メインステージ', startTime: '11:00' }),
    entry({ id: 'd', date: '2026-08-01', stage: 'サブステージ', startTime: '09:00' }),
  ];
  it('日付→ステージ→開始時刻の順に並ぶ', () => {
    expect(sortTimetableEntries(entries).map((e) => e.id)).toEqual(['d', 'c', 'b', 'a']);
  });
  it('ステージ一覧は並び順どおり重複なし', () => {
    expect(timetableStages(entries)).toEqual(['サブステージ', 'メインステージ']);
  });
  it('日付一覧は昇順で重複なし', () => {
    expect(timetableDates(entries)).toEqual(['2026-08-01', '2026-08-02']);
  });
});

describe('isSignificantTimetableChange', () => {
  const before = entry();
  it('時刻の変更は変更フラグ対象', () => {
    expect(isSignificantTimetableChange(before, { startTime: '12:30' })).toBe(true);
    expect(isSignificantTimetableChange(before, { endTime: '13:00' })).toBe(true);
  });
  it('ステージ・タイトル・日付の変更も対象', () => {
    expect(isSignificantTimetableChange(before, { stage: 'サブステージ' })).toBe(true);
    expect(isSignificantTimetableChange(before, { title: '別バンド' })).toBe(true);
    expect(isSignificantTimetableChange(before, { date: '2026-08-02' })).toBe(true);
  });
  it('補足だけの変更は対象外', () => {
    expect(isSignificantTimetableChange(before, { note: '雨天時は屋内' })).toBe(false);
  });
  it('同じ値なら対象外', () => {
    expect(isSignificantTimetableChange(before, { startTime: '12:00' })).toBe(false);
  });
});

describe('timetableChangeNotice', () => {
  it('日付・時刻・ステージ・タイトルを含む', () => {
    const notice = timetableChangeNotice(entry());
    expect(notice.title).toContain('タイムテーブル変更');
    expect(notice.body).toContain('08/01');
    expect(notice.body).toContain('12:00');
    expect(notice.body).toContain('メインステージ');
    expect(notice.body).toContain('テストバンド');
  });
});
