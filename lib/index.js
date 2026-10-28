// dsh-memory-gui —— 记忆库 + 图书馆的浏览页
//
// 记忆：直接读 fish-memory 的每会话存储（session-*.json），服务端搜索/筛选。
// 图书馆：复用 dsh-pin 的 /dsh-pin/lib/* 接口（同源 fetch）。
// 页面：<DSH 地址>/dsh-memory-gui
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'memory-gui'
export const inject = ['webServer']

const 记忆目录 = join(homedir(), '.dsh', 'fish-memory')

function 会话文件们() {
  try {
    return readdirSync(记忆目录)
      .filter((f) => f.startsWith('session-') && f.endsWith('.json') && !f.includes('.bak'))
      .map((f) => ({ 文件: f, 路径: join(记忆目录, f) }))
  } catch { return [] }
}

function 读记忆() {
  const 出 = []
  for (const { 文件, 路径 } of 会话文件们()) {
    try {
      const j = JSON.parse(readFileSync(路径, 'utf8'))
      const 记忆 = j?.memories || []
      const 短id = 文件.replace(/^session-/, '').replace(/\.json$/, '')
      for (const m of 记忆) {
        if (!m || !m.text) continue
        出.push({
          session: 短id,
          id: String(m.id || ''),
          text: m.text,
          at: m.createdAt || m.at || '',
          category: m.category || '',
          importance: Number(m.importance ?? 0),
          tags: Array.isArray(m.tags) ? m.tags : [],
          source: m.source || '',
        })
      }
    } catch {}
  }
  return 出
}

function 会话列表() {
  const 出 = []
  for (const { 文件, 路径 } of 会话文件们()) {
    try {
      const j = JSON.parse(readFileSync(路径, 'utf8'))
      出.push({ id: 文件.replace(/^session-/, '').replace(/\.json$/, ''), count: (j?.memories || []).length })
    } catch {
      出.push({ id: 文件.replace(/^session-/, '').replace(/\.json$/, ''), count: 0 })
    }
  }
  return 出.sort((a, b) => b.count - a.count)
}

function 搜索(记忆, q, 会话, 排序) {
  const 词 = String(q || '').trim().toLowerCase()
  let 结果 = 记忆
  if (会话 && 会话 !== 'all') 结果 = 结果.filter((m) => m.session === 会话)
  if (词) 结果 = 结果.filter((m) => (m.text + (m.tags || []).join(' ') + m.category).toLowerCase().includes(词))
  if (排序 === 'importance') 结果.sort((a, b) => b.importance - a.importance)
  else 结果.sort((a, b) => String(b.at).localeCompare(String(a.at)))
  return 结果
}

