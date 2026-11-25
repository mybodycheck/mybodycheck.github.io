{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const dstr=d=>new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const today=()=>dstr(new Date());
const shift=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return dstr(d)};
const avg=(a,f)=>{const v=a.map(f).filter(x=>x!=null&&!Number.isNaN(x));return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
let toastT;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),2000)}

/* ---------- language (English / 日本語) ----------
   All text is written in English. When Japanese is on, every text node and placeholder/aria-label/alt
   is swapped for its Japanese version from JA (exact match) or PAT (sentences with numbers).
   The English original is kept, so switching back is instant. */
let LANG='en';try{LANG=localStorage.getItem('bc-lang')||((navigator.language||'').toLowerCase().startsWith('ja')?'ja':'en')}catch(e){}
const LOC=()=>LANG==='ja'?'ja-JP':'en-GB';
const JA=window.BC_JA||{};
const VJ={better:'よくなった',same:'変わらない',worse:'悪くなった','itchy or red':'かゆい・赤い',today:'今日',yesterday:'昨日'};
const PAT=[
 [/^(Good morning|Good afternoon|Good evening)(?:, (.+))?$/,m=>({'Good morning':'おはようございます','Good afternoon':'こんにちは','Good evening':'こんばんは'}[m[1]])+(m[2]?`、${m[2]}さん`:'')],
 [/^(\d+) of (\d+) · (.+) L$/,m=>`${m[1]}/${m[2]}杯 · ${m[3]} L`],[/^(\d+) more by (\d+):00$/,m=>`${m[2]}:00までにあと${m[1]}杯`],[/^Next after (\d+):00$/,m=>`次は${m[1]}:00以降`],
 [/^Drink (\d+) glass(?:es)? of water$/,m=>`水を${m[1]}杯飲みましょう`],[/^before (\d+):00$/,m=>`${m[1]}:00までに`],[/^(\d+) steps? left$/,m=>`残り${m[1]}ステップ`],[/^(\d+) glasses left today$/,m=>`今日はあと${m[1]}杯`],
 [/^avg ([\d.]+)h$/,m=>`平均${m[1]}時間`],[/^([\d.]+)h$/,m=>`${m[1]}時間`],[/^Glass (\d+)$/,m=>`${m[1]}杯目`],[/^Face photo (.+)$/,m=>`顔写真 ${m[1]}`],
 [/^Your skin type · from (.+)$/,m=>`あなたの肌タイプ（${tr(m[1])}の記録より）`],[/^\(before ([\d.]+)\)$/,m=>`（先週 ${m[1]}）`],[/^updated (.+)$/,m=>`更新 ${m[1]}`],[/^until (.+)$/,m=>`${m[1]}まで`],
 [/^Added (.+?)(?: · (.+))?$/,m=>`追加：${VJ[m[1]]||m[1]}`+(m[2]?' · '+m[2].replace(/(better|same|worse|itchy or red) (\d+)/g,(_,w,n)=>VJ[w]+' '+n).replace(/, /g,'、'):'')]
];
function tr(s){if(LANG!=='ja'||s==null)return s;const k=String(s).trim();if(!k)return s;let j=JA[k];if(j==null)for(const [re,f] of PAT){const m=k.match(re);if(m){j=f(m);break}}return j==null?s:String(s).replace(k,j)}
const T=tr;
const ORIG=new WeakMap(),ATTRS=['placeholder','aria-label','alt','title'];
function trNode(n){if(n.nodeType===3){const p=n.parentNode;if(!p||/^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)||(p.closest&&p.closest('[data-notr]')))return;let o=ORIG.get(n);if(o==null){o=n.data;ORIG.set(n,o)}const v=tr(o);if(n.data!==v)n.data=v;return}
 if(n.nodeType!==1||/^(SCRIPT|STYLE)$/.test(n.nodeName)||n.hasAttribute('data-notr'))return;
 for(const a of ATTRS){if(n.hasAttribute(a)){const k='bcEn'+a.replace(/-/g,'');if(n.dataset[k]==null)n.dataset[k]=n.getAttribute(a);const v=tr(n.dataset[k]);if(n.getAttribute(a)!==v)n.setAttribute(a,v)}}
 n.childNodes.forEach(trNode)}
function trAll(){trNode(document.body);document.documentElement.lang=LANG;$$('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lang===LANG))}
new MutationObserver(ms=>{if(LANG!=='ja')return;ms.forEach(m=>m.addedNodes.forEach(trNode))}).observe(document.body,{childList:true,subtree:true});

/* ---------- state ---------- */
let profile={},products={},entries={},checks={},photos={};
let auth=null,db=null,uid=null,user=null,unsub=null,first=false,guest=false,triedAnon=false;
try{guest=localStorage.getItem('bc-guest')==='1';profile=JSON.parse(localStorage.getItem('bc-profile')||'{}');products=JSON.parse(localStorage.getItem('bc-products')||'{}');entries=JSON.parse(localStorage.getItem('bc-entries')||'{}');checks=JSON.parse(localStorage.getItem('bc-checks')||'{}');photos=JSON.parse(localStorage.getItem('bc-photos')||'{}')}catch(e){}
function localSave(){try{localStorage.setItem('bc-profile',JSON.stringify(profile));localStorage.setItem('bc-products',JSON.stringify(products));localStorage.setItem('bc-entries',JSON.stringify(entries));localStorage.setItem('bc-checks',JSON.stringify(checks));const pp={};Object.keys(photos).sort().slice(-30).forEach(k=>pp[k]=photos[k]);localStorage.setItem('bc-photos',JSON.stringify(pp))}catch(e){}}
const store=()=>db&&uid?db.collection('data/users/'+uid):null;
async function put(id,obj){const c=store();if(!c)return;try{await c.doc(id).set(obj)}catch(e){toast('Saved on this phone. Will sync later.')}}
async function saveEntry(d,patch){entries[d]={date:d,...(entries[d]||{}),...patch};localSave();renderAll();await put('e-'+d,entries[d])}
const sorted=()=>Object.values(entries).sort((a,b)=>a.date<b.date?-1:1);


/* ---------- motion helpers ---------- */
let popDrop=-1,lastScore=-1;
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(el,to){const t0=performance.now(),d=800;const step=t=>{const k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3);el.textContent=Math.round(to*e);if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)}
function burst(anchor){if(calm()||!anchor||anchor.offsetParent===null)return;const r=anchor.getBoundingClientRect(),b=document.createElement('div');b.className='burst';b.style.left=(r.left+r.width/2)+'px';b.style.top=(r.top+r.height/2)+'px';
 const cols=['#2A86AE','#D0668A','#3E8B5C','#3D55A3','#E0A23A','#A23D63'];for(let i=0;i<18;i++){const a=i/18*Math.PI*2,dist=60+Math.random()*50,s=document.createElement('i');s.style.background=cols[i%cols.length];s.style.setProperty('--dx',Math.cos(a)*dist+'px');s.style.setProperty('--dy',Math.sin(a)*dist+'px');s.style.animationDelay=(Math.random()*.08)+'s';b.appendChild(s)}
 document.body.appendChild(b);setTimeout(()=>b.remove(),1100)}

/* ---------- screens ---------- */
function chrome(on){$('.tabbar').hidden=!on;$('#top').hidden=!on;$('.side').hidden=!on}
function screen(name){chrome(true);$('#boot').hidden=name!=='boot';$('#auth').hidden=name!=='auth';$('#app').hidden=name!=='app'}
let view='today';
let ringAnim=true;
function go(v){const changed=view!==v||!$('[data-view='+v+']').classList.contains('enter');view=v;$$('main .view').forEach(s=>{s.hidden=s.dataset.view!==v;if(s.dataset.view===v&&changed){s.classList.remove('enter');void s.offsetWidth;s.classList.add('enter')}});
 if(v==='today'&&changed){ringAnim=true;renderToday()}
 $$('.tabbar button,#sidenav button').forEach(b=>b.dataset.tab===v?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
 window.scrollTo(0,0);if(v==='log')fillLog();if(v==='admin')loadAdmin();drawCharts()}
$('#sidenav').innerHTML=$('.tabbar').innerHTML;
[$('.tabbar'),$('#sidenav')].forEach(n=>n.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)go(b.dataset.tab)}));
$('#sideMe').addEventListener('click',()=>go('me'));
$('#avatarBtn').addEventListener('click',()=>go('me'));
let backTo='me';
document.addEventListener('click',e=>{const p=e.target.closest('[data-go=privacy]');if(p){if(!$('#auth').hidden){backTo='auth';screen('app');chrome(false)}else backTo=view;go('privacy');return}
 if(e.target.closest('[data-back]')){if(backTo==='auth'&&!user&&!guest){screen('auth')}else go(view==='admin'?'me':backTo)}});
