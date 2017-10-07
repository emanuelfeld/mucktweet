(function () {
  'use strict'

  let DEBUG = true

  if (window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  let userData = {}
  let tweetData = {}

  function getUserData (node) {
    return {
      'id': node.getAttribute('data-user-id'),
      'screenName': node.getAttribute('data-screen-name'),
      'name': node.getAttribute('data-name'),
      'status': 'suspended',
      'reportCount': 1,
      'reportDate': Date.now(),
      'hasUpdate': 1,
      'updateDate': null
    }
  }

  function getTweetData (node) {
    return {
      'id': node.getAttribute('data-tweet-id'),
      'userId': node.getAttribute('data-user-id'),
      'permalinkPath': node.getAttribute('data-permalink-path'),
      'status': 'available',
      'postDate': parseInt(node.querySelector('.js-relative-timestamp').getAttribute('data-time-ms')),
      'reportDate': Date.now(),
      'hasUpdate': 0,
      'updateDate': null
    }
  }

  function beganReport (node, reportType) {
    let reportActive = document.getElementById('report-dialog') !== null &&
      document.getElementById('report-dialog')
        .style.display !== 'none' &&
      document.getElementById('report-dialog')
        .classList.contains('report-' + reportType)
    if (reportActive &&
        document.getElementById('report-dialog')
          .contains(node) &&
        document.getElementById('report-dialog')
          .querySelector('.modal-content')
          .contains(node) === false) {
      return false
    }
    return reportActive
  }

  function submittedReport (node) {
    return node.classList.contains('new-report-flow-done-button')
  }

  function hasReportData () {
    return userData !== {} || tweetData !== {}
  }

  document.onclick = function (evt) {
    if (beganReport(evt.srcElement, 'user')) {
      const node = document.querySelector('.user-actions')
      userData = getUserData(node)
      console.log('Reporting user: ' + JSON.stringify(userData))
    } else if (beganReport(evt.srcElement, 'tweet')) {
      const node = evt.srcElement.closest('.tweet')
      userData = getUserData(node)
      console.log('Reporting user: ' + JSON.stringify(userData))
      tweetData = getTweetData(node)
      console.log('Reporting tweet: ' + JSON.stringify(tweetData))
    } else if ((DEBUG && hasReportData()) || submittedReport(evt.srcElement)) {
      console.log('Submitting report.')
      window.browser.runtime.sendMessage({
        'type': 'report',
        'content': {
          'userData': userData,
          'tweetData': tweetData
        }
      })
    }
  }
})()
