---
title: Scrapy Playwright实战 股民社区情感分析
date: 2025-11-22
categories: 爬虫与数据分析 
toc: true
---

本项目旨在通过爬取股民社区讨论内容，运用自然语言处理和情感分析技术，识别当前股民看好的股票，为投资决策提供情感面参考依据。

<!--more-->


## 数据源选择

> 东方财富股吧 https://guba.eastmoney.com
> 雪球 https://xueqiu.com
> 同花顺 https://t.10jqka.com.cn


```sh
mkdir scrapy-playwright-project
cd scrapy-playwright-project
python -m venv venv
source venv/bin/active
```

```
┌──(yang㉿yang)-[~/scrapy]
└─$ tree xueqiu_pj/
xueqiu_pj/
├── data
├── scrapy.cfg
├── xueqiu_pj
│   ├── __init__.py
│   ├── items.py
│   ├── middlewares.py
│   ├── pipelines.py
│   ├── settings.py
│   └── spiders
│       ├── __init__.py
│       └── xueqiu.py
└── xueqiu_spider.log
```

```sh
scrapy crawl xueqiu -o data.json
```