addEventListener('scroll',()=>$('#top').classList.toggle('scrolled',scrollY>4),{passive:true});

/* ---------- chips & scales ---------- */
/* a chip item is 'Value' or ['Value','Label shown']; the saved value is always the English value */
function chips(id,items,single){const el=$('#'+id);el.innerHTML=items.map(t=>{const [v,l]=Array.isArray(t)?t:[t,t];return`<button type="button" class="chip" data-val="${esc(v)}" aria-pressed="false">${esc(l)}</button>`}).join('');
 el.addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;const on=b.getAttribute('aria-pressed')!=='true';if(single)el.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed',on);el.dispatchEvent(new Event('change'))})}
const picked=id=>$$('#'+id+' .chip[aria-pressed=true]').map(b=>b.dataset.val);
const setPicked=(id,v)=>$$('#'+id+' .chip').forEach(b=>b.setAttribute('aria-pressed',(v||[]).includes(b.dataset.val)));
function scale(id,opts){const el=$('#'+id);el.innerHTML=opts.map(([v,n,l])=>`<button type="button" data-v="${v}" aria-pressed="false"><b>${n}</b>${l}</button>`).join('');
 el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const on=b.getAttribute('aria-pressed')!=='true';el.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed',on)})}
const scaleVal=id=>{const b=$('#'+id+' button[aria-pressed=true]');return b?+b.dataset.v:null};
const setScale=(id,v)=>$$('#'+id+' button').forEach(b=>b.setAttribute('aria-pressed',v!=null&&+b.dataset.v===v));
scale('acne',[[0,0,'Clear'],[1,1,'Few'],[2,2,'Some'],[3,3,'Many'],[4,4,'Lots'],[5,5,'Severe']]);
scale('back',[[0,0,'None'],[2,2,'Mild'],[4,4,'Medium'],[6,6,'Strong'],[8,8,'Severe'],[10,10,'Worst']]);
scale('energy',[[1,1,'Drained'],[2,2,'Tired'],[3,3,'OK'],[4,4,'Good'],[5,5,'Great']]);
chips('areas',['Cheeks','Jaw','Chin','Forehead','Nose']);chips('hair',[['Low','Little'],'Normal','High','Very high'],1);chips('teeth',['Fine','Sensitive','Gums bleed','Tooth pain']);
chips('lips',['Fine','Dry','Cracked','Bleeding'],1);chips('period',['On my period']);chips('poop',['None','Hard','Normal','Loose'],1);chips('bloat',[['No','Not at all'],'A little','A lot'],1);chips('ferm',['Curd (dahi)','Idli or dosa','Natto','Miso','Yogurt','Kimchi','Tsukemono']);
const DIETS=['Vegetarian','Eggetarian','Non-veg','Jain'],CONCERNS=['Acne','Dry skin','Hair fall','Chapped lips','Back pain','Body ache','Teeth','Tummy','Tiredness'],WAKES=['5:30','6:00','6:30','7:00','7:30','8:00'];
chips('feed',['Yes','No'],1);chips('diet',DIETS,1);chips('concerns',CONCERNS);chips('wake',WAKES,1);chips('slept',['Under 5h','5–6h','6–7h','7–8h','8h+'],1);
chips('obDiet',DIETS,1);chips('obConcerns',CONCERNS);chips('obWake',WAKES,1);chips('obFeed',['Yes','No'],1);chips('gpPlan',['Free','Gold','Platinum','Diamond'],1);setPicked('gpPlan',['Gold']);
$$('.stepper[data-k]').forEach(s=>s.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const o=s.querySelector('output');o.value=o.textContent=Math.max(0,Math.min(15,(+o.textContent||0)+ +b.dataset.d))}));

/* ---------- plan logic ---------- */
const SL={'Under 5h':4.5,'5–6h':5.5,'6–7h':6.5,'7–8h':7.5,'8h+':8.5};
const hm=m=>{m=(m%1440+1440)%1440;return Math.floor(m/60)+':'+String(m%60).padStart(2,'0')};
const glasses=()=>Math.round(Math.min(3500,Math.max(1500,(profile.weight||55)*33+(profile.feed?700:0)))/250);
const SLOTS=[[0,9],[9,12],[12,15],[15,18],[18,21]];
function waterPlan(){const G=glasses(),per=SLOTS.map((_,i)=>Math.floor(G/5)+(i<G%5?1:0)),h=new Date().getHours(),cur=SLOTS.findIndex(s=>h>=s[0]&&h<s[1]);let by=0;per.forEach((n,i)=>{if(i<=cur)by+=n});return{G,cur,by,end:cur>=0?SLOTS[cur][1]:null}}
function skinType(e){if(!e)return null;const m=e.moist,o=e.oil,to=e.toil;if(m==null&&o==null&&to==null)return null;
 const cO=o!=null&&o>30,tO=to!=null&&to>30,cD=m!=null&&m<35;
 if(tO&&!cO)return['Combination','Oily forehead and nose, normal or dry cheeks. Light gel on the T-zone, richer cream on the cheeks.'];
 if(cO&&cD)return['Dehydrated oily','Makes oil but lacks water. Light oil-free moisturiser, gentle cleanser, no harsh scrubs.'];
 if(cO)return['Oily','Gentle foaming cleanser and light gel moisturiser. Oily skin gets acne more easily.'];
 if(cD)return['Dry','Creamy cleanser and a richer moisturiser. Avoid very hot water.'];
 return['Normal','Balanced skin. Keep it simple: gentle wash, moisturiser, sunscreen.']}
