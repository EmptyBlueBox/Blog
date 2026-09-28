import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { cacheControl } from './common.mjs'

const exec = promisify(execFile)
const s3 = async (command, input, args = []) => {
  const { stdout } = await exec('aws', [
    's3api',
    command,
    '--cli-input-json',
    JSON.stringify(input),
    '--output',
    'json',
    '--no-cli-pager',
    ...args
  ])
  return JSON.parse(stdout)
}

export const mirror = async (asset, file) => {
  const object = { Bucket: process.env.S3_BUCKET, Key: asset.path }
  const metadata = {
    ContentType: asset.type,
    CacheControl: cacheControl,
    ContentLength: asset.storedBytes,
    ChecksumSHA256: Buffer.from(asset.storedSha256, 'hex').toString('base64'),
    ...(asset.encoding ? { ContentEncoding: asset.encoding } : {})
  }
  const uploaded = await s3('put-object', { ...object, ...metadata }, ['--body', file])
  assert.equal(uploaded.ChecksumSHA256, metadata.ChecksumSHA256)
  const stored = await s3('head-object', { ...object, ChecksumMode: 'ENABLED' })
  for (const [key, value] of Object.entries(metadata)) assert.equal(stored[key], value)
}
