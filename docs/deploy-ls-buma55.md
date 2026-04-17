# `ls.buma55.com` Deployment Notes

## What This Workflow Does

The repository includes `.github/workflows/deploy-ls-site.yml`.

On push to `main` or on manual trigger, GitHub Actions will:

1. install `apps/mobile-taro` dependencies
2. build the H5 bundle
3. write `ls.buma55.com` into `dist/CNAME`
4. deploy `apps/mobile-taro/dist` to GitHub Pages

## Required GitHub Setup

Before the deployed site can call the real backend, set this repository variable:

- `API_BASE_URL`

Example:

- `https://api.buma55.com`
- or another production API domain that serves the existing FastAPI backend

If this variable is not set, the production build falls back to `https://api.your-domain.com`, which is only a placeholder.

## Required DNS Setup For `ls.buma55.com`

After GitHub Pages is enabled for the repo, add a DNS record for:

- host: `ls`
- type: `CNAME`
- target: `<github-pages-target>`

The exact GitHub Pages target depends on the Pages configuration shown in the repo settings after the first deployment.

In GitHub:

1. Open repo `Settings`
2. Open `Pages`
3. Confirm deployment source is `GitHub Actions`
4. Add custom domain `ls.buma55.com`
5. Copy the recommended DNS target from the Pages panel

Then in the DNS provider for `buma55.com`:

1. Add the `CNAME` record for `ls`
2. Wait for DNS propagation
3. Re-check the Pages panel until certificate/HTTPS is issued

## Important Blocker

The frontend can be deployed independently, but login, SMS, report generation, and order APIs still require a real backend endpoint.

That means `ls.buma55.com` alone is not enough. We also need one of:

- an existing production API domain
- or a new backend deployment plan for `apps/api`
