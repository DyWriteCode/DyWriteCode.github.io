#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re
from pathlib import Path

def add_version_to_url(url, version_param):
    if not url:
        return url
    if '?v=' in url:
        return re.sub(r'([?&])v=[^&]*', r'\1v=' + version_param, url)
    else:
        separator = '&' if '?' in url else '?'
        return url + separator + 'v=' + version_param

def process_style_value(style_text, short_hash, timestamp):
    def replace_url(m):
        quote = m.group(1) or ''
        url = m.group(2).strip()
        if not url:
            return m.group(0)
        if 'cdn.jsdmirror.com' in url:
            # 替换 @latest 或旧哈希（十六进制）为 @新哈希
            url = re.sub(r'@(latest|[a-f0-9]+)', f'@{short_hash}', url)
            url = add_version_to_url(url, timestamp)
        else:
            if not re.match(r'^(https?:)?//', url) and not url.startswith('data:'):
                url = add_version_to_url(url, timestamp)
        return f'url({quote}{url}{quote})'
    return re.sub(r'(@import\s+)?url\((["\']?)([^"\'()]*)\2\)', replace_url, style_text)

def process_file_content(content, short_hash, timestamp):
    # 1. 替换 CDN 链接中的 @latest 或旧哈希 -> @新哈希
    # 匹配 cdn.jsdmirror.com 后面直到 @ 之前的所有内容（允许 /）
    content = re.sub(
        r'(cdn\.jsdmirror\.com[^"\'\s]*?)@(latest|[a-f0-9]+)',
        r'\1@' + short_hash,
        content
    )

    # 2. 处理 src / href / poster / data 等属性（添加 ?v=timestamp）
    attrs = ['src', 'href', 'poster', 'data', 'action', 'manifest']
    for attr in attrs:
        pattern = r'(' + attr + r')\s*=\s*(["\'])([^"\']*?)\2'
        def replace_attr(m):
            key = m.group(1)
            quote = m.group(2)
            url = m.group(3)
            if url and not url.startswith('data:') and not url.startswith('#'):
                url = add_version_to_url(url, timestamp)
                return f'{key}={quote}{url}{quote}'
            return m.group(0)
        content = re.sub(pattern, replace_attr, content)

    # 3. 处理 srcset
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

    # 5. 处理 <style> 标签
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
    full_version = data['version']          # 例如 "20260805123456-a1b2c3d"
    timestamp = full_version.split('-')[0]  # 时间戳
    short_hash = full_version.split('-')[1] # 短哈希

    for html_file in Path('.').rglob('*.html'):
        if 'original_project' in str(html_file):
            continue
        print(f"Processing {html_file}")
        update_html(html_file, short_hash, timestamp)

if __name__ == '__main__':
    main()