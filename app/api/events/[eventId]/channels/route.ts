// app/api/events/[eventId]/channels/route.ts
// 配信チャンネル（セグメント）: 来場者本人の選択の取得と変更。
// 認証は端末（匿名認証 uid → memberId）。選択は購読者レコードに保存し、
// チャンネル別 FCM トピックの付け替えも同時に行う。
import { NextResponse } from 'next/server';
import { memberIdFromRequest } from '@/lib/event-member-auth';
import {
  getSubscriberChannels,
  updateSubscriberChannels,
} from '@/lib/event-register';
import { getEvent } from '@/lib/event-store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const auth = await memberIdFromRequest(request);
  if ('error' in auth) return auth.error;
  const event = await getEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
  }
  const selected = await getSubscriberChannels(eventId, auth.memberId);
  return NextResponse.json({ channels: event.channels, selected });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const auth = await memberIdFromRequest(request);
  if ('error' in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 });
  }
  const channelIds = Array.isArray(body.channelIds)
    ? body.channelIds.filter((id): id is string => typeof id === 'string')
    : [];
  const result = await updateSubscriberChannels(eventId, auth.memberId, channelIds);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ selected: result.channels });
}
