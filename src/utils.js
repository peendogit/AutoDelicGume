import { api } from './api.js';

function getToken(){return localStorage.getItem('adg_token');}
async function api(path,opts={}){
  const token=getToken();
  const res=await fetch('/api'+path,{
    headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},
    ...opts,body:opts.body?JSON.stringify(opts.body):undefined
  });
  const data=await res.json();
  if(res.status===401){localStorage.removeItem('adg_token');window.location.reload();throw new Error('Sesija istekla');}
  if(!res.ok) throw new Error(data.error||'Greška');
  return data;
}

// ===== UTILS =====

function resizeImage(file,maxW=1200,maxH=1200,quality=0.82){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        let w=img.width,h=img.height;
        if(w>maxW||h>maxH){const ratio=Math.min(maxW/w,maxH/h);w=Math.round(w*ratio);h=Math.round(h*ratio);}
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg',quality));
      };img.src=e.target.result;
    };reader.readAsDataURL(file);
  });
}

function promjerDisp(p){if(!p)return '';return /^[0-9]/.test(p)?'R'+p:p;}

function tipLbl(t){return {komad:'Komad (1)',par:'Par (2)',set:'Set (4)'}[t]||t||'';}

function statusLbl(s){return {na_stanju:'Na stanju',prodat:'Prodat'}[s]||s||'';}

function timeAgo(dt){
  const sec=Math.floor((Date.now()-new Date(dt).getTime())/1000);
  if(sec<60)return 'upravo';if(sec<3600)return Math.floor(sec/60)+' min';
  if(sec<86400)return Math.floor(sec/3600)+' h';return Math.floor(sec/86400)+' d';
}
const PROMJER_OPTIONS=['13','14','15','16','16C','17','17C','18','19','20','21'];
const SIRINA_OPTIONS=['155','165','175','185','195','205','215','225','235','245','255'];
const VISINA_OPTIONS=['40','45','50','55','60','65','70','75','80'];
const EMPTY_GUMA={sezona:'',sirina:'',visina:'',promjer:'',napomena:'',policaKod:'',slike:[],dubina:'',dot:'',tip:'',cijena:''};

export { getToken, resizeImage, promjerDisp, tipLbl, statusLbl, timeAgo };
