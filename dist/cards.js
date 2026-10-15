export const SUITS = ['♠','♥','♣','♦'];
export const RANKS = {11:'J',12:'Q',13:'K',14:'A'};
export const rank = c => c%13+2;
export const suit = c => Math.floor(c/13);
export const label = c => (RANKS[rank(c)]||rank(c))+SUITS[suit(c)];
export const makeDeck = () => Array.from({length:52},(_,i)=>i);

export function shuffle(deck,rng=Math.random) {
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  return deck;
}

function straightHigh(ranks) {
  const unique=[...new Set(ranks)].sort((a,b)=>b-a);
  if(unique[0]===14)unique.push(1);
  let run=1;
  for(let i=1;i<unique.length;i++){
    run=unique[i]===unique[i-1]-1?run+1:1;
    if(run===5)return unique[i]+4;
  }
  return 0;
}

export function evaluate(cards) {
  const counts=Array(15).fill(0),suits=[[],[],[],[]];
  for(const c of cards){counts[rank(c)]++;suits[suit(c)].push(rank(c));}
  const ordered=[];for(let r=14;r>=2;r--)if(counts[r])ordered.push(r);
  const groups=n=>ordered.filter(r=>counts[r]>=n);
  const flush=suits.find(x=>x.length>=5)?.sort((a,b)=>b-a);
  const sf=flush&&straightHigh(flush),straight=straightHigh(ordered),quad=groups(4),trips=groups(3),pairs=groups(2);
  let category=0,kickers=ordered.slice(0,5);
  if(sf){category=8;kickers=[sf];}
  else if(quad.length){category=7;kickers=[quad[0],...ordered.filter(r=>r!==quad[0]).slice(0,1)];}
  else if(trips.length&&pairs.some(r=>r!==trips[0])){category=6;kickers=[trips[0],pairs.find(r=>r!==trips[0])];}
  else if(flush){category=5;kickers=flush.slice(0,5);}
  else if(straight){category=4;kickers=[straight];}
  else if(trips.length){category=3;kickers=[trips[0],...ordered.filter(r=>r!==trips[0]).slice(0,2)];}
  else if(pairs.length>=2){category=2;kickers=[...pairs.slice(0,2),...ordered.filter(r=>!pairs.slice(0,2).includes(r)).slice(0,1)];}
  else if(pairs.length){category=1;kickers=[pairs[0],...ordered.filter(r=>r!==pairs[0]).slice(0,3)];}
  let value=category;for(let i=0;i<5;i++)value=value*15+(kickers[i]||0);
  const name=category===8&&kickers[0]===14?'皇家同花顺':['高牌','一对','两对','三条','顺子','同花','葫芦','四条','同花顺'][category];
  return {value,category,kickers,name};
}

// Only the observer's cards and public cards enter this simulation.
export function equity(hole,board,opponents=1,samples=120,rng=Math.random) {
  if(opponents<1)return 1;
  const known=new Set([...hole,...board]),available=makeDeck().filter(c=>!known.has(c));
  const needed=5-board.length+opponents*2;
  let wins=0;
  for(let n=0;n<samples;n++){
    const pool=available.slice();
    for(let i=0;i<needed;i++){const j=i+Math.floor(rng()*(pool.length-i));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const community=board.concat(pool.slice(0,5-board.length));
    const hero=evaluate(hole.concat(community)).value;
    let ties=1,beat=false;
    for(let o=0;o<opponents;o++){
      const offset=5-board.length+o*2;
      const score=evaluate(community.concat(pool[offset],pool[offset+1])).value;
      if(score>hero){beat=true;break;}if(score===hero)ties++;
    }
    if(!beat)wins+=1/ties;
  }
  return wins/samples;
}
