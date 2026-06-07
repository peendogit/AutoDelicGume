import React, { useState, useEffect } from 'react';
import { api, promjerDisp, timeAgo } from '../utils.js';

function Dashboard({user,onNav,showToast}){
  const [data,setData]=useState(null);
  useEffect(()=>{const load=()=>api('/dashboard').then(setData).catch(e=>{if(e.message&&e.message.includes('fetch'))setTimeout(load,1500);});load();},[]);
  if(!data)return <div className="page"><div style={{color:'var(--muted)',padding:40,textAlign:'center',fontFamily:'Barlow Condensed,sans-serif',letterSpacing:2,textTransform:'uppercase',fontSize:13}}>Učitavanje...</div></div>;
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
        {(data.zadnje_gume||[]).length===0
          ?<div style={{fontSize:12,color:'var(--muted)'}}>Nema guma</div>
          :(data.zadnje_gume||[]).map(g=><div key={g.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}} onClick={()=>onNav('gume')}>
            <div><div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14}}>{g.sirina}/{g.visina} {promjerDisp(g.promjer)}</div><div style={{fontSize:10,color:'var(--muted)'}}>{g.sifra} · {g.polica_kod}</div></div>
            <button className="btn-sm" onClick={e=>{e.stopPropagation();onNav('gume');}}>Pregledaj</button>
          </div>)
        }
      </div>
      <div className="card-panel">
        <div className="section-title">Otvoreni zadaci</div>
        {(data.zadnji_zadaci||[]).length===0
          ?<div style={{fontSize:12,color:'var(--muted)'}}>Nema otvorenih zadataka 🎉</div>
          :(data.zadnji_zadaci||[]).map(z=>{
            const priColor=z.prioritet==='visok'?'var(--red)':z.prioritet==='srednji'?'var(--accent)':'var(--muted)';
            return(<div key={z.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}} onClick={()=>onNav('zadaci')}>
              <div style={{width:6,height:6,borderRadius:'50%',background:priColor,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{z.naslov}</div>
                <div style={{fontSize:10,color:'var(--muted)'}}>{z.dodao_korisnik}</div>
              </div>
              <div style={{fontSize:10,color:priColor,fontWeight:700,flexShrink:0,textTransform:'uppercase'}}>{z.prioritet}</div>
            </div>);
          })
        }
        {(data.zadnji_zadaci||[]).length>0&&<button className="btn-sm" style={{width:'100%',marginTop:6,justifyContent:'center'}} onClick={()=>onNav('zadaci')}>Svi zadaci →</button>}
      </div>
    </div>}
  </div>);
}

// ===== AUTA MODULE =====

export default Dashboard;
