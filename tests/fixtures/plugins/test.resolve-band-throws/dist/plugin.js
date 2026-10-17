import { hooks } from 'nio:plugin-api'

hooks.beforeCreate(async () => {
  throw new Error('resolve boom')
})
