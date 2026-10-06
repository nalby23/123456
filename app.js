(function(){
'use strict';
var $=function(s){return document.querySelector(s)};
var CATS=[
  {id:'pitch',label:'מגרש',emoji:'🏟️'},
  {id:'gear',label:'ציוד וכדורים',emoji:'⚽'},
  {id:'snacks',label:'שתייה וכיבוד',emoji:'🛒'},
  {id:'ref',label:'שופט',emoji:'🟨'},
  {id:'other',label:'אחר',emoji:'📦'}
];
function catOf(id){for(var i=0;i<CATS.length;i++){if(CATS[i].id===id)return CATS[i]}return CATS[4]}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function r2(n){return Math.round(n*100)/100}
function num(n){return Math.abs(r2(n)).toLocaleString('he-IL',{minimumFractionDigits:0,maximumFractionDigits:2})}
function ilsText(n){return (r2(n)<0?'-':'')+'₪'+num(n)}
function ils(n){return '<span class="amt" dir="ltr">'+ilsText(n)+'</span>'}
function pad(n){return String(n).padStart(2,'0')}
function today(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function fmtDate(iso){var p=String(iso||'').split('-');if(p.length<3)return '';return pad(+p[2])+'.'+pad(+p[1])+'.'+String(p[0]).slice(2)}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function parseAmt(v){
  var s=String(v).trim().replace(/[^\d.,]/g,'');
  if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))s=s.replace(/,/g,'');
  else s=s.replace(',','.');
  var n=parseFloat(s);return isFinite(n)?r2(n):NaN;
}
function sum(a){var t=0;a.forEach(function(x){t+=x.amount});return r2(t)}
function byDate(a,b){return b.date.localeCompare(a.date)||(b.id>a.id?1:-1)}
var ss={
  get:function(k){try{return sessionStorage.getItem(k)}catch(e){return null}},
  set:function(k,v){try{sessionStorage.setItem(k,v)}catch(e){}},
  del:function(k){try{sessionStorage.removeItem(k)}catch(e){}}
};

var app=$('#app');
var state={rev:0,updated:null,incomes:[],expenses:[]};
var loaded=false,loadError='',saving=false;
var password=ss.get('kupa-pw')||'',isAdmin=false,showLogin=false;
var modal=null,pendingReceipt=null,fileTarget='new',confirmId=null,confirmT=null;
var receiptCache={};

/* ---------- api ---------- */
function api(path,opts){
  opts=opts||{};
  opts.cache='no-store';
  return fetch('/api/'+path,opts);
}
function loadData(){
  return api('data').then(function(r){if(!r.ok)throw new Error('http '+r.status);return r.json()})
    .then(function(d){state=d;loaded=true;loadError='';render()})
    .catch(function(){loadError=loaded?'לא הצלחנו לרענן. מוצגים הנתונים האחרונים.':'לא הצלחנו לטעון את הנתונים. בדקו חיבור לאינטרנט.';render()});
}
function save(mutate,receipts,okMsg){
  if(saving)return;
  var next=JSON.parse(JSON.stringify(state));
  mutate(next);
  saving=true;
  api('save',{method:'POST',headers:{'content-type':'application/json','x-admin-password':password},
    body:JSON.stringify({baseRev:state.rev,state:next,receipts:receipts||{}})})
    .then(function(r){return r.json().then(function(d){return {status:r.status,d:d}})})
    .then(function(x){
      saving=false;
      if(x.status===200){state=x.d;toast(okMsg||'נשמר. כולם רואים את העדכון.');render()}
      else if(x.status===409){state=x.d.state;toast('מישהו עדכן בינתיים. הנתונים רועננו, נסו שוב.');render()}
      else if(x.status===401){logout();toast('הסיסמה לא תקינה.')}
      else{toast('השמירה נכשלה. נסו שוב.');render()}
    })
    .catch(function(){saving=false;toast('אין חיבור. השמירה לא בוצעה.');render()});
}
function login(pw){
  api('login',{method:'POST',headers:{'x-admin-password':pw}}).then(function(r){
    if(r.ok){password=pw;ss.set('kupa-pw',pw);isAdmin=true;showLogin=false;render();toast('מצב מנהל פתוח')}
    else toast(r.status===401?'סיסמה שגויה, או שלא הוגדרה סיסמה באתר.':'שגיאה. נסו שוב.');
  }).catch(function(){toast('אין חיבור.')});
}
function logout(){password='';isAdmin=false;view='viewer';ss.del('kupa-pw');render()}
var view='viewer';

/* ---------- views ---------- */
function header(){
  var sw=isAdmin?'<div class="seg" role="group" aria-label="מצב תצוגה"><button data-action="view" data-v="viewer" aria-pressed="'+(view==='viewer')+'">👀 צופה</button><button data-action="view" data-v="admin" aria-pressed="'+(view==='admin')+'">🛠️ מנהל</button></div>':'';
  return '<header class="top"><div class="brand"><div class="logo" aria-hidden="true">⚽</div><div><h1>קופת הקבוצה</h1><p>דשבורד שקיפות · בלי שמות, רק מספרים</p></div></div>'+sw+'</header>';
}
function donut(parts,total){
  var r=46,C=2*Math.PI*r,off=0,gap=parts.length>1?1.6:0;
  var segs=parts.map(function(p){
    var len=p.amt/total*C,dash=Math.max(len-gap,0.6);
    var s='<circle cx="60" cy="60" r="'+r+'" fill="none" stroke="var(--c-'+p.id+')" stroke-width="16" stroke-dasharray="'+dash.toFixed(2)+' '+(C-dash).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'" transform="rotate(-90 60 60)"/>';
    off+=len;return s;
  }).join('');
  var label='חלוקת ההוצאות: '+parts.map(function(p){return catOf(p.id).label+' '+Math.round(p.amt/total*100)+'%'}).join(', ');
  return '<svg viewBox="0 0 120 120" role="img" aria-label="'+esc(label)+'"><circle cx="60" cy="60" r="'+r+'" fill="none" stroke="var(--surface-2)" stroke-width="16"/>'+segs+'</svg>';
}
function viewerScreen(){
  if(!loaded&&!loadError)return '<div class="skel">טוען את הקופה...</div>';
  var inc=sum(state.incomes),exp=sum(state.expenses),bal=r2(inc-exp),h='';
  if(loadError)h+='<div class="err" role="alert">'+esc(loadError)+' <button data-action="reload">נסו שוב</button></div>';
  h+='<section class="hero" aria-label="יתרה נוכחית"><div class="hero-label">💰 יתרה נוכחית בקופה</div><div class="hero-num'+(bal<0?' neg':'')+'">'+ils(bal)+'</div><div class="hero-meta">מה שנכנס פחות מה שיצא</div></section>';
  h+='<div class="tiles"><div class="tile"><div class="lbl">📥 סך הכל הכנסות</div><div class="val in">'+ils(inc)+'</div></div><div class="tile"><div class="lbl">🛒 סך הכל הוצאות</div><div class="val out">'+ils(exp)+'</div></div></div>';
  var map={};state.expenses.forEach(function(e){map[e.cat]=r2((map[e.cat]||0)+e.amount)});
  var parts=Object.keys(map).map(function(k){return {id:catOf(k).id,amt:map[k]}}).sort(function(a,b){return b.amt-a.amt});
  h+='<section class="card"><h2>📊 לאן הלך הכסף</h2>';
  if(!parts.length||exp<=0)h+='<div class="empty">עדיין לא נרשמו הוצאות.</div>';
  else{
    h+='<div class="chart"><div class="donut">'+donut(parts,exp)+'<div class="mid"><span class="t">סה״כ הוצאות</span><span class="v">'+ils(exp)+'</span></div></div><ul class="legend">';
    parts.forEach(function(p){
      var c=catOf(p.id),pc=Math.round(p.amt/exp*100);
      h+='<li><span class="nm"><span class="dot" style="background:var(--c-'+c.id+')"></span><span>'+c.emoji+' '+esc(c.label)+'</span><span class="pc">'+pc+'%</span></span><span class="am">'+ils(p.amt)+'</span><span class="bar"><i style="width:'+pc+'%;background:var(--c-'+c.id+')"></i></span></li>';
    });
    h+='</ul></div>';
  }
  h+='</section>';
  var ex=state.expenses.slice().sort(byDate);
  h+='<section class="card"><h2>📄 היסטוריית הוצאות<small>'+ex.length+' רשומות</small></h2>';
  if(!ex.length)h+='<div class="empty">עדיין לא נרשמו הוצאות.</div>';
  else{
    h+='<div class="tbl-wrap"><table><thead><tr><th>תאריך</th><th>הוצאה</th><th>סכום</th><th>קבלה</th></tr></thead><tbody>';
    ex.forEach(function(e){
      var c=catOf(e.cat);
      h+='<tr><td class="d">'+fmtDate(e.date)+'</td><td>'+c.emoji+' '+esc(e.name)+'<small>'+esc(c.label)+'</small></td><td class="n">'+ils(e.amount)+'</td><td>'+(e.hasReceipt?'<button class="chip" data-action="receipt" data-id="'+esc(e.id)+'">📄 הצג קבלה</button>':'<span class="muted">ללא קבלה</span>')+'</td></tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='</section>';
  var inl=state.incomes.slice().sort(byDate);
  h+='<section class="card"><h2>💰 הכנסות לקופה<small>'+inl.length+' רשומות</small></h2>';
  if(!inl.length)h+='<div class="empty">עדיין לא נרשמו הכנסות.</div>';
  else{
    h+='<ul class="dep">';
    inl.forEach(function(i){h+='<li><span class="d">'+fmtDate(i.date)+'</span><span class="tx">'+esc(i.note||'הפקדה לקופה')+'</span><span class="am">+'+ils(i.amount)+'</span></li>'});
    h+='</ul>';
  }
  h+='</section>';
  var up=state.updated?'עודכן לאחרונה: '+new Date(state.updated).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'}):'';
  h+='<footer class="foot">האתר אנונימי במכוון: אין בו שמות של שחקנים.'+(up?'<br>'+esc(up):'')+(isAdmin?'':'<br><button class="adminlink" data-action="show-login">כניסת מנהל</button>')+(isAdmin?'<br><button class="adminlink" data-action="logout">יציאה ממצב מנהל</button>':'')+'</footer>';
  return h;
}
function catOptions(){return CATS.map(function(c){return '<option value="'+c.id+'">'+c.emoji+' '+esc(c.label)+'</option>'}).join('')}
function adminScreen(){
  var bal=r2(sum(state.incomes)-sum(state.expenses)),h='';
  h+='<section class="card"><div class="sync"><b>✓</b> <span>כל שינוי נשמר מיד ומופיע לכולם באותו קישור.</span></div><p class="hint" style="margin-top:8px">יתרה כרגע: <b>'+ils(bal)+'</b></p></section>';
  h+='<section class="card"><h2>💰 הכנסה לקופה</h2><form data-form="income" class="grid2" novalidate>'
    +'<div class="field"><label class="lbl2" for="f-inc-amt">סכום (₪)</label><input id="f-inc-amt" inputmode="decimal" autocomplete="off" placeholder="למשל 300"></div>'
    +'<div class="field"><label class="lbl2" for="f-inc-date">תאריך</label><input id="f-inc-date" type="date" value="'+today()+'"></div>'
    +'<div class="field span2"><label class="lbl2" for="f-inc-note">תיאור (לא חובה)</label><input id="f-inc-note" autocomplete="off" placeholder="למשל: גיוס לחודש אוקטובר"></div>'
    +'<p class="hint span2">אל תכתבו שמות של שחקנים. האתר אנונימי.</p>'
    +'<div class="span2"><button class="btn" type="submit"'+(saving?' disabled':'')+'>הוסף הכנסה</button></div></form></section>';
  h+='<section class="card"><h2>🛒 הוצאה חדשה</h2><form data-form="expense" class="grid2" novalidate>'
    +'<div class="field span2"><label class="lbl2" for="f-exp-name">שם ההוצאה</label><input id="f-exp-name" autocomplete="off" placeholder="למשל: כדורים, מגרש"></div>'
    +'<div class="field"><label class="lbl2" for="f-exp-amt">סכום (₪)</label><input id="f-exp-amt" inputmode="decimal" autocomplete="off" placeholder="למשל 280"></div>'
    +'<div class="field"><label class="lbl2" for="f-exp-date">תאריך</label><input id="f-exp-date" type="date" value="'+today()+'"></div>'
    +'<div class="field span2"><label class="lbl2" for="f-exp-cat">קטגוריה</label><select id="f-exp-cat">'+catOptions()+'</select></div>'
    +'<div class="field span2"><span class="lbl2">קבלה (לא חובה)</span><div class="rcpt">'
    +(pendingReceipt?'<img class="thumb" src="'+pendingReceipt+'" alt="תצוגה מקדימה של הקבלה"><button type="button" class="ghost danger" data-action="clear-pending">הסר</button>':'')
    +'<button type="button" class="ghost" data-action="pick-new">📄 '+(pendingReceipt?'החלף קובץ':'צרף תמונה או צלם')+'</button></div></div>'
    +'<div class="span2"><button class="btn" type="submit"'+(saving?' disabled':'')+'>שמור הוצאה</button></div></form></section>';
  var ex=state.expenses.slice().sort(byDate);
  h+='<section class="card"><h2>🧾 ניהול הוצאות<small>'+ex.length+'</small></h2>';
  if(!ex.length)h+='<div class="empty">אין הוצאות.</div>';
  else{
    h+='<ul class="mlist">';
    ex.forEach(function(e){
      var c=catOf(e.cat),k='exp:'+e.id;
      h+='<li class="mrow"><div><b>'+c.emoji+' '+esc(e.name)+'</b><small>'+esc(c.label)+' · '+fmtDate(e.date)+'</small></div><div class="am">'+ils(e.amount)+'</div><div class="macts">'
        +'<button class="ghost" data-action="attach" data-id="'+esc(e.id)+'">📄 '+(e.hasReceipt?'החלף קבלה':'הוסף קבלה')+'</button>'
        +(e.hasReceipt?'<button class="ghost" data-action="receipt" data-id="'+esc(e.id)+'">הצג</button>':'')
        +'<button class="ghost danger" data-action="del" data-kind="exp" data-id="'+esc(e.id)+'">'+(confirmId===k?'בטוח? מחק':'מחק')+'</button></div></li>';
    });
    h+='</ul>';
  }
  h+='</section>';
  var inl=state.incomes.slice().sort(byDate);
  h+='<section class="card"><h2>💰 ניהול הכנסות<small>'+inl.length+'</small></h2>';
  if(!inl.length)h+='<div class="empty">אין הכנסות.</div>';
  else{
    h+='<ul class="mlist">';
    inl.forEach(function(i){
      var k='inc:'+i.id;
      h+='<li class="mrow"><div><b>'+esc(i.note||'הפקדה לקופה')+'</b><small>'+fmtDate(i.date)+'</small></div><div class="am">'+ils(i.amount)+'</div><div class="macts"><button class="ghost danger" data-action="del" data-kind="inc" data-id="'+esc(i.id)+'">'+(confirmId===k?'בטוח? מחק':'מחק')+'</button></div></li>';
    });
    h+='</ul>';
  }
  h+='</section>';
  h+='<section class="card"><h2>🧹 התחלה מחדש</h2><p class="hint" style="margin-bottom:12px">מוחק את כל ההכנסות וההוצאות לכולם.</p><button class="ghost danger" data-action="reset">'+(confirmId==='reset'?'בטוח? מחק הכל':'אפס את הקופה')+'</button></section>';
  return h;
}
function loginScreen(){
  return '<section class="card"><h2>🔐 כניסת מנהל</h2><form data-form="login" class="login" novalidate><div class="field"><label class="lbl2" for="f-pw">סיסמה</label><input id="f-pw" type="password" autocomplete="current-password"></div><button class="btn" type="submit">כניסה</button><button type="button" class="ghost" data-action="hide-login">ביטול</button></form></section>';
}
function modalHtml(){
  if(!modal)return '';
  return '<div class="modal" role="presentation"><div class="modal-card" role="dialog" aria-modal="true" aria-label="קבלה"><div class="modal-head"><b>'+esc(modal.title)+'</b><button class="ghost" id="modal-close" data-action="close-modal">✕ סגור</button></div><div class="modal-body">'+(modal.src?'<img src="'+modal.src+'" alt="צילום הקבלה">':'<div class="empty">טוען קבלה...</div>')+'</div></div></div>';
}
function snap(){
  var o={};
  app.querySelectorAll('input[id],select[id]').forEach(function(el){o[el.id]=el.value});
  var ae=document.activeElement;o.__focus=ae&&ae.id&&app.contains(ae)?ae.id:null;
  return o;
}
function restore(o){
  Object.keys(o).forEach(function(k){if(k==='__focus')return;var el=document.getElementById(k);if(el)el.value=o[k]});
  if(o.__focus&&o.__focus!=='modal-close'){var f=document.getElementById(o.__focus);if(f)try{f.focus()}catch(e){}}
}
function render(){
  var s=snap();
  var body=showLogin&&!isAdmin?loginScreen():(isAdmin&&view==='admin'?adminScreen():viewerScreen());
  app.innerHTML='<div class="wrap">'+header()+body+'</div>'+modalHtml();
  restore(s);
  document.body.style.overflow=modal?'hidden':'';
  if(modal){var c=$('#modal-close');if(c)c.focus()}
  if(showLogin&&!isAdmin){var p=$('#f-pw');if(p&&!s.__focus)p.focus()}
}
var toastEl=document.createElement('div');
toastEl.className='toast';toastEl.hidden=true;toastEl.setAttribute('role','status');
document.body.appendChild(toastEl);
var toastT=null;
function toast(m){toastEl.textContent=m;toastEl.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){toastEl.hidden=true},3800)}

/* ---------- forms ---------- */
function addIncome(){
  var amt=parseAmt($('#f-inc-amt').value),date=$('#f-inc-date').value||today(),note=$('#f-inc-note').value.trim();
  if(!(amt>0)){toast('הזינו סכום גדול מאפס');return}
  $('#f-inc-amt').value='';$('#f-inc-note').value='';
  save(function(n){n.incomes.push({id:uid(),amount:amt,date:date,note:note})},{},'ההכנסה נשמרה.');
}
function addExpense(){
  var name=$('#f-exp-name').value.trim(),amt=parseAmt($('#f-exp-amt').value),cat=$('#f-exp-cat').value,date=$('#f-exp-date').value||today();
  if(!name){toast('כתבו שם להוצאה');return}
  if(!(amt>0)){toast('הזינו סכום גדול מאפס');return}
  var id=uid(),rc={};
  if(pendingReceipt)rc[id]=pendingReceipt;
  var had=!!pendingReceipt;
  pendingReceipt=null;$('#f-exp-name').value='';$('#f-exp-amt').value='';
  save(function(n){n.expenses.push({id:id,name:name,cat:cat,amount:amt,date:date,hasReceipt:had})},rc,'ההוצאה נשמרה.');
}

/* ---------- receipts ---------- */
var fileInput=document.createElement('input');
fileInput.type='file';fileInput.accept='image/*';fileInput.hidden=true;fileInput.setAttribute('aria-hidden','true');
document.body.appendChild(fileInput);
function compress(file){
  return new Promise(function(res,rej){
    var rd=new FileReader();
    rd.onerror=rej;
    rd.onload=function(){
      var img=new Image();
      img.onerror=rej;
      img.onload=function(){
        var tries=[[1400,0.72],[1100,0.62],[800,0.55]],out='';
        for(var i=0;i<tries.length;i++){
          var s=Math.min(1,tries[i][0]/Math.max(img.width,img.height));
          var w=Math.max(1,Math.round(img.width*s)),h=Math.max(1,Math.round(img.height*s));
          var c=document.createElement('canvas');c.width=w;c.height=h;
          var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);
          out=c.toDataURL('image/jpeg',tries[i][1]);
          if(out.length<900000)break;
        }
        res(out);
      };
      img.src=rd.result;
    };
    rd.readAsDataURL(file);
  });
}
fileInput.addEventListener('change',function(){
  var f=fileInput.files&&fileInput.files[0];fileInput.value='';
  if(!f)return;
  if(!/^image\//.test(f.type)){toast('אפשר לצרף רק תמונה (JPG או PNG)');return}
  compress(f).then(function(url){
    if(fileTarget==='new'){pendingReceipt=url;render()}
    else{
      var id=fileTarget,rc={};rc[id]=url;
      delete receiptCache[id];
      save(function(n){n.expenses.forEach(function(e){if(e.id===id)e.hasReceipt=true})},rc,'הקבלה נשמרה.');
    }
  }).catch(function(){toast('לא הצלחתי לקרוא את התמונה. נסו קובץ JPG או PNG.')});
});
function openReceipt(id){
  var ex=state.expenses.filter(function(x){return x.id===id})[0];
  if(!ex)return;
  var title=ex.name+' · '+ilsText(ex.amount);
  if(receiptCache[id]){modal={src:receiptCache[id],title:title};render();return}
  modal={src:'',title:title};render();
  api('receipt?id='+encodeURIComponent(id)).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
    receiptCache[id]=d.src;
    if(modal&&modal.title===title){modal.src=d.src;render()}
  }).catch(function(){modal=null;render();toast('לא הצלחנו לטעון את הקבלה.')});
}

