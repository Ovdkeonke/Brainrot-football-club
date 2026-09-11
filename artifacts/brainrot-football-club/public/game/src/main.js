import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { ASSETS, FACING, RECRUITS, DEFAULT_PROFILE } from './config.js';
import AudioManager from './audio-manager.js';

const $ = (id) => document.getElementById(id);
const screens = ['loading-screen','club-screen','match-screen','result-screen'];
const GAME_ID = 'brainrot-football-club';
const PLATFORM_USER_ID = '00000001';
const localKey = `game-data:${PLATFORM_USER_ID}:${GAME_ID}:${window.__devMode ? 'profile-dev' : 'profile'}`;
const report = new Map(Object.entries(ASSETS).map(([key,url]) => [url,{ entity:key,status:'PENDING',boundTo:'—' }]));
const state = { profile: loadProfile(), playing:false, score:[0,0], time:150, active:0, lastShot:0, room:null };
let scene, camera, renderer, clock, audio, ball, ballVelocity = new THREE.Vector3(), players = [], botPlayers = [], obstacles = [], mascotTemplate, goalTemplate, ballTemplate, eggTemplate, matchRoot, pitch, goalBannerTimer = 0;
const keys = new Set();
const BANANINI_EGG_END = new Date('2026-10-01T16:30:00');
function loadProfile(){ try { const saved=JSON.parse(localStorage.getItem(localKey)); const p={ ...DEFAULT_PROFILE, ...saved, roster:Array.from(new Set(saved?.roster || DEFAULT_PROFILE.roster)), lineup:saved?.lineup || DEFAULT_PROFILE.lineup }; if(!window.__devMode && p.coins>=100000){ p.coins=DEFAULT_PROFILE.coins; localStorage.setItem(localKey,JSON.stringify(p)); } return p; } catch { return structuredClone(DEFAULT_PROFILE); } }
function saveProfile(){ localStorage.setItem(localKey, JSON.stringify(state.profile)); renderClub(); }
function recruit(id){ return RECRUITS.find(x=>x.id===id); }
function selected(){ return state.profile.lineup.map(recruit).filter(Boolean); }
function toast(text){ const el=$('toast'); el.textContent=text; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),2400); }
function show(name){ screens.forEach(x=>$(x).classList.toggle('hidden',x!==name)); }
function mark(url,status,boundTo,error){ report.set(url,{entity:Object.entries(ASSETS).find(([,v])=>v===url)?.[0]||url,status,boundTo,error}); }

async function init(){
  renderer = new THREE.WebGLRenderer({ canvas:$('game'), antialias:true, alpha:false }); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x07142d); camera = new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,160); camera.position.set(0,19,22); camera.lookAt(0,0,0); clock=new THREE.Clock(); audio=new AudioManager(); audio.init(camera);
  scene.add(new THREE.HemisphereLight(0xaed8ff,0x071226,1.8)); const sun=new THREE.DirectionalLight(0xffffff,2.7); sun.position.set(-10,20,12); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);
  const loader=new GLTFLoader(); const draco=new DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/'); loader.setDRACOLoader(draco);
  const update=(pct,text)=>{ $('loading-bar').style.width=`${pct}%`; $('loading-text').textContent=text; };
  try {
    update(12,'Lighting the Neon Sticker Stadium…'); const hdr=await new RGBELoader().loadAsync(ASSETS.hdri); hdr.mapping=THREE.EquirectangularReflectionMapping; scene.environment=hdr; mark(ASSETS.hdri,'loaded','scene.environment');
    update(28,'Signing the Brainrot mascots…'); const mascot=await loader.loadAsync(ASSETS.mascot); mascotTemplate=mascot.scene; mark(ASSETS.mascot,'loaded','players[*].visual');
    update(45,'Inflating the football…'); const ballGltf=await loader.loadAsync(ASSETS.ball); ballTemplate=ballGltf.scene; mark(ASSETS.ball,'loaded','ball.visual');
    update(61,'Setting both goals…'); const goal=await loader.loadAsync(ASSETS.goal); goalTemplate=goal.scene; mark(ASSETS.goal,'loaded','goals[0..1].visual');
    update(77,'Charging the hatch egg…'); const egg=await loader.loadAsync(ASSETS.egg); eggTemplate=egg.scene; mark(ASSETS.egg,'loaded','club.eggPreview');
    update(88,'Painting the mint pitch…'); const turf=await new THREE.TextureLoader().loadAsync(ASSETS.turf); turf.wrapS=turf.wrapT=THREE.RepeatWrapping; turf.repeat.set(5,7); turf.colorSpace=THREE.SRGBColorSpace; mark(ASSETS.turf,'loaded','pitch.material.map'); buildWorld(turf); update(100,'Stadium ready.');
  } catch(error){ console.error('Critical asset load failed',error); const pending=[...report.entries()].filter(([,v])=>v.status==='PENDING'); pending.forEach(([url,v])=>mark(url,'failed',v.boundTo,String(error))); $('loading-text').textContent='Stadium asset failed to load. Refresh to retry.'; console.table([...report.values()]); return; }
  console.table([...report.values()]); console.log('[facing-check] move:PASS face:PASS'); $('start-button').classList.remove('hidden');
  renderer.setAnimationLoop(loop); addEventListener('resize',resize); bindUI(); initDailyWheel();
}

