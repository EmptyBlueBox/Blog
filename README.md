# Yutong's Site

Personal website and bilingual blog built with Astro and deployed on Vercel.

Visit [www.lyt0112.com](https://www.lyt0112.com/).

## Requirements

- Node.js 22.12.0 or newer
- Bun 1.2.0 or newer

## Local development

```shell
git clone git@github.com:EmptyBlueBox/Blog.git
cd Blog
bun install --frozen-lockfile
bun run dev
```

Run all repository checks with:

```shell
bun run verify
```

The command checks ESLint, Prettier, Astro types, and the production build. Use `bun run fix` to apply ESLint and Prettier changes.

## Media uploads

Media is mirrored to Alibaba OSS and Amazon S3. DNSPod routes mainland China to Alibaba CDN and other regions to CloudFront.

Install AWS CLI 2.32.0 or newer. Configure `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`, `S3_BUCKET`, and `AWS_PROFILE` in `.env.cdn`.

```shell
aws login --profile blog-cdn --region us-west-2
bun run cdn:upload --file /path/to/video.mp4 --id projects/name/videos/demo.mp4
```

The uploader verifies both copies before updating the manifest. New asset URLs work without a website deployment; updated page references require deployment.
