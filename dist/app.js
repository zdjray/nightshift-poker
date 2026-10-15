import {createGame,newHand,act,legalActions,PROFILES,STREETS} from './engine.js';
import {SUITS,RANKS,rank,suit,label,evaluate,equity} from './cards.js';
import {chooseAction} from './ai.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const fmt=n=>Math.abs(n).toLocaleString('en-US'),signed=n=>(n>=0?'+':'−')+fmt(n);
const icon=name=>'<svg class="icon" aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const avatar=id=>'assets/'+['','luna','river','blaze'][id]+'.svg';
const STORAGE='nightshift-session-v1';
let state,settings={sound:false,practice:false,difficulty:'normal',pace:'relaxed'};
let stats={hands:0,wins:0,best:0,lastHand:0},history=[];
let aiTimer=null,audio=null,toastTimer=null,betAmount=40,lastBoardKey='',lastHeroHand=0,coachKey='',coachValue=0,storageAvailable=true,lastAnnouncement='';

function validState(s){
  if(!s||s.version!==1||!Array.isArray(s.players)||s.players.length!==4||!Array.isArray(s.deck)||!Array.isArray(s.board)||!Array.isArray(s.logs)||!STREETS[s.stage])return false;
  if(!Number.isInteger(s.hand)||s.hand<1||![0,1,2,3].includes(s.button)||s.blind!==20||!Number.isInteger(s.pot)||s.pot<0)return false;
  if(!s.players.every((p,i)=>p.id===i&&p.name===PROFILES[i].name&&Number.isInteger(p.chips)&&p.chips>=0&&Number.isInteger(p.contributed)&&p.contributed>=0&&Number.isInteger(p.bet)&&p.bet>=0&&Array.isArray(p.hole)&&p.hole.length===(p.inHand?2:0)))return false;
  if(!s.logs.every(e=>e&&typeof e.text==='string'&&(e.player===null||[0,1,2,3].includes(e.player))))return false;
  const chips=s.players.reduce((n,p)=>n+p.chips,0)+(s.stage==='showdown'?0:s.pot);
  const cards=s.deck.concat(s.board,...s.players.map(p=>p.hole));
  return chips===10000&&cards.every(c=>Number.isInteger(c)&&c>=0&&c<52)&&new Set(cards).size===cards.length&&(s.stage==='showdown'?!!s.result:Number.isInteger(s.actor)&&s.actor>=0&&s.actor<4);
}

try{
  const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');
  if(saved){
    if(['easy','normal','hard'].includes(saved.settings?.difficulty))settings.difficulty=saved.settings.difficulty;
    if(['relaxed','quick'].includes(saved.settings?.pace))settings.pace=saved.settings.pace;
    settings.sound=saved.settings?.sound===true;settings.practice=saved.settings?.practice===true;
    if(validState(saved.state)){
      state=saved.state;
      if(saved.stats&&['hands','wins','best','lastHand'].every(k=>Number.isInteger(saved.stats[k])&&saved.stats[k]>=0))stats=saved.stats;
      if(Array.isArray(saved.history))history=saved.history.filter(h=>Number.isInteger(h.hand)&&Number.isInteger(h.net)&&Number.isInteger(h.total)).slice(-40);
    }
  }
}catch{storageAvailable=false;}
if(!state)state=createGame();