const 页面 = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>记忆库 · 图书馆</title>
<style>
 body{background:#14161a;color:#dcdcdc;font:13px/1.7 "Microsoft YaHei",system-ui,sans-serif;margin:0;padding:20px 26px}
 h1{font-size:17px;margin:0 0 4px}.sub{color:#8a8a8a;font-size:12px;margin-bottom:14px}
 .bar{display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap}
 .bar button{background:#1f2227;color:#dcdcdc;border:1px solid #2f333a;border-radius:6px;padding:4px 12px;cursor:pointer}
 .bar button.on{background:#2a3550;border-color:#3b4d78}
 input,select{background:#191b20;color:#dcdcdc;border:1px solid #2f333a;border-radius:6px;padding:5px 9px;font:inherit}
 .card{background:#191b20;border:1px solid #24272d;border-radius:10px;padding:10px 14px;margin-bottom:10px}
 .card .t{white-space:pre-wrap;line-height:1.65}
 .card .m{color:#7a8088;font-size:11px;margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
 .tag{display:inline-block;padding:0 5px;border-radius:2px;font-size:11px;border:1px solid rgba(128,128,128,.3);opacity:.75}
 .k{color:#8fb4ff}.warn{color:#e0b070}
 .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
 @media(max-width:900px){.cols{grid-template-columns:1fr}}
</style></head><body>
<h1>记忆库 · 图书馆</h1>
<div class="sub" id="sub"></div>
<div class="bar">
  <button data-p="mem" class="on">记忆</button>
  <button data-p="lib">图书馆</button>
  <span id="extra" style="margin-left:auto"></span>
</div>
<div id="mem" >
  <div class="bar">
    <input id="q" placeholder="搜关键词" style="width:220px">
    <select id="sess"></select>
    <select id="sort"><option value="recency">按时间</option><option value="importance">按重要度</option></select>
    <button id="go">搜</button>
  </div>
  <div id="list"></div>
</div>
<div id="lib" style="display:none">
  <div class="bar">
    <input id="n" placeholder="它叫什么" style="width:180px">
    <input id="u" placeholder="它能解决什么" style="flex:1;min-width:220px">
    <button id="add">收进图书馆</button>
  </div>
  <div id="liblist"></div>
</div>
<script>
const 万=n=>n>=1e4?(n/1e4).toFixed(1)+'w':String(n);
let 页='mem';
async function 拉会话(){
  const j=await (await fetch('/dsh-memory-gui/api/sessions')).json();
  const s=document.getElementById('sess');
  s.innerHTML='<option value="all">全部会话</option>'+j.map(x=>'<option value="'+x.id+'">'+x.id.slice(0,8)+'（'+x.count+'）</option>').join('');
}
async function 拉记忆(){
  const q=document.getElementById('q').value, sess=document.getElementById('sess').value, sort=document.getElementById('sort').value;
  const u='/dsh-memory-gui/api/memory?q='+encodeURIComponent(q)+'&session='+encodeURIComponent(sess)+'&sort='+sort+'&limit=200';
  const j=await (await fetch(u)).json();
  document.getElementById('sub').textContent='记忆共 '+万(j.total)+' 条，显示 '+j.rows.length+' 条';
  document.getElementById('list').innerHTML=j.rows.map(m=>
    '<div class="card"><div class="t">'+esc(m.text)+'</div><div class="m">'
    +'<span class="k">'+m.session.slice(0,8)+'</span>'
    +(m.importance?'<span class="tag">重要 '+m.importance+'</span>':'')
    +(m.category?'<span class="tag">'+esc(m.category)+'</span>':'')
    +(m.at?'<span>'+esc(m.at)+'</span>':'')
    +(m.tags||[]).map(t=>'<span class="tag">#'+esc(t)+'</span>').join('')
    +'</div></div>').join('') || '<div class="sub">没有对得上的。</div>';
}
async function 拉馆(){
  const j=await (await fetch('/dsh-pin/lib/list',{cache:'no-store'})).json();
  const it=j.ok?(j.items||[]):[];
  document.getElementById('liblist').innerHTML=it.map(x=>
    '<div class="card"><div style="font-weight:600">'+esc(x.name)+'</div>'
    +'<div class="t" style="margin-top:3px">'+esc(x.use)+'</div>'
    +'<div class="m"><span style="margin-left:auto"><button data-del="'+x.id+'">删</button></span></div></div>').join('')
    || '<div class="sub">图书馆是空的。</div>';
  document.getElementById('liblist').querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
    await fetch('/dsh-pin/lib/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:b.dataset.del})});
    拉馆();
  });
}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
document.querySelectorAll('.bar button[data-p]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.bar button[data-p]').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');页=b.dataset.p;
  document.getElementById('mem').style.display=页==='mem'?'':'none';
  document.getElementById('lib').style.display=页==='lib'?'':'none';
  if(页==='lib')拉馆();
});
document.getElementById('go').onclick=拉记忆;
document.getElementById('q').addEventListener('keydown',e=>{if(e.key==='Enter')拉记忆()});
document.getElementById('add').onclick=async()=>{
  const n=document.getElementById('n').value.trim(),u=document.getElementById('u').value.trim();
  if(!n||!u)return;
  await fetch('/dsh-pin/lib/add',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:n,use:u})});
  document.getElementById('n').value='';document.getElementById('u').value='';拉馆();
};
拉会话();拉记忆();
</script></body></html>`

function 转义(s) { return String(s ?? '') }

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/dsh-memory-gui',
    handler: async (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(页面)
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/dsh-memory-gui/api/sessions',
    handler: async (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(会话列表()))
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/dsh-memory-gui/api/memory',
    handler: async (req, res) => {
      try {
        const u = new URL(req.url || '/', 'http://x')
        const 记忆 = 读记忆()
        const 结果 = 搜索(记忆, u.searchParams.get('q'), u.searchParams.get('session'), u.searchParams.get('sort'))
        const limit = Math.max(1, Math.min(500, Number(u.searchParams.get('limit') || 200)))
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ total: 记忆.length, rows: 结果.slice(0, limit) }))
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ total: 0, rows: [], error: e?.message ?? String(e) }))
      }
    },
  }))
}
