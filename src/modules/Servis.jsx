import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils.js';
import { Icons } from '../components/index.jsx';

function ServisModul({user,showToast}){
  const isAdmin=user.role==='admin';
  const [mainTab,setMainTab]=useState(isAdmin?'pregled':'poslovi');
  const [period,setPeriod]=useState('mjesec');
  const [pregled,setPregled]=useState(null);const [loadingPregled,setLoadingPregled]=useState(false);
  const [mehanicari,setMehanicari]=useState([]);
  const [poslovi,setPoslovi]=useState([]);
  const [modalPosao,setModalPosao]=useState(false);
  const [formPosao,setFormPosao]=useState({mehanicar_id:'',mehanicar_ime:'',registracija:'',opis_posla:'',naplaceno:'',napomena:''});
  const [savingPosao,setSavingPosao]=useState(false);
  const [modalMeh,setModalMeh]=useState(false);
  const [formMeh,setFormMeh]=useState({ime:''});
  const [editingPosaoId,setEditingPosaoId]=useState(null);

  const PERIOD_OPTS=[['danas','Danas'],['sedmica','7 dana'],['mjesec','Ovaj mj.'],['godina','Ova god.'],['sve','Sve']];

  const loadMehanicari=async()=>{try{const d=await api('/mehanicari');setMehanicari(d);}catch(e){}};
  const loadPoslovi=async()=>{try{const d=await api('/servis-poslovi');setPoslovi(d);}catch(e){}};
  const loadPregled=async(p)=>{
    if(!isAdmin)return;
    setLoadingPregled(true);
    try{const d=await api('/servis-pregled?period='+p);setPregled(d);}catch(e){showToast(e.message,'err');}
    setLoadingPregled(false);
  };

  useEffect(()=>{loadMehanicari();loadPoslovi();if(isAdmin)loadPregled(period);},[]);
  useEffect(()=>{if(isAdmin)loadPregled(period);},[period]);

  const aktivniMeh=useMemo(()=>mehanicari.filter(m=>m.aktivan),[mehanicari]);

  const openAddPosao=()=>{setFormPosao({mehanicar_id:'',mehanicar_ime:'',registracija:'',opis_posla:'',naplaceno:'',napomena:''});setEditingPosaoId(null);setModalPosao(true);};
  const openEditPosao=(p)=>{setFormPosao({mehanicar_id:p.mehanicar_id||'',mehanicar_ime:p.mehanicar_ime,registracija:p.registracija||'',opis_posla:p.opis_posla,naplaceno:p.naplaceno,napomena:p.napomena||''});setEditingPosaoId(p.id);setModalPosao(true);};

  const doSavePosao=async()=>{
    if(!formPosao.mehanicar_ime||!formPosao.opis_posla||!formPosao.naplaceno){showToast('Mehaničar, opis posla i naplaćeno su obavezni','err');return;}
    setSavingPosao(true);
    try{
      let p;
      if(editingPosaoId){p=await api('/servis-poslovi/'+editingPosaoId,{method:'PUT',body:formPosao});setPoslovi(prev=>prev.map(x=>x.id===p.id?p:x));showToast('Posao ažuriran');}
      else{p=await api('/servis-poslovi',{method:'POST',body:formPosao});setPoslovi(prev=>[p,...prev]);showToast('Posao dodan');}
      setModalPosao(false);
      if(isAdmin)loadPregled(period);
    }catch(e){showToast(e.message,'err');}
    setSavingPosao(false);
  };

  const doDelPosao=async(id)=>{
    if(!window.confirm('Obrisati ovaj posao?'))return;
    try{await api('/servis-poslovi/'+id,{method:'DELETE'});setPoslovi(p=>p.filter(x=>x.id!==id));if(isAdmin)loadPregled(period);showToast('Posao obrisan');}
    catch(e){showToast(e.message,'err');}
  };

  const doAddMeh=async()=>{
    if(!formMeh.ime.trim()){showToast('Ime je obavezno','err');return;}
    try{const m=await api('/mehanicari',{method:'POST',body:formMeh});setMehanicari(p=>[...p,m]);setFormMeh({ime:''});showToast('Mehaničar dodan');}
    catch(e){showToast(e.message,'err');}
  };

  const toggleMeh=async(m)=>{
    try{const u=await api('/mehanicari/'+m.id,{method:'PUT',body:{ime:m.ime,aktivan:m.aktivan?0:1}});setMehanicari(p=>p.map(x=>x.id===u.id?u:x));}
    catch(e){showToast(e.message,'err');}
  };

  const doDelMeh=async(id)=>{
    if(!window.confirm('Obrisati mehaničara? (poslovi ostaju u istoriji)'))return;
    try{await api('/mehanicari/'+id,{method:'DELETE'});setMehanicari(p=>p.filter(m=>m.id!==id));showToast('Mehaničar obrisan');}
    catch(e){showToast(e.message,'err');}
  };

  return(<div className="page">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
      <div><div className="page-title">Servis</div><div className="page-sub">Radni nalozi, mehaničari i zarada</div></div>
      {mainTab==='poslovi'&&<button className="btn-add-main" onClick={openAddPosao}><Icons.Plus size={13}/> Novi posao</button>}
      {mainTab==='mehanicari'&&isAdmin&&<button className="btn-add-main" onClick={()=>setModalMeh(true)}><Icons.Plus size={13}/> Novi mehaničar</button>}
    </div>

    <div className="status-tabs" style={{marginBottom:14}}>
      {isAdmin&&<button className={"stab"+(mainTab==='pregled'?' as':'')} onClick={()=>setMainTab('pregled')}>Pregled</button>}
      <button className={"stab"+(mainTab==='poslovi'?' as':'')} onClick={()=>setMainTab('poslovi')}>Poslovi</button>
      {isAdmin&&<button className={"stab"+(mainTab==='mehanicari'?' as':'')} onClick={()=>setMainTab('mehanicari')}>Mehaničari</button>}
    </div>

    {/* PREGLED — admin only */}
    {mainTab==='pregled'&&isAdmin&&<>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
        {PERIOD_OPTS.map(([v,l])=><button key={v} className={"stab"+(period===v?' as':'')} style={{flex:'none',padding:'5px 10px'}} onClick={()=>setPeriod(v)}>{l}</button>)}
      </div>
      {loadingPregled?<div style={{color:'var(--muted)',padding:20,textAlign:'center'}}>Učitavanje...</div>:pregled&&<>
        <div className="kpi-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',marginBottom:14}}>
          <div className="kpi green"><div className="kpi-lbl">Ukupna zarada</div><div className="kpi-val" style={{color:'var(--green)',fontSize:22}}>{pregled.ukupnaZarada.toLocaleString('sr-Latn-RS')} KM</div><div className="kpi-sub">{pregled.brojPoslova} poslova</div></div>
          <div className="kpi accent"><div className="kpi-lbl">Aktivnih mehaničara</div><div className="kpi-val" style={{color:'var(--accent)',fontSize:22}}>{aktivniMeh.length}</div></div>
        </div>

        <div className="card-panel" style={{marginBottom:14}}>
          <div className="section-title">Zarada po mehaničaru</div>
          {pregled.poMehanicaru.length===0?<div style={{fontSize:12,color:'var(--muted)',padding:'10px 0'}}>Nema poslova u odabranom periodu</div>:
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {pregled.poMehanicaru.map((m,i)=>{
              const pct=pregled.ukupnaZarada>0?Math.round(m.ukupno/pregled.ukupnaZarada*100):0;
              return(<div key={i} style={{padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14}}>{i===0&&'🥇 '}{m.mehanicar_ime}</span>
                  <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,color:'var(--green)',fontSize:16}}>{m.ukupno.toLocaleString('sr-Latn-RS')} KM</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1,height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                    <div style={{width:pct+'%',height:'100%',background:'var(--green)'}}/>
                  </div>
                  <span style={{fontSize:10,color:'var(--muted)',flexShrink:0}}>{m.broj_poslova} posl. · {pct}%</span>
                </div>
              </div>);
            })}
          </div>}
        </div>
      </>}
    </>}

    {/* POSLOVI */}
    {mainTab==='poslovi'&&<div className="card-panel">
      <div className="section-title">Svi poslovi ({poslovi.length})</div>
      {poslovi.length===0?<div className="empty"><Icons.Task size={40}/><p>Nema unesenih poslova. Dodaj prvi!</p></div>:
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {poslovi.map(p=>{const dt=new Date(p.created_at);return(
          <div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14}}>{p.opis_posla}</div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>
                {p.mehanicar_ime}{p.registracija&&' · '+p.registracija} · {dt.toLocaleDateString('sr-Latn-RS')} {dt.toLocaleTimeString('sr-Latn-RS',{hour:'2-digit',minute:'2-digit'})}
              </div>
              {p.napomena&&<div style={{fontSize:11,color:'var(--muted)',marginTop:2,fontStyle:'italic'}}>{p.napomena}</div>}
            </div>
            <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,color:'var(--green)',flexShrink:0,fontSize:15}}>{p.naplaceno} KM</div>
            {isAdmin&&<div style={{display:'flex',gap:4,flexShrink:0}}>
              <button className="btn-sm" style={{padding:'4px 8px'}} onClick={()=>openEditPosao(p)}><Icons.Edit/></button>
              <button className="btn-sm red" style={{padding:'4px 8px'}} onClick={()=>doDelPosao(p.id)}><Icons.Trash/></button>
            </div>}
          </div>
        );})}
      </div>}
    </div>}

    {/* MEHANIČARI — admin only */}
    {mainTab==='mehanicari'&&isAdmin&&<div className="card-panel">
      <div className="section-title">Mehaničari ({mehanicari.length})</div>
      {mehanicari.length===0?<div className="empty"><Icons.Task size={40}/><p>Nema mehaničara. Dodaj prvog!</p></div>:
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {mehanicari.map(m=>(
          <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)',opacity:m.aktivan?1:0.5}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:m.aktivan?'var(--green)':'var(--muted)',flexShrink:0}}/>
            <span style={{flex:1,fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14}}>{m.ime}</span>
            <button className="btn-sm" style={{padding:'4px 10px'}} onClick={()=>toggleMeh(m)}>{m.aktivan?'Deaktiviraj':'Aktiviraj'}</button>
            <button className="btn-sm red" style={{padding:'4px 8px'}} onClick={()=>doDelMeh(m.id)}><Icons.Trash/></button>
          </div>
        ))}
      </div>}
    </div>}

    {/* MODAL — novi/uredi posao */}
    {modalPosao&&<div className="overlay" onClick={()=>setModalPosao(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{editingPosaoId?'Uredi posao':'Novi posao'} <button className="btn-close" onClick={()=>setModalPosao(false)}>×</button></div>
      <div className="fg2">
        <label>Mehaničar *</label>
        <select value={formPosao.mehanicar_id} onChange={e=>{
          const id=e.target.value;const m=mehanicari.find(x=>String(x.id)===id);
          setFormPosao(f=>({...f,mehanicar_id:id,mehanicar_ime:m?m.ime:f.mehanicar_ime}));
        }}>
          <option value="">— Odaberi —</option>
          {aktivniMeh.map(m=><option key={m.id} value={m.id}>{m.ime}</option>)}
        </select>
      </div>
      <div className="fg2"><label>Registracija vozila</label><input placeholder="npr. BN123-AB" value={formPosao.registracija} onChange={e=>setFormPosao(f=>({...f,registracija:e.target.value}))}/></div>
      <div className="fg2"><label>Opis posla *</label><textarea placeholder="Šta je rađeno..." value={formPosao.opis_posla} onChange={e=>setFormPosao(f=>({...f,opis_posla:e.target.value}))}/></div>
      <div className="fg2"><label>Naplaćeno (KM) *</label>
        <div className="price-row"><input className="price-inp" type="number" min="0" step="0.5" placeholder="0" value={formPosao.naplaceno} onChange={e=>setFormPosao(f=>({...f,naplaceno:e.target.value}))}/><span className="price-curr">KM</span></div>
      </div>
      <div className="fg2"><label>Napomena</label><input placeholder="opciono..." value={formPosao.napomena} onChange={e=>setFormPosao(f=>({...f,napomena:e.target.value}))}/></div>
      <div className="modal-foot">
        <button className="btn-cancel" onClick={()=>setModalPosao(false)}>Odustani</button>
        <button className="btn-save" disabled={savingPosao} onClick={doSavePosao}>{editingPosaoId?'Sačuvaj izmjene':'Dodaj posao'}</button>
      </div>
    </div></div>}

    {/* MODAL — novi mehaničar */}
    {modalMeh&&<div className="overlay" onClick={()=>setModalMeh(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Novi mehaničar <button className="btn-close" onClick={()=>setModalMeh(false)}>×</button></div>
      <div className="fg2"><label>Ime *</label><input autoFocus placeholder="npr. Marko" value={formMeh.ime} onChange={e=>setFormMeh(f=>({...f,ime:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&doAddMeh()}/></div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>setModalMeh(false)}>Odustani</button><button className="btn-save" onClick={async()=>{await doAddMeh();setModalMeh(false);}}>Dodaj</button></div>
    </div></div>}

    <div className="site-footer">© 2026 <span>DelicNode</span></div>
  </div>);
}

export default ServisModul;
