// lib/event-timetable.ts
// FES のタイムテーブル（ステージ別の進行表）。
// 主催者が日付・ステージ・開始/終了時刻・タイトル・補足を登録し、
// 来場者画面にそのまま出す。登録済みの予定を編集すると「変更されました」
// フラグ（changedAt）が立ち、来場者に分かるようにする＋プッシュで知らせる。
// データは events/{eventId}/timetable サブコレクション。個人情報は持たない。
// 日次リセットの対象外（会期中ずっと使う）。終了処理でまとめて消す。
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { EVENT_SUBCOLLECTIONS } from './event';

export const TIMETABLE_COLLECTION = EVENT_SUBCOLLECTIONS.timetable;

export interface TimetableEntry {
  id: string;
  /** 開催日（JST, 'YYYY-MM-DD'） */
  date: string;
  /** ステージ名（自由入力。来場者画面のタブになる） */
  stage: string;
  /** 開始時刻（'HH:MM'） */
  startTime: string;
  /** 終了時刻（'HH:MM'、開始より後） */
  endTime: string;
  /** 出演者名・催し名 */
  title: string;
  /** 補足（任意） */
  note: string;
  /** 作成後に編集された時刻（ISO）。未編集なら null */
  changedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableEntryInput {
  date: string;
  stage: string;
  startTime: string;
  endTime: string;
  title: string;
  note?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 入力チェック。問題があればエラーメッセージを返す（純粋関数）。 */
export function validateTimetableInput(input: TimetableEntryInput): string | null {
  if (!DATE_PATTERN.test(input.date)) return '日付の形式が不正です';
  if (!input.stage.trim()) return 'ステージ名が必要です';
  if (!TIME_PATTERN.test(input.startTime)) return '開始時刻の形式が不正です';
  if (!TIME_PATTERN.test(input.endTime)) return '終了時刻の形式が不正です';
  if (input.endTime <= input.startTime) return '終了時刻は開始時刻より後にしてください';
  if (!input.title.trim()) return 'タイトルが必要です';
  return null;
}

/** 並び順: 日付 → ステージ → 開始時刻 → タイトル（純粋関数）。 */
export function sortTimetableEntries(entries: TimetableEntry[]): TimetableEntry[] {
  return [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.stage.localeCompare(b.stage) ||
      a.startTime.localeCompare(b.startTime) ||
      a.title.localeCompare(b.title),
  );
}

/** 予定に現れるステージ名の一覧（並び順は出現順、重複なし・純粋関数）。 */
export function timetableStages(entries: TimetableEntry[]): string[] {
  const seen: string[] = [];
  for (const entry of sortTimetableEntries(entries)) {
    if (!seen.includes(entry.stage)) seen.push(entry.stage);
  }
  return seen;
}

/** 予定に現れる日付の一覧（昇順・重複なし・純粋関数）。 */
export function timetableDates(entries: TimetableEntry[]): string[] {
  return [...new Set(entries.map((e) => e.date))].sort();
}

/**
 * 編集で「変更フラグ」を立てるべきかどうか（純粋関数）。
 * 時刻・ステージ・タイトル・日付が変わったら来場者向けの変更として扱う。
 * 補足（note）だけの修正ではフラグを立てない。
 */
export function isSignificantTimetableChange(
  before: Pick<TimetableEntry, 'date' | 'stage' | 'startTime' | 'endTime' | 'title'>,
  patch: Partial<TimetableEntryInput>,
): boolean {
  return (
    (patch.date !== undefined && patch.date !== before.date) ||
    (patch.stage !== undefined && patch.stage.trim() !== before.stage) ||
    (patch.startTime !== undefined && patch.startTime !== before.startTime) ||
    (patch.endTime !== undefined && patch.endTime !== before.endTime) ||
    (patch.title !== undefined && patch.title.trim() !== before.title)
  );
}

/** 変更通知プッシュの文面（純粋関数）。 */
export function timetableChangeNotice(entry: TimetableEntry): {
  title: string;
  body: string;
} {
  return {
    title: 'タイムテーブル変更のお知らせ',
    body: `${entry.date.slice(5).replace('-', '/')} ${entry.startTime}〜 ${entry.stage}「${entry.title}」の予定が変更されました。最新のタイムテーブルをご確認ください。`,
  };
}

function entriesRef(eventId: string) {
  return db.collection('events').doc(eventId).collection(TIMETABLE_COLLECTION);
}

function toEntry(
  id: string,
  data: FirebaseFirestore.DocumentData,
): TimetableEntry {
  return {
    id,
    date: String(data.date ?? ''),
    stage: String(data.stage ?? ''),
    startTime: String(data.startTime ?? ''),
    endTime: String(data.endTime ?? ''),
    title: String(data.title ?? ''),
    note: String(data.note ?? ''),
    changedAt:
      typeof data.changedAt === 'string' && data.changedAt ? data.changedAt : null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? '',
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? '',
  };
}

export async function listTimetableEntries(
  eventId: string,
): Promise<TimetableEntry[]> {
  const snap = await entriesRef(eventId).get();
  return sortTimetableEntries(snap.docs.map((doc) => toEntry(doc.id, doc.data())));
}

export async function getTimetableEntry(
  eventId: string,
  entryId: string,
): Promise<TimetableEntry | null> {
  const doc = await entriesRef(eventId).doc(entryId).get();
  return doc.exists ? toEntry(doc.id, doc.data()!) : null;
}

export async function createTimetableEntry(
  eventId: string,
  input: TimetableEntryInput,
): Promise<TimetableEntry> {
  const error = validateTimetableInput(input);
  if (error) throw new Error(error);
  const ref = entriesRef(eventId).doc();
  await ref.set({
    date: input.date,
    stage: input.stage.trim(),
    startTime: input.startTime,
    endTime: input.endTime,
    title: input.title.trim(),
    note: (input.note ?? '').trim(),
    changedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const created = await ref.get();
  return toEntry(ref.id, created.data()!);
}

export async function updateTimetableEntry(
  eventId: string,
  entryId: string,
  patch: Partial<TimetableEntryInput>,
  now: Date = new Date(),
): Promise<TimetableEntry | null> {
  const ref = entriesRef(eventId).doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const before = toEntry(snap.id, snap.data()!);
  const merged: Required<TimetableEntryInput> = {
    date: patch.date ?? before.date,
    stage: patch.stage ?? before.stage,
    startTime: patch.startTime ?? before.startTime,
    endTime: patch.endTime ?? before.endTime,
    title: patch.title ?? before.title,
    note: patch.note ?? before.note,
  };
  const error = validateTimetableInput(merged);
  if (error) throw new Error(error);
  const update: Record<string, unknown> = {
    date: merged.date,
    stage: merged.stage.trim(),
    startTime: merged.startTime,
    endTime: merged.endTime,
    title: merged.title.trim(),
    note: merged.note.trim(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (isSignificantTimetableChange(before, patch)) {
    update.changedAt = now.toISOString();
  }
  await ref.update(update);
  const updated = await ref.get();
  return toEntry(entryId, updated.data()!);
}

export async function deleteTimetableEntry(
  eventId: string,
  entryId: string,
): Promise<boolean> {
  const ref = entriesRef(eventId).doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}
