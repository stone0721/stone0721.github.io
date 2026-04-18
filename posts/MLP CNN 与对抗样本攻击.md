---
title: MLP CNN 与对抗样本攻击
date: 2026-04-19
categories: AI 安全 
toc: true
---

深度神经网络通过多层非线性变换实现复杂特征提取与模式识别。包括多层感知机（MLP）和卷积神经网络（CNN）。
本文实现了 MLP 和 LeNet-5，并在此基础上，使用 FGSM 和 PGD 方法对 LeNet-5 模型开展了无目标与有目标对抗样本攻击。

<!--more-->

## 多层感知机 MLP

多层感知机（Multilayer Perceptron）是多层神经网络的一种，指全连接的简单前馈网络，由输入层、一个或多个隐藏层和输出层组成。每层之间通过全连接的方式进行连接

### 激活函数

不使用激活函数，多层神经网络表达能力等同于单层线性回归，无法解决非线性问题

激活函数的核心就是引入非线性，而 多层线性变换 + 非线性激活能组合出任意复杂的决策边界，逼近几乎任何连续函数。

Universal Approximation Theorem ：只要激活函数满足一定条件（非多项式、连续等，比如 sigmoid、ReLU、tanh），单隐藏层的神经网络就能在紧致集上任意逼近任何连续函数。更深的网络则能用更少的神经元、更高效的方式实现同样的逼近能力。

- Sigmoid：$ σ(h) = 1 / (1 + e^{-h}) $  涉及指数计算，当输入 h 很大/很小时，导数接近 0，反向传播时梯度会层层衰减到几乎为0，深层网络几乎无法训练。
- ReLU： $ ReLU(x) = max(0, x) $ 计算简单，缓解梯度消失并能加速收敛；负值直接置零，一些神经元输出 0，相当于不传递任何信息，有点模拟神经元激活和抑制的意思，下一次传播时也有可能重新激活，这种临时关闭，让 ReLU 能带来稀疏性。但如果权重和偏置被更新地太狠，可能让这个神经元计算结果一直为负值，导致神经元"永久死亡"

### 实现 MLP（3 层）

本次实验使用 NumPy + PyTorch 张量的方式，实现一个简单的 3 层神经网络，并在 MNIST 手写数字识别任务上进行训练和测试

输入为展平后的 28×28 图像（784 维），隐藏层神经元数量设为 100，输出为 10 类数字。

实验采用 Sigmoid 激活函数和交叉熵损失，使用手动实现的随机梯度下降（SGD）进行参数更新。



1. 模型参数初始化，导入数据集

```python
import torch
import torchvision
import torchvision.transforms as transforms
import numpy as np
from tqdm import tqdm

input_size = 784
hidden_size = 100
label_num = 10
batch_size = 128  # 批次大小

# 使用正态分布随机初始化权重，并进行缩放
Wh = np.random.randn(input_size, hidden_size) / 10  # 输入到隐藏层权重
bh = np.zeros(hidden_size)                          # 隐藏层偏置
Wo = np.random.randn(hidden_size, label_num) / 5    # 隐藏层到输出层权重
bo = np.zeros(label_num)                            # 输出层偏置

# 转换为 Torch Tensor 并开启梯度追踪
Wh = torch.FloatTensor(Wh)
bh = torch.FloatTensor(bh)
Wo = torch.FloatTensor(Wo)
bo = torch.FloatTensor(bo)

Wh.requires_grad = True
bh.requires_grad = True
Wo.requires_grad = True
bo.requires_grad = True
```

```python
# 加载训练集和测试集
transform = transforms.ToTensor()

trainset = torchvision.datasets.MNIST(root="./MNIST", train=True, download=True, transform=transform)
testset = torchvision.datasets.MNIST(root="./MNIST", train=False, download=True, transform=transform)

train_loader = torch.utils.data.DataLoader(trainset, batch_size=batch_size, shuffle=True, drop_last=True)
test_loader = torch.utils.data.DataLoader(testset, batch_size=batch_size, shuffle=False, drop_last=True)
```

