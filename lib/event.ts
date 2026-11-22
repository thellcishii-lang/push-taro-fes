// lib/event.ts
// Push-taro FES のイベント設定モデル（純粋な型・定数・判定ロジックのみ）。
// Firestore への読み書きは lib/event-store.ts に分離する。
//
// 設計原則（干渉しない・波及しない）:
// - イベントごとにデータ名前空間を分ける（events/{eventId} 配下で完結）。
// - リセット等の定期処理は「固定時刻の一括 cron」にせず、
//   15分間隔のスケジューラがイベント単独で拾って実行する前提の判定関数を用意する。

import type { Locale } from './i18n';

/** 日次リセットの方式。イベントごとに選択する。 */
export type EventResetMode =
  /** 方式A: 購読も端末情報も毎日消去する（単日イベント向け） */
  | 'full-daily'
  /** 方式B: 毎日リセットするのは購読のみ。端末情報と取得・消込記録は期間中保持し、終了時に消去する */
  | 'keep-phones';

export type EventStatus = 'draft' | 'live' | 'ended';

/**
 * 主催者リンク（最大3件）。来場者画面にタイトル付きカードで表示される。
 * イベントドキュメントの links フィールドに配列で持つ。
 * タイトルは主催者が書いた原文のまま表示する（案内PDFのタイトルと同じ扱い、
 * 自動翻訳しない）。
 */
export interface EventLink {
  title: string;
  url: string;
}

/**
 * 配信チャンネル（セグメント）。主催者が最大 MAX_EVENT_CHANNELS 件まで作り、
 * 来場者が受け取りたいチャンネルを選ぶ（オプトイン）。全体配信は常に届く。
 * イベントドキュメントの channels フィールドに配列で持つ。id は購読の
 * 紐付けに使うため、名前を変えても変えない。名前は原文のまま表示する。
 */
export interface EventChannel {
  id: string;
  name: string;
}

/**
 * 会場マップの中心（OpenStreetMap 上の座標）。主催者が設定画面で決める。
 * 未設定なら null で、来場者画面に地図は出ない。
 */
export interface EventVenueMap {
  lat: number;
  lng: number;
  zoom: number;
}

/**
 * 会場マップのピン（ステージ・フード・トイレ等の場所）。
 * 主催者が地図をタップして置く。id は名前を変えても変えない。
 */
