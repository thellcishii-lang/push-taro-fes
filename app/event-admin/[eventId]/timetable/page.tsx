'use client';

// app/event-admin/[eventId]/timetable/page.tsx
// Push-taro FES 主催者向けのタイムテーブル画面（管理画面①）。
// 日付・ステージ・開始/終了時刻・タイトル・補足を登録し、来場者画面に
// そのまま出す。時刻や出演者を変更すると「変更されました」の印が付き、
// その場でプッシュ通知も送れる。
// 画面の固定文は4言語辞書（lib/ui-text.ts の ADMIN_TEXT）。
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { AdminLanguageSelect, useAdminLocale } from '@/components/AdminLocale';
import {
  ADMIN_CARD_BORDER,
  ADMIN_CARD_SHADOW,
  ADMIN_PAGE_BG,
  AdminBrandBar,
  ButtonSpinner,
  adminButtonContentStyle,
  adminErrorTextStyle,
  adminFeedbackStyle,
  adminPageTitleStyle,
} from '@/components/AdminBrand';
import { adminText, uiText } from '@/lib/ui-text';
import { AdminShell } from '@/components/AdminShell';
import { CapWarningBanner } from '@/components/CapWarningBanner';
import { AdminNav } from '../AdminNav';

interface TimetableEntry {
  id: string;
  date: string;
  stage: string;
  startTime: string;
  endTime: string;
  title: string;
  note: string;
  changedAt: string | null;
}

const VIOLET = '#0e7fc4';
const TEAL = '#19b8a6';

const containerStyle: React.CSSProperties = {
  padding: '20px 16px 48px',
  maxWidth: 880,
  margin: '0 auto',
  fontFamily: 'sans-serif',
  backgroundColor: ADMIN_PAGE_BG,
  minHeight: '100vh',
  boxSizing: 'border-box',
  color: '#0f172a',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: `1px solid ${ADMIN_CARD_BORDER}`,
  borderRadius: 18,
  boxShadow: ADMIN_CARD_SHADOW,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '11px 12px',
  marginTop: 6,
  border: '1px solid #cbd5e1',
  borderRadius: 12,
  fontSize: 14,
  backgroundColor: '#ffffff',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 12,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '12px 22px',
  fontWeight: 700,
  fontSize: 15,
  backgroundColor: VIOLET,
  color: '#ffffff',
  border: 'none',
  borderRadius: 12,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(14, 127, 196, 0.25)',
};

const smallButtonStyle: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  cursor: 'pointer',
};

const dangerButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  border: '1px solid #fca5a5',
  color: '#b91c1c',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  margin: 0,
};

