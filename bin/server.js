require('babel-polyfill')
const Plugin = require('..').default
const attach = require('@chemzqm/neovim').attach
const logger = require('../lib/util/logger')('server')
let opts = process.argv.indexOf('--stdio') !== -1 ? {reader: process.stdin, writer: process.stdout} : {socket: process.env.NVIM_LISTEN_ADDRESS}
const nvim = attach(opts)

const plugin = new Plugin(nvim)

nvim.on('notification', (method, args) => {
  switch (method) {
    case 'CocResult':
      plugin.cocResult.call(plugin, args)
      return
    case 'VimEnter':
      plugin.onEnter()
      return
    case 'CocAutocmd':
      plugin.cocAutocmd.call(plugin, args).catch(e => {
        logger.error('Autocmd error: ' + e.stack)
      })
      return
    case 'TerminalResult':
      plugin.emitter.emit('terminalResult', args[0])
      return
    case 'JobResult':
      plugin.emitter.emit('JobResult', args[0], args[1])
      return
    default:
      logger.debug('notification', method)
  }
})

nvim.on('request', (method, args, resp) => {
  switch (method) {
    case 'CocAction':
      plugin.cocAction.call(plugin, args).then(res => {
        resp.send(res)
      }, e => {
        logger.error('Action error: ' + e.stack)
        resp.send(null)
      })
      return
    case 'BufWritePre':
      plugin.cocAutocmd.call(plugin, ['BufWritePre', args[0]]).then(() => {
        resp.send(null)
      }, e => {
        logger.error('Action error: ' + e.stack)
        resp.send(null)
      })
      return
    default:
      logger.error('Unknown request' + method)
      resp.send(null)
  }
})

let initialized = false

nvim.channelId.then(channelId => {
  initialized = true
  nvim.setVar('coc_node_channel_id', channelId)
  nvim.getVvar('vim_did_enter').then(entered => {
    if (entered) plugin.onEnter()
  })
})

process.on('uncaughtException', function (err) {
  let msg = '[coc.nvim] uncaught exception: ' + err.stack
  console.error(msg)
  if (!initialized) {
    process.exit(1)
  } else {
    nvim.call('coc#util#echo_messages', ['Error', msg.split('\n')]).catch(() => {
      // noop
    })
  }
  logger.error('uncaughtException', err.stack)
})

process.on('unhandledRejection', function (reason, p) {
  if (reason instanceof Error) {
    console.error('UnhandledRejection: ' + reason.message + '\n' + reason.stack)
  } else {
    console.error('UnhandledRejection: ' + reason)
  }
  logger.error('unhandledRejection ', p, reason)
})
