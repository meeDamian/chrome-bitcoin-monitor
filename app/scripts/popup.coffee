'use strict'

angular.module 'monitorApp', []
.controller 'QuickAddCtrl', ['$scope', ($scope) ->

  $scope.addAddr = ->
    a = $scope.address
    d = new Date()
    l = 'Added ' + [
      d.getFullYear()
      d.getMonth()
      d.getDay()
    ].join '-'

    obj = {}
    obj[a] = l

    chrome.storage.sync.set obj, ->
      $scope.address = ''
      $scope.$apply()
]
