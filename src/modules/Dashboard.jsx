import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, promjerDisp, tipLbl, statusLbl, timeAgo, resizeImage } from '../utils.js';
import { ErrorBoundary, ComboBox, useImageUpload, Lightbox, ImgUploadUI, Pagination } from '../components/index.jsx';

function Dashboard({user,onNav,showToast}){
  const [data,setData]=useState(null);
  useEffect(()=>{api('/dashboard').then(setData).catch(console.error);},[]);
  if(!data)return <div className="page"><div style={{color:'var(--muted)',padding:40,textAlign:'center',fontFamily:'Barlow Condensed,sans-serif',letterSpacing:2,textTransform:'uppercase',fontSize:13}}>Učitavanje...</div></div>;
  const aktDot={PRIJAVA:'blue',DODANA_GUMA:'green',PRODANA_GUMA:'green',PREMJESTENA_GUMA:'accent',EDITOVANA_GUMA:'accent',OBRISANA_GUMA:'red',DODAN_AUTO:'blue',PRODAT_AUTO:'green',OBRISAN_AUTO:'red'};
  const aktNaziv={PRIJAVA:'Prijava',DODANA_GUMA:'Dodana guma',PRODANA_GUMA:'Prodana guma',PREMJESTENA_GUMA:'Premještena',EDITOVANA_GUMA:'Izmijenjena guma',OBRISANA_GUMA:'Obrisana guma',DODAN_AUTO:'Dodan auto',PRODAT_AUTO:'Prodat auto',OBRISAN_AUTO:'Obrisan auto'};
  return(<div className="page">
    <div className="page-header">
      <div className="page-title">Dobrodošao, {user.username} 👋</div>
      <div className="page-sub">Pregled stanja — {new Date().toLocaleDateString('sr-Latn-RS',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div className="kpi-grid">
      <div className="kpi accent" style={{cursor:'pointer'}} onClick={()=>onNav('gume')}><div className="kpi-lbl">Gume na stanju</div><div className="kpi-val" style={{color:'var(--accent)'}}>{data.gume_stanje}</div><div className="kpi-sub">{data.gume_prodato} prodato ukupno</div></div>
      <div className="kpi green" style={{cursor:'pointer'}} onClick={()=>onNav('auta')}><div className="kpi-lbl">Auta na stanju</div><div className="kpi-val" style={{color:'var(--green)'}}>{data.auta_stanje}</div><div className="kpi-sub">{data.auta_prodato} prodato ukupno</div></div>
      {user.role==='admin'&&<div className="kpi blue" style={{cursor:'pointer'}} onClick={()=>onNav('zadaci')}><div className="kpi-lbl">Otvoreni zadaci</div><div className="kpi-val" style={{color:'var(--blue)'}}>{data.zadaci_otvoreno}</div><div className="kpi-sub">to-do lista</div></div>}
      {user.role==='admin'&&<div className="kpi purple" style={{cursor:'pointer'}} onClick={()=>onNav('troskovi')}><div className="kpi-lbl">U popravci</div><div className="kpi-val" style={{color:'var(--purple)'}}>{data.troskovi_aktivno}</div><div className="kpi-sub">auta na popravci</div></div>}
    </div>
    {data&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
      <div className="card-panel">
        <div className="section-title">Posljednje dodano — Gume</div>
        {(data.zadnje_gume||[]).length===0?<div style={{fontSize:12,color:'var(--muted)'}}>Nema guma</div>:
        (data.zadnje_gume||[]).map(g=><div key={g.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}} onClick={()=>onNav('gume')}>
          <div><div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14}}>{g.sirina}/{g.visina} {promjerDisp(g.promjer)}</div><div style={{fontSize:10,color:'var(--muted)'}}>{g.sifra} · {g.polica_kod}</div></div>
          <button className="btn-sm" onClick={e=>{e.stopPropagation();onNav('gume');}}>Pregledaj</button>
        </div>)}
      </div>
      <div className="card-panel">
        <div className="section-title">Posljednje dodano — Auta</div>
        {(data.zadnja_auta||[]).length===0?<div style={{fontSize:12,color:'var(--muted)'}}>Nema auta</div>:
        (data.zadnja_auta||[]).map(a=><div key={a.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}} onClick={()=>onNav('auta')}>
          <div><div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14}}>{a.marka} {a.model}</div><div style={{fontSize:10,color:'var(--muted)'}}>{a.sifra} · {a.godiste}</div></div>
          <button className="btn-sm" onClick={e=>{e.stopPropagation();onNav('auta');}}>Pregledaj</button>
        </div>)}
      </div>
    </div>}
    {user.role==='admin'&&<div className="card-panel" style={{marginTop:14}}>
      <div className="section-title">Posljednje aktivnosti</div>
      {(data.aktivnosti||[]).length===0?<div style={{fontSize:12,color:'var(--muted)'}}>Nema aktivnosti</div>:
      (data.aktivnosti||[]).map((a,i)=>{
        const dt=new Date(a.created_at);
        return(<div key={i} className="act-item">
          <div className={'act-dot '+(aktDot[a.akcija]||'accent')}/>
          <div className="act-body"><div className="act-main"><b>{a.korisnik}</b> — {aktNaziv[a.akcija]||a.akcija}{a.detalji&&<span style={{color:'var(--muted)'}}> · {a.detalji}</span>}</div></div>
          <div className="act-time">{timeAgo(a.created_at)}</div>
        </div>);
      })}
    </div>}
  </div>);
}

// ===== AUTA MODULE =====

export default Dashboard;