2. 前向传播与损失计算

```python
def forward(x, Wh, bh, Wo, bo):
    # x shape: [batch_size, 784]
    h = torch.sigmoid(torch.mm(x, Wh) + bh)  # 隐藏层 + Sigmoid 激活
    o = torch.mm(h, Wo) + bo  # 输出层 [batch_size, 10]
    return o
```

3. 反向传播与梯度计算

```python
loss_func = torch.nn.CrossEntropyLoss()  # 定义损失函数

def calc_grad(o, y, Wh, bh, Wo, bo):
    # 调用loss_func计算损失loss，并反向传播以获得梯度（注意，无需为Wh.grad等手动赋值，loss反传会自动赋值）
    loss = loss_func(o, y)
    loss.backward()
    return Wh.grad, bh.grad, Wo.grad, bo.grad
```

4. 训练函数（手动 SGD 更新）

```python
def train(dataloader, lr, Wh, bh, Wo, bo):
    for x, y in tqdm(dataloader):
        Wh.grad = torch.zeros(Wh.shape)
        bh.grad = torch.zeros(bh.shape)
        Wo.grad = torch.zeros(Wo.shape)
        bo.grad = torch.zeros(bo.shape)

        # 将图像展平为 [batch_size, 784]
        x = x.reshape(-1, 28 * 28)

        # 前向传播
        o = forward(x, Wh, bh, Wo, bo)
        # 计算损失并反向传播得到梯度
        Wh.grad, bh.grad, Wo.grad, bo.grad = calc_grad(o, y, Wh, bh, Wo, bo) 
        # 手动 SGD 参数更新
        Wh.data = Wh.data - lr * Wh.grad
        bh.data = bh.data - lr * bh.grad
        Wo.data = Wo.data - lr * Wo.grad
        bo.data = bo.data - lr * bo.grad

    return Wh, bh, Wo, bo
```

5. 预测与测试

```python
def predict(x, Wh, bh, Wo, bo):
    # 利用forward函数，实现模型的预测
    prediction = torch.argmax(forward(x,Wh,bh,Wo,bo),1)
    return prediction
    
def test(dataloader, Wh, bh, Wo, bo):
    correct = 0
    total = 0
    for x, y in dataloader:
        # reshape x from [batch_size, 28, 28] to [batch_size, 784]
        x = x.reshape(-1, 28 * 28)
        
        # forward & predict
        prediction = predict(x, Wh, bh, Wo, bo)

        # 实现模型在测试集上的预测和准确率统计
        correct += (y == prediction).sum().item() 
        total = total + y.size(0)
    return correct / total
```

6. 训练与评估

```python
learning_rate = 0.01
epoches = 10

for epoch in range(1, epoches + 1):
    Wh, bh, Wo, bo = train(train_loader, learning_rate, Wh, bh, Wo, bo)
    train_accuracy = test(train_loader, Wh, bh, Wo, bo)
    test_accuracy = test(test_loader, Wh, bh, Wo, bo)
    print("Epoch", epoch, "Train Accuracy =", train_accuracy)
    print("Epoch", epoch, "Test Accuracy =", test_accuracy)

torch.save(Wh, "./Wh.pth")
torch.save(Wo, "./Wo.pth")
torch.save(bh, "./bh.pth")
torch.save(bo, "./bo.pth")
```

总算是训好了：

![image-20260418173553641](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/1.png)

最终测试集准确率稳定在 0.88

可视化：

```python
from matplotlib import pyplot as plt

def visualize(imgs, true_labels, pred_labels):
    fig = plt.figure(figsize=(8, 8))
    for idx, (img, true_label, pred_label) in enumerate(zip(imgs, true_labels, pred_labels)):
        ax = fig.add_subplot(4, 5, idx + 1)
        ax.imshow(img, cmap='gray')
        ax.set_title(f'true label: {true_label.item()}\npred label: {pred_label.item()}')
        ax.set_xticks([])
        ax.set_yticks([])
    plt.show()
    
    
# take out the first 20 samples in test set
x, y = next(iter(test_loader))
x, y = x[:20], y[:20]

# forward
x = x.reshape(-1, 28 * 28)
pred = predict(x, Wh, bh, Wo, bo)

# visualize
x = x.reshape(-1, 28, 28)
visualize(x, y, pred)
```

