import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.2";
const game=new Chess();
const $=id=>document.getElementById(id);
const boardEl=$("board"),movesEl=$("moves"),boardHome=boardEl.parentElement,boardHomeNext=boardEl.nextSibling;
const pieceNames={k:"king",q:"queen",r:"rook",b:"bishop",n:"knight",p:"pawn"};
const pieceGlyphs={w:{k:"♔",q:"♕",r:"♖",b:"♗",n:"♘",p:"♙"},b:{k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"}};
function pieceIconHTML(color,type,className="ui-piece-icon"){if(featureSettings.pieceStyle==="unicode")return `<span class="${className} unicode-piece">${pieceGlyphs[color][type]}</span>`;return `<img class="${className} svg-piece-icon" src="assets/pieces/${color==="w"?"white":"black"}-${pieceNames[type]}.svg" alt="">`}
function syncPieceDecorations(){const pill=$("pieceBadgeIcon"),mark=$("startMarkIcon");if(pill)pill.innerHTML=pieceIconHTML("b","p");if(mark)mark.innerHTML=pieceIconHTML("b","n");updateStatus()}
let selected=null,targets=[],flipped=false,lastMove=null,botThinking=false,animateMove=null;
let gameStarted=false,gameOverByClock=false,allowUnload=false,clockBase=300,increment=0,remaining={w:300000,b:300000},clockStamp=0,clockTimer=null,redoStack=[];
let savedGameId=null,cloudUser=null,audioContext=null;
let replayMode=false,replayMoves=[],replayIndex=0,replayRenderedIndex=0,replayReturnPgn="",replayReturnFen="",replayTimer=null,replayAnalysis=[],replayItem=null,replayAnalysisReady=false;
const featureDefaults={boardTheme:"forest",pieceStyle:"svg",soundEnabled:true,vibrationEnabled:true};
let featureSettings={...featureDefaults,...JSON.parse(localStorage.getItem("chesszur-settings")||"{}")};
let savedGames=JSON.parse(localStorage.getItem("chesszur-history")||"[]");
const supabaseUrl="https://rbdlfzoqwuchkjbgzmjb.supabase.co";
const supabaseKey="sb_publishable_4QTH9c6hCCXWElBBZjlJdg_iXuA7RX3";
const chessReviewEndpoint="https://rbdlfzoqwuchkjbgzmjb.supabase.co/functions/v1/chess-review";
const supabase=createClient(supabaseUrl,supabaseKey);
const files="abcdefgh";
function squareName(r,c){return files[c]+(8-r)}
function formatTime(ms){const total=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(total/60),s=total%60;return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")}
function syncClock(){if(!gameStarted||game.isGameOver()||gameOverByClock)return;const now=Date.now();if(clockStamp){remaining[game.turn()]-=now-clockStamp;if(remaining[game.turn()]<=0){remaining[game.turn()]=0;gameOverByClock=true;botThinking=false;clearTimeout(botTimer);updateClockDisplay();updateStatus();maybeSaveGame();return}}clockStamp=now;updateClockDisplay()}
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
  if(piece){if(featureSettings.pieceStyle==="unicode"){const glyph=document.createElement("span");glyph.className="piece-glyph "+(piece.color==="w"?"white":"black");glyph.textContent=pieceGlyphs[piece.color][piece.type];btn.append(glyph);if(moveAnimation&&sq===moveAnimation.to&&oldSquares.has(moveAnimation.from)){glyph.style.visibility="hidden";pendingAnimations.push({img:glyph,from:oldSquares.get(moveAnimation.from)})}}else{const img=document.createElement("img");img.className="piece "+(piece.color==="w"?"white":"black");img.src=`assets/pieces/${piece.color==="w"?"white":"black"}-${pieceNames[piece.type]}.svg`;img.alt=piece.type;img.draggable=false;btn.append(img);if(moveAnimation&&sq===moveAnimation.to&&oldSquares.has(moveAnimation.from)){img.style.visibility="hidden";pendingAnimations.push({img,from:oldSquares.get(moveAnimation.from)})}}}
  if(c===0){const coord=document.createElement("span");coord.className="coord";coord.textContent=String(8-rr);btn.append(coord)}if(rr===7){const coord=document.createElement("span");coord.className="coord file";coord.textContent=files[cc];btn.append(coord)}
  btn.setAttribute("aria-label",sq+(piece?" "+piece.type:""));btn.addEventListener("click",()=>tap(sq));boardEl.append(btn);
 }
 if(pendingAnimations.length)requestAnimationFrame(()=>{for(const item of pendingAnimations){const to=item.img.getBoundingClientRect();const dx=item.from.left-to.left,dy=item.from.top-to.top;item.img.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"translate(0,0)"}],{duration:180,easing:"cubic-bezier(.22,.75,.25,1)",fill:"both"}).onfinish=()=>{item.img.style.transform="";};item.img.style.visibility="visible";}});
 updateStatus();updateMoves();maybeSaveGame();$("undo").disabled=!game.history().length||botThinking;$("redo").disabled=!redoStack.length||botThinking;updateClockDisplay();
}
function choosePromotion(){return new Promise(resolve=>{const dialog=$("promotionDialog");const finish=value=>{dialog.hidden=true;dialog.removeEventListener("click",handleClick);resolve(value)};const handleClick=e=>{const option=e.target.closest("[data-promotion]");if(option)finish(option.dataset.promotion)};dialog.addEventListener("click",handleClick);dialog.hidden=false;dialog.querySelector("[data-promotion=q]").focus()})}
async function tap(sq){
 if(replayMode||!gameStarted||game.isGameOver()||gameOverByClock||botThinking||game.turn()!=="w")return;
 const p=game.get(sq);
 if(selected&&targets.some(m=>m.to===sq)){
  const from=selected,moves=targets.filter(m=>m.to===sq);let promotion;
  if(moves.some(m=>m.promotion)){promotion=await choosePromotion();if(!promotion)return}
  syncClock();if(gameOverByClock)return;
  try{const captured=Boolean(game.get(sq))||moves.some(m=>m.flags.includes("e"));lastMove=game.move({from,to:sq,...(promotion?{promotion}:{})});playMoveFeedback(captured,game.isCheck());remaining.w+=increment*1000;redoStack=[];selected=null;targets=[];animateMove={from,to:sq};clockStamp=Date.now();render();scheduleBot()}catch(e){selected=null;targets=[];render()}return;
 }
 if(p&&p.color===game.turn()){selected=sq;targets=game.moves({square:sq,verbose:true})}else{selected=null;targets=[]}render();
}
function updateStatus(){
 const side=game.turn()==="w"?"Bạn":"Bot";let title=side+" đến lượt",desc=game.turn()==="w"?"Chọn quân để bắt đầu":"Bot chuẩn bị nước đi";
 if(botThinking){title="Bot đang suy nghĩ…";desc="Đang phân tích thế cờ theo cấp độ AI"}
 if(gameOverByClock){title="Hết thời gian!";desc=(remaining.w<=0?"Bot":"Bạn")+" chiến thắng";$("statusIcon").textContent="⏱"}
 else if(game.isCheckmate()){title="Chiếu hết!";desc=(game.turn()==="w"?"Bot":"Bạn")+" chiến thắng";$("statusIcon").textContent="🏆"}
 else if(game.isDraw()){title="Ván cờ hòa";desc=game.isStalemate()?"Hết nước đi hợp lệ":"Điều kiện hòa đã được đáp ứng";$("statusIcon").textContent="🤝"}
 else if(game.isCheck()){$("statusIcon").textContent="⚠️";title=side+" đang bị chiếu!";desc="Hãy bảo vệ vua"}else $("statusIcon").innerHTML=pieceIconHTML(game.turn(),"p","status-piece-icon");
 $("statusTitle").textContent=title;$("statusDesc").textContent=desc;$("whiteTurn").style.opacity=game.turn()==="w"?"1":".45";$("blackTurn").style.opacity=game.turn()==="b"?"1":".45";$("orientation").innerHTML=flipped?pieceIconHTML("b","p","orientation-piece")+" Bot ở phía dưới":pieceIconHTML("w","p","orientation-piece")+" Bạn đi trước";
}
const values={p:100,n:320,b:330,r:500,q:900,k:20000};
function evaluate(){if(game.isCheckmate())return game.turn()==="b"?-99999:99999;if(game.isDraw())return 0;let score=0;for(const row of game.board())for(const p of row)if(p)score+=(p.color==="b"?1:-1)*values[p.type];return score}
const searchCache=new Map();
function moveOrderScore(m){let score=0;if(m.captured)score+=10000+values[m.captured]*10-values[m.piece];if(m.promotion)score+=8000+values[m.promotion];if(m.flags.includes("k")||m.flags.includes("q"))score+=80;return score}
function orderedMoves(moves){return moves.sort((a,b)=>moveOrderScore(b)-moveOrderScore(a))}
function search(depth,alpha,beta){if(depth===0||game.isGameOver())return evaluate();const key=game.fen()+"|"+depth,cached=searchCache.get(key);if(cached!==undefined)return cached;const maximizing=game.turn()==="b",moves=orderedMoves(game.moves({verbose:true}));let best=maximizing?-Infinity:Infinity,cutoff=false;for(const m of moves){game.move(m);const score=search(depth-1,alpha,beta);game.undo();if(maximizing){if(score>best)best=score;alpha=Math.max(alpha,best)}else{if(score<best)best=score;beta=Math.min(beta,best)}if(beta<=alpha){cutoff=true;break}}if(!cutoff){if(searchCache.size>30000)searchCache.clear();searchCache.set(key,best)}return best}
function chooseBotMove(){const moves=game.moves({verbose:true});if(!moves.length)return null;const strength=Number($("strength").value),depth=strength<300?1:strength<500?2:strength<800?3:4;searchCache.clear();const maximizing=game.turn()==="b";orderedMoves(moves);let best=maximizing?-Infinity:Infinity,ranked=[],alpha=-Infinity,beta=Infinity;for(const m of moves){game.move(m);const score=search(depth-1,alpha,beta);game.undo();ranked.push({move:m,score});if(maximizing){best=Math.max(best,score);alpha=Math.max(alpha,best)}else{best=Math.min(best,score);beta=Math.min(beta,best)}}const tolerance=strength<300?180:strength<500?70:strength<800?20:0,candidates=ranked.filter(item=>maximizing?item.score>=best-tolerance:item.score<=best+tolerance);return candidates[Math.floor(Math.random()*candidates.length)].move}
function scheduleBot(){if(game.isGameOver()||game.turn()!=="b"||gameOverByClock)return;botThinking=true;updateStatus();botTimer=setTimeout(()=>{syncClock();if(gameOverByClock||game.isGameOver()||game.turn()!=="b"){botThinking=false;render();return}const move=chooseBotMove();syncClock();if(gameOverByClock){botThinking=false;render();return}if(move){const captured=Boolean(game.get(move.to))||move.flags.includes("e");lastMove=game.move(move);playMoveFeedback(captured,game.isCheck());remaining.b+=increment*1000;animateMove={from:move.from,to:move.to};clockStamp=Date.now()}botThinking=false;selected=null;targets=[];render()},250)}
function updateMoves(){const hist=game.history();if(!hist.length){movesEl.innerHTML='<div class="empty">Nước đi sẽ hiện ở đây.</div>';return}let html='<table><tbody>';for(let i=0;i<hist.length;i+=2){html+='<tr><td class="num">'+(i/2+1)+'.</td><td>'+hist[i]+'</td><td>'+(hist[i+1]||"")+'</td></tr>'}html+='</tbody></table>';movesEl.innerHTML=html;movesEl.scrollTop=movesEl.scrollHeight}
function strengthLabel(){const v=Number($("strength").value),tier=v<300?"Thực tập sinh AI":v<500?"Người mới AI":v<800?"Huấn luyện viên AI":"Cao thủ cờ AI";$("startStrengthValue").textContent=v+" · "+tier}
$("strength").addEventListener("input",strengthLabel);strengthLabel();
let selectedTime={seconds:300,increment:0};
$("timeOptions").addEventListener("click",e=>{const btn=e.target.closest("[data-time]");if(!btn)return;document.querySelectorAll(".time-option").forEach(x=>x.classList.toggle("active",x===btn));selectedTime={seconds:Number(btn.dataset.time),increment:Number(btn.dataset.increment)}});
function beginGame(){savedGameId=null;game.reset();selected=null;targets=[];lastMove=null;botThinking=false;gameOverByClock=false;redoStack=[];clockBase=selectedTime.seconds;increment=selectedTime.increment;remaining={w:clockBase*1000,b:clockBase*1000};gameStarted=true;$("startScreen").hidden=true;$("boardContent").hidden=false;$("gameSide").hidden=false;$("gameView").hidden=false;$("clockMode").textContent=clockBase/60+" phút";$("clockIncrement").textContent="+"+increment+" giây / nước";$("gameSettings").textContent="AI: "+$("startStrengthValue").textContent+" · "+clockBase/60+" phút"+(increment?" + "+increment+" giây":"");render();startClock()}
$("startGame").addEventListener("click",beginGame);
$("newGame").addEventListener("click",()=>{if(!confirm("Trở về màn hình bắt đầu? Ván hiện tại sẽ kết thúc."))return;stopClock();clearTimeout(botTimer);gameStarted=false;botThinking=false;$("boardContent").hidden=true;$("gameSide").hidden=true;$("startScreen").hidden=false;$("gameView").hidden=false});
function requestUndo(){if(botThinking||!game.history().length)return;if(!confirm("Bạn muốn Đi lại nước vừa rồi? Ván đấu sẽ được đưa về trạng thái trước đó."))return;syncClock();if(gameOverByClock)return;let m=game.undo();if(m)redoStack.unshift({from:m.from,to:m.to,promotion:m.promotion,color:m.color});if(m&&game.history().length&&game.turn()==="b"){m=game.undo();if(m)redoStack.unshift({from:m.from,to:m.to,promotion:m.promotion})}lastMove=game.history({verbose:true}).at(-1)||null;selected=null;targets=[];clockStamp=Date.now();render()}
function requestRedo(){if(botThinking||!redoStack.length)return;if(!confirm("Bạn muốn Làm lại nước đi đã hoàn tác?"))return;syncClock();if(gameOverByClock)return;try{let move=redoStack.shift();lastMove=game.move(move);remaining[lastMove.color]+=increment*1000;if(game.turn()==="b"&&redoStack.length&&redoStack[0].color==="b"){move=redoStack.shift();lastMove=game.move(move);remaining[lastMove.color]+=increment*1000}selected=null;targets=[];clockStamp=Date.now();render();if(game.turn()==="b"&&!game.isGameOver())scheduleBot()}catch(e){redoStack=[];render()}}
$("undo").addEventListener("click",requestUndo);$("redo").addEventListener("click",requestRedo);
$("flip").addEventListener("click",()=>{flipped=!flipped;render()});
$("copyFen").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(game.fen());$("copyFen").textContent="Đã sao chép!";setTimeout(()=>$("copyFen").textContent="Sao chép FEN",1300)}catch(e){prompt("Sao chép FEN:",game.fen())}});
window.addEventListener("beforeunload",e=>{if(gameStarted&&!allowUnload&&!game.isGameOver()&&!gameOverByClock){e.preventDefault();e.returnValue=""}});
window.addEventListener("keydown",e=>{if(gameStarted&&(e.key==="F5"||e.key==="r"&&(e.ctrlKey||e.metaKey))){e.preventDefault();if(confirm("Bạn đang trong ván đấu. Tải lại trang sẽ làm mất ván hiện tại. Bạn có chắc chắn muốn tải lại?")){allowUnload=true;stopClock();location.reload()}}});
render();


