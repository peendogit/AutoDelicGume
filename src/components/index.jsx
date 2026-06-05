import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, resizeImage } from '../utils.js';

class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(e){return {error:e};}
  render(){
    if(this.state.error){
      return <div style={{padding:24,background:'#1a0a0a',color:'#f85149',fontFamily:'monospace',fontSize:12,borderRadius:8,margin:16,border:'1px solid #f85149'}}>
        <div style={{fontFamily:"Barlow Condensed,sans-serif",fontSize:16,fontWeight:900,marginBottom:12}}>❌ GREŠKA — pošalji ovo programeru:</div>
        <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{this.state.error?.message}</pre>
        <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-all',fontSize:10,color:'#f8514988',marginTop:8}}>{this.state.error?.stack?.slice(0,500)}</pre>
        <button onClick={()=>this.setState({error:null})} style={{marginTop:12,background:'#f85149',color:'#fff',border:'none',borderRadius:4,padding:'6px 12px',cursor:'pointer',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700}}>Pokušaj ponovo</button>
      </div>;
    }
    return this.props.children;
  }
}

// ===== ICONS =====
const Icons={
  Tire:({size=20})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/></svg>,
  Car:({size=20})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17" r="2.5"/><circle cx="16.5" cy="17" r="2.5"/></svg>,
  Task:({size=20})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  Money:({size=20})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Home:({size=20})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Gear:({size=18})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Plus:({size=13})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash:({size=12})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  Edit:({size=12})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Check:({size=11})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  Logout:({size=16})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Chart:({size=20})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Log:({size=20})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Img:({size=20})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Search:({size=13})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Move:({size=14})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l-3 3 3 3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/></svg>,
  History:({size=14})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Link:({size=13})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
};

// ===== COMBOBOX =====

function ComboBox({value,onChange,options,placeholder,normalize}){
  const [showCustom,setShowCustom]=useState(false);
  const isCustom=value&&!options.includes(value);
  return(<div>
    <select style={{width:'100%',background:'var(--card)',border:'1.5px solid var(--border)',borderRadius:5,color:value&&!isCustom?'var(--text)':'var(--muted)',fontFamily:'Barlow,sans-serif',fontSize:13,padding:'8px 10px',outline:'none'}}
      value={showCustom||isCustom?'__custom__':value||''}
      onChange={e=>{if(e.target.value==='__custom__'){setShowCustom(true);onChange('');}else{setShowCustom(false);onChange(normalize?normalize(e.target.value):e.target.value);}}}>
      <option value="">{placeholder||'Odaberi'}</option>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
      <option value="__custom__">Unesi ručno...</option>
    </select>
    {(showCustom||isCustom)&&<input autoFocus className="combo-custom" value={value} placeholder="Unesi vrijednost..."
      onChange={e=>onChange(normalize?normalize(e.target.value):e.target.value)}/>}
  </div>);
}

// ===== IMAGE UPLOAD HOOK =====

function useImageUpload(initialSlike=[]){
  const [slike,setSlike]=useState(initialSlike);
  const [uploadState,setUploadState]=useState({uploading:false,done:0,total:0});
  const uploadingRef=useRef(false);
  const fileRef=useRef();
  const progress=uploadState.total>0?Math.round((uploadState.done/uploadState.total)*100):0;
  const handleFiles=async(e)=>{
    const files=Array.from(e.target.files);if(!files.length)return;e.target.value='';
    if(uploadingRef.current)return;uploadingRef.current=true;
    setUploadState({uploading:true,done:0,total:files.length});
    const results=[];
    for(let i=0;i<files.length;i++){
      // Resize on client side first
      const dataURL=await resizeImage(files[i]);
      // Upload to server disk
      try{
        const r=await fetch('/api/upload-slika',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataURL})});
        const d=await r.json();
        results.push(d.url||dataURL); // Fallback to base64 if upload fails
      }catch(err){
        results.push(dataURL); // Fallback to base64
      }
      setUploadState({uploading:true,done:i+1,total:files.length});
    }
    setSlike(p=>[...p,...results]);setUploadState({uploading:false,done:0,total:0});uploadingRef.current=false;
  };
  const removeImg=(i)=>setSlike(p=>p.filter((_,j)=>j!==i));
  return{slike,setSlike,uploadState,uploadingRef,progress,handleFiles,removeImg,fileRef};
}

// ===== LIGHTBOX =====