![image-20260418173310173](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/2.png)






## 卷积神经网络 CNN

### 卷积 Convolution

卷积的局部仍是线性操作，卷积层相对于线性层（全连接层）的优点：

1. 参数共享：卷积核在整个图像上滑动，利用空间平移不变性不需要为每个位置单独学一套权重，相反全连接层每个输出神经元对每个像素都有独立权重，学到的特征是位置敏感的，泛化极差。
2. 局部连接：图像的本质是局部相关性：边缘、纹理、形状都是局部像素的组合，卷积能高效提取细粒度局部特征，通过堆叠多层卷积、池化，形成层次化特征（浅层边缘、中层纹理、深层物体/语义），相反全连接层全局像素混在一起，必须自己学习哪些像素该组合的规律。
3. 数据效率：卷积层由于参数共享和局部连接，参数量比全连接少4~5个数量级，在相同数据量下更容易收敛到好的解。全连接层参数爆炸，数据集再大也极易过拟合。

全连接层理论上能逼近卷积做的任何事情，但它没有利用图像的局部性和平移不变性这两个先验，在现实数据和优化条件下，卷积层总是更优、更高效的方案。

- kernel_size 卷积核大小
- stride 滑动步长
- padding 两侧填充数目



CNN 中的卷积每个卷积层输入、输出都有多通道，许多图片就是 RGB 三通道

H × W × C ： 高度、宽度、通道数


### 池化 Pooling

池化紧随卷积层之后，也称作下采样 Downsampling，核心是在保留最重要特征的同时，大幅压缩特征图的空间尺寸（高度和宽度）。

池化窗口通常 2×2 或 3×3

- Max Pooling：取窗口内最大值（几乎所有经典 CNN）
- Average Pooling：取窗口内平均值
- Global Avg Pooling：对整张特征图求平均（ResNet、MoblieNet）

池化的必要性：

1. 缓解参数爆炸
2. 增强平移不变性：进一步模糊精确位置信息，对小的扭曲、噪声更鲁棒
3. 扩大 Receptive Field：下层卷积的每个特征实际上来自原图更大区域，多层堆叠后形成天然的层次结构：浅层边缘、中层纹理、深层物体/语义
4. 防止过拟合：池化是无参数的正则化，不训练权重，强制丢弃一部分空间细节，减少位置敏感



### 实现卷积神经网络 LeNet5

使用 PyTorch 框架实现经典卷积神经网络 LeNet-5，并在 MNIST（28×28 灰度手写数字图像，共 10 类）上完成训练和测试

![image-20260419002851146](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/3.png)



优化器 SGD ， 损失函数 CrossEntropyLoss

1. 模型定义，以及前向传播

	注意尺寸的计算：
	$$
	Output = \left\lfloor \frac{Input + 2 \times Padding - KernelSize}{Stride} \right\rfloor + 1
	$$

