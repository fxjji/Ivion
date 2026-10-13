const STORAGE_KEY = "fieteBotAccounts_v2";
const fishTable = [
  {name:"Rotauge",emoji:"🐟",rarity:"Gewöhnlich",chance:50,value:20,xp:10},
  {name:"Barsch",emoji:"🐠",rarity:"Ungewöhnlich",chance:25,value:35,xp:15},
  {name:"Koi",emoji:"🐡",rarity:"Selten",chance:15,value:75,xp:25},
  {name:"Hai",emoji:"🦈",rarity:"Episch",chance:7,value:150,xp:45},
  {name:"Drachenfisch",emoji:"🐉",rarity:"Legendär",chance:2.5,value:400,xp:100},
  {name:"Kristallqualle",emoji:"🪼",rarity:"Mythisch",chance:0.5,value:1000,xp:250}
];
const symbols=["🍒","🍋","🔔","⭐","💎","7️⃣"], payouts={"🍒":2,"🍋":3,"🔔":5,"⭐":8,"💎":10,"7️⃣":25};
const slotWeights=[60,20,10,5,3,2];
const rouletteOrder=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const rouletteRed=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
let reactionTimer=null,reactionReadyAt=0,reactionState="idle";
const makePlayer=(name)=>({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),name,coins:1000,level:1,xp:0,fish:[],totalCaught:0,lastDaily:null,avatar:null,createdAt:Date.now()});
let accounts=[], activeId="", state, toastTimer;
function loadAll(){
  try{
    const data=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(data&&Array.isArray(data.players)&&data.players.length){accounts=data.players;activeId=data.activeId||accounts[0].id;state=accounts.find(p=>p.id===activeId)||accounts[0];activeId=state.id;return true;}
    const old=JSON.parse(localStorage.getItem("fieteBotSave_v1"));
    if(old&&typeof old.coins==="number"){
      const first=makePlayer((old.name||"").trim()||"Spieler");Object.assign(first,old,{id:first.id,avatar:null});
      accounts=[first];activeId=first.id;state=first;persistAll();return true;
    }
  }catch(e){console.warn("Lokaler Spielstand konnte nicht gelesen werden.",e);}
  accounts=[];activeId="";state=null;return false;
}
function persistAll(){localStorage.setItem(STORAGE_KEY,JSON.stringify({activeId,players:accounts}));}
function saveState(){persistAll();}
function format(n){return Math.floor(n).toLocaleString("de-DE");}
function nextLevelXP(level=state.level){return 100+(level-1)*50;}
function notify(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2800);}
function addXP(amount){state.xp+=amount;let leveled=0;while(state.xp>=nextLevelXP()){state.xp-=nextLevelXP();state.level++;leveled++;const reward=state.level===2?100:state.level===3?200:state.level===5?500:100;state.coins+=reward;}if(leveled)notify(`Levelaufstieg! Level ${state.level} erreicht. Levelbonus gutgeschrieben.`);}
function levelTitle(level){if(level>=10)return"Legende";if(level>=5)return"Profi-Angler";if(level>=3)return"Fortgeschritten";if(level>=2)return"Lehrling";return"Anfänger";}
function setAvatar(img,letterId,avatar){
  const image=document.getElementById(img),letter=document.getElementById(letterId);
  if(avatar){image.src=avatar;image.hidden=false;letter.hidden=true;}else{image.hidden=true;image.removeAttribute("src");letter.hidden=false;}
}
function renderAccounts(){
  const select=document.getElementById("account-select");
  select.innerHTML=accounts.map(a=>`<option value="${a.id}">${escapeHTML(a.name)}</option>`).join("");
  select.value=activeId;
  const list=document.getElementById("players-list");
  list.innerHTML=accounts.map(a=>`<button class="player-card ${a.id===activeId?"current":""}" data-player-id="${a.id}"><span class="player-card-avatar">${a.avatar?`<img src="${a.avatar}" alt="">`:escapeHTML((a.name[0]||"?").toUpperCase())}</span><span class="player-card-info"><strong>${escapeHTML(a.name)}</strong><small>Level ${a.level} · ${format(a.coins)} Coins</small></span><span class="player-card-arrow">${a.id===activeId?"Aktiv":"Ansehen →"}</span></button>`).join("");
  list.querySelectorAll("[data-player-id]").forEach(btn=>btn.addEventListener("click",()=>switchPlayer(btn.dataset.playerId)));
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function render(){
  document.getElementById("top-name").textContent=state.name;
  document.getElementById("top-avatar-letter").textContent=(state.name[0]||"F").toUpperCase();
  setAvatar("top-avatar","top-avatar-letter",state.avatar);
  document.getElementById("top-level").textContent=`Level ${state.level}`;
  document.getElementById("top-coins").textContent=format(state.coins);
  document.getElementById("stat-coins").textContent=format(state.coins);
  document.getElementById("stat-fish").textContent=state.fish.length;
  document.getElementById("stat-level").textContent=state.level;
  const needed=nextLevelXP(),pct=Math.min(100,state.xp/needed*100);
  document.getElementById("stat-xp").textContent=`${state.xp} / ${needed} XP`;
  document.getElementById("stat-xp-bar").style.width=pct+"%";
  document.getElementById("profile-avatar").textContent=(state.name[0]||"F").toUpperCase();
  setAvatar("profile-photo","profile-avatar",state.avatar);
  document.getElementById("profile-name").textContent=state.name;
  document.getElementById("profile-level-text").textContent=`Level ${state.level} · ${levelTitle(state.level)}`;
  document.getElementById("profile-xp-bar").style.width=pct+"%";
  document.getElementById("profile-xp-text").textContent=`${state.xp} / ${needed} XP bis Level ${state.level+1}`;
  document.getElementById("player-name").value=state.name;
  const today=new Date().toLocaleDateString("sv-SE"),claimed=state.lastDaily===today;
  document.getElementById("claim-daily").disabled=claimed;
  document.getElementById("claim-daily").textContent=claimed?"Heute abgeholt":"Abholen";
  document.getElementById("daily-status").textContent=claimed?"Du hast deine tägliche Belohnung bereits abgeholt.":"Hol dir deine Coins für heute.";
  document.getElementById("inventory-count").textContent=state.fish.length;
  document.getElementById("inventory-value").textContent=format(state.fish.reduce((sum,f)=>sum+f.value,0))+" Coins";
  renderInventory();renderAccounts();
  const prizeButton=document.getElementById("prize-wheel-spin");
  if(prizeButton){const prizeClaimed=state.lastPrizeWheel===today;prizeButton.disabled=prizeClaimed;prizeButton.textContent=prizeClaimed?"Heute gedreht":"Glücksrad drehen";document.getElementById("prize-wheel-result").textContent=prizeClaimed?"Du hast deine Tagesbelohnung bereits abgeholt.":"Dein Tages-Spin wartet.";}
}
function switchPlayer(id){const target=accounts.find(a=>a.id===id);if(!target)return;activeId=id;state=target;persistAll();render();notify(`Account „${state.name}“ geöffnet.`);}
document.getElementById("account-select").addEventListener("change",e=>switchPlayer(e.target.value));
document.getElementById("add-player").addEventListener("click",()=>{
  if(accounts.length>=20){notify("Maximal 20 lokale Spielerprofile.");return;}
  const name=prompt("Name für den neuen Spieler (max. 18 Zeichen):");if(name===null)return;
  const clean=name.trim().slice(0,18);if(!clean){notify("Der Spielername darf nicht leer sein.");return;}
  const player=makePlayer(clean);accounts.push(player);activeId=player.id;state=player;persistAll();render();setView("profile");notify(`Account „${clean}“ erstellt.`);
});
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
const menuToggle=document.getElementById("menu-toggle"),drawerBackdrop=document.getElementById("drawer-backdrop");
function closeDrawer(){document.body.classList.remove("drawer-open");menuToggle?.setAttribute("aria-expanded","false");menuToggle?.setAttribute("aria-label","Navigation öffnen");}
function toggleDrawer(){const open=document.body.classList.toggle("drawer-open");menuToggle?.setAttribute("aria-expanded",String(open));menuToggle?.setAttribute("aria-label",open?"Navigation schließen":"Navigation öffnen");}
menuToggle?.addEventListener("click",toggleDrawer);drawerBackdrop?.addEventListener("click",closeDrawer);

document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.go)));
function setView(name){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));const titles={dashboard:"Menü",fishing:"Angelplatz",slots:"Spielhalle",roulette:"Roulette",minigames:"Minispiele",inventory:"Sammlung",profile:"Profil & Level"};document.getElementById("page-title").textContent=titles[name]||"Ivion";closeDrawer();window.scrollTo({top:0,behavior:"smooth"});}
document.getElementById("claim-daily").addEventListener("click",()=>{
  const today=new Date().toLocaleDateString("sv-SE");if(state.lastDaily===today)return;
  state.coins+=250;state.lastDaily=today;addXP(20);saveState();render();notify("Tagesbonus abgeholt: +250 Coins und 20 XP!");
});
function weightedFish(){let roll=Math.random()*100,acc=0;for(const fish of fishTable){acc+=fish.chance;if(roll<acc)return fish;}return fishTable[0];}
document.getElementById("fish-btn").addEventListener("click",()=>{
  if(state.coins<25){notify("Nicht genug Coins. Hol zuerst deinen Tagesbonus ab.");return;}
  state.coins-=25;const caught=weightedFish(),entry={...caught,id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),caughtAt:new Date().toISOString()};
  state.fish.push(entry);state.totalCaught++;addXP(caught.xp);saveState();render();
  const result=document.getElementById("catch-result");result.classList.remove("hidden");result.textContent=`${caught.emoji} ${caught.name} gefangen! ${caught.rarity} · Verkaufswert: ${format(caught.value)} Coins · +${caught.xp} XP`;
});
function renderInventory(){const list=document.getElementById("inventory-list");if(!state.fish.length){list.innerHTML='<div class="empty-state"><span>—</span><strong>Noch keine Fische</strong><p>Besuche den Angelplatz, um deine Sammlung zu füllen.</p></div>';return;}
  const counts={};state.fish.forEach(f=>{const k=f.name;counts[k]=(counts[k]||0)+1;});
  list.innerHTML=Object.entries(counts).map(([name,count])=>{const f=fishTable.find(x=>x.name===name);return `<div class="fish-row"><div class="fish-emoji">${f.emoji}</div><div><strong>${f.name}</strong><small>${f.rarity} · ${count} Stück${count===1?"":"e"}</small></div><div class="fish-value">${format(f.value*count)} Coins</div></div>`;}).join("");
}
document.getElementById("sell-fish").addEventListener("click",()=>{
  if(!state.fish.length){notify("Deine Sammlung ist noch leer.");return;}
  const total=state.fish.reduce((sum,f)=>sum+f.value,0),count=state.fish.length;state.fish=[];state.coins+=total;addXP(Math.max(5,Math.floor(count*5)));saveState();render();notify(`${count} Fisch(e) für ${format(total)} Coins verkauft.`);
});
document.getElementById("bet-all").addEventListener("click",()=>{document.getElementById("bet-amount").value=Math.max(0,state.coins);});
document.getElementById("spin-btn").addEventListener("click",()=>{
  const bet=Math.floor(Number(document.getElementById("bet-amount").value));
  if(!Number.isFinite(bet)||bet<10){notify("Der Mindesteinsatz beträgt 10 Coins.");return;}
  if(bet>state.coins){notify("Dafür hast du nicht genug Coins.");return;}
  state.coins-=bet;const drawSymbol=()=>{let r=Math.random()*100;for(let i=0;i<slotWeights.length;i++){r-=slotWeights[i];if(r<0)return symbols[i];}return symbols[0];};const reels=[drawSymbol(),drawSymbol(),drawSymbol()];
  reels.forEach((s,i)=>document.getElementById(`reel-${i+1}`).textContent=s);
  const multiplier=reels.every(s=>s===reels[0])?(payouts[reels[0]]||0):0,msg=document.getElementById("slot-message");
  if(multiplier){const winnings=bet*multiplier;state.coins+=winnings;addXP(10);msg.textContent=`Gewinn! ${reels.join(" ")} · Auszahlung ${format(winnings)} Coins (${multiplier}×)`;msg.style.color="#f6c85f";notify(`Gewonnen: ${format(winnings)} Coins Auszahlung.`);}
  else{msg.textContent=`Kein Treffer: ${reels.join(" ")} · Einsatz ${format(bet)} Coins verloren.`;msg.style.color="#a9afbf";notify("Diesmal kein Gewinn. Nur virtuelle Coins.");}
  saveState();render();
});
document.getElementById("save-profile").addEventListener("click",()=>{
  const name=document.getElementById("player-name").value.trim();if(!name){notify("Bitte gib einen Namen ein.");return;}
  state.name=name.slice(0,18);saveState();render();notify("Profil gespeichert.");
});
document.getElementById("avatar-upload").addEventListener("change",e=>{
  const file=e.target.files[0];if(!file)return;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)){notify("Bitte PNG, JPG oder WebP verwenden.");e.target.value="";return;}
  if(file.size>1_000_000){notify("Das Bild ist zu groß. Bitte unter 1 MB auswählen.");e.target.value="";return;}
  const reader=new FileReader();reader.onload=()=>{state.avatar=reader.result;saveState();render();notify("Profilbild hinzugefügt.");};reader.readAsDataURL(file);
});
document.getElementById("remove-avatar").addEventListener("click",()=>{state.avatar=null;document.getElementById("avatar-upload").value="";saveState();render();notify("Profilbild entfernt.");});
document.getElementById("reset-game").addEventListener("click",()=>{
  if(!confirm("Diesen Account wirklich zurücksetzen? Das kann nicht rückgängig gemacht werden."))return;
  const name=state.name;const fresh=makePlayer(name);accounts=accounts.map(a=>a.id===activeId?fresh:a);activeId=fresh.id;state=fresh;saveState();render();document.getElementById("catch-result").classList.add("hidden");notify("Account zurückgesetzt.");
});

