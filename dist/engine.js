import {makeDeck,shuffle,evaluate} from './cards.js';

export const PROFILES = [
  {name:'你',style:'hero',tag:'保持你的扑克脸',color:'lime'},
  {name:'LUNA',style:'tight',tag:'冷静的观察者',color:'purple'},
  {name:'RIVER',style:'balanced',tag:'难以读懂的高手',color:'blue'},
  {name:'BLAZE',style:'loose',tag:'天生的冒险家',color:'orange'}
];
export const STREETS={preflop:'翻牌前',flop:'翻牌',turn:'转牌',river:'河牌',showdown:'本局结束'};

export function addLog(s,player,text,type='action'){
  s.logs.push({id:++s.logId,hand:s.hand,street:s.stage,player,text,type});
  if(s.logs.length>160)s.logs.shift();
}

export function createGame(rng=Math.random) {
  const s={version:1,players:PROFILES.map((p,id)=>({...p,id,chips:2500})),hand:0,button:2,blind:20,logs:[],logId:0,stage:'showdown',result:null};
  return newHand(s,rng);
}

function next(s,from,predicate){for(let n=1;n<=4;n++){const i=(from+n)%4;if(predicate(s.players[i]))return i;}return null;}
const live=p=>p.inHand&&!p.folded;
const canAct=p=>live(p)&&!p.allIn;

function post(s,index,amount){
  const p=s.players[index],paid=Math.min(p.chips,amount);
  p.chips-=paid;p.bet+=paid;p.contributed+=paid;s.pot+=paid;p.allIn=p.chips===0;
  return paid;
}

export function newHand(s,rng=Math.random){
  if(s.stage!=='showdown')throw new Error('请先完成当前牌局');
  if(s.players.filter(p=>p.chips>0).length<2)return s;
  s.hand++;s.deck=shuffle(makeDeck(),rng);s.board=[];s.stage='preflop';s.pot=0;s.lastPot=0;s.result=null;s.currentBet=s.blind;s.minRaise=s.blind;
  s.players.forEach(p=>Object.assign(p,{inHand:p.chips>0,hole:[],folded:p.chips===0,allIn:false,bet:0,contributed:0,acted:false,raiseLocked:false,reopenAt:0,lastAction:'',won:0}));
  s.button=next(s,s.button,p=>p.inHand);
  const headsUp=s.players.filter(p=>p.inHand).length===2;
  s.smallBlind=headsUp?s.button:next(s,s.button,p=>p.inHand);
  s.bigBlind=next(s,s.smallBlind,p=>p.inHand);
  for(let n=0;n<2;n++)for(let j=1;j<=4;j++){const p=s.players[(s.button+j)%4];if(p.inHand)p.hole.push(s.deck.pop());}
  addLog(s,null,'第 '+String(s.hand).padStart(2,'0')+' 手 · 新的可能','round');
  const sb=post(s,s.smallBlind,s.blind/2),bb=post(s,s.bigBlind,s.blind);
  s.players[s.smallBlind].lastAction='小盲 '+sb;s.players[s.bigBlind].lastAction='大盲 '+bb;
  addLog(s,s.smallBlind,'小盲 '+sb);addLog(s,s.bigBlind,'大盲 '+bb);
  s.actor=next(s,s.bigBlind,canAct);
  progress(s,s.bigBlind);
  return s;
}

function targetBet(s,p){
  const opponents=s.players.filter(q=>live(q)&&q.id!==p.id);
  return opponents.some(q=>!q.allIn)?s.currentBet:Math.min(s.currentBet,Math.max(0,...opponents.map(q=>q.bet)));
}

export function legalActions(s){
  const p=s.players[s.actor];
  if(s.stage==='showdown'||!p||!canAct(p))return {toCall:0,canRaise:false,minTo:0,maxTo:0};
  const toCall=Math.max(0,targetBet(s,p)-p.bet),maxTo=p.bet+p.chips;
  const canRaise=!p.raiseLocked&&maxTo>s.currentBet&&s.players.some(q=>q.id!==p.id&&canAct(q));
  const fullMinTo=s.currentBet>0&&s.currentBet<s.blind?s.blind:s.currentBet+s.minRaise;
  return {toCall,callAmount:Math.min(toCall,p.chips),canCheck:toCall===0,canRaise,minTo:Math.min(maxTo,fullMinTo),fullMinTo,maxTo};
}

