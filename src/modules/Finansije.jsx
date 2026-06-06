import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api , fmtDate} from '../utils.js';
import { Icons } from '../components/index.jsx';

function FinansijeModul({showToast}){
  const [mainTab,setMainTab]=useState('pregled');
  const [data,setData]=useState(null);const [period,setPeriod]=useState('mjesec');const [loading,setLoading]=useState(false);
  const [listaTros,setListaTros]=useState([]);const [modalTros,setModalTros]=useState(false);
  const [formTros,setFormTros]=useState({kategorija:'',opis:'',iznos:'',datum:new Date().toISOString().slice(0,10)});
  const [filterMj,setFilterMj]=useState(new Date().toISOString().slice(0,7));
  const [redovni,setRedovni]=useState([]);const [modalRedovni,setModalRedovni]=useState(false);
  const [editRedovni,setEditRedovni]=useState(null);
  const [formR,setFormR]=useState({naziv:'',kategorija:'',iznos:'',dan_u_mjesecu:'1'});

  const KATEGORIJE=['Gorivo','Radnici','Režije (struja, voda)','Alat i oprema','Održavanje vozila','Zakup','Osiguranje','Knjigovođa','Ostalo'];
  const PERIOD_OPTS=[['danas','Danas'],['sedmica','7 dana'],['mjesec','Ovaj mj.'],['godina','Ova god.'],['sve','Sve']];

  const loadFin=async(p)=>{setLoading(true);try{const d=await api('/finansije?period='+p);setData(d);}catch(e){showToast(e.message,'err');}setLoading(false);};
  const loadTros=async()=>{try{const d=await api('/troskovi-otpada');setListaTros(d);}catch(e){}};
  const loadRedovni=async()=>{try{const d=await api('/redovni-troskovi');setRedovni(d);}catch(e){}};
  useEffect(()=>{loadFin(period);loadTros();loadRedovni();},[]);
  useEffect(()=>{loadFin(period);},[period]);

  const prihodGume=useMemo(()=>(!data?0:(data.gumeProdate||[]).reduce((s,g)=>s+(parseFloat(g.cijena_prodaje)||0),0)),[data]);
  const prihodAuta=useMemo(()=>(!data?0:(data.autaProdana||[]).reduce((s,a)=>s+(parseFloat(a.prodajna_cijena)||0),0)),[data]);
  const filteredTros=useMemo(()=>listaTros.filter(t=>!filterMj||t.datum.startsWith(filterMj)),[listaTros,filterMj]);
  const ukupniTros=useMemo(()=>filteredTros.reduce((s,t)=>s+(parseFloat(t.iznos)||0),0),[filteredTros]);
  const ukupnoRedovni=useMemo(()=>redovni.filter(r=>r.aktivan).reduce((s,r)=>s+(parseFloat(r.iznos)||0),0),[redovni]);
  const poKat=useMemo(()=>{const m={};filteredTros.forEach(t=>{m[t.kategorija]=(m[t.kategorija]||0)+(parseFloat(t.iznos)||0);});return Object.entries(m).sort((a,b)=>b[1]-a[1]);},[filteredTros]);
  const neto=prihodGume+prihodAuta-ukupniTros-ukupnoRedovni;
  const mjeseci=useMemo(()=>[...new Set(listaTros.map(t=>t.datum.slice(0,7)))].sort().reverse(),[listaTros]);

  const doAddTros=async()=>{
    if(!formTros.kategorija||!formTros.iznos){showToast('Kategorija i iznos su obavezni','err');return;}
    try{const t=await api('/troskovi-otpada',{method:'POST',body:formTros});setListaTros(p=>[t,...p]);setModalTros(false);setFormTros({kategorija:'',opis:'',iznos:'',datum:new Date().toISOString().slice(0,10)});showToast('Trošak dodan');}
    catch(e){showToast(e.message,'err');}
  };
  const doDelTros=async(id)=>{if(!window.confirm('Obrisati trošak?'))return;await api('/troskovi-otpada/'+id,{method:'DELETE'});setListaTros(p=>p.filter(t=>t.id!=id));};
  const doSaveRedovni=async()=>{
    if(!formR.naziv||!formR.iznos){showToast('Naziv i iznos su obavezni','err');return;}
    try{
      let r;
      if(editRedovni){r=await api('/redovni-troskovi/'+editRedovni.id,{method:'PUT',body:{...formR,aktivan:editRedovni.aktivan}});setRedovni(p=>p.map(x=>x.id===r.id?r:x));}
      else{r=await api('/redovni-troskovi',{method:'POST',body:formR});setRedovni(p=>[...p,r]);}
      setModalRedovni(false);setEditRedovni(null);setFormR({naziv:'',kategorija:'',iznos:'',dan_u_mjesecu:'1'});showToast('Sačuvano');
    }catch(e){showToast(e.message,'err');}
  };
  const doDelRedovni=async(id)=>{if(!window.confirm('Obrisati?'))return;await api('/redovni-troskovi/'+id,{method:'DELETE'});setRedovni(p=>p.filter(r=>r.id!=id));};
  const toggleRedovni=async(r)=>{const u=await api('/redovni-troskovi/'+r.id,{method:'PUT',body:{...r,aktivan:r.aktivan?0:1}});setRedovni(p=>p.map(x=>x.id===u.id?u:x));};

  return(<div className="page">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
      <div><div className="page-title">Finansije</div><div className="page-sub">Prihodi, troškovi i neto bilans</div></div>
      {mainTab==='troskovi'&&<button className="btn-add-main" onClick={()=>setModalTros(true)}><Icons.Plus size={13}/> Dodaj trošak</button>}
      {mainTab==='redovni'&&<button className="btn-add-main" onClick={()=>setModalRedovni(true)}><Icons.Plus size={13}/> Novi redovni</button>}
    </div>

    <div className="status-tabs" style={{marginBottom:14}}>
      <button className={"stab"+(mainTab==='pregled'?' as':'')} onClick={()=>setMainTab('pregled')}>Pregled</button>
      <button className={"stab"+(mainTab==='prihodi'?' as':'')} onClick={()=>setMainTab('prihodi')}>Prihodi</button>
      <button className={"stab"+(mainTab==='troskovi'?' as':'')} onClick={()=>setMainTab('troskovi')}>Troškovi</button>
      <button className={"stab"+(mainTab==='redovni'?' as':'')} onClick={()=>setMainTab('redovni')}>Redovni</button>
    </div>

    {mainTab==='pregled'&&<>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
        {PERIOD_OPTS.map(([v,l])=><button key={v} className={"stab"+(period===v?' as':'')} style={{flex:'none',padding:'5px 10px'}} onClick={()=>setPeriod(v)}>{l}</button>)}
      </div>
      {loading?<div style={{color:'var(--muted)',padding:20,textAlign:'center'}}>Učitavanje...</div>:data&&<>
        <div className="kpi-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))'}}>
          <div className="kpi green"><div className="kpi-lbl">Prihod gume</div><div className="kpi-val" style={{color:'var(--green)',fontSize:20}}>{prihodGume.toLocaleString('sr-Latn-RS')} KM</div><div className="kpi-sub">{(data.gumeProdate||[]).length} prodanih</div></div>
          <div className="kpi blue"><div className="kpi-lbl">Prihod auta</div><div className="kpi-val" style={{color:'var(--blue)',fontSize:20}}>{prihodAuta.toLocaleString('sr-Latn-RS')} KM</div><div className="kpi-sub">{(data.autaProdana||[]).length} prodanih</div></div>
          <div className="kpi red"><div className="kpi-lbl">Jednokratni troš.</div><div className="kpi-val" style={{color:'var(--red)',fontSize:20}}>{ukupniTros.toLocaleString('sr-Latn-RS')} KM</div></div>
          <div className="kpi red" style={{opacity:.75}}><div className="kpi-lbl">Redovni /mj</div><div className="kpi-val" style={{color:'var(--red)',fontSize:20}}>{ukupnoRedovni.toLocaleString('sr-Latn-RS')} KM</div></div>
          <div style={{gridColumn:'1/-1',background:neto>=0?'rgba(63,185,80,.08)':'rgba(248,81,73,.08)',border:'2px solid '+(neto>=0?'rgba(63,185,80,.3)':'rgba(248,81,73,.3)'),borderRadius:'var(--radius)',padding:'14px 16px'}}>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:9,fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',color:'var(--muted)',marginBottom:4}}>NETO (prihodi − svi troškovi)</div>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:32,fontWeight:900,color:neto>=0?'var(--green)':'var(--red)'}}>{neto.toLocaleString('sr-Latn-RS')} KM</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:7,padding:'10px 14px'}}>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:9,fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',color:'var(--muted)',marginBottom:4}}>Lager gume</div>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:20,fontWeight:900,color:'var(--accent)'}}>{((data.gumeStanje&&data.gumeStanje.vrijednost)||0).toLocaleString('sr-Latn-RS')} KM</div>
            <div style={{fontSize:10,color:'var(--muted)'}}>{(data.gumeStanje&&data.gumeStanje.count)||0} kom</div>
          </div>
          <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:7,padding:'10px 14px'}}>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:9,fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',color:'var(--muted)',marginBottom:4}}>Lager auta</div>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:20,fontWeight:900,color:'var(--accent)'}}>{((data.autaStanje&&data.autaStanje.vrijednost)||0).toLocaleString('sr-Latn-RS')} KM</div>
            <div style={{fontSize:10,color:'var(--muted)'}}>{(data.autaStanje&&data.autaStanje.count)||0} vozila</div>
          </div>
        </div>
      </>}
    </>}

    {mainTab==='prihodi'&&<>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
        {PERIOD_OPTS.map(([v,l])=><button key={v} className={"stab"+(period===v?' as':'')} style={{flex:'none',padding:'5px 10px'}} onClick={()=>setPeriod(v)}>{l}</button>)}
      </div>
      {loading?<div style={{color:'var(--muted)',padding:20,textAlign:'center'}}>Učitavanje...</div>:data&&<>
        <div className="kpi-grid">
          <div className="kpi green"><div className="kpi-lbl">Gume</div><div className="kpi-val" style={{color:'var(--green)',fontSize:22}}>{prihodGume.toLocaleString('sr-Latn-RS')} KM</div></div>
          <div className="kpi blue"><div className="kpi-lbl">Auta</div><div className="kpi-val" style={{color:'var(--blue)',fontSize:22}}>{prihodAuta.toLocaleString('sr-Latn-RS')} KM</div></div>
          <div className="kpi accent"><div className="kpi-lbl">Ukupno</div><div className="kpi-val" style={{color:'var(--accent)',fontSize:22}}>{(prihodGume+prihodAuta).toLocaleString('sr-Latn-RS')} KM</div></div>
        </div>
        {(data.gumeProdate||[]).length>0&&<div className="card-panel">
          <div className="section-title">Prodane gume ({(data.gumeProdate||[]).length})</div>
          <div style={{maxHeight:250,overflowY:'auto'}}>
            {(data.gumeProdate||[]).map((g,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid var(--border)',fontSize:12}}>
              <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,width:50,color:'var(--accent)'}}>{g.sifra}</span>
              <span style={{flex:1,color:'var(--muted)'}}>{g.sirina}/{g.visina} {promjerDisp(g.promjer)} {g.sezona}</span>
              <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,color:'var(--green)'}}>{g.cijena_prodaje||'—'}</span>
              <span style={{fontSize:10,color:'var(--muted)',width:55,textAlign:'right'}}>{fmtDate(g.datum_prodaje)}</span>
            </div>)}
          </div>
        </div>}
        {(data.autaProdana||[]).length>0&&<div className="card-panel">
          <div className="section-title">Prodana auta ({(data.autaProdana||[]).length})</div>
          <div style={{maxHeight:200,overflowY:'auto'}}>
            {(data.autaProdana||[]).map((a,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid var(--border)',fontSize:12}}>
              <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,width:55,color:'var(--accent)'}}>{a.sifra}</span>
              <span style={{flex:1}}>{a.marka} {a.model}{a.godiste?' ('+a.godiste+')':''}</span>
              {a.nabavna_cijena&&<span style={{color:'var(--red)',fontSize:11}}>{a.nabavna_cijena} KM</span>}
              <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,color:'var(--green)'}}>{a.prodajna_cijena||'—'} KM</span>
            </div>)}
          </div>
        </div>}
      </>}
    </>}

    {mainTab==='troskovi'&&<>
      <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:9,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--muted)'}}>Mj:</span>
        <button className={"stab"+(filterMj===''?' as':'')} style={{flex:'none',padding:'4px 10px'}} onClick={()=>setFilterMj('')}>Svi</button>
        {mjeseci.slice(0,6).map(m=><button key={m} className={"stab"+(filterMj===m?' as':'')} style={{flex:'none',padding:'4px 10px'}} onClick={()=>setFilterMj(m)}>{m}</button>)}
      </div>
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',marginBottom:12}}>
        <div className="kpi red" style={{padding:'8px 12px'}}><div className="kpi-lbl">Ukupno</div><div className="kpi-val" style={{color:'var(--red)',fontSize:20}}>{ukupniTros.toLocaleString('sr-Latn-RS')} KM</div></div>
        {poKat.slice(0,3).map(([k,v])=><div key={k} className="kpi" style={{padding:'8px 12px'}}><div className="kpi-lbl">{k}</div><div className="kpi-val" style={{fontSize:16}}>{v.toLocaleString('sr-Latn-RS')} KM</div></div>)}
      </div>
      {filteredTros.length===0?<div className="empty"><Icons.Money size={36}/><p>Nema troškova za ovaj period.</p></div>:
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        {filteredTros.map(t=><div key={t.id} style={{display:'flex',alignItems:'center',gap:10,background:'var(--card)',border:'1px solid var(--border)',borderRadius:6,padding:'9px 12px'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:1}}>
              <span style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:800}}>{t.kategorija}</span>
              {t.opis&&<span style={{fontSize:11,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.opis}</span>}
            </div>
            <div style={{fontSize:10,color:'var(--muted)'}}>{fmtDate(t.datum)} · {t.korisnik}</div>
          </div>
          <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:16,fontWeight:900,color:'var(--red)',flexShrink:0}}>{parseFloat(t.iznos).toLocaleString('sr-Latn-RS')} KM</div>
          <button className="del-btn" onClick={()=>doDelTros(t.id)}><Icons.Trash/></button>
        </div>)}
      </div>}
    </>}

    {mainTab==='redovni'&&<>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <div className="kpi red" style={{padding:'10px 14px'}}><div className="kpi-lbl">Aktivnih / mj</div><div className="kpi-val" style={{color:'var(--red)',fontSize:22}}>{ukupnoRedovni.toLocaleString('sr-Latn-RS')} KM</div><div className="kpi-sub">{redovni.filter(r=>r.aktivan).length} stavki</div></div>
        <div className="kpi" style={{padding:'10px 14px'}}><div className="kpi-lbl">Godišnje</div><div className="kpi-val" style={{fontSize:22}}>{(ukupnoRedovni*12).toLocaleString('sr-Latn-RS')} KM</div></div>
      </div>
      {redovni.length===0?<div className="empty"><Icons.Money size={36}/><p>Nema redovnih troškova.</p></div>:
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {redovni.map(r=><div key={r.id} style={{display:'flex',alignItems:'center',gap:10,background:'var(--card)',border:'1.5px solid '+(r.aktivan?'var(--border)':'rgba(255,255,255,.04)'),borderRadius:7,padding:'10px 14px',opacity:r.aktivan?1:.5}}>
          <div onClick={()=>toggleRedovni(r)} style={{width:20,height:20,borderRadius:'50%',border:'2px solid '+(r.aktivan?'var(--green)':'var(--border)'),background:r.aktivan?'var(--green)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            {r.aktivan?<Icons.Check size={10}/>:null}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:14,fontWeight:800}}>{r.naziv}</div>
            <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{r.kategorija} · {r.dan_u_mjesecu}. u mj.</div>
          </div>
          <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:16,fontWeight:900,color:r.aktivan?'var(--red)':'var(--muted)',flexShrink:0}}>{parseFloat(r.iznos).toLocaleString('sr-Latn-RS')} KM</div>
          <button className="del-btn" style={{color:'var(--blue)',opacity:1}} onClick={()=>{setEditRedovni(r);setFormR({naziv:r.naziv,kategorija:r.kategorija,iznos:String(r.iznos),dan_u_mjesecu:String(r.dan_u_mjesecu)});setModalRedovni(true);}}><Icons.Edit/></button>
          <button className="del-btn" onClick={()=>doDelRedovni(r.id)}><Icons.Trash/></button>
        </div>)}
      </div>}
    </>}

    {modalTros&&<div className="overlay" onClick={()=>setModalTros(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Novi trošak <button className="btn-close" onClick={()=>setModalTros(false)}>x</button></div>
      <div className="fg2"><label>Kategorija *</label><select value={formTros.kategorija} onChange={e=>setFormTros(f=>({...f,kategorija:e.target.value}))}><option value="">— Odaberi —</option>{KATEGORIJE.map(k=><option key={k} value={k}>{k}</option>)}</select></div>
      <div className="fg2"><label>Opis</label><input placeholder="Detalji..." value={formTros.opis} onChange={e=>setFormTros(f=>({...f,opis:e.target.value}))}/></div>
      <div className="two-col">
        <div className="fg2"><label>Iznos (KM) *</label><div className="price-row"><input className="price-inp" type="number" min="0" step="0.5" placeholder="0" value={formTros.iznos} onChange={e=>setFormTros(f=>({...f,iznos:e.target.value}))}/><span className="price-curr">KM</span></div></div>
        <div className="fg2"><label>Datum</label><input type="date" value={formTros.datum} onChange={e=>setFormTros(f=>({...f,datum:e.target.value}))}/></div>
      </div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>setModalTros(false)}>Odustani</button><button className="btn-save" onClick={doAddTros}>Dodaj</button></div>
    </div></div>}

    {modalRedovni&&<div className="overlay" onClick={()=>{setModalRedovni(false);setEditRedovni(null);}}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{editRedovni?'Uredi redovni':'Novi redovni'} <button className="btn-close" onClick={()=>{setModalRedovni(false);setEditRedovni(null);}}>x</button></div>
      <div className="fg2"><label>Naziv *</label><input autoFocus value={formR.naziv} onChange={e=>setFormR(f=>({...f,naziv:e.target.value}))} placeholder="npr. Zakup hale"/></div>
      <div className="fg2"><label>Kategorija</label><select value={formR.kategorija} onChange={e=>setFormR(f=>({...f,kategorija:e.target.value}))}><option value="">— Odaberi —</option>{KATEGORIJE.map(k=><option key={k} value={k}>{k}</option>)}</select></div>
      <div className="two-col">
        <div className="fg2"><label>Iznos / mj (KM) *</label><div className="price-row"><input className="price-inp" type="number" min="0" placeholder="0" value={formR.iznos} onChange={e=>setFormR(f=>({...f,iznos:e.target.value}))}/><span className="price-curr">KM</span></div></div>
        <div className="fg2"><label>Dan u mj.</label><input type="number" min="1" max="31" placeholder="1" value={formR.dan_u_mjesecu} onChange={e=>setFormR(f=>({...f,dan_u_mjesecu:e.target.value}))}/></div>
      </div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>{setModalRedovni(false);setEditRedovni(null);}}>Odustani</button><button className="btn-save" onClick={doSaveRedovni}>{editRedovni?'Sačuvaj':'Dodaj'}</button></div>
    </div></div>}

    <div className="site-footer">© 2026 DelicNode</div>
  </div>);
}


// ===== KUPCI MODULE =====

// ===== ADMIN APP =====

export default FinansijeModul;
