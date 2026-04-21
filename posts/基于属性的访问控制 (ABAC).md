---
title: 基于属性的访问控制（ABAC）
date: 2025-12-12
categories: 系统安全
toc: true
---

基于属性的访问控制（Attribute-Based Access Control, ABAC）与传统基于角色的访问控制（RBAC）不同，ABAC 通过主体、客体、环境和动作等多维度属性的动态组合来做出访问决策，灵活性更强，控制粒度也更细。在多角色、多部门、数据敏感度差异大的复杂业务环境中，ABAC 能很好地应对跨部门访问、上下文感知安全和最小权限原则等挑战。

<!--more-->


传统的 RBAC（基于角色的访问控制）通过 用户、角色、权限 的间接映射，在用户规模较小、业务逻辑简单的场景下表现出色。然而，随着组织规模的增长和业务复杂度的提升，RBAC 的局限性逐渐显现：

- 角色爆炸：当需要根据部门、项目、时间等维度区分权限时，角色数量会呈指数级膨胀。
- 无法感知上下文：RBAC 的决策只看角色，无法考虑环境等上下文信息。
- 细粒度控制乏力：当需要基于资源所有者、敏感等级等属性做差异化授权时，RBAC 往往需要借助辅助的 ACL 或业务层代码 hack，既破坏了架构整洁性，也增加了维护成本。

ABAC 将决策视角从角色转向属性，通过评估请求方（主体）、资源方（客体）、环境上下文和操作类型的多维度属性组合来做动态判断。这种范式转变带来了显著优势：

- 策略表达力更强：不再受限于预定义角色，可以基于任意属性组合编写策略，避免角色爆炸。
- 上下文感知：环境属性（时间、位置、设备）是 ABAC 的原生决策因子，无需像 RBAC 那样通过扩展角色来模拟。
- 细粒度控制：策略聚焦于在什么条件下允许什么操作，而不是为每个角色堆叠一堆权限，实现细粒度控制。

## ABAC 理论基础

ABAC 的核心思想来自 NIST SP 800-162（Guide to Attribute Based Access Control）等标准组织的访问控制框架，决策不再只看静态角色，而是实时评估四类属性：

- **主体属性**（Subject Attributes）：用户的角色、部门、安全等级、认证状态等
- **客体属性**（Object Attributes）：资源的类型、所属部门、敏感度、所有者、创建时间等
- **环境属性**（Environment Attributes）：访问时间、位置、设备类型、网络安全等级等上下文信息
- **动作属性**（Action）：读、写、修改、删除、审批等具体操作


在大学场景下，学生、教师、管理员角色交织，成绩、经费、文件等资源的敏感度各不相同，如果还考虑工作时间、校园位置等环境约束。
传统 RBAC 很难处理这么多交叉条件，而 ABAC 通过策略组合算法（如拒绝优先、允许优先）能灵活解决冲突和优先级问题。

## 核心架构设计

使用模块化设计实现一个简单 ABAC 系统：

`models.py` 定义数据结构，不涉及任何业务逻辑

`engine.py` 串联数据模型和策略集合

`policy.py`  决策单元，定义策略集

`university_policies.py` 实现访问控制规则


### 数据模型

models.py 用 Python dataclass 定义了四个核心类：主体、客体、环境和访问请求，涵盖所需的全部属性。

```python
from dataclasses import dataclass
from typing import Dict, Any, Optional

@dataclass
class User:
    """用户（主体）属性。"""
    user_id: str
    role: str             # "student" | "teacher" | "admin"
    department: str       # e.g. "CS", "Math"
    clearance_level: str  # "low" | "medium" | "high"
    attributes: Optional[Dict[str, Any]] = None

@dataclass
class Resource:
    """客体（资源）属性。"""
    resource_id: str
    resource_type: str        # "score" | "file" | "funds"
    department: str
    sensitivity_level: str    # "low" | "medium" | "high"
    owner_id: str
    attributes: Optional[Dict[str, Any]] = None

@dataclass
class Environment:
    """环境属性。"""
    time_of_access: str       # "workday" | "afterhours"
    location: str             # "campus" | "offcampus"
    device_type: str          # "normal" | "emergency"
    attributes: Optional[Dict[str, Any]] = None

@dataclass
class Request:
    """访问请求，把主体 / 客体 / 环境和动作合在一起。"""
    user: User
    resource: Resource
    environment: Environment
    action: str               # e.g. "read"
```

