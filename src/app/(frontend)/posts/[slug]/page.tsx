// TODO: Remove in Phase 2 — posts collection no longer exists
import { notFound } from 'next/navigation'

export default function PostPage() {
  notFound()
}

export async function generateStaticParams() {
  return []
}
