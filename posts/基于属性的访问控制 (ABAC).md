---
title: 基于属性的访问控制（ABAC）
date: 2025-12-12
categories: 系统安全
toc: true
---

基于属性的访问控制（Attribute-Based Access Control, ABAC）与传统基于角色的访问控制（RBAC）不同，ABAC 通过主体、客体、环境和动作等多维度属性的动态组合来做出访问决策，灵活性更强，控制粒度也更细。在多角色、多部门、数据敏感度差异大的复杂业务环境中，ABAC 能很好地应对跨部门访问、上下文感知安全和最小权限原则等挑战。

本文将介绍一个完整的 ABAC 系统设计方案，涵盖核心架构、策略建模、引擎实现，以及针对大学业务场景的策略集，并结合实际使用示例和零信任思想展开讨论。

<!--more-->

## ABAC 理论基础

ABAC 的核心思想来自 NIST 等标准组织的访问控制框架，决策不再只看静态角色，而是实时评估四类属性：

- **主体属性**（Subject Attributes）：用户的角色、部门、安全等级等。
- **客体属性**（Object Attributes）：资源的类型、所属部门、敏感度、所有者等。
- **环境属性**（Environment Attributes）：访问时间、位置、设备类型等上下文信息。
- **动作属性**（Action）：读、写、修改等具体操作。

相比 RBAC 的角色-权限静态映射，属性驱动的决策有几个明显优势：
- 动态性：支持实时上下文感知（如非工作时间或校外访问限制）。
- 细粒度：可实现学生仅能查看本人成绩、教师仅限同部门文件等精确控制。
- 扩展性：易于融入零信任架构，默认拒绝所有未显式授权的访问。

在大学这种场景下，学生、教师、管理员角色交织，成绩、经费、文件等资源的敏感度各不相同，还要考虑工作时间、校园位置等环境约束。传统 RBAC 很难处理这么多交叉条件，而 ABAC 通过策略组合算法（如拒绝优先、允许优先）能灵活解决冲突和优先级问题。

## 核心架构设计

ABAC 系统采用模块化设计，四个核心模块构成了完整的实现：

```
ABAC System
├── models.py          # 核心数据模型
├── policy.py          # 策略定义与组合
├── engine.py          # 策略评估引擎
└── university_policies.py  # 大学业务策略集
```

分层架构把模型和策略解耦，方便后续扩展和维护。

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

这里，role 用来区分身份，department 实现部门隔离，clearance_level 和 sensitivity_level 构成多级安全控制，time_of_access、location、device_type 提供上下文信息，支持零信任场景下的动态决策，attributes 字段则预留了扩展空间，方便未来添加自定义属性。

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

Policy 类把条件和决策效果解耦，方便策略独立编写和复用。PolicySet 实现了三种经典组合算法：拒绝优先（deny_overrides）、允许优先（permit_overrides）和首次匹配（first_applicable），确保策略冲突时能按预期行为决策。

### 策略评估引擎

engine.py 是对外接口，持有根策略集并提供简洁的评估方法：

```python
from .models import Request
from .policy import PolicySet, Effect

class ABACEngine:
    """简单的 ABAC 引擎：持有一个根 PolicySet，对外提供 evaluate / is_allowed。"""
    def __init__(self, root_policy_set: PolicySet) -> None:
        self.root_policy_set = root_policy_set

    def evaluate(self, request: Request) -> Effect:
        return self.root_policy_set.evaluate(request)

    def is_allowed(self, request: Request) -> bool:
        return self.evaluate(request) == "permit"
```

ABACEngine 完全封装了策略评估逻辑，对上层业务代码暴露两个核心接口：evaluate() 返回详细决策结果，is_allowed() 直接返回布尔值，方便在实际系统中快速集成。



## 大学业务策略实现

大学业务策略集是整个方案的核心，采用特殊权限→禁止规则→允许规则的分层设计，确保安全优先。一共定义了15条策略，覆盖管理员全权、学生成绩隔离、教师部门限制、时间/位置/设备约束等场景。

策略设计思路结合 ABAC 理论：先处理管理员和紧急破窗机制，再通过拒绝策略严格限制越权行为，最后补充允许策略实现最小权限的业务访问。

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
        combining_alg="permit_overrides",
    )
    return ABACEngine(policy_set)
```

这15条策略可以分成三类：

- 特殊权限类，包含管理员全权和紧急破窗机制，保障特殊场景下的灵活性；
- 禁止类，严格阻止越权行为，比如学生看他人成绩、教师跨部门访问、非工作时间访问高敏资源等；
- 允许类，实现最小权限下的正常业务访问。

这种"先拒绝后允许"的设计思路确保了安全优先，同时允许优先的组合算法让允许策略在无冲突时快速生效。



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

这个方案深度融合了零信任理念：

- 默认拒绝，未被任何允许策略显式允许的访问都会被拒绝；
- 上下文感知，时间、位置、设备类型等环境属性直接参与决策；
- 最小权限，用户仅获得完成当前任务所需的最低访问权；
- 持续验证，支持紧急破窗机制，但仍受其他拒绝策略约束。