'use client';
import type { Lookup } from '@/hooks/useWordLookup';

interface Props {
  word: string;
  lookup: Lookup | null;
  lookingUp: boolean;
  isSaved: boolean;
  onSave: () => void;
  onClose: () => void;
}

export default function WordLookupPanel({ word, lookup, lookingUp, isSaved, onSave, onClose }: Props) {
  const speak = () => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  };

  return (
    <div style={{ position: 'fixed', bottom: 80, left: 16, right: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', maxHeight: '60vh', overflowY: 'auto', zIndex: 100 }}>
      {lookingUp
        ? <p style={{ color: 'var(--text-muted)', margin: 0, padding: 16 }}>查詢「{word}」...</p>
        : lookup && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 20 }}>{word}</strong>
                <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 14 }}>{lookup.phonetic}</span>
                <button onClick={speak} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '0 2px', lineHeight: 1 }}>🔊</button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={onSave}
                  disabled={isSaved}
                  style={{ background: isSaved ? 'var(--bg-tertiary)' : 'var(--accent)', color: isSaved ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', cursor: isSaved ? 'default' : 'pointer', fontSize: 13, fontWeight: 500, flexShrink: 0 }}
                >
                  {isSaved ? '已儲存' : '加入單字庫'}
                </button>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', padding: '0 4px', lineHeight: 1 }}>✕</button>
              </div>
            </div>

            <p style={{ margin: '0 0 12px', fontSize: 16 }}>{lookup.definition}</p>

            <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, borderLeft: '3px solid var(--accent)' }}>
              <p style={{ margin: '0 0 4px', fontSize: 15, fontStyle: 'italic', color: 'var(--text-primary)' }}>{lookup.example}</p>
              {lookup.example_zh && <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--text-muted)' }}>{lookup.example_zh}</p>}
              {lookup.example_breakdown && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--accent)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  解析：{lookup.example_breakdown}
                </p>
              )}
            </div>

            {lookup.phrases?.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>常見片語</p>
                {lookup.phrases.map((ph, i) => (
                  <p key={i} style={{ margin: '0 0 3px', fontSize: 14, color: 'var(--text-muted)' }}>• {ph}</p>
                ))}
              </div>
            )}

            {lookup.informal && (
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>口語用法</p>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{lookup.informal}</p>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
