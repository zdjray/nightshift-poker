import {equity} from './cards.js';
import {legalActions} from './engine.js';

export function chooseAction(state,difficulty='normal',rng=Math.random){
  const p=state.players[state.actor],l=legalActions(state);
  const count=state.players.filter(q=>q.inHand&&!q.folded&&q.id!==p.id).length;
  const samples={easy:50,normal:110,hard:210}[difficulty]||110;
  const estimate=equity(p.hole,state.board,count,samples,rng);
  const noise=(rng()-.5)*({easy:.22,normal:.08,hard:.025}[difficulty]||.08);
  const strength=Math.max(0,Math.min(1,estimate+noise));
  const style=p.style==='hero'?'balanced':p.style;
  const caution={tight:.065,balanced:.015,loose:-.045}[style];
  const bluff=rng()<({tight:.035,balanced:.08,loose:.17}[style]);
  const odds=l.toCall/(state.pot+l.toCall||1);
  const threshold=1/(count+1)+.17+caution;
  if(l.canRaise&&((strength>threshold&&rng()<.62)||bluff)){
    const fraction=strength>.7?.85:style==='loose'?.65:.5;
    const target=state.currentBet+Math.max(state.minRaise,Math.round((state.pot+l.toCall)*fraction/10)*10);
    if(target>=l.maxTo&&strength<.38&&!bluff)return {type:l.toCall?'call':'check'};
    return {type:'raise',amount:Math.min(l.maxTo,Math.max(l.minTo,target))};
  }
  if(l.toCall===0)return {type:'check'};
  if(strength>odds+caution||l.toCall<=state.blind&&strength>.16||bluff)return {type:'call'};
  return {type:'fold'};
}