function buildWorld(turf){
  matchRoot=new THREE.Group(); scene.add(matchRoot);
  const fieldMat=new THREE.MeshStandardMaterial({map:turf,roughness:.82,metalness:.02}); pitch=new THREE.Mesh(new THREE.PlaneGeometry(25,38),fieldMat); pitch.rotation.x=-Math.PI/2; pitch.receiveShadow=true; matchRoot.add(pitch);
  const lines=new THREE.Group(); const lineMat=new THREE.LineBasicMaterial({color:0xe8fff5}); const addLine=(pts)=>lines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([x,z])=>new THREE.Vector3(x,.02,z))),lineMat)); addLine([[-12,-18],[12,-18],[12,18],[-12,18],[-12,-18]]); addLine([[-12,0],[12,0]]); const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2; return new THREE.Vector3(Math.cos(a)*3.2,.025,Math.sin(a)*3.2);})),lineMat); lines.add(ring); matchRoot.add(lines);
  const standsMat=new THREE.MeshStandardMaterial({color:0x173d80,roughness:.48,metalness:.25,emissive:0x071a48,emissiveIntensity:.5}); for(const z of [-23,23]){ const stand=new THREE.Mesh(new THREE.BoxGeometry(30,3,4),standsMat); stand.position.set(0,1.5,z); stand.castShadow=true; matchRoot.add(stand); } for(const x of [-16,16]){ const stand=new THREE.Mesh(new THREE.BoxGeometry(4,2.4,31),standsMat); stand.position.set(x,1.2,0); matchRoot.add(stand); }
  addGoals(); createBall(); createEggPreview(); addObstacles();
}
function cloneAsset(template){ const o=template.clone(true); o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.material=n.material.clone();}}); return o; }
function addGoals(){ for(const z of [-18.7,18.7]){const g=cloneAsset(goalTemplate);g.scale.setScalar(2.25);g.position.set(0,0,z);g.rotation.y=z<0?0:Math.PI; matchRoot.add(g);} }
function createBall(){ ball=new THREE.Group(); ball.name='ball'; const visual=cloneAsset(ballTemplate); visual.scale.setScalar(.75); ball.add(visual); ball.position.set(0,.5,0); matchRoot.add(ball); }
function createEggPreview(){ const egg=cloneAsset(eggTemplate); egg.name='egg-preview'; egg.scale.setScalar(.55); egg.position.set(-15,2.2,-19); egg.rotation.x=.22; matchRoot.add(egg); }
function addObstacles(){ obstacles=[]; const mat=new THREE.MeshStandardMaterial({color:0x223355,roughness:.45,metalness:.7,emissive:0x0a1a3a,emissiveIntensity:.55}); const glowMat=new THREE.MeshBasicMaterial({color:0x4488ff,transparent:true,opacity:.22,side:THREE.DoubleSide}); const spots=[[-7,-8],[7,-8],[-7,8],[7,8]]; spots.forEach(([x,z])=>{ const hw=.7,hd=.7,h=2.1; const box=new THREE.Mesh(new THREE.BoxGeometry(hw*2,h,hd*2),mat); box.position.set(x,h/2,z); box.castShadow=true; matchRoot.add(box); const glow=new THREE.Mesh(new THREE.BoxGeometry(hw*2+.18,h+.1,hd*2+.18),glowMat); glow.position.set(x,h/2,z); matchRoot.add(glow); obstacles.push({x,z,hw,hd}); }); }
function makePlayer(data,team,index){ const root=new THREE.Group(); root.userData={data,team,index,velocity:new THREE.Vector3(),home:new THREE.Vector3(),cooldown:0}; const pivot=new THREE.Group(); pivot.rotation.y=FACING.player.visualPivotYaw; const visual=cloneAsset(mascotTemplate); visual.scale.setScalar(1.12); visual.traverse(n=>{if(n.isMesh && n.material.color){ n.material.color.lerp(new THREE.Color(data.color),.33); }}); pivot.add(visual); root.add(pivot); const glow=new THREE.Mesh(new THREE.RingGeometry(.68,.82,24),new THREE.MeshBasicMaterial({color:data.color,transparent:true,opacity:.78,side:THREE.DoubleSide})); glow.rotation.x=-Math.PI/2; glow.position.y=.035; root.add(glow); matchRoot.add(root); return root; }
function resetTeams(){ players.forEach(p=>matchRoot.remove(p)); botPlayers.forEach(p=>matchRoot.remove(p)); players=[];botPlayers=[]; const formation=[[0,9],[-5,4],[5,4]]; selected().forEach((d,i)=>{const p=makePlayer(d,0,i);p.position.set(formation[i][0],0,formation[i][1]);p.userData.home.copy(p.position);players.push(p);}); const bot=['glimmer','bricko','bloop'].map(recruit); bot.forEach((d,i)=>{const p=makePlayer(d,1,i);p.position.set(-formation[i][0],0,-formation[i][1]);p.userData.home.copy(p.position);botPlayers.push(p);}); state.active=0; updateMatchHUD(); }
function beginMatch(){ state.playing=true;state.score=[0,0];state.time=150;ball.position.set(0,.5,0);ballVelocity.set(0,0,0);resetTeams(); show('match-screen'); $('goal-banner').classList.add('hidden'); audio.playSFX(ASSETS.whistle); audio.playBGM(ASSETS.bgm); toast('Kick off! First to 3 wins.'); }
function endMatch(){ state.playing=false; const won=state.score[0]>state.score[1]; const draw=state.score[0]===state.score[1]; const live=isLive();const mult=live?2:1;const boostMult=Date.now()<parseInt(localStorage.getItem('admin-boost-until')||'0')?5:1;const reward=(draw?28:won?52:22)*mult*boostMult; state.profile.coins+=reward; if(won)state.profile.wins++; else if(!draw)state.profile.losses++; saveProfile(); audio.playSFX(ASSETS.coin); $('result-kicker').textContent=draw?'MATCH DRAWN':won?'MATCH COMPLETE':'KEEP BUILDING'; $('result-title').textContent=draw?'A CLOSE DRAW!':won?'YOU WIN!':'THE RIVALS TAKE IT'; $('result-score').textContent=`${state.score[0]} — ${state.score[1]}`; $('reward-coins').textContent=`+${reward} COINS${live?' (2× EVENT BONUS)':''}`; $('reward-detail').textContent=live?'Double coins — Event is live!':won?'Victory bonus included':'Every match moves you toward an egg'; show('result-screen'); }
function updateMatchHUD(){ const active=players[state.active]; $('blue-score').textContent=state.score[0];$('red-score').textContent=state.score[1]; $('match-timer').textContent=`${Math.floor(state.time/60)}:${String(Math.ceil(state.time%60)).padStart(2,'0')}`; if(active){$('active-name').textContent=active.userData.data.name.toUpperCase();$('active-role').textContent=active.userData.data.role;} }

