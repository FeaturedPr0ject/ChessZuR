import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const game=new Chess();
const boardEl=document.getElementById("board");
const movesEl=document.getElementById("moves");
const symbols={w:{k:"♔",q:"♕",r:"♖",b:"♗",n:"♘",p:"♙"},b:{k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"}};
let selected=null,targets=[],flipped=false,lastMove=null,botThinking=false;
const files="abcdefgh";
function squareName(r,c){return files[c]+(8-r)}
function render(){
 boardEl.innerHTML="";
 const checkSq=game.isCheck()?game.board().flatMap((row,r)=>row.map((p,c)=>p&&p.type==="k"&&p.color===game.turn()?squareName(r,c):null)).find(Boolean):null;
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const rr=flipped?7-r:r,cc=flipped?7-c:c,sq=squareName(rr,cc),piece=game.get(sq),btn=document.createElement("button");
  btn.className="square "+((rr+cc)%2===0?"light":"dark");
  if(sq===selected)btn.classList.add("selected");
  if(lastMove&&(sq===lastMove.from||sq===lastMove.to))btn.classList.add("last");
  if(sq===checkSq)btn.classList.add("check");
  const target=targets.find(m=>m.to===sq);
  if(target)btn.classList.add(piece?"capture":"legal");
  if(piece){const span=document.createElement("span");span.className="piece "+(piece.color==="w"?"white":"black");span.textContent=symbols[piece.color][piece.type];btn.append(span)}
  if(c===0){const coord=document.createElement("span");coord.className="coord";coord.textContent=String(8-rr);btn.append(coord)}
  if(rr===7){const coord=document.createElement("span");coord.className="coord file";coord.textContent=files[cc];btn.append(coord)}
  btn.setAttribute("aria-label",sq+(piece?" "+piece.type:""));btn.addEventListener("click",()=>tap(sq));boardEl.append(btn);
 }
 updateStatus();updateMoves();document.getElementById("undo").disabled=game.history().length===0;
}
function tap(sq){
 if(game.isGameOver())return;
 const p=game.get(sq);
 if(selected&&targets.some(m=>m.to===sq)){
  const moves=targets.filter(m=>m.to===sq);let promotion;
  if(moves.some(m=>m.promotion)){const choice=(prompt("Phong cấp thành: q = Hậu, r = Xe, b = Tượng, n = Mã","q")||"q").toLowerCase();promotion=["q","r","b","n"].includes(choice)?choice:"q"}
  try{lastMove=game.move({from:selected,to:sq,...(promotion?{promotion}:{})});selected=null;targets=[];render();scheduleBot()}catch(e){selected=null;targets=[];render()}return;
 }
 if(p&&p.color===game.turn()){selected=sq;targets=game.moves({square:sq,verbose:true});}
 else{selected=null;targets=[]}
 render();
}
function updateStatus(){
 const side=game.turn()==="w"?"Bạn":"Bot",icon=game.turn()==="w"?"♙":"♟";
 document.getElementById("statusIcon").textContent=icon;
 let title=side+" đến lượt",desc=game.turn()==="w"?"Chọn quân để bắt đầu":"Bot chuẩn bị nước đi";\n if(botThinking){title="Bot đang suy nghĩ…";desc="Đang tìm nước đi hợp lệ";}
 if(game.isCheckmate()){title="Chiếu hết!";desc=(game.turn()==="w"?"Bot":"Bạn")+" chiến thắng";document.getElementById("statusIcon").textContent="🏆"}
 else if(game.isDraw()){title="Ván cờ hòa";desc=game.isStalemate()?"Hết nước đi hợp lệ":"Điều kiện hòa đã được đáp ứng";document.getElementById("statusIcon").textContent="🤝"}
 else if(game.isCheck()){title=side+" đang bị chiếu!";desc="Hãy bảo vệ vua";document.getElementById("statusIcon").textContent="⚠️"}
 document.getElementById("statusTitle").textContent=title;document.getElementById("statusDesc").textContent=desc;
 document.getElementById("whiteTurn").style.opacity=game.turn()==="w"?"1":".45";
 document.getElementById("blackTurn").style.opacity=game.turn()==="b"?"1":".45";
 document.getElementById("orientation").textContent=flipped?"♟ Bot ở phía dưới":"♙ Bạn đi trước";
}
const values={p:100,n:320,b:330,r:500,q:900,k:20000};
function evaluate(){if(game.isCheckmate())return game.turn()==="b"?-99999:99999;if(game.isDraw())return 0;let score=0;for(const row of game.board())for(const p of row)if(p)score+=(p.color==="b"?1:-1)*values[p.type];return score}
function search(depth,alpha,beta){if(depth===0||game.isGameOver())return evaluate();const maximizing=game.turn()==="b",moves=game.moves({verbose:true});let best=maximizing?-Infinity:Infinity;for(const m of moves){game.move(m);const score=search(depth-1,alpha,beta);game.undo();if(maximizing){best=Math.max(best,score);alpha=Math.max(alpha,best)}else{best=Math.min(best,score);beta=Math.min(beta,best)}if(beta<=alpha)break}return best}
function chooseBotMove(){const moves=game.moves({verbose:true});if(!moves.length)return null;const level=document.getElementById("difficulty").value;if(level==="easy")return moves[Math.floor(Math.random()*moves.length)];const depth=level==="hard"?3:2;let best=-Infinity,candidates=[];for(const m of moves){game.move(m);const score=search(depth-1,-Infinity,Infinity);game.undo();if(score>best){best=score;candidates=[m]}else if(score===best)candidates.push(m)}return candidates[Math.floor(Math.random()*candidates.length)]}
function scheduleBot(){if(game.isGameOver()||game.turn()!=="b")return;botThinking=true;updateStatus();setTimeout(()=>{if(game.isGameOver()||game.turn()!=="b"){botThinking=false;render();return}const move=chooseBotMove();if(move)lastMove=game.move(move);botThinking=false;selected=null;targets=[];render()},350)}
function updateMoves(){
 const hist=game.history();if(!hist.length){movesEl.innerHTML='<div class="empty">Nước đi sẽ hiện ở đây.</div>';return}
 let html='<table><tbody>';
 for(let i=0;i<hist.length;i+=2){const n=i/2+1,w=hist[i],b=hist[i+1]||"";html+='<tr><td class="num">'+n+'.</td><td>'+w+'</td><td>'+b+'</td></tr>'}
 html+='</tbody></table>';movesEl.innerHTML=html;movesEl.scrollTop=movesEl.scrollHeight;
}
document.getElementById("newGame").addEventListener("click",()=>{if(game.history().length&&!confirm("Bắt đầu ván mới?"))return;game.reset();selected=null;targets=[];lastMove=null;botThinking=false;render()});
document.getElementById("undo").addEventListener("click",()=>{if(botThinking)return;let m=game.undo();if(m&&game.history().length)m=game.undo()||m;if(m){lastMove=game.history({verbose:true}).at(-1)||null;selected=null;targets=[];render()}});
document.getElementById("flip").addEventListener("click",()=>{flipped=!flipped;render()});
document.getElementById("copyFen").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(game.fen());const b=document.getElementById("copyFen");b.textContent="Đã sao chép!";setTimeout(()=>b.textContent="▣ Sao chép FEN",1300)}catch(e){prompt("Sao chép FEN:",game.fen())}});
render();