export function act(s,type,amount){
  if(s.stage==='showdown'||s.actor===null)throw new Error('本局已结束');
  const p=s.players[s.actor],l=legalActions(s),acting=s.actor;
  if(!['fold','check','call','raise'].includes(type))throw new Error('无效操作');
  if(type==='check'&&l.toCall>0)throw new Error('当前需要跟注');
  if(type==='raise'&&(!l.canRaise||!Number.isInteger(amount)||amount>l.maxTo||amount<=s.currentBet||(amount<l.fullMinTo&&amount!==l.maxTo)))throw new Error('加注金额无效');
  if(type==='fold'){p.folded=true;p.lastAction='弃牌';addLog(s,acting,'弃牌','fold');}
  else if(type==='check'||type==='call'){
    const paid=post(s,acting,l.toCall);
    p.lastAction=paid?(p.allIn?'全下 '+paid:'跟注 '+paid):'过牌';addLog(s,acting,p.lastAction,p.allIn?'allin':'action');
  }else{
    const previous=s.currentBet,raise=amount-previous,full=amount>=l.fullMinTo;
    post(s,acting,amount-p.bet);s.currentBet=amount;
    s.players.forEach(q=>{
      if(q.id===acting||!canAct(q))return;
      if(full){q.acted=false;q.raiseLocked=false;q.reopenAt=0;}
      else if(q.acted){q.reopenAt=q.reopenAt||previous+s.minRaise;q.raiseLocked=!(q.bet===0&&q.lastAction==='过牌')&&amount<q.reopenAt;}
    });
    if(full)s.minRaise=previous<s.blind?amount:raise;
    p.lastAction=(p.allIn?'全下 ':previous?'加注至 ':'下注 ')+amount;addLog(s,acting,p.lastAction,p.allIn?'allin':'raise');
  }
  p.acted=true;
  p.reopenAt=s.currentBet+s.minRaise;
  progress(s,acting);
  return s;
}

function progress(s,last){
  const remaining=s.players.filter(live),actionable=s.players.filter(canAct);
  if(remaining.length===1){settleShowdown(s);return;}
  if(actionable.length<=1){
    const p=actionable[0];
    if(p&&targetBet(s,p)>p.bet){s.actor=p.id;return;}
    while(s.board.length<5)dealStreet(s);
    settleShowdown(s);return;
  }
  const pending=p=>canAct(p)&&(!p.acted||p.bet<targetBet(s,p));
  const actor=next(s,last,pending);
  if(actor!==null){s.actor=actor;return;}
  if(s.stage==='river'){settleShowdown(s);return;}
  dealStreet(s);
  s.currentBet=0;s.minRaise=s.blind;
  s.players.forEach(p=>{p.bet=0;p.acted=false;p.raiseLocked=false;p.reopenAt=0;if(live(p)&&!p.allIn)p.lastAction='';});
  s.actor=next(s,s.button,canAct);
}

function dealStreet(s){
  s.deck.pop();
  const count=s.board.length===0?3:1;
  for(let i=0;i<count;i++)s.board.push(s.deck.pop());
  s.stage=s.board.length===3?'flop':s.board.length===4?'turn':'river';
  addLog(s,null,STREETS[s.stage],'street');
}

export function settleShowdown(s){
  const eligible=s.players.filter(p=>!p.folded&&p.inHand),originalPot=s.pot;
  if(!eligible.length)throw new Error('牌局缺少有效玩家');
  const uncontested=eligible.length===1,pots=[];
  s.players.forEach(p=>p.won=0);
  if(uncontested){eligible[0].won=originalPot;pots.push({amount:originalPot,winners:[eligible[0].id]});}
  else {
    const scores=Object.fromEntries(eligible.map(p=>[p.id,evaluate(p.hole.concat(s.board))]));
    const levels=[...new Set(s.players.map(p=>p.contributed).filter(Boolean))].sort((a,b)=>a-b);
    let prev=0;
    for(const level of levels){
      const contributors=s.players.filter(p=>p.contributed>=level),amount=(level-prev)*contributors.length;
      const candidates=contributors.filter(p=>!p.folded&&p.inHand);
      const best=Math.max(...candidates.map(p=>scores[p.id].value));
      const winners=candidates.filter(p=>scores[p.id].value===best).sort((a,b)=>((a.id-s.button+3)%4)-((b.id-s.button+3)%4));
      if(winners.length){const each=Math.floor(amount/winners.length),odd=amount%winners.length;winners.forEach((p,i)=>p.won+=each+(i<odd?1:0));pots.push({amount,winners:winners.map(p=>p.id)});}
      prev=level;
    }
  }
  const winners=s.players.filter(p=>p.won>0).map(p=>p.id);
  s.players.forEach(p=>p.chips+=p.won);
  s.result={winners,pots,uncontested,total:originalPot,heroNet:s.players[0].won-s.players[0].contributed};
  s.lastPot=originalPot;s.pot=0;s.actor=null;s.stage='showdown';
  for(const id of winners){const p=s.players[id];p.lastAction='收获 '+p.won;addLog(s,id,'赢得 '+p.won+(uncontested?' · 其他玩家弃牌':' · '+evaluate(p.hole.concat(s.board)).name),'win');}
  return s;
}
