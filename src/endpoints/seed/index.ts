// TODO: Replace with e-commerce seed data in Phase 2

export const seed = {
  route: '/seed' as const,
  method: 'post' as const,
  handler: async () => {
    return new Response(JSON.stringify({ message: 'Seed stub — replace in Phase 2' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  },
}