function save(){try{localStorage.setItem(STORAGE,JSON.stringify({state,settings,stats,history}));storageAvailable=true;}catch{storageAvailable=false;}}
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2900);}
function sound(kind='chip'){
  if(!settings.sound)return;
  try{
    audio??=new (window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended')audio.resume();
    const notes=kind==='win'?[523.25,659.25,783.99]:kind==='deal'?[420,540]:[1000,1450];
    notes.forEach((frequency,i)=>{
      const osc=audio.createOscillator(),gain=audio.createGain(),time=audio.currentTime+i*(kind==='win'?.1:.035);
      osc.type=kind==='win'?'sine':'triangle';osc.frequency.setValueAtTime(frequency,time);
      gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(kind==='win'?.045:.016,time+.006);gain.gain.exponentialRampToValueAtTime(.001,time+.1);
      osc.connect(gain);gain.connect(audio.destination);osc.start(time);osc.stop(time+.12);
    });
  }catch{settings.sound=false;}
}

function card(c,{back=false,placeholder=false,fresh=false}={}){
  if(back||placeholder)return '<div class="card '+(placeholder?'card-placeholder':'card-back')+'" aria-label="'+(placeholder?'待发公共牌':'未公开的底牌')+'">'+icon('spade')+'</div>';
  const r=RANKS[rank(c)]||rank(c),s=SUITS[suit(c)],red=suit(c)===1||suit(c)===3;
  const corner='<b>'+r+'</b><span>'+s+'</span>';
  return '<div class="card'+(red?' red':'')+(fresh?' fresh':'')+'" aria-label="'+label(c)+'"><div class="card-corner">'+corner+'</div><span class="card-center">'+s+'</span><div class="card-corner bottom" aria-hidden="true">'+corner+'</div></div>';
}
function hiddenCards(){return card(null,{back:true})+card(null,{back:true});}
function miniHand(p){
  if(!p.inHand)return '<div class="mini-hand"></div>';
  const reveal=state.stage==='showdown'&&!state.result.uncontested&&!p.folded;
  return '<div class="mini-hand">'+(reveal?p.hole.map(c=>card(c)).join(''):hiddenCards())+'</div>';
}
function betStack(amount){return '<div class="bet-stack"><span class="chips"><i></i><i></i><i></i><i></i></span>'+fmt(amount)+'</div>';}

function renderSeats(){
  for(let id=1;id<=3;id++){
    const p=state.players[id],active=state.actor===id,winner=state.stage==='showdown'&&p.won>0;
    const el=$('#seat-'+id);
    el.classList.toggle('active',active);el.classList.toggle('winner',winner);el.classList.toggle('folded',p.folded&&p.inHand);el.classList.toggle('out',!p.inHand);
    const dealer=state.button===id?'<span class="dealer" title="庄家">D</span>':'';
    const blind=state.stage==='preflop'&&state.bigBlind===id?'<span class="blind-marker">BB</span>':state.stage==='preflop'&&state.smallBlind===id?'<span class="blind-marker">SB</span>':'';
    el.innerHTML='<div class="seat-head"><div class="avatar-wrap"><img class="avatar" src="'+avatar(id)+'" alt="'+p.name+'">'+dealer+'</div><div class="seat-info"><div class="seat-name">'+p.name+'<span class="ai-tag">AI</span></div><div class="seat-chips">'+fmt(p.chips)+blind+'</div></div></div>'+miniHand(p)+'<div class="seat-action">'+(!p.inHand?'暂时离桌':active?'思考中 <span class="typing">···</span>':p.lastAction||'等待行动')+'</div>'+(p.bet&&state.stage!=='showdown'?betStack(p.bet):'');
  }
  const p=state.players[0],winner=state.stage==='showdown'&&p.won>0,hero=$('#hero-seat');
  hero.classList.toggle('is-turn',state.actor===0);hero.classList.toggle('is-winner',winner);
  const fresh=lastHeroHand!==state.hand;
  hero.innerHTML='<div class="hero-hand'+(p.folded?' folded':'')+(winner?' winning':'')+'" aria-label="你的底牌">'+(p.hole.length?p.hole.map(c=>card(c,{fresh})).join(''):hiddenCards())+'</div><div class="hero-info"><div class="hero-name"><span class="hero-avatar">'+icon('spade')+(state.button===0?'<span class="dealer">D</span>':'')+'</span>你<span class="you-badge">YOU</span></div><div class="hero-chips">'+fmt(p.chips)+'</div><div class="hero-status">'+(winner?'好牌，打得漂亮':p.folded?'本局已弃牌':p.allIn?'已全下 · 等待亮牌':state.actor===0?'轮到你了':p.lastAction||'保持你的扑克脸')+'</div></div>';
  lastHeroHand=state.hand;
}

function renderBoard(){
  const key=state.hand+':'+state.board.join(',');
  if(key!==lastBoardKey){
    const previous=lastBoardKey.split(':')[1]?.split(',').filter(Boolean).map(Number)||[];
    $('#board').innerHTML=Array.from({length:5},(_,i)=>i<state.board.length?card(state.board[i],{fresh:!previous.includes(state.board[i])}):card(null,{placeholder:true})).join('');
    lastBoardKey=key;
  }
  $('#pot-value').textContent=fmt(state.stage==='showdown'?state.lastPot:state.pot);
  $('#hand-number').textContent='第 '+String(state.hand).padStart(2,'0')+' 手';
  const streets=['preflop','flop','turn','river'],idx=streets.indexOf(state.stage);
  $('#street-indicator').innerHTML=streets.map((s,i)=>'<span class="street-dot'+(i<=idx||state.stage==='showdown'&&i<=Math.max(0,state.board.length-2)?' done':'')+'"></span>').join('')+'<span class="street-name">'+STREETS[state.stage]+'</span>';
}

function handType(){
  const p=state.players[0];
  if(!p.inHand)return '等待新牌局';
  if(p.folded)return '耐心也是策略';
  if(state.board.length>=3)return evaluate(p.hole.concat(state.board)).name;
  if(rank(p.hole[0])===rank(p.hole[1]))return '口袋对子';
  return suit(p.hole[0])===suit(p.hole[1])?'同花起手':'你的底牌';
}

function renderActions(){
  const hero=state.players[0],isTurn=state.actor===0,finished=state.stage==='showdown';
  const l=legalActions({...state,actor:0});
  $('#bet-controls').hidden=finished;$('#action-buttons').hidden=finished;$('#result-actions').hidden=!finished;
  $('#skip-button').hidden=finished||!(hero.folded||hero.allIn);
  $('#status-light').classList.toggle('your-turn',isTurn);
  let title,subtitle='';
  if(finished){
    const r=state.result;
    title=r.heroNet>0?'漂亮，拿下这一手！':r.heroNet===0&&hero.won>0?'好牌相遇，平分底池。':hero.chips===0?'尽兴了，就再来一场。':'下一手，还有无限可能。';
    subtitle='本局 '+signed(r.heroNet);
    const over=state.players.filter(p=>p.chips>0).length<2||hero.chips===0;
    $('#next-button').innerHTML=(over?'重新入座':'再来一手')+icon('arrow');
  }else if(isTurn){title='轮到你了';subtitle=l.toCall?'需跟注 '+fmt(l.callAmount):'可以免费过牌';}
  else if(hero.folded){title='你已弃牌';subtitle='静候这一手的结局';}
  else if(hero.allIn){title='你已全下';subtitle='让好牌自己说话';}
  else {title=state.players[state.actor]?.name+' 正在思考';subtitle='从容一点，保持节奏';}
  $('#turn-title').textContent=title;$('#turn-subtitle').textContent=subtitle;
  $('#hand-type').innerHTML=icon('cards')+'<span>'+handType()+'</span>';
  if(!finished){
    $('#fold-button').disabled=!isTurn;
    $('#call-button').disabled=!isTurn;
    const callText=l.toCall?(hero.chips<=l.toCall?'全下 ':'跟注 ')+fmt(l.callAmount):'过牌';
    $('#call-button').innerHTML=icon(l.toCall?'chip':'check')+'<span>'+callText+'</span>';
    $('#raise-button').disabled=!isTurn||!l.canRaise;
    $('#bet-slider').disabled=!isTurn||!l.canRaise;
    $$('.bet-presets button').forEach(b=>b.disabled=!isTurn||!l.canRaise);
    const min=l.minTo||40,max=Math.max(min,l.maxTo||40);
    $('#bet-slider').min=min;$('#bet-slider').max=max;$('#bet-slider').step=1;
    betAmount=min;updateBet(betAmount);
    $('.bet-label').firstChild.textContent=state.currentBet?'加注至 ':'下注至 ';
  }
  const announcement=state.hand+':'+state.stage+':'+title+':'+subtitle;
  if(announcement!==lastAnnouncement&&(isTurn||finished)){$('#game-announcement').textContent=title+'，'+subtitle+'。'+handType();lastAnnouncement=announcement;}
  renderCoach();
}

function updateBet(value){
  const slider=$('#bet-slider');betAmount=Math.max(Number(slider.min),Math.min(Number(slider.max),Math.round(value)));
  slider.value=betAmount;$('#bet-output').textContent=fmt(betAmount);$('#raise-value').textContent=fmt(betAmount);
  const max=state.players[0].chips+state.players[0].bet;
  $('#raise-button>span').textContent=betAmount===max?'全下':state.currentBet?'加注':'下注';
  const ratio=(betAmount-Number(slider.min))/(Number(slider.max)-Number(slider.min)||1)*100;
  slider.style.setProperty('--range-fill',ratio+'%');
}

function renderCoach(){
  const el=$('#coach-line'),p=state.players[0];el.hidden=!settings.practice||p.folded||state.stage==='showdown'||!p.inHand;
  if(el.hidden)return;
  const count=state.players.filter(q=>q.inHand&&!q.folded&&q.id!==0).length;
  const key=p.hole.join(',')+':'+state.board.join(',')+':'+count;
  if(key!==coachKey){coachValue=equity(p.hole,state.board,count,240);coachKey=key;}
  const l=legalActions({...state,actor:0}),odds=l.toCall/(state.pot+l.toCall||1);
  const tip=l.toCall&&coachValue<odds+.03?'跟注代价偏高，耐心也是策略。':coachValue>.6?'牌力不错，可以考虑价值下注。':l.toCall?'比较胜率与跟注成本，再做决定。':'可以过牌观察，给下一张牌一点空间。';
  el.innerHTML=icon('spark')+'<strong>估算胜率 '+Math.round(coachValue*100)+'%</strong><small>基于未知牌模拟</small><span>'+tip+'</span>';
}

function recordResult(){
  if(state.stage!=='showdown'||stats.lastHand===state.hand)return;
  stats.lastHand=state.hand;stats.hands++;if(state.result.heroNet>0){stats.wins++;stats.best=Math.max(stats.best,state.players[0].won);}
  history.push({hand:state.hand,net:state.result.heroNet,total:state.result.total,winners:state.result.winners.map(i=>state.players[i].name).join('、'),type:state.result.uncontested?'其他玩家弃牌':state.players[0].folded?'你已弃牌':evaluate(state.players[0].hole.concat(state.board)).name});
  history=history.slice(-40);
}

function sessionNet(){const p=state.players[0];return p.chips+(state.stage==='showdown'?0:p.contributed)-2500;}
function renderStats(){
  const net=sessionNet(),el=$('#net-value');el.innerHTML=signed(net)+'<span>CHIPS</span>';el.classList.toggle('negative',net<0);
  $('#hands-stat').textContent=String(stats.hands).padStart(2,'0');$('#wins-stat').textContent=stats.hands?Math.round(stats.wins/stats.hands*100)+'%':'—';$('#best-stat').textContent=stats.best?fmt(stats.best):'—';
  let cumulative=0;const points=[0,...history.map(h=>cumulative+=h.net)].slice(-20),low=Math.min(-30,...points),high=Math.max(30,...points);
  const path=points.length<2?'M0 20H230':points.map((n,i)=>(i?'L':'M')+(i/(points.length-1)*230).toFixed(1)+' '+(27-(n-low)/(high-low)*24).toFixed(1)).join(' ');
  $('#sparkline-path').setAttribute('d',path);
}

function logMarkup(entry){
  if(entry.player===null)return '<div class="log-entry round">'+entry.text+'</div>';
  return '<div class="log-entry '+entry.type+'"><span class="log-dot"></span><span class="log-player'+(entry.player===0?' you':'')+'">'+PROFILES[entry.player].name+'</span><span class="log-text">'+entry.text+'</span></div>';
}
function renderSettings(){
  $('#sound-button').innerHTML=icon(settings.sound?'volume':'muted');$('#sound-button').setAttribute('aria-label',settings.sound?'关闭音效':'开启音效');$('#sound-button').title=settings.sound?'关闭音效':'开启音效';
  $('#sound-switch').setAttribute('aria-checked',settings.sound);$('#practice-switch').setAttribute('aria-checked',settings.practice);
  $('#classic-mode').classList.toggle('selected',!settings.practice);$('#practice-mode').classList.toggle('selected',settings.practice);
  $('#classic-mode').setAttribute('aria-pressed',!settings.practice);$('#practice-mode').setAttribute('aria-pressed',settings.practice);
  $$('[data-difficulty]').forEach(b=>{const selected=b.dataset.difficulty===settings.difficulty;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected);});
  $$('[data-pace]').forEach(b=>{const selected=b.dataset.pace===settings.pace;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected);});
  $('#save-note').textContent=storageAvailable?'进度自动保存在当前浏览器，回来可继续玩。':'当前浏览器无法保存进度，本次仍可正常游玩。';
}

