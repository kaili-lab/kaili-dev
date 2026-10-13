import console from 'node:console'
import { checkFonts } from './check-fonts-lib.mjs'

console.log(JSON.stringify(await checkFonts(), null, 2))