export interface EventPin {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface EventConfig {
  id: string;
  /** イベント名（例: 展示会名） */
  name: string;
  /** 主催者の Firebase Auth uid */
  ownerUid: string;
  /** 開催開始日（JST, 'YYYY-MM-DD'） */
  startDate: string;
  /** 開催終了日（JST, 'YYYY-MM-DD'）。この日を過ぎたら終了処理（登録情報消去）の対象 */
  endDate: string;
  resetMode: EventResetMode;
  /** リセット時刻（JST, 'HH:MM'）。イベントごとに変更可能 */
  resetTime: string;
  /** 購読者上限 */
  subscriberCap: number;
  /** イベントのデフォルト言語（主催者が設定）。個人の言語選択がこれを上書きする */
  defaultLocale: Locale;
  /**
   * 入場用QRの取り込みを有効にするか（主催者が設定。既定オフ）。
   * オンにすると、来場者が主催者側の既存システム（事前登録・チケット等）から
   * 受け取った入場用QRを自分の画面で読み込んで購読者レコードに保存し、
   * 入場時に表示できる。オフの間は来場者画面に何も出ず、保存もできない。
   */
  admissionQrEnabled: boolean;
  /**
   * 主催者リンク（最大 MAX_EVENT_LINKS 件）。設定画面で登録し、来場者画面に
   * タイトル付きで表示する（案内PDFと同じく登録前でも見える位置）。
   * 未登録なら空配列で、来場者画面には何も出ない。
   * 導入前に作られたイベントには項目自体が無いため、読み取り時は空配列に倒す。
   */
  links: EventLink[];
  /**
   * 配信チャンネル（セグメント、最大 MAX_EVENT_CHANNELS 件）。
   * 未登録なら空配列。導入前に作られたイベントには項目自体が無いため、
   * 読み取り時は空配列に倒す。
   */
  channels: EventChannel[];
  /** 会場マップの中心。未設定は null */
  venueMap: EventVenueMap | null;
  /** 会場マップのピン（最大 MAX_EVENT_PINS 件） */
  pins: EventPin[];
  /**
   * クーポン上限（イベント全体の件数）。購読者上限と同じく契約枠の軸なので、
   * 変更は運営側のみ。既定は MAX_COUPONS_PER_EVENT。
   */
  couponCap: number;
  /**
   * 最終レポートの運営用バックアップ保持日数（契約ごとに設定）。
   * バックアップは削除対象の外に置き、期限を過ぎたら自動消去する。
   */
  backupRetentionDays: number;
  status: EventStatus;
  /** 最後に日次リセットを実行した JST 日付（'YYYY-MM-DD'）。未実施なら null */
  lastResetDate: string | null;
  /** 終了処理（電話番号消去まで）を完了したかどうか */
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** events/{eventId} 配下のサブコレクション名 */
export const EVENT_SUBCOLLECTIONS = {
  /** プッシュ購読（端末ごとの購読情報） */
  subscribers: 'subscribers',
  /** 端末キー本人確認レコード（端末の識別子を含む。電話番号は持たない） */
  members: 'members',
  /** クーポン取得記録（端末キーに紐づく） */
  claims: 'claims',
  /** クーポン消込記録（端末キーに紐づく） */
  redemptions: 'redemptions',
  /** タイムテーブル（FES。日次リセット対象外、終了処理でのみ消す） */
  timetable: 'timetable',
} as const;

export type EventSubcollection =
  (typeof EVENT_SUBCOLLECTIONS)[keyof typeof EVENT_SUBCOLLECTIONS];

export const DEFAULT_SUBSCRIBER_CAP = 50_000;
export const MAX_COUPONS_PER_EVENT = 100;
/**
 * 1主催者が同時に仕込めるイベント数の上限（下書き＋開催中）。
 * 会場日程が重なる運用（例: 月-水／水-金／週末）を想定した製品ルール。
 * 終了したイベントは数えない。
 */
export const MAX_CONCURRENT_EVENTS = 3;
export const MAX_INFO_PDFS = 5;
export const MAX_EVENT_LINKS = 3;
export const MAX_EVENT_CHANNELS = 10;
export const MAX_EVENT_PINS = 30;
export const MAX_PIN_LABEL_LENGTH = 30;
export const MAX_CHANNEL_NAME_LENGTH = 50;
export const DEFAULT_RESET_TIME = '00:00';
export const DEFAULT_BACKUP_RETENTION_DAYS = 30;
export const DEFAULT_RESET_MODE: EventResetMode = 'full-daily';

/** 新規イベントの入力。省略項目は既定値で補完する。 */
export interface CreateEventInput {
  name: string;
  ownerUid: string;
  startDate: string;
  endDate: string;
  /** 作成時の状態。未指定は下書き。'ended' は作成時には指定できない。 */
  status?: 'draft' | 'live';
  resetMode?: EventResetMode;
  resetTime?: string;
  subscriberCap?: number;
  defaultLocale?: Locale;
  admissionQrEnabled?: boolean;
  links?: EventLink[];
  channels?: EventChannel[];
  venueMap?: EventVenueMap | null;
  pins?: EventPin[];
  couponCap?: number;
  backupRetentionDays?: number;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date を JST の 'YYYY-MM-DD' に変換する（coupon-day.ts の couponDay と同じ方式）。 */
/** 購読者の言語別 FCM トピック名。配信は言語ごとにこのトピックへ送る。 */
export function localeTopic(eventId: string, locale: Locale): string {
  return `event_${eventId}_users_${locale}`;
}

/** チャンネル購読者の言語別 FCM トピック名。 */
export function channelTopic(eventId: string, channelId: string, locale: Locale): string {
  return `event_${eventId}_ch_${channelId}_${locale}`;
}

export function jstDateString(date: Date): string {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Date を JST の 'HH:MM' に変換する。 */
export function jstTimeString(date: Date): string {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(11, 16);
}

/** 'HH:MM' 形式かどうかの簡易バリデーション（00:00〜23:59）。 */
export function isValidResetTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** https の URL かどうか。 */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function readLinkFields(item: unknown): { title: string; url: string } | null {
  if (!item || typeof item !== 'object') return null;
  const raw = item as { title?: unknown; url?: unknown };
  return {
    title: typeof raw.title === 'string' ? raw.title.trim() : '',
    url: typeof raw.url === 'string' ? raw.url.trim() : '',
  };
}

/**
 * 主催者リンクの入力を検証して正規化する（書き込み用。不正なら throw）。
 * - タイトルと URL はセット: 片方だけの枠はエラー
 * - 両方空の枠は未指定として読み飛ばす（設定画面の空枠がこれに当たる）
 * - URL は https のみ許可
 * - 実質の件数は最大 MAX_EVENT_LINKS 件
 */
export function normalizeEventLinks(input: unknown): EventLink[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new Error('リンクの形式が不正です');
  const links: EventLink[] = [];
  for (const item of input) {
    const fields = readLinkFields(item);
    if (!fields) throw new Error('リンクの形式が不正です');
    if (!fields.title && !fields.url) continue;
    if (!fields.title || !fields.url) {
      throw new Error('リンクのタイトルとURLは両方入力してください');
    }
    if (!isHttpsUrl(fields.url)) {
      throw new Error('リンクのURLは https:// で始まる必要があります');
    }
    links.push(fields);
  }
  if (links.length > MAX_EVENT_LINKS) {
    throw new Error(`リンクは最大${MAX_EVENT_LINKS}件までです`);
  }
  return links;
}

/**
 * 保存済みの主催者リンクを防御的に読む（読み取り用。throw しない）。
 * 項目が無い旧イベントは空配列。不正な要素は落とし、上限で切り詰める。
 */
export function parseEventLinks(value: unknown): EventLink[] {
  if (!Array.isArray(value)) return [];
  const links: EventLink[] = [];
  for (const item of value) {
    const fields = readLinkFields(item);
    if (fields && fields.title && fields.url && isHttpsUrl(fields.url)) {
      links.push(fields);
      if (links.length >= MAX_EVENT_LINKS) break;
    }
  }
  return links;
}

const CHANNEL_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function readChannelFields(item: unknown): { id: string; name: string } | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  return {
    id: typeof record.id === 'string' ? record.id : '',
    name: typeof record.name === 'string' ? record.name.trim() : '',
  };
}

function generateChannelId(): string {
  return `ch${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 配信チャンネルの入力を検証して正規化する（書き込み用。不正なら throw）。
 * - 名前が空の枠は未指定として読み飛ばす（設定画面の空枠がこれに当たる）
 * - id は保持し、無い・重複・形式不正のものには新しい id を振る
 * - 実質の件数は最大 MAX_EVENT_CHANNELS 件
 */
export function normalizeEventChannels(input: unknown): EventChannel[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new Error('セグメントの形式が不正です');
  const channels: EventChannel[] = [];
  const usedIds = new Set<string>();
  for (const item of input) {
    const fields = readChannelFields(item);
    if (!fields) throw new Error('セグメントの形式が不正です');
    if (!fields.name) continue;
    if (fields.name.length > MAX_CHANNEL_NAME_LENGTH) {
      throw new Error(`セグメント名は${MAX_CHANNEL_NAME_LENGTH}文字までです`);
    }
    let id = fields.id;
    if (!CHANNEL_ID_PATTERN.test(id) || usedIds.has(id)) {
      id = generateChannelId();
    }
    usedIds.add(id);
    channels.push({ id, name: fields.name });
  }
  if (channels.length > MAX_EVENT_CHANNELS) {
    throw new Error(`セグメントは最大${MAX_EVENT_CHANNELS}件までです`);
  }
  return channels;
}

/**
 * 保存済みの配信チャンネルを防御的に読む（読み取り用。throw しない）。
 * 項目が無い旧イベントは空配列。不正な要素は落とし、上限で切り詰める。
 */
export function parseEventChannels(value: unknown): EventChannel[] {
  if (!Array.isArray(value)) return [];
  const channels: EventChannel[] = [];
  const usedIds = new Set<string>();
  for (const item of value) {
    const fields = readChannelFields(item);
    if (
      fields &&
      fields.name &&
      CHANNEL_ID_PATTERN.test(fields.id) &&
      !usedIds.has(fields.id)
    ) {
      usedIds.add(fields.id);
      channels.push({ id: fields.id, name: fields.name });
      if (channels.length >= MAX_EVENT_CHANNELS) break;
    }
  }
  return channels;
}

function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * 会場マップ中心の入力を検証して正規化する（書き込み用）。
 * 未指定（null/undefined）は null。座標が不正なら throw。
 */
export function normalizeVenueMap(input: unknown): EventVenueMap | null {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object') throw new Error('会場マップの形式が不正です');
  const record = input as Record<string, unknown>;
  if (!isValidLatLng(record.lat, record.lng)) {
    throw new Error('会場マップの座標が不正です');
  }
  const zoomRaw = typeof record.zoom === 'number' ? record.zoom : 16;
  const zoom = Math.min(19, Math.max(1, Math.round(zoomRaw)));
  return { lat: record.lat as number, lng: record.lng as number, zoom };
}

/** 保存済みの会場マップ中心を防御的に読む（読み取り用）。 */
export function parseVenueMap(value: unknown): EventVenueMap | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!isValidLatLng(record.lat, record.lng)) return null;
  const zoomRaw = typeof record.zoom === 'number' ? record.zoom : 16;
  return {
    lat: record.lat as number,
    lng: record.lng as number,
    zoom: Math.min(19, Math.max(1, Math.round(zoomRaw))),
  };
}

const PIN_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function generatePinId(): string {
  return `pin${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 会場ピンの入力を検証して正規化する（書き込み用。不正なら throw）。
 * ラベルが空のピンは読み飛ばす。座標が不正なピンはエラーにする
 * （地図に出ないピンが黙って消えると主催者が気づけないため）。
 */
export function normalizeEventPins(input: unknown): EventPin[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new Error('ピンの形式が不正です');
  const pins: EventPin[] = [];
  const usedIds = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== 'object') throw new Error('ピンの形式が不正です');
    const record = item as Record<string, unknown>;
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    if (!label) continue;
    if (label.length > MAX_PIN_LABEL_LENGTH) {
      throw new Error(`ピンの名前は${MAX_PIN_LABEL_LENGTH}文字までです`);
    }
    if (!isValidLatLng(record.lat, record.lng)) {
      throw new Error('ピンの座標が不正です');
    }
    let id = typeof record.id === 'string' ? record.id : '';
    if (!PIN_ID_PATTERN.test(id) || usedIds.has(id)) id = generatePinId();
    usedIds.add(id);
    pins.push({ id, label, lat: record.lat as number, lng: record.lng as number });
  }
  if (pins.length > MAX_EVENT_PINS) {
    throw new Error(`ピンは最大${MAX_EVENT_PINS}件までです`);
  }
  return pins;
}

/** 保存済みの会場ピンを防御的に読む（読み取り用。throw しない）。 */
export function parseEventPins(value: unknown): EventPin[] {
  if (!Array.isArray(value)) return [];
  const pins: EventPin[] = [];
  const usedIds = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    const id = typeof record.id === 'string' ? record.id : '';
    if (
      label &&
      PIN_ID_PATTERN.test(id) &&
      !usedIds.has(id) &&
      isValidLatLng(record.lat, record.lng)
    ) {
      usedIds.add(id);
      pins.push({ id, label, lat: record.lat as number, lng: record.lng as number });
      if (pins.length >= MAX_EVENT_PINS) break;
    }
  }
  return pins;
}

/**
 * このイベントの「今日分」の日次リセットが実行すべき状態かどうか。
 *
 * スケジューラ（15分間隔）が各イベントについて呼ぶ前提:
 * - 開催期間中（startDate <= 今日 <= endDate）であること
 * - 設定時刻を過ぎていること
 * - 今日分がまだ未実施（lastResetDate が今日でない）こと
 *
 * 冪等性は lastResetDate で担保する: 途中で失敗しても次の tick で再判定され、
 * 成功済みのイベントは二重にリセットされない。
 */
export function isResetDue(
  event: Pick<EventConfig, 'startDate' | 'endDate' | 'resetTime' | 'lastResetDate' | 'status'>,
  now: Date,
): boolean {
  if (event.status !== 'live') return false;
  const today = jstDateString(now);
  if (today < event.startDate || today > event.endDate) return false;
  if (event.lastResetDate === today) return false;
  return jstTimeString(now) >= event.resetTime;
}

/** 同時イベント上限のカウント対象かどうか（終了したイベントは数えない）。 */
export function countsTowardConcurrentCap(
  event: Pick<EventConfig, 'status'>,
): boolean {
  return event.status !== 'ended';
}

/** 主催者が現在仕込んでいるイベント数（下書き＋開催中）。 */
export function countConcurrentEvents(
  events: Pick<EventConfig, 'status'>[],
): number {
  return events.filter(countsTowardConcurrentCap).length;
}

/** 新しいイベントをもう1つ仕込めるかどうか（同時上限 MAX_CONCURRENT_EVENTS 未満）。 */
export function canCreateAnotherEvent(
  events: Pick<EventConfig, 'status'>[],
): boolean {
  return countConcurrentEvents(events) < MAX_CONCURRENT_EVENTS;
}

/**
 * 作成時に指定できる状態かどうかを検証し、正規化する（純粋関数・テスト対象）。
 * 未指定（undefined / null）は下書き。'ended' は作成時には選べない
 * （終了はスケジューラの終了処理でのみ遷移する）。
 * それ以外は例外を投げる（呼び出し側で 400 にする）。
 */
export function resolveCreateStatus(value: unknown): 'draft' | 'live' {
  if (value === undefined || value === null || value === 'draft') return 'draft';
  if (value === 'live') return 'live';
  throw new Error('状態の指定が不正です（下書きか開催中を指定してください）');
}

/**
 * 主催者がイベントを削除できるかどうか（純粋関数・テスト対象）。
 * 開催中は削除できない（先に終了させる運用）。削除できるのは
 * 下書きと、終了処理まで済んだ 'ended' のみ。
 */
export function canDeleteEvent(event: Pick<EventConfig, 'status'>): boolean {
  return event.status === 'draft' || event.status === 'ended';
}

/**
 * 契約枠の変更（プロビジョニング更新）を伝播してよいイベントかどうか。
 * 「終わった」イベント = 終了ステータス（'ended'）または終了処理完了
 * （finalizedAt 設定済み）。それ以外（下書き・開催中）は伝播対象で、
 * 終了済みのイベントの枠は履歴として触らない。
 */
export function receivesCapsPropagation(
  event: Pick<EventConfig, 'status' | 'finalizedAt'>,
): boolean {
  return event.status !== 'ended' && !event.finalizedAt;
}

/**
 * 終了処理（登録情報消去）の対象かどうか。
 * 終了日を過ぎていて、まだ finalized されていないイベントが対象。
 * リセットより優先される（終了後にリセットは走らない）。
 */
export function isFinalizationDue(
  event: Pick<EventConfig, 'endDate' | 'finalizedAt'>,
  now: Date,
): boolean {
  if (event.finalizedAt) return false;
  return jstDateString(now) > event.endDate;
}

export type SubscriberUsageLevel = 'normal' | 'warning' | 'full';

/**
 * 購読者枠の使用状況（イベントカードのインジケーター用）。
 * percent は 0–100 に丸め、level は 90%以上で warning、上限到達で full。
 */
export function subscriberUsage(
  count: number,
  cap: number,
): { percent: number; level: SubscriberUsageLevel } {
  if (cap <= 0) return { percent: 0, level: 'normal' };
  const ratio = count / cap;
  const percent = Math.min(100, Math.round(ratio * 100));
  const level: SubscriberUsageLevel = ratio >= 1 ? 'full' : ratio >= 0.9 ? 'warning' : 'normal';
  return { percent, level };
}
