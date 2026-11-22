// app/api/events/[eventId]/timetable/[entryId]/notify/route.ts
// タイムテーブルの変更を来場者へプッシュで知らせる（即時配信）。
// 文面は予定から自動生成し、通常の配信と同じ仕組み（言語別トピック）で送る。
import { NextResponse } from 'next/server';
import { requireEventOwner } from '@/lib/event-auth';
import { getTimetableEntry, timetableChangeNotice } from '@/lib/event-timetable';
import {
  createCampaignRecord,
  executeCampaign,
  getCampaign,
  jstDateTimeString,
} from '@/lib/event-push';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string; entryId: string }> },
) {
  const { eventId, entryId } = await params;
  const guard = await requireEventOwner(request, eventId);
  if ('error' in guard) return guard.error;

  const entry = await getTimetableEntry(eventId, entryId);
  if (!entry) {
    return NextResponse.json({ error: '予定が見つかりません' }, { status: 404 });
  }
  const notice = timetableChangeNotice(entry);
  try {
    const campaign = await createCampaignRecord(eventId, {
      title: notice.title,
      body: notice.body,
      kind: 'instant',
      scheduledAt: jstDateTimeString(new Date()),
      ownerUid: guard.uid,
    });
    const result = await executeCampaign(eventId, campaign.id);
    const executed = await getCampaign(eventId, campaign.id);
    if (!result.sent) {
      return NextResponse.json(
        { error: `配信に失敗しました: ${result.reason}`, campaign: executed },
        { status: 502 },
      );
    }
    return NextResponse.json({ campaign: executed }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '配信に失敗しました' },
      { status: 400 },
    );
  }
}
