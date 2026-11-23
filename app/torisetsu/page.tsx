// app/torisetsu/page.tsx
import type { Metadata } from 'next';
import TorisetsuIndexClient from './TorisetsuIndexClient';

export const metadata: Metadata = {
  title: 'Push-taro FES 取扱説明書｜音楽フェス・大型イベント向けプッシュ通知 × クーポン',
  description:
    '音楽フェス・大型イベント向け Push-taro FES の取扱説明書。データのリセット方式、イベント終了時の消去手順、集計レポート、消込の権限について解説します。',
  alternates: { canonical: '/torisetsu' },
};

export default function Page() {
  return <TorisetsuIndexClient />;
}
