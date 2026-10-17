import { hooks } from 'nio:plugin-api'

hooks.beforeCreate(async (ctx) => {
  await ctx.update({ headers: [{ name: 'X-Enrich', value: '1' }] })
})
