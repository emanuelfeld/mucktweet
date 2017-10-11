(function () {
  'use strict'

  const DEBUG = false

  if (!!window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  let userData = {}
  let tweetData = {}

  function getUserData (node) {
    console.log('Parsing user data')
    return {
      'id': node.getAttribute('data-user-id'),
      'screenName': node.getAttribute('data-screen-name'),
      'name': node.getAttribute('data-name'),
      'status': 'available',
      'reportCount': 1,
      'reportDate': Date.now(),
      'updateDate': null
    }
  }

  function getTweetData (node) {
    console.log('Parsing tweet data')
    return {
      'id': node.getAttribute('data-tweet-id'),
      'userId': node.getAttribute('data-user-id'),
      'permalinkPath': node.getAttribute('data-permalink-path'),
      'status': 'available',
      'postDate': parseInt(node.querySelector('._timestamp').getAttribute('data-time-ms')),
      'reportDate': Date.now(),
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

  window.addEventListener('load', function (evt) {
    window.browser.runtime.sendMessage({'type': 'update'}, function (res) {
      console.log('Sent update message', res.content)
    })
  })

  document.addEventListener('click', function (evt) {
    console.log('Clicked', evt.target)
    if ((DEBUG && hasReportData()) || submittedReport(evt.target)) {
      console.log('Submitting user report:', JSON.stringify(userData))
      console.log('Submitting tweet report:', JSON.stringify(tweetData))
      window.browser.runtime.sendMessage({
        'type': 'report',
        'content': {
          'userData': userData,
          'tweetData': tweetData
        }
      }, function (res) {
        userData = {}
        tweetData = {}
        window.browser.runtime.sendMessage({'type': 'update'}, function (res) {
          console.log('Sent update messaage', res.content)
        })
      })
    } else if (beganReport(evt.target, 'user')) {
      let node = document.querySelector('.user-actions')
      if (node) {
        userData = getUserData(node)
        console.log('Beginning user report:', JSON.stringify(userData))
      }
    } else if (beganReport(evt.target, 'tweet')) {
      let node = evt.target.closest('.tweet')
      if (node) {
        userData = getUserData(node)
        console.log('Beginning user report:', JSON.stringify(userData))
        tweetData = getTweetData(node)
        console.log('Beginning tweet report:', JSON.stringify(tweetData))
      }
    }
  })
})()
