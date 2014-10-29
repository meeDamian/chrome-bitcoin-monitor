(function() {
  'use strict';
  angular.module('monitorApp', []).controller('ListCtrl', [
    '$scope', function($scope) {
      $scope.addresses = [];
      chrome.storage.sync.get(null, function(data) {
        var a, l;
        for (a in data) {
          l = data[a];
          if (a !== '_display') {
            $scope.addresses.push({
              label: l,
              address: a
            });
          }
        }
        return $scope.$apply();
      });
      $scope.addAddr = function() {
        var a, l, obj;
        a = $scope.address;
        l = $scope.label;
        obj = {};
        obj[a] = l;
        return chrome.storage.sync.set(obj, function() {
          $scope.addresses.push({
            label: l,
            address: a
          });
          $scope.label = '';
          $scope.address = '';
          return $scope.$apply();
        });
      };
      return $scope.remove = function(a) {
        return chrome.storage.sync.remove(a.address, function() {
          var idx;
          idx = $scope.addresses.indexOf(a);
          if (idx > -1) {
            $scope.addresses.splice(idx, 1);
          }
          return $scope.$apply();
        });
      };
    }
  ]).controller('OptsCtrl', [
    '$scope', function($scope) {
      chrome.storage.sync.get('_display', function(data) {
        var _ref;
        $scope.displayOption = (_ref = data._display) != null ? _ref : 'usd';
        return $scope.$apply();
      });
      return $scope.$watch('displayOption', function(value) {
        return chrome.storage.sync.set({
          _display: value
        });
      });
    }
  ]);

}).call(this);
