import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, getToken, promjerDisp, tipLbl, statusLbl, timeAgo, resizeImage } from './utils.js';
import { Icons, ErrorBoundary, Lightbox, Pagination } from './components/index.jsx';
import LoginScreen from './modules/LoginScreen.jsx';
import Dashboard from './modules/Dashboard.jsx';
import AutaModul from './modules/Auta.jsx';
import ZadaciModul from './modules/Zadaci.jsx';
import GumeModul from './modules/Gume.jsx';
import PremjestanjeWidget from './modules/Premjestanje.jsx';
import KupciModul from './modules/Kupci.jsx';
import PonudaModul from './modules/Ponude.jsx';
import PodesavanjaModul from './modules/Podesavanja.jsx';
import NaloziModul from './modules/Nalozi.jsx';
import FinansijeModul from './modules/Finansije.jsx';
import AnalitikaModul from './modules/Analitika.jsx';
import LogModul from './modules/Log.jsx';

function App(){
  const [user,setUser]=useState(null);const [authChecked,setAuthChecked]=useState(false);
  const [page,setPage]=useState(()=>localStorage.getItem('adg_last_page')||'dashboard');
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [toast,setToast]=useState(null);
  const [theme,setTheme]=useState(()=>localStorage.getItem('adg_theme')||'dark');
  const [lightbox,setLightbox]=useState(null);
  // Gume state (lifted for cross-module use)
  const [police,setPolice]=useState([]);
  const [magacini,setMagacini]=useState([]);
  const [gume,setGume]=useState([]);
  const [gumeLoaded,setGumeLoaded]=useState(false);

  const isAdmin=user?.role==='admin';

  useEffect(()=>{document.body.className=theme==='light'?'light':'';localStorage.setItem('adg_theme',theme);},[theme]);
  useEffect(()=>{
    const t=getToken();if(!t){setAuthChecked(true);return;}
    api('/auth/me').then(u=>{setUser(u);setAuthChecked(true);}).catch(()=>{localStorage.removeItem('adg_token');setAuthChecked(true);});
  },[]);

  const showToast=useCallback((msg,type='ok')=>{setToast({msg,type});setTimeout(()=>setToast(null),2800);},[]);

  const loadPoliceAndMag=async()=>{
    try{const [p,m]=await Promise.all([api('/police'),api('/magacini')]);setPolice(p);setMagacini(m);}catch(e){}
  };

  const loadGume=async()=>{
    try{const g=await api('/gume');setGume(g);setGumeLoaded(true);}catch(e){showToast(e.message,'err');}
  };

  useEffect(()=>{if(user){loadPoliceAndMag();}}, [user]);
  useEffect(()=>{
    if(!user)return;
    const loadCount=()=>api('/nalozi/count').then(d=>setNalogCount(d?.count||0)).catch(e=>{});
    loadCount();
    const iv=setInterval(loadCount,30000);
    window.addEventListener('nalozi-changed',loadCount);
    return ()=>{clearInterval(iv);window.removeEventListener('nalozi-changed',loadCount);};
  },[user]);
  useEffect(()=>{if(user&&(page==='gume'||page==='dashboard')&&!gumeLoaded)loadGume();},[user,page]);

  const [isOnline,setIsOnline]=useState(navigator.onLine);
  const [nalogCount,setNalogCount]=useState(0);
  const [openGumaId,setOpenGumaId]=useState(null);
  const [returnPage,setReturnPage]=useState(null);
  const [fabOpen,setFabOpen]=useState(false);
  const overlayCountRef = React.useRef(0);
  const [quickAddModal,setQuickAddModal]=useState(null); // 'guma' | 'auto'
  const [offlineQueue] = useState([]);

  useEffect(()=>{
    const on=()=>{ setIsOnline(true); showToast('Konekcija vraćena ✓'); };
    const off=()=>setIsOnline(false);
    window.addEventListener('online',on);
    window.addEventListener('offline',off);
    return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);};
  },[]);

  const navigatingBack=useRef(false);

  useEffect(()=>{
    window.history.replaceState({page},'','/');
    const onPop=(e)=>{
      // Close overlay first if any are open
      const overlays=document.querySelectorAll('.overlay, .lightbox');
      if(overlays.length>0){
        overlays[overlays.length-1].click();
        window.history.pushState({page},'','/'); // stay on current page, re-add history entry
        return;
      }
      const prevPage=e.state&&e.state.page;
      if(prevPage&&prevPage!==page){
        navigatingBack.current=true;
        setPage(prevPage);
        localStorage.setItem('adg_last_page',prevPage);
      } else if(!prevPage){
        // No more history - prevent app close, stay
        window.history.pushState({page},'','/');
      }
    };
    window.addEventListener('popstate',onPop);
    return()=>window.removeEventListener('popstate',onPop);
  },[]);

  const doLogout=async()=>{try{await api('/auth/logout',{method:'POST'});}catch(e){}localStorage.removeItem('adg_token');setUser(null);setGume([]);setGumeLoaded(false);};
  const nav=(p,gumaId)=>{
    if(p!==page){
      window.history.pushState({page:p},'','/');
    }
    if(gumaId){setReturnPage(page);}
    setPage(p);localStorage.setItem('adg_last_page',p);setSidebarOpen(false);if(gumaId)setOpenGumaId(gumaId);
  };
  // Radnici uvijek idu na gume
  useEffect(()=>{if(user&&user.role!=='admin'&&(page==='dashboard'||page==='auta'))setPage('gume');},[user]);

  if(!authChecked)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--muted)',fontFamily:'Barlow Condensed',fontSize:14,letterSpacing:2}}>UČITAVANJE...</div>;
  if(!user)return<LoginScreen onLogin={setUser}/>;

  const navItems=[
    {id:'dashboard',label:'Pregled',icon:<Icons.Home size={18}/>,always:true},
    {id:'gume',label:'Gume',icon:<Icons.Tire size={18}/>,always:true},
    {id:'auta',label:'Auta',icon:<Icons.Car size={18}/>,adminOnly:true},
    {id:'kupci',label:'Kupci',icon:<Icons.Task size={18}/>,adminOnly:true},
    {id:'ponude',label:'Ponude',icon:<Icons.Money size={18}/>,adminOnly:true},
    {id:'zadaci',label:'Zadaci',icon:<Icons.Task size={18}/>,adminOnly:true},
    {id:'finansije',label:'Finansije',icon:<Icons.Money size={18}/>,adminOnly:true},
    {id:'analitika',label:'Analitika',icon:<Icons.Chart size={18}/>,adminOnly:true},
    {id:'log',label:'Dnevnik',icon:<Icons.Log size={18}/>,adminOnly:true},
  ].filter(i=>i.always||(i.adminOnly&&isAdmin));

  const pageTitles={nalozi:'Nalozi',dashboard:'Pregled',gume:'Gume',auta:'Auta',zadaci:'Zadaci',finansije:'Finansije',kupci:'Kupci',ponude:'Ponude / Računi',podesavanja:'Podešavanja',analitika:'Analitika',log:'Dnevnik'};

  return(<div className="layout">
    {/* SIDEBAR OVERLAY on mobile */}
    {sidebarOpen&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:99}} onClick={()=>setSidebarOpen(false)}/>}

    {/* SIDEBAR */}
    <aside className={'sidebar'+(sidebarOpen?' open':'')}>
      <div className="sb-logo">
        <span className="sb-logo-icon"><Icons.Car size={22}/></span>
        <div className="sb-logo-text">Auto Delić<span>Upravljanje otpadom</span></div>
      </div>
      <nav className="sb-nav">
        {navItems.map(item=><button key={item.id} className={'sb-item'+(page===item.id?' active':'')} onClick={()=>nav(item.adminHash||item.id)}>
          <span className="icon">{item.icon}</span>{item.label}
        </button>)}
      </nav>
      <div className="sb-bottom">
        <div className="sb-user">
          <div style={{flex:1,minWidth:0}}>
            <div className="sb-user-name">{user.username}</div>
          </div>
          <span className={'sb-user-badge '+user.role}>{user.role}</span>
        </div>
        <div style={{display:'flex',gap:5}}>
          <button className="tb-btn" style={{flex:1}} title={theme==='dark'?'Svijetla tema':'Tamna tema'} onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?'☀️':'🌙'}</button>
          <button className="tb-btn" style={{flex:1,color:'var(--red)',borderColor:'rgba(248,81,73,.3)'}} title="Odjava" onClick={doLogout}><Icons.Logout size={16}/></button>
        </div>
      </div>
    </aside>

    {/* MAIN CONTENT */}
    <div className="content">
      <div className="topbar">
        <button className="topbar-burger" onClick={()=>setSidebarOpen(s=>!s)}>
          <span/><span/><span/>
        </button>
        <div className="topbar-title">{pageTitles[page]||page}</div>
        <div className="topbar-actions">
          <button onClick={()=>nav('nalozi')} style={{position:'relative',background:'none',border:'none',color:page==='nalozi'?'var(--accent)':'var(--muted)',cursor:'pointer',padding:'6px 16px 6px 8px',fontSize:13,fontFamily:'Barlow Condensed,sans-serif',fontWeight:900,letterSpacing:1,textTransform:'uppercase',lineHeight:1}}>
            NALOZI
            {nalogCount>0&&<span style={{position:'absolute',top:0,right:0,background:'var(--red)',color:'#fff',borderRadius:'50%',width:16,height:16,fontSize:9,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>{nalogCount}</span>}
          </button>
          {isAdmin&&<button title="Podešavanja" onClick={()=>nav('podesavanja')} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',padding:'6px 8px',fontSize:20,lineHeight:1}}>⚙️</button>}
        </div>
      </div>

      {/* PAGES */}
      {page==='dashboard'&&<ErrorBoundary><Dashboard user={user} onNav={nav} showToast={showToast}/></ErrorBoundary>}
      {page==='gume'&&<ErrorBoundary><GumeModul user={user} showToast={showToast} gume={gume} setGume={setGume} police={police} magacini={magacini} loadPolice={loadPoliceAndMag} lightbox={lightbox} setLightbox={setLightbox} quickAdd={quickAddModal==='guma'} onQuickAddDone={()=>setQuickAddModal(null)} openGumaId={openGumaId} onOpenGumaDone={()=>setOpenGumaId(null)} onNav={nav} returnTo={returnPage}/></ErrorBoundary>}
      {page==='auta'&&isAdmin&&<ErrorBoundary><AutaModul user={user} showToast={showToast} quickAdd={quickAddModal==='auto'} onQuickAddDone={()=>setQuickAddModal(null)}/></ErrorBoundary>}
      {page==='zadaci'&&isAdmin&&<ZadaciModul user={user} showToast={showToast}/>}
      {page==='kupci'&&isAdmin&&<ErrorBoundary><KupciModul showToast={showToast}/></ErrorBoundary>}
      {page==='ponude'&&isAdmin&&<ErrorBoundary><PonudaModul showToast={showToast}/></ErrorBoundary>}
      {page==='nalozi'&&<NaloziModul user={user} showToast={showToast} onCountChange={setNalogCount} onOpenGuma={(id)=>nav('gume',id)} setLightbox={setLightbox}/> }
      {page==='podesavanja'&&isAdmin&&<PodesavanjaModul user={user} showToast={showToast} magacini={magacini} setMagacini={setMagacini} police={police} loadPolice={loadPoliceAndMag}/>}
      {page==='finansije'&&isAdmin&&<FinansijeModul showToast={showToast}/>}
      {page==='analitika'&&isAdmin&&<AnalitikaModul showToast={showToast}/>}
      {page==='log'&&isAdmin&&<LogModul showToast={showToast}/>}
    </div>

    {lightbox&&<Lightbox images={lightbox.images} startIndex={lightbox.index} onClose={()=>setLightbox(null)}/>}
    {/* FAB — brzo dodavanje */}
    {user&&<>
      {fabOpen&&<div className="fab-overlay" onClick={()=>setFabOpen(false)}/>}
      {fabOpen&&<div className="fab-menu">
        <div className="fab-item" onClick={()=>{setFabOpen(false);setQuickAddModal('guma');nav('gume');}}>
          <div className="fab-item-lbl">Dodaj gumu</div>
          <div className="fab-item-btn">🛞</div>
        </div>
        {isAdmin&&<div className="fab-item" onClick={()=>{setFabOpen(false);setQuickAddModal('auto');nav('auta');}}>
          <div className="fab-item-lbl">Dodaj auto</div>
          <div className="fab-item-btn">🚗</div>
        </div>}
      </div>}
      <button className="fab" onClick={()=>setFabOpen(o=>!o)}>{fabOpen?'×':'+'}</button>
    </>}
    {!isOnline&&<div className="offline-bar">⚡ Nema interneta — podaci se ne mogu osvježiti</div>}
    {toast&&<div className={'toast'+(toast.type==='err'?' err':'')}>{toast.msg}</div>}
  </div>);
}

// Fix modal position when keyboard opens on mobile
if('visualViewport' in window) {
  window.visualViewport.addEventListener('resize', () => {
    const modals = document.querySelectorAll('.modal');
    const overlays = document.querySelectorAll('.overlay');
    const keyboardHeight = window.innerHeight - window.visualViewport.height;
    overlays.forEach(o => {
      if(keyboardHeight > 100) {
        o.style.alignItems = 'flex-start';
        o.style.paddingTop = '10px';
      } else {
        o.style.alignItems = '';
        o.style.paddingTop = '';
      }
    });
  });
}

export default App;