const skinName=t=>t?t+' skin':'';
const lastSkin=()=>sorted().reverse().find(e=>e.moist!=null||e.oil!=null||e.toil!=null);
function routine(){const st=skinType(lastSkin()),t=st?st[0]:null,L=sorted().reverse()[0],acne=(L&&L.acne>=2)||(profile.concerns||[]).includes('Acne');
 const clean={Dry:'Lukewarm water or a mild cream cleanser',Oily:'Gentle foaming cleanser, no scrub',Combination:'Gentle foaming cleanser, mainly forehead and nose','Dehydrated oily':'Gentle low-foam cleanser'}[t]||'Gentle cleanser';
 const moist={Dry:'Rich cream with ceramides',Oily:'Light oil-free gel moisturiser',Combination:'Gel on T-zone, cream on cheeks','Dehydrated oily':'Hydrating gel with hyaluronic acid'}[t]||'Light moisturiser';
 const am=[clean,moist,'Sunscreen SPF 30+, even when cloudy'],pm=['Wash off sunscreen and makeup'];
 if(acne)pm.push('Acne care: salicylic or azelaic acid, 2–3 nights a week'+(profile.feed?' (ask your doctor first while breastfeeding)':''));
 pm.push(moist,'Clean pillowcase twice a week');
 if((profile.concerns||[]).includes('Chapped lips')){am.push('Lip balm, fragrance-free');pm.push('Lip balm, fragrance-free')}
 return{am,pm,type:t,acne}}
function computeScore(){const t=entries[today()]||{},w=waterPlan(),r=routine();
 const water=Math.min(1,(t.water||0)/w.G),log=t.acne!=null||t.back!=null||t.poop?1:0;
 const sk=((t.am||[]).length/r.am.length+(t.pm||[]).length/r.pm.length)/2,sleep=t.sleep!=null?Math.min(1,t.sleep/7.5):0;
 return{parts:[['Water',water,'var(--water)',`${t.water||0}/${w.G}`,'c-water'],['Check-in',log,'var(--body)',log?'Done':'Not yet','log'],['Skincare',sk,'var(--skin)',`${(t.am||[]).length+(t.pm||[]).length}/${r.am.length+r.pm.length}`,'c-skin'],['Sleep',sleep,'var(--sleep)',t.sleep!=null?t.sleep+'h':'Not yet','c-sleep']],score:Math.round((water*.35+log*.25+sk*.2+sleep*.2)*100)}}

/* ---------- render: Today ---------- */
function arc(cx,cy,r,a0,a1){const p=a=>[cx+r*Math.cos((a-90)*Math.PI/180),cy+r*Math.sin((a-90)*Math.PI/180)],[x0,y0]=p(a0),[x1,y1]=p(a1);return`M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1-a0>180?1:0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`}
function renderToday(){const now=new Date(),h=now.getHours();
 const nm=(user&&user.displayName||profile.name||'').split(' ')[0];
 $('#hiName').textContent=(h<12?'Good morning':h<18?'Good afternoon':'Good evening')+(nm?', '+nm:'');
 $('#hiDate').textContent=now.toLocaleDateString(LOC(),{weekday:'long',day:'numeric',month:'long'});
 const ini=((nm||(user&&user.email)||'')[0]||'').toUpperCase(),icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.3-3.6 4.2-5.2 7.5-5.2s6.2 1.6 7.5 5.2"/></svg>';
 ['#avatarBtn','#meAv','#sideAv'].forEach(q=>$(q).innerHTML=ini?esc(ini):icon);
 $('#sideName').textContent=(user&&user.displayName)||profile.name||(guest?'Guest':'You');$('#sideEmail').textContent=user&&user.email?user.email:guest?'Saved on this phone':'';
 const {parts,score}=computeScore();$('#score').textContent=score;
 let g='';parts.forEach(([,v,c],i)=>{const a0=i*90+4,a1=i*90+86;g+=`<path d="${arc(75,75,62,a0,a1)}" fill="none" stroke="#F0DCE4" stroke-width="13" stroke-linecap="round"/>`;if(v>0.02)g+=`<path class="arcfill" pathLength="1" d="${arc(75,75,62,a0,a0+(a1-a0)*Math.min(1,v))}" fill="none" stroke="${c}" stroke-width="13" stroke-linecap="round"/>`;else g+='<g></g>'});
 $('#ring').innerHTML=g;const rg=$('#ring');rg.classList.toggle('anim',ringAnim);
 if(ringAnim&&!matchMedia('(prefers-reduced-motion: reduce)').matches){countUp($('#score'),score)}ringAnim=false;
 if(score>=100&&lastScore<100&&lastScore>=0)burst($('#ring'));lastScore=score;
 $('#legend').innerHTML=parts.map(([n,,c,val,to])=>`<button type="button" data-to="${to}"><span class="dot" style="background:${c}"></span>${n}<em>${val}</em></button>`).join('');
 /* up next */
 const t=entries[today()]||{},w=waterPlan(),done=t.water||0,need=Math.max(0,w.by-done),r=routine();let nx;
 if(need>0&&w.cur>=0)nx=[`Drink ${need} glass${need>1?'es':''} of water`,`before ${w.end}:00`,'+ Glass','water'];
 else if(!(t.acne!=null||t.back!=null||t.poop))nx=['Log how you feel today','takes 1 minute','Open log','log'];
 else if(h>=19&&(t.pm||[]).length<r.pm.length)nx=['Night skincare',`${r.pm.length-(t.pm||[]).length} steps left`,'Show','pm'];
 else if(h<12&&(t.am||[]).length<r.am.length)nx=['Morning skincare',`${r.am.length-(t.am||[]).length} steps left`,'Show','am'];
 else if(done<w.G)nx=['You are on track',`${w.G-done} glasses left today`,'+ Glass','water'];
 else nx=['All done for now','Great care today. Rest well.',null,null];
 $('#next').innerHTML=`<p>${nx[0]}<small>${nx[1]}</small></p>${nx[2]?`<button type="button" data-act="${nx[3]}">${nx[2]}</button>`:''}`;
 /* water */
 $('#drops').innerHTML=Array.from({length:w.G},(_,i)=>`<button type="button" class="drop${i===popDrop?' pop':''}" data-i="${i}" aria-pressed="${i<done}" aria-label="Glass ${i+1}"><svg viewBox="0 0 34 40"><path d="M17 3c6 7.5 12 14 12 21a12 12 0 0 1-24 0c0-7 6-13.5 12-21z"/></svg></button>`).join('');
 $('#wText').textContent=`${done} of ${w.G} · ${parseFloat((done*.25).toFixed(2))} / ${parseFloat((w.G*.25).toFixed(2))} L`;
 $('#wNext').textContent=done>=w.G?'Goal reached':w.cur<0?(h<9?'Start with 2 glasses':'Small sips now'):need?`${need} more by ${w.end}:00`:`Next after ${w.end}:00`;
 /* skincare */
 const pm=$('#pmBtn').getAttribute('aria-pressed')==='true',list=pm?r.pm:r.am,doneS=pm?(t.pm||[]):(t.am||[]);
 $('#sType').textContent=skinName(r.type);
 $('#steps').innerHTML=list.map((s,i)=>`<label><input type="checkbox" data-i="${i}" ${doneS.includes(i)?'checked':''}><span>${esc(s)}</span></label>`).join('');
 /* sleep */
 const wk=(profile.wake||'6:30').split(':').map(Number),wm=wk[0]*60+wk[1];$('#slWind').textContent=hm(wm-510);$('#slBed').textContent=hm(wm-480);$('#slWake').textContent=hm(wm);
 const inv=Object.entries(SL).find(([,v])=>v===t.sleep);setPicked('slept',inv?[inv[0]]:[]);
 const sa=avg(sorted().slice(-7),e=>e.sleep);$('#slAvg').textContent=sa==null?'':`avg ${sa.toFixed(1)}h`;
 /* tips */
 const c=profile.concerns||[],L=sorted().slice(-7),veg=profile.diet==='Vegetarian'||profile.diet==='Jain',egg=profile.diet==='Eggetarian';
 const tips=[['var(--gut)','Fermented food','One today: curd (dahi), natto, miso soup or plain yogurt.'],['var(--gut)','Fibre','Five servings of vegetables and fruit. Dal, seaweed and mushrooms count.'],['var(--body)','Move','A 15-minute walk after lunch helps digestion and your back.']];
 if(c.includes('Back pain')||(avg(L,e=>e.back)||0)>=3)tips.unshift(['var(--body)','Back care','Lift with bent knees and a straight back. A physio can give exercises made for you.']);
 const last=sorted().reverse()[0];if(last&&(last.poop==='Hard'||last.poop==='None'))tips.unshift(['var(--gut)','Toilet','Two extra glasses of water and a kiwi or prunes today.']);
 if(c.includes('Chapped lips'))tips.unshift(['var(--skin)','Lips','Fragrance-free lip balm, try not to lick your lips, and use a humidifier in winter.']);
 if(c.includes('Body ache'))tips.push(['var(--body)','Body ache','Gentle stretches and short walks often help. If pain is strong or lasts weeks, see a doctor.']);
 if(c.includes('Teeth'))tips.push(['var(--body)','Teeth',veg||egg?'Calcium foods: paneer, curd, tofu, sesame, komatsuna.':'Calcium foods: tofu, small fish, yogurt, komatsuna.']);
 if(c.includes('Hair fall'))tips.push(['var(--body)','Hair',veg?'Protein at every meal: dal, paneer, tofu. Iron: spinach, hijiki.':egg?'Protein at every meal: eggs, dal, paneer, tofu. Iron: spinach, hijiki.':'Protein at every meal: eggs, fish, tofu. Iron: spinach, hijiki.']);
 if(c.includes('Tiredness'))tips.push(['var(--body)','Energy','A blood test for iron, B12 and vitamin D can show why you feel tired.']);
 tips.push(['var(--sleep)','Sleep','Phone away 30 minutes before bed.']);
 $('#tips').innerHTML=tips.map(([col,a,b])=>`<div class="tip"><b><span class="dot" style="background:${col}"></span>${a}</b><p>${b}</p></div>`).join('')}
