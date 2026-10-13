import { createMiddleware } from '@tanstack/react-start'

export const developmentOnly = createMiddleware().server(async ({ next }) => {
  if (import.meta.env.PROD) {
    throw new Response('Not Found', { status: 404 })
  }

  return next()
})