function render(){
  recordResult();renderSeats();renderBoard();renderActions();renderStats();renderSettings();
  $('#log-list').innerHTML=state.logs.slice(-5).map(logMarkup).join('');
  save();scheduleBot();
}
function clearBot(){clearTimeout(aiTimer);aiTimer=null;}
function scheduleBot(){
  clearBot();if(state.stage==='showdown'||state.actor===0||document.hidden||$('dialog[open]'))return;
  aiTimer=setTimeout(()=>{
    aiTimer=null;
    try{const a=chooseAction(state,settings.difficulty);act(state,a.type,a.amount);sound(state.stage==='showdown'&&state.result.heroNet>0?'win':'chip');render();}
    catch(error){toast('牌局暂时停下了，请打开设置重新入座。');console.error(error);}
  },(settings.pace==='quick'?370:850)+Math.random()*(settings.pace==='quick'?140:400));
}
function heroAction(type){
  if(state.actor!==0||state.stage==='showdown')return;
  clearBot();try{act(state,type,type==='raise'?betAmount:undefined);sound(state.stage==='showdown'&&state.result.heroNet>0?'win':'chip');render();}catch(error){toast(error.message);render();}
}

function openDialog(id){
  clearBot();
  if(id==='history-dialog')renderHistory();if(id==='settings-dialog')renderSettings();if(id==='settlement-dialog')renderSettlement();
  $('#'+id).showModal();
}
function renderHistory(){
  $('#history-stats').innerHTML='<div><span>净赢筹码</span><b class="profit">'+signed(sessionNet())+'</b></div><div><span>已玩手数</span><b>'+stats.hands+'</b></div><div><span>获胜率</span><b>'+(stats.hands?Math.round(stats.wins/stats.hands*100)+'%':'—')+'</b></div>';
  $('#hand-history').innerHTML=history.length?history.slice().reverse().map(h=>'<div class="history-hand"><div><strong>第 '+String(h.hand).padStart(2,'0')+' 手</strong><p>'+h.type+' · 底池 '+fmt(h.total)+'</p></div><span class="history-net'+(h.net>=0?' positive':'')+'">'+signed(h.net)+'</span></div>').join(''):'<p class="empty-history">夜晚才刚开始。完成第一手牌，你的故事就会出现在这里。</p>';
  $('#full-log').innerHTML=state.logs.slice().reverse().map(logMarkup).join('');
}
function renderSettlement(){
  if(!state.result)return;
  const r=state.result;
  $('#settlement-body').innerHTML='<div class="settlement-total"><span>第 '+state.hand+' 手 · 本局总底池</span><b>'+fmt(r.total)+'</b></div>'+(state.board.length?'<div class="board" style="margin-bottom:12px">'+state.board.map(c=>card(c)).join('')+'</div>':'')+state.players.filter(p=>p.inHand).map(p=>{
    const reveal=p.id===0||!p.folded&&!r.uncontested;
    const description=p.folded?'已弃牌':r.uncontested?'无需亮牌':evaluate(p.hole.concat(state.board)).name;
    return '<div class="settlement-row">'+(p.id?'<img src="'+avatar(p.id)+'" alt="'+p.name+'">':'<div class="settlement-you">'+icon('spade')+'</div>')+'<div class="settlement-info"><strong>'+p.name+'</strong><p>'+description+'</p></div><div class="mini-hand">'+(reveal?p.hole.map(c=>card(c)).join(''):hiddenCards())+'</div><div class="settlement-payout">'+(p.won?'+'+fmt(p.won):'—')+'</div></div>';
  }).join('')+'<div class="pot-breakdown">'+r.pots.map((pot,i)=>(i?'边池 '+i:'主池')+' · '+fmt(pot.amount)+' → '+pot.winners.map(id=>state.players[id].name).join('、')).join('<br>')+'<br>你的本局净收益 '+signed(r.heroNet)+'</div>';
}

