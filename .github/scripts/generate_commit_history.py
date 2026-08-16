#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import subprocess
import json
import os
import sys

def get_commit_data():
    try:
        output = subprocess.check_output(
            ['git', 'log', '--pretty=format:%H|%an|%ad|%s', '--date=iso'],
            text=True
        )
        commits = []
        for line in output.strip().split('\n'):
            if not line:
                continue
            parts = line.split('|', 3)
            if len(parts) == 4:
                commits.append({
                    'hash': parts[0][:7],
                    'author': parts[1],
                    'date': parts[2],
                    'subject': parts[3]
                })
        return commits
    except subprocess.CalledProcessError as e:
        print(f"Error running git log: {e}", file=sys.stderr)
        return []

def generate_html(commits):
    repo = os.environ.get('GITHUB_REPOSITORY', 'DyWriteCode/DyWriteCode.github.io')
    json_data = json.dumps(commits, ensure_ascii=False)

    html_template = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📜 提交历史</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background: #f4f6f9; padding: 30px 20px; color: #1e293b; }}
        .container {{ max-width: 1300px; margin: 0 auto; background: #ffffff; border-radius: 24px; box-shadow: 0 12px 40px rgba(0,0,0,0.06); padding: 28px 30px 36px; }}
        .header {{ display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; border-bottom: 2px solid #edf2f7; padding-bottom: 16px; }}
        .header h1 {{ font-size: 26px; font-weight: 600; display: flex; align-items: center; gap: 10px; }}
        .header h1 small {{ font-size: 16px; font-weight: 400; color: #6b7a8f; }}
        .commit-count {{ background: #eef2f6; padding: 6px 16px; border-radius: 40px; font-size: 14px; color: #334155; font-weight: 500; }}
        .search-area {{
            position: sticky;
            top: 0;
            z-index: 10;
            background: #f8fafc;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 22px;
            padding: 6px 16px 6px 20px;
            border-radius: 60px;
            border: 1px solid #e2e8f0;
            transition: border-color 0.2s, box-shadow 0.2s;
            backdrop-filter: blur(4px);
            border-bottom: 1px solid #d1d9e6;
        }}
        .search-area:focus-within {{ border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,0.12); }}
        .search-area .search-icon {{ font-size: 18px; color: #94a3b8; flex-shrink: 0; }}
        .search-area input {{ flex: 1; border: none; background: transparent; padding: 12px 0; font-size: 16px; outline: none; color: #0f172a; min-width: 160px; }}
        .search-area input::placeholder {{ color: #94a3b8; font-weight: 400; }}
        .search-meta {{ display: flex; align-items: center; gap: 10px; flex-shrink: 0; }}
        .search-meta .match-info {{ font-size: 14px; color: #475569; min-width: 60px; text-align: center; user-select: none; }}
        .search-meta .nav-btn {{ background: transparent; border: 1px solid #d1d9e6; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; color: #334155; transition: background 0.15s, border-color 0.15s; }}
        .search-meta .nav-btn:hover:not(:disabled) {{ background: #eef2f6; border-color: #b0c0d0; }}
        .search-meta .nav-btn:disabled {{ opacity: 0.3; cursor: not-allowed; }}
        .search-meta .clear-btn {{ background: transparent; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; padding: 0 4px; transition: color 0.15s; display: none; }}
        .search-meta .clear-btn.visible {{ display: inline-block; }}
        .search-meta .clear-btn:hover {{ color: #475569; }}
        .table-wrap {{ overflow-x: auto; border-radius: 16px; border: 1px solid #edf2f7; background: #ffffff; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 14px; min-width: 600px; }}
        th {{ text-align: left; padding: 14px 18px; background: #f8fafc; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e2e8f0; position: sticky; top: 0; z-index: 2; }}
        td {{ padding: 12px 18px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; transition: background 0.15s; cursor: default; }}
        tr:last-child td {{ border-bottom: none; }}
        tr.hidden {{ display: none; }}
        tr.current-match td {{ background: #fef9e7 !important; outline: 2px solid #facc15; outline-offset: -2px; }}
        tr[data-hash] {{ cursor: pointer; }}
        tr[data-hash]:hover td {{ background: #f1f5f9; }}
        .highlight {{ background: #fde047; padding: 0 2px; border-radius: 2px; font-weight: 500; }}
        .author-tag {{ display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px 4px 8px; border-radius: 40px; font-weight: 500; font-size: 13px; background: #eef2f6; color: #1e293b; }}
        .author-tag .avatar {{ width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: #fff; flex-shrink: 0; }}
        .hash {{ font-family: 'JetBrains Mono', 'Cascadia Code', monospace; background: #f1f5f9; padding: 2px 8px; border-radius: 12px; font-size: 13px; color: #1e293b; letter-spacing: 0.2px; }}
        .date {{ color: #475569; font-size: 13px; white-space: nowrap; }}
        .subject {{ max-width: 380px; word-break: break-word; }}
        .no-results {{ text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 16px; }}
        @media (max-width: 680px) {{ .container {{ padding: 18px 14px; }} .header {{ flex-direction: column; align-items: stretch; }} .header h1 {{ font-size: 22px; }} .search-area {{ padding: 4px 12px 4px 16px; border-radius: 40px; }} .search-meta .match-info {{ min-width: 44px; font-size: 13px; }} .search-meta .nav-btn {{ width: 28px; height: 28px; font-size: 14px; }} th, td {{ padding: 10px 12px; font-size: 13px; }} .author-tag {{ font-size: 12px; padding: 2px 10px 2px 6px; }} .hash {{ font-size: 12px; }} }}
        @media (max-width: 480px) {{ .table-wrap {{ border-radius: 12px; }} table {{ font-size: 12px; min-width: 480px; }} .subject {{ max-width: 140px; }} }}
        .table-wrap::-webkit-scrollbar {{ height: 6px; }}
        .table-wrap::-webkit-scrollbar-thumb {{ background: #d1d9e6; border-radius: 12px; }}
        .table-wrap::-webkit-scrollbar-track {{ background: #f1f5f9; }}
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>📜 提交历史 <small>— 所有版本</small></h1>
        <div class="commit-count" id="totalCount">共 0 条</div>
    </div>
    <div class="search-area">
        <span class="search-icon">🔍</span>
        <input type="text" id="searchInput" placeholder="搜索哈希、作者、备注或日期… (支持 hash:|h:, author:|a:, subject:|s:, date:|d: 前缀)" autofocus>
        <div class="search-meta">
            <span class="match-info" id="matchInfo">0 / 0</span>
            <button class="nav-btn" id="prevBtn" title="上一个匹配 (Shift+Enter)">↑</button>
            <button class="nav-btn" id="nextBtn" title="下一个匹配 (Enter)">↓</button>
            <button class="clear-btn" id="clearBtn" title="清除搜索">✕</button>
        </div>
    </div>
    <div class="table-wrap">
        <table>
            <thead><tr><th style="width:12%;">哈希</th><th style="width:16%;">作者</th><th style="width:22%;">日期</th><th style="flex:1;">备注</th></tr></thead>
            <tbody id="commitBody"></tbody>
        </table>
        <div id="noResult" class="no-results" style="display:none;">🔎 没有匹配的提交</div>
    </div>
</div>
<script>
(function() {{
    'use strict';
    const commitData = {json_data};
    const repo = '{repo}';

    const tbody = document.getElementById('commitBody');
    const noResult = document.getElementById('noResult');
    const totalCount = document.getElementById('totalCount');
    const searchInput = document.getElementById('searchInput');
    const matchInfo = document.getElementById('matchInfo');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const clearBtn = document.getElementById('clearBtn');

    // ----- 作者颜色生成 -----
    const authorColorMap = new Map();
    const avatarColors = ['#3b82f6','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#6366f1','#d946ef','#f97316','#14b8a6'];
    function getAuthorColor(author) {{
        if (authorColorMap.has(author)) return authorColorMap.get(author);
        let hash = 0;
        for (let i = 0; i < author.length; i++) hash = author.charCodeAt(i) + ((hash << 5) - hash);
        const color = avatarColors[Math.abs(hash) % avatarColors.length];
        authorColorMap.set(author, color);
        return color;
    }}

    // 转义正则特殊字符
    function escapeRegExp(str) {{
        return str.replace(/[.*+?^${{}}()|[\]\\\\]/g, '\\\\$&');
    }}

    /**
     * 渲染表格，并可对指定字段添加高亮
     * @param {Array} data          - 提交数据数组
     * @param {Array} highlightFields - 需要高亮的字段名列表，如 ['hash', 'subject']
     * @param {string} query       - 高亮关键词（已转义）
     */
    function renderTable(data, highlightFields, query) {{
        if (data.length === 0) {{
            tbody.innerHTML = '';
            noResult.style.display = 'block';
            totalCount.textContent = '共 0 条';
            return;
        }}
        noResult.style.display = 'none';
        totalCount.textContent = `共 ${{data.length}} 条`;

        let html = '';
        data.forEach(item => {{
            const color = getAuthorColor(item.author);
            const initial = item.author.charAt(0).toUpperCase();

            // 各字段原始内容
            let hashText = item.hash;
            let authorText = item.author;
            let dateText = item.date;
            let subjectText = item.subject;

            // 如果指定了高亮字段且查询词存在，则对相应字段进行高亮替换
            if (highlightFields && highlightFields.length && query) {{
                const regex = new RegExp(escapeRegExp(query), 'gi');
                if (highlightFields.includes('hash')) {{
                    hashText = hashText.replace(regex, match => `<span class="highlight">${{match}}</span>`);
                }}
                if (highlightFields.includes('author')) {{
                    authorText = authorText.replace(regex, match => `<span class="highlight">${{match}}</span>`);
                }}
                if (highlightFields.includes('date')) {{
                    dateText = dateText.replace(regex, match => `<span class="highlight">${{match}}</span>`);
                }}
                if (highlightFields.includes('subject')) {{
                    subjectText = subjectText.replace(regex, match => `<span class="highlight">${{match}}</span>`);
                }}
            }}

            html += `<tr data-hash="${{item.hash}}" data-author="${{item.author}}" data-date="${{item.date}}" data-subject="${{item.subject}}">
                <td><span class="hash">${{hashText}}</span></td>
                <td><span class="author-tag"><span class="avatar" style="background:${{color}};">${{initial}}</span>${{authorText}}</span></td>
                <td class="date">${{dateText}}</td>
                <td class="subject">${{subjectText}}</td>
            </tr>`;
        }});
        tbody.innerHTML = html;
    }}

    // 初始渲染（无高亮）
    renderTable(commitData);

    // ----- 双击跳转 GitHub -----
    tbody.addEventListener('dblclick', function(e) {{
        const tr = e.target.closest('tr');
        if (!tr) return;
        const hash = tr.dataset.hash;
        if (hash) window.open(`https://github.com/${{repo}}/commit/${{hash}}`, '_blank');
    }});

    // ============================================================
    // 增强搜索功能：字段前缀、过滤、高亮、导航
    // ============================================================
    function parseSearch(input) {{
        const trimmed = input.trim();
        if (!trimmed) return {{ field: null, value: '' }};
        const lower = trimmed.toLowerCase();
        const prefixMap = {{
            'hash:': 'hash', 'h:': 'hash',
            'author:': 'author', 'a:': 'author',
            'date:': 'date', 'd:': 'date',
            'subject:': 'subject', 's:': 'subject'
        }};
        for (const [key, field] of Object.entries(prefixMap)) {{
            if (lower.startsWith(key)) {{
                const value = trimmed.slice(key.length).trim();
                if (value) return {{ field, value }};
                break;
            }}
        }}
        return {{ field: null, value: trimmed }};
    }}

    // 辅助函数：将日期字符串标准化为 YYYY-MM-DD，并处理查询中的非零填充
    function normalizeDateForMatch(dateStr) {{
        // dateStr 形如 "2026-08-15 10:30:00 +0800"，取前10位
        return dateStr.substring(0, 10);
    }}
    function normalizeQueryDate(query) {{
        // 将用户输入的日期补零，如 "2026-8-15" -> "2026-08-15"
        const parts = query.split('-');
        if (parts.length !== 3) return query; // 不是标准日期格式，原样返回
        const year = parts[0].padStart(4, '0');
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${{year}}-${{month}}-${{day}}`;
    }}

    let currentMatches = [], currentIndex = -1;

    function performSearch() {{
        const {{ field, value: rawQuery }} = parseSearch(searchInput.value);
        let query = rawQuery; // 原始查询词

        // 清空搜索状态（未输入或清空）
        if (!query) {{
            renderTable(commitData);
            currentMatches = [];
            currentIndex = -1;
            matchInfo.textContent = '0 / 0';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            clearBtn.classList.remove('visible');
            totalCount.textContent = `共 ${{commitData.length}} 条`;
            noResult.style.display = 'none';
            return;
        }}

        clearBtn.classList.add('visible');

        // 标准化查询（仅针对日期字段）
        let queryForFilter = query;
        let dateNormalizedQuery = null;
        if (field === 'date') {{
            // 尝试将用户输入转为 YYYY-MM-DD
            dateNormalizedQuery = normalizeQueryDate(query);
            // 同时保留原始query用于高亮显示（高亮时显示原词）
            queryForFilter = dateNormalizedQuery;
        }}

        // ---------- 过滤数据 ----------
        const filtered = commitData.filter(item => {{
            if (field) {{
                let value = item[field];
                if (field === 'date') {{
                    // 日期字段特殊处理：取日期部分并标准化比较
                    const datePart = normalizeDateForMatch(value);
                    return datePart.toLowerCase().includes(queryForFilter.toLowerCase());
                }} else {{
                    return value && value.toLowerCase().includes(query.toLowerCase());
                }}
            }} else {{
                // 全局搜索：对所有字段进行搜索，其中日期也做标准化
                const hashMatch = item.hash.toLowerCase().includes(query.toLowerCase());
                const authorMatch = item.author.toLowerCase().includes(query.toLowerCase());
                const datePart = normalizeDateForMatch(item.date);
                const dateMatch = datePart.toLowerCase().includes(query.toLowerCase());
                const subjectMatch = item.subject.toLowerCase().includes(query.toLowerCase());
                return hashMatch || authorMatch || dateMatch || subjectMatch;
            }}
        }});

        // ---------- 决定高亮字段 ----------
        let highlightFields = [];
        if (field) {{
            highlightFields = [field];
        }} else {{
            // 全局搜索：只高亮 hash 和 subject（避免破坏 author 标签），日期不参与高亮（日期格式复杂）
            highlightFields = ['hash', 'subject'];
        }}

        // ---------- 渲染过滤后的数据并应用高亮 ----------
        // 高亮时使用的查询词：对于日期字段，用原始查询词（用户输入的），因为高亮目标是日期字段的完整字符串，可能包含时间等，但我们在 renderTable 中对 date 进行高亮时，将使用原始 query 去匹配
        // 但是我们在 renderTable 中高亮 date 字段时，我们需要用原始 query（未经标准化），因为用户期望看到原始输入的高亮。
        // 然而我们过滤时使用了标准化后的 query，所以过滤出的数据中 date 字段是完整的。高亮时仍用原始 query 去匹配。
        // 注意：如果 query 是 "2026-8-15"，而 date 是 "2026-08-15 ..."，则高亮不会匹配，因为子串不同。所以对 date 高亮我们不做，或者我们可以在高亮时也标准化？但为了用户体验，我们不对 date 进行高亮，因为日期格式固定，用户输入可能不完全匹配，高亮意义不大。所以我们就不对 date 高亮。
        // 因此，在 highlightFields 中去掉 date（如果有的话）
        if (highlightFields.includes('date')) {{
            // 如果字段搜索是 date，高亮时使用原始 query，但可能不匹配，所以我们可以用标准化后的 query 来高亮，但会高亮完整日期部分。
            // 建议：对 date 字段高亮时，使用标准化后的 queryForFilter 来匹配，但为了统一，我们改用原始 query 也行，但可能不匹配。
            // 更稳健的做法：在 renderTable 中对 date 字段的高亮逻辑，将 date 和 query 都标准化后再比较，但高亮时替换的是匹配的子串，这比较复杂。
            // 简化：不对日期进行高亮，只过滤。因为日期搜索通常用于定位，高亮不是必须。
            highlightFields = highlightFields.filter(f => f !== 'date');
        }}
        // 对于全局搜索，我们原本就不包含 date，所以没问题。

        renderTable(filtered, highlightFields, query);

        // 获取当前所有可见行（已过滤）
        const rows = tbody.querySelectorAll('tr');
        currentMatches = Array.from(rows);
        currentIndex = -1;
        if (currentMatches.length > 0) {{
            currentIndex = 0;
            currentMatches[0].classList.add('current-match');
            currentMatches[0].scrollIntoView({{ block: 'nearest', behavior: 'smooth' }});
            prevBtn.disabled = false;
            nextBtn.disabled = false;
        }} else {{
            prevBtn.disabled = true;
            nextBtn.disabled = true;
        }}
        matchInfo.textContent = currentMatches.length > 0 ? `1 / ${{currentMatches.length}}` : '0 / 0';
        // 注意：totalCount 已在 renderTable 中更新为过滤后的数量
    }}

    function navigate(delta) {{
        if (currentMatches.length === 0) return;
        if (currentIndex >= 0) currentMatches[currentIndex].classList.remove('current-match');
        currentIndex = (currentIndex + delta + currentMatches.length) % currentMatches.length;
        currentMatches[currentIndex].classList.add('current-match');
        currentMatches[currentIndex].scrollIntoView({{ block: 'nearest', behavior: 'smooth' }});
        matchInfo.textContent = `${{currentIndex+1}} / ${{currentMatches.length}}`;
    }}

    // ----- 事件绑定 -----
    searchInput.addEventListener('input', performSearch);
    searchInput.addEventListener('keydown', e => {{
        if (e.key === 'Enter') {{
            e.preventDefault();
            if (e.shiftKey) navigate(-1);
            else navigate(1);
        }}
    }});
    prevBtn.addEventListener('click', () => navigate(-1));
    nextBtn.addEventListener('click', () => navigate(1));
    clearBtn.addEventListener('click', () => {{
        searchInput.value = '';
        performSearch();
        searchInput.focus();
    }});
    document.addEventListener('keydown', e => {{
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {{
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }}
    }});

    // 初始化搜索状态（显示全部）
    performSearch();
}})();
</script>
</body>
</html>'''

    with open('commit-history.html', 'w', encoding='utf-8') as f:
        f.write(html_template)

    print(f"✅ commit-history.html 已生成，包含 {len(commits)} 条提交记录")
    print(f"📌 仓库名: {repo}，双击行跳转至对应的 GitHub Commit")
    print("🔍 搜索增强: 支持 hash:/h:, author:/a:, date:/d:, subject:/s: 前缀，无前缀全局搜索")

if __name__ == '__main__':
    commits = get_commit_data()
    if not commits:
        print("⚠️ 未获取到提交记录，生成空页面", file=sys.stderr)
    generate_html(commits)