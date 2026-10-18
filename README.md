# test-lighthouse-theme

Shopify theme for `test-lighthouse-heattaoe.myshopify.com`.

Deploys only go one way: **GitHub → Actions → Shopify**. The Shopify GitHub integration is deliberately **not** connected, because it auto-commits customizer edits and causes merge conflicts.

## Branches and themes

| Branch    | Shopify theme | Theme ID     |
|-----------|---------------|--------------|
| `main`    | Live          | 189554491613 |
| `staging` | Staging       | 189554917597 |
| `dev`     | Dev           | 189554884829 |

Flow: `feature/*` → PR into `dev` → PR into `staging` → PR into `main`.

Every push to one of these branches runs `.github/workflows/deploy-theme.yml`, which:
1. runs `npm run build` (Shopify Theme Check, fails on errors)
2. runs `shopify theme push --nodelete` to the mapped theme

**Live (`main`) deploys skip customizer-owned files** (`config/settings_data.json`, `templates/*.json`, `sections/*.json`, `locales/*.json`) so changes made in the theme editor aren't overwritten. To bring those changes back into git, run `npm run pull:live` on a branch and open a PR.

## Local development

```sh
npm install           # also installs the husky hooks
npm run dev           # shopify theme dev (uses a personal development theme)
npm run build         # Theme Check
```

Husky hooks:
- `pre-commit`: runs `npm run build`
- `pre-push`: blocks direct pushes to `main` and `staging` (override with `ALLOW_PROTECTED_PUSH=1 git push`)

## One-time setup

1. In the Shopify admin, install the **Theme Access** app and create a password.
2. In GitHub, go to Settings → Secrets and variables → Actions and add:
   - `SHOPIFY_CLI_THEME_TOKEN`: the Theme Access password
   - `SHOPIFY_FLAG_STORE`: `test-lighthouse-heattaoe.myshopify.com`
3. (Recommended) Add branch protection on `main` and `staging` that requires a PR and a passing **Theme Check** run.