$('#legend').addEventListener('click',e=>{const b=e.target.closest('[data-to]');if(!b)return;const t=b.dataset.to;if(t==='log')go('log');else $('#'+t).scrollIntoView({behavior:'smooth',block:'center'})});
$('#next').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
 if(a==='water')addWater(1);else if(a==='log')go('log');else{$('#'+(a==='pm'?'pmBtn':'amBtn')).click();$('#c-skin').scrollIntoView({behavior:'smooth',block:'center'})}});
function addWater(n){const v=Math.max(0,Math.min(glasses(),((entries[today()]||{}).water||0)+n));popDrop=n>0?v-1:-1;saveEntry(today(),{water:v});popDrop=-1;if(n>0){toast(v>=glasses()?'Water goal reached':'Glass added');if(v>=glasses())burst($('#drops'))}}
$('#wPlus').addEventListener('click',()=>addWater(1));$('#wMinus').addEventListener('click',()=>addWater(-1));
$('#drops').addEventListener('click',e=>{const b=e.target.closest('.drop');if(!b)return;const i=+b.dataset.i,d=(entries[today()]||{}).water||0,nv=d===i+1?i:i+1;popDrop=nv>d?i:-1;saveEntry(today(),{water:nv});popDrop=-1;if(nv>=glasses()&&d<glasses())burst($('#drops'))});
$('#amBtn').addEventListener('click',()=>{$('#amBtn').setAttribute('aria-pressed','true');$('#pmBtn').setAttribute('aria-pressed','false');renderToday()});
$('#pmBtn').addEventListener('click',()=>{$('#pmBtn').setAttribute('aria-pressed','true');$('#amBtn').setAttribute('aria-pressed','false');renderToday()});
if(new Date().getHours()>=15){$('#pmBtn').setAttribute('aria-pressed','true');$('#amBtn').setAttribute('aria-pressed','false')}
$('#steps').addEventListener('change',e=>{const i=+e.target.dataset.i,k=$('#pmBtn').getAttribute('aria-pressed')==='true'?'pm':'am',cur=new Set((entries[today()]||{})[k]||[]);e.target.checked?cur.add(i):cur.delete(i);saveEntry(today(),{[k]:[...cur].sort()});const r=routine();if(e.target.checked&&cur.size>=r[k].length)burst($('#c-skin .head'))});
$('#slept').addEventListener('change',()=>{const p=picked('slept')[0];saveEntry(today(),{sleep:p?SL[p]:null});if(p)toast('Sleep saved')});

/* ---------- Log ---------- */
let logDate=today(),logPhoto=null;
function dayLabel(d){return d===today()?'Today':d===shift(today(),-1)?'Yesterday':new Date(d+'T12:00:00').toLocaleDateString(LOC(),{weekday:'short',day:'numeric',month:'short'})}
function fillLog(){const e=entries[logDate]||{};$('#dLabel').textContent=dayLabel(logDate);$('#dNext').disabled=logDate>=today();
 setScale('acne',e.acne);setScale('back',e.back);setScale('energy',e.energy);setPicked('areas',e.areas);setPicked('hair',e.hair?[e.hair]:[]);setPicked('lips',e.lips?[e.lips]:[]);setPicked('teeth',e.teeth);setPicked('period',e.period?['On my period']:[]);
 setPicked('poop',e.poop?[e.poop]:[]);setPicked('bloat',e.bloat?[e.bloat]:[]);setPicked('ferm',e.ferm);
 $$('.stepper[data-k]').forEach(s=>{const o=s.querySelector('output');o.textContent=e[s.dataset.k]??0});
 ['moist','oil','tmoist','toil'].forEach(k=>$('#'+k).value=e[k]??'');$('#note').value=e.notes||'';
 logPhoto=photos[logDate]||null;$('#phImg').hidden=!logPhoto;if(logPhoto)$('#phImg').src=logPhoto}
$('#dPrev').addEventListener('click',()=>{logDate=shift(logDate,-1);fillLog()});
$('#dNext').addEventListener('click',()=>{if(logDate<today()){logDate=shift(logDate,1);fillLog()}});
function shrink(file,max,q){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);res(c.toDataURL('image/jpeg',q))};img.onerror=rej;img.src=URL.createObjectURL(file)})}
$('#phIn').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{logPhoto=await shrink(f,360,.65);$('#phImg').src=logPhoto;$('#phImg').hidden=false}catch(x){toast('Could not use this photo')}});
const num=v=>v===''?null:Number(v);
$('#saveLog').addEventListener('click',async()=>{const p={acne:scaleVal('acne'),back:scaleVal('back'),energy:scaleVal('energy'),areas:picked('areas'),hair:picked('hair')[0]||null,lips:picked('lips')[0]||null,teeth:picked('teeth'),period:picked('period').length>0,
 poop:picked('poop')[0]||null,bloat:picked('bloat')[0]||null,ferm:picked('ferm'),notes:$('#note').value.trim()};
 $$('.stepper[data-k]').forEach(s=>p[s.dataset.k]=+s.querySelector('output').textContent);['moist','oil','tmoist','toil'].forEach(k=>p[k]=num($('#'+k).value));
 if(logPhoto&&logPhoto!==photos[logDate]){photos[logDate]=logPhoto;put('p-'+logDate,{date:logDate,img:logPhoto})}
 await saveEntry(logDate,p);toast('Log saved');if(logDate===today())go('today')});