function Lightbox({images,startIndex,onClose}){
  const [idx,setIdx]=useState(startIndex||0);
  const [scale,setScale]=useState(1);
  const [offset,setOffset]=useState({x:0,y:0});
  const [dragging,setDragging]=useState(false);
  const pinchRef=useRef(null);const pinchScaleRef=useRef(1);
  const dragRef=useRef(null);const lastTap=useRef(0);
  const touchStartX=useRef(null);const touchStartY=useRef(null);
  useEffect(()=>{setScale(1);setOffset({x:0,y:0});},[idx]);
  useEffect(()=>{
    const h=e=>{
      if(e.key==='Escape'){if(scale>1){setScale(1);setOffset({x:0,y:0});}else onClose();}
      if(e.key==='ArrowRight'&&scale===1)setIdx(i=>Math.min(i+1,images.length-1));
      if(e.key==='ArrowLeft'&&scale===1)setIdx(i=>Math.max(i-1,0));
    };
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  },[images,onClose,scale]);
  const onTouchStart=e=>{
    if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;pinchRef.current=Math.sqrt(dx*dx+dy*dy);pinchScaleRef.current=scale;return;}
    touchStartX.current=e.touches[0].clientX;touchStartY.current=e.touches[0].clientY;
    if(scale>1)dragRef.current={x:e.touches[0].clientX-offset.x,y:e.touches[0].clientY-offset.y};
    const now=Date.now();if(now-lastTap.current<300){e.stopPropagation();if(scale>1){setScale(1);setOffset({x:0,y:0});}else setScale(2.5);lastTap.current=0;}else lastTap.current=now;
  };
  const onTouchMove=e=>{
    e.stopPropagation();
    if(e.touches.length===2&&pinchRef.current){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;const d=Math.sqrt(dx*dx+dy*dy);const ns=Math.min(Math.max(pinchScaleRef.current*(d/pinchRef.current),1),5);setScale(ns);if(ns===1)setOffset({x:0,y:0});return;}
    if(e.touches.length===1&&scale>1&&dragRef.current)setOffset({x:e.touches[0].clientX-dragRef.current.x,y:e.touches[0].clientY-dragRef.current.y});
  };
  const onTouchEnd=e=>{
    if(pinchRef.current){pinchRef.current=null;return;}if(scale>1){dragRef.current=null;return;}
    if(touchStartX.current===null)return;
    const dx=e.changedTouches[0].clientX-touchStartX.current,dy=Math.abs(e.changedTouches[0].clientY-touchStartY.current);
    if(dy<40){if(dx>60)setIdx(i=>Math.max(i-1,0));else if(dx<-60)setIdx(i=>Math.min(i+1,images.length-1));}
    touchStartX.current=null;touchStartY.current=null;
  };
  const onWheel=e=>{e.stopPropagation();setScale(s=>{const n=Math.min(Math.max(s+(e.deltaY>0?-.3:.3),1),5);if(n===1)setOffset({x:0,y:0});return n;});};
  return(
    <div className="lightbox" onClick={scale>1?undefined:onClose} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onWheel={onWheel} onMouseMove={e=>{if(dragging&&scale>1&&dragRef.current)setOffset({x:e.clientX-dragRef.current.x,y:e.clientY-dragRef.current.y});}} onMouseUp={()=>setDragging(false)} style={{cursor:scale>1?(dragging?'grabbing':'grab'):'default'}}>
      <button className="lightbox-close" onClick={onClose}>×</button>
      {images.length>1&&<div style={{position:'absolute',top:16,left:'50%',transform:'translateX(-50%)',background:'rgba(0,0,0,.6)',color:'#fff',fontFamily:'Barlow Condensed,sans-serif',fontSize:13,fontWeight:700,padding:'3px 12px',borderRadius:20,letterSpacing:'1px',zIndex:1}}>{idx+1} / {images.length}</div>}
      {scale>1&&<div style={{position:'absolute',top:16,right:16,background:'rgba(0,0,0,.6)',color:'#fff',fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:700,padding:'3px 10px',borderRadius:20,zIndex:1}}>{Math.round(scale*100)}%</div>}
      {scale>1&&<button onClick={e=>{e.stopPropagation();setScale(1);setOffset({x:0,y:0});}} style={{position:'absolute',bottom:60,right:16,background:'rgba(255,255,255,.15)',border:'none',color:'#fff',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:700,zIndex:1}}>Poništi zoom</button>}
      {scale===1&&idx>0&&<button className="lightbox-nav prev" onClick={e=>{e.stopPropagation();setIdx(i=>Math.max(i-1,0));}}>‹</button>}
      <img src={images[idx]} alt="" onClick={e=>{if(scale>1)e.stopPropagation();}} onMouseDown={e=>{if(scale>1){e.stopPropagation();setDragging(true);dragRef.current={x:e.clientX-offset.x,y:e.clientY-offset.y};}}} style={{maxWidth:'100%',maxHeight:'80vh',borderRadius:8,objectFit:'contain',userSelect:'none',transform:`scale(${scale}) translate(${offset.x/scale}px,${offset.y/scale}px)`,transition:dragging?'none':'transform .15s ease',cursor:scale>1?(dragging?'grabbing':'grab'):'zoom-in'}}/>
      {scale===1&&idx<images.length-1&&<button className="lightbox-nav next" onClick={e=>{e.stopPropagation();setIdx(i=>Math.min(i+1,images.length-1));}}>›</button>}
      {images.length>1&&scale===1&&<div style={{position:'absolute',bottom:20,left:'50%',transform:'translateX(-50%)',display:'flex',gap:6}}>{images.map((_,i)=><span key={i} onClick={e=>{e.stopPropagation();setIdx(i);}} style={{width:i===idx?20:8,height:8,borderRadius:4,background:i===idx?'#fff':'rgba(255,255,255,.4)',cursor:'pointer',transition:'all .2s'}}/>)}</div>}
    </div>
  );
}

