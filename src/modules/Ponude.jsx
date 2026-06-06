import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, promjerDisp, tipLbl, statusLbl, timeAgo, resizeImage } from '../utils.js';
import { Icons, ErrorBoundary, ComboBox, useImageUpload, Lightbox, ImgUploadUI, Pagination } from '../components/index.jsx';

function PonudaModul({showToast}){
  const [ponude,setPonude]=useState([]);const [modal,setModal]=useState(false);
  const [editPonuda,setEditPonuda]=useState(null);
  const [ponudePage,setPonudePage]=useState(1);
  const [racunModal,setRacunModal]=useState(null);
  const [brFiskInput,setBrFiskInput]=useState('');
  const [viewPonuda,setViewPonuda]=useState(null);
  const [form,setForm]=useState({kupac_ime:'',kupac_adresa:'',kupac_telefon:'',napomena:'',pdv:true,rok_placanja:'Avansno plaćanje',mjesto:'Bijeljina',vozilo:'',unosSaPdv:false});
  const [stavke,setStavke]=useState([{opis:'',kolicina:1,cijena:'',jm:'KOM'}]);

  const FIRMA={naziv:'Auto Delić',adresa:'',tel:'+387 66 027 888',pdv_broj:'',jib:''};

  const load=async()=>{try{const d=await api('/ponude');setPonude(d);}catch(e){showToast(e.message,'err');}};
  useEffect(()=>{load();},[]);

  const ukupnoBezPdv=(st)=>st.reduce((s,x)=>s+(parseFloat(x.cijena)||0)*(parseInt(x.kolicina)||1),0);
  const pdvIznos=(st)=>Math.round(ukupnoBezPdv(st)*0.17*100)/100;
  const ukupnoSaPdv=(st,hasPdv)=>hasPdv?Math.round((ukupnoBezPdv(st)+pdvIznos(st))*100)/100:ukupnoBezPdv(st);

  const addStavka=()=>setStavke(p=>[...p,{opis:'',kolicina:1,cijena:'',jm:'KOM'}]);
  const updateStavka=(i,f,v)=>setStavke(p=>p.map((s,j)=>j===i?{...s,[f]:v}:s));
  const removeStavka=(i)=>setStavke(p=>p.filter((_,j)=>j!==i));

  const doSave=async()=>{
    if(!form.kupac_ime.trim()){showToast('Ime kupca je obavezno','err');return;}
    const valid=stavke.filter(s=>s.opis.trim());
    if(!valid.length){showToast('Dodaj barem jednu stavku','err');return;}
    try{
      let p;
      if(editPonuda){
        p=await api('/ponude/'+editPonuda.id,{method:'PUT',body:{...form,stavke:valid}});
        setPonude(prev=>prev.map(x=>x.id===p.id?p:x));showToast('Ponuda ažurirana');
      } else {
        p=await api('/ponude',{method:'POST',body:{...form,stavke:valid}});
        setPonude(prev=>[p,...prev]);doPrint(p,'predracun');showToast('Ponuda '+p.broj+' kreirana');
      }
      setModal(false);setEditPonuda(null);
      setForm({kupac_ime:'',kupac_adresa:'',kupac_telefon:'',napomena:'',pdv:true,rok_placanja:'Avansno plaćanje',mjesto:'Bijeljina'});
      setStavke([{opis:'',kolicina:1,cijena:'',jm:'KOM'}]);
    }catch(e){showToast(e.message,'err');}
  };
  const doDel=async(id)=>{if(!window.confirm('Obrisati ponudu?'))return;await api('/ponude/'+id,{method:'DELETE'});setPonude(p=>p.filter(x=>x.id!=id));};

  const genWAText=(p)=>{
    const st=p.stavke||[];const hasPdv=p.pdv!==false;
    let txt=`PONUDA - ${FIRMA.naziv}\nBroj: ${p.broj}\nDatum: ${new Date(p.created_at).toLocaleDateString('sr-Latn-RS')}\n`;
    txt+=`\nKupac: ${p.kupac_ime}\n\nSTAVKE:\n`;
    st.forEach((s,i)=>{const u=(parseFloat(s.cijena)||0)*(parseInt(s.kolicina)||1);txt+=`${i+1}. ${s.opis} — ${s.kolicina}x${s.cijena} KM = ${u.toFixed(2)} KM\n`;});
    txt+=hasPdv?`\nBez PDV-a: ${ukupnoBezPdv(st).toFixed(2)} KM\nPDV (17%): ${pdvIznos(st).toFixed(2)} KM\nUKUPNO: ${ukupnoSaPdv(st,true).toFixed(2)} KM`:`\nUKUPNO: ${ukupnoBezPdv(st).toFixed(2)} KM`;
    txt+=`\n\nTel: ${FIRMA.tel}`;
    return txt;
  };

  const doPrint=(p,tip,brFisk)=>{
    const tip2=tip||'predracun';
    const brFisk2=brFisk||'';
    const st=p.stavke||[];
    const hasPdv=p.pdv!==0&&p.pdv!==false&&!p.unosSaPdv;
    const unosSaPdv=!!p.unosSaPdv;
    const datum=new Date(p.created_at).toLocaleDateString('sr-Latn-BA');
    const bez=st.reduce((s,x)=>s+(parseFloat(x.cijena)||0)*(parseInt(x.kolicina)||1),0);
    const pdvIz=Math.round(bez*0.17*100)/100;
    const ukup=hasPdv?Math.round((bez+pdvIz)*100)/100:bez;
    const LOGO='data:image/webp;base64,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';
    const stavkeHTML=st.map((s,i)=>{
      const v=(parseFloat(s.cijena)||0)*(parseInt(s.kolicina)||1);
      return '<tr><td class=br>'+(i+1)+'.</td><td class=op>'+s.opis+'</td><td class=jm>'+(s.jm||'KOM')+'</td><td class=n>'+s.kolicina+'</td><td class=n>'+parseFloat(s.cijena||0).toFixed(2)+'</td><td class=n>'+v.toFixed(2)+'</td></tr>';
    }).join('');
    const totHTML=unosSaPdv
      ?'<tr><td colspan=2>Cijena (bez PDV):</td><td>'+(ukup/1.17).toFixed(2)+' KM</td></tr><tr class=pr><td colspan=2>PDV 17% (sadržan):</td><td>'+(ukup-ukup/1.17).toFixed(2)+' KM</td></tr><tr class=mr><td colspan=2>UKUPNO:</td><td>'+ukup.toFixed(2)+' KM</td></tr>'
      :hasPdv
      ?'<tr><td colspan=2>Ukupno bez PDV-a:</td><td>'+bez.toFixed(2)+' KM</td></tr><tr class=pr><td colspan=2>PDV (17%):</td><td>'+pdvIz.toFixed(2)+' KM</td></tr><tr class=mr><td colspan=2>UKUPNO sa PDV-om:</td><td>'+ukup.toFixed(2)+' KM</td></tr>'
      :'<tr class=mr><td colspan=2>UKUPNO:</td><td>'+ukup.toFixed(2)+' KM</td></tr>';
    const fiscRow=(tip2==='racun'&&brFisk2)?'<tr><td>Br. fisc. računa:</td><td colspan=2><b>'+brFisk2+'</b></td></tr>':'';
    const doc='<!DOCTYPE html><html lang=hr><head><meta charset=UTF-8><title>'+(tip2==='racun'?'Račun':'Pred račun')+' '+p.broj+'</title>'
    +'<style>'
    +'*{box-sizing:border-box;margin:0;padding:0}'
    +'body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#111}'
    +'.page{width:210mm;min-height:297mm;margin:0 auto;padding:10mm 14mm 0;display:flex;flex-direction:column}'
    +'.body{flex:1}'
    +'.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #5a9e2f;padding-bottom:5mm;margin-bottom:4mm}'
    +'.hdr img{height:60px;object-fit:contain}'
    +'.firma{text-align:right;font-size:9pt;color:#333;line-height:1.7}'
    +'.firma b{font-size:11pt;color:#111;display:block}'
    +'.web{color:#5a9e2f;font-weight:bold}'
    +'.jib{display:flex;justify-content:space-between;margin-bottom:4mm;padding-bottom:2mm;border-bottom:1px solid #ccc;font-size:8.5pt;color:#444}'
    +'.tit{font-size:15pt;font-weight:bold;text-align:center;margin-bottom:5mm;letter-spacing:0.5px}'
    +'.row{display:flex;gap:8mm;margin-bottom:5mm}'
    +'.kom{flex:1;border:1px solid #bbb;border-radius:3px;padding:6px 10px;min-height:26mm}'
    +'.kl{font-size:7.5pt;text-transform:uppercase;color:#777;margin-bottom:3px;font-weight:bold;letter-spacing:0.5px}'
    +'.kn{font-size:12pt;font-weight:bold;margin-bottom:2px}'
    +'.ki{font-size:8.5pt;color:#444;line-height:1.6}'
    +'.ib{flex:0 0 68mm;border:1px solid #bbb;border-radius:3px;padding:6px 10px}'
    +'.ib table{width:100%;border-collapse:collapse;font-size:9pt}'
    +'.ib td{padding:2.5px 4px;vertical-align:top}'
    +'.ib td:first-child{color:#555;font-weight:bold;white-space:nowrap;width:46%;padding-right:6px}'
    +'table.st{width:100%;border-collapse:collapse;margin-bottom:5mm;font-size:9.5pt}'
    +'table.st th{background:#f0f0f0;border-top:2px solid #333;border-bottom:2px solid #333;padding:5px 6px;text-align:left;font-size:8.5pt;white-space:nowrap}'
    +'th.n,td.n{text-align:right}'
    +'td.br{width:28px;color:#666}'
    +'td.op{}'
    +'td.jm{width:38px;text-align:center;color:#555}'
    +'table.st td{padding:4px 6px;border-bottom:1px solid #e8e8e8;vertical-align:top}'
    +'tr:nth-child(even) td{background:#fafafa}'
    +'td.n{text-align:right;font-weight:600;width:70px}'
    +'.tw{display:flex;justify-content:flex-end;margin-bottom:5mm}'
    +'.tt{border-collapse:collapse;font-size:10pt}'
    +'.tt td{padding:3px 8px;min-width:60px}'
    +'.tt td:first-child{text-align:right;color:#555}'
    +'.tt td:last-child{text-align:right;font-weight:bold;min-width:80px}'
    +'.mr td{padding:5px 8px;font-size:11.5pt;font-weight:bold;border-top:2.5px solid #333}'
    +'.pr td{border-top:1px solid #ddd}'
    +'.nap{border:1px dashed #ccc;border-radius:3px;padding:5px 10px;font-size:9pt;color:#555;margin-bottom:5mm}'
    +'.bottom{margin-top:auto;padding:10mm 0 10mm}'
    +'.pot{display:flex;justify-content:space-between;margin-bottom:8mm}'
    +'.pb{text-align:center;width:70mm}'
    +'.pl{border-top:1px solid #999;margin-top:12mm;padding-top:4px;font-size:8pt;color:#555}'
    +'.ft{font-size:7.5pt;color:#888;text-align:center;border-top:1px solid #ddd;padding-top:4mm}'
    +'@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:0}.page{padding:8mm 12mm 0}}'
    +'</style></head><body><div class=page><div class=body>'
    +'<div class=hdr><img src="'+LOGO+'" alt="Auto Delić"/>'
    +'<div class=firma><b>Auto Delić</b>Tel: 066 027 888<br><span class=web>www.delicauto.com</span><br>Pavlovića put 13, 76300 Bijeljina<br>autootpaddelic@gmail.com</div></div>'
    +'<div class=jib>'
    +'<span>JIB: 5540010000584312</span>'
    +'<span>Naša banka &Zcaron;R: 5540010000584312</span>'
    +'</div>'
    +'<div class=tit>'+(tip2==='racun'?'RAČUN':'PREDRAČUN / PONUDA')+' BR. '+p.broj+'</div>'
    +(p.vozilo?'<div style="text-align:center;font-family:Arial,sans-serif;font-size:10pt;color:#5a9e2f;font-weight:bold;margin-bottom:4mm">Vozilo: '+p.vozilo+'</div>':'')
    +'<div class=row>'
    +'<div class=kom><div class=kl>Komitent (kupac):</div><div class=kn>'+p.kupac_ime+'</div>'
    +'<div class=ki>'+(p.kupac_adresa?p.kupac_adresa+'<br>':'')+(p.kupac_telefon?'Tel: '+p.kupac_telefon:'')+'</div></div>'
    +'<div class=ib><table>'
    +'<tr><td>Datum:</td><td>'+datum+'</td></tr>'
    +'<tr><td>Rok plaćanja:</td><td>'+(p.rok_placanja||'Avansno plaćanje')+'</td></tr>'
    +'<tr><td>Mjesto:</td><td>'+(p.mjesto||'Bijeljina')+'</td></tr>'
    +fiscRow
    +'</table></div></div>'
    +'<table class=st><thead><tr>'
    +'<th>Br.</th><th>Opis</th><th style=text-align:center>JM</th>'
    +'<th class=n>Količina</th><th class=n>Cijena (KM)</th><th class=n>Vrijednost (KM)</th>'
    +'</tr></thead><tbody>'+stavkeHTML+'</tbody></table>'
    +'<div class=tw><table class=tt>'+totHTML+'</table></div>'
    +(p.napomena?'<div class=nap><b>Napomena:</b> '+p.napomena+'</div>':'')
    +'</div>'
    +'<div class=bottom>'
    +'<div class=pot>'
    +'<div class=pb><div class=pl>Potpis kupca</div></div>'
    +'<div class=pb><div class=pl>Potpis izdavaoca</div></div>'
    +'</div>'
    +'<div class=ft>Auto Delić &mdash; Pavlovića put 13, 76300 Bijeljina &mdash; Tel: 066 027 888 &mdash; www.delicauto.com</div>'
    +'</div>'
    +'</div>'
    +'<script>window.onload=function(){window.print();}<\/script>'
    +'</body></html>';
    const w=window.open('','_blank','width=860,height=1100');
    if(w){w.document.write(doc);w.document.close();}
  };


  return(<div className="page">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
      <div><div className="page-title">Ponude / Predračuni</div><div className="page-sub">Kreiraj, štampaj, pošalji</div></div>
      <button className="btn-add-main" onClick={()=>setModal(true)}><Icons.Plus size={13}/> Nova ponuda</button>
    </div>

    {ponude.length===0?<div className="empty"><Icons.Money size={36}/><p>Nema kreiranih ponuda.</p></div>:
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {ponude.slice((ponudePage-1)*30,ponudePage*30).map(p=>{
        const st=p.stavke||[];
        const hasPdv=p.pdv!==0&&p.pdv!==false&&!p.unosSaPdv;
        const unosSaPdv=!!p.unosSaPdv;
        const ukupSt=st.reduce((s,x)=>s+(parseFloat(x.cijena)||0)*(parseInt(x.kolicina)||1),0);
        const ukupPrikaz=unosSaPdv?ukupSt:(hasPdv?ukupSt*1.17:ukupSt);
        const pdvLabel=unosSaPdv?'sa PDV (sadržan)':hasPdv?'sa PDV-om':null;
        return(<div key={p.id} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:8}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:16,color:'var(--accent)',cursor:'pointer',textDecoration:'underline'}} onClick={e=>{e.stopPropagation();setViewPonuda(p);}}>{p.broj}</span>
                <span style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14}}>{p.kupac_ime}</span>
              {p.vozilo&&<span style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:11,color:'var(--accent)',background:'rgba(240,180,41,.12)',borderRadius:4,padding:'1px 6px'}}>🚗 {p.vozilo}</span>}
              </div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{st.length} stavki · {new Date(p.created_at).toLocaleDateString('sr-Latn-RS')}</div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:18,color:'var(--green)'}}>{ukupPrikaz.toFixed(2)} KM</div>
              {pdvLabel&&<div style={{fontSize:10,color:'var(--muted)'}}>{pdvLabel}</div>}
            </div>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <div style={{position:'relative',display:'inline-block'}}>
              <button className="btn-sm" onClick={e=>{e.stopPropagation();const m=e.currentTarget.nextElementSibling;m.style.display=m.style.display==='block'?'none':'block';}}>🖨 Štampaj ▾</button>
              <div style={{display:'none',position:'absolute',top:'110%',left:0,zIndex:100,background:'var(--surf)',border:'1px solid var(--border)',borderRadius:6,boxShadow:'0 4px 16px rgba(0,0,0,.5)',minWidth:170,overflow:'hidden'}}>
                <div style={{padding:'10px 14px',cursor:'pointer',fontSize:12,fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,letterSpacing:'1px'}} onClick={e=>{doPrint(p,'predracun');e.currentTarget.parentNode.style.display='none';}}>📋 Predračun</div>
                <div style={{padding:'10px 14px',cursor:'pointer',fontSize:12,fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,letterSpacing:'1px',borderTop:'1px solid var(--border)'}} onClick={e=>{e.currentTarget.parentNode.style.display='none';setRacunModal(p);}}>🧾 Račun</div>
              </div>
            </div>
            <button className="btn-sm" onClick={()=>{setEditPonuda(p);setForm({kupac_ime:p.kupac_ime,kupac_adresa:p.kupac_adresa||'',kupac_telefon:p.kupac_telefon||'',vozilo:p.vozilo||'',napomena:p.napomena||'',pdv:p.pdv!==0&&!p.unosSaPdv,unosSaPdv:!!p.unosSaPdv,rok_placanja:p.rok_placanja||'Avansno plaćanje',mjesto:p.mjesto||'Bijeljina'});setStavke(p.stavke&&p.stavke.length?p.stavke:[{opis:'',kolicina:1,cijena:'',jm:'KOM'}]);setModal(true);}}><Icons.Edit size={10}/></button>
            <button className="btn-sm red" onClick={()=>doDel(p.id)}><Icons.Trash size={10}/></button>
          </div>
        </div>);
      })}
    </div>}
    <Pagination page={ponudePage} total={ponude.length} perPage={30} onChange={p=>setPonudePage(p)}/>

    {modal&&<div className="overlay" onClick={()=>setModal(false)}><div className="modal" style={{maxWidth:540}} onClick={e=>e.stopPropagation()}>
      <div className="modal-title">{editPonuda?"Uredi ponudu":"Nova ponuda"} <button className="btn-close" onClick={()=>{setModal(false);setEditPonuda(null);}}>x</button></div>
      <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:10,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--accent)',marginBottom:8}}>Podaci o kupcu</div>
      <div className="two-col">
        <div className="fg2"><label>Ime kupca *</label>
          <input autoFocus value={form.kupac_ime} onChange={e=>setForm(f=>({...f,kupac_ime:e.target.value}))} list="kupci-lista" placeholder="Marko Marković ili odaberi iz liste"/>
          <datalist id="kupci-lista">{(window._kupciCache||[]).map(k=><option key={k.id} value={k.ime}/>)}</datalist>
        </div>
        <div className="fg2"><label>Telefon</label><input value={form.kupac_telefon} onChange={e=>setForm(f=>({...f,kupac_telefon:e.target.value}))} placeholder="061 234 567"/></div>
      </div>
      <div className="fg2"><label>Adresa kupca</label><input value={form.kupac_adresa} onChange={e=>setForm(f=>({...f,kupac_adresa:e.target.value}))} placeholder="Ulica bb, Grad"/></div>
      <div className="two-col">
        <div className="fg2"><label>Mjesto izdavanja</label><input value={form.mjesto} onChange={e=>setForm(f=>({...f,mjesto:e.target.value}))}/></div>
        <div className="fg2"><label>Rok plaćanja</label><input value={form.rok_placanja} onChange={e=>setForm(f=>({...f,rok_placanja:e.target.value}))}/></div>
      </div>
      <div style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <input type="checkbox" id="pdv-chk" checked={!!form.pdv&&!form.unosSaPdv} onChange={e=>setForm(f=>({...f,pdv:e.target.checked,unosSaPdv:false}))} style={{width:16,height:16}}/>
          <label htmlFor="pdv-chk" style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',cursor:'pointer'}}>Obračunaj PDV (17%)</label>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <input type="checkbox" id="unos-sa-pdv-chk" checked={!!form.unosSaPdv} onChange={e=>setForm(f=>({...f,unosSaPdv:e.target.checked,pdv:false}))} style={{width:16,height:16}}/>
          <label htmlFor="unos-sa-pdv-chk" style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',cursor:'pointer',color:'var(--accent)'}}>Unosim cijenu SA PDV</label>
        </div>
      </div>
      <div className="fg2"><label style={{color:'var(--accent)'}}>🚗 Vozilo <span style={{color:'var(--muted)',fontWeight:400}}>(npr. VW Golf 5 2008)</span></label><input value={form.vozilo||''} onChange={e=>setForm(f=>({...f,vozilo:e.target.value}))} placeholder="Model, godište, motorizacija..."/></div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,marginTop:4}}>
        <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:10,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--accent)'}}>Stavke</div>
        {form.unosSaPdv&&<div style={{fontSize:10,color:'var(--accent)',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700}}>⚠️ Unosiš cijene SA PDV — automatski se dijeli sa 1.17</div>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 45px 50px 55px 16px',gap:4,marginBottom:4}}>
        {['Opis','Kom','JM','Cij.',''].map((h,i)=><div key={i} style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:9,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--muted)'}}>{h}</div>)}
      </div>
      {stavke.map((s,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'1fr 45px 55px 55px 16px',gap:4,marginBottom:4,alignItems:'center'}}>
        <input style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:4,color:'var(--text)',fontFamily:'Barlow,sans-serif',fontSize:12,padding:'5px 7px',outline:'none'}} placeholder="Opis..." value={s.opis} onChange={e=>updateStavka(i,'opis',e.target.value)}/>
        <input style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:4,color:'var(--text)',fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:700,padding:'5px 4px',outline:'none',textAlign:'center'}} type="number" min="1" value={s.kolicina} onChange={e=>updateStavka(i,'kolicina',e.target.value)}/>
        <select style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:4,color:'var(--text)',fontFamily:'Barlow Condensed,sans-serif',fontSize:11,padding:'5px 3px',outline:'none'}} value={s.jm||'KOM'} onChange={e=>updateStavka(i,'jm',e.target.value)}><option>KOM</option><option>PAR</option><option>SET</option><option>KG</option></select>
        <input style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:4,color:'var(--text)',fontFamily:'Barlow Condensed,sans-serif',fontSize:12,fontWeight:700,padding:'5px 4px',outline:'none',textAlign:'right'}} type="number" placeholder="KM" value={s.cijena} onChange={e=>updateStavka(i,'cijena',e.target.value)}/>
        <button onClick={()=>removeStavka(i)} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:14,padding:0}}>×</button>
      </div>)}
      <button className="btn-sm" style={{marginBottom:10}} onClick={addStavka}><Icons.Plus size={10}/> Dodaj stavku</button>
      {stavke.some(s=>s.opis&&s.cijena)&&(()=>{
        const ukup=stavke.reduce((s,x)=>s+(parseFloat(x.cijena)||0)*(parseInt(x.kolicina)||1),0);
        if(form.unosSaPdv){
          // Cijene su SA PDV — prikaži razlaganje
          const bezPdv=ukup/1.17;const pdvIz=ukup-bezPdv;
          return(<div style={{background:'rgba(240,180,41,.08)',border:'1px solid rgba(240,180,41,.2)',borderRadius:6,padding:'8px 12px',marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}><span style={{color:'var(--muted)'}}>Cijena (bez PDV):</span><span>{bezPdv.toFixed(2)} KM</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}><span style={{color:'var(--muted)'}}>PDV 17% (sadržan):</span><span>{pdvIz.toFixed(2)} KM</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:18}}><span>UKUPNO:</span><span style={{color:'var(--accent)'}}>{ukup.toFixed(2)} KM</span></div>
          </div>);
        }
        if(form.pdv){
          const pdvIz=ukup*0.17;
          return(<div style={{background:'rgba(63,185,80,.08)',border:'1px solid rgba(63,185,80,.2)',borderRadius:6,padding:'8px 12px',marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}><span style={{color:'var(--muted)'}}>Bez PDV-a:</span><span>{ukup.toFixed(2)} KM</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}><span style={{color:'var(--muted)'}}>PDV (17%):</span><span>{pdvIz.toFixed(2)} KM</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:18}}><span>UKUPNO:</span><span style={{color:'var(--green)'}}>{(ukup+pdvIz).toFixed(2)} KM</span></div>
          </div>);
        }
        return(<div style={{background:'rgba(63,185,80,.08)',border:'1px solid rgba(63,185,80,.2)',borderRadius:6,padding:'8px 12px',marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:18}}><span>UKUPNO:</span><span style={{color:'var(--green)'}}>{ukup.toFixed(2)} KM</span></div>
        </div>);
      })()}
      <div className="fg2"><label>Napomena</label><textarea value={form.napomena} onChange={e=>setForm(f=>({...f,napomena:e.target.value}))} placeholder="Rok važenja, uvjeti..."/></div>
      <div className="modal-foot"><button className="btn-cancel" onClick={()=>{setModal(false);setEditPonuda(null);}}>Odustani</button><button className="btn-save" onClick={doSave}>{editPonuda?"Sačuvaj":"Kreiraj ponudu"}</button></div>
    </div></div>}
    {viewPonuda&&<div className="overlay" onClick={()=>setViewPonuda(null)}><div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Ponuda {viewPonuda.broj} <button className="btn-close" onClick={()=>setViewPonuda(null)}>x</button></div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:13,color:'var(--muted)'}}>{viewPonuda.kupac_ime} · {new Date(viewPonuda.created_at).toLocaleDateString('sr-Latn-BA')}</div>
        <div style={{fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,fontSize:20,color:'var(--green)'}}>{ukupnoSaPdv(viewPonuda.stavke||[],viewPonuda.pdv!==0).toFixed(2)} KM</div>
      </div>
      {viewPonuda.vozilo&&<div style={{background:'rgba(240,180,41,.1)',border:'1px solid rgba(240,180,41,.3)',borderRadius:6,padding:'6px 12px',marginBottom:10,fontFamily:'Barlow Condensed,sans-serif',fontWeight:800,fontSize:14,color:'var(--accent)'}}>🚗 {viewPonuda.vozilo}</div>}
      <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',marginBottom:12}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 45px 80px',background:'rgba(255,255,255,.04)',padding:'6px 12px',fontFamily:'Barlow Condensed,sans-serif',fontSize:9,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--muted)'}}>
          <div>Opis</div><div style={{textAlign:'center'}}>Kom</div><div style={{textAlign:'right'}}>Iznos</div>
        </div>
        {(viewPonuda.stavke||[]).map((s,i)=>{const v=(parseFloat(s.cijena)||0)*(parseInt(s.kolicina)||1);return(<div key={i} style={{display:'grid',gridTemplateColumns:'1fr 45px 80px',padding:'7px 12px',borderTop:'1px solid var(--border)',fontSize:13}}>
          <div>{s.opis}</div><div style={{textAlign:'center',color:'var(--muted)'}}>{s.kolicina}x</div><div style={{textAlign:'right',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700}}>{v.toFixed(2)} KM</div>
        </div>);})}
      </div>
      {viewPonuda.pdv!==0&&<div style={{fontSize:12,color:'var(--muted)',textAlign:'right',marginBottom:8}}>PDV (17%): {pdvIznos(viewPonuda.stavke||[]).toFixed(2)} KM</div>}
      {viewPonuda.napomena&&<div style={{fontSize:12,color:'var(--muted)',marginBottom:12,fontStyle:'italic'}}>{viewPonuda.napomena}</div>}
      <div className="modal-foot">
        <button className="btn-cancel" onClick={()=>setViewPonuda(null)}>Zatvori</button>
        {viewPonuda.kupac_telefon&&<a href={'https://wa.me/387'+viewPonuda.kupac_telefon.replace(/^0/,'').replace(/\D/g,'')+'?text='+encodeURIComponent(genWAText(viewPonuda))} target="_blank" style={{display:'flex',alignItems:'center',justifyContent:'center',width:34,height:34,background:'#25d366',borderRadius:6,textDecoration:'none',fontSize:18}}>💬</a>}
        {viewPonuda.kupac_telefon&&<a href={'viber://forward?text='+encodeURIComponent(genWAText(viewPonuda))} style={{display:'flex',alignItems:'center',justifyContent:'center',width:34,height:34,background:'#7360f2',borderRadius:6,textDecoration:'none',fontSize:18}}>📲</a>}
        <div style={{position:'relative',display:'inline-block'}}>
          <button className="btn-save" onClick={e=>{const m=e.currentTarget.nextElementSibling;m.style.display=m.style.display==='block'?'none':'block';}}>🖨 Štampaj ▾</button>
          <div style={{display:'none',position:'absolute',bottom:'110%',right:0,zIndex:100,background:'var(--surf)',border:'1px solid var(--border)',borderRadius:6,boxShadow:'0 4px 16px rgba(0,0,0,.5)',minWidth:160,overflow:'hidden'}}>
            <div style={{padding:'10px 14px',cursor:'pointer',fontSize:12,fontFamily:'Barlow Condensed,sans-serif',fontWeight:700}} onClick={e=>{doPrint(viewPonuda,'predracun');e.currentTarget.parentNode.style.display='none';}}>📋 Predračun</div>
            <div style={{padding:'10px 14px',cursor:'pointer',fontSize:12,fontFamily:'Barlow Condensed,sans-serif',fontWeight:700,borderTop:'1px solid var(--border)'}} onClick={e=>{e.currentTarget.parentNode.style.display='none';setRacunModal(viewPonuda);setViewPonuda(null);}}>🧾 Račun</div>
          </div>
        </div>
      </div>
    </div></div>}
    {racunModal&&<div className="overlay" onClick={()=>setRacunModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-title">Štampaj račun <button className="btn-close" onClick={()=>setRacunModal(null)}>x</button></div>
      <div style={{fontSize:13,marginBottom:14,color:'var(--muted)'}}>Ponuda: <b style={{color:'var(--text)'}}>{racunModal.broj}</b></div>
      <div className="fg2">
        <label>Broj fiskalnog računa <span style={{color:'var(--muted)',fontWeight:400,fontSize:10}}>(opciono)</span></label>
        <input autoFocus value={brFiskInput} onChange={e=>setBrFiskInput(e.target.value)} placeholder="npr. IT-12345-67890" onKeyDown={e=>e.key==='Enter'&&(doPrint(racunModal,'racun',brFiskInput),setRacunModal(null),setBrFiskInput(''))}/>
      </div>
      <div className="modal-foot">
        <button className="btn-cancel" onClick={()=>setRacunModal(null)}>Odustani</button>
        <button className="btn-save" onClick={()=>{doPrint(racunModal,'racun',brFiskInput);setRacunModal(null);setBrFiskInput('');}}>🖨 Štampaj račun</button>
      </div>
    </div></div>}
    <div className="site-footer">© 2026 <span>DelicNode</span></div>
  </div>);
}

export default PonudaModul;