function applyFeatureSettings(){document.body.dataset.boardTheme=featureSettings.boardTheme;document.body.dataset.pieceStyle=featureSettings.pieceStyle;for(const key of ["boardTheme","pieceStyle","soundEnabled","vibrationEnabled"]){const el=$(key);if(el)el.type==="checkbox"?el.checked=Boolean(featureSettings[key]):el.value=featureSettings[key]}syncPieceDecorations();render()}
function saveFeatureSettings(){localStorage.setItem("chesszur-settings",JSON.stringify(featureSettings));applyFeatureSettings()}
function playMoveFeedback(captured,check){if(featureSettings.soundEnabled){try{const C=window.AudioContext||window.webkitAudioContext;if(C){audioContext=audioContext||new C();if(audioContext.state==="suspended")audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type="sine";osc.frequency.value=check?740:captured?520:360;gain.gain.setValueAtTime(.0001,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.075,audioContext.currentTime+.012);gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+.11);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.12)}}catch(e){}}if(featureSettings.vibrationEnabled&&navigator.vibrate)navigator.vibrate(check?[25,35,25]:captured?24:12)}
function openFeatureDialog(id){$(id).hidden=false}
function closeFeatureDialog(id){$(id).hidden=true}
function resultLabel(){if(gameOverByClock)return remaining.w<=0?"Thua do hết giờ":"Thắng do đối thủ hết giờ";if(game.isCheckmate())return game.turn()==="w"?"Thua":"Thắng";return "Hòa"}
function maybeSaveGame(){if(replayMode||!gameStarted||savedGameId||(!game.isGameOver()&&!gameOverByClock)||!game.history().length)return;savedGameId=crypto.randomUUID();const item={id:savedGameId,result:resultLabel(),created_at:new Date().toISOString(),pgn:game.pgn(),fen:game.fen(),moves:game.history(),white_ms:remaining.w,black_ms:remaining.b,clock_seconds:clockBase,increment_seconds:increment};savedGames=[item,...savedGames].slice(0,50);localStorage.setItem("chesszur-history",JSON.stringify(savedGames));renderHistory();if(cloudUser)saveCloudGame(item)}
async function connectCloud(){const status=$("cloudStatus");try{let {data:{session}}=await supabase.auth.getSession();if(!session){const {data,error}=await supabase.auth.signInAnonymously();if(error)throw error;session=data.session}cloudUser=session?.user||null;if(cloudUser){status.textContent="☁ Đồng bộ Supabase đã kết nối";await loadCloudHistory();for(const item of savedGames)await saveCloudGame(item)}}catch(error){status.textContent="☁ Lưu trên thiết bị · cần bật Anonymous Sign-ins và chạy SQL Supabase";console.warn("Supabase:",error.message)}}
async function saveCloudGame(item){const {error}=await supabase.from("chess_games").upsert({id:item.id,user_id:cloudUser.id,result:item.result,pgn:item.pgn,fen:item.fen,moves:item.moves,white_ms:item.white_ms,black_ms:item.black_ms,clock_seconds:item.clock_seconds,increment_seconds:item.increment_seconds,played_at:item.created_at});if(error){$("cloudStatus").textContent="☁ Chưa đồng bộ được · "+error.message;return}$("cloudStatus").textContent="☁ Đã lưu ván lên Supabase"}
async function loadCloudHistory(){const {data,error}=await supabase.from("chess_games").select("id,result,pgn,fen,moves,white_ms,black_ms,clock_seconds,increment_seconds,played_at").order("played_at",{ascending:false}).limit(50);if(error){$("cloudStatus").textContent="☁ Đăng nhập được nhưng bảng dữ liệu chưa sẵn sàng";return}const merged=new Map(savedGames.map(x=>[x.id,x]));for(const row of data||[])merged.set(row.id,{...row,created_at:row.played_at});savedGames=[...merged.values()].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,50);localStorage.setItem("chesszur-history",JSON.stringify(savedGames));renderHistory()}
function renderHistory(){const list=$("historyList");if(!list)return;$("historyCount").textContent=savedGames.length+" ván";if(!savedGames.length){list.innerHTML='<p class="feature-hint">Chưa có ván đấu hoàn thành.</p>';return}list.innerHTML=savedGames.map((item,index)=>'<article class="history-item"><div><strong>'+escapeHtml(item.result||"Ván đấu")+'</strong><small>'+new Date(item.created_at||item.played_at).toLocaleString("vi-VN")+' · '+(item.moves?.length||0)+' nước</small></div><button class="btn history-view" data-history="'+index+'" >Xem lại</button></article>').join("")}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("settingsButton").addEventListener("click",()=>openFeatureDialog("settingsDialog"));$("historyButton").addEventListener("click",()=>{renderHistory();openFeatureDialog("historyDialog")});
document.querySelectorAll("[data-close]").forEach(btn=>btn.addEventListener("click",()=>closeFeatureDialog(btn.dataset.close)));
document.querySelectorAll(".feature-overlay").forEach(el=>el.addEventListener("click",e=>{if(e.target===el)closeFeatureDialog(el.id)}));
for(const key of ["boardTheme","pieceStyle"]){$(key).addEventListener("change",e=>{featureSettings[key]=e.target.value;saveFeatureSettings()})}
for(const key of ["soundEnabled","vibrationEnabled"]){$(key).addEventListener("change",e=>{featureSettings[key]=e.target.checked;saveFeatureSettings()})}
localStorage.removeItem("chesszur-gemini-key");