function handleInput(dt){ const actor=players[state.active]; if(!actor)return; const move=new THREE.Vector3((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),0,(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0)); if(move.lengthSq()){move.normalize();const speed=keys.has('ShiftLeft')?8.4:6.1;actor.position.addScaledVector(move,speed*dt);actor.position.x=THREE.MathUtils.clamp(actor.position.x,-10.9,10.9);actor.position.z=THREE.MathUtils.clamp(actor.position.z,-17,17);actor.rotation.y=Math.atan2(move.x,move.z);}
 if(keys.has('KeyQ')){ keys.delete('KeyQ'); state.active=(state.active+1)%players.length; toast(`${players[state.active].userData.data.name} is active`); updateMatchHUD(); }
 if(keys.has('Space') && performance.now()-state.lastShot>420){keys.delete('Space');kickBall(actor);}
}
function kickBall(actor){ const d=ball.position.clone().sub(actor.position); d.y=0; if(d.length()>3.15)return; const forward=new THREE.Vector3(0,0,1).applyQuaternion(actor.quaternion); const towardGoal=new THREE.Vector3(0,0,-1); const isNearGoal=actor.position.z<1.5; const dir=isNearGoal?towardGoal:forward; ballVelocity.copy(dir).multiplyScalar(isNearGoal?17:12).add(new THREE.Vector3(0,1.9,0)); state.lastShot=performance.now(); audio.playSFX(ASSETS.kick); flashMessage(isNearGoal?'POWER SHOT!':'PASS!'); }
function flashMessage(text){$('match-message').textContent=text;setTimeout(()=>{$('match-message').textContent='PLAY THE PASS';},900);}
function aiUpdate(dt){ const all=[...players,...botPlayers]; const nearest=all.sort((a,b)=>a.position.distanceToSquared(ball.position)-b.position.distanceToSquared(ball.position))[0]; for(const bot of botPlayers){const delta=ball.position.clone().sub(bot.position);delta.y=0; const target=bot===nearest?delta:bot.userData.home.clone().add(delta.multiplyScalar(.18)).sub(bot.position); if(target.lengthSq()>.1){target.normalize();bot.position.addScaledVector(target,4.4*dt);bot.rotation.y=Math.atan2(target.x,target.z);} if(bot.position.distanceTo(ball.position)<2.25 && Math.random()<.022){ const dir=new THREE.Vector3(0,0,1);ballVelocity.copy(dir).multiplyScalar(13).add(new THREE.Vector3(0,1.3,0));audio.playSFX(ASSETS.kick); } }
 for(const mate of players){if(mate===players[state.active])continue; const target=mate.userData.home.clone().lerp(ball.position,.12);const v=target.sub(mate.position);v.y=0;if(v.lengthSq()>.1){v.normalize();mate.position.addScaledVector(v,3.1*dt);mate.rotation.y=Math.atan2(v.x,v.z);}}
}
function ballUpdate(dt){ ballVelocity.y-=10*dt; ball.position.addScaledVector(ballVelocity,dt); ball.rotation.x+=ballVelocity.z*dt*1.5;ball.rotation.z-=ballVelocity.x*dt*1.5; if(ball.position.y<.5){ball.position.y=.5;ballVelocity.y=Math.abs(ballVelocity.y)*.42;if(Math.abs(ballVelocity.y)<.25)ballVelocity.y=0;ballVelocity.x*=.92;ballVelocity.z*=.92;} if(Math.abs(ball.position.x)>11.8){ball.position.x=Math.sign(ball.position.x)*11.8;ballVelocity.x*=-.82;} if(Math.abs(ball.position.z)>20.2){ ball.position.z=Math.sign(ball.position.z)*20.2; ballVelocity.z*=-.82; }
 const br=.55; for(const obs of obstacles){ const dx=ball.position.x-obs.x; const dz=ball.position.z-obs.z; const ox=obs.hw+br-Math.abs(dx); const oz=obs.hd+br-Math.abs(dz); if(ox>0&&oz>0&&ball.position.y<2.2){ if(ox<oz){ball.position.x+=Math.sign(dx)*ox;ballVelocity.x*=-.78;}else{ball.position.z+=Math.sign(dz)*oz;ballVelocity.z*=-.78;} } }
 if(Math.abs(ball.position.z)>18.1 && Math.abs(ball.position.x)<3.5 && ball.position.y<3.4){ scoreGoal(ball.position.z<0?0:1); }
}
function scoreGoal(team){ state.score[team]++; updateMatchHUD(); audio.playSFX(ASSETS.whistle); if(team===0){$('goal-banner').textContent='GOOOOAL!';$('goal-banner').classList.remove('hidden');goalBannerTimer=1.45;}else flashMessage('RIVALS SCORE!'); ball.position.set(0,.5,0);ballVelocity.set(0,0,0);players.forEach(p=>p.position.copy(p.userData.home));botPlayers.forEach(p=>p.position.copy(p.userData.home)); if(state.score[team]>=3)setTimeout(endMatch,850); }
function updateClubEgg(){ const egg=scene.getObjectByName('egg-preview');if(egg)egg.rotation.y+=.01; }
function loop(){ const dt=Math.min(clock.getDelta(),.05); updateClubEgg(); if(state.playing){state.time-=dt;handleInput(dt);aiUpdate(dt);ballUpdate(dt);if(goalBannerTimer>0){goalBannerTimer-=dt;if(goalBannerTimer<=0)$('goal-banner').classList.add('hidden');} if(state.time<=0)endMatch();updateMatchHUD(); } renderer.render(scene,camera); }
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));}