`role` 区分身份（学生、教师、管理员），`department` 实现部门隔离，`clearance_level` 和 `sensitivity_level` 构成多级安全控制（Bell-LaPadula 模型的安全等级概念），

`time_of_access`、`location`、`device_type` 提供上下文信息，支持零信任场景下的动态决策。

`attributes` 字段预留了扩展空间，业务方可以注入任意自定义属性，而无需修改数据模型本身。

### 策略定义与组合

policy.py 是 ABAC 的决策单元，每条策略都有 ID、描述、效果（允许/拒绝）和条件函数。策略集通过组合算法来处理多个策略之间的冲突。

```python
from typing import Callable, Literal, List
from .models import Request

Effect = Literal["permit", "deny", "not_applicable"]    # 决策结果
CombiningAlgName = Literal["deny_overrides", "permit_overrides", "first_applicable"]


class Policy:
    """
    一条策略（rule）：如果 condition 为 True，则产生 effect(permit/deny)，
    否则返回 not_applicable。
    """

    def __init__(
        self,
        policy_id: str,
        description: str,
        effect: Literal["permit", "deny"],
        condition: Callable[[Request], bool],
    ) -> None:
        self.policy_id = policy_id
        self.description = description
        self.effect = effect
        self.condition = condition

    def evaluate(self, request: Request) -> Effect:
        if self.condition(request):
            return self.effect
        return "not_applicable"


class PolicySet:
    """
    一组策略 + 组合算法：deny_overrides / permit_overrides / first_applicable。
    """

    def __init__(
        self,
        set_id: str,
        policies: List[Policy],
        combining_alg: CombiningAlgName = "permit_overrides",
    ) -> None:
        self.set_id = set_id
        self.policies = policies
        self.combining_alg = combining_alg

    def evaluate(self, request: Request) -> Effect:
        if self.combining_alg == "deny_overrides":
            return self._deny_overrides(request)
        elif self.combining_alg == "permit_overrides":
            return self._permit_overrides(request)
        elif self.combining_alg == "first_applicable":
            return self._first_applicable(request)
        else:
            raise ValueError(f"Unknown combining algorithm: {self.combining_alg}")

    # --- 各种组合算法 ---

    def _deny_overrides(self, request: Request) -> Effect:
        """
        只要有任何deny，整体deny；没有deny但有permit，则permit；否则not_applicable。
        """
        at_least_one_permit = False
        for policy in self.policies:
            res = policy.evaluate(request)
            if res == "deny":
                return "deny"
            if res == "permit":
                at_least_one_permit = True
        return "permit" if at_least_one_permit else "not_applicable"

    def _permit_overrides(self, request: Request) -> Effect:
        """
        只要有任何permit，整体permit；没有permit但有deny，则deny；否则not_applicable。
        """
        at_least_one_deny = False
        for policy in self.policies:
            res = policy.evaluate(request)
            if res == "permit":
                return "permit"
            if res == "deny":
                at_least_one_deny = True
        return "deny" if at_least_one_deny else "not_applicable"

    def _first_applicable(self, request: Request) -> Effect:
        """
        按顺序找到第一条产生permit/deny的策略并返回；如果都not_applicable就not_applicable。
        """
        for policy in self.policies:
            res = policy.evaluate(request)
            if res != "not_applicable":
                return res
        return "not_applicable"

```

Policy 类把条件和决策效果解耦，方便策略独立编写和复用。PolicySet 实现了三种经典组合算法，适用于不同安全场景：

| 组合算法 | 适用场景 | 决策逻辑 |
| --- | --- | --- |
| **deny_overrides** | 高安全要求系统 | 任何策略拒绝即拒绝，只有全部允许才放行 |
| **permit_overrides** | 效率优先、默认开放的业务系统 | 任何策略允许即允许，无禁止时放行 |
| **first_applicable** | 策略有严格优先级顺序的场景 | 按声明顺序执行，第一条匹配的策略决定结果 |

> **为什么需要组合算法？** 实际业务中，一条请求往往会同时命中多条策略。例如学生访问自己的成绩，既匹配「学生可以访问自己成绩」的允许策略，又匹配「低安全级别用户不能访问高敏感资源」的拒绝策略。组合算法决定了这种冲突时的最终行为，确保系统行为可预测。

