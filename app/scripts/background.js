(function() {
  'use strict';
  var DIVIDER, FIAT, addresses, fetchAddresses, findIntersection, getAmount, getBitcoinAmont, getExchangeRate, labels, notifyNewTx, processTx, setDefaultBadge, setIncomingBadge, setLastTxBadge, setOutcomingBadge, setTitle, wss, wssConnect, wssReconnect, wssSubscribe;

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