export default function EventTimetableAdminPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [locale, setLocale] = useAdminLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [eventName, setEventName] = useState('');
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [message, setMessage] = useState('');
  const [loadMessage, setLoadMessage] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [stage, setStage] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const callApi = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!user) throw new Error(adminText(locale, 'loginRequired'));
      const idToken = await user.getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      };
      headers['Authori' + 'zation'] = `Bearer ${idToken}`;
      const res = await fetch(path, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error ?? adminText(locale, 'apiError', { status: String(res.status) }));
      return data;
    },
    [user, locale],
  );

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [eventData, ttData] = await Promise.all([
        callApi(`/api/events/${eventId}`),
        callApi(`/api/events/${eventId}/timetable`),
      ]);
      if (typeof eventData.event?.name === 'string') setEventName(eventData.event.name);
      setEntries(ttData.entries ?? []);
      setDate((prev) => prev || eventData.event?.startDate || '');
      setLoadMessage('');
    } catch (e) {
      setLoadMessage(e instanceof Error ? e.message : adminText(locale, 'loadFailed'));
    }
  }, [user, eventId, callApi, locale]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const handleLogin = async () => {
    setBusy(true);
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setMessage(adminText(locale, 'loginFailed'));
    } finally {
      setBusy(false);
    }
  };

  const resetForm = useCallback(() => {
    setEditingId(null);
    setStartTime('');
    setEndTime('');
    setTitle('');
    setNote('');
  }, []);

  const handleSubmit = async () => {
    setBusy(true);
    setFormMessage('');
    try {
      const payload = { date, stage, startTime, endTime, title, note };
      if (editingId) {
        await callApi(`/api/events/${eventId}/timetable/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await callApi(`/api/events/${eventId}/timetable`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      await load();
    } catch (e) {
      setFormMessage(e instanceof Error ? e.message : adminText(locale, 'timetableSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (entry: TimetableEntry) => {
    setEditingId(entry.id);
    setDate(entry.date);
    setStage(entry.stage);
    setStartTime(entry.startTime);
    setEndTime(entry.endTime);
    setTitle(entry.title);
    setNote(entry.note);
    setFormMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (entry: TimetableEntry) => {
    if (!window.confirm(adminText(locale, 'timetableDeleteConfirm'))) return;
    setBusy(true);
    try {
      await callApi(`/api/events/${eventId}/timetable/${entry.id}`, { method: 'DELETE' });
      if (editingId === entry.id) resetForm();
      await load();
    } catch (e) {
      setFormMessage(e instanceof Error ? e.message : adminText(locale, 'timetableSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleNotify = async (entry: TimetableEntry) => {
    setBusy(true);
    setFormMessage('');
    try {
      await callApi(`/api/events/${eventId}/timetable/${entry.id}/notify`, { method: 'POST' });
      setFormMessage(adminText(locale, 'timetableNotified'));
    } catch (e) {
      setFormMessage(e instanceof Error ? e.message : adminText(locale, 'timetableSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!authReady) return <main style={containerStyle}>{uiText(locale, 'loading')}</main>;

  if (!user) {
    return (
      <main style={{ ...containerStyle, maxWidth: 480 }}>
        <AdminBrandBar right={<AdminLanguageSelect locale={locale} onChange={setLocale} />} />
        <section style={{ ...cardStyle, padding: 24, marginTop: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px' }}>{adminText(locale, 'adminLoginTitle')}</h1>
          <label style={labelStyle}>
            {adminText(locale, 'emailLabel')}
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label style={labelStyle}>
            {adminText(locale, 'passwordLabel')}
            <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button onClick={handleLogin} disabled={busy} style={{ ...primaryButtonStyle, width: '100%' }}>
            <span style={adminButtonContentStyle}>
              {busy && <ButtonSpinner />}
              {adminText(locale, 'loginButton')}
            </span>
          </button>
          {message && <p style={{ color: '#b91c1c', marginTop: 12, fontSize: 14 }}>{message}</p>}
        </section>
      </main>
    );
  }

  const stages = [...new Set(entries.map((e) => e.stage))];
  const dates = [...new Set(entries.map((e) => e.date))].sort();

  return (
    <AdminShell
      locale={locale}
      email={user.email}
      onLogout={() => void signOut(auth)}
      languageSelect={<AdminLanguageSelect locale={locale} onChange={setLocale} />}
      nav={<AdminNav eventId={eventId} eventName={eventName} current="①" locale={locale} />}
    >
      <h1 style={adminPageTitleStyle}>{adminText(locale, 'timetablePageTitle')}</h1>
      <CapWarningBanner locale={locale} />
      {loadMessage && <p style={adminErrorTextStyle}>{loadMessage}</p>}
      <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 8 }}>
        {adminText(locale, 'timetablePageNote')}
      </p>

      <section style={{ ...cardStyle, marginTop: 16, padding: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ ...labelStyle, flex: '1 1 150px' }}>
            {adminText(locale, 'timetableDateLabel')}
            <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label style={{ ...labelStyle, flex: '1 1 180px' }}>
            {adminText(locale, 'timetableStageLabel')}
            <input
              style={inputStyle}
              type="text"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              list="timetable-stages"
            />
            <datalist id="timetable-stages">
              {stages.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label style={{ ...labelStyle, flex: '0 1 110px' }}>
            {adminText(locale, 'timetableStartLabel')}
            <input style={inputStyle} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label style={{ ...labelStyle, flex: '0 1 110px' }}>
            {adminText(locale, 'timetableEndLabel')}
            <input style={inputStyle} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
        <label style={labelStyle}>
          {adminText(locale, 'timetableTitleLabel')}
          <input style={inputStyle} type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label style={labelStyle}>
          {adminText(locale, 'timetableNoteLabel')}
          <input style={inputStyle} type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => void handleSubmit()} disabled={busy} style={primaryButtonStyle}>
            <span style={adminButtonContentStyle}>
              {busy && <ButtonSpinner />}
              {adminText(locale, editingId ? 'timetableSaveButton' : 'timetableAddButton')}
            </span>
          </button>
          {editingId && (
            <button onClick={resetForm} disabled={busy} style={smallButtonStyle}>
              {adminText(locale, 'timetableCancelButton')}
            </button>
          )}
        </div>
        {formMessage && <p style={adminFeedbackStyle}>{formMessage}</p>}
      </section>

      <section style={{ marginTop: 30 }}>
        <h2 style={sectionTitleStyle}>{adminText(locale, 'timetableListTitle')}</h2>
        {entries.length === 0 && (
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 10 }}>
            {adminText(locale, 'timetableEmpty')}
          </p>
        )}
        {dates.map((d) => (
          <div key={d} style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 8px' }}>{d}</h3>
            {entries
              .filter((e) => e.date === d)
              .map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    ...cardStyle,
                    padding: '12px 16px',
                    marginTop: 8,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: VIOLET, minWidth: 108 }}>
                    {entry.startTime}〜{entry.endTime}
                  </div>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {entry.title}
                      {entry.changedAt && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#ffffff',
                            backgroundColor: TEAL,
                            borderRadius: 999,
                            padding: '2px 8px',
                            verticalAlign: 'middle',
                          }}
                        >
                          {adminText(locale, 'timetableChangedBadge')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {entry.stage}
                      {entry.note ? ` ／ ${entry.note}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {entry.changedAt && (
                      <button onClick={() => void handleNotify(entry)} disabled={busy} style={{ ...smallButtonStyle, borderColor: TEAL, color: '#0f766e' }}>
                        {adminText(locale, 'timetableNotifyButton')}
                      </button>
                    )}
                    <button onClick={() => handleEdit(entry)} disabled={busy} style={smallButtonStyle}>
                      {adminText(locale, 'timetableEditButton')}
                    </button>
                    <button onClick={() => void handleDelete(entry)} disabled={busy} style={dangerButtonStyle}>
                      {adminText(locale, 'timetableDeleteButton')}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