/* ---------- Skin ---------- */
const VERD=['Better','Same','Worse','Itchy or red'];let prodImg=null;
function renderSkin(){const ls=lastSkin(),st=skinType(ls);$('#skType').textContent=st?skinName(st[0]):'Not measured yet';
 $('#skTip').textContent=st?st[1]:'Add skin meter numbers in Log to find your skin type.';$('#skFrom').textContent=ls?'Your skin type · from '+dayLabel(ls.date):'Your skin type';
 const ph=Object.keys(photos).sort().reverse();$('#photos').innerHTML=ph.length?ph.map(d=>`<figure><img src="${photos[d]}" alt="Face photo ${d}"><figcaption>${d.slice(5).replace('-','/')}</figcaption></figure>`).join(''):'<p class="sub" style="grid-column:1/-1">Add a face photo in Log to start your diary.</p>';
 const l=Object.values(products).sort((a,b)=>a.added<b.added?1:-1);
 $('#prodList').innerHTML=l.map(p=>{const rs=p.reactions||[],td=rs.find(r=>r.date===today()),bad=rs.some(r=>r.r==='Itchy or red')||rs.filter(r=>r.r==='Worse').length>=2,cnt=VERD.map(r=>[r,rs.filter(x=>x.r===r).length]).filter(x=>x[1]);
  return`<div class="prod">${p.img?`<img src="${p.img}" alt="">`:'<span class="ph"></span>'}<div><div class="spread"><b data-notr>${esc(p.name)}</b><button class="link" type="button" data-pd="${p.id}" style="font-size:13px;color:var(--muted)">Remove</button></div>
  <p class="sub">Added ${dayLabel(p.added).toLowerCase()}${cnt.length?' · '+cnt.map(([r,n])=>r.toLowerCase()+' '+n).join(', '):''}</p>
  <div class="react" style="--c:var(--skin)">${VERD.map(r=>`<button type="button" class="chip" data-p="${p.id}" data-r="${r}" aria-pressed="${!!(td&&td.r===r)}">${r}</button>`).join('')}</div>
  ${bad?'<p class="warn">Your skin reacted badly. Stop using it for now. If redness lasts over 2 days, see a dermatologist (皮膚科).</p>':''}</div></div>`}).join('')}
async function saveProd(p){products[p.id]=p;localSave();renderSkin();await put(p.id,p)}
$('#pPhoto').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{prodImg=await shrink(f,200,.6);toast('Photo added')}catch(x){toast('Could not use this photo')}});
$('#pAdd').addEventListener('click',async()=>{const n=$('#pName').value.trim();if(!n){$('#pName').focus();toast('Type the product name');return}
 await saveProd({id:'prod-'+Date.now().toString(36),name:n.slice(0,80),img:prodImg,added:today(),reactions:[]});$('#pName').value='';prodImg=null;toast('Product added. Patch test for 2 days first.')});
$('#pForm').addEventListener('submit',e=>{e.preventDefault();$('#pAdd').click()});
$('#prodList').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.pd){if(!b.dataset.sure){b.dataset.sure='1';b.textContent='Sure?';return}const id=b.dataset.pd;delete products[id];localSave();renderSkin();const c=store();if(c)c.doc(id).delete().catch(()=>{});return}
 if(!b.dataset.p)return;const p={...products[b.dataset.p]};p.reactions=(p.reactions||[]).filter(r=>r.date!==today());if(b.getAttribute('aria-pressed')!=='true')p.reactions.push({date:today(),r:b.dataset.r});saveProd(p)});

/* ---------- Insights ---------- */
function renderInsights(){const a=sorted(),out=[];
 if(a.length<3)out.push(['var(--muted)','Log for 3 days and patterns will show here.']);
 else{const r=a.slice(-7),p=a.slice(-14,-7),b1=avg(r,e=>e.back),b0=avg(p,e=>e.back);
  if(b1!=null)out.push(['var(--body)',`Back pain this week: <b>${b1.toFixed(1)}/10</b>`+(b0!=null?` (before ${b0.toFixed(1)})`:'')]);
  const on=a.filter(e=>e.period),off=a.filter(e=>!e.period),x=avg(on,e=>e.acne),y=avg(off,e=>e.acne);if(x!=null&&y!=null){out.push(['var(--skin)',`Acne on period days <b>${x.toFixed(1)}</b>, other days <b>${y.toFixed(1)}</b>.`+(x-y>=1?' It may follow your cycle. Tell the dermatologist.':'')])}
  const bad=a.filter(e=>e.poop==='Hard'||e.poop==='None'||e.bloat==='A lot'),good=a.filter(e=>e.poop==='Normal'&&e.bloat!=='A lot'),gx=avg(bad,e=>e.acne),gy=avg(good,e=>e.acne);if(gx!=null&&gy!=null)out.push(['var(--gut)',`Acne on hard gut days <b>${gx.toFixed(1)}</b>, good gut days <b>${gy.toFixed(1)}</b>.`+(gx-gy>=1?' Your skin may react to your gut.':'')]);
  const s1=avg(a.filter(e=>e.sleep!=null&&e.sleep<6),e=>e.back),s2=avg(a.filter(e=>e.sleep>=6),e=>e.back);if(s1!=null&&s2!=null&&s1-s2>=1)out.push(['var(--sleep)',`Back pain is higher after short sleep: <b>${s1.toFixed(1)}</b> vs <b>${s2.toFixed(1)}</b>.`]);
  if(a.filter(e=>e.energy!=null&&e.energy<=2).length>=Math.ceil(a.length/2))out.push(['var(--body)','Low energy on many days. A blood test for iron, B12, vitamin D and thyroid can help.'])}
 $('#pats').innerHTML=out.map(([c,t])=>`<div class="pat"><span class="dot" style="background:${c}"></span><p>${t}</p></div>`).join('');
 const w=a.slice(-7),vg=avg(w,e=>e.veg);
 $('#gutTiles').innerHTML=`<div class="tile"><b>${w.filter(e=>e.poop==='Normal').length}/${w.length}</b><span>normal toilet</span></div><div class="tile"><b>${w.filter(e=>(e.ferm||[]).length).length}/${w.length}</b><span>fermented food</span></div><div class="tile"><b>${vg==null?'–':vg.toFixed(1)}</b><span>veg a day</span></div>`;
 const ja=LANG==='ja',W=ja?{back:'腰痛 ',acne:'ニキビ ',gl:'杯',sl:'時間睡眠',toilet:'お通じ ',lips:'唇 ',sep:'、',none:'記録なし'}:{back:'back ',acne:'acne ',gl:' glasses',sl:'h sleep',toilet:'toilet ',lips:'lips ',sep:', ',none:'water only'};
 $('#hist').innerHTML=a.slice(-14).reverse().map(e=>`<div><b>${dayLabel(e.date)}</b><br><span class="sub" data-notr>${[e.back!=null&&W.back+e.back,e.acne!=null&&W.acne+e.acne,e.water!=null&&e.water+W.gl,e.sleep!=null&&e.sleep+W.sl,e.poop&&W.toilet+(ja?T(e.poop):e.poop.toLowerCase()),e.lips&&e.lips!=='Fine'&&W.lips+(ja?T(e.lips):e.lips.toLowerCase())].filter(Boolean).join(W.sep)||W.none}</span>${e.notes?`<br><span class="sub" data-notr>${esc(e.notes)}</span>`:''}</div>`).join('')||'<p class="sub">No days logged yet.</p>'}
