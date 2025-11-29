---
title: Scrapy-Playwright
date: 2025-11-29
categories: 爬虫与数据分析
toc: true
---

本项目通过自动化采集股民社区讨论内容，结合自然语言处理与情感分析技术，构建市场情感识别模型，为投资决策提供情感维度的量化参考依据。

<!--more-->

## 系统整体架构

系统采用分层架构设计模式，实现组件间低耦合、高内聚，确保扩展性与可维护性。整体架构由五个核心层次组成，构建了从原始数据采集到分析结果可视化的完整处理链路：

```
[多源数据采集层] → [数据预处理层] → [情感分析引擎] → [数据存储层] → [分析可视化层]
       ↓                ↓                ↓              ↓                ↓
Scrapy+Playwright   Pandas/NumPy    LLM+规则混合模型 JSONL/关系型数据库 Matplotlib/Seaborn
```

**爬虫模块: Scrapy + Playwright**
- **Scrapy**: 高性能异步爬虫框架，提供完整的请求调度、数据提取与管道处理机制
- **Playwright**: 现代化浏览器自动化工具，支持JavaScript动态渲染页面爬取，具备强大的页面交互能力

**数据处理引擎: Pandas + NumPy**
- **Pandas**: 专业数据分析库，提供高效的数据清洗、转换与结构化处理能力
- **NumPy**: 科学计算基础库，提供高性能矩阵运算支持，为情感分析提供数值计算基础

**情感分析引擎: 混合模型架构**
- **规则基础层**: 基于jieba分词与金融领域情感词典，实现初步情感倾向识别
- **深度学习增强层**: 利用大语言模型(LLM)进行复杂语义理解与上下文分析，提升情感判断准确性

## 数据源选择

