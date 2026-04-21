---
title: MLP (全连接) 和 CNN (卷积)
date: 2026-04-02
categories: 深度学习
toc: true
---

深度神经网络通过多层非线性变换实现复杂特征提取与模式识别，包括多层感知机（MLP）和卷积神经网络（CNN）。本文理论结合实践，解析 MLP 和 CNN 的核心原理，并通过 PyTorch 完成在 MNIST 手写数字数据集上完成训练与评估。

<!--more-->

## 多层感知机 MLP

多层感知机（Multilayer Perceptron）是多层神经网络的一种，指全连接的简单前馈网络，由输入层、一个或多个隐藏层和输出层组成。每层之间通过全连接的方式进行连接，参数量庞大。

### 激活函数

如果层与层之间只进行线性变换，多层神经网络表达能力等同于单层线性回归，无法解决非线性问题

激活函数的核心就是引入非线性，而 多层线性变换 + 非线性激活 能组合出任意复杂的决策边界，逼近几乎任何连续函数。

Universal Approximation Theorem ：只要激活函数满足一定条件（非多项式、连续等，比如 sigmoid、ReLU、tanh），单隐藏层的神经网络就能在紧致集上任意逼近任何连续函数。更深的网络则能用更少的神经元、更高效的方式实现同样的逼近能力。

- **Sigmoid**：$ \text{σ}(h) = 1 / (1 + e^{-h}) $  涉及指数计算，当输入 h 很大/很小时，导数接近 0，反向传播时梯度会层层衰减到几乎为0，深层网络几乎无法训练。
- **ReLU**： $ \text{ReLU}(x) = max(0, x) $ 计算简单，缓解梯度消失并能加速收敛；负值直接置零，一些神经元输出 0，相当于不传递任何信息，有点模拟神经元激活和抑制的意思，下一次传播时也有可能重新激活，这种临时关闭，让 ReLU 能带来稀疏性。但如果权重和偏置被更新地太狠，可能让这个神经元计算结果一直为负值，导致神经元"永久死亡"
- **Softmax** ：$ \text{Softmax}(z_i) = \frac{e^{z_i}}{\sum_{j=1}^{C} e^{z_j}} $  将多个输出归一化为概率分布（和为 1），常用于多分类输出层；与交叉熵损失搭配时梯度计算高效。


### 实现 MLP（3 层）

使用 NumPy + PyTorch 张量的方式，实现一个简单的 3 层神经网络，并在 MNIST 手写数字识别任务上进行训练和测试

输入为展平后的 28×28 图像（784 维），隐藏层神经元数量设为 100，输出为 10 类数字。

实验采用 Sigmoid 激活函数和交叉熵损失，使用手动实现的随机梯度下降（SGD）进行参数更新。



模型定义：

$$ 
\begin{aligned}
&h = \sigma(W_h x + b_h)，其中 \sigma(h) = \frac{1}{1+e^{-h}} \\ 
&o = W_o h + b_o 
\end{aligned}
$$

损失函数：

$$ 
\ell(\theta) = \sum_{i=1}^{N} CE(f(x^{(i)}), y^{(i)}) 
$$

> 损失函数：用于量化模型预测结果和真实标签的差距，在分类任务中最常使用的是交叉熵损失。

手写数字识别任务的输出层是线性的，产生 10 个未归一化的实数值(logits)，为了解释为概率分布，使用 `Softmax` 函数，将 logits 压缩到 (0,1) 区间，并且所有概率和为 1

PyTorch 中的 `nn.CrossEntropyLoss` 已经自动包含了 `Softmax` 计算，在代码中不要在最后一层手动添加 Softmax 激活函数

其数学过程：
- 对网络的原始输出 `o` 应用Softmax，将其转换为概率分布 $ \mathbf{\hat{y}} = [\hat{y}_1, \hat{y}_2, ..., \hat{y}_C] $
- 计算 $ \text{Loss}(t, \mathbf{\hat{y}}) = -\log(\hat{y}_t) $


Batch SGD：每次随机取一部分数据 batch 输入模型，进行训练，对整个 batch 一起计算损失函数，反向更新参数 

#### 代码实现

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
# 定义数据预处理：仅将 PIL图像或 NumPy 数组转换为 PyTorch 张量
transform = transforms.ToTensor()

