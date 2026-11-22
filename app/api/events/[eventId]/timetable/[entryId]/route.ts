// app/api/events/[eventId]/timetable/[entryId]/route.ts
// タイムテーブル: 主催者向けの編集と削除。
// 時刻・ステージ・タイトル・日付の変更は「変更されました」フラグを立てる。
import { NextResponse } from 'next/server';
import { requireEventOwner } from '@/lib/event-auth';
import {
  deleteTimetableEntry,
  updateTimetableEntry,
  type TimetableEntryInput,
} from '@/lib/event-timetable';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; entryId: string }> },
) {
  const { eventId, entryId } = await params;
  const guard = await requireEventOwner(request, eventId);
  if ('error' in guard) return guard.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 });
  }
  const patch: Partial<TimetableEntryInput> = {};
  for (const key of ['date', 'stage', 'startTime', 'endTime', 'title', 'note'] as const) {
    if (typeof body[key] === 'string') patch[key] = body[key] as string;
  }
  try {
    const entry = await updateTimetableEntry(eventId, entryId, patch);
    if (!entry) {
      return NextResponse.json({ error: '予定が見つかりません' }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新に失敗しました' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string; entryId: string }> },
) {
  const { eventId, entryId } = await params;
  const guard = await requireEventOwner(request, eventId);
  if ('error' in guard) return guard.error;

  const deleted = await deleteTimetableEntry(eventId, entryId);
  if (!deleted) {
    return NextResponse.json({ error: '予定が見つかりません' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