### 策略评估引擎

engine.py 是对外接口，持有根策略集并提供简洁的评估方法：

```python
from .models import Request
from .policy import PolicySet, Effect

class ABACEngine:
    """ABAC 引擎：持有一个根 PolicySet，对外提供 evaluate / is_allowed。"""
    def __init__(self, root_policy_set: PolicySet) -> None:
        self.root_policy_set = root_policy_set

    def evaluate(self, request: Request) -> Effect:
        return self.root_policy_set.evaluate(request)

    def is_allowed(self, request: Request) -> bool:
        return self.evaluate(request) == "permit"
```

ABACEngine 完全封装了策略评估逻辑，对上层业务代码暴露两个核心接口：

- `evaluate()` 返回详细决策结果（`permit`/`deny`/`not_applicable`），用于需要细粒度决策日志的场景；

- `is_allowed()` 直接返回布尔值，方便在实际系统中快速集成。根策略集（root_policy_set）的设计允许构建更复杂的策略层级——例如按业务线（教务、财务、科研）分别定义子策略集，通过树形结构组合实现企业级策略管理。



## 业务策略实现

业务策略集是整个方案的核心，采用**特殊权限、禁止规则、允许规则**的分层设计，确保安全优先。一共定义了 15 条策略，覆盖管理员全权、学生成绩隔离、教师部门限制、时间/位置/设备约束等场景。

策略设计思路结合 ABAC 理论：先处理管理员和紧急破窗机制，再通过拒绝策略严格限制越权行为，最后补充允许策略实现最小权限的业务访问。

**策略全景图**

```
特殊权限                                                        
├── P1. 管理员全权 (admin_all_access)                           
└── P2. 紧急破窗 (emergency_override)                           

禁止规则                                                        
├── P3. 非工作时间禁止访问高敏感资源                             
├── P4. 校外禁止访问高敏感资源                                   
├── P5. 低安全级别用户禁止访问高敏感资源                         
├── P6. 中安全级别用户禁止访问高敏感资源                         
├── P7. 教师禁止修改成绩                                        
├── P8. 学生禁止访问经费                                        
├── P9. 教师禁止访问经费                                        
├── P10. 学生禁止访问他人成绩                                   
├── P11. 教师禁止访问其他部门学生成绩                           
└── P12. 教师禁止访问其他部门文件                               

允许规则                                                       
├── P13. 学生可访问自己成绩                                     
├── P14. 同部门教师可访问本系学生成绩                            
└── P15. 同部门教师可访问本系文件                               
```

- 特殊权限类：管理员全权和紧急破窗机制，保障特殊场景下的灵活性；
- 禁止类：严格阻止越权行为，比如学生看他人成绩、教师跨部门访问、非工作时间访问高敏资源等；
- 允许类：实现最小权限下的正常业务访问。

这种**先拒绝后允许**的设计思路确保了安全优先——拒绝策略优先匹配，只有在没有任何拒绝时才轮到允许策略生效。

契合顺序匹配的组合算法（`first_applicable`）

