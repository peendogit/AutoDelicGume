import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils.js';
import { Icons, SimplePagination } from '../components/index.jsx';

const VRSTE=['Aluminijumske','Čelične','Rezervni točak'];
const RUPE=['3x98','3x112','4x98','4x100','4x108','4x114.3','5x100','5x105','5x108','5x110','5x112','5x114.3','5x115','5x118','5x120','5x127','5x130','6x114.3','6x130','6x139.7'];
const PRECNICI=['13','14','15','16','17','18','19','20','21','22'];
const SIRINE=['4.5','5','5.5','6','6.5','7','7.5','8','8.5','9','9.5','10','10.5','11','12'];

function FelneModul({user,showToast,quickAdd,onQuickAddDone,setLightbox}){
  const isAdmin=user.role==='admin';
  const [felne,setFelne]=useState([]);
  const [loading,setLoading]=useState(false);
  const [filter,setFilter]=useState({vrsta:'',rupe:'',precnik:'',sirina:'',sifra:'',stanje:'na_stanju',centralna_rupa:'',marka:''});
  const [detail,setDetail]=useState(null);
  const [page,setPage]=useState(1);const PER_PAGE=15;
  const [modal,setModal]=useState(false);
  const [editId,setEditId]=useState(null);
  const emptyForm={vrsta:'',rupe:'',precnik:'',sirina:'',et:'',centralna_rupa:'',marka:'',model:'',kolicina:'4',ostecenje:false,napomena:'',cijena:'',slike:[]};
  const [form,setForm]=useState(emptyForm);
  const [saving,setSaving]=useState(false);
  const [prodajaModal,setProdajaModal]=useState(null);
  const [prodajnaCijena,setProdajnaCijena]=useState('');
  const [nalogModal,setNalogModal]=useState(null);
  const [nalogForm,setNalogForm]=useState({napomena:'',hitno:false,za_slanje:false});
  const [nalogSaving,setNalogSaving]=useState(false);
  const [felneSaNalogom,setFelneSaNalogom]=useState(new Map());
  const loadNalozi=async()=>{try{const d=await api('/nalozi');if(Array.isArray(d)){const m=new Map();d.forEach(n=>{if(n.guma_id<0)m.set(-n.guma_id,{status:n.status,nalogId:n.id});});setFelneSaNalogom(m);}}catch(e){}};

  const load=async()=>{
    setLoading(true);
    try{
      const q=new URLSearchParams();
      Object.entries(filter).forEach(([k,v])=>{if(v)q.set(k,v);});
      const d=await api('/felne?'+q.toString());
      setFelne(d);
    }catch(e){showToast(e.message,'err');}
    setLoading(false);
  };
  useEffect(()=>{load();},[filter]);
  useEffect(()=>{loadNalozi();},[]);
  useEffect(()=>{setPage(1);},[filter]);
  useEffect(()=>{if(quickAdd){openAdd();onQuickAddDone&&onQuickAddDone();}},[quickAdd]);

  const openAdd=()=>{setForm(emptyForm);setEditId(null);setModal(true);};
  const openEdit=(f)=>{setForm({vrsta:f.vrsta,rupe:f.rupe,precnik:f.precnik,sirina:f.sirina,et:f.et||'',centralna_rupa:f.centralna_rupa||'',marka:f.marka,model:f.model||'',kolicina:String(f.kolicina||4),ostecenje:!!f.ostecenje,napomena:f.napomena||'',cijena:f.cijena??'',slike:f.slike||[]});setEditId(f.id);setModal(true);};

  const doSave=async()=>{
    if(!form.vrsta||!form.rupe||!form.precnik||!form.sirina||!form.marka.trim()){showToast('Vrsta, rupe, prečnik, širina i marka su obavezni','err');return;}
    setSaving(true);
    try{
      let f;
      if(editId){f=await api('/felne/'+editId,{method:'PUT',body:form});setFelne(p=>p.map(x=>x.id===f.id?f:x));showToast('Sačuvano');}
      else{f=await api('/felne',{method:'POST',body:form});setFelne(p=>[f,...p]);showToast('Set dodan — '+f.sifra);}
      setModal(false);
    }catch(e){showToast(e.message,'err');}
    setSaving(false);
  };

  const doDelete=async(f)=>{
    if(!window.confirm('Obrisati '+f.sifra+'?'))return;
    try{await api('/felne/'+f.id,{method:'DELETE'});setFelne(p=>p.filter(x=>x.id!==f.id));showToast('Obrisano');}
    catch(e){showToast(e.message,'err');}
  };

  const doProdaj=async()=>{
    const c=parseFloat(prodajnaCijena);
    if(isNaN(c)||c<0){showToast('Unesi cijenu','err');return;}
    try{
      const f=await api('/felne/'+prodajaModal.id+'/prodaj',{method:'POST',body:{cijena_prodaje:c}});
      setFelne(p=>filter.stanje==='na_stanju'?p.filter(x=>x.id!==f.id):p.map(x=>x.id===f.id?{...f,slike:x.slike}:x));
      setProdajaModal(null);setProdajnaCijena('');
      showToast('Prodano za '+c+' KM');
    }catch(e){showToast(e.message,'err');}
  };

  const doVrati=async(f)=>{
    if(!window.confirm('Vratiti '+f.sifra+' na stanje?'))return;
    try{
      const u=await api('/felne/'+f.id+'/vrati',{method:'POST'});
      setFelne(p=>filter.stanje==='prodato'?p.filter(x=>x.id!==u.id):p.map(x=>x.id===u.id?{...u,slike:x.slike}:x));
      showToast('Vraćeno na stanje');
    }catch(e){showToast(e.message,'err');}
  };

  const addSlika=async(e)=>{
    const file=e.target.files&&e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=async()=>{
      try{
        const {url}=await api('/upload-slika',{method:'POST',body:{dataURL:reader.result}});
        setForm(f=>({...f,slike:[...f.slike,url]}));
      }catch(err){showToast(err.message,'err');}
    };
    reader.readAsDataURL(file);
    e.target.value='';
  };

  const paged=useMemo(()=>felne.slice((page-1)*PER_PAGE,page*PER_PAGE),[felne,page]);

  return(<div className="page">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
      <div><div className="page-title">Felne</div><div className="page-sub">Setovi felni — aluminijumske i čelične</div></div>
      <button className="btn-add-main" onClick={openAdd}><Icons.Plus size={13}/> Novi set</button>
    </div>

    {/* FILTERI */}
    <div className="card-panel" style={{marginBottom:12}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
        <div className="fg2" style={{margin:0}}><label>Vrsta</label>
          <select value={filter.vrsta} onChange={e=>setFilter(f=>({...f,vrsta:e.target.value}))}>
            <option value="">Sve</option>{VRSTE.map(v=><option key={v} value={v}>{v}</option>)}
          </select></div>
        <div className="fg2" style={{margin:0}}><label>Broj i raspon rupa</label>
          <select value={filter.rupe} onChange={e=>setFilter(f=>({...f,rupe:e.target.value}))}>
            <option value="">Sve</option>{RUPE.map(r=><option key={r} value={r}>{r}</option>)}
          </select></div>
        <div className="fg2" style={{margin:0}}><label>Prečnik</label>
          <select value={filter.precnik} onChange={e=>setFilter(f=>({...f,precnik:e.target.value}))}>
            <option value="">Svi</option>{PRECNICI.map(p=><option key={p} value={p}>{p}"</option>)}
          </select></div>
        <div className="fg2" style={{margin:0}}><label>Širina</label>
          <select value={filter.sirina} onChange={e=>setFilter(f=>({...f,sirina:e.target.value}))}>
            <option value="">Sve</option>{SIRINE.map(s=><option key={s} value={s}>{s} J</option>)}
          </select></div>
        <div className="fg2" style={{margin:0}}><label>Interna šifra</label>
          <input placeholder="F10..." value={filter.sifra} onChange={e=>setFilter(f=>({...f,sifra:e.target.value}))}/></div>
        <div className="fg2" style={{margin:0}}><label>Centralna rupa (mm)</label>
          <input type="number" step="0.01" placeholder="npr. 65.1" value={filter.centralna_rupa} onChange={e=>setFilter(f=>({...f,centralna_rupa:e.target.value}))}/></div>
        <div className="fg2" style={{margin:0}}><label>Proizvođač</label>
          <input placeholder="npr. Peugeot, Audi..." value={filter.marka} onChange={e=>setFilter(f=>({...f,marka:e.target.value}))}/></div>
        <div className="fg2" style={{margin:0}}><label>Stanje</label>
          <select value={filter.stanje} onChange={e=>setFilter(f=>({...f,stanje:e.target.value}))}>
            <option value="na_stanju">Na stanju</option>
            <option value="prodato">Prodato</option>
            <option value="">Sve</option>
          </select></div>
      </div>
    </div>

    {/* LISTA */}
    <div className="card-panel">
      <div className="section-title">Ukupno {felne.length}</div>
      {loading?<div style={{color:'var(--muted)',padding:20,textAlign:'center'}}>Učitavanje...</div>:
      felne.length===0?<div className="empty"><p style={{fontSize:13,color:'var(--muted)'}}>Nema felni za odabrane filtere.</p></div>:
      <>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {paged.map(f=>(
          <div key={f.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
            {f.slike&&f.slike.length>0?
              <img src={f.slike[0]} alt="" style={{width:52,height:52,objectFit:'cover',borderRadius:6,flexShrink:0,cursor:'pointer'}} onClick={()=>setLightbox&&setLightbox({images:f.slike,index:0})}/>:
              <div style={{width:52,height:52,borderRadius:6,background:'var(--border)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:20}}>🛞</div>}
            <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>setDetail(f)}>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14}}>
                {f.vrsta==='Aluminijumske'?'Alu':f.vrsta==='Čelične'?'Čelične':'Rez. točak'} {f.precnik}" {f.rupe}
                {!!f.ostecenje&&<span style={{marginLeft:6,fontSize:9,background:'rgba(248,81,73,.15)',color:'var(--red)',padding:'2px 6px',borderRadius:4,fontWeight:700,verticalAlign:'middle'}}>OŠTEĆENO</span>}
              </div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>
                {f.sifra} · {f.marka}{f.model?' '+f.model:''} · {f.sirina}J{f.et?' ET'+f.et:''}{f.centralna_rupa?' · CB '+f.centralna_rupa+'mm':''} · {f.kolicina} kom
                {felneSaNalogom.has(f.id)&&<span style={{marginLeft:6,fontSize:9,background:'rgba(88,166,255,.15)',color:'var(--blue)',padding:'2px 6px',borderRadius:4,fontWeight:700}}>NA NALOGU</span>}
              </div>
              {f.prodato===1&&<div style={{fontSize:10,color:'var(--green)',marginTop:1}}>Prodato {f.datum_prodaje} · {f.prodao_korisnik}</div>}
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              {f.prodato===1?
                <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,color:'var(--green)',fontSize:15}}>{f.cijena_prodaje} KM</div>:
                f.cijena!=null&&isAdmin&&<div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:14}}>{f.cijena} KM</div>}
            </div>
            <div style={{display:'flex',gap:4,flexShrink:0}}>
              {f.prodato===0&&<button className="btn-sm" style={{padding:'4px 8px',color:'var(--green)'}} onClick={()=>{setProdajaModal(f);setProdajnaCijena(f.cijena!=null?String(f.cijena):'');}}>Prodaj</button>}
              {f.prodato===1&&isAdmin&&<button className="btn-sm" style={{padding:'4px 8px'}} onClick={()=>doVrati(f)}>Vrati</button>}
              <button className="btn-sm" style={{padding:'4px 8px'}} onClick={()=>openEdit(f)}><Icons.Edit/></button>
              {isAdmin&&f.prodato===1&&<button className="btn-sm red" style={{padding:'4px 8px'}} onClick={()=>doDelete(f)}><Icons.Trash/></button>}
            </div>
          </div>
        ))}
      </div>
      <SimplePagination page={page} total={felne.length} perPage={PER_PAGE} onChange={setPage}/>
      </>}
    </div>

    {/* MODAL — novi/uredi set */}
    {modal&&<div className="overlay" onClick={()=>setModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{editId?'Uredi set':'Novi set'} <button className="btn-close" onClick={()=>setModal(false)}>×</button></div>
      <div className="two-col">
        <div className="fg2"><label>Vrsta *</label>
          <select value={form.vrsta} onChange={e=>setForm(f=>({...f,vrsta:e.target.value}))}>
            <option value="">— Izaberi —</option>{VRSTE.map(v=><option key={v} value={v}>{v}</option>)}
          </select></div>
        <div className="fg2"><label>Broj i raspon rupa *</label>
          <select value={form.rupe} onChange={e=>setForm(f=>({...f,rupe:e.target.value}))}>
            <option value="">— Izaberi —</option>{RUPE.map(r=><option key={r} value={r}>{r}</option>)}
          </select></div>
      </div>
      <div className="two-col">
        <div className="fg2"><label>Prečnik *</label>
          <select value={form.precnik} onChange={e=>setForm(f=>({...f,precnik:e.target.value}))}>
            <option value="">— Izaberi —</option>{PRECNICI.map(p=><option key={p} value={p}>{p}"</option>)}
          </select></div>
        <div className="fg2"><label>Širina *</label>
          <select value={form.sirina} onChange={e=>setForm(f=>({...f,sirina:e.target.value}))}>
            <option value="">— Izaberi —</option>{SIRINE.map(s=><option key={s} value={s}>{s} J</option>)}
          </select></div>
      </div>
      <div className="two-col">
        <div className="fg2"><label>ET</label><input type="number" placeholder="npr. 46" value={form.et} onChange={e=>setForm(f=>({...f,et:e.target.value}))}/></div>
        <div className="fg2"><label>Centralna rupa (mm)</label><input type="number" step="0.01" placeholder="npr. 65.10" value={form.centralna_rupa} onChange={e=>setForm(f=>({...f,centralna_rupa:e.target.value}))}/></div>
      </div>
      <div className="two-col">
        <div className="fg2"><label>Marka vozila *</label><input placeholder="npr. Peugeot" value={form.marka} onChange={e=>setForm(f=>({...f,marka:e.target.value}))}/></div>
        <div className="fg2"><label>Model</label><input placeholder="npr. 508 (10-14)" value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))}/></div>
      </div>
      <div className="two-col">
        <div className="fg2"><label>Količina (kom)</label><input type="number" min="1" max="10" value={form.kolicina} onChange={e=>setForm(f=>({...f,kolicina:e.target.value}))}/></div>
        {isAdmin&&<div className="fg2"><label>Cijena (KM)</label><div className="price-row"><input className="price-inp" type="number" min="0" placeholder="0" value={form.cijena} onChange={e=>setForm(f=>({...f,cijena:e.target.value}))}/><span className="price-curr">KM</span></div></div>}
      </div>
      <div className="fg2">
        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
          <input type="checkbox" checked={form.ostecenje} onChange={e=>setForm(f=>({...f,ostecenje:e.target.checked}))} style={{width:'auto'}}/>
          Oštećeno
        </label>
      </div>
      <div className="fg2"><label>Napomena</label><input placeholder="opciono..." value={form.napomena} onChange={e=>setForm(f=>({...f,napomena:e.target.value}))}/></div>
      <div className="fg2">
        <label>Slike ({form.slike.length})</label>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {form.slike.map((s,i)=>(
            <div key={i} style={{position:'relative'}}>
              <img src={s} alt="" style={{width:56,height:56,objectFit:'cover',borderRadius:6}}/>
              <button onClick={()=>setForm(f=>({...f,slike:f.slike.filter((_,j)=>j!==i)}))} style={{position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',fontSize:10,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
          ))}
          <label style={{width:56,height:56,borderRadius:6,border:'2px dashed var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:20,color:'var(--muted)'}} title="Slikaj kamerom">
            📷<input type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={addSlika}/>
          </label>
          <label style={{width:56,height:56,borderRadius:6,border:'2px dashed var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:20,color:'var(--muted)'}} title="Iz galerije">
            +<input type="file" accept="image/*" style={{display:'none'}} onChange={addSlika}/>
          </label>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn-cancel" onClick={()=>setModal(false)}>Odustani</button>
        <button className="btn-save" disabled={saving} onClick={doSave}>{editId?'Sačuvaj':'Dodaj set'}</button>
      </div>
    </div></div>}

    {/* MODAL — detalji */}
    {detail&&<div className="overlay" onClick={()=>setDetail(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{detail.sifra} — {detail.vrsta} {detail.precnik}" <button className="btn-close" onClick={()=>setDetail(null)}>×</button></div>
      {detail.slike&&detail.slike.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
        {detail.slike.map((s,i)=><img key={i} src={s} alt="" style={{width:72,height:72,objectFit:'cover',borderRadius:6,cursor:'pointer'}} onClick={()=>setLightbox&&setLightbox({images:detail.slike,index:i})}/>)}
      </div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 14px',fontSize:13}}>
        <div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>VRSTA</span>{detail.vrsta}</div>
        <div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>BROJ I RASPON RUPA</span>{detail.rupe}</div>
        <div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>PREČNIK</span>{detail.precnik}"</div>
        <div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>ŠIRINA</span>{detail.sirina} J</div>
        <div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>ET</span>{detail.et||'—'}</div>
        <div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>CENTRALNA RUPA</span>{detail.centralna_rupa?detail.centralna_rupa+' mm':'—'}</div>
        <div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>MARKA</span>{detail.marka}</div>
        <div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>MODEL</span>{detail.model||'—'}</div>
        <div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>KOLIČINA</span>{detail.kolicina} kom</div>
        <div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>STANJE</span>{detail.ostecenje?<span style={{color:'var(--red)'}}>Oštećeno</span>:'Ispravno'}</div>
        {isAdmin&&detail.cijena!=null&&detail.prodato===0&&<div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>CIJENA</span>{detail.cijena} KM</div>}
        {detail.prodato===1&&<div><span style={{color:'var(--muted)',fontSize:10,display:'block'}}>PRODATO</span><span style={{color:'var(--green)'}}>{detail.cijena_prodaje} KM · {detail.datum_prodaje}</span></div>}
      </div>
      {detail.napomena&&<div style={{marginTop:10,fontSize:12,color:'var(--muted)',fontStyle:'italic'}}>{detail.napomena}</div>}
      <div style={{marginTop:8,fontSize:10,color:'var(--muted)'}}>Dodao {detail.dodao_korisnik} · {new Date(detail.created_at).toLocaleDateString('sr-Latn-RS')}</div>
      <div className="modal-foot">
        <button className="btn-cancel" onClick={()=>setDetail(null)}>Zatvori</button>
        {isAdmin&&detail.prodato===0&&!felneSaNalogom.has(detail.id)&&<button className="btn-save" style={{background:'var(--blue)'}} onClick={()=>{setNalogForm({napomena:'',hitno:false,za_slanje:false});setNalogModal(detail);setDetail(null);}}>📋 Pošalji nalog</button>}
        {isAdmin&&felneSaNalogom.has(detail.id)&&<button className="btn-sm" style={{color:'var(--red)',borderColor:'rgba(248,81,73,.3)',fontWeight:700}} onClick={async()=>{
          if(!window.confirm('Zatvoriti nalog za ove felne?'))return;
          try{
            const info=felneSaNalogom.get(detail.id);
            const tok=localStorage.getItem('adg_token');
            await fetch('/api/nalozi/'+info.nalogId+'/zavrsi',{method:'POST',headers:{'Authorization':'Bearer '+tok}});
            setFelneSaNalogom(m=>{const nm=new Map(m);nm.delete(detail.id);return nm;});
            window.dispatchEvent(new Event('nalozi-changed'));
            showToast('Nalog zatvoren');setDetail(null);
          }catch(err){showToast('Greška','err');}
        }}>✕ Zatvori nalog</button>}
        <button className="btn-save" onClick={()=>{setDetail(null);openEdit(detail);}}>Uredi</button>
      </div>
    </div></div>}

    {/* MODAL — prodaja */}
    {prodajaModal&&<div className="overlay" onClick={()=>setProdajaModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Prodaj {prodajaModal.sifra} <button className="btn-close" onClick={()=>setProdajaModal(null)}>×</button></div>
      <div style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>{prodajaModal.vrsta} {prodajaModal.precnik}" {prodajaModal.rupe} — {prodajaModal.marka} {prodajaModal.model||''}</div>
      <div className="fg2"><label>Prodajna cijena (KM) *</label>
        <div className="price-row"><input autoFocus className="price-inp" type="number" min="0" placeholder="0" value={prodajnaCijena} onChange={e=>setProdajnaCijena(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doProdaj()}/><span className="price-curr">KM</span></div>
      </div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>setProdajaModal(null)}>Odustani</button><button className="btn-save" onClick={doProdaj}>Prodaj</button></div>
    </div></div>}

    {/* MODAL — nalog */}
    {nalogModal&&<div className="overlay" onClick={()=>setNalogModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Nalog za {nalogModal.sifra} <button className="btn-close" onClick={()=>setNalogModal(null)}>×</button></div>
      <div style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>{nalogModal.vrsta} {nalogModal.precnik}" {nalogModal.rupe} — {nalogModal.marka} {nalogModal.model||''} · {nalogModal.kolicina} kom</div>
      <div className="fg2"><label>Napomena</label><input placeholder="opciono..." value={nalogForm.napomena} onChange={e=>setNalogForm(f=>({...f,napomena:e.target.value}))}/></div>
      <div style={{display:'flex',gap:16,marginBottom:4}}>
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
              guma_id:-nalogModal.id,
              guma_sifra:nalogModal.sifra,
              guma_opis:'FELNE — '+nalogModal.vrsta+' '+nalogModal.precnik+'" '+nalogModal.rupe+' · '+nalogModal.marka+(nalogModal.model?' '+nalogModal.model:'')+' · '+nalogModal.kolicina+' kom',
              guma_lokacija:'Felne',
              guma_slika:(nalogModal.slike&&nalogModal.slike[0])||'',
              napomena:nalogForm.napomena,
              hitno:nalogForm.hitno,
              za_slanje:nalogForm.za_slanje
            })});
            showToast('Nalog poslan!');
            loadNalozi();
            window.dispatchEvent(new Event('nalozi-changed'));
            setNalogModal(null);
          }catch(e){showToast('Greška: '+e.message,'err');}
          setNalogSaving(false);
        }}>Pošalji nalog</button>
      </div>
    </div></div>}

    <div className="site-footer">© 2026 DelicNode</div>
  </div>);
}

export default FelneModul;
