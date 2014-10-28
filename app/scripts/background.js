(function() {
  'use strict';
  var DIVIDER, FIAT, addresses, callFake, fetchAddresses, findIntersection, getAmount, labels, notifyNewTx, processTx, qqqq, sendFakeMsgs, setDefaultBadge, setIncomingBadge, setLastTxBadge, setOutcomingBadge, wss, wssConnect, wssReconnect, wssSubscribe;

  qqqq = {
    fake: true,
    ports: [],
    data: '{\"op\":\"utx\",\"x\":{\"hash\":\"638458a765d3d0120198df2d4aeda4ff21cec4cf35cab84d32f18ccab7f8bbef\",\"vin_sz\":1,\"vout_sz\":2,\"lock_time\":\"Unavailable\",\"size\":258,\"relayed_by\":\"127.0.0.1\",\"tx_index\":67831480,\"time\":1414515372,\"inputs\":[{\"prev_out\":{\"value\":10590371,\"addr\":\"1LmssUWuFkdkveNnUQEdXfRmCWck5sEwc4\",\"type\":0}}],\"out\":[{\"value\":281698,\"addr\":\"1DamianM2k8WfNEeJmyqSe2YW1upB7UATx\",\"type\":0},{\"value\":10298673,\"addr\":\"1LmssUWuFkdkveNnUQEdXfRmCWck5sEwc4\",\"type\":0}]}}',
    source: null,
    lastEventId: '',
    origin: 'wss://ws.blockchain.info',
    path: {
      length: 0
    },
    'cancelBubble': false,
    'returnValue': true,
    'srcElement': {
      'binaryType': 'blob',
      'protocol': '',
      'extensions': 'permessage-deflate;client_max_window_bits=15',
      'bufferedAmount': 0,
      'readyState': 1,
      'url': 'wss://ws.blockchain.info/inv',
      'URL': 'wss://ws.blockchain.info/inv'
    },
    'defaultPrevented': false,
    'timeStamp': 1414515373275,
    'cancelable': false,
    'bubbles': false,
    'eventPhase': 2,
    'currentTarget': {
      'binaryType': 'blob',
      'protocol': '',
      'extensions': 'permessage-deflate;client_max_window_bits=15',
      'bufferedAmount': 0,
      'readyState': 1,
      'url': 'wss://ws.blockchain.info/inv',
      'URL': 'wss://ws.blockchain.info/inv'
    },
    'target': {
      'binaryType': 'blob',
      'protocol': '',
      'extensions': 'permessage-deflate;client_max_window_bits=15',
      'bufferedAmount': 0,
      'readyState': 1,
      'url': 'wss://ws.blockchain.info/inv',
      'URL': 'wss://ws.blockchain.info/inv'
    },
    'type': 'message'
  };

  DIVIDER = 1e5;

  FIAT = false;

  wss = null;

  addresses = [];

  labels = {};

  callFake = function() {
    return wss.onmessage(qqqq);
  };

  sendFakeMsgs = function() {
    setTimeout(callFake, 1000);
    return setInterval(callFake, 30000);
  };

  fetchAddresses = function(cb) {
    return chrome.storage.sync.get(null, function(data) {
      labels = data;
      return typeof cb === "function" ? cb(data) : void 0;
    });
  };

  getAmount = function(amount, cb) {
    var prefix, rawAmount;
    prefix = '';
    if (DIVIDER === 1e5) {
      prefix = 'm';
    }
    if (DIVIDER === 1e2) {
      prefix = 'μ';
    }
    rawAmount = amount / DIVIDER;
    return cb({
      formatted: prefix + '฿' + rawAmount,
      raw: rawAmount
    });
  };

  findIntersection = function(lst) {
    return lst.filter(function(n) {
      return -1 !== addresses.indexOf(n.addr);
    });
  };

  processTx = function(bcTx) {
    var i, tx;
    tx = {
      hash: bcTx.hash,
      time: bcTx.time,
      "in": (function() {
        var _i, _len, _ref, _results;
        _ref = bcTx.inputs;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          i = _ref[_i];
          _results.push(i.prev_out);
        }
        return _results;
      })(),
      out: bcTx.out
    };
    tx.my = findIntersection(tx["in"]);
    tx.type = 'out';
    if (!tx.my.length) {
      tx.my = findIntersection(tx.out);
      tx.type = 'in';
    }
    return tx;
  };

  setDefaultBadge = function() {
    chrome.browserAction.setBadgeText({
      text: '' + addresses.length
    });
    return chrome.browserAction.setBadgeBackgroundColor({
      color: '#5677fc'
    });
  };

  setIncomingBadge = function(amount) {
    return setLastTxBadge(amount, '#259b24');
  };

  setOutcomingBadge = function(amount) {
    return setLastTxBadge(amount, '#e51c23');
  };

  setLastTxBadge = function(amount, color) {
    chrome.browserAction.setBadgeBackgroundColor({
      color: color
    });
    chrome.browserAction.setBadgeText({
      text: '' + amount
    });
    return setTimeout(setDefaultBadge, 5 * 60 * 1000);
  };

  notifyNewTx = function(tx, isFake) {
    var addrLength, addrShort, address, badgeFn, label, whatHappened, where, _ref;
    if (isFake == null) {
      isFake = false;
    }
    console.log('msg' + (isFake ? '(fake)' : ''), tx);
    if (tx.type === 'in') {
      whatHappened = 'arrived';
      where = 'to';
      badgeFn = setIncomingBadge;
    } else {
      whatHappened = 'been spent';
      where = 'from';
      badgeFn = setOutcomingBadge;
    }
    address = tx.my[0].addr;
    label = labels[address];
    addrLength = address.length;
    addrShort = address.substring(0, addrLength / 2 - 3) + '…' + address.substring(addrLength / 2 + 3, addrLength);
    return getAmount((_ref = tx.my[0]) != null ? _ref.value : void 0, function(amount) {
      return chrome.notifications.create((isFake ? '' : tx.hash), {
        type: 'basic',
        iconUrl: 'images/icon-128.png',
        title: amount.formatted + ' have ' + whatHappened,
        message: where + ' your "' + label + '" address',
        contextMessage: addrShort,
        buttons: [
          {
            title: 'See on Blockchain.info',
            iconUrl: 'images/blockchain32.png'
          }
        ]
      }, function() {
        return badgeFn(amount.raw);
      });
    });
  };

  wssConnect = function() {
    addresses = [];
    return wss = new WebSocket('wss://ws.blockchain.info/inv');
  };

  wssReconnect = function() {
    return wss.close();
  };

  wssSubscribe = function(addr) {
    addresses.push(addr);
    return wss.send(JSON.stringify({
      op: 'addr_sub',
      addr: addr
    }));
  };

  wssConnect();

  wss.onclose = wssConnect;

  wss.onopen = function() {
    console.log('open');
    return fetchAddresses(function() {
      var a;
      for (a in labels) {
        wssSubscribe(a);
      }
      return setDefaultBadge();
    });
  };

  wss.onmessage = function(ev) {
    return notifyNewTx(processTx(JSON.parse(ev.data).x), !!ev.fake);
  };

  wss.onerror = function(e) {
    return console.log('error', e);
  };

  sendFakeMsgs();

  chrome.runtime.onInstalled.addListener(function(details) {
    return console.log('previousVersion', details.previousVersion);
  });

  chrome.notifications.onButtonClicked.addListener(function(id, btnIdx) {
    return window.open('https://blockchain.info/tx/' + id);
  });

  chrome.storage.onChanged.addListener(function(changes) {
    var k, v;
    console.log('changes', changes);
    fetchAddresses();
    for (k in changes) {
      v = changes[k];
      if (v.hasOwnProperty('oldValue')) {
        wssReconnect();
        break;
      }
      if (v.hasOwnProperty('newValue')) {
        wssSubscribe(v);
      }
    }
    return setDefaultBadge();
  });

}).call(this);
