const MODEL = 'gpt-5.6-luna';

function doGet() {
  return HtmlService.createHtmlOutput(getAppHtml())
    .setTitle('いっしょに考えよう｜先生用テスト');
}

function askAI(history, mode) {
  mode = mode || '探究';
  history = Array.isArray(history) ? history : [];
  history = history.slice(-12);

  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) throw new Error('APIキーが設定されていません。Apps Scriptの「スクリプト プロパティ」に OPENAI_API_KEY を登録してください。');

  const modeRule = {
    '探究': '理由・根拠・具体例・比較・別の立場・つながり・予想・次の問いを使い分ける。',
    'SDGs': '「誰のため？」「何のため？」「ほかの人や地球にはどんな影響？」「ほかの立場なら？」を特に大切にする。',
    '国語': '文章中の言葉や表現を根拠にして考えさせる。答えを先に言わず、「どの言葉からそう考えた？」を大切にする。',
    '社会': '資料・地図・写真・数字などの根拠に注目させ、くらしや地域とのつながりを考えさせる。',
    '算数': 'すぐに計算方法や答えを教えず、「分かっていること」「求めること」「図や式が表していること」を問い返す。'
  }[mode] || '';

  const systemPrompt = `あなたは小学校4年生の「考える相棒」です。先生が授業で使うテスト版です。\n現在のモード：${mode}\nこのモードで大切にすること：${modeRule}\n\n【目的】\n子どもの代わりに答えを出すのではなく、子ども自身の考えを一段深める。AIは「教える人」より「考える相手」としてふるまう。\n\n【最重要ルール】\n1. 原則として、完成した答え・作文・調査結果・発表原稿を直接与えない。\n2. 「答えを教えて」と言われても、まず考えるための問い返しや小さなヒントを出す。\n3. 子どもの発言を短く受け止めてから問い返す。\n4. 1回の返答で中心となる問いは原則1つだけ。\n5. 「なぜ？」を連続させず、理由、根拠、具体例、比較、別の立場、つながり、予想などを使い分ける。\n6. 子どもの今の考えから、無理なく一段だけ深くなる問いを選ぶ。いきなり難しい問いに飛ばさない。\n7. 間違いの可能性があっても、すぐ「違う」と言わず、何を確かめればよいかを考えさせる。\n8. 事実確認が必要なら、検索結果を作らず、「○○を調べて確かめよう」と調べる対象を示す。\n9. 個人情報（氏名、住所、電話番号、顔写真、アカウント情報など）を求めたり保存したりしない。\n10. 危険、暴力、いじめ、差別、自傷など安全に関わる相談では、通常の問い返しより安全を優先し、信頼できる大人への相談を促す。\n\n【問いの選び方】\n・まだ理由が出ていない→「どうしてそう思った？」\n・理由はあるが根拠がない→「何を見てそう考えた？」\n・具体性がない→「たとえば、どんな場面？」\n・一つの立場だけ→「別の立場の人ならどう思う？」\n・二つの案がある→「比べると、どちらがよさそう？」\n・関係が見えてきた→「ほかのこととつながっている？」\n・十分考えた→「ここから、もっと知りたいことは？」\n\n【返答形式】\n必ず次の2行で返す。\n返答：子どもに見せる文章。最初に受け止め、次に中心となる問いを1つ。必要な場合だけ調べることを1つ示す。\nねらい：教師だけが見る短いメモ。今回の問い返しで狙った思考の動き（例：根拠を求める、別の立場、比較、次の問い）を10〜25字程度で書く。\n\n【文章のルール】\n・4年生に分かる言葉を使う。\n・やさしいが幼すぎない。\n・長くしない。\n・質問を一度に何個も並べない。\n・子どもの答えを先回りして完成させない。\n\nこれまでの会話を踏まえ、今の子どもの発言に対する「次の一手」を考えてください。`;

  const input = [{ role: 'system', content: systemPrompt }];
  history.forEach(m => {
    if (!m || !m.role || !m.text) return;
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    input.push({ role: role, content: m.text.slice(0, 1200) });
  });

  const payload = {
    model: MODEL,
    input: input,
    max_output_tokens: 300
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  let data;
  try { data = JSON.parse(response.getContentText()); }
  catch (e) { throw new Error('AIからの応答を読み取れませんでした。'); }
  if (code >= 400) throw new Error((data.error && data.error.message) || 'OpenAI API error');

  const raw = extractOutputText(data);
  const parsed = parseTeacherFormat(raw);
  return parsed;
}

function parseTeacherFormat(raw) {
  const match = raw.match(/返答：([\\s\\S]*?)\\nねらい：([\\s\\S]*)/);
  if (match) {
    return { reply: match[1].trim(), aim: match[2].trim() };
  }
  return { reply: raw.replace(/^返答：/, '').trim(), aim: '子どもの考えを一段深める問い返し' };
}