/* ---------- events ---------- */
function closeModal(){modal=null;render()}
document.addEventListener('click',function(e){
  var t=e.target;
  if(modal&&t.classList&&t.classList.contains('modal')){closeModal();return}
  var el=t.closest?t.closest('[data-action]'):null;if(!el)return;
  var a=el.dataset.action,id=el.dataset.id;
  if(a==='view'){view=el.dataset.v;render();window.scrollTo(0,0)}
  else if(a==='receipt')openReceipt(id);
  else if(a==='close-modal')closeModal();
  else if(a==='pick-new'){fileTarget='new';fileInput.click()}
  else if(a==='attach'){fileTarget=id;fileInput.click()}
  else if(a==='clear-pending'){pendingReceipt=null;render()}
  else if(a==='reload'){loadError='';loadData()}
  else if(a==='show-login'){showLogin=true;render()}
  else if(a==='hide-login'){showLogin=false;render()}
  else if(a==='logout')logout();
  else if(a==='del'||a==='reset'){
    var key=a==='reset'?'reset':el.dataset.kind+':'+id;
    if(confirmId===key){
      confirmId=null;
      if(a==='reset')save(function(n){n.incomes=[];n.expenses=[]},{},'הקופה אופסה.');
      else if(el.dataset.kind==='exp')save(function(n){n.expenses=n.expenses.filter(function(x){return x.id!==id})},{},'ההוצאה נמחקה.');
      else save(function(n){n.incomes=n.incomes.filter(function(x){return x.id!==id})},{},'ההכנסה נמחקה.');
    }else{
      confirmId=key;render();
      clearTimeout(confirmT);confirmT=setTimeout(function(){confirmId=null;render()},4000);
    }
  }
});
document.addEventListener('submit',function(e){
  var f=e.target.closest?e.target.closest('form[data-form]'):null;if(!f)return;
  e.preventDefault();
  if(f.dataset.form==='income')addIncome();
  else if(f.dataset.form==='expense')addExpense();
  else if(f.dataset.form==='login'){var pw=$('#f-pw').value;if(pw)login(pw)}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&modal)closeModal()});
function canPoll(){return !document.hidden&&!modal&&!saving&&!(isAdmin&&view==='admin')&&!showLogin}
document.addEventListener('visibilitychange',function(){if(canPoll())loadData()});
setInterval(function(){if(canPoll())loadData()},60000);

/* ---------- boot ---------- */
render();
loadData();
if(password){
  api('login',{method:'POST',headers:{'x-admin-password':password}}).then(function(r){
    if(r.ok){isAdmin=true;render()}else{password='';ss.del('kupa-pw')}
  }).catch(function(){});
}
})();
