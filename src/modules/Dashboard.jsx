import React, { useState, useEffect } from 'react';
import { api, promjerDisp } from '../utils.js';
import { Pagination } from '../components/index.jsx';

function Dashboard({user,onNav,showToast}){
  const [data,setData]=useState(null);
  const [pageProd,setPageProd]=useState(1);
  const [pageGume,setPageGume]=useState(1);
  const [pageZad,setPageZad]=useState(1);
  const [pageNal,setPageNal]=useState(1);
  const PER_PAGE=5;
  useEffect(()=>{const load=()=>api('/dashboard').then(setData).catch(e=>{if(e.message&&e.message.includes('fetch'))setTimeout(load,1500);});load();},[]);
  const [nalozi,setNalozi]=useState([]);
  const loadNalozi=()=>{if(user.role==='admin'){api('/nalozi').then(d=>{if(Array.isArray(d))setNalozi(d);}).catch(e=>{});}};
  useEffect(()=>{loadNalozi();},[user.role]);
  useEffect(()=>{
    const handler=()=>loadNalozi();
    window.addEventListener('nalozi-changed',handler);
    return()=>window.removeEventListener('nalozi-changed',handler);
  },[user.role]);
  if(!data)return <div className="page"><div style={{color:'var(--muted)',padding:40,textAlign:'center',fontFamily:'Barlow Condensed,sans-serif',letterSpacing:2,textTransform:'uppercase',fontSize:13}}>Učitavanje...</div></div>;
  const prod24=data.prodaja_24h||[];
  const prihod24=prod24.reduce((s,g)=>s+(parseFloat(g.cijena_prodaje)||0),0);
  return(<div className="page">
    <div className="page-header">
      <div className="page-title">Dobrodošao, {user.username} 👋</div>
      <div className="page-sub">Pregled stanja — {new Date().toLocaleDateString('sr-Latn-RS',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div className="card-panel" style={{marginBottom:14}}>
      <div className="section-title">Prodaja — zadnja 24h</div>
      {prod24.length===0
        ?<div style={{fontSize:12,color:'var(--muted)'}}>Nema prodaje u zadnja 24h</div>
        :<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:11,color:'var(--muted)'}}>{prod24.length} kom prodano</span>
            <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,color:'var(--green)',fontSize:16}}>{prihod24.toLocaleString('sr-Latn-RS')} KM</span>
          </div>
          {prod24.slice((pageProd-1)*PER_PAGE,pageProd*PER_PAGE).map((g,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:13}}>{g.sirina}/{g.visina} {promjerDisp(g.promjer)} {g.sezona}</div>
              <div style={{fontSize:10,color:'var(--muted)'}}>{g.sifra} · {g.prodao_korisnik||'—'}</div>
            </div>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,color:'var(--green)',flexShrink:0,fontSize:13}}>{g.cijena_prodaje}</div>
          </div>)}
          <Pagination page={pageProd} total={prod24.length} perPage={PER_PAGE} onChange={setPageProd}/>
        </>
      }
    </div>

    {user.role==='admin'&&nalozi.length>0&&<div className="card-panel" style={{marginBottom:14}}>
      <div className="section-title">Aktivni nalozi ({nalozi.length})</div>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {nalozi.slice((pageNal-1)*PER_PAGE,pageNal*PER_PAGE).map(n=>(
          <div key={n.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)',cursor:'pointer',opacity:n.status==='zavrseno'?0.75:1}} onClick={()=>onNav('gume',n.guma_id)}>
            <div style={{width:6,height:6,borderRadius:'50%',background:n.status==='zavrseno'?'var(--green)':n.hitno?'var(--red)':n.za_slanje?'#e3b341':'var(--accent)',flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:13}}>{n.guma_sifra} — {n.guma_opis}</div>
              <div style={{fontSize:10,color:n.status==='zavrseno'?'var(--green)':'var(--muted)'}}>
                {n.status==='zavrseno' ? '✓ Spremno' : n.status==='preuzeto' ? 'Preuzeo: '+n.preuzeo : 'Čeka preuzimanje'} · {n.kreirao}
              </div>
            </div>
            {n.hitno&&n.status!=='zavrseno'?<span style={{background:'var(--red)',color:'#fff',fontSize:9,fontWeight:900,padding:'1px 6px',borderRadius:4}}>HITNO</span>:null}
          </div>
        ))}
      </div>
      <Pagination page={pageNal} total={nalozi.length} perPage={PER_PAGE} onChange={setPageNal}/>
      <button className="btn-sm" style={{width:'100%',marginTop:8,justifyContent:'center'}} onClick={()=>onNav('nalozi')}>Svi nalozi →</button>
    </div>}

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
      <div className="card-panel">
        <div className="section-title">Posljednje dodano — Gume</div>
        {(data.zadnje_gume||[]).length===0
          ?<div style={{fontSize:12,color:'var(--muted)'}}>Nema guma</div>
          :<>
            {(data.zadnje_gume||[]).slice((pageGume-1)*PER_PAGE,pageGume*PER_PAGE).map(g=><div key={g.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}} onClick={()=>onNav('gume')}>
              <div><div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14}}>{g.sirina}/{g.visina} {promjerDisp(g.promjer)}</div><div style={{fontSize:10,color:'var(--muted)'}}>{g.sifra} · {g.polica_kod}</div></div>
              <button className="btn-sm" onClick={e=>{e.stopPropagation();onNav('gume');}}>Pregledaj</button>
            </div>)}
            <Pagination page={pageGume} total={(data.zadnje_gume||[]).length} perPage={PER_PAGE} onChange={setPageGume}/>
          </>
        }
      </div>
      <div className="card-panel">
        <div className="section-title">Otvoreni zadaci</div>
        {(data.zadnji_zadaci||[]).length===0
          ?<div style={{fontSize:12,color:'var(--muted)'}}>Nema otvorenih zadataka 🎉</div>
          :<>
            {(data.zadnji_zadaci||[]).slice((pageZad-1)*PER_PAGE,pageZad*PER_PAGE).map(z=>{
              const priColor=z.prioritet==='visok'?'var(--red)':z.prioritet==='srednji'?'var(--accent)':'var(--muted)';
              return(<div key={z.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}} onClick={()=>onNav('zadaci')}>
                <div style={{width:6,height:6,borderRadius:'50%',background:priColor,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{z.naslov}</div>
                  <div style={{fontSize:10,color:'var(--muted)'}}>{z.dodao_korisnik}</div>
                </div>
                <div style={{fontSize:10,color:priColor,fontWeight:700,flexShrink:0,textTransform:'uppercase'}}>{z.prioritet}</div>
              </div>);
            })}
            <Pagination page={pageZad} total={(data.zadnji_zadaci||[]).length} perPage={PER_PAGE} onChange={setPageZad}/>
          </>
        }
        {(data.zadnji_zadaci||[]).length>0&&<button className="btn-sm" style={{width:'100%',marginTop:6,justifyContent:'center'}} onClick={()=>onNav('zadaci')}>Svi zadaci →</button>}
      </div>
    </div>

    <div className="kpi-grid">
      <div className="kpi accent" style={{cursor:'pointer'}} onClick={()=>onNav('gume')}><div className="kpi-lbl">Gume na stanju</div><div className="kpi-val" style={{color:'var(--accent)'}}>{data.gume_stanje}</div><div className="kpi-sub">{data.gume_prodato} prodato ukupno</div></div>
      <div className="kpi green" style={{cursor:'pointer'}} onClick={()=>onNav('auta')}><div className="kpi-lbl">Auta na stanju</div><div className="kpi-val" style={{color:'var(--green)'}}>{data.auta_stanje}</div><div className="kpi-sub">{data.auta_prodato} prodato ukupno</div></div>
      {user.role==='admin'&&<div className="kpi blue" style={{cursor:'pointer'}} onClick={()=>onNav('zadaci')}><div className="kpi-lbl">Otvoreni zadaci</div><div className="kpi-val" style={{color:'var(--blue)'}}>{data.zadaci_otvoreno}</div><div className="kpi-sub">to-do lista</div></div>}
      {user.role==='admin'&&<div className="kpi purple" style={{cursor:'pointer'}} onClick={()=>onNav('troskovi')}><div className="kpi-lbl">U popravci</div><div className="kpi-val" style={{color:'var(--purple)'}}>{data.troskovi_aktivno}</div><div className="kpi-sub">auta na popravci</div></div>}
    </div>

  </div>);
}

export default Dashboard;
