import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, promjerDisp, tipLbl, statusLbl, timeAgo, resizeImage } from '../utils.js';
import { ErrorBoundary, ComboBox, useImageUpload, Lightbox, ImgUploadUI, Pagination } from '../components/index.jsx';

function PremjestanjeWidget({showToast,police:policeProp}){
  const [sifre,setSifre]=useState('');
  const [policaKod,setPolicaKod]=useState('');
  const [police,setPolice]=useState(policeProp||[]);
  const [rezultat,setRezultat]=useState(null);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{if(!policeProp||policeProp.length===0)api('/police').then(setPolice).catch(()=>{});},[]);

  const policaMatch=useMemo(()=>{
    if(!policaKod.trim())return null;
    return police.find(p=>p.naziv.toLowerCase()===policaKod.trim().toLowerCase())||null;
  },[policaKod,police]);

  const doMove=async()=>{
    const lista=sifre.split(/[\n,\s]+/).map(s=>s.trim().toUpperCase()).filter(Boolean);
    if(!lista.length){showToast('Unesite šifre guma','err');return;}
    if(!policaMatch){showToast('Polica ne postoji','err');return;}
    setLoading(true);
    try{
      const r=await api('/gume/batch-premjesti',{method:'POST',body:{sifre:lista,policaKod:policaMatch.naziv}});
      setRezultat(r);
      showToast(r.uspjesno+' od '+lista.length+' guma premješteno na '+policaMatch.naziv);
      if(r.uspjesno===lista.length){setSifre('');setPolicaKod('');}
    }catch(e){showToast(e.message,'err');}
    setLoading(false);
  };

  return(<div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
      <div className="fg2" style={{marginBottom:0}}>
        <label>Šifre guma (jedna ili više)</label>
        <textarea style={{width:'100%',background:'var(--card)',border:'1.5px solid var(--border)',borderRadius:5,color:'var(--text)',fontFamily:'Barlow Condensed,sans-serif',fontSize:13,fontWeight:700,padding:'8px 10px',outline:'none',resize:'vertical',minHeight:72,letterSpacing:'1px',textTransform:'uppercase'}}
          placeholder={"GU10\nGU11\nGU12"} value={sifre} onChange={e=>setSifre(e.target.value)}/>
        <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>Razdvoji enterom, zarezom ili razmakom</div>
      </div>
      <div className="fg2" style={{marginBottom:0}}>
        <label>Nova polica</label>
        <input style={{width:'100%',background:'var(--card)',border:'1.5px solid '+(policaKod.trim()?(policaMatch?'var(--green)':'var(--red)'):'var(--border)'),borderRadius:5,color:'var(--text)',fontFamily:'Barlow Condensed,sans-serif',fontSize:16,fontWeight:800,padding:'8px 10px',outline:'none',letterSpacing:'1px',textTransform:'uppercase'}}
          placeholder="P10" value={policaKod} onChange={e=>setPolicaKod(e.target.value.toUpperCase())}/>
        {policaKod.trim()&&policaMatch&&<div style={{fontSize:10,color:'var(--green)',marginTop:3}}>✓ {policaMatch.magacin_naziv} › {policaMatch.prolaz_naziv} › {policaMatch.regal_naziv}</div>}
        {policaKod.trim()&&!policaMatch&&<div style={{fontSize:10,color:'var(--red)',marginTop:3}}>Polica ne postoji</div>}
        {!policaKod.trim()&&police.length>0&&<div style={{fontSize:9,color:'var(--muted)',marginTop:3}}>Dostupne: {police.slice(0,8).map(p=>p.naziv).join(', ')}{police.length>8&&'...'}</div>}
      </div>
    </div>
    <button className="btn-add-main" style={{width:'100%',justifyContent:'center'}} onClick={doMove} disabled={loading||!policaMatch||!sifre.trim()}>
      {loading?'Premještanje...':'📦 Premjesti gume'}
    </button>
    {rezultat&&<div style={{marginTop:10,background:'var(--card)',borderRadius:6,padding:'10px 12px'}}>
      <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--muted)',marginBottom:6}}>Rezultat premještanja</div>
      {rezultat.rezultati.map((r,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,padding:'3px 0'}}>
        <span style={{color:r.ok?'var(--green)':'var(--red)',fontSize:14}}>{r.ok?'✓':'✗'}</span>
        <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:700}}>{r.sifra}</span>
        <span style={{color:'var(--muted)'}}>{r.ok?'→ '+r.polica_nova:r.greska}</span>
      </div>)}
    </div>}
  </div>);
}


// ===== KUPCI MODULE =====

export default PremjestanjeWidget;