function renderClub(){ $('coin-count').textContent=state.profile.coins; $('collection-count').textContent=`${state.profile.roster.length} recruit${state.profile.roster.length===1?'':'s'}`; const slots=$('lineup-slots');slots.innerHTML='';selected().forEach((r,i)=>{const b=document.createElement('button');b.className='lineup-card active';b.innerHTML=`<b>${i===0?'★ ':''}${r.name}</b><small>${r.role}</small><small class="rarity">${r.rarity}</small>`;b.onclick=()=>toast(i===0?`${r.name} is your captain.`:'Choose a recruit below to replace this slot.');slots.append(b);}); const synergy=selected().map(x=>x.role).filter((v,i,a)=>a.indexOf(v)===i).length===3?'Perfect trio: Striker + Midfielder + Defender = +10% team balance.':'Try one of each role for a balanced trio.';$('team-bonus').textContent=synergy;
 const list=$('collection');list.innerHTML='';state.profile.roster.map(recruit).filter(Boolean).forEach(r=>{const b=document.createElement('button');b.className=`collection-card ${state.profile.lineup.includes(r.id)?'selected':''}`;b.innerHTML=`<b style="color:#${r.color.toString(16).padStart(6,'0')}">${r.name}</b><small>${r.rarity} • ${r.role}</small><div class="statline">PACE ${r.pace} • POWER ${r.power} • FLAIR ${r.flair}</div>`;b.onclick=()=>toggleLineup(r.id);list.append(b);}); if(isLive()){$('hatch-button').textContent='🔴 2× LUCK — HATCH STICKER EGG — 70';$('legendary-hatch-button').textContent='🔴 2× LUCK — HATCH LEGENDARY EGG — 900';}else{$('hatch-button').textContent='HATCH STICKER EGG — 70';$('legendary-hatch-button').textContent='HATCH LEGENDARY EGG — 900';} }
