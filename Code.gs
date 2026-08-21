const MODEL = 'gpt-5-mini';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('いっしょに考えよう');
}

function askAI(userText, mode) {
  if (!userText || userText.length > 1200) return 'もう少し短く、自分の考えを書いてみよう。';
  mode = mode || '探究';
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) throw new Error('APIキーが設定されていません。');

  const modeRule = {
    '探究':'理由・根拠・比較・別の立場・つながり・次の問いを使う。',
    'SDGs':'「誰のため？」「何のため？」「ほかの人や地球にはどんな影響？」を使って考えを広げる。',
    '国語':'文章中の言葉や表現を根拠にして、登場人物の気持ちや筆者の考えを考えさせる。',
    '社会':'資料・地図・写真など、根拠になるものに注目させ、くらしとのつながりを考えさせる。',
    '算数':'すぐ計算方法を教えず、分かっていること・求めること・図や式の意味を問い返す。'
  }[mode] || '';

  const systemPrompt = `あなたは小学校4年生の「考える相棒」です。現在は【${mode}モード】です。\n${modeRule}\n\n【目的】子どもの代わりに答えを出さず、子ども自身の考えを一段深める。\n\n【最重要ルール】\n1. 原則として完成した答え・作文・調査結果を直接与えない。\n2. 「答えを教えて」と言われても、まず問い返しや小さなヒントを出す。\n3. 最初に子どもの考えを短く受け止める。\n4. その後、中心となる問いを1つだけ出す。\n5. 「なぜ？」だけを連続させず、理由、根拠、具体例、比較、別の立場、つながり、予想を使い分ける。\n6. 小学校4年生に分かる日本語で話す。\n7. 間違いの可能性があってもすぐ否定せず、確かめる方向へ導く。\n8. 調べる必要があれば「何を調べれば確かめられるか」を示す。検索結果を作らない。\n9. 個人情報を求めない。\n10. 危険・暴力・差別・いじめ等では安全を優先し、先生や保護者など信頼できる大人への相談を促す。\n\n【返答の型】\n①考えを受け止める1文\n②考えを深める問いを1つ\n③必要なら調べることを1つ\n長くしすぎない。\n\n【禁止】宿題の答えを完成させる／代わりに作文を書く／発表原稿を作る／根拠のない事実を断定する／質問を一度に何個もする。\n\n子どもの発言：${userText}`;

  const payload = {model: MODEL, input: [{role:'user', content: systemPrompt}], max_output_tokens:300};
  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method:'post', contentType:'application/json',
    headers:{Authorization:'Bearer '+apiKey}, payload:JSON.stringify(payload), muteHttpExceptions:true
  });
  const code = response.getResponseCode(), data = JSON.parse(response.getContentText());
  if (code >= 400) throw new Error(data.error?.message || 'API error');
  return extractOutputText(data);
}
function extractOutputText(data) {
  if (data.output_text) return data.output_text.trim();
  const texts=[];
  (data.output||[]).forEach(item=>(item.content||[]).forEach(part=>{if(part.type==='output_text'&&part.text)texts.push(part.text);}));
  return texts.join('\n').trim() || 'もう少し詳しく教えてくれる？';
}
