#!/usr/bin/env node
// 318 自动情报采集器
// 定时搜索 318 国道相关资讯，生成情报页面推送到博客

const TAVILY_KEY = process.env.TAVILY_API_KEY;
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
  if (!TAVILY_KEY) throw new Error('未设置 TAVILY_API_KEY');
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BLOCKED_DOMAINS = /(taobao\.com|tmall\.com|jd\.com|youtube\.com|youtu\.be|douyin\.com|en\.wikipedia\.org|meilvtong\.com|mgoods\.taobao\.com)/i;

function isMostlyEnglish(text) {
  const str = String(text || '');
  const letters = (str.match(/[a-zA-Z]/g) || []).length;
  const total = str.replace(/\s+/g, '').length;
  return total > 0 && letters / total > 0.6;
}

function pickAnswer(d) {
  const candidates = [d.answer, ...(d.results || []).map(r => r.content)].filter(Boolean);
  for (const c of candidates) {
    if (!isMostlyEnglish(c)) return c;
  }
  return candidates[0] || '暂无信息';
}

function generateHTML(data) {
  const now = new Date();
  const ds = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const sections = data.map((d, i) => {
    const answer = pickAnswer(d);
    const sources = (d.results || []).filter(r => r.url && !BLOCKED_DOMAINS.test(r.url)).slice(0, 5);
    const sourcesHtml = sources.length
      ? `<div class="sources">${sources.map(s => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title || s.url)}</a>`).join('')}</div>`
      : '';
    return `
    <section class="section" aria-labelledby="sec-${i}">
      <h2 class="section-title" id="sec-${i}">${escapeHtml(SEARCH_QUERIES[i])}</h2>
      <div class="card">
        <p>${escapeHtml(answer).slice(0, 500).replace(/\n/g, '<br>')}</p>
        ${sourcesHtml}
      </div>
    </section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>318 情报站 — xiaoliang</title>
  <meta name="description" content="318国道最新资讯自动采集，路况、攻略、风景。">
  <meta name="robots" content="index,follow">
  <meta name="theme-color" content="#0b0b10">
  <link rel="canonical" href="https://blog.xiaoliangzou.eu.cc/318">
  <meta property="og:title" content="318 情报站 — xiaoliang">
  <meta property="og:description" content="318国道最新资讯自动采集，路况、攻略、风景。">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://blog.xiaoliangzou.eu.cc/318">
  <meta property="og:image" content="https://blog.xiaoliangzou.eu.cc/assets/social-preview.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://blog.xiaoliangzou.eu.cc/assets/social-preview.jpg">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%230b0b10'/><text x='16' y='23' font-family='serif' font-size='22' font-weight='700' fill='%23c9a96e' text-anchor='middle'>梁</text></svg>">
  <link rel="stylesheet" href="/assets/site.css">
  <style>
    .subtitle { margin: 6px 0 0; color: var(--dim); font-family: ui-serif, Georgia, "Times New Roman", "Songti SC", serif; font-size: 15px; }
    .updated { margin: 10px 0 0; color: var(--dim); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; }
    .status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #4ade80; margin-right: 6px; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    .card { padding: 16px 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); }
    .card p { margin: 0 0 12px; color: var(--muted); font-family: ui-serif, Georgia, "Times New Roman", "Songti SC", serif; font-size: 15px; line-height: 2; }
    .card p:last-child { margin-bottom: 0; }
    .sources { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
    .sources a { font-size: 11px; color: var(--accent); text-decoration: none; padding: 2px 8px; border: 1px solid var(--line); border-radius: 4px; transition: all .3s; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sources a:hover { border-color: var(--accent); background: rgba(201,169,110,.08); }
  </style>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "318 情报站 — xiaoliang",
    "url": "https://blog.xiaoliangzou.eu.cc/318",
    "description": "318国道最新资讯自动采集，路况、攻略、风景。"
  }
  </script>
</head>
<body>
  <main class="wrap">
    <nav class="nav" aria-label="主导航">
      <a class="logo" href="/">xiaoliang</a>
      <div class="nav-right">
        <div class="nav-links">
          <a href="/">首页</a>
          <a class="active" href="/318">318</a>
          <a href="/more">更多</a>
          <a href="/travel">照片</a>
          <a href="/now">Now</a>
        </div>
        <button class="theme" id="theme-btn" type="button" aria-label="切换主题">☽</button>
      </div>
    </nav>

    <section class="hero sub-hero" aria-labelledby="intel-title">
      <p class="kicker"><span class="pulse"></span>雅安 · 318 起点 · 自动情报</p>
      <h1 id="intel-title">318 情报站</h1>
      <p class="updated"><span class="status-dot"></span>更新于 ${ds} ${ts} · 自动采集</p>
    </section>

    ${sections}

    <footer class="footer">
      <p>© 2026 xiaoliang · 情报站由机器人每8小时自动更新</p>
      <p style="margin-top:8px;font-size:10px;color:var(--dim)">数据来源：Tavily Search</p>
    </footer>
  </main>
  <script>
    const body = document.body;
    const btn = document.getElementById('theme-btn');
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') { body.classList.add('light'); btn.textContent = '☀'; }
    btn.addEventListener('click', () => {
      body.classList.toggle('light');
      const isLight = body.classList.contains('light');
      btn.textContent = isLight ? '☀' : '☽';
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
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