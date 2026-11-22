// app/api/events/[eventId]/timetable/route.ts
// タイムテーブル: 来場者向け取得（認証なし）と主催者向け登録。
import { NextResponse } from 'next/server';
import { requireEventOwner } from '@/lib/event-auth';
import {
  createTimetableEntry,
  listTimetableEntries,
  type TimetableEntryInput,
} from '@/lib/event-timetable';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const entries = await listTimetableEntries(eventId);
  return NextResponse.json({ entries });
}

function readInput(body: Record<string, unknown>): TimetableEntryInput {
  return {
    date: typeof body.date === 'string' ? body.date : '',
    stage: typeof body.stage === 'string' ? body.stage : '',
    startTime: typeof body.startTime === 'string' ? body.startTime : '',
    endTime: typeof body.endTime === 'string' ? body.endTime : '',
    title: typeof body.title === 'string' ? body.title : '',
    note: typeof body.note === 'string' ? body.note : '',
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const guard = await requireEventOwner(request, eventId);
  if ('error' in guard) return guard.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 });
  }
  try {
    const entry = await createTimetableEntry(eventId, readInput(body));
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '登録に失敗しました' },
      { status: 400 },
    );
  }
}
