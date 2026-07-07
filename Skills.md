# MAE (Multi-Asset Execution) Plugin — Common Tasks (Skills)

Quick reference for repetitive Git, build, and deployment operations on this project.

Remote: https://github.com/ashokkumar954/multi-asset-execution-MAE.git

---

## Build

### Build the plugin ZIP
```bash
cd "c:/Project/MAE"
grunt build
```
Output artifacts:
- `build/mae-1.0.0-hosted.zip` — deploy this to FFS Plugins
- `build/hosted/` — exploded hosted build

---

## Git — Commit & Push

### Commit all changes (src + build artifacts)
```bash
git add src/ build/mae-1.0.0-hosted.zip build/mae-1.0.0-sources.zip build/hosted/ build/plugins.xml build/properties.xml
git commit -m "your message here"
git push origin HEAD
```
> Never stage `build/*-sources/` — redundant unpacked copy of `src/`.

### Push current branch
```bash
git push origin HEAD
```

### Push a specific branch
```bash
git push origin <branch-name>
```

---

## Git — Branches

### List all branches
```bash
git branch -a
```

### Create and switch to a new branch
```bash
git checkout -b <new-branch>
```

### Switch to an existing branch
```bash
git checkout <branch-name>
```

### Create a demo/POC branch from a tag
```bash
git checkout -b demo/poc-v2 v1.0-mae-working
```

---

## Git — Tags

### List all tags with details
```bash
git tag -n1 --sort=-creatordate
```

### Create a new tag and push
```bash
git tag v2.0-mae-working
git push origin v2.0-mae-working
```

### Move an existing tag to the current commit
```bash
git tag -f v1.0-mae-working
git push origin v1.0-mae-working --force
```

### Delete a tag locally + from remote
```bash
git tag -d <tag-name>
git push origin :refs/tags/<tag-name>
```

### Show what commit a tag points to
```bash
git rev-list -n1 v1.0-mae-working
```

---

## Git — Status & History

### What's changed (not yet committed)
```bash
git status
git diff
```

### Recent commits
```bash
git log --oneline -10
```

### See all branches and tags
```bash
git log --oneline --decorate --all --graph
```

---

## GitHub (gh CLI)

### Open repo in browser
```bash
gh browse
```

### List open pull requests
```bash
gh pr list
```

### Create a pull request
```bash
gh pr create --base main --head <branch> --title "PR Title" --body "Description"
```

### Create a GitHub release
```bash
gh release create v1.0-mae-working build/mae-1.0.0-hosted.zip --title "v1.0 MAE Working" --notes "Release notes"
```

---

## Deployment

### Deploy to FFS Plugins (Oracle)
1. Run `grunt build`
2. Upload `build/mae-1.0.0-hosted.zip` to Oracle Field Service → Configuration → Plugins
3. Set plugin type: **Hosted**
4. Assign to activity types as needed

### Plugin applications required
| Key | Type | Name in Oracle |
|-----|------|---------------|
| `fusionOAuthUserAssertionApplication` | `oauth_user_assertion` | Concentric - Oracle Fusion Applications - User Asserted |
| `ofsApiApplication` | `ofs` | App CX Service |

---

## Branches & Tags — Current State

| Branch / Tag | Purpose |
|---|---|
| `main` | Primary branch |
| `v1.0-mae-working` | Last known working build |
