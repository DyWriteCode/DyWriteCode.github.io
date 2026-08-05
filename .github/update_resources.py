#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re
from pathlib import Path

def add_version_to_url(url, version_param):
    """为 URL 添加 ?v=version_param，若已有 v 参数则替换其值"""
    if not url:
        return url
    # 如果已经有 v 参数，替换它；否则追加
    if '?v=' in url:
        return re.sub(r'([?&])v=[^&]*', r'\1v=' + version_param, url)
    else:
        separator = '&' if '?' in url else '?'
        return url + separator + 'v=' + version_param

def process_style_value(style_text, short_hash, timestamp):
    """替换 style 文本中的 url(...)"""
    def replace_url(m):
        quote = m.group(1) or ''
        url = m.group(2).strip()
        if not url:
            return m.group(0)
        # 处理 CDN 链接中的 @latest
        if 'cdn.jsdmirror.com' in url:
            if '@latest' in url:
                url = url.replace('@latest', f'@{short_hash}')
            url = add_version_to_url(url, timestamp)
        else:
            # 非 CDN 的相对路径
            if not re.match(r'^(https?:)?//', url) and not url.startswith('data:'):
                url = add_version_to_url(url, timestamp)
        return f'url({quote}{url}{quote})'
    
    # 匹配 url(...) 和 @import url(...)
    return re.sub(r'(@import\s+)?url\((["\']?)([^"\'()]*)\2\)', replace_url, style_text)

def process_file_content(content, short_hash, timestamp):
    """
    使用正则替换所有资源链接，不修改其他内容
    """

    # 1. 全局替换 CDN 链接中的 @latest -> @hash
    # 使用 lookbehind 确保只匹配 cdn.jsdmirror.com 的路径部分
    content = re.sub(
        r'(cdn\.jsdmirror\.com[^"\'/\s]*?)/@latest',
        r'\1/@' + short_hash,
        content
    )

    # 2. 处理 src / href / poster / data 等属性
    attrs = ['src', 'href', 'poster', 'data', 'action', 'manifest']
    for attr in attrs:
        pattern = r'(' + attr + r')\s*=\s*(["\'])([^"\']*?)\2'
        def replace_attr(m):
            key = m.group(1)
            quote = m.group(2)
            url = m.group(3)
            if url and not url.startswith('data:') and not url.startswith('#'):
                new_url = add_version_to_url(url, timestamp)
                return f'{key}={quote}{new_url}{quote}'
            return m.group(0)
        content = re.sub(pattern, replace_attr, content)

    # 3. 处理 srcset（可能包含多个 URL）
    pattern = r'srcset\s*=\s*(["\'])([^"\']*?)\1'
    def replace_srcset(m):
        quote = m.group(1)
        srcset_value = m.group(2)
        parts = srcset_value.split(',')
        new_parts = []
        for part in parts:
            part = part.strip()
            tokens = part.split()
            if not tokens:
                continue
            url = tokens[0]
            rest = ' '.join(tokens[1:])
            if url and not url.startswith('data:') and not url.startswith('#'):
                url = add_version_to_url(url, timestamp)
            new_parts.append((url + (' ' + rest if rest else '')).strip())
        return f'srcset={quote}{", ".join(new_parts)}{quote}'
    content = re.sub(pattern, replace_srcset, content)

    # 4. 处理 style 属性
    pattern = r'style\s*=\s*(["\'])([^"\']*?)\1'
    def replace_style_attr(m):
        quote = m.group(1)
        style_value = m.group(2)
        new_style = process_style_value(style_value, short_hash, timestamp)
        return f'style={quote}{new_style}{quote}'
    content = re.sub(pattern, replace_style_attr, content)

    # 5. 处理 <style> 标签内的内容
    def replace_style_tag(m):
        opening = m.group(1)
        inner = m.group(2)
        closing = m.group(3)
        new_inner = process_style_value(inner, short_hash, timestamp)
        return opening + new_inner + closing
    content = re.sub(
        r'(<style\b[^>]*>)(.*?)(</style>)',
        replace_style_tag,
        content,
        flags=re.DOTALL
    )

    return content

def update_html(file_path, short_hash, timestamp):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = process_file_content(content, short_hash, timestamp)
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file_path}")
    else:
        print(f"No changes in {file_path}")

def main():
    with open('version.json', 'r') as f:
        data = json.load(f)
    full_version = data['version']
    timestamp = full_version.split('-')[0]
    short_hash = full_version.split('-')[1]

    for html_file in Path('.').rglob('*.html'):
        if 'original_project' in str(html_file):
            continue
        print(f"Processing {html_file}")
        update_html(html_file, short_hash, timestamp)

if __name__ == '__main__':
    main()