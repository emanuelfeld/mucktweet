(function () {
  'use strict'

  const DEBUG = true

  if (!!window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  let userData = {}
  let tweetData = {}

  function getUserData (node) {
    console.log('Parsing user data.')
    return {
      'id': node.getAttribute('data-user-id'),
      'screenName': node.getAttribute('data-screen-name'),
      'name': node.getAttribute('data-name'),
      'status': 'suspended',
      'reportCount': 1,
      'reportDate': Date.now(),
      'hasUpdate': 0,
      'updateDate': null
    }
  }

  function getTweetData (node) {
    console.log('Parsing tweet data.')
    return {
      'id': node.getAttribute('data-tweet-id'),
      'userId': node.getAttribute('data-user-id'),
      'permalinkPath': node.getAttribute('data-permalink-path'),
      'status': 'deleted',
      'postDate': parseInt(node.querySelector('._timestamp').getAttribute('data-time-ms')),
      'reportDate': Date.now(),
      'hasUpdate': 0,
      'updateDate': null
    }
  }

  function beganReport (node, reportType) {
    const reportActive = document.getElementById('report-dialog') !== null &&
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
    if ((document.getElementById('report-dialog') &&
         document.getElementById('report-dialog').style.display === 'block') === false) {
      return false
    }

    return node.classList.contains('add-text') ||
           node.classList.contains('tweet-number') ||
           node.classList.contains('new-report-flow-done-button')
  }

  function hasReportData () {
    return Object.keys(userData).length > 0 ||
           Object.keys(tweetData).length > 0
  }

  document.onclick = function (evt) {
    console.log('Clicked', evt.srcElement)
    if ((DEBUG && hasReportData()) || submittedReport(evt.srcElement)) {
      console.log('Submitting report.')
      console.log('Submitting user report: ' + JSON.stringify(userData))
      console.log('Submitting tweet report: ' + JSON.stringify(tweetData))
      window.browser.runtime.sendMessage({
        'type': 'report',
        'content': {
          'userData': userData,
          'tweetData': tweetData
        }
      }, function (res) {
        userData = {}
        tweetData = {}
      })
    } else if (beganReport(evt.srcElement, 'user')) {
      const node = document.querySelector('.user-actions')
      userData = getUserData(node)
      console.log('Beginning user report: ' + JSON.stringify(userData))
    } else if (beganReport(evt.srcElement, 'tweet')) {
      const node = evt.srcElement.closest('.tweet')
      userData = getUserData(node)
      console.log('Beginning user report: ' + JSON.stringify(userData))
      tweetData = getTweetData(node)
      console.log('Beginning tweet report: ' + JSON.stringify(tweetData))
    }
  }
})()
