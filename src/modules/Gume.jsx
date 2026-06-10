import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, promjerDisp, tipLbl, statusLbl, timeAgo, resizeImage, EMPTY_GUMA, PROMJER_OPTIONS, SIRINA_OPTIONS, VISINA_OPTIONS } from '../utils.js';
import { Icons, ErrorBoundary, ComboBox, useImageUpload, Lightbox, ImgUploadUI, Pagination } from '../components/index.jsx';
import PremjestanjeWidget from './Premjestanje.jsx';

function GumeModul({user,showToast,gume,setGume,police,magacini,loadPolice,lightbox,setLightbox,quickAdd,onQuickAddDone,openGumaId,onOpenGumaDone}){
  const isAdmin=user.role==='admin';
  const [statusTab,setStatusTab]=useState('stanje');
  const [filters,setFilters]=useState({sezona:'',sirina:'',visina:'',promjer:'',sifra:'',tip:''});
  const [modal,setModal]=useState(null);const [editingId,setEditingId]=useState(null);
  const [gumaPage,setGumaPage]=useState(1);const GUME_PER_PAGE=30;
  useEffect(()=>{setGumaPage(1);},[filters,statusTab]);
  const [detailG,setDetailG]=useState(null);const [sellModal,setSellModal]=useState(false);
  const [sellPrice,setSellPrice]=useState('');
  const [form,setForm]=useState({...EMPTY_GUMA});
  const [submitAttempted,setSubmitAttempted]=useState(false);
  const [savingGuma,setSavingGuma]=useState(false);
  const [moveModal,setMoveModal]=useState(null);const [moveKod,setMoveKod]=useState('');
  const [showHistorija,setShowHistorija]=useState(false);const [historijaGuma,setHistorijaGuma]=useState([]);
  const [nalogModal,setNalogModal]=useState(null);const [nalogForm,setNalogForm]=useState({napomena:'',hitno:false,za_slanje:false});const [nalogSaving,setNalogSaving]=useState(false);
  const [gumeSaNalogom,setGumeSaNalogom]=useState(new Set());
  const loadNalozi=useCallback(async()=>{try{const d=await api('/nalozi');if(Array.isArray(d)){setGumeSaNalogom(new Set(d.filter(n=>n.status!=='zavrseno').map(n=>n.guma_id)));}}catch(e){}},[]);
  useEffect(()=>{if(isAdmin)loadNalozi();},[isAdmin,loadNalozi]);
  const [customSirina,setCustomSirina]=useState(()=>{try{return JSON.parse(localStorage.getItem('adg_sirina')||'[]');}catch{return [];}});
  const [customVisina,setCustomVisina]=useState(()=>{try{return JSON.parse(localStorage.getItem('adg_visina')||'[]');}catch{return [];}});
  const [customPromjer,setCustomPromjer]=useState(()=>{try{return JSON.parse(localStorage.getItem('adg_promjer')||'[]');}catch{return [];}});
  const [policaSearch,setPolicaSearch]=useState(false);
  const [premjestanjeOpen,setPremjestanjeOpen]=useState(false);
  const [policaSearchVal,setPolicaSearchVal]=useState('');
  const [policaGume,setPolicaGume]=useState(null);
  const imgHook=useImageUpload([]);

  useEffect(()=>{if(quickAdd){openAdd();onQuickAddDone&&onQuickAddDone();}},[ quickAdd]);
  useEffect(()=>{
    if(openGumaId){
      const g=gume.find(x=>x.id===openGumaId);
      if(g){setDetailG(g);onOpenGumaDone&&onOpenGumaDone();}
    }
  },[openGumaId,gume]);

  const sirina_opts=useMemo(()=>[...SIRINA_OPTIONS,...customSirina].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>parseInt(a)-parseInt(b)),[customSirina]);
  const visina_opts=useMemo(()=>[...VISINA_OPTIONS,...customVisina].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>parseInt(a)-parseInt(b)),[customVisina]);
  const promjer_opts=useMemo(()=>[...PROMJER_OPTIONS,...customPromjer].filter((v,i,a)=>a.indexOf(v)===i),[customPromjer]);

  const filtered=useMemo(()=>gume.filter(g=>{
    if(statusTab==='stanje'&&g.prodato)return false;if(statusTab==='prodato'&&!g.prodato)return false;
    if(filters.sezona&&g.sezona!==filters.sezona)return false;if(filters.tip&&g.tip!==filters.tip)return false;
    if(filters.sirina&&!g.sirina.includes(filters.sirina))return false;if(filters.visina&&!g.visina.includes(filters.visina))return false;
    if(filters.promjer&&!g.promjer.includes(filters.promjer))return false;if(filters.sifra&&!g.sifra.toLowerCase().includes(filters.sifra.toLowerCase()))return false;
    return true;
  }),[gume,statusTab,filters]);

  const stanjeCount=useMemo(()=>gume.filter(g=>!g.prodato).length,[gume]);
  const prodatoCount=useMemo(()=>gume.filter(g=>g.prodato).length,[gume]);
  const policaMatch=useMemo(()=>{if(!form.policaKod.trim())return null;return police.find(p=>p.naziv.toLowerCase()===form.policaKod.trim().toLowerCase())||null;},[form.policaKod,police]);
  const canSave=form.sezona&&form.sirina&&form.visina&&form.promjer&&policaMatch&&!imgHook.uploadState.uploading&&!imgHook.uploadingRef.current&&!savingGuma;

  const nextGuNum=useMemo(()=>{const max=gume.reduce((m,x)=>{const n=parseInt(x.sifra.replace('GU',''))||0;return n>m?n:m;},9);return max+1;},[gume]);

  const openAdd=()=>{setForm({...EMPTY_GUMA});imgHook.setSlike([]);setEditingId(null);setSubmitAttempted(false);setModal('form');};
  const openEdit=(g)=>{setForm({sezona:g.sezona,sirina:g.sirina,visina:g.visina,promjer:g.promjer,napomena:g.napomena||'',policaKod:g.polica_kod||'',dubina:g.dubina||'',dot:g.dot||'',tip:g.tip||'',cijena:g.cijena||''});imgHook.setSlike(g.slike?[...g.slike]:[]);setEditingId(g.id);setDetailG(null);setSubmitAttempted(false);setModal('form');};

  const doSellAuto=async()=>{
    try{
      const updated=await api('/auta/'+detail.id,{method:'PUT',body:{...detail,slike:detail.slike,status:'prodat',prodajna_cijena:sellAutoPrice||detail.prodajna_cijena}});
      setAuta(p=>p.map(a=>a.id===updated.id?updated:a));
      setSellAutoModal(false);setDetail(null);setSellAutoPrice('');
      showToast(detail.marka+' '+detail.model+' označen kao prodat');
    }catch(e){showToast(e.message,'err');}
  };

  const doSave=async()=>{
    setSubmitAttempted(true);if(!canSave||savingGuma)return;setSavingGuma(true);
    try{
      const body={sezona:form.sezona,sirina:form.sirina,visina:form.visina,promjer:form.promjer,napomena:form.napomena,policaKod:policaMatch.naziv,slike:imgHook.slike||[],dubina:form.dubina||null,dot:form.dot||null,tip:form.tip||null,cijena:form.cijena||null};
      let g;
      if(editingId){g=await api('/gume/'+editingId,{method:'PUT',body});setGume(p=>p.map(x=>x.id===g.id?g:x));showToast('Guma ažurirana');}
      else{g=await api('/gume',{method:'POST',body});setGume(p=>[g,...p]);showToast('Guma '+g.sifra+' dodana');}
      setModal(null);setSubmitAttempted(false);
    }catch(e){showToast(e.message,'err');}setSavingGuma(false);
  };

  const doSell=async()=>{
    try{const g=await api('/gume/'+detailG.id+'/prodaj',{method:'POST',body:{cijena:sellPrice}});setGume(p=>p.map(x=>x.id===g.id?g:x));setSellModal(false);setDetailG(null);showToast(g.sifra+' prodana'+(g.cijena_prodaje?' za '+g.cijena_prodaje:''));}
    catch(e){showToast(e.message,'err');}
  };

  const doDel=async(id)=>{if(!window.confirm('Da li ste sigurni da želite obrisati ovu gumu? Ova akcija se ne može poništiti.'))return;await api('/gume/'+id,{method:'DELETE'});setGume(p=>p.filter(g=>g.id!=id));setDetailG(null);showToast('Guma obrisana');};

  const doMove=async()=>{
    const pm=police.find(p=>p.naziv.toLowerCase()===moveKod.trim().toLowerCase());
    if(!pm){showToast('Polica "'+moveKod+'" ne postoji','err');return;}
    try{const g=await api('/gume/'+moveModal.id+'/premjesti',{method:'POST',body:{policaKod:pm.naziv}});setGume(p=>p.map(x=>x.id===g.id?g:x));if(detailG&&detailG.id===g.id)setDetailG(g);setMoveModal(null);setMoveKod('');showToast('Guma premještena na policu '+pm.naziv);}
    catch(e){showToast(e.message,'err');}
  };

  const loadHistorija=async(id)=>{try{const h=await api('/gume/'+id+'/historija');setHistorijaGuma(h);setShowHistorija(true);}catch(e){showToast(e.message,'err');}};

  const TIP_OPTS=[{v:'',l:'Svi tipovi'},{v:'komad',l:'Komad (1)'},{v:'par',l:'Par (2)'},{v:'set',l:'Set (4)'}];

      return(<div className="page">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
      <div><div className="page-title">Gume</div><div className="page-sub">Pretraga i upravljanje · <span style={{cursor:"pointer",color:"var(--blue)",fontSize:11}} onClick={()=>setPolicaSearch(s=>!s)}>🔍 pretraga po polici</span></div></div>
      <button className="btn-add-main" onClick={openAdd}><Icons.Plus size={13}/> Dodaj gumu</button>
    </div>

    {/* PRETRAGA PO POLICI — skrivena */}
    {policaSearch&&<div style={{background:'rgba(88,166,255,.08)',border:'1.5px solid rgba(88,166,255,.3)',borderRadius:8,padding:'12px 14px',marginBottom:10,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
      <span style={{fontSize:12,color:'var(--blue)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',flexShrink:0}}>🔍 Polica:</span>
      <input style={{flex:1,minWidth:80,background:'var(--card)',border:'1.5px solid var(--border)',borderRadius:5,color:'var(--text)',fontFamily:'Barlow,sans-serif',fontSize:13,padding:'6px 9px',outline:'none'}}
        placeholder="npr. P10" value={policaSearchVal} onChange={e=>setPolicaSearchVal(e.target.value.toUpperCase())}
        onKeyDown={async e=>{
          if(e.key==='Enter'&&policaSearchVal.trim()){
            try{const g=await api('/police/'+encodeURIComponent(policaSearchVal.trim())+'/gume');setPolicaGume(g);}
            catch(err){showToast(err.message,'err');}
          }
        }}/>
      <button className="btn-new" onClick={async()=>{if(!policaSearchVal.trim())return;try{const g=await api('/police/'+encodeURIComponent(policaSearchVal.trim())+'/gume');setPolicaGume(g);}catch(err){showToast(err.message,'err');}}}>Traži</button>
      {policaGume!==null&&<button style={{background:'none',border:'1px solid var(--border)',color:'var(--muted)',borderRadius:4,padding:'4px 8px',cursor:'pointer',fontSize:11}} onClick={()=>{setPolicaGume(null);setPolicaSearchVal('');}}>× Zatvori</button>}
    </div>}
    {policaGume!==null&&<div style={{background:'var(--surf)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px',marginBottom:10}}>
      <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:11,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--muted)',marginBottom:8}}>Polica {policaSearchVal} — {policaGume.length} guma</div>
      {policaGume.length===0?<div style={{fontSize:12,color:'var(--muted)'}}>Nema guma na ovoj polici</div>:
      <div className="tire-grid">{policaGume.map(g=><div key={g.id} className="tire-card" onClick={()=>setDetailG(g)}>
        <div className="tire-thumb">{g.slike&&g.slike.length>0?<img src={g.slike[0]} alt="" loading="lazy"/>:<Icons.Tire size={30}/>}</div>
        <span className={'bs '+(g.sezona==='Zimska'?'z':'l')} style={{fontSize:8,padding:'1px 4px'}}>{g.sezona==='Zimska'?'❄':'☀'}</span>
        <span className="bsif" style={{fontSize:8}}>{g.sifra}</span>
        <div className="tire-info"><div className="tire-size" style={{fontSize:14}}>{g.sirina}/{g.visina} {promjerDisp(g.promjer)}</div></div>
      </div>)}</div>}
    </div>}
    {/* FILTERI */}
    <div className="sf-wrap">
      <div className="sf-grid">
        <div className="fg sf-full"><label>Interna šifra</label><input placeholder="npr. GU10" value={filters.sifra} onChange={e=>setFilters(f=>({...f,sifra:e.target.value}))}/></div>
        <div className="fg"><label>Sezona</label><select value={filters.sezona} onChange={e=>setFilters(f=>({...f,sezona:e.target.value}))}><option value="">Sve</option><option>Zimska</option><option>Ljetna</option></select></div>
        <div className="fg"><label>Tip</label><select value={filters.tip} onChange={e=>setFilters(f=>({...f,tip:e.target.value}))}>{TIP_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
        <div className="fg"><label>Širina (mm)</label><select value={filters.sirina} onChange={e=>setFilters(f=>({...f,sirina:e.target.value}))}><option value="">Sve</option>{sirina_opts.map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg"><label>Profil (%)</label><select value={filters.visina} onChange={e=>setFilters(f=>({...f,visina:e.target.value}))}><option value="">Sve</option>{visina_opts.map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg"><label>Prečnik</label><select value={filters.promjer} onChange={e=>setFilters(f=>({...f,promjer:e.target.value}))}><option value="">Sve</option>{promjer_opts.map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg"><button style={{width:'100%',background:'var(--border)',border:'none',color:'var(--muted)',borderRadius:5,fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',padding:'8px',cursor:'pointer'}} onClick={()=>setFilters({sezona:'',sirina:'',visina:'',promjer:'',sifra:'',tip:''})}>↺ Poništi</button></div>
      </div>
    </div>

    <div className="status-tabs">
      <button className={'stab'+(statusTab==='stanje'?' as':'')} onClick={()=>setStatusTab('stanje')}>Na stanju ({stanjeCount})</button>
      <button className={'stab'+(statusTab==='prodato'?' ap':'')} onClick={()=>setStatusTab('prodato')}>Prodato ({prodatoCount})</button>
    </div>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginBottom:8}}>
      <div className="res-count" style={{marginBottom:0}}>Prikazano: <b>{filtered.length}</b> guma</div>
      <button style={{background:'none',border:'1px solid var(--border)',color:'var(--muted)',borderRadius:5,fontFamily:'Barlow Condensed,sans-serif',fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',padding:'4px 10px',cursor:'pointer'}} onClick={()=>setPremjestanjeOpen(p=>!p)}>
        📦 Premještanje guma
      </button>
    </div>
    {premjestanjeOpen&&<div className="card-panel" style={{marginBottom:12}}>
      <div className="section-title" style={{marginBottom:10}}>📦 Premještanje guma</div>
      <PremjestanjeWidget showToast={showToast} police={police}/>
    </div>}

    {filtered.length===0?<div className="empty"><Icons.Tire size={40}/><p>{gume.length===0?'Nema guma. Dodaj prvu!':'Nema rezultata.'}</p></div>:
    <div className="tire-grid">
      {filtered.slice((gumaPage-1)*GUME_PER_PAGE,gumaPage*GUME_PER_PAGE).map(g=><div key={g.id} className={'tire-card'+(g.prodato?' sold':'')} onClick={()=>setDetailG(g)}>
        <div className="tire-thumb">{g.slike&&g.slike.length>0?<img src={g.slike[0]} alt="" loading="lazy"/>:<Icons.Tire size={34}/>}</div>
        <span className={'bs '+(g.sezona==='Zimska'?'z':'l')}>{g.sezona==='Zimska'?'❄':'☀'} {g.sezona}</span>
        <span className="bsif">{g.sifra}</span>
        {g.tip&&<span className={'tip-badge tip-'+g.tip} style={{position:'absolute',bottom:g.prodato?22:7,right:7}}>{g.tip==='komad'?'1 kom':g.tip==='par'?'2 kom':'4 kom'}</span>}
        {g.prodato&&<div className="bsold">Prodato{g.datum_prodaje?' · '+g.datum_prodaje:''}</div>}
        <div className="tire-info">
          <div className="tire-size">{g.sirina}/{g.visina} {promjerDisp(g.promjer)}</div>
          <div className="tire-cod">{g.sifra}</div>
          <div className="tire-loc">{g.loc_magacin?`${g.loc_magacin} › ${g.loc_prolaz} › ${g.loc_regal} › ${g.polica_kod}`:g.polica_kod||'—'}</div>
        </div>
      </div>)}
    </div>}
    <Pagination page={gumaPage} total={filtered.length} perPage={GUME_PER_PAGE} onChange={p=>{setGumaPage(p);window.scrollTo(0,0);}}/>

    {/* DETAIL */}
    {detailG&&!sellModal&&!lightbox&&<div className="overlay" onClick={()=>setDetailG(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{detailG.sirina}/{detailG.visina} {promjerDisp(detailG.promjer)} <button className="btn-close" onClick={()=>setDetailG(null)}>×</button></div>
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12,flexWrap:'wrap'}}>
        <span className={'bs '+(detailG.sezona==='Zimska'?'z':'l')} style={{position:'static',display:'inline-flex'}}>{detailG.sezona==='Zimska'?'❄':'☀'} {detailG.sezona}</span>
        <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:17,color:'var(--accent)',letterSpacing:2}}>{detailG.sifra}</span>
        {detailG.tip&&<span className={'tip-badge tip-'+detailG.tip}>{tipLbl(detailG.tip)}</span>}
      </div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'flex-start',gap:8,marginBottom:8,flexWrap:'wrap'}}>
        {detailG.slike&&detailG.slike.length>0&&<div className="det-imgs" style={{marginBottom:0}}>{detailG.slike.map((s,i)=><img key={i} className="thumb" src={s} onClick={()=>setLightbox({images:detailG.slike,index:i})}/>)}</div>}
        {!detailG.prodato&&isAdmin&&(gumeSaNalogom.has(detailG.id)
          ?<button className="btn-sm" disabled style={{color:'var(--muted)',borderColor:'var(--border)',fontWeight:700,flexShrink:0,fontSize:'1.3em',padding:'10.4px 15.6px',opacity:0.6,cursor:'not-allowed'}}>📋 Nalog poslan</button>
          :<button className="btn-sm" style={{color:'var(--accent)',borderColor:'rgba(255,165,0,.3)',fontWeight:700,flexShrink:0,fontSize:'1.3em',padding:'10.4px 15.6px'}} onClick={e=>{e.stopPropagation();setNalogModal(detailG);setNalogForm({napomena:'',hitno:false,za_slanje:false});}}>📋 Nalog</button>
        )}
      </div>
      {detailG.cijena&&<div style={{background:'rgba(240,180,41,.08)',border:'1px solid rgba(240,180,41,.25)',borderRadius:6,padding:'8px 12px',marginBottom:9,display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:10,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--muted)'}}>Cijena</span><span style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:20,fontWeight:900,color:'var(--accent)',letterSpacing:'1px'}}>{detailG.cijena} KM</span></div>}
      <div className="specs-grid">
        <div className="spec-box"><div className="spec-lbl">Širina</div><div className="spec-val">{detailG.sirina} mm</div></div>
        <div className="spec-box"><div className="spec-lbl">Profil</div><div className="spec-val">{detailG.visina}%</div></div>
        <div className="spec-box"><div className="spec-lbl">Prečnik</div><div className="spec-val">{promjerDisp(detailG.promjer)}"</div></div>
        <div className="spec-box"><div className="spec-lbl">Šifra</div><div className="spec-val" style={{color:'var(--accent)'}}>{detailG.sifra}</div></div>
      </div>
      {(detailG.dubina||detailG.dot)&&<div style={{display:'flex',gap:7,marginBottom:8,flexWrap:'wrap'}}>
        {detailG.dubina&&<div className="spec-box" style={{flex:1}}><div className="spec-lbl">Dubina šare</div><div className="spec-val" style={{fontSize:16}}>{detailG.dubina} mm</div></div>}
        {detailG.dot&&<div className="spec-box" style={{flex:1}}><div className="spec-lbl">Godina (DOT)</div><div className="spec-val" style={{fontSize:16}}>{detailG.dot}</div></div>}
      </div>}
      {detailG.polica_kod&&<div className="loc-box" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <span>📍 {detailG.loc_magacin&&`${detailG.loc_magacin} › ${detailG.loc_prolaz} › ${detailG.loc_regal} › `}{detailG.polica_kod}</span>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          <button className="btn-sm" onClick={()=>loadHistorija(detailG.id)} title="Historija premještanja" style={{padding:'4px 8px'}}><Icons.History/></button>
          {!detailG.prodato&&<button className="btn-sm" style={{color:'var(--blue)',borderColor:'rgba(88,166,255,.3)',padding:'4px 8px'}} onClick={()=>{setMoveModal(detailG);setMoveKod('');setDetailG(null);}}><Icons.Move/></button>}
        </div>
      </div>
      {detailG.prodato&&<div className="sold-box">Prodato{detailG.datum_prodaje?' · '+detailG.datum_prodaje:''}{detailG.cijena_prodaje&&<span style={{marginLeft:'auto',fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:14}}>{detailG.cijena_prodaje}</span>}</div>}
      {detailG.napomena&&<><div className="sec-lbl">Napomena</div><p style={{fontSize:12,color:'var(--muted)',lineHeight:1.6}}>{detailG.napomena}</p></>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8,fontSize:10,color:'var(--muted)'}}>
        {detailG.dodao_korisnik&&<span>Dodao: <b style={{color:'var(--text)'}}>{detailG.dodao_korisnik}</b></span>}
        {detailG.prodao_korisnik&&<span>· Prodao: <b style={{color:'var(--text)'}}>{detailG.prodao_korisnik}</b></span>}
      </div>
      <div className="modal-foot">
        {isAdmin&&<div className="foot-left"><button className="btn-sm red" onClick={()=>doDel(detailG.id)}><Icons.Trash/> Obriši</button></div>}
        {!detailG.prodato&&<button className="btn-sm" onClick={()=>openEdit(detailG)}><Icons.Edit/> Uredi</button>}
        {!detailG.prodato&&<button className="btn-save" onClick={()=>setSellModal(true)} style={{background:'var(--green)',color:'#fff'}}>Prodaj</button>}
        {detailG.prodato&&<button className="btn-cancel" onClick={()=>setDetailG(null)}>Zatvori</button>}
      </div>
    </div></div>}

    {/* SELL */}
    {detailG&&sellModal&&<div className="overlay" onClick={()=>setSellModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Prodaj gumu <button className="btn-close" onClick={()=>setSellModal(false)}>×</button></div>
      <div className="sell-box"><p>Prodaješ: <strong>{detailG.sifra} — {detailG.sirina}/{detailG.visina} {promjerDisp(detailG.promjer)} ({detailG.sezona})</strong></p>
        <div className="fg2" style={{marginTop:10}}><label>Prodajna cijena (opcionalno)</label>
          <div className="price-row"><input className="price-inp" type="number" placeholder="0" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} autoFocus onKeyDown={e=>e.key==='Enter'&&doSell()}/><span className="price-curr">KM</span></div>
        </div>
      </div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>setSellModal(false)}>Odustani</button><button className="btn-save" style={{background:'var(--green)',color:'#fff'}} onClick={doSell}>{sellPrice?'Prodaj za '+sellPrice+' KM':'Potvrdi prodaju'}</button></div>
    </div></div>}

    {/* MOVE */}
    {moveModal&&<div className="overlay" onClick={()=>setMoveModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Premjesti gumu <button className="btn-close" onClick={()=>setMoveModal(null)}>×</button></div>
      <p style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>Guma <b style={{color:'var(--text)'}}>{moveModal.sifra}</b> trenutno je na polici <b style={{color:'var(--accent)'}}>{moveModal.polica_kod||'—'}</b></p>
      {(()=>{const pm=police.find(p=>p.naziv.toLowerCase()===moveKod.trim().toLowerCase());return(<div className="fg2">
        <label>Nova šifra police</label>
        <input className={moveKod.trim()?(pm?'ok':'err'):''} autoFocus placeholder="npr. P15" value={moveKod} onChange={e=>setMoveKod(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doMove()}/>
        {moveKod.trim()&&pm&&<div className="ph ok"><Icons.Check size={10}/> {pm.magacin_naziv} › {pm.prolaz_naziv} › {pm.regal_naziv} › {pm.naziv}</div>}
        {moveKod.trim()&&!pm&&<div className="ph err">Polica ne postoji</div>}
        {!moveKod.trim()&&police.length>0&&<div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>Dostupne: {police.map(p=>p.naziv).join(', ')}</div>}
      </div>);})()}
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>setMoveModal(null)}>Odustani</button><button className="btn-save" onClick={doMove}>Premjesti</button></div>
    </div></div>}

    {/* HISTORIJA */}
    {showHistorija&&<div className="overlay" onClick={()=>setShowHistorija(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Historija premještanja <button className="btn-close" onClick={()=>setShowHistorija(false)}>×</button></div>
      <div style={{maxHeight:'60vh',overflowY:'auto'}}>
        {historijaGuma.length===0?<div style={{textAlign:'center',padding:'30px 0',color:'var(--muted)',fontSize:13}}>Guma nije premještana</div>:
        historijaGuma.map((h,i)=>{const dt=new Date(h.created_at);return(<div key={i} className="log-item">
          <span className="log-badge PREMJESTENA_GUMA">📦</span>
          <div style={{flex:1}}><div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:13,fontWeight:800}}>{h.polica_sa||'—'} → {h.polica_na}</div><div className="log-detail">Premjestio: <b style={{color:'var(--text)'}}>{h.korisnik}</b></div></div>
          <span className="log-time">{dt.toLocaleDateString('sr-Latn-RS')} {dt.toLocaleTimeString('sr-Latn-RS',{hour:'2-digit',minute:'2-digit'})}</span>
        </div>);})}
      </div>
    </div></div>}

    {/* FORM */}
    {modal==='form'&&<div className="overlay" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{editingId?'Uredi gumu':'Dodaj gumu'} <button className="btn-close" onClick={()=>setModal(null)}>×</button></div>
      {!editingId&&<div className="sifra-prev"><span>Šifra:</span> GU{nextGuNum}</div>}
      <div className="fg2"><label>Sezona *</label><select value={form.sezona} onChange={e=>setForm(f=>({...f,sezona:e.target.value}))}><option value="">— Odaberi —</option><option>Zimska</option><option>Ljetna</option></select></div>
      <div className="two-col">
        <div className="fg2"><label>Širina (mm) *</label><ComboBox value={form.sirina} onChange={v=>setForm(f=>({...f,sirina:v}))} options={sirina_opts} placeholder="Širina..."/></div>
        <div className="fg2"><label>Profil (%) *</label><ComboBox value={form.visina} onChange={v=>setForm(f=>({...f,visina:v}))} options={visina_opts} placeholder="Profil..."/></div>
      </div>
      <div className="fg2"><label>Prečnik *</label><ComboBox value={form.promjer} onChange={v=>setForm(f=>({...f,promjer:v.toUpperCase()}))} options={promjer_opts} placeholder="Prečnik..." normalize={v=>v.toUpperCase()}/></div>
      <div className="fg2"><label>Tip</label><select value={form.tip} onChange={e=>setForm(f=>({...f,tip:e.target.value}))}><option value="">— Odaberi —</option><option value="komad">Komad (1 kom)</option><option value="par">Par (2 kom)</option><option value="set">Set (4 kom)</option></select></div>
      <div className="fg2">
        <label>Šifra police *</label>
        <input className={form.policaKod.trim()?(policaMatch?'ok':'err'):''} placeholder="npr. P10" value={form.policaKod} onChange={e=>setForm(f=>({...f,policaKod:e.target.value}))} autoComplete="off"/>
        {form.policaKod.trim()&&policaMatch&&<div className="ph ok"><Icons.Check size={10}/> {policaMatch.magacin_naziv} › {policaMatch.prolaz_naziv} › {policaMatch.regal_naziv} › {policaMatch.naziv}</div>}
        {form.policaKod.trim()&&!policaMatch&&<div className="ph err">Polica ne postoji</div>}
        {!form.policaKod.trim()&&police.length>0&&<div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>Dostupne: {police.map(p=>p.naziv).join(', ')}</div>}
        {submitAttempted&&!policaMatch&&<div style={{marginTop:4,padding:'6px 9px',borderRadius:4,fontSize:11,background:'rgba(248,81,73,.1)',border:'1.5px solid rgba(248,81,73,.5)',color:'var(--red)',fontWeight:600}}>Polica je obavezna i mora postojati u sistemu</div>}
      </div>
      <div className="fg2"><label>Napomena</label><textarea placeholder="Stanje, opis..." value={form.napomena} onChange={e=>setForm(f=>({...f,napomena:e.target.value}))}/></div>
      <div className="two-col">
        <div className="fg2"><label>Dubina šare (mm)</label><input type="number" step="0.5" min="0" max="12" placeholder="npr. 7.5" value={form.dubina} onChange={e=>setForm(f=>({...f,dubina:e.target.value}))}/></div>
        <div className="fg2"><label>Godina (DOT)</label><input type="number" min="2000" max="2099" placeholder="npr. 2022" value={form.dot} onChange={e=>setForm(f=>({...f,dot:e.target.value}))}/></div>
      </div>
      {isAdmin&&<div className="fg2"><label>Cijena (KM)</label>
        <div className="price-row"><input className="price-inp" type="number" min="0" step="0.5" placeholder="0.00" value={form.cijena} onChange={e=>setForm(f=>({...f,cijena:e.target.value}))}/><span className="price-curr">KM</span></div>
      </div>}
      <ImgUploadUI {...imgHook} onThumbClick={i=>setLightbox({images:imgHook.slike,index:i})}/>
      <div className="modal-foot">
        <button className="btn-cancel" onClick={()=>setModal(null)}>Odustani</button>
        <button className="btn-save" onClick={doSave} disabled={!canSave}>{imgHook.uploadState.uploading?'Čekaj slanje...':editingId?'Sačuvaj izmjene':'Sačuvaj gumu'}</button>
      </div>
    </div></div>}

    {nalogModal&&<div className="overlay" onClick={()=>setNalogModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Pošalji nalog <button className="btn-close" onClick={()=>setNalogModal(null)}>×</button></div>
      <div style={{padding:'4px 0 8px',fontSize:13,color:'var(--muted)'}}>Guma: <b style={{color:'var(--text)'}}>{nalogModal.sifra}</b> — {nalogModal.sirina}/{nalogModal.visina}</div>
      <div className="fg2">
        <label>Napomena</label>
        <input value={nalogForm.napomena} onChange={e=>setNalogForm(f=>({...f,napomena:e.target.value}))} placeholder="npr. donesi do 14h, spremi za Marka..."/>
      </div>
      <div style={{display:'flex',gap:16,marginTop:10}}>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
          <input type="checkbox" checked={nalogForm.hitno} onChange={e=>setNalogForm(f=>({...f,hitno:e.target.checked}))}/>
          <span style={{color:'var(--red)',fontWeight:700}}>🔴 Hitno</span>
        </label>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
          <input type="checkbox" checked={nalogForm.za_slanje} onChange={e=>setNalogForm(f=>({...f,za_slanje:e.target.checked}))}/>
          <span style={{color:'var(--blue)',fontWeight:700}}>📦 Za slanje</span>
        </label>
      </div>
      <div className="modal-foot">
        <button className="btn-cancel" onClick={()=>setNalogModal(null)}>Odustani</button>
        <button className="btn-save" disabled={nalogSaving} onClick={async()=>{
          setNalogSaving(true);
          try{
            const tok=localStorage.getItem('adg_token');
            await fetch('/api/nalozi',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({
              guma_id:nalogModal.id,
              guma_sifra:nalogModal.sifra,
              guma_opis:nalogModal.sirina+'/'+nalogModal.visina+' '+nalogModal.promjer+' '+nalogModal.sezona,
              guma_lokacija:nalogModal.loc_magacin?(nalogModal.loc_magacin+' › '+nalogModal.loc_prolaz+' › '+nalogModal.loc_regal+' › '+(nalogModal.polica_kod||'')):(nalogModal.polica_kod||''),
              guma_slika:(nalogModal.slike&&nalogModal.slike[0])||'',
              napomena:nalogForm.napomena,
              hitno:nalogForm.hitno,
              za_slanje:nalogForm.za_slanje
            })});
            showToast('Nalog poslan!');
            setGumeSaNalogom(s=>new Set([...s,nalogModal.id]));
            setNalogModal(null);
          }catch(e){showToast('Greška: '+e.message,'err');}
          setNalogSaving(false);
        }}>Pošalji nalog</button>
      </div>
    </div></div>}
  <div className="site-footer">© 2026 <span>DelicNode</span></div>
  </div>);
}


export default GumeModul;
