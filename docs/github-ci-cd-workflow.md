# GitHub CI/CD Workflow

```mermaid
flowchart TD
    Setup["一次性 GitHub 設定<br/>保護 main、設定 release Environment 與 reviewers<br/>Repository-scoped App、Environment credentials、啟用 immutable releases"]

    PR["PR → main"] --> CI["CI：bun test<br/>npm pack --dry-run"]
    CI -->|通過並合併| Push["Push 到 main"]
    Push --> Detect{"package.json.version<br/>有變更？"}

    Detect -->|否| NoRelease["不建立 tag 或 release"]
    Detect -->|是| Preflight["唯讀 preflight<br/>驗證 stable SemVer 與版本遞增<br/>確認 tag / release 尚未使用"]
    Preflight --> Checks["在候選 commit 執行<br/>bun test、npm pack --dry-run"]
    Checks --> Summary["產生 review summary<br/>不建立 tag、不生成 release notes"]
    Summary --> Approval{"release Environment<br/>reviewer 核准？"}

    Approval -->|拒絕| Stop["停止<br/>不建立 tag 或 release"]
    Approval -->|核准| Publish["受保護的 publish job<br/>GITHUB_TOKEN：contents:write"]
    Publish --> Immutable["GitHub App：Administration:read<br/>確認 immutable releases 已啟用"]
    Immutable --> Recheck["重新驗證候選版本<br/>確認 tag / release 未被占用"]
    Recheck -->|驗證失敗| Stop
    Recheck -->|通過| Tag["建立 annotated tag<br/>指向候選 commit SHA"]
    Tag --> Release["產生 GitHub release notes<br/>發布正式 release"]
    Release --> Verify["確認 release 為 immutable<br/>確認 peeled tag SHA 等於候選 SHA"]
    Verify -->|通過| Done["發布完成"]
    Verify -->|失敗| Recover["停止並人工檢查<br/>不得移動、刪除或重用 tag"]
    Tag -->|發布中途失敗| Recover

    Setup -. 前置條件 .-> CI
    Setup -. 前置條件 .-> Approval

    classDef gate fill:#fff4d6,stroke:#b7791f,color:#222;
    classDef safe fill:#e8f5e9,stroke:#388e3c,color:#222;
    classDef stop fill:#fdecea,stroke:#c62828,color:#222;
    class Approval,Immutable gate;
    class NoRelease,Done safe;
    class Stop,Recover stop;
```

## 目前尚待 GitHub owner 設定

- `main` branch protection：要求 PR 與 CI，禁止直接推送。
- `release` Environment：設定 required reviewers 與 self-review prevention。
- Repository-scoped GitHub App：僅授予 `Administration: read`，並在 Environment 設定 App credentials。
- 確認 immutable releases 已啟用。

本機 workflow 與程式尚未推送；GitHub Actions 實際執行與 reviewer gate 尚未驗證。
