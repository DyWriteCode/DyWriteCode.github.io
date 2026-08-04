#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from bs4 import BeautifulSoup

def add_version_to_url(url, version_param):
    """
    为 URL 添加 ?v={version_param} 或 &v={version_param}（如果已有查询参数）
    """
    if not url:
        return url
    parsed = urlparse(url)
    query_dict = parse_qs(parsed.query)
    # 如果已有 v 参数，替换其值
    if 'v' in query_dict:
        query_dict['v'] = [version_param]
    else:
        query_dict['v'] = [version_param]
    new_query = urlencode(query_dict, doseq=True)
    # 重新构造 URL
    return urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))

def update_html(file_path, short_hash, timestamp):
    with open(file_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    # 处理带有 src/href/srcset 的标签
    for tag in soup.find_all(['script', 'link', 'img', 'video', 'audio', 'source']):
        # ---- src 和 href ----
        for attr in ['src', 'href']:
            if not tag.has_attr(attr):
                continue
            value = tag[attr]
            if not value:
                continue
            # 1. 如果是 CDN 链接，先替换 @latest -> @{short_hash}
            if 'cdn.jsdmirror.com' in value:
                if '@latest' in value:
                    value = value.replace('@latest', f'@{short_hash}')
                # 然后无论是否 CDN，都添加 v 参数（相对路径或绝对路径）
                tag[attr] = add_version_to_url(value, timestamp)
            else:
                # 非 CDN 链接：仅当是相对路径（不以 http 或 // 开头）时加 v
                if not re.match(r'^(https?:)?//', value) and not value.startswith('data:'):
                    tag[attr] = add_version_to_url(value, timestamp)
                # 其他情况（外部绝对 URL）不处理

        # ---- srcset ----
        if tag.has_attr('srcset'):
            srcset_value = tag['srcset']
            parts = srcset_value.split(',')
            new_parts = []
            for part in parts:
                part = part.strip()
                # 提取 URL（可能后面带空格和尺寸描述）
                url_parts = part.split(' ')
                url = url_parts[0]
                if not url:
                    continue
                # 处理 CDN 链接
                if 'cdn.jsdmirror.com' in url:
                    if '@latest' in url:
                        url = url.replace('@latest', f'@{short_hash}')
                    url = add_version_to_url(url, timestamp)
                else:
                    # 非 CDN：仅当相对路径时加 v
                    if not re.match(r'^(https?:)?//', url) and not url.startswith('data:'):
                        url = add_version_to_url(url, timestamp)
                # 重新组合
                if len(url_parts) > 1:
                    new_parts.append(url + ' ' + ' '.join(url_parts[1:]))
                else:
                    new_parts.append(url)
            tag['srcset'] = ', '.join(new_parts)

    # 写回文件
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(str(soup))

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