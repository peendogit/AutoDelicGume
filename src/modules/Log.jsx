import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../utils.js';
import { Icons } from '../components/index.jsx';

function LogModul({showToast}){
  const [lista,setLista]=useState([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{api('/aktivnosti?limit=300').then(d=>{setLista(d);setLoading(false);}).catch(e=>{showToast(e.message,'err');setLoading(false);});},[]);
  const nazivi={PRIJAVA:'Prijava',DODANA_GUMA:'Dodana guma',EDITOVANA_GUMA:'Izmijenjena guma',PREMJESTENA_GUMA:'Premještena',PRODANA_GUMA:'Prodana guma',OBRISANA_GUMA:'Obrisana guma',DODAN_AUTO:'Dodan auto',PRODAT_AUTO:'Prodat auto',OBRISAN_AUTO:'Obrisan auto'};
  if(loading)return<div className="page"><div style={{color:'var(--muted)',padding:40,textAlign:'center'}}>Učitavanje...</div></div>;
  return(<div className="page">
    <div className="page-header"><div className="page-title">Dnevnik aktivnosti</div><div className="page-sub">{lista.length} zabilježenih aktivnosti</div></div>
    <div className="card-panel">
      {lista.length===0&&<div style={{textAlign:'center',padding:'30px 0',color:'var(--muted)',fontSize:13}}>Nema zabilježenih aktivnosti</div>}
      {lista.map((a,i)=>{
        const dt=new Date(a.created_at);
        const timeStr=dt.toLocaleDateString('sr-Latn-RS')+' '+dt.toLocaleTimeString('sr-Latn-RS',{hour:'2-digit',minute:'2-digit'});
        return(<div key={i} className="log-item">
          <span className={'log-badge '+(a.akcija||'')}>{nazivi[a.akcija]||a.akcija}</span>
          <div style={{flex:1,minWidth:0}}>
            <div className="log-user">{a.korisnik}</div>
            {a.detalji&&<div className="log-detail">{a.detalji}</div>}
          </div>
          <span className="log-time">{timeStr}</span>
        </div>);
      })}
    </div>
  <div className="site-footer">© 2026 <span>DelicNode</span></div>
  </div>);
}

// ===== GUME MODULE =====

export default LogModul;