function extractOutputText(data) {
  if (data.output_text) return data.output_text.trim();
  const texts = [];
  (data.output || []).forEach(item => {
    (item.content || []).forEach(part => {
      if (part.type === 'output_text' && part.text) texts.push(part.text);
    });
  });
  return texts.join('\n').trim() || 'もう少し詳しく教えてくれる？';
}

function getAppHtml() {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>いっしょに考えよう｜先生用テスト</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f6fa;color:#202733;font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif}.wrap{max-width:900px;margin:auto;padding:24px}.top{background:#fff;border-radius:18px;padding:20px 22px;box-shadow:0 2px 12px #0001}.tag{display:inline-block;background:#e9eefc;padding:5px 10px;border-radius:999px;font-size:12px}.title{margin:8px 0 4px;font-size:28px}.sub{margin:0;color:#596273}.bar{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.mode{padding:9px 14px;border:1px solid #ccd3df;background:#fff;border-radius:10px;cursor:pointer}.mode.active{border-color:#315efb;background:#eef3ff}.chat{background:#fff;border-radius:18px;padding:18px;min-height:420px;box-shadow:0 2px 12px #0001}.msg{max-width:78%;padding:12px 15px;border-radius:16px;margin:12px 0;line-height:1.75;white-space:pre-wrap}.ai{background:#edf3ff;margin-right:auto}.me{background:#eaf7e9;margin-left:auto}.aim{background:#fff8dc;border-left:4px solid #e6b800;padding:10px 12px;margin:4px 0 12px;color:#665400;font-size:13px}.inputbox{background:#fff;border-radius:18px;padding:15px;margin-top:14px;box-shadow:0 2px 12px #0001}.inputbox textarea{width:100%;resize:vertical;min-height:100px;border:1px solid #cbd3df;border-radius:12px;padding:12px;font-size:16px;font-family:inherit}.actions{display:flex;gap:10px;align-items:center;margin-top:10px}.send{border:0;background:#315efb;color:#fff;border-radius:10px;padding:11px 22px;font-size:16px;cursor:pointer}.reset{border:1px solid #ccd3df;background:#fff;border-radius:10px;padding:10px 16px;cursor:pointer}.send:disabled{opacity:.5}.notice{font-size:12px;color:#697386;margin-top:10px}.welcome{color:#374151}.error{background:#fff0f0;color:#9b1c1c;padding:10px;border-radius:10px;margin-top:10px}
</style></head>
<body><div class="wrap">
<div class="top"><span class="tag">先生用テスト版</span><h1 class="title">いっしょに考えよう</h1><p class="sub">答えを教えるのではなく、問い返しで考えを深めるAI</p>
<div class="bar" id="modes"></div></div>
<div class="chat" id="chat"><div class="msg ai welcome">こんにちは。先生が子どもの立場になって試してみてください。\n\n例えば「門真はいい町だと思う。公園があるから。」と入力してみましょう。</div></div>
<div class="inputbox"><textarea id="input" placeholder="子どもになったつもりで、自分の考えを書いてみよう"></textarea><div class="actions"><button class="send" id="send">送る</button><button class="reset" id="reset">会話をリセット</button></div><div class="notice">※このテスト版では会話履歴をブラウザ上で保持し、AIへの次の質問に利用します。個人情報は入力しないでください。</div><div id="error"></div></div>
</div>
<script>
const modes=['探究','SDGs','国語','社会','算数'];let mode='探究';let history=[];
const chat=document.getElementById('chat'),input=document.getElementById('input'),send=document.getElementById('send'),reset=document.getElementById('reset'),error=document.getElementById('error');
function drawModes(){document.getElementById('modes').innerHTML=modes.map(m=>'<button class="mode '+(m===mode?'active':'')+'" onclick="setMode(\\''+m+'\\')">'+m+'</button>').join('')}
window.setMode=function(m){mode=m;drawModes()};drawModes();
function addMsg(text,who,aim){const d=document.createElement('div');d.className='msg '+who;d.textContent=text;chat.appendChild(d);if(aim){const a=document.createElement('div');a.className='aim';a.textContent='🔎 問い返しのねらい：'+aim;chat.appendChild(a)}chat.scrollTop=chat.scrollHeight}
function clearError(){error.innerHTML=''}
async function sendMessage(){const text=input.value.trim();if(!text)return;if(text.length>1200){error.innerHTML='<div class="error">1200文字以内で書いてください。</div>';return}clearError();addMsg(text,'me');history.push({role:'user',text:text});input.value='';send.disabled=true;send.textContent='考え中…';try{const result=await new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).askAI(history,mode));addMsg(result.reply,'ai',result.aim);history.push({role:'assistant',text:result.reply})}catch(e){error.innerHTML='<div class="error">うまくつながりませんでした。<br>'+String(e.message||e)+'</div>'}finally{send.disabled=false;send.textContent='送る';input.focus()}}
send.onclick=sendMessage;input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))sendMessage()});reset.onclick=()=>{history=[];chat.innerHTML='<div class="msg ai welcome">会話をリセットしました。\n\n新しいテーマを入力してみてください。</div>';clearError();input.focus()};
</script></body></html>`;
}
