import { cdnImage } from '@/data/cdn'
import { links } from '@/data/links'

export const GET = () =>
  new Response(
    JSON.stringify({
      ...links,
      friends: links.friends.map((group) => ({
        ...group,
        link_list: group.link_list.map((frd) => ({
          ...frd,
          avatar: frd.avatar ? cdnImage(frd.avatar).src : undefined
        }))
      }))
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  )
