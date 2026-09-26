const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const rooms = new Map();
const GOAL = 24;
const TURN_MS = 20000;
const ships = ['Comet', 'Voyager', 'Nebula', 'Pulsar', 'Nova', 'Cosmos', 'Orbit', 'Stellar'];
const questions = [
  ['Which planet has the most prominent ring system?', ['Jupiter','Saturn','Uranus','Neptune'],1,'SOLAR SYSTEM'],
  ['What is the closest star to Earth?', ['Sirius','Proxima Centauri','The Sun','Alpha Centauri A'],2,'STARS'],
  ['What is the event horizon of a black hole?', ['Its brightest ring','The point beyond which light cannot escape','Its center','A nearby orbit'],1,'BLACK HOLES'],
  ['What galaxy contains our Solar System?', ['Andromeda','Whirlpool','Milky Way','Sombrero'],2,'GALAXIES'],
  ['What is an exoplanet?', ['A planet outside our Solar System','A planet with rings','A moon beyond Neptune','A failed star'],0,'EXOPLANETS'],
  ['Which telescope launched in 2021 to observe infrared light?', ['Hubble','Kepler','James Webb Space Telescope','Chandra'],2,'TELESCOPES'],
  ['Which mission first landed humans on the Moon?', ['Apollo 8','Apollo 11','Gemini 4','Artemis I'],1,'SPACE MISSIONS'],
  ['What causes the phases of the Moon?', ['Earth’s shadow every night','Clouds covering the Moon','Changing views of its sunlit half as it orbits Earth','The Moon changing shape'],2,'BASIC ASTRONOMY'],
  ['Which planet is known as the Red Planet?', ['Venus','Mars','Mercury','Jupiter'],1,'SOLAR SYSTEM'],
  ['What is the main fuel that powers the Sun?', ['Burning oxygen','Nuclear fusion of hydrogen','Radioactive rocks','Electricity'],1,'STARS'],
  ['What type of galaxy is the Milky Way?', ['Elliptical','Irregular','Spiral barred','Ring'],2,'GALAXIES'],
  ['Which NASA rover landed on Mars in 2021?', ['Curiosity','Perseverance','Spirit','Sojourner'],1,'SPACE MISSIONS'],
  ['A light-year measures what?', ['Time','Brightness','Distance','Speed'],2,'BASIC ASTRONOMY'],
  ['What is a nebula?', ['A cloud of gas and dust in space','A small black hole','A type of asteroid','A star cluster only'],0,'DEEP SPACE'],
  ['Which planet has the Great Red Spot?', ['Saturn','Mars','Jupiter','Neptune'],2,'SOLAR SYSTEM'],
  ['What does a telescope primarily collect?', ['Sound waves','Light','Gravity','Solar wind'],1,'TELESCOPES']
];
function code(){ let s=''; do { s=Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join(''); } while(rooms.has(s)); return s; }
function publicRoom(r){ return { code:r.code, status:r.status, players:r.players.map(p=>({id:p.id,name:p.name,ship:p.ship,pos:p.pos,inventory:p.inventory,connected:p.connected,shield:p.shield})), turn:r.turn, question:r.question ? {...r.question, endsAt:r.endsAt} : null, lastEvent:r.lastEvent, winner:r.winner, rankings:r.rankings, goal:GOAL }; }
function broadcast(r){ io.to(r.code).emit('state', publicRoom(r)); }
function nextQuestion(r){ if(r.status!=='racing'||!r.players.length)return; const q=questions[Math.floor(Math.random()*questions.length)]; const p=r.players[r.turn]; const duration=p?.penalty?15000:TURN_MS; if(p)p.penalty=false; r.question={text:q[0],choices:q[1],category:q[3],id:Math.random().toString(36).slice(2)}; r.endsAt=Date.now()+duration; if(r.timer)clearTimeout(r.timer); r.timer=setTimeout(()=>answer(r,r.players[r.turn]?.id,-1,true),duration); }
function answer(r,id,choice,timeout=false){
 const p=r.players[r.turn]; if(!p||p.id!==id||r.status!=='racing'||!r.question)return;
 clearTimeout(r.timer); const q=questions.find(x=>x[0]===r.question.text); const correct=!timeout&&choice===q[2];
 if(correct){p.pos=Math.min(GOAL,p.pos+2); r.lastEvent=`${p.name} got it right · +2 light-years`;}
 else { if(p.shield){p.shield=false;r.lastEvent=`${p.name} missed, but their Shield blocked the penalty`; } else { p.penalty=true; r.lastEvent=timeout?`${p.name} ran out of time · next turn timer −5s`:`${p.name} missed · next turn timer −5s`; } }
 if(p.pos>=GOAL){ r.status='finished'; r.winner=p.id; r.rankings=[...r.players].sort((a,b)=>b.pos-a.pos).map((x,i)=>({id:x.id,name:x.name,ship:x.ship,pos:x.pos,rank:i+1})); r.question=null; broadcast(r);return; }
 const power=Math.random(); if(power<.31){const type=['meteor','warp','shield','blackhole'][Math.floor(Math.random()*4)]; if(p.inventory[type]<2){p.inventory[type]++;r.lastEvent+=` · ${type==='blackhole'?'Black Hole':type==='meteor'?'Meteor Boost':type==='warp'?'Warp Drive':'Shield'} acquired`;}}
 r.turn=(r.turn+1)%r.players.length; r.question=null; broadcast(r); setTimeout(()=>{if(r.status==='racing') {nextQuestion(r);broadcast(r);}},1400);
}
function validText(v,max){return typeof v==='string'?v.trim().slice(0,max):'';}
io.on('connection',socket=>{
 socket.on('create',({name,ship},cb=()=>{})=>{const n=validText(name,18)||'Star Pilot';const r={code:code(),players:[{id:socket.id,name:n,ship:ships.includes(ship)?ship:'Comet',pos:0,inventory:{meteor:0,warp:0,shield:0,blackhole:0},connected:true,shield:false}],status:'lobby',turn:0,question:null,lastEvent:'Room created. Invite a pilot to join.',winner:null,rankings:[]};rooms.set(r.code,r);socket.join(r.code);socket.data.room=r.code;cb({ok:true,code:r.code});broadcast(r);});
 socket.on('join',({code:raw,name,ship},cb=()=>{})=>{const c=validText(raw,8).toUpperCase();const r=rooms.get(c);if(!r)return cb({ok:false,error:'Room not found. Check the code and try again.'});if(r.status!=='lobby')return cb({ok:false,error:'This race has already started.'});if(r.players.length>=4)return cb({ok:false,error:'This room is full (4 pilots maximum).'});if(r.players.some(p=>p.name.toLowerCase()===validText(name,18).toLowerCase()))return cb({ok:false,error:'That pilot name is already taken.'});const p={id:socket.id,name:validText(name,18)||'Star Pilot',ship:ships.includes(ship)?ship:ships[r.players.length],pos:0,inventory:{meteor:0,warp:0,shield:0,blackhole:0},connected:true,shield:false};r.players.push(p);socket.join(r.code);socket.data.room=r.code;r.lastEvent=`${p.name} joined the crew.`;broadcast(r);cb({ok:true,code:r.code});});
 socket.on('start',()=>{const r=rooms.get(socket.data.room);if(!r||r.status!=='lobby'||r.players[0]?.id!==socket.id||r.players.length<2)return;r.status='racing';r.turn=0;r.lastEvent='Engines ignited. First to Andromeda wins!';nextQuestion(r);broadcast(r);});
 socket.on('answer',({choice})=>{const r=rooms.get(socket.data.room);if(r)answer(r,socket.id,choice);});
 socket.on('powerup',({type,targetId})=>{const r=rooms.get(socket.data.room);if(!r||r.status!=='racing'||r.players[r.turn]?.id!==socket.id)return;const p=r.players[r.turn];if(!p.inventory[type])return; if(type==='blackhole'){const target=r.players.find(x=>x.id===targetId&&x.id!==p.id);if(!target)return;target.pos=Math.max(0,target.pos-2);r.lastEvent=`${p.name} sent ${target.name} into a Black Hole · −2`; }else if(type==='meteor'||type==='warp'){const amount=type==='meteor'?2:3;p.pos=Math.min(GOAL,p.pos+amount);r.lastEvent=`${p.name} used ${type==='meteor'?'Meteor Boost':'Warp Drive'} · +${amount}`;}else if(type==='shield'){p.shield=true;r.lastEvent=`${p.name} activated a Shield`;}p.inventory[type]--;if(p.pos>=GOAL){r.status='finished';r.winner=p.id;r.question=null;r.rankings=[...r.players].sort((a,b)=>b.pos-a.pos).map((x,i)=>({id:x.id,name:x.name,ship:x.ship,pos:x.pos,rank:i+1}));}else if(type==='meteor'||type==='warp'){clearTimeout(r.timer);r.turn=(r.turn+1)%r.players.length;r.question=null;setTimeout(()=>{if(r.status==='racing'){nextQuestion(r);broadcast(r);}},1100);}broadcast(r);});
 socket.on('playAgain',()=>{const r=rooms.get(socket.data.room);if(!r||r.status!=='finished'||r.players[0]?.id!==socket.id)return;for(const p of r.players){p.pos=0;p.inventory={meteor:0,warp:0,shield:0,blackhole:0};p.shield=false;}r.status='lobby';r.turn=0;r.question=null;r.winner=null;r.rankings=[];r.lastEvent='New race ready. Invite your crew!';broadcast(r);});
 socket.on('disconnect',()=>{const r=rooms.get(socket.data.room);if(!r)return;const p=r.players.find(x=>x.id===socket.id);if(p)p.connected=false;if(r.status==='lobby'&&!r.players.some(x=>x.connected)){rooms.delete(r.code);}else broadcast(r);});
});
const port=process.env.PORT||3000;server.listen(port,'0.0.0.0',()=>console.log(`Astro Race ready on ${port}`));

