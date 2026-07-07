'use client';
import { useState } from 'react';
import { useAllVocab, useDueVocab } from '@/hooks/useVocab';
import { advanceSrs, resetSrs, deleteVocab, addVocab } from '@/lib/db/vocabulary';
import { useStudent } from '@/context/StudentContext';
import { callAI, extractJSON } from '@/lib/ai';

type Tab = 'review' | 'list' | 'add';

export default function VocabPage() {
  const { db } = useStudent();
  const [tab, setTab] = useState<Tab>('review');
  const all = useAllVocab() ?? [];
  const due = useDueVocab() ?? [];
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [nw, setNw] = useState('');
  const [nd, setNd] = useState('');
  const [np, setNp] = useState('');
  const [ne, setNe] = useState('');
  const [looking, setLooking] = useState(false);

  const cur = due[idx];

  const know = async () => { if (cur?.id && db) { await advanceSrs(db, cur.id); setFlipped(false); setIdx(i => i+1); }};
  const forget = async () => { if (cur?.id && db) { await resetSrs(db, cur.id); setFlipped(false); setIdx(i => i+1); }};

  const autoLookup = async () => {
    if (!nw.trim()) return;
    setLooking(true);
    try {
      const raw = await callAI({ messages: [{ role:'user', content:`Look up "${nw}". JSON only: {"definition":"繁中 (詞性)","phonetic":"/IPA/","example":"example"}` }] });
      const p = extractJSON<{ definition?: string; phonetic?: string; example?: string }>(raw);
      setNd(p.definition??''); setNp(p.phonetic??''); setNe(p.example??'');
    } catch {} finally { setLooking(false); }
  };

  const saveNew = async () => {
    if (!nw.trim() || !db) return;
    await addVocab(db, { word:nw, definition:nd, phonetic:np, example:ne, srsLevel:0, nextReview:Date.now(), createdAt:Date.now() });
    setNw(''); setNd(''); setNp(''); setNe('');
  };

  const tb = (t: Tab, label: string) => ({
    padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    background: tab === t ? 'var(--accent)' : 'var(--bg-tertiary)',
    color: tab === t ? '#fff' : 'var(--text-muted)',
  });

  const inp = { width:'100%', padding:'12px 14px', boxSizing:'border-box' as const, background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text-primary)', fontFamily:'inherit', fontSize:17 };

  return (
    <div style={{ padding:24, maxWidth:640, margin:'0 auto' }}>
      <h1 style={{ fontSize:26, marginBottom:16 }}>單字庫</h1>
      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        <button style={tb('review','複習')} onClick={() => { setTab('review'); setIdx(0); setFlipped(false); }}>複習 ({due.length})</button>
        <button style={tb('list','全部')} onClick={() => setTab('list')}>全部 ({all.length})</button>
        <button style={tb('add','新增')} onClick={() => setTab('add')}>新增</button>
      </div>

      {tab === 'review' && (
        !cur || idx >= due.length
          ? <p style={{ textAlign:'center', color:'var(--text-muted)', marginTop:60 }}>{due.length === 0 ? '今日複習完成！' : '本輪完成！'}</p>
          : <div style={{ textAlign:'center' }}>
              <p style={{ color:'var(--text-muted)', fontSize:13, marginBottom:12 }}>{idx+1} / {due.length}</p>
              <div onClick={() => setFlipped(f => !f)} style={{ background:'var(--bg-secondary)', borderRadius:'var(--radius)', border:'1px solid var(--border)', padding:'40px 24px', minHeight:200, cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center' }}>
                <p style={{ fontSize:30, fontWeight:700, margin:0 }}>{cur.word}</p>
                {flipped && <>
                  <p className="mono" style={{ color:'var(--text-muted)', margin:'8px 0', fontSize:16 }}>{cur.phonetic}</p>
                  <p style={{ fontSize:18, margin:'0 0 8px' }}>{cur.definition}</p>
                  <p style={{ fontSize:16, color:'var(--text-muted)', fontStyle:'italic', margin:0 }}>{cur.example}</p>
                </>}
              </div>
              {flipped
                ? <div style={{ display:'flex', gap:12, marginTop:14 }}>
                    <button onClick={forget} style={{ flex:1, padding:12, background:'#ef444422', color:'#ef4444', border:'1px solid #ef444444', borderRadius:'var(--radius)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>不記得</button>
                    <button onClick={know} style={{ flex:1, padding:12, background:'#10b98122', color:'#10b981', border:'1px solid #10b98144', borderRadius:'var(--radius)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>記得</button>
                  </div>
                : <p style={{ color:'var(--text-subtle)', marginTop:10, fontSize:13 }}>點擊翻面</p>}
            </div>
      )}

      {tab === 'list' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {all.map(v => (
            <div key={v.id} style={{ background:'var(--bg-secondary)', borderRadius:'var(--radius-sm)', padding:'12px 14px', border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <strong>{v.word}</strong>
                <span className="mono" style={{ color:'var(--text-muted)', marginLeft:8, fontSize:15 }}>{v.phonetic}</span>
                <p style={{ margin:'2px 0 0', fontSize:15, color:'var(--text-muted)' }}>{v.definition}</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:11, color:'var(--accent)', background:'var(--bg-tertiary)', padding:'2px 8px', borderRadius:4 }}>Lv.{v.srsLevel}</span>
                <button onClick={() => v.id && db && deleteVocab(db, v.id)} style={{ background:'none', border:'none', color:'var(--text-subtle)', cursor:'pointer', fontSize:16 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'add' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', gap:8 }}>
            <input value={nw} onChange={e => setNw(e.target.value)} placeholder="單字或片語" style={{ ...inp, flex:1 }} />
            <button onClick={autoLookup} disabled={looking || !nw.trim()} style={{ padding:'12px 14px', background:'var(--bg-tertiary)', border:'none', borderRadius:'var(--radius)', color:'var(--text-primary)', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              {looking ? '查詢中...' : '自動查詢'}
            </button>
          </div>
          <input value={np} onChange={e => setNp(e.target.value)} placeholder="/音標/" style={inp} />
          <input value={nd} onChange={e => setNd(e.target.value)} placeholder="中文定義 (詞性)" style={inp} />
          <input value={ne} onChange={e => setNe(e.target.value)} placeholder="例句" style={inp} />
          <button onClick={saveNew} disabled={!nw.trim()} style={{ padding:12, background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', cursor:'pointer', fontFamily:'inherit', fontWeight:600, fontSize:17 }}>
            加入單字庫
          </button>
        </div>
      )}
    </div>
  );
}
