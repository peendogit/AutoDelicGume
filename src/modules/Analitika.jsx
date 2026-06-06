import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../utils.js';
import { Icons } from '../components/index.jsx';

function AnalitikaModul({showToast}){
  const [data,setData]=useState(null);const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('pregled'); // pregled | abc | prognoza

  useEffect(()=>{
    api('/analitika').then(d=>{setData(d);setLoading(false);}).catch(e=>{showToast(e.message,'err');setLoading(false);});
  },[]);

  if(loading)return<div className="page"><div style={{color:'var(--muted)',padding:40,textAlign:'center'}}>Učitavanje...</div></div>;
  if(!data)return null;

  const ABC_BOJA={A:'var(--green)',B:'var(--accent)',C:'var(--muted)'};
  const ABC_BG={A:'rgba(63,185,80,.12)',B:'rgba(240,180,41,.12)',C:'rgba(255,255,255,.04)'};
  const ABC_OPIS={A:'80% prodaje — prioritet nabavke',B:'15% prodaje — pratiti',C:'5% prodaje — razmisliti o odustajanju'};

  const abcGrupe = {
    A: (data.abcAnaliza||[]).filter(r=>r.kategorija==='A'),
    B: (data.abcAnaliza||[]).filter(r=>r.kategorija==='B'),
    C: (data.abcAnaliza||[]).filter(r=>r.kategorija==='C'),
  };

  return(<div className="page">
    <div className="page-header"><div className="page-title">Analitika</div><div className="page-sub">Statistike, ABC analiza i prognoza</div></div>

    <div className="status-tabs" style={{marginBottom:14}}>
      <button className={'stab'+(tab==='pregled'?' as':'')} onClick={()=>setTab('pregled')}>📊 Pregled</button>
      <button className={'stab'+(tab==='abc'?' as':'')} onClick={()=>setTab('abc')}>🔤 ABC analiza</button>
      <button className={'stab'+(tab==='prognoza'?' as':'')} onClick={()=>setTab('prognoza')}>🔮 Prognoza</button>
    </div>

    {tab==='pregled'&&<>
      <div className="kpi-grid">
        <div className="kpi accent"><div className="kpi-lbl">Ukupno guma</div><div className="kpi-val" style={{color:'var(--accent)'}}>{data.ukupnoGuma}</div></div>
        <div className="kpi green"><div className="kpi-lbl">Na stanju</div><div className="kpi-val" style={{color:'var(--green)'}}>{data.naStan}</div></div>
        <div className="kpi purple"><div className="kpi-lbl">Prodato</div><div className="kpi-val" style={{color:'var(--purple)'}}>{data.prodatoCount}</div></div>
      </div>
      {data.topDimenzije&&data.topDimenzije.length>0&&<div className="card-panel">
        <div className="section-title">Top dimenzije</div>
        {data.topDimenzije.map((d,i)=><div key={d.dimenzija} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
          <span style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:11,color:'var(--muted)',width:18}}>{i+1}.</span>
          <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:16,flex:1,letterSpacing:'1px'}}>{d.dimenzija}</span>
          <span style={{fontSize:11,color:'var(--muted)'}}>Ukupno: <b style={{color:'var(--text)'}}>{d.ukupno}</b></span>
          <span style={{fontSize:11,color:'var(--muted)'}}>Stanje: <b style={{color:'var(--green)'}}>{d.na_stanju}</b></span>
          <span style={{fontSize:11,color:'var(--muted)'}}>Prod.: <b style={{color:'var(--purple)'}}>{d.prodato}</b></span>
        </div>)}
      </div>}
      {data.topRadnici&&data.topRadnici.length>0&&<div className="card-panel">
        <div className="section-title">Radnici</div>
        {data.topRadnici.map(r=><div key={r.korisnik} style={{display:'flex',alignItems:'center',gap:10,background:'var(--card)',borderRadius:5,padding:'7px 10px',marginBottom:5}}>
          <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14,flex:1}}>{r.korisnik}</span>
          <span style={{fontSize:11,color:'var(--muted)'}}>Dodao: <b style={{color:'var(--text)'}}>{r.dodao}</b></span>
          <span style={{fontSize:11,color:'var(--muted)'}}>Prodao: <b style={{color:'var(--green)'}}>{r.prodao}</b></span>
        </div>)}
      </div>}
      {data.prodajaPoSezonama&&<div className="card-panel">
        <div className="section-title">Po sezoni</div>
        {data.prodajaPoSezonama.map(s=><div key={s.sezona} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
          <span style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:13,fontWeight:700,width:70}}>{s.sezona}</span>
          <div style={{flex:1,background:'var(--card)',borderRadius:3,height:8,overflow:'hidden'}}>
            <div style={{height:'100%',width:(data.ukupnoGuma>0?(s.ukupno/data.ukupnoGuma*100):0)+'%',background:s.sezona==='Zimska'?'var(--blue)':'var(--accent)',borderRadius:3}}/>
          </div>
          <span style={{fontSize:11,color:'var(--muted)',width:80,textAlign:'right'}}>{s.ukupno} ({s.prodato} pr.)</span>
        </div>)}
      </div>}

    </>}

    {tab==='abc'&&<>
      {/* Objašnjenje */}
      <div style={{background:'rgba(88,166,255,.07)',border:'1px solid rgba(88,166,255,.2)',borderRadius:8,padding:'12px 16px',marginBottom:14,fontSize:12,color:'var(--muted)',lineHeight:1.6}}>
        <b style={{color:'var(--text)',display:'block',marginBottom:4}}>ABC analiza (Pareto princip)</b>
        <span style={{color:'var(--green)',fontWeight:700}}>A</span> dimenzije = 80% ukupne prodaje — uvijek drži na stanju<br/>
        <span style={{color:'var(--accent)',fontWeight:700}}>B</span> dimenzije = 15% prodaje — pratiti, nabavljati po potrebi<br/>
        <span style={{color:'var(--muted)',fontWeight:700}}>C</span> dimenzije = 5% prodaje — razmisliti, možda odustati
      </div>

      {/* KPI kartice */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
        {['A','B','C'].map(k=><div key={k} style={{background:ABC_BG[k],border:'1.5px solid '+ABC_BOJA[k]+'44',borderRadius:8,padding:'10px 14px',textAlign:'center'}}>
          <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:28,fontWeight:900,color:ABC_BOJA[k]}}>{k}</div>
          <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:20,fontWeight:800}}>{abcGrupe[k].length}</div>
          <div style={{fontSize:10,color:'var(--muted)'}}>dimenzija</div>
        </div>)}
      </div>

      {/* Tabela po grupama */}
      {['A','B','C'].map(k=>(
        abcGrupe[k].length>0&&<div key={k} className="card-panel" style={{marginBottom:10}}>
          <div className="section-title" style={{marginBottom:10}}>
            <span style={{color:ABC_BOJA[k],fontFamily:'Barlow Condensed,sans-serif',fontSize:18,fontWeight:900,marginRight:8}}>{k}</span>
            <span style={{fontSize:11,color:'var(--muted)',fontWeight:400,textTransform:'none',letterSpacing:0}}>{ABC_OPIS[k]}</span>
          </div>
          {abcGrupe[k].map(r=><div key={r.dimenzija} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
            <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:15,flex:1,letterSpacing:'1px'}}>{r.dimenzija}</span>
            <div style={{display:'flex',gap:3,alignItems:'center'}}>
              <div style={{width:60,height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:Math.min(100,r.prodato_kom/Math.max(...(data.abcAnaliza||[]).map(x=>x.prodato_kom),1)*100)+'%',background:ABC_BOJA[k],borderRadius:3}}/>
              </div>
            </div>
            <span style={{fontSize:11,color:'var(--muted)',width:55,textAlign:'right'}}>{r.prodato_kom} prod.</span>
            <span style={{fontSize:11,color:r.na_stanju>0?'var(--green)':'var(--red)',width:50,textAlign:'right'}}>{r.na_stanju} stanje</span>
          </div>)}
        </div>
      ))}
    </>}

    {tab==='prognoza'&&<>
      {/* Info */}
      <div style={{background:'rgba(188,140,255,.07)',border:'1px solid rgba(188,140,255,.2)',borderRadius:8,padding:'12px 16px',marginBottom:14,fontSize:12,color:'var(--muted)',lineHeight:1.6}}>
        <b style={{color:'var(--text)',display:'block',marginBottom:4}}>Prognoza prodaje</b>
        Bazirana na prosječnoj prodaji iz istorije. Prosječno prodaješ <b style={{color:'var(--text)'}}>{data.prosjecnaMjesecnaProdaja} kom/mj</b>.
        {data.prosjecnaMjesecnaProdaja===0&&<span style={{color:'var(--red)'}}> Nedovoljno podataka — unosite prodajne datume kod prodaje guma.</span>}
      </div>

      {/* Prognoza po sezonama */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:14}}>
        {(data.prognoza||[]).map(p=><div key={p.mj} style={{background:'var(--card)',border:'1.5px solid '+(p.ima_historiju?'var(--border)':'rgba(255,255,255,.06)'),borderRadius:8,padding:'12px 14px'}}>
          <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--muted)',marginBottom:4}}>{p.naziv}</div>
          <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:28,fontWeight:900,color:p.ima_historiju?'var(--purple)':'var(--muted)'}}>{p.prognoza_kom}</div>
          <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{p.ima_historiju?'kom (historija)':'kom (prosjek)'}</div>
          <div style={{marginTop:6,display:'inline-flex',alignItems:'center',gap:4,background:p.sezona==='Zimska'?'rgba(88,166,255,.15)':'rgba(240,180,41,.15)',borderRadius:3,padding:'2px 7px',fontFamily:'Barlow Condensed,sans-serif',fontSize:9,fontWeight:800,color:p.sezona==='Zimska'?'var(--blue)':'var(--accent)',letterSpacing:'1px',textTransform:'uppercase'}}>
            {p.sezona==='Zimska'?'❄ Zimska':'☀ Ljetna'}
          </div>
        </div>)}
      </div>

      {/* Historija prodaje - grafikon */}
      {(data.prodajaPoMjesecima||[]).length>0&&<div className="card-panel">
        <div className="section-title">Historija prodaje po mjesecima</div>
        <div style={{display:'flex',gap:4,alignItems:'flex-end',height:80,marginTop:10}}>
          {[...(data.prodajaPoMjesecima||[])].reverse().map(m=>{
            const max=Math.max(...(data.prodajaPoMjesecima||[]).map(x=>x.prodano),1);
            const h=Math.max(m.prodano>0?4:0,Math.round((m.prodano/max)*70));
            return(<div key={m.mj} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <div style={{fontSize:9,color:'var(--text)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700}}>{m.prodano||''}</div>
              <div style={{width:'100%',background:'var(--purple)',borderRadius:'3px 3px 0 0',height:h+'px'}} title={m.mj+': '+m.prodano+' prodano'}/>
              <span style={{fontSize:8,color:'var(--muted)',transform:'rotate(-45deg)',marginTop:2,whiteSpace:'nowrap'}}>{m.mj.slice(5)}</span>
            </div>);
          })}
        </div>
        <div style={{fontSize:10,color:'var(--muted)',marginTop:8,textAlign:'center'}}>Prikazano zadnjih 12 mjeseci</div>
      </div>}

      {/* Savjeti na osnovu ABC */}
      {abcGrupe.A.length>0&&<div className="card-panel">
        <div className="section-title">💡 Preporuke za nabavku</div>
        <div style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Na osnovu ABC analize, ove dimenzije trebaš imati uvijek na stanju:</div>
        {abcGrupe.A.filter(r=>r.na_stanju===0||r.na_stanju<2).map(r=><div key={r.dimenzija} style={{display:'flex',alignItems:'center',gap:10,background:'rgba(248,81,73,.07)',border:'1px solid rgba(248,81,73,.2)',borderRadius:6,padding:'8px 12px',marginBottom:6}}>
          <span style={{fontSize:16}}>⚠️</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:15}}>{r.dimenzija}</div>
            <div style={{fontSize:11,color:'var(--muted)'}}>A kategorija — {r.prodato_kom} prodanih, trenutno {r.na_stanju} na stanju</div>
          </div>
          <span style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:11,fontWeight:700,color:'var(--red)'}}>NABAVI!</span>
        </div>)}
        {abcGrupe.A.filter(r=>r.na_stanju===0||r.na_stanju<2).length===0&&
          <div style={{fontSize:12,color:'var(--green)'}}>✓ Sve A dimenzije su na stanju.</div>}
      </div>}
    </>}

    <div className="site-footer">© 2026 <span>DelicNode</span></div>
  </div>);
}

// ===== LOG MODULE =====
// ===== LOG MODULE =====

export default AnalitikaModul;
