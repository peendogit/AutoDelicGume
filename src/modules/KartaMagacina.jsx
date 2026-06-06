import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../utils.js';
import { Icons } from '../components/index.jsx';

function KartaMagacinaInline({showToast,magacini:magaciniProp}){
  const [police,setPolice]=useState([]);
  const [magaciniData,setMagaciniData]=useState([]);
  const [gumeCount,setGumeCount]=useState({});const [selMag,setSelMag]=useState(null);
  const [selPolica,setSelPolica]=useState(null);const [policaGume,setPolicaGume]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    Promise.all([api('/magacini-full'),api('/police'),api('/gume')]).then(([m,p,g])=>{
      setMagaciniData(m);setPolice(p);
      const cnt={};g.filter(x=>!x.prodato).forEach(guma=>{cnt[guma.polica_kod]=(cnt[guma.polica_kod]||0)+1;});
      setGumeCount(cnt);setLoading(false);
      if(m.length>0)setSelMag(m[0].id);
      setMagaciniData(m);
    }).catch(e=>{showToast(e.message,'err');setLoading(false);});
  },[]);

  const selMagData=useMemo(()=>magaciniData.find(m=>m.id===selMag),[magaciniData,selMag]);

  const loadPolicaGume=async(naziv)=>{
    setSelPolica(naziv);
    try{const g=await api('/police/'+encodeURIComponent(naziv)+'/gume');setPolicaGume(g);}
    catch(e){showToast(e.message,'err');}
  };

  const getColor=(naziv)=>{
    const cnt=gumeCount[naziv]||0;
    if(cnt===0)return{bg:'rgba(255,255,255,.04)',border:'var(--border)',color:'var(--muted)'};
    if(cnt<=3)return{bg:'rgba(63,185,80,.12)',border:'rgba(63,185,80,.4)',color:'var(--green)'};
    if(cnt<=7)return{bg:'rgba(240,180,41,.12)',border:'rgba(240,180,41,.4)',color:'var(--accent)'};
    return{bg:'rgba(248,81,73,.12)',border:'rgba(248,81,73,.4)',color:'var(--red)'};
  };

  if(loading)return<div className="page"><div style={{color:'var(--muted)',padding:40,textAlign:'center'}}>Učitavanje...</div></div>;

  return(<div className="page">
    <div className="page-header"><div className="page-title">Karta magacina</div><div className="page-sub">Vizuelni pregled popunjenosti polica</div></div>

    {/* Legenda */}
    <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
      {[['Prazna','rgba(255,255,255,.04)','var(--border)','var(--muted)'],['1-3 gume','rgba(63,185,80,.12)','rgba(63,185,80,.4)','var(--green)'],['4-7 guma','rgba(240,180,41,.12)','rgba(240,180,41,.4)','var(--accent)'],['8+ guma','rgba(248,81,73,.12)','rgba(248,81,73,.4)','var(--red)']].map(([l,bg,brd,col])=>(
        <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
          <div style={{width:14,height:14,background:bg,border:'1.5px solid '+brd,borderRadius:3}}/>
          <span style={{fontSize:10,color:'var(--muted)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700}}>{l}</span>
        </div>
      ))}
    </div>

    {/* Magacin tabs */}
    {magaciniData.length>1&&<div className="status-tabs" style={{marginBottom:14}}>
      {magaciniData.map(m=><button key={m.id} className={"stab"+(selMag===m.id?' as':'')} onClick={()=>setSelMag(m.id)}>{m.naziv}</button>)}
    </div>}

    {selMagData&&selMagData.prolazi.map(pr=><div key={pr.id} style={{marginBottom:16}}>
      <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:11,fontWeight:800,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--blue)',marginBottom:8}}>{pr.naziv}</div>
      {pr.regali.map(r=><div key={r.id} style={{marginBottom:8}}>
        <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:9,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--muted)',marginBottom:5}}>{r.naziv}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
          {r.police.map(p=>{
            const cnt=gumeCount[p.naziv]||0;
            const col=getColor(p.naziv);
            return(<button key={p.id} onClick={()=>loadPolicaGume(p.naziv)}
              style={{background:col.bg,border:'1.5px solid '+(selPolica===p.naziv?'var(--accent)':col.border),borderRadius:6,padding:'6px 10px',cursor:'pointer',minWidth:52,textAlign:'center',transition:'all .15s'}}>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:13,color:selPolica===p.naziv?'var(--accent)':col.color}}>{p.naziv}</div>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:10,fontWeight:700,color:'var(--muted)'}}>{cnt>0?cnt+'x':'—'}</div>
            </button>);
          })}
        </div>
      </div>)}
    </div>)}

    {/* Polica detalj */}
    {selPolica&&<div style={{marginTop:8,background:'var(--surf)',border:'1.5px solid var(--accent)',borderRadius:10,padding:'14px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:16,color:'var(--accent)'}}>{selPolica} — {policaGume.length} guma</div>
        <button className="btn-close" onClick={()=>setSelPolica(null)}>×</button>
      </div>
      {policaGume.length===0?<div style={{fontSize:12,color:'var(--muted)'}}>Polica je prazna.</div>:
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        {policaGume.map(g=><div key={g.id} style={{display:'flex',alignItems:'center',gap:10,background:'var(--card)',borderRadius:6,padding:'6px 10px',fontSize:12}}>
          <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,color:'var(--accent)',width:45}}>{g.sifra}</span>
          <span style={{flex:1,fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,fontSize:14}}>{g.sirina}/{g.visina} {promjerDisp(g.promjer)}</span>
          <span style={{fontSize:10,color:g.sezona==='Zimska'?'var(--blue)':'var(--accent)'}}>{g.sezona==='Zimska'?'❄':'☀'}</span>
          {g.cijena&&<span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,color:'var(--green)',fontSize:12}}>{g.cijena} KM</span>}
        </div>)}
      </div>}
    </div>}
    <div className="site-footer">© 2026 <span>DelicNode</span></div>
  </div>);
}


const KartaMagacinaModul = KartaMagacinaInline;

export default KartaMagacinaInline;
