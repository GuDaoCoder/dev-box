# M2 插件分发验收夹具

此目录只用于本地开发和自动化测试，私钥不是生产密钥，也不得用于发布正式插件。

运行 `pnpm fixtures:m2` 会生成两个签名的本地 ZIP 验收包：

- `generated/devbox.fixture-1.0.0.zip`
- `generated/devbox.fixture-1.1.0.zip`

在 DevBox 的“添加 ZIP 插件”页面分别选择两个文件，即可验证安装、更新和回退。平台不再提供在线 Catalog。