// Roulette: animation and simple European-wheel result (0-36).
document.getElementById("roulette-choice").addEventListener("change",e=>{
  document.getElementById("number-choice-wrap").classList.toggle("hidden",e.target.value!=="number");
});
document.getElementById("roulette-spin").addEventListener("click",()=>{
  const bet=Math.floor(Number(document.getElementById("roulette-bet").value));
  if(!Number.isFinite(bet)||bet<10){notify("Mindesteinsatz: 10 Coins.");return;}
  if(bet>state.coins){notify("Dafür hast du nicht genug Coins.");return;}
  const choice=document.getElementById("roulette-choice").value;
  const chosen=Math.floor(Number(document.getElementById("roulette-number-choice").value));
  if(choice==="number"&&(!Number.isInteger(chosen)||chosen<0||chosen>36)){notify("Wähle eine Zahl von 0 bis 36.");return;}
  state.coins-=bet;
  const number=Math.floor(Math.random()*37),color=number===0?"green":rouletteRed.has(number)?"red":"black";
  const wheel=document.getElementById("roulette-wheel"),numEl=document.getElementById("roulette-number"),result=document.getElementById("roulette-result"),btn=document.getElementById("roulette-spin");
  const segment=360/37,index=rouletteOrder.indexOf(number),targetAngle=360-(index*segment+segment/2);
  wheel.style.transition="none";wheel.style.transform="rotate(0deg)";void wheel.offsetWidth;
  wheel.style.transition="transform 2.8s cubic-bezier(.12,.72,.1,1)";wheel.style.transform=`rotate(${5*360+targetAngle}deg)`;
  btn.disabled=true;
  const won=choice==="number"?number===chosen:choice==="red"||choice==="black"?choice===color:choice==="green"?color==="green":choice==="even"?number!==0&&number%2===0:number!==0&&number%2===1;
  const multiplier=choice==="green"||choice==="number"?14:2;
  setTimeout(()=>{
    numEl.textContent=number;numEl.className="wheel-number roulette-center "+color;
    if(won){const payout=bet*multiplier;state.coins+=payout;addXP(8);result.textContent=`Treffer! ${number} · ${color==="green"?"Grün":color==="red"?"Rot":"Schwarz"} · Auszahlung ${format(payout)} Coins`;result.classList.add("win-glow");}
    else{result.textContent=`${number} · ${color==="green"?"Grün":color==="red"?"Rot":"Schwarz"} · Kein Treffer, ${format(bet)} Coins Einsatz verloren.`;result.classList.remove("win-glow");}
    btn.disabled=false;saveState();render();
  },2850);
});
// Coin flip: fictional coins only.
document.querySelectorAll(".coinflip-choice").forEach(btn=>btn.addEventListener("click",()=>{
  const bet=Math.floor(Number(document.getElementById("coinflip-bet").value));
  if(!Number.isFinite(bet)||bet<10){notify("Mindesteinsatz: 10 Coins.");return;}
  if(bet>state.coins){notify("Dafür hast du nicht genug Coins.");return;}
  state.coins-=bet;const result=Math.random()<.5?"heads":"tails",coin=document.getElementById("coinflip-coin"),out=document.getElementById("coinflip-result");
  coin.classList.remove("coin-flip");void coin.offsetWidth;coin.classList.add("coin-flip");
  const won=btn.dataset.choice===result;
  setTimeout(()=>{coin.textContent=result==="heads"?"K":"Z";if(won){state.coins+=bet*2;addXP(5);out.textContent=`Richtig! ${result==="heads"?"Kopf":"Zahl"} · +${format(bet*2)} Coins Auszahlung`;out.classList.add("win-glow");}else{out.textContent=`Es kam ${result==="heads"?"Kopf":"Zahl"}. Diesmal daneben.`;out.classList.remove("win-glow");}saveState();render();},550);
}));
// Reaction test: no betting, only XP for a fast reaction.
document.getElementById("reaction-start").addEventListener("click",()=>{
  if(reactionState==="waiting")return;
  const target=document.getElementById("reaction-target"),out=document.getElementById("reaction-result");
  reactionState="waiting";target.disabled=true;target.className="reaction-target";target.textContent="Warte auf Grün …";out.textContent="Nicht zu früh klicken!";
  clearTimeout(reactionTimer);
  reactionTimer=setTimeout(()=>{reactionState="ready";reactionReadyAt=Date.now();target.disabled=false;target.classList.add("ready");target.textContent="JETZT KLICKEN";},1200+Math.random()*2800);
});
document.getElementById("reaction-target").addEventListener("click",()=>{
  const target=document.getElementById("reaction-target"),out=document.getElementById("reaction-result");
  if(reactionState==="waiting"){clearTimeout(reactionTimer);reactionState="idle";target.disabled=true;target.textContent="Zu früh!";out.textContent="Zu früh geklickt. Starte nochmal.";return;}
  if(reactionState!=="ready")return;
  const ms=Date.now()-reactionReadyAt;reactionState="idle";target.disabled=true;target.classList.remove("ready");target.textContent="Nochmal versuchen";
  const xp=ms<250?30:ms<400?20:10;addXP(xp);out.textContent=`${ms} ms · +${xp} XP`;saveState();render();
});
// Daily prize wheel uses a separate daily claim from the main bonus.
document.getElementById("prize-wheel-spin").addEventListener("click",()=>{
  const today=new Date().toLocaleDateString("sv-SE");
  if(state.lastPrizeWheel===today){notify("Das Glücksrad hast du heute schon gedreht.");return;}
  state.lastPrizeWheel=today;const rewards=[{coins:50,xp:0,label:"+50 Coins"},{coins:100,xp:0,label:"+100 Coins"},{coins:150,xp:0,label:"+150 Coins"},{coins:0,xp:25,label:"+25 XP"},{coins:250,xp:0,label:"+250 Coins"},{coins:75,xp:10,label:"+75 Coins und 10 XP"}];
  const reward=rewards[Math.floor(Math.random()*rewards.length)],symbol=document.getElementById("wheel-symbol"),out=document.getElementById("prize-wheel-result");
  symbol.classList.remove("wheel-pop");void symbol.offsetWidth;symbol.classList.add("wheel-pop");state.coins+=reward.coins;if(reward.xp)addXP(reward.xp);
  out.textContent=`Belohnung: ${reward.label}`;saveState();render();document.getElementById("prize-wheel-spin").disabled=true;
});

