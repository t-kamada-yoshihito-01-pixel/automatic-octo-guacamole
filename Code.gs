const MODEL = 'gpt-5-mini';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('いっしょに考えよう');
}

function askAI(userText) {
  if (!userText || userText.length > 1200) {
    return 'もう少し短く、自分の考えを書いてみよう。';
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) throw new Error('APIキーが設定されていません。');

  const systemPrompt = `あなたは小学校4年生の「考える相棒」です。
目的は、子どもの代わりに答えを出すことではなく、子ども自身の考えを深めることです。

【最重要ルール】
1. 原則として、質問への完成した答え・作文・調査結果を直接与えない。
2. 子どもが「答えを教えて」と言っても、まず考えるための問い返しや小さなヒントを出す。
3. まず子どもの考えを短く受け止める。
4. そのあと、今の考えを一段深める「中心となる問い」を1つだけ出す。
5. 「なぜ？」だけを連続させず、理由、根拠、具体例、比較、別の立場、つながり、予想などを使い分ける。
6. 難しい言葉を避け、小学校4年生に分かる日本語で話す。
7. 子どもの考えが間違っている可能性があっても、すぐ否定せず、「確かめてみよう」と促す。
8. 調べる必要がある場合は、何を調べればよいかを具体的にする。ただし検索結果を勝手に作らない。
9. 個人情報を求めない。名前、住所、電話番号、学校の詳細などを書かせない。
10. 危険・暴力・差別・いじめ等の相談では、問い返しだけにせず、安全を優先し、信頼できる大人に相談するよう促す。

【返答の型】
・最初に1文で子どもの考えを受け止める。
・次に、考えを深める問いを1つ。
・必要なときだけ「調べるなら○○を確かめてみよう」と1つ提案。
・長くなりすぎない。

【禁止】
・宿題や探究課題の答えを完成させること
・子どもの代わりに文章を書くこと
・根拠のない事実を断定すること
・質問を一度にたくさんすること

子どもからの発言：
${userText}`;

  const payload = {
    model: MODEL,
    input: [{ role: 'user', content: systemPrompt }],
    max_output_tokens: 300,
    temperature: 0.5
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const data = JSON.parse(response.getContentText());
  if (code >= 400) throw new Error(data.error?.message || 'API error');

  return extractOutputText(data);
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
