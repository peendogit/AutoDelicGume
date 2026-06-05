import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, promjerDisp, tipLbl, statusLbl, timeAgo, resizeImage } from '../utils.js';
import { ErrorBoundary, ComboBox, useImageUpload, Lightbox, ImgUploadUI, Pagination } from '../components/index.jsx';

function AutaModul({user,showToast,quickAdd,onQuickAddDone}){
  const isAdmin=user.role==='admin';
  const [auta,setAuta]=useState([]);const [loading,setLoading]=useState(true);
  const [statusFilter,setStatusFilter]=useState('');
  const [autaPage,setAutaPage]=useState(1);
  useEffect(()=>{setAutaPage(1);},[statusFilter]);
  const [modal,setModal]=useState(null);
  const [detail,setDetail]=useState(null);
  const [lightbox,setLightbox]=useState(null);
  const [troskoviAuta,setTroskoviAuta]=useState({}); // {auto_id: {dijelovi:[...]}}
  const [dioModal,setDioModal]=useState(null); // auto_id
  const [editDio,setEditDio]=useState(null);
  const [dioForm,setDioForm]=useState({naziv:'',planirana_cijena:'',stvarna_cijena:'',nabavljeno:false});
  const [savingDio,setSavingDio]=useState(false);
  const [cijenaHistorija,setCijenaHistorija]=useState(null);
  const [statusHistorija,setStatusHistorija]=useState(null);
  const [sellAutoModal,setSellAutoModal]=useState(false);
  const [sellAutoPrice,setSellAutoPrice]=useState('');
  const [form,setForm]=useState({marka:'',model:'',godiste:'',boja:'',km:'',motor:'',vin:'',napomena:'',olx_link:'',nabavna_cijena:'',prodajna_cijena:'',status:'na_stanju',datum_registracije:'',registrovan:false});
  const [editId,setEditId]=useState(null);const [saving,setSaving]=useState(false);
  const imgHook=useImageUpload([]);

  const MRTAV_KAPITAL_DANI=90;
  const daniNaSkladistu=(d)=>Math.floor((Date.now()-new Date(d).getTime())/(1000*60*60*24));
  const jeMrtavKapital=(a)=>a.status==='na_stanju'&&daniNaSkladistu(a.created_at)>=MRTAV_KAPITAL_DANI;

  // Ukupno uloženo = nabavna + svi nabavljeni dijelovi
  const ukupnoUlozeno=(autoId,nabavna)=>{
    const t=troskoviAuta[autoId];
    if(!t||!t.dijelovi)return parseFloat(nabavna)||0;
    const dijeloviSum=(t.dijelovi||[]).filter(d=>d.nabavljeno).reduce((s,d)=>s+(parseFloat(d.stvarna_cijena)||0),0);
    return (parseFloat(nabavna)||0)+dijeloviSum;
  };

  useEffect(()=>{if(quickAdd){openAdd();onQuickAddDone&&onQuickAddDone();}},[quickAdd]);
  useEffect(()=>{loadRegistracije();},[]);

  const load=async()=>{
    setLoading(true);
    try{
      const d=await api('/auta');setAuta(d);
      // Load troškovi for all auta
      const tros={};
      await Promise.all(d.map(async a=>{
        try{const t=await api('/auta/'+a.id+'/troskovi');tros[a.id]=t||{dijelovi:[]};}
        catch(e){tros[a.id]={dijelovi:[]};}
      }));
      setTroskoviAuta(tros);
    }catch(e){showToast(e.message,'err');}
    setLoading(false);
  };
  useEffect(()=>{load();},[]);

  const [regPodsjetnici,setRegPodsjetnici]=useState([]);
  const [showReg,setShowReg]=useState(false);

  const loadRegistracije=async()=>{
    try{const d=await api('/podsjetnici/registracija');setRegPodsjetnici(d);}
    catch(e){}
  };

  const regUkupno=regPodsjetnici.length;
  const regKriticno=regPodsjetnici.filter(a=>a.dani_do_registracije<=30).length;

  const STATUS_TABS=[
    {v:'',l:'Svi'},
    {v:'na_stanju',l:'Na stanju'},
    {v:'na_popravci',l:'Na popravci'},
    {v:'prodat',l:'Prodato'},
  ];
  const filtered=auta.filter(a=>!statusFilter||a.status===statusFilter);
  const naStanju=auta.filter(a=>a.status==='na_stanju');
  const naPop=auta.filter(a=>a.status==='na_popravci');
  const ukupnaVrijednost=naStanju.reduce((s,a)=>s+(parseFloat(a.prodajna_cijena)||0),0);
  const mrtavK=naStanju.filter(a=>jeMrtavKapital(a)).length;

  const openAdd=()=>{setForm({marka:'',model:'',godiste:'',boja:'',km:'',motor:'',vin:'',napomena:'',olx_link:'',nabavna_cijena:'',prodajna_cijena:'',status:'na_stanju'});imgHook.setSlike([]);setEditId(null);setModal('form');};
  const openEdit=(a)=>{setForm({marka:a.marka,model:a.model,godiste:a.godiste||'',boja:a.boja||'',km:a.km||'',motor:a.motor||'',vin:a.vin||'',napomena:a.napomena||'',olx_link:a.olx_link||'',nabavna_cijena:a.nabavna_cijena||'',prodajna_cijena:a.prodajna_cijena||'',status:a.status||'na_stanju',datum_registracije:a.datum_registracije||'',registrovan:!!(a.datum_registracije)});imgHook.setSlike(a.slike?[...a.slike]:[]);setEditId(a.id);setDetail(null);setModal('form');};

  const doSave=async()=>{
    if(!form.marka||!form.model){showToast('Marka i model su obavezni','err');return;}
    if(saving)return;setSaving(true);
    try{
      const body={...form,slike:imgHook.slike};let a;
      if(editId){a=await api('/auta/'+editId,{method:'PUT',body});setAuta(p=>p.map(x=>x.id===a.id?a:x));showToast('Auto ažuriran');}
      else{a=await api('/auta',{method:'POST',body});setAuta(p=>[a,...p]);setTroskoviAuta(p=>({...p,[a.id]:{dijelovi:[]}}));showToast('Auto '+a.sifra+' dodan');}
      setModal(null);
    }catch(e){showToast(e.message,'err');}setSaving(false);
  };
  const doDel=async(id)=>{if(!window.confirm('Obrisati auto?'))return;await api('/auta/'+id,{method:'DELETE'});setAuta(p=>p.filter(a=>a.id!=id));setDetail(null);showToast('Obrisan');};
  const doSellAuto=async()=>{
    try{const updated=await api('/auta/'+detail.id,{method:'PUT',body:{...detail,slike:detail.slike,status:'prodat',prodajna_cijena:sellAutoPrice||detail.prodajna_cijena}});
      setAuta(p=>p.map(a=>a.id===updated.id?updated:a));setSellAutoModal(false);setDetail(null);setSellAutoPrice('');showToast('Auto prodat');}
    catch(e){showToast(e.message,'err');}
  };
  const loadCijenaHistorija=async(id)=>{try{const h=await api('/auta/'+id+'/cijena-historija');setCijenaHistorija(h);}catch(e){showToast(e.message,'err');}};
  const loadStatusHistorija=async(id)=>{try{const h=await api('/auta/'+id+'/status-historija');setStatusHistorija(h);}catch(e){showToast(e.message,'err');}};

  // TROŠKOVI
  const doAddDio=async(autoId)=>{
    if(!dioForm.naziv.trim()){showToast('Naziv je obavezan','err');return;}
    if(savingDio)return;setSavingDio(true);
    try{
      let dio;
      if(editDio){
        dio=await api('/auta/'+autoId+'/troskovi/dio/'+editDio.id,{method:'PUT',body:dioForm});
        setTroskoviAuta(p=>({...p,[autoId]:{...p[autoId],dijelovi:(p[autoId]?.dijelovi||[]).map(d=>d.id===dio.id?dio:d)}}));
      }else{
        dio=await api('/auta/'+autoId+'/troskovi/dio',{method:'POST',body:dioForm});
        setTroskoviAuta(p=>({...p,[autoId]:{...p[autoId],dijelovi:[...(p[autoId]?.dijelovi||[]),dio]}}));
      }
      setDioModal(null);setEditDio(null);setDioForm({naziv:'',planirana_cijena:'',stvarna_cijena:'',nabavljeno:false});
      showToast(editDio?'Trošak ažuriran':'Trošak dodan');
    }catch(e){showToast(e.message,'err');}setSavingDio(false);
  };
  const doDelDio=async(autoId,dioId)=>{
    await api('/auta/'+autoId+'/troskovi/dio/'+dioId,{method:'DELETE'});
    setTroskoviAuta(p=>({...p,[autoId]:{...p[autoId],dijelovi:(p[autoId]?.dijelovi||[]).filter(d=>d.id!=dioId)}}));
  };
  const toggleDio=async(autoId,d)=>{
    const novi={...d,nabavljeno:!d.nabavljeno,stvarna_cijena:!d.nabavljeno?(parseFloat(d.stvarna_cijena)||parseFloat(d.planirana_cijena)||0):null};
    const updated=await api('/auta/'+autoId+'/troskovi/dio/'+d.id,{method:'PUT',body:{naziv:d.naziv,planirana_cijena:d.planirana_cijena,stvarna_cijena:novi.stvarna_cijena,nabavljeno:novi.nabavljeno}});
    setTroskoviAuta(p=>({...p,[autoId]:{...p[autoId],dijelovi:(p[autoId]?.dijelovi||[]).map(x=>x.id===d.id?updated:x)}}));
  };

  const statusColor={na_stanju:'var(--green)',na_popravci:'var(--accent)',prodat:'var(--purple)'};
  const statusLblLocal={na_stanju:'Na stanju',na_popravci:'Na popravci',prodat:'Prodat'};

  return(<div className="page">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
      <div><div className="page-title">Vozni park</div><div className="page-sub">Sva vozila — stanje, popravke i troškovi</div></div>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        {regKriticno>0&&<button className="btn-sm" style={{color:'var(--red)',borderColor:'var(--red)',position:'relative'}} onClick={()=>setShowReg(r=>!r)}>
          🔔 Registracije <span style={{background:'var(--red)',color:'#fff',borderRadius:10,fontSize:9,padding:'1px 5px',marginLeft:3,fontFamily:'Barlow Condensed,sans-serif',fontWeight:900}}>{regKriticno}</span>
        </button>}
        {regKriticno===0&&regUkupno>0&&<button className="btn-sm" onClick={()=>setShowReg(r=>!r)}>🔔 Registracije ({regUkupno})</button>}
        <button className="btn-add-main" onClick={openAdd}><Icons.Plus size={13}/> Dodaj auto</button>
      </div>
    </div>

    {/* KPI */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8,marginBottom:12}}>
      <div className="kpi green" style={{padding:'8px 12px'}}><div className="kpi-lbl">Vrijednost lagera</div><div className="kpi-val" style={{color:'var(--green)',fontSize:18}}>{ukupnaVrijednost.toLocaleString('sr-Latn-RS')} KM</div><div className="kpi-sub">{naStanju.length} vozila</div></div>
      {naPop.length>0&&<div className="kpi accent" style={{padding:'8px 12px'}}><div className="kpi-lbl">Na popravci</div><div className="kpi-val" style={{color:'var(--accent)',fontSize:18}}>{naPop.length}</div></div>}
      {mrtavK>0&&<div className="kpi red" style={{padding:'8px 12px'}}><div className="kpi-lbl">Mrtav kapital</div><div className="kpi-val" style={{color:'var(--red)',fontSize:18}}>{mrtavK}</div></div>}
    </div>

    {/* Registracije panel */}
    {showReg&&<div style={{background:'var(--surf)',border:'1.5px solid var(--border)',borderRadius:10,padding:'12px 14px',marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:800,letterSpacing:'1px',textTransform:'uppercase',color:'var(--muted)'}}>🔔 Registracije auta</div>
        <button className="btn-close" onClick={()=>setShowReg(false)}>×</button>
      </div>
      {regPodsjetnici.length===0?<div style={{fontSize:12,color:'var(--muted)'}}>Nema auta sa unesenim datumom registracije.</div>:
      <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:220,overflowY:'auto'}}>
        {regPodsjetnici.map(a=>{
          const boja=a.istekla?'var(--red)':a.dani_do_registracije<=30?'var(--accent)':a.dani_do_registracije<=90?'var(--blue)':'var(--green)';
          const poruka=a.istekla?'Istekla '+Math.abs(a.dani_do_registracije)+'d':a.dani_do_registracije===0?'Ističe danas!':'Za '+a.dani_do_registracije+'d';
          return(<div key={a.id} style={{display:'flex',alignItems:'center',gap:10,background:'var(--card)',border:'1px solid '+boja+'44',borderRadius:6,padding:'7px 10px',cursor:'pointer'}}
            onClick={()=>{const found=auta.find(x=>x.id===a.id);if(found)setDetail(found);}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:boja,flexShrink:0}}/>
            <div style={{flex:1,fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:13}}>{a.marka} {a.model} {a.godiste&&'('+a.godiste+')'}</div>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:11,color:boja}}>{poruka}</div>
          </div>);
        })}
      </div>}
    </div>}

    {/* Status tabs */}
    <div className="status-tabs" style={{marginBottom:12}}>
      {STATUS_TABS.map(({v,l})=>{
        const cnt=v===''?auta.length:auta.filter(a=>a.status===v).length;
        return <button key={v} className={"stab"+(statusFilter===v?' as':'')} onClick={()=>setStatusFilter(v)}>{l} ({cnt})</button>;
      })}
    </div>

    {loading?<div className="empty">Učitavanje...</div>:filtered.length===0?<div className="empty"><Icons.Car size={40}/><p>Nema vozila.</p></div>:
    <div className="auto-grid">
      {filtered.slice((autaPage-1)*30,autaPage*30).map(a=>{
        const tros=troskoviAuta[a.id];
        const dijeloviCount=(tros?.dijelovi||[]).length;
        const nabavljeniCount=(tros?.dijelovi||[]).filter(d=>d.nabavljeno).length;
        const ulozeno=ukupnoUlozeno(a.id,a.nabavna_cijena);
        return(<div key={a.id} className="auto-card" onClick={()=>setDetail(a)} style={{borderColor:a.status==='na_popravci'?'rgba(240,180,41,.4)':a.status==='prodat'?'rgba(188,140,255,.3)':'var(--border)'}}>
          <div className="auto-img">{a.slike&&a.slike.length>0?<img src={a.slike[0]} alt="" loading="lazy"/>:<Icons.Car size={40}/>}</div>
          <span style={{position:'absolute',bottom:68,right:0,background:statusColor[a.status],color:'#000',borderRadius:'4px 0 0 4px',fontFamily:'Barlow Condensed,sans-serif',fontSize:9,fontWeight:900,padding:'3px 7px',textTransform:'uppercase',letterSpacing:'1px',opacity:.95}}>{statusLblLocal[a.status]}</span>
          {jeMrtavKapital(a)&&<span className="dead-capital">🔴 {daniNaSkladistu(a.created_at)}d</span>}
          {a.datum_registracije&&(()=>{const dani=Math.round((new Date(a.datum_registracije)-new Date())/(1000*60*60*24));return dani<=30&&dani>=-7?<span style={{position:'absolute',top:7,left:7,background:dani<0?'var(--red)':'var(--accent)',color:'#000',borderRadius:4,fontFamily:'Barlow Condensed,sans-serif',fontSize:9,fontWeight:900,padding:'2px 6px'}}>{dani<0?'REG ISTEKLA':'REG '+dani+'d'}</span>:null;})()}
          <div className="auto-info">
            <div className="auto-name">{a.marka} {a.model}</div>
            <div className="auto-sub">{[a.godiste,a.motor,a.km&&a.km+' km'].filter(Boolean).join(' · ')}</div>
            {isAdmin&&<div style={{marginTop:4,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:11,fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,color:'var(--red)'}}>Uloženo: {ulozeno.toLocaleString('sr-Latn-RS')} KM</div>
              {a.prodajna_cijena&&<div style={{fontSize:11,fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,color:'var(--green)'}}>{a.prodajna_cijena} KM</div>}
            </div>}
            {dijeloviCount>0&&<div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>🔧 {nabavljeniCount}/{dijeloviCount} dijelova</div>}
          </div>
        </div>);
      })}
    </div>}
    <Pagination page={autaPage} total={filtered.length} perPage={30} onChange={p=>{setAutaPage(p);window.scrollTo(0,0);}}/>

    {/* DETAIL */}
    {detail&&!lightbox&&!sellAutoModal&&cijenaHistorija===null&&dioModal===null&&<div className="overlay" onClick={()=>setDetail(null)}><div className="modal" style={{maxWidth:540}} onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{detail.marka} {detail.model} <button className="btn-close" onClick={()=>setDetail(null)}>x</button></div>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
        <span style={{background:statusColor[detail.status]+'22',color:statusColor[detail.status],border:'1px solid '+statusColor[detail.status],borderRadius:4,fontFamily:'Barlow Condensed,sans-serif',fontSize:10,fontWeight:800,padding:'2px 8px',textTransform:'uppercase'}}>{statusLblLocal[detail.status]}</span>
        <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:15,color:'var(--accent)',letterSpacing:2}}>{detail.sifra}</span>
        <button title="Historija statusa" onClick={()=>loadStatusHistorija(detail.id)} style={{background:'none',border:'1px solid var(--border)',borderRadius:4,color:'var(--muted)',cursor:'pointer',padding:'2px 7px',fontSize:11,fontFamily:'Barlow Condensed,sans-serif',fontWeight:700}}>📋 Historija</button>
      </div>
      {detail.slike&&detail.slike.length>0&&<div>
          <div className="det-imgs">{detail.slike.map((s,i)=><div key={i} style={{position:'relative',display:'inline-block'}}>
            <img className="thumb" src={s} onClick={()=>setLightbox({images:detail.slike,index:i})} style={{border:i===0?'2px solid var(--accent)':'2px solid transparent'}}/>
            {i!==0&&<button onClick={async()=>{
              const noveSlike=[s,...detail.slike.filter((_,j)=>j!==i)];
              const updated=await api('/auta/'+detail.id,{method:'PUT',body:{...detail,slike:noveSlike}});
              setAuta(p=>p.map(a=>a.id===updated.id?updated:a));setDetail(updated);showToast('Naslovna slika promijenjena');
            }} style={{position:'absolute',bottom:4,left:4,background:'rgba(0,0,0,.75)',border:'none',color:'#fff',borderRadius:3,fontSize:9,padding:'2px 4px',cursor:'pointer',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700}}>★ Naslovna</button>}
            {i===0&&<span style={{position:'absolute',bottom:4,left:4,background:'var(--accent)',color:'#000',borderRadius:3,fontSize:9,padding:'2px 4px',fontFamily:'Barlow Condensed,sans-serif',fontWeight:800}}>★ Naslovna</span>}
          </div>)}
          </div>
          <div style={{fontSize:10,color:'var(--muted)',marginBottom:8}}>Klikni "★ Naslovna" na slici da je postaviš kao naslovnu</div>
        </div>}
      {jeMrtavKapital(detail)&&<div style={{background:'rgba(248,81,73,.1)',border:'1.5px solid rgba(248,81,73,.4)',borderRadius:6,padding:'8px 12px',marginBottom:8,fontSize:12,color:'var(--red)'}}>🔴 <b>Mrtav kapital</b> — vozilo stoji {daniNaSkladistu(detail.created_at)} dana</div>}

      {/* SPECS */}
      <div className="specs-grid">
        {detail.godiste&&<div className="spec-box"><div className="spec-lbl">Godište</div><div className="spec-val">{detail.godiste}</div></div>}
        {detail.motor&&<div className="spec-box"><div className="spec-lbl">Motor</div><div className="spec-val" style={{fontSize:14}}>{detail.motor}</div></div>}
        {detail.km&&<div className="spec-box"><div className="spec-lbl">Kilometraža</div><div className="spec-val">{detail.km} km</div></div>}
        {detail.boja&&<div className="spec-box"><div className="spec-lbl">Boja</div><div className="spec-val" style={{fontSize:14}}>{detail.boja}</div></div>}
      </div>

      {/* FINANSIJE */}
      {isAdmin&&(()=>{
        const t=troskoviAuta[detail.id];
        const dijelovi=t?.dijelovi||[];
        const nabavljeniSum=dijelovi.filter(d=>d.nabavljeno).reduce((s,d)=>s+(parseFloat(d.stvarna_cijena)||0),0);
        const planiraniSum=dijelovi.reduce((s,d)=>s+(parseFloat(d.planirana_cijena)||0),0);
        const nab=parseFloat(detail.nabavna_cijena)||0;
        const ulozeno=nab+nabavljeniSum;
        const marza=detail.prodajna_cijena?parseFloat(detail.prodajna_cijena)-ulozeno:null;
        return(<div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:12}}>
          <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:10,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--muted)',marginBottom:8}}>Finansije</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            <div><div style={{fontSize:9,color:'var(--muted)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase'}}>Nabavna</div><div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:15,fontWeight:900,color:'var(--text)'}}>{nab} KM</div></div>
            <div><div style={{fontSize:9,color:'var(--muted)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase'}}>Troškovi</div><div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:15,fontWeight:900,color:'var(--red)'}}>{nabavljeniSum} KM</div></div>
            <div><div style={{fontSize:9,color:'var(--muted)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase'}}>Ukupno uloženo</div><div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:15,fontWeight:900,color:'var(--accent)'}}>{ulozeno} KM</div></div>
          </div>
          {detail.prodajna_cijena&&<div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:9,color:'var(--muted)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase'}}>Prodajna cijena</div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:15,fontWeight:900,color:'var(--green)'}}>{detail.prodajna_cijena} KM</div>
                <button onClick={()=>loadCijenaHistorija(detail.id)} style={{background:'none',border:'1px solid var(--border)',borderRadius:4,color:'var(--muted)',cursor:'pointer',padding:'2px 5px',fontSize:10}}><Icons.History size={10}/></button>
              </div>
            </div>
            {marza!==null&&<div style={{textAlign:'right'}}><div style={{fontSize:9,color:'var(--muted)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase'}}>Marža</div><div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:15,fontWeight:900,color:marza>=0?'var(--green)':'var(--red)'}}>{marza>=0?'+':''}{marza} KM</div></div>}
          </div>}
          {planiraniSum>nabavljeniSum&&<div style={{marginTop:6,fontSize:10,color:'var(--muted)'}}>Plan: {nab+planiraniSum} KM ukupno (još {planiraniSum-nabavljeniSum} KM dijelova)</div>}
        </div>);
      })()}

      {/* TROŠKOVI DIJELOVI */}
      {(()=>{
        const t=troskoviAuta[detail.id];
        const dijelovi=t?.dijelovi||[];
        return(<div style={{marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:11,fontWeight:800,letterSpacing:'1px',textTransform:'uppercase',color:'var(--muted)'}}>🔧 Troškovi popravke ({dijelovi.length})</div>
            <button className="btn-sm" onClick={()=>{setDioModal(detail.id);setDioForm({naziv:'',planirana_cijena:'',stvarna_cijena:'',nabavljeno:false});setEditDio(null);}}><Icons.Plus size={10}/> Dodaj</button>
          </div>
          {dijelovi.length===0?<div style={{fontSize:11,color:'var(--muted)',fontStyle:'italic'}}>Nema unesenih troškova popravke.</div>:
          <div style={{display:'flex',flexDirection:'column',gap:3}}>
            {dijelovi.map(d=><div key={d.id} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
              <div className={"dio-check"+(d.nabavljeno?' done':'')} style={{flexShrink:0}} onClick={()=>toggleDio(detail.id,d)}>{d.nabavljeno&&<Icons.Check size={9}/>}</div>
              <span style={{flex:1,fontSize:12,textDecoration:d.nabavljeno?'line-through':''}}>{d.naziv}</span>
              <span style={{fontSize:11,color:'var(--muted)',width:60,textAlign:'right'}}>{d.planirana_cijena?d.planirana_cijena+' KM':''}</span>
              <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:12,width:65,textAlign:'right',color:d.nabavljeno?(parseFloat(d.stvarna_cijena)>parseFloat(d.planirana_cijena)?'var(--red)':'var(--green)'):'var(--muted)'}}>{d.nabavljeno?(d.stvarna_cijena+' KM'):'—'}</span>
              <button className="del-btn" style={{opacity:1,color:'var(--blue)'}} onClick={()=>{setEditDio(d);setDioForm({naziv:d.naziv,planirana_cijena:d.planirana_cijena||'',stvarna_cijena:d.stvarna_cijena||'',nabavljeno:!!d.nabavljeno});setDioModal(detail.id);}}><Icons.Edit/></button>
              <button className="del-btn" onClick={()=>doDelDio(detail.id,d.id)}><Icons.Trash/></button>
            </div>)}
          </div>}
        </div>);
      })()}

      {detail.vin&&<div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'6px 10px',fontSize:11,marginBottom:8}}>VIN: <b>{detail.vin}</b></div>}
      {detail.datum_registracije&&(()=>{
        const parts=detail.datum_registracije.split('-');
        const d=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2]));
        const today=new Date();today.setHours(0,0,0,0);
        const dani=Math.round((d-today)/(1000*60*60*24));
        const boja=dani<0?'var(--red)':dani<=30?'var(--accent)':dani<=90?'var(--blue)':'var(--green)';
        const fmt=parts[2]+'.'+parts[1]+'.'+parts[0];
        return(<div style={{background:boja+'18',border:'1px solid '+boja+'44',borderRadius:5,padding:'6px 10px',fontSize:11,marginBottom:8,color:boja}}>
          🔔 Registracija: <b>{fmt}</b> — {dani<0?'istekla '+Math.abs(dani)+' dana':dani===0?'ističe danas!':'ističe za '+dani+' dana'}
        </div>);
      })()}
      {detail.napomena&&<><div className="sec-lbl">Napomena</div><p style={{fontSize:12,color:'var(--muted)',lineHeight:1.6,marginBottom:8}}>{detail.napomena}</p></>}
      <div className="modal-foot">
        {isAdmin&&<div className="foot-left"><button className="btn-sm red" onClick={()=>doDel(detail.id)}><Icons.Trash/> Obriši</button></div>}
        {detail.olx_link&&<a href={detail.olx_link} target="_blank" rel="noopener noreferrer" className="olx-link" onClick={e=>e.stopPropagation()}><Icons.Link size={12}/> OLX</a>}
        <button className="btn-cancel" onClick={()=>openEdit(detail)}><Icons.Edit/> Uredi</button>
        {detail.status==='na_stanju'&&<button className="btn-sm" style={{color:'var(--accent)',borderColor:'var(--accent)'}} onClick={async()=>{const u=await api('/auta/'+detail.id,{method:'PUT',body:{...detail,slike:detail.slike,status:'na_popravci'}});setAuta(p=>p.map(a=>a.id===u.id?u:a));setDetail(u);showToast('Status: Na popravci');}}>🔧 Na popravku</button>}
        {detail.status==='na_popravci'&&<button className="btn-sm" style={{color:'var(--green)',borderColor:'var(--green)'}} onClick={async()=>{const u=await api('/auta/'+detail.id,{method:'PUT',body:{...detail,slike:detail.slike,status:'na_stanju'}});setAuta(p=>p.map(a=>a.id===u.id?u:a));setDetail(u);showToast('Status: Na stanju');}}>✓ Gotova popravka</button>}
        {(detail.status==='na_stanju'||detail.status==='na_popravci')&&<button className="btn-save" style={{background:'var(--green)',color:'#fff'}} onClick={()=>setSellAutoModal(true)}>Prodaj</button>}
      </div>
    </div></div>}

    {/* DIO MODAL */}
    {dioModal!==null&&<div className="overlay" onClick={()=>{setDioModal(null);setEditDio(null);}}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{editDio?'Uredi trošak':'Dodaj trošak popravke'} <button className="btn-close" onClick={()=>{setDioModal(null);setEditDio(null);}}>x</button></div>
      <div className="fg2"><label>Naziv *</label><input autoFocus value={dioForm.naziv} onChange={e=>setDioForm(f=>({...f,naziv:e.target.value}))} placeholder="npr. alternator, kočnice..."/></div>
      <div className="fg2"><label>Planirana cijena (KM)</label><input type="number" value={dioForm.planirana_cijena} onChange={e=>setDioForm(f=>({...f,planirana_cijena:e.target.value}))} placeholder="0"/></div>
      <div className="fg2" style={{display:'flex',alignItems:'center',gap:10}}>
        <input type="checkbox" id="nab-chk2" checked={!!dioForm.nabavljeno} onChange={e=>setDioForm(f=>({...f,nabavljeno:e.target.checked,stvarna_cijena:e.target.checked&&!f.stvarna_cijena?f.planirana_cijena:f.stvarna_cijena}))} style={{width:16,height:16}}/>
        <label htmlFor="nab-chk2" style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',cursor:'pointer'}}>Već nabavljeno/plaćeno</label>
      </div>
      {dioForm.nabavljeno&&<div className="fg2"><label>Stvarna cijena (KM)</label><input type="number" value={dioForm.stvarna_cijena} onChange={e=>setDioForm(f=>({...f,stvarna_cijena:e.target.value}))} placeholder="0"/></div>}
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>{setDioModal(null);setEditDio(null);}}>Odustani</button><button className="btn-save" disabled={savingDio} onClick={()=>doAddDio(dioModal)}>{savingDio?'Čuvanje...':editDio?'Sačuvaj':'Dodaj'}</button></div>
    </div></div>}

    {/* SELL MODAL */}
    {detail&&sellAutoModal&&<div className="overlay" onClick={()=>setSellAutoModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Prodaj auto <button className="btn-close" onClick={()=>setSellAutoModal(false)}>x</button></div>
      <div className="sell-box"><p>Prodaješ: <strong>{detail.marka} {detail.model}{detail.godiste?' ('+detail.godiste+')':''}</strong></p>
        {isAdmin&&<div style={{fontSize:11,color:'var(--muted)',marginBottom:8}}>Ukupno uloženo: <b style={{color:'var(--accent)'}}>{ukupnoUlozeno(detail.id,detail.nabavna_cijena)} KM</b></div>}
        <div className="fg2" style={{marginTop:10}}><label>Prodajna cijena (KM)</label>
          <div className="price-row"><input className="price-inp" type="number" placeholder="0" autoFocus value={sellAutoPrice} onChange={e=>setSellAutoPrice(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSellAuto()}/><span className="price-curr">KM</span></div>
        </div>
        {sellAutoPrice&&isAdmin&&<div style={{fontSize:11,color:parseFloat(sellAutoPrice)-ukupnoUlozeno(detail.id,detail.nabavna_cijena)>=0?'var(--green)':'var(--red)',marginTop:4}}>
          Marža: {(parseFloat(sellAutoPrice)-ukupnoUlozeno(detail.id,detail.nabavna_cijena)).toFixed(0)} KM
        </div>}
      </div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>setSellAutoModal(false)}>Odustani</button><button className="btn-save" style={{background:'var(--green)',color:'#fff'}} onClick={doSellAuto}>Potvrdi prodaju</button></div>
    </div></div>}

    {/* STATUS HISTORIJA */}
    {statusHistorija!==null&&<div className="overlay" onClick={()=>setStatusHistorija(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Historija statusa <button className="btn-close" onClick={()=>setStatusHistorija(null)}>x</button></div>
      {statusHistorija.length===0?<div style={{textAlign:'center',padding:'24px 0',color:'var(--muted)',fontSize:13}}>Nema promjena statusa</div>:
      statusHistorija.map((h,i)=>{
        const STATUS_COLORS={na_stanju:'var(--green)',na_popravci:'var(--accent)',prodat:'var(--purple)'};
        const STATUS_LBLS={na_stanju:'Na stanju',na_popravci:'Na popravci',prodat:'Prodat'};
        const dt=new Date(h.created_at);
        return(<div key={i} className="log-item">
          <div style={{flex:1}}>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:14,fontWeight:800,display:'flex',gap:8,alignItems:'center'}}>
              <span style={{color:STATUS_COLORS[h.stari_status]||'var(--muted)',textDecoration:'line-through',fontSize:12}}>{STATUS_LBLS[h.stari_status]||h.stari_status||'—'}</span>
              <span style={{color:'var(--muted)'}}>→</span>
              <span style={{color:STATUS_COLORS[h.novi_status]||'var(--text)'}}>{STATUS_LBLS[h.novi_status]||h.novi_status}</span>
            </div>
            <div className="log-detail">{h.korisnik} · {dt.toLocaleDateString('sr-Latn-BA')} {dt.toLocaleTimeString('sr-Latn-BA',{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
        </div>);
      })}
    </div></div>}

    {/* CIJENA HISTORIJA */}
    {cijenaHistorija!==null&&<div className="overlay" onClick={()=>setCijenaHistorija(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Historija cijena <button className="btn-close" onClick={()=>setCijenaHistorija(null)}>x</button></div>
      {cijenaHistorija.length===0?<div style={{textAlign:'center',padding:'24px 0',color:'var(--muted)',fontSize:13}}>Cijena nije mijenjana</div>:
      cijenaHistorija.map((h,i)=>{const dt=new Date(h.created_at);return(<div key={i} className="log-item">
        <div style={{flex:1}}><div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:14,fontWeight:800,display:'flex',gap:8,alignItems:'center'}}>
          <span style={{color:'var(--red)',textDecoration:'line-through'}}>{h.stara_cijena?h.stara_cijena+' KM':'—'}</span>
          <span style={{color:'var(--muted)'}}>→</span>
          <span style={{color:'var(--green)'}}>{h.nova_cijena} KM</span>
        </div><div className="log-detail">{h.korisnik}</div></div>
        <span className="log-time">{dt.toLocaleDateString('sr-Latn-RS')}</span>
      </div>);})}
    </div></div>}

    {/* FORM */}
    {modal==='form'&&<div className="overlay" onClick={()=>setModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{editId?'Uredi auto':'Dodaj auto'} <button className="btn-close" onClick={()=>setModal(null)}>x</button></div>
      <div className="two-col">
        <div className="fg2"><label>Marka *</label><input placeholder="Golf" value={form.marka} onChange={e=>setForm(f=>({...f,marka:e.target.value}))}/></div>
        <div className="fg2"><label>Model *</label><input placeholder="5" value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))}/></div>
      </div>
      <div className="two-col">
        <div className="fg2"><label>Godište</label><input placeholder="2012" value={form.godiste} onChange={e=>setForm(f=>({...f,godiste:e.target.value}))}/></div>
        <div className="fg2"><label>Kilometraža</label><input placeholder="150000" value={form.km} onChange={e=>setForm(f=>({...f,km:e.target.value}))}/></div>
      </div>
      <div className="two-col">
        <div className="fg2"><label>Motor</label><input placeholder="1.9 TDI" value={form.motor} onChange={e=>setForm(f=>({...f,motor:e.target.value}))}/></div>
        <div className="fg2"><label>Boja</label><input placeholder="Crna" value={form.boja} onChange={e=>setForm(f=>({...f,boja:e.target.value}))}/></div>
      </div>
      <div className="fg2"><label>VIN</label><input placeholder="WVW..." value={form.vin} onChange={e=>setForm(f=>({...f,vin:e.target.value.toUpperCase()}))}/></div>
      <div className="fg2"><label>Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}><option value="na_stanju">Na stanju</option><option value="na_popravci">Na popravci</option><option value="prodat">Prodat</option></select></div>
      {isAdmin&&<div className="two-col">
        <div className="fg2"><label>Nabavna (KM)</label><input type="number" placeholder="0" value={form.nabavna_cijena} onChange={e=>setForm(f=>({...f,nabavna_cijena:e.target.value}))}/></div>
        <div className="fg2"><label>Prodajna (KM)</label><input type="number" placeholder="0" value={form.prodajna_cijena} onChange={e=>setForm(f=>({...f,prodajna_cijena:e.target.value}))}/></div>
      </div>}
      <div className="fg2"><label>OLX link</label><input placeholder="https://olx.ba/..." value={form.olx_link} onChange={e=>setForm(f=>({...f,olx_link:e.target.value}))}/></div>
      <div className="fg2" style={{display:'flex',alignItems:'center',gap:10}}>
        <input type="checkbox" id="reg-chk" checked={!!form.registrovan} onChange={e=>setForm(f=>({...f,registrovan:e.target.checked,datum_registracije:e.target.checked?f.datum_registracije:''}))} style={{width:16,height:16}}/>
        <label htmlFor="reg-chk" style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',cursor:'pointer'}}>Registrovano vozilo</label>
      </div>
      {form.registrovan&&<div className="fg2"><label>Datum isteka registracije</label><input type="date" value={form.datum_registracije||''} onChange={e=>setForm(f=>({...f,datum_registracije:e.target.value}))}/></div>}
      <div className="fg2"><label>Napomena</label><textarea placeholder="Stanje..." value={form.napomena} onChange={e=>setForm(f=>({...f,napomena:e.target.value}))}/></div>
      <ImgUploadUI {...imgHook} onThumbClick={i=>setLightbox({images:imgHook.slike,index:i})}/>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>setModal(null)}>Odustani</button><button className="btn-save" onClick={doSave} disabled={saving||imgHook.uploadState.uploading}>{saving?'Čuvanje...':'Sačuvaj'}</button></div>
    </div></div>}

    {lightbox&&<Lightbox images={lightbox.images} startIndex={lightbox.index} onClose={()=>setLightbox(null)}/>}
    <div className="site-footer">© 2026 <span>DelicNode</span></div>
  </div>);
}

// ===== ZADACI MODULE =====

export default AutaModul;
