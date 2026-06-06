import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, promjerDisp, tipLbl, statusLbl, timeAgo, resizeImage } from '../utils.js';
import { Icons, ErrorBoundary, ComboBox, useImageUpload, Lightbox, ImgUploadUI, Pagination } from '../components/index.jsx';

function ZadaciModul({user,showToast}){
  const [zadaci,setZadaci]=useState([]);const [modal,setModal]=useState(false);
  const [form,setForm]=useState({naslov:'',opis:'',prioritet:'srednji'});
  const [filterStatus,setFilterStatus]=useState('otvoreno');
  const [sortPrioritet,setSortPrioritet]=useState('sve'); // sve | visok | srednji | nizak

  const load=async()=>{try{const d=await api('/zadaci');setZadaci(d);}catch(e){showToast(e.message,'err');}};
  useEffect(()=>{load();},[]);
  const toggle=async(z)=>{
    const novi=z.status==='otvoreno'?'zatvoreno':'otvoreno';
    await api('/zadaci/'+z.id,{method:'PUT',body:{...z,status:novi}});
    setZadaci(p=>p.map(x=>x.id===z.id?{...x,status:novi}:x));
    showToast(novi==='zatvoreno'?'Zadatak završen ✓':'Zadatak ponovo otvoren');
  };
  const doAdd=async()=>{
    if(!form.naslov.trim()){showToast('Naslov je obavezan','err');return;}
    const z=await api('/zadaci',{method:'POST',body:form});setZadaci(p=>[z,...p]);setModal(false);setForm({naslov:'',opis:'',prioritet:'srednji'});showToast('Zadatak dodan');
  };
  const doDel=async(id)=>{if(!window.confirm('Obrisati zadatak?'))return;await api('/zadaci/'+id,{method:'DELETE'});setZadaci(p=>p.filter(z=>z.id!=id));showToast('Zadatak obrisan');};
  const PRIOR_ORD={visok:0,srednji:1,nizak:2};
  const filtered=zadaci
    .filter(z=>(filterStatus==='sve'||z.status===filterStatus)&&(sortPrioritet==='sve'||z.prioritet===sortPrioritet))
    .sort((a,b)=>PRIOR_ORD[a.prioritet]-PRIOR_ORD[b.prioritet]);
  const otv=zadaci.filter(z=>z.status==='otvoreno').length,zatv=zadaci.filter(z=>z.status==='zatvoreno').length;
  return(<div className="page">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
      <div><div className="page-title">Zadaci</div><div className="page-sub">To-do lista za otpad</div></div>
      <button className="btn-add-main" onClick={()=>setModal(true)}><Icons.Plus size={13}/> Novi zadatak</button>
    </div>
    <div className="status-tabs">
      <button className={'stab'+(filterStatus==='otvoreno'?' as':'')} onClick={()=>setFilterStatus('otvoreno')}>Otvoreni ({otv})</button>
      <button className={'stab'+(filterStatus==='zatvoreno'?' ap':'')} onClick={()=>setFilterStatus('zatvoreno')}>Završeni ({zatv})</button>
      <button className={'stab'+(filterStatus==='sve'?' as':'')} onClick={()=>setFilterStatus('sve')}>Svi</button>
    </div>
    <div style={{display:'flex',gap:5,marginBottom:12,flexWrap:'wrap'}}>
      <span style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:9,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--muted)',alignSelf:'center',marginRight:3}}>Prioritet:</span>
      {[['sve','Svi',''],['visok','Visok','visok'],['srednji','Srednji','srednji'],['nizak','Nizak','nizak']].map(([v,l,cls])=>
        <button key={v} className={'stab'+(sortPrioritet===v?' '+(cls?'as':'as'):'')}
          style={{flex:'none',padding:'4px 10px',...(sortPrioritet===v&&cls==='visok'?{borderColor:'var(--red)',color:'var(--red)',background:'rgba(248,81,73,.08)'}:sortPrioritet===v&&cls==='srednji'?{borderColor:'var(--accent)',color:'var(--accent)',background:'rgba(240,180,41,.08)'}:sortPrioritet===v&&cls==='nizak'?{borderColor:'var(--blue)',color:'var(--blue)',background:'rgba(88,166,255,.08)'}:{})}}
          onClick={()=>setSortPrioritet(v)}>{l}</button>)}
    </div>
    <div className="zadaci-list">
      {filtered.length===0&&<div className="empty"><Icons.Task size={36}/><p>Nema zadataka.</p></div>}
      {filtered.map(z=><div key={z.id} className={'zadatak'+(z.status==='zatvoreno'?' zatvoren':'')}>
        <div className={'zadatak-check'+(z.status==='zatvoreno'?' done':'')} onClick={()=>toggle(z)}>
          {z.status==='zatvoreno'&&<Icons.Check size={10}/>}
        </div>
        <div className="zadatak-body">
          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:3}}>
            <div className="zadatak-title" style={{textDecoration:z.status==='zatvoreno'?'line-through':'none'}}>{z.naslov}</div>
            <span className={'prioritet '+z.prioritet}>{z.prioritet}</span>
          </div>
          {z.opis&&<div className="zadatak-opis">{z.opis}</div>}
          <div style={{fontSize:10,color:'var(--muted)',marginTop:4}}>{z.dodao_korisnik} · {new Date(z.created_at).toLocaleDateString('sr-Latn-RS')}</div>
        </div>
        <button className="del-btn" onClick={()=>doDel(z.id)}><Icons.Trash/></button>
      </div>)}
    </div>
    {modal&&<div className="overlay" onClick={()=>setModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Novi zadatak <button className="btn-close" onClick={()=>setModal(false)}>×</button></div>
      <div className="fg2"><label>Naslov *</label><input autoFocus value={form.naslov} onChange={e=>setForm(f=>({...f,naslov:e.target.value}))} placeholder="Šta treba uraditi?"/></div>
      <div className="fg2"><label>Opis</label><textarea value={form.opis} onChange={e=>setForm(f=>({...f,opis:e.target.value}))} placeholder="Detalji..."/></div>
      <div className="fg2"><label>Prioritet</label><select value={form.prioritet} onChange={e=>setForm(f=>({...f,prioritet:e.target.value}))}><option value="visok">Visok</option><option value="srednji">Srednji</option><option value="nizak">Nizak</option></select></div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>setModal(false)}>Odustani</button><button className="btn-save" onClick={doAdd}>Dodaj zadatak</button></div>
    </div></div>}
  <div className="site-footer">© 2026 <span>DelicNode</span></div>
  </div>);
}

// ===== GUME MODULE =====

export default ZadaciModul;
