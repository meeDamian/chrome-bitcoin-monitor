'use strict'

DIVIDER = 1e5
FIAT = false

wss = null
addresses = []
labels = {}

#
# HELPERS
#

fetchAddresses = (cb) ->
  chrome.storage.sync.get null, (data) ->
    labels = data
    cb? data


getAmount = (amount, cb) ->
  prefix = ''
  prefix = 'm' if DIVIDER is 1e5
  prefix = 'μ' if DIVIDER is 1e2

  rawAmount = amount / DIVIDER

  cb
    formatted: prefix + '฿' + rawAmount
    raw: rawAmount

findIntersection = (lst) ->
  lst.filter (n) -> -1 isnt addresses.indexOf n.addr

# change BC-format tx to simplified internal format
processTx = (bcTx) ->
  tx =
    hash: bcTx.hash
    time: bcTx.time
    in: (i.prev_out for i in bcTx.inputs)
    out: bcTx.out

  tx.my = findIntersection tx.in
  tx.type = 'out'

  unless tx.my.length
    tx.my = findIntersection tx.out
    tx.type = 'in'

  tx


#
# BADGE
#

# Show number of tracked addresses, and neutral color
setDefaultBadge = ->
  chrome.browserAction.setBadgeText text: '' + addresses.length
  chrome.browserAction.setBadgeBackgroundColor color: '#5677fc'

# Show last tx amount for 5mins, and change color to indicate direction
setIncomingBadge = (amount) -> setLastTxBadge amount, '#259b24'
setOutcomingBadge = (amount) -> setLastTxBadge amount, '#e51c23'
setLastTxBadge = (amount, color) ->
  chrome.browserAction.setBadgeBackgroundColor color: color
  chrome.browserAction.setBadgeText text: '' + amount

  setTimeout setDefaultBadge, 5 * 60 * 1000


#
# NOTIFICATION
#

# build Chrome notification based on simplified tx
notifyNewTx = (tx) ->
  console.log 'msg', tx

  if tx.type is 'in'
    whatHappened = 'arrived'
    where = 'to'
    badgeFn = setIncomingBadge

  else
    whatHappened = 'been spent'
    where = 'from'
    badgeFn = setOutcomingBadge

  address = tx.my[0].addr
  label = labels[ address ]

  addrLength = address.length
  addrShort = address.substring(0, addrLength / 2 - 3) +
    '…' +
    address.substring addrLength / 2 + 3, addrLength

  getAmount tx.my[0]?.value, (amount) ->

    chrome.notifications.create tx.hash,
      type: 'basic'
      iconUrl: 'images/icon-128.png' # TODO: change this icon

      title: amount.formatted + ' have ' + whatHappened
      message: where + ' your "' + label + '" address'
      contextMessage: addrShort

      buttons: [
        title: 'See on Blockchain.info'
        iconUrl: 'images/blockchain32.png'
      ]

    , ->
      badgeFn amount.raw


#
# SOCKETS STUFF
#

wssConnect = ->
  addresses = []
  wss = new WebSocket 'wss://ws.blockchain.info/inv'

wssReconnect = -> wss.close()

wssSubscribe = (addr) ->
  addresses.push addr
  wss.send JSON.stringify
    op: 'addr_sub'
    addr: addr


wssConnect()
wss.onclose = wssConnect
wss.onopen = ->
  console.log 'open'
  fetchAddresses ->
    wssSubscribe a for a of labels

    setDefaultBadge()

wss.onmessage = (ev) ->
  notifyNewTx processTx JSON.parse(ev.data).x

wss.onerror = (e) ->
  console.log 'error', e
  # TODO: reconnect


#
# LISTENERS
#

# This should probably be gone
chrome.runtime.onInstalled.addListener (details) ->
  console.log 'previousVersion', details.previousVersion

# What to do after notification button is clicked
chrome.notifications.onButtonClicked.addListener (id, btnIdx) ->
  window.open 'https://blockchain.info/tx/' + id

# When list of addresses changes
chrome.storage.onChanged.addListener (changes) ->
  console.log 'changes', changes

  fetchAddresses()

  for k, v of changes
    # WARN: Dat shitze iz broken ;(
    if v.hasOwnProperty 'oldValue'
      wssReconnect()
      break

    if v.hasOwnProperty 'newValue'
      wssSubscribe v

  setDefaultBadge()




