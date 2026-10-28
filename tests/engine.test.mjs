import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, makeDeck, equity } from '../dist/cards.js';
import { createGame, newHand, act, legalActions, settleShowdown } from '../dist/engine.js';
import { chooseAction } from '../dist/ai.js';

const card = (rank,suit=0) => suit*13+rank-2;
const cards = (...ranks) => ranks.map((r,i)=>card(r,i%4));
function seeded(seed=427) { return () => { seed = (Math.imul(1664525,seed)+1013904223)>>>0; return seed/4294967296; }; }
const total = s => s.players.reduce((n,p)=>n+p.chips,0)+(s.stage==='showdown'?0:s.pot);

test('deck contains all 52 unique cards',()=>{assert.equal(makeDeck().length,52);assert.equal(new Set(makeDeck()).size,52);});
test('ace-low straight is five-high and loses to six-high',()=>{
  const wheel=evaluate(cards(14,2,3,4,5,9,11));
  assert.equal(wheel.category,4);
  assert.ok(wheel.value<evaluate(cards(2,3,4,5,6,9,11)).value);
});
test('two trips choose the higher full house',()=>{
  const result=evaluate([card(14,0),card(14,1),card(14,2),card(13,0),card(13,1),card(13,2),card(2,0)]);
  assert.equal(result.category,6); assert.equal(result.kickers[0],14); assert.equal(result.kickers[1],13);
});
test('flush uses its five best cards and includes the last kicker',()=>{
  const a=evaluate([14,12,9,7,4,3].map(r=>card(r,1)).concat(card(13,0)));
  const b=evaluate([14,12,9,7,2].map(r=>card(r,1)).concat(card(13,0),card(11,2)));
  assert.equal(a.category,5);assert.ok(a.value>b.value);
});
test('every hand class ranks above the previous one',()=>{
  const hands=[cards(14,11,9,7,5,3,2),cards(14,14,9,7,5,3,2),cards(14,14,9,9,5,3,2),cards(14,14,14,9,5,3,2),cards(10,9,8,7,6,2,3),[14,11,9,7,5].map(r=>card(r,1)).concat(card(2,0),card(3,0)),cards(14,14,14,9,9,3,2),[0,1,2,3].map(s=>card(14,s)).concat(cards(9,3,2)),[10,11,12,13,14].map(r=>card(r,2)).concat(card(2,0),card(3,0))];
  for(let i=0;i<hands.length;i++){assert.equal(evaluate(hands[i]).category,i);if(i)assert.ok(evaluate(hands[i]).value>evaluate(hands[i-1]).value);}
});
test('a royal board ties all hole cards',()=>{
  const board=[10,11,12,13,14].map(r=>card(r,0));
  assert.equal(evaluate(board.concat(card(2,1),card(3,1))).value,evaluate(board.concat(card(14,1),card(14,2))).value);
  assert.equal(equity([card(2,1),card(3,1)],board,3,30,seeded()),0.25);
});
test('new game posts blinds, deals unique cards, and preserves 10,000 chips',()=>{
  const s=createGame(seeded());assert.equal(total(s),10000);assert.equal(s.pot,30);assert.equal(s.players.filter(p=>p.bet>0).length,2);
  assert.equal(new Set(s.players.flatMap(p=>p.hole).concat(s.deck)).size,52);
});
test('illegal raise is rejected without changing state',()=>{
  const s=createGame(seeded()); const before=JSON.stringify(s); assert.throws(()=>act(s,'raise',21)); assert.equal(JSON.stringify(s),before);
});
test('folded players cannot receive side pots and uncalled excess is returned',()=>{
  const s=createGame(seeded());s.board=[card(2,0),card(3,1),card(7,2),card(8,3),card(9,0)];
  const contributed=[100,200,300,300];
  s.players.forEach((p,i)=>Object.assign(p,{hole:[card(14-i,1),card(14-i,2)],contributed:contributed[i],chips:2500-contributed[i],folded:false,allIn:true}));s.pot=900;
  settleShowdown(s);assert.deepEqual(s.players.map(p=>p.won),[400,300,200,0]);assert.equal(total(s),10000);
});
test('odd split chip goes to the first winner clockwise after dealer',()=>{
  const s=createGame(seeded());s.button=0;s.board=[10,11,12,13,14].map(r=>card(r,0));
  s.players.forEach((p,i)=>Object.assign(p,{contributed:i===3?0:1,chips:2500-(i===3?0:1),folded:i>=2,hole:[card(2+i,1),card(6+i,2)]}));s.pot=3;
  settleShowdown(s);assert.equal(s.players[1].won,2);assert.equal(s.players[0].won,1);assert.equal(s.players[2].won,0);assert.equal(total(s),10000);
});
test('a short all-in does not reopen raising for a previous caller',()=>{
  const s=createGame(seeded());s.currentBet=100;s.minRaise=100;s.actor=1;s.pot=300;
  s.players.forEach((p,i)=>Object.assign(p,{bet:i===3?0:100,contributed:i===3?0:100,acted:i!==1,raiseLocked:false,folded:i===3,allIn:false,chips:i===1?50:500}));
  act(s,'raise',150);assert.equal(s.actor,2);const l=legalActions(s);assert.equal(l.toCall,50);assert.equal(l.canRaise,false);
  assert.throws(()=>act(s,'raise',300));act(s,'call');assert.equal(s.actor,0);assert.equal(legalActions(s).canRaise,false);
});
test('a player who checked may complete a short opening all-in to the minimum bet',()=>{
  const s=createGame(seeded());s.stage='flop';s.currentBet=0;s.minRaise=20;s.actor=1;s.pot=80;
  s.players.forEach((p,i)=>Object.assign(p,{bet:0,contributed:20,chips:i===1?5:500,folded:i>1,acted:i===0,raiseLocked:false,reopenAt:i===0?20:0,lastAction:i===0?'过牌':''}));
  act(s,'raise',5);assert.equal(s.actor,0);assert.equal(legalActions(s).canRaise,false);
  // A third player with chips is needed to allow an additional bet.
  const t=createGame(seeded());t.stage='flop';t.currentBet=0;t.minRaise=20;t.actor=1;t.pot=80;
  t.players.forEach((p,i)=>Object.assign(p,{bet:0,contributed:20,chips:i===1?5:500,folded:i===3,acted:i===0,raiseLocked:false,reopenAt:i===0?20:0,lastAction:i===0?'过牌':''}));
  act(t,'raise',5);act(t,'call');assert.equal(t.actor,0);assert.equal(legalActions(t).canRaise,true);assert.equal(legalActions(t).minTo,20);
  act(t,'raise',20);assert.equal(t.currentBet,20);assert.equal(t.minRaise,20);
});
test('cumulative short all-ins reopen action once the full raise is faced',()=>{
  const s=createGame(seeded());s.currentBet=100;s.minRaise=100;s.actor=1;s.pot=400;
  s.players.forEach((p,i)=>Object.assign(p,{bet:100,contributed:100,chips:i===1?50:i===2?100:500,acted:i===0,raiseLocked:false,reopenAt:i===0?200:0,folded:false,allIn:false,lastAction:i===0?'跟注 100':''}));
  act(s,'raise',150);act(s,'raise',200);act(s,'call');assert.equal(s.actor,0);assert.equal(legalActions(s).canRaise,true);assert.equal(legalActions(s).minTo,300);
});
test('folded best cards never win a showdown pot',()=>{
  const s=createGame(seeded());s.board=[card(2,0),card(3,1),card(7,2),card(8,3),card(9,0)];
  s.players.forEach((p,i)=>Object.assign(p,{hole:[card(14-i,1),card(14-i,2)],contributed:100,chips:2400,folded:i===0,allIn:false}));s.pot=400;
  settleShowdown(s);assert.deepEqual(s.players.map(p=>p.won),[0,400,0,0]);assert.equal(total(s),10000);
});
test('heads-up dealer posts small blind and acts first preflop',()=>{
  const s=createGame(seeded());s.players[2].chips=0;s.players[3].chips=0;s.button=1;s.stage='showdown';newHand(s,seeded(2));
  assert.equal(s.button,0);assert.equal(s.smallBlind,0);assert.equal(s.bigBlind,1);assert.equal(s.actor,0);
});
test('a lone player with chips cannot bet against all-in opponents',()=>{
  const s=createGame(seeded());s.actor=0;s.currentBet=40;s.players.forEach((p,i)=>Object.assign(p,{folded:i>1,allIn:i===1,bet:i===1?40:0,acted:false}));
  assert.equal(legalActions(s).canRaise,false);
});
test('many seeded games terminate with legal decisions and conserve all chips',()=>{
  const rng=seeded(219);let decisions=0;
  for(let game=0;game<35;game++){
    const s=createGame(rng);
    for(let h=0;h<12;h++){
      let guard=0;
      while(s.stage!=='showdown'){
        assert.ok(guard++<160,'hand did not terminate'); const l=legalActions(s);let a;
        if(rng()<0.25&&l.canRaise){a={type:'raise',amount:rng()<0.15?l.maxTo:Math.min(l.maxTo,l.minTo+Math.floor(rng()*5)*20)};}
        else if(rng()<0.12&&l.toCall>0){a={type:'fold'};}else{a={type:l.toCall?'call':'check'};}
        act(s,a.type,a.amount);decisions++;assert.equal(total(s),10000);assert.ok(s.players.every(p=>p.chips>=0&&Number.isInteger(p.chips)));
      }
      if(s.players.filter(p=>p.chips>0).length<2)break;newHand(s,rng);
    }
  }
  assert.ok(decisions>500);
});
function playAIHand(difficulty,seed){
  const rng=seeded(seed),s=createGame(rng),decisions=[];
  const context=`${difficulty}, seed ${seed}`;
  assert.equal(total(s),10000,context);
  while(s.stage!=='showdown'){
    assert.ok(decisions.length<100,`${context}: hand did not terminate`);
    const l=legalActions(s),a=chooseAction(s,difficulty,rng);
    assert.ok(['fold','check','call','raise'].includes(a.type),`${context}: unknown action`);
    if(a.type==='check')assert.equal(l.canCheck,true,context);
    if(a.type==='call')assert.ok(l.toCall>0,`${context}: call without a bet`);
    if(a.type==='raise'){
      assert.equal(l.canRaise,true,context);
      assert.ok(Number.isInteger(a.amount)&&a.amount>=l.minTo&&a.amount<=l.maxTo,`${context}: invalid raise`);
    }
    decisions.push({actor:s.actor,stage:s.stage,...a});
    act(s,a.type,a.amount);
    assert.equal(total(s),10000,context);
    assert.ok(s.players.every(p=>Number.isInteger(p.chips)&&p.chips>=0),`${context}: invalid stack`);
  }
  assert.ok(decisions.length>0,`${context}: no AI decisions exercised`);
  assert.equal(s.stage,'showdown',context);
  assert.equal(s.actor,null,context);
  assert.equal(s.pot,0,context);
  return {decisions,state:s};
}

// Keep Monte Carlo work bounded: three hands per difficulty, each replayed once.
for(const difficulty of ['easy','normal','hard']){
  for(const seed of [23,219,427]){
    test(`AI ${difficulty}, seed ${seed}: legal decisions, termination, chip conservation and reproducible replay`,()=>{
      const first=playAIHand(difficulty,seed);
      const replay=playAIHand(difficulty,seed);
      assert.deepEqual(replay,first,'same seed must reproduce every decision and the settled state');
    });
  }
}