```python
class LeNet5(nn.Module):
    def __init__(self):
        super(LeNet5, self).__init__()

        # 第一层卷积：输入 1 通道 输出 6 通道 5×5 卷积核
        self.conv1 = nn.Conv2d(in_channels=1, out_channels=6, kernel_size=5, stride=1, padding=2)
        # 池化：2×2 MaxPool stride = 2
        self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)
        # 第二层卷积：输入 6 通道 输出 16 通道 5×5 卷积核
        self.conv2 = nn.Conv2d(6, 16, 5, 1, 0)  
        # 池化：2×2 MaxPool stride = 2
        self.pool2 = nn.MaxPool2d(2, 2)

        # 全连接分类
        self.fc1 = nn.Linear(in_features=16 * 5 * 5, out_features=120)
        self.fc2 = nn.Linear(120, 80)
        self.fc3 = nn.Linear(80, 10)

        self.relu = nn.functional.relu
        
        
    def forward(self, x):
        # x 的形状: [batch_size, 1, 28, 28]
        # 第一层：Conv + ReLU + Pool
        # [batch, 6, 28, 28] -> [batch, 6, 14, 14]
        x = self.pool1(self.relu(self.conv1(x)))

        # 第二层：Conv + ReLU + Pool
        # [batch, 16, 10, 10] -> [batch, 16, 5, 5]
        x = self.pool2(self.relu(self.conv2(x)))

        # 展平为全连接层输入: [batch_size, 400]
        # [batch, 16, 5, 5] -> [batch, 400]
        x = x.reshape(-1, 25 * 16)

        # 全连接层 + ReLU
        x = self.relu(self.fc1(x))  # [batch, 120]
        x = self.relu(self.fc2(x))  # [batch, 80]
        o = self.fc3(x)             # [batch, 10]
        return o
```

2. 设置超参数，加载数据集

```python
def load_mnist(batch_size):
    if not os.path.exists('data/'):
        os.mkdir('data/')

    transform = torchvision.transforms.Compose([
        torchvision.transforms.ToTensor(),
        # torchvision.transforms.Normalize((0.1307,), (0.3081,)),
    ])

    train_set = torchvision.datasets.MNIST(root='data/', transform=transform, train=True, download=True)
    test_set = torchvision.datasets.MNIST(root='data/', transform=transform, train=False, download=True)
    train_loader = torch.utils.data.DataLoader(train_set, batch_size=batch_size, shuffle=True)
    test_loader = torch.utils.data.DataLoader(test_set, batch_size=batch_size, shuffle=False)

    return train_loader, test_loader
```

```python
batch_size = 128
lr = 0.01
epoch = 10
train_loader, test_loader = load_mnist(batch_size=batch_size)
```

3. 开始训练，使用交叉熵损失函数、SGD 优化

```python
model = LeNet5()
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.SGD(model.parameters(), lr=lr)

model.train()

for e in range(epoch):
    t = tqdm(train_loader)
    for img, label in t:
        optimizer.zero_grad()
        pred = model(img)
        loss = criterion(pred, label)
        
        loss.backward()
        optimizer.step()

        t.set_postfix(epoch=e, train_loss=loss.item())
```

![image-20260418234926584](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/4.png)

4. 评估结果

```python
def evaluate_dataloader(dataloader, model):
    model.eval()
    
    correct_cnt, sample_cnt = 0, 0

    t = tqdm(dataloader)
    for img, label in t:
        output = model(img)
        pred = output.argmax(1)
        correct_cnt += (pred == label).sum().item()
        sample_cnt += label.size(0)
        t.set_postfix(test_acc=correct_cnt/sample_cnt)
```

![image-20260418235017324](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/5.png)

准确度达到 0.965





## 对抗样本攻击

对抗样本是指在原始输入数据中加入人眼难以察觉的微小扰动后，能诱使深度神经网络产生错误分类的样本。

### 原理

对于上述分类任务，模型学习目标：最小化损失函数
$$
\begin{aligned}
&\min_{\boldsymbol{\theta}} \ell\left(f_{\boldsymbol{\theta}}(\boldsymbol{x}), y\right) \\
&\boldsymbol{\theta}：模型参数（权重、偏置等） \\
&\boldsymbol{x}：输入样本（如图像） \\
&\boldsymbol{y}：真实标签 \\
&\ell(\cdot)：损失函数（如交叉熵）
\end{aligned}
$$

### 无目标攻击

无目标攻击，对抗样本的目标是最大化分类损失  
$$
\begin{aligned}
&\max_{\boldsymbol{\delta}} \ell\left(f_{\boldsymbol{\theta}}(\boldsymbol{x} + \boldsymbol{\delta}), y\right)
\\
&\boldsymbol{\delta}：对抗扰动（噪声）
\end{aligned}
$$