```python
from typing import List
from .models import User, Resource, Environment, Request
from .policy import Policy, PolicySet
from .engine import ABACEngine

def build_university_engine() -> ABACEngine:
    policies: List[Policy] = []

    # 策略 1：管理员可以访问所有资源
    def admin_all_access(req: Request) -> bool:
        return req.user.role == "admin"

    policies.append(Policy(
        policy_id="admin_all_access",
        description="Admin can access all resources.",
        condition=admin_all_access,
        effect="permit",
    ))

    # 策略 2：紧急设备可以访问所有资源（破窗机制）
    def emergency_override(req: Request) -> bool:
        return req.environment.device_type == "emergency"

    policies.append(Policy(
        policy_id="emergency_override",
        description="Emergency device allows access to all resources.",
        condition=emergency_override,
        effect="permit",
    ))

    # 策略 3：非工作时间不允许访问高敏感资源
    def afterhours_high_sensitivity_deny(req: Request) -> bool:
        return (req.environment.time_of_access == "afterhours" and
                req.resource.sensitivity_level == "high")

    policies.append(Policy(
        policy_id="afterhours_high_sensitivity_deny",
        description="Deny access to high sensitivity resources after hours.",
        condition=afterhours_high_sensitivity_deny,
        effect="deny",
    ))

    # 策略 4：校外不允许访问高敏感资源
    def offcampus_high_sensitivity_deny(req: Request) -> bool:
        return (req.environment.location == "offcampus" and
                req.resource.sensitivity_level == "high")

    policies.append(Policy(
        policy_id="offcampus_high_sensitivity_deny",
        description="Deny access to high sensitivity resources off campus.",
        condition=offcampus_high_sensitivity_deny,
        effect="deny",
    ))

    # 策略 5：低安全级别用户不允许访问高敏感资源
    def low_clearance_high_sensitivity_deny(req: Request) -> bool:
        return (req.user.clearance_level == "low" and
                req.resource.sensitivity_level == "high")

    policies.append(Policy(
        policy_id="low_clearance_high_sensitivity_deny",
        description="Deny access to high sensitivity resources for low clearance users.",
        condition=low_clearance_high_sensitivity_deny,
        effect="deny",
    ))

    # 策略 6：中安全级别用户不允许访问高敏感资源
    def medium_clearance_high_sensitivity_deny(req: Request) -> bool:
        return (req.user.clearance_level == "medium" and
                req.resource.sensitivity_level == "high")

    policies.append(Policy(
        policy_id="medium_clearance_high_sensitivity_deny",
        description="Deny access to high sensitivity resources for medium clearance users.",
        condition=medium_clearance_high_sensitivity_deny,
        effect="deny",
    ))

    # 策略 7：教师不可修改学生成绩
    def teacher_modify_score_deny(req: Request) -> bool:
        return (req.user.role == "teacher" and
                req.resource.resource_type == "score" and
                req.action == "modify")

    policies.append(Policy(
        policy_id="teacher_modify_score_deny",
        description="Teachers cannot modify student scores.",
        condition=teacher_modify_score_deny,
        effect="deny",
    ))

    # 策略 8：学生不可访问经费资源
    def student_access_funds_deny(req: Request) -> bool:
        return (req.user.role == "student" and
                req.resource.resource_type == "funds")

    policies.append(Policy(
        policy_id="student_access_funds_deny",
        description="Students cannot access funds resources.",
        condition=student_access_funds_deny,
        effect="deny",
    ))

    # 策略 9：教师不可访问经费资源
    def teacher_access_funds_deny(req: Request) -> bool:
        return (req.user.role == "teacher" and
                req.resource.resource_type == "funds")

    policies.append(Policy(
        policy_id="teacher_access_funds_deny",
        description="Teachers cannot access funds resources.",
        condition=teacher_access_funds_deny,
        effect="deny",
    ))
    
    # 策略 10：学生不可访问他人成绩
    def student_other_score(req: Request) -> bool:
        return (req.user.role == "student" and
                req.resource.resource_type == "score" and
                req.resource.owner_id != req.user.user_id)

    policies.append(Policy(
        policy_id="student_other_score",
        description="Students cannot access others' scores.",
        condition=student_other_score,
        effect="deny",
    ))
    
    # 策略 11：教师不可访问其他部门学生的成绩
    def teacher_other_dept_student_score(req: Request) -> bool:
        return (req.user.role == "teacher" and
                req.resource.resource_type == "score" and
                req.user.department != req.resource.department)

    policies.append(Policy(
        policy_id="teacher_other_dept_student_score",
        description="Teachers cannot access scores of students in other departments.",
        condition=teacher_other_dept_student_score,
        effect="deny",
    ))
    
    
    # 策略 12：不同部门教师不可访问文件资源
    def teacher_other_dept_file_deny(req: Request) -> bool:
        return (req.user.role == "teacher" and
                req.resource.resource_type == "file" and
                req.user.department != req.resource.department)

    policies.append(Policy(
        policy_id="teacher_other_dept_file_deny",
        description="Teachers cannot access file resources in other departments.",
        condition=teacher_other_dept_file_deny,
        effect="deny",
    ))
    
    
    
    # 策略 13：学生可以访问自己的成绩
    def student_own_score(req: Request) -> bool:
        return (req.user.role == "student" and
                req.resource.resource_type == "score" and
                req.resource.owner_id == req.user.user_id)

    policies.append(Policy(
        policy_id="student_own_score",
        description="Students can access their own scores.",
        condition=student_own_score,
        effect="permit",
    ))


    # 策略 14：教师可以访问同部门学生的成绩
    def teacher_same_dept_student_score(req: Request) -> bool:
        return (req.user.role == "teacher" and
                req.resource.resource_type == "score" and
                req.user.department == req.resource.department)

    policies.append(Policy(
        policy_id="teacher_same_dept_student_score",
        description="Teachers can access scores of students in the same department.",
        condition=teacher_same_dept_student_score,
        effect="permit",
    ))

    # 策略 15：同部门教师可以访问文件资源
    def teacher_same_dept_file_access(req: Request) -> bool:
        return (req.user.role == "teacher" and
                req.resource.resource_type == "file" and
                req.user.department == req.resource.department)

    policies.append(Policy(
        policy_id="teacher_same_dept_file_access",
        description="Teachers can access file resources in the same department.",
        condition=teacher_same_dept_file_access,
        effect="permit",
    ))


    policy_set = PolicySet(
        set_id="university_policies",
        policies=policies,
        combining_alg="first_applicable",
    )
    return ABACEngine(policy_set)
```