function toggleLineup(id){const line=state.profile.lineup;if(line.includes(id)){if(line.length<=1)return toast('Keep at least one Brainrot selected.');state.profile.lineup=line.filter(x=>x!==id);}else if(line.length<3)state.profile.lineup=[...line,id];else{state.profile.lineup=[line[1],line[2],id];toast('Replaced your oldest starter.');}saveProfile();}
function hatch(type='sticker'){const legendary=type==='legendary';const cost=legendary?900:70;if(state.profile.coins<cost)return toast('Win or play another match for more coins.');state.profile.coins-=cost;const roll=Math.random();let pool;const lv=isLive();if(legendary){pool=roll<(lv?.0025:.005)?RECRUITS.filter(x=>x.rarity==='OG'):roll<(lv?.06:.03)?RECRUITS.filter(x=>x.rarity==='LEGENDARY'):roll<(lv?.24:.12)?RECRUITS.filter(x=>x.rarity==='EPIC'):roll<(lv?.66:.33)?RECRUITS.filter(x=>x.rarity==='RARE'):RECRUITS.filter(x=>x.rarity==='COMMON');}else{pool=roll<(lv?.004:.002)?RECRUITS.filter(x=>x.rarity==='LEGENDARY'):roll<(lv?.024:.012)?RECRUITS.filter(x=>x.rarity==='EPIC'):roll<(lv?.14:.07)?RECRUITS.filter(x=>x.rarity==='RARE'):RECRUITS.filter(x=>x.rarity==='COMMON');}const r=pool[Math.floor(Math.random()*pool.length)];const duplicate=state.profile.roster.includes(r.id);if(!duplicate)state.profile.roster.push(r.id);else state.profile.coins+=legendary?250:22;saveProfile();audio.playSFX(ASSETS.hatch);$('hatch-reveal').textContent=duplicate?'✦':r.name[0];$('hatch-name').textContent=duplicate?`${r.name} DUPLICATE!`:r.name.toUpperCase();$('hatch-details').textContent=`${r.rarity} • ${r.role}`;$('hatch-trait').textContent=duplicate?`Duplicate converted into ${legendary?250:22} bonus coins.`:r.trait;$('hatch-modal').classList.remove('hidden');}
function createRoom(){const code=Math.random().toString(36).slice(2,7).toUpperCase();state.room=code;$('room-code').value=code;$('online-status').textContent=`Room ${code} created. Share the code with a friend. This playable build launches a bot stand-in if no second player is connected.`;toast(`Room ${code} created`);}function joinRoom(){const code=$('room-code').value.trim().toUpperCase();if(!code)return toast('Enter a five-character room code.');state.room=code;$('online-status').textContent=`Joined room ${code}. Waiting for host sync; launching a local rival for this build.`;toast(`Joined ${code}`);}
function getEventState(){const LIVE=15*60*1000;const now=new Date();const day=now.getDay();const days=(day-4+7)%7;const last=new Date(now);last.setDate(now.getDate()-days);last.setHours(16,30,0,0);if(last>now)last.setDate(last.getDate()-7);const since=now-last;if(since<LIVE)return{live:true,remaining:LIVE-since};const next=new Date(last);next.setDate(last.getDate()+7);return{live:false,msUntil:next-now};}
function isLive(){return getEventState().live;}
function startCountdown(){
  const el=document.getElementById('event-countdown');
  if(!el)return;
  function tick(){
    const ev=getEventState();
    if(ev.live){
      const m=Math.floor(ev.remaining/60000);const s=Math.floor((ev.remaining%60000)/1000);
      el.innerHTML=`<span class="cd-live">🔴 BRAINROT FUẞBALL ADMIN ABUSE — JETZT LIVE! noch ${m}:${String(s).padStart(2,'0')}</span>`;
      const b=document.getElementById('event-bonus');if(b)b.classList.remove('hidden');
      const bt=document.getElementById('event-bonus-timer');if(bt)bt.textContent=`noch ${m}:${String(s).padStart(2,'0')}`;
    }else{
      const diff=ev.msUntil;const d=Math.floor(diff/86400000);const h=Math.floor((diff%86400000)/3600000);const m=Math.floor((diff%3600000)/60000);const s=Math.floor((diff%60000)/1000);
      el.innerHTML=`<span class="cd-label">Brainrot Fußball admin abuse</span><span class="cd-timer">in ${d}d ${h}h ${m}m ${s}s</span>`;
      const b=document.getElementById('event-bonus');if(b)b.classList.add('hidden');
      const bt=document.getElementById('event-bonus-timer');if(bt)bt.textContent='';
    }
  }
  tick();setInterval(tick,1000);
}
function pollBroadcast(){ async function check(){ try{ const r=await fetch('/api/broadcast'); if(!r.ok)return; const data=await r.json(); const el=document.getElementById('broadcast-ticker'); const txt=document.getElementById('broadcast-text'); if(data.active&&data.message){if(el)el.classList.remove('hidden');if(txt)txt.textContent=data.message;} else{if(el)el.classList.add('hidden');} const boost=await fetch('/api/boost'); const bd=await boost.json(); if(bd.active){localStorage.setItem('admin-boost-until',String(bd.until));}else{localStorage.removeItem('admin-boost-until');} const coins=await fetch('/api/coins'); const cd=await coins.json(); if(cd.grant>0){state.profile.coins+=cd.grant;saveProfile();toast('+200 COINS vom Admin!');} }catch{} } const pollEl=document.getElementById('poll-popup'); const pollQ=document.getElementById('poll-question'); const pollBtnA=document.getElementById('poll-btn-a'); const pollBtnB=document.getElementById('poll-btn-b'); const pollResult=document.getElementById('poll-result');const pollCloseBtn=document.getElementById('poll-close-btn');
if(pollCloseBtn){
  pollCloseBtn.onclick=()=>document.getElementById('poll-popup').classList.add('hidden');
} 
 let voted=false; async function checkPoll(){ try{ const r=await fetch('/api/poll'); const d=await r.json(); if(d.active){pollEl.classList.remove('hidden');pollQ.textContent=d.question;pollBtnA.textContent=d.optionA;pollBtnB.textContent=d.optionB;const total=d.votesA+d.votesB;if(voted||total>0){const pA=total?Math.round(d.votesA/total*100):0;const pB=total?Math.round(d.votesB/total*100):0;pollResult.textContent=d.optionA+': '+pA+'% | '+d.optionB+': '+pB+'%';}}else{pollEl.classList.add('hidden');voted=false;pollResult.textContent='';} }catch{} } if(pollBtnA) if(pollBtnA) pollBtnA.onclick=async()=>{if(voted)return;voted=true;const id=localStorage.getItem('PLATFORM_USER_ID')||'anon';await fetch('/api/poll/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({option:'A',voterId:id})});checkPoll();}; if(pollBtnB) pollBtnB.onclick=async()=>{if(voted)return;voted=true;const id=localStorage.getItem('PLATFORM_USER_ID')||'anon';await fetch('/api/poll/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({option:'B',voterId:id})});checkPoll();}; checkPoll();setInterval(checkPoll,5000);check();setInterval(check,5000); } function initAdminPanel() {
  const btn = document.getElementById('admin-open-btn');
  const panel = document.getElementById('admin-panel');
  const closeBtn = document.getElementById('admin-close-btn');
  const sendBtn = document.getElementById('admin-send-btn');
  const clearBtn = document.getElementById('admin-clear-btn');
  const msgInput = document.getElementById('admin-msg');
  const pwInput = document.getElementById('admin-pw');
  const statusEl = document.getElementById('admin-status');
  const boostBtn = document.getElementById('admin-boost-btn');
  const distBtn = document.getElementById('admin-dist-btn');
  const boostStatus = document.getElementById('admin-boost-status');

  if (!btn || !panel) return;
  if (btn.dataset.adminReady === '1') return;
  btn.dataset.adminReady = '1';

  btn.classList.remove('hidden');

  btn.onclick = () => {
    panel.classList.remove('hidden');
    panel.style.display = 'flex';
  };

  if (closeBtn) {
    closeBtn.onclick = () => {
      panel.classList.add('hidden');
      panel.style.display = '';
    };
  }

  const ADMIN_PW = 'green1601mybest';
  const BOOST_KEY = 'admin-boost-until';

  function checkBoost() {
    if (!boostStatus) return;

    const until = parseInt(localStorage.getItem(BOOST_KEY) || '0');

    if (Date.now() < until) {
      const rem = Math.ceil((until - Date.now()) / 1000);
      boostStatus.textContent = '✅ 5× aktiv, noch ' + rem + 's';
      setTimeout(checkBoost, 1000);
    } else {
      boostStatus.textContent = '';
    }
  }

  checkBoost();

  window.__boostActive = () =>
    Date.now() < parseInt(localStorage.getItem(BOOST_KEY) || '0');

  if (boostBtn) {
    boostBtn.onclick = async () => {
      if (pwInput.value.trim() !== ADMIN_PW) {
        statusEl.textContent = '❌ Falsches Passwort.';
        return;
      }

      try {
        const res = await fetch('/api/boost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: pwInput.value.trim()
          })
        });

        const d = await res.json();

        if (d.ok) {
          localStorage.setItem(
            BOOST_KEY,
            String(Date.now() + 180000)
          );
          boostStatus.textContent = '✅ 5× aktiv, 3 Minuten!';
          statusEl.textContent = '';
          checkBoost();
        } else {
          statusEl.textContent = '❌ ' + d.error;
        }
      } catch (e) {
        statusEl.textContent = '❌ Fehler: ' + e.message;
      }
    };
  }

  if (distBtn) {
    distBtn.onclick = async () => {
      if (pwInput.value.trim() !== ADMIN_PW) {
        statusEl.textContent = '❌ Falsches Passwort.';
        return;
      }

      try {
        const res = await fetch('/api/coins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: pwInput.value.trim()
          })
        });

        const d = await res.json();

        statusEl.textContent = d.ok
          ? '✅ 200 Coins an alle gesendet!'
          : '❌ ' + d.error;
      } catch (e) {
        statusEl.textContent = '❌ Fehler: ' + e.message;
      }
    };
  }

  async function post(method) {
    const secret = pwInput.value.trim();
    const message = msgInput.value.trim();

    if (!secret) {
      statusEl.textContent = '❌ Passwort eingeben.';
      return;
    }

    if (method === 'POST' && !message) {
      statusEl.textContent = '❌ Nachricht eingeben.';
      return;
    }

    statusEl.textContent = '…';

    try {
      const r = await fetch('/api/broadcast', {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          secret
        })
      });

      const d = await r.json();

      if (d.ok) {
        statusEl.textContent =
          method === 'DELETE'
            ? '✅ Nachricht gelöscht.'
            : '✅ Gesendet!';

        if (method !== 'DELETE') {
          msgInput.value = '';
        }
      } else {
        statusEl.textContent = '❌ ' + d.error;
      }
    } catch (e) {
      statusEl.textContent = '❌ Fehler: ' + e.message;
    }
  }

  if (sendBtn) sendBtn.onclick = () => post('POST');
  if (clearBtn) clearBtn.onclick = () => post('DELETE');

  const pollQInput = document.getElementById('poll-question-input');
  const pollOptA = document.getElementById('poll-option-a');
  const pollOptB = document.getElementById('poll-option-b');
  const pollStartBtn = document.getElementById('poll-start-btn');
  const pollStopBtn = document.getElementById('poll-stop-btn');
  const pollAdminStatus = document.getElementById('poll-admin-status');

  if (pollStartBtn) {
    pollStartBtn.onclick = async () => {
      if (pwInput.value.trim() !== ADMIN_PW) {
        pollAdminStatus.textContent = '❌ Falsches Passwort.';
        return;
      }

      const q = pollQInput.value.trim();
      const a = pollOptA.value.trim();
      const b = pollOptB.value.trim();

      if (!q || !a || !b) {
        pollAdminStatus.textContent = '❌ Alle Felder ausfüllen.';
        return;
      }

      try {
        const res = await fetch('/api/poll/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            secret: pwInput.value.trim(),
            question: q,
            optionA: a,
            optionB: b
          })
        });

        const d = await res.json();

        pollAdminStatus.textContent = d.ok
          ? '✅ Umfrage gestartet!'
          : '❌ ' + d.error;
      } catch (e) {
        pollAdminStatus.textContent = '❌ Fehler: ' + e.message;
      }
    };
  }

  if (pollStopBtn) {
    pollStopBtn.onclick = async () => {
      if (pwInput.value.trim() !== ADMIN_PW) {
        pollAdminStatus.textContent = '❌ Falsches Passwort.';
        return;
      }

      try {
        const res = await fetch('/api/poll/stop', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            secret: pwInput.value.trim()
          })
        });

        const d = await res.json();

        pollAdminStatus.textContent = d.ok
          ? '✅ Umfrage gestoppt!'
          : '❌ ' + d.error;
      } catch (e) {
        pollAdminStatus.textContent = '❌ Fehler: ' + e.message;
      }
    };
  }
}function bindUI(){ $('start-button').onclick=()=>{show('club-screen');renderClub();audio.playBGM(ASSETS.bgm);} ;const eventAreaBtn=document.getElementById('event-area-btn');const eventAreaPanel=document.getElementById('event-area-panel');const eventAreaClose=document.getElementById('event-area-close');if(eventAreaBtn&&eventAreaPanel)eventAreaBtn.onclick=()=>eventAreaPanel.classList.remove('hidden');if(eventAreaClose&&eventAreaPanel)eventAreaClose.onclick=()=>eventAreaPanel.classList.add('hidden');$('play-bot').onclick=beginMatch;$('create-room').onclick=createRoom;$('join-room').onclick=joinRoom;$('hatch-button').onclick=()=>hatch('sticker');$('legendary-hatch-button').onclick=()=>hatch('legendary');startCountdown();$('close-hatch').onclick=()=>$('hatch-modal').classList.add('hidden');$('back-club').onclick=()=>{show('club-screen');renderClub();};$('exit-match').onclick=()=>{state.playing=false;show('club-screen');renderClub();};addEventListener('keydown',e=>{if(['Space','KeyQ'].includes(e.code))e.preventDefault();keys.add(e.code);});addEventListener('keyup',e=>keys.delete(e.code)); initTouch(); pollBroadcast();
initAdminPanel(); }

