import { links } from '@/data/links'

export const prerender = true

export const GET = () =>
  new Response(
    JSON.stringify({
      ...links,
      friends: links.friends.map((group) => ({
        ...group,
        link_list: group.link_list.map((frd) => ({
          ...frd,
          avatar: typeof frd.avatar === 'string' ? frd.avatar : frd.avatar.src
        }))
      }))
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  )