策略在 PolicySet 中按声明顺序逐一评估，本文的 15 条策略遵循以下原则：

1. 特殊权限优先：管理员和紧急设备拥有最高优先级，无论资源敏感度如何都能通过
2. 禁止规则次之：覆盖时间、位置、安全等级、部门等多维度限制条件
3. 允许规则兜底：在所有禁止规则都不满足时，才允许合法业务操作

这种设计在安全性和可用性之间取得了良好平衡：正常业务流畅运行，而恶意或疏忽的越权访问被多层过滤网捕获。



## 使用示例

下面用典型的大学业务场景来测试验证策略的有效性：

```python
import unittest
from src.models import User, Resource, Environment, Request
from src.university_policies import build_university_engine


class TestUniversityBasic(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = build_university_engine()

    # 学生能访问自己的成绩
    def test_student_own_score_allowed(self):
        student = User("s1", "student", "CS", "low")
        own_score = Resource("r1", "score", "CS", "low", "s1")
        env = Environment("workday", "campus", "normal")
        req = Request(student, own_score, env, "read")
        self.assertTrue(self.engine.is_allowed(req))

    # 学生不能访问他人的成绩
    def test_student_other_score_denied(self):
        student = User("s1", "student", "CS", "low")
        other_score = Resource("r2", "score", "CS", "low", "s2")
        env = Environment("workday", "campus", "normal")
        req = Request(student, other_score, env, "read")
        self.assertFalse(self.engine.is_allowed(req))

    # 教师能访问同部门学生的成绩
    def test_teacher_same_dept_student_score_allowed(self):
        teacher = User("t1", "teacher", "CS", "medium")
        stu_score = Resource("r3", "score", "CS", "low", "s2")
        env = Environment("workday", "campus", "normal")
        req = Request(teacher, stu_score, env, "read")
        self.assertTrue(self.engine.is_allowed(req))

    # 教师不能访问其他部门学生的成绩
    def test_teacher_other_dept_score_denied(self):
        teacher = User("t1", "teacher", "CS", "medium")
        stu_score_other_dept = Resource("r4", "score", "Math", "low", "s3")
        env = Environment("workday", "campus", "normal")
        req = Request(teacher, stu_score_other_dept, env, "read")
        self.assertFalse(self.engine.is_allowed(req))

    # 管理员能访问基本所有资源
    def test_admin_all_access(self):
        admin = User("a1", "admin", "CS", "high")
        high_score = Resource("r5", "score", "Math", "high", "s9")
        env = Environment("workday", "campus", "normal")
        req = Request(admin, high_score, env, "read")
        self.assertTrue(self.engine.is_allowed(req))

    # 紧急设备emergency下允许破窗访问所有资源
    def test_emergency_override(self):
        user = User("u1", "student", "CS", "low")
        sensitive_res = Resource("r6", "funds", "Finance", "high", "corp")
        env = Environment("workday", "offcampus", "emergency")
        req = Request(user, sensitive_res, env, "read")
        self.assertTrue(self.engine.is_allowed(req))


if __name__ == "__main__":
    unittest.main()

```