function replayMoveAt(index){return replayMoves[index-1]||null}
function currentReplayAnnotation(){return replayAnalysis.find(item=>Number(item.ply)===replayIndex)||null}
function renderReplayCoach(){
 const bubble=$("replayCoachBubble"),mark=$("replayMoveMark"),title=$("replayCoachTitle"),king=$("replayCoachKing");
 if(king)king.innerHTML=pieceIconHTML("w","k","review-king-icon");
 const move=replayMoveAt(replayIndex),note=currentReplayAnnotation();
 if(!replayItem||!isLostGame(replayItem)){title.textContent="Trợ lý ChessZuR";bubble.textContent="Phân tích Gemini tự động chỉ dành cho ván bạn bị thua.";mark.textContent="";mark.hidden=true;return}
 if(!replayAnalysisReady){title.textContent="Gemini đang phân tích…";bubble.textContent="Mình đang xem từng nước đi để tìm thời điểm bạn bỏ lỡ cơ hội hoặc mắc sai lầm.";mark.hidden=true;return}
 if(!move){title.textContent="Bắt đầu ván đấu";bubble.textContent="Theo dõi các nước đi. Mình sẽ giải thích ngay khi đến nước có vấn đề.";mark.hidden=true;return}
 const san=game.history().at(-1)||"Nước đi";
 if(note){title.textContent="Nước "+Math.ceil(replayIndex/2)+" · "+san;mark.hidden=false;mark.textContent=note.mark||"?";mark.className="replay-move-mark";mark.dataset.mark=note.mark||"?";const verdict=note.mark_verdict||"Chưa có kết luận";const emotion=note.emotion||"Bình tĩnh";bubble.textContent="Đánh giá ký hiệu: "+verdict+". Sắc thái: "+emotion+". "+(note.reason||"Nước đi này cần được xem xét.");if(note.emotion_reason)bubble.textContent+=" "+note.emotion_reason;if(note.best_alternative)bubble.textContent+=" Nên cân nhắc: "+note.best_alternative+"."}
 else{title.textContent="Nước "+Math.ceil(replayIndex/2)+" · "+san;mark.hidden=true;bubble.textContent="Nước đi này chưa có nhận xét riêng. Hãy chú ý các quân đang bị tấn công và độ an toàn của vua."}
}
function showReplayPosition(){const previousIndex=replayRenderedIndex;if(replayIndex!==previousIndex){const step=replayMoves[Math.max(replayIndex,previousIndex)-1];if(step)animateMove=replayIndex>previousIndex?{from:step.from,to:step.to}:{from:step.to,to:step.from}}else animateMove=null;game.reset();for(const move of replayMoves.slice(0,replayIndex))game.move(move);lastMove=game.history({verbose:true}).at(-1)||null;selected=null;targets=[];render();replayRenderedIndex=replayIndex;$("replayCounter").textContent=replayIndex+" / "+replayMoves.length;$("replayPrev").disabled=replayIndex===0;$("replayNext").disabled=replayIndex===replayMoves.length;const move=game.history().at(-1);$("replayStatus").textContent=replayIndex===0?"Vị trí bắt đầu":replayIndex===replayMoves.length?"Đã đến nước cuối":"Nước "+Math.ceil(replayIndex/2)+": "+move;renderReplayCoach()}
function isLostGame(item){return /thua|hết giờ.*thua/i.test(String(item?.result||""))}
function stopReplayAutoplay(){if(replayTimer){clearInterval(replayTimer);replayTimer=null}}
function startReplayAutoplay(){stopReplayAutoplay();replayTimer=setInterval(()=>{if(!replayMode||replayIndex>=replayMoves.length){stopReplayAutoplay();return}replayIndex++;showReplayPosition();if(replayIndex>=replayMoves.length)stopReplayAutoplay()},2000)}
async function analyzeLostGame(item){
 replayAnalysis=[];replayAnalysisReady=false;renderReplayCoach();
 const retryButton=$("replayCoachRetry");
 if(retryButton)retryButton.hidden=true;
 const showError=(title,message)=>{
  replayAnalysisReady=false;
  $("replayCoachTitle").textContent=title;
  $("replayCoachBubble").textContent=message;
  if(retryButton)retryButton.hidden=false;
 };
 const readResponse=async response=>{
  const raw=await response.text();
  let data={};
  try{data=raw?JSON.parse(raw):{}}catch{data={error:raw.slice(0,700)}}
  return {response,data};
 };
 try{
  $("replayCoachTitle").textContent="Đang kiểm tra Supabase…";
  $("replayCoachBubble").textContent="1/3 · Kiểm tra phiên đăng nhập và quyền truy cập.";
  let {data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError)throw new Error("Không đọc được phiên Supabase: "+sessionError.message);
  if(!session){
   const {data,error}=await supabase.auth.signInAnonymously();
   if(error)throw new Error("Anonymous Sign-ins chưa hoạt động: "+error.message);
   session=data.session;
  }
  if(!session?.access_token)throw new Error("Supabase không cấp access token. Kiểm tra Anonymous Sign-Ins và thử tải lại trang.");
  const headers={"Content-Type":"application/json","apikey":supabaseKey,"Authorization":"Bearer "+session.access_token};
  $("replayCoachBubble").textContent="2/3 · Kiểm tra endpoint chess-review và Secret GEMINI_API_KEY.";
  let probe;
  try{
   probe=await fetch(chessReviewEndpoint,{method:"POST",headers,body:"{}",signal:AbortSignal.timeout(20000)});
  }catch(error){
   throw new Error("Không kết nối được endpoint. Kiểm tra mạng, URL Function và CORS. Chi tiết: "+(error.message||error));
  }
  const checked=await readResponse(probe);
  if(probe.status===404)throw new Error("HTTP 404: Supabase không tìm thấy chess-review. Function chưa deploy hoặc tên deploy không đúng.");
  if(probe.status===401)throw new Error("HTTP 401: JWT không được chấp nhận. Kiểm tra Anonymous Sign-ins và cấu hình verify_jwt.");
  if(probe.status===403)throw new Error("HTTP 403: Request bị chặn. Kiểm tra CORS và Allowed Origin của Function.");
  if(probe.status===503)throw new Error("HTTP 503: Function đã được tìm thấy nhưng thiếu Secret GEMINI_API_KEY trong Supabase.");
  if(probe.status!==400||!String(checked.data?.error||"").includes("Không có dữ liệu ván cờ")){
   throw new Error("Kiểm tra endpoint thất bại · HTTP "+probe.status+" · "+(checked.data?.error||probe.statusText||"Phản hồi không như dự kiến"));
  }
  $("replayCoachBubble").textContent="3/3 · Endpoint hoạt động, JWT hợp lệ và Secret đã được tìm thấy. Đang gửi ván cờ cho Gemini…";
  const response=await fetch(chessReviewEndpoint,{
   method:"POST",headers,
   body:JSON.stringify({pgn:item.pgn||"",moves:item.moves||[],result:item.result||"loss"}),
   signal:AbortSignal.timeout(45000)
  });
  const result=await readResponse(response);
  if(!response.ok){
   const messages={
    400:"Dữ liệu PGN/nước đi không hợp lệ.",
    401:"JWT hết hạn hoặc không hợp lệ.",
    403:"Function từ chối request. Kiểm tra CORS/Allowed Origin.",
    404:"Không tìm thấy chess-review.",
    429:"Function đang giới hạn yêu cầu. Chờ 15 giây rồi thử lại.",
    500:"Lỗi bên trong Edge Function hoặc dữ liệu Gemini không đọc được.",
    502:"Gemini API từ chối hoặc không phản hồi. Kiểm tra model, API key và quota.",
    503:"Không tìm thấy Secret GEMINI_API_KEY."
   };
   throw new Error("Gemini/Function trả HTTP "+response.status+" · "+(result.data.error||messages[response.status]||response.statusText||"Request thất bại"));
  }
  if(!Array.isArray(result.data?.reviews))throw new Error("Function trả HTTP 200 nhưng thiếu mảng reviews. Kiểm tra response của Edge Function.");
  replayAnalysis=result.data.reviews.filter(x=>Number.isInteger(Number(x.ply))&&Number(x.ply)>0&&Number(x.ply)<=replayMoves.length);
  replayAnalysisReady=true;renderReplayCoach();
 }catch(error){
  const message=error.name==="TimeoutError"||error.name==="AbortError"?"Hết thời gian chờ. Kiểm tra trạng thái Edge Function/Gemini rồi thử lại.":error.message||"Không xác định được lỗi.";
  showError("ChessZuR Coach · Chẩn đoán thất bại",message);
  console.warn("ChessZuR Coach diagnostic:",error);
 }
}
function startReplay(item){try{const parsed=new Chess();if(item.pgn)parsed.loadPgn(item.pgn);else{parsed.reset();for(const move of item.moves||[])parsed.move(move)}replayMoves=parsed.history({verbose:true}).map(m=>({from:m.from,to:m.to,...(m.promotion?{promotion:m.promotion}:{})}));replayReturnPgn=game.history().length?game.pgn():"";replayReturnFen=game.fen();replayItem=item;replayAnalysis=[];replayAnalysisReady=false;stopClock();stopReplayAutoplay();clearTimeout(botTimer);botThinking=false;replayMode=true;replayIndex=0;replayRenderedIndex=0;$("replayCoach").hidden=!isLostGame(item);$("historyDialog").hidden=true;$("replayDialog").hidden=false;boardEl.classList.add("replay-board");$("replayBoardSlot").append(boardEl);showReplayPosition();if(isLostGame(item))analyzeLostGame(item);else renderReplayCoach();startReplayAutoplay()}catch(error){alert("Không thể mở lại ván cờ này: "+error.message)}}
function closeReplay(){stopReplayAutoplay();replayMode=false;replayItem=null;$("replayDialog").hidden=true;boardEl.classList.remove("replay-board");boardHome.insertBefore(boardEl,boardHomeNext);if(replayReturnPgn)game.loadPgn(replayReturnPgn);else game.load(replayReturnFen);lastMove=game.history({verbose:true}).at(-1)||null;selected=null;targets=[];render();if(gameStarted&&!game.isGameOver()&&!gameOverByClock){startClock();if(game.turn()==="b")scheduleBot()}}
$("historyList").addEventListener("click",e=>{const btn=e.target.closest("[data-history]");if(!btn)return;const item=savedGames[Number(btn.dataset.history)];if(item)startReplay(item)});
$("replayPrev").addEventListener("click",()=>{if(replayIndex>0){replayIndex--;showReplayPosition()}});
$("replayNext").addEventListener("click",()=>{if(replayIndex<replayMoves.length){replayIndex++;showReplayPosition()}});
$("replayClose").addEventListener("click",closeReplay);
$("replayCoachRetry").addEventListener("click",()=>{if(replayItem&&isLostGame(replayItem))analyzeLostGame(replayItem)});

$("clearHistory").addEventListener("click",async()=>{if(!confirm("Xóa lịch sử ván đấu đã lưu?"))return;savedGames=[];localStorage.removeItem("chesszur-history");renderHistory();if(cloudUser){const {error}=await supabase.from("chess_games").delete().eq("user_id",cloudUser.id);if(error)$("cloudStatus").textContent="Đã xóa trên thiết bị, chưa xóa được dữ liệu đám mây: "+error.message;else $("cloudStatus").textContent="Đã xóa lịch sử trên thiết bị và Supabase"}});
applyFeatureSettings();renderHistory();connectCloud();
