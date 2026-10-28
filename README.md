# dsh-memory-gui

DSH 插件：记忆库与图书馆的浏览页。

- **记忆**：直接读 fish-memory 的每会话存储（`session-*.json`），服务端搜索/筛选，
  按时间或重要度排序，可选会话。
- **图书馆**：复用 `dsh-pin` 的图书馆接口，能增、能删。

## 安装

```sh
plugin_manager install_bundle <本目录>
```

或放进 profile 的 `cordis.patch.yml`：

```yaml
- insert:
    - id: memory-gui
      name: dsh-memory-gui
```

## 页面

装好后访问 `<DSH 地址>/dsh-memory-gui`。

## 接口

- `GET /dsh-memory-gui/api/sessions`
- `GET /dsh-memory-gui/api/memory?q=&session=&sort=recency|importance&limit=200`

## 依赖

- 记忆浏览依赖 `dsh-fish-memory` 的数据目录（`~/.dsh/fish-memory/`）
- 图书馆依赖 `dsh-pin`（同源调用 `/dsh-pin/lib/*`）

## 许可

MIT
