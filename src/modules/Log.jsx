import React, { useState, useEffect } from 'react';
import { api, fmtDateTime } from '../utils.js';
import { SimplePagination } from '../components/index.jsx';

const PER_PAGE = 20;

const ZAVRSNE_AKCIJE = {
  PREUZET: 'Preuzeo',
  SPREMLJENO: 'Spremio (P599)',
  ZAVRSENO: 'Završio bez premještanja',
  ARHIVIRAN: 'Arhivirao',
};

function grupisiNaloge(log){
  const grupe = new Map();
  // Process oldest-first so KREIRAN is found first, terminal action overwrites
  const sorted = [...log].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  for(const ev of sorted){
    const id = ev.nalog_id;
    if(!grupe.has(id)) grupe.set(id, {nalog_id:id, guma_sifra:ev.guma_sifra, guma_opis:ev.guma_opis, kreiran:null, zadnja:null});
    const g = grupe.get(id);
    if(ev.akcija==='KREIRAN'){
      g.kreiran = ev;
    } else if(ZAVRSNE_AKCIJE[ev.akcija]){
      g.zadnja = ev; // last terminal action wins (sorted ascending, so last write = latest)
    }
  }
  // Return newest-first by most recent event (zadnja || kreiran)
  return [...grupe.values()].sort((a,b)=>{
    const ta = new Date((a.zadnja||a.kreiran)?.created_at||0);
    const tb = new Date((b.zadnja||b.kreiran)?.created_at||0);
    return tb-ta;
  });
}