$('#copyAll').addEventListener('click',async()=>{const t=sorted().map(e=>`${e.date}: back ${e.back??'-'}/10, acne ${e.acne??'-'}/5 ${(e.areas||[]).join('/')}, water ${e.water??0}, sleep ${e.sleep??'-'}h, toilet ${e.poop||'-'}, bloating ${e.bloat||'-'}, energy ${e.energy??'-'}/5, hair ${e.hair||'-'}, lips ${e.lips||'-'}, teeth ${(e.teeth||[]).join('/')||'-'}${e.period?', period':''}${e.notes?', note: '+e.notes:''}`).join('\n');
 try{await navigator.clipboard.writeText(t||'No data yet');toast('Copied')}catch(x){toast('Copy is not allowed here')}});

/* ---------- charts ---------- */
function chart(svg,a,series,max,ticks){const W=svg.clientWidth,H=svg.clientHeight;if(!W)return;const L=28,R=10,T=10,B=24,iw=W-L-R,ih=H-T-B;
 const pts=series.map(s=>({c:s.c,p:a.map((e,i)=>[i,s.f(e)]).filter(([,v])=>v!=null&&!Number.isNaN(v))}));
 if(a.length<2||!pts.some(s=>s.p.length>=2)){svg.innerHTML=`<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#75626C" font-size="14">Your chart appears after 2 days</text>`;return}
 const x=i=>L+i*iw/(a.length-1),y=v=>T+ih-Math.min(v,max)/max*ih;let g='';
 ticks.forEach(v=>g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#EEDDE4"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#75626C">${v}</text>`);
 [0,a.length-1].forEach(i=>g+=`<text x="${x(i)}" y="${H-6}" text-anchor="${i?'end':'start'}" font-size="11" fill="#75626C">${a[i].date.slice(5).replace('-','/')}</text>`);
 pts.forEach(s=>{if(!s.p.length)return;g+=`<polyline fill="none" stroke="${s.c}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" points="${s.p.map(([i,v])=>x(i)+','+y(v)).join(' ')}"/>`+s.p.map(([i,v])=>a.length>14&&i<a.length-1?'':`<circle cx="${x(i)}" cy="${y(v)}" r="3.2" fill="${s.c}"/>`).join('')});svg.innerHTML=g}
function drawCharts(){const a=sorted().slice(-30).filter(e=>e.back!=null||e.acne!=null);
 if(view==='insights')chart($('#mainChart'),a,[{f:e=>e.back,c:'#6E5AB8'},{f:e=>e.acne==null?null:e.acne*2,c:'#D0668A'}],10,[0,5,10]);
 if(view==='skin')chart($('#skChart'),sorted().slice(-30).filter(e=>e.moist!=null||e.oil!=null||e.toil!=null),[{f:e=>e.moist,c:'#2A86AE'},{f:e=>e.oil,c:'#D0668A'},{f:e=>e.toil,c:'#C98A1B'}],80,[0,40,80])}
const ro=new ResizeObserver(()=>drawCharts());['#mainChart','#skChart'].forEach(s=>ro.observe($(s)));

/* ---------- Me ---------- */
const DOC=[['blood','Blood test: vitamin D, calcium, iron (ferritin), B12, thyroid'],['ortho','Back: orthopedic clinic (整形外科) or physiotherapist'],['dr','Ask about the stomach muscle gap after pregnancy (diastasis recti)'],['derm','Skin: dermatologist (皮膚科) for cheek and jaw acne'],['dent','Teeth: dentist (歯科) check-up'],['gutdr','Gut: if toilet problems last weeks, 消化器内科'],['show','Show your history (Insights → Copy) to each doctor']];
let alarmList=[];
function renderMe(){$('#meName').textContent=(user&&user.displayName)||profile.name||(guest?'Guest':'You');$('#meEmail').textContent=user&&user.email?user.email:guest?'Saved on this phone only':'';
 if(document.activeElement!==$('#pW'))$('#pW').value=profile.weight||'';setPicked('feed',profile.feed==null?[]:[profile.feed?'Yes':'No']);setPicked('diet',profile.diet?[profile.diet]:[]);setPicked('concerns',profile.concerns);setPicked('wake',[profile.wake||'6:30']);
 const pl=curPlan();$('#meBadge').hidden=pl==='Free';if(pl!=='Free'){$('#meBadge').textContent=pl;$('#meBadge').style.setProperty('--pc',PLAN_C[pl])}
 const wk=(profile.wake||'6:30').split(':').map(Number),wm=wk[0]*60+wk[1];
 alarmList=[[hm(wm),'Wake up: 2 glasses of water'],[hm(Math.max(wm+150,600)),'Water: 1–2 glasses'],['12:30','Lunch, water, 15-minute walk'],['15:00','Water and a stretch'],['18:00','Last water of the day'],[hm(wm-510),'Wind down: phone away, night skincare'],[hm(wm-480),'Bedtime']];
 $('#alarms').innerHTML=alarmList.map(([a,b])=>`<div><b>${a}</b><span>${b}</span></div>`).join('');
 $('#doc').innerHTML=DOC.map(([k,t])=>`<label><input type="checkbox" data-k="${k}" ${checks[k]?'checked':''}><span>${t}</span></label>`).join('');
 $('#toAdmin').hidden=!isAdmin();$('#logout').textContent=guest&&!user?'Log in or sign up':'Log out'}
$('#pSave').addEventListener('click',async()=>{const w=num($('#pW').value);profile={...profile,weight:w||null,feed:picked('feed')[0]?picked('feed')[0]==='Yes':null,diet:picked('diet')[0]||profile.diet||null,concerns:picked('concerns'),wake:picked('wake')[0]||'6:30',lang:LANG};localSave();renderAll();toast('Saved');await put('profile',profile)});

/* ---------- onboarding (first time only) ---------- */
let obShown=false;
function maybeOnboard(){if(obShown||profile.onboarded||$('#app').hidden||view==='privacy')return;obShown=true;
 setPicked('obDiet',profile.diet?[profile.diet]:[]);setPicked('obConcerns',profile.concerns||[]);setPicked('obWake',[profile.wake||'6:30']);setPicked('obFeed',profile.feed==null?[]:[profile.feed?'Yes':'No']);
 chrome(false);go('onboard')}
$('#obStart').addEventListener('click',async()=>{const er=$('#obErr');er.textContent='';
 if(!picked('obDiet')[0]){er.textContent='Please choose what you eat.';return}
 if(!$('#obAgree').checked){er.textContent='Please tick the box to continue.';return}
 profile={...profile,diet:picked('obDiet')[0],concerns:picked('obConcerns'),wake:picked('obWake')[0]||'6:30',feed:picked('obFeed')[0]?picked('obFeed')[0]==='Yes':(profile.feed??null),lang:LANG,onboarded:true,agreed:today()};
 localSave();chrome(true);renderAll();go('today');setTimeout(()=>burst($('#ring')),500);await put('profile',profile)});

/* ---------- plans ---------- */
const PLAN_C={Free:'#75626C',Gold:'#B07A12',Platinum:'#5B6B7D',Diamond:'#2A86AE'};
const PLANS=[['Free','Free forever',['Daily check-in, water and sleep','Basic skin, hair, lips and back tips','30 Indian and Japanese dishes','5 basic yoga poses']],
 ['Gold','₹99 / ¥480 a month',['Everything in Free','Full care routines','Weekly diet chart: Indian veg or non-veg + Japanese','Full yoga and stretch library','Monthly PDF report in English or Japanese']],
 ['Platinum','₹299 / ¥1,480 a month',['Everything in Gold','Personal 4-week plans from your logs']],
 ['Diamond','₹999 / ¥4,800 a month',['Everything in Platinum','Chat with a yoga teacher or nutritionist']]];
let myPlan=null;
const curPlan=()=>myPlan&&myPlan.plan&&(!myPlan.until||myPlan.until>=today())?myPlan.plan:'Free';
function renderPlans(){const cur=curPlan();
 $('#planCards').innerHTML=PLANS.map(([n,price,feats])=>`<div class="plan${n===cur?' cur':''}" style="--pc:${PLAN_C[n]}">${n===cur?'<span class="tag">Current plan</span>':''}<div class="pname"><i></i>${n}</div><div class="price">${price}</div><ul>${feats.map(f=>`<li>${f}</li>`).join('')}</ul>${n==='Free'?'':`<button class="btn" type="button" disabled>${n===cur?'Current plan':'Coming soon'}</button>`}${n===cur&&myPlan&&myPlan.until?`<p class="sub">until ${myPlan.until}</p>`:''}</div>`).join('');
 $('#memberId').textContent=uid||'–'}
async function loadMyPlan(){if(!db||!uid)return;try{const d=await db.collection('plans').doc(uid).get();myPlan=d.exists?d.data():null}catch(e){myPlan=null}renderMe();renderPlans()}
$('#toPlans').addEventListener('click',()=>{backTo='me';go('plans')});
$('#copyId').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(uid||'');toast('Copied')}catch(x){toast('Copy is not allowed here')}});