# 下载并加载MNIST训练集和测试集
trainset = torchvision.datasets.MNIST(root="./MNIST", train=True, download=True, transform=transform)
testset = torchvision.datasets.MNIST(root="./MNIST", train=False, download=True, transform=transform)

# 创建数据加载器(DataLoader)，用于按批次加载和打乱数据
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
# 使用 PyTorch 内置的交叉熵损失函数，它内部已集成Softmax操作
loss_func = torch.nn.CrossEntropyLoss()  

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
        # 在每次迭代开始时，将梯度显式清零。如果不清零，梯度会累加。
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
    # 利用forward函数得到logits，然后通过argmax获取预测类别（维度1代表在10个类别上取最大值索引）
    prediction = torch.argmax(forward(x,Wh,bh,Wo,bo), 1)
    return prediction
    
def test(dataloader, Wh, bh, Wo, bo):
    correct = 0
    total = 0
    for x, y in dataloader:
        # 展平输入
        x = x.reshape(-1, 28 * 28)
        
        # forward & predict
        prediction = predict(x, Wh, bh, Wo, bo)

        # 统计预测正确的数量
        correct += (y == prediction).sum().item() 
        total = total + y.size(0)
    # 返回准确率
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

CNN 的核心是卷积层。与 MLP 的全连接不同，卷积层通过卷积核在输入数据上进行局部线性计算（滑动窗口）

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



使用 SGD 优化器， ReLU 激活函数，交叉熵损失函数 CrossEntropyLoss

1. 模型定义，以及前向传播

	注意尺寸的计算：
	$$
	Output = \left\lfloor \frac{Input + 2 \times Padding - KernelSize}{Stride} \right\rfloor + 1
	$$

```python
class LeNet5(nn.Module):
    def __init__(self):
        super(LeNet5, self).__init__()

        # 第一层卷积：输入 1 通道 输出 6 通道 5×5 卷积核 输出大小为 28*28
        self.conv1 = nn.Conv2d(in_channels=1, out_channels=6, kernel_size=5, stride=1, padding=2)
        # 池化：2×2 MaxPool stride = 2 输出大小为 14*14
        self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)
        # 第二层卷积：输入 6 通道 输出 16 通道 5×5 卷积核 输出大小为 10*10
        self.conv2 = nn.Conv2d(6, 16, 5, 1, 0)  
        # 池化：2×2 MaxPool stride = 2 输出大小为 5*5
        self.pool2 = nn.MaxPool2d(2, 2)

        # 全连接层部分：将卷积层输出的三维特征图展平为一维向量
        self.fc1 = nn.Linear(in_features=16 * 5 * 5, out_features=120)
        self.fc2 = nn.Linear(120, 84)
        self.fc3 = nn.Linear(84, 10) # 输出10个类别的logits
      
        # 使用PyTorch函数式接口中的ReLU激活函数
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
criterion = nn.CrossEntropyLoss()  # 交叉熵损失函数
optimizer = torch.optim.SGD(model.parameters(), lr=lr)  # 随机梯度下降优化器

model.train()

for e in range(epoch):
    t = tqdm(train_loader)
    for img, label in t:
        optimizer.zero_grad()  # 清零上一轮迭代累积的梯度
        pred = model(img)
        loss = criterion(pred, label) # 计算损失
        loss.backward()    # 反向传播，计算梯度
        optimizer.step()   # 优化器根据梯度更新模型参数

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
        pred = output.argmax(1)       # 获取预测类别 (在维度1上取最大值索引)
        correct_cnt += (pred == label).sum().item()
        sample_cnt += label.size(0)
        t.set_postfix(test_acc=correct_cnt/sample_cnt)
```

![image-20260418235017324](../assets/img/MLP%20CNN%20%E4%B8%8E%E5%AF%B9%E6%8A%97%E6%A0%B7%E6%9C%AC%E6%94%BB%E5%87%BB/5.png)

准确度达到 0.965

## 总结

在 MNIST 任务上，相同训练轮数下 LeNet-5 的训练时间、识别准确率 (0.965) 都明显高于 MLP (0.88)，验证了 CNN 针对图像数据的归纳偏置（局部性、平移不变性）的有效性