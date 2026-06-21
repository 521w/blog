#!/usr/bin/env node
// 318 自动情报采集器
// 定时搜索 318 国道相关资讯，生成情报页面推送到博客

const TAVILY_KEY = process.env.TAVILY_API_KEY || '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';
const TAVILY_URL = 'https://api.tavily.com/search';
const BLOG_DIR = '/data/data/com.termux/files/home/blog';
const GH_REPO = '521w/blog';

const SEARCH_QUERIES = [
  '318国道 路况 今日',
  '318川藏线 最新消息',
  '318国道 自驾 攻略 2026',
  '雅安 318 起点',
  '川藏线 风景 小众景点',
  '318国道 封路 交通',
];

// 从 git-credentials 提取 GitHub token
async function getGitHubToken() {
  const { readFile, access } = await import('fs/promises');
  const { homedir } = await import('os');
  const credPath = `${homedir()}/.git-credentials`;
  try {
    await access(credPath);
    const buf = await readFile(credPath);
    const line = buf.toString('utf-8').split('\n')[0];
    const parts = line.split('@')[0];
    const token = parts.split(':').pop();
    return token && token.startsWith('ghp_') ? token : null;
  } catch { return null; }
}

async function searchTavily(query) {
  const res = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: TAVILY_KEY, query, search_depth: 'advanced', max_results: 6, include_answer: true }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  return res.json();
}

