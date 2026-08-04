#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from bs4 import BeautifulSoup

def add_version_to_url(url, version_param):
    """为 URL 添加 ?v=version_param，若已有 v 参数则替换其值"""
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

def process_style_value(style_value, short_hash, timestamp):
    """
    处理 style 属性值或 <style> 标签文本中的 url(...) 和 @import url(...)
    """
    if not style_value or not isinstance(style_value, str):
        return style_value

    # 匹配 url(...) 和 @import url(...)
    # 支持单双引号或无引号，支持带查询参数
    pattern = r'(@import\s+)?url\((["\']?)([^"\'()]*)\2\)'

    def replace_url(match):
        prefix = match.group(1) or ''
        quote = match.group(2)
        url = match.group(3).strip()
        if not url:
            return match.group(0)
        # 处理 CDN 链接
        if 'cdn.jsdmirror.com' in url:
            if '@latest' in url:
                url = url.replace('@latest', f'@{short_hash}')
            url = add_version_to_url(url, timestamp)
        else:
            # 非 CDN：仅对相对路径添加 ?v
            if not re.match(r'^(https?:)?//', url) and not url.startswith('data:'):
                url = add_version_to_url(url, timestamp)
        return f'{prefix}url({quote}{url}{quote})'

    return re.sub(pattern, replace_url, style_value)

def update_html(file_path, short_hash, timestamp):
    with open(file_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    # 处理标签属性
    for tag in soup.find_all(['script', 'link', 'img', 'video', 'audio', 'source', 'style']):
        # 1. src / href
        for attr in ['src', 'href']:
            if not tag.has_attr(attr):
                continue
            value = tag[attr]
            if not value:
                continue
            if 'cdn.jsdmirror.com' in value:
                if '@latest' in value:
                    value = value.replace('@latest', f'@{short_hash}')
                tag[attr] = add_version_to_url(value, timestamp)
            else:
                if not re.match(r'^(https?:)?//', value) and not value.startswith('data:'):
                    tag[attr] = add_version_to_url(value, timestamp)

        # 2. style 属性
        if tag.has_attr('style'):
            tag['style'] = process_style_value(tag['style'], short_hash, timestamp)

        # 3. srcset
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

    # 处理 <style> 标签内的文本
    for style_tag in soup.find_all('style'):
        if style_tag.string:
            style_tag.string.replace_with(process_style_value(style_tag.string, short_hash, timestamp))

    # 不进行格式化，直接写入
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(str(soup))

def main():
    with open('version.json', 'r') as f:
        data = json.load(f)
    full_version = data['version']
    timestamp = full_version.split('-')[0]
    short_hash = full_version.split('-')[1]

    for html_file in Path('.').rglob('*.html'):
        # 排除 original_project 目录
        if 'original_project' in str(html_file):
            continue
        print(f"Processing {html_file}")
        update_html(html_file, short_hash, timestamp)

if __name__ == '__main__':
    main()