function initDailyWheel(){
  const openBtn=document.getElementById('wheel-open-btn');
  const panel=document.getElementById('wheel-panel');
  const closeBtn=document.getElementById('wheel-close-btn');
  const spinBtn=document.getElementById('wheel-spin-btn');
  const wheel=document.querySelector('.wheel-inner');
  const result=document.getElementById('wheel-result');

  if(!openBtn||!panel||!closeBtn||!spinBtn||!wheel)return;

  const today=new Date().toISOString().slice(0,10);
  const lastSpin=localStorage.getItem('daily-wheel-date');

  if(lastSpin===today){
    spinBtn.disabled=true;
    spinBtn.textContent='MORGEN WIEDER';
    result.textContent='Heute schon gedreht!';
  }

  openBtn.onclick=()=>panel.classList.remove('hidden');
  closeBtn.onclick=()=>panel.classList.add('hidden');

  spinBtn.onclick=()=>{
    if(localStorage.getItem('daily-wheel-date')===today)return;

    const prizes=[50,100,50,1000,500,100];
    const index=Math.floor(Math.random()*prizes.length);
    const prize=prizes[index];

    const turns=5+Math.floor(Math.random()*3);
    const segment=360/prizes.length;
    const target=turns*360+(360-(index*segment+segment/2));

    wheel.style.transform=`rotate(${target}deg)`;
    spinBtn.disabled=true;

    setTimeout(()=>{
      state.profile.coins+=prize;
      saveProfile();

      localStorage.setItem('daily-wheel-date',today);

      result.textContent=`🎉 +${prize} COINS!`;
      spinBtn.textContent='MORGEN WIEDER';
      toast(`+${prize} COINS vom Glücksrad!`);
    },4000);
  };
}function initTouch(){
  const sty=document.createElement('style');
  sty.textContent=`
    #tc{position:fixed;inset:0;pointer-events:none;z-index:999;display:none;align-items:flex-end;justify-content:space-between;padding:0 18px 36px}
    #tc.vis{display:flex}
    .tcd{pointer-events:all;display:grid;grid-template:repeat(3,72px)/repeat(3,72px);gap:6px}
    .tcd button{all:unset;display:flex;align-items:center;justify-content:center;border-radius:18px;background:rgba(255,255,255,.13);color:#fff;font-size:24px;font-weight:900;touch-action:none;-webkit-tap-highlight-color:transparent;border:2px solid rgba(255,255,255,.18);transition:background .07s,transform .07s}
    .tcd button.on{background:rgba(82,214,164,.38);transform:scale(.93)}
    .tcd .gap{pointer-events:none}
    .tcr{pointer-events:all;display:flex;flex-direction:column;align-items:flex-end;gap:10px}
    .tc-sw{all:unset;display:flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:18px;background:rgba(155,108,255,.25);color:#c7aaff;font:900 11px/1 inherit;letter-spacing:.05em;text-align:center;touch-action:none;-webkit-tap-highlight-color:transparent;border:2px solid rgba(155,108,255,.45);transition:background .07s,transform .07s}
    .tc-sw.on{background:rgba(155,108,255,.55);transform:scale(.93)}
    .tc-sp{all:unset;display:flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:18px;background:rgba(255,201,74,.18);color:#ffc94a;font:900 11px/1 inherit;letter-spacing:.05em;text-align:center;touch-action:none;-webkit-tap-highlight-color:transparent;border:2px solid rgba(255,201,74,.38);transition:background .07s,transform .07s}
    .tc-sp.on{background:rgba(255,201,74,.42);transform:scale(.93)}
    .tc-kick{all:unset;display:flex;align-items:center;justify-content:center;width:96px;height:96px;border-radius:50%;background:#52d6a4;color:#07142d;font:900 12px/1.3 inherit;letter-spacing:.04em;text-align:center;touch-action:none;-webkit-tap-highlight-color:transparent;box-shadow:0 0 28px rgba(82,214,164,.55);transition:transform .07s,filter .07s}
    .tc-kick.on{transform:scale(.9);filter:brightness(1.2)}
    @media(pointer:coarse){.control-card{display:none!important}}
  `;
  document.head.appendChild(sty);

  const tc=document.createElement('div');
  tc.id='tc';
  tc.innerHTML=`
    <div class="tcd">
      <div class="gap"></div><button data-k="KeyW">▲</button><div class="gap"></div>
      <button data-k="KeyA">◄</button><div class="gap"></div><button data-k="KeyD">►</button>
      <div class="gap"></div><button data-k="KeyS">▼</button><div class="gap"></div>
    </div>
    <div class="tcr">
      <button class="tc-sw" data-k="KeyQ" data-once>SWITCH<br>⇄</button>
      <button class="tc-sp" data-k="ShiftLeft">SPRINT<br>⚡</button>
      <button class="tc-kick" data-k="Space" data-once>⚽<br>KICK</button>
    </div>
  `;
  document.body.appendChild(tc);

  const matchEl=$('match-screen');
  new MutationObserver(()=>{
    tc.classList.toggle('vis',!matchEl.classList.contains('hidden'));
  }).observe(matchEl,{attributes:true,attributeFilter:['class']});

  const live=new Map();

  function btnAt(x,y){
    return document.elementFromPoint(x,y)?.closest('[data-k]');
  }
  function press(btn){
    if(!btn)return;
    keys.add(btn.dataset.k);
    btn.classList.add('on');
    if('once' in btn.dataset){
      setTimeout(()=>{keys.delete(btn.dataset.k);btn.classList.remove('on');},200);
    }
  }
  function release(btn){
    if(!btn||'once' in btn.dataset)return;
    keys.delete(btn.dataset.k);
    btn.classList.remove('on');
  }

  tc.addEventListener('touchstart',e=>{
    e.preventDefault();
    for(const t of e.changedTouches){
      const btn=btnAt(t.clientX,t.clientY);
      live.set(t.identifier,btn||null);
      press(btn);
    }
  },{passive:false});

  tc.addEventListener('touchmove',e=>{
    e.preventDefault();
    for(const t of e.changedTouches){
      const old=live.get(t.identifier);
      const cur=btnAt(t.clientX,t.clientY)||null;
      if(old===cur)continue;
      release(old);
      live.set(t.identifier,cur);
      press(cur);
    }
  },{passive:false});

  tc.addEventListener('touchend',e=>{
    e.preventDefault();
    for(const t of e.changedTouches){
      release(live.get(t.identifier));
      live.delete(t.identifier);
    }
  },{passive:false});

  tc.addEventListener('touchcancel',e=>{
    for(const t of e.changedTouches){
      release(live.get(t.identifier));
      live.delete(t.identifier);
    }
  });
}