async function writeToGitHub(html) {
  const token = await getGitHubToken();
  if (!token) { console.log('[318] 无 GitHub token'); return; }

  const encoded = Buffer.from(html).toString('base64');
  const url = `https://api.github.com/repos/${GH_REPO}/contents/318.html`;

  // Check existing
  let sha = null;
  try {
    const res = await fetch(url, { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch (e) { /* 不存在也无所谓 */ }

  const body = { message: `auto: 318情报 ${new Date().toISOString().slice(0,10)}`, content: encoded, branch: 'main' };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) console.log('[318] GitHub 上传成功');
  else console.log(`[318] GitHub 上传失败: ${res.status}`);
}

function generateHTML(data) {
  const now = new Date();
  const ds = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const sections = data.map((d, i) => {
    const answer = d.answer || d.results?.[0]?.content || '暂无信息';
    const sources = (d.results || []).slice(0, 5);
    return `
    <div class="section">
      <div class="section-label">${SEARCH_QUERIES[i]}</div>
      <div class="card">
        <p>${answer.slice(0, 500).replace(/\n/g, '<br>')}</p>
        <div class="sources">
          ${sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.title}</a>`).join('')}
        </div>
      </div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>318 情报站 — xiaoliang</title>
  <meta name="description" content="318国道最新资讯自动采集，路况、攻略、风景。">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%230a0a0f'/><text x='16' y='23' font-family='serif' font-size='22' font-weight='700' fill='%23c9a96e' text-anchor='middle'>梁</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    :root { --bg: #0a0a0f; --bg-soft: #0f0f14; --text: #f0f0f5; --text-muted: #8a8a95; --text-dim: #5a5a65; --accent: #c9a96e; --line: rgba(255,255,255,0.06); --card: rgba(255,255,255,0.03); }
    .light { --bg: #fafafa; --bg-soft: #f5f5f0; --text: #171717; --text-muted: #525252; --text-dim: #a3a3a3; --accent: #8b6914; --line: rgba(0,0,0,0.08); --card: rgba(0,0,0,0.02); }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); line-height:1.7; -webkit-font-smoothing:antialiased; min-height:100vh; padding:40px 24px 80px; transition:background .4s,color .4s; }
    .content { max-width:680px; margin:0 auto; }
    .nav { display:flex; justify-content:space-between; align-items:center; margin-bottom:48px; padding-bottom:16px; border-bottom:1px solid var(--line); }
    .nav-logo { font-family:'Inter',sans-serif; font-size:13px; font-weight:500; letter-spacing:.2em; text-transform:uppercase; color:var(--text); text-decoration:none; }
    .nav-links { display:flex; gap:24px; font-size:12px; font-weight:300; letter-spacing:.1em; text-transform:uppercase; }
    .nav-links a { color:var(--text-dim); text-decoration:none; transition:color .3s; }
    .nav-links a:hover { color:var(--text); }
    .theme-toggle { background:none; border:1px solid var(--line); color:var(--text-dim); width:32px; height:32px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; transition:all .3s; }
    .theme-toggle:hover { border-color:var(--accent); color:var(--accent); }
    h1 { font-family:'Noto Serif SC',serif; font-size:28px; font-weight:700; margin-bottom:4px; letter-spacing:.04em; color:var(--text); }
    .subtitle { font-family:'Noto Serif SC',serif; font-size:14px; color:var(--text-dim); margin-bottom:4px; }
    .updated { font-family:'Inter',sans-serif; font-size:11px; letter-spacing:.15em; color:var(--text-dim); margin-bottom:36px; }
    .status-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:#4ade80; margin-right:6px; animation:pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    .divider { width:48px; height:1px; background:var(--accent); margin-bottom:36px; }
    .section { margin-bottom:40px; }
    .section-label { font-family:'Inter',sans-serif; font-size:10px; font-weight:500; letter-spacing:.3em; text-transform:uppercase; color:var(--text-dim); margin-bottom:12px; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:16px 20px; }
    .card p { font-family:'Noto Serif SC',serif; font-size:14px; color:var(--text-muted); line-height:2; margin-bottom:12px; }
    .card p:last-child { margin-bottom:0; }
    .sources { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
    .sources a { font-size:11px; color:var(--accent); text-decoration:none; padding:2px 8px; border:1px solid var(--line); border-radius:4px; transition:all .3s; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .sources a:hover { border-color:var(--accent); background:rgba(201,169,110,.08); }
    .footer { margin-top:48px; padding-top:16px; border-top:1px solid var(--line); text-align:center; font-size:11px; color:var(--text-dim); font-weight:300; }
    .footer a { color:var(--accent); text-decoration:none; }
  </style>
</head>
<body>
  <div class="content">
    <nav class="nav">
      <a href="/" class="nav-logo">xiaoliang</a>
      <div style="display:flex;align-items:center;gap:20px;">
        <div class="nav-links">
          <a href="/">首页</a>
          <a href="/now.html">Now</a>
          <a href="/318.html" style="color:var(--accent)">情报站</a>
        </div>
        <button class="theme-toggle" id="theme-btn" onclick="toggleTheme()" title="切换主题">☽</button>
      </div>
    </nav>
    <h1>🚗 318 情报站</h1>
    <p class="subtitle">雅安 · 318 起点 · 自动情报</p>
    <p class="updated"><span class="status-dot"></span>更新于 ${ds} ${ts} · 自动采集</p>
    <div class="divider"></div>
    ${sections}
    <div class="footer">
      <p>© 2026 xiaoliang · 情报站由机器人每8小时自动更新</p>
      <p style="margin-top:8px;font-size:10px;color:var(--text-dim)">数据来源：Tavily Search</p>
    </div>
  </div>
  <script>
    function toggleTheme(){document.body.classList.toggle('light');const l=document.body.classList.contains('light');document.getElementById('theme-btn').textContent=l?'☀':'☽';localStorage.setItem('theme',l?'light':'dark')}
    (function(){const s=localStorage.getItem('theme');if(s==='light'){document.body.classList.add('light');const b=document.getElementById('theme-btn');if(b)b.textContent='☀'}})();
  </script>
</body>
</html>`;
}

async function main() {
  console.log('[318] 开始采集...');
  const allData = [];

  for (const q of SEARCH_QUERIES) {
    console.log(`  ${q}`);
    try {
      const data = await searchTavily(q);
      allData.push(data);
    } catch (e) {
      console.log(`  ✗ ${e.message}`);
      allData.push({ results: [], answer: '获取失败' });
    }
  }

  const html = generateHTML(allData);
  const { writeFileSync } = await import('fs');
  writeFileSync(`${BLOG_DIR}/318.html`, html, 'utf-8');
  console.log('[318] 318.html 已写入本地');

  await writeToGitHub(html);
  console.log('[318] 完成');
}

main().catch(e => console.error('[318] 错误:', e));