function setupRouletteWheel(){
  const labels=document.getElementById("roulette-labels");if(!labels)return;
  labels.innerHTML=rouletteOrder.map((n,i)=>{const angle=i*(360/37)+(180/37);const color=n===0?"green":rouletteRed.has(n)?"red":"black";return `<span class="roulette-segment-number ${color}" style="--angle:${angle}deg">${n}</span>`;}).join("");
  const stops=rouletteOrder.map((n,i)=>`${n===0?"#21875c":rouletteRed.has(n)?"#b52c44":"#171a24"} ${i*(360/37)}deg ${(i+1)*(360/37)}deg`).join(",");
  document.getElementById("roulette-wheel").style.background=`conic-gradient(${stops})`;
}
document.getElementById("onboarding-form").addEventListener("submit",e=>{
  e.preventDefault();const name=document.getElementById("first-player-name").value.trim().slice(0,18);
  if(!name){document.getElementById("first-player-name").focus();return;}
  const player=makePlayer(name);accounts=[player];activeId=player.id;state=player;persistAll();
  document.body.classList.remove("needs-name");document.getElementById("onboarding").hidden=true;render();notify(`Willkommen bei Ivion, ${name}!`);
});
setupRouletteWheel();
if(loadAll()){document.body.classList.remove("needs-name");document.getElementById("onboarding").hidden=true;render();}

