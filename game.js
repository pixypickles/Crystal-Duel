(()=>{'use strict';
const c=document.getElementById('game'),x=c.getContext('2d');
const overlay=document.getElementById('overlay'),result=document.getElementById('result'),resultTitle=document.getElementById('resultTitle');
const pHp=document.getElementById('pHp'),eHp=document.getElementById('eHp'),pHpText=document.getElementById('pHpText'),eHpText=document.getElementById('eHpText'),difficultyBadge=document.getElementById('difficultyBadge'),difficultyHelp=document.getElementById('difficultyHelp');
const W=1280,H=720,TOP=82,BOTTOM=680,LANE_H=(BOTTOM-TOP)/5,CHARGE=650,MAX_HP=30;
const PX=[205,1075],CX=[72,1208],WX=[285,995];
const speed={a:330,b:500,c:720};
const damage={a:{normal:5,charged:8},b:{normal:4,charged:7},c:{normal:3,charged:6}};
const AI={easy:{moveMin:700,moveRand:700,shotMin:1050,shotRand:850,dangerGuard:.20,dangerReact:.35,track:.25,charge:.08,wall:.03,aimError:.55},normal:{moveMin:480,moveRand:580,shotMin:720,shotRand:700,dangerGuard:.38,dangerReact:.52,track:.42,charge:.18,wall:.07,aimError:.28},hard:{moveMin:350,moveRand:500,shotMin:500,shotRand:700,dangerGuard:.65,dangerReact:.78,track:.55,charge:.28,wall:.12,aimError:.10}};
let S,raf,last=0,difficulty='normal';
function player(side){return{side,lane:2,hp:MAX_HP,guard:false,wall:null,charge:null,stun:0,guardTap:-9999,aiShot:0,aiMove:0}}
function reset(started=false){S={running:started,players:[player(0),player(1)],bullets:[],particles:[],time:0,winner:null};result.classList.remove('show');overlay.classList.toggle('show',!started);syncHud()}
const ly=n=>TOP+LANE_H*(n+.5);
function hasType(side,type){return S.bullets.some(b=>b.side===side&&b.type===type&&!b.dead)}
function move(side,d){if(!S.running)return;const p=S.players[side],now=performance.now();if(now<p.stun)return;p.lane=Math.max(0,Math.min(4,p.lane+d))}
function attackDown(side,t){if(!S.running)return;const p=S.players[side],now=performance.now();if(now<p.stun||p.charge||hasType(side,t))return;p.charge={t,start:now}}
function attackUp(side,t,forcedHeld){const p=S.players[side];if(!p.charge||p.charge.t!==t)return;const now=performance.now();if(!S.running||now<p.stun||hasType(side,t)){p.charge=null;return}const held=forcedHeld??(now-p.charge.start),charged=held>=CHARGE,dir=side? -1:1;S.bullets.push({side,type:t,charged,lane:p.lane,x:PX[side]+dir*45,y:ly(p.lane),vx:speed[t]*dir,damage:damage[t][charged?'charged':'normal'],maxDamage:damage[t][charged?'charged':'normal'],r:charged?24:13,dead:false,turn:p.lane===0||p.lane===4});p.charge=null;spark(PX[side],ly(p.lane),side?'#ff88d7':'#77efff',8)}
function guardDown(side){if(!S.running)return;const p=S.players[side],now=performance.now();if(now<p.stun)return;if(now-p.guardTap<300){p.wall={lane:p.lane};p.guardTap=-9999;spark(WX[side],ly(p.lane),'#d7fbff',16)}else p.guardTap=now;p.guard=true}
function guardUp(side){S.players[side].guard=false}
function spark(px,py,col,n){for(let i=0;i<n;i++){let a=Math.random()*6.28,v=40+Math.random()*170;S.particles.push({x:px,y:py,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.35+Math.random()*.35,col})}}
function syncHud(){for(const [p,bar,txt] of [[S.players[0],pHp,pHpText],[S.players[1],eHp,eHpText]]){bar.style.width=(p.hp/MAX_HP*100)+'%';txt.textContent=p.hp}}
function finish(w){S.running=false;S.winner=w;resultTitle.textContent=w===0?'YOU WIN!':'YOU LOSE';setTimeout(()=>result.classList.add('show'),300)}
function ai(now){const a=S.players[1],you=S.players[0],d=AI[difficulty];if(now<a.stun)return;
 if(now>a.aiMove){const danger=S.bullets.find(b=>b.side===0&&!b.dead&&b.x>650&&Math.abs(b.y-ly(a.lane))<35);if(danger&&Math.random()<d.dangerReact){if(Math.random()<d.dangerGuard){if(Math.random()<d.wall){guardDown(1);guardUp(1);guardDown(1)}else guardDown(1)}else{const away=a.lane<=2?1:-1;move(1,away)}}else{let target;if(Math.random()<d.aimError)target=Math.floor(Math.random()*5);else target=Math.random()<d.track?you.lane:Math.floor(Math.random()*5);move(1,Math.sign(target-a.lane))}a.aiMove=now+d.moveMin+Math.random()*d.moveRand}
 if(now>a.aiShot){const available=['a','b','c'].filter(t=>!hasType(1,t));if(available.length){const t=available[Math.floor(Math.random()*available.length)];attackDown(1,t);attackUp(1,t,Math.random()<d.charge?800:120)}a.aiShot=now+d.shotMin+Math.random()*d.shotRand}
 if(a.guard&&now-a.guardTap>260)guardUp(1)
}
function update(dt,now){if(!S.running)return;S.time+=dt;ai(now);
 for(const b of S.bullets){if(b.dead)continue;b.x+=b.vx*dt;
   if(b.turn){const trigger=b.side===0?W*.68:W*.32;if((b.side===0&&b.x>=trigger)||(b.side===1&&b.x<=trigger)){const dy=ly(2)-b.y,step=390*dt;b.y+=Math.sign(dy)*Math.min(Math.abs(dy),step);if(Math.abs(dy)<3){b.y=ly(2);b.lane=2;b.turn=false}}else b.y=ly(b.lane)}else b.y=ly(b.lane);
   const d=S.players[1-b.side];
   if(d.wall&&Math.abs(b.y-ly(d.wall.lane))<LANE_H*.38&&Math.abs(b.x-WX[d.side])<28){d.wall=null;b.dead=true;spark(WX[d.side],b.y,'#d8fcff',20);continue}
   if(Math.abs(b.y-ly(d.lane))<35&&Math.abs(b.x-PX[d.side])<38){if(d.guard){b.dead=true;spark(PX[d.side],b.y,'#eaffff',14)}else{d.stun=now+430;d.charge=null;b.dead=true;spark(PX[d.side],b.y,'#fff',18)}continue}
   if(Math.abs(b.y-ly(2))<LANE_H*1.49&&Math.abs(b.x-CX[d.side])<42){d.hp=Math.max(0,d.hp-b.damage);b.dead=true;spark(CX[d.side],b.y,d.side?'#ff79cf':'#6beaff',24);syncHud();if(d.hp<=0)finish(1-d.side);continue}
   if(b.x<-70||b.x>W+70)b.dead=true
 }
 for(let i=0;i<S.bullets.length;i++)for(let j=i+1;j<S.bullets.length;j++){const a=S.bullets[i],b=S.bullets[j];if(a.dead||b.dead||a.side===b.side)continue;if(Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r){
 const ad=a.damage,bd=b.damage;
 if(ad===bd){a.dead=true;b.dead=true}
 else if(ad>bd){b.dead=true;a.damage=ad-bd;a.charged=a.damage>damage[a.type].normal;a.r=Math.max(8,13+(a.damage-1)*1.5)}
 else{a.dead=true;b.damage=bd-ad;b.charged=b.damage>damage[b.type].normal;b.r=Math.max(8,13+(b.damage-1)*1.5)}
 spark((a.x+b.x)/2,(a.y+b.y)/2,'#dffcff',14)}}
 S.bullets=S.bullets.filter(b=>!b.dead);for(const p of S.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.95;p.vy*=.95;p.life-=dt}S.particles=S.particles.filter(p=>p.life>0)
}
function crystal(cx,cy,col,flip){x.save();x.translate(cx,cy);x.fillStyle=col;x.shadowColor=col;x.shadowBlur=25;x.beginPath();x.moveTo(0,-130);x.lineTo(48,-45);x.lineTo(36,115);x.lineTo(0,145);x.lineTo(-36,115);x.lineTo(-48,-45);x.closePath();x.fill();x.shadowBlur=0;x.strokeStyle='#dffcff';x.lineWidth=5;x.stroke();x.restore()}
function character(p){const y=ly(p.lane),col=p.side?'#ff6bc5':'#55dfff';x.save();x.translate(PX[p.side],y);x.fillStyle=col;x.strokeStyle='#efffff';x.lineWidth=4;x.globalAlpha=performance.now()<p.stun&&Math.floor(performance.now()/70)%2?.35:1;x.beginPath();x.arc(0,-15,25,0,6.28);x.fill();x.stroke();x.fillRect(-25,12,50,55);x.strokeRect(-25,12,50,55);x.fillStyle='#071426';x.fillRect(-10,-20,7,9);x.fillRect(6,-20,7,9);if(p.guard){x.strokeStyle='#aaf7ff';x.lineWidth=10;x.beginPath();x.arc(p.side?-45:45,15,46,p.side?-1.2:1.94,p.side?1.2:4.34);x.stroke()}x.restore()}
function draw(){x.clearRect(0,0,W,H);let g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#071b33');g.addColorStop(.5,'#07101e');g.addColorStop(1,'#251027');x.fillStyle=g;x.fillRect(0,0,W,H);
 for(let i=0;i<5;i++){x.fillStyle=i%2?'#0d2034':'#0a1829';x.fillRect(0,TOP+i*LANE_H,W,LANE_H);x.strokeStyle='#35506a';x.lineWidth=2;x.strokeRect(0,TOP+i*LANE_H,W,LANE_H)}
 x.fillStyle='#ffffff12';x.fillRect(0,TOP+LANE_H,150,LANE_H*3);x.fillRect(W-150,TOP+LANE_H,150,LANE_H*3);crystal(CX[0],ly(2),'#55dfff');crystal(CX[1],ly(2),'#ff6bc5');
 for(const p of S.players){if(p.wall){x.fillStyle='#8eeeffaa';x.strokeStyle='#e8ffff';x.lineWidth=4;x.fillRect(WX[p.side]-13,ly(p.wall.lane)-LANE_H*.38,26,LANE_H*.76);x.strokeRect(WX[p.side]-13,ly(p.wall.lane)-LANE_H*.38,26,LANE_H*.76)}character(p)}
 for(const b of S.bullets){x.beginPath();x.fillStyle=b.side?'#ff7ad1':'#69eaff';x.shadowColor=x.fillStyle;x.shadowBlur=20;x.arc(b.x,b.y,b.r,0,6.28);x.fill();x.shadowBlur=0;x.fillStyle='#fff';x.beginPath();x.arc(b.x,b.y,Math.max(4,b.r*.35),0,6.28);x.fill()}
 for(const p of S.particles){x.globalAlpha=Math.max(0,p.life/.7);x.fillStyle=p.col;x.fillRect(p.x,p.y,5,5)}x.globalAlpha=1;
 for(const p of S.players){if(p.charge){const q=Math.min(1,(performance.now()-p.charge.start)/CHARGE);x.strokeStyle=p.side?'#ff90db':'#8af3ff';x.lineWidth=7;x.beginPath();x.arc(PX[p.side],ly(p.lane),42,-Math.PI/2,-Math.PI/2+q*Math.PI*2);x.stroke()}}
}
function loop(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;update(dt,t);draw();raf=requestAnimationFrame(loop)}
function start(){reset(true);overlay.classList.remove('show');result.classList.remove('show');difficultyBadge.textContent=difficulty.toUpperCase()}
document.querySelectorAll('[data-difficulty]').forEach(btn=>btn.addEventListener('click',()=>{difficulty=btn.dataset.difficulty;document.querySelectorAll('[data-difficulty]').forEach(b=>b.classList.toggle('selected',b===btn));difficultyHelp.textContent={easy:'ゆっくり反応。攻撃とチャージが控えめ',normal:'標準的な強さ',hard:'従来の強敵AI'}[difficulty]}));
document.getElementById('start').onclick=start;document.getElementById('again').onclick=start;document.getElementById('restart').onclick=start;
document.querySelectorAll('#controls button').forEach(btn=>{const a=btn.dataset.action;const down=e=>{e.preventDefault();btn.setPointerCapture?.(e.pointerId);if(a==='up')move(0,-1);else if(a==='down')move(0,1);else if(a==='guard')guardDown(0);else attackDown(0,a)};const up=e=>{e.preventDefault();if(a==='guard')guardUp(0);else if(speed[a])attackUp(0,a)};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up)});
window.addEventListener('contextmenu',e=>e.preventDefault());reset(false);raf=requestAnimationFrame(loop);
})();
