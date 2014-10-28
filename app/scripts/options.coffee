'use strict'

angular.module 'monitorApp', []
.controller 'ListCtrl', [ '$scope', ($scope) ->

  $scope.addresses = []

  chrome.storage.sync.get null, (data) ->
    for a, l of data
      $scope.addresses.push
        label: l
        address: a

    $scope.$apply()

  $scope.addAddr = ->
    a = $scope.address
    l = $scope.label

    obj = {}
    obj[a] = l
    chrome.storage.sync.set obj, ->
      $scope.addresses.push
        label: l
        address: a

      $scope.label = ''
      $scope.address = ''

      $scope.$apply()

  $scope.remove = (a) ->
    chrome.storage.sync.remove a.address, ->
      idx = $scope.addresses.indexOf a
      if idx > -1
        $scope.addresses.splice idx, 1

      $scope.$apply()

]


