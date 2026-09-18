# M2 插件分发验收夹具

此目录只用于本地开发和自动化测试，私钥不是生产密钥，也不得用于发布正式插件。

运行 `pnpm fixtures:m2` 会生成两个签名的 `.devbox-plugin` 包和本地 Catalog：

- `generated/devbox.fixture-1.0.0.devbox-plugin`
- `generated/devbox.fixture-1.1.0.devbox-plugin`
- `generated/catalog.json`

可以在此目录启动静态 HTTP 服务，再通过插件中心验证在线安装、更新、失败回退和离线安装。

```sh
cd fixtures/m2/generated
python3 -m http.server 4174 --bind 127.0.0.1
```

开发版 DevBox 中的 Catalog 地址为 `http://127.0.0.1:4174/catalog.json`。生产版只接受配置的官方 HTTPS origin。
