#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from bs4 import BeautifulSoup

def add_version_to_url(url, version_param):
    """为 URL 添加 ?v=version_param，若已有则替换"""
    if not url:
        return url
    parsed = urlparse(url)
    query_dict = parse_qs(parsed.query)
    query_dict['v'] = [version_param]
    new_query = urlencode(query_dict, doseq=True)
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

    # 处理 src / href
    for tag in soup.find_all(['script', 'link', 'img', 'video', 'audio', 'source']):
        for attr in ['src', 'href']:
            if not tag.has_attr(attr):
                continue
            value = tag[attr]
            if not value:
                continue
            # CDN 链接替换 @latest -> @short_hash，并加 ?v
            if 'cdn.jsdmirror.com' in value:
                if '@latest' in value:
                    value = value.replace('@latest', f'@{short_hash}')
                tag[attr] = add_version_to_url(value, timestamp)
            else:
                # 非 CDN 相对路径加 ?v
                if not re.match(r'^(https?:)?//', value) and not value.startswith('data:'):
                    tag[attr] = add_version_to_url(value, timestamp)

        # 处理 srcset
        if tag.has_attr('srcset'):
            srcset_value = tag['srcset']
            parts = srcset_value.split(',')
            new_parts = []
            for part in parts:
                part = part.strip()
                url_parts = part.split(' ')
                url = url_parts[0]
                if not url:
                    continue
                if 'cdn.jsdmirror.com' in url:
                    if '@latest' in url:
                        url = url.replace('@latest', f'@{short_hash}')
                    url = add_version_to_url(url, timestamp)
                else:
                    if not re.match(r'^(https?:)?//', url) and not url.startswith('data:'):
                        url = add_version_to_url(url, timestamp)
                if len(url_parts) > 1:
                    new_parts.append(url + ' ' + ' '.join(url_parts[1:]))
                else:
                    new_parts.append(url)
            tag['srcset'] = ', '.join(new_parts)

    # 不格式化，直接写入修改后的内容
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