/* EX-YU Radio v10 — anonymous active installations, not IP addresses. */
(() => {
 'use strict';
 const URL = 'https://jjgkvncuixqmcyugcblj.supabase.co/functions/v1/radio-online';
 const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZ2t2bmN1aXhxbWN5dWdjYmxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MjQ0NDQsImV4cCI6MjExMTIwMDQ0NH0.DOOOmJ_27zMLwds_JjV8jvXaRMgizjKARnIRlwYoM2w'; // Public legacy anon key, never a service-role key.
 const PERIOD=60000, TTL=3, STORAGE='exyu-radio-presence-v10';
 const count=document.getElementById('onlineUsersCount'), status=document.getElementById('onlineStatus'), stamp=document.getElementById('onlineUpdatedAt'), refresh=document.getElementById('refreshOnlineBtn');
 const audio=document.getElementById('audio'), isRadio=!!audio;
 let pending=false,lastRefresh=0,session=null;
 function makeId(){
   const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
   const s=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
   return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);
 }
 if(isRadio){try{session=localStorage.getItem(STORAGE);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session||'')){session=makeId();localStorage.setItem(STORAGE,session);}}catch{try{session=makeId();}catch{session=null;}}}
 function show(value,message,good){
  if(count)count.textContent=value;
  if(status)status.textContent=message;
  if(stamp)stamp.textContent=good?'Ažurirano '+new Date().toLocaleTimeString('sr-RS',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'Podatak trenutno nije dostupan';
  const chip=document.querySelector('.online-counter-link');if(chip)chip.title=good?'Aktivne aplikacije u poslednja 3 minuta':'Statistika trenutno nije dostupna';
 }
 function active(){return !document.hidden || !!(audio&&!audio.paused);}
 async function checkLive(){
  if(pending)return;
  if(navigator.onLine===false){show('—','Nema internet veze',false);return;}
  pending=true;lastRefresh=Date.now();if(refresh)refresh.disabled=true;
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
  try{
   const response=await fetch(URL,{method:'POST',mode:'cors',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY,'apikey':KEY},body:JSON.stringify({session_id:isRadio&&active()?session:null}),signal:ctrl.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   const {online}=await response.json();if(!Number.isSafeInteger(online)||online<0)throw Error('invalid count');
   if(navigator.onLine===false)throw Error('offline');
   show(online.toLocaleString('sr-RS'),'Aktivne aplikacije u poslednja '+TTL+' minuta',true);
  }catch{show('—','Statistika trenutno nije dostupna',false);}
  finally{clearTimeout(timeout);pending=false;if(refresh)refresh.disabled=false;}
 }
 const resume=()=>{if(active()&&Date.now()-lastRefresh>10000)void checkLive();};
 document.addEventListener('visibilitychange',resume);
 window.addEventListener('online',()=>void checkLive());
 window.addEventListener('offline',()=>show('—','Nema internet veze',false));
 window.addEventListener('pageshow',resume);
 if(audio)audio.addEventListener('playing',resume);
 if(refresh)refresh.addEventListener('click',()=>void checkLive());
 void checkLive();setInterval(()=>{if(active())void checkLive();},PERIOD);
})();