function toggleSound(){settings.sound=!settings.sound;if(settings.sound)sound('deal');renderSettings();save();}
function setPractice(enabled){if(settings.practice===enabled)return;settings.practice=enabled;render();toast(enabled?'练习模式 · 胜率为模拟估算，仅供策略参考':'经典牌局 · 相信你的判断');}
function resetGame(){
  clearBot();state=createGame();stats={hands:0,wins:0,best:0,lastHand:0};history=[];lastBoardKey='';lastHeroHand=0;coachKey='';
  $$('dialog[open]').forEach(d=>d.close());$('#reset-confirm').hidden=true;sound('deal');render();toast('重新入座。每位玩家拥有 2,500 筹码。');
}

$('#fold-button').addEventListener('click',()=>heroAction('fold'));
$('#call-button').addEventListener('click',()=>heroAction(legalActions(state).toCall?'call':'check'));
$('#raise-button').addEventListener('click',()=>heroAction('raise'));
$('#bet-slider').addEventListener('input',e=>updateBet(Number(e.target.value)));
$$('[data-bet]').forEach(b=>b.addEventListener('click',()=>{
  const l=legalActions(state);if(state.actor!==0||!l.canRaise)return;
  const fraction=b.dataset.bet==='half'?.5:1;
  updateBet(b.dataset.bet==='all'?l.maxTo:Math.min(l.maxTo,Math.max(l.minTo,state.currentBet+Math.round((state.pot+l.toCall)*fraction/10)*10)));
}));
$('#next-button').addEventListener('click',()=>{
  if(state.stage!=='showdown')return;
  if(state.players[0].chips===0||state.players.filter(p=>p.chips>0).length<2){resetGame();return;}
  newHand(state);sound('deal');render();
});
$('#skip-button').addEventListener('click',()=>{
  if(!state.players[0].folded&&!state.players[0].allIn)return;
  clearBot();let guard=0;
  try{while(state.stage!=='showdown'&&state.actor!==0&&guard++<160){const a=chooseAction(state,settings.difficulty);act(state,a.type,a.amount);}sound(state.result?.heroNet>0?'win':'deal');render();}catch(error){toast(error.message);render();}
});
$('#rules-button').addEventListener('click',()=>openDialog('rules-dialog'));
$('#settings-button').addEventListener('click',()=>openDialog('settings-dialog'));
$('#history-button').addEventListener('click',()=>openDialog('history-dialog'));
$('#mobile-history').addEventListener('click',()=>openDialog('history-dialog'));
$('#settlement-button').addEventListener('click',()=>openDialog('settlement-dialog'));
$('#sound-button').addEventListener('click',toggleSound);$('#sound-switch').addEventListener('click',toggleSound);
$('#classic-mode').addEventListener('click',()=>setPractice(false));$('#practice-mode').addEventListener('click',()=>setPractice(true));
$('#practice-switch').addEventListener('click',()=>setPractice(!settings.practice));
$$('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{settings.difficulty=b.dataset.difficulty;renderSettings();save();}));
$$('[data-pace]').forEach(b=>b.addEventListener('click',()=>{settings.pace=b.dataset.pace;renderSettings();save();}));
$('#reset-button').addEventListener('click',()=>{$('#reset-confirm').hidden=!$('#reset-confirm').hidden;});
$('#confirm-reset').addEventListener('click',resetGame);
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(dialog=>{
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{$('#reset-confirm').hidden=true;scheduleBot();});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearBot();else scheduleBot();});
window.addEventListener('pagehide',()=>{clearBot();save();});
document.addEventListener('keydown',e=>{
  if(e.repeat||$('dialog[open]')||state.actor!==0||['INPUT','BUTTON'].includes(document.activeElement?.tagName))return;
  if(e.key.toLowerCase()==='f')heroAction('fold');
  if(e.key.toLowerCase()==='c')heroAction(legalActions(state).toCall?'call':'check');
});

$('#opponent-list').innerHTML=PROFILES.slice(1).map((p,i)=>'<div class="opponent-row"><img src="'+avatar(i+1)+'" alt=""><div class="opponent-copy"><strong>'+p.name+'</strong><p>'+p.tag+'</p></div><span class="style-pill '+p.color+'">'+['谨慎','均衡','激进'][i]+'</span></div>').join('');
render();
