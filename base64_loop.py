#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Base64 多次编码/解码工具
用法：
    python base64_loop.py -e "hello" -n 3          # 编码 3 次
    python base64_loop.py -d "aGVsbG8=" -n 2       # 解码 2 次
    python base64_loop.py -e                       # 交互式输入文本，默认编码 1 次
"""

import sys
import base64
import argparse


def b64encode(text: str) -> str:
    """将字符串编码为 Base64（UTF-8 编码）"""
    return base64.b64encode(text.encode('utf-8')).decode('utf-8')


def b64decode(text: str) -> str:
    """将 Base64 字符串解码为原文（UTF-8）"""
    return base64.b64decode(text.encode('utf-8')).decode('utf-8')


def main():
    parser = argparse.ArgumentParser(
        description="Base64 编码/解码工具，支持多次循环处理",
        epilog="示例: python base64_loop.py -e 'hello' -n 3"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('-e', '--encode', action='store_true', help="编码模式")
    group.add_argument('-d', '--decode', action='store_true', help="解码模式")
    parser.add_argument('-n', '--times', type=int, default=1,
                        help="循环次数（默认 1），必须 >= 1")
    parser.add_argument('text', nargs='?', default=None,
                        help="待处理的文本，若不提供则进入交互式输入")

    args = parser.parse_args()

    # 获取输入文本
    if args.text is None:
        args.text = input("请输入要处理的文本: ").strip()
        if not args.text:
            print("输入不能为空。")
            sys.exit(1)

    times = args.times if args.times >= 1 else 1
    action = "编码" if args.encode else "解码"
    current = args.text

    try:
        for i in range(times):
            if args.encode:
                current = b64encode(current)
            else:
                current = b64decode(current)
            print(f"第 {i+1} 次{action}结果: {current}")
    except Exception as e:
        print(f"错误: 第 {i+1} 次{action}失败，原因为: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()