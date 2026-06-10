import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, promjerDisp, tipLbl, statusLbl, timeAgo, resizeImage } from '../utils.js';
import { ErrorBoundary, ComboBox, useImageUpload, Lightbox, ImgUploadUI, Pagination } from '../components/index.jsx';

function LoginScreen({onLogin}){
  const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [showPass,setShowPass]=useState(false);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const doLogin=async()=>{
    if(!username||!password){setError('Unesite korisničko ime i lozinku');return;}
    setLoading(true);setError('');
    try{const d=await api('/auth/login',{method:'POST',body:{username,password}});localStorage.setItem('adg_token',d.token);onLogin({username:d.username,role:d.role});}
    catch(e){setError(e.message);}setLoading(false);
  };
  return(<div className="login-wrap"><div className="login-card">
    <div className="login-logo"><img src="/logo-orig.webp" alt="Auto Delić" style={{height:64,objectFit:"contain"}}/></div>
    <div className="login-sub">Upravljanje auto otpadom</div>
    {error&&<div className="login-err">{error}</div>}
    <div className="fg2"><label>Korisničko ime</label><input autoFocus value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()} placeholder="admin"/></div>
    <div className="fg2"><label>Lozinka</label>
      <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()} placeholder="••••••"/>
      <label style={{display:'flex',alignItems:'center',gap:6,marginTop:6,fontSize:12,color:'var(--muted)',cursor:'pointer'}}>
        <input type="checkbox" checked={showPass} onChange={e=>setShowPass(e.target.checked)}/> Prikaži lozinku
      </label>
    </div>
    <button className="btn-save" style={{width:'100%',marginTop:4,padding:'10px',fontSize:14}} onClick={doLogin} disabled={loading}>{loading?'Prijavljivanje...':'Prijavi se'}</button>
  </div></div>);
}

// ===== DASHBOARD =====

export default LoginScreen;