在给定数据点和模型的情况下，通过改变 $\boldsymbol{\delta}$ ，最大化损失函数

如果对 $\boldsymbol{\delta}$ 没有限制，加扰动的图片可能被人眼察觉，所以要限制扰动强度，每个维度扰动绝对值都小于  $\epsilon$
$$
\begin{aligned}
&\max_{\boldsymbol{\delta}} \ell\left(f_{\boldsymbol{\theta}}(\boldsymbol{x} + \boldsymbol{\delta}), y\right) \quad \text{s.t.} \quad \|\boldsymbol{\delta}\|_{\infty} \leq \epsilon \\
&\epsilon：扰动的“最大允许强度”\\
\end{aligned}
$$


回顾梯度下降、反向传播的参数更新：
$$
\boldsymbol{\theta} = \boldsymbol{\theta} - \alpha \cdot \nabla_{\boldsymbol{\theta}} \ell\left(f_{\boldsymbol{\theta}}(\boldsymbol{x}), y\right) \\
$$
这个过程是最小化损失函数，如果反向更新，等同于在最大化损失函数
$$
\boldsymbol{\theta} = \boldsymbol{\theta} + \alpha \cdot \nabla_{\boldsymbol{\theta}} \ell\left(f_{\boldsymbol{\theta}}(\boldsymbol{x}), y\right)
$$
将更新做到输入上，即得对抗样本的公式：
$$
\tilde{\boldsymbol{x}} = \boldsymbol{x} + \alpha \cdot \nabla_{\boldsymbol{x}} \ell\left(f_{\boldsymbol{\theta}}(\boldsymbol{x}), y\right)
$$

#### FGSM

FGSM 是一种单步梯度攻击方法，通过在输入图像的梯度方向上添加一个固定大小的扰动来生成对抗样本。

实现 $ \|\boldsymbol{\delta}\|_{\infty} \leq \epsilon $ ：

$$
\boldsymbol{\delta} = \epsilon \cdot \operatorname{sign}\left(\nabla_{\boldsymbol{x}} \ell\left(f_{\boldsymbol{\theta}}(\boldsymbol{x}), y\right)\right), 
\\
\operatorname{sign}(\delta_i) = \begin{cases} 
+1, & \delta_i > 0 \\
-1, & \delta_i \leq 0 
\end{cases}
$$


最终 FGSM 对抗样本生成流程

$$
\tilde{\boldsymbol{x}} = \boldsymbol{x} + \epsilon \cdot \operatorname{sign}\left(\nabla_{\boldsymbol{x}} \ell\left(f_{\boldsymbol{\theta}}(\boldsymbol{x}), y\right)\right)
$$



```python
def fgsm(imgs, epsilon, model, criterion, labels):
    model.eval()

    adv_xs = imgs.float()
    adv_xs.requires_grad = True

    # 模型前向传播，计算loss，然后loss反传
    o = model(adv_xs)
    loss = criterion(o, labels)
    model.zero_grad()
    loss.backward()

    # 得到输入的梯度、生成对抗样本
    # 公式：adv_xs = imgs + epsilon * sign(grad)，其中grad是输入的梯度，sign()是符号函数

    adv_xs = adv_xs + epsilon * adv_xs.grad.sign()

    # 对扰动做截断，保证对抗样本的像素值在合理域内
    # 使用函数：torch.clamp(input, min, max)可以对输入张量的元素进行截断，使其值在指定的范围内
    adv_xs = torch.clamp(adv_xs, 0.0, 1.0)

    model.train()

    return adv_xs.detach()
```
```python
model = LeNet5()
model.load_state_dict(torch.load('model/lenet5.pt'))
model.eval()

criterion = nn.CrossEntropyLoss()
```
```python
def evaluate(imgs, labels, model):
    # 用model预测imgs，并得到预测标签pred_label
    model.eval()
    pred = model(imgs)
    pred_label = pred.argmax(1)

    # 计算预测标签与真实标签的匹配数目
    correct_cnt = (pred_label == labels).sum().item()
    
    print(f'match rate: {correct_cnt/labels.shape[0]}')
    return pred_label
```
```python
epsilon = 0.1
adv_xs = fgsm(imgs, epsilon, model, criterion, labels)

pred_label = evaluate(adv_xs, labels, model)

adv_imgs = adv_xs.reshape_as(imgs)
visualize_adv(adv_imgs, labels, pred_label)

with open('data/fgsm_img_label.pkl', 'wb') as f:
    pickle.dump({
        'adv_img': adv_imgs,
        'true_label': labels,
        'pred_label': pred_label,
    }, f)
```



