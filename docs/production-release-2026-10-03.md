# Production release checkpoint — 2026-10-03

This is a documentation-only production deployment trigger. No application behavior is changed in this commit.

## Release source
- Repository: skrwl24-ux/content-maker
- Verified previous main: `bf9eb8ae19ccee75a64e927b58abfdf3e04c83a8`
- Pending merged changes: #42 apartment data-health, #43 shared-parcel identity fix, #44 article image-plan sync, #45 Blogger parser and publishing validation
- PR #45 GitHub Actions (Verify apartment data changes) passed for its head commit; workflow runs `npm install` and `npm run build`.

## Live deployment validation
1. Confirm the production alias `content-maker-chi.vercel.app` uses this release commit (or a later descendant), rather than `f1e3be65`.
2. Confirm `/apartment-bulk/data-health` returns a working page, not 404.
3. Check `/google-blog-schedule`: malformed article markers block copy/publish; valid article fields stay separate; all six image slots must be linked before final copy.
4. Check daily article image prompts: three source tables produce five image slots (00, 01, 01-2, 01-3, 02); zero-table flow stays at three.

If Vercel still reports `build-rate-limit` on Hobby, do not generate repeated commits to retry. Use Vercel Redeploy for the current main release once the deployment allowance is available and verify the alias.