/* ---------- language switch ---------- */
function setLang(l){if(l===LANG)return;LANG=l;try{localStorage.setItem('bc-lang',l)}catch(e){}trAll();renderAll();if(view==='log')fillLog();if(view==='admin')loadAdmin();
 if(uid&&profile.onboarded){profile={...profile,lang:l};localSave();put('profile',profile)}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-lang]');if(b)setLang(b.dataset.lang)});
$('#doc').addEventListener('change',e=>{const k=e.target.dataset.k;checks[k]=e.target.checked;localSave();put('checklist',{...checks})});
$('#copyAl').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(alarmList.map(([a,b])=>a+'  '+b).join('\n'));toast('Copied')}catch(x){toast('Copy is not allowed here')}});

function renderAll(){renderToday();renderSkin();renderInsights();renderMe();renderPlans();drawCharts()}

/* ---------- accounts ---------- */
let mode='login';
const aerr=t=>$('#aErr').textContent=t;
const nice=e=>({'auth/invalid-email':'That email does not look right.','auth/weak-password':'Password needs 6 or more characters.','auth/email-already-in-use':'This email already has an account. Switch to Log in.','auth/invalid-credential':'Email or password is wrong.','auth/wrong-password':'Email or password is wrong.','auth/user-not-found':'No account with this email. Switch to Sign up.','auth/popup-blocked':'The Google window was blocked. Allow pop-ups, or use email.','auth/popup-closed-by-user':'The Google window was closed. Try again.','auth/cancelled-popup-request':'','auth/unauthorized-domain':'This website is not allowed in Firebase yet.','auth/too-many-requests':'Too many tries. Wait a few minutes.','auth/network-request-failed':'No internet connection.','auth/requires-recent-login':'For safety, log out, log in again, then delete.'}[e&&e.code]??'Something went wrong. Try again.');
function setMode(m){mode=m;const up=m==='signup';aerr('');$('#mLogin').setAttribute('aria-pressed',!up);$('#mSignup').setAttribute('aria-pressed',up);
 $('#nameRow').hidden=!up;$('#pass2Row').hidden=!up;$('#resetRow').hidden=up;$('#aSubmit').textContent=up?'Create account':'Log in';$('#aPass').autocomplete=up?'new-password':'current-password';
 $('#gText').textContent=up?'Sign up with Google':'Continue with Google';$('#aTitle').textContent=up?'Start your daily body check':'Your body, one gentle check a day';
 $('#aSub').textContent=up?'Free and private. Takes one minute a day.':'Water, skin, gut and sleep in one place, with a plan for today.'}
$('#mLogin').addEventListener('click',()=>setMode('login'));$('#mSignup').addEventListener('click',()=>setMode('signup'));
$('#aForm').addEventListener('submit',async e=>{e.preventDefault();aerr('');if(!auth)return aerr('Login is not available right now.');
 const em=$('#aEmail').value.trim(),pw=$('#aPass').value;
 if(mode==='signup'&&!$('#aName').value.trim()){$('#aName').focus();return aerr('Please type your name.')}
 if(!em){$('#aEmail').focus();return aerr('Please type your email.')}
 if(!/^\S+@\S+\.\S+$/.test(em)){$('#aEmail').focus();return aerr('That email does not look right.')}
 if(!pw){$('#aPass').focus();return aerr('Please type your password.')}
 if(mode==='signup'){if(pw.length<6)return aerr('Password needs 6 or more characters.');if(pw!==$('#aPass2').value)return aerr('The two passwords are not the same.')}
 const b=$('#aSubmit');b.disabled=true;b.textContent=mode==='signup'?'Creating account…':'Logging in…';
 try{if(mode==='signup'){const r=await auth.createUserWithEmailAndPassword(em,pw);try{await r.user.updateProfile({displayName:$('#aName').value.trim()});r.user.sendEmailVerification().catch(()=>{})}catch(x){}renderAll()}
  else await auth.signInWithEmailAndPassword(em,pw)}catch(err){aerr(nice(err))}
 b.disabled=false;b.textContent=mode==='signup'?'Create account':'Log in'});
$('#gLogin').addEventListener('click',()=>{aerr('');if(!auth)return aerr('Login is not available right now.');auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e=>aerr(nice(e)))});
$('#aReset').addEventListener('click',()=>{const m=$('#aEmail').value.trim();if(!m){$('#aEmail').focus();return aerr('Type your email first, then tap Forgot password.')}
 auth&&auth.sendPasswordResetEmail(m).then(()=>{aerr('');toast('Reset link sent to your email')}).catch(e=>aerr(nice(e)))});

function clearLocal(){try{['bc-entries','bc-checks','bc-photos','bc-profile','bc-products','bc-guest'].forEach(k=>localStorage.removeItem(k))}catch(e){}entries={};checks={};photos={};profile={};products={}}
$('#logout').addEventListener('click',async()=>{if(guest&&!user){guest=false;try{localStorage.removeItem('bc-guest')}catch(e){}if(auth&&auth.currentUser)await auth.signOut().catch(()=>{});setMode('login');screen('auth');return}
 if(auth)await auth.signOut().catch(()=>{});clearLocal();setMode('login');$('#aPass').value='';screen('auth')});
$('#delAcc').addEventListener('click',async()=>{const b=$('#delAcc'),m=$('#delMsg');if(!b.dataset.armed){b.dataset.armed='1';b.textContent='Tap again to delete everything';m.textContent='This cannot be undone.';return}
 const cu=auth&&auth.currentUser,sr=cu&&!cu.isAnonymous&&db?db.collection('stats').doc(cu.uid):null;
 try{const c=store();if(c){const all=await c.get();for(const d of all.docs)await d.ref.delete()}if(sr)await sr.set({deleted:today()},{merge:true}).catch(()=>{});
  if(cu&&!cu.isAnonymous)await cu.delete().catch(async e=>{if(sr)await sr.set({deleted:null},{merge:true}).catch(()=>{});throw e});
  clearLocal();guest=false;user=null;toast('Your data has been deleted');setMode('login');screen('auth')}catch(e){m.textContent=nice(e)}
 delete b.dataset.armed;b.textContent='Delete my account and data'});