epsilon = 0.1   match rate: 0.8

![image-20260419000343801](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/6.png)



epsilon = 0.2 match rate: 0.0

![image-20260419000425449](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/7.png)



这说明当扰动强度增大时，攻击效果显著增强



#### PGD

Project Gradient Descent：每次 SGD 后都对扰动做裁剪，初始化扰动为 0，clamp 表示裁剪到 $[-\epsilon ,\epsilon]$ 中
$$
\delta_{t+1}=\operatorname{clamp}\left(\delta_{t}+\alpha \cdot \operatorname{sign}\left(\nabla_{x+\delta_{t}} \ell\left(f_{\theta}\left(x+\delta_{t}\right), y\right)\right),-\epsilon, \epsilon\right)
$$

```python
model = LeNet5()
model.load_state_dict(torch.load('model/lenet5.pt'))
model.eval()

criterion = nn.CrossEntropyLoss()
```

```python
def pgd(imgs, epsilon, alpha, iter, model, criterion, labels):

    model.eval()
    adv_xs = imgs.float()

    for i in range(iter):
        adv_xs = adv_xs.clone().detach().requires_grad_(True)
        # Forward and compute loss, then backward
        o = model(adv_xs)
        loss = criterion(o, labels)
        model.zero_grad()
        loss.backward()

        # Retrieve grad and generate adversarial example, note to detach

        adv_xs = adv_xs + alpha * adv_xs.grad.sign()

        # Clip perturbation
        adv_xs = torch.clamp(adv_xs - imgs, - epsilon, epsilon) + imgs
        adv_xs = torch.clamp(adv_xs, 0.0, 1.0)

    model.train()

    return adv_xs.detach()
```

```python
epsilon = 0.2
iter = 5
alpha = 0.07
adv_xs = pgd(imgs, epsilon, alpha, iter, model, criterion, labels)
pred_label = evaluate(adv_xs, labels, model)
```

epsilon = 0.1 match rate: 0.55

![image-20260419000527337](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/8.png)



epsilon = 0.2 match rate: 0.0

![image-20260419000642787](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/9.png)



epsilon = 0.2 时，匹配率降至 0%，攻击成功率极高 



```python
with open('data/pgd_img_label.pkl', 'wb') as f:
    pickle.dump({
        'adv_img': adv_imgs,
        'true_label': labels,
        'pred_label': pred_label,
    }, f)


with open('data/fgsm_img_label.pkl', 'rb') as f:
    data = pickle.load(f)
    fgsm_imgs = data['adv_img']

# Compute perturbation from original img
delta_fgsm = fgsm_imgs - imgs
delta_pgd = adv_imgs - imgs

# Compute L2 distance
print(f'L2_FGSM: {delta_fgsm.pow(2).sum(dim=-1).sqrt().mean()}')
print(f'L2_PGD: {delta_pgd.pow(2).sum(dim=-1).sqrt().mean()}')
```

```
L2_FGSM: 0.7743703722953796
L2_PGD: 0.7302716374397278
```

与 FGSM 相比，PGD 在相同 epsilon下产生的 L2 扰动范数更小，说明扰动更隐蔽。



### 有目标攻击

