import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils.js';
import { Icons, SimplePagination } from '../components/index.jsx';

const VRSTE=['Aluminijumske','Čelične'];
const RUPE=['3x98','3x112','4x98','4x100','4x108','4x114.3','5x100','5x105','5x108','5x110','5x112','5x114.3','5x115','5x118','5x120','5x127','5x130','6x114.3','6x130','6x139.7'];
const PRECNICI=['13','14','15','16','17','18','19','20','21','22'];
const SIRINE=['4.5','5','5.5','6','6.5','7','7.5','8','8.5','9','9.5','10','10.5','11','12'];

function FelneModul({user,showToast,quickAdd,onQuickAddDone,setLightbox}){
  const isAdmin=user.role==='admin';
  const [felne,setFelne]=useState([]);
  const [loading,setLoading]=useState(false);
  const [filter,setFilter]=useState({vrsta:'',rupe:'',precnik:'',sirina:'',sifra:'',stanje:'na_stanju'});
  const [page,setPage]=useState(1);const PER_PAGE=15;
  const [modal,setModal]=useState(false);
  const [editId,setEditId]=useState(null);
  const emptyForm={vrsta:'',rupe:'',precnik:'',sirina:'',et:'',centralna_rupa:'',marka:'',model:'',kolicina:'4',ostecenje:false,napomena:'',cijena:'',slike:[]};
  const [form,setForm]=useState(emptyForm);
  const [saving,setSaving]=useState(false);
  const [prodajaModal,setProdajaModal]=useState(null);
  const [prodajnaCijena,setProdajnaCijena]=useState('');

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
          <input placeholder="FE..." value={filter.sifra} onChange={e=>setFilter(f=>({...f,sifra:e.target.value}))}/></div>
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
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14}}>
                {f.vrsta==='Aluminijumske'?'Alu':'Čelične'} {f.precnik}" {f.rupe}
                {!!f.ostecenje&&<span style={{marginLeft:6,fontSize:9,background:'rgba(248,81,73,.15)',color:'var(--red)',padding:'2px 6px',borderRadius:4,fontWeight:700,verticalAlign:'middle'}}>OŠTEĆENO</span>}
              </div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>
                {f.sifra} · {f.marka}{f.model?' '+f.model:''} · {f.sirina}J{f.et?' ET'+f.et:''}{f.centralna_rupa?' · CB '+f.centralna_rupa+'mm':''} · {f.kolicina} kom
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
              {isAdmin&&<button className="btn-sm red" style={{padding:'4px 8px'}} onClick={()=>doDelete(f)}><Icons.Trash/></button>}
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
          <label style={{width:56,height:56,borderRadius:6,border:'2px dashed var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:20,color:'var(--muted)'}}>
            +<input type="file" accept="image/*" style={{display:'none'}} onChange={addSlika}/>
          </label>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn-cancel" onClick={()=>setModal(false)}>Odustani</button>
        <button className="btn-save" disabled={saving} onClick={doSave}>{editId?'Sačuvaj':'Dodaj set'}</button>
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

    <div className="site-footer">© 2026 DelicNode</div>
  </div>);
}

export default FelneModul;