function LogModul({ showToast }) {
  const [tab, setTab] = useState('aktivnosti'); // 'aktivnosti' | 'nalozi'

  // Aktivnosti
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageAkt, setPageAkt] = useState(1);

  // Nalozi log
  const [naloziLog, setNaloziLog] = useState([]);
  const [loadingNal, setLoadingNal] = useState(false);
  const [pageNal, setPageNal] = useState(1);
  const [od, setOd] = useState('');
  const [do_, setDo] = useState('');

  useEffect(() => {
    api('/aktivnosti?limit=300').then(d => { setLista(d); setLoading(false); }).catch(e => { showToast(e.message, 'err'); setLoading(false); });
  }, []);

  const loadNaloziLog = () => {
    setLoadingNal(true);
    const params = new URLSearchParams();
    if (od) params.set('od', od);
    if (do_) params.set('do_', do_);
    const qs = params.toString();
    api('/nalozi-log' + (qs ? '?' + qs : '')).then(d => {
      if (Array.isArray(d)) { setNaloziLog(d); setPageNal(1); }
      setLoadingNal(false);
    }).catch(e => { showToast(e.message, 'err'); setLoadingNal(false); });
  };

  useEffect(() => { if (tab === 'nalozi') loadNaloziLog(); }, [tab]);

  const nazivi = { PRIJAVA: 'Prijava', DODANA_GUMA: 'Dodana guma', EDITOVANA_GUMA: 'Izmijenjena guma', PREMJESTENA_GUMA: 'Premještena', PRODANA_GUMA: 'Prodana guma', OBRISANA_GUMA: 'Obrisana guma', DODAN_AUTO: 'Dodan auto', PRODAT_AUTO: 'Prodat auto', OBRISAN_AUTO: 'Obrisan auto' };

  if (loading) return <div className="page"><div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Učitavanje...</div></div>;

  const aktStranica = lista.slice((pageAkt - 1) * PER_PAGE, pageAkt * PER_PAGE);
  const naloziGrupisani = grupisiNaloge(naloziLog);
  const nalStranica = naloziGrupisani.slice((pageNal - 1) * PER_PAGE, pageNal * PER_PAGE);

  return (<div className="page">
    <div className="page-header"><div className="page-title">Dnevnik</div><div className="page-sub">Aktivnosti i istorija naloga</div></div>

    <div className="status-tabs" style={{ marginBottom: 14 }}>
      <button className={'stab' + (tab === 'aktivnosti' ? ' as' : '')} onClick={() => setTab('aktivnosti')}>📋 Aktivnosti ({lista.length})</button>
      <button className={'stab' + (tab === 'nalozi' ? ' as' : '')} onClick={() => setTab('nalozi')}>🔁 Istorija naloga</button>
    </div>

    {tab === 'aktivnosti' && <>
      <div className="card-panel">
        {lista.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)', fontSize: 13 }}>Nema zabilježenih aktivnosti</div>}
        {aktStranica.map((a, i) => {
          const dt = new Date(a.created_at);
          const timeStr = dt.toLocaleDateString('sr-Latn-RS') + ' ' + dt.toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' });
          return (<div key={i} className="log-item">
            <span className={'log-badge ' + (a.akcija || '')}>{nazivi[a.akcija] || a.akcija}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="log-user">{a.korisnik}</div>
              {a.detalji && <div className="log-detail">{a.detalji}</div>}
            </div>
            <span className="log-time">{timeStr}</span>
          </div>);
        })}
      </div>
      <SimplePagination page={pageAkt} total={lista.length} perPage={PER_PAGE} onChange={setPageAkt} />
    </>}

    {tab === 'nalozi' && <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 9, fontFamily: 'Barlow Condensed,sans-serif', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)' }}>OD</label>
          <input type="date" value={od} onChange={e => setOd(e.target.value)} style={{ fontSize: 13, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--card)', color: 'var(--text)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 9, fontFamily: 'Barlow Condensed,sans-serif', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)' }}>DO</label>
          <input type="date" value={do_} onChange={e => setDo(e.target.value)} style={{ fontSize: 13, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--card)', color: 'var(--text)' }} />
        </div>
        <button className="btn-sm" onClick={loadNaloziLog}>Filtriraj</button>
        {(od || do_) && <button className="btn-sm" onClick={() => { setOd(''); setDo(''); setTimeout(loadNaloziLog, 0); }}>Resetuj</button>}
      </div>

      {loadingNal
        ? <div style={{ color: 'var(--muted)', padding: 30, textAlign: 'center' }}>Učitavanje...</div>
        : <div className="card-panel">
          {naloziLog.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)', fontSize: 13 }}>Nema zabilježenih događaja</div>}
          {nalStranica.map((n, i) => (
            <div key={i} className="log-item" style={{flexDirection:'column',alignItems:'stretch',gap:4}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <div className="log-user">{n.guma_sifra} — {n.guma_opis}</div>
                <span style={{fontSize:10,color:'var(--muted)'}}>nalog #{n.nalog_id}</span>
              </div>
              <div className="log-detail" style={{display:'flex',flexDirection:'column',gap:2}}>
                {n.kreiran && <div>
                  Poslao <b style={{color:'var(--text)'}}>{n.kreiran.korisnik}</b> · {fmtDateTime(n.kreiran.created_at)}
                  {n.kreiran.detalji ? ' · '+n.kreiran.detalji : ''}
                </div>}
                {n.zadnja
                  ? <div>
                      {ZAVRSNE_AKCIJE[n.zadnja.akcija]||n.zadnja.akcija} <b style={{color:'var(--text)'}}>{n.zadnja.korisnik}</b> · {fmtDateTime(n.zadnja.created_at)}
                      {n.zadnja.detalji ? ' · '+n.zadnja.detalji : ''}
                    </div>
                  : <div style={{color:'var(--accent)'}}>⏳ Aktivan / čeka preuzimanje</div>
                }
              </div>
            </div>
          ))}
        </div>
      }
      <SimplePagination page={pageNal} total={naloziGrupisani.length} perPage={PER_PAGE} onChange={setPageNal} />
    </>}

    <div className="site-footer">© 2026 <span>DelicNode</span></div>
  </div>);
}

export default LogModul;