无目标攻击： $\max_{\boldsymbol{\delta}} \ell\left(f_{\boldsymbol{\theta}}(\boldsymbol{x} + \boldsymbol{\delta}), y\right)$ 在微小扰动下最大化损失函数

有目标攻击：在微小扰动下最小化到目标的距离 $\min_{\boldsymbol{\delta}} \ell\left(f_{\boldsymbol{\theta}}(\boldsymbol{x} + \boldsymbol{\delta}), \tilde{y}\right)$ 

```python
model = LeNet5()
model.load_state_dict(torch.load('model/lenet5.pt'))
model.eval()

criterion = nn.CrossEntropyLoss()
```

#### FGSM

反向传播的目的是最小化预测值和真实值的 loss

而有目标攻击是最小化预测值和目标值的 loss
$$
\tilde{x}=x-\epsilon \cdot \operatorname{sign}\left(\nabla_{x} \ell\left(f_{\theta}(x), \tilde{y}\right)\right)
$$

```python
epsilon = 0.2
fgsm_xs = fgsm_target(imgs, epsilon, model, criterion, target_labels)
pred_label = evaluate(fgsm_xs, target_labels, model)
```

```python
def fgsm_target(imgs, epsilon, model, criterion, labels):
    model.eval()

    adv_xs = imgs.float()
    adv_xs.requires_grad = True

    o = model(adv_xs)
    loss = criterion(o, labels)
    model.zero_grad()
    loss.backward()

    adv_xs = adv_xs - epsilon * adv_xs.grad.sign()

    adv_xs = torch.clamp(adv_xs, 0.0, 1.0)

    model.train()

    return adv_xs.detach()
```

```python
fgsm_imgs = fgsm_xs.reshape_as(imgs)
visualize_target_adv(fgsm_imgs, target_labels, pred_label)
```

epsilon = 0.2  match rate: 0.4

![image-20260419001138628](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/10.png)

#### PGD

$$
\delta_{t+1}=\operatorname{clamp}\left(\delta_{t}-\alpha \cdot \operatorname{sign}\left(\nabla_{x+\delta_{t}} \ell\left(f_{\theta}\left(x+\delta_{t}\right), \tilde{y}\right)\right),-\epsilon, \epsilon\right)
$$

```python
epsilon = 0.2
iter = 15
alpha = 0.07
pgd_xs = pgd_target(imgs, epsilon, alpha, iter, model, criterion, target_labels)
pred_label = evaluate(pgd_xs, target_labels, model)
```

```python
def pgd_target(imgs, epsilon, alpha, iter, model, criterion, labels):

    model.eval()
    adv_xs = imgs.float()

    for i in range(iter):
        adv_xs = adv_xs.clone().detach().requires_grad_(True)
        o = model(adv_xs)
        loss = criterion(o, labels)
        model.zero_grad()
        loss.backward()

        adv_xs = adv_xs - alpha * adv_xs.grad.sign()

        adv_xs = torch.clamp(adv_xs - imgs, - epsilon, epsilon) + imgs
        adv_xs = torch.clamp(adv_xs, 0.0, 1.0)

    model.train()

    return adv_xs.detach()
```



```python
pgd_imgs = pgd_xs.reshape_as(imgs)
visualize_target_adv(pgd_imgs, target_labels, pred_label)
```

epsilon = 0.2
iter = 15
alpha = 0.07

match rate: 0.8

![image-20260419001400972](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/11.png)

```python
delta_fgsm = fgsm_imgs - imgs
delta_pgd = pgd_imgs - imgs

print(f'L2_FGSM: {delta_fgsm.pow(2).sum(dim=-1).sqrt().mean()}')
print(f'L2_PGD: {delta_pgd.pow(2).sum(dim=-1).sqrt().mean()}')
```

```
L2_FGSM: 0.7922353744506836
L2_PGD: 0.6826989054679871
```

相同 epsilon 下 PGD 产生的 L2 扰动范数更小，更隐蔽