// ===== IMG UPLOAD UI =====

function ImgUploadUI({slike,progress,uploadState,uploadingRef,handleFiles,removeImg,fileRef,onThumbClick}){
  return(<div className="fg2">
    <label>Slike</label>
    <div className="img-zone" onClick={()=>!uploadState.uploading&&(()=>{if(fileRef.current){fileRef.current.removeAttribute('capture');fileRef.current.click();}})()}>
      <Icons.Img size={22}/><span>{uploadState.uploading?'Obrađivanje...':'Dodaj slike'}</span>
      {!uploadState.uploading&&<span style={{fontSize:10,color:'var(--muted)'}}>JPG, PNG — automatski se optimizuju</span>}
    </div>
    {uploadState.uploading&&<div style={{marginTop:6}}><div className="upload-bar-wrap"><div className="upload-bar" style={{width:progress+'%'}}/></div><div style={{fontSize:10,color:'var(--muted)',textAlign:'center'}}>Obrađena {uploadState.done} od {uploadState.total} ({progress}%)</div></div>}
    <input ref={fileRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handleFiles}/>
    <div style={{display:'flex',gap:6,marginTop:6}}>
      <button style={{flex:1,background:'none',border:'1px dashed var(--border)',color:'var(--muted)',borderRadius:5,padding:'5px',fontSize:11,fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,cursor:'pointer',letterSpacing:'1px',textTransform:'uppercase'}} onClick={()=>{if(fileRef.current){fileRef.current.removeAttribute('capture');fileRef.current.click();}}}>🖼 Galerija</button>
      <button style={{flex:1,background:'none',border:'1px dashed var(--accent)',color:'var(--accent)',borderRadius:5,padding:'5px',fontSize:11,fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,cursor:'pointer',letterSpacing:'1px',textTransform:'uppercase'}} onClick={()=>{if(fileRef.current){fileRef.current.setAttribute('capture','environment');fileRef.current.click();}}}>📷 Kamera</button>
    </div>
    {slike.length>0&&<div className="img-grid">{slike.map((src,i)=><div key={i} className="img-item"><img src={src} alt="" onClick={()=>onThumbClick&&onThumbClick(i)}/><button className="img-rm" onClick={()=>removeImg(i)}>×</button></div>)}</div>}
  </div>);
}

// ===== LOGIN =====

function Pagination({page, total, perPage, onChange}){
  const totalPages = Math.ceil(total/perPage);
  if(totalPages<=1) return null;
  return(<div style={{display:'flex',gap:4,justifyContent:'center',padding:'16px 0',flexWrap:'wrap'}}>
    <button className="btn-sm" disabled={page===1} onClick={()=>onChange(page-1)} style={{padding:'4px 10px'}}>←</button>
    {Array.from({length:Math.min(totalPages,7)},(_,i)=>{
      let p;
      if(totalPages<=7) p=i+1;
      else if(page<=4) p=i+1;
      else if(page>=totalPages-3) p=totalPages-6+i;
      else p=page-3+i;
      return p>=1&&p<=totalPages?<button key={p} className={"btn-sm"+(p===page?' as':'')} onClick={()=>onChange(p)} style={{padding:'4px 10px',minWidth:32}}>{p}</button>:null;
    })}
    <button className="btn-sm" disabled={page===totalPages} onClick={()=>onChange(page+1)} style={{padding:'4px 10px'}}>→</button>
    <span style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:11,color:'var(--muted)',alignSelf:'center',marginLeft:4}}>{page}/{totalPages} ({total} ukupno)</span>
  </div>);
}

// ===== MAIN APP =====

export { ErrorBoundary, ComboBox, useImageUpload, Lightbox, ImgUploadUI, Pagination };
