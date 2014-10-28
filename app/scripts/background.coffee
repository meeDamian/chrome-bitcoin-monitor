'use strict'

qqqq = {
  fake: true,
  ports:[],
  data: '{\"op\":\"utx\",\"x\":{\"hash\":\"638458a765d3d0120198df2d4aeda4ff21cec4cf35cab84d32f18ccab7f8bbef\",\"vin_sz\":1,\"vout_sz\":2,\"lock_time\":\"Unavailable\",\"size\":258,\"relayed_by\":\"127.0.0.1\",\"tx_index\":67831480,\"time\":1414515372,\"inputs\":[{\"prev_out\":{\"value\":10590371,\"addr\":\"1LmssUWuFkdkveNnUQEdXfRmCWck5sEwc4\",\"type\":0}}],\"out\":[{\"value\":281698,\"addr\":\"1DamianM2k8WfNEeJmyqSe2YW1upB7UATx\",\"type\":0},{\"value\":10298673,\"addr\":\"1LmssUWuFkdkveNnUQEdXfRmCWck5sEwc4\",\"type\":0}]}}',
  source:null,
  lastEventId:'',
  origin:'wss://ws.blockchain.info',
  path:{
    length:0
  },
  'cancelBubble':false,
  'returnValue':true,
  'srcElement':{
    'binaryType':'blob',
    'protocol':'',
    'extensions':'permessage-deflate;client_max_window_bits=15',
    'bufferedAmount':0,
    'readyState':1,
    'url':'wss://ws.blockchain.info/inv',
    'URL':'wss://ws.blockchain.info/inv'
  },
  'defaultPrevented':false,
  'timeStamp':1414515373275,
  'cancelable':false,
  'bubbles':false,
  'eventPhase':2,
  'currentTarget':{
    'binaryType':'blob',
    'protocol':'',
    'extensions':'permessage-deflate;client_max_window_bits=15',
    'bufferedAmount':0,
    'readyState':1,
    'url':'wss://ws.blockchain.info/inv',
    'URL':'wss://ws.blockchain.info/inv'
  },
  'target':{
    'binaryType':'blob',
    'protocol':'',
    'extensions':'permessage-deflate;client_max_window_bits=15',
    'bufferedAmount':0,
    'readyState':1,
    'url':'wss://ws.blockchain.info/inv',
    'URL':'wss://ws.blockchain.info/inv'
  },
  'type':'message'
};



DIVIDER = 1e5
FIAT = false

wss = null
addresses = []
labels = {}


#
# FAKERS
#
callFake = -> wss.onmessage qqqq
sendFakeMsgs = ->
  setTimeout callFake, 1000
  setInterval callFake, 30000


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
notifyNewTx = (tx, isFake=no) ->
  console.log 'msg' + (if isFake then '(fake)' else ''), tx

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

    chrome.notifications.create (if isFake then '' else tx.hash),
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
  notifyNewTx processTx(JSON.parse(ev.data).x), !!ev.fake

wss.onerror = (e) ->
  console.log 'error', e
  # TODO: reconnect


sendFakeMsgs()


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




