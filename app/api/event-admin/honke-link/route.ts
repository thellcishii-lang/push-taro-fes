// app/api/event-admin/honke-link/route.ts
/**
 * 本家の契約ページ / クーポン購入ページへのハンドオフリンクを発行する。
 *
 * POST { purpose: 'account', eventId? }
 * - ログイン中主催者の契約（organizers の ownerUid 引き）だけを対象にする
 *   （requireEventOwner: 初回パスワード変更ブロック含む）
 * - 共有シークレット HONKE_HANDOFF_SECRET が未設定なら 503 を返し、
 *   クライアントは通常リンク（パスワードログイン）にフォールバックする
 */

import { NextResponse } from 'next/server';
import { getUidFromRequest } from '@/lib/event-auth';
import { findOrganizerByOwnerUid } from '@/lib/organizers';
import {
  buildHonkeHandoffUrl,
  honkeHandoffSecret,
  type HandoffPurpose,
} from '@/lib/honke-handoff';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = honkeHandoffSecret();
  if (!secret) {
    return NextResponse.json({ error: 'not-configured' }, { status: 503 });
  }

  let purpose: unknown;
  let eventId: unknown;
  try {
    const body = await request.json();
    purpose = body?.purpose;
    eventId = body?.eventId;
  } catch {
    return NextResponse.json({ error: 'リクエストが不正です' }, { status: 400 });
  }
  if (purpose !== 'account') {
    return NextResponse.json({ error: 'purpose が不正です' }, { status: 400 });
  }

  const uid = await getUidFromRequest(request);
  if (!uid) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  const organizer = await findOrganizerByOwnerUid(uid);
  if (!organizer) {
    return NextResponse.json({ error: '契約が見つかりません' }, { status: 404 });
  }

  const url = buildHonkeHandoffUrl(
    {
      contractId: organizer.contractId,
      purpose: purpose as HandoffPurpose,
      eventId: typeof eventId === 'string' ? eventId : undefined,
    },
    secret,
    Math.floor(Date.now() / 1000)
  );
  return NextResponse.json({ url });
}