/* ---------- sync & stats ---------- */
function startSync(){if(unsub)unsub();first=false;loadMyPlan();
 unsub=store().onSnapshot(s=>{const next={},ph={},pr={};let ck=null,np=null;
  s.docs.forEach(d=>{const v=d.data();if(d.id==='checklist')ck=v;else if(d.id==='profile')np=v;else if(d.id.startsWith('prod-'))pr[d.id]={...v};else if(d.id.startsWith('e-'))next[d.id.slice(2)]={...v};else if(d.id.startsWith('p-')&&v.img)ph[d.id.slice(2)]=v.img});
  if(s.empty&&!s.metadata.fromCache&&!first){first=true;const c=store();Object.values(entries).forEach(r=>c.doc('e-'+r.date).set(r).catch(()=>{}));Object.entries(photos).forEach(([d,img])=>c.doc('p-'+d).set({date:d,img}).catch(()=>{}));
   Object.values(products).forEach(p=>c.doc(p.id).set(p).catch(()=>{}));if(Object.keys(profile).length)c.doc('profile').set(profile).catch(()=>{});if(Object.keys(checks).length)c.doc('checklist').set({...checks}).catch(()=>{});maybeOnboard();return}
  first=true;entries=next;photos=ph;products=pr;profile=np?{...np}:profile;checks=ck?{...ck}:{};localSave();renderAll();if(view==='log')fillLog();maybeOnboard()},
  ()=>toast('Could not reach your account. Saving on this phone.'))}
async function track(u){try{const t=today();let last=null;try{last=localStorage.getItem('bc-seen-'+u.uid)}catch(e){}if(last===t)return;
 const r=db.collection('stats').doc(u.uid),g=await r.get(),v={lastActive:t,days:firebase.firestore.FieldValue.arrayUnion(t),anon:!!u.isAnonymous};if(!g.exists)v.created=t;await r.set(v,{merge:true});try{localStorage.setItem('bc-seen-'+u.uid,t)}catch(e){}}catch(e){}}
const isAdmin=()=>!!(user&&user.uid===ADMIN_UID);
const dayN=n=>shift(today(),-n);
async function loadAdmin(){if(!isAdmin()){go('me');return}$('#aWhen').textContent='Loading…';
 try{const snap=await db.collection('stats').get(),all=snap.docs.map(d=>d.data()),t=today(),d7=dayN(6),acc=all.filter(x=>!x.anon),live=acc.filter(x=>!x.deleted),guests=all.filter(x=>x.anon),on=all.filter(x=>!x.deleted);
  const T=[[live.length,'accounts'],[guests.length,'guests'],[on.filter(x=>x.lastActive===t).length,'active today'],[on.filter(x=>(x.days||[]).some(y=>y>=d7)).length,'active 7 days'],[acc.filter(x=>x.created>=d7).length,'new 7 days'],[acc.filter(x=>x.deleted).length,'deleted']];
  $('#aStats').innerHTML=T.map(([n,l])=>`<div class="tile"><b>${n}</b><span>${l}</span></div>`).join('');
  const ser=[];for(let i=29;i>=0;i--){const d=dayN(i);ser.push({date:d,a:all.filter(x=>(x.days||[]).includes(d)).length,n:acc.filter(x=>x.created===d).length})}
  const mx=Math.max(5,Math.ceil(Math.max(...ser.map(x=>Math.max(x.a,x.n)))/5)*5);chart($('#aChart'),ser,[{f:x=>x.a,c:'#2A86AE'},{f:x=>x.n,c:'#A23D63'}],mx,[0,mx/2,mx]);
  $('#aWhen').textContent='updated '+new Date().toLocaleTimeString(LOC(), {hour:'2-digit',minute:'2-digit'})}catch(e){$('#aWhen').textContent='Could not load. Check the database rules.'}loadPlanList()}
$('#toAdmin').addEventListener('click',()=>go('admin'));
async function loadPlanList(){const el=$('#gpList');try{const s=await db.collection('plans').get(),rows=s.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.plan&&r.plan!=='Free');
  el.innerHTML=rows.length?rows.map(r=>`<div class="spread"><span><b>${esc(r.plan)}</b><br><span class="sub" data-notr>${esc(r.id.slice(0,10))}…${r.until?' · '+esc(r.until):''}</span></span><button class="link" type="button" data-fill="${esc(r.id)}">Edit</button></div>`).join(''):'<p class="sub">No paid members yet.</p>'}
 catch(e){el.innerHTML='<p class="sub">Could not save. Add the plans rule in Firebase first.</p>'}}
$('#gpList').addEventListener('click',e=>{const b=e.target.closest('[data-fill]');if(b){$('#gpId').value=b.dataset.fill;$('#gpId').scrollIntoView({block:'center'})}});
$('#gpSave').addEventListener('click',async()=>{const er=$('#gpErr'),id=$('#gpId').value.trim(),pl=picked('gpPlan')[0];er.textContent='';
 if(!id){$('#gpId').focus();er.textContent='Paste the member ID';return}if(!pl)return;
 try{await db.collection('plans').doc(id).set({plan:pl,until:$('#gpUntil').value||null,set:today()});toast('Plan saved');$('#gpId').value='';$('#gpUntil').value='';setPicked('gpPlan',['Gold']);loadPlanList();if(id===uid)loadMyPlan()}
 catch(e){er.textContent='Could not save. Add the plans rule in Firebase first.'}});

/* ---------- start ---------- */
trAll();
function enterApp(){screen('app');renderAll();if(location.hash==='#privacy'){backTo=(user||guest)?'today':'auth';if(!(user||guest))chrome(false);go('privacy')}else{go('today');if(!auth)maybeOnboard()}}
if(/Instagram|FBAN|FBAV/i.test(navigator.userAgent))$('#igNote').hidden=false;
const cfgOk=window.firebase&&FIREBASE_CONFIG.apiKey;
if(cfgOk){try{firebase.initializeApp(FIREBASE_CONFIG);auth=firebase.auth();db=firebase.firestore()}catch(e){auth=null;db=null}}
if(auth&&guest){guest=false;clearLocal()}
if(!auth){guest=true;enterApp()}
else{
 if(guest)enterApp();
 setTimeout(()=>{if(!$('#boot').hidden){location.hash==='#privacy'?enterApp():screen('auth')}},8000);
 auth.onAuthStateChanged(u=>{
  if(u&&u.isAnonymous){track(u);user=null;uid=null;if(unsub){unsub();unsub=null}if(!guest){auth.signOut().catch(()=>{});screen('auth');return}if($('#app').hidden)enterApp();return}
  if(u){track(u);user=u;uid=u.uid;if(guest){guest=false;try{localStorage.removeItem('bc-guest')}catch(e){}}startSync();enterApp();return}
  user=null;uid=null;if(unsub){unsub();unsub=null}
  if(guest){if($('#app').hidden)enterApp();if(!triedAnon){triedAnon=true;auth.signInAnonymously().catch(()=>{})}return}
  if(location.hash==='#privacy'){enterApp();return}
  screen('auth')})}
}
