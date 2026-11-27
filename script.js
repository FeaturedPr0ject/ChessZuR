import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const game=new Chess();
const $=id=>document.getElementById(id);
const boardEl=$("board"),movesEl=$("moves");
const pieceNames={k:"king",q:"queen",r:"rook",b:"bishop",n:"knight",p:"pawn"};
let selected=null,targets=[],flipped=false,lastMove=null,botThinking=false,animateMove=null;
let gameStarted=false,gameOverByClock=false,allowUnload=false,clockBase=300,increment=0,remaining={w:300000,b:300000},clockStamp=0,clockTimer=null,redoStack=[];
const files="abcdefgh";
function squareName(r,c){return files[c]+(8-r)}
function formatTime(ms){const total=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(total/60),s=total%60;return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")}
function syncClock(){if(!gameStarted||game.isGameOver()||gameOverByClock)return;const now=Date.now();if(clockStamp){remaining[game.turn()]-=now-clockStamp;if(remaining[game.turn()]<=0){remaining[game.turn()]=0;gameOverByClock=true;botThinking=false;clearTimeout(botTimer);updateClockDisplay();updateStatus();return}}clockStamp=now;updateClockDisplay()}
function updateClockDisplay(){ $("whiteTime").textContent=formatTime(remaining.w);$("blackTime").textContent=formatTime(remaining.b);$("whiteClock").classList.toggle("active",gameStarted&&!game.isGameOver()&&!gameOverByClock&&game.turn()==="w");$("blackClock").classList.toggle("active",gameStarted&&!game.isGameOver()&&!gameOverByClock&&game.turn()==="b");}
let botTimer=null;
function startClock(){clearInterval(clockTimer);clockStamp=Date.now();clockTimer=setInterval(()=>{syncClock();if(gameOverByClock)clearInterval(clockTimer)},200)}
function stopClock(){clearInterval(clockTimer);clockStamp=0}
function render(){
 const oldSquares=new Map([...boardEl.children].map(el=>[el.getAttribute("data-square"),el.getBoundingClientRect()]));
 const moveAnimation=animateMove;animateMove=null;const pendingAnimations=[];boardEl.innerHTML="";
 const checkSq=game.isCheck()?game.board().flatMap((row,r)=>row.map((p,c)=>p&&p.type==="k"&&p.color===game.turn()?squareName(r,c):null)).find(Boolean):null;
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const rr=flipped?7-r:r,cc=flipped?7-c:c,sq=squareName(rr,cc),piece=game.get(sq),btn=document.createElement("button");
  btn.className="square "+((rr+cc)%2===0?"light":"dark");btn.dataset.square=sq;
  if(sq===selected)btn.classList.add("selected");if(lastMove&&(sq===lastMove.from||sq===lastMove.to))btn.classList.add("last");if(sq===checkSq)btn.classList.add("check");
  const target=targets.find(m=>m.to===sq);if(target)btn.classList.add(piece?"capture":"legal");
  if(piece){const img=document.createElement("img");img.className="piece "+(piece.color==="w"?"white":"black");img.src=`assets/pieces/${piece.color==="w"?"white":"black"}-${pieceNames[piece.type]}.svg`;img.alt=piece.type;img.draggable=false;btn.append(img);if(moveAnimation&&sq===moveAnimation.to&&oldSquares.has(moveAnimation.from))pendingAnimations.push({img,from:oldSquares.get(moveAnimation.from)});}
  if(c===0){const coord=document.createElement("span");coord.className="coord";coord.textContent=String(8-rr);btn.append(coord)}if(rr===7){const coord=document.createElement("span");coord.className="coord file";coord.textContent=files[cc];btn.append(coord)}
  btn.setAttribute("aria-label",sq+(piece?" "+piece.type:""));btn.addEventListener("click",()=>tap(sq));boardEl.append(btn);
 }
 if(pendingAnimations.length)requestAnimationFrame(()=>{for(const item of pendingAnimations){const to=item.img.getBoundingClientRect();item.img.animate([{transform:`translate(${item.from.left-to.left}px,${item.from.top-to.top}px) scale(.92)`},{transform:"translate(0,0) scale(1)"}],{duration:320,easing:"cubic-bezier(.22,.75,.25,1)",fill:"both"}).onfinish=()=>{item.img.style.transform="";}}});
 updateStatus();updateMoves();$("undo").disabled=!game.history().length||botThinking;$("redo").disabled=!redoStack.length||botThinking;updateClockDisplay();
}
function tap(sq){
 if(!gameStarted||game.isGameOver()||gameOverByClock||botThinking||game.turn()!=="w")return;
 const p=game.get(sq);
 if(selected&&targets.some(m=>m.to===sq)){
  const from=selected,moves=targets.filter(m=>m.to===sq);let promotion;
  if(moves.some(m=>m.promotion)){const choice=(prompt("Phong cấp thành: q = Hậu, r = Xe, b = Tượng, n = Mã","q")||"q").toLowerCase();promotion=["q","r","b","n"].includes(choice)?choice:"q"}
  syncClock();if(gameOverByClock)return;
  try{lastMove=game.move({from,to:sq,...(promotion?{promotion}:{})});remaining.w+=increment*1000;redoStack=[];selected=null;targets=[];animateMove={from,to:sq};clockStamp=Date.now();render();scheduleBot()}catch(e){selected=null;targets=[];render()}return;
 }
 if(p&&p.color===game.turn()){selected=sq;targets=game.moves({square:sq,verbose:true})}else{selected=null;targets=[]}render();
}
function updateStatus(){
 const side=game.turn()==="w"?"Bạn":"Bot";let title=side+" đến lượt",desc=game.turn()==="w"?"Chọn quân để bắt đầu":"Bot chuẩn bị nước đi";
 if(botThinking){title="Bot đang suy nghĩ…";desc="Đang phân tích thế cờ theo cấp độ AI"}
 if(gameOverByClock){title="Hết thời gian!";desc=(remaining.w<=0?"Bot":"Bạn")+" chiến thắng";$("statusIcon").textContent="⏱"}
 else if(game.isCheckmate()){title="Chiếu hết!";desc=(game.turn()==="w"?"Bot":"Bạn")+" chiến thắng";$("statusIcon").textContent="🏆"}
 else if(game.isDraw()){title="Ván cờ hòa";desc=game.isStalemate()?"Hết nước đi hợp lệ":"Điều kiện hòa đã được đáp ứng";$("statusIcon").textContent="🤝"}
 else if(game.isCheck()){$("statusIcon").textContent="⚠️";title=side+" đang bị chiếu!";desc="Hãy bảo vệ vua"}else $("statusIcon").textContent=game.turn()==="w"?"♙":"♟";
 $("statusTitle").textContent=title;$("statusDesc").textContent=desc;$("whiteTurn").style.opacity=game.turn()==="w"?"1":".45";$("blackTurn").style.opacity=game.turn()==="b"?"1":".45";$("orientation").textContent=flipped?"♟ Bot ở phía dưới":"♙ Bạn đi trước";
}
const values={p:100,n:320,b:330,r:500,q:900,k:20000};
function evaluate(){if(game.isCheckmate())return game.turn()==="b"?-99999:99999;if(game.isDraw())return 0;let score=0;for(const row of game.board())for(const p of row)if(p)score+=(p.color==="b"?1:-1)*values[p.type];return score}
function search(depth,alpha,beta){if(depth===0||game.isGameOver())return evaluate();const maximizing=game.turn()==="b",moves=game.moves({verbose:true});let best=maximizing?-Infinity:Infinity;for(const m of moves){game.move(m);const score=search(depth-1,alpha,beta);game.undo();if(maximizing){best=Math.max(best,score);alpha=Math.max(alpha,best)}else{best=Math.min(best,score);beta=Math.min(beta,best)}if(beta<=alpha)break}return best}
function chooseBotMove(){const moves=game.moves({verbose:true});if(!moves.length)return null;const strength=Number($("strength").value),depth=strength<300?1:strength<500?2:strength<800?3:4;let best=-Infinity,ranked=[];for(const m of moves){game.move(m);const score=search(depth-1,-Infinity,Infinity);game.undo();ranked.push({move:m,score});best=Math.max(best,score)}const tolerance=strength<300?180:strength<500?70:strength<800?20:0,candidates=ranked.filter(item=>item.score>=best-tolerance);return candidates[Math.floor(Math.random()*candidates.length)].move}
function scheduleBot(){if(game.isGameOver()||game.turn()!=="b"||gameOverByClock)return;botThinking=true;updateStatus();botTimer=setTimeout(()=>{syncClock();if(gameOverByClock||game.isGameOver()||game.turn()!=="b"){botThinking=false;render();return}const move=chooseBotMove();syncClock();if(gameOverByClock){botThinking=false;render();return}if(move){lastMove=game.move(move);remaining.b+=increment*1000;animateMove={from:move.from,to:move.to};clockStamp=Date.now()}botThinking=false;selected=null;targets=[];render()},250)}
function updateMoves(){const hist=game.history();if(!hist.length){movesEl.innerHTML='<div class="empty">Nước đi sẽ hiện ở đây.</div>';return}let html='<table><tbody>';for(let i=0;i<hist.length;i+=2){html+='<tr><td class="num">'+(i/2+1)+'.</td><td>'+hist[i]+'</td><td>'+(hist[i+1]||"")+'</td></tr>'}html+='</tbody></table>';movesEl.innerHTML=html;movesEl.scrollTop=movesEl.scrollHeight}
function strengthLabel(){const v=Number($("strength").value),tier=v<300?"Thực tập sinh AI":v<500?"Người mới AI":v<800?"Huấn luyện viên AI":"Cao thủ cờ AI";$("startStrengthValue").textContent=v+" · "+tier}
$("strength").addEventListener("input",strengthLabel);strengthLabel();
let selectedTime={seconds:300,increment:0};
$("timeOptions").addEventListener("click",e=>{const btn=e.target.closest("[data-time]");if(!btn)return;document.querySelectorAll(".time-option").forEach(x=>x.classList.toggle("active",x===btn));selectedTime={seconds:Number(btn.dataset.time),increment:Number(btn.dataset.increment)}});
function beginGame(){game.reset();selected=null;targets=[];lastMove=null;botThinking=false;gameOverByClock=false;redoStack=[];clockBase=selectedTime.seconds;increment=selectedTime.increment;remaining={w:clockBase*1000,b:clockBase*1000};gameStarted=true;$("startScreen").hidden=true;$("gameView").hidden=false;$("clockMode").textContent=clockBase/60+" phút";$("clockIncrement").textContent="+"+increment+" giây / nước";$("gameSettings").textContent="AI: "+$("startStrengthValue").textContent+" · "+clockBase/60+" phút"+(increment?" + "+increment+" giây":"");render();startClock()}
$("startGame").addEventListener("click",beginGame);
$("newGame").addEventListener("click",()=>{if(!confirm("Trở về màn hình bắt đầu? Ván hiện tại sẽ kết thúc."))return;stopClock();clearTimeout(botTimer);gameStarted=false;botThinking=false;$("gameView").hidden=true;$("startScreen").hidden=false});
function requestUndo(){if(botThinking||!game.history().length)return;if(!confirm("Bạn muốn Đi lại nước vừa rồi? Ván đấu sẽ được đưa về trạng thái trước đó."))return;syncClock();if(gameOverByClock)return;let m=game.undo();if(m)redoStack.unshift({from:m.from,to:m.to,promotion:m.promotion,color:m.color});if(m&&game.history().length&&game.turn()==="b"){m=game.undo();if(m)redoStack.unshift({from:m.from,to:m.to,promotion:m.promotion})}lastMove=game.history({verbose:true}).at(-1)||null;selected=null;targets=[];clockStamp=Date.now();render()}
function requestRedo(){if(botThinking||!redoStack.length)return;if(!confirm("Bạn muốn Làm lại nước đi đã hoàn tác?"))return;syncClock();if(gameOverByClock)return;try{let move=redoStack.shift();lastMove=game.move(move);remaining[lastMove.color]+=increment*1000;if(game.turn()==="b"&&redoStack.length&&redoStack[0].color==="b"){move=redoStack.shift();lastMove=game.move(move);remaining[lastMove.color]+=increment*1000}selected=null;targets=[];clockStamp=Date.now();render();if(game.turn()==="b"&&!game.isGameOver())scheduleBot()}catch(e){redoStack=[];render()}}
$("undo").addEventListener("click",requestUndo);$("redo").addEventListener("click",requestRedo);
$("flip").addEventListener("click",()=>{flipped=!flipped;render()});
$("copyFen").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(game.fen());$("copyFen").textContent="Đã sao chép!";setTimeout(()=>$("copyFen").textContent="Sao chép FEN",1300)}catch(e){prompt("Sao chép FEN:",game.fen())}});
window.addEventListener("beforeunload",e=>{if(gameStarted&&!allowUnload&&!game.isGameOver()&&!gameOverByClock){e.preventDefault();e.returnValue=""}});
window.addEventListener("keydown",e=>{if(gameStarted&&(e.key==="F5"||e.key==="r"&&(e.ctrlKey||e.metaKey))){e.preventDefault();if(confirm("Bạn đang trong ván đấu. Tải lại trang sẽ làm mất ván hiện tại. Bạn có chắc chắn muốn tải lại?")){allowUnload=true;stopClock();location.reload()}}});
render();
