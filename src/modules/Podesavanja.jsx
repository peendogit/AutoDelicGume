import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, getToken, promjerDisp, tipLbl, statusLbl, timeAgo, resizeImage, PROMJER_OPTIONS, SIRINA_OPTIONS, VISINA_OPTIONS, fmtDate } from '../utils.js';
import { Icons, ErrorBoundary, ComboBox, useImageUpload, Lightbox, ImgUploadUI, Pagination } from '../components/index.jsx';

function PodesavanjaModul({user,showToast,magacini,setMagacini,police,loadPolice}){
  const [setTab,setSetTab]=useState('magacin');
  const [korisnici,setKorisnici]=useState([]);
  const [cjenovnikLista,setCjenovnikLista]=useState([]);
  const [editCjenovnik,setEditCjenovnik]=useState(null);
  const [cjenovnikForm,setCjenovnikForm]=useState({dimenzija:'',sezona:'',cijena_min:'',cijena_max:'',napomena:''});
  const loadCjenovnik=async()=>{try{const d=await api('/cjenovnik');setCjenovnikLista(d);}catch(e){}};
  const [openMag,setOpenMag]=useState({});const [openProlaz,setOpenProlaz]=useState({});const [openRegal,setOpenRegal]=useState({});
  const [customPolica,setCustomPolica]=useState({});
  const [newMagName,setNewMagName]=useState('');
  const [newUser,setNewUser]=useState({username:'',password:'',role:'radnik'});
  const [editUser,setEditUser]=useState(null);
  const [customSirina,setCustomSirina]=useState(()=>{try{return JSON.parse(localStorage.getItem('adg_sirina')||'[]');}catch{return [];}});
  const [customVisina,setCustomVisina]=useState(()=>{try{return JSON.parse(localStorage.getItem('adg_visina')||'[]');}catch{return [];}});
  const [customPromjer,setCustomPromjer]=useState(()=>{try{return JSON.parse(localStorage.getItem('adg_promjer')||'[]');}catch{return [];}});
  const [newDimVal,setNewDimVal]=useState({sirina:'',visina:'',promjer:''});

  const loadKorisnici=async()=>{try{const k=await api('/korisnici');setKorisnici(k);}catch(e){showToast(e.message,'err');}};
  useEffect(()=>{
    if(setTab==='korisnici')loadKorisnici();
    if(setTab==='cjenovnik')loadCjenovnik();
  },[setTab]);

  const doDelMag=async(id)=>{if(!window.confirm('Brisanje magacina će obrisati i sve prolaze, regale i police unutar njega.\nDa li ste sigurni?'))return;await api('/magacini/'+id,{method:'DELETE'});setMagacini(p=>p.filter(m=>m.id!=id));await loadPolice();showToast('Magacin obrisan');};
  const doAddMag=async()=>{if(!newMagName.trim())return;try{const m=await api('/magacini',{method:'POST',body:{naziv:newMagName.trim()}});m.prolazi=[];setMagacini(p=>[...p,m]);setOpenMag(p=>({...p,[m.id]:true}));setNewMagName('');showToast('Magacin "'+newMagName.trim()+'" kreiran');}catch(e){showToast(e.message,'err');}};
  const doAddMagDirect=async(naziv)=>{try{const m=await api('/magacini',{method:'POST',body:{naziv}});m.prolazi=[];setMagacini(p=>[...p,m]);setOpenMag(p=>({...p,[m.id]:true}));showToast('Magacin "'+naziv+'" kreiran');}catch(e){showToast(e.message,'err');}};
  const doAddProlaz=async(mid)=>{const pr=await api('/prolazi',{method:'POST',body:{magacin_id:mid}});pr.regali=[];setMagacini(p=>p.map(m=>m.id!=mid?m:{...m,prolazi:[...m.prolazi,pr]}));setOpenProlaz(p=>({...p,[pr.id]:true}));};
  const doDelProlaz=async(mid,pid)=>{if(!window.confirm('Obrisati prolaz i sve u njemu?'))return;await api('/prolazi/'+pid,{method:'DELETE'});setMagacini(p=>p.map(m=>m.id!=mid?m:{...m,prolazi:m.prolazi.filter(pr=>pr.id!=pid)}));await loadPolice();};
  const doAddRegal=async(mid,pid)=>{const r=await api('/regali',{method:'POST',body:{prolaz_id:pid}});r.police=[];setMagacini(p=>p.map(m=>m.id!=mid?m:{...m,prolazi:m.prolazi.map(pr=>pr.id!=pid?pr:{...pr,regali:[...pr.regali,r]})}));setOpenRegal(p=>({...p,[r.id]:true}));};
  const doDelRegal=async(mid,pid,rid)=>{if(!window.confirm('Obrisati regal i sve police u njemu?'))return;await api('/regali/'+rid,{method:'DELETE'});setMagacini(p=>p.map(m=>m.id!=mid?m:{...m,prolazi:m.prolazi.map(pr=>pr.id!=pid?pr:{...pr,regali:pr.regali.filter(r=>r.id!=rid)})}));await loadPolice();};
  const doAddPolica=async(mid,pid,rid)=>{try{const pl=await api('/police/auto',{method:'POST',body:{regal_id:rid}});setMagacini(p=>p.map(m=>m.id!=mid?m:{...m,prolazi:m.prolazi.map(pr=>pr.id!=pid?pr:{...pr,regali:pr.regali.map(r=>r.id!=rid?r:{...r,police:[...r.police,pl]})})}));setOpenRegal(p=>({...p,[rid]:true}));await loadPolice();}catch(e){showToast(e.message,'err');}};
  const doAddCustomPolica=async(rid,mid,pid)=>{const raw=(customPolica[rid]||'').trim();if(!raw)return;try{const pl=await api('/police/custom',{method:'POST',body:{regal_id:rid,naziv:raw}});setMagacini(p=>p.map(m=>m.id!=mid?m:{...m,prolazi:m.prolazi.map(pr=>pr.id!=pid?pr:{...pr,regali:pr.regali.map(r=>r.id!=rid?r:{...r,police:[...r.police,pl]})})}));setCustomPolica(p=>({...p,[rid]:''}));setOpenRegal(p=>({...p,[rid]:true}));await loadPolice();}catch(e){showToast(e.message,'err');}};
  const doDelPolica=async(mid,pid,rid,plid)=>{if(!window.confirm('Obrisati policu?'))return;await api('/police/'+plid,{method:'DELETE'});setMagacini(p=>p.map(m=>m.id!=mid?m:{...m,prolazi:m.prolazi.map(pr=>pr.id!=pid?pr:{...pr,regali:pr.regali.map(r=>r.id!=rid?r:{...r,police:r.police.filter(pl=>pl.id!=plid)})})}));await loadPolice();};
  const doAddUser=async()=>{if(!newUser.username||!newUser.password){showToast('Unesite korisničko ime i lozinku','err');return;}try{const k=await api('/korisnici',{method:'POST',body:newUser});setKorisnici(p=>[...p,k]);setNewUser({username:'',password:'',role:'radnik'});showToast('Korisnik "'+k.username+'" kreiran');}catch(e){showToast(e.message,'err');}};
  const doDelUser=async(id)=>{if(!window.confirm('Da li ste sigurni da želite obrisati ovog korisnika?'))return;await api('/korisnici/'+id,{method:'DELETE'});setKorisnici(p=>p.filter(k=>k.id!=id));showToast('Korisnik obrisan');};
  const doEditUser=async()=>{if(!editUser||!editUser.username.trim()){showToast('Korisničko ime je obavezno','err');return;}try{const body={username:editUser.username.trim(),role:editUser.role};if(editUser.password.trim())body.password=editUser.password.trim();const updated=await api('/korisnici/'+editUser.id,{method:'PUT',body});setKorisnici(p=>p.map(k=>k.id===updated.id?updated:k));setEditUser(null);showToast('Korisnik "'+updated.username+'" ažuriran');}catch(e){showToast(e.message,'err');}};
  const doBackup=async()=>{try{showToast('Preuzimanje rezervne kopije...');const res=await fetch('/api/backup',{headers:{'Authorization':'Bearer '+getToken()}});if(!res.ok){const d=await res.json();showToast(d.error||'Greška','err');return;}const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');const date=new Date().toISOString().slice(0,10);a.href=url;a.download='autodelic-backup-'+date+'.json';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);showToast('Rezervna kopija preuzeta!');}catch(e){showToast('Greška: '+e.message,'err');}};
  const addCustomDim=(type,val)=>{val=val.trim();if(!val)return;if(type==='sirina'){const n=[...customSirina,val];setCustomSirina(n);localStorage.setItem('adg_sirina',JSON.stringify(n));}if(type==='visina'){const n=[...customVisina,val];setCustomVisina(n);localStorage.setItem('adg_visina',JSON.stringify(n));}if(type==='promjer'){const n=[...customPromjer,val.toUpperCase()];setCustomPromjer(n);localStorage.setItem('adg_promjer',JSON.stringify(n));}setNewDimVal(p=>({...p,[type]:''}));showToast('Dimenzija dodana');};
  const removeCustomDim=(type,val)=>{if(type==='sirina'){const n=customSirina.filter(x=>x!==val);setCustomSirina(n);localStorage.setItem('adg_sirina',JSON.stringify(n));}if(type==='visina'){const n=customVisina.filter(x=>x!==val);setCustomVisina(n);localStorage.setItem('adg_visina',JSON.stringify(n));}if(type==='promjer'){const n=customPromjer.filter(x=>x!==val);setCustomPromjer(n);localStorage.setItem('adg_promjer',JSON.stringify(n));}};

  return(<div className="page">
    <div className="set-tabs">
      <button className={'set-tab'+(setTab==='magacin'?' on':'')} onClick={()=>setSetTab('magacin')}>🏠 Magacin</button>
      <button className={'set-tab'+(setTab==='korisnici'?' on':'')} onClick={()=>setSetTab('korisnici')}>👥 Korisnici</button>
      <button className={'set-tab'+(setTab==='dimenzije'?' on':'')} onClick={()=>setSetTab('dimenzije')}>📐 Dimenzije</button>
      <button className={'set-tab'+(setTab==='cjenovnik'?' on':'')} onClick={()=>setSetTab('cjenovnik')}>💰 Cjenovnik</button>
    </div>

    {setTab==='magacin'&&<>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
        <button className="btn-new" onClick={()=>{const n=prompt('Naziv novog magacina:');if(n&&n.trim())doAddMagDirect(n.trim());}}><Icons.Plus size={11}/> Novi magacin</button>
      </div>
      {magacini.map(m=><div key={m.id} className="mag-card">
        <div className="tree-row" onClick={()=>setOpenMag(p=>({...p,[m.id]:!p[m.id]}))}>
          <div className="tree-lbl-mag">{m.naziv}<span style={{fontSize:10,color:'var(--muted)',fontWeight:400,textTransform:'none',letterSpacing:0,marginLeft:6}}>{m.prolazi.length} prolaza</span></div>
          <div style={{display:'flex',gap:5,alignItems:'center'}}><span className="del-btn" onClick={e=>{e.stopPropagation();doDelMag(m.id);}}><Icons.Trash/></span><span style={{fontSize:9,color:'var(--muted)'}}>{openMag[m.id]?'▲':'▼'}</span></div>
        </div>
        {openMag[m.id]&&<div style={{padding:'0 12px 12px'}}>
          {m.prolazi.map(pr=><div key={pr.id} style={{background:'var(--surf)',border:'1px solid var(--border)',borderRadius:5,overflow:'hidden',marginBottom:4}}>
            <div className="tree-row" onClick={()=>setOpenProlaz(p=>({...p,[pr.id]:!p[pr.id]}))}>
              <span className="tree-lbl-prolaz">{pr.naziv}</span>
              <div style={{display:'flex',gap:4,alignItems:'center'}}><span className="del-btn" onClick={e=>{e.stopPropagation();doDelProlaz(m.id,pr.id);}}><Icons.Trash/></span><span style={{fontSize:9,color:'var(--muted)'}}>{openProlaz[pr.id]?'▲':'▼'}</span></div>
            </div>
            {openProlaz[pr.id]&&<div style={{padding:'4px 10px 10px'}}>
              {pr.regali.map(r=><div key={r.id} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:4,overflow:'hidden',marginBottom:3}}>
                <div className="tree-row" onClick={()=>setOpenRegal(p=>({...p,[r.id]:!p[r.id]}))}>
                  <span className="tree-lbl-regal">{r.naziv} ({r.police.length})</span>
                  <div style={{display:'flex',gap:4,alignItems:'center'}}><span className="del-btn" onClick={e=>{e.stopPropagation();doDelRegal(m.id,pr.id,r.id);}}><Icons.Trash/></span><span style={{fontSize:9,color:'var(--muted)'}}>{openRegal[r.id]?'▲':'▼'}</span></div>
                </div>
                {openRegal[r.id]&&<div style={{padding:'4px 8px 8px'}}>
                  <div className="police-wrap">{r.police.map(pl=><div key={pl.id} className="polica-chip">{pl.naziv}<span className="del-btn" style={{padding:0}} onClick={e=>{e.stopPropagation();doDelPolica(m.id,pr.id,r.id,pl.id);}}><span style={{fontSize:10}}>×</span></span></div>)}</div>
                  <div className="add-row"><span className="add-btn" onClick={e=>{e.stopPropagation();doAddPolica(m.id,pr.id,r.id);}}><Icons.Plus size={9}/> Auto</span></div>
                  <div style={{display:'flex',gap:4,marginTop:4}} onClick={e=>e.stopPropagation()}>
                    <input className="cust-inp" placeholder="P2334" value={customPolica[r.id]||''} onChange={e=>setCustomPolica(p=>({...p,[r.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&doAddCustomPolica(r.id,m.id,pr.id)}/>
                    <span className="add-btn" style={{border:'1px solid var(--accent)',color:'var(--accent)'}} onClick={()=>doAddCustomPolica(r.id,m.id,pr.id)}><Icons.Plus size={9}/> Custom</span>
                  </div>
                </div>}
              </div>)}
              <div className="add-row" onClick={e=>e.stopPropagation()}><span className="add-btn" onClick={()=>doAddRegal(m.id,pr.id)}><Icons.Plus size={9}/> Regal</span></div>
            </div>}
          </div>)}
          <div className="add-row" onClick={e=>e.stopPropagation()}><span className="add-btn" onClick={()=>doAddProlaz(m.id)}><Icons.Plus size={9}/> Prolaz</span></div>
        </div>}
      </div>)}
    </>}

    {setTab==='korisnici'&&<>
      <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:7,padding:'12px 14px',marginBottom:12}}>
        <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:11,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--muted)',marginBottom:9}}>Novi korisnik</div>
        <div className="two-col" style={{gap:7,marginBottom:7}}>
          <div className="fg2" style={{marginBottom:0}}><label>Korisničko ime</label><input value={newUser.username} onChange={e=>setNewUser(u=>({...u,username:e.target.value}))} placeholder="marko"/></div>
          <div className="fg2" style={{marginBottom:0}}><label>Lozinka</label><input type="password" value={newUser.password} onChange={e=>setNewUser(u=>({...u,password:e.target.value}))} placeholder="••••••"/></div>
        </div>
        <div style={{display:'flex',gap:7,alignItems:'center'}}>
          <div className="fg2" style={{marginBottom:0,flex:1}}><label>Uloga</label><select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))}><option value="radnik">Radnik</option><option value="admin">Admin</option></select></div>
          <button className="btn-new" style={{marginTop:14}} onClick={doAddUser}><Icons.Plus size={10}/> Dodaj</button>
        </div>
      </div>
      {korisnici.map(k=><div key={k.id} className="user-item">
        <div style={{flex:1,minWidth:0}}><div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{k.username}</div><div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{fmtDate(k.created_at)}</div></div>
        <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
          <span className={'user-role '+k.role}>{k.role}</span>
          <button className="del-btn" style={{color:'var(--blue)',opacity:.8}} title="Uredi" onClick={()=>setEditUser({...k,password:''})}><Icons.Edit/></button>
          {k.role!=='admin'&&<button className="del-btn" onClick={()=>doDelUser(k.id)}><Icons.Trash/></button>}
        </div>
      </div>)}
      <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
        <button className="btn-new" style={{background:'var(--blue)',width:'100%',justifyContent:'center',gap:6}} onClick={doBackup}>💾 Preuzmi rezervnu kopiju podataka</button>
        <div style={{fontSize:10,color:'var(--muted)',marginTop:5,textAlign:'center'}}>JSON fajl — sačuvaj na sigurno mjesto</div>
      </div>
    </>}

    {setTab==='dimenzije'&&<div>{[{label:'Širina (mm)',type:'sirina',base:SIRINA_OPTIONS,custom:customSirina},{label:'Profil (%)',type:'visina',base:VISINA_OPTIONS,custom:customVisina},{label:'Prečnik',type:'promjer',base:PROMJER_OPTIONS,custom:customPromjer}].map(({label,type,base,custom})=>(
      <div key={type} style={{marginBottom:14,background:'var(--card)',border:'1px solid var(--border)',borderRadius:7,padding:'11px 13px'}}>
        <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:11,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--muted)',marginBottom:8}}>{label}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
          {base.map(v=><span key={v} style={{background:'rgba(255,255,255,.05)',border:'1px solid var(--border)',borderRadius:3,fontFamily:'Barlow Condensed,sans-serif',fontSize:11,fontWeight:700,padding:'2px 7px',color:'var(--muted)'}}>{v}</span>)}
          {custom.map(v=><span key={v} style={{background:'rgba(240,180,41,.1)',border:'1px solid rgba(240,180,41,.3)',borderRadius:3,fontFamily:'Barlow Condensed,sans-serif',fontSize:11,fontWeight:700,padding:'2px 7px',color:'var(--accent)',display:'inline-flex',alignItems:'center',gap:4}}>{v}<span style={{cursor:'pointer',fontSize:12,lineHeight:1}} onClick={()=>removeCustomDim(type,v)}>×</span></span>)}
        </div>
        <div style={{display:'flex',gap:5}}>
          <input style={{flex:1,background:'var(--surf)',border:'1px dashed var(--border)',borderRadius:4,color:'var(--text)',fontFamily:'Barlow,sans-serif',fontSize:12,padding:'5px 8px',outline:'none'}} placeholder={'Dodaj npr. '+(type==='sirina'?'185':type==='visina'?'45':'21')} value={newDimVal[type]||''} onChange={e=>setNewDimVal(p=>({...p,[type]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addCustomDim(type,newDimVal[type]||'')}/>
          <button className="btn-new" onClick={()=>addCustomDim(type,newDimVal[type]||'')}><Icons.Plus size={10}/> Dodaj</button>
        </div>
      </div>
    ))}</div>}

    {setTab==='cjenovnik'&&<div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
        <button className="btn-new" onClick={()=>{setCjenovnikForm({dimenzija:'',sezona:'',cijena_min:'',cijena_max:'',napomena:''});setEditCjenovnik(null);setCjenovnikModal(true);}}><Icons.Plus size={10}/> Dodaj cijenu</button>
      </div>
      {cjenovnikLista.length===0?<div style={{fontSize:12,color:'var(--muted)',padding:'20px 0',textAlign:'center'}}>Nema unesenih cijena.</div>:
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        {cjenovnikLista.map(c=><div key={c.id} style={{display:'flex',alignItems:'center',gap:10,background:'var(--card)',border:'1px solid var(--border)',borderRadius:7,padding:'8px 12px'}}>
          <div style={{flex:1}}><div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:15,letterSpacing:'1px'}}>{c.dimenzija}</div>
          <div style={{fontSize:10,color:'var(--muted)'}}>{c.sezona||'Sve sezone'}{c.napomena?' · '+c.napomena:''}</div></div>
          <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:14,color:'var(--accent)'}}>{c.cijena_min===c.cijena_max?c.cijena_min+' KM':c.cijena_min+'–'+c.cijena_max+' KM'}</div>
          <button className="del-btn" style={{color:'var(--blue)',opacity:1}} onClick={()=>{setEditCjenovnik(c);setCjenovnikForm({dimenzija:c.dimenzija,sezona:c.sezona||'',cijena_min:String(c.cijena_min),cijena_max:String(c.cijena_max),napomena:c.napomena||''});setCjenovnikModal(true);}}><Icons.Edit/></button>
          <button className="del-btn" onClick={async()=>{if(!window.confirm('Obrisati?'))return;await api('/cjenovnik/'+c.id,{method:'DELETE'});setCjenovnikLista(p=>p.filter(x=>x.id!=c.id));}}><Icons.Trash/></button>
        </div>)}
      </div>}
    </div>}

  
    {editUser&&<div className="overlay" onClick={()=>setEditUser(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Uredi korisnika <button className="btn-close" onClick={()=>setEditUser(null)}>×</button></div>
      <div className="fg2"><label>Korisničko ime</label><input autoFocus value={editUser.username} onChange={e=>setEditUser(u=>({...u,username:e.target.value}))} placeholder="korisničko_ime"/></div>
      <div className="fg2"><label>Nova lozinka (ostavi prazno da ne mijenjaš)</label><input type="password" value={editUser.password} onChange={e=>setEditUser(u=>({...u,password:e.target.value}))} placeholder="••••••"/></div>
      <div className="fg2"><label>Uloga</label><select value={editUser.role} onChange={e=>setEditUser(u=>({...u,role:e.target.value}))}><option value="radnik">Radnik</option><option value="admin">Admin</option></select></div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>setEditUser(null)}>Odustani</button><button className="btn-save" onClick={doEditUser}>Sačuvaj izmjene</button></div>
    </div></div>}
  </div>);
}


// ===== PREMJEŠTANJE WIDGET (na Dashboardu) =====
// ===== ANALITIKA MODULE =====

// ===== PAGINATION HELPER =====

export default PodesavanjaModul;