| 数据源 | 平台特点 | 用户画像 | 数据特性 | 采集优先级 |
|-------|---------|---------|---------|----------|
| **雪球网**<br>(https://xueqiu.com) | 专业投资社区，内容深度较高 | 机构投资者、专业投资者、资深散户 | 讨论质量高、结构化程度好、数据粒度适中 | 高 |
| **东方财富股吧**<br>(https://guba.eastmoney.com) | 综合性财经社区，用户基数大 | 散户为主，活跃度高 | 数据量大、情感表达直接、实时强劲 | 高 |
| **同花顺**<br>(https://t.10jqka.com.cn) | 金融信息服务平台，功能全面 | 多元化投资者群体 | 财经数据丰富、互动内容多样、用户基础广泛 | 中 |

## 雪球网数据采集实现

### 项目初始化与环境配置

```sh
mkdir scrapy-playwright-pj
cd scrapy-playwright-pj
python -m venv venv
source venv/bin/activate
pip install scrapy scrapy-playwright
playwright install chromium
# 项目初始化
scrapy startproject stock_sentiment_analysis
cd stock_sentiment_analysis
```

生成爬虫模块
```sh
scrapy genspider xueqiu xueqiu.com
```

启动爬虫
```sh
scrapy crawl xueqiu
```

项目目录结构
```
stock_sentiment_analysis/
├── scrapy.cfg                 # 项目配置文件
├── stock_sentiment_analysis/  # 主项目目录
│   ├── __init__.py
│   ├── items.py               # 数据模型定义
│   ├── middlewares.py         # 中间件配置
│   ├── pipelines.py           # 数据处理管道
│   ├── settings.py            # 全局配置
│   └── spiders/               # 爬虫模块目录
│       ├── __init__.py
│       └── xueqiu_spider.py   # 雪球网爬虫实现
└── output/                    # 数据输出目录
```

### 将 Playwright 集成到 Scrapy

#### Scrapy 工作流

![1](../assets/img/Scrapy-Playwright股民社区情感分析/1.png)

Scrapy 采用组件化架构设计，其核心工作流程包括：
- **调度器(Scheduler)**: 管理请求队列，根据优先级和去重策略分配下载任务
- **下载器(Downloader)**: 负责获取网页内容，支持多种下载处理器插件
- **爬虫(Spider)**: 定义爬取规则，提取目标数据
- **管道(Pipeline)**: 处理和存储提取的数据
- **中间件(Middleware)**: 提供请求/响应处理的钩子机制

#### 异步下载器架构设计

传统爬虫难以处理现代 Web 应用中的 JavaScript 动态渲染内容，本系统通过集成 Playwright 解决这一挑战。以下是关键配置实现：

```python
# settings.py - 异步下载器配置

# 替换默认下载器为 Playwright 下载器
DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}

# 启用异步IO引擎以支持 Playwright
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

# 浏览器实例配置
PLAYWRIGHT_LAUNCH_OPTIONS = {
    "headless": False,  # 调试模式，调试完后可设为True
    "timeout": 60 * 1000,  # 延长超时时间，适应复杂页面加载
    "args": [
        "--disable-infobars",  # 隐藏信息栏
        "--disable-blink-features=AutomationControlled",  # 绕过反爬检测
        "--no-sandbox",  # 非沙箱模式，Linux环境下需要
        "--ignore-certificate-errors",  # 忽略证书错误
    ]
}

# 模拟真实浏览器请求头
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# 并发控制配置
CONCURRENT_REQUESTS = 5  # 控制并发请求数
DOWNLOAD_DELAY = 2  # 设置下载延迟，避免请求过快

# 重试机制配置
RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [429, 500, 502, 503, 504]

# 启用日志记录
LOG_LEVEL = 'INFO'
LOG_STDOUT = True
```

#### 异步爬虫模块设计

通过结合Scrapy的异步框架与Playwright的浏览器自动化能力，实现了高效、稳定的数据采集。

**同步vs异步爬虫模式对比**

| 特性 | 传统同步爬虫 | 异步Playwright爬虫 |
|------|------------|------------------|
| 渲染能力 | 仅支持静态HTML | 完整支持JavaScript动态渲染 |
| 交互能力 | 无 | 支持点击、滚动、表单填写等复杂交互 |
| 反爬规避 | 能力有限 | 模拟真实浏览器行为，规避大多数反爬机制 |
| 性能模型 | 阻塞式IO | 非阻塞式IO，高并发处理能力 |
| 错误恢复 | 简单重试 | 可结合浏览器状态恢复，更健壮 |

```python
# 传统同步爬虫模式 - 存在的局限性
class TraditionalStockSpider(scrapy.Spider):
    name = "traditional_xueqiu"
    allowed_domains = ["xueqiu.com"]
    start_urls = ["https://xueqiu.com/hq"]
  
    def parse(self, response):
        # 无法处理需要JavaScript渲染的动态内容
        # 无法执行页面交互操作
        pass
```

```python
# 异步 Playwright 爬虫模式 - 本系统实现
import scrapy
from scrapy_playwright.page import PageMethod
from stock_sentiment_analysis.items import StockCommentItem

class XueqiuSpider(scrapy.Spider):
    name = "xueqiu_spider"
    allowed_domains = ["xueqiu.com"]
    custom_settings = {
        'DOWNLOAD_DELAY': 2,  # 设置下载延迟，避免请求过快
        'CONCURRENT_REQUESTS': 5,  # 控制并发请求数
    }

    async def start_requests(self):
        """初始化爬虫，配置 Playwright 浏览器参数"""
        self.logger.info("开始爬取雪球热门股票数据")
        yield scrapy.Request(
            url='https://xueqiu.com/hq',
            meta={
                'playwright': True,  # 启用Playwright处理
                'playwright_include_page': True,  # 允许直接操作页面实例
                'playwright_page_methods': [
                    # 等待热门股票列表加载完成 - 显式等待机制
                    PageMethod("wait_for_selector", "ul[class*='hot-stock-list']", timeout=30000),
                    PageMethod('wait_for_timeout', 2000),  # 额外等待确保渲染完成
                ]
            }
        )
```

### 获取热门股票数据

系统采用多级解析策略，先从热点股票列表页面提取基础信息，然后为每只目标股票创建独立的评论爬取任务。

这种设计实现了数据提取与深入爬取的解耦，提高系统的可靠性以及可扩展性。


查看热门股票页的前端结构：

![2](../assets/img/Scrapy-Playwright股民社区情感分析/2.png)


```python
import scrapy
from scrapy_playwright.page import PageMethod
from stock_sentiment_analysis.items import StockCommentItem

class XueqiuSpider(scrapy.Spider):
    name = "xueqiu_spider"
    allowed_domains = ["xueqiu.com"]
    custom_settings = {
        'DOWNLOAD_DELAY': 2,  # 设置下载延迟，避免请求过快
        'CONCURRENT_REQUESTS': 5,  # 控制并发请求数
    }

    async def start_requests(self):
        """初始化爬虫，请求热门股票页面
        
        设置Playwright参数，确保能够正确渲染动态加载的热门股票列表内容
        采用显式等待策略，提高页面加载的可靠性
        """
        self.logger.info("开始爬取雪球热门股票数据")
        yield scrapy.Request(
            url='https://xueqiu.com/hq',
            meta={
                'playwright': True,  # 启用Playwright浏览器渲染
                'playwright_include_page': True,  # 获取页面实例用于后续操作
                'playwright_page_methods': [
                    # 显式等待热门股票列表元素出现，确保内容完全加载
                    PageMethod("wait_for_selector", "ul[class*='hot-stock-list']", timeout=30000),
                    # 额外等待时间，确保动态内容渲染完成
                    PageMethod('wait_for_timeout', 2000),
                ]
            }
        )

    async def parse(self, response):
        """提取热门股票列表信息并发起详情页请求
        
        作为爬虫的数据提取核心方法，采用异步处理模式，实现了高效的数据提取与任务分发。
        关键技术点包括：健壮的CSS选择器策略、数据完整性校验、元数据传递机制。
        """
        # 使用CSS包含选择器精确定位热门股票列表项
        # *= 表示包含关系选择器，选择class属性包含hot-stock-list的ul元素及其内部的li元素
        # 这种方式增强了选择器的稳定性，降低了页面结构变更带来的影响
        stock_list = response.css('ul[class*="hot-stock-list"] li')
        
        self.logger.info(f"成功定位并解析到{len(stock_list)}支热门股票")
        
        # 遍历每个股票列表项提取关键信息
        for item in stock_list:
            # 采用多层次提取策略，从链接中解析股票代码
            link = item.css('a::attr(href)').get()
            stock_code = link.split('/')[-1] if link else None
            
            # 使用语义化的CSS选择器提取股票核心指标
            rank_span = item.css('span[class*="hot-stock-index"]::text').get()
            name_span = item.css('span[class*="hot-stock-name"]::text').get()
            percent_span = item.css('span[class*="hot-stock-percent"]::text').get()
            
            # 实施严格的数据完整性校验，确保数据质量
            if all([rank_span, name_span, percent_span, stock_code]):
                # 构建标准化的股票信息字典，规范化数据格式
                stock_info = {
                    'rank': rank_span.replace('.', '').strip(),  # 清理排名数据
                    'name': name_span.strip(),  # 清理股票名称
                    'percent': percent_span.strip(),  # 保留涨跌幅百分比
                    'code': stock_code,  # 规范化股票代码
                    'link': response.urljoin(link) if link else None  # 构建完整URL
                }
                self.logger.debug(f"成功提取股票信息: {stock_info['name']}({stock_info['code']})")
                
                # 为每只股票创建独立的评论爬取任务
                yield scrapy.Request(
                    url=response.urljoin(link),
                    callback=self.parse_comments,  # 指定评论解析回调函数
                    meta={
                        'playwright': True,  # 启用浏览器渲染评论内容
                        'playwright_include_page': True,
                        'playwright_page_methods': [
                            # 等待评论内容加载完成
                            PageMethod("wait_for_selector", "article[class*='timeline__item']", timeout=30000),
                        ],
                        **stock_info  # 解包传递股票基本信息，实现数据链路完整性
                    },
                )
            else:
                # 记录数据异常情况，便于后续调试与优化
                self.logger.warning(f"股票数据不完整，跳过处理: 排名={rank_span}, 名称={name_span}, 涨跌幅={percent_span}")
```

输出结果：

```
{'rank': '1', 'name': '赣锋锂业', 'percent': '-10.00%', 'code': 'SZ002460', 'link': 'https://xueqiu.com/S/SZ002460'}
2025-11-22 23:34:41 [scrapy.core.scraper] DEBUG: Scraped from <200 https://xueqiu.com/hq>
{'rank': '2', 'name': '英伟达', 'percent': '-0.97%', 'code': 'NVDA', 'link': 'https://xueqiu.com/S/NVDA'}
2025-11-22 23:34:41 [scrapy.core.scraper] DEBUG: Scraped from <200 https://xueqiu.com/hq>
{'rank': '3', 'name': '淳中科技', 'percent': '-9.02%', 'code': 'SH603516', 'link': 'https://xueqiu.com/S/SH603516'}
2025-11-22 23:34:41 [scrapy.core.scraper] DEBUG: Scraped from <200 https://xueqiu.com/hq>
{'rank': '4', 'name': '航天发展', 'percent': '-10.01%', 'code': 'SZ000547', 'link': 'https://xueqiu.com/S/SZ000547'}
2025-11-22 23:34:41 [scrapy.core.scraper] DEBUG: Scraped from <200 https://xueqiu.com/hq>
{'rank': '5', 'name': '上海电力', 'percent': '-4.34%', 'code': 'SH600021', 'link': 'https://xueqiu.com/S/SH600021'}
2025-11-22 23:34:41 [scrapy.core.scraper] DEBUG: Scraped from <200 https://xueqiu.com/hq>
{'rank': '6', 'name': '蓝色光标', 'percent': '+2.09%', 'code': 'SZ300058', 'link': 'https://xueqiu.com/S/SZ300058'}
2025-11-22 23:34:41 [scrapy.core.scraper] DEBUG: Scraped from <200 https://xueqiu.com/hq>
{'rank': '7', 'name': '易点天下', 'percent': '+19.99%', 'code': 'SZ301171', 'link': 'https://xueqiu.com/S/SZ301171'}
2025-11-22 23:34:41 [scrapy.core.scraper] DEBUG: Scraped from <200 https://xueqiu.com/hq>
{'rank': '8', 'name': '小米集团-W', 'percent': '+1.01%', 'code': '01810', 'link': 'https://xueqiu.com/S/01810'}
2025-11-22 23:34:41 [scrapy.core.scraper] DEBUG: Scraped from <200 https://xueqiu.com/hq>
{'rank': '9', 'name': '平潭发展', 'percent': '-10.03%', 'code': 'SZ000592', 'link': 'https://xueqiu.com/S/SZ000592'}
```











### 评论数据深度爬取策略

#### 单页评论爬取
分析雪球网评论区的DOM结构，设计可靠高效的CSS选择器策略，实现对动态渲染评论内容的精准提取：

![6](../assets/img/Scrapy-Playwright股民社区情感分析/6.png)



```python
    async def parse_comments(self, response):
        """异步解析股票详情页中的用户评论数据
        
        实现核心功能：
        1. 从meta传递链中恢复股票基础信息
        2. 使用Selector解析Playwright渲染后的完整DOM结构
        3. 应用文本提取算法处理嵌套文本节点
        4. 执行数据质量过滤与标准化
        """
        # 从meta中获取股票基础信息，实现数据链路完整性
        stock_rank = response.meta.get('rank')
        stock_name = response.meta.get('name')
        stock_percent = response.meta.get('percent')
        stock_code = response.meta.get('code')
        stock_url = response.meta.get('link')
        
        # 资源管理：释放Playwright页面实例
        page = response.meta["playwright_page"]
        await page.close()  # 显式关闭页面，避免内存泄漏
        
        # 使用Scrapy Selector解析渲染后的HTML内容
        # 采用中间层抽象，提高代码可维护性
        sel = Selector(text=response.text)
        
        # 使用健壮的CSS选择器定位评论元素
        # 使用包含选择器模式，增强对页面结构变化的适应性
        articles = sel.css("article[class*='timeline__item']")
        
        # 异常情况处理与日志记录
        if not articles:
            self.logger.warning(f"[{stock_rank}-{stock_name}] 未获取到有效评论数据")
            return
            
        self.logger.info(f"[{stock_rank}-{stock_name}] 成功定位{len(articles)}条评论记录")
```


评论内容DOM结构：

![4](../assets/img/Scrapy-Playwright股民社区情感分析/4.png)  
![5](../assets/img/Scrapy-Playwright股民社区情感分析/5.png)

```python
            # 批量处理评论数据，采用流式处理模式
            for article in articles:
                # 提取评论元数据
                post_time = article.css('.date-and-source::text').get()
                user_name = article.css('.user-name::text').get()
                
                # 高级文本提取算法：处理多层嵌套的文本节点
                # 实现了递归式文本合并，解决评论内容分布在多个子节点的问题
                comment_elements = article.css('div.content--description div ::text')
                user_comment = ''.join(
                    comment_element.get().strip() 
                    for comment_element in comment_elements 
                    if comment_element.get() and comment_element.get().strip()
                )
                
                # 数据质量过滤：实施最小长度检查，过滤无意义短评论
                if not user_comment or len(user_comment.strip()) < 5:
                    continue
                    
                # 构建标准化数据项，实现数据格式统一
                item = StockCommentItem(
                    platform="xueqiu",  # 多源数据标记，便于后续数据融合
                    stock_rank=stock_rank,    
                    stock_name=stock_name,
                    stock_percent=stock_percent,
                    stock_code=stock_code,
                    stock_url=stock_url,
                    comment_text=user_comment,
                    comment_time=post_time,
                    user_name=user_name,
                    crawl_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                )
                
                # 数据日志记录，便于监控数据质量
                self.logger.debug(f"成功提取评论：{stock_name} - {user_comment[:30]}...")
                
                # 返回标准化数据项到处理管道
                yield item
```

#### 分页爬取机制

为实现大规模评论数据的全面采集，系统设计了智能分页爬取机制，能够自适应网站的分页策略，并结合反爬措施确保稳定运行。

```python
    async def parse_comments_with_pagination(self, response):
        """实现分页爬取策略，支持多页评论数据采集
        
        核心功能：
        1. 递归式分页处理，自动发现并抓取所有可用评论页面
        2. 智能等待策略，确保动态加载内容完全渲染
        3. 自适应爬取速率，根据网站响应动态调整
        """
        # 获取当前股票信息
        stock_info = response.meta.get('stock_info', {})
        current_page = response.meta.get('page', 1)
        
        page = response.meta["playwright_page"]
        
        try:
            # 提取评论数据（与parse_comments方法类似）
            # ...评论提取代码...
            
            # 判断是否存在下一页
            next_page_selector = 'button[class*="pagination-next"]'
            is_disabled = await page.is_disabled(next_page_selector)
            
            # 分页策略：最多爬取10页，防止无限循环
            if not is_disabled and current_page < 10:
                # 智能等待：随机延迟，模拟人类行为
                await page.wait_for_timeout(random.randint(1000, 3000))
                
                # 点击下一页按钮
                await page.click(next_page_selector)
                
                # 等待新评论加载完成
                await page.wait_for_selector("article[class*='timeline__item']", state="visible")
                
                self.logger.info(f"[{stock_info.get('name')}] 开始爬取第{current_page + 1}页评论")
                
                # 创建下一页爬取任务
                yield scrapy.Request(
                    url=response.url,
                    callback=self.parse_comments_with_pagination,
                    meta={
                        'playwright': True,
                        'playwright_include_page': True,
                        'stock_info': stock_info,
                        'page': current_page + 1,
                        'playwright_page': page  # 复用页面实例，提高性能
                    },
                    dont_filter=True  # 允许重复URL爬取，适应分页机制
                )
            else:
                # 没有下一页或达到最大页数，关闭页面
                await page.close()
                self.logger.info(f"[{stock_info.get('name')}] 评论爬取完成，共爬取{current_page}页")
                
        except Exception as e:
            # 异常处理：记录错误并确保资源释放
            self.logger.error(f"分页爬取异常: {str(e)}")
            await page.close()
```

### 数据处理管道设计

系统实现了高效的数据处理管道，将爬取的原始评论数据转换为结构化的JSON格式，便于后续的情感分析处理。

```python
# items.py
import scrapy
class TestPjItem(scrapy.Item):
    stock_rank = scrapy.Field()
    stock_name = scrapy.Field()
    stock_percent = scrapy.Field()
    stock_code = scrapy.Field()
    stock_url = scrapy.Field()
    post_time = scrapy.Field()
    user_name = scrapy.Field()
    user_comment = scrapy.Field()

```

```python
# xueqiu.py
    item = TestPjItem(
        stock_rank=stock_rank,    
        stock_name=stock_name,
        stock_percent=stock_percent,
        stock_code=stock_code,
        stock_url=stock_url,
        post_time=post_time,
        user_name=user_name,
        user_comment=user_comment
    )
    yield item
```

这就需要修改pipelines，处理数据

```python
import json
import datetime
import os
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem

class JsonWriterPipeline:
    def __init__(self):
        self.file = None
        self.items_count = 0
        self.output_dir = 'output'
        
    def open_spider(self, spider):
        # 创建输出目录
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
        
        # 根据时间生成文件名
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.output_dir}/stock_data_{timestamp}.json"
        
        # 打开文件
        self.file = open(filename, 'w', encoding='utf-8')
        self.file.write('[\n')  # 开始JSON数组
        spider.logger.info(f"数据将保存到: {filename}")
        
    def close_spider(self, spider):
        if self.file:
            if self.items_count > 0:
                self.file.write('\n]')  # 结束JSON数组
            else:
                self.file.write(']')  # 空数组
            self.file.close()
            spider.logger.info(f"爬虫结束，共保存 {self.items_count} 条数据")
        
    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        item_dict = dict(adapter)
        
        # 格式化JSON
        if self.items_count > 0:
            self.file.write(',\n')  # 添加逗号分隔符
        
        json_line = json.dumps(item_dict, ensure_ascii=False, indent=2)
        self.file.write(' ' * 2 + json_line)  # 缩进2个空格
        
        self.items_count += 1
        if self.items_count % 10 == 0:  # 每10条数据刷新一次
            self.file.flush()
            spider.logger.info(f"已处理 {self.items_count} 条数据")
        
        return item
```

对应的需要在 setting 中启用管道

```python
# 中间件设置
DOWNLOADER_MIDDLEWARES = {
    # 禁用默认的UserAgentMiddleware，使用自定义的
    "scrapy.downloadermiddlewares.useragent.UserAgentMiddleware": None,
}

# 启用管道
ITEM_PIPELINES = {
    "test_pj.pipelines.JsonWriterPipeline": 100,     # JSON输出
}
```

测试结果: 爬取成功
```JSON
[
  {
  "stock_rank": "1",
  "stock_name": "赣锋锂业",
  "stock_percent": "-10.00%",
  "stock_code": "SZ002460",
  "stock_url": "https://xueqiu.com/S/SZ002460",
  "post_time": "8秒前",
  "user_name": "陪赣锋到老",
  "user_comment": "$赣锋锂业(SZ002460)$ 李总和副点在2022年底的分别以76-81的每股价增15万股、10.39万股，他们至今未减持，人家的钱也是钱，他会怕那些所谓的主力庄家砸盘吗？那些所谓的主力庄家砸盘、能砸掉赣锋的固定资产设备、资源储量、产能、技术专利、市占率、和赣锋客户的对赣锋产品的需求吗？[捂..."
},
......
  {
  "stock_rank": "1",
  "stock_name": "赣锋锂业",
  "stock_percent": "-10.00%",
  "stock_code": "SZ002460",
  "stock_url": "https://xueqiu.com/S/SZ002460",
  "post_time": "2小时前",
  "user_name": "亏不完的西瓜",
  "user_comment": "回复@信用的加薪小喷泉: 这里多跌一段时间，好好洗一洗筹码，后面空间会更大，你没看现在周末一堆人等着起飞呢，肯定要洗的大家都安静下来持股，基本就到位了$天齐锂业(SZ002466)$ $赣锋锂业(SZ002460)$//@信用的加薪小喷泉:回复@亏不完的西瓜:2035年，不影响这两年涨【英国政府推出新的关键矿产战略：到2035年生产至少5万吨锂】英国政府11月22日发布声明称，目标2035年前实现10%的矿产需求由国内生产、20%通过回收再利用满足。声明称，到2035年英国将至少生产5万吨锂，政府将投入约5000万英镑的新一轮资金支持本土企业。"
}
]
```

### 速率限制

实践中单一会话爬取一千六百条多条评论时会触发速率限制，评论区无法再加载。所以使用多级解析。

访问速率过快会弹出阿里云验证界面，需要控制好访问速率


![8](../assets/img/Scrapy-Playwright股民社区情感分析/8.png)

可以看到成功爬取热门的 9 支股票的所有评论

![9](../assets/img/Scrapy-Playwright股民社区情感分析/9.png)

### 爬虫模块实现总结

本模块基于Scrapy框架与Playwright浏览器自动化工具构建，通过模拟真实浏览器行为实现动态内容加载，有效规避JavaScript渲染相关的爬取障碍。

系统实现了高效的多源数据采集能力，能够快速获取股民社区讨论内容。对于其他类似结构的股民社区平台，可复用相同的技术架构与实现方案。


# 情感分析引擎实现

实现基于混合模型架构的情感分析引擎，通过规则基础层与深度学习增强层的有机结合，实现了对股民评论文本的高精度情感识别。

该引擎具备情感标签分类、统计分析与可视化展示等核心功能，能够将非结构化文本转换为量化的情感指标。

## 评论预处理
### 文本清洗与规范化

情感分析前的预处理阶段，对数据执行标准化处理流程，确保数据格式的一致性与完整性。该环节将来自不同平台的原始评论数据映射至统一的内部数据结构，为后续情感分析提供标准化输入。

```python
# 标准化处理示例
return {
    "platform": "",  # 来源平台标识
    "stock_code": normalize_stock_code(row.get("stock_code")),  # 统一股票代码格式
    "stock_name": row.get("stock_name"),  # 股票名称

    "post_time": row.get("post_time"),  # 发布时间
    "user_name": row.get("user_name"),  # 用户名称
    "content": row.get("user_comment"),  # 评论文本内容

    "sentiment": None,  # 预留情感分析结果字段
    "summary": None,    # 预留摘要字段
}
```

系统采用 `Comment` 数据类作为标准化评论的统一数据模型：

```python
@dataclass
class Comment:
    # 基本来源信息
    platform: str                     # "guba" / "xueqiu" / "aigupiao"
    stock_code: str                   # 统一后的代码，如 "600000"
    stock_name: Optional[str] = None  # 股票名称，可为空

    # 文本内容
    title: Optional[str] = None       # 有些平台有标题（帖子），有些为空
    content: str = ""                 # 评论/帖子正文
    author: Optional[str] = None      # 用户名/昵称
    
    # 其他字段...
    
    # 分析结果
    sentiment: Optional[SentimentLabel] = None  # 五档情感
    summary: Optional[str] = None               # 后续可以放"事件/观点摘要"
```

## 情感标签体系设计

系统采用五档情感分类体系，实现对股民情感强度的精细化量化与分类：

```python
class SentimentLabel(str, Enum):
    """
    五档情感标签，value 直接用中文，方便前端展示和落库。
    """
    VERY_BULLISH = "非常看涨"
    BULLISH = "看涨"
    NEUTRAL = "中性"
    BEARISH = "看跌"
    VERY_BEARISH = "非常看跌"

    @property
    def score(self) -> int:
        """
        情感数值映射函数，将类别标签转换为可量化的数值分数。
        情感强度从正向到负向映射为：非常看涨(2)、看涨(1)、中性(0)、看跌(-1)、非常看跌(-2)
        该设计支持后续的统计分析、趋势计算和情感指数构建。
        """
        return {
            SentimentLabel.VERY_BULLISH: 2,
            SentimentLabel.BULLISH: 1,
            SentimentLabel.NEUTRAL: 0,
            SentimentLabel.BEARISH: -1,
            SentimentLabel.VERY_BEARISH: -2,
        }[self]
```

每个情感标签都有对应的数值分数，便于后续的统计计算和趋势分析。这种设计既保留了情感的语义表达，又支持数值化分析。

## 混合模型情感分析实现

### 1. 规则基础层

规则基础层基于领域特定情感词典构建，通过精心设计的金融专业词库实现情感倾向的初步识别：

```python
# 强烈看涨词库
VERY_BULLISH_WORDS = [
    "起飞", "暴涨", "涨停", "翻倍", "飞起", "秒板", "大牛",
    "梭哈", "all in", "满仓", "地板起飞",
    "火箭", "飞天", "一路向上", "无敌", "起飞起飞",
]

# 看涨词库
BULLISH_WORDS = [
    "看好", "看涨", "买入", "加仓", "上车", "低吸", "抄底",
    "拿住", "长线", "牛股", "机会", "利好", "值得买",
    "有戏", "要涨", "要起飞", "开始拉升", "趋势向上",
]

# 强烈看跌词库
VERY_BEARISH_WORDS = [
    "暴跌", "崩盘", "跌停", "完了", "凉了", "退市", "腰斩",
    "血崩", "全砸", "要完", "闪崩",
    "活埋", "没救了", "要死", "死透了", "废了", "垃圾股", "垃圾票",
    "跌麻了", "跌成狗", "血亏爆仓", "彻底没戏",
]

# 看跌词库
BEARISH_WORDS = [
    "看空", "不看好", "减仓", "出货", "清仓", "割肉",
    "跑路", "套牢", "套住", "风险大", "利空",
    "阴跌", "磨人", "走弱", "走势很差", "被套", "难看",
    "跌", "回调", "回落", "下跌", "压力很大",
]
```

规则分类算法采用优先级匹配策略，通过多级筛选机制确保情感倾向识别的准确性：

```python
def classify_text_sentiment(text: str) -> SentimentLabel:
    """
    基于词典的规则分类算法：
    1. 首先匹配强烈情感倾向词（非常看涨/非常看跌），确保高情感强度表达被优先识别；
    2. 其次匹配一般情感倾向词（看涨/看跌）；
    3. 未匹配到任何情感词时，判定为中性。
    
    该算法采用自顶向下的优先级策略，确保对情感强度的准确把握。
    """
    if not text:
        return SentimentLabel.NEUTRAL

    t = text.strip()
    tl = t.lower()  # 统一成小写，提高英文词汇匹配准确率

    # 强烈情感优先级判断
    if any(w in tl for w in VERY_BULLISH_WORDS):
        return SentimentLabel.VERY_BULLISH
    if any(w in tl for w in VERY_BEARISH_WORDS):
        return SentimentLabel.VERY_BEARISH

    # 一般情感倾向判断
    if any(w in tl for w in BULLISH_WORDS):
        return SentimentLabel.BULLISH
    if any(w in tl for w in BEARISH_WORDS):
        return SentimentLabel.BEARISH

    # 默认中性
    return SentimentLabel.NEUTRAL
```

### 2. 深度学习增强层

针对规则模型识别为中性的评论样本，系统引入DeepSeek大语言模型进行二次精准判断，构建了规则-深度学习混合增强架构。该策略在保证基础处理效率的同时，显著提升了对复杂语义、隐含情感及上下文关联的理解能力。

```python
def attach_sentiment(comments: List[Comment], use_llm: bool = False) -> List[Comment]:
    """
    情感标注主函数，为评论文档集合添加情感标签（原地修改并返回）。

    实现流程：
    1. 采用规则模型classify_text_sentiment进行初步情感标注；
    2. 针对规则模型识别为"中性"的样本，在use_llm=True时调用DeepSeek大语言模型进行二次判断：
       - 若LLM返回有效SentimentLabel枚举值，则以LLM判断结果覆盖原标注；
       - 若LLM返回None，表示内容与投资情感无关，则将sentiment字段设为None（JSON序列化时为null）；
       - 若LLM返回其他无法解析的类型（如原始字符串），则保留规则模型的原始标注结果。
    
    该函数实现了规则模型与深度学习模型的级联架构，平衡了处理效率与情感识别准确性。
    """
    # 实现代码...
```

LLM调用通过精心设计的提示工程方法，引导模型专注于金融领域情感分析任务，提高输出质量与一致性：

```python
def classify_sentiment_with_llm(text: str) -> Optional[SentimentLabel]:
    """
    基于大语言模型的情感分类函数
    
    通过领域特定提示词工程，引导LLM专注于金融评论情感分析任务，
    确保输出格式标准化和分类结果准确性。
    """
    # 提示词工程设计，约束模型输出格式并聚焦于金融情感分析
    prompt = f"""
请分析下面这段话对相关股票/市场的情绪倾向。

文本: {text}

请注意：你最终只能输出一个词（下列之一）：
非常看涨 / 看涨 / 中性 / 看跌 / 非常看跌 / null
不要输出任何其他文字或解释。
"""
    
    # 调用DeepSeek模型并处理结果
    # 实现模型调用、输出解析与错误处理逻辑
    # ...
```

## 情感分析流水线

系统构建了端到端的情感分析流水线，实现了数据读取、情感标注和结果输出的完整自动化处理流程，确保批量化处理的高效性和一致性：

```python
def run_sentiment_pipeline(
    input_path: Path | None = None,
    output_path: Path | None = None,
) -> None:
    """
    端到端情感分析流水线主函数
    
    功能说明：
    1. 从指定路径读取标准化处理后的评论文档
    2. 调用情感标注引擎对评论集进行批量情感分析
    3. 将情感分析结果序列化为JSONL格式输出
    
    参数：
    - input_path: 输入文件路径，默认为预定义的标准化文件
    - output_path: 输出文件路径，默认为预定义的情感标注结果文件
    """
    # 路径参数解析与默认值处理
    input_path = input_path or STANDARDIZED_FILE
    output_path = output_path or STANDARDIZED_WITH_SENTIMENT_FILE

    # 数据加载与批处理
    comments: list[Comment] = load_comments_from_jsonl(input_path)
    print(f"[sentiment_pipeline] 读取到 {len(comments)} 条标准化评论，开始情感分析...")

    # 空输入检查
    if not comments:
        print("[sentiment_pipeline] 没有可处理的评论，结束。")
        return

    # 执行混合模型情感分析
    attach_sentiment(comments, use_llm=True)

    # 结果持久化
    save_comments_to_jsonl(comments, output_path)
    print(f"[sentiment_pipeline] 已完成情感标注，输出到：{output_path}")
```

## 数据聚合与统计分析

为支持市场情感宏观分析和股票投资价值评估，系统设计并实现了高效的数据聚合框架，按股票代码维度对评论文本进行分组统计，构建多维度的情感指标体系：

```python
def aggregate_comments_by_stock(comments: List[Comment]) -> List[dict]:
    """
    股票级情感数据聚合算法
    
    功能说明：
    - 按股票代码维度聚合所有相关评论
    - 构建五档情感分布统计
    - 计算情感强度加权平均分
    - 生成结构化聚合结果列表
    
    参数：
    - comments: 情感标注后的评论对象列表
    
    返回值：
    - 包含股票情感统计指标的字典列表，每个字典代表一支股票的情感概览
    """
    # 初始化股票映射字典，用于O(1)时间复杂度的查找
    stock_map: Dict[str, dict] = {}

    # 遍历评论集进行聚合处理
    for c in comments:
        code = (c.stock_code or "").strip()
        if not code:
            # 过滤无股票代码的评论
            continue

        # 查找或初始化股票统计对象
        sku = stock_map.get(code)
        if sku is None:
            sku = {
                "stock_code": code,
                "stock_name": c.stock_name,
                "comment_count": 0,

                # 五档情感分布计数器
                "very_bullish": 0,
                "bullish": 0,
                "neutral": 0,
                "bearish": 0,
                "very_bearish": 0,

                # 情感得分统计
                "sentiment_score_sum": 0.0,
                "sentiment_score_avg": 0.0,
            }
            stock_map[code] = sku

        # 累计统计数据
        # ...
```

聚合结果可以导出为JSONL格式，便于后续的可视化展示和进一步分析。

## 情感可视化展示

系统设计并实现了多维度可视化组件，通过直观的数据图表实现情感分析结果的可视化呈现，支持市场情感的快速洞察和股票情感状态的比较分析：

### 平均情感得分条形图

采用水平条形图展示股票情感强度分布，支持按情感得分排序，便于快速识别市场情绪极端的股票：

```python
def plot_avg_sentiment_bar(df: pd.DataFrame, out_png: Path, top_n: int = 30) -> None:
    """
    股票情感强度分布可视化函数
    
    功能说明：
    - 将股票按平均情感得分进行排序
    - 生成水平条形图展示排名靠前的股票情感强度
    - 支持自定义展示数量，默认展示情感最消极的30支股票
    
    参数：
    - df: 包含股票情感统计数据的Pandas DataFrame
    - out_png: 图表输出路径
    - top_n: 需要展示的股票数量
    
    输出：
    - 生成并保存指定路径的情感强度分布条形图
    """
    # 数据预处理：按情感得分排序并筛选指定数量的样本
    df_sorted = df.sort_values("sentiment_score_avg")
    if len(df_sorted) > top_n:
        df_sorted = df_sorted.head(top_n)

    # 可视化参数配置与图表生成
    plt.figure(figsize=(10, 6))
    plt.bar(df_sorted["display_name"], df_sorted["sentiment_score_avg"])
    plt.xticks(rotation=60, ha="right")
    plt.ylabel("平均情感得分")
    plt.title(f"各股票平均情感得分（取最悲观的 {top_n} 只）")
    plt.tight_layout()
    
    # 图像输出逻辑
    # ...
```