import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, promjerDisp, tipLbl, statusLbl, timeAgo, resizeImage } from '../utils.js';
import { Icons, ErrorBoundary, ComboBox, useImageUpload, Lightbox, ImgUploadUI, Pagination } from '../components/index.jsx';

function KupciModul({showToast}){
  const [kupci,setKupci]=useState([]);const [search,setSearch]=useState('');
  const [mainTab,setMainTab]=useState('kupci'); // kupci | kompenz
  const [modal,setModal]=useState(false);const [detail,setDetail]=useState(null);
  const [editKupac,setEditKupac]=useState(null);
  const [form,setForm]=useState({ime:'',telefon:'',adresa:'',jib:'',pdv_broj:'',napomena:''});
  const [kupForm,setKupForm]=useState({opis:'',iznos:'',placeno:'',datum:new Date().toISOString().slice(0,10)});
  const [modalKup,setModalKup]=useState(false);
  const [editKupovina,setEditKupovina]=useState(null);
  const [placanjModal,setPlacanjModal]=useState(null);
  const [novoPlacanje,setNovoPlacanje]=useState('');
  const [filterDug,setFilterDug]=useState(false);
  // Kompenzacije
  const [selPartner,setSelPartner]=useState(null);
  const [kompStavke,setKompStavke]=useState([]);
  const [modalStavka,setModalStavka]=useState(false);
  const [stavkaForm,setStavkaForm]=useState({opis:'',iznos:'',smjer:'duguju_nam',datum:new Date().toISOString().slice(0,10)});
  const [searchK,setSearchK]=useState('');

  const load=async()=>{try{const d=await api('/kupci');setKupci(d);}catch(e){showToast(e.message,'err');}};
  useEffect(()=>{load();},[]);

  const loadKomp=async(id)=>{try{const d=await api('/kupci/'+id+'/kompenzacije');setKompStavke(d);}catch(e){setKompStavke([]);}};

  const dugovanje=(k)=>(k.kupovine||[]).reduce((s,x)=>s+(parseFloat(x.iznos)||0)-(parseFloat(x.placeno)||0),0);
  const ukupnoKupao=(k)=>(k.kupovine||[]).reduce((s,x)=>s+(parseFloat(x.iznos)||0),0);
  const ukupnoDugova=useMemo(()=>kupci.reduce((s,k)=>s+Math.max(0,dugovanje(k)),0),[kupci]);

  const filtered=useMemo(()=>kupci.filter(k=>{
    const s=!search||k.ime.toLowerCase().includes(search.toLowerCase())||(k.telefon&&k.telefon.includes(search));
    return s&&(!filterDug||dugovanje(k)>0);
  }),[kupci,search,filterDug]);

  const filteredK=useMemo(()=>kupci.filter(k=>!searchK||k.ime.toLowerCase().includes(searchK.toLowerCase())),[kupci,searchK]);

  const doSave=async()=>{
    if(!form.ime.trim()){showToast('Ime je obavezno','err');return;}
    try{
      if(editKupac){const k=await api('/kupci/'+editKupac.id,{method:'PUT',body:form});setKupci(p=>p.map(x=>x.id===k.id?{...x,...k}:x));setDetail(d=>d?{...d,...k}:d);}
      else{const k=await api('/kupci',{method:'POST',body:form});setKupci(p=>[...p,k]);}
      setModal(false);setEditKupac(null);setForm({ime:'',telefon:'',adresa:'',jib:'',pdv_broj:'',napomena:''});showToast('Sačuvano');
    }catch(e){showToast(e.message,'err');}
  };
  const doDel=async(id)=>{if(!window.confirm('Obrisati?'))return;await api('/kupci/'+id,{method:'DELETE'});setKupci(p=>p.filter(k=>k.id!=id));setDetail(null);};

  const doAddKupovina=async()=>{
    if(!kupForm.opis.trim()){showToast('Opis je obavezan','err');return;}
    try{
      if(editKupovina){
        const k=await api('/kupci/'+detail.id+'/kupovina/'+editKupovina.id,{method:'PUT',body:kupForm});
        setKupci(p=>p.map(x=>x.id!=detail.id?x:{...x,kupovine:(x.kupovine||[]).map(kup=>kup.id===k.id?k:kup)}));
        setDetail(d=>({...d,kupovine:(d.kupovine||[]).map(kup=>kup.id===k.id?k:kup)}));
      }else{
        const k=await api('/kupci/'+detail.id+'/kupovina',{method:'POST',body:kupForm});
        setKupci(p=>p.map(x=>x.id!=detail.id?x:{...x,kupovine:[k,...(x.kupovine||[])]}));
        setDetail(d=>({...d,kupovine:[k,...(d.kupovine||[])]}));
      }
      setModalKup(false);setEditKupovina(null);setKupForm({opis:'',iznos:'',placeno:'',datum:new Date().toISOString().slice(0,10)});showToast('Sačuvano');
    }catch(e){showToast(e.message,'err');}
  };
  const doPlati=async(kupId,kupovId)=>{
    const k=await api('/kupci/'+kupId+'/kupovina/'+kupovId,{method:'PUT',body:{placeno:novoPlacanje}});
    setKupci(p=>p.map(x=>x.id!=kupId?x:{...x,kupovine:(x.kupovine||[]).map(kup=>kup.id===k.id?k:kup)}));
    setDetail(d=>({...d,kupovine:(d.kupovine||[]).map(kup=>kup.id===k.id?k:kup)}));
    setPlacanjModal(null);setNovoPlacanje('');showToast('Plaćanje evidentirano');
  };
  const doDelKupovina=async(kid)=>{
    await api('/kupci/'+detail.id+'/kupovina/'+kid,{method:'DELETE'});
    setKupci(p=>p.map(x=>x.id!=detail.id?x:{...x,kupovine:(x.kupovine||[]).filter(k=>k.id!=kid)}));
    setDetail(d=>({...d,kupovine:(d.kupovine||[]).filter(k=>k.id!=kid)}));
  };

  const doAddStavka=async()=>{
    if(!stavkaForm.opis.trim()||!stavkaForm.iznos){showToast('Opis i iznos obavezni','err');return;}
    try{const k=await api('/kupci/'+selPartner.id+'/kompenzacije',{method:'POST',body:stavkaForm});setKompStavke(p=>[k,...p]);setModalStavka(false);setStavkaForm({opis:'',iznos:'',smjer:'duguju_nam',datum:new Date().toISOString().slice(0,10)});showToast('Dodano');}catch(e){showToast(e.message,'err');}
  };
  const toggleKomp=async(s)=>{const u=await api('/kupci/'+selPartner.id+'/kompenzacije/'+s.id,{method:'PUT',body:{izmireno:!s.izmireno}});setKompStavke(p=>p.map(x=>x.id===u.id?u:x));};
  const delKomp=async(s)=>{await api('/kupci/'+selPartner.id+'/kompenzacije/'+s.id,{method:'DELETE'});setKompStavke(p=>p.filter(x=>x.id!==s.id));};

  const kompSaldo=useMemo(()=>{
    const njama=kompStavke.filter(s=>s.smjer==='dugujemo'&&!s.izmireno).reduce((s,x)=>s+(parseFloat(x.iznos)||0),0);
    const nama=kompStavke.filter(s=>s.smjer==='duguju_nam'&&!s.izmireno).reduce((s,x)=>s+(parseFloat(x.iznos)||0),0);
    return{njama,nama,neto:nama-njama};
  },[kompStavke]);

  return(<div className="page">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
      <div><div className="page-title">Kupci</div><div className="page-sub">Dužnici i kompenzacije</div></div>
      {mainTab==='kupci'&&<button className="btn-add-main" onClick={()=>{setForm({ime:'',telefon:'',adresa:'',jib:'',pdv_broj:'',napomena:''});setEditKupac(null);setModal(true);}}><Icons.Plus size={13}/> Novi kupac</button>}
    </div>

    <div className="status-tabs" style={{marginBottom:12}}>
      <button className={"stab"+(mainTab==='kupci'?' as':'')} onClick={()=>setMainTab('kupci')}>👥 Kupci & Dužnici</button>
      <button className={"stab"+(mainTab==='kompenz'?' as':'')} onClick={()=>setMainTab('kompenz')}>🔄 Kompenzacije</button>
    </div>

    {/* TAB: KUPCI */}
    {mainTab==='kupci'&&<>
      {ukupnoDugova>0&&<div style={{background:'rgba(248,81,73,.08)',border:'1.5px solid rgba(248,81,73,.3)',borderRadius:8,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div><div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:10,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--muted)'}}>Ukupna dugovanja</div>
        <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:22,color:'var(--red)'}}>{ukupnoDugova.toLocaleString('sr-Latn-BA')} KM</div></div>
        <button className={"stab"+(filterDug?' as':'')} style={{borderColor:'var(--red)',color:filterDug?'var(--red)':'var(--muted)'}} onClick={()=>setFilterDug(f=>!f)}>Samo dužnici</button>
      </div>}
      <div className="sf-wrap" style={{marginBottom:12}}>
        <div className="fg"><label>Pretraga</label><input placeholder="Ime ili telefon..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      </div>
      {filtered.length===0?<div className="empty"><Icons.Task size={36}/><p>Nema kupaca.</p></div>:
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {filtered.map(k=>{const dug=dugovanje(k);return(<div key={k.id} style={{background:'var(--card)',border:'1.5px solid '+(dug>0?'rgba(248,81,73,.3)':'var(--border)'),borderRadius:8,padding:'10px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:12}} onClick={()=>setDetail(k)}>
          <div style={{width:36,height:36,borderRadius:'50%',background:dug>0?'var(--red)':'var(--accent)',color:'#000',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:16,flexShrink:0}}>{k.ime.charAt(0).toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:15}}>{k.ime}</div>
            <div style={{fontSize:11,color:'var(--muted)'}}>{k.telefon||'Nema broja'} · {(k.kupovine||[]).length} transakcija</div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            {dug>0&&<div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:14,color:'var(--red)'}}>Duguje {dug.toLocaleString('sr-Latn-BA')} KM</div>}
            {dug<=0&&ukupnoKupao(k)>0&&<div style={{fontSize:12,color:'var(--green)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700}}>✓ Izmiren</div>}
          </div>
          {k.telefon&&<a href={"https://wa.me/387"+k.telefon.replace(/^0/,'').replace(/\D/g,'')} target="_blank" onClick={e=>e.stopPropagation()} style={{background:'#25d366',color:'#fff',borderRadius:'50%',width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14,textDecoration:'none'}}>💬</a>}
        </div>);})}
      </div>}
    </>}

    {/* TAB: KOMPENZACIJE */}
    {mainTab==='kompenz'&&<>
      <div className="sf-wrap" style={{marginBottom:12}}>
        <div className="fg"><label>Odaberi partnera</label>
          <select value={selPartner?.id||''} onChange={e=>{const p=kupci.find(k=>k.id==e.target.value);setSelPartner(p||null);if(p)loadKomp(p.id);}}>
            <option value="">— Odaberi —</option>
            {kupci.map(k=><option key={k.id} value={k.id}>{k.ime}</option>)}
          </select>
        </div>
      </div>
      {!selPartner?<div className="empty"><div style={{fontSize:32}}>🔄</div><p>Odaberi partnera gore za prikaz kompenzacija.</p></div>:<>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
          <div className="kpi red" style={{padding:'8px 12px'}}><div className="kpi-lbl">Mi njima dugujemo</div><div className="kpi-val" style={{color:'var(--red)',fontSize:18}}>{kompSaldo.njama.toLocaleString('sr-Latn-BA')} KM</div></div>
          <div className="kpi green" style={{padding:'8px 12px'}}><div className="kpi-lbl">Oni nama duguju</div><div className="kpi-val" style={{color:'var(--green)',fontSize:18}}>{kompSaldo.nama.toLocaleString('sr-Latn-BA')} KM</div></div>
          <div className="kpi" style={{padding:'8px 12px',borderColor:kompSaldo.neto>=0?'rgba(63,185,80,.3)':'rgba(248,81,73,.3)'}}>
            <div className="kpi-lbl">Saldo</div>
            <div className="kpi-val" style={{color:kompSaldo.neto>=0?'var(--green)':'var(--red)',fontSize:18}}>{kompSaldo.neto>=0?'+':''}{kompSaldo.neto.toLocaleString('sr-Latn-BA')} KM</div>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
          <button className="btn-add-main" onClick={()=>setModalStavka(true)}><Icons.Plus size={13}/> Nova stavka</button>
        </div>
        {kompStavke.length===0?<div className="empty"><p>Nema stavki za {selPartner.ime}.</p></div>:
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          {kompStavke.map(s=><div key={s.id} style={{display:'flex',alignItems:'center',gap:8,background:'var(--card)',border:'1.5px solid '+(s.izmireno?'var(--border)':s.smjer==='dugujemo'?'rgba(248,81,73,.3)':'rgba(63,185,80,.3)'),borderRadius:7,padding:'8px 12px',opacity:s.izmireno?.55:1}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:s.smjer==='dugujemo'?'var(--red)':'var(--green)',flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:13}}>{s.opis}</div>
              <div style={{fontSize:10,color:'var(--muted)'}}>{s.smjer==='dugujemo'?'Mi njima':'Oni nama'} · {s.datum}{s.izmireno?' · ✓ Izmireno':''}</div>
            </div>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:15,color:s.smjer==='dugujemo'?'var(--red)':'var(--green)',flexShrink:0}}>{(parseFloat(s.iznos)||0).toLocaleString('sr-Latn-BA')} KM</div>
            <button className="btn-sm" style={{color:s.izmireno?'var(--muted)':'var(--green)',borderColor:s.izmireno?'var(--border)':'var(--green)',padding:'3px 8px',fontSize:10}} onClick={()=>toggleKomp(s)}>{s.izmireno?'Poništi':'✓ Izmiri'}</button>
            <button className="del-btn" onClick={()=>delKomp(s)}><Icons.Trash/></button>
          </div>)}
        </div>}
      </>}

      {modalStavka&&selPartner&&<div className="overlay" onClick={()=>setModalStavka(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">Nova stavka — {selPartner.ime} <button className="btn-close" onClick={()=>setModalStavka(false)}>x</button></div>
        <div className="fg2"><label>Smjer</label>
          <div style={{display:'flex',gap:8}}>
            <button className={"stab"+(stavkaForm.smjer==='duguju_nam'?' as':'')} style={{flex:1,padding:'8px'}} onClick={()=>setStavkaForm(f=>({...f,smjer:'duguju_nam'}))}>🟢 Oni nama duguju</button>
            <button className={"stab"+(stavkaForm.smjer==='dugujemo'?' as':'')} style={{flex:1,padding:'8px',borderColor:'var(--red)',color:stavkaForm.smjer==='dugujemo'?'var(--red)':'var(--muted)'}} onClick={()=>setStavkaForm(f=>({...f,smjer:'dugujemo'}))}>🔴 Mi njima dugujemo</button>
          </div>
        </div>
        <div className="fg2"><label>Opis *</label><input autoFocus value={stavkaForm.opis} onChange={e=>setStavkaForm(f=>({...f,opis:e.target.value}))} placeholder="npr. Motor za Golf 5"/></div>
        <div className="two-col">
          <div className="fg2"><label>Iznos (KM) *</label><div className="price-row"><input className="price-inp" type="number" value={stavkaForm.iznos} onChange={e=>setStavkaForm(f=>({...f,iznos:e.target.value}))}/><span className="price-curr">KM</span></div></div>
          <div className="fg2"><label>Datum</label><input type="date" value={stavkaForm.datum} onChange={e=>setStavkaForm(f=>({...f,datum:e.target.value}))}/></div>
        </div>
        <div className="modal-foot"><button className="btn-cancel" onClick={()=>setModalStavka(false)}>Odustani</button><button className="btn-save" onClick={doAddStavka}>Dodaj</button></div>
      </div></div>}
    </>}

    {/* DETAIL */}
    {detail&&!modalKup&&placanjModal===null&&mainTab==='kupci'&&<div className="overlay" onClick={()=>setDetail(null)}><div className="modal" style={{maxWidth:500}} onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{detail.ime} <button className="btn-close" onClick={()=>setDetail(null)}>x</button></div>
      {detail.telefon&&<div style={{display:'flex',gap:6,marginBottom:12}}>
        <a href={"tel:"+detail.telefon} style={{flex:1,background:'var(--card)',border:'1px solid var(--border)',borderRadius:6,padding:'7px',textAlign:'center',color:'var(--blue)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,fontSize:11,textDecoration:'none'}}>📞 Pozovi</a>
        <a href={"https://wa.me/387"+detail.telefon.replace(/^0/,'').replace(/\D/g,'')} target="_blank" style={{flex:1,background:'#25d366',borderRadius:6,padding:'7px',textAlign:'center',color:'#fff',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,fontSize:11,textDecoration:'none'}}>💬 WhatsApp</a>
        <a href={"viber://chat?number=%2B387"+detail.telefon.replace(/^0/,'').replace(/\D/g,'')} style={{flex:1,background:'#7360f2',borderRadius:6,padding:'7px',textAlign:'center',color:'#fff',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,fontSize:11,textDecoration:'none'}}>📲 Viber</a>
      </div>}
      {(()=>{const dug=dugovanje(detail);return dug>0&&<div style={{background:'rgba(248,81,73,.1)',border:'1.5px solid rgba(248,81,73,.3)',borderRadius:7,padding:'10px 14px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontSize:10,color:'var(--muted)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase'}}>Duguje</div><div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:24,color:'var(--red)'}}>{dug.toLocaleString('sr-Latn-BA')} KM</div></div>
        <div style={{fontSize:12,color:'var(--muted)'}}>od {ukupnoKupao(detail).toLocaleString('sr-Latn-BA')} KM ukupno</div>
      </div>;})()}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
        <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:11,fontWeight:800,letterSpacing:'1px',textTransform:'uppercase',color:'var(--muted)'}}>Transakcije ({(detail.kupovine||[]).length})</div>
        <button className="btn-sm" onClick={()=>setModalKup(true)}><Icons.Plus size={10}/> Dodaj</button>
      </div>
      <div style={{maxHeight:220,overflowY:'auto',marginBottom:12}}>
        {(detail.kupovine||[]).length===0?<div style={{fontSize:12,color:'var(--muted)'}}>Nema transakcija.</div>:
        (detail.kupovine||[]).map(k=>{const dug=Math.max(0,(parseFloat(k.iznos)||0)-(parseFloat(k.placeno)||0));return(<div key={k.id} style={{padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
            <div style={{flex:1}}>{k.opis}</div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:13}}>{(parseFloat(k.iznos)||0).toLocaleString('sr-Latn-BA')} KM</div>
              {parseFloat(k.placeno)>0&&<div style={{fontSize:10,color:'var(--green)'}}>Plaćeno: {parseFloat(k.placeno).toLocaleString('sr-Latn-BA')} KM</div>}
            </div>
            <button className="del-btn" style={{color:'var(--blue)',opacity:1}} onClick={()=>{setEditKupovina(k);setKupForm({opis:k.opis,iznos:String(k.iznos||''),placeno:String(k.placeno||''),datum:k.datum||new Date().toISOString().slice(0,10)});setModalKup(true);}}><Icons.Edit/></button>
            <button className="del-btn" onClick={()=>doDelKupovina(k.id)}><Icons.Trash/></button>
          </div>
          {dug>0&&<div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
            <div style={{flex:1,fontSize:11,color:'var(--red)'}}>Duguje: <b>{dug.toLocaleString('sr-Latn-BA')} KM</b></div>
            <button className="btn-sm" style={{color:'var(--green)',borderColor:'var(--green)'}} onClick={()=>{setPlacanjModal(k.id);setNovoPlacanje(String(dug));}}>+ Uplata</button>
          </div>}
        </div>);})}
      </div>
      <div className="modal-foot">
        <div className="foot-left"><button className="btn-sm red" onClick={()=>doDel(detail.id)}><Icons.Trash/> Obriši</button></div>
        <button className="btn-cancel" onClick={()=>{setEditKupac(detail);setForm({ime:detail.ime,telefon:detail.telefon||'',adresa:detail.adresa||'',jib:detail.jib||'',pdv_broj:detail.pdv_broj||'',napomena:detail.napomena||''});setDetail(null);setModal(true);}}>Uredi</button>
      </div>
    </div></div>}

    {placanjModal!==null&&detail&&<div className="overlay" onClick={()=>setPlacanjModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Evidentiraj uplatu <button className="btn-close" onClick={()=>setPlacanjModal(null)}>x</button></div>
      <div className="fg2"><label>Iznos uplate (KM)</label><div className="price-row"><input className="price-inp" type="number" autoFocus value={novoPlacanje} onChange={e=>setNovoPlacanje(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doPlati(detail.id,placanjModal)}/><span className="price-curr">KM</span></div></div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>setPlacanjModal(null)}>Odustani</button><button className="btn-save" style={{background:'var(--green)',color:'#fff'}} onClick={()=>doPlati(detail.id,placanjModal)}>Potvrdi uplatu</button></div>
    </div></div>}

    {modalKup&&detail&&<div className="overlay" onClick={()=>setModalKup(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{editKupovina?"Uredi transakciju":"Nova transakcija"} <button className="btn-close" onClick={()=>{setModalKup(false);setEditKupovina(null);}}>x</button></div>
      <div className="fg2"><label>Opis *</label><input autoFocus value={kupForm.opis} onChange={e=>setKupForm(f=>({...f,opis:e.target.value}))} placeholder="npr. 4x zimske 205/55 R16"/></div>
      <div className="two-col">
        <div className="fg2"><label>Ukupan iznos (KM)</label><div className="price-row"><input className="price-inp" type="number" placeholder="0" value={kupForm.iznos} onChange={e=>setKupForm(f=>({...f,iznos:e.target.value}))}/><span className="price-curr">KM</span></div></div>
        <div className="fg2"><label>Plaćeno odmah (KM)</label><div className="price-row"><input className="price-inp" type="number" placeholder="0" value={kupForm.placeno} onChange={e=>setKupForm(f=>({...f,placeno:e.target.value}))}/><span className="price-curr">KM</span></div></div>
      </div>
      <div className="fg2"><label>Datum</label><input type="date" value={kupForm.datum} onChange={e=>setKupForm(f=>({...f,datum:e.target.value}))}/></div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>{setModalKup(false);setEditKupovina(null);}}>Odustani</button><button className="btn-save" onClick={doAddKupovina}>{editKupovina?"Sačuvaj":"Dodaj"}</button></div>
    </div></div>}

    {modal&&<div className="overlay" onClick={()=>setModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{editKupac?'Uredi kupca':'Novi kupac'} <button className="btn-close" onClick={()=>setModal(false)}>x</button></div>
      <div className="fg2"><label>Naziv / Ime *</label><input autoFocus value={form.ime} onChange={e=>setForm(f=>({...f,ime:e.target.value}))} placeholder="Marko Marković"/></div>
      <div className="fg2"><label>Adresa</label><input value={form.adresa||''} onChange={e=>setForm(f=>({...f,adresa:e.target.value}))} placeholder="Ulica bb, Grad"/></div>
      <div className="fg2"><label>Telefon</label><input value={form.telefon} onChange={e=>setForm(f=>({...f,telefon:e.target.value}))} placeholder="061 234 567"/></div>
      <div className="two-col">
        <div className="fg2"><label>JIB</label><input value={form.jib||''} onChange={e=>setForm(f=>({...f,jib:e.target.value}))}/></div>
        <div className="fg2"><label>PDV broj</label><input value={form.pdv_broj||''} onChange={e=>setForm(f=>({...f,pdv_broj:e.target.value}))}/></div>
      </div>
      <div className="fg2"><label>Napomena</label><textarea value={form.napomena} onChange={e=>setForm(f=>({...f,napomena:e.target.value}))}/></div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>setModal(false)}>Odustani</button><button className="btn-save" onClick={doSave}>Sačuvaj</button></div>
    </div></div>}
    <div className="site-footer">© 2026 <span>DelicNode</span></div>
  </div>);
}

export default KupciModul;
