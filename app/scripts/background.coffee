'use strict'

DIVIDER = 1e8
FIAT = true

wss = null
addresses = []
labels = {}

#
# HELPERS
#

fetchAddresses = (cb) ->
  chrome.storage.sync.get null, (data) ->
    display = data._display ? 'usd'

    fiat = display is 'usd'

    DIVIDER = 1e8 if display is 'xbc'
    DIVIDER = 1e5 if display is 'mxbc'
    DIVIDER = 1e2 if display is 'uxbc'

    delete data._display

    labels = data
    cb? data


getExchangeRate = (cb) ->
  request = new XMLHttpRequest();
  request.open 'GET', 'https://www.bitstamp.net/api/ticker/', true

  request.onload = ->
    if request.status >= 200 and request.status < 400

      data = JSON.parse request.responseText
      cb parseFloat data.last

  request.onerror = ->

  request.send();

getBitcoinAmont = (amount, cb) ->
  prefix = ''
  prefix = 'm' if DIVIDER is 1e5
  prefix = 'μ' if DIVIDER is 1e2

  rawAmount = amount / DIVIDER

  cb prefix + '฿' + rawAmount, rawAmount

getAmount = (amount, cb) ->
  callback = (notif, badge) ->
    cb
      forNotification: notif
      forBadge: badge ? notif
      raw: amount

  if FIAT
    getExchangeRate (last) ->
      callback '$' + (amount / 1e8 * last).toFixed 2

  else getBitcoinAmont amount, callback

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

  tmp = findIntersection tx.out

  # outgoing tx
  unless tx.my.length
    tx.my = tmp
    tx.type = 'in'

  # remove 'rest' (if calculable)
  else
    # Yes, I do know this part is ugly
    for o in tmp
      i.value -= o.value for i in tx.my when o.addr is i.addr

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


setTitle = (amount) ->
  chrome.browserAction.setTitle title: amount


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

      title: amount.forNotification + ' have ' + whatHappened
      message: where + ' your "' + label + '" address'
      contextMessage: addrShort

      buttons: [
        title: 'See on Blockchain.info'
        iconUrl: 'images/blockchain32.png'
      ]

    , ->
      badgeFn amount.forBadge

      getBitcoinAmont amount.raw, (btcAmount) ->
        setTitle btcAmount


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
  return if changes._display?

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