这些示例能直观验证策略的有效性：同一用户在不同环境或资源下的决策结果完全由属性动态决定。

## 零信任思想体现

零信任（Zero Trust）的核心原则是「永不信任，始终验证」（Never Trust, Always Verify）。

传统安全边界模型假设内网是可信的，一旦攻击者突破边界（如通过钓鱼邮件获取 VPN 凭证），即可在内部横向移动。

零信任则彻底抛弃这种假设——无论请求来自内网还是外网，无论用户是员工还是访客，每一次访问都必须经过验证和授权。

这个 ABAC 方案深度融合了零信任理念，在以下几个维度体现得尤为突出：

### 1. 默认拒绝（Default Deny）

> "Implicit deny, explicit permit"

系统默认行为是拒绝访问，只有当策略明确允许时才放行。在本方案中，PolicySet 的 `evaluate()` 方法对任何不匹配策略的请求都返回 `not_applicable`，而引擎的 `is_allowed()` 只有在明确得到 `permit` 时才返回 `True`。这意味着一个新上线的资源默认对所有用户不可见，直到管理员通过策略显式授权。

### 2. 上下文感知（Context-Aware）

时间、位置、设备类型等环境属性直接参与决策，而非仅仅作为辅助信息。例如：

- **时间维度**：「非工作时间不允许访问高敏感资源」防止攻击者在非监控时段（如深夜）批量导出数据
- **位置维度**：「校外不允许访问高敏感资源」即使凭证被盗，攻击者若不在校园网内也无法获取高敏感数据
- **设备维度**：「紧急设备可破窗访问」确保真正的紧急情况下业务不中断，但其他正常策略仍受约束

这些约束叠加起来，极大提高了攻击者的攻击成本。

### 3. 最小权限（Least Privilege）

用户仅获得完成当前任务所需的最低访问权。在本方案中：

- 学生只能看自己的成绩，不能看别人的——即使同班同学也无法互相查看
- 教师只能访问本系学生的成绩，无法跨系「查岗」
- 即使是管理员，在非紧急情况下也需要遵循常规策略——紧急破窗是例外而非常态

### 4. 持续验证（Continuous Verification）

零信任不是「一次验证，长期有效」，而是每次请求都需要重新验证。本方案中，ABAC 引擎本身是无状态的，每次 `evaluate()` 调用都会根据当前请求的完整上下文重新决策。这意味着：

- 用户从校园网切换到校外网络 → 访问高敏感资源被阻断
- 用户在非工作时间尝试访问 → 即使白天已通过验证，也会被拒绝
- 紧急设备标记解除（如临时借用的 emergency 设备归还）→ 权限立即回收

### 5. 深度防御（Defense in Depth）

单一安全措施从来不是万无一失的。零信任倡导多层防御，让攻击者需要突破多道防线才能达成目标。本方案通过策略组合实现深度防御：

```
第一层：身份验证（ Authentication）—— 已由业务系统完成
        ↓
第二层：ABAC 属性检查
  ├── 特殊权限层：管理员/紧急设备
  ├── 安全等级层：用户 clearance ≥ 资源 sensitivity
  ├── 上下文层：时间 + 位置 + 设备
  └── 业务规则层：部门隔离 + 所有权验证
        ↓
第三层：审计日志（可基于 evaluate() 返回值扩展）
```

即使攻击者伪造了身份，只要属性不满足（如不在可信位置、安全等级不足），依然会被拒绝。

## 总结与展望

本文从理论到实践，介绍了一个 ABAC 系统设计方案：

- **NIST 标准对齐**：四维属性模型（主体、客体、环境、动作）符合 NIST SP 800-162 定义
- **模块化架构**：models/policy/engine/university_policies 四层分离，便于维护和扩展
- **15 条业务策略**：覆盖大学场景下的身份认证、部门隔离、时间空间约束、安全等级控制
- **零信任落地**：默认拒绝、上下文感知、最小权限、持续验证、深度防御五大原则贯穿始终

ABAC 并不是要取代 RBAC，而是在 RBAC 难以应对的复杂场景下提供更精细、更灵活的访问控制能力。两者可以共存——用 RBAC 管理粗粒度的角色权限，用 ABAC 处理细粒度的上下文约束，相得益彰。