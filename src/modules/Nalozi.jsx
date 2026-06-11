import React, { useState, useEffect, useCallback } from 'react';
import { api, timeAgo, fmtDateTime } from '../utils.js';
import { Icons } from '../components/index.jsx';

const NALOG_AKCIJA_TXT = {
  PREUZET: 'Preuzeo nalog',
  SPREMLJENO: 'Spremio na P599',
  ZAVRSENO: 'Završio bez premještanja',
  ARHIVIRAN: 'Arhivirano',
};

function NaloziModul({ user, showToast, onCountChange, onOpenGuma, setLightbox }) {
  const isAdmin = user.role === 'admin';
  const [nalozi, setNalozi] = useState([]);
  const [tab, setTab] = useState('svi'); // 'svi' | 'moji'
  const [loading, setLoading] = useState(false);

  const [err, setErr] = useState('');
  const [istorija, setIstorija] = useState([]);
  const loadIstorija = useCallback(async () => {
    try {
      const d = await api('/nalozi-moja-istorija');
      if (Array.isArray(d)) setIstorija(d);
    } catch(e) {}
  }, []);
  const load = useCallback(async () => {
    try {
      setErr('');
      const d = await api('/nalozi');
      if(!Array.isArray(d)){ setErr('Server: '+(d?.error||JSON.stringify(d))); return; }
      setNalozi(d);
      const ceka = d.filter(n => n.status === 'ceka').length;
      if (onCountChange) onCountChange(ceka);
    } catch(e) { setErr('Greška: '+e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if(tab==='moji') loadIstorija(); }, [tab, loadIstorija]);

  const doPreuzmi = async (id) => {
    try {
      await api(`/nalozi/${id}/preuzmi`, { method: 'POST' });
      showToast('Nalog preuzet!');
      load();
      window.dispatchEvent(new Event('nalozi-changed'));
      loadIstorija();
    } catch(e) { showToast('Greška', 'err'); }
  };

  const doSpremi = async (id) => {
    if (!confirm('Guma će biti premještena na policu P599. Nastavi?')) return;
    try {
      await api(`/nalozi/${id}/spremi`, { method: 'POST' });
      showToast('Guma premještena na P599, nalog zatvoren!');
      load();
      window.dispatchEvent(new Event('nalozi-changed'));
      loadIstorija();
    } catch(e) { showToast('Greška', 'err'); }
  };

  const doZavrsi = async (id) => {
    if (!confirm('Zatvori nalog bez premještanja gume?')) return;
    try {
      await api(`/nalozi/${id}/zavrsi`, { method: 'POST' });
      showToast('Nalog zatvoren');
      load();
      window.dispatchEvent(new Event('nalozi-changed'));
      loadIstorija();
    } catch(e) { showToast('Greška', 'err'); }
  };

  const prikazani = tab === 'moji'
    ? nalozi.filter(n => n.preuzeo === user.username && n.status !== 'zavrseno')
    : nalozi.filter(n => n.status !== 'zavrseno');

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Nalozi</div>
      </div>

      <div className="tab-bar" style={{ marginBottom: 14 }}>
        <button className={'stab' + (tab === 'svi' ? ' as' : '')} onClick={() => setTab('svi')}>
          Svi nalozi
          {nalozi.filter(n => n.status === 'ceka').length > 0 &&
            <span style={{ marginLeft: 5, background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 10, fontWeight: 900 }}>
              {nalozi.filter(n => n.status === 'ceka').length}
            </span>
          }
        </button>
        <button className={'stab' + (tab === 'moji' ? ' as' : '')} onClick={() => setTab('moji')}>
          Moji nalozi
          {nalozi.filter(n => n.preuzeo === user.username && n.status !== 'zavrseno').length > 0 &&
            <span style={{ marginLeft: 5, background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 10, fontWeight: 900 }}>
              {nalozi.filter(n => n.preuzeo === user.username && n.status !== 'zavrseno').length}
            </span>
          }
        </button>
      </div>

      {err&&<div style={{padding:'12px',color:'var(--red)',fontSize:12,background:'rgba(248,81,73,.1)',borderRadius:6,marginBottom:10}}>{err}</div>}
      {prikazani.length === 0
        ? <div className="empty"><p style={{ color: 'var(--muted)', fontSize: 13 }}>Nema naloga</p></div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {prikazani.map(n => {
            const jePreuzeo = n.preuzeo === user.username;
            const jePreuzeto = n.status === 'preuzeto';
            return (
              <div key={n.id} className="card-panel" style={{
                borderLeft: `3px solid ${n.hitno ? 'var(--red)' : n.za_slanje ? '#e3b341' : 'var(--border)'}`,
                opacity: jePreuzeto && !jePreuzeo ? 0.7 : 1
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontFamily: 'Barlow Condensed,sans-serif', fontWeight: 900, fontSize: 16, color:'var(--accent)', cursor: onOpenGuma?'pointer':'default', textDecoration: onOpenGuma?'underline':'none' }}
                        onClick={()=>onOpenGuma&&onOpenGuma(n.guma_id)}>
                        {n.guma_sifra}
                      </span>
                      {n.hitno ? <span style={{ background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 900, padding: '1px 6px', borderRadius: 4, letterSpacing: 1 }}>HITNO</span> : null}
                      {n.za_slanje ? <span style={{ background: '#e3b341', color: '#1a1a1a', fontSize: 9, fontWeight: 900, padding: '1px 6px', borderRadius: 4, letterSpacing: 1 }}>ZA SLANJE</span> : null}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{n.guma_opis}</div>
                    {n.guma_lokacija ? <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 2 }}>📍 {n.guma_lokacija}</div> : null}
                    {n.napomena ? <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 4 }}>"{n.napomena}"</div> : null}
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      Kreirao: <b>{n.kreirao}</b> · {timeAgo(n.created_at)}
                    </div>
                    {jePreuzeto && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 3, fontWeight: 700 }}>
                      ✓ Preuzeo: {n.preuzeo}{n.preuzeto_at?' · '+fmtDateTime(n.preuzeto_at):''}
                    </div>}
                    {n.status === 'zavrseno' && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, fontWeight: 700 }}>
                      ⬛ Završio: {n.preuzeo||'—'}{n.zavrseno_at ? ' · '+fmtDateTime(n.zavrseno_at) : ''} {n.guma_lokacija==='P599' ? '(spremljeno na P599)' : ''}
                    </div>}
                  </div>
                  <div style={{ position: 'relative', flexShrink: 0, width: 64, height: 64, borderRadius: 6, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)' }}>
                    {n.guma_slika
                      ? <img src={n.guma_slika} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: setLightbox?'pointer':'default' }} onClick={()=>setLightbox&&setLightbox({images:[n.guma_slika],index:0})}/>
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 22 }}>🛞</div>
                    }
                    <div style={{ position: 'absolute', top: 2, left: 2, background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 9, fontWeight: 900, padding: '1px 5px', borderRadius: 4, lineHeight: 1.4 }}>#{n.id}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {n.status === 'ceka' && (
                    <button className="btn-sm" style={{ color: 'var(--accent)', borderColor: 'rgba(255,165,0,.3)', fontWeight: 700, fontSize: '1.3em', padding: '10.4px 15.6px' }}
                      onClick={() => doPreuzmi(n.id)}>
                      Preuzmi
                    </button>
                  )}
                  {jePreuzeto && jePreuzeo && (
                    <>
                      <button className="btn-sm" style={{ color: 'var(--green)', borderColor: 'rgba(63,185,80,.3)', fontWeight: 700 }}
                        onClick={() => doSpremi(n.id)}>
                        ✓ Dio je spremljen
                      </button>
                      <button className="btn-sm" style={{ color: 'var(--muted)' }}
                        onClick={() => doZavrsi(n.id)}>
                        Završi nalog
                      </button>
                    </>
                  )}
                  {jePreuzeto && !jePreuzeo && isAdmin && (
                    <button className="btn-sm" style={{ color: 'var(--muted)' }}
                      onClick={() => doZavrsi(n.id)}>
                      Zatvori (admin)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      }

      {tab === 'moji' && istorija.length > 0 && <div style={{marginTop:18}}>
        <div className="section-title" style={{marginBottom:8}}>Istorija mojih naloga</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {istorija.map((h,i) => (
            <div key={i} className="card-panel" style={{padding:'8px 12px',opacity:0.85}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:13}}>{h.guma_sifra} — {h.guma_opis}</div>
                  <div style={{fontSize:10,color:'var(--muted)'}}>
                    {NALOG_AKCIJA_TXT[h.akcija]||h.akcija}{h.detalji?' · '+h.detalji:''}
                  </div>
                </div>
                <span style={{fontSize:10,color:'var(--muted)',flexShrink:0}}>{fmtDateTime(h.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}

export default NaloziModul;
