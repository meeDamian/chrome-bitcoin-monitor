(function() {
  'use strict';
  var DIVIDER, FIAT, addresses, fetchAddresses, findIntersection, getAmount, getBitcoinAmont, getExchangeRate, labels, notifyNewTx, processTx, setDefaultBadge, setIncomingBadge, setLastTxBadge, setOutcomingBadge, setTitle, wss, wssConnect, wssReconnect, wssSubscribe;

  DIVIDER = 1e8;

  FIAT = true;

  wss = null;

  addresses = [];

  labels = {};

  fetchAddresses = function(cb) {
    return chrome.storage.sync.get(null, function(data) {
      var display, fiat, _ref;
      display = (_ref = data._display) != null ? _ref : 'usd';
      fiat = display === 'usd';
      if (display === 'xbc') {
        DIVIDER = 1e8;
      }
      if (display === 'mxbc') {
        DIVIDER = 1e5;
      }
      if (display === 'uxbc') {
        DIVIDER = 1e2;
      }
      delete data._display;
      labels = data;
      return typeof cb === "function" ? cb(data) : void 0;
    });
  };

  getExchangeRate = function(cb) {
    var request;
    request = new XMLHttpRequest();
    request.open('GET', 'https://www.bitstamp.net/api/ticker/', true);
    request.onload = function() {
      var data;
      if (request.status >= 200 && request.status < 400) {
        data = JSON.parse(request.responseText);
        return cb(parseFloat(data.last));
      }
    };
    request.onerror = function() {};
    return request.send();
  };

  getBitcoinAmont = function(amount, cb) {
    var prefix, rawAmount;
    prefix = '';
    if (DIVIDER === 1e5) {
      prefix = 'm';
    }
    if (DIVIDER === 1e2) {
      prefix = 'μ';
    }
    rawAmount = amount / DIVIDER;
    return cb(prefix + '฿' + rawAmount, rawAmount);
  };

  getAmount = function(amount, cb) {
    var callback;
    callback = function(notif, badge) {
      return cb({
        forNotification: notif,
        forBadge: badge != null ? badge : notif,
        raw: amount
      });
    };
    if (FIAT) {
      return getExchangeRate(function(last) {
        return callback('$' + (amount / 1e8 * last).toFixed(2));
      });
    } else {
      return getBitcoinAmont(amount, callback);
    }
  };

  findIntersection = function(lst) {
    return lst.filter(function(n) {
      return -1 !== addresses.indexOf(n.addr);
    });
  };

  processTx = function(bcTx) {
    var i, o, tmp, tx, _i, _j, _len, _len1, _ref;
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
    tmp = findIntersection(tx.out);
    if (!tx.my.length) {
      tx.my = tmp;
      tx.type = 'in';
    } else {
      for (_i = 0, _len = tmp.length; _i < _len; _i++) {
        o = tmp[_i];
        _ref = tx.my;
        for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
          i = _ref[_j];
          if (o.addr === i.addr) {
            i.value -= o.value;
          }
        }
      }
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

  setTitle = function(amount) {
    return chrome.browserAction.setTitle({
      title: amount
    });
  };

  notifyNewTx = function(tx) {
    var addrLength, addrShort, address, badgeFn, label, whatHappened, where, _ref;
    console.log('msg', tx);
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
      return chrome.notifications.create(tx.hash, {
        type: 'basic',
        priority: 2,
        iconUrl: 'images/icon-128.png',
        title: amount.forNotification + ' have ' + whatHappened,
        message: where + ' your "' + label + '" address',
        contextMessage: addrShort,
        buttons: [
          {
            title: 'See on Blockchain.info',
            iconUrl: 'images/blockchain32.png'
          }
        ]
      }, function() {
        badgeFn(amount.forBadge);
        return getBitcoinAmont(amount.raw, function(btcAmount) {
          return setTitle(btcAmount);
        });
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
    return notifyNewTx(processTx(JSON.parse(ev.data).x));
  };

  wss.onerror = function(e) {
    return console.log('error', e);
  };

  chrome.runtime.onInstalled.addListener(function(details) {
    return console.log('previousVersion', details.previousVersion);
  });

  chrome.notifications.onButtonClicked.addListener(function(id, btnIdx) {
    return window.open('https://blockchain.info/tx/' + id);
  });

  chrome.storage.onChanged.addListener(function(changes) {
    var k, v;
    if (changes._display != null) {
      return;
    }
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