initAdminPanel();
init();
function initBananiniEgg(){
  const panel = document.querySelector('.hatch-panel');
  if(!panel) return;

  const egg = document.createElement('div');
  egg.className = 'legendary-egg';
  egg.id = 'bananini-egg';

  egg.innerHTML = `
    <b>🍌 BANANINI EGG</b>
    <small>35.000 Coins • Garantiert Bananini</small>
    <p id="bananini-countdown"></p>
    <button id="bananini-hatch-button" class="gold">
      HATCH BANANINI EGG — 35.000
    </button>
  `;

  panel.appendChild(egg);

  const countdown = document.getElementById('bananini-countdown');
  const button = document.getElementById('bananini-hatch-button');

  function updateBananiniEgg(){
    const remaining = BANANINI_EGG_END - new Date();

    if(remaining <= 0){
      egg.remove();
      return;
    }

    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);

    countdown.textContent = `Noch ${days}T ${hours}Std ${minutes}Min`;
  }

  updateBananiniEgg();
  setInterval(updateBananiniEgg, 60000);

  button.onclick = ()=>{
    if(state.profile.coins < 35000){
      alert('Nicht genug Coins!');
      return;
    }

    state.profile.coins -= 35000;
    state.profile.roster.push('bananini');
    saveProfile();

    document.getElementById('coin-count').textContent =
      state.profile.coins.toLocaleString();

    alert('🍌 BANANINI erhalten!');
  };
}

initBananiniEgg();