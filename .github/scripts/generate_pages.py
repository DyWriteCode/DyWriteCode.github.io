#!/usr/bin/env python3
"""
自动生成 pages.json - 扫描所有 HTML 文件，为 404 智能推荐提供数据
"""

import os
import json
import re
from pathlib import Path

# ========== 配置 ==========
IGNORE_DIRS = {'.git', 'node_modules', 'dist', 'build', '__pycache__', '.vscode', 'venv', 'env'}
IGNORE_FILES = {'404.html'}   # 不列入清单的文件
OUTPUT_FILE = 'pages.json'
ROOT_DIR = '../../'                # 扫描根目录（相对于脚本所在位置）
# ==========================

def should_ignore_dir(dir_name: str) -> bool:
    """判断目录是否应该被忽略"""
    if dir_name.startswith('.') or dir_name.startswith('_'):
        return True
    return dir_name in IGNORE_DIRS

def get_all_html_files(root_dir: str):
    """递归获取所有 .html 文件的路径（相对于 root_dir）"""
    html_files = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # 过滤要忽略的目录（原地修改 dirnames 以阻止 os.walk 进入）
        dirnames[:] = [d for d in dirnames if not should_ignore_dir(d)]

        for filename in filenames:
            if filename.endswith('.html') and filename not in IGNORE_FILES:
                full_path = os.path.join(dirpath, filename)
                # 计算相对路径（相对于 root_dir）
                rel_path = os.path.relpath(full_path, root_dir)
                # 统一使用 '/' 作为 URL 分隔符（Windows 也兼容）
                url_path = rel_path.replace(os.sep, '/')
                html_files.append({
                    'rel_path': rel_path,
                    'url': '/' + url_path,   # 以 / 开头
                    'name': None  # 稍后生成
                })
    return html_files

def generate_pretty_name(rel_path: str) -> str:
    """根据相对路径生成友好的显示名称"""
    # 分离目录和文件名
    parts = rel_path.replace('\\', '/').split('/')
    filename = parts[-1]
    # 去除 .html 后缀
    basename = filename[:-5] if filename.endswith('.html') else filename

    # 如果文件名为 index，则使用父目录名
    if basename.lower() == 'index':
        if len(parts) >= 2:
            dir_name = parts[-2]
            name = dir_name
        else:
            name = '首页'
    else:
        name = basename

    # 美化：将中划线、下划线、点替换为空格，并首字母大写
    name = re.sub(r'[-_.]', ' ', name)
    # 每个单词首字母大写（保留数字和字母）
    name = ' '.join(word.capitalize() for word in name.split())
    # 特殊处理：如果生成的是空字符串，则用 '页面'
    return name if name.strip() else '页面'

def main():
    print("🔍 正在扫描 HTML 文件...")
    files = get_all_html_files(ROOT_DIR)
    print(f"📄 找到 {len(files)} 个 HTML 文件（排除 404.html 等）")

    pages = []
    for f in files:
        name = generate_pretty_name(f['rel_path'])
        pages.append({
            'name': name,
            'url': f['url']
        })

    # 按 url 排序，保证输出稳定
    pages.sort(key=lambda x: x['url'])

    # 写入 JSON 文件（格式美观，非 ASCII 字符保持原样）
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(pages, f, ensure_ascii=False, indent=2)

    print(f"✅ 已生成 {OUTPUT_FILE}，共 {len(pages)} 个页面。")

if __name__ == '__main__':
    main()